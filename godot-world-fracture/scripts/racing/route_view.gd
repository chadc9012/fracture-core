extends Control
## A long-distance race on one of the owner's Track Pack 01 routes (route.gd / route_race.gd; 12–93 km stages and
## circuits through Neon City, Nexus City, the Nexus highway, the Glass Flats, up Frostveil and round the Azure Isles).
##
## A route is far too long to build whole, so the road and everything beside it is built in CHUNK-metre pieces as you
## drive: the pieces from BEHIND metres back to AHEAD metres on stay, the rest are freed. Each piece is a few merged meshes
## (road ribbon, verges, barriers, the look's dressing) so a piece costs a handful of draws on the phone. The look follows
## the route's kind: towers and neon over a night street, kerbs and stands on a day circuit, rails and gantries on the
## highway, flags and rock on the rally, snow banks and pines on the climb, the sea beside the coast road, buoys on the
## water. Traffic and a police pursuit run on the routes the pack marks for them.

signal closed

const Route := preload("res://scripts/racing/route.gd")
const RouteRace := preload("res://scripts/racing/route_race.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Phone := preload("res://scripts/phone.gd")
const Materials := preload("res://scripts/city/materials.gd")
const CinematicSky := preload("res://scripts/vfx/cinematic_sky.gd")
const Facade := preload("res://scripts/vfx/facade.gd")
const Turf := preload("res://scripts/vfx/turf.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
const GarageState := preload("res://scripts/garage/garage_state.gd")
const DriveProfile := preload("res://scripts/driving/drive_profile.gd")
const SessionStore := preload("res://scripts/driving/drive_session_store.gd")
const StaticBatch := preload("res://scripts/static_batch.gd")

const CHUNK := 200.0
const BEHIND := 400.0
const AHEAD := 1200.0
const FLEET := "res://models/fleet/"
const PROFILE := "user://profile.json"
const RIVAL_FILES := ["street-racer-lod.glb", "muscle-car-lod.glb", "tuner.glb", "luxury-sedan.glb", "security-suv.glb"]
const RIVAL_NAMES := ["Ghost", "Vex", "Nightjar", "K. Voss", "Mara Lin", "D. Okafor", "Rook", "Halo", "Saint", "Cinder", "Wraith"]
const TRAFFIC_FILES := ["luxury-sedan.glb", "security-suv.glb", "city-pod.glb", "tech-transport.glb"]

var route_id := "neon-midnight"
var laps := -1                     # -1: the route's own lap count
var vehicle_id := "tuner"
var autopilot := false
var route: Route
var race: RouteRace
var world: Node3D
var cam: Camera3D
var controls: Control
var player: RefCounted
var player_entry: Dictionary
var rivals: Array = []             # [{sc, entry, skill}]
var traffic: Array = []            # [{sc, along, lane, speed}]
var cops: Array = []               # [{sc, lights}]
var obstacles: Array[AABB] = []
var countdown := 4.0
var hud: Label
var board: Label
var banner: Label
var finish_panel: Control
var cam_yaw := 0.0
var _chunks := {}                  # chunk index -> Node3D
var _mats := {}
var _far: MeshInstance3D           # the far ground that follows the car
var _water: MeshInstance3D
var _rng := RandomNumberGenerator.new()
var _paid := false
var _missed_said := false
var _close_calls := 0
var _lit := 0

func _ready() -> void:
	_rng.seed = hash(route_id)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	Phone.fit_viewport(vp)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	var last: String = String(SessionStore.load_data().last_vehicle)
	if last != "" and not Catalog.vehicle(last).is_empty():
		vehicle_id = last
	route = Route.new(route_id)
	race = RouteRace.new(route, laps)
	_environment()
	_far_ground()
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.1
	cam.far = 2400.0
	world.add_child(cam)
	cam.current = true
	_grid()
	_stream(true)
	_follow()
	controls = TouchControls.new()
	add_child(controls)
	controls.set_mode("drive")
	if controls.crosshair:
		controls.crosshair.visible = false
	for n in [controls.hull_back, controls.hull_fill, controls.weapon_name, controls.ammo]:
		if n:
			n.visible = false
	hud = _label(Vector2(16, 60), 22)
	board = _label(Vector2(-250, 60), 15)
	board.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	board.position = Vector2(-250, 60)
	banner = _label(Vector2(0, 0), 34)
	banner.anchor_left = 0.5
	banner.anchor_right = 0.5
	banner.offset_left = -320.0
	banner.offset_right = 320.0
	banner.offset_top = 120.0
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var back := Button.new()
	back.text = "← LEAVE"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	banner.text = "%s\n%s · %.1f km%s" % [String(route.def.name).to_upper(), String(route.def.region), route.length * race.laps_to_go / 1000.0, (" · %d laps" % race.laps_to_go) if route.closed else ""]
	if controls.touch_ui:
		controls.toast.call_deferred("The car drives itself · steer with your left thumb · BRAKE for the corners")
	_place_camera(1.0)

func _label(at: Vector2, size: int) -> Label:
	var l := Label.new()
	l.position = at
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	add_child(l)
	return l

func _exit_tree() -> void:
	Sound.loop_stop("route_engine")
	Sound.loop_stop("route_siren")

# --------------------------------------------------------------------------------------------- light and sky
const LOOKS := {
	"neon": { "sky": "neon", "sun": [Color(0.55, 0.6, 1.0), 0.5, -40.0], "fog": [Color(0.32, 0.16, 0.42), 0.0022], "amb": [Color(0.45, 0.3, 0.65), 1.2], "exp": 1.35 },
	"nexus": { "sky": "day", "sun": [Color(1.0, 0.84, 0.64), 2.3, -24.0], "fog": [Color(0.86, 0.78, 0.66), 0.0009], "amb": [Color(0.7, 0.72, 0.78), 0.65], "exp": 1.05 },
	"highway": { "sky": "dusk", "sun": [Color(1.0, 0.72, 0.48), 2.0, -9.0], "fog": [Color(0.92, 0.66, 0.5), 0.0012], "amb": [Color(0.7, 0.62, 0.62), 0.6], "exp": 1.05 },
	"desert": { "sky": "desert", "sun": [Color(1.0, 0.9, 0.74), 2.6, -48.0], "fog": [Color(0.95, 0.82, 0.64), 0.0016], "amb": [Color(0.85, 0.75, 0.62), 0.7], "exp": 0.95 },
	"snow": { "sky": "cold", "sun": [Color(1.0, 0.92, 0.84), 2.0, -18.0], "fog": [Color(0.8, 0.86, 0.94), 0.0018], "amb": [Color(0.7, 0.78, 0.9), 0.8], "exp": 0.85 },
	"coast": { "sky": "tropic", "sun": [Color(1.0, 0.95, 0.85), 2.4, -50.0], "fog": [Color(0.7, 0.85, 0.95), 0.0008], "amb": [Color(0.7, 0.8, 0.9), 0.7], "exp": 0.95 },
	"water": { "sky": "tropic", "sun": [Color(1.0, 0.95, 0.85), 2.4, -50.0], "fog": [Color(0.7, 0.85, 0.95), 0.0008], "amb": [Color(0.7, 0.8, 0.9), 0.7], "exp": 0.95 },
}

func _environment() -> void:
	var lk: Dictionary = LOOKS[route.look()]
	var sun := DirectionalLight3D.new()
	sun.light_color = lk.sun[0]
	sun.light_energy = lk.sun[1]
	sun.rotation_degrees = Vector3(float(lk.sun[2]), 35.0, 0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 140.0
	Phone.fit_sun(sun)
	world.add_child(sun)
	var o := CinematicSky.golden_day()
	match String(lk.sky):
		"neon":
			o = CinematicSky.neon_night()
		"dusk":
			o.merge({"top": Color(0.16, 0.22, 0.48), "horizon": Color(1.0, 0.56, 0.32), "cloud_tint": Color(1.0, 0.7, 0.55), "haze": 0.8}, true)
		"desert":
			o.merge({"top": Color(0.22, 0.45, 0.78), "horizon": Color(0.98, 0.86, 0.68), "clouds": 0.15, "haze": 0.6}, true)
		"cold":
			o.merge({"top": Color(0.12, 0.3, 0.62), "horizon": Color(0.85, 0.9, 0.96), "clouds": 0.4, "cloud_tint": Color(0.95, 0.97, 1.0), "haze": 0.3}, true)
		"tropic":
			o.merge({"top": Color(0.1, 0.4, 0.82), "horizon": Color(0.78, 0.9, 0.98), "clouds": 0.4, "haze": 0.3}, true)
	o["planet_tex"] = Data.texture("veyra.jpgb", true)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = CinematicSky.make(o)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = lk.amb[0]
	env.ambient_light_energy = lk.amb[1]
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = lk.exp
	env.glow_enabled = true
	env.glow_intensity = 0.9 if route.look() == "neon" else 0.5
	env.glow_bloom = 0.1 if route.look() == "neon" else 0.04
	env.glow_hdr_threshold = 0.9 if route.look() == "neon" else 1.15
	env.fog_enabled = true
	env.fog_light_color = lk.fog[0]
	env.fog_density = lk.fog[1]
	env.fog_aerial_perspective = 0.4
	env.fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.07
	env.adjustment_saturation = 1.15 if route.look() == "neon" else 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)

## the ground far from the road (and the sea on the water and coast routes): one big plane that follows the car
func _far_ground() -> void:
	var lk := route.look()
	_far = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(5000, 5000)
	_far.mesh = pm
	_far.material_override = _ground_mat()
	_far.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(_far)
	if lk == "water" or lk == "coast":
		_water = MeshInstance3D.new()
		var wm := PlaneMesh.new()
		wm.size = Vector2(5000, 5000)
		wm.subdivide_width = 1
		_water.mesh = wm
		var sh := Shader.new()
		sh.code = """
shader_type spatial;
render_mode cull_disabled;
uniform vec3 deep : source_color = vec3(0.02, 0.2, 0.32);
uniform vec3 shallow : source_color = vec3(0.1, 0.55, 0.62);
varying vec3 wpos;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz * 0.08 + vec2(TIME * 0.12, TIME * 0.05);
	float n = noise(p) * 0.6 + noise(p * 2.7 - TIME * 0.2) * 0.4;
	ALBEDO = mix(deep, shallow, n * 0.6);
	ROUGHNESS = 0.06;
	METALLIC = 0.1;
	SPECULAR = 0.8;
	float nx = noise(p * 3.0 + 1.3) - noise(p * 3.0 + vec2(0.07, 1.3));
	float nz = noise(p * 3.0 + 4.1) - noise(p * 3.0 + vec2(4.1, 0.07));
	NORMAL_MAP = normalize(vec3(nx * 4.0, nz * 4.0, 1.0)) * 0.5 + 0.5;
}
"""
		var m := ShaderMaterial.new()
		m.shader = sh
		_water.material_override = m
		_water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		world.add_child(_water)

func _ground_mat() -> Material:
	match route.look():
		"desert":
			return Turf.material({"base": Color(0.78, 0.62, 0.42), "dry": Color(0.88, 0.74, 0.52), "dark": Color(0.6, 0.45, 0.3)})
		"snow":
			return Turf.material({"base": Color(0.88, 0.91, 0.96), "dry": Color(0.95, 0.96, 0.99), "dark": Color(0.7, 0.75, 0.84)})
		"neon":
			return _flat("nground", Color(0.05, 0.05, 0.07), 0.5)
		"highway":
			return Turf.material({"base": Color(0.42, 0.42, 0.24), "dry": Color(0.58, 0.5, 0.3), "dark": Color(0.26, 0.3, 0.16)})
		"coast", "water":
			return Turf.material({"base": Color(0.84, 0.76, 0.58), "dry": Color(0.9, 0.84, 0.66), "dark": Color(0.7, 0.62, 0.45)})
	return Turf.material({"stripes": 0.0})

# --------------------------------------------------------------------------------------------- materials
func _flat(key: String, c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	_mats[key] = m
	return m

func _road_mat() -> Material:
	if _mats.has("road"):
		return _mats.road
	var m: Material
	match String(route.def.get("surface", "asphalt")):
		"sand_gravel":
			# packed gravel, darker than the sand round it, rutted by the cars before you
			m = Turf.material({"base": Color(0.44, 0.35, 0.26), "dry": Color(0.52, 0.42, 0.31), "dark": Color(0.3, 0.24, 0.18), "stripes": 0.9, "stripe_dir": 0.0})
		"snow_asphalt":
			m = Materials.pbr("asphalt_02", Color(0.62, 0.64, 0.7), 6.0, 0.7) if Materials.has("asphalt_02") else _flat("asph", Color(0.2, 0.2, 0.22))
		_:
			m = Materials.pbr("asphalt_02", Color(0.4, 0.4, 0.43) if route.look() != "neon" else Color(0.2, 0.2, 0.24), 6.0, 0.7 if route.look() != "neon" else 0.35) if Materials.has("asphalt_02") else _flat("asph", Color(0.12, 0.12, 0.13))
	_mats.road = m
	return m

# --------------------------------------------------------------------------------------------- streaming the road
func _stream(first := false) -> void:
	var along: float = float(player_entry.get("hint", 0.0))
	if along < 0.0:
		along = 0.0
	var count := int(ceil(route.length / CHUNK))
	var want := {}
	var k0 := int(floor((along - BEHIND) / CHUNK))
	var k1 := int(floor((along + AHEAD) / CHUNK))
	for k in range(k0, k1 + 1):
		var kk := posmod(k, count) if route.closed else k
		if kk < 0 or kk >= count:
			continue
		want[kk] = true
	for k in _chunks.keys():
		if not want.has(k):
			(_chunks[k] as Node3D).queue_free()
			_chunks.erase(k)
	# build at most two new pieces a frame (a stall-free stream on the phone); everything on the first frame
	var built := 0
	for k in want:
		if not _chunks.has(k):
			_chunks[k] = _build_chunk(k)
			built += 1
			if built >= 2 and not first:
				break

## a mesh accumulator per material for one piece
class Acc:
	var st := {}
	func tool(m: Material) -> SurfaceTool:
		if not st.has(m):
			var s := SurfaceTool.new()
			s.begin(Mesh.PRIMITIVE_TRIANGLES)
			st[m] = s
		return st[m]
	func quad(m: Material, a: Vector3, b: Vector3, c: Vector3, d: Vector3, uv_scale := 1.0) -> void:
		var s := tool(m)
		s.set_uv(Vector2(0, 0)); s.add_vertex(a)
		s.set_uv(Vector2(1, 0) * uv_scale); s.add_vertex(b)
		s.set_uv(Vector2(1, 1) * uv_scale); s.add_vertex(c)
		s.set_uv(Vector2(0, 0)); s.add_vertex(a)
		s.set_uv(Vector2(1, 1) * uv_scale); s.add_vertex(c)
		s.set_uv(Vector2(0, 1) * uv_scale); s.add_vertex(d)
	func box(m: Material, at: Vector3, size: Vector3, yaw := 0.0) -> void:
		var bm := BoxMesh.new()
		bm.size = size
		tool(m).append_from(bm, 0, Transform3D(Basis(Vector3.UP, yaw), at))
	func mesh(m: Material, src: Mesh, xf: Transform3D) -> void:
		tool(m).append_from(src, 0, xf)
	func commit(parent: Node3D, shadow := true) -> void:
		for m in st:
			var s: SurfaceTool = st[m]
			s.generate_normals()
			var mi := MeshInstance3D.new()
			mi.mesh = s.commit()
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			parent.add_child(mi)

func _build_chunk(k: int) -> Node3D:
	var holder := Node3D.new()
	world.add_child(holder)
	var acc := Acc.new()
	var d0 := k * CHUNK
	var d1 := minf((k + 1) * CHUNK, route.length)
	var hw := route.width * 0.5
	var lk := route.look()
	var elevated := String(route.def.race_type) == "elevated_circuit"
	var lift := 16.0 if elevated else 0.0
	var step := 5.0
	var d := d0
	var road := _road_mat()
	var verge := _ground_mat()
	var r2 := RandomNumberGenerator.new()
	r2.seed = k * 7919 + hash(route_id)
	while d < d1 - 0.01:
		var e := minf(d + step, d1)
		var a := route.at(d)
		var b := route.at(e)
		var fa := route.dir_at(d)
		var fb := route.dir_at(e)
		var na := Vector3(fa.z, 0, -fa.x)
		var nb := Vector3(fb.z, 0, -fb.x)
		a.y += lift
		b.y += lift
		if lk != "water":
			# the road ribbon
			acc.quad(road, a + na * hw, b + nb * hw, b - nb * hw, a - na * hw)
			# lane lines: a dash every 12 m (the edge lines are solid)
			if lk != "desert" and int(d / 6.0) % 2 == 0:
				for lane: float in ([-hw * 0.33, hw * 0.33] if route.width >= 16.0 else [0.0]):
					var c0 := a + na * lane + Vector3(0, 0.02, 0)
					var c1 := b + nb * lane + Vector3(0, 0.02, 0)
					acc.quad(_flat("paint", Color(0.92, 0.92, 0.88), 0.6), c0 + na * 0.08, c1 + nb * 0.08, c1 - nb * 0.08, c0 - na * 0.08)
			if lk != "desert":
				for s: float in [-1.0, 1.0]:
					var e0 := a + na * s * (hw - 0.3) + Vector3(0, 0.02, 0)
					var e1 := b + nb * s * (hw - 0.3) + Vector3(0, 0.02, 0)
					acc.quad(_flat("edge", Color(0.95, 0.95, 0.92) if lk != "nexus" else Color(0.95, 0.95, 0.92), 0.6), e0 + na * s * 0.1, e1 + nb * s * 0.1, e1 - nb * s * 0.1, e0 - na * s * 0.1)
			# the verges: ground falling away from the road on both sides (none under an elevated road: it stands on pillars)
			for s: float in ([] if elevated else [-1.0, 1.0]):
				var prev_a := a + na * s * hw
				var prev_b := b + nb * s * hw
				for off: float in [3.0, 12.0, 40.0, 120.0]:
					var qa := a + na * s * (hw + off)
					var qb := b + nb * s * (hw + off)
					qa.y = route.ground(qa, d) + (lift * 0.0 if not elevated else -lift)
					qb.y = route.ground(qb, e) + (lift * 0.0 if not elevated else -lift)
					if elevated:
						qa.y = route.at(d).y - 2.0
						qb.y = route.at(e).y - 2.0
					# wound as the road is (outer edge to inner on the +n side, inner to outer on the other): front faces up
					if s > 0.0:
						acc.quad(verge, qa, qb, prev_b, prev_a)
					else:
						acc.quad(verge, prev_a, prev_b, qb, qa)
					prev_a = qa
					prev_b = qb
		if elevated:
			# the deck's underside and a pillar every 40 m down to the streets
			acc.quad(_flat("deck", Color(0.3, 0.3, 0.33), 0.8), a - na * hw + Vector3(0, -1.2, 0), b - nb * hw + Vector3(0, -1.2, 0), b + nb * hw + Vector3(0, -1.2, 0), a + na * hw + Vector3(0, -1.2, 0))
			if int(d / 5.0) % 8 == 0:
				var base := route.at(d)
				acc.box(_flat("pillar", Color(0.42, 0.42, 0.45), 0.8), Vector3(base.x, base.y + lift * 0.5 - 1.0, base.z), Vector3(3.0, lift, 3.0))
		_dress(acc, holder, d, e, a, b, na, nb, r2, lift)
		d = e
	# checkpoint gates in this piece
	for i in route.checkpoints.size():
		var cpd: float = route.checkpoints[i]
		if cpd >= d0 and cpd < d1:
			_gate(holder, cpd, i)
	if route.closed and d0 <= 0.0 or (not route.closed and d0 <= 80.0 and d1 > 80.0):
		_gate(holder, 0.0 if route.closed else 80.0, -1)
	acc.commit(holder)
	return holder

## the look's roadside, one road step (5 m) at a time
func _dress(acc: Acc, holder: Node3D, d: float, e: float, a: Vector3, b: Vector3, na: Vector3, nb: Vector3, r2: RandomNumberGenerator, lift: float) -> void:
	var hw := route.width * 0.5
	var lk := route.look()
	var step_i := int(d / 5.0)
	var f := route.dir_at(d)
	var yaw := atan2(f.x, f.z)
	match lk:
		"neon":
			# concrete barriers with a neon strip, towers both sides, lamps every 40 m
			for s: float in [-1.0, 1.0]:
				var ba := a + na * s * (hw + 0.4)
				var bb := b + nb * s * (hw + 0.4)
				acc.quad(_flat("barrier", Color(0.55, 0.55, 0.58), 0.7), ba, bb, bb + Vector3(0, 0.9, 0), ba + Vector3(0, 0.9, 0))
				var neon_c := Color(1.0, 0.2, 0.85) if (int(d / CHUNK) + int(s > 0.0)) % 2 == 0 else Color(0.2, 0.9, 1.0)
				acc.quad(_flat("neon%d" % int(neon_c.r * 10.0), neon_c, 0.4, 0.0, 3.5), ba + Vector3(0, 0.92, 0), bb + Vector3(0, 0.92, 0), bb + Vector3(0, 1.02, 0), ba + Vector3(0, 1.02, 0))
				if step_i % 8 == 0:
					var pole := a + na * s * (hw + 1.2)
					acc.box(_flat("pole", Color(0.15, 0.15, 0.17), 0.4, 0.6), pole + Vector3(0, 4.0, 0), Vector3(0.18, 8.0, 0.18))
					acc.box(_flat("lamp", Color(0.85, 0.9, 1.0), 0.3, 0.0, 4.0), pole + Vector3(0, 8.0, 0) - na * s * 1.2, Vector3(0.4, 0.12, 1.2), yaw)
				if step_i % 6 == 0 and r2.randf() < 0.85:
					var w := r2.randf_range(14.0, 30.0)
					var h := r2.randf_range(30.0, 110.0)
					var at := a + na * s * (hw + 14.0 + w * 0.5 + r2.randf_range(0.0, 20.0))
					at.y = a.y - lift - 2.0
					Facade._box(acc.tool(_facade()), at, Vector3(w, h + lift, r2.randf_range(14.0, 26.0)), yaw)
		"nexus":
			# red-and-white kerbs, run-off, tyre walls, a skyline row further out
			for s: float in [-1.0, 1.0]:
				var ka := a + na * s * hw
				var kb := b + nb * s * hw
				acc.quad(_flat("kerb_r" if step_i % 2 == 0 else "kerb_w", Color(0.85, 0.1, 0.08) if step_i % 2 == 0 else Color(0.95, 0.95, 0.92), 0.6), ka + Vector3(0, 0.03, 0), kb + Vector3(0, 0.03, 0), kb + nb * s * 1.2 + Vector3(0, 0.03, 0), ka + na * s * 1.2 + Vector3(0, 0.03, 0))
				if step_i % 2 == 0:
					acc.box(_flat("tyres", Color(0.08, 0.08, 0.09), 0.9), a + na * s * (hw + 12.0) + Vector3(0, 0.55, 0), Vector3(1.1, 1.1, 5.2), yaw)
				if step_i % 7 == 0 and r2.randf() < 0.9:
					var w := r2.randf_range(18.0, 34.0)
					var at := a + na * s * (hw + 60.0 + r2.randf_range(0.0, 60.0))
					at.y = a.y - 1.0
					Facade._box(acc.tool(_facade()), at, Vector3(w, r2.randf_range(25.0, 120.0), w), yaw)
			if step_i % 120 == 0:
				_stand(acc, a, na, yaw)
		"highway":
			# W-beam guard rails, a lamp every 50 m, sign gantries every 2 km
			for s: float in [-1.0, 1.0]:
				var ga := a + na * s * (hw + 0.6) + Vector3(0, 0.55, 0)
				var gb := b + nb * s * (hw + 0.6) + Vector3(0, 0.55, 0)
				acc.quad(_flat("rail", Color(0.72, 0.74, 0.76), 0.35, 0.7), ga, gb, gb + Vector3(0, 0.32, 0), ga + Vector3(0, 0.32, 0))
				if step_i % 2 == 0:
					acc.box(_flat("post", Color(0.4, 0.4, 0.42), 0.6, 0.5), a + na * s * (hw + 0.7) + Vector3(0, 0.45, 0), Vector3(0.12, 0.9, 0.12))
				if step_i % 10 == 0:
					var pole := a + na * s * (hw + 1.5)
					acc.box(_flat("pole", Color(0.15, 0.15, 0.17), 0.4, 0.6), pole + Vector3(0, 5.0, 0), Vector3(0.2, 10.0, 0.2))
					acc.box(_flat("lamp_w", Color(1.0, 0.8, 0.55), 0.3, 0.0, 3.0), pole + Vector3(0, 10.0, 0) - na * s * 1.5, Vector3(0.4, 0.14, 1.4), yaw)
			if step_i % 400 == 0:
				for s: float in [-1.0, 1.0]:
					acc.box(_flat("gantry", Color(0.5, 0.52, 0.55), 0.4, 0.7), a + na * s * (hw + 1.0) + Vector3(0, 3.5, 0), Vector3(0.4, 7.0, 0.4))
				acc.box(_flat("gantry", Color(0.5, 0.52, 0.55), 0.4, 0.7), a + Vector3(0, 7.0, 0), Vector3(route.width + 3.0, 0.5, 0.6), yaw + PI * 0.5)
				acc.box(_flat("sign", Color(0.05, 0.35, 0.18), 0.6), a + Vector3(0, 8.2, 0) - f * 0.4, Vector3(route.width * 0.6, 2.0, 0.1), yaw + PI * 0.5)
				var km := int(round((route.length - d) / 1000.0))
				_text(holder, "NEXUS CITY  %d km" % km if km > 0 else "FINISH", a + Vector3(0, 8.2, 0) - f * 0.5, yaw + PI, Color(1, 1, 1), 110)
		"desert":
			# marker poles with flags, boulders, the odd dune
			for s: float in [-1.0, 1.0]:
				if step_i % 12 == 0:
					var p := a + na * s * (hw + 1.5)
					acc.box(_flat("marker", Color(0.95, 0.45, 0.1), 0.6), p + Vector3(0, 1.0, 0), Vector3(0.08, 2.0, 0.08))
					acc.box(_flat("flag", Color(0.95, 0.2, 0.1) if s < 0 else Color(0.1, 0.4, 0.95), 0.8), p + Vector3(0, 1.8, 0) + f * 0.3, Vector3(0.02, 0.4, 0.6), yaw)
				if r2.randf() < 0.07:
					var p2 := a + na * s * (hw + r2.randf_range(8.0, 90.0))
					p2.y = route.ground(p2, d) - 0.4
					var rock := SphereMesh.new()
					var rs := r2.randf_range(0.8, 4.5)
					rock.radius = rs
					rock.height = rs * 1.3
					rock.radial_segments = 7
					rock.rings = 4
					acc.mesh(_flat("rock", Color(0.55, 0.4, 0.3), 0.95), rock, Transform3D(Basis(Vector3.UP, r2.randf() * TAU).scaled(Vector3(1.0, r2.randf_range(0.5, 1.0), 1.3)), p2))
				if r2.randf() < 0.012:
					var dune := a + na * s * (hw + r2.randf_range(60.0, 140.0))
					dune.y = route.ground(dune, d) - 4.0
					var dm := SphereMesh.new()
					dm.radius = r2.randf_range(25.0, 45.0)
					dm.height = dm.radius * 0.7
					dm.radial_segments = 14
					dm.rings = 6
					acc.mesh(_ground_mat(), dm, Transform3D(Basis(Vector3.UP, r2.randf() * TAU).scaled(Vector3(1.0, 0.35, 1.8)), dune))
		"snow":
			# snow banks, a rock wall uphill, a rail on the drop, pines
			for s: float in [-1.0, 1.0]:
				var sa := a + na * s * (hw + 0.2)
				var sb := b + nb * s * (hw + 0.2)
				acc.quad(_flat("snowbank", Color(0.92, 0.94, 0.98), 0.7), sa, sb, sb + nb * s * 1.5 + Vector3(0, 0.6, 0), sa + na * s * 1.5 + Vector3(0, 0.6, 0))
				if s > 0.0:
					# the cut rock face of the mountainside
					var wa := a + na * (hw + 4.0)
					var wb := b + nb * (hw + 4.0)
					acc.quad(_flat("rockface", Color(0.32, 0.33, 0.36), 0.95), wa, wb, wb + nb * 6.0 + Vector3(0, 14.0, 0), wa + na * 6.0 + Vector3(0, 14.0, 0))
				else:
					var ga := a - na * (hw + 0.8) + Vector3(0, 0.5, 0)
					var gb := b - nb * (hw + 0.8) + Vector3(0, 0.5, 0)
					acc.quad(_flat("rail", Color(0.72, 0.74, 0.76), 0.35, 0.7), ga, gb, gb + Vector3(0, 0.3, 0), ga + Vector3(0, 0.3, 0))
				if r2.randf() < 0.18:
					var p := a + na * s * (hw + r2.randf_range(6.0, 60.0) + (6.0 if s > 0.0 else 0.0))
					p.y = route.ground(p, d)
					_pine(acc, p, r2.randf_range(0.8, 1.5))
		"coast":
			# the sea side (right) gets a rail and the drop to the beach; palms on the land side
			var ga := a + na * (hw + 0.6) + Vector3(0, 0.5, 0)
			var gb := b + nb * (hw + 0.6) + Vector3(0, 0.5, 0)
			acc.quad(_flat("rail", Color(0.82, 0.84, 0.86), 0.35, 0.7), ga, gb, gb + Vector3(0, 0.32, 0), ga + Vector3(0, 0.32, 0))
			if r2.randf() < 0.12:
				var p := a - na * (hw + r2.randf_range(4.0, 30.0))
				p.y = route.ground(p, d)
				_palm(acc, p, r2)
		"water":
			# buoys marking the course both sides, an island now and then
			for s: float in [-1.0, 1.0]:
				if step_i % 6 == 0:
					var p := a + na * s * (hw + 1.0)
					p.y = 0.0
					var bm := SphereMesh.new()
					bm.radius = 0.7
					bm.height = 1.4
					bm.radial_segments = 10
					bm.rings = 5
					acc.mesh(_flat("buoy_r" if s < 0 else "buoy_g", Color(0.95, 0.15, 0.1) if s < 0 else Color(0.1, 0.8, 0.3), 0.4, 0.0, 0.6), bm, Transform3D(Basis(), p + Vector3(0, 0.3, 0)))
				if r2.randf() < 0.004:
					var isl := a + na * s * (hw + r2.randf_range(80.0, 220.0))
					var im := SphereMesh.new()
					im.radius = r2.randf_range(30.0, 70.0)
					im.height = im.radius * 0.6
					im.radial_segments = 16
					im.rings = 6
					acc.mesh(_ground_mat(), im, Transform3D(Basis().scaled(Vector3(1.0, 0.25, 1.0)), Vector3(isl.x, -3.0, isl.z)))
					for t in 4:
						var pp := Vector3(isl.x + r2.randf_range(-15.0, 15.0), 2.0, isl.z + r2.randf_range(-15.0, 15.0))
						_palm(acc, pp, r2)

var _facade_mat: Material
func _facade() -> Material:
	if _facade_mat == null:
		var night := route.look() == "neon"
		_facade_mat = Facade.material({"lit": 0.55 if night else 0.12, "glow": 2.6 if night else 1.8, "frame": Color(0.05, 0.05, 0.07) if night else Color(0.1, 0.11, 0.13),
			"glass": Color(0.04, 0.05, 0.09), "sky": Color(0.5, 0.3, 0.7) if night else Color(0.85, 0.75, 0.65), "cool": Color(1.0, 0.25, 0.85) if night else Color(0.55, 0.8, 1.0)})
	return _facade_mat

func _pine(acc: Acc, p: Vector3, s: float) -> void:
	acc.box(_flat("trunk", Color(0.25, 0.17, 0.1), 0.9), p + Vector3(0, 1.0 * s, 0), Vector3(0.35, 2.0, 0.35) * s)
	for t in 3:
		var cm := CylinderMesh.new()
		cm.top_radius = 0.0
		cm.bottom_radius = (2.4 - t * 0.6) * s
		cm.height = (3.6 - t * 0.5) * s
		cm.radial_segments = 7
		cm.rings = 0
		acc.mesh(_flat("needles_snow" if t == 2 else "needles", Color(0.88, 0.92, 0.96) if t == 2 else Color(0.12, 0.24, 0.16), 0.9), cm, Transform3D(Basis(), p + Vector3(0, (2.6 + t * 1.9) * s, 0)))

func _palm(acc: Acc, p: Vector3, r2: RandomNumberGenerator) -> void:
	var h := r2.randf_range(6.0, 10.0)
	var lean := Basis(Vector3(r2.randf() - 0.5, 0, r2.randf() - 0.5).normalized(), r2.randf_range(0.05, 0.2))
	var cm := CylinderMesh.new()
	cm.top_radius = 0.15
	cm.bottom_radius = 0.25
	cm.height = h
	cm.radial_segments = 6
	cm.rings = 0
	acc.mesh(_flat("palm_trunk", Color(0.45, 0.36, 0.25), 0.9), cm, Transform3D(lean, p + lean * Vector3(0, h * 0.5, 0)))
	var top := p + lean * Vector3(0, h, 0)
	for k in 7:
		var a := TAU * k / 7.0
		acc.box(_flat("frond", Color(0.16, 0.42, 0.14), 0.8), top + Vector3(cos(a), -0.4, sin(a)) * 1.6, Vector3(0.5, 0.06, 3.2), a + PI * 0.5)

func _stand(acc: Acc, a: Vector3, na: Vector3, yaw: float) -> void:
	var hw := route.width * 0.5
	var base := a - na * (hw + 22.0)
	for row in 8:
		acc.box(_flat("stand", Color(0.55, 0.57, 0.6), 0.7), base - na * row * 1.2 + Vector3(0, 0.5 + row * 0.7, 0), Vector3(0.9, 1.0 + row * 1.4, 60.0), yaw)
		acc.box(_flat("seats%d" % (row % 3), [Color(0.85, 0.15, 0.12), Color(0.15, 0.35, 0.85), Color(0.95, 0.8, 0.1)][row % 3], 0.6), base - na * row * 1.2 + Vector3(0, 1.05 + row * 0.7, 0), Vector3(0.6, 0.12, 59.0), yaw)
	acc.box(_flat("roof", Color(0.85, 0.86, 0.88), 0.4, 0.4), base - na * 5.0 + Vector3(0, 9.5, 0), Vector3(12.0, 0.3, 62.0), yaw)

## a checkpoint gate (index -1: the start / finish): two pylons and a banner across the road, lit
func _gate(holder: Node3D, d: float, index: int) -> void:
	var p := route.at(d) + Vector3(0, 16.0 if String(route.def.race_type) == "elevated_circuit" else 0.0, 0)
	if route.look() == "water":
		p.y = 0.0
	var f := route.dir_at(d)
	var n := Vector3(f.z, 0, -f.x)
	var yaw := atan2(f.x, f.z)
	var hw := route.width * 0.5 + 1.0
	var finish := index == -1 or (not route.closed and index == route.checkpoints.size() - 1)
	var c := Color(1.0, 0.85, 0.2) if finish else Color(0.2, 0.9, 1.0)
	for s: float in [-1.0, 1.0]:
		var pyl := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.8, 7.0, 0.8)
		pyl.mesh = bm
		pyl.material_override = _flat("gate_pyl", Color(0.12, 0.12, 0.14), 0.4, 0.5)
		pyl.position = p + n * s * hw + Vector3(0, 3.5, 0)
		holder.add_child(pyl)
		var strip := MeshInstance3D.new()
		var sm := BoxMesh.new()
		sm.size = Vector3(0.85, 6.6, 0.1)
		strip.mesh = sm
		strip.material_override = _flat("gate_%s" % c.to_html(), c, 0.4, 0.0, 3.0)
		strip.position = p + n * s * hw + Vector3(0, 3.5, 0) - f * 0.42
		strip.rotation.y = yaw
		holder.add_child(strip)
	var top := MeshInstance3D.new()
	var tm := BoxMesh.new()
	tm.size = Vector3(hw * 2.0 + 0.8, 1.2, 0.5)
	top.mesh = tm
	top.material_override = _flat("gate_top", Color(0.06, 0.06, 0.08), 0.4, 0.4)
	top.position = p + Vector3(0, 7.2, 0)
	top.rotation.y = yaw + PI * 0.5
	holder.add_child(top)
	var label := "FINISH" if finish and not route.closed else ("START / FINISH" if index == -1 else "CHECKPOINT %d" % index)
	_text(holder, label, p + Vector3(0, 7.2, 0) - f * 0.3, yaw + PI, c * 1.4, 90)

func _text(holder: Node3D, t: String, at: Vector3, yaw: float, c: Color, size := 80) -> void:
	var l := Label3D.new()
	l.text = t
	l.font_size = size
	l.pixel_size = 0.012
	l.modulate = c
	l.shaded = false
	l.position = at
	l.rotation.y = yaw
	holder.add_child(l)

# --------------------------------------------------------------------------------------------- the cars
func _spawn_car(file: String, at: Transform3D, vehicle: String, entry: Dictionary, hover := false) -> RefCounted:
	var node: Node3D
	if ResourceLoader.exists(FLEET + file):
		node = (load(FLEET + file) as PackedScene).instantiate() as Node3D
	elif ResourceLoader.exists("res://models/city/" + file):
		node = (load("res://models/city/" + file) as PackedScene).instantiate() as Node3D
	else:
		node = Node3D.new()
	StreetCar.face_forward(node)
	_fit_length(node, 4.7)
	StaticBatch.compact(node)
	world.add_child(node)
	node.transform = at
	var perf := { "max_speed": 58.0, "acceleration": 13.0, "steering": 1.0, "braking": 18.0 }
	if vehicle != "":
		var pp: Dictionary = DriveProfile.performance(GarageState.load_or_fresh(), vehicle)
		if not pp.is_empty():
			perf = pp.duplicate()
	if hover:
		perf["hover"] = true
	var sc := StreetCar.new(node, vehicle, perf)
	sc.bounds = Rect2(-1e6, -1e6, 2e6, 2e6)
	sc.obstacles = obstacles
	sc.skip = obstacles.size()
	obstacles.append(sc.box())
	sc.set_meta("box_index", sc.skip)
	# the car stands on the route's road: each car keeps its own place along it for the search
	var water := route.look() == "water"
	sc.ground_at = func(x: float, z: float) -> float:
		if water:
			return 0.0
		return route.ground(Vector3(x, 0, z), float(entry.get("hint", -1.0))) + (16.0 if String(route.def.race_type) == "elevated_circuit" else 0.0)
	return sc

## some fleet hulls come at odd sizes (the hover-car is several cars long): scale a model's children so its longest side
## is a car's length, standing on the ground, as Skyways does with `_fit_hull`
static func _fit_length(node: Node3D, length: float) -> void:
	var aabb := AABB()
	var first := true
	for c in node.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != node and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	var span := maxf(aabb.size.z, aabb.size.x)
	if first or span < 0.01 or (span > length * 0.6 and span < length * 2.2):
		return
	var k := length / span
	for ch in node.get_children():
		if ch is Node3D:
			(ch as Node3D).scale *= k
			(ch as Node3D).position = (ch as Node3D).position * k - Vector3(0, aabb.position.y * k, 0)

func _grid() -> void:
	var hover := route.look() == "water"
	var n := mini(int(route.def.get("opponents", 7)), 5)    # a phone budget: five rivals at most
	for i in n:
		var e := race.add(RIVAL_NAMES[(i + absi(hash(route_id))) % RIVAL_NAMES.size()])
		var sc := _spawn_car("hover-car.glb" if hover else RIVAL_FILES[i % RIVAL_FILES.size()], route.grid(i), "", e, hover)
		# rivals are tuned to the route's pace: a little under the player's top speed, the best near it
		sc.profile["max_speed"] = 56.0 + i * 1.2
		rivals.append({ "sc": sc, "entry": e, "skill": 0.88 + i * 0.025, "lane": route.width * (0.22 if i % 2 == 0 else -0.22) * (1.0 - 0.3 * float(i / 2 % 2)) })
	player_entry = race.add("You", true)
	var v := Catalog.vehicle(vehicle_id)
	var file := "hover-car.glb" if hover else (String(v.get("model", FLEET + "tuner.glb")).get_file() if not v.is_empty() else "tuner.glb")
	player = _spawn_car(file, route.grid(n), "" if hover else vehicle_id, player_entry, hover)
	cam_yaw = player.yaw()
	if bool(route.def.get("traffic", false)):
		for i in 10:
			_spawn_traffic(i)

# --------------------------------------------------------------------------------------------- traffic and police
func _spawn_traffic(i: int) -> void:
	var e := { "hint": -1.0 }
	var along := 400.0 + i * 260.0
	var lane := (route.width * 0.25) * (1.0 if i % 2 == 0 else -1.0)
	var c := route.at(along)
	var f := route.dir_at(along)
	var at := Transform3D(Basis.looking_at(Vector3(f.x, 0, f.z).normalized(), Vector3.UP), c + Vector3(f.z, 0, -f.x) * lane)
	var sc := _spawn_car(TRAFFIC_FILES[i % TRAFFIC_FILES.size()], at, "", e)
	traffic.append({ "sc": sc, "e": e, "along": along, "lane": lane, "speed": _rng.randf_range(14.0, 22.0) })

func _step_traffic(dt: float) -> void:
	var me: float = float(player_entry.hint)
	for t in traffic:
		t.along = float(t.along) + float(t.speed) * dt
		# recycle a car left far behind (or never reached) to somewhere ahead of you
		var rel: float = float(t.along) - me
		if route.closed:
			rel = wrapf(rel, -route.length * 0.5, route.length * 0.5)
		if rel < -150.0 or rel > 1800.0:
			t.along = me + _rng.randf_range(500.0, 1500.0)
			t.e.hint = -1.0
		var c := route.at(float(t.along))
		var f := route.dir_at(float(t.along))
		var sc: RefCounted = t.sc
		var n := Vector3(f.z, 0, -f.x)
		sc.node.position = Vector3(c.x, 0, c.z) + n * float(t.lane)
		t.e.hint = float(t.along)
		sc.node.position.y = sc.ground_at.call(sc.node.position.x, sc.node.position.z)
		sc.node.rotation.y = atan2(-f.x, -f.z)
		obstacles[int(sc.get_meta("box_index"))] = sc.box()
		# a near miss at speed: the crowd loves it, the police don't
		var dd: float = (sc.node.position - player.node.position).length()
		if dd < 3.2 and absf(player.speed) > 30.0 and not t.get("missed", false):
			t["missed"] = true
			_close_calls += 1
			controls.toast("NEAR MISS")
		elif dd > 10.0:
			t["missed"] = false

func _step_police(dt: float) -> void:
	if not bool(route.def.get("police", false)) or not race.started:
		return
	var want := mini(int(ceil(race.heat)), 3)
	while cops.size() < want:
		var behind: float = float(player_entry.hint) - 260.0 - cops.size() * 40.0
		var e := { "hint": -1.0 }
		var c := route.at(maxf(behind, 0.0))
		var f := route.dir_at(maxf(behind, 0.0))
		var sc := _spawn_car("police-car.glb", Transform3D(Basis.looking_at(Vector3(f.x, 0, f.z).normalized(), Vector3.UP), c), "", e)
		sc.profile["max_speed"] = 62.0
		var lights: Array = []
		for k in 2:
			var l := OmniLight3D.new()
			l.omni_range = 14.0
			l.light_energy = 3.0
			l.position = Vector3(0.5 - k, 1.8, 0)
			sc.node.add_child(l)
			lights.append(l)
		cops.append({ "sc": sc, "e": e, "lights": lights })
		Sound.loop("route_siren", "siren", -12.0, 1.0)
		controls.toast("POLICE IN PURSUIT · heat %d" % want)
	var near := 0
	var t := Time.get_ticks_msec() / 1000.0
	for cp in cops:
		var sc: RefCounted = cp.sc
		var to: Vector3 = player.node.position - sc.node.position
		var dist: float = to.length()
		# chase: aim at the car (or a point on the road ahead of it when far back), match its speed and a bit more
		var aim: Vector3 = player.node.position if dist < 60.0 else route.at(float(cp.e.hint) + 30.0)
		var dir: Vector3 = aim - sc.node.position
		var err: float = wrapf(atan2(-dir.x, -dir.z) - sc.node.rotation.y, -PI, PI)
		var top: float = minf(float(sc.profile.max_speed), absf(player.speed) + 8.0)
		sc.step(dt, clampf((top - sc.speed) / 4.0, -1.0, 1.0), clampf(err * 2.5, -1.0, 1.0), 0.0)
		var n: Array = route.nearest_from(sc.node.position, float(cp.e.hint))
		cp.e.hint = float(n[0])
		obstacles[int(sc.get_meta("box_index"))] = sc.box()
		if dist < 18.0:
			near += 1
		for k in (cp.lights as Array).size():
			var l: OmniLight3D = cp.lights[k]
			l.light_color = Color(1.0, 0.1, 0.1) if (int(t * 6.0) + k) % 2 == 0 else Color(0.1, 0.3, 1.0)
	race.police(dt, absf(player.speed), _close_calls, near)
	_close_calls = 0

# --------------------------------------------------------------------------------------------- the loop
func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	if countdown > 0.0:
		countdown -= dt
		var lit := clampi(int(ceil((4.0 - countdown) / 0.8)), 0, 5)
		if lit != _lit:
			_lit = lit
			if lit > 0:
				Sound.sfx("click", -4.0, 0.0)
		if countdown <= 0.0:
			race.start()
			banner.text = "GO"
			Sound.loop("route_engine", "engine", -10.0, 0.6)
		elif countdown < 3.0:
			banner.text = str(int(ceil(countdown)))
		_tick_race(0.0)
		_follow()
		_place_camera(dt)
		return
	if countdown > -1.0:
		countdown -= dt
		if countdown <= -1.0:
			banner.text = ""
	Sound.loop_set("route_engine", 0.6 + clampf(absf(player.speed) / maxf(float(player.profile.max_speed), 1.0), 0.0, 1.0) * 1.3, -10.0 + clampf(absf(player.speed) / 30.0, 0.0, 1.0) * 5.0)
	# the player's car (as the circuits: on a phone the car drives itself and the thumb steers)
	var throttle: float = controls.move.y
	var steer: float = -controls.move.x
	if controls.touch_ui and not controls.scripted:
		throttle = controls.move.y if controls.move.y < -0.45 else 1.0
		if absf(steer) < 0.12:
			var ahead := route.at(float(player_entry.hint) + 18.0)
			var to2: Vector3 = ahead - player.node.position
			steer = clampf(wrapf(atan2(-to2.x, -to2.z) - player.node.rotation.y, -PI, PI) * 1.2, -0.4, 0.4)
	if not controls.touch_ui and not controls.scripted:
		throttle = (1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0)
		steer = (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0)
	if autopilot:
		var r := _drive_line(player.node, float(player_entry.hint), float(player.profile.max_speed), player.speed)
		throttle = r.x
		steer = r.y
	if race.finished or float(player_entry.finished_at) >= 0.0:
		throttle = 0.0
	player.step(dt, throttle, steer, controls.brake())
	_keep_on(player, player_entry)
	# rivals: the racing line, eased for the corners; a pack that stays in the race over 90 km (rubber band)
	for rv in rivals:
		var sc: RefCounted = rv.sc
		var e: Dictionary = rv.entry
		var gap: float = race.progress(e) - race.progress(player_entry)
		var band := clampf(1.0 - gap / 2500.0, 0.85, 1.12)
		var r := _drive_line(sc.node, float(e.hint), float(sc.profile.max_speed) * float(rv.skill) * band, sc.speed, float(rv.lane))
		if float(e.finished_at) >= 0.0:
			r.x = -0.3
		sc.step(dt, r.x, r.y, 0.0)
		_keep_on(sc, e)
	_step_traffic(dt)
	_step_police(dt)
	_tick_race(dt)
	_stream()
	_follow()
	_place_camera(dt)

## the far ground and the sea stay under the car (every frame, the countdown too: left at 0 they covered a low road)
func _follow() -> void:
	_far.position = Vector3(player.node.position.x, player.node.position.y - (30.0 if route.look() != "neon" else 3.0), player.node.position.z)
	if _water:
		_water.position = Vector3(player.node.position.x, (0.0 if route.look() == "water" else minf(player.node.position.y - 16.0, 0.0)), player.node.position.z)
		if route.look() == "coast":
			_water.position.y = 0.0
			_far.position.y = -6.0

## [throttle, steer] for a driver following the road at up to `top`
func _drive_line(n: Node3D, hint: float, top: float, speed: float, lane := 0.0) -> Vector2:
	var ad := hint + 16.0 + absf(speed) * 0.35
	var fa := route.dir_at(ad)
	var aim := route.at(ad) + Vector3(fa.z, 0, -fa.x) * lane    # each driver keeps a line of its own (no conga line)
	var to: Vector3 = aim - n.position
	var err := wrapf(atan2(-to.x, -to.z) - n.rotation.y, -PI, PI)
	var curve := route.dir_at(hint + 20.0).angle_to(route.dir_at(hint + 60.0 + absf(speed) * 0.8))
	var want := top * (1.0 - clampf(curve / 0.9, 0.0, 0.55))
	return Vector2(clampf((want - speed) / 4.0, -1.0, 1.0), clampf(err * 2.4, -1.0, 1.0))

## the road's edge holds a car (barriers on the street, the rail on the highway and mountain, the buoys on the water
## only slow): a car past the edge is put back and scrubs speed; one left far off course is put back on the road
func _keep_on(sc: RefCounted, e: Dictionary) -> void:
	var n: Array = route.nearest_from(sc.node.position, float(e.get("hint", -1.0)))
	e.hint = float(n[0])
	var side := float(n[1])
	var walled := route.look() in ["neon", "highway", "snow", "coast"]
	var lim := route.width * 0.5 + (0.2 if walled else float(route.kind.verge))
	if side > lim:
		var q := route.at(float(n[0]))
		var out: Vector3 = Vector3(sc.node.position.x - q.x, 0, sc.node.position.z - q.z).normalized()
		sc.node.position = Vector3(q.x + out.x * lim, sc.node.position.y, q.z + out.z * lim)
		sc.speed *= pow(0.3, get_process_delta_time()) if walled else 0.98
	obstacles[int(sc.get_meta("box_index"))] = sc.box()

func _tick_race(dt: float) -> void:
	var positions: Array = []
	for rv in rivals:
		positions.append(rv.sc.node.position)
	positions.append(player.node.position)
	race.tick(dt, positions)
	var me := player_entry
	if bool(me.get("missed", false)) and not _missed_said:
		_missed_said = true
		controls.toast("MISSED CHECKPOINT %d · back onto the road" % int(me.next))
	elif not bool(me.get("missed", false)):
		_missed_said = false
	var place: int = race.position_of(me)
	var cps := route.checkpoints.size()
	var to_go := race.remaining(me)
	hud.text = "P%d / %d   CP %d / %d%s\n%d km/h   %.1f km to go   %s%s" % [place, race.entries.size(), mini(int(me.next), cps), cps,
		("   LAP %d / %d" % [mini(int(me.lap) + 1, race.laps_to_go), race.laps_to_go]) if route.closed else "",
		int(absf(player.speed) * 3.6), to_go / 1000.0, _fmt(race.time),
		("   HEAT " + "★".repeat(int(ceil(race.heat)))) if race.heat > 0.05 else ""]
	var lines: Array = []
	var i := 1
	var mine := race.progress(me)
	for e in race.order():
		var gap: float = race.progress(e) - mine
		lines.append("%d  %s%s" % [i, e.name, ("  ✓" if float(e.finished_at) >= 0.0 else ("" if e == me else "  %+.0f m" % gap))])
		i += 1
	board.text = "\n".join(lines)
	if (float(me.finished_at) >= 0.0 or race.busted) and not _paid:
		_finish()

static func _fmt(t: float) -> String:
	return "%d:%04.1f" % [int(t) / 60, fmod(t, 60.0)]

var look_dev: Array = []          # [from, to] offsets from the car: a fixed look-dev camera for shots
func _place_camera(dt: float) -> void:
	var n: Node3D = player.node
	if not look_dev.is_empty():
		cam.position = n.position + (look_dev[0] as Vector3)
		cam.look_at(n.position + (look_dev[1] as Vector3))
		return
	var look: Vector2 = controls.take_look() if controls else Vector2.ZERO
	cam_yaw -= look.x * 0.0045
	cam_yaw = lerp_angle(cam_yaw, n.rotation.y, minf(1.0, 2.5 * dt) if look.x == 0.0 else 0.0)
	var pivot := n.position + Vector3(0, 1.4, 0)
	var back := Vector3(sin(cam_yaw), 0.26, cos(cam_yaw)).normalized()
	var want := pivot + back * 8.5
	var k := 1.0 if dt >= 1.0 else 1.0 - exp(-10.0 * dt)
	cam.position = cam.position.lerp(want, k)
	cam.look_at(pivot + Vector3(0, 0.6, 0))
	var vs := get_viewport_rect().size
	cam.keep_aspect = Camera3D.KEEP_WIDTH if vs.y > vs.x else Camera3D.KEEP_HEIGHT
	cam.fov = 78.0 if vs.y > vs.x else 64.0

func _finish() -> void:
	_paid = true
	Sound.loop_stop("route_siren")
	var me := player_entry
	var prize := race.prize()
	var profile := { "xp": 0, "nex": 0, "level": 1 }
	var f := FileAccess.open(PROFILE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			profile.merge(d, true)
	var xp := 0 if race.busted else int(80 + route.length * race.laps_to_go / 1000.0 * 12.0)
	var res := Progression.grant(profile, "race", prize, xp, String(route.def.name))
	for l in res.lines:
		controls.toast(String(l))
	var w := FileAccess.open(PROFILE, FileAccess.WRITE)
	if w:
		w.store_string(JSON.stringify(profile))
	finish_panel = PanelContainer.new()
	finish_panel.set_anchors_preset(Control.PRESET_CENTER)
	finish_panel.position = Vector2(-190, -100)
	var v := VBoxContainer.new()
	finish_panel.add_child(v)
	var t := Label.new()
	t.text = ("BUSTED · %s\nthe police boxed you in\nno prize" % String(route.def.name)) if race.busted else \
		"P%d · %s\n%s · %.1f km\n+%d Nex   +%d XP" % [race.position_of(me), String(route.def.name), _fmt(float(me.finished_at)), route.length * race.laps_to_go / 1000.0, prize, xp]
	t.add_theme_font_size_override("font_size", 22)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var b := Button.new()
	b.text = "LEAVE"
	b.custom_minimum_size = Vector2(320, 48)
	b.pressed.connect(func(): closed.emit())
	v.add_child(b)
	add_child(finish_panel)
