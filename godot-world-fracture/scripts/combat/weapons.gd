extends RefCounted
## Weapon frames and a magazine (the Dec 4 plan, phase 2): the three frames the slice ships with, in the web game's units
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
}
const ORDER := ["AUTO", "SNIPER", "FUSION"]
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
	func ammo_text() -> String:
		return "%d / %d" % [mag, reserve]
