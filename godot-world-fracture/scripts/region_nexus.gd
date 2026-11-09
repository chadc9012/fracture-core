extends RefCounted
## The Nexus Region board's set pieces in the region 3D view (owner, Nov 9: "Nexus Region v1.0", pass 2): waterfalls off the
## ridge and the sea cliffs, yachts at the harbour, the marina and out on the bay, and three landmarks the plain extrusion
## can't draw — the corrupted Fracture Spire, the Lighthouse Point light and the Nexus Beach Ferris wheel. region_3d.gd calls
## `dress(r)` once the ground, buildings and rings are in; the landmarks come through its `_build_landmarks`.

const LANDMARKS := ["The Fracture Spire", "Lighthouse Point", "Nexus Beach Wheel"]

static func dress(r: Node) -> void:
	_falls(r)
	_yachts(r)

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
