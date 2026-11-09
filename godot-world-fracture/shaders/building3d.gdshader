shader_type spatial;
// Buildings in a region's 3D view: walls of floors and windows (3.2 m storeys, 2.6 m bays) laid out in metres along each face
// (UV), the roof flat (COLOR.a = 1). Windows light up at night, warm in houses and towns, cyan and magenta in Neon City.
//
// Anti-aliased (owner, Nov 9: "it looks pixelated"): window edges, slab lines and frames are filtered by their on-screen
// size (fwidth), and once a storey is only a few pixels tall the per-window pattern (which lit, which blinds, tints, grime
// stripes) fades to its average — an even glow of the same brightness — instead of a field of flickering single pixels.
render_mode cull_back;

uniform float night = 0.0;
uniform float neon = 0.0;
// Pass 15: facade depth cues without additional draw calls.
uniform float facade_detail = 1.0;
// Batch update 4: art-direction controls, no new texture dependencies.
uniform float facade_weathering : hint_range(0.0, 1.0) = 0.45;
uniform float window_reflection : hint_range(0.0, 1.0) = 0.55;
uniform float window_light_strength : hint_range(0.0, 2.0) = 0.85;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
// a filtered 0..1 band: 1 between a and b, edges softened over w
float band(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }

varying float seed;
void vertex() { seed = UV2.x; }
void fragment() {
	vec3 base = COLOR.rgb;
	if (COLOR.a > 0.5) {
		ALBEDO = base * 0.82;
		ROUGHNESS = 0.9;
	} else {
		vec2 g = UV / vec2(2.6, 3.2);
		vec2 cell = floor(g);
		vec2 f = fract(g);
		// how big one bay / storey is on screen: fw ~ cells per pixel
		vec2 fw = max(fwidth(g), vec2(1e-4));
		// 1 while a storey spans 4+ pixels, 0 once it is under ~2
		float detail = 1.0 - smoothstep(0.25, 0.5, max(fw.x, fw.y));
		float ground = smoothstep(2.2, 2.6, UV.y);
		float win_near = band(f.x, 0.18, 0.82, fw.x) * band(f.y, 0.3, 0.82, fw.y);
		// far away: the window's share of the wall (0.64 x 0.52)
		float win = mix(0.333, win_near, detail) * ground;

		float r = hash2(cell + seed * 17.0);
		float tint = mix(0.5, hash2(cell + seed * 29.0), detail);
		float blind = step(0.76, hash2(cell + seed * 53.0)) * detail + 0.24 * (1.0 - detail);

		// the wall
		vec3 wall = base;
		float grime = mix(0.06, hash2(vec2(floor(UV.x * 1.5), seed)) * 0.12, detail) + smoothstep(6.0, 0.0, UV.y) * 0.1;
		float floor_dirt = (1.0 - smoothstep(0.0, 0.22, f.y)) * detail + 0.11 * (1.0 - detail);
		float vertical_streak = mix(0.5, hash2(vec2(floor(UV.x * 3.0), seed + 7.0)), detail);
		wall *= 1.0 - grime * facade_weathering;
		wall *= 1.0 - facade_weathering * floor_dirt * 0.085;
		wall *= 1.0 - facade_weathering * vertical_streak * 0.035;
		// floor slab lines and the shadowed lintels / mullions, filtered, and gone once they would be sub-pixel
		float slab = 1.0 - band(f.y, 0.06, 1.0, fw.y);
		wall *= 1.0 - 0.32 * slab * detail;
		float jamb = min(abs(f.x - 0.18), abs(f.x - 0.82));
		float lintel = min(abs(f.y - 0.3), abs(f.y - 0.82));
		float frame = 1.0 - smoothstep(0.035 - fw.x, 0.035 + fw.x, min(jamb, lintel));
		wall *= 1.0 - facade_detail * frame * 0.14 * detail;

		// the glass
		float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
		vec3 glass = mix(vec3(0.11, 0.17, 0.22), vec3(0.42, 0.53, 0.64), fres * (1.0 - night) * window_reflection) * mix(1.0, 0.35, night);
		glass *= mix(0.78, 1.12, tint);
		glass *= 1.0 - blind * 0.28;
		float reveal = min(min(f.x - 0.18, 0.82 - f.x), min(f.y - 0.3, 0.82 - f.y));
		glass *= mix(1.0, mix(1.0, smoothstep(0.0, 0.065, reveal) * 0.28 + 0.72, detail), facade_detail);

		// which windows are lit: per window up close, the lit share (38% at night, less the blinds) far away
		float share = mix(0.0, 0.38, night);
		float lit_one = step(1.0 - share, r) * (1.0 - blind * 0.75);
		float lit = mix(share * (1.0 - 0.24 * 0.75), lit_one, detail);
		vec3 warm = vec3(1.0, 0.72, 0.42);
		vec3 cool_one = r > 0.8 ? vec3(1.0, 0.25, 0.75) : vec3(0.25, 0.85, 1.0);
		vec3 cool = mix(vec3(0.62, 0.55, 0.88), cool_one, detail);

		ALBEDO = mix(wall, glass, win);
		EMISSION = mix(warm, cool, neon) * lit * window_light_strength * night * win;
		ROUGHNESS = mix(0.82, 0.12, win);
		METALLIC = 0.3 * win;
	}
}
