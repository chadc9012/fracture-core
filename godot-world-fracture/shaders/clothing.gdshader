shader_type spatial;
// The street's people in their own clothes (GTA pass, owner Nov 11: "at least GTA 5 visual quality", people next). One
// civilian body per build is dressed many ways: scripts/build-operator-civilian.py writes each vertex's body zone (UV2.y)
// and its rest position (UV.x, UV.y, UV2.x), and this shader decides per walker what each zone wears — the hoodie the
// body was painted with, or a t-shirt with bare forearms, a jacket and trousers, shorts, a dress, a long coat — in that
// walker's colours (instance uniforms, so the whole crowd shares one material). Cloth gets weave or knit, soft folds
// that follow the body (bumped from the rest pose, so they stay put while the body walks), denim twill and fading,
// leather or trainer shoes; skin takes the walker's skin tone. Detail fades once it would be under a pixel.

instance uniform vec3 top_col : source_color = vec3(0.1, 0.1, 0.12);
instance uniform vec3 trim_col : source_color = vec3(0.07, 0.07, 0.08);
instance uniform vec3 leg_col : source_color = vec3(0.24, 0.24, 0.26);
instance uniform vec3 shoe_col : source_color = vec3(0.92, 0.92, 0.9);
instance uniform vec3 acc_col : source_color = vec3(0.86, 0.13, 0.12);
instance uniform vec3 skin_col : source_color = vec3(0.55, 0.38, 0.28);
// 0 hoodie (as painted, recoloured), 1 t-shirt, 2 jacket + trousers, 3 summer (vest top, shorts), 4 dress, 5 long coat
instance uniform int style = 0;
// 0 joggers, 1 denim, 2 suiting, 3 chinos
instance uniform int legs_kind = 0;
// 0 trainers, 1 leather
instance uniform int shoe_kind = 0;
// 1 = keep the painted outfit exactly (the operator)
instance uniform int as_painted = 0;

varying vec3 rest;
varying float zone;

float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
	vec3 i = floor(x), f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void vertex() {
	rest = vec3(UV.x, 1.0 - UV.y, UV2.x);   // Blender's x, y, z (z up); the glTF exporter flips v
	zone = floor(1.0 - UV2.y + 0.5);
}

// slots: 0 painted, 1 skin, 2 top, 3 top trim, 4 legs, 5 leg trim, 6 shoes, 7 accent, 8 sole
int slot_of(int z, int st) {
	// zones: 1 hand, 2 neck, 3 hood, 4 shoulder, 5 upper arm, 6 forearm, 7 cuff, 8 torso, 9 top trim, 10 top accent,
	// 11 thigh, 12 shin, 13 ankle cuff, 14 leg trim, 15 leg accent, 16 shoe, 17 shoe accent, 18 sole
	if (z <= 2) return 1;
	if (z == 18) return 8;
	if (z == 16) return 6;
	if (z == 17) return st == 2 || st == 4 ? 6 : 7;
	bool top = z >= 3 && z <= 10;
	if (st == 1) {   // t-shirt: bare forearms, the hood reads as a collar
		if (z == 6 || z == 7) return 1;
		if (z == 9 || z == 10) return 2;
	}
	if (st == 2) {   // jacket: the chest print becomes the shirt, trousers in the jacket's cloth
		if (z == 10) return 3;
		if (z == 13 || z == 14 || z == 15) return 4;
	}
	if (st == 3) {   // summer: bare arms and shins
		if (z == 5 || z == 6 || z == 7) return 1;
		if (z == 12 || z == 13) return 1;
		if (z == 15 || z == 14) return 4;
	}
	if (st == 4) {   // dress: to the knee, bare forearms and shins
		if (z == 6 || z == 7) return 1;
		if (z == 11 || z == 14 || z == 15) return 2;
		if (z == 12 || z == 13) return 1;
	}
	if (st == 5) {   // long coat: over the thighs
		if (z == 11 || z == 14 || z == 15) return 2;
	}
	if (top) return z == 7 || z == 9 ? 3 : (z == 10 ? 7 : 2);
	if (z == 13 || z == 14) return 5;
	if (z == 15) return 7;
	return 4;
}

void fragment() {
	int z = int(zone + 0.5);   // round: interpolating equal values is not exact on every GPU
	int slot = as_painted == 1 ? 0 : slot_of(z, style);
	vec3 c = COLOR.rgb;
	float rough = 0.9;
	float bump_amp = 0.0;
	float h = 0.0;
	// how many rest-space metres one pixel covers: detail under ~2 px fades out
	float px = length(fwidth(rest));
	float fine = 1.0 - smoothstep(0.0015, 0.004, px);
	float mid = 1.0 - smoothstep(0.006, 0.02, px);

	// soft folds that hang off the body (bigger, slower noise stretched along the limb)
	float folds = noise3(rest * vec3(18.0, 18.0, 7.0)) * 0.65 + noise3(rest * vec3(40.0, 40.0, 16.0)) * 0.35;

	if (slot == 1) {
		c = skin_col;
		rough = 0.55;
		h = noise3(rest * 300.0) * 0.3 * fine;
		bump_amp = 0.25;
	} else if (slot == 8) {
		c = shoe_kind == 1 ? shoe_col * 0.6 : vec3(0.93, 0.92, 0.9) * (COLOR.r > 0.5 ? 1.0 : 0.15);
		rough = 0.6;
	} else if (slot == 6 || (slot == 7 && z >= 16)) {
		c = slot == 7 ? acc_col : shoe_col;
		if (shoe_kind == 1) {   // leather: polished, creased
			rough = 0.32 + 0.2 * noise3(rest * 120.0);
			h = noise3(rest * vec3(80.0, 80.0, 30.0)) * mid;
			bump_amp = 0.4;
		} else {                // trainers: mesh upper
			rough = 0.75;
			h = (sin(rest.x * 900.0) * sin(rest.z * 900.0) * 0.5 + 0.5) * fine * 0.5;
			bump_amp = 0.3;
		}
	} else if (slot != 0) {
		bool is_top = slot == 2 || slot == 3 || (slot == 7 && z <= 10);
		if (slot == 2) c = top_col;
		else if (slot == 3) c = trim_col;
		else if (slot == 4) c = leg_col;
		else if (slot == 5) c = leg_col * 0.78;
		else c = acc_col;
		// fabric
		if (is_top) {
			if (style == 0) {        // fleece knit
				h = noise3(rest * 420.0) * fine * 0.6 + folds;
			} else if (style == 2 || style == 5) {   // suiting / coat wool: a faint herringbone
				float hb = abs(fract((rest.z * 160.0) + abs(fract(rest.x * 40.0) - 0.5)) - 0.5);
				h = hb * fine * 0.5 + folds * 0.8;
				rough = 0.8;
			} else {                 // jersey cotton
				h = noise3(rest * 600.0) * fine * 0.4 + folds;
			}
			bump_amp = 0.55;
		} else if (slot == 4 || slot == 5) {
			if (legs_kind == 1) {    // denim: diagonal twill, lighter worn fronts and thighs, darker seams' shade
				float tw = sin((rest.z * 2.0 + rest.x + rest.y) * 520.0) * 0.5 + 0.5;
				h = tw * fine * 0.5 + folds;
				float wear = noise3(rest * vec3(9.0, 9.0, 4.0));
				c *= mix(0.86, 1.22, wear * mid);
				c = mix(c, c * vec3(0.95, 1.0, 1.08), 0.3);
				rough = 0.85;
			} else if (legs_kind == 2) {   // suit trousers: smooth with a pressed sheen
				h = folds * 0.7;
				rough = 0.65;
			} else {
				h = noise3(rest * 380.0) * fine * 0.4 + folds;
			}
			bump_amp = 0.5;
		}
		// where the body was painted darker (hems, pocket edges, cuffs), keep that shading in the new colour
		float painted = dot(COLOR.rgb, vec3(0.33));
		c *= mix(1.0, clamp(0.75 + painted * 0.6, 0.7, 1.05), float(style == 0));
		// folds shade the cloth a little
		c *= 0.88 + 0.24 * folds;
	} else {
		h = folds * 0.6;
		bump_amp = 0.3;
	}

	// the cloth's relief as light and shade on the colour (a normal bump on skinned, small, distant figures only
	// sparkled on the phone)
	c *= 1.0 - bump_amp * 0.35 * (h - 0.5) * mid;

	ALBEDO = clamp(c, 0.0, 1.0);
	ROUGHNESS = rough;
	SPECULAR = slot == 1 ? 0.4 : 0.35;
}
