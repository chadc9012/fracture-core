extends RefCounted
## A street race's line through the open city (street racing life, Nov 11): an open polyline sampled every ~3 m, laid on
## the avenue the city already has. A sprint runs one way down the avenue; a loop runs down one side, hairpins round, back
## up the other side and hairpins again, `laps` times, so it ends where it started. Unlike track.gd (a closed venue lap)
## the two sides of a loop are only metres apart, so `nearest_from` searches a window round the car's last place on the
## line: a car on the way back is never mistaken for one on the way out. Pure, no nodes.

## where the start line sits along the line (the grid fills the first metres behind it)
const START := 30.0

var pts := PackedVector3Array()
var cum := PackedFloat32Array()
var length := 0.0

func _init(ctrl: Array = []) -> void:
	if ctrl.size() >= 2:
		_resample(ctrl)

## one way down the middle of the avenue from z0 to z1 (between the traffic lanes: the traffic is what you weave)
static func sprint(z0: float, z1: float, lane := 0.0) -> RefCounted:
	var ctrl: Array = []
	var dz := signf(z1 - z0)
	var n := maxi(2, int(absf(z1 - z0) / 140.0))
	for i in n + 1:
		var z := lerpf(z0 - dz * START, z1, float(i) / n)
		var x := lane + (0.0 if i == 0 or i == n else 0.0)
		ctrl.append(Vector3(x, 0, z))
	return load("res://scripts/racing/street_route.gd").new(ctrl)

## `laps` loops between z_hi and z_lo from the start line at `start_z` (the meet): down the +x lane (driving -z), a
## turnaround at z_lo, up the -x lane, a turnaround at z_hi, and back down to the start line. The racing lanes run
## either side of the centre line (±`lane`), inside the traffic lanes (±3); each end swings out to a circle of radius `turn` (the road is 16 m kerb to kerb, the parked cars are
## moved off it for the race: street_life.gd clears `ends`), as wide as a car's lock allows.
static func loop(z_hi: float, z_lo: float, laps: int, start_z: float, lane := 1.0, turn := 6.5) -> RefCounted:
	var ctrl: Array = []
	ctrl.append(Vector3(lane, 0, start_z + START))
	var from := start_z
	for lap in maxi(1, laps):
		_side(ctrl, lane, from, z_lo + turn + 22.0)
		_turn(ctrl, z_lo, lane, turn, -1.0)
		_side(ctrl, -lane, z_lo + turn + 22.0, z_hi - turn - 22.0)
		_turn(ctrl, z_hi, lane, turn, 1.0)
		from = z_hi - turn - 22.0
	_side(ctrl, lane, from, start_z)
	var r: RefCounted = load("res://scripts/racing/street_route.gd").new(ctrl)
	r.ends = [z_lo, z_hi]
	return r

## the z of each turnaround (the race clears parked cars round them)
var ends: Array = []

static func _side(ctrl: Array, x: float, z0: float, z1: float) -> void:
	var n := maxi(1, int(absf(z1 - z0) / 60.0))
	for i in range(1, n + 1):
		ctrl.append(Vector3(x, 0, lerpf(z0, z1, float(i) / n)))

## out from the lane to the turn's radius over 22 m, a half circle round (0, z), and in to the other lane.
## `sgn` -1 at the low end (from +x to -x), +1 at the high end (from -x back to +x)
static func _turn(ctrl: Array, z: float, lane: float, r: float, sgn: float) -> void:
	var s0 := 1.0 if sgn < 0.0 else -1.0       # the side it arrives on
	ctrl.append(Vector3(s0 * lerpf(lane, r, 0.5), 0, z - sgn * 11.0))
	ctrl.append(Vector3(s0 * r, 0, z))
	for i in range(1, 12):
		var a := PI * float(i) / 12.0
		ctrl.append(Vector3(s0 * r * cos(a), 0, z + sgn * r * sin(a)))
	ctrl.append(Vector3(-s0 * r, 0, z))
	ctrl.append(Vector3(-s0 * lerpf(lane, r, 0.5), 0, z - sgn * 11.0))
	ctrl.append(Vector3(-s0 * lane, 0, z - sgn * 22.0))

func _resample(ctrl: Array) -> void:
	pts.append(ctrl[0])
	for i in range(1, ctrl.size()):
		var a: Vector3 = ctrl[i - 1]
		var b: Vector3 = ctrl[i]
		var steps := maxi(1, int(ceil(a.distance_to(b) / 3.0)))
		for s in range(1, steps + 1):
			pts.append(a.lerp(b, float(s) / steps))
	cum.resize(pts.size())
	var d := 0.0
	cum[0] = 0.0
	for i in range(1, pts.size()):
		d += pts[i].distance_to(pts[i - 1])
		cum[i] = d
	length = d

## the race distance: start line to the end of the line
func race_length() -> float:
	return length - START

func _index_at(d: float) -> int:
	var lo := 0
	var hi := pts.size() - 1
	while lo < hi:
		var mid := (lo + hi + 1) / 2
		if cum[mid] <= d:
			lo = mid
		else:
			hi = mid - 1
	return lo

## the point `d` metres along (before the start it runs on back along the first leg, past the end along the last)
func at(d: float) -> Vector3:
	if d <= 0.0:
		return pts[0] - (pts[1] - pts[0]).normalized() * -d
	if d >= length:
		var n := pts.size()
		return pts[n - 1] + (pts[n - 1] - pts[n - 2]).normalized() * (d - length)
	var i := _index_at(d)
	var seg := cum[i + 1] - cum[i]
	return pts[i].lerp(pts[i + 1], (d - cum[i]) / maxf(seg, 0.001))

func dir_at(d: float) -> Vector3:
	return (at(d + 1.5) - at(d - 1.5)).normalized()

## the side vector at `d` (right of the direction of travel)
func side_at(d: float) -> Vector3:
	var f := dir_at(d)
	return Vector3(-f.z, 0, f.x)

## [along, dist] of the nearest point to `p` within `back`..`fwd` metres of `hint` (a car's last place on the line)
func nearest_from(p: Vector3, hint: float, back := 25.0, fwd := 70.0) -> Array:
	var i0 := _index_at(maxf(0.0, hint - back))
	var i1 := mini(pts.size() - 1, _index_at(minf(length, hint + fwd)) + 1)
	var best_d := 1e9
	var best_along := hint
	for i in range(i0, i1):
		var a := pts[i]
		var b := pts[i + 1]
		var ab := b - a
		var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		var q := a + ab * t
		var dd := Vector2(p.x - q.x, p.z - q.z).length()
		if dd < best_d:
			best_d = dd
			best_along = cum[i] + t * (cum[i + 1] - cum[i])
	return [best_along, best_d]

## how sharp the line is between `a` and `b` metres along (0 straight, 1 a hairpin)
func curvature(a: float, b: float) -> float:
	return clampf(dir_at(a).angle_to(dir_at(b)) / 1.2, 0.0, 1.0)

## the grid: `slot` 0 on the line's left at the front, two abreast, 7 m a row, behind the start line
func grid(slot: int) -> Transform3D:
	var d := START - 6.0 - (slot / 2) * 8.0
	var c := at(d) + side_at(d) * (-1.0 if slot % 2 == 0 else 1.0)
	return Transform3D(Basis.looking_at(dir_at(d), Vector3.UP), c)
