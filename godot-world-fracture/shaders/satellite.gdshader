shader_type canvas_item;
// The satellite view of a region map, recoloured on the GPU from the map's baked data (the same rules as the web game's
// satelliteFromData): R the land cover, G the hill shade, B the water depth. Noise is keyed to world metres so it never swims.

uniform vec3 pal[32];
uniform vec4 bounds = vec4(0.0, 0.0, 1000.0, 0.0); // x0, z0, span
// cover indices (styles.covers order) the shader treats specially
uniform int i_deep; uniform int i_sea; uniform int i_shallow; uniform int i_lake; uniform int i_river;
uniform int i_forest; uniform int i_dense; uniform int i_marsh; uniform int i_meadow; uniform int i_grass; uniform int i_scrub;
uniform int i_desert; uniform int i_dunes; uniform int i_sandstone; uniform int i_wash; uniform int i_lava; uniform int i_magma;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

void fragment() {
	vec4 d = texture(TEXTURE, UV);
	int cover = int(round(d.r * 255.0));
	float shade = 0.4 + (d.g * 255.0 / 252.0) * 0.9;
	float depth = d.b * 255.0 / 6.0;
	vec2 w = bounds.xy + UV * bounds.z;
	vec3 c = pal[clamp(cover, 0, 31)];
	float grain = hash2(floor(w * 1.7)) - 0.5;
	bool water = cover == i_deep || cover == i_sea || cover == i_shallow || cover == i_lake || cover == i_river;
	if (water) {
		float k = smoothstep(0.0, 30.0, depth);
		c -= vec3(10.0, 18.0, 14.0) / 255.0 * k;
		float wave = vnoise(w * 0.08) - 0.5;
		c += vec3(6.0, 8.0, 10.0) / 255.0 * wave;
	} else {
		if (cover == i_forest || cover == i_dense || cover == i_marsh) {
			float crown = vnoise(w * 0.8);
			float k = ((crown - 0.5) * 46.0 + grain * 14.0) / 255.0;
			c += vec3(0.7, 1.0, 0.5) * k;
			if (crown < 0.28) c *= vec3(0.7, 0.72, 0.7);
		} else if (cover == i_meadow || cover == i_grass || cover == i_scrub) {
			float pt = vnoise(w * 0.06) - 0.5;
			c += (vec3(24.0, 26.0, 10.0) * pt + vec3(10.0, 10.0, 6.0) * grain) / 255.0;
		} else if (cover == i_desert || cover == i_dunes || cover == i_sandstone || cover == i_wash) {
			float rip = sin(w.x * 0.5 + w.y * 0.3 + vnoise(w * 0.03) * 8.0);
			c += (vec3(8.0, 6.0, 4.0) * rip + vec3(12.0, 10.0, 8.0) * grain) / 255.0;
		} else if (cover == i_lava) {
			float v = 1.0 - abs(vnoise(w * 0.18) * 2.0 - 1.0);
			float hot = smoothstep(0.8, 0.97, v);
			c = mix(vec3(40.0, 26.0, 22.0) / 255.0, vec3(1.0, 190.0 / 255.0, 60.0 / 255.0), hot);
		} else {
			c += vec3(16.0, 15.0, 14.0) / 255.0 * grain;
		}
		if (cover != i_lava && cover != i_magma) c *= shade;
	}
	COLOR = vec4(clamp(c, 0.0, 1.0), 1.0);
}
