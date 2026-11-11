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
		if (front > -0.1 && abs(lat) < 0.045 && hh < neck - 0.02 && distance(pal[INNER], pal[TOP]) > 0.002) return INNER;   // an open jacket's shirt, up to the collar
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
		if (abs(hh - pc) < 0.007 && abs(lat) < 0.04) return PRINT2;
		return INNER;
	}
	if (front > 0.3) {
		float dn = neck - hh;
		if (abs(lat) < 0.008) return ZIP;
		if ((pieces & 1) == 0 && dn > 0.025 && dn < 0.1 && min(abs(lat - 0.03), abs(lat + 0.03)) < 0.0045) return STRING;
		if (abs(hh - pc) < 0.03 && abs(lat) < 0.06)
			return (abs(hh - pc) < 0.007 && abs(lat) < 0.046) ? PRINT2 : PRINT;
		float ptop = min(0.13, pc - 0.045);
		if ((pieces & 2) == 0 && hh > 0.035 && hh < ptop && abs(lat) < 0.085)
			return (abs(lat) > 0.075 || hh > ptop - 0.01) ? POCKET_EDGE : POCKET;
	}
	return TOP;
}

void fragment() {
	// glTF stores texture coordinates with V flipped (1 - v): undone here
	int part = part_of(UV.x, 1.0 - UV.y, UV2.x, 1.0 - UV2.y);
	vec3 c = (part == SKIN) ? skin : pal[part];
	float g = grain[part];
	float shade = 0.97 + jit * 0.05;
	float rough = 0.88;
	if (g > 0.5 && g < 1.5) {          // denim: a diagonal twill
		float tw = sin((lpos.x + lpos.y + lpos.z) * 900.0) * 0.5 + 0.5;
		shade *= 0.93 + tw * 0.1;
	} else if (g > 1.5 && g < 2.5) {   // rib knit: fine ribs
		float rb = sin((lpos.x + lpos.z) * 700.0) * 0.5 + 0.5;
		shade *= 0.9 + rb * 0.12;
	} else if (g > 2.5) {              // nylon / leather: smoother, a sheen
		rough = 0.42;
	}
	ALBEDO = c * shade;
	ROUGHNESS = rough;
	SPECULAR = 0.35;
}
