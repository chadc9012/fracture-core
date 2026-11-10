extends RefCounted
## The Nexus Region board's set pieces in the region 3D view (owner, Nov 9: "Nexus Region v1.0", pass 2): waterfalls off the
## ridge and the sea cliffs, yachts at the harbour, the marina and out on the bay, and three landmarks the plain extrusion
## can't draw — the corrupted Fracture Spire, the Lighthouse Point light and the Nexus Beach Ferris wheel. region_3d.gd calls
## `dress(r)` once the ground, buildings and rings are in; the landmarks come through its `_build_landmarks`.

const LANDMARKS := ["The Fracture Spire", "Lighthouse Point", "Nexus Beach Wheel"]

static func dress(r: Node) -> void:
	_falls(r)
	_yachts(r)
	_courts(r)
	_harbor(r)
	_stadiums(r)
	_southreach(r)
	_eastpoint(r)
	_villas(r)

# ---------------------------------------------------------------------------------------------------------------- falls

## every "falls" place: find the steepest way down from it, then hang a curtain of white water from the lip to the foot
## with a pool of mist where it lands
static func _falls(r: Node) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var mist: Array[Vector3] = []
	var any := false
	for p in r.m.pois:
		if String(p.cat) != "falls":
			continue
		var c: Vector2 = r._loc(float(p.x), float(p.z))
		var best_dir := Vector2.ZERO
		var best_drop := 0.0
		var top: float = r._h(c.x, c.y)
		# the lip: the highest ground within 24 m, then the direction that falls furthest from it
		for k in 12:
			var a := float(k) / 12.0 * TAU
			for d in [8.0, 16.0, 24.0]:
				var q: Vector2 = c + Vector2(cos(a), sin(a)) * d
				var hq: float = r._h(q.x, q.y)
				if hq > top:
					top = hq
					c = q
		for k in 24:
			var a := float(k) / 24.0 * TAU
			var dir := Vector2(cos(a), sin(a))
			var low: float = top
			for s in range(3, 70, 3):
				low = minf(low, r._h(c.x + dir.x * s, c.y + dir.y * s))
			if top - low > best_drop:
				best_drop = top - low
				best_dir = dir
		if best_drop < 6.0:
			continue
		# walk out from the lip to the foot (the first point within 1.5 m of the lowest ground)
		var foot := 6.0
		var floor_y: float = maxf(top - best_drop, r._water)
		for s in range(3, 70, 2):
			if r._h(c.x + best_dir.x * s, c.y + best_dir.y * s) < floor_y + 1.5:
				foot = float(s)
				break
		var width := clampf(best_drop * 0.35, 6.0, 16.0)
		var side := Vector2(-best_dir.y, best_dir.x) * width * 0.5
		var steps := 8
		for i in steps:
			var t0 := float(i) / steps
			var t1 := float(i + 1) / steps
			var o0: Vector2 = c + best_dir * (sqrt(t0) * foot)
			var o1: Vector2 = c + best_dir * (sqrt(t1) * foot)
			var y0 := lerpf(top + 0.4, floor_y, t0 * t0)
			var y1 := lerpf(top + 0.4, floor_y, t1 * t1)
			var w1 := 1.0 + t1 * 0.5
			var w0 := 1.0 + t0 * 0.5
			var quad := [Vector3(o0.x - side.x * w0, y0, o0.y - side.y * w0), Vector3(o0.x + side.x * w0, y0, o0.y + side.y * w0),
				Vector3(o1.x + side.x * w1, y1, o1.y + side.y * w1), Vector3(o1.x - side.x * w1, y1, o1.y - side.y * w1)]
			var uvs := [Vector2(0, t0), Vector2(1, t0), Vector2(1, t1), Vector2(0, t1)]
			for tri in [[0, 1, 2], [0, 2, 3]]:
				for vi in tri:
					st.set_uv(uvs[vi])
					st.add_vertex(quad[vi])
		mist.append(Vector3(c.x + best_dir.x * foot, floor_y + 0.3, c.y + best_dir.y * foot))
		any = true
	if not any:
		return
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	float streak = n(vec2(UV.x * 9.0, UV.y * 6.0 - TIME * 1.6)) * 0.7 + n(vec2(UV.x * 23.0, UV.y * 14.0 - TIME * 2.6)) * 0.4;
	float edge = smoothstep(0.0, 0.18, UV.x) * smoothstep(1.0, 0.82, UV.x);
	ALBEDO = vec3(0.78, 0.9, 1.0) * (0.35 + streak) * edge * (0.75 + 0.25 * UV.y);
}"""
	var mat := ShaderMaterial.new()
	mat.shader = sh
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	r._world.add_child(mi)
	# the plunge pools: soft white discs of spray
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.albedo_color = Color(0.92, 0.97, 1.0, 0.45)
	var disc := CylinderMesh.new()
	disc.top_radius = 7.0
	disc.bottom_radius = 9.0
	disc.height = 1.2
	disc.radial_segments = 16
	for q in mist:
		var dm := MeshInstance3D.new()
		dm.mesh = disc
		dm.material_override = sm
		dm.position = q
		dm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		r._world.add_child(dm)

# --------------------------------------------------------------------------------------------------------------- yachts

## white yachts moored round every dock ring and a few at anchor out on the bay
static func _yachts(r: Node) -> void:
	var hull := _mat(Color("#f2f4f6"), 0.0, 0.2, 0.35)
	var glass := _mat(Color("#1d3550"), 0.0, 0.6, 0.1)
	var trim := _mat(Color("#4fb8ff"), 1.5)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7171
	var spots: Array[Array] = []
	for ring in r.m.rings:
		if String(ring[3]) != "dock":
			continue
		var c: Vector2 = r._loc(float(ring[0]), float(ring[1]))
		var rad: float = ring[2]
		for k in 7:
			var a := float(k) / 7.0 * TAU + rng.randf() * 0.4
			spots.append([c + Vector2(cos(a), sin(a)) * (rad + 6.0 + rng.randf() * 14.0), a + PI * 0.5, 0.7 + rng.randf() * 0.6])
	# at anchor: points over open water south of the coast
	var span: float = r._span
	for k in 60:
		if spots.size() > 40:
			break
		var q := Vector2(rng.randf_range(-0.25, 0.3), rng.randf_range(0.15, 0.4)) * span
		if r._h(q.x, q.y) < r._water - 3.0:
			spots.append([q, rng.randf() * TAU, 1.0 + rng.randf() * 0.9])
	for s in spots:
		var p: Vector2 = s[0]
		if r._h(p.x, p.y) > r._water - 1.0:
			continue  # never on land
		var y := Node3D.new()
		y.position = Vector3(p.x, r._water + 0.4, p.y)
		y.rotation.y = float(s[1])
		y.scale = Vector3.ONE * float(s[2])
		r._world.add_child(y)
		_part(y, BoxMesh.new(), hull, Vector3(0, 0.6, 0), Vector3(3.6, 1.6, 12.0))
		var bow := PrismMesh.new()
		_part(y, bow, hull, Vector3(0, 0.6, 7.4), Vector3(3.6, 1.6, 2.8), Vector3(PI * 0.5, 0, 0))
		_part(y, BoxMesh.new(), hull, Vector3(0, 2.0, -1.0), Vector3(2.8, 1.4, 6.5))
		_part(y, BoxMesh.new(), glass, Vector3(0, 2.1, -0.9), Vector3(2.9, 0.7, 6.0))
		_part(y, BoxMesh.new(), hull, Vector3(0, 3.1, -1.6), Vector3(2.2, 0.9, 3.6))
		_part(y, BoxMesh.new(), trim, Vector3(0, 1.45, 0), Vector3(3.7, 0.12, 12.1))

# ------------------------------------------------------------------------------------------------- beach, harbour, arenas

## Nexus Beach's courts: on every plaza near the beach, a tennis, basketball or volleyball court with its lines and net
static func _courts(r: Node) -> void:
	var beach := Vector2.INF
	for p in r.m.pois:
		if String(p.id) == "nr-beach":
			beach = r._loc(float(p.x), float(p.z))
	if beach == Vector2.INF:
		return
	var kinds := [[Color("#2f8f6a"), Color("#3a7bd5")], [Color("#d9772b"), Color("#b5532a")], [Color("#e9d29a"), Color("#e2c27e")]]
	var line := _mat(Color("#f6f6f6"), 0.4)
	var net := _mat(Color("#222831"))
	var k := 0
	for pv in r.m.pavements:
		var at: Vector2 = r._loc(float(pv[0]), float(pv[1]))
		if String(pv[5]) != "plaza" or at.distance_to(beach) > 140.0:
			continue
		var hx: float = pv[2]
		var hz: float = pv[3]
		var y: float = r._h(at.x, at.y) + 0.18
		var kind: Array = kinds[k % 3]
		var root := Node3D.new()
		root.position = Vector3(at.x, y, at.y)
		root.rotation.y = float(pv[4])
		r._world.add_child(root)
		_part(root, BoxMesh.new(), _mat(kind[1]), Vector3.ZERO, Vector3(hx * 2.0, 0.08, hz * 2.0))
		_part(root, BoxMesh.new(), _mat(kind[0]), Vector3(0, 0.03, 0), Vector3(hx * 1.6, 0.08, hz * 1.5))
		for sz: float in [-1.0, 1.0]:
			_part(root, BoxMesh.new(), line, Vector3(0, 0.08, sz * hz * 0.75), Vector3(hx * 1.6, 0.03, 0.12))
		for sx: float in [-1.0, 1.0]:
			_part(root, BoxMesh.new(), line, Vector3(sx * hx * 0.8, 0.08, 0), Vector3(0.12, 0.03, hz * 1.5))
		_part(root, BoxMesh.new(), line, Vector3(0, 0.08, 0), Vector3(0.12, 0.03, hz * 1.5))
		_part(root, BoxMesh.new(), net, Vector3(0, 0.55, 0), Vector3(0.08, 1.0 if k % 3 == 0 else 2.4, hz * 1.6))
		k += 1

## Nexus Harbor's working quay: gantry cranes along the water and container stacks on the apron behind them
static func _harbor(r: Node) -> void:
	var dock := Vector2.INF
	for ring in r.m.rings:
		if String(ring[3]) == "dock" and String(ring[4]) == "Nexus Harbor":
			dock = r._loc(float(ring[0]), float(ring[1]))
	if dock == Vector2.INF:
		return
	var orange := _mat(Color("#e8742b"), 0.0, 0.3, 0.5)
	var blue := _mat(Color("#2b6fe8"), 0.0, 0.3, 0.5)
	var lamp := _mat(Color("#fff0b5"), 3.0)
	# the quay: the harbour apron nearest the dock ring; the cranes stand along its sea edge, booms out over the water
	var shore := dock
	var best := INF
	for pv in r.m.pavements:
		if String(pv[5]) != "apron":
			continue
		var at: Vector2 = r._loc(float(pv[0]), float(pv[1]))
		if at.distance_to(dock) < best:
			best = at.distance_to(dock)
			shore = at + Vector2(0, float(pv[3]) - 3.0)
	var gy: float = r._h(shore.x, shore.y)
	for k in 4:
		var c := Node3D.new()
		c.position = Vector3(shore.x - 45.0 + k * 30.0, gy, shore.y + 2.0)
		r._world.add_child(c)
		var col := orange if k % 2 == 0 else blue
		for sx: float in [-1.0, 1.0]:
			for sz: float in [-1.0, 1.0]:
				_part(c, BoxMesh.new(), col, Vector3(sx * 4.0, 9.0, sz * 5.0), Vector3(0.9, 18.0, 0.9))
		_part(c, BoxMesh.new(), col, Vector3(0, 18.5, 4.0), Vector3(9.5, 1.4, 36.0))
		_part(c, BoxMesh.new(), col, Vector3(0, 21.0, 0), Vector3(7.0, 3.5, 4.0))
		_part(c, BoxMesh.new(), lamp, Vector3(0, 19.4, 21.5), Vector3(1.0, 0.4, 0.6))
	# containers: a few stacks of mixed colours behind the cranes
	var cols := [Color("#c0392b"), Color("#2e86de"), Color("#27ae60"), Color("#f39c12"), Color("#8e44ad"), Color("#ecf0f1")]
	var rng := RandomNumberGenerator.new()
	rng.seed = 5151
	var box := BoxMesh.new()
	for row in 3:
		for i in 10:
			var at := shore + Vector2(-50.0 + i * 10.5, -16.0 - row * 6.0)
			var g: float = r._h(at.x, at.y)
			if g < r._water + 0.5:
				continue
			for lvl in rng.randi_range(1, 3):
				_part(r._world, box, _mat(cols[rng.randi() % cols.size()], 0.0, 0.4, 0.6), Vector3(at.x, g + 1.3 + lvl * 2.6, at.y), Vector3(6.1, 2.5, 2.4))

## the Arena and the Stadium as bowls: raked stands round a lit field, a violet neon crown and four light towers
static func _stadiums(r: Node) -> void:
	var stand := _mat(Color("#d9dde6"), 0.0, 0.2, 0.6)
	var seats := _mat(Color("#3b3f6e"))
	var field := _mat(Color("#2f9e4a"), 0.25)
	var neon := _mat(Color("#a35cff"), 3.0)
	var lamp := _mat(Color("#fffbe8"), 5.0)
	for ring in r.m.rings:
		if String(ring[3]) != "arena":
			continue
		var c: Vector2 = r._loc(float(ring[0]), float(ring[1]))
		var rad: float = ring[2]
		var gy: float = r._h(c.x, c.y)
		var root := Node3D.new()
		root.position = Vector3(c.x, gy, c.y)
		r._world.add_child(root)
		var outer := CylinderMesh.new()
		outer.top_radius = rad + 3.0
		outer.bottom_radius = rad + 1.0
		outer.height = 12.0
		outer.radial_segments = 40
		outer.cap_top = false
		_part(root, outer, stand, Vector3(0, 6.0, 0), Vector3(1.0, 1.0, 0.78))
		var bowl := CylinderMesh.new()
		bowl.top_radius = rad + 2.6
		bowl.bottom_radius = rad * 0.62
		bowl.height = 11.0
		bowl.radial_segments = 40
		bowl.cap_bottom = false
		bowl.cap_top = false
		bowl.flip_faces = true
		_part(root, bowl, seats, Vector3(0, 6.0, 0), Vector3(1.0, 1.0, 0.78))
		_part(root, _disc(rad * 0.62), field, Vector3(0, 0.6, 0), Vector3(1.0, 1.0, 0.78))
		var crown := TorusMesh.new()
		crown.inner_radius = rad + 2.6
		crown.outer_radius = rad + 3.4
		crown.rings = 48
		crown.ring_segments = 4
		_part(root, crown, neon, Vector3(0, 12.2, 0), Vector3(1.0, 1.0, 0.78))
		for k in 4:
			var a := float(k) / 4.0 * TAU + PI * 0.25
			var p := Vector3(cos(a) * (rad + 5.0), 0, sin(a) * (rad + 5.0) * 0.78)
			_part(root, BoxMesh.new(), stand, p + Vector3(0, 11.0, 0), Vector3(0.8, 22.0, 0.8))
			_part(root, BoxMesh.new(), lamp, p + Vector3(0, 22.5, 0), Vector3(3.0, 1.6, 0.6), Vector3(0, -a, 0))

## a named building's spot on the map (local), or INF
static func _named(r: Node, name: String) -> Vector2:
	for bd in r.m.buildings:
		if bd.size() > 7 and String(bd[7]) == name:
			return r._loc(float(bd[0]), float(bd[1]))
	return Vector2.INF

## Southreach: three arched hangars along the airfield, a radar dish turning on its tower, a comms mast with red lights
static func _southreach(r: Node) -> void:
	var hq := _named(r, "Nexus Defense HQ")
	if hq == Vector2.INF:
		return
	var steel := _mat(Color("#7c8a7a"), 0.0, 0.5, 0.5)
	var dark := _mat(Color("#2d3530"))
	var white := _mat(Color("#e9eef2"), 0.0, 0.3, 0.4)
	var red := _mat(Color("#ff3b30"), 4.0)
	for rd in r.m.roads:
		if String(rd.get("name", "")) != "Southreach Airfield":
			continue
		var a: Vector2 = r._loc(float(rd.pts[0][0]), float(rd.pts[0][1]))
		var b: Vector2 = r._loc(float(rd.pts[1][0]), float(rd.pts[1][1]))
		var dir := (b - a).normalized()
		var nrm := Vector2(-dir.y, dir.x)
		for k in 3:
			var at := a.lerp(b, 0.25 + 0.25 * k) + nrm * 26.0
			var gy: float = r._h(at.x, at.y)
			var h := Node3D.new()
			h.position = Vector3(at.x, gy, at.y)
			h.rotation.y = atan2(dir.x, dir.y)
			r._world.add_child(h)
			var arch := CylinderMesh.new()
			arch.top_radius = 8.0
			arch.bottom_radius = 8.0
			arch.height = 22.0
			arch.radial_segments = 16
			_part(h, arch, steel, Vector3(0, 0, 0), Vector3(1, 1, 0.75), Vector3(0, 0, PI * 0.5)).rotation = Vector3(PI * 0.5, 0, 0)
			_part(h, BoxMesh.new(), dark, Vector3(0, 3.0, 11.05), Vector3(10.0, 6.0, 0.2))
	# the radar: a turning dish on a lattice tower beside the HQ
	var rt := hq + Vector2(-40, -30)
	var gy2: float = r._h(rt.x, rt.y)
	var tower := Node3D.new()
	tower.position = Vector3(rt.x, gy2, rt.y)
	r._world.add_child(tower)
	_part(tower, BoxMesh.new(), steel, Vector3(0, 7.0, 0), Vector3(2.4, 14.0, 2.4))
	var turn := Node3D.new()
	turn.position = Vector3(0, 15.0, 0)
	turn.set_meta("spin", 0.8)
	tower.add_child(turn)
	r._spin.append(turn)
	var dish := SphereMesh.new()
	dish.radius = 4.5
	dish.height = 2.2
	dish.is_hemisphere = true
	_part(turn, dish, white, Vector3(0, 0, 1.0), Vector3.ONE, Vector3(-PI * 0.4, 0, 0))
	# the comms mast with its red lights
	var mt := hq + Vector2(30, -36)
	var gy3: float = r._h(mt.x, mt.y)
	_part(r._world, BoxMesh.new(), white, Vector3(mt.x, gy3 + 18.0, mt.y), Vector3(0.8, 36.0, 0.8))
	for y in [12.0, 24.0, 36.5]:
		_part(r._world, SphereMesh.new(), red, Vector3(mt.x, gy3 + y, mt.y), Vector3.ONE * 0.9)

## Eastpoint: smokestacks banded red and white with smoke rising, and round storage tanks beside the steelworks
static func _eastpoint(r: Node) -> void:
	var works := _named(r, "Nexus Steelworks")
	var yard := _named(r, "Logistics Center")
	if works == Vector2.INF:
		return
	var brick := _mat(Color("#8c4a3a"), 0.0, 0.0, 0.8)
	var white := _mat(Color("#e8e8e8"))
	var red := _mat(Color("#c0392b"))
	var tank := _mat(Color("#cfd6dc"), 0.0, 0.6, 0.35)
	var smoke := _mat(Color(0.75, 0.75, 0.78, 0.35))
	smoke.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	smoke.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var rng := RandomNumberGenerator.new()
	rng.seed = 6262
	for k in 3:
		var at := works + Vector2(-22.0 + k * 22.0, -26.0)
		var gy: float = r._h(at.x, at.y)
		var h := 34.0 + k * 6.0
		var stack := CylinderMesh.new()
		stack.top_radius = 1.6
		stack.bottom_radius = 2.4
		stack.height = h
		stack.radial_segments = 14
		_part(r._world, stack, brick, Vector3(at.x, gy + h * 0.5, at.y))
		var band := CylinderMesh.new()
		band.top_radius = 1.7
		band.bottom_radius = 1.75
		band.height = 3.0
		band.radial_segments = 14
		_part(r._world, band, red, Vector3(at.x, gy + h - 5.0, at.y))
		_part(r._world, band, white, Vector3(at.x, gy + h - 2.0, at.y))
		for i in 4:
			var puff := SphereMesh.new()
			puff.radius = 2.5 + i * 1.6
			puff.height = (2.5 + i * 1.6) * 1.6
			_part(r._world, puff, smoke, Vector3(at.x + i * 2.5, gy + h + 3.0 + i * 4.5, at.y - i * 1.2))
	var base := yard if yard != Vector2.INF else works + Vector2(40, 40)
	for k in 5:
		var at := base + Vector2(-30.0 + (k % 3) * 18.0, 24.0 + float(k / 3) * 18.0)
		var gy: float = r._h(at.x, at.y)
		var t := CylinderMesh.new()
		t.top_radius = 6.5
		t.bottom_radius = 6.5
		t.height = 9.0
		t.radial_segments = 20
		_part(r._world, t, tank, Vector3(at.x, gy + 4.5, at.y))

## the Azure Keys' villas: a turquoise pool beside each and a pier out to the water
static func _villas(r: Node) -> void:
	var keys := Vector2.INF
	for p in r.m.pois:
		if String(p.id) == "nr-keys":
			keys = r._loc(float(p.x), float(p.z))
	if keys == Vector2.INF:
		return
	var pool := _mat(Color("#2fd3e0"), 0.6, 0.2, 0.05)
	var deck := _mat(Color("#c9a77a"))
	var wood := _mat(Color("#8a6a48"))
	for bd in r.m.buildings:
		if String(bd[5]) != "house":
			continue
		var at: Vector2 = r._loc(float(bd[0]), float(bd[1]))
		if at.distance_to(keys) > 420.0:
			continue
		# the way to the water: the first of 12 directions that reaches it within 30 m
		var to := Vector2.ZERO
		for k in 12:
			var d := Vector2(cos(k * TAU / 12.0), sin(k * TAU / 12.0))
			if r._h(at.x + d.x * 22.0, at.y + d.y * 22.0) < r._water - 0.3:
				to = d
				break
		if to == Vector2.ZERO:
			continue
		var gy: float = r._h(at.x, at.y)
		var side := Vector2(-to.y, to.x)
		var pp := at + side * 7.0
		_part(r._world, BoxMesh.new(), deck, Vector3(pp.x, r._h(pp.x, pp.y) + 0.15, pp.y), Vector3(6.0, 0.3, 6.0))
		_part(r._world, BoxMesh.new(), pool, Vector3(pp.x, r._h(pp.x, pp.y) + 0.32, pp.y), Vector3(4.2, 0.1, 4.2))
		var a := at + to * 5.0
		var b := at + to * 24.0
		var mid := (a + b) * 0.5
		var pier := _part(r._world, BoxMesh.new(), wood, Vector3(mid.x, r._water + 0.6, mid.y), Vector3(1.6, 0.3, a.distance_to(b)))
		pier.rotation.y = atan2(to.x, to.y)

static func _disc(rad: float) -> CylinderMesh:
	var d := CylinderMesh.new()
	d.top_radius = rad
	d.bottom_radius = rad
	d.height = 0.3
	d.radial_segments = 32
	return d

# ------------------------------------------------------------------------------------------------------------ landmarks

## one of the board's landmarks on its plot (root stands at the plot's foot, turned to its yaw; top = its height above that)
static func landmark(r: Node, root: Node3D, name: String, hx: float, hz: float, top: float) -> void:
	match name:
		"The Fracture Spire":
			_fracture_spire(r, root, top)
		"Lighthouse Point":
			_lighthouse(r, root, top)
		"Nexus Beach Wheel":
			_wheel(r, root, top)

## the corrupted spire: a crown of violet crystal blades round one tall shard, cracks of light, and a column of rift light
static func _fracture_spire(r: Node, root: Node3D, top: float) -> void:
	var shard := _mat(Color("#5a1f8f"), 1.2, 0.3, 0.15)
	var glow := _mat(Color("#c060ff"), 4.5)
	var blade := CylinderMesh.new()
	blade.top_radius = 0.0
	blade.bottom_radius = 1.0
	blade.height = 1.0
	blade.radial_segments = 4
	blade.rings = 1
	_part(root, blade, shard, Vector3(0, top * 0.5, 0), Vector3(7.0, top, 7.0))
	_part(root, blade, glow, Vector3(0, top * 0.5 + 2.0, 0), Vector3(1.6, top * 0.92, 1.6))
	var rng := RandomNumberGenerator.new()
	rng.seed = 3131
	for k in 14:
		var a := float(k) / 14.0 * TAU + rng.randf() * 0.3
		var d := 8.0 + rng.randf() * 18.0
		var h := top * (0.2 + rng.randf() * 0.45)
		var tilt := 0.25 + rng.randf() * 0.35
		var n := Node3D.new()
		n.position = Vector3(cos(a) * d, 0, sin(a) * d)
		n.rotation = Vector3(sin(a) * tilt, rng.randf() * TAU, -cos(a) * tilt)
		root.add_child(n)
		_part(n, blade, shard if k % 3 else glow, Vector3(0, h * 0.5, 0), Vector3(2.0 + rng.randf() * 2.5, h, 2.0 + rng.randf() * 2.5))
	var beam := _mat(Color("#b44dff"), 5.0)
	beam.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beam.albedo_color.a = 0.3
	beam.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var col := CylinderMesh.new()
	col.top_radius = 6.0
	col.bottom_radius = 2.0
	col.height = 500.0
	col.radial_segments = 12
	_part(root, col, beam, Vector3(0, top + 250.0, 0))
	var light := OmniLight3D.new()
	light.light_color = Color("#b44dff")
	light.light_energy = 4.0
	light.omni_range = 90.0
	light.position = Vector3(0, top * 0.6, 0)
	root.add_child(light)
	# the board's lightning: jagged violet bolts from the tip down into the crags, each flashing on and off at its own
	# rate (region_3d's _process flickers nodes with a "flicker" meta)
	var bolt := _mat(Color("#e2b3ff"), 8.0)
	bolt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	for k in 5:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var a := float(k) / 5.0 * TAU + rng.randf() * 0.6
		var from := Vector3(0, top, 0)
		var to := Vector3(cos(a) * (30.0 + rng.randf() * 40.0), rng.randf() * 10.0, sin(a) * (30.0 + rng.randf() * 40.0))
		var prev := from
		for i in range(1, 9):
			var t := float(i) / 8.0
			var q := from.lerp(to, t) + (Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.4, 0.4), rng.randf_range(-1, 1)) * 7.0 if i < 8 else Vector3.ZERO)
			var side := (q - prev).cross(Vector3.UP).normalized() * 0.5
			if side.length() < 0.1:
				side = Vector3(0.5, 0, 0)
			var quad := [prev - side, prev + side, q + side, q - side]
			for tri in [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]:
				for vi in tri:
					st.add_vertex(quad[vi])
			prev = q
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = bolt
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.set_meta("flicker", 0.6 + rng.randf() * 1.4)
		mi.set_meta("spin", 0.0)
		root.add_child(mi)
		r._spin.append(mi)

## a white lighthouse banded in red on its rock, the lamp room glowing and its beam turning
static func _lighthouse(r: Node, root: Node3D, top: float) -> void:
	var white := _mat(Color("#f4f1ea"), 0.0, 0.0, 0.6)
	var red := _mat(Color("#c3332c"), 0.0, 0.0, 0.5)
	var lamp := _mat(Color("#fff2b0"), 6.0)
	var tower := CylinderMesh.new()
	tower.top_radius = 2.0
	tower.bottom_radius = 3.0
	tower.height = 1.0
	tower.radial_segments = 16
	var body := top - 5.0
	_part(root, tower, white, Vector3(0, body * 0.5, 0), Vector3(1, body, 1))
	for k in 3:
		var y := body * (0.2 + 0.28 * float(k))
		var f := 1.0 - (y / body) * 0.33
		var band := CylinderMesh.new()
		band.top_radius = 3.0 * f + 0.05
		band.bottom_radius = 3.0 * f + 0.05
		band.height = 2.4
		band.radial_segments = 16
		_part(root, band, red, Vector3(0, y, 0))
	var room := CylinderMesh.new()
	room.top_radius = 1.6
	room.bottom_radius = 1.6
	room.height = 2.6
	room.radial_segments = 12
	_part(root, room, lamp, Vector3(0, body + 1.4, 0))
	var cap := CylinderMesh.new()
	cap.top_radius = 0.2
	cap.bottom_radius = 2.2
	cap.height = 1.6
	cap.radial_segments = 12
	_part(root, cap, red, Vector3(0, body + 3.4, 0))
	var sweep := Node3D.new()
	sweep.position = Vector3(0, body + 1.4, 0)
	sweep.set_meta("spin", 0.9)
	root.add_child(sweep)
	r._spin.append(sweep)
	var beam := _mat(Color("#fff2b0"), 4.0)
	beam.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beam.albedo_color.a = 0.22
	beam.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var cone := CylinderMesh.new()
	cone.top_radius = 0.4
	cone.bottom_radius = 9.0
	cone.height = 140.0
	cone.radial_segments = 10
	_part(sweep, cone, beam, Vector3(0, 0, 70.0), Vector3.ONE, Vector3(PI * 0.5, 0, 0))
	var light := OmniLight3D.new()
	light.light_color = Color("#fff2b0")
	light.light_energy = 2.5
	light.omni_range = 40.0
	light.position = Vector3(0, body + 1.4, 0)
	root.add_child(light)

## the Ferris wheel on Nexus Beach: a lit rim on two legs, spokes and gondolas, turning slowly
static func _wheel(r: Node, root: Node3D, top: float) -> void:
	var steel := _mat(Color("#e8ecf2"), 0.0, 0.7, 0.3)
	var neon := _mat(Color("#b06bff"), 3.0)
	var pink := _mat(Color("#ff5fb8"), 2.5)
	var rad := top * 0.45
	var hub_y := top - rad
	for sx: float in [-1.0, 1.0]:
		var leg := Node3D.new()
		leg.position = Vector3(sx * 2.0, 0, 0)
		root.add_child(leg)
		for sz: float in [-1.0, 1.0]:
			var ll := sqrt(hub_y * hub_y + (rad * 0.45) ** 2)
			_part(leg, BoxMesh.new(), steel, Vector3(0, hub_y * 0.5, sz * rad * 0.22), Vector3(0.6, ll, 0.6), Vector3(sz * atan2(rad * 0.45, hub_y), 0, 0))
	var wheel := Node3D.new()
	wheel.position = Vector3(0, hub_y, 0)
	wheel.rotation = Vector3(0, 0, 0)
	root.add_child(wheel)
	# the wheel turns about its axle (local x): spin it through a child turned so its y is the axle
	var axle := Node3D.new()
	axle.rotation = Vector3(0, 0, PI * 0.5)
	axle.set_meta("spin", 0.15)
	wheel.add_child(axle)
	r._spin.append(axle)
	var rim := TorusMesh.new()
	rim.inner_radius = rad - 0.6
	rim.outer_radius = rad
	rim.rings = 48
	rim.ring_segments = 6
	_part(axle, rim, neon, Vector3.ZERO)
	for k in 12:
		var a := float(k) / 12.0 * TAU
		_part(axle, BoxMesh.new(), steel, Vector3(cos(a) * rad * 0.5, 0, sin(a) * rad * 0.5), Vector3(rad, 0.25, 0.25), Vector3(0, -a, 0))
		_part(axle, BoxMesh.new(), pink if k % 2 else neon, Vector3(cos(a) * rad, 0, sin(a) * rad), Vector3(1.6, 1.6, 1.6))

# ----------------------------------------------------------------------------------------------------------- helpers

static func _mat(col: Color, emit := 0.0, metal := 0.0, rough := 0.5) -> StandardMaterial3D:
	var mt := StandardMaterial3D.new()
	mt.albedo_color = col
	mt.metallic = metal
	mt.roughness = rough
	if emit > 0.0:
		mt.emission_enabled = true
		mt.emission = col
		mt.emission_energy_multiplier = emit
	return mt

static func _part(parent: Node3D, mesh: Mesh, mat: Material, at: Vector3, scl := Vector3.ONE, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = at
	mi.scale = scl
	mi.rotation = rot
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi
