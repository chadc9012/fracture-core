extends RefCounted
## Raid 01 · The Hollow Star as rules (pure, no nodes; the web game's hollow-star-data.ts). Six encounters on the way down
## 3.8 km under Nexus City; the Godot build plays the first and the last: The Broken Gate (hold the gate while three
## stabilizer pylons charge, six waves of the void army) and The Hollow Star (Astravore, four phases). The fireteam is you
## and five bots, sharing the raid's lives; at zero lives the fireteam wipes and the encounter starts over. A cleared
## encounter is a checkpoint, kept in user://raids.json with the clears, so the lobby can resume at the boss.
##
## The gate: a pylon charges while a friendly stands in its ring and no enemy does; an enemy in the ring drains it.
## The boss: hp in percent; phases at 100 / 70 / 40 / 15. Phase II drops three conduits and the boss is shielded until
## all three are stable, while the overload gauge climbs; Phase IV exposes the core (double damage) and starts the
## machine's overload clock. A full gauge or an empty clock wipes the fireteam.

const SAVE := "user://raids.json"
const ID := "hollow-star"
const NAME := "Raid 01 · The Hollow Star"
const LIVES := 8
const FIRETEAM := 6

## every encounter, in order; `playable` are the ones built in Godot so far
const ENCOUNTERS := [
	{ "id": "broken-gate", "name": "The Broken Gate", "room": "Nexus Subway Gate", "objective": "Hold the gate while three stabilizer pylons come online", "playable": true },
	{ "id": "fallen-bridge", "name": "The Fallen Bridge", "room": "Collapsing Spans", "objective": "Cross the failing spans under fire", "playable": false },
	{ "id": "seal-chambers", "name": "The Seal Chambers", "room": "Three Sealed Vaults", "objective": "Split up and hold three seals", "playable": false },
	{ "id": "chrono-core", "name": "The Chrono Core", "room": "Conduit Hall", "objective": "Route the conduits, drop the shields", "playable": false },
	{ "id": "echo-realm", "name": "The Echo Realm", "room": "Mirror Dimensions", "objective": "Solve both halves, escape together", "playable": false },
	{ "id": "hollow-star-boss", "name": "The Hollow Star", "room": "Final Chamber · 3.8 km", "objective": "Break Astravore before the machine overloads", "playable": true },
]
const PHASES := [
	{ "name": "Phase I · Awakening", "at": 100.0, "call": "Spread for the beams, jump the rings, kill the guardians" },
	{ "name": "Phase II · Star Collapse", "at": 70.0, "call": "Stabilize all three conduits — the overload is climbing" },
	{ "name": "Phase III · Fractured Reality", "at": 40.0, "call": "Gravity's shifting — keep moving, watch the floor" },
	{ "name": "Phase IV · Final Stand", "at": 15.0, "call": "The core is exposed — burn it before the overload" },
]
## the void army: raid names over the trooper bodies (enemies.gd types)
const VOID := {
	"Void Reaver": "executor", "Void Vanguard": "elite", "Void Arcanist": "marksman", "Void Sentinel": "drone",
}
const GATE_WAVES := [
	["Void Reaver", "Void Reaver", "Void Vanguard"],
	["Void Reaver", "Void Reaver", "Void Reaver", "Void Arcanist"],
	["Void Vanguard", "Void Vanguard", "Void Reaver", "Void Sentinel"],
	["Void Reaver", "Void Reaver", "Void Arcanist", "Void Arcanist", "Void Sentinel"],
	["Void Vanguard", "Void Vanguard", "Void Vanguard", "Void Reaver", "Void Reaver"],
	["Void Vanguard", "Void Arcanist", "Void Arcanist", "Void Sentinel", "Void Sentinel", "Void Reaver"],
]
const PYLON_RATE := 1.0 / 22.0      # a held pylon fills in 22 s
const PYLON_DRAIN := 1.0 / 30.0
const BOSS_HP := 100.0
const OVERLOAD_RATE := 1.0 / 75.0   # phase II: 75 s to stabilize the conduits
const CONDUIT_RATE := 1.0 / 5.0     # a conduit holds after 5 s in its ring
const FINAL_CLOCK := 90.0           # phase IV: the machine overloads in 90 s

var encounter := "broken-gate"
var lives := LIVES
var wipes := 0
var time := 0.0
var cleared := false            # this encounter
var done := false               # the whole raid
# the gate
var pylons := [0.0, 0.0, 0.0]
var wave := 0                   # waves sent so far
# the boss
var boss_hp := BOSS_HP
var phase := 0
var conduits := [0.0, 0.0, 0.0]
var overload := 0.0
var clock := FINAL_CLOCK
var shielded := false

func _init(start := "broken-gate") -> void:
	begin(start)

func begin(id: String) -> void:
	encounter = id
	lives = LIVES
	time = 0.0
	cleared = false
	pylons = [0.0, 0.0, 0.0]
	wave = 0
	boss_hp = BOSS_HP
	phase = 0
	conduits = [0.0, 0.0, 0.0]
	overload = 0.0
	clock = FINAL_CLOCK
	shielded = false

static func encounter_def(id: String) -> Dictionary:
	for e in ENCOUNTERS:
		if e.id == id:
			return e
	return {}

## a fireteam member went down; true when that was the last life (the wipe)
func lose_life() -> bool:
	lives -= 1
	if lives <= 0:
		wipe()
		return true
	return false

func wipe() -> void:
	wipes += 1
	begin(encounter)

# --------------------------------------------------------------------------------------------- The Broken Gate
## one pylon's second: `friendly` someone of ours stands in its ring, `hostile` an enemy does
func tick_pylon(i: int, dt: float, friendly: bool, hostile: bool) -> void:
	if hostile:
		pylons[i] = maxf(0.0, pylons[i] - PYLON_DRAIN * dt)
	elif friendly:
		pylons[i] = minf(1.0, pylons[i] + PYLON_RATE * dt)

func pylons_online() -> int:
	var n := 0
	for p in pylons:
		if p >= 1.0:
			n += 1
	return n

## the next wave to send, or [] when all six are out
func next_wave() -> Array:
	if wave >= GATE_WAVES.size():
		return []
	var w: Array = GATE_WAVES[wave]
	wave += 1
	return w

## the gate holds when all three pylons are online and every wave has been sent and beaten (`alive` hostiles left)
func gate_check(alive: int) -> bool:
	if encounter != "broken-gate" or cleared:
		return false
	if pylons_online() == 3 and wave >= GATE_WAVES.size() and alive == 0:
		cleared = true
	return cleared

# --------------------------------------------------------------------------------------------- The Hollow Star
func phase_for(hp: float) -> int:
	var p := 0
	for i in PHASES.size():
		if hp <= float(PHASES[i].at) and i > p:
			p = i
	return p

## damage to Astravore; returns the damage that landed (none through the conduit shield, double on the exposed core)
func hit_boss(d: float) -> float:
	if encounter != "hollow-star-boss" or cleared or shielded:
		return 0.0
	var dealt := d * (2.0 if phase == 3 else 1.0)
	# each phase gate holds the boss at its threshold until the phase begins
	var floor_hp := 0.0
	if phase == 0:
		floor_hp = float(PHASES[1].at)
	elif phase == 1:
		floor_hp = float(PHASES[2].at)
	elif phase == 2:
		floor_hp = float(PHASES[3].at)
	boss_hp = maxf(floor_hp, boss_hp - dealt)
	var np := phase_for(boss_hp)
	if np > phase:
		_enter_phase(np)
	if boss_hp <= 0.0:
		cleared = true
	return dealt

func _enter_phase(p: int) -> void:
	phase = p
	if p == 1:
		shielded = true
		conduits = [0.0, 0.0, 0.0]
		overload = 0.0
	if p == 3:
		clock = FINAL_CLOCK

## a conduit's second in phase II: someone of ours in its ring
func tick_conduit(i: int, dt: float, friendly: bool) -> void:
	if phase != 1 or not shielded:
		return
	if friendly:
		conduits[i] = minf(1.0, conduits[i] + CONDUIT_RATE * dt)

func conduits_stable() -> int:
	var n := 0
	for c in conduits:
		if c >= 1.0:
			n += 1
	return n

## the raid's clock; returns "wipe" when the overload or the final clock takes the fireteam
func tick(dt: float) -> String:
	time += dt
	if encounter != "hollow-star-boss" or cleared:
		return ""
	if phase == 1 and shielded:
		if conduits_stable() == 3:
			shielded = false
			overload = 0.0
		else:
			overload += OVERLOAD_RATE * dt
			if overload >= 1.0:
				wipe()
				return "wipe"
	if phase == 3:
		clock -= dt
		if clock <= 0.0:
			wipe()
			return "wipe"
	return ""

# --------------------------------------------------------------------------------------------- saves and rewards
static func load_save() -> Dictionary:
	var out := { "clears": 0, "checkpoint": "", "best": 0.0 }
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary and d.get(ID) is Dictionary:
			out.merge(d[ID], true)
	return out

static func write_save(s: Dictionary) -> void:
	var all := {}
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			all = d
	all[ID] = s
	var w := FileAccess.open(SAVE, FileAccess.WRITE)
	if w:
		w.store_string(JSON.stringify(all))

## the reward for a full clear: the first clear carries the Hollow Star Lens and the Starbreaker title
static func reward(first: bool) -> Dictionary:
	if first:
		return { "nex": 2500, "xp": 2000, "item": "Hollow Star Lens", "title": "Starbreaker" }
	return { "nex": 1200, "xp": 1000, "item": "", "title": "" }
