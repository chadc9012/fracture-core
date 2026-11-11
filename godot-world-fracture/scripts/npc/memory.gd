extends RefCounted
## What Nexus City's people remember about you (people.gd), and the rules that change it. Node-free; the state is a
## Dictionary saved as user://npcs.json (a cloud FILES entry, so it follows you between devices):
##   { "people": { "<id>": { "affinity": -100..100, "met": bool, "talked": "YYYY-MM-DD", "log": [last events] } },
##     "notoriety": float, "notoriety_at": unix seconds, "warned": bool, "errand": {from, to, item, reward} or {} }
## Affinity bands: under 0 wary, 0-29 acquaintance, 30-59 friend, 60+ close friend. A first meeting is worth +5, a chat
## +3 once a day, a delivered errand +8 to both people; gunfire near them costs 2. All gains scale with personality.

const People := preload("res://scripts/npc/people.gd")
const PATH := "user://npcs.json"
const LOG_MAX := 6
const NOTORIETY_COP := 8.0          # a police officer comes over at this much
const NOTORIETY_DECAY := 1.0 / 600.0   # one point every ten minutes of real time
const FINE := 150

const ITEMS := [
	"a sealed envelope", "a spare key", "a phone charger", "a takeaway coffee", "a parcel of spark plugs", "a ticket stub",
	"a folded note", "a data chip", "a jacket left at the counter", "a bag of oranges",
]

static func blank() -> Dictionary:
	return { "people": {}, "notoriety": 0.0, "notoriety_at": 0, "warned": false, "errand": {} }

static func load_state() -> Dictionary:
	var f := FileAccess.open(PATH, FileAccess.READ)
	if not f:
		return blank()
	var d: Variant = JSON.parse_string(f.get_as_text())
	return tidy(d if d is Dictionary else {})

static func save_state(s: Dictionary) -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(s))

## fills in anything a save is missing (old saves, cloud copies)
static func tidy(s: Dictionary) -> Dictionary:
	var b := blank()
	for k in b:
		if not s.has(k):
			s[k] = b[k]
	if not (s.people is Dictionary):
		s.people = {}
	if not (s.errand is Dictionary):
		s.errand = {}
	return s

static func person(s: Dictionary, id: String) -> Dictionary:
	var all: Dictionary = s.people
	if not all.has(id):
		all[id] = { "affinity": 0, "met": false, "talked": "", "log": [] }
	return all[id]

static func affinity(s: Dictionary, id: String) -> int:
	return int(person(s, id).affinity)

static func band(a: int) -> String:
	if a < 0:
		return "wary"
	if a < 30:
		return "acquaintance"
	if a < 60:
		return "friend"
	return "close"

## change how someone feels about you (personality scales gains, not losses); notes why in their log
static func nudge(s: Dictionary, id: String, amount: float, why: String) -> int:
	var p := person(s, id)
	var who := People.by_id(id)
	var k: float = People.PERSONALITIES.get(String(who.get("personality", "warm")), 1.0) if amount > 0.0 else 1.0
	p.affinity = clampi(int(round(float(p.affinity) + amount * k)), -100, 100)
	var log: Array = p.log
	log.append(why)
	while log.size() > LOG_MAX:
		log.pop_front()
	return int(p.affinity)

## a conversation: the first ever is an introduction, then one chat a day counts
static func talk(s: Dictionary, id: String, today: String) -> String:
	var p := person(s, id)
	if not bool(p.met):
		p.met = true
		p.talked = today
		nudge(s, id, 5.0, "met")
		return "met"
	if String(p.talked) != today:
		p.talked = today
		nudge(s, id, 3.0, "chatted")
		return "chat"
	return "again"

# --------------------------------------------------------------------------------------------- errands
## today's errand from `from`, if they have one for you: someone else on the roster, a small item, a reward. Picked from
## the date so it's the same all day; none while they're wary of you or you already carry one.
static func errand_offer(s: Dictionary, from: String, today: String, present: Array) -> Dictionary:
	if not (s.errand as Dictionary).is_empty() or affinity(s, from) < 0 or not bool(person(s, from).met):
		return {}
	var h := absi(hash(from + today))
	if h % 3 == 0:
		return {}   # not everyone needs a hand every day
	var others: Array = present.filter(func(id): return id != from)
	if others.is_empty():
		return {}
	var pay := int(People.by_id(from).get("pay", 1))
	return { "from": from, "to": String(others[h % others.size()]), "item": String(ITEMS[(h / 3) % ITEMS.size()]), "reward": (40 + (h % 5) * 10) * pay }

static func take_errand(s: Dictionary, e: Dictionary) -> void:
	s.errand = e.duplicate()

## handing the item over: both like you more and the giver's reward is paid into `profile`
static func deliver(s: Dictionary, to: String, profile: Dictionary) -> Dictionary:
	var e: Dictionary = s.errand
	if e.is_empty() or String(e.to) != to:
		return {}
	nudge(s, to, 8.0, "delivered:" + String(e.from))
	nudge(s, String(e.from), 8.0, "errand:" + to)
	profile.nex = int(profile.get("nex", 0)) + int(e.reward)
	s.errand = {}
	return e

# --------------------------------------------------------------------------------------------- notoriety and the law
## notoriety as of `now`, decayed for the real time since it was last touched
static func notoriety(s: Dictionary, now: int) -> float:
	var at := int(s.get("notoriety_at", 0))
	var n := float(s.get("notoriety", 0.0))
	if at > 0 and now > at:
		n = maxf(0.0, n - float(now - at) * NOTORIETY_DECAY)
	return n

static func add_notoriety(s: Dictionary, amount: float, now: int) -> float:
	s.notoriety = notoriety(s, now) + amount
	s.notoriety_at = now
	return float(s.notoriety)

## shots fired on the avenue: notoriety, and everyone named within earshot thinks less of you
static func gunfire(s: Dictionary, near_ids: Array, now: int) -> void:
	add_notoriety(s, 1.0, now)
	for id in near_ids:
		nudge(s, String(id), -2.0, "scared")

## what an officer does when they reach you: "none" under the threshold; a "warning" the first time or from an officer
## who likes you; otherwise a "fine". Either way the slate is wiped.
static func police_verdict(s: Dictionary, officer: String, now: int) -> String:
	if notoriety(s, now) < NOTORIETY_COP:
		return "none"
	var verdict := "fine"
	if not bool(s.get("warned", false)) or affinity(s, officer) >= 30:
		verdict = "warning"
	s.warned = true
	s.notoriety = 0.0
	s.notoriety_at = now
	nudge(s, officer, -1.0 if verdict == "fine" else 0.0, verdict)
	return verdict

static func pay_fine(profile: Dictionary) -> int:
	var paid := mini(FINE, int(profile.get("nex", 0)))
	profile.nex = int(profile.get("nex", 0)) - paid
	return paid
