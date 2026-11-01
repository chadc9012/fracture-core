shader_type spatial;
// Open water in a region's 3D view: deep blue-green, rolling normals, a bright glint and the reef showing through the shallows.
render_mode cull_disabled, depth_draw_always;

uniform vec3 deep_col : source_color = vec3(0.03, 0.12, 0.2);
uniform vec3 shallow_col : source_color = vec3(0.1, 0.36, 0.42);
uniform float clarity = 0.72;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz * 0.12;
	float t = TIME * 0.35;
	float h1 = vnoise(p + vec2(t, t * 0.6)), h2 = vnoise(p * 2.3 - vec2(t * 0.8, t));
	vec3 n = normalize(vec3((h1 - 0.5) * 0.6 + (h2 - 0.5) * 0.3, 1.0, (h2 - 0.5) * 0.6 - (h1 - 0.5) * 0.3));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = mix(shallow_col, deep_col, 0.55 + fres * 0.45);
	ROUGHNESS = 0.06;
	METALLIC = 0.0;
	SPECULAR = 0.7;
	ALPHA = mix(clarity, 0.97, fres);
}
