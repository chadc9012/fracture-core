// The operator's own clothes, drawn on the civ bodies (scripts/build-operator-civilian.py). Each vertex says which zone
// of the body it is on (vertex colour red: zone * 20 / 255) and, in UV and UV2, where it sits in that zone in rest pose,
// measured from the zone's landmarks (in body heights). The seams are cut here from those smooth coordinates — hem, cuffs,
// zip line, stripes, pockets, the chest print, a tee's sleeve, the hem of shorts — and each garment part takes its
// colour and fabric from the outfit (scripts/character/outfits.gd), so one mesh wears every outfit.
shader_type spatial;
render_mode cull_back;

uniform vec3 pal[32];             // linear colours, one per part (outfits.gd PARTS order)
uniform float grain[32];          // 0 plain cotton, 1 denim, 2 rib knit, 3 nylon / leather sheen
uniform vec3 skin = vec3(0.3, 0.16, 0.09);
// the body's landmarks, heights above the hip line in body heights (data/outfit_landmarks.json)
uniform float knee = -0.31;
uniform float ankle = -0.54;
uniform float floor_h = -0.66;
uniform float neck = 0.29;
uniform float shoulder = 0.25;
uniform float elbow = 0.13;
uniform float wrist = 0.02;
uniform float armpit = 0.1;
// which parts the outfit wears as modelled pieces instead (1 drawstrings, 2 kangaroo pocket, 4 cargo pockets): not painted too
uniform int pieces = 0;
// a crop top: the torso is bare below this height above the hip line (-1: covered)
uniform float crop = -1.0;
uniform float button = -9.0;      // a buttoned jacket: the shirt panel shows only above this height (formal wear, Nov 23)

varying flat int zone;
varying float jit;
varying float fwd;
varying vec3 lpos;

void vertex() {
	zone = clamp(int(round(COLOR.r * 255.0 / 20.0)), 0, 6);
	jit = COLOR.g;
	fwd = (COLOR.b - 0.5) * 0.5;
	lpos = VERTEX;
}

// part ids (outfits.gd PARTS)
const int SKIN = 0; const int ARM_STRIPE_HI = 1; const int SOLE = 2; const int MIDSOLE = 3; const int HEEL = 4;
const int FLASH = 5; const int TOE = 6; const int SHOE = 7; const int HOOD_OPEN = 8; const int HOOD = 9;
const int ARM_STRIPE = 10; const int SLEEVE_HI = 11; const int SLEEVE_LO = 12; const int WRIST = 13; const int FOREARM = 14;
const int ANKLE = 15; const int LEG_STRIPE = 16; const int CARGO_FLAP = 17; const int CARGO = 18; const int THIGH_HI = 19;
const int THIGH_LO = 20; const int KNEE = 21; const int SHIN = 22; const int HEM = 23; const int ZIP = 24; const int STRING = 25;
const int PRINT2 = 26; const int PRINT = 27; const int POCKET_EDGE = 28; const int POCKET = 29; const int INNER = 30; const int TOP = 31;

// lat: across the body; hh: height above the hip line; front / outn: the rest normal toward the front / the outside
int part_of(float lat, float hh, float front, float outn) {
	if (zone == 0) return SKIN;
	if (zone == 1) {
		float h = hh - floor_h;
		if (h < 0.016) return SOLE;
		if (h < 0.023) return MIDSOLE;
		if (front < -0.55 && h < 0.06) return HEEL;
		if (outn > 0.45 && h > 0.03 && h < 0.05) return FLASH;
		if (fwd > 0.09) return TOE;
		return SHOE;
	}
	if (zone == 2) {
		if (front > -0.1 && abs(lat) < 0.045 && hh < neck - 0.02 && hh > button && distance(pal[INNER], pal[TOP]) > 0.002) return INNER;   // an open jacket's shirt, up to the collar
		return hh > neck - 0.035 ? HOOD_OPEN : HOOD;
	}
	if (zone == 3) {
		if (abs(lat) < armpit * 0.92) return TOP;          // the side of the chest under the arm is the top's, not the sleeve's
		bool hi = hh > (shoulder + elbow) * 0.5;
		if (outn > 0.92 && hh < shoulder - 0.045) return hi ? ARM_STRIPE_HI : ARM_STRIPE;
		return hi ? SLEEVE_HI : SLEEVE_LO;
	}
	if (zone == 4) {
		if (hh < wrist + 0.035) return WRIST;
		return outn > 0.92 ? ARM_STRIPE : FOREARM;
	}
	if (hh < 0.0) {                                     // the legs (zones 5 and 6 meet on the hip line)
		if (hh > -0.05) return THIGH_HI;
		float k = hh - knee;
		if (hh - ankle < 0.04) return ANKLE;
		bool bare = distance(pal[KNEE], skin) < 0.002;
		if (outn > 0.95 && !(bare && k < 0.045)) return LEG_STRIPE;
		if ((pieces & 4) == 0 && outn > 0.4 && outn < 0.92 && k > 0.05 && k < 0.15) return k < 0.135 ? CARGO : CARGO_FLAP;
		if (k < -0.045) return SHIN;
		if (k < 0.045) return KNEE;
		if (k < 0.1) return THIGH_LO;
		return THIGH_HI;
	}
	if (hh < crop) return SKIN;
	if (hh < 0.025) return HEM;
	float pc = neck * 0.6;                              // the chest print's height, and the pocket below it, by the torso's length
	if (front > -0.1 && abs(lat) < 0.045 && distance(pal[INNER], pal[TOP]) > 0.002) {
		// an open jacket: a straight shirt panel down the front, its print on it
		if (abs(lat) < 0.008) return ZIP;
		return INNER;
	}
	if (front > 0.3) {
		float dn = neck - hh;
		if (abs(lat) < 0.008) return ZIP;
		if ((pieces & 1) == 0 && dn > 0.025 && dn < 0.1 && min(abs(lat - 0.03), abs(lat + 0.03)) < 0.0045) return STRING;
		float ptop = min(0.13, pc - 0.045);
		if ((pieces & 2) == 0 && hh > 0.035 && hh < ptop && abs(lat) < 0.085)
			return (abs(lat) > 0.075 || hh > ptop - 0.01) ? POCKET_EDGE : POCKET;
	}
	return TOP;
}

// The chest print: a round badge with a slash through it, edges smoothed by the pixel's footprint. The old print was a
// hard-cut rectangle split by the zip line and a stripe, and read as a pixelated logo (polish, Nov 22). Print2 fills the
// badge, print draws the ring and the slash; on a front whose zip shows, or an open jacket's shirt, it sits off the zip.
vec3 chest_print(vec3 c, int part, float lat, float hh) {
	if (part != TOP && part != INNER && !(part == ZIP && distance(pal[ZIP], pal[TOP]) <= 0.002)) return c;   // a hidden zip line takes the print too
	bool open = distance(pal[INNER], pal[TOP]) > 0.002;          // an open jacket: the badge is on the shirt panel
	// a zip that shows or modelled drawstrings down the front: a smaller badge on the left chest, clear of both (centred,
	// the strings hung either side of it like brackets)
	bool side = distance(pal[ZIP], pal[TOP]) > 0.002 || (pieces & 1) != 0;
	float r = open ? 0.014 : (side ? 0.016 : 0.026);
	vec2 p = open ? vec2(lat - 0.024, hh - neck * 0.6)
		: (side ? vec2(lat - 0.06, hh - (neck * 0.6 + 0.012)) : vec2(lat, hh - neck * 0.6));
	float d = length(p);
	if (d > r + 0.01) return c;
	float aa = max(fwidth(d), 1e-5);
	float w = r * 0.2;
	float disc = 1.0 - smoothstep(r - aa, r + aa, d);
	float fill = 1.0 - smoothstep(r - w - aa, r - w + aa, d);
	float ls = abs(dot(p, vec2(0.8, 0.6)));
	float la = max(fwidth(ls), 1e-5);
	float slash = (1.0 - smoothstep(w * 0.55 - la, w * 0.55 + la, ls)) * fill;
	if (open && part != INNER) return c;
	vec3 ink = open ? pal[PRINT2] : pal[PRINT];
	vec3 ground = open ? pal[INNER] : pal[PRINT2];
	c = mix(c, ground, fill);
	return mix(c, ink, clamp(disc - fill + slash, 0.0, 1.0));
}

// surface relief (GTA pass, Nov 22): a height field over the rest-pose zone coordinates (so it stays on the cloth as the
// body moves), lit as a bump from its screen-space slopes — soft folds and creases in fabric, fine pores on bare skin
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
}
vec3 bumped(vec3 n, vec3 pos, float h, float strength) {
	vec3 dpdx = dFdx(pos);
	vec3 dpdy = dFdy(pos);
	vec3 r1 = cross(dpdy, n);
	vec3 r2 = cross(n, dpdx);
	float det = dot(dpdx, r1);
	vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
	return normalize(abs(det) * n - grad * strength);
}

void fragment() {
	// glTF stores texture coordinates with V flipped (1 - v): undone here
	int part = part_of(UV.x, 1.0 - UV.y, UV2.x, 1.0 - UV2.y);
	vec3 c = (part == SKIN) ? skin : pal[part];
	if (zone >= 5 && 1.0 - UV.y > 0.0 && UV2.x > 0.3) c = chest_print(c, part, UV.x, 1.0 - UV.y);
	float g = grain[part];
	float shade = 0.97 + jit * 0.05;
	float rough = 0.88;
	if (g > 0.5 && g < 1.5) {          // denim: a diagonal twill
		float tw = sin((lpos.x + lpos.y + lpos.z) * 900.0) * 0.5 + 0.5;
		shade *= 0.93 + tw * 0.1;
	} else if (g > 1.5 && g < 2.5) {   // rib knit: fine ribs
		float rb = sin((lpos.x + lpos.z) * 700.0) * 0.5 + 0.5;
		shade *= 0.9 + rb * 0.12;
	} else if (g > 2.5) {              // nylon / leather: smoother, a soft sheen (0.42 read as latex)
		rough = 0.62;
	}
	vec2 q = vec2(UV.x + float(zone) * 3.1, 1.0 - UV.y);   // body heights; zones apart so seams don't line up
	if (part == SKIN) {
		// bare skin: softer and a little translucent like the heads beside it, faint mottling, fine pores
		float mott = vn2(q * 60.0) * 0.6 + vn2(q * 180.0) * 0.4;
		c *= 0.94 + 0.1 * mott;
		ALBEDO = c;
		ROUGHNESS = 0.5 + 0.12 * vn2(q * 300.0);
		SPECULAR = 0.5;
		BACKLIGHT = c * 0.35;
		NORMAL = bumped(NORMAL, VERTEX, vn2(q * 700.0) * 0.7 + vn2(q * 1600.0) * 0.3, 0.0009);
	} else {
		// fabric: soft folds running round the limbs and body, finer creases, and the weave catching the light
		float fold = vn2(vec2(q.x * 9.0, q.y * 30.0)) * 0.65 + vn2(vec2(q.x * 26.0, q.y * 75.0) + 7.3) * 0.35;
		if (g > 2.5) fold *= 0.6;                          // nylon / leather: taut
		shade *= 0.9 + 0.14 * fold;
		ALBEDO = c * shade;
		ROUGHNESS = rough;
		SPECULAR = 0.35;
		NORMAL = bumped(NORMAL, VERTEX, fold, g > 2.5 ? 0.006 : 0.011);
		// a soft sheen across the fibres at grazing angles (cloth catches light at its edges)
		float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
		ALBEDO += c * rim * (g > 2.5 ? 0.06 : 0.18);
	}
}
