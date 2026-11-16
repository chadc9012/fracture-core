extends RefCounted
## The street-racing night of the owner's Nov 15 boards (docs/reference/nfs-night/): deep navy dark, a big moon, sodium
## lamps that pool orange on the ground and flare in the lens, every light smeared in long streaks across the wet road
## toward the camera, purple / cyan underglow beneath the parked cars, and a hard, saturated grade.
##
## Built from cheap additive cards so it looks the same on the phone's Mobile renderer, Forward+ and the web build:
##   - halo:   a camera-facing glow + a thin horizontal (anamorphic) flare on every light
##   - pool:   a soft disc on the ground under every lamp (the Mobile renderer lights a mesh with 8 lights at most, so
##             most lamps never reached the road; the pool always does)
##   - streak: the light's reflection in wet asphalt. Placed where the mirror image really lands — between the light's
##             foot and the camera, at distance D·h/(e+h) from the foot (D: camera to foot, h: light height, e: camera
##             height) — and stretched along the view direction the way rough wet ground smears it. The vertex shader
##             recomputes that every frame, so the streaks swing with the camera like real reflections.
##   - underglow: a coloured disc under each parked car (ground light only — the car models are not touched).
## One MultiMesh per kind per root (a block or a streamed tile): four draws for every light on it.

const HALO := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled, skip_vertex_transform;
uniform float strength = 1.0;
varying vec4 col;
void vertex() {
	col = COLOR;
	vec3 c = (VIEW_MATRIX * vec4(MODEL_MATRIX[3].xyz, 1.0)).xyz;
	float s = length(MODEL_MATRIX[0].xyz);
	// pulled toward the camera so the lamp head itself never clips the glow
	VERTEX = c + vec3(VERTEX.x * s * 2.6, VERTEX.y * s, 0.0) + vec3(0.0, 0.0, min(1.2, -c.z * 0.5));
}
void fragment() {
	vec2 p = (UV - 0.5) * vec2(2.6, 1.0) * 2.0;
	float r = length(p);
	float core = exp(-r * r * 22.0) * 1.6;
	float glow = exp(-r * r * 3.2) * 0.38;
	float flare = exp(-abs(p.y) * 38.0) * exp(-abs(p.x) * 1.1) * 0.45;
	float dist = -VERTEX.z;
	float fade = smoothstep(1.5, 5.0, dist);   // no glare right in your face
	ALBEDO = col.rgb * (core + glow + flare) * col.a * strength * fade;
}
"""

const POOL := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform float strength = 1.0;
varying vec4 col;
void vertex() { col = COLOR; }
void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.4);
	ALBEDO = col.rgb * a * col.a * strength;
}
"""

const STREAK := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, skip_vertex_transform;
uniform float strength = 1.0;
uniform float road_half = 8.0;
uniform float curb = 0.18;
varying vec4 col;
varying float along;
varying float across;
varying vec3 wpos;
void vertex() {
	col = COLOR;
	vec3 foot = MODEL_MATRIX[3].xyz;            // the point on the ground under the light
	float h = max(INSTANCE_CUSTOM.x, 0.3);      // the light's height above that ground
	vec3 cam = CAMERA_POSITION_WORLD;
	vec2 to_cam = cam.xz - foot.xz;
	float D = max(length(to_cam), 0.01);
	vec2 dir = to_cam / D;
	vec2 side = vec2(-dir.y, dir.x);
	float e = max(cam.y - foot.y, 0.4);
	float hit = D * h / (e + h);                 // where the mirror image meets the ground, from the foot
	float len = clamp(D * 0.4, 1.5, 22.0);      // rough wet asphalt smears it along the view
	float w = clamp(0.12 + h * 0.025 + D * 0.006, 0.12, 0.6) * INSTANCE_CUSTOM.y;
	along = UV.y;                                // 0 far end .. 1 near end
	across = UV.x * 2.0 - 1.0;
	float t = hit + (UV.y - 0.5) * len;
	t = clamp(t, 0.0, D - 0.6);
	vec2 xz = foot.xz + dir * t + side * across * w;
	float y = abs(xz.x) > road_half ? curb + 0.025 : 0.025;
	wpos = vec3(xz.x, y, xz.y);
	VERTEX = (VIEW_MATRIX * vec4(wpos, 1.0)).xyz;
}
float h1(float n) { return fract(sin(n) * 43758.5453); }
void fragment() {
	float core = exp(-across * across * 7.0);
	float len = smoothstep(0.0, 0.35, along) * smoothstep(1.0, 0.7, along);
	// ripples in the wet surface break the streak into bands
	float k = wpos.x * 3.1 + wpos.z * 5.7;
	float bands = 0.65 + 0.35 * sin(along * 46.0 + h1(floor(k)) * 6.28);
	float dist = -VERTEX.z;
	float near = smoothstep(2.5, 12.0, dist);
	ALBEDO = col.rgb * core * len * bands * near * col.a * strength;
}
"""

static var _mats := {}

static func _mat(code: String, strength: float) -> ShaderMaterial:
	var key := code.substr(0, 16) + str(code.length()) + str(strength)
	if _mats.has(key):
		return _mats[key]
	var sh := Shader.new()
	sh.code = code
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("strength", strength)
	_mats[key] = m
	return m

## every light on `root` (lamps, sign glows, shop lights) gets a halo, a streak and — when it is a lamp over the street —
## a pool; every parked car directly under `root` gets underglow. `road_half` / `curb` place the streaks on the road or
## the raised walk.
static func build(root: Node3D, road_half: float, curb: float, neon_city := false) -> void:
	var halos: Array = []    # [pos, color, size]
	var pools: Array = []
	var streaks: Array = []  # [foot, color, height, width]
	for l in root.find_children("*", "OmniLight3D", true, false):
		var light := l as OmniLight3D
		if root.name != &"" and not String(root.name).begins_with("tile_") and String(root.get_path_to(light)).begins_with("tile_"):
			continue   # a streamed tile does its own
		if not light.visible or light.light_energy <= 0.0:
			continue
		var p := root.to_local(light.global_position)
		var ground := curb if absf(p.x) > road_half else 0.0
		var h := p.y - ground
		if h < 0.6 or h > 40.0:
			continue
		var c := light.light_color
		var lamp := c.r > 0.9 and c.g > 0.6 and c.b < 0.8 and light.omni_range >= 12.0
		if lamp:
			# sodium street lamps (the boards' orange pools), slightly brighter than the light itself
			c = Color(1.0, 0.66, 0.34)
		halos.append([p, c, 0.9 if lamp else 0.75])
		streaks.append([Vector3(p.x, ground, p.z), c, h, 1.0 if lamp else 0.8])
		if lamp or h < 7.0:
			pools.append([Vector3(p.x, ground + 0.03, p.z), c, clampf(light.omni_range * 0.55, 3.0, 9.0) if lamp else 3.5])
	var under: Array = []
	var glow_cols := [Color(0.62, 0.15, 1.0), Color(0.1, 0.75, 1.0), Color(0.75, 0.1, 0.95), Color(0.2, 1.0, 0.55)]
	var i := 0
	for ch in root.get_children():
		if ch is Node3D and ch.has_meta("car"):
			var cp := (ch as Node3D).position
			under.append([Vector3(cp.x, 0.025, cp.z), glow_cols[i % glow_cols.size()], (ch as Node3D).rotation.y])
			i += 1
	var amp := 1.25 if neon_city else 1.0
	_halos(root, halos, amp)
	_pools(root, pools, amp)
	_streaks(root, streaks, road_half, curb, amp)
	_underglow(root, under, amp)

static func _mm(root: Node3D, mesh: Mesh, n: int, mat: Material, custom := false) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = custom
	mm.mesh = mesh
	mm.instance_count = n
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.name = "night_fx"
	root.add_child(mi)
	return mm

static func _halos(root: Node3D, list: Array, amp: float) -> void:
	if list.is_empty():
		return
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	var mm := _mm(root, q, list.size(), _mat(HALO, 1.0 * amp))
	mm.custom_aabb = AABB(Vector3(-2000, -50, -2000), Vector3(4000, 500, 4000))
	for k in list.size():
		var e: Array = list[k]
		mm.set_instance_transform(k, Transform3D(Basis().scaled(Vector3.ONE * float(e[2])), e[0]))
		mm.set_instance_color(k, e[1])

static func _pools(root: Node3D, list: Array, amp: float) -> void:
	if list.is_empty():
		return
	var q := PlaneMesh.new()
	q.size = Vector2.ONE
	var mm := _mm(root, q, list.size(), _mat(POOL, 0.35 * amp))
	for k in list.size():
		var e: Array = list[k]
		var s := float(e[2]) * 2.0
		mm.set_instance_transform(k, Transform3D(Basis().scaled(Vector3(s, 1.0, s)), e[0]))
		mm.set_instance_color(k, e[1])

static func _streaks(root: Node3D, list: Array, road_half: float, curb: float, amp: float) -> void:
	if list.is_empty():
		return
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	q.subdivide_depth = 10
	var mat := _mat(STREAK, 0.42 * amp)
	mat.set_shader_parameter("road_half", road_half)
	mat.set_shader_parameter("curb", curb)
	var mm := _mm(root, q, list.size(), mat, true)
	# the vertices move with the camera in the shader, so the box can't be known: never cull them
	mm.custom_aabb = AABB(Vector3(-2000, -50, -2000), Vector3(4000, 500, 4000))
	for k in list.size():
		var e: Array = list[k]
		mm.set_instance_transform(k, Transform3D(Basis(), e[0]))
		mm.set_instance_color(k, e[1])
		mm.set_instance_custom_data(k, Color(float(e[2]), float(e[3]), 0.0, 0.0))

static func _underglow(root: Node3D, list: Array, amp: float) -> void:
	if list.is_empty():
		return
	var q := PlaneMesh.new()
	q.size = Vector2.ONE
	var mm := _mm(root, q, list.size(), _mat(POOL, 0.7 * amp))
	for k in list.size():
		var e: Array = list[k]
		var b := Basis(Vector3.UP, float(e[2])).scaled(Vector3(3.2, 1.0, 6.4))
		mm.set_instance_transform(k, Transform3D(b, e[0]))
		mm.set_instance_color(k, e[1])

## the night sky of the boards: deep navy overhead, a magenta-violet glow of the city on the horizon, slow dark clouds
## with moonlit rims, faint stars, and a large moon with its maria and a soft halo.
static func sky() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type sky;
uniform vec3 zenith : source_color = vec3(0.008, 0.012, 0.035);
uniform vec3 horizon : source_color = vec3(0.20, 0.06, 0.26);
uniform vec3 moon_dir = vec3(0.42, 0.36, -0.83);
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5; float v = 0.0; for (int k = 0; k < 5; k++) { v += a * n(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void sky() {
	vec3 d = EYEDIR;
	vec3 md = normalize(moon_dir);
	if (d.y < 0.0) { COLOR = horizon * 0.35; }
	else {
		float t = pow(1.0 - d.y, 4.0);
		vec3 c = mix(zenith, horizon, t);
		// stars, thinned near the glowing horizon
		vec2 sp = d.xz / (d.y + 0.3) * 260.0;
		float st = step(0.9965, h(floor(sp))) * smoothstep(0.15, 0.5, d.y);
		c += vec3(0.8, 0.85, 1.0) * st * 0.6;
		// the moon: a disc with dark maria, and a halo
		float m = dot(d, md);
		float disc = smoothstep(0.99935, 0.9995, m);
		vec3 tang = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
		vec3 bit = cross(tang, md);
		vec2 mp = vec2(dot(d - md, tang), dot(d - md, bit)) * 30.0;
		float maria = smoothstep(0.45, 0.75, fbm(mp * 2.2 + 3.0));
		vec3 moon = vec3(1.0, 0.98, 0.92) * (1.25 - maria * 0.45) * 2.4;
		c += vec3(0.30, 0.34, 0.55) * pow(max(m, 0.0), 260.0) * 0.9 + vec3(0.12, 0.10, 0.25) * pow(max(m, 0.0), 18.0) * 0.4;
		// clouds on a plane above, lit at their rims by the moon
		vec2 uv = d.xz / (d.y + 0.15) * 1.3;   // still clouds: no TIME, so the radiance map is drawn once, not every frame
		float cl = smoothstep(0.46, 0.78, fbm(uv));
		float rim = pow(max(m, 0.0), 12.0);
		vec3 cc = mix(vec3(0.02, 0.025, 0.05), vec3(0.20, 0.20, 0.32), rim) + horizon * t * 0.5;
		c = mix(c, cc, cl * 0.92 * smoothstep(0.0, 0.1, d.y));
		c = mix(c, moon, disc * (1.0 - cl * 0.85));
		COLOR = c;
	}
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

## the grade: crushed navy darks, hot saturated neon, a wide bloom
static func grade(env: Environment, sun: DirectionalLight3D, sky: Sky, neon_city: bool) -> void:
	sky.sky_material = sky()
	sky.process_mode = Sky.PROCESS_MODE_AUTOMATIC
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	sun.light_color = Color(0.55, 0.65, 1.0)
	# lifted Nov 15 evening (owner: "why is the night image so dark"): the boards average 45-85 of 255 in luminance
	# with lit wet roads at 48-85; the street measured 25 overall and 15 on the road. Moonlight, the navy ambient and
	# the exposure all up — still night, but a night you can see the road in
	sun.light_energy = 1.2
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.24, 0.26, 0.48) if not neon_city else Color(0.3, 0.2, 0.5)
	env.ambient_light_energy = 2.9
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 2.35
	env.glow_enabled = true
	env.glow_intensity = 1.0
	env.glow_strength = 1.1
	env.glow_bloom = 0.12
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	for lv in 7:
		env.set_glow_level(lv, 1.0 if lv in [1, 2, 3, 4, 5] else 0.0)
	env.fog_enabled = true
	env.fog_light_color = Color(0.06, 0.05, 0.14)
	env.fog_density = 0.0022
	env.fog_sun_scatter = 0.0
	env.fog_aerial_perspective = 0.25
	env.volumetric_fog_density = 0.008
	env.volumetric_fog_albedo = Color(0.45, 0.4, 0.7)
	env.adjustment_enabled = true
	env.adjustment_brightness = 1.0
	env.adjustment_contrast = 1.12
	env.adjustment_saturation = 1.4
