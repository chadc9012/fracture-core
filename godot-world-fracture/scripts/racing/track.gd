extends RefCounted
## A race track as data (the Dec 4 plan, phase 5; the owner's racing direction: real venues with stands and pit lanes): a
## closed centreline sampled from control points, a width, and where the start line, the pit lane and the grandstands sit.
## `progress(p)` is how far round the lap a point is (0..1), which the race uses for laps and positions; `nearest(p)` and
## `ahead(p, m)` steer the rivals; `off_track(p)` is the grass. Pure, no nodes.

const TrackPack := preload("res://scripts/racing/track_pack.gd")

const TRACKS := {
	"nexus-speedway": {
		# a grand-prix circuit (owner, Nov 11: "make the racing longer"; was a 569 m oval): a 420 m main straight along -z at
		# x = 0, a hairpin onto the long back straight, the sweeping west side, the infield esses, the north loop and the
		# fast final bends back onto the straight. ~3.6 km a lap since Nov 18 (×1.7, the owner: "make the racing tracks longer"), five laps. Metres.
		"name": "Nexus Speedway", "width": 14.0, "laps": 5, "prize": [1600, 850, 420, 160],
		"points": [[0, 0, 306], [0, 0, -408], [-24, 0, -486], [-102, 0, -518], [-255, 0, -518], [-408, 0, -507], [-510, 0, -459], [-561, 0, -366], [-578, 0, -255], [-586, 0, -102], [-561, 0, -26], [-493, 0, 17], [-425, 0, -17], [-357, 0, -68], [-289, 0, -51], [-255, 0, 8], [-255, 0, 153], [-286, 0, 255], [-366, 0, 314], [-493, 0, 348], [-561, 0, 425], [-544, 0, 510], [-459, 0, 561], [-255, 0, 570], [-102, 0, 544], [-31, 0, 476], [0, 0, 391]],
		"start": 0.0,
		"pit": { "x": 20.0, "z0": -100.0, "z1": 100.0 },
		"stands": [{ "x": 30.0, "z0": -200.0, "z1": 200.0, "yaw": 0.0 }, { "x": -621.0, "z0": -340.0, "z1": -136.0, "yaw": 0.0 }],
	},
	# a night street circuit through Neon City's blocks: the avenue is the main straight, right-angle corners round the
	# blocks, a jog through the market grid; concrete barriers instead of kerbs and grass (race_view builds it as a city)
	"neon-circuit": {
		# ~3.2 km a lap through a dozen blocks (Nov 18 ×1.7; Nov 11 1.9 km, was 779 m): the 500 m avenue, the south blocks, the market jog west,
		# the long west boulevard, the north blocks and back onto the avenue. Four laps.
		"name": "Neon Night Circuit", "kind": "street", "width": 13.0, "laps": 4, "prize": [2000, 1100, 500, 200],
		"points": [[0, 0, 425], [0, 0, -425], [-17, 0, -479], [-68, 0, -496], [-306, 0, -496], [-357, 0, -479], [-374, 0, -428], [-374, 0, -255], [-394, 0, -207], [-442, 0, -190], [-561, 0, -190], [-609, 0, -170], [-629, 0, -122], [-629, 0, 153], [-609, 0, 201], [-561, 0, 221], [-391, 0, 221], [-343, 0, 238], [-323, 0, 286], [-323, 0, 493], [-303, 0, 541], [-255, 0, 561], [-68, 0, 561], [-17, 0, 544], [0, 0, 493]],
		"start": 0.0,
	},
}

## the ground the track covers (x and z extents of the centreline), grown by `margin` metres
func bounds(margin := 0.0) -> Rect2:
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for p in pts:
		lo = Vector2(minf(lo.x, p.x), minf(lo.y, p.z))
		hi = Vector2(maxf(hi.x, p.x), maxf(hi.y, p.z))
	return Rect2(lo, hi - lo).grow(margin)

## the tracks a lobby lists, in order: the venues, then Track Pack 01 (track_pack.gd)
static func ids() -> Array:
	return TRACKS.keys() + TrackPack.ids()

static func def_of(track_id: String) -> Dictionary:
	if TRACKS.has(track_id):
		return TRACKS[track_id]
	return TrackPack.def(track_id)

func street() -> bool:
	return String(def.get("kind", "venue")) == "street"

## one of the owner's Track Pack 01 tracks (long, open country; pack_venue.gd builds it)
func pack() -> bool:
	return String(def.get("kind", "venue")) == "pack"

var id: String
var def: Dictionary
var pts: PackedVector3Array = PackedVector3Array()
var cum: PackedFloat32Array = PackedFloat32Array()
var length := 0.0
var width := 14.0

func _init(track_id: String) -> void:
	id = track_id
	def = def_of(track_id)
	width = float(def.width)
	# a long lap is sampled coarser (an 86 km rally at 3 m would be 29,000 points; its corners are hundreds of metres)
	var spacing := 3.0 if not pack() else 8.0
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
		var steps := maxi(2, int(seg / spacing))
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
	if pts.size() > 1000:
		_build_grid()

## a long lap's segments bucketed in 64 m cells, so `nearest` looks at a few dozen instead of all of them
const CELL := 64.0
var _grid := {}

func _cell(x: float, z: float) -> Vector2i:
	return Vector2i(int(floor(x / CELL)), int(floor(z / CELL)))

func _build_grid() -> void:
	for i in pts.size():
		var a := pts[i]
		var b := pts[(i + 1) % pts.size()]
		var cells := { _cell(a.x, a.z): true, _cell(b.x, b.z): true }
		for c: Vector2i in cells:
			if not _grid.has(c):
				_grid[c] = PackedInt32Array()
			(_grid[c] as PackedInt32Array).append(i)

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
	if not _grid.is_empty():
		var c := _cell(p.x, p.z)
		var segs := PackedInt32Array()
		for dx in range(-1, 2):
			for dz in range(-1, 2):
				var k := Vector2i(c.x + dx, c.y + dz)
				if _grid.has(k):
					segs.append_array(_grid[k])
		if not segs.is_empty():
			return _nearest_of(p, segs)
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

func _nearest_of(p: Vector3, segs: PackedInt32Array) -> Array:
	var best_d := 1e9
	var best_along := 0.0
	for i in segs:
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

## how far `p` is from the road, looking no further than `max_r` (scenery placement: no full scan for far points)
func distance_to_road(p: Vector3, max_r: float) -> float:
	if _grid.is_empty():
		return minf(float(nearest(p)[1]), max_r)
	var c := _cell(p.x, p.z)
	var r := int(ceil(max_r / CELL))
	var segs := PackedInt32Array()
	for dx in range(-r, r + 1):
		for dz in range(-r, r + 1):
			var k := Vector2i(c.x + dx, c.y + dz)
			if _grid.has(k):
				segs.append_array(_grid[k])
	if segs.is_empty():
		return max_r
	return minf(float(_nearest_of(p, segs)[1]), max_r)

## the road's height under `p` (the pack's highways climb, Frostveil drops into its glacier)
func height_at(p: Vector3) -> float:
	return at(float(nearest(p)[0])).y

## the checkpoints as distances round the lap (the owner's 12 on a pack track; none on the venues)
func checkpoint_alongs() -> Array:
	var out: Array = []
	for c in def.get("checkpoints", []):
		out.append(float(nearest(Vector3(float(c[0]), float(c[1]), float(c[2])))[0]))
	out.sort()
	return out

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
