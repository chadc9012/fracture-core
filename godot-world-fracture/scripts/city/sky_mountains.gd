extends RefCounted
## The mountains round Neon City (owner, Nov 24: "build that street and view of the mountains", over the Neon City board
## docs/reference/meshy-neon/ — the boulevard under forested ranges, a waterfall down a green slope). Painted into the
## sky shader rather than built: three ranges, far to near, ridged noise round the compass, at infinite distance so
## they stand behind the skyline from anywhere on the 1.8 km avenue, never clip at the camera's 1.5 km far plane and
## cost a few noise taps per sky pixel. Lower where the avenue runs (±z) so the vista's towers still read against
## the sky, higher off to the sides. By night: navy-green silhouettes, the far range lifted by the city's violet glow,
## moonlit ridges, a scatter of hillside lights and the falls catching the moon; by day: forest green and grey rock
## under blue aerial haze, snow on the far peaks.
##   street_slice.gd and night_fx.gd splice GLSL in with `inject(code)` and turn it on with `mountains = 1.0`.

## the uniforms and functions, put in before `void sky()`; needs the shader's own h() / n() hash and value noise
const FUNCS := """
uniform float mountains = 0.0;
uniform float mtn_night = 1.0;
float mt_n1(float x, float s) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(h(vec2(i, s)), h(vec2(i + 1.0, s)), f); }
float mt_ridge(float a, float s) {
	float v = 0.0; float amp = 0.55; float fr = 1.0;
	for (int k = 0; k < 5; k++) { float r = 1.0 - abs(mt_n1(a * fr, s + float(k) * 7.31) * 2.0 - 1.0); v += amp * mix(r, r * r, 0.6); amp *= 0.46; fr *= 1.93; }
	return v;
}
// the sky colour `c` behind, the horizon colour `hz`; returns the colour with the ranges in front
vec3 mt_ranges(vec3 d, vec3 c, vec3 hz, vec3 light_dir) {
	float az = atan(d.z, d.x) / 6.2831853;            // -0.5 .. 0.5 round the compass
	float e = d.y;
	float side = abs(d.x) / max(length(d.xz), 1e-4); // 0 down the avenue (z), 1 across it
	float lift = mix(0.5, 1.0, smoothstep(0.15, 0.7, side));
	vec3 col = c;
	float lit_side = clamp(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(light_dir.x, 0.0, light_dir.z))) * 0.5 + 0.5, 0.0, 1.0);
	for (int L = 0; L < 3; L++) {
		float fl = float(L);
		float a = az * (10.0 + fl * 7.0) + fl * 11.7;
		float r = mt_ridge(a, 3.0 + fl * 13.0);
		float top = ((0.035 - fl * 0.008) + r * (0.26 - fl * 0.075)) * lift;
		if (e < top) {
			float haze = 0.55 - fl * 0.25;                   // far ranges sink into the sky
			float tex = 0.82 + 0.36 * n(vec2(a * 9.0, e * 160.0 + fl * 5.0));
			vec3 body;
			if (mtn_night > 0.5) {
				body = mix(vec3(0.03, 0.05, 0.06), vec3(0.05, 0.07, 0.09), fl * 0.5) * tex;
				// moonlit ridge line and upper slopes on the moon's side
				float rim = smoothstep(0.02, 0.0, top - e) * lit_side;
				body += vec3(0.16, 0.19, 0.32) * rim * (0.7 + 0.4 * fl);
				// hillside lights on the near range
				if (L == 2) {
					vec2 cell = floor(vec2(a * 60.0, e * 600.0));
					float on = step(0.996, h(cell + 3.7)) * step(0.01, top - e) * step(e, top * 0.55);
					body += vec3(1.0, 0.66, 0.34) * on * 0.9;
				}
			} else {
				vec3 forest = vec3(0.10, 0.19, 0.11) * tex;
				vec3 rock = vec3(0.36, 0.36, 0.38) * tex;
				float high = smoothstep(top - 0.05, top - 0.012, e);
				body = mix(forest, rock, high * (0.35 + 0.4 * (1.0 - fl * 0.5)));
				if (L == 0) { body = mix(body, vec3(0.92, 0.94, 0.98), smoothstep(top - 0.018, top - 0.004, e) * step(0.12, top)); }
				body *= 0.75 + 0.5 * lit_side;
			}
			col = mix(body, hz, haze);
			// the falls: a bright thread down the middle range with mist at its foot
			if (L == 1) {
				float fx = abs(fract(az + 0.5 + 0.137) - 0.5) * 6.2831853;   // angle from the falls' bearing
				float thread = smoothstep(0.0022, 0.0006, fx) * step(e, top - 0.008) * smoothstep(0.0, 0.02, e);
				float mist = smoothstep(0.012, 0.0, fx) * smoothstep(0.03, 0.0, e) * 0.5;
				vec3 water = mtn_night > 0.5 ? vec3(0.45, 0.55, 0.85) : vec3(0.9, 0.95, 1.0);
				col = mix(col, water, clamp(thread + mist, 0.0, 1.0));
			}
		}
	}
	return col;
}
"""

## the shader code with the ranges in: FUNCS before `void sky()`, and `COLOR = ...;` at the end of the sky branch
## routed through mt_ranges. `last_color_line` is the exact final assignment to wrap; `hz` the horizon expression and
## `light` the light direction expression the shader has.
static func inject(code: String, last_color_line: String, hz: String, light: String) -> String:
	var out := code.replace("void sky() {", FUNCS + "\nvoid sky() {")
	var expr := last_color_line.strip_edges().trim_prefix("COLOR = ").trim_suffix(";")
	var wrapped := "COLOR = mountains > 0.5 ? mt_ranges(d, %s, %s, %s) : %s;" % [expr, hz, light, expr]
	assert(out.contains(last_color_line), "sky_mountains: no '%s' in the sky shader" % last_color_line)
	return out.replace(last_color_line, wrapped)
