shader_type spatial;
// Open water in a region's 3D view: deep blue-green, rolling normals, a bright glint and the reef showing through the shallows.
//
// Graphics pass (owner, Nov 11: "push for better graphics"): the ripples were one value-noise field 8 m across, which
// read as grey static from the overview and up close. Now:
//   - four directional swell / chop wave trains (long swell to short chop) plus a little noise, the short ones fading with
//     distance so the far sea is a calm, sky-reflecting sheet instead of glitter
//   - colour by real depth, from the region's height texture: clear turquoise over sand, the deep colour offshore
//   - a foam line where the water meets the land, breaking with the swell
// The sky's reflection comes from the environment (low roughness + fresnel).
render_mode cull_disabled, depth_draw_always;

uniform vec3 deep_col : source_color = vec3(0.03, 0.12, 0.2);
uniform vec3 shallow_col : source_color = vec3(0.1, 0.36, 0.42);
uniform float clarity = 0.72;
uniform sampler2D height_tex : filter_linear, repeat_disable;
uniform float has_h = 0.0;
uniform float span = 1000.0;
uniform float hn = 257.0;
uniform float water_y = 0.0;
uniform float foam = 1.0;
uniform float detail = 1.0;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

// slope (d/dx, d/dz) of one wave train: direction, wavelength (m), amplitude (m), speed factor
vec2 wave(vec2 p, vec2 dir, float len, float amp, float t) {
	float k = 6.2831 / len;
	float ph = dot(dir, p) * k + t * sqrt(9.8 * k);
	return dir * (k * amp * cos(ph));
}

void fragment() {
	float t = TIME;
	float cam_d = length(wp - CAMERA_POSITION_WORLD);
	float near = 1.0 - smoothstep(60.0, 420.0, cam_d);
	float mid = 1.0 - smoothstep(300.0, 1400.0, cam_d);
	vec2 p = wp.xz;

	vec2 g = vec2(0.0);
	g += wave(p, normalize(vec2(0.8, 0.6)), 34.0, 0.32, t) * mid;
	g += wave(p, normalize(vec2(0.3, 0.95)), 15.0, 0.14, t * 1.05) * mid;
	g += wave(p, normalize(vec2(-0.6, 0.8)), 6.5, 0.05, t * 1.1) * mix(0.3, 1.0, near);
	g += wave(p, normalize(vec2(0.95, -0.3)), 2.9, 0.018, t * 1.2) * near * detail;
	float n1 = vnoise(p * 0.35 + vec2(t * 0.3, t * 0.2));
	float n2 = vnoise(p * 0.35 + vec2(t * 0.3, t * 0.2) + vec2(0.4, 0.0));
	float n3 = vnoise(p * 0.35 + vec2(t * 0.3, t * 0.2) + vec2(0.0, 0.4));
	g += vec2(n2 - n1, n3 - n1) * 0.35 * near * detail;
	vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);

	// depth under the surface from the ground heights (open sea beyond the map: deep)
	float depth = 40.0;
	if (has_h > 0.5) {
		vec2 uv = p / span + 0.5;
		if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
			float gh = texture(height_tex, (uv * (hn - 1.0) + 0.5) / hn).r;
			depth = water_y - gh;
		}
	}
	float dk = smoothstep(0.0, 9.0, depth);
	vec3 col = mix(shallow_col * 1.1, deep_col, dk);
	// a hint of sand colour through the very shallow water
	col = mix(col, vec3(0.55, 0.5, 0.38), (1.0 - smoothstep(0.0, 1.0, depth)) * 0.2);

	// surf: a foam line at the shore pulsing with the swell, broken up by noise
	float swell = 0.5 + 0.5 * sin(dot(p, normalize(vec2(0.8, 0.6))) * 0.185 + t * 0.75);
	float fn = vnoise(p * 0.6 + t * 0.15) * 0.6 + vnoise(p * 1.7 - t * 0.2) * 0.4;
	float band = 1.0 - smoothstep(0.0, 0.25 + swell * 0.45, depth);
	float surf = smoothstep(0.5, 0.85, band * (0.45 + fn * 0.8)) * 0.85 * foam * step(-0.2, depth) * mid;

	ALBEDO = mix(col, vec3(0.92, 0.95, 0.96), surf);
	ROUGHNESS = mix(0.04, 0.6, surf);
	METALLIC = 0.0;
	SPECULAR = 0.6;
	ALPHA = clamp(mix(mix(clarity * 0.75, 0.97, dk), 0.98, fres) + surf, 0.0, 1.0);
}
