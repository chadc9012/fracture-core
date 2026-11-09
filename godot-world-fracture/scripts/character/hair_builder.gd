extends RefCounted
## Hairstyles as geometry (a port of the web game's hair-geometry.ts), built in head space around the head they go on: the skull
## is measured from the head mesh (fit_skull), caps are lat/long shells over it down to the hairline, and locs, braids, tails and
## twists are tubes along curves that leave the scalp and hang. Each strand carries its own shade in the vertex colour. The same
## style on the same head always builds the same hair.

const HAIR_DEPTH := 0.012
const BP := 24
const BT := 48

var centre := Vector3(0, 0.09, -0.005)
var radii := Vector3(0.085, 0.11, 0.1)
var az_front := 0.1
var az_back := 0.1

# geometry accumulator
var _v := PackedVector3Array()
var _n := PackedVector3Array()
var _c := PackedColorArray()
var _uv := PackedVector2Array()
var _i := PackedInt32Array()

static func rand(seed: float) -> float:
	var x := sin(seed * 127.1 + 311.7) * 43758.5453
	return x - floorf(x)

func radius_at(d: Vector3) -> float:
	return 1.0 / Vector3(d.x / radii.x, d.y / radii.y, d.z / (az_front if d.z > 0.0 else az_back)).length()

static func dir_of(phi: float, theta: float) -> Vector3:
	return Vector3(sin(phi) * sin(theta), cos(phi), sin(phi) * cos(theta))

func on_skull(phi: float, theta: float, lift := 0.0) -> Vector3:
	var d := dir_of(phi, theta)
	return d * (radius_at(d) + lift) + centre

func outward(p: Vector3) -> Vector3:
	return ((p - centre) / radii).normalized()

static func hairline(theta: float) -> float:
	var t := (1.0 - cos(theta)) / 2.0
	return lerpf(0.45 * PI, 0.62 * PI, sin(t * PI * 0.5))

## measures the head (head-space vertices) and fits its skull, less the cut hair's thickness
func fit_skull(pts: PackedVector3Array) -> void:
	var crown := -INF
	for p in pts:
		if absf(p.x) < 0.035 and p.z > -0.05 and p.z < 0.06 and p.y > crown:
			crown = p.y
	if crown > -INF:
		centre = Vector3(0, clampf(crown * 0.5, 0.07, 0.1), -0.005)
	var d0 := radii
	var outer := PackedFloat32Array()
	outer.resize(BP * BT)
	var step := maxi(1, pts.size() / 20000)
	for k in range(0, pts.size(), step):
		var v := pts[k] - centre
		var r := v.length()
		if r < 1e-4:
			continue
		var d := v / r
		if d.y < -0.15 and d.z > -0.3:
			continue
		if r > 1.0 / (d / d0).length() * 1.12:
			continue
		var phi := acos(clampf(d.y, -1, 1))
		var th := atan2(d.x, d.z) + PI
		var bi := mini(BP - 1, int(phi / PI * BP)) * BT + mini(BT - 1, int(th / TAU * BT))
		outer[bi] = maxf(outer[bi], r)
	var stat := func(pick: Callable, fallback: float) -> float:
		var picked: Array[float] = []
		for i in BP:
			for j in BT:
				var r: float = outer[i * BT + j]
				if r <= 0.0:
					continue
				var phi := (i + 0.5) / BP * PI
				var th := (j + 0.5) / BT * TAU - PI
				if pick.call(dir_of(phi, th)):
					picked.append(r)
		if picked.size() < 3:
			return fallback
		picked.sort()
		return picked[int(picked.size() * 0.4)]
	var ax: float = stat.call(func(d: Vector3) -> bool: return absf(d.x) > 0.8 and d.y > -0.1, d0.x + HAIR_DEPTH) - HAIR_DEPTH
	var ay: float = stat.call(func(d: Vector3) -> bool: return d.y > 0.8, d0.y + HAIR_DEPTH) - HAIR_DEPTH
	az_front = stat.call(func(d: Vector3) -> bool: return d.z > 0.8 and d.y > 0.0, d0.z + HAIR_DEPTH) - HAIR_DEPTH
	az_back = stat.call(func(d: Vector3) -> bool: return d.z < -0.8, d0.z + HAIR_DEPTH) - HAIR_DEPTH
	radii = Vector3(ax, ay, maxf(az_front, az_back))

# --- geometry helpers

func _add_arrays(arr: Array, xf: Transform3D, shade: float) -> void:
	var base := _v.size()
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var ns: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var uvs: Variant = arr[Mesh.ARRAY_TEX_UV]
	for k in vs.size():
		_v.append(xf * vs[k])
		_n.append((xf.basis * ns[k]).normalized())
		_c.append(Color(shade, shade, shade))
		_uv.append(uvs[k] if uvs != null else Vector2.ZERO)
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for k in idx:
		_i.append(base + k)

## a lat/long shell over the skull, `lift` (float or Callable(phi, theta)) off it, down to limit(theta)
func shell(lift: Variant, limit: Callable, shade := 1.0, rows := 18, cols := 36) -> void:
	var base := _v.size()
	var grid: Array[Vector3] = []
	for i in rows + 1:
		for j in cols + 1:
			var th := float(j) / cols * TAU
			var phi := minf(limit.call(th), float(i) / rows * PI)
			var lv: float = lift if lift is float else lift.call(phi, th)
			grid.append(on_skull(phi, th, lv))
	for k in grid.size():
		_v.append(grid[k])
		_n.append(outward(grid[k]))
		_c.append(Color(shade, shade, shade))
		_uv.append(Vector2(float(k % (cols + 1)) / cols, float(k / (cols + 1)) / rows))
	for i in rows:
		for j in cols:
			var a := base + i * (cols + 1) + j
			var b := a + cols + 1
			_i.append_array([a, a + 1, b, b, a + 1, b + 1])

func cap(thick: float, side_thick: Variant, phi_max: Variant, shade := 1.0) -> void:
	var lim := func(th: float) -> float: return minf(phi_max if phi_max != null else 0.6 * PI, hairline(th))
	if side_thick == null:
		shell(thick, lim, shade)
	else:
		var st: float = side_thick
		shell(func(phi: float, _th: float) -> float: return lerpf(thick, st, smoothstep(0.22 * PI, 0.5 * PI, phi)), lim, shade)

static func _catmull(pts: Array[Vector3], t: float) -> Vector3:
	var n := pts.size() - 1
	var f := clampf(t, 0.0, 1.0) * n
	var i := mini(int(f), n - 1)
	var u := f - i
	var p0 := pts[maxi(i - 1, 0)]
	var p1 := pts[i]
	var p2 := pts[i + 1]
	var p3 := pts[mini(i + 2, n)]
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u)

## a tube along a curve through pts, radius r tapering to r_end
func strand(pts: Array[Vector3], r: float, seed: float, r_end := -1.0, segs := 8, sides := 5, tip := 1.0) -> void:
	var shade0 := 0.82 + rand(seed) * 0.3
	var base := _v.size()
	var prev_n := Vector3.ZERO
	for s in segs + 1:
		var t := float(s) / segs
		var p := _catmull(pts, t)
		var tan := (_catmull(pts, minf(1.0, t + 0.01)) - _catmull(pts, maxf(0.0, t - 0.01))).normalized()
		if tan == Vector3.ZERO:
			tan = Vector3.DOWN
		var nrm := prev_n
		if nrm == Vector3.ZERO or absf(nrm.dot(tan)) > 0.99:
			nrm = tan.cross(Vector3.RIGHT if absf(tan.x) < 0.9 else Vector3.FORWARD).normalized()
		nrm = (nrm - tan * nrm.dot(tan)).normalized()
		prev_n = nrm
		var bin := tan.cross(nrm)
		var rr := r if r_end < 0.0 else lerpf(r, r_end, t)
		var shade := shade0 * lerpf(1.0, tip, smoothstep(0.45, 1.0, t))
		for k in sides + 1:
			var a := float(k) / sides * TAU
			var o := nrm * cos(a) + bin * sin(a)
			_v.append(p + o * rr)
			_n.append(o)
			_c.append(Color(shade, shade, shade))
			_uv.append(Vector2(float(k) / sides, t * 4.0))
	for s in segs:
		for k in sides:
			var a := base + s * (sides + 1) + k
			var b := a + sides + 1
			_i.append_array([a, b, a + 1, b, b + 1, a + 1])

func hanging(root: Vector3, length: float, r: float, seed: float, curl := false) -> void:
	var n := outward(root)
	if n.z > 0.15:
		n.x += (signf(n.x) if n.x != 0.0 else 1.0) * n.z * 0.9
		n.z *= 0.15
		n = n.normalized()
	var drift := (rand(seed + 1) - 0.5) * 0.04
	var p1 := root + n * 0.03 + Vector3(0, -length * 0.15, 0)
	var p2 := root + n * (0.03 + absf(drift)) + Vector3(drift, -length * 0.6, -0.01)
	var p3 := root + Vector3(n.x * 0.025 + drift * 1.4, -length, n.z * 0.02 - 0.015)
	var path: Array[Vector3] = [root, p1, p2, p3]
	if not curl:
		strand(path, r, seed)
		return
	var side := n.cross(Vector3.UP).normalized()
	var pts: Array[Vector3] = []
	for i in 15:
		var t := i / 14.0
		var a := t * PI * 7.0 + seed
		pts.append(_catmull(path, t) + side * cos(a) * 0.012 * t + n * sin(a) * 0.012 * t)
	strand(pts, r, seed, -1.0, 20)

## short twists over the top of the head (web hair-geometry.ts twistTop): each rises off the scalp, tips over and falls
## outward, wound as two strands, lighter or darker at the ends by `tip`
func twist_top(count: int, length: float, radius: float, seed: float, phi_max: float, tip: float) -> void:
	var rings := maxi(3, roundi(sqrt(count * 0.6)))
	var i := 0
	for ring in rings:
		var phi := 0.03 * PI + float(ring) / (rings - 1) * (phi_max - 0.03 * PI)
		var per := maxi(3, roundi(float(count) / rings * (0.35 + 1.3 * sin(phi))))
		for k in per:
			var th := (k + 0.5 + rand(seed + i) * 0.4) / per * TAU + ring * 0.37
			i += 1
			if phi > hairline(th) - 0.06:
				continue
			var root := on_skull(phi, th, 0.003)
			var n := outward(root)
			var h := (dir_of(0.5 * PI, th) + Vector3(0, 0, 0.35)).normalized()
			var l := length * (0.75 + rand(seed + (i - 1) * 5) * 0.5)
			var fall := 0.08 + (phi / phi_max) * 0.3
			var side := n.cross(h).normalized()
			var pts: Array[Vector3] = []
			for s in 9:
				var t := s / 8.0
				var p := root + n * l * (0.75 * t - 0.2 * t * t) + h * l * fall * t * t + Vector3(0, -l * fall * 0.6 * t * t * t, 0)
				var a := t * PI * 5.0 + rand(seed + i - 1) * 6.0
				pts.append(p + side * cos(a) * radius * 0.45 + h * sin(a) * radius * 0.25)
			strand(pts, radius, seed + i - 1, radius * 0.6, 10, 6, tip)

func roots(count: int, seed: float) -> Array[Vector3]:
	var out: Array[Vector3] = []
	var rings := maxi(2, roundi(sqrt(count)))
	var i := 0
	for ring in rings:
		if out.size() >= count:
			break
		var phi := 0.12 * PI + float(ring) / (rings - 1) * 0.5 * PI
		var per := maxi(1, roundi(float(count) / rings * (0.5 + sin(phi))))
		for k in per:
			if out.size() >= count:
				break
			var th := (k + 0.5) / per * TAU + rand(seed + i) * 0.2
			i += 1
			if phi > hairline(th) - 0.05:
				continue
			out.append(on_skull(phi, th, 0.004))
	return out

func _look(axis: Vector3) -> Basis:
	# rotates +Z onto axis
	var z := axis.normalized()
	var up := Vector3.UP if absf(z.y) < 0.99 else Vector3.RIGHT
	var x := up.cross(z).normalized()
	return Basis(x, z.cross(x), z)

func tie(at: Vector3, axis: Vector3, r: float) -> void:
	var t := TorusMesh.new()
	t.inner_radius = r - 0.004
	t.outer_radius = r + 0.004
	t.rings = 14
	t.ring_segments = 6
	# torus lies in XZ (axis Y): rotate Y onto axis
	var b := _look(axis) * Basis(Vector3.RIGHT, -PI / 2)
	_add_arrays(t.get_mesh_arrays(), Transform3D(b, at), 0.35)

func cornrow(theta: float, seed: float, hang: float) -> void:
	var pts: Array[Vector3] = []
	for s in 7:
		var t := s / 6.0
		var th := theta if t < 0.5 else PI - theta
		var phi := (hairline(th) - 0.08) * absf(t * 2.0 - 1.0)
		pts.append(on_skull(maxf(0.05, phi), th, 0.006))
	var back := pts[-1]
	if hang > 0.0:
		pts.append(back + Vector3(0, -hang * 0.45, -0.025))
		pts.append(back + Vector3(0, -hang, -0.03))
	strand(pts, 0.007, seed)

func bun(phi: float, theta: float, r: float, flat: float, braided: bool) -> void:
	var at := on_skull(phi, theta, r * 0.45)
	var n := outward(at)
	var sp := SphereMesh.new()
	sp.radius = r
	sp.height = r * 2.0
	sp.radial_segments = 18
	sp.rings = 10
	_add_arrays(sp.get_mesh_arrays(), Transform3D(_look(n) * Basis.from_scale(Vector3(1, flat, 0.85)), at), 0.95)
	tie(on_skull(phi, theta, 0.004), n, r * 0.72)
	if braided:
		var side := n.cross(Vector3.UP).normalized()
		var up := side.cross(n).normalized()
		var pts: Array[Vector3] = []
		for i in 31:
			var a := i * 0.7
			var rr := r * (0.3 + 0.7 * (i / 30.0))
			pts.append(at + side * cos(a) * rr + up * sin(a) * rr * flat + n * (r * 0.75 * sqrt(maxf(0.0, 1.0 - pow(rr / r, 2))) + 0.002))
		strand(pts, 0.006, 77, -1.0, 40)

func tail(phi: float, theta: float, length: float, radius: float, sway: float, seed: float) -> void:
	var base := on_skull(phi, theta, 0.012)
	var n := outward(base)
	tie(base, n, radius * 0.9)
	var back := Vector3(n.x, 0, n.z).normalized()
	var high := phi < 0.45 * PI
	var pts: Array[Vector3] = [base, base + back * (0.06 if high else 0.025) + Vector3(0, -0.03 if high else -0.06, 0),
		base + back * (0.07 if high else 0.01) + Vector3(sway * 0.02, -length * 0.55, 0),
		base + back * (0.03 if high else -0.005) + Vector3(sway * 0.03, -length, 0)]
	strand(pts, radius, seed, radius * 0.45, 12, 6)

func curtain(length: float, waves: float, span: float, side: int, seed: float) -> void:
	var half := minf(PI, 0.45 * PI * span)
	var cols := maxi(6, roundi(half * 14.0))
	for j in cols + 1:
		var th := PI + float(j) / cols * 2.0 * half - half
		if side == 1 and th < PI:
			continue
		if side == -1 and th > PI:
			continue
		var top := on_skull(hairline(th) - 0.02, th, 0.012)
		var n := outward(top)
		n.y = 0
		n = n.normalized()
		var pts: Array[Vector3] = []
		for i in 7:
			var t := i / 6.0
			var wave := sin(t * PI * 2.2 + j) * 0.012 * waves * t if waves != 0.0 else 0.0
			pts.append(top + n * (0.008 + t * 0.03 + wave) + Vector3(0, -length * t, 0))
		strand(pts, 0.011, seed + j, 0.007)

func tufts(count: int, length: float, radius: float, seed: float, spiky: bool, curl: bool) -> void:
	var rs := roots(count, seed)
	for i in rs.size():
		var r := rs[i]
		var n := outward(r)
		var side := n.cross(Vector3.UP).normalized() * (rand(seed + i * 3) - 0.5)
		if spiky:
			var cone := CylinderMesh.new()
			cone.top_radius = 0.0
			cone.bottom_radius = radius
			cone.height = length
			cone.radial_segments = 5
			cone.rings = 1
			var axis := (n + side * 0.6 + Vector3(0, 0.3, 0)).normalized()
			var b := _look(axis) * Basis(Vector3.RIGHT, PI / 2)
			_add_arrays(cone.get_mesh_arrays(), Transform3D(b, r + axis * length * 0.5), 0.85 + rand(i) * 0.3)
			continue
		var dir := (n * 0.3 + side + Vector3(0, -0.6, 0)).normalized()
		if curl:
			var pts: Array[Vector3] = []
			for k in 11:
				var t := k / 10.0
				var a := t * PI * 4.0 + i
				pts.append(r + dir * length * t + n * sin(a) * 0.008 + side * cos(a) * 0.008)
			strand(pts, radius, seed + i, -1.0, 14)
		else:
			var path: Array[Vector3] = [r, r + dir * length * 0.5 + n * 0.01, r + dir * length]
			strand(path, radius, seed + i, radius * 0.5)

func fringe(sweep: int, lift: float, up: bool) -> void:
	if up:
		for k in range(-3, 4):
			var th := k * 0.18
			var r := on_skull(hairline(th) - 0.1, th, 0.008)
			var n := outward(r)
			var path: Array[Vector3] = [r, r + n * lift * 0.6 + Vector3(0, lift * 0.8, 0), r + n * -0.01 + Vector3(0, lift * 1.3, -0.03)]
			strand(path, 0.012, 90 + k, 0.006)
		return
	var s := float(sweep if sweep != 0 else 1)
	if sweep == 0:
		var p0: Array[Vector3] = [on_skull(0.42 * PI, -0.45, lift + 0.004), on_skull(0.44 * PI, 0, lift + 0.008), on_skull(0.42 * PI, 0.45, lift + 0.004)]
		strand(p0, 0.014, 3)
	else:
		var p1: Array[Vector3] = [on_skull(0.36 * PI, -0.6 * s, lift), on_skull(0.4 * PI, -0.15 * s, lift + 0.008), on_skull(0.44 * PI, 0.35 * s, lift + 0.004)]
		strand(p1, 0.016, 3)

func crown_braid() -> void:
	var pts: Array[Vector3] = []
	for j in 41:
		var th := j / 40.0 * TAU
		pts.append(on_skull(hairline(th) - 0.12, th, 0.012))
	strand(pts, 0.011, 88, -1.0, 60)

func side_braid(side: int, length: float) -> void:
	var th := side * 0.72 * PI
	var top := on_skull(0.5 * PI, th, 0.014)
	var pts: Array[Vector3] = [top, top + Vector3(side * 0.01, -0.08, 0.03), top + Vector3(side * 0.005, -length * 0.6, 0.06), top + Vector3(0, -length, 0.075)]
	strand(pts, 0.016, 99, 0.009, 10, 6)
	tie(pts[3] + Vector3(0, 0.02, 0), Vector3.UP, 0.011)

static func _g(p: Dictionary, k: String, d: Variant = null) -> Variant:
	return p[k] if p.has(k) and p[k] != null else d

func begin() -> void:
	_v = PackedVector3Array(); _n = PackedVector3Array(); _c = PackedColorArray(); _uv = PackedVector2Array(); _i = PackedInt32Array()

## the geometry added since begin(), as an ArrayMesh (null when empty)
func take() -> ArrayMesh:
	if _v.is_empty():
		return null
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = _v
	arr[Mesh.ARRAY_NORMAL] = _n
	arr[Mesh.ARRAY_COLOR] = _c
	arr[Mesh.ARRAY_TEX_UV] = _uv
	arr[Mesh.ARRAY_INDEX] = _i
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	begin()
	# tangents, so the strand shader can bump along the hair
	var st := SurfaceTool.new()
	st.create_from(m, 0)
	st.generate_tangents()
	return st.commit()

## adds a primitive mesh's arrays (a sphere, a box…) placed by xf
func add_primitive(pm: PrimitiveMesh, xf: Transform3D, shade := 1.0) -> void:
	_add_arrays(pm.get_mesh_arrays(), xf, shade)

## builds a style (catalogue entry) into an ArrayMesh in head space; null for "as modelled" and bald
func build(style: Dictionary) -> ArrayMesh:
	if style.get("kind", "") != "built":
		return null
	begin()
	var seed := 1.0
	for p: Dictionary in style.get("parts", []):
		seed += 17.0
		match p.kind:
			"cap": cap(p.thick, _g(p, "sideThick"), _g(p, "phiMax"), _g(p, "shade", 1.0))
			"fringe": fringe(int(p.sweep), _g(p, "lift", 0.012), _g(p, "up", false))
			"hanging":
				var rs := roots(int(p.count), p.seed)
				for i in rs.size():
					hanging(rs[i], p.length + rand(p.seed + i) * p.jitter, p.radius, p.seed + i, _g(p, "curl", false))
			"tied":
				var is_bun: bool = _g(p, "bun", false)
				var gather := on_skull(0.42 * PI if is_bun else 0.56 * PI, PI, 0.03)
				var rs := roots(int(p.count), 17)
				for i in rs.size():
					var md := outward((rs[i] + gather) * 0.5)
					var mid := md * (radius_at(md) + 0.012) + centre
					var path: Array[Vector3] = [rs[i], mid, gather]
					strand(path, p.radius, i)
				if is_bun:
					bun(0.42 * PI, PI, 0.04, 0.9, false)
				else:
					tie(gather, Vector3(0, 0.3, -1), 0.03)
					for i in 12:
						var a := i / 12.0 * TAU
						var st := gather + Vector3(cos(a) * 0.018, sin(a) * 0.012, -0.01)
						var path2: Array[Vector3] = [st, st + Vector3(cos(a) * 0.01, -0.1, -0.02), st + Vector3(cos(a) * 0.015, -0.22, -0.01)]
						strand(path2, p.radius, 50 + i)
			"tail": tail(p.phi, p.theta, p.length, p.radius, _g(p, "sway", 0.0), seed)
			"bun": bun(p.phi, p.theta, p.r, _g(p, "flat", 1.0), _g(p, "braided", false))
			"crest":
				var w: float = _g(p, "width", 0.022)
				for i in 13:
					var t := i / 12.0
					var th := 0.0 if t < 0.5 else PI
					var phi := (hairline(th) - 0.06) * absf(t * 2.0 - 1.0)
					var at := on_skull(maxf(0.03, phi), th, 0.002)
					var n := outward(at)
					var h: float = p.height * (0.75 + 0.35 * sin(t * PI))
					var bx := BoxMesh.new()
					bx.size = Vector3(w, h, 0.028)
					# the box stands on the scalp: its Y along the normal, its width across the head
					var xa := (Vector3.RIGHT - n * n.x).normalized()
					_add_arrays(bx.get_mesh_arrays(), Transform3D(Basis(xa, n, xa.cross(n)), at + n * h * 0.5), 0.9 + 0.1 * rand(i))
			"afro":
				var start := _v.size()
				var ex: float = _g(p, "extra", 0.25)
				shell(0.0, func(th: float) -> float: return minf(0.7 * PI, hairline(th) + ex), 1.0, 36, 72)
				for k in range(start, _v.size()):
					_v[k] = _v[k] + outward(_v[k]) * (p.lift + rand((k - start) * 7) * p.jitter)
			"curtain": curtain(p.length, _g(p, "waves", 0.0), _g(p, "span", 1.0), int(_g(p, "side", 0)), seed)
			"cornrows":
				var rows := int(p.rows)
				for i in rows:
					cornrow(-0.6 + float(i) / (rows - 1) * 1.2, i, _g(p, "hang", 0.15))
			"crown": crown_braid()
			"tufts": tufts(int(p.count), p.length, p.radius, p.seed, _g(p, "spiky", false), _g(p, "curl", false))
			"sideBraid": side_braid(int(p.side), p.length)
			"twistTop": twist_top(int(p.count), p.length, p.radius, p.seed, p.phiMax, _g(p, "tip", 1.0))
	return take()

## the skin-toned skull that closes a head whose cut hair is taken away, just under the skull surface
func scalp() -> ArrayMesh:
	begin()
	# tucked further in at the front, so it never shows through the forehead
	shell(func(phi: float, th: float) -> float: return -0.005 - 0.008 * maxf(0.0, cos(th)) * smoothstep(0.15 * PI, 0.4 * PI, phi), func(th: float) -> float: return minf(0.88 * PI, hairline(th) + lerpf(0.05, 0.8, (1.0 - cos(th)) / 2.0)), 1.0, 24, 40)
	return take()
