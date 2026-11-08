extends RefCounted
## Weapon frames and a magazine (the Dec 4 plan, phase 2): the web game's frames in the web game's units
## (src/game/weapons.ts AUTO and weapon-classes.ts FRAMES — damage is a multiplier on a base bullet, fireRate seconds a
## pull, spread radians from the hip, adsSpread the fraction of it when aiming) with weapon-meta.ts range bands. The
## magazine logic is the web game's too: a pull with an empty mag starts a reload, `burst` bolts a pull spaced `burst_gap`.
## Pure: no nodes, so tests/combat/weapons_test.gd runs it headless.

const FRAMES := {
	"AUTO": { "name": "Auto Rifle", "model": "rifle.glb", "damage": 1.0, "fire_rate": 0.11, "burst": 1, "burst_gap": 0.0, "spread": 0.035, "ads_spread": 0.35, "recoil": 0.006, "mag": 32, "reserve": 192, "reload": 1.6,
		"range_full": 28.0, "range_end": 55.0, "range_floor": 0.7, "precision": 1.5, "muzzle_dz": 0.0, "label": "Rapid-fire · mid range" },
	"SNIPER": { "name": "Sniper Rifle", "model": "rifle-sniper.glb", "damage": 6.5, "fire_rate": 1.05, "burst": 1, "burst_gap": 0.0, "spread": 0.06, "ads_spread": 0.08, "recoil": 0.07, "mag": 5, "reserve": 30, "reload": 2.6,
		"range_full": 150.0, "range_end": 250.0, "range_floor": 0.9, "precision": 2.4, "muzzle_dz": 0.372, "label": "One shot · aim down sights" },
	"FUSION": { "name": "Fusion Rifle", "model": "rifle-fusion.glb", "damage": 2.2, "fire_rate": 1.1, "burst": 5, "burst_gap": 0.035, "spread": 0.02, "ads_spread": 0.6, "recoil": 0.008, "mag": 20, "reserve": 100, "reload": 2.2,
		"range_full": 18.0, "range_end": 36.0, "range_floor": 0.4, "precision": 1.1, "muzzle_dz": 0.07, "label": "Five-bolt volley · close to mid" },
	# the authored sidearm / shotgun / SMG / LMG / heavy (public/models/weapons via scripts/build-weapons.py), Nov 8
	"SMG": { "name": "Submachine Gun", "model": "rifle-smg.glb", "damage": 0.72, "fire_rate": 0.065, "burst": 1, "burst_gap": 0.0, "spread": 0.026, "ads_spread": 0.55, "recoil": 0.005, "mag": 40, "reserve": 240, "reload": 1.5,
		"range_full": 14.0, "range_end": 32.0, "range_floor": 0.55, "precision": 1.35, "muzzle_dz": 0.0, "label": "Fastest fire · close range" },
	"SHOTGUN": { "name": "Breach Shotgun", "model": "shotgun.glb", "damage": 0.75, "pellets": 8, "fire_rate": 0.8, "burst": 1, "burst_gap": 0.0, "spread": 0.075, "ads_spread": 0.75, "recoil": 0.04, "mag": 6, "reserve": 42, "reload": 2.4,
		"range_full": 8.0, "range_end": 20.0, "range_floor": 0.2, "precision": 1.15, "muzzle_dz": 0.0, "label": "Close quarters · one-shot inside 8 m" },
	"SIDEARM": { "name": "Hand Cannon", "model": "pistol.glb", "damage": 2.4, "fire_rate": 0.34, "burst": 1, "burst_gap": 0.0, "spread": 0.012, "ads_spread": 0.4, "recoil": 0.03, "mag": 8, "reserve": 64, "reload": 1.3,
		"range_full": 26.0, "range_end": 48.0, "range_floor": 0.6, "precision": 2.0, "muzzle_dz": -0.3, "label": "Precision · rewards headshots" },
	"LMG": { "name": "Light Machine Gun", "model": "heavy.glb", "damage": 1.05, "fire_rate": 0.095, "burst": 1, "burst_gap": 0.0, "spread": 0.045, "ads_spread": 0.45, "recoil": 0.009, "mag": 80, "reserve": 320, "reload": 3.6,
		"range_full": 32.0, "range_end": 60.0, "range_floor": 0.7, "precision": 1.4, "muzzle_dz": 0.1, "label": "Big magazine · sustained fire" },
	"HEAVY": { "name": "Heavy Cannon", "model": "heavy.glb", "damage": 4.5, "fire_rate": 0.9, "burst": 1, "burst_gap": 0.0, "spread": 0.01, "ads_spread": 0.5, "recoil": 0.05, "mag": 4, "reserve": 20, "reload": 2.6,
		"range_full": 100.0, "range_end": 160.0, "range_floor": 0.85, "precision": 1.8, "muzzle_dz": 0.1, "label": "High impact · long range" },
}
const ORDER := ["AUTO", "SNIPER", "FUSION", "SMG", "SHOTGUN", "SIDEARM", "LMG", "HEAVY"]

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
	func _init(f: String) -> void:
		frame = f
		mag = int(FRAMES[f].mag)
		reserve = int(FRAMES[f].reserve)
	func def() -> Dictionary:
		return FRAMES[frame]
	## advances timers; returns how many bolts leave the barrel this step (the rest of a burst, or the first of a new pull)
	func step(dt: float, trigger: bool) -> int:
		var shots := 0
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
		if trigger and cool <= 0.0:
			cool = float(def().fire_rate)
			shots = 1
			mag -= 1
			_burst_left = int(def().burst) - 1
			_burst_cool = float(def().burst_gap)
		return shots
	func reload() -> bool:
		if reloading > 0.0 or mag >= int(def().mag) or reserve <= 0:
			return false
		reloading = float(def().reload)
		_burst_left = 0
		return true
	func display_name() -> String:
		return label if label != "" else String(def().name)
	func ammo_text() -> String:
		return "%d / %d" % [mag, reserve]
