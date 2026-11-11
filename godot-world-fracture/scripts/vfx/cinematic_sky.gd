extends RefCounted
## The game's sky after the owner's target frames (docs/reference/target-*.png): a deep gradient, a sun with a soft halo,
## layered clouds lit from the sun's side, stars at night and the giant cracked planet hanging over the horizon with its
## cracks glowing. One sky shader, so every view (street, driving, racing, Killbox day maps, airports, regions) can share
## the look instead of a flat ProceduralSkyMaterial.
##
## Phone cost: the shader does not read TIME, so Godot bakes the radiance (ambient + reflections) once instead of every
## frame; the background pass is one fragment per pixel with a few octaves of noise.
##
##   var env := Environment.new()
##   env.background_mode = Environment.BG_SKY
##   env.sky = CinematicSky.make({"top": Color(...), "horizon": Color(...), "night": 1.0, "clouds": 0.5})
## Keys (all optional): top, horizon, ground (Colors), night 0..1, clouds 0..1 coverage, cloud_tint (Color), planet (bool),
## planet_dir (Vector3 toward it), planet_size (radians), stars 0..1, sun_tint (Color), haze 0..1 (horizon glow band).

const SHADER := """
shader_type sky;
render_mode use_debanding;

uniform vec3 top_color : source_color = vec3(0.2, 0.35, 0.65);
uniform vec3 horizon_color : source_color = vec3(0.95, 0.75, 0.55);
uniform vec3 ground_color : source_color = vec3(0.12, 0.11, 0.11);
uniform vec3 cloud_tint : source_color = vec3(1.0, 0.95, 0.9);
uniform vec3 sun_tint : source_color = vec3(1.0, 0.85, 0.65);
uniform float night = 0.0;
uniform float clouds = 0.5;
uniform float stars = 0.0;
uniform float haze = 0.4;
uniform bool planet = true;
uniform vec3 planet_dir = vec3(-0.45, 0.32, -0.83);
uniform float planet_size = 0.32;
uniform sampler2D planet_tex : source_color, filter_linear_mipmap, hint_default_black;
uniform bool planet_has_tex = false;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
	return v;
}
// distance to the nearest cell edge (the planet's cracks)
float cell_edge(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	float d1 = 8.0, d2 = 8.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(float(x), float(y));
		vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
		float d = length(g + o - f);
		if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
	}
	return d2 - d1;
}

void sky() {
	vec3 d = normalize(EYEDIR);
	float h = d.y;
	// the gradient: horizon band into the zenith, the ground below
	vec3 col = mix(horizon_color, top_color, pow(clamp(h, 0.0, 1.0), 0.45));
	col = mix(col, ground_color, smoothstep(0.0, -0.12, h));
	vec3 sun_dir = LIGHT0_ENABLED ? LIGHT0_DIRECTION : vec3(0.0, 1.0, 0.0);
	float sd = max(dot(d, sun_dir), 0.0);
	// a warm glow band along the horizon toward the sun, stronger in the day
	col += sun_tint * haze * pow(1.0 - abs(h), 6.0) * (0.25 + 0.75 * pow(sd, 3.0)) * (1.0 - night * 0.7);
	// stars
	if (stars > 0.0 && h > 0.0) {
		vec3 sp = d * 220.0;
		vec3 cell = floor(sp);
		float s = hash3(cell);
		float star = step(0.9965, s) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
		col += vec3(0.85, 0.9, 1.0) * star * stars * 2.4 * smoothstep(0.0, 0.25, h);
		// a faint band of the galaxy
		float band = fbm(vec2(atan(d.x, d.z) * 3.0, d.y * 6.0)) * smoothstep(0.35, 0.0, abs(d.y - 0.35 + d.x * 0.3));
		col += vec3(0.35, 0.3, 0.55) * band * stars * 0.35;
	}
	// the cracked planet
	if (planet) {
		vec3 pd = normalize(planet_dir);
		float ang = acos(clamp(dot(d, pd), -1.0, 1.0));
		if (ang < planet_size * 1.25) {
			vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), pd));
			vec3 up = cross(pd, right);
			vec2 q = vec2(dot(d, right), dot(d, up)) / sin(planet_size);
			float r = length(q);
			if (r < 1.0) {
				vec3 n = normalize(right * q.x + up * q.y - pd * sqrt(1.0 - r * r));
				vec2 suv = vec2(atan(n.x, n.z) / 6.2832 + 0.5, acos(clamp(n.y, -1.0, 1.0)) / 3.1416);
				vec3 surf = planet_has_tex ? texture(planet_tex, suv).rgb : mix(vec3(0.3, 0.42, 0.55), vec3(0.62, 0.5, 0.38), fbm(suv * vec2(14.0, 7.0)));
				float lit = clamp(dot(n, -sun_dir) * 0.5 + 0.5, 0.0, 1.0);
				lit = mix(0.25, 1.1, lit) * mix(1.0, 0.75, night);
				float e = cell_edge(suv * vec2(10.0, 5.0) + fbm(suv * 20.0) * 0.5);
				float crack = (1.0 - smoothstep(0.0, 0.025, e)) * smoothstep(0.35, 0.6, fbm(suv * 9.0 + 3.0));
				vec3 p_col = surf * lit;
				p_col = mix(p_col, vec3(1.0, 0.5, 0.2) * 1.8, crack * 0.75);
				// limb darkening and the thin lit atmosphere at the edge
				p_col *= mix(1.0, 0.55, pow(r, 4.0));
				p_col += vec3(0.45, 0.65, 1.0) * smoothstep(0.85, 1.0, r) * 0.6;
				// the sky's haze in front of it near the horizon
				p_col = mix(p_col, col, smoothstep(0.25, -0.05, h) * 0.8);
				col = p_col;
			} else {
				// its atmosphere's glow just outside the rim
				col += vec3(0.4, 0.6, 1.0) * (1.0 - smoothstep(1.0, 1.25, r)) * 0.35;
			}
		}
	}
	// the sun disc and halo
	col += sun_tint * (pow(sd, 1400.0) * 14.0 + pow(sd, 24.0) * 0.35) * (1.0 - night);
	// clouds: a layer over the dome, lit from the sun's side, thinning toward the horizon
	if (clouds > 0.0 && h > 0.0) {
		vec2 cp = d.xz / (h + 0.18) * 1.6;
		float c = fbm(cp + vec2(3.0, 1.0));
		c += fbm(cp * 2.3 - vec2(5.0, 2.0)) * 0.35;
		float cover = smoothstep(1.0 - clouds, 1.0 - clouds + 0.38, c * 0.78);
		float thin = smoothstep(0.0, 0.18, h);
		float shade = fbm(cp + sun_dir.xz * 0.35 + vec2(3.0, 1.0));
		float light = clamp(1.15 - (shade - c) * 2.5, 0.35, 1.25);
		vec3 ccol = cloud_tint * light * mix(1.0, 0.5, night);
		ccol += sun_tint * pow(sd, 6.0) * 0.6 * (1.0 - night);
		ccol = mix(ccol, horizon_color, 1.0 - thin * 0.7);
		col = mix(col, ccol, cover * thin * 0.92);
	}
	COLOR = col;
}
"""

static var _shader: Shader

static func make(o := {}) -> Sky:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("top_color", o.get("top", Color(0.2, 0.35, 0.65)))
	m.set_shader_parameter("horizon_color", o.get("horizon", Color(0.95, 0.75, 0.55)))
	m.set_shader_parameter("ground_color", o.get("ground", Color(0.12, 0.11, 0.11)))
	m.set_shader_parameter("cloud_tint", o.get("cloud_tint", Color(1.0, 0.95, 0.9)))
	m.set_shader_parameter("sun_tint", o.get("sun_tint", Color(1.0, 0.85, 0.65)))
	var night: float = o.get("night", 0.0)
	m.set_shader_parameter("night", night)
	m.set_shader_parameter("clouds", o.get("clouds", 0.5))
	m.set_shader_parameter("stars", o.get("stars", night))
	m.set_shader_parameter("haze", o.get("haze", 0.4))
	m.set_shader_parameter("planet", o.get("planet", true))
	m.set_shader_parameter("planet_dir", o.get("planet_dir", Vector3(-0.45, 0.32, -0.83)))
	m.set_shader_parameter("planet_size", o.get("planet_size", 0.32))
	var tex: Texture2D = o.get("planet_tex", null)
	m.set_shader_parameter("planet_has_tex", tex != null)
	if tex:
		m.set_shader_parameter("planet_tex", tex)
	var sky := Sky.new()
	sky.sky_material = m
	sky.radiance_size = Sky.RADIANCE_SIZE_128
	return sky

## the presets the target frames call for
static func nexus_night() -> Dictionary:
	return {"top": Color(0.02, 0.03, 0.09), "horizon": Color(0.28, 0.14, 0.36), "ground": Color(0.02, 0.02, 0.03),
		"night": 1.0, "clouds": 0.35, "cloud_tint": Color(0.32, 0.22, 0.45), "stars": 0.9, "haze": 0.6,
		"sun_tint": Color(0.7, 0.5, 1.0), "planet_dir": Vector3(0.35, 0.42, -0.84), "planet_size": 0.24}

static func neon_night() -> Dictionary:
	var o := nexus_night()
	o.merge({"top": Color(0.03, 0.02, 0.1), "horizon": Color(0.42, 0.1, 0.42), "cloud_tint": Color(0.45, 0.18, 0.5)}, true)
	return o

static func golden_day() -> Dictionary:
	return {"top": Color(0.22, 0.4, 0.72), "horizon": Color(0.98, 0.76, 0.52), "ground": Color(0.2, 0.18, 0.16),
		"night": 0.0, "clouds": 0.55, "cloud_tint": Color(1.0, 0.92, 0.85), "haze": 0.55,
		"planet_dir": Vector3(-0.3, 0.3, -0.9), "planet_size": 0.2}
