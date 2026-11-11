extends Node3D
## A Track Pack 01 venue (the owner's eight tracks, Nov 11): builds one of their 12–86 km laps as a place to race —
## the sky and light of its region, the road laid along their centre line in 400 m pieces that draw only near the car
## (asphalt, shoulders, edge lines, a dashed centre; kerbs on the Grand Prix, a buoy lane on the water), pillars under
## the raised highways, scenery scattered along it by environment (neon towers and street lights in Neon City, stands and
## blocks round the Grand Prix, dunes and rocks on the Glass Flats, pines and drifts at Frostveil, palms and the sea on the
## coast, islands round the hover lane), the owner's 12 checkpoints as arches, and a ground that follows the car.
## race_view.gd hosts it (track.pack()); `follow(p)` each frame. Nothing here collides: off the road, the car slows.

const Track := preload("res://scripts/racing/track.gd")
const CHUNK := 400.0
const SAMPLE := 8.0
const DRAW := 1800.0

## per environment: sky top / horizon, sun colour / energy / pitch, fog colour / density, ground, shoulder, night
const ENVS := {
	"city": { "top": Color(0.02, 0.01, 0.06), "horizon": Color(0.2, 0.06, 0.25), "sun": Color(0.55, 0.6, 1.0), "sun_e": 0.35, "pitch": -50.0,
		"fog": Color(0.3, 0.1, 0.38), "fog_d": 0.0022, "ground": Color(0.07, 0.07, 0.09), "shoulder": Color(0.16, 0.15, 0.18), "night": true },
	"highway-night": { "top": Color(0.02, 0.02, 0.07), "horizon": Color(0.25, 0.1, 0.3), "sun": Color(0.55, 0.6, 1.0), "sun_e": 0.35, "pitch": -45.0,
		"fog": Color(0.22, 0.1, 0.3), "fog_d": 0.0015, "ground": Color(0.06, 0.07, 0.08), "shoulder": Color(0.2, 0.2, 0.22), "night": true },
	"circuit": { "top": Color(0.2, 0.42, 0.75), "horizon": Color(0.78, 0.8, 0.82), "sun": Color(1.0, 0.95, 0.85), "sun_e": 2.2, "pitch": -55.0,
		"fog": Color(0.75, 0.8, 0.85), "fog_d": 0.0004, "ground": Color(0.16, 0.28, 0.12), "shoulder": Color(0.55, 0.53, 0.5), "night": false },
	"highway": { "top": Color(0.25, 0.3, 0.55), "horizon": Color(1.0, 0.6, 0.35), "sun": Color(1.0, 0.7, 0.45), "sun_e": 1.8, "pitch": -14.0,
		"fog": Color(0.85, 0.6, 0.45), "fog_d": 0.0006, "ground": Color(0.42, 0.38, 0.22), "shoulder": Color(0.5, 0.47, 0.4), "night": false },
	"desert": { "top": Color(0.3, 0.5, 0.8), "horizon": Color(0.95, 0.82, 0.6), "sun": Color(1.0, 0.9, 0.75), "sun_e": 1.6, "pitch": -45.0,
		"fog": Color(0.95, 0.82, 0.62), "fog_d": 0.0005, "ground": Color(0.66, 0.5, 0.3), "shoulder": Color(0.72, 0.58, 0.38), "night": false },
	"snow": { "top": Color(0.5, 0.6, 0.72), "horizon": Color(0.85, 0.88, 0.92), "sun": Color(0.9, 0.93, 1.0), "sun_e": 1.0, "pitch": -30.0,
		"fog": Color(0.85, 0.88, 0.93), "fog_d": 0.0012, "ground": Color(0.78, 0.81, 0.86), "shoulder": Color(0.75, 0.78, 0.82), "night": false },
	"coast": { "top": Color(0.15, 0.45, 0.85), "horizon": Color(0.75, 0.88, 0.95), "sun": Color(1.0, 0.95, 0.85), "sun_e": 2.3, "pitch": -50.0,
		"fog": Color(0.75, 0.88, 0.95), "fog_d": 0.0004, "ground": Color(0.86, 0.78, 0.58), "shoulder": Color(0.8, 0.74, 0.58), "night": false },
	"water": { "top": Color(0.3, 0.3, 0.6), "horizon": Color(1.0, 0.55, 0.4), "sun": Color(1.0, 0.65, 0.45), "sun_e": 1.8, "pitch": -12.0,
		"fog": Color(0.9, 0.6, 0.5), "fog_d": 0.0005, "ground": Color(0.05, 0.25, 0.38), "shoulder": Color(0.05, 0.25, 0.38), "night": false },
}

var track: Track
var env_id := "circuit"
var ground: MeshInstance3D
var sea: MeshInstance3D
var _rng := RandomNumberGenerator.new()
## pieces built (for tests): road chunks, scenery multimeshes, checkpoint arches
var chunks := 0
var scenery := 0
var arches := 0

func build(t: Track) -> void:
	track = t
	env_id = String(t.def.get("env", "circuit"))
	_rng.seed = hash(t.id)
	_environment()
	_samples()
	_ground()
	_road()
	_scenery()
	_checkpoints()

func e() -> Dictionary:
	return ENVS.get(env_id, ENVS.circuit)

func _mat(c: Color, rough := 0.85, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m

func _glow(c: Color, energy := 3.0) -> StandardMaterial3D:
	var m := _mat(c, 0.4)
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

# --------------------------------------------------------------------------------------------- sky and light
func _environment() -> void:
	var ev := e()
	var sun := DirectionalLight3D.new()
	sun.light_color = ev.sun
	sun.light_energy = float(ev.sun_e)
	sun.shadow_enabled = not bool(ev.night)
	sun.directional_shadow_max_distance = 120.0
	sun.rotation_degrees = Vector3(float(ev.pitch), 35, 0)
	add_child(sun)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var psm := ProceduralSkyMaterial.new()
	psm.sky_top_color = ev.top
	psm.sky_horizon_color = ev.horizon
	psm.ground_bottom_color = (ev.ground as Color).darkened(0.4)
	psm.ground_horizon_color = ev.horizon
	if bool(ev.night):
		psm.sun_angle_max = 0.0
	sky.sky_material = psm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 1.4 if bool(ev.night) else 0.9
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = ev.fog
	env.fog_density = float(ev.fog_d)
	if bool(ev.night):
		env.glow_enabled = true
		env.glow_intensity = 0.8
		env.glow_bloom = 0.05
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

# --------------------------------------------------------------------------------------------- the ground
## a wide plane under the car, moved with it (the lap is 12–86 km across; one plane that big loses depth precision)
func _ground() -> void:
	ground = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(5000, 5000)
	ground.mesh = pm
	var gm := _mat(e().ground, 0.95)
	if env_id == "water":
		gm = _mat(Color(0.03, 0.16, 0.25), 0.15, 0.1)
	ground.material_override = gm
	ground.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(ground)
	if env_id == "coast":
		# the sea beside the coast road: the land is the shore strip laid along the road (in _road), the plane is water
		gm = _mat(Color(0.03, 0.17, 0.26), 0.15, 0.1)
		ground.material_override = gm
	follow(track.at(0.0))

var _base := INF
func _base_y() -> float:
	if _base == INF:
		for p in track.pts:
			_base = minf(_base, p.y)
	return _base

## the road sampled every SAMPLE metres once: centres and right-hand side vectors (the strips read these)
var _c := PackedVector3Array()
var _s := PackedVector3Array()

func _samples() -> void:
	var n := int(ceil(track.length / SAMPLE)) + 1
	_c.resize(n)
	_s.resize(n)
	for k in n:
		var d := minf(k * SAMPLE, track.length)
		_c[k] = track.at(d)
		_s[k] = _side(d)

func _at_k(d: float) -> int:
	return clampi(int(round(d / SAMPLE)), 0, _c.size() - 1)

func follow(p: Vector3) -> void:
	var y := _base_y() - 0.35 if env_id != "snow" else track.height_at(p) - 0.45
	if env_id == "coast" or env_id == "water":
		y = 0.0 if env_id == "coast" else -0.2
	ground.position = Vector3(snappedf(p.x, 50.0), y, snappedf(p.z, 50.0))

# --------------------------------------------------------------------------------------------- the road
func _road() -> void:
	var w := track.width * 0.5
	var asphalt := _mat(Color(0.1, 0.1, 0.11) if env_id != "desert" else Color(0.62, 0.5, 0.33), 0.9)
	if env_id == "snow":
		asphalt = _mat(Color(0.2, 0.21, 0.23), 0.6)
	var shoulder := _mat(e().shoulder, 0.95)
	var paint := _mat(Color(0.92, 0.92, 0.88), 0.6)
	var kerb_r := _mat(Color(0.8, 0.12, 0.1), 0.6)
	var land := _mat(Color(0.86, 0.78, 0.58), 0.95)
	var pillar := _mat(Color(0.45, 0.45, 0.48), 0.8)
	var base := _base_y()
	var d0 := 0.0
	while d0 < track.length:
		var d1 := minf(d0 + CHUNK, track.length)
		var node := MeshInstance3D.new()
		var mesh := ArrayMesh.new()
		var mid := track.at((d0 + d1) * 0.5)
		node.position = Vector3(mid.x, 0, mid.z)
		if env_id != "water":
			_strip(mesh, d0, d1, -w, w, 0.03, asphalt, mid)
			_strip(mesh, d0, d1, w, w + 3.0, 0.0, shoulder, mid)
			_strip(mesh, d0, d1, -w - 3.0, -w, 0.0, shoulder, mid)
			_strip(mesh, d0, d1, w - 0.6, w - 0.35, 0.05, paint, mid)
			_strip(mesh, d0, d1, -w + 0.35, -w + 0.6, 0.05, paint, mid)
			_strip(mesh, d0, d1, -0.12, 0.12, 0.05, paint, mid, true)
			if env_id == "circuit":
				_strip(mesh, d0, d1, w, w + 1.2, 0.06, kerb_r, mid, true)
				_strip(mesh, d0, d1, -w - 1.2, -w, 0.06, kerb_r, mid, true)
			if env_id == "coast":
				_strip(mesh, d0, d1, w + 3.0, w + 90.0, -0.05, land, mid, false, -2.5)
				_strip(mesh, d0, d1, -w - 90.0, -w - 3.0, -0.05, land, mid, false, -2.5)
		node.mesh = mesh
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		node.visibility_range_end = DRAW
		node.visibility_range_end_margin = 100.0
		node.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		if mesh.get_surface_count() > 0:
			add_child(node)
			chunks += 1
		# the raised highway stands on pillars
		var d := d0
		while d < d1:
			var c := track.at(d)
			if c.y - base > 2.5 and env_id != "snow":
				for s: float in [-1.0, 1.0]:
					var side := _side(d)
					var mi := MeshInstance3D.new()
					var bm := BoxMesh.new()
					bm.size = Vector3(1.2, c.y - base, 1.2)
					mi.mesh = bm
					mi.material_override = pillar
					mi.position = c + side * s * (w - 1.5) - Vector3(0, (c.y - base) * 0.5 + 0.2, 0)
					mi.visibility_range_end = DRAW * 0.6
					mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
					add_child(mi)
			d += 60.0
		d0 = d1
	if env_id == "water":
		_buoys()

func _side(d: float) -> Vector3:
	var f := track.dir_at(d)
	return Vector3(f.z, 0, -f.x)

## a ribbon from `a` to `b` metres across the road (right positive), `dy` above it, between d0 and d1, relative to `org`;
## `dashed` leaves every other 8 m piece out; `drop` lowers the outer edge (a shore falling to the sea)
func _strip(mesh: ArrayMesh, d0: float, d1: float, a: float, b: float, dy: float, mat: Material, org: Vector3, dashed := false, drop := 0.0) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var d := d0
	var k := int(d0 / SAMPLE)
	var any := false
	while d < d1 - 0.01:
		var dn := minf(d + SAMPLE, d1)
		if not dashed or k % 2 == 0:
			var k0 := _at_k(d)
			var k1 := _at_k(dn) if dn < track.length - 0.01 else 0
			var c0 := _c[k0]
			var c1 := _c[k1] if k1 != 0 else track.at(0.0)
			var s0 := _s[k0]
			var s1 := _s[k1]
			var off := Vector3(org.x, 0, org.z)
			var ya := dy + (drop if absf(a) > absf(b) else 0.0)
			var yb := dy + (drop if absf(b) > absf(a) else 0.0)
			var p00 := c0 + s0 * a + Vector3(0, ya, 0) - off
			var p01 := c0 + s0 * b + Vector3(0, yb, 0) - off
			var p10 := c1 + s1 * a + Vector3(0, ya, 0) - off
			var p11 := c1 + s1 * b + Vector3(0, yb, 0) - off
			st.set_normal(Vector3.UP)
			for v in [p00, p01, p10, p01, p11, p10]:
				st.set_uv(Vector2(v.x, v.z) * 0.1)
				st.add_vertex(v)
			any = true
		d = dn
		k += 1
	if any:
		(mat as BaseMaterial3D).cull_mode = BaseMaterial3D.CULL_DISABLED
		st.set_material(mat)
		st.commit(mesh)

## the hover lane: orange buoys both sides every 40 m (one multimesh per 2 km)
func _buoys() -> void:
	var mat := _glow(Color(1.0, 0.5, 0.1), 1.2)
	var sm := SphereMesh.new()
	sm.radius = 0.7
	sm.height = 1.2
	sm.material = mat
	var xf: Array = []
	var d := 0.0
	while d < track.length:
		var c := track.at(d)
		for s: float in [-1.0, 1.0]:
			xf.append(Transform3D(Basis(), c + _side(d) * s * (track.width * 0.5 + 1.0) + Vector3(0, 0.2, 0)))
		d += 40.0
	_multi(sm, xf, 2000.0)

# --------------------------------------------------------------------------------------------- scenery
func _scenery() -> void:
	match env_id:
		"city":
			_scatter(_tower_mesh(), 45.0, 22.0, 70.0, Vector3(14, 28, 14), Vector3(26, 90, 26))
			_scatter(_lamp_mesh(Color(1.0, 0.25, 0.7)), 40.0, track.width * 0.5 + 2.5, track.width * 0.5 + 2.6, Vector3.ONE, Vector3.ONE)
		"highway-night":
			_scatter(_lamp_mesh(Color(0.3, 0.85, 1.0)), 50.0, track.width * 0.5 + 1.5, track.width * 0.5 + 1.6, Vector3.ONE, Vector3.ONE, true)
			_scatter(_tower_mesh(), 140.0, 90.0, 260.0, Vector3(20, 40, 20), Vector3(40, 140, 40))
		"circuit":
			_scatter(_stand_mesh(), 600.0, track.width * 0.5 + 14.0, track.width * 0.5 + 15.0, Vector3.ONE, Vector3.ONE)
			_scatter(_block_mesh(Color(0.75, 0.76, 0.8)), 70.0, 60.0, 160.0, Vector3(16, 14, 16), Vector3(34, 60, 34))
			_scatter(_tree_mesh(Color(0.22, 0.45, 0.2)), 30.0, track.width * 0.5 + 18.0, 55.0, Vector3(0.8, 0.8, 0.8), Vector3(1.4, 1.6, 1.4))
		"highway":
			_scatter(_lamp_mesh(Color(1.0, 0.8, 0.5)), 60.0, track.width * 0.5 + 1.5, track.width * 0.5 + 1.6, Vector3.ONE, Vector3.ONE, true)
			_scatter(_tree_mesh(Color(0.35, 0.42, 0.2)), 35.0, track.width * 0.5 + 12.0, 120.0, Vector3(0.8, 0.8, 0.8), Vector3(1.6, 1.8, 1.6))
			_scatter(_block_mesh(Color(0.7, 0.62, 0.55)), 300.0, 80.0, 300.0, Vector3(20, 10, 20), Vector3(40, 50, 40))
		"desert":
			_scatter(_dune_mesh(), 60.0, 40.0, 260.0, Vector3(30, 6, 18), Vector3(80, 22, 50))
			_scatter(_rock_mesh(Color(0.6, 0.4, 0.28)), 45.0, track.width * 0.5 + 6.0, 90.0, Vector3(2, 2, 2), Vector3(9, 7, 9))
			_scatter(_cactus_mesh(), 70.0, track.width * 0.5 + 8.0, 60.0, Vector3(0.8, 0.8, 0.8), Vector3(1.3, 1.5, 1.3))
		"snow":
			_scatter(_pine_mesh(), 18.0, track.width * 0.5 + 6.0, 110.0, Vector3(0.8, 0.8, 0.8), Vector3(1.5, 2.0, 1.5))
			_scatter(_rock_mesh(Color(0.45, 0.47, 0.52)), 60.0, track.width * 0.5 + 10.0, 140.0, Vector3(3, 2, 3), Vector3(14, 10, 14))
			_scatter(_dune_mesh(Color(0.95, 0.96, 1.0)), 90.0, track.width * 0.5 + 4.0, 30.0, Vector3(8, 1.5, 4), Vector3(18, 3, 8))
		"coast":
			_scatter(_palm_mesh(), 35.0, track.width * 0.5 + 6.0, 40.0, Vector3(0.9, 0.9, 0.9), Vector3(1.2, 1.5, 1.2))
			_scatter(_block_mesh(Color(0.95, 0.85, 0.75)), 140.0, 50.0, 85.0, Vector3(12, 8, 12), Vector3(26, 24, 26))
		"water":
			_scatter(_dune_mesh(Color(0.35, 0.55, 0.3)), 400.0, 120.0, 600.0, Vector3(80, 18, 60), Vector3(220, 50, 160))
			_scatter(_palm_mesh(), 220.0, 60.0, 140.0, Vector3(1, 1, 1), Vector3(1.4, 1.6, 1.4))

## `mesh` every ~`every` metres, both sides, between `near` and `far` from the centre, scaled between lo..hi;
## never on the road (a lap that comes back near itself would put a tower on the other leg)
func _scatter(mesh: Mesh, every: float, near: float, far: float, lo: Vector3, hi: Vector3, regular := false) -> void:
	var xf: Array = []
	var d := _rng.randf() * every
	while d < track.length:
		var c := track.at(d)
		var side := _side(d)
		for s: float in [-1.0, 1.0]:
			var off := _rng.randf_range(near, far)
			var p := c + side * s * off
			var r := _rng.randf()
			var sc := Vector3(lerpf(lo.x, hi.x, r), lerpf(lo.y, hi.y, _rng.randf()), lerpf(lo.z, hi.z, r))
			var reach := maxf(sc.x, sc.z) * 0.5 + track.width * 0.5 + 3.0
			if not regular and track.distance_to_road(p, reach + 1.0) < reach:
				continue
			if regular and track.distance_to_road(p, track.width) < track.width * 0.5 + 0.5:
				continue
			var y := c.y - 0.3 if env_id == "snow" else (c.y if regular else _base_y() - 0.3)
			if env_id == "coast":
				y = c.y - 0.3
			# a lamp's arm (its +z) reaches over the road; anything else turns at random
			var yaw := atan2(-s * side.x, -s * side.z) if regular else _rng.randf() * TAU
			xf.append(Transform3D(Basis(Vector3.UP, yaw).scaled(sc), Vector3(p.x, y, p.z)))
		d += every * (1.0 if regular else _rng.randf_range(0.6, 1.4))
	_multi(mesh, xf, 2000.0)

## one MultiMeshInstance3D per 2 km of lap, so the far ones aren't drawn
func _multi(mesh: Mesh, xf: Array, piece: float) -> void:
	var groups := {}
	for t: Transform3D in xf:
		var k := Vector2i(int(floor(t.origin.x / piece)), int(floor(t.origin.z / piece)))
		if not groups.has(k):
			groups[k] = []
		(groups[k] as Array).append(t)
	for k in groups:
		var list: Array = groups[k]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = list.size()
		var org := Vector3((k.x + 0.5) * piece, 0, (k.y + 0.5) * piece)
		for i in list.size():
			var t: Transform3D = list[i]
			t.origin -= org
			mm.set_instance_transform(i, t)
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.position = org
		mmi.visibility_range_end = DRAW + piece * 0.7
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
		scenery += 1

## the meshes: a few primitives merged per kind (one draw per multimesh)
func _merged(parts: Array) -> Mesh:
	var mesh := ArrayMesh.new()
	for p in parts:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		st.append_from(p[0], 0, p[1])
		st.set_material(p[2])
		st.commit(mesh)
	return mesh

func _box_m(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b

func _tower_mesh() -> Mesh:
	var c: Color = [Color(1.0, 0.2, 0.62), Color(0.15, 0.85, 1.0), Color(0.62, 0.3, 1.0)][_rng.randi() % 3]
	return _merged([
		[_box_m(Vector3(1, 1, 1)), Transform3D(Basis(), Vector3(0, 0.5, 0)), _mat(Color(0.08, 0.08, 0.11), 0.4, 0.4)],
		[_box_m(Vector3(1.01, 0.012, 1.01)), Transform3D(Basis(), Vector3(0, 0.3, 0)), _glow(c, 2.5)],
		[_box_m(Vector3(1.01, 0.012, 1.01)), Transform3D(Basis(), Vector3(0, 0.62, 0)), _glow(Color(1.0, 0.85, 0.55), 1.5)],
		[_box_m(Vector3(1.01, 0.012, 1.01)), Transform3D(Basis(), Vector3(0, 0.9, 0)), _glow(c, 2.5)],
	])

func _block_mesh(c: Color) -> Mesh:
	return _merged([
		[_box_m(Vector3(1, 1, 1)), Transform3D(Basis(), Vector3(0, 0.5, 0)), _mat(c, 0.7)],
		[_box_m(Vector3(1.01, 0.04, 1.01)), Transform3D(Basis(), Vector3(0, 0.75, 0)), _mat(Color(0.25, 0.35, 0.45), 0.2, 0.5)],
		[_box_m(Vector3(1.01, 0.04, 1.01)), Transform3D(Basis(), Vector3(0, 0.45, 0)), _mat(Color(0.25, 0.35, 0.45), 0.2, 0.5)],
	])

func _lamp_mesh(c: Color) -> Mesh:
	return _merged([
		[_box_m(Vector3(0.25, 9.0, 0.25)), Transform3D(Basis(), Vector3(0, 4.5, 0)), _mat(Color(0.3, 0.32, 0.35), 0.5, 0.6)],
		[_box_m(Vector3(0.2, 0.2, 2.6)), Transform3D(Basis(), Vector3(0, 9.0, 1.2)), _mat(Color(0.3, 0.32, 0.35), 0.5, 0.6)],
		[_box_m(Vector3(0.5, 0.15, 0.9)), Transform3D(Basis(), Vector3(0, 8.85, 2.3)), _glow(c, 4.0)],
	])

func _stand_mesh() -> Mesh:
	var parts: Array = []
	var seat := [_mat(Color(0.85, 0.15, 0.2), 0.6), _mat(Color(0.15, 0.4, 0.85), 0.6), _mat(Color(0.95, 0.85, 0.2), 0.6)]
	for i in 6:
		parts.append([_box_m(Vector3(60, 0.9, 2.2)), Transform3D(Basis(), Vector3(0, 0.45 + i * 0.9, i * 2.0)), seat[i % 3]])
	parts.append([_box_m(Vector3(62, 0.3, 14)), Transform3D(Basis(), Vector3(0, 8.0, 5.0)), _mat(Color(0.9, 0.9, 0.92), 0.5, 0.3)])
	return _merged(parts)

func _tree_mesh(c: Color) -> Mesh:
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 2.4
	cone.height = 6.0
	cone.radial_segments = 7
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.25
	trunk.bottom_radius = 0.3
	trunk.height = 2.0
	trunk.radial_segments = 5
	return _merged([[trunk, Transform3D(Basis(), Vector3(0, 1.0, 0)), _mat(Color(0.35, 0.25, 0.15))], [cone, Transform3D(Basis(), Vector3(0, 4.5, 0)), _mat(c, 0.9)]])

func _pine_mesh() -> Mesh:
	var parts: Array = []
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.2
	trunk.bottom_radius = 0.3
	trunk.height = 2.0
	trunk.radial_segments = 5
	parts.append([trunk, Transform3D(Basis(), Vector3(0, 1.0, 0)), _mat(Color(0.3, 0.22, 0.15))])
	for i in 3:
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 2.6 - i * 0.6
		cone.height = 3.6
		cone.radial_segments = 7
		parts.append([cone, Transform3D(Basis(), Vector3(0, 3.0 + i * 1.9, 0)), _mat(Color(0.12, 0.3, 0.2) if i < 2 else Color(0.92, 0.94, 0.98), 0.9)])
	return _merged(parts)

func _palm_mesh() -> Mesh:
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.18
	trunk.bottom_radius = 0.3
	trunk.height = 9.0
	trunk.radial_segments = 6
	var parts: Array = [[trunk, Transform3D(Basis(Vector3(0, 0, 1), 0.08), Vector3(0.3, 4.5, 0)), _mat(Color(0.5, 0.38, 0.25))]]
	for i in 6:
		var leaf := _box_m(Vector3(0.7, 0.08, 4.0))
		var b := Basis(Vector3.UP, TAU * i / 6.0) * Basis(Vector3.RIGHT, 0.35)
		parts.append([leaf, Transform3D(b, Vector3(0.65, 9.0, 0) + b * Vector3(0, 0, 1.8)), _mat(Color(0.2, 0.55, 0.22), 0.8)])
	return _merged(parts)

func _dune_mesh(c := Color(0.86, 0.7, 0.46)) -> Mesh:
	var sm := SphereMesh.new()
	sm.radius = 0.5
	sm.height = 1.0
	sm.is_hemisphere = true
	sm.radial_segments = 12
	sm.rings = 4
	return _merged([[sm, Transform3D(), _mat(c, 1.0)]])

func _rock_mesh(c: Color) -> Mesh:
	var sm := SphereMesh.new()
	sm.radius = 0.5
	sm.height = 0.8
	sm.radial_segments = 6
	sm.rings = 3
	return _merged([[sm, Transform3D(Basis(), Vector3(0, 0.25, 0)), _mat(c, 0.95)]])

func _cactus_mesh() -> Mesh:
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.35
	trunk.bottom_radius = 0.4
	trunk.height = 4.0
	trunk.radial_segments = 6
	var arm := CylinderMesh.new()
	arm.top_radius = 0.25
	arm.bottom_radius = 0.25
	arm.height = 1.6
	arm.radial_segments = 6
	var g := _mat(Color(0.3, 0.5, 0.25), 0.9)
	return _merged([[trunk, Transform3D(Basis(), Vector3(0, 2.0, 0)), g], [arm, Transform3D(Basis(), Vector3(0.7, 2.6, 0)), g], [arm, Transform3D(Basis(), Vector3(-0.7, 2.0, 0)), g]])

# --------------------------------------------------------------------------------------------- checkpoints
## the owner's 12 checkpoints as arches over the road (the first is the start line: the start gantry stands there)
func _checkpoints() -> void:
	var c0 := Color(1.0, 0.25, 0.65) if bool(e().night) else Color(1.0, 0.75, 0.15)
	var mat := _glow(c0, 2.0)
	var alongs := track.checkpoint_alongs()
	for i in alongs.size():
		var d: float = alongs[i]
		if d < 30.0 or d > track.length - 30.0:
			continue
		var c := track.at(d)
		var f := track.dir_at(d)
		var g := Node3D.new()
		g.position = c
		g.rotation.y = atan2(f.x, f.z)
		for s: float in [-1.0, 1.0]:
			var post := MeshInstance3D.new()
			post.mesh = _box_m(Vector3(0.5, 7.0, 0.5))
			post.material_override = mat
			post.position = Vector3(s * (track.width * 0.5 + 1.0), 3.5, 0)
			g.add_child(post)
		var bar := MeshInstance3D.new()
		bar.mesh = _box_m(Vector3(track.width + 2.5, 1.0, 0.4))
		bar.material_override = mat
		bar.position.y = 7.0
		g.add_child(bar)
		var lbl := Label3D.new()
		lbl.text = "CHECKPOINT %d" % i
		lbl.font_size = 96
		lbl.pixel_size = 0.012
		lbl.outline_size = 16
		lbl.position = Vector3(0, 8.4, 0)
		lbl.rotation.y = PI
		g.add_child(lbl)
		add_child(g)
		arches += 1
