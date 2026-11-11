extends RefCounted
## The head's skin shader (a port of the web game's operator-skin-shader.ts), generated per look: the skin-tone retint, taking
## the cut head's own hair off the scalp for a chosen hairstyle, facial hair, and markings — scars, tattoos, stretch marks,
## Resonance traces, paint, freckles — painted from shapes in head space. Head space rides in CUSTOM0 (written when the head
## is built, character_rig.gd), so the shapes stay put while the head animates.

const Catalog := preload("res://scripts/character/catalog.gd")

static func _f(n: float) -> String:
	var s := str(n)
	return s if "." in s or "e" in s else s + ".0"
static func _v3(a: Array) -> String:
	return "vec3(%s, %s, %s)" % [_f(a[0]), _f(a[1]), _f(a[2])]

const BEARD := {
	"stubble": "max(max(jaw, cheek), lip) * 0.5",
	"goatee": "max(chin, lipRing) * 0.95",
	"moustache": "lip * 0.95",
	"full": "max(max(jaw, cheek), max(lip, max(chin, burns))) * 0.95",
	"chin-strap": "strap * 0.95",
	"van-dyke": "max(chin, lip) * 0.95",
	"chops": "max(burns, cheekLow) * 0.95",
}

static func _beard(id: String) -> String:
	if not BEARD.has(id):
		return ""
	return """	{
	float onFace = smoothstep(0.2, 0.4, k);
	float jaw = smoothstep(-0.012, 0.0, p.y) * (1.0 - smoothstep(0.03, 0.045, p.y)) * smoothstep(0.015, 0.03, p.z) * (1.0 - smoothstep(0.06, 0.07, abs(p.x)));
	float chin = (1.0 - smoothstep(0.02, 0.03, abs(p.x))) * smoothstep(-0.012, 0.0, p.y) * (1.0 - smoothstep(0.012, 0.02, p.y)) * smoothstep(0.06, 0.075, p.z);
	float lipRing = (1.0 - smoothstep(0.024, 0.032, abs(p.x))) * smoothstep(-0.012, 0.0, p.y) * (1.0 - smoothstep(0.04, 0.046, p.y)) * smoothstep(0.07, 0.082, p.z)
		* (1.0 - (1.0 - smoothstep(0.02, 0.026, abs(p.x))) * smoothstep(0.012, 0.016, p.y) * (1.0 - smoothstep(0.03, 0.034, p.y)));
	float lip = (1.0 - smoothstep(0.026, 0.034, abs(p.x))) * smoothstep(0.026, 0.031, p.y) * (1.0 - smoothstep(0.04, 0.046, p.y)) * smoothstep(0.075, 0.085, p.z);
	float cheek = smoothstep(0.0, 0.012, p.y) * (1.0 - smoothstep(0.04, 0.052, p.y)) * smoothstep(0.0, 0.02, p.z) * smoothstep(0.028, 0.04, abs(p.x)) * (1.0 - smoothstep(0.068, 0.075, abs(p.x)));
	float cheekLow = cheek * (1.0 - smoothstep(0.02, 0.035, p.y));
	float burns = smoothstep(0.05, 0.06, abs(p.x)) * smoothstep(0.01, 0.025, p.y) * (1.0 - smoothstep(0.085, 0.095, p.y)) * smoothstep(-0.035, -0.02, p.z) * (1.0 - smoothstep(0.03, 0.045, p.z));
	float strap = smoothstep(-0.01, 0.0, p.y) * (1.0 - smoothstep(0.012, 0.02, p.y)) * smoothstep(0.0, 0.015, p.z) * (1.0 - smoothstep(0.06, 0.07, abs(p.x)));
	strap = max(strap, burns * (1.0 - smoothstep(0.03, 0.045, p.y)));
	float lipMouth = (1.0 - smoothstep(0.022, 0.028, abs(p.x))) * smoothstep(0.012, 0.016, p.y) * (1.0 - smoothstep(0.028, 0.032, p.y)) * smoothstep(0.08, 0.088, p.z);
	float beard = clamp(%s, 0.0, 1.0) * onFace * (1.0 - lipMouth);
	float grain = 0.55 + 0.45 * wf_hash(floor(q * vec3(700.0, 1400.0, 700.0)));
	vec3 tone = beard_tone * clamp(l / max(skin_lum, 0.02), 0.35, 1.3);
	col = mix(col, tone, beard * grain);
	}
""" % BEARD[id]

static func _marking(m: Dictionary) -> String:
	var shapes: Array = Catalog.data().get("markingShapes", {}).get(m.id, [])
	if shapes.is_empty():
		return ""
	var a := ""
	for s: Dictionary in shapes:
		var t: String = ("wf_line(q, %s, %s, %s)" % [_v3(s.a), _v3(s.b), _f(s.w)]) if s.kind == "line" else ("wf_dot(q, %s, %s)" % [_v3(s.c), _f(s.r)])
		a = t if a == "" else "max(%s, %s)" % [a, t]
	match m.kind:
		"scar":
			if m.id.begins_with("burn"):
				return "\t{ float a = %s; a *= 0.55 + 0.45 * wf_hash(floor(q * 400.0)); vec3 g = vec3(dot(c, vec3(0.3, 0.59, 0.11)));\n\tcol = mix(col, mix(g, c, 0.45) * vec3(0.95, 0.68, 0.62), a * 0.8); }\n" % a
			return "\t{ float a = %s; vec3 ridge = c * vec3(1.14, 0.98, 0.95) + 0.035;\n\tcol = mix(col, ridge, a); col = mix(col, c * vec3(0.78, 0.5, 0.48), smoothstep(0.55, 1.0, a) * 0.55); }\n" % a
		"stretch":
			return "\t{ float a = %s * (0.7 + 0.3 * wf_hash(floor(q * 900.0))); vec3 g = vec3(dot(c, vec3(0.3, 0.59, 0.11)));\n\tcol = mix(col, mix(c, g, 0.5) * 1.22 + 0.03, a * 0.6); }\n" % a
		"tattoo":
			return "\t{ float a = %s; col = mix(col, vec3(0.055, 0.065, 0.085) * (0.6 + 0.4 * c.r / max(skin_lum, 0.02)), a * 0.88); }\n" % a
		"resonance":
			return "\t{ float a = %s; col = mix(col, vec3(0.1, 0.5, 0.6), a * 0.7); glow = max(glow, a); }\n" % a
		"paint":
			var colour := "vec3(0.55, 0.06, 0.04)" if m.id == "paint-warstripes" else ("vec3(0.85, 0.84, 0.8)" if m.id == "paint-cheekbars" else "vec3(0.03, 0.03, 0.035)")
			return "\t{ float a = %s * (0.85 + 0.15 * wf_hash(floor(q * 600.0))); col = mix(col, %s * (0.7 + 0.3 * l / max(skin_lum, 0.02)), a * 0.92); }\n" % [a, colour]
		"freckle":
			return "\t{ float a = %s; float h = wf_hash(floor(q * 520.0)); float spot = step(0.78, h) * a; col = mix(col, c * vec3(0.62, 0.5, 0.42), spot * 0.8); }\n" % a
	return ""

## hair_mode: 0 keep the cut head's hair, 1 bald (scalp hair to skin), 2 recolour/cut it for a built style
static func code(hair_mode: int, beard: String, marks: Array, has_normal: bool) -> String:
	var sk: Dictionary = Catalog.data().get("skull", {"centre": [0, 0.09, -0.005], "radii": [0.085, 0.11, 0.1]})
	# both faces: the generated heads carry triangles wound the wrong way, which culling cut out as holes (owner, Nov 11)
	var s := "shader_type spatial;\nrender_mode cull_disabled;\n// world-fracture operator skin\n"
	s += "uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;\n"
	if has_normal:
		s += "uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;\n"
	s += "uniform vec3 skin = vec3(0.0); uniform float skin_lum = 0.2; uniform vec3 hair = vec3(0.07); uniform vec3 bald = vec3(0.4, 0.3, 0.25);\n"
	s += "uniform vec3 beard_tone = vec3(0.01); uniform float roughness_v = 0.62;\n"
	s += "varying vec3 rest;\n"
	s += "vec3 wf_map(vec3 v) { return normalize((v - %s) / %s) * 0.1; }\n" % [_v3(sk.centre), _v3(sk.radii)]
	s += """float wf_line(vec3 q, vec3 a, vec3 b, float w) {
	vec3 ma = wf_map(a), mb = wf_map(b), ab = mb - ma;
	float t = clamp(dot(q - ma, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
	return 1.0 - smoothstep(w, w + 0.0025, length(q - (ma + ab * t)));
}
float wf_dot(vec3 q, vec3 c, float r) { return 1.0 - smoothstep(r, r + 0.004, length(q - wf_map(c))); }
float wf_hash(vec3 q) { return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void vertex() { rest = CUSTOM0.xyz; }
void fragment() {
	vec3 c = texture(albedo_tex, UV).rgb;
	vec3 col = c;
	float glow = 0.0;
	float l = dot(c, vec3(0.3, 0.59, 0.11));
	float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
	float sat = (mx - mn) / (mx + 1e-4);
	float k = smoothstep(0.015, 0.05, c.r - c.b) * smoothstep(0.12, 0.25, sat) * (1.0 - smoothstep(0.78, 0.9, sat)) * smoothstep(0.012, 0.035, l) * step(c.b, c.g + 0.04);
	vec3 p = rest;
	if (skin_lum > 0.0 && skin.r + skin.g + skin.b > 0.0) {
		col = mix(c, skin * clamp(l / skin_lum, 0.0, 2.2), k);
	}
"""
	if hair_mode > 0:
		s += """	{
	float notSkin = max(1.0 - smoothstep(0.35, 0.55, l / max(skin_lum, 0.02)), (1.0 - k) * (1.0 - smoothstep(0.3, 0.45, sat)));
	float eyes = smoothstep(0.04, 0.05, p.z) * smoothstep(0.05, 0.058, p.y) * (1.0 - smoothstep(0.094, 0.1, p.y)) * (1.0 - smoothstep(0.042, 0.05, abs(p.x)));
	float lower = smoothstep(0.03, 0.04, p.z) * (1.0 - smoothstep(0.055, 0.062, p.y)) * (1.0 - smoothstep(0.046, 0.054, abs(p.x))) * max(1.0 - smoothstep(0.03, 0.038, abs(p.x)), smoothstep(0.3, 0.45, k));
	float face = max(eyes, lower);
	float ears = smoothstep(0.045, 0.052, abs(p.x)) * smoothstep(0.03, 0.038, p.y) * (1.0 - smoothstep(0.095, 0.102, p.y)) * smoothstep(-0.04, -0.032, p.z) * (1.0 - smoothstep(0.02, 0.028, p.z)) * smoothstep(0.2, 0.4, k);
	float neck = step(p.y, 0.045) * step(length(vec2(p.x, p.z + 0.02)), 0.062);
	// with a built style, the cut head's own fringe over the forehead stays as bangs (in the style's colour) to meet the cap
	float bangs = %s * smoothstep(0.02, 0.04, p.z) * (1.0 - smoothstep(0.05, 0.065, abs(p.x))) * (1.0 - smoothstep(0.13, 0.145, p.y));
	float scalp = notSkin * smoothstep(0.0, 0.015, p.y) * (1.0 - max(max(face, bangs), max(ears, neck)));
	// cut only above the brow and behind the ears: below the brow at the front, the cut head's own hair (a fringe over an
	// eye, locks at the cheek) has no face modelled under it, and cutting it left holes through the face (owner, Nov 11)
	scalp *= max(smoothstep(0.1, 0.112, p.y), 1.0 - smoothstep(-0.01, 0.01, p.z));
	if (scalp > 0.35) { discard; }
	float kept = notSkin * max(smoothstep(%s, %s, p.y) * max(face, ears), bangs);
	vec3 hairTone = %s;
	col = mix(col, hairTone, max(scalp / 0.35, kept));
	}
""" % (["0.0", "0.098", "0.104", "bald * clamp(l / 0.05, 0.6, 1.3)"] if hair_mode == 1 else ["1.0", "0.088", "0.094", "hair * clamp(l / 0.06, 0.3, 1.6)"])
	s += "\tc = col;\n\tvec3 q = wf_map(p);\n"
	s += _beard(beard)
	for id: String in marks:
		var m := Catalog.find("markings", id)
		if not m.is_empty():
			s += _marking(m)
	s += "\tALBEDO = col;\n\tROUGHNESS = roughness_v;\n\tEMISSION = vec3(0.15, 0.85, 1.0) * glow * 1.6;\n"
	if has_normal:
		s += "\tNORMAL_MAP = texture(normal_tex, UV).rgb;\n"
	s += "}\n"
	return s
