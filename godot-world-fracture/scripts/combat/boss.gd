extends RefCounted
## Fracture creatures & bosses (asset catalog): the six on the owner's board as one rule set, pure and headless-testable,
## with the web game's boss systems ported — three escalating phases (boss-phases.ts: ENGAGED / OVERDRIVEN / OVERLOADED by
## hull fraction, speed / damage / cooldown multipliers), poise and the stagger punish window (boss-poise.ts: sustained hits
## build poise at POISE_PER_DAMAGE, decaying 4/s; POISE_MAX breaks it into a 4 s stagger where hits do ×2.25; a phase change
## opens a 5 s weak point at ×1.6; no poise builds for 6 s after a stagger), and an attack cycle per boss: a telegraph,
## then the attack (LUNGE melee, VOLLEY of bolts, SLAM shockwave, SUMMON adds, BREATH cone), then a cooldown. Hull is the
## web's regional boss hull (360) × the row's `hull` × 10 for Godot's damage units.

const POISE_MAX := 100.0
const POISE_PER_DAMAGE := 1.6
const POISE_DECAY := 4.0
const POISE_REFRACTORY := 6.0
const STAGGER := 4.0
const WEAK_POINT := 5.0
const WEAK_MULT := 1.6
const STAGGER_MULT := 2.25
const BASE_HULL := 360.0 * 10.0

const PHASES := [
	{ "label": "ENGAGED", "telegraph": "Reading your approach.", "speed": 1.0, "damage": 1.0, "cooldown": 1.0 },
	{ "label": "OVERDRIVEN", "telegraph": "Systems overdriving — faster, harder hits.", "speed": 1.2, "damage": 1.3, "cooldown": 0.85 },
	{ "label": "OVERLOADED", "telegraph": "Critical overload — maximum output, slower recovery.", "speed": 1.4, "damage": 1.6, "cooldown": 1.3 },
]

## the board's six. `model` under models/bosses (the authored boss / elite hulls — see docs/asset-catalog.md for which
## family each reads as); `size` metres tall; `attacks` cycle in order; `adds` the enemies.gd type the SUMMON brings and
## how many; `reward` Nex / XP on a first clear (the web's regional boss pays 900 / 600, the world boss 2500 / 1500)
const BOSSES := {
	"rift-hound": { "name": "Rift Hound", "model": "frost-wolf.glb", "size": 2.6, "hull": 0.6, "speed": 8.5, "range": 2.4, "attacks": ["LUNGE", "LUNGE", "VOLLEY"], "adds": ["scout", 0], "reward": [600, 400],
		"blurb": "A pack hunter from the first rifts, all teeth and speed. It lunges, circles and lunges again." },
	"crystal-stalker": { "name": "Crystal Stalker", "model": "aberration-elite.glb", "size": 3.2, "hull": 0.8, "speed": 5.5, "range": 14.0, "attacks": ["VOLLEY", "LUNGE", "VOLLEY", "SLAM"], "adds": ["drone", 2], "reward": [800, 500],
		"blurb": "Grown from the Crystal Badlands. It fires shards from range and shatters the ground when you close." },
	"abyssal-leviathan": { "name": "Abyssal Leviathan", "model": "abyssal-boss.glb", "size": 7.0, "hull": 1.4, "speed": 4.0, "range": 18.0, "attacks": ["BREATH", "SLAM", "VOLLEY", "SUMMON"], "adds": ["scout", 3], "reward": [1200, 800],
		"blurb": "The Drowned Crown's keeper, dragged up from the Thalassia trenches. A tide of pressure and brine." },
	"vyrak": { "name": "Vyrak, the Ashen Covenant", "model": "skyborn-boss.glb", "size": 4.0, "hull": 1.2, "speed": 6.5, "range": 16.0, "attacks": ["BREATH", "VOLLEY", "LUNGE", "SUMMON"], "adds": ["marksman", 2], "reward": [1400, 900],
		"blurb": "The Covenant's winged herald. Fire from above, then it drops onto you with its blades." },
	"astravore": { "name": "Astravore", "model": "aberration-boss.glb", "size": 6.0, "hull": 1.8, "speed": 3.5, "range": 20.0, "attacks": ["SUMMON", "VOLLEY", "SLAM", "BREATH"], "adds": ["elite", 2], "reward": [2000, 1200],
		"blurb": "The Hollow Star raid's heart. It calls its brood, then bathes the ground in starfire." },
	"colossus": { "name": "Rust Colossus", "model": "guardian-boss.glb", "size": 9.0, "hull": 2.4, "speed": 2.6, "range": 6.0, "attacks": ["SLAM", "LUNGE", "SLAM", "SUMMON"], "adds": ["executor", 2], "reward": [2500, 1500],
		"blurb": "Grid-Iron Flats' world boss, a walking foundry. Every step is a shockwave; the core glows when it staggers." },
}

## attack timings (s) and effects: telegraph before, cooldown after; damage in the operator's hull units (enemies.gd damage
## scale), `radius` for area hits, `bolts` for volleys
const ATTACKS := {
	"LUNGE": { "telegraph": 0.7, "cooldown": 1.6, "damage": 22.0, "radius": 3.2, "reach": 6.0 },
	"VOLLEY": { "telegraph": 0.9, "cooldown": 2.0, "damage": 9.0, "bolts": 5, "spread": 0.12 },
	"SLAM": { "telegraph": 1.1, "cooldown": 2.6, "damage": 30.0, "radius": 9.0 },
	"BREATH": { "telegraph": 1.0, "cooldown": 2.8, "damage": 6.0, "duration": 2.0, "cone": 0.5, "reach": 22.0 },
	"SUMMON": { "telegraph": 1.2, "cooldown": 3.5, "damage": 0.0 },
}

enum Step { APPROACH, TELEGRAPH, ATTACK, COOLDOWN, STAGGERED, DEAD }

var id := ""
var def: Dictionary
var hull := 0.0
var hull_max := 0.0
var poise := 0.0
var stagger_until := -100.0
var weak_until := -100.0
var phase := 0
var step := Step.APPROACH
var attack := ""
var attack_i := 0
var timer := 0.0
var clock := 0.0
var attack_t := 0.0       # time inside the current ATTACK (breath lasts)
var dead := false
## events for the view, drained each frame: {"kind": "phase"|"stagger"|"recover"|"telegraph"|"attack"|"summon"|"dead", ...}
var events: Array = []
var summoned := 0

func _init(boss_id: String) -> void:
	id = boss_id
	def = BOSSES[boss_id]
	hull_max = BASE_HULL * float(def.hull)
	hull = hull_max

func tuning() -> Dictionary:
	return PHASES[phase]

func staggered() -> bool:
	return clock < stagger_until

func weak_point() -> bool:
	return not staggered() and clock < weak_until

static func phase_for(fraction: float) -> int:
	if fraction <= 0.3:
		return 2
	if fraction <= 0.66:
		return 1
	return 0

## a hit from the operator: returns the damage dealt after the weak-point / stagger multipliers
func hit(damage: float) -> float:
	if dead:
		return 0.0
	var mult := STAGGER_MULT if staggered() else (WEAK_MULT if weak_point() else 1.0)
	var dealt := damage * mult
	hull = maxf(0.0, hull - dealt)
	# poise: never during a stagger, nor in the refractory after one
	if not staggered() and clock >= stagger_until + POISE_REFRACTORY:
		poise += damage * POISE_PER_DAMAGE
		if poise >= POISE_MAX:
			poise = 0.0
			stagger_until = clock + STAGGER
			weak_until = clock + STAGGER
			step = Step.STAGGERED
			timer = STAGGER
			attack_t = 0.0
			events.append({ "kind": "stagger" })
	var want := phase_for(hull / hull_max)
	if want != phase:
		phase = want
		weak_until = maxf(weak_until, clock + WEAK_POINT)
		events.append({ "kind": "phase", "phase": phase, "label": String(PHASES[phase].label), "telegraph": String(PHASES[phase].telegraph) })
	if hull <= 0.0 and not dead:
		dead = true
		step = Step.DEAD
		events.append({ "kind": "dead" })
	return dealt

## one frame: `dist` to the operator. The view moves the body (APPROACH closes at speed × phase; everything else stands
## or turns) and applies the attack events it is handed.
func tick(dt: float, dist: float) -> void:
	if dead:
		return
	clock += dt
	if not staggered() and poise > 0.0:
		poise = maxf(0.0, poise - POISE_DECAY * dt)
	var t := tuning()
	match step:
		Step.STAGGERED:
			timer -= dt
			if timer <= 0.0:
				step = Step.COOLDOWN
				timer = 0.6
				events.append({ "kind": "recover" })
		Step.APPROACH:
			var next: String = def.attacks[attack_i % (def.attacks as Array).size()]
			var reach: float = float(def.range) if next in ["VOLLEY", "BREATH", "SUMMON"] else float(ATTACKS[next].get("reach", def.range))
			if dist <= reach or next == "SUMMON":
				attack = next
				step = Step.TELEGRAPH
				timer = float(ATTACKS[attack].telegraph) / float(t.speed)
				events.append({ "kind": "telegraph", "attack": attack, "seconds": timer })
		Step.TELEGRAPH:
			timer -= dt
			if timer <= 0.0:
				step = Step.ATTACK
				attack_t = 0.0
				var a: Dictionary = ATTACKS[attack]
				events.append({ "kind": "attack", "attack": attack, "damage": float(a.damage) * float(t.damage), "radius": float(a.get("radius", 0.0)), "bolts": int(a.get("bolts", 0)), "reach": float(a.get("reach", def.range)), "cone": float(a.get("cone", 0.0)) })
				if attack == "SUMMON":
					var n := int(def.adds[1]) + phase
					summoned += n
					events.append({ "kind": "summon", "type": String(def.adds[0]), "count": n })
				timer = float(ATTACKS[attack].get("duration", 0.15))
		Step.ATTACK:
			attack_t += dt
			timer -= dt
			if timer <= 0.0:
				step = Step.COOLDOWN
				timer = float(ATTACKS[attack].cooldown) * float(t.cooldown)
				attack_i += 1
		Step.COOLDOWN:
			timer -= dt
			if timer <= 0.0:
				step = Step.APPROACH

## the view asks: should the body close in this frame, and how fast
func move_speed() -> float:
	if dead or staggered():
		return 0.0
	if step == Step.APPROACH:
		return float(def.speed) * float(tuning().speed)
	if step == Step.COOLDOWN:
		return float(def.speed) * 0.35
	return 0.0

func drain() -> Array:
	var out := events
	events = []
	return out

func reward() -> Dictionary:
	return { "nex": int(def.reward[0]), "xp": int(def.reward[1]) }
