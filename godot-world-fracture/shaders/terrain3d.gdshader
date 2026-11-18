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
uniform int i_ash = -1; uniform int i_basalt = -1;
uniform vec3 tint = vec3(1.0); // the region's earth (the Wastelands' red ground)
uniform float embers = 0.0; // smouldering specks in the ash (Ember Peaks at night)

varying vec2 wpos;
varying vec3 wnorm;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

void vertex() {
	wpos = bounds.xy + UV * bounds.z;
	wnorm = NORMAL;   // the ground mesh is unrotated: its normals are world normals
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
	if (cover == i_forest || cover == i_dense || cover == i_marsh) {
		float crown = vnoise(w * 0.8);
		c += vec3(0.7, 1.0, 0.5) * ((crown - 0.5) * 40.0 + grain * 10.0) / 255.0;
		if (crown < 0.3) c *= 0.72;
	} else if (cover == i_meadow || cover == i_grass || cover == i_scrub) {
		c += (vec3(22.0, 24.0, 10.0) * (vnoise(w * 0.06) - 0.5) + vec3(14.0, 14.0, 8.0) * grain) / 255.0;
	} else if (cover == i_desert || cover == i_dunes || cover == i_sandstone || cover == i_wash) {
		float rip = sin(w.x * 0.5 + w.y * 0.3 + vnoise(w * 0.03) * 8.0);
		c += (vec3(8.0, 6.0, 4.0) * rip + vec3(12.0, 10.0, 8.0) * grain) / 255.0;
		// wind-blown sand: broad lighter and darker drifts so the dunes read under a high sun
		c *= 0.88 + 0.22 * vnoise(w * 0.012 + vnoise(w * 0.004) * 2.0);
	} else if (cover == i_lava || cover == i_magma) {
		// a lava flow: cooled crust plates drifting downstream, molten seams glowing between them, the seams breathing
		vec2 fl = w * 0.14 + vec2(TIME * 0.025, TIME * 0.04);
		float seam = 1.0 - abs(vnoise(fl + vnoise(w * 0.05) * 2.0) * 2.0 - 1.0);
		float v = 1.0 - abs(vnoise(w * 0.18 + TIME * 0.03) * 2.0 - 1.0);
		float breathe = 0.85 + 0.15 * sin(TIME * 1.3 + vnoise(w * 0.02) * 6.0);
		// magma (the crater, the pools) is mostly molten with crust rafts floating on it — it was solid white-hot and
		// blew out the whole crater (Nov 18, against the owner's volcano photo: dark rock, orange-red seams)
		float hot = cover == i_magma ? mix(0.15, 0.85, smoothstep(0.55, 0.95, seam)) * breathe
			: max(smoothstep(0.8, 0.97, seam), smoothstep(0.86, 0.99, v)) * breathe;
		vec3 crust = vec3(0.07, 0.05, 0.05) * (0.8 + 0.4 * vnoise(fl * 3.0));
		c = mix(crust, vec3(0.95, 0.38, 0.1), hot);
		emit = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.34, 0.06), hot * hot) * hot * (cover == i_magma ? 1.5 : 2.2);
	} else if (cover == i_ash || cover == i_basalt) {
		// volcanic ground: cinder grain, darker cooled-flow plates with cracks between, a few embers still glowing
		float plate = vnoise(w * 0.09 + vnoise(w * 0.02) * 3.0);
		float crack = 1.0 - smoothstep(0.0, 0.05, abs(plate - 0.5));
		c *= 0.82 + 0.3 * vnoise(w * 0.35) + grain * 0.25;
		c = mix(c, c * 0.55, smoothstep(0.55, 0.75, plate) + crack * 0.6);
		rough = 0.95;
		float sp = hash2(floor(w * 1.7));
		emit = vec3(1.0, 0.3, 0.06) * step(0.9975, sp) * embers * (0.6 + 0.4 * sin(TIME * 2.0 + sp * 40.0))
			+ vec3(0.9, 0.2, 0.04) * crack * smoothstep(0.62, 0.8, vnoise(w * 0.013)) * embers * 0.5;
	} else if (cover == i_crystal) {
		float sp = vnoise(w * 1.3);
		emit = vec3(0.55, 0.35, 1.0) * smoothstep(0.7, 0.95, sp) * 1.2;
		rough = 0.35;
	} else if (cover == i_rift) {
		float k = 1.0 - abs(vnoise(w * 0.25 + TIME * 0.05) * 2.0 - 1.0);
		emit = vec3(0.6, 0.2, 1.0) * k * 1.6;
	} else if (cover == i_urban || cover == i_paved || cover == i_town) {
		c += vec3(10.0) / 255.0 * grain;
		// paving slabs 4 m square with darker joints, and at night in the rain puddles in patches: glossy where the water
		// stands, matt between (a uniform mirror read as a blue sheet in Neon City's Street View — Nov 18)
		vec2 slab = fract(w / 4.0);
		float joint = 1.0 - step(0.035, min(min(slab.x, 1.0 - slab.x), min(slab.y, 1.0 - slab.y)));
		c *= 1.0 - joint * 0.25;
		c *= mix(0.92, 1.08, hash2(floor(w / 4.0)));
		float puddle = smoothstep(0.5, 0.68, vnoise(w * 0.07 + 3.1) * 0.7 + vnoise(w * 0.31) * 0.3);
		rough = mix(0.85, mix(0.62, 0.06, puddle), wet);
		c *= mix(1.0, mix(0.62, 0.38, puddle), wet);
	} else if (cover == i_snow || cover == i_ice) {
		rough = 0.55;
		c += vec3(6.0) / 255.0 * grain;
		// snow does not hold on the steep faces: dark rock shows through there, in streaks down the fall line, and the
		// drifts between have soft wind ripples (the owner's Frostspire photos: white ridges, dark crags)
		float steep = 1.0 - normalize(wnorm).y;
		float streaks = vnoise(vec2(w.x * 0.15, w.y * 0.15) + vnoise(w * 0.03) * 4.0);
		float bare = smoothstep(0.22, 0.42, steep + (streaks - 0.5) * 0.25);
		c = mix(c * (0.94 + 0.06 * sin(w.x * 0.8 + vnoise(w * 0.05) * 6.0)), vec3(0.16, 0.16, 0.18) * (0.8 + 0.4 * streaks), bare);
		rough = mix(rough, 0.9, bare);
	} else {
		c += vec3(16.0, 15.0, 14.0) / 255.0 * grain;
	}
	ALBEDO = clamp(c * tint, 0.0, 1.0);
	ROUGHNESS = rough;
	EMISSION = emit;
}
