extends Control
## Nexus City street slice: one block of a Nexus avenue at golden hour, built to chase the owner's concept frames (wet
## reflective asphalt, palms and planters, a café terrace, mid-rise apartments over shopfronts, glass towers behind, warm
## low sun through haze). Meshy-generated props from res://models/city/, the fleet cars parked at the kerb.
## Forward+ gets SDFGI bounce light, screen-space reflections, SSAO/SSIL and volumetric fog; the mobile renderer
## quietly drops what it can't do and keeps the rest.
signal closed

const ROAD_W := 16.0          # kerb to kerb
const WALK_W := 7.0           # each sidewalk
const LENGTH := 260.0         # street length (z)
const MODELS := "res://models/city/"
const FLEET := "res://models/fleet/"

var cam: Camera3D
var world: Node3D
var _rng := RandomNumberGenerator.new()
var _cache := {}

func _ready() -> void:
	_rng.seed = 2207
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.06, 0.08)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	_environment()
	_street()
	_buildings()
	_skyline()
	_props()
	_cars()
	cam = Camera3D.new()
	cam.fov = 58.0
	cam.near = 0.05
	cam.far = 1500.0
	world.add_child(cam)
	cam.current = true
	look_from(Vector3(ROAD_W * 0.5 + 3.4, 1.7, 30.0), Vector3(ROAD_W * 0.5 - 3.0, 4.0, -40.0))
	var back := Button.new()
	back.text = "← BACK"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)

func look_from(from: Vector3, at: Vector3) -> void:
	cam.position = from
	cam.look_at(at)

# --------------------------------------------------------------------------------------------- light, sky, haze
func _environment() -> void:
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.78, 0.55)
	sun.light_energy = 2.6
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 220.0
	sun.light_angular_distance = 1.2
	sun.rotation_degrees = Vector3(-11.0, 148.0, 0.0)   # low sun ahead and to the right, long shadows across the street
	sun.light_volumetric_fog_energy = 1.6
	world.add_child(sun)
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.29, 0.43, 0.66)
	sky_mat.sky_horizon_color = Color(0.98, 0.72, 0.50)
	sky_mat.ground_horizon_color = Color(0.70, 0.55, 0.45)
	sky_mat.ground_bottom_color = Color(0.18, 0.17, 0.17)
	sky_mat.sun_angle_max = 20.0
	sky_mat.sun_curve = 0.08
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.05
	env.ssr_enabled = true
	env.ssr_max_steps = 96
	env.ssr_fade_in = 0.1
	env.ssr_fade_out = 2.5
	env.ssao_enabled = true
	env.ssao_radius = 1.4
	env.ssao_intensity = 1.6
	env.ssil_enabled = true
	var lite := OS.get_environment("SLICE_LITE")   # "gi" drops SDFGI, "fog" drops volumetric fog, "all" both
	# SDFGI stalls the software Vulkan used for testing; opt in with SLICE_GI=1 on a real GPU
	env.sdfgi_enabled = OS.get_environment("SLICE_GI") == "1" and lite != "gi" and lite != "all"
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 4
	env.sdfgi_min_cell_size = 0.25
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.1
	env.fog_enabled = true
	env.fog_light_color = Color(0.92, 0.72, 0.55)
	env.fog_density = 0.0016
	env.fog_sun_scatter = 0.35
	env.fog_aerial_perspective = 0.55
	env.volumetric_fog_enabled = lite != "fog" and lite != "all"
	env.volumetric_fog_density = 0.006
	env.volumetric_fog_albedo = Color(0.95, 0.85, 0.75)
	env.volumetric_fog_anisotropy = 0.55
	env.volumetric_fog_length = 160.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 1.12
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)

# --------------------------------------------------------------------------------------------- materials
static func _noise_tex(freq: float, octaves: int, size := 1024, normal := false, seamless := true) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = freq
	n.fractal_octaves = octaves
	var t := NoiseTexture2D.new()
	t.width = size
	t.height = size
	t.seamless = seamless
	t.noise = n
	if normal:
		t.as_normal_map = true
		t.bump_strength = 6.0
	return t

## wet asphalt: dark, with puddles where the roughness noise drops low enough to mirror the sky and the buildings
static func asphalt() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D puddle_noise : hint_default_white, repeat_enable;
uniform sampler2D grain : hint_default_white, repeat_enable;
uniform sampler2D grain_n : hint_normal, repeat_enable;
uniform float wet = 0.75;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz;
	float g = texture(grain, p * 0.35).r;
	float puddle = smoothstep(0.52, 0.62, texture(puddle_noise, p * 0.018).r * 0.8 + texture(puddle_noise, p * 0.07).r * 0.3);
	float wetness = clamp(wet * 0.55 + puddle * wet, 0.0, 1.0);
	vec3 base = vec3(0.075, 0.078, 0.085) * (0.75 + 0.5 * g);
	ALBEDO = mix(base, base * 0.55, wetness);
	ROUGHNESS = mix(0.86, 0.05, wetness);
	SPECULAR = mix(0.4, 0.75, wetness);
	NORMAL_MAP = mix(texture(grain_n, p * 0.35).xyz, vec3(0.5, 0.5, 1.0), puddle);
	NORMAL_MAP_DEPTH = 0.8;
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("puddle_noise", _noise_tex(0.004, 4, 512))
	m.set_shader_parameter("grain", _noise_tex(0.09, 3, 512))
	m.set_shader_parameter("grain_n", _noise_tex(0.09, 3, 512, true))
	return m

## pale stone paving in 0.6 m slabs, damp in the joints
static func paving() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D grain : hint_default_white, repeat_enable;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz / vec2(0.6, 0.6);
	vec2 f = abs(fract(p) - 0.5);
	float joint = 1.0 - smoothstep(0.46, 0.49, max(f.x, f.y));
	vec2 id = floor(p);
	float tint = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
	float g = texture(grain, wpos.xz * 0.6).r;
	vec3 stone = mix(vec3(0.60, 0.55, 0.49), vec3(0.70, 0.65, 0.57), tint) * (0.88 + 0.2 * g);
	ALBEDO = mix(stone * 0.62, stone, joint);
	ROUGHNESS = mix(0.35, 0.78 + 0.08 * tint, joint);
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("grain", _noise_tex(0.12, 3, 256))
	return m

static func flat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

# --------------------------------------------------------------------------------------------- street
func _street() -> void:
	var half := ROAD_W * 0.5
	_box(Vector3(ROAD_W, 0.1, LENGTH), Vector3(0, -0.05, 0), asphalt())
	var pave := paving()
	var kerb := flat(Color(0.62, 0.61, 0.58), 0.6)
	for side: float in [-1.0, 1.0]:
		_box(Vector3(WALK_W, 0.18, LENGTH), Vector3(side * (half + WALK_W * 0.5), 0.09, 0), pave)
		_box(Vector3(0.3, 0.2, LENGTH), Vector3(side * (half + 0.15), 0.1, 0), kerb)
	# lane paint, worn, and a pedestrian crossing at the end of the block
	var paint := flat(Color(0.85, 0.85, 0.82), 0.5)
	var z := -LENGTH * 0.5 + 4.0
	while z < LENGTH * 0.5 - 4.0:
		_box(Vector3(0.15, 0.012, 3.0), Vector3(0, 0.006, z), paint)
		z += 9.0
	for side: float in [-1.0, 1.0]:
		_box(Vector3(0.15, 0.012, LENGTH), Vector3(side * (half - 0.6), 0.006, 0), paint)
	var x := -half + 1.0
	while x < half - 0.5:
		_box(Vector3(0.9, 0.012, 4.0), Vector3(x, 0.006, -62.0), paint)
		x += 1.8

# --------------------------------------------------------------------------------------------- loading models
## a Meshy prop scaled so its height is `height` metres, base on the ground, centred on x/z
func prop(file: String, height: float, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	var path := MODELS + file
	if not ResourceLoader.exists(path):
		push_warning("street slice: missing " + path)
		return null
	if not _cache.has(path):
		_cache[path] = load(path)
	var node := (_cache[path] as PackedScene).instantiate() as Node3D
	var holder := Node3D.new()
	holder.add_child(node)
	var aabb := _aabb(node)
	var s := height / maxf(aabb.size.y, 0.001)
	node.scale = Vector3.ONE * s
	node.position = Vector3(-(aabb.position.x + aabb.size.x * 0.5) * s, -aabb.position.y * s, -(aabb.position.z + aabb.size.z * 0.5) * s)
	holder.position = pos
	holder.rotation_degrees.y = yaw_deg
	world.add_child(holder)
	return holder

static func _aabb(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != n and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		out = a if first else out.merge(a)
		first = false
	return out

# --------------------------------------------------------------------------------------------- buildings
func _buildings() -> void:
	var half := ROAD_W * 0.5 + WALK_W
	for side: float in [-1.0, 1.0]:
		var z := -LENGTH * 0.5 + 14.0
		var i := 0
		while z < LENGTH * 0.5 - 10.0:
			var h := 20.0 + _rng.randf_range(-2.0, 6.0)
			# the apartment block's facade faces +z in the model; turn it to face the street
			var b := prop("apartment.glb", h, Vector3(side * (half + h * 0.48), 0.0, z), -90.0 * side)
			if b:
				b.scale.x *= 1.0 + 0.08 * (i % 3)
			# street-level shops: a shopfront podium on the ground floor of every block
			prop("shopfront.glb", 5.2, Vector3(side * (half + 4.0), 0.18, z), -90.0 * side)   # sunk into the block, the awning out over the walk
			z += h * 0.98
			i += 1

## glass towers rising behind the street wall: the skyline in the concept frames
func _skyline() -> void:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform vec3 glass : source_color = vec3(0.32, 0.42, 0.52);
uniform vec3 frame : source_color = vec3(0.16, 0.17, 0.19);
uniform float floor_h = 3.3;
uniform float bay_w = 1.5;
uniform float lit = 0.25;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 9137.7); }
void fragment() {
	vec2 uv = vec2(abs(wnrm.x) > 0.5 ? wpos.z : wpos.x, wpos.y);
	vec2 cell = uv / vec2(bay_w, floor_h);
	vec2 f = fract(cell);
	float mullion = step(0.93, f.x) + step(0.88, f.y);
	float on = step(1.0 - lit, h21(floor(cell))) * (1.0 - mullion);
	vec3 g = glass * (0.8 + 0.4 * h21(floor(cell) * 0.37));
	ALBEDO = mix(g, frame, clamp(mullion, 0.0, 1.0));
	METALLIC = mix(0.85, 0.3, clamp(mullion, 0.0, 1.0));
	ROUGHNESS = mix(0.06, 0.5, clamp(mullion, 0.0, 1.0));
	EMISSION = vec3(1.0, 0.82, 0.6) * on * 0.35;
}
"""
	for k in 26:
		var m := ShaderMaterial.new()
		m.shader = sh
		var tint := _rng.randf()
		m.set_shader_parameter("glass", Color(0.25 + 0.1 * tint, 0.36 + 0.08 * tint, 0.48 + 0.08 * tint))
		m.set_shader_parameter("lit", _rng.randf_range(0.02, 0.1))
		var w := _rng.randf_range(18.0, 34.0)
		var h := _rng.randf_range(60.0, 190.0)
		var side := -1.0 if k % 2 == 0 else 1.0
		var x := side * _rng.randf_range(50.0, 120.0)
		var z := _rng.randf_range(-LENGTH * 0.7, LENGTH * 0.2) - 60.0
		_box(Vector3(w, h, w * _rng.randf_range(0.8, 1.3)), Vector3(x, h * 0.5, z), m)
	# a landmark at the end of the avenue
	var lm := ShaderMaterial.new()
	lm.shader = sh
	lm.set_shader_parameter("glass", Color(0.36, 0.48, 0.62))
	lm.set_shader_parameter("lit", 0.08)
	_box(Vector3(30, 260, 30), Vector3(-6, 130, -LENGTH * 0.5 - 70.0), lm)
	_box(Vector3(18, 60, 18), Vector3(-6, 290, -LENGTH * 0.5 - 70.0), lm)

# --------------------------------------------------------------------------------------------- street furniture
func _props() -> void:
	var half := ROAD_W * 0.5
	for side: float in [-1.0, 1.0]:
		var z := -LENGTH * 0.5 + 8.0
		var i := 0
		while z < LENGTH * 0.5 - 6.0:
			var edge := side * (half + 1.3)
			if i % 2 == 0:
				if ResourceLoader.exists(MODELS + "palm.glb"):
					prop("palm.glb", _rng.randf_range(8.5, 11.0), Vector3(edge, 0.18, z), _rng.randf() * 360.0)
				else:
					_palm_fallback(Vector3(edge, 0.18, z))
			elif ResourceLoader.exists(MODELS + "street-lamp.glb"):
				prop("street-lamp.glb", 6.5, Vector3(edge, 0.18, z), 90.0 * side + 180.0)
			else:
				_lamp_fallback(Vector3(edge, 0.18, z), side)
			if i % 3 == 1:
				prop("planter.glb", 2.2, Vector3(edge, 0.18, z + 5.5), 0.0)
			z += 12.0
			i += 1
		# a café terrace along the shopfronts on the near side
	for k in 5:
		prop("cafe-set.glb", 0.95, Vector3(half + WALK_W - 2.4, 0.18, 6.0 - k * 3.2), _rng.randf_range(-20.0, 20.0))
	prop("bus-shelter.glb", 2.8, Vector3(-(half + 2.4), 0.18, 12.0), 90.0)

func _palm_fallback(at: Vector3) -> void:
	var trunk := flat(Color(0.45, 0.38, 0.3), 0.9)
	_box(Vector3(0.35, 8.0, 0.35), at + Vector3(0, 4.0, 0), trunk)

func _lamp_fallback(at: Vector3, side: float) -> void:
	var metal := flat(Color(0.12, 0.12, 0.13), 0.35, 0.7)
	_box(Vector3(0.18, 6.5, 0.18), at + Vector3(0, 3.25, 0), metal)
	_box(Vector3(1.6, 0.12, 0.3), at + Vector3(-side * 0.7, 6.4, 0), metal)
	_box(Vector3(1.2, 0.04, 0.2), at + Vector3(-side * 0.7, 6.33, 0), flat(Color(1.0, 0.9, 0.75), 0.4, 0.0, 3.0))

# --------------------------------------------------------------------------------------------- parked cars
func _cars() -> void:
	var files := ["street-racer-lod.glb", "muscle-car-lod.glb", "security-suv.glb", "tuner.glb", "offroad-truck.glb"]
	var half := ROAD_W * 0.5
	var z := -LENGTH * 0.5 + 20.0
	var i := 0
	while z < LENGTH * 0.5 - 20.0:
		var side := 1.0 if i % 2 == 0 else -1.0
		var f: String = files[i % files.size()]
		if ResourceLoader.exists(FLEET + f):
			var car := (load(FLEET + f) as PackedScene).instantiate() as Node3D
			car.position = Vector3(side * (half - 1.4), 0.0, z + _rng.randf_range(-2.0, 2.0))
			car.rotation_degrees.y = 0.0 if side > 0 else 180.0
			world.add_child(car)
		z += _rng.randf_range(9.0, 16.0)
		i += 1
