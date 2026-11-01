shader_type spatial;
// Buildings in a region's 3D view: walls of floors and windows (3.2 m storeys, 2.6 m bays) laid out in metres along each face
// (UV), the roof flat (COLOR.a = 1). Windows light up at night, warm in houses and towns, cyan and magenta in Neon City.
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

varying float seed;
void vertex() { seed = UV2.x; }
void fragment() {
	vec3 base = COLOR.rgb;
	if (COLOR.a > 0.5) {
		ALBEDO = base * 0.82;
		ROUGHNESS = 0.9;
	} else {
		vec2 cell = floor(UV / vec2(2.6, 3.2));
		vec2 f = fract(UV / vec2(2.6, 3.2));
		bool win = f.x > 0.18 && f.x < 0.82 && f.y > 0.3 && f.y < 0.82 && UV.y > 2.4;
		float r = hash2(cell + seed * 17.0);
		float tint = hash2(cell + seed * 29.0);
		float blind = step(0.76, hash2(cell + seed * 53.0));
		vec3 c = base;
		float grime = hash2(vec2(floor(UV.x * 1.5), seed)) * 0.12 + smoothstep(6.0, 0.0, UV.y) * 0.1;
		// Per-floor dirt streaks and a subtle variation in panel tone.
		float floor_dirt = 1.0 - smoothstep(0.0, 0.22, f.y);
		float vertical_streak = hash2(vec2(floor(UV.x * 3.0), seed + 7.0));
		c *= 1.0 - grime * facade_weathering;
		c *= 1.0 - facade_weathering * floor_dirt * 0.085;
		c *= 1.0 - facade_weathering * vertical_streak * 0.035;
		if (win) {
			float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
			c = mix(vec3(0.11, 0.17, 0.22), vec3(0.42, 0.53, 0.64), fres * (1.0 - night) * window_reflection) * mix(1.0, 0.35, night);
			c *= mix(0.78, 1.12, tint);
			// Interior blinds and frame shadow make flat window rectangles less uniform.
			c *= 1.0 - blind * 0.28;
			float reveal = min(min(f.x - 0.18, 0.82 - f.x), min(f.y - 0.3, 0.82 - f.y));
			c *= mix(1.0, smoothstep(0.0, 0.065, reveal) * 0.28 + 0.72, facade_detail);
			float lit = step(1.0 - mix(0.0, 0.38, night), r) * (1.0 - blind * 0.75);
			vec3 warm = vec3(1.0, 0.72, 0.42), cool = r > 0.8 ? vec3(1.0, 0.25, 0.75) : vec3(0.25, 0.85, 1.0);
			EMISSION = mix(warm, cool, neon) * lit * window_light_strength * night;
			ROUGHNESS = 0.12;
			METALLIC = 0.3;
		} else {
			ROUGHNESS = 0.82;
			// floor slab lines
			if (f.y < 0.06) c *= 0.68;
			// Shadowed lintels and vertical mullions, aligned to existing metre-scale UVs.
			float jamb = min(abs(f.x - 0.18), abs(f.x - 0.82));
			float lintel = min(abs(f.y - 0.3), abs(f.y - 0.82));
			float frame = 1.0 - step(0.035, min(jamb, lintel));
			c *= 1.0 - facade_detail * frame * 0.14;
		}
		ALBEDO = c;
	}
}
