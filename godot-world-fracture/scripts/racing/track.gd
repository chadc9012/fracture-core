extends RefCounted
## A race track as data (the Dec 4 plan, phase 5; the owner's racing direction: real venues with stands and pit lanes): a
## closed centreline sampled from control points, a width, and where the start line, the pit lane and the grandstands sit.
## `progress(p)` is how far round the lap a point is (0..1), which the race uses for laps and positions; `nearest(p)` and
## `ahead(p, m)` steer the rivals; `off_track(p)` is the grass. Pure, no nodes.

const TRACKS := {
	"nexus-speedway": {
		"name": "Nexus Speedway", "width": 14.0, "laps": 3, "prize": [900, 500, 250, 100],
		# a stadium oval with a chicane on the back straight (metres; the main straight runs along -z at x = 0)
		"points": [[0, 0, 60], [0, 0, -60], [-12, 0, -95], [-45, 0, -112], [-85, 0, -100], [-100, 0, -60], [-96, 0, -10], [-80, 0, 20], [-96, 0, 50], [-90, 0, 90], [-60, 0, 112], [-25, 0, 100], [-8, 0, 75]],
		"start": 0.0,
		"pit": { "x": 20.0, "z0": -40.0, "z1": 50.0 },
		"stands": [{ "x": 30.0, "z0": -55.0, "z1": 55.0, "yaw": 0.0 }, { "x": -118.0, "z0": -80.0, "z1": 0.0, "yaw": 0.0 }],
	},
	# a night street circuit through Neon City's blocks: the avenue is the main straight, right-angle corners round the
	# blocks, a jog through the market grid; concrete barriers instead of kerbs and grass (race_view builds it as a city)
	"neon-circuit": {
		"name": "Neon Night Circuit", "kind": "street", "width": 13.0, "laps": 3, "prize": [1200, 650, 300, 120],
		"points": [[0, 0, 126], [0, 0, -90], [-7, 0, -119], [-29, 0, -130], [-104, 0, -130], [-130, 0, -119], [-140, 0, -94], [-140, 0, -32], [-130, 0, -11], [-104, 0, 0], [-83, 0, 11], [-72, 0, 36], [-72, 0, 119], [-61, 0, 148], [-36, 0, 162], [-11, 0, 155]],
		"start": 0.0,
	},
}

## the tracks a lobby lists, in order
static func ids() -> Array:
	return TRACKS.keys()

func street() -> bool:
	return String(def.get("kind", "venue")) == "street"

var id: String
var def: Dictionary
var pts: PackedVector3Array = PackedVector3Array()
var cum: PackedFloat32Array = PackedFloat32Array()
var length := 0.0
var width := 14.0

func _init(track_id: String) -> void:
	id = track_id
	def = TRACKS[track_id]
	width = float(def.width)
	var ctrl: Array = []
	for p in def.points:
		ctrl.append(Vector3(p[0], p[1], p[2]))
	# Catmull-Rom through the control points, closed, ~3 m a sample
	var n := ctrl.size()
	for i in n:
		var p0: Vector3 = ctrl[(i - 1 + n) % n]
		var p1: Vector3 = ctrl[i]
		var p2: Vector3 = ctrl[(i + 1) % n]
		var p3: Vector3 = ctrl[(i + 2) % n]
		var seg := p1.distance_to(p2)
		var steps := maxi(2, int(seg / 3.0))
		for s in steps:
			var t := float(s) / steps
			pts.append(_catmull(p0, p1, p2, p3, t))
	cum.resize(pts.size() + 1)
	var d := 0.0
	for i in pts.size():
		cum[i] = d
		d += pts[i].distance_to(pts[(i + 1) % pts.size()])
	cum[pts.size()] = d
	length = d

static func _catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: float) -> Vector3:
	var t2 := t * t
	var t3 := t2 * t
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)

## the point at `d` metres along the lap (wraps)
func at(d: float) -> Vector3:
	d = fposmod(d, length)
	var i := 0
	var lo := 0
	var hi := pts.size() - 1
	while lo < hi:
		var mid := (lo + hi + 1) / 2
		if cum[mid] <= d:
			lo = mid
		else:
			hi = mid - 1
	i = lo
	var a := pts[i]
	var b := pts[(i + 1) % pts.size()]
	var seg := cum[i + 1] - cum[i]
	return a.lerp(b, (d - cum[i]) / maxf(seg, 0.001))

## the direction of the lap at `d`
func dir_at(d: float) -> Vector3:
	return (at(d + 1.5) - at(d - 1.5)).normalized()

## metres along the lap of the nearest centreline point to `p`, and the distance from it: [along, dist]
func nearest(p: Vector3) -> Array:
	var best_d := 1e9
	var best_along := 0.0
	for i in pts.size():
		var a := pts[i]
		var b := pts[(i + 1) % pts.size()]
		var ab := b - a
		var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		var q := a + ab * t
		var dd := Vector2(p.x - q.x, p.z - q.z).length()
		if dd < best_d:
			best_d = dd
			best_along = cum[i] + t * (cum[i + 1] - cum[i])
	return [best_along, best_d]

## lap fraction 0..1 from the start line
func progress(p: Vector3) -> float:
	var n := nearest(p)
	return fposmod(float(n[0]) - float(def.start), length) / length

func off_track(p: Vector3) -> bool:
	return float(nearest(p)[1]) > width * 0.5 + (1.5 if street() else 0.0)

## a point `m` metres further round from where `p` is, for a driver to aim at
func ahead(p: Vector3, m: float) -> Vector3:
	return at(float(nearest(p)[0]) + m)

## how sharp the lap is `m` ahead of `p` (0 straight, 1 tight), for a driver's throttle
func curvature_ahead(p: Vector3, m: float) -> float:
	var d := float(nearest(p)[0])
	var a := dir_at(d + m * 0.5)
	var b := dir_at(d + m)
	return clampf(a.angle_to(b) / 0.6, 0.0, 1.0)

## the grid: `slot` 0 is pole, two abreast, 7 m apart, behind the start line
func grid(slot: int) -> Transform3D:
	var d := float(def.start) - 8.0 - (slot / 2) * 7.0
	var c := at(d)
	var f := dir_at(d)
	var side := Vector3(f.z, 0, -f.x) * (3.0 if slot % 2 == 0 else -3.0)
	var t := Transform3D(Basis.looking_at(f, Vector3.UP), c + side)
	return t
