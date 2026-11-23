extends RefCounted
## Vyrak, the Sky Sovereign — a Unique in the Shangri-La Frontier sense (owner, Nov 23: "Vyrak needs to be a unique encounter
## i hate that he keeps being brought up", then "Think Shanghai-la frontier": secret conditions, world-first + unique loot,
## the Ashen Mark on a loss, both games). The web game's rules are src/game/sky-sovereign.ts; this mirrors them, node-free.
##  - Nothing mentions him: no clue, no lead, no journal entry until met (unique_encounters.json U09 has `unique: true` and no
##    clues). He comes down only when the operator is ALONE (free roam, no mission, nobody online in the region), ON FOOT,
##    LEVEL 12+, at NIGHT and has stood in the Ribcage crater for DWELL seconds. Solara is drawn in daylight here, so night is
##    the device's own clock (20:00–05:00): you have to be out there at night for real. Nobody is told any of this.
##  - A loss (the operator goes down mid-fight) does not reset him: he climbs back into the dark and brands the Ashen Mark —
##    ash streaks on the left shoulder (character_rig.gd `ashen_mark`). It lasts until he falls.
##  - A kill is once per profile: Encounters.clear pays the Nex / XP / Dragonite, plus the title and the kill stamp
##    `profile.unique_slain.vyrak = {at, callsign}` that rides the cloud save (data.godot.profile) to the web's
##    /api/world-firsts, which crowns the earliest kill across every save.

const ID := "vyrak"
const MISSION := "U09"
const WORLD := "solara"
const LAIR := "ribcage"
const RADIUS := 45.0        # metres from the Ribcage POI
const DWELL := 12.0         # seconds the conditions must hold, unbroken
const MIN_LEVEL := 12
const NIGHT_FROM := 20      # device clock: 20:00 …
const NIGHT_TO := 5         # … to 05:00
const MARK := "ashen-mark:vyrak"
const SLAIN := "unique-slain:vyrak"
const SEEN_FIRST := "world-first-seen:vyrak"
const TITLE := "Sky Sovereign's Equal"
## the web game's published host, which serves /api/world-firsts
const WEB := "https://world-fracture.lovable.app"
const BRAND_LINES := [
	"VYRAK: You lived. Carry that, little spark. I will know you when I see you again.",
	"The Sky Sovereign climbs back into the dark. Ash has burned into your armor, and it will not wipe off.",
]
const REMARKS := [
	"That ash on your plates — it's still warm. Where have you been?",
	"Don't stand so close. My grandmother said ash like that comes down from the Glass Flats at night.",
	"You've got the look of someone something let go. Don't push your luck twice.",
	"Old rangers had a word for marks like yours. They didn't say it out loud.",
]

## tests set this to an hour to stand in for the device's clock
static var hour_override := -1
## night by the device's clock (pass an hour to test)
static func is_night(hour := -1) -> bool:
	var h := hour if hour >= 0 else (hour_override if hour_override >= 0 else int(Time.get_datetime_dict_from_system().hour))
	return h >= NIGHT_FROM or h < NIGHT_TO

## c = {dist, night, level, on_foot, alone}
static func conditions_met(c: Dictionary) -> bool:
	return float(c.get("dist", 1e9)) <= RADIUS and bool(c.get("night", false)) and int(c.get("level", 0)) >= MIN_LEVEL \
		and bool(c.get("on_foot", false)) and bool(c.get("alone", false))

static func new_watch() -> Dictionary:
	return { "held": 0.0, "called": false }

## true exactly once, the tick the conditions have held for DWELL; any break resets the count. Once called it stays quiet
## until the operator has left the crater (twice the radius), so a fight that ends never re-summons on the spot.
static func step(w: Dictionary, c: Dictionary, dt: float, slain: bool) -> bool:
	if slain:
		w.held = 0.0
		return false
	if bool(w.called):
		if float(c.get("dist", 0.0)) > RADIUS * 2.0:
			w.called = false
			w.held = 0.0
		return false
	if not conditions_met(c):
		w.held = 0.0
		return false
	w.held = float(w.held) + maxf(0.0, dt)
	if float(w.held) < DWELL:
		return false
	w.called = true
	w.held = 0.0
	return true

# ------------------------------------------------------------------------------------------------ the profile
static func _keys(p: Dictionary) -> Array:
	if not (p.get("enc") is Array):
		p["enc"] = []
	return p.enc

static func has_key(p: Dictionary, k: String) -> bool:
	return p.get("enc") is Array and (p.enc as Array).has(k)

static func is_slain(p: Dictionary) -> bool:
	return has_key(p, SLAIN)

static func is_marked(p: Dictionary) -> bool:
	return has_key(p, MARK) and not is_slain(p)

static func has_met(p: Dictionary) -> bool:
	return is_slain(p) or has_key(p, MARK)

## a loss: brands once (never after the kill). True when it branded.
static func brand(p: Dictionary) -> bool:
	if is_slain(p) or has_key(p, MARK):
		return false
	_keys(p).append(MARK)
	return true

## the kill, once per profile: the stamp, the title and the key (Encounters.clear pays the Nex / XP / Dragonite)
static func slay(p: Dictionary, callsign: String, now_ms: int) -> bool:
	if is_slain(p):
		return false
	_keys(p).append(SLAIN)
	var sign := callsign.strip_edges().to_upper().left(16)
	if sign == "":
		sign = "OPERATOR"
	var us: Dictionary = p.get("unique_slain", {}) if p.get("unique_slain") is Dictionary else {}
	us[ID] = { "at": now_ms, "callsign": sign }
	p["unique_slain"] = us
	var titles: Array = p.get("titles", []) if p.get("titles") is Array else []
	if not titles.has(TITLE):
		titles.append(TITLE)
	p["titles"] = titles
	return true

static func slain_at(p: Dictionary) -> Dictionary:
	var us: Variant = p.get("unique_slain", {})
	return (us as Dictionary).get(ID, {}) if us is Dictionary else {}

# ------------------------------------------------------------------------------------------------ the world-first
## the banner after a kill: the world's first if nobody on record fell him earlier. `first` is {} or {callsign, at}.
static func banner(first: Dictionary, mine: Dictionary) -> String:
	if first.is_empty() or float(first.get("at", 0)) >= float(mine.get("at", 0)):
		return "WORLD FIRST · %s has slain a Unique: Vyrak, the Sky Sovereign" % String(mine.get("callsign", "OPERATOR"))
	return "UNIQUE SLAIN · Vyrak, the Sky Sovereign — the world's first fell to %s" % String(first.get("callsign", "OPERATOR"))

## everyone else sees it once; the slayer does not
static func announcement(p: Dictionary, first: Dictionary) -> String:
	if first.is_empty() or has_key(p, SEEN_FIRST):
		return ""
	var mine := slain_at(p)
	if not mine.is_empty() and float(mine.get("at", 0)) <= float(first.get("at", 0)):
		return ""
	return "WORLD ANNOUNCEMENT · %s has slain a Unique: Vyrak, the Sky Sovereign" % String(first.get("callsign", "OPERATOR"))

static func mark_seen(p: Dictionary) -> void:
	if not has_key(p, SEEN_FIRST):
		_keys(p).append(SEEN_FIRST)

## parse /api/world-firsts' body: {} when there is no first or the body is not what it should be
static func parse_first(body: String) -> Dictionary:
	var j: Variant = JSON.parse_string(body)
	if not (j is Dictionary) or not ((j as Dictionary).get("first") is Dictionary):
		return {}
	var f: Dictionary = j.first
	if float(f.get("at", 0)) <= 0.0:
		return {}
	return { "at": float(f.at), "callsign": String(f.get("callsign", "OPERATOR")) }

## asks the web for the world's first kill (null-safe: {} offline / unpublished / any failure). `owner` hosts the request.
static func fetch_first(owner: Node) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 8.0
	owner.add_child(http)
	if http.request(WEB + "/api/world-firsts?id=" + ID) != OK:
		http.queue_free()
		return {}
	var res: Array = await http.request_completed
	http.queue_free()
	if int(res[0]) != HTTPRequest.RESULT_SUCCESS or int(res[1]) != 200:
		return {}
	return parse_first((res[3] as PackedByteArray).get_string_from_utf8())
