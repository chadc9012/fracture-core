shader_type spatial;
// Open water in a region's 3D view (owner, Nov 23: "make … water look real"): four layers of travelling wave normals
// (long swell, chop, ripples, a fine sparkle), colour by real depth (the depth buffer: clear shallows showing the bed,
// deep water dark), white foam where the water meets the shore and round anything standing in it, the sky reflected
// by Fresnel, and a sharp sun glint from the engine's own light (low roughness on the wave normals).
render_mode cull_disabled, depth_draw_never;   // never: the depth texture must hold what is behind the water, not the water

uniform vec3 deep_col : source_color = vec3(0.03, 0.12, 0.2);
uniform vec3 shallow_col : source_color = vec3(0.1, 0.36, 0.42);
uniform vec3 sky_col : source_color = vec3(0.55, 0.68, 0.82);
uniform float clarity = 0.72;
uniform float foam = 1.0;
uniform float wave = 1.0;          // calmer lakes and bog pools set it lower
uniform sampler2D depth_tex : hint_depth_texture, filter_linear;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
// slope of a travelling noise layer (finite differences) — its contribution to the wave normal
vec2 slope(vec2 p, vec2 drift, float sc) {
	vec2 q = p * sc + drift;
	float e = 0.15;
	float c = vnoise(q);
	return vec2(vnoise(q + vec2(e, 0.0)) - c, vnoise(q + vec2(0.0, e)) - c) / e;
}
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	float t = TIME;
	vec2 p = wp.xz;
	vec2 g = slope(p, vec2(t * 0.05, t * 0.03), 0.035) * 0.55 * wave       // swell
		+ slope(p, vec2(-t * 0.16, t * 0.11), 0.16) * 0.32 * wave            // chop
		+ slope(p, vec2(t * 0.42, -t * 0.35), 0.62) * 0.16                   // ripples
		+ slope(p, vec2(-t * 0.9, -t * 0.7), 2.3) * 0.05;                    // sparkle
	vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	// how much water lies between the surface and what is behind it
	float depth_raw = texture(depth_tex, SCREEN_UV).r;
#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
	vec4 ndc = vec4(SCREEN_UV * 2.0 - 1.0, depth_raw * 2.0 - 1.0, 1.0);
#else
	vec4 ndc = vec4(SCREEN_UV * 2.0 - 1.0, depth_raw, 1.0);
#endif
	vec4 world_behind = INV_PROJECTION_MATRIX * ndc;
	float behind = -world_behind.z / world_behind.w;
	float here = -VERTEX.z;
	float thick = clamp(behind - here, 0.0, 200.0);
	// the depth buffer is empty past the far plane (open sea): treat that as deep
	if (depth_raw <= 0.00001 || depth_raw >= 0.99999) { thick = 200.0; }
	float deep = 1.0 - exp(-thick * 0.18);
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	vec3 body = mix(shallow_col * 1.15, deep_col, deep);
	vec3 c = mix(body, sky_col, clamp(fres * 0.6, 0.0, 0.6));
	// foam: a broken band along the shore, and on the crests in deep water a few flecks
	float band = 1.0 - smoothstep(0.0, 1.4, thick);
	float broken = smoothstep(0.35, 0.75, vnoise(p * 1.4 + vec2(t * 0.3, -t * 0.2)) + band * 0.5);
	float crest = smoothstep(0.82, 0.95, vnoise(p * 0.22 + vec2(t * 0.08, t * 0.05))) * smoothstep(0.6, 1.0, deep) * 0.35;
	float f = clamp(band * broken + crest * wave, 0.0, 1.0) * foam;
	c = mix(c, vec3(0.92, 0.95, 0.97), f);
	ALBEDO = c;
	ROUGHNESS = mix(0.035, 0.6, f);
	METALLIC = 0.0;
	SPECULAR = mix(0.75, 0.2, f);
	// clear in the shallows (the bed shows), opaque in the deep, at grazing angles and in foam
	ALPHA = clamp(mix(clarity * mix(0.35, 1.0, deep), 0.98, max(fres, f)), 0.0, 1.0);
}
