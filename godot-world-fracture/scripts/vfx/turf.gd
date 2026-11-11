extends RefCounted
## Grass for flat venues (race circuits, parks, sports fields): world-mapped colour variation in two scales, darker
## clumps, a fine blade grain in the normal and, for a kept venue, the mower's stripes. One flat colour read as a
## plastic sheet next to the authored cars; this reads as turf from the chase camera.
##
##   box.material_override = Turf.material({"stripes": 8.0})   # stripe width in metres; 0 for wild grass

const SHADER := """
shader_type spatial;
uniform vec3 base : source_color = vec3(0.24, 0.38, 0.15);
uniform vec3 dry : source_color = vec3(0.42, 0.45, 0.22);
uniform vec3 dark : source_color = vec3(0.12, 0.22, 0.09);
uniform float stripes = 0.0;
uniform float stripe_dir = 0.0;
varying vec3 wpos;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz;
	float big = noise(p * 0.02) * 0.6 + noise(p * 0.07) * 0.4;
	float clump = noise(p * 0.6) * 0.5 + noise(p * 2.3) * 0.5;
	vec3 c = mix(base, dry, smoothstep(0.45, 0.85, big) * 0.6);
	c = mix(c, dark, smoothstep(0.55, 0.9, clump) * 0.35);
	if (stripes > 0.0) {
		vec2 dir = vec2(cos(stripe_dir), sin(stripe_dir));
		float s = step(0.5, fract(dot(p, dir) / (stripes * 2.0)));
		c *= mix(0.86, 1.08, s);
	}
	ALBEDO = c;
	ROUGHNESS = 0.92;
	SPECULAR = 0.25;
	// blade grain: a fine noise tilt so the sun picks out the texture
	float gx = noise(p * 9.0) - noise(p * 9.0 + vec2(0.13, 0.0));
	float gz = noise(p * 9.0) - noise(p * 9.0 + vec2(0.0, 0.13));
	NORMAL_MAP = normalize(vec3(gx * 3.0, gz * 3.0, 1.0)) * 0.5 + 0.5;
}
"""

static var _shader: Shader

static func material(o := {}) -> ShaderMaterial:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("base", o.get("base", Color(0.24, 0.38, 0.15)))
	m.set_shader_parameter("dry", o.get("dry", Color(0.42, 0.45, 0.22)))
	m.set_shader_parameter("dark", o.get("dark", Color(0.12, 0.22, 0.09)))
	m.set_shader_parameter("stripes", o.get("stripes", 0.0))
	m.set_shader_parameter("stripe_dir", o.get("stripe_dir", 0.0))
	return m
