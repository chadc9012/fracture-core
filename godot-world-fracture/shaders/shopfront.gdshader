shader_type spatial;
// The street-level shopfronts along the Nexus / Neon avenues (GTA pass, owner Nov 11: Phase 2 "storefronts, realistic
// architecture"; the fleet towers' ground floors read as black bands). One quad per building, the whole shop drawn here:
//   - shop windows in bays with a kick plate, mullions and a transom, the glass reflecting (low roughness + fresnel)
//   - INTERIOR MAPPING behind the glass, the trick GTA-era games use for shops: the view ray is traced into a box room
//     per bay (side walls, floor tiles, a back wall of stocked shelves or a counter, ceiling light panels), so every
//     window has a lit room with real parallax and no geometry
//   - a sign band over each shop (three bays) with a lit strip in the shop's colour and block lettering
//   - now and then a shop with its roller shutter down
// World-space: the quad's own position along the street (z) and height (y) drive everything, so the static batcher can
// merge every front of a block into one mesh. `night` turns the shops' light up.
render_mode cull_back;

uniform float night = 0.0;
uniform float base_y = 0.18;
uniform float bay = 3.4;
uniform float room_h = 3.3;
uniform float depth = 4.5;

varying vec3 wp;
varying vec3 wn;

float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float u = wp.z;
	float v = wp.y - base_y;
	float side = sign(wn.x + 1e-4);
	float bay_i = floor(u / bay);
	float lu = (u / bay - bay_i) * bay;
	// mirror the bay on the far side so "left" in the room is the viewer's left on both sides of the street
	float shop_i = floor(bay_i / 3.0);
	float hs = hash2(vec2(shop_i, side * 7.0));
	float hb = hash2(vec2(bay_i, side * 3.0 + 1.0));
	float fw = max(fwidth(u), 1e-4);
	float detail = 1.0 - smoothstep(0.06, 0.2, fw);
	bool shut = hs < 0.1;

	vec3 frame = vec3(0.06, 0.065, 0.07);
	vec3 shop_col = hue(hs * 0.83 + 0.05);
	float lit_night = mix(0.35, 1.0, night);

	vec3 albedo = frame;
	vec3 emit = vec3(0.0);
	float rough = 0.4;
	float metal = 0.6;

	if (v < 0.28) {
		// kick plate: dark stone
		albedo = vec3(0.12, 0.12, 0.13);
		rough = 0.6;
		metal = 0.0;
	} else if (v < room_h) {
		float edge = min(lu, bay - lu);
		float mull = 1.0 - smoothstep(0.05 - fw, 0.05 + fw, edge);
		float transom = 1.0 - smoothstep(0.03 - fw, 0.03 + fw, abs(v - (room_h - 0.55)));
		float frame_k = max(mull, transom * step(0.5, hb));
		if (shut) {
			// a roller shutter: ribbed steel
			float rib = 0.5 + 0.5 * sin(v * 60.0);
			albedo = mix(vec3(0.42, 0.43, 0.45), vec3(0.3, 0.31, 0.33), rib * detail) * (0.8 + 0.2 * hash2(vec2(bay_i, 9.0)));
			rough = 0.5;
			metal = 0.7;
		} else {
			// --- the room behind the glass
			vec3 d = normalize(wp - CAMERA_POSITION_WORLD);
			vec3 into = -wn;
			vec3 t = vec3(0.0, 0.0, 1.0);
			vec3 dl = vec3(dot(d, t), d.y, max(dot(d, into), 1e-3));
			vec3 p = vec3(lu, v, 0.0);
			float tx = dl.x > 0.0 ? (bay - p.x) / dl.x : -p.x / min(dl.x, -1e-4);
			float ty = dl.y > 0.0 ? (room_h - p.y) / dl.y : -p.y / min(dl.y, -1e-4);
			float tz = depth / dl.z;
			float tm = min(min(tx, ty), tz);
			vec3 h = p + dl * tm;
			vec3 wall = mix(vec3(0.85, 0.82, 0.76), shop_col * 0.6 + 0.3, 0.35 + 0.3 * hs);
			vec3 room;
			float kind = hash2(vec2(shop_i, 5.0));
			if (tm == tz) {
				// back wall: shelves of stock, or a counter with a menu board (cafés)
				room = wall;
				if (kind < 0.65) {
					float row = fract(h.y / 0.45);
					float shelf = step(0.6, h.y) * step(h.y, 2.4);
					float item = hash2(vec2(floor(h.x * 6.0), floor(h.y / 0.45) + bay_i * 13.0));
					vec3 stock = hue(item) * 0.55 + 0.25;
					room = mix(room, stock, shelf * step(0.12, row) * step(item, 0.85));
					room = mix(room, vec3(0.2), shelf * (1.0 - step(0.08, row)));
				} else {
					float counter = step(h.y, 1.05);
					room = mix(room, vec3(0.25, 0.17, 0.12), counter);
					float board = step(1.7, h.y) * step(h.y, 2.4) * step(0.6, h.x) * step(h.x, bay - 0.6);
					room = mix(room, vec3(0.08), board);
				}
			} else if (tm == ty) {
				if (dl.y > 0.0) {
					// ceiling: light panels
					float panel = step(0.6, fract(h.x / 1.1)) * step(0.5, fract(h.z / 1.5));
					room = vec3(0.7) + vec3(1.6, 1.5, 1.35) * panel;
				} else {
					// floor tiles
					float tile = mod(floor(h.x / 0.6) + floor(h.z / 0.6), 2.0);
					room = mix(vec3(0.55, 0.53, 0.5), vec3(0.4, 0.39, 0.37), tile);
				}
			} else {
				room = wall * 0.8;
				// racks along the side walls
				float rack = step(0.5, h.y) * step(h.y, 2.2) * step(0.8, h.z);
				room = mix(room, hue(hash2(vec2(floor(h.z * 2.0), bay_i)) ) * 0.5 + 0.2, rack * 0.6);
			}
			// warm or cool shop light, dimmer deeper in
			vec3 light = mix(vec3(1.0, 0.86, 0.68), vec3(0.85, 0.93, 1.0), step(0.6, hs));
			room *= light * mix(1.0, 0.75, clamp(h.z / depth, 0.0, 1.0));
			float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
			albedo = mix(vec3(0.02, 0.025, 0.03), frame, frame_k);
			emit = room * (1.0 - frame_k) * (1.0 - fres * 0.7) * lit_night * 0.9;
			rough = mix(0.04, 0.4, frame_k);
			metal = mix(0.0, 0.6, frame_k);
		}
	} else {
		// sign band over the shop: dark panel, a lit strip in the shop colour, block lettering in the middle
		albedo = vec3(0.05, 0.05, 0.06);
		rough = 0.5;
		metal = 0.3;
		float su = fract(u / (bay * 3.0));
		float sv = v - room_h;
		float strip = 1.0 - smoothstep(0.02, 0.04, abs(sv - 0.08));
		// the shop's name as block letters: 3x5-cell glyphs with a gap between, centred on the shop (pixel-font lettering
		// reads as a word at a glance; random noise read as a glitch)
		float sw = bay * 3.0;
		float n_ch = 4.0 + floor(hs * 6.0);
		float ch_w = 0.36;
		float word = n_ch * ch_w;
		float x0 = su * sw - (sw - word) * 0.5;
		float ci = floor(x0 / ch_w);
		vec2 g = vec2(fract(x0 / ch_w) * 1.25, (sv - 0.24) / 0.36);
		float inside = step(0.0, x0) * step(x0, word) * step(0.0, g.x) * step(g.x, 1.0) * step(0.0, g.y) * step(g.y, 1.0);
		vec2 cell = floor(g * vec2(3.0, 5.0));
		float on = step(0.42, hash2(vec2(ci + shop_i * 17.0, cell.x + cell.y * 3.0)));
		// every glyph keeps a spine so it reads as a letter
		on = max(on, step(cell.x, 0.5) * step(0.5, hash2(vec2(ci, shop_i))));
		float letters = inside * on;
		emit = shop_col * (strip * 1.5 + letters * 1.2) * mix(0.5, 2.2, night) * detail;
		emit += shop_col * (strip + letters) * 0.4 * (1.0 - detail);
		if (shut) emit *= 0.2;
	}
	ALBEDO = albedo;
	EMISSION = emit;
	ROUGHNESS = rough;
	METALLIC = metal;
	SPECULAR = 0.6;
}
