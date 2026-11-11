shader_type spatial;
// Curtain-wall glass for the landmark towers (Core Spire, Neon City Grand Casino). Owner, Nov 10: "Fix glass windows".
// The old material was a 128 px window texture mapped triplanar in world space: on the round shafts and the casino's
// flared crown it smeared into brown checkers and blocky stripes. This draws the windows in the shader instead:
//   - bays run around the shaft (angle x radius about the part's own centre, so a cylinder wraps evenly), storeys by height
//   - every edge is anti-aliased by its on-screen size, and once a storey is a few pixels tall the per-window pattern
//     fades to its average glow instead of shimmering
//   - dark reflective glass (fresnel sky tint, low roughness) between slim mullions and darker spandrel bands
//   - lit rooms per window from a hash, at a few brightness steps, brighter under the ceiling
//   - flat tops and undersides stay plain glass
render_mode cull_back;

uniform vec3 lit_col : source_color = vec3(1.0, 0.7, 0.48);
uniform vec3 glass_col : source_color = vec3(0.07, 0.06, 0.13);
uniform float energy = 0.45;
uniform float bay = 3.2;
uniform float storey = 4.2;
uniform float lit_share = 0.46;
uniform vec3 sky_col : source_color = vec3(0.42, 0.5, 0.72);

varying vec3 wp;
varying vec3 wn;
varying vec3 org;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float band(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	org = MODEL_MATRIX[3].xyz;
}

void fragment() {
	vec3 d = wp - org;
	float r = max(length(d.xz), 0.5);
	// two angles with their wrap on opposite sides, so the derivative never sees the jump at +-pi
	float a1 = atan(d.z, d.x);
	float a2 = atan(-d.z, -d.x);
	float u = a1 * r / bay;
	float v = wp.y / storey;
	float fwu = max(min(fwidth(a1), fwidth(a2)) * r / bay, 1e-4);
	float fwv = max(fwidth(v), 1e-4);
	vec2 cell = floor(vec2(u, v));
	vec2 f = fract(vec2(u, v));
	float detail = 1.0 - smoothstep(0.22, 0.5, max(fwu, fwv));
	float seed = hash2(floor(org.xz * 0.37) + floor(org.y));

	// faces: walls get windows, roofs and undersides plain glass
	float side = 1.0 - smoothstep(0.6, 0.85, abs(wn.y));
	// a slim mullion splits each bay into two panes
	float mull = smoothstep(0.012 - fwu, 0.012 + fwu, abs(f.x - 0.5));
	float win_near = band(f.x, 0.05, 0.95, fwu) * band(f.y, 0.24, 0.94, fwv) * mix(1.0, mull, detail);
	float win = mix(0.62, win_near, detail) * side;

	// reflective glass: the sky in the fresnel, a slight per-pane tint so the wall isn't one flat sheet
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	float pane = mix(0.5, hash2(cell + seed * 41.0), detail);
	vec3 glass = glass_col * mix(0.85, 1.2, pane) + sky_col * (0.08 + 0.55 * fres);
	vec3 spandrel = glass_col * 0.55 + sky_col * 0.04 * fres;

	// lit rooms
	// rooms light in runs of a few bays along a floor (offices, suites), not as a checkerboard
	vec2 run = vec2(floor(cell.x / 3.0 + hash2(vec2(cell.y, seed)) * 3.0), cell.y);
	float h = mix(hash2(run + seed * 17.0), hash2(cell + seed * 19.0), 0.25);
	float step_b = 0.75 + 0.25 * hash2(run + seed * 23.0);
	float ceiling = mix(1.0, 0.7, smoothstep(0.94, 0.24, f.y) * detail);
	float lit_one = step(1.0 - lit_share, h) * step_b * ceiling;
	float lit = mix(lit_share * 0.78, lit_one, detail);
	vec3 col = mix(lit_col, lit_col * vec3(0.85, 0.95, 1.15), step(0.85, hash2(cell + seed * 7.0)) * detail);

	ALBEDO = mix(spandrel, glass, win);
	METALLIC = mix(0.25, 0.55, win);
	ROUGHNESS = mix(0.55, 0.06, win);
	SPECULAR = 0.7;
	EMISSION = col * lit * energy * win;
}
