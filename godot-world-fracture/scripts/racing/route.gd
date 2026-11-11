extends RefCounted
## A long-distance race route (owner's Racing Tracks Pack 01, Nov 11: "GTA × Need for Speed", 12–86 km stages and
## circuits; docs/racing/track-pack-01, data/race_routes.json). Pure, no nodes.
##
## The pack gives each route ten or so control points kilometres apart, so a route here is that skeleton with the road
## a real one would take: a Catmull-Rom spline through the points, then bends along it sized to the kind of road (city
## blocks, sweeping highway, rally esses, mountain switchbacks), tapered to zero at the control points so the pack's
## layout holds, and a height profile (the climb to Frostveil Summit, dunes on the Glass Flats, rolling highway). The
## pack's checkpoints are kept at the same share of the way along the finished road (its README asks for checkpoints to
## be recomputed once the route is laid).
##
## `nearest_from(p, hint)` searches a window round a car's last known distance (a 86 km route has 17 000 samples; a
## full search per car per frame is too slow for a phone); `ground(p, hint)` is the road's height under a point and the
## shoulder falling away beside it.

const DATA := "res://data/race_routes.json"
const STEP := 5.0

## per kind: bend amplitude (m) and wavelength (m), height swing (m) and wavelength, climb over the whole route (m), the
## look the view dresses it with, and how far a car may leave the road before it is off course
const KINDS := {
	"street_sprint": { "bend": 26.0, "wave": 420.0, "hill": 4.0, "hill_wave": 900.0, "climb": 0.0, "look": "neon", "verge": 2.0 },
	"elevated_circuit": { "bend": 40.0, "wave": 900.0, "hill": 14.0, "hill_wave": 1600.0, "climb": 0.0, "look": "neon", "verge": 1.0 },
	"professional_circuit": { "bend": 55.0, "wave": 700.0, "hill": 6.0, "hill_wave": 1400.0, "climb": 0.0, "look": "nexus", "verge": 8.0 },
	"highway_sprint": { "bend": 70.0, "wave": 2200.0, "hill": 18.0, "hill_wave": 3000.0, "climb": 0.0, "look": "highway", "verge": 4.0 },
	"offroad_rally": { "bend": 110.0, "wave": 950.0, "hill": 10.0, "hill_wave": 380.0, "climb": 0.0, "look": "desert", "verge": 30.0 },
	"mountain_point_to_point": { "bend": 70.0, "wave": 420.0, "hill": 30.0, "hill_wave": 1800.0, "climb": 1450.0, "look": "snow", "verge": 3.0 },
	"coastal_circuit": { "base": 18.0, "bend": 60.0, "wave": 800.0, "hill": 10.0, "hill_wave": 2200.0, "climb": 0.0, "look": "coast", "verge": 4.0 },
	"hovercraft_water_circuit": { "bend": 90.0, "wave": 650.0, "hill": 0.0, "hill_wave": 1000.0, "climb": 0.0, "look": "water", "verge": 40.0 },
}

var id: String
var def: Dictionary
var kind: Dictionary
var closed := false
var width := 14.0
var pts: PackedVector3Array = PackedVector3Array()
var cum: PackedFloat32Array = PackedFloat32Array()
var length := 0.0
var checkpoints: PackedFloat32Array = PackedFloat32Array()   # metres along the finished road

static var _data: Dictionary

static func all() -> Array:
	if _data.is_empty():
		var f := FileAccess.open(DATA, FileAccess.READ)
		_data = JSON.parse_string(f.get_as_text()) if f else {"routes": []}
	return _data.routes

static func ids() -> Array:
	return all().map(func(r: Dictionary) -> String: return String(r.id))

static func find(route_id: String) -> Dictionary:
	for r in all():
		if String(r.id) == route_id:
			return r
	return {}

func _init(route_id: String) -> void:
	id = route_id
	def = find(route_id)
	kind = KINDS.get(String(def.get("race_type", "")), KINDS.street_sprint)
	closed = bool(def.get("closed", false))
	width = maxf(10.0, float(def.get("lane_w", 14.0)))
	var ctrl: Array[Vector3] = []
	for p in def.get("points", []):
		ctrl.append(Vector3(float(p[0]), 0.0, float(p[1])))
	if closed and ctrl.size() > 2 and ctrl[0].distance_to(ctrl[ctrl.size() - 1]) < 1.0:
		ctrl.remove_at(ctrl.size() - 1)
	_lay(ctrl)
	# the pack's checkpoints at the same share of the way along the finished road
	var pack_len := float(def.get("length_m", length))
	for c in def.get("checkpoints", []):
		var at_m := clampf(float(c) / pack_len, 0.0, 1.0) * length
		# strictly increasing; a circuit's last checkpoint is its start line, which the lap itself counts
		if (not checkpoints.is_empty() and at_m <= checkpoints[checkpoints.size() - 1] + 1.0) or (closed and at_m > length - 50.0):
			continue
		checkpoints.append(at_m)
	if not closed and (checkpoints.is_empty() or checkpoints[checkpoints.size() - 1] < length - 1.0):
		checkpoints.append(length)

## the spline, the bends and the heights
func _lay(ctrl: Array[Vector3]) -> void:
	var n := ctrl.size()
	var spline: Array[Vector3] = []
	var at_ctrl: Array[int] = []          # sample index of each control point
	var segs := n if closed else n - 1
	for i in segs:
		var p0: Vector3 = ctrl[(i - 1 + n) % n] if closed or i > 0 else ctrl[0] * 2.0 - ctrl[1]
		var p1: Vector3 = ctrl[i]
		var p2: Vector3 = ctrl[(i + 1) % n]
		var p3: Vector3 = ctrl[(i + 2) % n] if closed or i + 2 < n else ctrl[n - 1] * 2.0 - ctrl[n - 2]
		var steps := maxi(4, int(p1.distance_to(p2) / STEP))
		at_ctrl.append(spline.size())
		for s in steps:
			spline.append(_catmull(p0, p1, p2, p3, float(s) / steps))
	if not closed:
		at_ctrl.append(spline.size())
		spline.append(ctrl[n - 1])
	# distances along the raw spline, to place the bends
	var raw := PackedFloat32Array()
	raw.resize(spline.size())
	var d := 0.0
	for i in spline.size():
		raw[i] = d
		if i + 1 < spline.size():
			d += spline[i].distance_to(spline[i + 1])
	var total := d
	var bend: float = kind.bend
	var wave: float = kind.wave
	var hill: float = kind.hill
	var hwave: float = kind.hill_wave
	var climb: float = kind.climb
	var seed := float(absi(hash(id)) % 1000)
	var ci := 0
	for i in spline.size():
		# the taper: zero at the control points, full between them
		while ci + 1 < at_ctrl.size() and at_ctrl[ci + 1] <= i:
			ci += 1
		var a0 := raw[at_ctrl[ci]]
		var a1 := raw[at_ctrl[ci + 1]] if ci + 1 < at_ctrl.size() else total
		var u := clampf((raw[i] - a0) / maxf(a1 - a0, 1.0), 0.0, 1.0)
		var taper := sin(u * PI)
		var x := raw[i]
		var side := sin(x / wave * TAU + seed) * 0.7 + sin(x / (wave * 0.37) * TAU + seed * 1.7) * 0.3
		var f := (spline[mini(i + 1, spline.size() - 1)] - spline[maxi(i - 1, 0)])
		f.y = 0.0
		f = f.normalized() if f.length() > 0.001 else Vector3.FORWARD
		var normal := Vector3(f.z, 0, -f.x)
		var p := spline[i] + normal * side * bend * taper
		var t := x / maxf(total, 1.0)
		var y := hill * (sin(x / hwave * TAU + seed * 0.5) * 0.7 + sin(x / (hwave * 0.29) * TAU) * 0.3)
		y += float(kind.get("base", 0.0))                # the coast road runs along the cliff above the sea
		if climb > 0.0:
			y += climb * (0.5 - 0.5 * cos(t * PI))      # a long climb from the valley to the summit
		elif closed:
			y *= sin(t * PI) * 0.5 + 0.5                # circuits come back to their own start line
		p.y = y
		pts.append(p)
	_smooth()
	cum.resize(pts.size() + 1)
	d = 0.0
	for i in pts.size():
		cum[i] = d
		var j := (i + 1) % pts.size()
		if closed or i + 1 < pts.size():
			d += pts[i].distance_to(pts[j])
	cum[pts.size()] = d
	length = d

## round off anything tighter than a car can take: a few passes of a 45 m moving average (ends held on a stage)
func _smooth() -> void:
	var count := pts.size()
	for it in 4:
		var out := PackedVector3Array()
		out.resize(count)
		for i in count:
			if not closed and (i < 4 or i >= count - 4):
				out[i] = pts[i]
				continue
			var acc := Vector3.ZERO
			for k in range(-4, 5):
				acc += pts[posmod(i + k, count)]
			out[i] = acc / 9.0
		pts = out

static func _catmull(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: float) -> Vector3:
	var t2 := t * t
	var t3 := t2 * t
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)

func look() -> String:
	return String(kind.look)

func laps() -> int:
	return int(def.get("laps", 1)) if closed else 1

## the sample at or before `d` metres along
func _index_at(d: float) -> int:
	d = fposmod(d, length) if closed else clampf(d, 0.0, length)
	var lo := 0
	var hi := pts.size() - 1
	while lo < hi:
		var mid := (lo + hi + 1) / 2
		if cum[mid] <= d:
			lo = mid
		else:
			hi = mid - 1
	return lo

## the point `d` metres along (wraps on a circuit, clamps on a stage)
func at(d: float) -> Vector3:
	d = fposmod(d, length) if closed else clampf(d, 0.0, length)
	var lo := 0
	var hi := pts.size() - 1
	while lo < hi:
		var mid := (lo + hi + 1) / 2
		if cum[mid] <= d:
			lo = mid
		else:
			hi = mid - 1
	var b := pts[(lo + 1) % pts.size()] if closed or lo + 1 < pts.size() else pts[lo]
	var seg := cum[lo + 1] - cum[lo]
	return pts[lo].lerp(b, (d - cum[lo]) / maxf(seg, 0.001))

func dir_at(d: float) -> Vector3:
	var a := at(d - 2.5)
	var b := at(d + 2.5)
	var f := b - a
	return f.normalized() if f.length() > 0.001 else Vector3.FORWARD

## [along, sideways distance] of the nearest road point to `p`, searching `window` metres either side of `hint`
## (hint < 0: the whole route, for a first fix)
func nearest_from(p: Vector3, hint: float, window := 260.0) -> Array:
	var count := pts.size()
	var i0 := 0
	var i1 := count - 1
	if hint >= 0.0:
		var c := _index_at(hint)
		var w := int(window / STEP) + 2
		i0 = c - w
		i1 = c + w
		if not closed:
			i0 = maxi(i0, 0)
			i1 = mini(i1, count - 2)
	var best_d := 1e12
	var best_along := 0.0
	var stride := 1
	var i := i0
	while i <= i1:
		var k := posmod(i, count)
		var k2 := (k + 1) % count
		if not closed and k2 == 0:
			i += stride
			continue
		var a := pts[k]
		var ab := pts[k2] - a
		var tt := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		var q := a + ab * tt
		var dd := Vector2(p.x - q.x, p.z - q.z).length_squared()
		if dd < best_d:
			best_d = dd
			best_along = cum[k] + tt * (cum[k + 1] - cum[k])
		i += stride
	return [best_along, sqrt(best_d)]

## the ground under `p`: the road's height across its width, then the shoulder (a bank up on one side and a drop on the
## other in the mountains, flat elsewhere)
func ground(p: Vector3, hint: float) -> float:
	var n := nearest_from(p, hint)
	var y := at(float(n[0])).y
	var off := float(n[1]) - width * 0.5
	if off <= 0.0:
		return y
	if look() == "coast":
		# the land rises inland (left), the cliff drops to the beach and the sea (right)
		var fc := dir_at(float(n[0]))
		var qc := at(float(n[0]))
		if Vector3(fc.z, 0, -fc.x).dot(p - qc) > 0.0:
			return lerpf(y, 0.6, clampf(off / 40.0, 0.0, 1.0))
		return y + off * 0.12
	if look() == "snow":
		var f := dir_at(float(n[0]))
		var q := at(float(n[0]))
		var side := signf(Vector3(f.z, 0, -f.x).dot(p - q))
		return y + (off * 0.55 if side > 0.0 else -off * 0.35)
	return y - minf(off, 6.0) * 0.04

func off_course(p: Vector3, hint: float) -> bool:
	return float(nearest_from(p, hint)[1]) > width * 0.5 + float(kind.verge)

## a car's place on the grid: `slot` 0 is pole, two abreast, 8 m apart, behind the start
func grid(slot: int) -> Transform3D:
	var d := (0.0 if closed else 80.0) - 8.0 - (slot / 2) * 8.0
	if closed:
		d = fposmod(d, length)
	var c := at(d)
	var f := dir_at(d)
	var side := Vector3(f.z, 0, -f.x) * (width * 0.22 if slot % 2 == 0 else -width * 0.22)
	return Transform3D(Basis.looking_at(Vector3(f.x, 0, f.z).normalized(), Vector3.UP), c + side)
