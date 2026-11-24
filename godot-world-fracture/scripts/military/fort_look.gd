extends RefCounted
## Fort Kessler's surfaces (owner, Nov 23: "I need my game to look like this — builds floor characters weapons planes
## vehicles tanks military", with frames of GTA V's Fort Zancudo): sun-bleached tarmac in slabs with cracks, patches,
## oil and tyre marks; dry scrub and dirt; brown ranges with green in the folds; corrugated hangar steel; chain-link.
## All world-space shaders on the mobile renderer: no texture downloads, sharp at any distance.

static func _shader(code: String) -> Shader:
	var s := Shader.new()
	s.code = code
	return s

const NOISE := """
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
	float a = 0.5;
	float s = 0.0;
	for (int k = 0; k < 5; k++) { s += vn(p) * a; p = p * 2.03 + 17.0; a *= 0.5; }
	return s;
}
"""

## tarmac: 7.5 m slabs with dark joints, each a little different; hairline cracks; patched squares; oil stains; and along
## `skid_axis` (the runway's direction) streaks of rubber where wheels touch down
static func tarmac(tone := Color(0.46, 0.45, 0.43), skids := 0.0) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("""
shader_type spatial;
uniform vec3 tone : source_color;
uniform float skids = 0.0;
varying vec3 wp;
""" + NOISE + """
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	vec2 g = p / 7.5;
	vec2 cell = floor(g);
	vec2 f = abs(fract(g) - 0.5);
	float joint = smoothstep(0.488, 0.497, max(f.x, f.y));
	float slab = h21(cell);
	float grit = vn(p * 9.0) * 0.5 + vn(p * 31.0) * 0.5;
	vec3 c = tone * (0.93 + 0.1 * slab) * (0.9 + 0.2 * grit);
	// big weathering, sun-bleached patches
	c *= 0.88 + 0.24 * fbm(p * 0.035);
	// cracks: thin dark lines where a ridged noise crosses zero
	float cr = abs(fbm(p * 0.22 + slab * 9.0) - 0.5);
	c = mix(c, c * 0.7, smoothstep(0.008, 0.0, cr) * step(0.62, h21(cell + 3.1)));
	// patched slabs, darker and smoother
	float patch = step(0.9, h21(cell + 7.7));
	c = mix(c, tone * 0.62, patch * 0.8);
	// oil and stains
	float oil = smoothstep(0.66, 0.8, fbm(p * 0.09 + 40.0));
	c = mix(c, vec3(0.12, 0.11, 0.1), oil * 0.55);
	// tyre rubber along z (the runway runs north-south)
	float lane = smoothstep(0.55, 1.0, vn(vec2(p.x * 0.9, p.y * 0.012))) * smoothstep(0.3, 0.9, vn(vec2(p.x * 0.07, p.y * 0.003)));
	c = mix(c, vec3(0.08, 0.08, 0.08), lane * skids * 0.75);
	c = mix(c, c * 0.6, joint * 0.6);
	ALBEDO = c;
	ROUGHNESS = mix(0.88, 0.6, oil);
	SPECULAR = 0.35;
}
""")
	m.set_shader_parameter("tone", tone)
	m.set_shader_parameter("skids", skids)
	return m

## the land outside the slabs: dry grass, bare dirt, scrub
static func scrub() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("""
shader_type spatial;
varying vec3 wp;
""" + NOISE + """
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float n = fbm(p * 0.02);
	float d = fbm(p * 0.11 + 9.0);
	vec3 grass = mix(vec3(0.56, 0.5, 0.31), vec3(0.42, 0.45, 0.24), smoothstep(0.35, 0.7, n));
	vec3 dirt = vec3(0.6, 0.5, 0.38);
	vec3 c = mix(grass, dirt, smoothstep(0.5, 0.7, d));
	// scrub: small dark green tufts
	float tuft = smoothstep(0.82, 0.9, vn(p * 2.2)) * (1.0 - smoothstep(0.5, 0.7, d));
	c = mix(c, vec3(0.2, 0.26, 0.12), tuft * 0.8);
	c *= 0.85 + 0.3 * vn(p * 6.0);
	ALBEDO = c;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
}
""")
	return m

## the ranges: bare tan rock on the steep faces, chaparral green in the folds, paler with distance
static func range_rock() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("""
shader_type spatial;
varying vec3 wp;
varying vec3 wn;
""" + NOISE + """
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec2 p = wp.xz;
	float steep = 1.0 - wn.y;
	vec3 rock = mix(vec3(0.5, 0.39, 0.28), vec3(0.4, 0.31, 0.23), fbm(p * 0.01));
	vec3 bush = mix(vec3(0.33, 0.36, 0.2), vec3(0.24, 0.3, 0.16), fbm(p * 0.03 + 5.0));
	float folds = smoothstep(0.36, 0.56, fbm(p * 0.006 + 2.0)) * (1.0 - smoothstep(0.25, 0.65, steep));
	vec3 c = mix(rock, bush, folds * 0.85);
	// dark speckle of shrubs on the slopes
	c = mix(c, vec3(0.2, 0.24, 0.13), smoothstep(0.8, 0.9, vn(p * 0.35)) * (1.0 - steep) * 0.7);
	c *= 0.85 + 0.25 * vn(p * 0.2);
	ALBEDO = c;
	ROUGHNESS = 0.97;
	SPECULAR = 0.15;
}
""")
	return m

## corrugated steel cladding: ribs across the wall's width, streaks of rust and dirt down from the top
static func corrugated(paint: Color) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("""
shader_type spatial;
uniform vec3 paint : source_color;
varying vec3 wp;
varying vec3 wn;
""" + NOISE + """
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	float u = mix(wp.x, wp.z, step(abs(wn.z), abs(wn.x)));
	if (abs(wn.y) > 0.6) { u = wp.x + wp.z; }
	float rib = 0.5 + 0.5 * sin(u * 9.0);
	vec3 c = paint * (0.82 + 0.22 * rib);
	float streak = vn(vec2(u * 1.3, wp.y * 0.08)) * smoothstep(0.0, 6.0, wp.y);
	c = mix(c, c * vec3(0.72, 0.62, 0.5), smoothstep(0.55, 0.9, streak) * 0.6);
	c *= 0.9 + 0.15 * vn(wp.xz * 0.3 + wp.y);
	ALBEDO = c;
	ROUGHNESS = 0.55;
	METALLIC = 0.45;
}
""")
	m.set_shader_parameter("paint", paint)
	return m

## painted render: a building's wall, with a darker plinth and grime
static func render_wall(paint: Color) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("""
shader_type spatial;
uniform vec3 paint : source_color;
varying vec3 wp;
""" + NOISE + """
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec3 c = paint * (0.9 + 0.12 * fbm(wp.xz * 0.2 + wp.y * 0.3));
	c = mix(c * 0.7, c, smoothstep(0.0, 0.9, wp.y));
	c = mix(c, c * 0.8, smoothstep(0.6, 0.85, vn(vec2(wp.x + wp.z, wp.y * 0.15) * 0.8)) * 0.5);
	ALBEDO = c;
	ROUGHNESS = 0.9;
}
""")
	m.set_shader_parameter("paint", paint)
	return m

## chain-link: a diamond mesh you see through, galvanised grey
static func chain_link() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("""
shader_type spatial;
render_mode cull_disabled;
varying vec3 wp;
varying vec3 wn;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	float u = mix(wp.x, wp.z, step(abs(wn.z), abs(wn.x)));
	vec2 q = vec2(u + wp.y, u - wp.y) / 0.07;
	vec2 f = abs(fract(q) - 0.5);
	float wire = 1.0 - smoothstep(0.36, 0.46, min(f.x, f.y));
	if (wire < 0.5) { discard; }
	ALBEDO = vec3(0.62, 0.64, 0.66);
	METALLIC = 0.8;
	ROUGHNESS = 0.45;
}
""")
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

static func glass(tint := Color(0.25, 0.34, 0.4)) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = tint
	m.roughness = 0.06
	m.metallic = 0.85
	return m
