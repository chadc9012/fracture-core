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
// Nov 22 (owner: "next step without Meshy"): facade styles in the shader, no new models. town = half-timbered market
// town (Old Harrow, Goldenreach): plaster between dark beams, small paned windows with shutters, a stone footing.
// rust = scrap-built Wastelands / Ember outposts: corrugated sheet, rust blooms, few and boarded windows.
uniform float town = 0.0;
uniform float rust = 0.0;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }

varying float seed;
void vertex() { seed = UV2.x; }
void fragment() {
	vec3 base = COLOR.rgb;
	if (COLOR.a > 0.5) {
		ALBEDO = base * 0.82;
		ROUGHNESS = 0.9;
	} else if (town > 0.5) {
		vec2 cell = floor(UV / vec2(2.6, 3.2));
		vec2 f = fract(UV / vec2(2.6, 3.2));
		float r = hash2(cell + seed * 17.0);
		float pick = hash2(cell + seed * 41.0);
		vec3 c = base * (0.92 + 0.12 * hash2(floor(UV * vec2(3.0, 2.0)) + seed));       // patchy limewash
		c *= 1.0 - smoothstep(1.6, 0.0, UV.y) * 0.18 - hash2(vec2(floor(UV.x * 2.0), seed)) * 0.06;
		vec3 beam = vec3(0.16, 0.11, 0.08) * (0.85 + 0.3 * hash2(floor(UV * 9.0)));
		bool has_win = pick > 0.3 && UV.y > 3.2 || (pick > 0.55 && UV.y > 1.0);
		bool win = has_win && f.x > 0.32 && f.x < 0.68 && f.y > 0.34 && f.y < 0.76;
		bool shutter = has_win && f.y > 0.34 && f.y < 0.76 && ((f.x > 0.2 && f.x <= 0.32) || (f.x >= 0.68 && f.x < 0.8));
		// the frame: posts at the bay lines, rails at the floors, a brace across the blank bays
		float post = step(f.x, 0.055) + step(0.945, f.x);
		float rail = step(f.y, 0.07) + step(0.93, f.y);
		float brace = (!has_win && pick < 0.16) ? step(abs(f.y - (pick < 0.08 ? f.x : 1.0 - f.x)), 0.045) : 0.0;
		ROUGHNESS = 0.9;
		if (UV.y < 0.9) {
			// a stone footing: coursed blocks
			vec2 st = UV * vec2(1.6, 3.4) + vec2(floor(UV.y * 3.4) * 0.5, 0.0);
			c = vec3(0.42, 0.40, 0.37) * (0.75 + 0.35 * hash2(floor(st) + seed));
			vec2 sf = fract(st);
			c *= 1.0 - 0.35 * step(min(sf.x, sf.y), 0.07);
		} else if (win) {
			// small panes behind a cross of glazing bars
			vec2 wf = vec2((f.x - 0.32) / 0.36, (f.y - 0.34) / 0.42);
			float bars = step(abs(wf.x - 0.5), 0.04) + step(abs(wf.y - 0.5), 0.035) + step(min(min(wf.x, 1.0 - wf.x), min(wf.y, 1.0 - wf.y)), 0.07);
			float lit = step(1.0 - mix(0.0, 0.85, night), r);
			c = mix(vec3(0.10, 0.13, 0.16), beam, min(bars, 1.0));
			EMISSION = vec3(1.0, 0.66, 0.32) * lit * (1.0 - min(bars, 1.0)) * (0.6 + 0.6 * hash2(cell + 3.0)) * min(night * 3.0, 1.4);
			ROUGHNESS = 0.2;
		} else if (shutter) {
			vec3 paint = pick > 0.7 ? vec3(0.22, 0.33, 0.28) : (pick > 0.5 ? vec3(0.36, 0.17, 0.14) : vec3(0.20, 0.25, 0.36));
			c = paint * (0.8 + 0.25 * step(0.5, fract(f.y * 14.0)));
		} else if (post + rail + brace > 0.5) {
			c = beam;
		}
		ALBEDO = c;
	} else if (rust > 0.5) {
		vec2 cell = floor(UV / vec2(2.6, 3.2));
		vec2 f = fract(UV / vec2(2.6, 3.2));
		float r = hash2(cell + seed * 17.0);
		// corrugated sheet in mismatched panels, rust blooming from the seams and running down from the fixings
		float panel = hash2(vec2(floor(UV.x / 1.3), floor(UV.y / 2.4)) + seed * 7.0);
		vec3 c = mix(base, vec3(0.42, 0.44, 0.45), 0.45) * (0.7 + 0.45 * panel);
		c *= 0.86 + 0.14 * sin(UV.x * 26.0);
		float n1 = hash2(floor(UV * 2.3) + seed);
		float n2 = hash2(floor(UV * 5.1) + seed * 3.0);
		float bloom = smoothstep(0.55, 0.95, n1 * 0.6 + n2 * 0.4 + (1.0 - fract(UV.y / 2.4)) * 0.25);
		c = mix(c, vec3(0.36, 0.17, 0.08) * (0.7 + 0.5 * n2), bloom * 0.85);
		c *= 1.0 - 0.3 * step(fract(UV.y / 2.4), 0.03) - 0.25 * step(fract(UV.x / 1.3), 0.03);   // panel seams
		bool win = r > 0.72 && f.x > 0.25 && f.x < 0.75 && f.y > 0.4 && f.y < 0.75 && UV.y > 2.4;
		ROUGHNESS = 0.75;
		METALLIC = 0.35 * (1.0 - bloom);
		if (win) {
			float boarded = step(0.86, r);
			float lit = step(1.0 - mix(0.0, 0.6, night), hash2(cell + seed * 5.0)) * (1.0 - boarded);
			c = mix(vec3(0.07, 0.08, 0.09), vec3(0.30, 0.22, 0.14) * (0.8 + 0.3 * step(0.5, fract(f.y * 9.0))), boarded);
			EMISSION = vec3(1.0, 0.55, 0.22) * lit * night * 1.2;
			METALLIC = 0.0;
		}
		ALBEDO = c;
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
			// warm rooms and cool-white offices everywhere; Neon City adds a share of cyan / magenta panes (the boards'
			// towers are mostly warm and white windows with the neon as the accent, not all neon)
			vec3 warm = tint > 0.62 ? vec3(0.85, 0.9, 1.0) : vec3(1.0, 0.72, 0.42);
			vec3 cool = r > 0.8 ? vec3(1.0, 0.25, 0.75) : vec3(0.25, 0.85, 1.0);
			float neon_pane = step(1.0 - neon * 0.3, hash2(cell + seed * 71.0));
			EMISSION = mix(warm, cool, neon_pane) * lit * window_light_strength * night;
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
