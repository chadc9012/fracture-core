extends RefCounted
## Street racing life (owner, Nov 11: "racing like GTA and Need for Speed had a baby"): the reputation ladder from UNKNOWN to
## LEGEND, the races each city holds on its streets, what they pay, what a bust costs, and the heat of a police pursuit.
## Neon City is the underground capital (illegal midnight runs, drift battles, outlaw rings, the Ghost); Nexus City is the
## professional capital (sanctioned cups and the Grand Prix, plus one outlaw highway run); the coast has a sprint and a
## rush. Legal races close the road and never draw the police; illegal ones start the heat. Saved to street_career.json.
## Pure, no nodes.

const SAVE_PATH := "user://street_career.json"

## the ladder (the owner's table): reputation needed, and what it opens
const TIERS := [
	{ "name": "UNKNOWN", "rep": 0, "line": "Local street races" },
	{ "name": "ROOKIE", "rep": 250, "line": "Small underground events" },
	{ "name": "STREET RACER", "rep": 800, "line": "City tournaments" },
	{ "name": "OUTLAW", "rep": 2000, "line": "High-stakes illegal races" },
	{ "name": "ELITE", "rep": 4500, "line": "Supercar championships" },
	{ "name": "LEGEND", "rep": 9000, "line": "Exclusive crews and legendary rivals" },
]

## the races found on each city's avenue. `at`: where the meet stands (z on the avenue, the hub block is -130..130);
## kind "sprint" (z0 -> z1), "loop" (z_hi..z_lo, `laps`) or "drift" (a loop scored on slides against `targets`);
## `tier`: the ladder rung it needs; `heat`: the pursuit level an illegal race starts at; prize and rep by place.
## Lengths are the avenue's (it runs ~1.8 km); the owner's full-scale Track Pack 01 tracks are venues of their own
## (track_pack.gd, in Game Modes → Races), so the avenue races carry their own names.
const EVENTS := {
	"neon-backstreet": { "name": "Backstreet Dash", "city": "neon", "at": 60.0, "tier": 0, "legal": false, "heat": 1,
		"kind": "sprint", "z0": 60.0, "z1": -840.0, "rivals": ["Vex", "Kilo"], "skill": 0.8,
		"prize": [700, 350, 150], "rep": [120, 70, 40] },
	"neon-midnight": { "name": "Midnight Avenue Run", "city": "neon", "at": 20.0, "tier": 1, "legal": false, "heat": 1,
		"kind": "loop", "z_hi": 840.0, "z_lo": -840.0, "laps": 1, "rivals": ["Vex", "Nightjar", "Kilo"], "skill": 0.86,
		"prize": [1500, 800, 400, 150], "rep": [260, 150, 90, 40] },
	"neon-drift": { "name": "Neon Drift Battle", "city": "neon", "at": -20.0, "tier": 2, "legal": false, "heat": 1,
		"kind": "drift", "z_hi": 320.0, "z_lo": -320.0, "laps": 2, "targets": [9000, 6000, 3500], "rivals": ["Ryu", "Sable", "Kilo"],
		"prize": [1800, 900, 400, 150], "rep": [320, 180, 100, 40] },
	"neon-ring": { "name": "Neon Avenue Ring", "city": "neon", "at": -60.0, "tier": 3, "legal": false, "heat": 2,
		"kind": "loop", "z_hi": 860.0, "z_lo": -860.0, "laps": 3, "rivals": ["Nightjar", "Vex", "Sable"], "skill": 0.92,
		"prize": [5000, 2500, 1200, 400], "rep": [650, 380, 220, 90] },
	"neon-ghost": { "name": "Ghost's Crown", "city": "neon", "at": -110.0, "tier": 4, "legal": false, "heat": 3,
		"kind": "loop", "z_hi": 860.0, "z_lo": -860.0, "laps": 3, "rivals": ["Ghost", "Nightjar", "Vex"], "skill": 0.97,
		"prize": [12000, 5000, 2000, 600], "rep": [2400, 900, 400, 150], "boss": "Ghost" },
	"nexus-avenue-cup": { "name": "Avenue Cup", "city": "nexus", "at": 60.0, "tier": 0, "legal": true,
		"kind": "loop", "z_hi": 420.0, "z_lo": -420.0, "laps": 2, "rivals": ["K. Voss", "Mara Lin", "D. Okafor"], "skill": 0.82,
		"prize": [600, 300, 150, 60], "rep": [100, 60, 40, 20] },
	"nexus-tournament": { "name": "Nexus City Tournament", "city": "nexus", "at": 20.0, "tier": 2, "legal": true,
		"kind": "loop", "z_hi": 860.0, "z_lo": -860.0, "laps": 2, "rivals": ["K. Voss", "Mara Lin", "D. Okafor"], "skill": 0.9,
		"prize": [3000, 1500, 700, 250], "rep": [380, 220, 130, 50] },
	"nexus-outlaw": { "name": "Outlaw Avenue Run", "city": "nexus", "at": -20.0, "tier": 3, "legal": false, "heat": 2,
		"kind": "loop", "z_hi": 860.0, "z_lo": -860.0, "laps": 2, "rivals": ["Rook", "Sable", "Kilo"], "skill": 0.92,
		"prize": [4500, 2200, 1000, 350], "rep": [600, 350, 200, 80] },
	"nexus-grand-prix": { "name": "Nexus Supercar Championship", "city": "nexus", "at": -60.0, "tier": 4, "legal": true,
		"kind": "loop", "z_hi": 860.0, "z_lo": -860.0, "laps": 4, "rivals": ["K. Voss", "Mara Lin", "D. Okafor"], "skill": 0.96,
		"prize": [10000, 5000, 2500, 800], "rep": [1500, 800, 450, 150] },
	"coast-boardwalk": { "name": "Boardwalk Sprint", "city": "coast", "at": 60.0, "tier": 0, "legal": false, "heat": 1,
		"kind": "sprint", "z0": 60.0, "z1": 840.0, "rivals": ["Marlin", "Juno"], "skill": 0.8,
		"prize": [650, 320, 140], "rep": [110, 65, 35] },
	"coast-rush": { "name": "Coastline Rush", "city": "coast", "at": 20.0, "tier": 1, "legal": true,
		"kind": "loop", "z_hi": 840.0, "z_lo": -840.0, "laps": 2, "rivals": ["Marlin", "Juno", "Reef"], "skill": 0.86,
		"prize": [1600, 800, 400, 150], "rep": [240, 140, 80, 30] },
}

## where it saves (tests point it elsewhere)
var path := SAVE_PATH
var rep := 0
var wins := 0
var races := 0
var busts := 0
var escapes := 0
## event id -> best finishing place
var best := {}

static func tier_index(r: int) -> int:
	var t := 0
	for i in TIERS.size():
		if r >= int(TIERS[i].rep):
			t = i
	return t

static func tier_named(name: String) -> int:
	for i in TIERS.size():
		if String(TIERS[i].name) == name.to_upper():
			return i
	return 0

func tier() -> int:
	return tier_index(rep)

func tier_name() -> String:
	return String(TIERS[tier()].name)

## "ROOKIE 380 / 800" — the rung, and how far to the next
func ladder_line() -> String:
	var t := tier()
	if t >= TIERS.size() - 1:
		return "%s · %d rep" % [tier_name(), rep]
	return "%s · %d / %d to %s" % [tier_name(), rep, int(TIERS[t + 1].rep), String(TIERS[t + 1].name)]

static func event(id: String) -> Dictionary:
	return EVENTS.get(id, {})

static func events_for(city: String) -> Array:
	var out: Array = []
	for id in EVENTS:
		if String(EVENTS[id].city) == city:
			out.append(id)
	return out

func unlocked(id: String) -> bool:
	var ev := event(id)
	return not ev.is_empty() and tier() >= int(ev.tier)

## the paid result of a finish: {nex, rep, tier_up ("" or the new rung's name)}; `entrants` counts the player
func finish(id: String, place: int, ev_override := {}) -> Dictionary:
	var ev: Dictionary = ev_override if not ev_override.is_empty() else event(id)
	var prize: Array = ev.get("prize", [0])
	var reps: Array = ev.get("rep", [0])
	var i := clampi(place - 1, 0, prize.size() - 1)
	var before := tier()
	var got := { "nex": int(prize[i]), "rep": int(reps[mini(i, reps.size() - 1)]), "tier_up": "" }
	rep += got.rep
	races += 1
	if place == 1:
		wins += 1
	if id != "" and (not best.has(id) or place < int(best[id])):
		best[id] = place
	if tier() > before:
		got.tier_up = tier_name()
	return got

## a bust: the fine (no more than the player holds) and the reputation lost, by the heat it happened at
func busted(level: int, holding_nex: int) -> Dictionary:
	busts += 1
	var lost := 80 * maxi(1, level)
	rep = maxi(0, rep - lost)
	return { "fine": mini(maxi(0, holding_nex), 400 * maxi(1, level)), "rep": lost }

## shaking the police off pays in reputation
func escaped(level: int) -> int:
	escapes += 1
	var got := 40 * maxi(1, level)
	rep += got
	return got

func to_dict() -> Dictionary:
	return { "rep": rep, "wins": wins, "races": races, "busts": busts, "escapes": escapes, "best": best }

func from_dict(d: Dictionary) -> void:
	rep = maxi(0, int(d.get("rep", 0)))
	wins = int(d.get("wins", 0))
	races = int(d.get("races", 0))
	busts = int(d.get("busts", 0))
	escapes = int(d.get("escapes", 0))
	var b: Variant = d.get("best", {})
	best = b if b is Dictionary else {}

func save() -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(to_dict()))

static func load_or_fresh(from := SAVE_PATH) -> RefCounted:
	var c: RefCounted = load("res://scripts/racing/street_career.gd").new()
	c.path = from
	var f := FileAccess.open(from, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			c.from_dict(d)
	return c

## The heat of a pursuit: level 1..5 (0 is no pursuit). Seen by a unit, the chase goes on and every ESCALATE seconds it
## climbs a level; out of sight long enough (half as long hidden in a court or an alley) the police lose you; held slow
## with a unit alongside for BUST_HOLD seconds, you're busted. `step` says what happened: "", "up", "escaped", "busted".
class Heat:
	const ESCALATE := 35.0
	const BUST_HOLD := 3.0
	var level := 0
	var last_level := 0
	var pursuit := 0.0
	var unseen := 0.0
	var bust := 0.0

	func active() -> bool:
		return level > 0

	func start(l: int) -> void:
		level = clampi(maxi(level, l), 0, 5)
		pursuit = 0.0
		unseen = 0.0
		bust = 0.0

	func cool_needed() -> float:
		return 6.0 + 3.0 * level

	func step(dt: float, seen: bool, pinned: bool, hiding: bool) -> String:
		if level <= 0:
			return ""
		bust = (bust + dt) if pinned else maxf(0.0, bust - dt * 2.0)
		if bust >= BUST_HOLD:
			last_level = level
			level = 0
			bust = 0.0
			return "busted"
		if seen:
			unseen = 0.0
			pursuit += dt
			if pursuit >= ESCALATE and level < 5:
				level += 1
				pursuit = 0.0
				return "up"
			return ""
		unseen += dt * (2.0 if hiding else 1.0)
		if unseen >= cool_needed():
			last_level = level
			level = 0
			return "escaped"
		return ""
