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

## the 18 hidden unique encounters (tools/campaign/unique/encounters.py → unique_encounter.gd): their hulls, on the
## authored boss models already in models/bosses (no new models). Vyrak and the Abyssal Leviathan fight on the rows
## above. `reward` here is only the fallback: the encounter pays its own (encounters.gd `clear`).
const UNIQUE := {
	"unbroken-glass": { "name": "The Unbroken Glass", "model": "aberration-elite.glb", "size": 4.2, "hull": 0.9, "speed": 3.0, "range": 16.0, "attacks": ["VOLLEY", "SPIKES", "SLAM", "VOLLEY"], "adds": ["drone", 2], "reward": [600, 400],
		"blurb": "A standing wave of glass that takes a body only to hold its song together." },
	"system-core": { "name": "The System Core", "model": "aberration-boss.glb", "size": 5.0, "hull": 1.3, "speed": 2.0, "range": 18.0, "attacks": ["VOLLEY", "SUMMON", "SPIKES", "BREATH"], "adds": ["drone", 3], "reward": [1200, 800],
		"blurb": "The Deepmind's real core, risen from under the Research District." },
	"rime-alpha": { "name": "Rime Alpha", "model": "frost-wolf.glb", "size": 3.2, "hull": 0.95, "speed": 9.0, "range": 2.6, "attacks": ["LUNGE", "SWEEP", "LUNGE", "CHARGE"], "adds": ["scout", 2], "reward": [900, 600],
		"blurb": "A crystal-coated alpha that fed on the Frostspire's cryo seams." },
	"dark-knight": { "name": "The Dark Knight", "model": "dark-knight.glb", "size": 2.9, "hull": 1.0, "speed": 5.0, "range": 3.0, "attacks": ["LUNGE", "SWEEP", "CHARGE", "VOLLEY"], "adds": ["executor", 1], "reward": [1000, 700],
		"blurb": "Commander Serik Vale, still holding the vault door." },
	"hollow-saint": { "name": "The Hollow Saint", "model": "aberration-elite.glb", "size": 3.6, "hull": 1.05, "speed": 3.5, "range": 14.0, "attacks": ["VOLLEY", "SUMMON", "BREATH", "SPIKES"], "adds": ["scout", 2], "reward": [1100, 750],
		"blurb": "A celestial echo wearing a dead sister's name." },
	"drowned-monarch": { "name": "The Drowned Monarch", "model": "abyssal-boss.glb", "size": 5.5, "hull": 1.25, "speed": 3.2, "range": 9.0, "attacks": ["SLAM", "SWEEP", "BREATH", "CHARGE"], "adds": ["scout", 2], "reward": [1300, 850],
		"blurb": "A king of the sunken ark, still holding court." },
	"vaelith": { "name": "Vaelith", "model": "skyborn-boss.glb", "size": 5.5, "hull": 1.4, "speed": 5.0, "range": 18.0, "attacks": ["BREATH", "SLAM", "CHARGE", "BREATH"], "adds": ["scout", 0], "reward": [0, 900],
		"blurb": "The Dragon Who Remembers. Its first trial cannot be won by killing." },
	"red-ronin": { "name": "The Red Ronin", "model": "dark-knight.glb", "size": 2.4, "hull": 0.85, "speed": 7.5, "range": 2.6, "attacks": ["CHARGE", "SWEEP", "LUNGE", "CHARGE"], "adds": ["scout", 0], "reward": [1000, 700],
		"blurb": "A masterless blade that cuts shots out of the air." },
	"hollow-colossus": { "name": "The Hollow Colossus", "model": "guardian-boss.glb", "size": 10.0, "hull": 1.6, "speed": 2.2, "range": 7.0, "attacks": ["SLAM", "SLAM", "CHARGE", "SPIKES"], "adds": ["executor", 1], "reward": [1500, 900],
		"blurb": "A sleeper the size of a city block, holding the ruins up." },
	"exiled-architect": { "name": "The Exiled Architect", "model": "dark-knight.glb", "size": 2.8, "hull": 1.1, "speed": 4.0, "range": 14.0, "attacks": ["SUMMON", "VOLLEY", "SPIKES", "LUNGE"], "adds": ["drone", 2], "reward": [1400, 850],
		"blurb": "An engineer who redraws walls, doors and constructs." },
	"verdant-sovereign": { "name": "The Verdant Sovereign", "model": "guardian-boss.glb", "size": 7.0, "hull": 1.2, "speed": 2.6, "range": 12.0, "attacks": ["SPIKES", "SWEEP", "SUMMON", "SLAM"], "adds": ["scout", 3], "reward": [1200, 800],
		"blurb": "The heart of the oldest forest, still awake." },
	"black-market-phantom": { "name": "The Black Market Phantom", "model": "dark-knight.glb", "size": 2.3, "hull": 0.9, "speed": 8.5, "range": 12.0, "attacks": ["CHARGE", "VOLLEY", "CHARGE", "SWEEP"], "adds": ["scout", 0], "reward": [1300, 800],
		"blurb": "A masked rider who runs routes nobody else can see." },
	"king-beneath": { "name": "The King Beneath the City", "model": "aberration-boss.glb", "size": 5.5, "hull": 1.25, "speed": 2.0, "range": 18.0, "attacks": ["VOLLEY", "SUMMON", "BREATH", "SPIKES"], "adds": ["drone", 3], "reward": [1400, 850],
		"blurb": "A machine intelligence wired into the Undercity." },
	"clockwork-saint": { "name": "The Clockwork Saint", "model": "guardian-boss.glb", "size": 6.0, "hull": 1.2, "speed": 3.0, "range": 10.0, "attacks": ["SWEEP", "SPIKES", "SLAM", "VOLLEY"], "adds": ["scout", 2], "reward": [1400, 850],
		"blurb": "The guardian of a stopped hour." },
	"eternal-huntress": { "name": "The Eternal Huntress", "model": "aberration-elite.glb", "size": 3.0, "hull": 1.0, "speed": 7.0, "range": 20.0, "attacks": ["VOLLEY", "VOLLEY", "CHARGE", "SPIKES"], "adds": ["scout", 2], "reward": [1300, 800],
		"blurb": "A phantom archer older than the Mistwood's trees." },
	"iron-behemoth": { "name": "The Iron Behemoth", "model": "guardian-boss.glb", "size": 9.0, "hull": 1.5, "speed": 2.4, "range": 20.0, "attacks": ["VOLLEY", "SLAM", "VOLLEY", "SUMMON"], "adds": ["executor", 2], "reward": [1500, 900],
		"blurb": "A siege engine still fighting a war nobody remembers." },
}
## Chapter 1 — The Aftershock's six (tools/campaign/aftershock.py Missions 2–7), each on a hull of its own: Meshy 7.1
## Image-to-3D from an on-brief concept image (Nov 23), decimated to 80k tris (tools/decimate_glb.py) and gate-passed
## (scripts/check-meshy-textures.py). Story bosses only: not in the Rift Gate's pick (boss_arena.gd walks BOSSES).
const STORY := {
	"fracture-commander": { "name": "Fracture Commander", "model": "fracture-commander.glb", "size": 4.2, "hull": 0.7, "speed": 5.5, "range": 14.0, "attacks": ["VOLLEY", "LUNGE", "SWEEP", "SUMMON"], "adds": ["scout", 2], "reward": [700, 450],
			"blurb": "The checkpoint's big one: black plate split by violet fracture light, crystal spurs on its shoulders. It holds the line with its troopers and comes for you when they fall." },
	"subject-zero": { "name": "Subject Zero", "model": "subject-zero.glb", "size": 2.2, "hull": 0.65, "speed": 7.5, "range": 3.0, "attacks": ["LUNGE", "CHARGE", "SPIKES", "LUNGE"], "adds": ["drone", 0], "reward": [750, 480],
			"blurb": "The research wing's first subject, still in the grey scrubs, crystal growing out of the chest and the left arm. Fast, close, and the floor erupts where it stands." },
	"fracture-executioner": { "name": "Fracture Executioner", "model": "fracture-executioner.glb", "size": 3.4, "hull": 0.9, "speed": 7.0, "range": 3.0, "attacks": ["SWEEP", "LUNGE", "CHARGE", "SWEEP"], "adds": ["executor", 1], "reward": [900, 600],
			"blurb": "The subway's hooded hunter, violet blades grown from both forearms. Sweeps, then closes on whoever is still standing." },
	"siege-beast": { "name": "Fracture Siege Beast", "model": "siege-beast.glb", "size": 6.5, "hull": 1.5, "speed": 4.0, "range": 8.0, "attacks": ["SLAM", "CHARGE", "SLAM", "SPIKES"], "adds": ["scout", 2], "reward": [1100, 700],
			"blurb": "The thing that came over the northern wall: a quadruped of cracked stone and crystal spines. Every slam is a shockwave; the charge takes the wall with it." },
	"harbinger": { "name": "The Harbinger", "model": "harbinger.glb", "size": 3.8, "hull": 1.3, "speed": 5.0, "range": 18.0, "attacks": ["VOLLEY", "SUMMON", "BREATH", "SPIKES"], "adds": ["elite", 2], "reward": [1300, 850],
			"blurb": "The one who comes to reclaim what was taken. Black and gold plate under a torn mantle, a crown of violet crystal; it calls its chosen and burns the ground between you." },
	"archive-warden": { "name": "Archive Warden", "model": "archive-warden.glb", "size": 5.0, "hull": 1.4, "speed": 3.0, "range": 10.0, "attacks": ["SLAM", "SWEEP", "VOLLEY", "SUMMON"], "adds": ["executor", 2], "reward": [1400, 900],
			"blurb": "The Archive's keeper on the central dais: a chained stone-and-bronze golem, runes down the arms, a visor slit of violet light. Slow, and nothing it hits gets up quickly." },
}

## a row of any table
static func row(boss_id: String) -> Dictionary:
	return BOSSES.get(boss_id, STORY.get(boss_id, UNIQUE.get(boss_id, {})))

## the unique encounters' gimmicks (web scenario-gimmicks.ts), set by unique_encounter.gd after the summon:
##   poise    — outside the stagger / weak-point window hits land at POISE_OUTSIDE
##   adaptive — each damage kind it has been hit by grows familiar (decaying FAMILIAR_DECAY a second); a familiar one lands
##              for as little as 0.35, a fresh one for up to 1.3, so rotating gun elements, melee and grenades is the way in
##   attune   — every ATTUNE_EVERY s its halo turns to one of `attune_elements`; that kind lands ×1.5, the rest ×0.35
##   closing  — hits from farther than CLOSE_RANGE are cut out of the air (×0.15, and they build no poise)
##   trial    — it cannot be killed: at TRIAL_FLOOR of its hull it yields, which ends the fight as a win
const POISE_OUTSIDE := 0.5
const FAMILIAR_DECAY := 0.12
const ATTUNE_EVERY := 9.0
const CLOSE_RANGE := 12.0
const TRIAL_FLOOR := 0.45
var gimmick := ""
var attune_elements: Array = ["KINETIC", "MELEE"]
var attuned := "KINETIC"
var familiar := {}
var yielded := false
var _attune_t := 0.0
var _attune_i := 0

func gimmick_mult(kind: String, dist: float) -> float:
	match gimmick:
		"poise":
			return 1.0 if staggered() or weak_point() else POISE_OUTSIDE
		"adaptive":
			return clampf(1.3 - float(familiar.get(kind, 0.0)) / (hull_max * 0.06), 0.35, 1.3)
		"attune":
			return 1.5 if kind == attuned else 0.35
		"closing":
			return 1.0 if dist <= CLOSE_RANGE else 0.15
	return 1.0

func set_gimmick(g: String, kinds: Array = []) -> void:
	gimmick = g
	if not kinds.is_empty():
		attune_elements = kinds
	attuned = String(attune_elements[0])
	_attune_t = ATTUNE_EVERY

## attack timings (s) and effects: telegraph before, cooldown after; damage in the operator's hull units (enemies.gd damage
## scale), `radius` for area hits, `bolts` for volleys
## Patterns (Nov 22, owner: "boss combat patterns and stagger systems"): from OVERDRIVEN on, an attack chains straight
## into its FOLLOW-up (every other attack in phase 2, every attack in phase 3), so the fight escalates from single reads
## to two-move strings; the new SWEEP (a 200° swing — jump it or dodge through it), CHARGE (a run through you along a
## telegraphed line) and SPIKES (circles erupt where you stood) give the six bosses their combos. A PARRY of a melee
## attack (LUNGE, SWEEP, CHARGE) knocks PARRY_POISE into the poise bar, so timed counters are the fast way to a stagger;
## a staggered boss can be finished (close_combat.gd), which ends the stagger early.
const PARRY_POISE := 45.0
const FOLLOW := { "LUNGE": "SWEEP", "SWEEP": "LUNGE", "VOLLEY": "SPIKES", "SPIKES": "VOLLEY", "SLAM": "CHARGE", "CHARGE": "SLAM", "BREATH": "SWEEP", "SUMMON": "VOLLEY" }
## the attacks that can be parried (a swing or a body at arm's reach), the ones a jump clears (low and wide)
const PARRYABLE := ["LUNGE", "SWEEP", "CHARGE"]
const JUMPABLE := ["SWEEP", "SLAM"]

const ATTACKS := {
	"LUNGE": { "telegraph": 0.7, "cooldown": 1.6, "damage": 22.0, "radius": 3.2, "reach": 6.0 },
	"SWEEP": { "telegraph": 0.8, "cooldown": 1.4, "damage": 26.0, "radius": 5.5, "reach": 5.0, "arc": 1.75 },
	"CHARGE": { "telegraph": 1.0, "cooldown": 2.2, "damage": 30.0, "radius": 2.2, "reach": 16.0 },
	"SPIKES": { "telegraph": 1.1, "cooldown": 2.0, "damage": 24.0, "radius": 2.6, "count": 3 },
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
## the attack chained in next (a phase combo), "" for none; tallies for the tests
var chained := ""
var chains := 0
var parries := 0

func _init(boss_id: String) -> void:
	id = boss_id
	def = row(boss_id)
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
func hit(damage: float, kind := "", dist := 0.0) -> float:
	if dead:
		return 0.0
	var g := gimmick_mult(kind, dist)
	if gimmick == "adaptive":
		familiar[kind] = float(familiar.get(kind, 0.0)) + damage
	if gimmick == "closing" and dist > CLOSE_RANGE:
		damage *= g      # cut out of the air: no poise from it either
		g = 1.0
	var mult := (STAGGER_MULT if staggered() else (WEAK_MULT if weak_point() else 1.0)) * g
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
	if gimmick == "trial" and hull <= hull_max * TRIAL_FLOOR and not dead:
		# it yields: the trial is won, nothing dies
		hull = hull_max * TRIAL_FLOOR
		yielded = true
		dead = true
		step = Step.DEAD
		events.append({ "kind": "dead", "yield": true })
		return dealt
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
	if gimmick == "adaptive":
		for k in familiar:
			familiar[k] = float(familiar[k]) * exp(-FAMILIAR_DECAY * dt)
	elif gimmick == "attune":
		_attune_t -= dt
		if _attune_t <= 0.0:
			_attune_t = ATTUNE_EVERY
			_attune_i = (_attune_i + 1) % attune_elements.size()
			attuned = String(attune_elements[_attune_i])
			events.append({ "kind": "attune", "element": attuned })
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
			var next: String = chained if chained != "" else def.attacks[attack_i % (def.attacks as Array).size()]
			var reach: float = float(def.range) if next in ["VOLLEY", "BREATH", "SUMMON"] else float(ATTACKS[next].get("reach", def.range))
			if dist <= reach or next in ["SUMMON", "SPIKES", "CHARGE"] or chained != "":
				attack = next
				chained = ""
				step = Step.TELEGRAPH
				timer = float(ATTACKS[attack].telegraph) / float(t.speed)
				events.append({ "kind": "telegraph", "attack": attack, "seconds": timer })
		Step.TELEGRAPH:
			timer -= dt
			if timer <= 0.0:
				step = Step.ATTACK
				attack_t = 0.0
				var a: Dictionary = ATTACKS[attack]
				events.append({ "kind": "attack", "attack": attack, "damage": float(a.damage) * float(t.damage), "radius": float(a.get("radius", 0.0)), "bolts": int(a.get("bolts", 0)), "reach": float(a.get("reach", def.range)), "cone": float(a.get("cone", 0.0)), "arc": float(a.get("arc", 0.0)), "count": int(a.get("count", 0)) })
				if attack == "SUMMON":
					var n := int(def.adds[1]) + phase
					summoned += n
					events.append({ "kind": "summon", "type": String(def.adds[0]), "count": n })
				timer = float(ATTACKS[attack].get("duration", 0.15))
		Step.ATTACK:
			attack_t += dt
			timer -= dt
			if timer <= 0.0:
				attack_i += 1
				step = Step.COOLDOWN
				# the phase combo: OVERDRIVEN chains every other attack into its follow-up, OVERLOADED every one
				var chain := phase >= 2 or (phase == 1 and attack_i % 2 == 1)
				if chain and FOLLOW.has(attack) and attack != "SUMMON":
					chained = String(FOLLOW[attack])
					chains += 1
					timer = 0.35
				else:
					timer = float(ATTACKS[attack].cooldown) * float(t.cooldown)
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

## a parried melee attack (close_combat.gd): poise in a lump — a stagger comes quicker by counters than by gunfire
func parried() -> void:
	if dead or staggered() or clock < stagger_until + POISE_REFRACTORY:
		return
	parries += 1
	poise += PARRY_POISE
	if poise >= POISE_MAX:
		poise = 0.0
		stagger_until = clock + STAGGER
		weak_until = clock + STAGGER
		step = Step.STAGGERED
		timer = STAGGER
		chained = ""
		events.append({ "kind": "stagger" })

## a finisher landed on a staggered boss: the stagger ends early (the punish is spent)
func finished_stagger() -> void:
	if staggered():
		stagger_until = clock + 0.6
		timer = minf(timer, 0.6)

func reward() -> Dictionary:
	return { "nex": int(def.reward[0]), "xp": int(def.reward[1]) }
