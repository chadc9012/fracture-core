shader_type spatial;
// The ground of a region's 3D view: coloured from the map's baked data (R the land cover) with the satellite palette, lit by
// the scene, with close-up grain, forest crowns, dune ripples, glowing lava and crystal, and wet city streets at night. World
// metres drive the noise so it never swims.
//
// Graphics pass (owner, Nov 11: "push for better graphics"): the ground used to be lit by the grid's vertex normals (one
// every ~7 m) and coloured flat per cover, which read as smooth plastic blobs from the overview camera. Now:
//   - per-pixel normals from a height texture (bicubic-smooth slopes instead of facets) plus a small detail relief per
//     cover (rocky ground, dune ripples, snow drifts) that fades with distance so it never shimmers
//   - slopes turn to bare rock with height strata; hollows darken and ridges catch light (a cavity term from the heights)
//   - large-scale colour patches so a desert or an ice cap is not one flat tone; damp, darker ground at the waterline
//   - bright covers (sand, snow) are rolled off before the tone mapper so they keep their texture instead of clipping
// `detail` is the graphics tier (0 low: palette, slopes and patches only).
render_mode cull_back;

uniform sampler2D data_tex : filter_nearest, repeat_disable;
uniform sampler2D height_tex : filter_linear, repeat_disable;
uniform vec3 pal[32];
uniform vec4 bounds = vec4(0.0, 0.0, 1000.0, 0.0); // x0, z0, span (world metres)
uniform float hn = 257.0;      // grid points per side of height_tex
uniform float water_y = -10000.0;
uniform float wet = 0.0; // night rain in the cities
uniform float detail = 1.0;
uniform int i_forest; uniform int i_dense; uniform int i_marsh; uniform int i_meadow; uniform int i_grass; uniform int i_scrub;
uniform int i_desert; uniform int i_dunes; uniform int i_sandstone; uniform int i_wash; uniform int i_lava; uniform int i_magma;
uniform int i_urban; uniform int i_paved; uniform int i_town; uniform int i_snow; uniform int i_ice; uniform int i_crystal; uniform int i_rift;

varying vec2 wpos;
varying vec3 vw;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 11.0) * 0.3 + vnoise(p * 4.1 + 37.0) * 0.15; }

// height texture lookup at a grid uv (0..1 across the mesh), in metres
float hgt(vec2 uv) { return texture(height_tex, (uv * (hn - 1.0) + 0.5) / hn).r; }

void vertex() {
	wpos = bounds.xy + UV * bounds.z;
	vw = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	// dither the lookup by a texel so cover edges read as ragged ground, not pixels (the index itself must stay exact)
	vec2 texel = 1.0 / vec2(textureSize(data_tex, 0));
	vec2 j = vec2(vnoise(wpos * 0.9), vnoise(wpos * 0.9 + 17.0)) - 0.5;
	int cover = int(round(texture(data_tex, UV + j * texel * 1.6).r * 255.0));
	vec3 c = pal[clamp(cover, 0, 31)];
	vec2 w = wpos;
	float grain = hash2(floor(w * 3.0)) - 0.5;
	float rough = 0.92;
	vec3 emit = vec3(0.0);
	float cam_d = length(vw - CAMERA_POSITION_WORLD);
	// 1 near the camera, 0 past ~350 m: the small relief and grain fade before they would be sub-pixel
	float near = (1.0 - smoothstep(120.0, 350.0, cam_d)) * detail;

	bool city = cover == i_urban || cover == i_paved || cover == i_town;
	bool hot = cover == i_lava || cover == i_magma || cover == i_crystal || cover == i_rift;
	bool sand = cover == i_desert || cover == i_dunes || cover == i_sandstone || cover == i_wash;
	bool cold = cover == i_snow || cover == i_ice;
	bool green = cover == i_forest || cover == i_dense || cover == i_marsh || cover == i_meadow || cover == i_grass || cover == i_scrub;

	// --- the shape of the ground: per-pixel slope from the heights, plus detail relief
	float cell = bounds.z / (hn - 1.0);
	float du = 1.0 / (hn - 1.0);
	float h0 = hgt(UV);
	float hx = hgt(UV + vec2(du, 0.0)) - hgt(UV - vec2(du, 0.0));
	float hz = hgt(UV + vec2(0.0, du)) - hgt(UV - vec2(0.0, du));
	vec3 nw = normalize(vec3(-hx / (2.0 * cell), 1.0, -hz / (2.0 * cell)));
	float slope = 1.0 - nw.y;

	// hollows and ridges: the height against its neighbourhood about 3 cells out
	float ring = (hgt(UV + vec2(3.0 * du, 0.0)) + hgt(UV - vec2(3.0 * du, 0.0)) + hgt(UV + vec2(0.0, 3.0 * du)) + hgt(UV - vec2(0.0, 3.0 * du))) * 0.25;
	float cav = clamp((h0 - ring) / 6.0, -1.0, 1.0) * detail;

	// detail relief, two scales, its gradient bent into the normal: landforms of 15-40 m (dunes, drifts, hummocks, rock
	// outcrops) that read from the overview camera, and fine grain up close. Each fades before it would be sub-pixel.
	float mid = (1.0 - smoothstep(700.0, 1600.0, cam_d)) * detail;
	float amp_m = 0.0;
	float amp_f = 0.0;
	float fq_m = 0.04;
	float fq_f = 0.45;
	if (sand) { amp_m = 0.7; fq_m = 0.03; amp_f = 0.3; fq_f = 0.22; }
	else if (cold) { amp_m = 0.45; fq_m = 0.035; amp_f = 0.22; fq_f = 0.15; }
	else if (green) { amp_m = 0.3; fq_m = 0.05; amp_f = 0.3; fq_f = 0.5; }
	else if (!city && !hot) { amp_m = 0.55; fq_m = 0.05; amp_f = 0.5; fq_f = 0.45; }
	amp_m *= mid;
	amp_f *= near;
	vec3 bump = vec3(0.0);
	if (amp_m > 0.001) {
		float e = 2.0;
		vec2 q = w * fq_m;
		float d0, dx, dz;
		if (sand) {
			// dunes: wind-bent crests, the slip face steeper than the windward side
			float bend = vnoise(w * 0.006) * 5.0;
			d0 = pow(0.5 + 0.5 * sin(q.x * 1.0 + q.y * 0.55 + bend), 1.6) + fbm(q * 0.7) * 0.5;
			dx = pow(0.5 + 0.5 * sin((q.x + e * fq_m) * 1.0 + q.y * 0.55 + bend), 1.6) + fbm((q + vec2(e * fq_m, 0.0)) * 0.7) * 0.5;
			dz = pow(0.5 + 0.5 * sin(q.x * 1.0 + (q.y + e * fq_m) * 0.55 + bend), 1.6) + fbm((q + vec2(0.0, e * fq_m)) * 0.7) * 0.5;
		} else {
			d0 = fbm(q);
			dx = fbm(q + vec2(e * fq_m, 0.0));
			dz = fbm(q + vec2(0.0, e * fq_m));
		}
		bump += vec3(-(dx - d0), 0.0, -(dz - d0)) * amp_m * 3.0;
		cav += (d0 - 0.5) * 0.5 * mid;
	}
	if (amp_f > 0.001) {
		float e = 0.6;
		vec2 q = w * fq_f;
		float d0, dx, dz;
		if (sand) {
			float bend = vnoise(w * 0.02) * 6.0;
			d0 = sin(q.x * 2.4 + q.y * 1.3 + bend) + vnoise(q * 3.0) * 0.6;
			dx = sin((q.x + e * fq_f) * 2.4 + q.y * 1.3 + bend) + vnoise((q + vec2(e * fq_f, 0.0)) * 3.0) * 0.6;
			dz = sin(q.x * 2.4 + (q.y + e * fq_f) * 1.3 + bend) + vnoise((q + vec2(0.0, e * fq_f)) * 3.0) * 0.6;
		} else {
			d0 = fbm(q);
			dx = fbm(q + vec2(e * fq_f, 0.0));
			dz = fbm(q + vec2(0.0, e * fq_f));
		}
		bump += vec3(-(dx - d0) / e, 0.0, -(dz - d0) / e) * amp_f;
	}
	nw = normalize(nw + bump);
	slope = max(slope, 1.0 - nw.y * 0.97);
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);

	// --- colour per cover (the original look)
	if (cover == i_forest || cover == i_dense || cover == i_marsh) {
		float crown = vnoise(w * 0.8);
		c += vec3(0.7, 1.0, 0.5) * ((crown - 0.5) * 40.0 + grain * 10.0 * near) / 255.0;
		if (crown < 0.3) c *= 0.72;
	} else if (cover == i_meadow || cover == i_grass || cover == i_scrub) {
		c += (vec3(22.0, 24.0, 10.0) * (vnoise(w * 0.06) - 0.5) + vec3(14.0, 14.0, 8.0) * grain * near) / 255.0;
		// dry and lush patches
		c = mix(c, c * vec3(1.12, 1.04, 0.78), smoothstep(0.55, 0.8, fbm(w * 0.012)) * 0.6);
	} else if (sand) {
		float rip = sin(w.x * 0.5 + w.y * 0.3 + vnoise(w * 0.03) * 8.0);
		c += (vec3(8.0, 6.0, 4.0) * rip + vec3(12.0, 10.0, 8.0) * grain) * near / 255.0;
	} else if (cover == i_lava || cover == i_magma) {
		// a lava flow: cooled crust plates drifting downstream, molten seams glowing between them, the seams breathing
		vec2 fl = w * 0.14 + vec2(TIME * 0.025, TIME * 0.04);
		float seam = 1.0 - abs(vnoise(fl + vnoise(w * 0.05) * 2.0) * 2.0 - 1.0);
		float v = 1.0 - abs(vnoise(w * 0.18 + TIME * 0.03) * 2.0 - 1.0);
		float breathe = 0.85 + 0.15 * sin(TIME * 1.3 + vnoise(w * 0.02) * 6.0);
		float k = cover == i_magma ? 1.0 : max(smoothstep(0.8, 0.97, seam), smoothstep(0.86, 0.99, v)) * breathe;
		vec3 crust = vec3(0.12, 0.08, 0.07) * (0.8 + 0.4 * vnoise(fl * 3.0));
		c = mix(crust, vec3(1.0, 0.6, 0.2), k);
		emit = mix(vec3(0.9, 0.22, 0.05), vec3(1.0, 0.42, 0.1), k) * k * 2.4;
	} else if (cover == i_crystal) {
		float sp = vnoise(w * 1.3);
		emit = vec3(0.55, 0.35, 1.0) * smoothstep(0.7, 0.95, sp) * 1.2;
		rough = 0.35;
	} else if (cover == i_rift) {
		float k = 1.0 - abs(vnoise(w * 0.25 + TIME * 0.05) * 2.0 - 1.0);
		emit = vec3(0.6, 0.2, 1.0) * k * 1.6;
	} else if (city) {
		c += vec3(10.0) / 255.0 * grain * near;
		rough = mix(0.85, 0.18, wet);
		c *= mix(1.0, 0.55, wet);
	} else if (cold) {
		rough = 0.55;
		c += vec3(6.0) / 255.0 * grain * near;
		// blue in the hollows, wind-scoured grey-blue patches of ice
		c = mix(c, c * vec3(0.82, 0.9, 1.04), clamp(-cav * 1.5, 0.0, 1.0) * 0.8);
		c = mix(c, vec3(0.62, 0.72, 0.8), smoothstep(0.62, 0.85, fbm(w * 0.01)) * 0.35);
	} else {
		c += vec3(16.0, 15.0, 14.0) / 255.0 * grain * near;
	}

	if (!city && !hot) {
		// big patches of slightly different ground, so a whole cover is never one tone
		float patchy = fbm(w * 0.0045);
		float fine = fbm(w * 0.03);
		c *= mix(0.84, 1.12, patchy) * mix(0.94, 1.05, fine);
		c = mix(c, c * vec3(1.06, 0.98, 0.9), smoothstep(0.5, 0.85, fbm(w * 0.008 + 5.0)) * 0.5);

		// steep ground is bare rock, banded by height
		vec3 rock = mix(vec3(dot(c, vec3(0.33))), c, 0.35) * vec3(0.78, 0.74, 0.7);
		if (cold) rock = vec3(0.56, 0.6, 0.67) * mix(0.9, 1.05, fbm(w * 0.05));
		if (sand) rock = c * vec3(0.78, 0.66, 0.56);
		float strata = 0.85 + 0.15 * sin(vw.y * 0.9 + vnoise(w * 0.05) * 4.0);
		rock *= mix(1.0, strata, (cold ? 0.25 : 0.6) + 0.4 * near);
		// snow clings to all but the steepest faces
		float rk = cold ? smoothstep(0.45, 0.65, slope + (vnoise(w * 0.08) - 0.5) * 0.1)
			: smoothstep(0.22, 0.42, slope + (vnoise(w * 0.08) - 0.5) * 0.12);
		c = mix(c, rock, rk);
		rough = mix(rough, 0.85, rk);

		// cavity: dark hollows, lit ridges
		c *= 1.0 + clamp(cav, -1.0, 1.0) * 0.18;

		// damp ground just above the waterline
		float shore = 1.0 - smoothstep(0.0, 2.2, vw.y - water_y);
		c = mix(c, c * vec3(0.62, 0.6, 0.58), shore * 0.85);
		rough = mix(rough, 0.35, shore * 0.7);
	}

	// under the water: the bed darkens and turns sea-green with depth (seen through the clear shallows)
	float under = vw.y < water_y ? smoothstep(0.0, 5.0, water_y - vw.y) : 0.0;
	c = mix(c, c * vec3(0.45, 0.62, 0.66), under);

	// roll off bright covers before the tone mapper so sand and snow keep their texture
	float lum = dot(c, vec3(0.3, 0.59, 0.11));
	float knee = 0.5;
	if (lum > knee) c *= (knee + (lum - knee) * 0.45) / lum;

	ALBEDO = clamp(c, 0.0, 1.0);
	ROUGHNESS = rough;
	SPECULAR = 0.35;
	EMISSION = emit;
}
