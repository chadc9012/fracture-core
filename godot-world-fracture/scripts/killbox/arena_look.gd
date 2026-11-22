extends RefCounted
## The Killbox arenas' look (owner, Nov 22: "Work on killbox"): a sky per arena, the city (or the dunes, the ice, the
## sea floor, the void) around it, surfaced facades and decks, and detail on the cover. Look only — the arena's shapes,
## its boxes and the rules stay in arena.gd / killbox_match.gd. Everything here is procedural (shaders on the mobile
## renderer, MultiMeshes for the backdrop), so it costs a handful of draw calls and no download.

## what stands around each `look` (arena_view.gd LOOKS): the sky's mood, the ground far below, the backdrop
const SCENES := {
	"neon-rooftops": { "kind": "city", "ground": Color(0.04, 0.04, 0.06), "sun": Color(0.5, 0.55, 0.9), "sun_e": 0.7, "amb": Color(0.25, 0.2, 0.4), "amb_e": 1.3, "stars": 0.6 },
	"nexus-grid": { "kind": "city", "ground": Color(0.03, 0.05, 0.07), "sun": Color(0.5, 0.7, 0.95), "sun_e": 0.7, "amb": Color(0.16, 0.26, 0.4), "amb_e": 1.3, "stars": 0.8 },
	"prime-roof": { "kind": "city", "ground": Color(0.04, 0.03, 0.06), "sun": Color(0.6, 0.5, 0.95), "sun_e": 0.7, "amb": Color(0.26, 0.18, 0.42), "amb_e": 1.3, "stars": 0.6 },
	"skydock": { "kind": "city", "ground": Color(0.05, 0.05, 0.07), "sun": Color(0.75, 0.75, 0.95), "sun_e": 0.9, "amb": Color(0.28, 0.28, 0.4), "amb_e": 1.3, "stars": 0.9, "far": true },
	"neon-yard": { "kind": "city", "ground": Color(0.04, 0.04, 0.06), "sun": Color(0.5, 0.55, 0.9), "sun_e": 0.7, "amb": Color(0.25, 0.2, 0.4), "amb_e": 1.3, "stars": 0.5 },
	"glass-spire": { "kind": "city", "ground": Color(0.03, 0.04, 0.07), "sun": Color(0.55, 0.65, 0.95), "sun_e": 0.8, "amb": Color(0.2, 0.24, 0.42), "amb_e": 1.3, "stars": 0.9, "far": true },
	"riverfront": { "kind": "city", "ground": Color(0.02, 0.05, 0.09), "sun": Color(0.5, 0.55, 0.9), "sun_e": 0.7, "amb": Color(0.25, 0.2, 0.4), "amb_e": 1.3, "stars": 0.5, "water": true },
	"solara-outpost": { "kind": "desert", "ground": Color(0.78, 0.63, 0.42), "sun": Color(1.0, 0.93, 0.8), "sun_e": 1.25, "amb": Color(0.6, 0.66, 0.78), "amb_e": 0.6, "stars": 0.0 },
	"frostveil-ring": { "kind": "ice", "ground": Color(0.62, 0.7, 0.8), "sun": Color(0.6, 0.75, 1.0), "sun_e": 0.9, "amb": Color(0.3, 0.4, 0.6), "amb_e": 1.2, "stars": 1.0 },
	"thalassia-dome": { "kind": "sea", "ground": Color(0.03, 0.14, 0.18), "sun": Color(0.35, 0.85, 0.9), "sun_e": 0.8, "amb": Color(0.1, 0.35, 0.42), "amb_e": 1.3, "stars": 0.0 },
	"void-rift": { "kind": "void", "ground": Color(0.02, 0.0, 0.04), "sun": Color(0.7, 0.5, 1.0), "sun_e": 0.8, "amb": Color(0.28, 0.14, 0.42), "amb_e": 1.3, "stars": 1.0 },
}

## the body in each sky: direction, colour, angular radius, ringed
const ORBS := {
	"neon-rooftops": [Vector3(-0.5, 0.42, -0.75), Color(0.95, 0.75, 0.9), 0.07, 0.0],
	"nexus-grid": [Vector3(0.6, 0.5, -0.6), Color(0.75, 0.9, 1.0), 0.05, 0.0],
	"prime-roof": [Vector3(0.3, 0.5, -0.8), Color(0.85, 0.75, 1.0), 0.06, 0.0],
	"skydock": [Vector3(-0.2, 0.3, -0.9), Color(1.0, 0.8, 0.55), 0.11, 0.0],
	"neon-yard": [Vector3(0.7, 0.4, -0.5), Color(0.95, 0.8, 0.9), 0.05, 0.0],
	"glass-spire": [Vector3(-0.6, 0.55, -0.55), Color(0.8, 0.88, 1.0), 0.06, 0.0],
	"riverfront": [Vector3(0.1, 0.32, -0.95), Color(1.0, 0.9, 0.75), 0.08, 0.0],
	"solara-outpost": [Vector3(0.45, 0.6, -0.65), Color(3.0, 2.7, 2.0), 0.045, 0.0],
	"frostveil-ring": [Vector3(-0.35, 0.42, -0.85), Color(0.75, 0.82, 1.0), 0.13, 1.0],
	"void-rift": [Vector3(0.0, 0.45, -0.9), Color(0.1, 0.02, 0.16), 0.16, 0.0],
}

static func scene(look_id: String) -> Dictionary:
	return SCENES.get(look_id, SCENES["neon-rooftops"])

static func _shader(code: String) -> Shader:
	var s := Shader.new()
	s.code = code
	return s

# ------------------------------------------------------------------------------------------------ the sky

const SKY := """
shader_type sky;
uniform vec3 top : source_color;
uniform vec3 horizon : source_color;
uniform vec3 glow : source_color;
uniform float stars = 0.6;
uniform float aurora = 0.0;
uniform vec3 orb_dir = vec3(0.0, 1.0, 0.0);
uniform vec3 orb : source_color = vec3(0.0);
uniform float orb_size = 0.0;
uniform float orb_ring = 0.0;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void sky() {
	vec3 d = normalize(EYEDIR);
	float t = clamp(d.y, 0.0, 1.0);
	vec3 c = mix(horizon, top, pow(t, 0.42));
	// the city's light on the haze, low on the sky
	c += glow * pow(1.0 - t, 6.0) * 0.55;
	if (d.y < 0.0) {
		c = mix(horizon, horizon * 0.25, clamp(-d.y * 4.0, 0.0, 1.0));
	}
	vec2 uv = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))) * 260.0;
	vec2 id = floor(uv);
	float h = h21(id);
	float s = step(0.99, h) * smoothstep(0.4, 0.0, length(fract(uv) - 0.5)) * smoothstep(0.03, 0.3, d.y);
	c += vec3(s) * stars * (0.5 + 0.5 * h21(id + 7.0));
	// curtains of light over the ice
	float band = sin(d.x * 6.0 + sin(d.z * 4.0) * 2.0) * 0.5 + 0.5;
	c += vec3(0.15, 0.9, 0.55) * aurora * band * smoothstep(0.15, 0.4, d.y) * smoothstep(0.85, 0.45, d.y) * 0.35;
	// the sun, a moon or a ringed world
	if (orb_size > 0.0) {
		vec3 o = normalize(orb_dir);
		float a = acos(clamp(dot(d, o), -1.0, 1.0));
		float disc = smoothstep(orb_size, orb_size * 0.94, a);
		// a soft terminator so the disc reads as a sphere
		vec3 side = normalize(cross(o, vec3(0.0, 1.0, 0.0)));
		float shade = mix(1.0, clamp(0.72 + dot(d - o * dot(d, o), side) / orb_size * 0.38, 0.2, 1.1), step(0.5, orb_ring + stars));
		c = mix(c, orb * shade, disc);
		c += orb * exp(-a / (orb_size * 2.2)) * 0.35 * (1.0 - disc);
		if (orb_ring > 0.0) {
			vec3 up = normalize(cross(side, o) + side * 0.35);
			vec3 rel = d - o * dot(d, o);
			float rx = dot(rel, side);
			float ry = dot(rel, up) * 4.5;
			float rr = length(vec2(rx, ry));
			float ring = smoothstep(orb_size * 1.35, orb_size * 1.45, rr) * smoothstep(orb_size * 2.1, orb_size * 2.0, rr);
			ring *= mix(1.0, 1.0 - disc, step(0.0, dot(rel, up)));
			c = mix(c, orb * 0.85, ring * 0.7 * step(0.0, dot(d, o)));
		}
	}
	COLOR = c;
}
"""

## the sky, the ambient and the key light for a look; `look` is arena_view's LOOKS row
static func environment(world: Node3D, look_id: String, look: Dictionary) -> Environment:
	var sc := scene(look_id)
	var env := Environment.new()
	var sm := ShaderMaterial.new()
	sm.shader = _shader(SKY)
	sm.set_shader_parameter("top", look.sky)
	var day: bool = sc.kind == "desert"
	sm.set_shader_parameter("horizon", look.fog if day else (look.fog as Color) * 0.75)
	sm.set_shader_parameter("glow", Color(0, 0, 0) if day else (look.trim[0] as Color).lerp(look.fog, 0.5))
	sm.set_shader_parameter("stars", float(sc.stars))
	sm.set_shader_parameter("aurora", 1.0 if sc.kind == "ice" else 0.0)
	var orb: Array = ORBS.get(look_id, [])
	if not orb.is_empty():
		sm.set_shader_parameter("orb_dir", orb[0])
		sm.set_shader_parameter("orb", orb[1])
		sm.set_shader_parameter("orb_size", orb[2])
		sm.set_shader_parameter("orb_ring", orb[3])
	var sky := Sky.new()
	sky.sky_material = sm
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = sc.amb
	env.ambient_light_energy = float(sc.amb_e)
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = look.fog
	env.fog_density = 0.0022 if sc.kind == "sea" else (0.0016 if sc.kind == "city" else 0.0007)
	env.fog_sky_affect = 0.0
	env.glow_enabled = true
	env.glow_intensity = 0.6
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var key := DirectionalLight3D.new()
	key.light_color = sc.sun
	key.light_energy = float(sc.sun_e)
	key.rotation_degrees = Vector3(-42, 28, 0) if day else Vector3(-55, 20, 0)
	key.shadow_enabled = true
	key.directional_shadow_max_distance = 140.0
	world.add_child(key)
	return env

# ------------------------------------------------------------------------------------------------ surfaces

## a block's wall: floors and bays of windows in world space, some lit (warm, a few cool), dark glass otherwise
const FACADE := """
shader_type spatial;
uniform vec3 wall : source_color;
uniform vec3 lit : source_color = vec3(1.0, 0.82, 0.55);
uniform vec3 accent : source_color = vec3(0.3, 0.8, 1.0);
uniform float lit_share = 0.4;
uniform float energy = 1.6;
uniform float bay = 2.4;
uniform float floor_h = 3.2;
varying vec3 wp;
varying vec3 wn;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	float side = step(abs(wn.y), 0.5);
	float xface = step(abs(wn.z), abs(wn.x));
	float u = mix(wp.x, wp.z, xface);
	vec2 g = vec2(u / bay, wp.y / floor_h);
	vec2 c = floor(g);
	vec2 f = fract(g);
	float win = step(0.14, f.x) * step(f.x, 0.86) * step(0.22, f.y) * step(f.y, 0.82) * side;
	float seed = xface * 17.0 + floor(mix(wp.z, wp.x, xface) / 6.0);
	float h = h21(c + seed);
	float on = step(1.0 - lit_share, h);
	vec3 tint = mix(lit, accent, step(0.86, h21(c + seed + 3.7)));
	// a blind half down in some windows, a floor band between storeys
	float blind = mix(1.0, step(f.y, 0.55), step(0.7, h21(c + seed + 11.0)));
	float band = step(f.y, 0.06) * side;
	vec3 base = wall * (0.85 + 0.3 * h21(vec2(c.y, seed)));
	ALBEDO = mix(mix(base, base * 0.6, band), vec3(0.02, 0.03, 0.05), win);
	ROUGHNESS = mix(0.82, 0.12, win);
	METALLIC = win * 0.7;
	EMISSION = tint * win * on * blind * energy * (0.45 + 0.55 * h21(c + seed + 5.0));
}
"""

static func facade(look: Dictionary, lit_share := 0.4, energy := 1.6) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader(FACADE)
	m.set_shader_parameter("wall", look.facade)
	m.set_shader_parameter("accent", look.trim[1 % (look.trim as Array).size()])
	m.set_shader_parameter("lit_share", lit_share)
	m.set_shader_parameter("energy", energy)
	return m

## a deck: 4 m panels with dark seams, worn patches and standing water that mirrors the signs (or drifted sand / frost)
const DECK := """
shader_type spatial;
uniform vec3 tone : source_color;

uniform vec3 line : source_color = vec3(0.9, 0.75, 0.2);
uniform float wet = 1.0;
uniform float dust = 0.0;
uniform vec3 dust_tone : source_color = vec3(0.8, 0.7, 0.5);
varying vec3 wp;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 p = wp.xz;
	vec2 g = p / 4.0;
	vec2 f = abs(fract(g) - 0.5);
	float s = smoothstep(0.485, 0.497, max(f.x, f.y));
	float panel = h21(floor(g));
	float n = vnoise(p * 0.35) * 0.6 + vnoise(p * 1.7) * 0.3 + vnoise(p * 7.0) * 0.1;
	float puddle = smoothstep(0.56, 0.68, n) * wet;
	float drift = smoothstep(0.42, 0.7, vnoise(p * 0.22 + 31.0) * 0.7 + vnoise(p * 2.3) * 0.3) * dust;
	vec3 c = tone * (0.78 + 0.34 * panel) * (0.86 + 0.28 * vnoise(p * 3.0));
	c = mix(c, tone * 2.4 + 0.07, s * 0.85);
	c = mix(c, c * 0.45, puddle);
	c = mix(c, dust_tone, drift);
	ALBEDO = c;
	ROUGHNESS = mix(mix(0.72, 0.06, puddle), 0.95, drift);
	METALLIC = mix(0.15, 0.55, puddle) * (1.0 - drift);
}
"""

static func deck(look: Dictionary, look_id: String) -> ShaderMaterial:
	var sc := scene(look_id)
	var m := ShaderMaterial.new()
	m.shader = _shader(DECK)
	m.set_shader_parameter("tone", (look.roof as Color).lightened(0.1))
	var dry: bool = sc.kind == "desert" or sc.kind == "ice"
	m.set_shader_parameter("wet", 0.0 if dry else 1.0)
	m.set_shader_parameter("dust", 1.0 if dry else 0.0)
	m.set_shader_parameter("dust_tone", Color(0.86, 0.74, 0.52) if sc.kind == "desert" else Color(0.92, 0.95, 1.0))
	return m

## a shipping container's ribbed steel, a little rust low down, in the given paint
const RIBBED := """
shader_type spatial;
uniform vec3 paint : source_color;
varying vec3 wp;
varying vec3 wn;
varying vec3 lp;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void vertex() {
	lp = VERTEX;
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	float side = step(abs(wn.y), 0.5);
	float u = mix(wp.x, wp.z, step(abs(wn.z), abs(wn.x)));
	float rib = smoothstep(0.0, 0.5, abs(fract(u * 3.2) - 0.5) * 2.0);
	float shade = mix(1.0, 0.62 + 0.38 * rib, side);
	vec2 q = vec2(u, wp.y) * 1.3;
	vec2 qi = floor(q);
	vec2 qf = fract(q);
	qf = qf * qf * (3.0 - 2.0 * qf);
	float nz = mix(mix(h21(qi), h21(qi + vec2(1.0, 0.0)), qf.x), mix(h21(qi + vec2(0.0, 1.0)), h21(qi + vec2(1.0, 1.0)), qf.x), qf.y);
	float rust = smoothstep(0.5, 1.0, nz * (1.0 - clamp(lp.y + 0.5, 0.0, 1.0)) * 2.4);
	ALBEDO = mix(paint * shade, vec3(0.32, 0.16, 0.08) * shade, rust * 0.4);
	ROUGHNESS = 0.55 + 0.3 * rust;
	METALLIC = 0.5 * (1.0 - rust);
}
"""

static func ribbed(paint: Color) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader(RIBBED)
	m.set_shader_parameter("paint", paint)
	return m

## a walkway: steel grating you can see the dark through, a solid kick plate along each edge
const GRATE := """
shader_type spatial;
uniform vec3 tone : source_color = vec3(0.3, 0.32, 0.36);
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 g = fract(wp.xz / 0.32);
	float open = (1.0 - step(0.16, g.x) * step(g.x, 0.84) * step(0.16, g.y) * step(g.y, 0.84));
	ALBEDO = mix(vec3(0.015, 0.015, 0.02), tone, open);
	ROUGHNESS = mix(0.9, 0.35, open);
	METALLIC = 0.8 * open;
}
"""

static func grate() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader(GRATE)
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

# ------------------------------------------------------------------------------------------------ the backdrop

static func _mm(world: Node3D, mesh: Mesh, mat: Material, xfs: Array) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)
	return mi

## what stands around the arena. `keep` is the arena's footprint (x, z rect): nothing is put inside it or close by.
static func backdrop(world: Node3D, look_id: String, look: Dictionary, keep: Rect2, rng: RandomNumberGenerator) -> void:
	var sc := scene(look_id)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(3000, 3000)
	ground.mesh = pm
	ground.position.y = -0.25
	ground.material_override = flat(sc.ground, 0.25 if sc.get("water", false) else 0.9, 0.3 if sc.get("water", false) else 0.0)
	world.add_child(ground)
	var c := keep.get_center()
	var r0 := maxf(keep.size.x, keep.size.y) * 0.5 + 40.0
	match String(sc.kind):
		"city":
			_city(world, look, c, r0, rng, bool(sc.get("far", false)))
		"desert":
			_mesas(world, c, r0, rng)
		"ice":
			_peaks(world, c, r0, rng)
		"sea":
			_sea(world, look, c, r0, rng)
		"void":
			_shards(world, look, c, r0, rng)
	_set_piece(world, look_id, look, c, r0)

## a shaft of light: unshaded, additive, fading to nothing at the top
const BEAM := """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;
uniform vec3 tint : source_color;
uniform float power = 0.5;
uniform float flip = 0.0;
void fragment() {
	float v = mix(UV.y, 1.0 - UV.y, flip);
	float rim = pow(abs(dot(normalize(NORMAL), normalize(VIEW))), 1.5);
	ALBEDO = tint * power * v * v * rim;
}
"""

static func _beam(world: Node3D, pos: Vector3, h: float, r_bottom: float, r_top: float, tint: Color, power := 0.5, tilt := Vector3.ZERO, from_top := false) -> void:
	var cm := CylinderMesh.new()
	cm.bottom_radius = r_bottom
	cm.top_radius = r_top
	cm.height = h
	cm.radial_segments = 16
	cm.rings = 1
	cm.cap_top = false
	cm.cap_bottom = false
	var m := ShaderMaterial.new()
	m.shader = _shader(BEAM)
	m.set_shader_parameter("tint", tint)
	m.set_shader_parameter("power", power)
	m.set_shader_parameter("flip", 1.0 if from_top else 0.0)
	var mi := MeshInstance3D.new()
	mi.mesh = cm
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var pivot := Node3D.new()
	pivot.position = pos
	pivot.rotation = tilt
	mi.position.y = h * 0.5
	pivot.add_child(mi)
	world.add_child(pivot)

## a giant advertising screen: scan lines and blocks of colour that crawl
const SCREEN := """
shader_type spatial;
render_mode unshaded;
uniform vec3 a : source_color;
uniform vec3 b : source_color;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec2 uv = UV * vec2(6.0, 10.0);
	float t = floor(TIME * 0.6);
	float blk = h21(floor(uv) + t * 0.37);
	float bars = step(0.5, fract(UV.y * 3.0 - TIME * 0.05));
	vec3 c = mix(a, b, step(0.55, blk)) * (0.35 + 0.65 * bars);
	c *= 0.75 + 0.25 * sin(UV.y * 500.0);
	float frame = step(0.03, UV.x) * step(UV.x, 0.97) * step(0.02, UV.y) * step(UV.y, 0.98);
	ALBEDO = c * frame * 1.6;
}
"""

static func _screen(world: Node3D, pos: Vector3, size: Vector2, yaw: float, a: Color, b: Color) -> void:
	var qm := QuadMesh.new()
	qm.size = size
	var m := ShaderMaterial.new()
	m.shader = _shader(SCREEN)
	m.set_shader_parameter("a", a)
	m.set_shader_parameter("b", b)
	var mi := MeshInstance3D.new()
	mi.mesh = qm
	mi.material_override = m
	mi.position = pos
	mi.rotation.y = yaw
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)
	_part(world, _b(Vector3(size.x + 1.0, size.y + 1.0, 0.8)), pos - Vector3(sin(yaw), 0, cos(yaw)) * 0.5, flat(Color(0.05, 0.05, 0.07), 0.6, 0.5), Vector3(0, yaw, 0))

static func _torus(world: Node3D, pos: Vector3, r: float, thick: float, rot: Vector3, mat: Material) -> void:
	var tm := TorusMesh.new()
	tm.inner_radius = r - thick
	tm.outer_radius = r
	tm.rings = 48
	tm.ring_segments = 8
	var mi := _part(world, tm, pos, mat, rot)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## the one thing each arena is remembered by; all of it stands outside the fight (no collision, nothing to hide behind)
static func _set_piece(world: Node3D, look_id: String, look: Dictionary, c: Vector2, r0: float) -> void:
	var o := Vector3(c.x, 0, c.y)
	var t0: Color = look.trim[0]
	var t1: Color = look.trim[1 % (look.trim as Array).size()]
	match look_id:
		"neon-rooftops":
			# advertising screens the size of buildings, facing the roofs
			_screen(world, o + Vector3(-r0 - 8.0, 46.0, -18.0), Vector2(26, 40), PI * 0.5, t0, t1)
			_screen(world, o + Vector3(r0 + 10.0, 52.0, 14.0), Vector2(30, 34), -PI * 0.5, t1, Color(1.0, 0.8, 0.3))
			_screen(world, o + Vector3(8.0, 58.0, -r0 - 16.0), Vector2(44, 28), 0.0, Color(1.0, 0.3, 0.5), t1)
		"nexus-grid":
			# the Nexus spire and its beam
			var sp := o + Vector3(-30.0, 0, -r0 - 60.0)
			_part(world, _cyl(11.0, 150.0, 3.0), sp + Vector3(0, 75, 0), facade(look, 0.5, 1.4))
			for k in 4:
				_torus(world, sp + Vector3(0, 40.0 + k * 30.0, 0), 14.0 - k * 2.2, 0.6, Vector3.ZERO, flat(t0, 0.4, 0.0, 4.0))
			_beam(world, sp + Vector3(0, 150, 0), 600.0, 2.5, 5.0, t0, 0.9, Vector3.ZERO, true)
		"prime-roof":
			# searchlights crossing over the arena
			for k in 4:
				var a := TAU * (float(k) + 0.3) / 4.0
				_beam(world, o + Vector3(cos(a) * (r0 + 20.0), 10.0, sin(a) * (r0 + 20.0)), 420.0, 1.5, 22.0, t0.lerp(Color.WHITE, 0.5), 0.35, Vector3(cos(a + 1.9) * 0.45, 0, sin(a + 1.9) * 0.45), true)
		"skydock":
			# craft holding off the dock, their landing lights down through the haze
			for k in 3:
				var p := o + Vector3(-70.0 + k * 75.0, 44.0 + k * 9.0, -r0 - 30.0 - k * 22.0)
				if ResourceLoader.exists("res://models/fleet/vanguard-jet.glb"):
					var jet := (load("res://models/fleet/vanguard-jet.glb") as PackedScene).instantiate() as Node3D
					jet.position = p
					jet.rotation.y = 0.6 - k * 0.5
					jet.scale = Vector3.ONE * 2.2
					world.add_child(jet)
				_beam(world, p + Vector3(0, -90, 0), 90.0, 9.0, 0.6, Color(1.0, 0.9, 0.7), 0.3)
		"neon-yard":
			# gantry cranes over the stacks
			var steel := flat(Color(0.75, 0.3, 0.12), 0.6, 0.5)
			for sgn: float in [-1.0, 1.0]:
				var base := o + Vector3(sgn * (r0 + 14.0), 0, -10.0 * sgn)
				for lz: float in [-9.0, 9.0]:
					_part(world, _b(Vector3(2.0, 62.0, 2.0)), base + Vector3(0, 31, lz), steel)
				_part(world, _b(Vector3(70.0, 3.0, 3.0)), base + Vector3(-sgn * 22.0, 62.0, 0), steel)
				_part(world, _b(Vector3(3.0, 3.0, 20.0)), base + Vector3(0, 60.0, 0), steel)
				_part(world, _b(Vector3(0.3, 22.0, 0.3)), base + Vector3(-sgn * 40.0, 50.0, 0), flat(Color(0.1, 0.1, 0.1), 0.5))
				_part(world, _b(Vector3(6.0, 2.6, 2.6)), base + Vector3(-sgn * 40.0, 38.0, 0), ribbed(Color(0.6, 0.2, 0.2)))
				_part(world, _b(Vector3(1.0, 1.0, 1.0)), base + Vector3(-sgn * 55.0, 64.5, 0), flat(Color(1.0, 0.15, 0.1), 0.5, 0.0, 6.0))
		"glass-spire":
			# sister spires, lit to their crowns
			for k in 3:
				var p2 := o + Vector3(-90.0 + k * 85.0, 0, -r0 - 50.0 - (k % 2) * 40.0)
				var hh := 150.0 + k * 35.0
				_part(world, _cyl(13.0, hh, 5.0), p2 + Vector3(0, hh * 0.5, 0), facade(look, 0.6, 1.5))
				_part(world, _cyl(0.5, 40.0, 0.1), p2 + Vector3(0, hh + 20.0, 0), flat(t0, 0.4, 0.0, 5.0))
				_torus(world, p2 + Vector3(0, hh - 2.0, 0), 6.5, 0.7, Vector3.ZERO, flat(t0, 0.4, 0.0, 5.0))
		"riverfront":
			# the bridge across the water, cables lit
			var dark := flat(Color(0.1, 0.1, 0.13), 0.6, 0.5)
			var z := o.z - r0 - 45.0
			_part(world, _b(Vector3(420.0, 2.5, 14.0)), Vector3(o.x, 16.0, z), dark)
			for sgn2: float in [-1.0, 1.0]:
				var tx := o.x + sgn2 * 80.0
				for lz2: float in [-6.0, 6.0]:
					_part(world, _b(Vector3(4.0, 80.0, 3.0)), Vector3(tx, 40.0, z + lz2), dark)
				_part(world, _b(Vector3(5.0, 3.0, 16.0)), Vector3(tx, 78.0, z), dark)
				_part(world, _b(Vector3(1.2, 1.2, 1.2)), Vector3(tx, 82.0, z), flat(Color(1.0, 0.15, 0.1), 0.5, 0.0, 6.0))
				for k2 in 9:
					for dir: float in [-1.0, 1.0]:
						var reach := 14.0 + k2 * 8.0
						var top := Vector3(tx, 78.0 - k2 * 2.0, z)
						var foot := Vector3(tx + dir * reach, 17.5, z)
						var mid := (top + foot) * 0.5
						var cable := _part(world, _b(Vector3(0.22, top.distance_to(foot), 0.22)), mid, flat(t0, 0.4, 0.0, 2.5))
						cable.rotation.z = atan2(foot.x - top.x, top.y - foot.y)
		"solara-outpost":
			# a solar tower: the receiver burning white at the top, mirrors in rows below
			var tp := o + Vector3(40.0, 0, -r0 - 70.0)
			_part(world, _cyl(5.0, 110.0, 3.0), tp + Vector3(0, 55, 0), flat(Color(0.8, 0.78, 0.72), 0.7))
			_part(world, _cyl(5.5, 10.0), tp + Vector3(0, 112, 0), flat(Color(1.0, 0.97, 0.85), 0.3, 0.0, 8.0))
			var mirrors: Array = []
			for ring in 3:
				for k3 in 22:
					var a2 := PI * 0.15 + PI * 0.7 * float(k3) / 21.0
					var mp := tp + Vector3(cos(a2) * (40.0 + ring * 16.0), 2.5, sin(a2) * (40.0 + ring * 16.0))
					mirrors.append(Transform3D(Basis.from_euler(Vector3(-0.7, -a2 + PI * 0.5, 0)).scaled(Vector3(6.0, 0.15, 4.5)), mp))
			_mm(world, BoxMesh.new(), flat(Color(0.75, 0.86, 1.0), 0.05, 1.0), mirrors)
		"frostveil-ring":
			# drill pylons on the ice, each with a beacon
			for k4 in 5:
				var a3 := TAU * (float(k4) + 0.5) / 5.0
				var pp := o + Vector3(cos(a3) * (r0 + 30.0), 0, sin(a3) * (r0 + 30.0))
				_part(world, _cyl(2.2, 48.0, 0.8), pp + Vector3(0, 24, 0), flat(Color(0.3, 0.36, 0.44), 0.4, 0.7))
				_part(world, _b(Vector3(1.4, 1.4, 1.4)), pp + Vector3(0, 49, 0), flat(t0, 0.4, 0.0, 6.0))
				_beam(world, pp + Vector3(0, 49, 0), 160.0, 0.5, 2.5, t0, 0.5, Vector3.ZERO, true)
		"thalassia-dome":
			# sunlight coming down through the water
			for k5 in 7:
				var a4 := TAU * float(k5) / 7.0 + 0.4
				var rr := (r0 + 5.0) * (0.35 + 0.5 * fmod(k5 * 0.618, 1.0))
				_beam(world, o + Vector3(cos(a4) * rr, 0, sin(a4) * rr), 190.0, 4.0 + k5 % 3 * 2.0, 16.0, Color(0.5, 1.0, 0.95), 0.16, Vector3(0.12, 0, 0.18))
		"void-rift":
			# the rift itself: a burning ring round a hole in the sky, a second ring tilted through it
			var rp := o + Vector3(0, 150.0, -r0 - 190.0)
			_torus(world, rp, 78.0, 2.4, Vector3(PI * 0.5, 0, 0), flat(t0, 0.3, 0.0, 6.0))
			_torus(world, rp, 96.0, 0.9, Vector3(PI * 0.5 + 0.5, 0.4, 0), flat(t1, 0.3, 0.0, 4.0))
			_beam(world, o + Vector3(0, -40, -r0 - 190.0), 190.0, 3.0, 30.0, t0, 0.35)

static func _ring(c: Vector2, r: float, a: float) -> Vector3:
	return Vector3(c.x + cos(a) * r, 0.0, c.y + sin(a) * r)

## towers on every side: a near ring that frames the roofs, a far ring that makes the skyline, red lamps on the tall
static func _city(world: Node3D, look: Dictionary, c: Vector2, r0: float, rng: RandomNumberGenerator, far_only: bool) -> void:
	var xfs: Array = []
	var lamps: Array = []
	var crowns: Array = []
	var n := 120
	for i in n:
		var near := i < 22 and not far_only
		var a := rng.randf() * TAU
		var r := (r0 + rng.randf_range(20.0, 80.0)) if near else (r0 + rng.randf_range(110.0, 560.0))
		var p := _ring(c, r, a)
		var w := rng.randf_range(16.0, 34.0) if near else rng.randf_range(22.0, 60.0)
		var d := rng.randf_range(16.0, 34.0) if near else rng.randf_range(22.0, 60.0)
		var h := rng.randf_range(14.0, 44.0) if near else rng.randf_range(30.0, 130.0) * (1.0 if rng.randf() < 0.85 else 1.6)
		if far_only:
			h *= 0.45   # a deck above the city: the towers stay below the fight
		var yaw := snappedf(rng.randf() * TAU, PI * 0.5) + rng.randf_range(-0.08, 0.08)
		xfs.append(Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3(w, h, d)), p + Vector3(0, h * 0.5, 0)))
		if h > 95.0:
			lamps.append(Transform3D(Basis().scaled(Vector3(1.4, 1.4, 1.4)), p + Vector3(0, h + 3.0, 0)))
		if not near and rng.randf() < 0.3:
			crowns.append(Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3(w + 0.6, 1.2, d + 0.6)), p + Vector3(0, h - rng.randf_range(0.5, 6.0), 0)))
	var bm := BoxMesh.new()
	_mm(world, bm, facade(look, 0.2, 1.0), xfs)
	if not lamps.is_empty():
		var sm := SphereMesh.new()
		sm.radial_segments = 8
		sm.rings = 4
		_mm(world, sm, flat(Color(1.0, 0.12, 0.1), 0.5, 0.0, 6.0), lamps)
	if not crowns.is_empty():
		# a band of the arena's neon round some tower tops
		_mm(world, bm, flat(look.trim[0], 0.4, 0.0, 3.0), crowns)

## sandstone mesas and rock stacks under a bright sky
static func _mesas(world: Node3D, c: Vector2, r0: float, rng: RandomNumberGenerator) -> void:
	var xfs: Array = []
	var caps: Array = []
	for i in 70:
		var a := rng.randf() * TAU
		var r := r0 + rng.randf_range(40.0, 600.0)
		var p := _ring(c, r, a)
		var w := rng.randf_range(40.0, 150.0)
		var h := rng.randf_range(8.0, 30.0) + r * 0.06
		xfs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(w, h, w * rng.randf_range(0.6, 1.3))), p + Vector3(0, h * 0.5 - 1.0, 0)))
		if rng.randf() < 0.5:
			var w2 := w * rng.randf_range(0.35, 0.6)
			caps.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(w2, h * 0.5, w2)), p + Vector3(rng.randf_range(-0.2, 0.2) * w, h * 1.2, 0)))
	var cm := CylinderMesh.new()
	cm.top_radius = 0.42
	cm.bottom_radius = 0.55
	cm.height = 1.0
	cm.radial_segments = 9
	cm.rings = 1
	_mm(world, cm, flat(Color(0.74, 0.5, 0.32), 0.95), xfs)
	_mm(world, cm, flat(Color(0.8, 0.58, 0.38), 0.95), caps)

## ice peaks round the ring, snow below
static func _peaks(world: Node3D, c: Vector2, r0: float, rng: RandomNumberGenerator) -> void:
	var xfs: Array = []
	for i in 90:
		var a := rng.randf() * TAU
		var r := r0 + rng.randf_range(160.0, 760.0)
		var p := _ring(c, r, a)
		var w := rng.randf_range(50.0, 160.0)
		var h := rng.randf_range(30.0, 80.0) + r * 0.2
		xfs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(w, h, w * rng.randf_range(0.7, 1.2))), p + Vector3(0, h * 0.5 - 2.0, 0)))
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0
	cm.bottom_radius = 0.5
	cm.height = 1.0
	cm.radial_segments = 7
	cm.rings = 1
	var m := flat(Color(0.7, 0.8, 0.92), 0.35, 0.1)
	_mm(world, cm, m, xfs)

## the sea floor outside the dome: rock spires, kelp-green glow, the dome's ribs overhead
static func _sea(world: Node3D, look: Dictionary, c: Vector2, r0: float, rng: RandomNumberGenerator) -> void:
	var xfs: Array = []
	var glow: Array = []
	for i in 80:
		var a := rng.randf() * TAU
		var r := r0 + rng.randf_range(30.0, 380.0)
		var p := _ring(c, r, a)
		var w := rng.randf_range(10.0, 40.0)
		var h := rng.randf_range(15.0, 70.0)
		xfs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(w, h, w)), p + Vector3(0, h * 0.5 - 1.0, 0)))
		if rng.randf() < 0.4:
			glow.append(Transform3D(Basis().scaled(Vector3(1.2, 1.2, 1.2) * rng.randf_range(0.8, 2.4)), p + Vector3(rng.randf_range(-w, w) * 0.4, h * rng.randf_range(0.3, 0.9), 0)))
	var cm := CylinderMesh.new()
	cm.top_radius = 0.12
	cm.bottom_radius = 0.5
	cm.height = 1.0
	cm.radial_segments = 7
	cm.rings = 1
	_mm(world, cm, flat(Color(0.06, 0.2, 0.24), 0.8), xfs)
	var sm := SphereMesh.new()
	sm.radial_segments = 8
	sm.rings = 4
	_mm(world, sm, flat(look.trim[0], 0.4, 0.0, 4.0), glow)
	# the dome: ribs arching over the decks
	var ribs: Array = []
	var rr := r0 + 12.0
	for k in 10:
		var yaw := PI * float(k) / 10.0
		for s in 24:
			var t := PI * (float(s) + 0.5) / 24.0
			var pos := Vector3(cos(t) * rr, sin(t) * rr * 0.75, 0.0)
			var tangent := Vector3(-sin(t), cos(t) * 0.75, 0.0).normalized()
			var b := Basis(Vector3.BACK, atan2(tangent.y, tangent.x)).scaled(Vector3(rr * PI / 24.0 * 1.08, 0.5, 0.5))
			ribs.append(Transform3D(Basis(Vector3.UP, yaw), Vector3(c.x, 0, c.y)) * Transform3D(b, pos))
	_mm(world, BoxMesh.new(), flat(Color(0.5, 0.62, 0.66), 0.35, 0.7), ribs)

## broken ground hanging in the rift, lit along its edges
static func _shards(world: Node3D, look: Dictionary, c: Vector2, r0: float, rng: RandomNumberGenerator) -> void:
	var xfs: Array = []
	var veins: Array = []
	for i in 110:
		var a := rng.randf() * TAU
		var r := r0 + rng.randf_range(20.0, 420.0)
		var p := _ring(c, r, a) + Vector3(0, rng.randf_range(-40.0, 150.0), 0)
		var s := Vector3(rng.randf_range(6.0, 40.0), rng.randf_range(4.0, 26.0), rng.randf_range(6.0, 40.0))
		var b := Basis.from_euler(Vector3(rng.randf_range(-0.6, 0.6), rng.randf() * TAU, rng.randf_range(-0.6, 0.6)))
		xfs.append(Transform3D(b.scaled(s), p))
		if rng.randf() < 0.45:
			veins.append(Transform3D(b.scaled(Vector3(s.x * 1.01, 0.25, s.z * 1.01)), p + b * Vector3(0, rng.randf_range(-0.3, 0.3) * s.y, 0)))
	_mm(world, BoxMesh.new(), flat(Color(0.12, 0.09, 0.15), 0.85), xfs)
	_mm(world, BoxMesh.new(), flat(look.trim[0], 0.4, 0.0, 3.5), veins)

# ------------------------------------------------------------------------------------------------ cover detail

static func _part(holder: Node3D, mesh: Mesh, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.rotation = rot
	mi.material_override = mat
	holder.add_child(mi)
	return mi

static func _b(size: Vector3) -> BoxMesh:
	var bm := BoxMesh.new()
	bm.size = size
	return bm

static func _cyl(r: float, h: float, r_top := -1.0) -> CylinderMesh:
	var cm := CylinderMesh.new()
	cm.bottom_radius = r
	cm.top_radius = r if r_top < 0.0 else r_top
	cm.height = h
	cm.radial_segments = 14
	cm.rings = 1
	return cm

## the pieces that make a cover box read as the thing it is. `holder` sits at the world origin; `pos` is the box's
## centre, `size` its extents; returns nodes that glow with the signs (they go dark in a blackout).
static func dress(holder: Node3D, kind: String, pos: Vector3, size: Vector3, look: Dictionary) -> Array:
	var glows: Array = []
	var dark := flat(Color(0.12, 0.12, 0.14), 0.5, 0.6)
	var steel := flat(Color(0.5, 0.52, 0.56), 0.4, 0.8)
	var hx := size.x * 0.5
	var hy := size.y * 0.5
	var hz := size.z * 0.5
	match kind:
		"crate":
			# a steel frame on the twelve edges, a stencil panel on the long side
			var t := 0.07
			for sx: float in [-1.0, 1.0]:
				for sz: float in [-1.0, 1.0]:
					_part(holder, _b(Vector3(t, size.y + 0.02, t)), pos + Vector3(sx * hx, 0, sz * hz), dark)
			for sy: float in [-1.0, 1.0]:
				for sz2: float in [-1.0, 1.0]:
					_part(holder, _b(Vector3(size.x + 0.02, t, t)), pos + Vector3(0, sy * hy, sz2 * hz), dark)
				for sx2: float in [-1.0, 1.0]:
					_part(holder, _b(Vector3(t, t, size.z + 0.02)), pos + Vector3(sx2 * hx, sy * hy, 0), dark)
			for sz3: float in [-1.0, 1.0]:
				_part(holder, _b(Vector3(size.x * 0.45, size.y * 0.3, 0.02)), pos + Vector3(0, 0, sz3 * (hz + 0.005)), flat(Color(0.75, 0.68, 0.45), 0.8))
		"container":
			# corner posts, door bars on one end, a neon ID strip
			for sx: float in [-1.0, 1.0]:
				for sz: float in [-1.0, 1.0]:
					_part(holder, _b(Vector3(0.16, size.y + 0.04, 0.16)), pos + Vector3(sx * hx, 0, sz * hz), dark)
			var long_x := size.x >= size.z
			for k: float in [-0.5, -0.17, 0.17, 0.5]:
				if long_x:
					_part(holder, _cyl(0.035, size.y * 0.86), pos + Vector3(hx + 0.04, 0, k * size.z * 0.7), steel)
				else:
					_part(holder, _cyl(0.035, size.y * 0.86), pos + Vector3(k * size.x * 0.7, 0, hz + 0.04), steel)
			var strip := _part(holder, _b(Vector3(size.x * 0.5, 0.1, 0.03) if long_x else Vector3(0.03, 0.1, size.z * 0.5)), pos + (Vector3(0, hy * 0.6, hz + 0.02) if long_x else Vector3(hx + 0.02, hy * 0.6, 0)), flat(look.trim[0], 0.4, 0.0, 3.0))
			glows.append(strip)
		"hvac":
			# a fan under a guard ring on top, louvres down one side, feet
			var fr := minf(hx, hz) * 0.72
			_part(holder, _cyl(fr, 0.08), pos + Vector3(0, hy + 0.04, 0), dark)
			_part(holder, _cyl(fr * 1.06, 0.14, fr * 1.06), pos + Vector3(0, hy + 0.02, 0), steel).scale = Vector3(1, 0.4, 1)
			for k in 4:
				_part(holder, _b(Vector3(fr * 1.8, 0.02, 0.12)), pos + Vector3(0, hy + 0.09, 0), steel, Vector3(0, PI * 0.25 * k, 0))
			var n := int(size.y / 0.22)
			for k2 in n:
				_part(holder, _b(Vector3(size.x * 0.8, 0.03, 0.06)), pos + Vector3(0, -hy + 0.2 + k2 * 0.22, hz + 0.02), dark, Vector3(0.5, 0, 0))
		"vent":
			# a rain cap on legs over the shaft
			_part(holder, _b(Vector3(size.x + 0.3, 0.08, size.z + 0.3)), pos + Vector3(0, hy + 0.22, 0), dark)
			for sx: float in [-1.0, 1.0]:
				for sz: float in [-1.0, 1.0]:
					_part(holder, _b(Vector3(0.05, 0.22, 0.05)), pos + Vector3(sx * hx * 0.85, hy + 0.11, sz * hz * 0.85), steel)
			var n2 := int(size.y / 0.25)
			for k3 in n2:
				for sz4: float in [-1.0, 1.0]:
					_part(holder, _b(Vector3(size.x * 0.84, 0.03, 0.05)), pos + Vector3(0, -hy + 0.2 + k3 * 0.25, sz4 * (hz + 0.02)), dark)
		"tank":
			# hoops, a domed lid, a ladder and a valve
			var r := hx
			for f: float in [-0.6, 0.0, 0.6]:
				_part(holder, _cyl(r * 1.03, 0.09), pos + Vector3(0, f * hy, 0), steel)
			_part(holder, _cyl(r, r * 0.35, r * 0.25), pos + Vector3(0, hy + r * 0.175, 0), flat(Color(0.42, 0.3, 0.22), 0.7))
			for sx: float in [-1.0, 1.0]:
				_part(holder, _b(Vector3(0.04, size.y, 0.04)), pos + Vector3(sx * 0.22, 0, r + 0.08), steel)
			var rungs := int(size.y / 0.4)
			for k4 in rungs:
				_part(holder, _b(Vector3(0.44, 0.03, 0.03)), pos + Vector3(0, -hy + 0.3 + k4 * 0.4, r + 0.08), steel)
			var valve := _part(holder, _cyl(0.14, 0.05), pos + Vector3(r + 0.05, -hy * 0.4, 0), flat(Color(0.9, 0.2, 0.15), 0.6), Vector3(0, 0, PI * 0.5))
			valve.name = "valve"
		"console":
			# a lit screen leaning back on top, a key strip, a status light
			var screen := _part(holder, _b(Vector3(size.x * 0.86, 0.5, 0.04)), pos + Vector3(0, hy + 0.22, -hz * 0.3), flat(look.trim[1 % (look.trim as Array).size()], 0.3, 0.0, 2.4), Vector3(-0.35, 0, 0))
			glows.append(screen)
			_part(holder, _b(Vector3(size.x * 0.92, 0.56, 0.03)), pos + Vector3(0, hy + 0.21, -hz * 0.3 - 0.03), dark, Vector3(-0.35, 0, 0))
			_part(holder, _b(Vector3(size.x * 0.8, 0.03, size.z * 0.4)), pos + Vector3(0, hy + 0.015, hz * 0.45), flat(Color(0.3, 0.32, 0.36), 0.5, 0.4))
			var led := _part(holder, _b(Vector3(size.x * 0.9, 0.05, 0.02)), pos + Vector3(0, hy * 0.4, hz + 0.012), flat(look.trim[0], 0.4, 0.0, 3.0))
			glows.append(led)
		"barrier":
			# feet, a reflector strip
			for sx: float in [-1.0, 1.0]:
				_part(holder, _b(Vector3(0.3, 0.1, size.z + 0.3)), pos + Vector3(sx * hx * 0.7, -hy + 0.05, 0), dark)
			var refl := _part(holder, _b(Vector3(size.x * 0.9, 0.06, size.z + 0.03)), pos + Vector3(0, hy * 0.7, 0), flat(Color(1.0, 0.7, 0.1), 0.4, 0.0, 1.6))
			glows.append(refl)
		"planter":
			# soil and a clipped shrub over the box
			_part(holder, _b(Vector3(size.x * 0.92, 0.06, size.z * 0.92)), pos + Vector3(0, hy + 0.01, 0), flat(Color(0.12, 0.08, 0.05), 0.95))
			var bush := SphereMesh.new()
			bush.radius = 0.5
			bush.height = 1.0
			bush.radial_segments = 10
			bush.rings = 6
			var count := maxi(1, int(maxf(size.x, size.z) / 1.1))
			for k5 in count:
				var f2 := (float(k5) + 0.5) / float(count) - 0.5
				var bp := pos + (Vector3(f2 * size.x * 0.85, hy + 0.4, 0) if size.x >= size.z else Vector3(0, hy + 0.4, f2 * size.z * 0.85))
				_part(holder, bush, bp, flat(Color(0.12, 0.34, 0.16).lerp(Color(0.2, 0.45, 0.2), fmod(k5 * 0.37, 1.0)), 0.9)).scale = Vector3(minf(size.x, 1.2), 0.95, minf(size.z, 1.2))
		"pillar":
			# a base, a capital, a light line up each face
			_part(holder, _b(Vector3(size.x + 0.25, 0.25, size.z + 0.25)), pos + Vector3(0, -hy + 0.125, 0), dark)
			_part(holder, _b(Vector3(size.x + 0.25, 0.2, size.z + 0.25)), pos + Vector3(0, hy - 0.1, 0), dark)
			for sz5: float in [-1.0, 1.0]:
				glows.append(_part(holder, _b(Vector3(0.08, size.y * 0.7, 0.02)), pos + Vector3(0, 0, sz5 * (hz + 0.012)), flat(look.trim[0], 0.4, 0.0, 2.6)))
		"monolith":
			# rift light in cracks round the stone
			for f3: float in [-0.5, 0.1, 0.6]:
				glows.append(_part(holder, _b(Vector3(size.x + 0.03, 0.07, size.z + 0.03)), pos + Vector3(0, f3 * hy, 0), flat(look.trim[0], 0.4, 0.0, 3.5), Vector3(0, 0, 0.06 * f3)))
		"dropship":
			# a parked lander: canopy, engine pods, skids, running lights
			var cab := SphereMesh.new()
			cab.radius = 0.5
			cab.height = 1.0
			cab.radial_segments = 12
			cab.rings = 6
			var long_x2 := size.x >= size.z
			var fwd := Vector3(1, 0, 0) if long_x2 else Vector3(0, 0, 1)
			var side := Vector3(0, 0, 1) if long_x2 else Vector3(1, 0, 0)
			var len := maxf(size.x, size.z)
			var wid := minf(size.x, size.z)
			_part(holder, cab, pos + fwd * len * 0.42 + Vector3(0, hy * 0.25, 0), flat(Color(0.05, 0.08, 0.12), 0.1, 0.8)).scale = Vector3(wid * 0.8, size.y * 0.8, wid * 0.8)
			for s2: float in [-1.0, 1.0]:
				_part(holder, _cyl(size.y * 0.3, len * 0.45), pos + side * s2 * (wid * 0.5 + size.y * 0.2) - fwd * len * 0.15 + Vector3(0, hy * 0.2, 0), steel, Vector3(0, 0, PI * 0.5) if long_x2 else Vector3(PI * 0.5, 0, 0))
				glows.append(_part(holder, _cyl(size.y * 0.22, 0.06), pos + side * s2 * (wid * 0.5 + size.y * 0.2) - fwd * (len * 0.38) + Vector3(0, hy * 0.2, 0), flat(look.trim[0], 0.4, 0.0, 4.0), Vector3(0, 0, PI * 0.5) if long_x2 else Vector3(PI * 0.5, 0, 0)))
				_part(holder, _b(fwd * len * 0.7 + side * 0.12 + Vector3(0, 0.1, 0)), pos + side * s2 * wid * 0.35 + Vector3(0, -hy - 0.0, 0), dark)
			_part(holder, _b(fwd * 0.2 + side * wid * 1.5 + Vector3(0, size.y * 0.5, 0)), pos - fwd * len * 0.45 + Vector3(0, hy + size.y * 0.2, 0), steel)
	return glows
