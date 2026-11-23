extends RefCounted
## Weapon frames and a magazine (the Dec 4 plan, phase 2): the web game's frames in the web game's units
## (src/game/weapons.ts AUTO and weapon-classes.ts FRAMES — damage is a multiplier on a base bullet, fireRate seconds a
## pull, spread radians from the hip, adsSpread the fraction of it when aiming) with weapon-meta.ts range bands. The
## magazine logic is the web game's too: a pull with an empty mag starts a reload, `burst` bolts a pull spaced `burst_gap`.
## Pure: no nodes, so tests/combat/weapons_test.gd runs it headless.

const FRAMES := {
	"AUTO": { "name": "Auto Rifle", "model": "rifle.glb", "damage": 1.0, "fire_rate": 0.11, "burst": 1, "burst_gap": 0.0, "spread": 0.035, "ads_spread": 0.35, "recoil": 0.006, "mag": 32, "reserve": 192, "reload": 1.6,
		"range_full": 28.0, "range_end": 55.0, "range_floor": 0.7, "precision": 1.5, "muzzle_dz": 0.0, "stability": 62, "handling": 55, "pattern": 78, "zoom": 0.78, "category": "Assault Rifle", "perks": ["rampage", "kill_clip", "rapid_hit", "subsistence"], "label": "Rapid-fire · mid range" },
	"SNIPER": { "name": "Sniper Rifle", "model": "rifle-sniper.glb", "damage": 6.5, "fire_rate": 1.05, "burst": 1, "burst_gap": 0.0, "spread": 0.06, "ads_spread": 0.08, "recoil": 0.07, "mag": 5, "reserve": 30, "reload": 2.6,
		"range_full": 150.0, "range_end": 250.0, "range_floor": 0.9, "precision": 2.4, "muzzle_dz": 0.372, "stability": 40, "handling": 30, "pattern": 92, "zoom": 0.32, "category": "Sniper Rifle", "perks": ["snapshot", "outlaw", "firefly", "box_breathing"], "label": "One shot · aim down sights" },
	"FUSION": { "name": "Fusion Rifle", "model": "rifle-fusion.glb", "damage": 2.2, "fire_rate": 1.1, "burst": 5, "burst_gap": 0.035, "charge": 0.45, "spread": 0.02, "ads_spread": 0.6, "recoil": 0.008, "mag": 20, "reserve": 100, "reload": 2.2,
		"range_full": 18.0, "range_end": 36.0, "range_floor": 0.4, "precision": 1.1, "muzzle_dz": 0.07, "stability": 58, "handling": 45, "pattern": 70, "zoom": 0.75, "category": "Fusion Rifle", "perks": ["backup_plan", "kill_clip", "rampage", "rapid_hit"], "label": "Five-bolt volley · close to mid" },
	# the authored sidearm / shotgun / SMG / LMG / heavy (public/models/weapons via scripts/build-weapons.py), Nov 8
	"SMG": { "name": "Submachine Gun", "model": "rifle-smg.glb", "damage": 0.72, "fire_rate": 0.065, "burst": 1, "burst_gap": 0.0, "spread": 0.026, "ads_spread": 0.55, "recoil": 0.005, "mag": 40, "reserve": 240, "reload": 1.5,
		"range_full": 14.0, "range_end": 32.0, "range_floor": 0.55, "precision": 1.35, "muzzle_dz": 0.0, "stability": 55, "handling": 80, "pattern": 60, "zoom": 0.85, "category": "Submachine Gun", "perks": ["rampage", "subsistence", "kill_clip", "dragonfly"], "label": "Fastest fire · close range" },
	"SHOTGUN": { "name": "Breach Shotgun", "model": "shotgun.glb", "damage": 0.95, "pellets": 8, "fire_rate": 0.8, "burst": 1, "burst_gap": 0.0, "spread": 0.075, "ads_spread": 0.75, "recoil": 0.04, "mag": 6, "reserve": 42, "reload": 2.4,
		"range_full": 8.0, "range_end": 20.0, "range_floor": 0.2, "precision": 1.15, "muzzle_dz": 0.0, "stability": 35, "handling": 60, "pattern": 85, "zoom": 0.9, "category": "Shotgun", "perks": ["trench_barrel", "outlaw", "rampage", "subsistence"], "label": "Close quarters · one-shot inside 8 m" },
	"SIDEARM": { "name": "Hand Cannon", "model": "pistol.glb", "damage": 2.4, "fire_rate": 0.34, "burst": 1, "burst_gap": 0.0, "spread": 0.012, "ads_spread": 0.4, "recoil": 0.03, "mag": 8, "reserve": 64, "reload": 1.3,
		"range_full": 26.0, "range_end": 48.0, "range_floor": 0.6, "precision": 2.0, "muzzle_dz": -0.3, "stability": 45, "handling": 70, "pattern": 88, "zoom": 0.82, "category": "Hand Cannon", "perks": ["outlaw", "firefly", "rapid_hit", "kill_clip"], "label": "Precision · rewards headshots" },
	"LMG": { "name": "Light Machine Gun", "model": "heavy.glb", "damage": 1.05, "fire_rate": 0.095, "burst": 1, "burst_gap": 0.0, "spread": 0.045, "ads_spread": 0.45, "recoil": 0.009, "mag": 80, "reserve": 320, "reload": 3.6,
		"range_full": 32.0, "range_end": 60.0, "range_floor": 0.7, "precision": 1.4, "muzzle_dz": 0.1, "stability": 70, "handling": 25, "pattern": 74, "zoom": 0.8, "category": "Light Machine Gun", "perks": ["rampage", "subsistence", "dragonfly", "kill_clip"], "label": "Big magazine · sustained fire" },
	"HEAVY": { "name": "Heavy Cannon", "model": "heavy.glb", "damage": 6.5, "fire_rate": 0.9, "burst": 1, "burst_gap": 0.0, "spread": 0.01, "ads_spread": 0.5, "recoil": 0.05, "mag": 4, "reserve": 20, "reload": 2.6,
		"range_full": 100.0, "range_end": 160.0, "range_floor": 0.85, "precision": 1.8, "muzzle_dz": 0.1, "stability": 50, "handling": 30, "pattern": 90, "zoom": 0.7, "category": "Heavy Cannon", "perks": ["outlaw", "firefly", "rampage", "box_breathing"], "label": "High impact · long range" },
	# the owner's weapon list (Nov 22, "weapons with distinct personalities"): pistols, marksman rifles, rocket and
	# grenade launchers and bows join the web frames; rockets and grenades fly (gunplay hands them to heavy_weapons.gd)
	"PISTOL": { "name": "Sidearm Pistol", "model": "pistol.glb", "damage": 1.45, "fire_rate": 0.16, "burst": 1, "burst_gap": 0.0, "spread": 0.016, "ads_spread": 0.45, "recoil": 0.012, "mag": 15, "reserve": 105, "reload": 1.1,
		"range_full": 20.0, "range_end": 40.0, "range_floor": 0.6, "precision": 1.6, "muzzle_dz": -0.3, "stability": 68, "handling": 90, "pattern": 80, "zoom": 0.85, "category": "Pistol", "perks": ["rapid_hit", "kill_clip", "subsistence", "dragonfly"], "label": "Quick draw · semi-auto" },
	"MARKSMAN": { "name": "Marksman Rifle", "model": "rifle-sniper.glb", "damage": 3.1, "fire_rate": 0.38, "burst": 1, "burst_gap": 0.0, "spread": 0.02, "ads_spread": 0.2, "recoil": 0.028, "mag": 12, "reserve": 72, "reload": 2.0,
		"range_full": 70.0, "range_end": 120.0, "range_floor": 0.8, "precision": 1.9, "muzzle_dz": 0.372, "stability": 58, "handling": 50, "pattern": 86, "zoom": 0.5, "category": "Marksman Rifle", "perks": ["outlaw", "firefly", "snapshot", "rapid_hit"], "label": "Semi-auto · long range" },
	"ROCKET": { "name": "Rocket Launcher", "model": "launcher.glb", "damage": 20.0, "fire_rate": 1.2, "burst": 1, "burst_gap": 0.0, "spread": 0.004, "ads_spread": 0.6, "recoil": 0.09, "mag": 1, "reserve": 6, "reload": 2.8,
		"range_full": 200.0, "range_end": 300.0, "range_floor": 1.0, "precision": 1.0, "muzzle_dz": 0.3, "stability": 40, "handling": 20, "pattern": 95, "zoom": 0.7, "category": "Rocket Launcher", "perks": ["cluster_bomb", "impact_casing", "backup_plan"],
		"projectile": { "kind": "rocket", "speed": 48.0, "gravity": 0.0, "radius": 6.0 }, "label": "Splash · one big hit" },
	"GL": { "name": "Grenade Launcher", "model": "launcher.glb", "damage": 6.0, "fire_rate": 0.7, "burst": 1, "burst_gap": 0.0, "spread": 0.01, "ads_spread": 0.6, "recoil": 0.05, "mag": 4, "reserve": 20, "reload": 2.4,
		"range_full": 120.0, "range_end": 200.0, "range_floor": 1.0, "precision": 1.0, "muzzle_dz": 0.3, "stability": 50, "handling": 40, "pattern": 92, "zoom": 0.75, "category": "Grenade Launcher", "perks": ["cluster_bomb", "impact_casing", "rampage"],
		"projectile": { "kind": "gl", "speed": 30.0, "gravity": 14.0, "radius": 4.5 }, "label": "Arcing shells · splash" },
	"BOW": { "name": "Combat Bow", "model": "", "damage": 5.2, "fire_rate": 0.25, "burst": 1, "burst_gap": 0.0, "spread": 0.004, "ads_spread": 0.3, "recoil": 0.02, "mag": 1, "reserve": 40, "reload": 0.0,
		"range_full": 60.0, "range_end": 110.0, "range_floor": 0.8, "precision": 2.0, "muzzle_dz": 0.0, "stability": 80, "handling": 65, "pattern": 96, "zoom": 0.6, "category": "Bow", "perks": ["archers_tempo", "firefly", "outlaw"],
		"draw": 0.6, "label": "Draw and release · silent" },
}
const ORDER := ["AUTO", "SNIPER", "FUSION", "SMG", "SHOTGUN", "SIDEARM", "LMG", "HEAVY"]
## every frame a gear item can fire as (ORDER is the bare kit a view starts with)
const ALL := ["AUTO", "SNIPER", "FUSION", "SMG", "SHOTGUN", "SIDEARM", "LMG", "HEAVY", "PISTOL", "MARKSMAN", "ROCKET", "GL", "BOW"]

## rays per bolt: a shotgun's pellets, one for everything else
static func pellets(frame: String) -> int:
	return int(FRAMES[frame].get("pellets", 1))

## a frame name the gear may carry; unknown ones fire as AUTO
static func known(frame: String) -> String:
	return frame if FRAMES.has(frame) else "AUTO"
## one base bullet's damage in hull points (the web game's troopers have 10)
const BASE_DAMAGE := 10.0

## damage falloff with distance: full inside range_full, down to range_floor at range_end (weapon-meta.ts)
static func falloff(frame: String, dist: float) -> float:
	var f: Dictionary = FRAMES[frame]
	if dist <= f.range_full:
		return 1.0
	var t: float = clampf((dist - f.range_full) / maxf(f.range_end - f.range_full, 0.01), 0.0, 1.0)
	return lerpf(1.0, f.range_floor, t)

## the hit's damage: base × frame × falloff × precision on a head
static func damage(frame: String, dist: float, head := false) -> float:
	var f: Dictionary = FRAMES[frame]
	return BASE_DAMAGE * float(f.damage) * falloff(frame, dist) * (float(f.precision) if head else 1.0)

## which frame a gear item fires as. The gear export (export-godot-gear.ts) gives the web's coarse frame; the item's class
## and name pick the owner's categories: bows and crossbows draw, grenade launchers and rockets fly, a "pistol" class that
## is not a hand cannon is a pistol, a scout / marksman rifle fires semi-auto
static func frame_for(item: Dictionary) -> String:
	var cls := String(item.get("cls", "")).to_lower()
	var name := String(item.get("name", "")).to_lower()
	var f := known(String(item.get("frame", "AUTO")))
	if cls in ["bow", "crossbow"]:
		return "BOW"
	if cls == "launcher" or name.contains(" gl") or name.ends_with("gl"):
		return "GL"
	if String(item.get("slot", "")) == "heavy" and (name.contains("rocket") or name.contains("cataclysm") or name.contains("ender") or name.contains("launcher")):
		return "ROCKET"
	if cls == "pistol" and not (name.contains("cannon") or name.contains("slugger") or name.contains("magnum") or name.contains("revolver")):
		return "PISTOL"
	if (cls in ["ar", "auto"] or f == "AUTO") and (name.contains("marksman") or name.contains("scout") or name.contains("dmr") or name.contains("longshot")):
		return "MARKSMAN"
	return f

## the ten numbers on a weapon card (0-100 bars, the rest as read), from the frame and the item's power multiplier
static func stats(frame: String, mult := 1.0, element := "KINETIC", perks: Array = []) -> Dictionary:
	var f: Dictionary = FRAMES[known(frame)]
	var per_shot := BASE_DAMAGE * float(f.damage) * mult * pellets(frame)
	var rpm := 60.0 / maxf(float(f.fire_rate) / maxf(float(f.burst), 1.0), 0.01) if float(f.burst) <= 1 else 60.0 / float(f.fire_rate)
	return {
		"category": String(f.get("category", f.name)),
		"damage": clampi(int(round(per_shot / 1.4)), 1, 100),
		"range": clampi(int(round(float(f.range_full) / 1.5)), 5, 100),
		"fire_rate": int(round(rpm)),
		"accuracy": clampi(int(round(100.0 - float(f.spread) * 900.0)), 5, 100),
		"stability": int(f.stability),
		"reload": clampi(int(round(100.0 - float(f.reload) * 22.0)), 5, 100) if float(f.reload) > 0.0 else 100,
		"magazine": int(f.mag),
		"handling": int(f.handling),
		"element": element,
		"perks": perks.map(func(k): return String(PERKS.get(k, {}).get("name", k))),
	}

## the gun's kick for shot `i` of a string (Destiny's recoil direction): up by `recoil` less what stability holds, and a
## sideways wander that follows the frame's own pattern — a high `pattern` climbs straight, a low one snakes. Seeded by
## the frame so a gun always kicks the same way and can be learnt. Aiming down sights halves it. (yaw, pitch) radians.
static func recoil_kick(frame: String, i: int, ads := false, stability_bonus := 0.0) -> Vector2:
	var f: Dictionary = FRAMES[known(frame)]
	var hold := clampf((float(f.stability) + stability_bonus) / 100.0, 0.0, 1.0)
	var up := float(f.recoil) * (1.25 - 0.75 * hold) * (0.55 if ads else 1.0)
	var seed := float(frame.hash() % 997) * 0.013
	var wander := (1.0 - float(f.pattern) / 100.0) * 1.4
	var side := (sin(i * 0.85 + seed) * 0.7 + sin(i * 2.3 + seed * 3.0) * 0.3) * wander * up
	# the first shots climb hardest (the bloom settles once the string is going)
	var climb := up * (1.15 if i < 3 else 0.9)
	return Vector2(side, climb)

## the elements (data/gear.json items carry one): what a hit does past its damage. gunplay.gd applies them to Targets.
const ELEMENTS := {
	"KINETIC": { "color": Color(0.95, 0.9, 0.8), "unshielded": 1.15, "shield": 1.0 },
	"THERMAL": { "color": Color(1.0, 0.5, 0.15), "unshielded": 1.0, "shield": 1.5, "burn": 9.0, "burn_s": 3.0 },
	"ARC":     { "color": Color(0.45, 0.85, 1.0), "unshielded": 1.0, "shield": 1.5, "chain": 0.35, "chain_r": 5.0, "chain_n": 2 },
	"VOID":    { "color": Color(0.7, 0.35, 1.0), "unshielded": 1.0, "shield": 1.5, "weaken": 1.2, "weaken_s": 4.0 },
	"CRYO":    { "color": Color(0.6, 0.9, 1.0), "unshielded": 1.0, "shield": 1.5, "slow": 0.5, "slow_s": 2.0, "freeze_at": 5, "freeze_s": 1.5 },
	"PLASMA":  { "color": Color(1.0, 0.35, 0.7), "unshielded": 1.0, "shield": 2.2 },
}
static func element_of(e: String) -> Dictionary:
	return ELEMENTS.get(e.to_upper(), ELEMENTS.KINETIC)

## perks: what each does is in Gun (damage_mult / reload_mult / stability_bonus / on_hit / on_kill) or, for the ones that
## spawn something, in gunplay.gd (`firefly`, `dragonfly`, `cluster_bomb`)
const PERKS := {
	"rampage":       { "name": "Rampage", "text": "Kills stack +10% damage (×3) for 4.5 s" },
	"kill_clip":     { "name": "Kill Clip", "text": "Reload after a kill: +25% damage for 5 s" },
	"rapid_hit":     { "name": "Rapid Hit", "text": "Precision hits speed reloads and steady the gun" },
	"subsistence":   { "name": "Subsistence", "text": "Kills refill part of the magazine" },
	"outlaw":        { "name": "Outlaw", "text": "Precision kills: reloads 40% faster for 6 s" },
	"firefly":       { "name": "Firefly", "text": "Precision kills explode" },
	"dragonfly":     { "name": "Dragonfly", "text": "Precision kills burst in an elemental blast" },
	"snapshot":      { "name": "Snapshot Sights", "text": "Aims down sights much faster" },
	"box_breathing": { "name": "Box Breathing", "text": "Aiming still for 1 s: the next precision hit +30%" },
	"backup_plan":   { "name": "Backup Plan", "text": "Faster handling, a little less damage" },
	"trench_barrel": { "name": "Trench Barrel", "text": "A melee kill: +50% damage for 5 s" },
	"cluster_bomb":  { "name": "Cluster Bomb", "text": "The blast throws three bomblets" },
	"impact_casing": { "name": "Impact Casing", "text": "+10% impact damage" },
	"archers_tempo": { "name": "Archer's Tempo", "text": "Precision hits: the next draw is faster" },
	# exotic perks (rarity "exotic" items carry one of these as their signature)
	"overcharge":    { "name": "Overcharge", "text": "Every 6th hit lands ×3", "exotic": true },
	"tempest":       { "name": "Tempest", "text": "Hits jolt: chain arcs to two more foes", "exotic": true },
	"devour":        { "name": "Devour", "text": "Kills restore shield and hull", "exotic": true },
}
const EXOTIC_PERKS := ["overcharge", "tempest", "devour"]

## a worn item's perks, fixed by its id (so the same rifle always rolls the same): two from the frame's pool, and an
## exotic's signature perk first
static func item_perks(item_id: String, frame: String, rarity := "") -> Array:
	var pool: Array = (FRAMES[known(frame)].get("perks", []) as Array).duplicate()
	var out: Array = []
	var h := absi(item_id.hash())
	if rarity == "exotic":
		out.append(EXOTIC_PERKS[h % EXOTIC_PERKS.size()])
	for k in 2:
		if pool.is_empty():
			break
		out.append(pool.pop_at((h >> (k * 5)) % pool.size()))
	return out

## A loaded weapon: its magazine, reserve, the cooldown between pulls, a burst in flight and a reload under way.
class Gun:
	var frame: String
	var mag: int
	var reserve: int
	var cool := 0.0
	var reloading := 0.0
	var _burst_left := 0
	var _burst_cool := 0.0
	## the worn item's name and damage multiplier (gear_store.gd loadout); the frame's own when bare
	var label := ""
	var mult := 1.0
	## the item's element and perks (gear), the perks' live state, the recoil string and the draw after a swap
	var element := "KINETIC"
	var perks: Array = []
	var rarity := ""
	var shot_i := 0              # shots in the current string (recoil pattern index)
	var since_shot := 9.0
	var drawing := 0.0           # seconds until a just-drawn gun can fire
	var tactical := false        # the reload under way started with rounds still in the mag (shorter)
	var reload_full := 0.0       # this reload's whole length, for its animation
	var charge := 0.0            # a bow's draw, seconds
	var spool := 0.0             # a fusion rifle's charge, seconds
	var last_charge := 1.0       # the released draw, 0..1 (damage scales with it)
	var _was_trigger := false
	var _stacks := 0             # rampage
	var _stack_t := 0.0
	var _boost_t := 0.0          # kill clip / trench barrel
	var _boost := 1.0
	var _fast_t := 0.0           # outlaw
	var _rapid := 0              # rapid hit stacks
	var _rapid_t := 0.0
	var _kill_t := 9.0           # seconds since the last kill (kill clip)
	var hits := 0                # every hit (overcharge)
	func _init(f: String) -> void:
		frame = f
		mag = int(FRAMES[f].mag)
		reserve = int(FRAMES[f].reserve)
	func has_perk(k: String) -> bool:
		return perks.has(k)
	## draw the gun (a swap): it fires after its handling time
	func draw() -> void:
		var h := float(def().get("handling", 50)) + (25.0 if has_perk("backup_plan") else 0.0)
		drawing = lerpf(0.55, 0.15, clampf(h / 100.0, 0.0, 1.0))
		charge = 0.0
		_was_trigger = false
	## seconds to raise the sights (ADS), by handling
	func ads_time() -> float:
		var h := float(def().get("handling", 50)) + (45.0 if has_perk("snapshot") else 0.0)
		return lerpf(0.35, 0.1, clampf(h / 100.0, 0.0, 1.0))
	## the perks' damage factor right now
	func damage_mult() -> float:
		var m := mult * (1.0 + 0.1 * _stacks) * (_boost if _boost_t > 0.0 else 1.0)
		if has_perk("backup_plan"):
			m *= 0.85
		if has_perk("impact_casing"):
			m *= 1.1
		return m
	func reload_mult() -> float:
		return (0.6 if _fast_t > 0.0 else 1.0) * (1.0 - 0.06 * _rapid)
	func stability_bonus() -> float:
		return 6.0 * _rapid
	## a hit landed: rapid hit / overcharge. Returns an extra factor for this hit (overcharge ×3)
	func on_hit(head: bool) -> float:
		hits += 1
		if head and has_perk("rapid_hit"):
			_rapid = mini(_rapid + 1, 5)
			_rapid_t = 2.0
		if has_perk("overcharge") and hits % 6 == 0:
			return 3.0
		return 1.0
	## a kill: rampage, kill clip's window, outlaw, trench barrel, subsistence
	func on_kill(head: bool, melee := false) -> void:
		_kill_t = 0.0
		if has_perk("rampage"):
			_stacks = mini(_stacks + 1, 3)
			_stack_t = 4.5
		if head and has_perk("outlaw"):
			_fast_t = 6.0
		if melee and has_perk("trench_barrel"):
			_boost = 1.5
			_boost_t = 5.0
		if has_perk("subsistence"):
			var back := maxi(1, int(def().mag) / 5)
			var take := mini(back, mini(reserve, int(def().mag) - mag))
			mag += take
			reserve -= take
	## the perk clocks
	func _tick(dt: float) -> void:
		since_shot += dt
		_kill_t += dt
		if since_shot > 0.32:
			shot_i = 0
		_stack_t -= dt
		if _stack_t <= 0.0:
			_stacks = 0
		_boost_t = maxf(0.0, _boost_t - dt)
		_fast_t = maxf(0.0, _fast_t - dt)
		_rapid_t -= dt
		if _rapid_t <= 0.0:
			_rapid = 0
	## how far a reload has got, 0..1 (-1 when none): the animation and the "mag in" moment read it
	func reload_progress() -> float:
		if reloading <= 0.0 or reload_full <= 0.0:
			return -1.0
		return 1.0 - reloading / reload_full
	func def() -> Dictionary:
		return FRAMES[frame]
	## advances timers; returns how many bolts leave the barrel this step (the rest of a burst, or the first of a new pull)
	func step(dt: float, trigger: bool) -> int:
		var shots := 0
		_tick(dt)
		if drawing > 0.0:
			drawing = maxf(0.0, drawing - dt)
			_was_trigger = trigger
			return 0
		# a bow: holding draws the string, letting go looses the arrow (the draw sets its damage)
		if def().has("draw"):
			return _bow(dt, trigger)
		if reloading > 0.0:
			reloading -= dt
			if reloading <= 0.0:
				var want: int = int(def().mag) - mag
				var take := mini(want, reserve)
				mag += take
				reserve -= take
				reloading = 0.0
			return 0
		cool = maxf(0.0, cool - dt)
		if _burst_left > 0:
			_burst_cool -= dt
			while _burst_left > 0 and _burst_cool <= 0.0 and mag > 0:
				shots += 1
				mag -= 1
				_burst_left -= 1
				_burst_cool += float(def().burst_gap)
			if mag == 0:
				_burst_left = 0
			return shots
		if trigger and mag <= 0:
			reload()
			return 0
		# a fusion rifle charges first (Destiny's charge time): hold the trigger through it and the volley goes; let go
		# early and the charge drains
		if def().has("charge") and _burst_left <= 0:
			if trigger and cool <= 0.0 and mag > 0:
				spool += dt
				if spool < float(def().charge):
					return shots
				spool = 0.0
			else:
				spool = 0.0
				return shots
		if trigger and cool <= 0.0:
			cool = float(def().fire_rate)
			shots = 1
			mag -= 1
			_burst_left = int(def().burst) - 1
			_burst_cool = float(def().burst_gap)
		if shots > 0:
			shot_i += 1
			since_shot = 0.0
		return shots
	func _bow(dt: float, trigger: bool) -> int:
		var full := float(def().draw)
		var out := 0
		cool = maxf(0.0, cool - dt)
		if trigger and reserve > 0 and cool <= 0.0:
			charge = minf(charge + dt, full * 1.6)
		elif _was_trigger and charge > 0.12 and reserve > 0:
			# an early release is weak, a full draw lands fully; held past 1.4× the draw the aim tires a little
			last_charge = clampf(charge / full, 0.3, 1.0) * (0.92 if charge > full * 1.4 else 1.0)
			reserve -= 1
			out = 1
			cool = float(def().fire_rate)
			since_shot = 0.0
			charge = 0.0
		else:
			charge = 0.0
		_was_trigger = trigger
		return out
	## the bow's draw 0..1 for the HUD and the body
	func draw_frac() -> float:
		return clampf(charge / maxf(float(def().get("draw", 1.0)), 0.01), 0.0, 1.0)
	func reload() -> bool:
		if def().has("draw"):
			return false
		if reloading > 0.0 or mag >= int(def().mag) or reserve <= 0:
			return false
		# a tactical reload (rounds still in) skips the chambering: 85% of the empty reload
		tactical = mag > 0
		reloading = float(def().reload) * (0.85 if tactical else 1.0) * reload_mult()
		reload_full = reloading
		_burst_left = 0
		if _kill_t < 3.0 and has_perk("kill_clip"):
			_boost = 1.25
			_boost_t = 5.0
		return true
	## a swap mid-reload throws it away (the mag stays where it was)
	func cancel_reload() -> void:
		reloading = 0.0
		reload_full = 0.0
	func display_name() -> String:
		return label if label != "" else String(def().name)
	func ammo_text() -> String:
		if def().has("draw"):
			return "ARROWS %d" % reserve
		return "%d / %d" % [mag, reserve]
