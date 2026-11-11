shader_type spatial;
// The ground of a region's 3D view: coloured from the map's baked data (R the land cover) with the satellite palette, lit by
// the scene (so no baked hill shade), with close-up grain, forest crowns, dune ripples, glowing lava and crystal, and wet
// city streets at night. World metres drive the noise so it never swims.
render_mode cull_back;

uniform sampler2D data_tex : filter_nearest, repeat_disable;
uniform vec3 pal[32];
uniform vec4 bounds = vec4(0.0, 0.0, 1000.0, 0.0); // x0, z0, span (world metres)
uniform float wet = 0.0; // night rain in the cities
uniform int i_forest; uniform int i_dense; uniform int i_marsh; uniform int i_meadow; uniform int i_grass; uniform int i_scrub;
uniform int i_desert; uniform int i_dunes; uniform int i_sandstone; uniform int i_wash; uniform int i_lava; uniform int i_magma;
uniform int i_urban; uniform int i_paved; uniform int i_town; uniform int i_snow; uniform int i_ice; uniform int i_crystal; uniform int i_rift;

varying vec2 wpos;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

void vertex() {
	wpos = bounds.xy + UV * bounds.z;
}

void fragment() {
	// dither the lookup by a texel so cover edges read as ragged ground, not pixels (the index itself must stay exact)
	vec2 texel = 1.0 / vec2(textureSize(data_tex, 0));
	vec2 j = vec2(vnoise(wpos * 0.9), vnoise(wpos * 0.9 + 17.0)) - 0.5;
	int cover = int(round(texture(data_tex, UV + j * texel * 1.6).r * 255.0));
	vec3 c = pal[clamp(cover, 0, 31)];
	vec2 w = wpos;
	// smooth grain in two scales (a hashed 33 cm square grain read as pixels from the chase camera)
	float grain = (vnoise(w * 2.7) * 0.6 + vnoise(w * 9.0) * 0.4) - 0.5;
	float rough = 0.92;
	vec3 emit = vec3(0.0);
	if (cover == i_forest || cover == i_dense || cover == i_marsh) {
		float crown = vnoise(w * 0.8);
		c += vec3(0.7, 1.0, 0.5) * ((crown - 0.5) * 40.0 + grain * 10.0) / 255.0;
		if (crown < 0.3) c *= 0.72;
	} else if (cover == i_meadow || cover == i_grass || cover == i_scrub) {
		c += (vec3(22.0, 24.0, 10.0) * (vnoise(w * 0.06) - 0.5) + vec3(14.0, 14.0, 8.0) * grain) / 255.0;
		// clumps of darker, lusher grass and drier patches between them
		float clump = vnoise(w * 0.45);
		c *= mix(0.86, 1.06, smoothstep(0.3, 0.7, clump));
		c = mix(c, c * vec3(1.15, 1.05, 0.75), smoothstep(0.62, 0.85, vnoise(w * 0.11)) * 0.5);
	} else if (cover == i_desert || cover == i_dunes || cover == i_sandstone || cover == i_wash) {
		float rip = sin(w.x * 0.5 + w.y * 0.3 + vnoise(w * 0.03) * 8.0);
		c += (vec3(8.0, 6.0, 4.0) * rip + vec3(12.0, 10.0, 8.0) * grain) / 255.0;
	} else if (cover == i_lava || cover == i_magma) {
		// a lava flow: cooled crust plates drifting downstream, molten seams glowing between them, the seams breathing
		vec2 fl = w * 0.14 + vec2(TIME * 0.025, TIME * 0.04);
		float seam = 1.0 - abs(vnoise(fl + vnoise(w * 0.05) * 2.0) * 2.0 - 1.0);
		float v = 1.0 - abs(vnoise(w * 0.18 + TIME * 0.03) * 2.0 - 1.0);
		float breathe = 0.85 + 0.15 * sin(TIME * 1.3 + vnoise(w * 0.02) * 6.0);
		float hot = cover == i_magma ? 1.0 : max(smoothstep(0.8, 0.97, seam), smoothstep(0.86, 0.99, v)) * breathe;
		vec3 crust = vec3(0.12, 0.08, 0.07) * (0.8 + 0.4 * vnoise(fl * 3.0));
		c = mix(crust, vec3(1.0, 0.6, 0.2), hot);
		emit = mix(vec3(0.9, 0.22, 0.05), vec3(1.0, 0.42, 0.1), hot) * hot * 2.4;
	} else if (cover == i_crystal) {
		float sp = vnoise(w * 1.3);
		emit = vec3(0.55, 0.35, 1.0) * smoothstep(0.7, 0.95, sp) * 1.2;
		rough = 0.35;
	} else if (cover == i_rift) {
		float k = 1.0 - abs(vnoise(w * 0.25 + TIME * 0.05) * 2.0 - 1.0);
		emit = vec3(0.6, 0.2, 1.0) * k * 1.6;
	} else if (cover == i_urban || cover == i_paved || cover == i_town) {
		c += vec3(10.0) / 255.0 * grain;
		rough = mix(0.85, 0.18, wet);
		c *= mix(1.0, 0.55, wet);
	} else if (cover == i_snow || cover == i_ice) {
		rough = 0.55;
		c += vec3(6.0) / 255.0 * grain;
	} else {
		c += vec3(16.0, 15.0, 14.0) / 255.0 * grain;
	}
	ALBEDO = clamp(c, 0.0, 1.0);
	ROUGHNESS = rough;
	// a fine bump everywhere so a low sun picks out the ground's texture
	float gx = vnoise(w * 6.0) - vnoise(w * 6.0 + vec2(0.15, 0.0));
	float gz = vnoise(w * 6.0) - vnoise(w * 6.0 + vec2(0.0, 0.15));
	NORMAL_MAP = normalize(vec3(gx * 2.0, gz * 2.0, 1.0)) * 0.5 + 0.5;
	EMISSION = emit;
}
