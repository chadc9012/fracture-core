extends RefCounted
## The sky over a region's 3D view, painted after the owner's world photos (docs/reference/world-photos: storm-ember,
## night / moon-frostspire, sunset-wastelands, day-solara): a gradient with a cloud deck lit from the sun or the moon, the
## sun's disc and glow, a moon with maria, stars, and a coloured glow along the horizon (the lava under Ember's storm).
## region_3d.gd `_build_env` uses it when a style carries a "sky" key; the rest keep the procedural sky.
## The clouds do not move (no TIME), so Godot draws the radiance map once, not every frame — the phone budget.

const CODE := """
shader_type sky;
uniform vec3 zenith : source_color;
uniform vec3 horizon : source_color;
uniform vec3 ground : source_color;
uniform vec3 glow : source_color;          // a band along the horizon (lava, city, dusk)
uniform float glow_amt = 0.0;
uniform vec3 light_dir = vec3(0.0, 0.5, -1.0);   // towards the sun or the moon
uniform vec3 light_col : source_color = vec3(1.0);
uniform float sun_disc = 0.0;              // 1 shows the sun's disc and glow
uniform float moon = 0.0;                  // 1 shows the moon's disc
uniform float moon_size = 1.0;
uniform float stars = 0.0;
uniform float cover = 0.5;                 // how much of the sky the cloud deck covers
uniform vec3 cloud_dark : source_color;
uniform vec3 cloud_lit : source_color;
uniform float cloud_scale = 1.3;
uniform float streak = 0.0;                // stretch the clouds into bands (sunset)
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5; float v = 0.0; for (int k = 0; k < 6; k++) { v += a * n(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void sky() {
	vec3 d = EYEDIR;
	vec3 ld = normalize(light_dir);
	float m = max(dot(d, ld), 0.0);
	if (d.y < 0.0) {
		COLOR = mix(horizon, ground, smoothstep(0.0, 0.25, -d.y)) + glow * glow_amt * exp(d.y * 14.0);
	} else {
		float t = pow(1.0 - d.y, 3.0);
		vec3 c = mix(zenith, horizon, t);
		c += glow * glow_amt * pow(1.0 - d.y, 12.0);
		c += light_col * (pow(m, 6.0) * 0.25 + pow(m, 60.0) * 0.5) * (sun_disc + moon * 0.35);
		vec2 sp = d.xz / (d.y + 0.3) * 260.0;
		c += vec3(0.8, 0.85, 1.0) * step(0.9962, h(floor(sp))) * smoothstep(0.12, 0.45, d.y) * stars * 0.7;
		// the moon: a disc with dark maria
		float ms = 0.9994 - (moon_size - 1.0) * 0.0012;
		float disc = smoothstep(ms, ms + 0.00015, m) * moon;
		vec3 tang = normalize(cross(ld, vec3(0.0, 1.0, 0.0)));
		vec3 bit = cross(tang, ld);
		vec2 mp = vec2(dot(d - ld, tang), dot(d - ld, bit)) * 30.0 / moon_size;
		vec3 mc = vec3(1.0, 0.98, 0.94) * (1.3 - smoothstep(0.45, 0.75, fbm(mp * 2.2 + 3.0)) * 0.5) * 2.2;
		// the sun's disc
		float sd = smoothstep(0.9993, 0.9996, m) * sun_disc;
		// the cloud deck on a plane overhead: dense where the noise is high, lit on the side towards the light
		vec2 uv = d.xz / (d.y + 0.12) * cloud_scale;
		uv.x *= 1.0 - streak * 0.7;
		float f = fbm(uv);
		float cl = smoothstep(1.0 - cover - 0.12, 1.0 - cover + 0.28, f) * smoothstep(0.0, 0.08, d.y);
		float thick = smoothstep(0.5, 0.95, f);
		float lit = clamp(pow(m, 4.0) * 0.8 + (1.0 - thick) * 0.35, 0.0, 1.0);
		vec3 cc = mix(cloud_dark, cloud_lit, lit) + glow * glow_amt * pow(1.0 - d.y, 6.0) * 0.6;
		cc = mix(cc, horizon, t * 0.45);   // the far deck fades into the horizon haze
		c = mix(c, cc, cl);
		c = mix(c, mc, disc * (1.0 - cl * 0.8));
		c += light_col * 3.0 * sd * (1.0 - cl * 0.9);
		COLOR = c;
	}
}
"""

## a sky material for one of the looks: "storm", "moon", "sunset", "day"; light_dir points at the sun / moon
static func make(look: String, s: Dictionary, light_dir: Vector3) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = CODE
	var mat := ShaderMaterial.new()
	mat.shader = sh
	var p := {
		"zenith": Color(s.top), "horizon": Color(s.hor), "ground": Color(s.fog).darkened(0.45),
		"glow": Color(s.get("glow", "#000000")), "glow_amt": float(s.get("glow_amt", 0.0)),
		"light_dir": light_dir, "light_col": Color(s.sun_col), "sun_disc": 0.0, "moon": 0.0, "moon_size": 1.0,
		"stars": 0.0, "cover": 0.5, "cloud_dark": Color(s.fog).darkened(0.3), "cloud_lit": Color(s.hor), "cloud_scale": 1.3, "streak": 0.0,
	}
	match look:
		"storm":
			p.merge({"cover": 0.86, "cloud_dark": Color("#0b0e18"), "cloud_lit": Color("#3c4664"), "cloud_scale": 0.9}, true)
		"moon":
			p.merge({"moon": 1.0, "moon_size": 2.6, "stars": 1.0, "cover": 0.3, "cloud_dark": Color("#0d1630"), "cloud_lit": Color("#5d74a8"), "cloud_scale": 1.1}, true)
		"sunset":
			p.merge({"sun_disc": 1.0, "cover": 0.42, "cloud_dark": Color("#5b3046"), "cloud_lit": Color("#ffb070"), "cloud_scale": 0.8, "streak": 0.8}, true)
		"day":
			p.merge({"sun_disc": 1.0, "cover": 0.34, "cloud_dark": Color("#9aa8b8"), "cloud_lit": Color("#ffffff"), "cloud_scale": 1.0}, true)
	for k in s.get("sky_set", {}):
		p[k] = s.sky_set[k]
	for k in p:
		mat.set_shader_parameter(k, p[k])
	return mat
