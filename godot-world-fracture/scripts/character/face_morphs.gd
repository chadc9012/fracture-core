extends RefCounted
## The face sculpt (a port of the web game's face-morphs.ts): ten sliders, each a smooth displacement field in head space —
## metres on a 1.85 m human, origin at the Head bone, +Z forward, +X the character's left — applied to the head mesh once at
## build. Values run -1 … 1 (0 is the head as cut).

const IDS := ["width", "jaw", "chin", "cheeks", "nose", "noseWidth", "brow", "eyes", "forehead", "lips"]
const GAIN := 1.4

static func _clamp01(t: float) -> float: return clampf(t, 0.0, 1.0)
## 1 inside lo, falling smoothly to 0 by hi
static func _fall(d: float, lo: float, hi: float) -> float:
	var t := _clamp01((d - lo) / (hi - lo))
	return 1.0 - t * t * (3.0 - 2.0 * t)
static func _rise(d: float, lo: float, hi: float) -> float: return 1.0 - _fall(d, lo, hi)
static func _w(v: float, a: float, b: float, soft: float) -> float:
	return _rise(v, a - soft, a + soft * 0.2) * _fall(v, b - soft * 0.2, b + soft)
static func _box(p: Vector3, mn: Vector3, mx: Vector3, soft: float) -> float:
	return _w(p.x, mn.x, mx.x, soft) * _w(p.y, mn.y, mx.y, soft) * _w(p.z, mn.z, mx.z, soft)
static func _ball(p: Vector3, c: Vector3, r: float) -> float:
	return _fall(p.distance_to(c), r * 0.35, r)

## the displacement one morph gives at value 1
static func offset(id: String, p: Vector3) -> Vector3:
	var sx := signf(p.x) if p.x != 0.0 else 1.0
	var ax := absf(p.x)
	match id:
		"width":
			var w := _rise(p.z, -0.03, 0.02) * _rise(p.y, -0.01, 0.03) * _fall(p.y, 0.11, 0.14) * _rise(ax, 0.01, 0.04)
			return Vector3(sx * 0.008 * w, 0, 0)
		"jaw":
			var w := _ball(p, Vector3(sx * 0.06, 0.02, 0.025), 0.045)
			return Vector3(sx * 0.011 * w, -0.003 * w, 0.002 * w)
		"chin":
			var w := _ball(p, Vector3(0, 0, 0.075), 0.04) * _rise(p.z, 0.03, 0.06)
			return Vector3(0, -0.012 * w, 0.004 * w)
		"cheeks":
			var bone := _ball(p, Vector3(sx * 0.058, 0.055, 0.045), 0.035)
			var hollow := _ball(p, Vector3(sx * 0.05, 0.03, 0.05), 0.03)
			return Vector3(sx * (0.008 * bone - 0.003 * hollow), 0.003 * bone, 0.006 * bone - 0.003 * hollow)
		"nose":
			var w := _box(p, Vector3(-0.02, 0.03, 0.078), Vector3(0.02, 0.085, 0.12), 0.012)
			var tip := _ball(p, Vector3(0, 0.042, 0.1), 0.025)
			return Vector3(0, -0.004 * tip, 0.008 * w + 0.006 * tip)
		"noseWidth":
			var w := _box(p, Vector3(-0.025, 0.03, 0.078), Vector3(0.025, 0.065, 0.12), 0.01) * _rise(ax, 0.004, 0.012)
			return Vector3(sx * 0.007 * w, 0, 0)
		"brow":
			return Vector3(0, 0, 0.007 * _box(p, Vector3(-0.055, 0.08, 0.065), Vector3(0.055, 0.105, 0.11), 0.012))
		"eyes":
			return Vector3(sx * 0.006 * _ball(p, Vector3(sx * 0.03, 0.068, 0.078), 0.028), 0, 0)
		"forehead":
			var w := _box(p, Vector3(-0.08, 0.098, 0.02), Vector3(0.08, 0.2, 0.12), 0.015) * _rise(p.y, 0.095, 0.115)
			return Vector3(0, 0.01 * w, 0.002 * w)
		"lips":
			return Vector3(0, 0, 0.006 * _ball(p, Vector3(0, 0.022, 0.088), 0.022) * _rise(p.z, 0.06, 0.08))
	return Vector3.ZERO

static func is_neutral(morphs: Dictionary) -> bool:
	for id: String in IDS:
		if float(morphs.get(id, 0.0)) != 0.0:
			return false
	return true

## the total displacement for a set of slider values
static func displacement(morphs: Dictionary, p: Vector3) -> Vector3:
	var d := Vector3.ZERO
	for id: String in IDS:
		var v := float(morphs.get(id, 0.0))
		if v != 0.0:
			d += offset(id, p) * v * GAIN
	return d

## clamps to -1…1 at two decimals and drops unknown or zero entries
static func clean(raw: Variant) -> Dictionary:
	var out := {}
	if raw is Dictionary:
		for k: Variant in raw:
			if k in IDS and (raw[k] is float or raw[k] is int):
				var c := clampf(roundf(float(raw[k]) * 100.0) / 100.0, -1.0, 1.0)
				if c != 0.0:
					out[k] = c
	return out
