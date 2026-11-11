shader_type sky;
// The sky over a region's 3D view (graphics pass, owner Nov 11: "push for better graphics"). Replaces the flat procedural
// two-colour gradient: a horizon band that brightens toward the sun, the sun disc with a soft halo (Mie-like glow), two
// layers of clouds lit from the sun's side with darker bellies, and stars at night. The clouds do not move (no TIME), so
// the sky's ambient / reflection cubemap is baked once, not every frame (the phone budget).
uniform vec3 top_col : source_color = vec3(0.29, 0.47, 0.65);
uniform vec3 hor_col : source_color = vec3(0.76, 0.8, 0.82);
uniform vec3 ground_col : source_color = vec3(0.3, 0.32, 0.33);
uniform vec3 sun_col : source_color = vec3(1.0, 0.94, 0.86);
uniform float cloud_cover : hint_range(0.0, 1.0) = 0.45;
uniform vec3 cloud_tint : source_color = vec3(1.0);
uniform float night : hint_range(0.0, 1.0) = 0.0;
uniform float seed = 0.0;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
	return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
float fbm(vec2 p) {
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += vnoise(p) * a; p = p * 2.07 + vec2(17.3, 9.1); a *= 0.5; }
	return v;
}

void sky() {
	vec3 d = EYEDIR;
	float up = d.y;
	vec3 sun = LIGHT0_ENABLED ? LIGHT0_DIRECTION : normalize(vec3(0.4, 0.5, 0.3));
	float mu = dot(d, sun);

	// the gradient: horizon band, a little brighter and warmer on the sun's side
	float t = pow(clamp(up, 0.0, 1.0), 0.45);
	vec3 col = mix(hor_col, top_col, t);
	float sunside = 0.5 + 0.5 * mu;
	col += sun_col * pow(sunside, 6.0) * (1.0 - t) * 0.35 * (1.0 - night * 0.8);
	// below the horizon fades into the ground haze
	col = mix(col, mix(hor_col, ground_col, clamp(-up * 3.0, 0.0, 1.0)), step(up, 0.0));

	// sun: disc + halo
	float disc = smoothstep(0.9994, 0.99975, mu);
	float halo = pow(max(mu, 0.0), 120.0) * 0.6 + pow(max(mu, 0.0), 12.0) * 0.12;
	vec3 sun_light = sun_col * (disc * 18.0 + halo) * (1.0 - night * 0.7);

	// stars, above the horizon at night
	if (night > 0.01 && up > 0.0) {
		// round points of different brightness, a few tinted, thinning into the horizon haze
		vec3 sp = d * 160.0;
		vec3 cell = floor(sp);
		vec3 f = fract(sp) - 0.5;
		float h = hash2(cell.xy + cell.z * 13.1 + seed);
		vec3 off = vec3(hash2(cell.yz + 3.1), hash2(cell.zx + 7.7), hash2(cell.xy + 1.3)) - 0.5;
		float r = length(f - off * 0.6);
		float st = step(0.975, h) * smoothstep(0.09, 0.0, r);
		vec3 tint = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.85, 0.7), step(0.5, hash2(cell.xy * 1.7)));
		col += tint * st * (0.4 + 1.6 * hash2(cell.zy * 2.3)) * night * smoothstep(0.03, 0.3, up);
	}

	// clouds on a plane overhead (EYEDIR / y), two layers, thinning toward the horizon
	if (up > 0.0 && cloud_cover > 0.01) {
		vec2 uv = d.xz / (up + 0.12);
		float base = fbm(uv * 0.9 + seed);
		float cov = 1.0 - cloud_cover;
		float dens = smoothstep(cov - 0.05, cov + 0.25, base);
		float wisps = smoothstep(0.55, 0.85, fbm(uv * vec2(0.6, 2.2) + 41.0 + seed)) * 0.45 * cloud_cover;
		dens = max(dens, wisps);
		// lit from the sun: sample toward the sun, thinner there = brighter edge
		vec2 toward = normalize(sun.xz + 1e-4) * 0.08;
		float lit = clamp(1.0 - (fbm((uv + toward) * 0.9 + seed) - base) * 4.0, 0.3, 1.25);
		vec3 day_c = mix(hor_col * 0.75 + vec3(0.12), vec3(1.0), 0.55) * lit;
		day_c += sun_col * pow(max(mu, 0.0), 8.0) * 0.6 * dens;
		vec3 night_c = hor_col * 0.55 + top_col * 0.2;
		vec3 cc = mix(day_c, night_c, night) * cloud_tint;
		float fade = smoothstep(0.0, 0.18, up);
		col = mix(col, cc, dens * fade * 0.92);
		sun_light *= 1.0 - dens * fade * 0.85;
	}

	COLOR = col + sun_light;
}
