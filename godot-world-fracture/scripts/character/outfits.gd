extends RefCounted
## The operator's own clothes (owner, Nov 10-11: "regular civilian clothing, urban style" ... "more"). Every civ body
## carries the id of the garment part under each vertex (scripts/build-operator-civilian.py); an outfit is a colour and a
## fabric for each part, so a sleeve can stop at the elbow (a tee), a leg at the knee (shorts), a front open on a shirt
## (a jacket). The look's "outfit" picks one; the creator's OUTFIT tab lists them.

const SHADER := preload("res://scripts/character/outfit.gdshader")

## the part ids, in the order the builder numbers them
const PARTS := ["skin", "arm_stripe_hi", "sole", "midsole", "heel", "flash", "toe", "shoe", "hood_open", "hood", "arm_stripe", "sleeve_hi",
	"sleeve_lo", "wrist", "forearm", "ankle", "leg_stripe", "cargo_flap", "cargo", "thigh_hi", "thigh_lo", "knee", "shin",
	"hem", "zip", "string", "print2", "print", "pocket_edge", "pocket", "inner", "top"]

const PLAIN := 0
const DENIM := 1
const RIB := 2
const SHEEN := 3

## each outfit: a name, the cut it suits (both, or one), and the colours of its pieces. Pieces not given take the
## garment's main colour; "SKIN" bares the part.
const LIST := [
	{ "id": "street-hoodie", "name": "Street Hoodie", "for": "male", "c": {
		"top": "131315", "rib": "0d0d0f", "print": "d92420", "print2": "f2f2ee", "string": "ebebe6",
		"legs": "3d3d42", "legs2": "2c2c30", "stripe": "eeeeea", "shoe": "f0f0ec", "accent": "d92420", "sole": "f5f5f2", "midsole": "121214", "toe": "cfcfcf" } },
	{ "id": "sand-hoodie", "name": "Sand Hoodie & Cargos", "for": "female", "c": {
		"top": "cdbda4", "rib": "b3a38b", "print": "151517", "print2": "cdbda4", "string": "1e1e1e",
		"legs": "4a4f33", "legs2": "3b402a", "stripe": "LEGS", "shoe": "f2f2ef", "accent": "151517", "sole": "f7f7f4", "midsole": "d9a86b", "toe": "d9d9d7" } },
	{ "id": "bomber", "name": "Bomber Jacket", "c": {
		"top": "3f4a2c", "fabric": SHEEN, "rib": "141414", "hood": "141414", "zip": "c9a54a", "inner": "efefeb", "string": "INNER",
		"print": "111111", "print2": "e0412f", "pocket": "INNER", "pocket_edge": "INNER",
		"legs": "1b1c20", "legs2": "16171a", "stripe": "LEGS", "legs_fabric": DENIM, "shoe": "f0f0ec", "accent": "141414", "sole": "f5f5f2", "midsole": "f5f5f2", "toe": "e6e6e3" } },
	{ "id": "tee-shorts", "name": "Tee & Shorts", "c": {
		"top": "f1f1ee", "rib": "e6e6e2", "hood": "f1f1ee", "hood_open": "e6e6e2", "string": "TOP", "pocket": "TOP", "pocket_edge": "TOP",
		"print": "f08a24", "print2": "1a1a1a", "sleeve_lo": "SKIN", "forearm": "SKIN", "wrist": "SKIN", "arm_stripe_lo": "SKIN",
		"legs": "1c1c1f", "legs2": "1c1c1f", "stripe": "LEGS", "knee": "SKIN", "shin": "SKIN", "ankle": "fafafa",
		"shoe": "18181a", "accent": "f5f5f2", "sole": "f5f5f2", "midsole": "18181a", "toe": "18181a" } },
	{ "id": "tracksuit", "name": "Tracksuit", "c": {
		"top": "1f3fa3", "fabric": SHEEN, "rib": "1a3285", "zip": "f2f2ee", "stripe_arm": "f2f2ee", "print": "TOP", "print2": "TOP", "string": "TOP",
		"pocket": "TOP", "pocket_edge": "TOP", "legs": "1f3fa3", "legs2": "1a3285", "stripe": "f2f2ee", "legs_fabric": SHEEN, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "121214", "accent": "f2f2ee", "sole": "f2f2ee", "midsole": "121214", "toe": "121214" } },
	{ "id": "varsity", "name": "Varsity Jacket", "c": {
		"top": "8f1c22", "rib": "121214", "hood": "121214", "sleeve": "e9e1cf", "fabric": PLAIN, "zip": "e9e1cf", "inner": "f3f3f0",
		"print": "8f1c22", "print2": "f3f3f0", "string": "INNER", "pocket": "INNER", "pocket_edge": "INNER",
		"legs": "35507a", "legs2": "2b4266", "stripe": "LEGS", "legs_fabric": DENIM, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "f3f3f0", "accent": "8f1c22", "sole": "f5f5f2", "midsole": "f5f5f2", "toe": "e9e9e6" } },
	{ "id": "denim", "name": "Denim Jacket", "c": {
		"top": "3e5f8a", "fabric": DENIM, "rib": "34507a", "hood": "34507a", "zip": "b98a45", "inner": "17171a", "string": "INNER",
		"print": "17171a", "print2": "c8c8c4", "pocket": "INNER", "pocket_edge": "INNER",
		"legs": "7f9bbd", "legs2": "6e89aa", "stripe": "LEGS", "legs_fabric": DENIM, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "8a5a33", "accent": "6e4526", "sole": "2a211a", "midsole": "2a211a", "toe": "7a4e2b" } },
	{ "id": "techwear", "name": "Techwear", "c": {
		"top": "111214", "fabric": SHEEN, "rib": "0b0b0d", "zip": "5e6266", "print": "111214", "print2": "8a9096", "string": "5e6266",
		"stripe_arm": "8a9096", "legs": "18191c", "legs2": "0f1012", "stripe": "8a9096", "legs_fabric": SHEEN, "cargo_flap": "5e6266",
		"shoe": "1c1d20", "accent": "8a9096", "sole": "0e0e10", "midsole": "8a9096", "toe": "26272b" } },
	{ "id": "pastel-set", "name": "Pastel Set", "c": {
		"top": "e8b4c4", "rib": "d79fb1", "print": "ffffff", "print2": "e8b4c4", "string": "ffffff",
		"legs": "e8b4c4", "legs2": "d79fb1", "stripe": "ffffff", "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "fafaf8", "accent": "e8b4c4", "sole": "fafaf8", "midsole": "fafaf8", "toe": "ededeb" } },
	{ "id": "workwear", "name": "Work Jacket", "c": {
		"top": "a07a45", "rib": "8a683a", "hood": "4a3a28", "hood_open": "4a3a28", "zip": "3a2e22", "inner": "ecebe6", "string": "INNER",
		"print": "ecebe6", "print2": "ecebe6", "pocket": "INNER", "pocket_edge": "INNER",
		"legs": "23314a", "legs2": "1d293e", "stripe": "LEGS", "legs_fabric": DENIM, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "5a3b22", "accent": "3d2716", "sole": "1e1813", "midsole": "1e1813", "toe": "4e321c" } },
]

static var _landmarks: Dictionary = {}

## a civ body's knee, ankle, floor, neck, shoulder, elbow and wrist heights (data/outfit_landmarks.json, written by the
## builder) for the outfit shader
static func landmarks(body_name: String) -> Dictionary:
	if _landmarks.is_empty():
		var f := FileAccess.open("res://data/outfit_landmarks.json", FileAccess.READ)
		if f:
			var v: Variant = JSON.parse_string(f.get_as_text())
			if v is Dictionary:
				_landmarks = v
	return _landmarks.get(body_name, {})

static func ids() -> Array:
	return LIST.map(func(o: Dictionary) -> String: return o.id)

static func find(id: String) -> Dictionary:
	for o: Dictionary in LIST:
		if o.id == id:
			return o
	return {}

## the outfit a cut starts in
static func default_for(body: String) -> String:
	return "sand-hoodie" if body == "female" else "street-hoodie"

static func _col(v: Variant) -> Color:
	return Color.html(String(v))

## the colour and fabric of every part for an outfit, and the hands' skin
static func material(id: String, skin: Color) -> ShaderMaterial:
	var o := find(id)
	if o.is_empty():
		o = find("street-hoodie")
	var c: Dictionary = o.c
	var top_f := int(c.get("fabric", PLAIN))
	var leg_f := int(c.get("legs_fabric", PLAIN))
	var named := {
		"top": c.top, "rib": c.get("rib", c.top), "legs": c.legs, "legs2": c.get("legs2", c.legs),
		"inner": c.get("inner", c.top), "skin": "SKIN",
	}
	# what each part is, before the outfit's own choices: [colour key, fabric]
	var base := {
		"sole": ["sole", PLAIN], "midsole": ["midsole", PLAIN], "heel": ["accent", PLAIN], "flash": ["accent", PLAIN], "toe": ["toe", PLAIN], "shoe": ["shoe", PLAIN],
		"hood_open": ["rib", RIB], "hood": ["hood", top_f], "arm_stripe_hi": ["stripe_arm", top_f], "arm_stripe": ["stripe_arm", top_f], "sleeve_hi": ["sleeve", top_f],
		"sleeve_lo": ["sleeve", top_f], "wrist": ["rib", RIB], "forearm": ["sleeve", top_f],
		"ankle": ["legs2", RIB], "leg_stripe": ["stripe", leg_f], "cargo_flap": ["cargo_flap", leg_f], "cargo": ["cargo", leg_f],
		"thigh_hi": ["legs", leg_f], "thigh_lo": ["legs", leg_f], "knee": ["knee", leg_f], "shin": ["shin", leg_f],
		"hem": ["rib", RIB], "zip": ["zip", top_f], "string": ["string", PLAIN], "print2": ["print2", PLAIN], "print": ["print", PLAIN],
		"pocket_edge": ["pocket_edge", top_f], "pocket": ["pocket", top_f], "inner": ["inner", PLAIN], "top": ["top", top_f],
	}
	var fallback := { "hood": "top", "stripe_arm": "sleeve", "sleeve": "top", "cargo_flap": "legs2", "cargo": "legs2", "knee": "legs",
		"shin": "legs", "zip": "top", "pocket_edge": "rib", "pocket": "top", "accent": "shoe", "toe": "shoe", "midsole": "sole", "stripe": "legs" }
	var pal := PackedVector3Array()
	var grain := PackedFloat32Array()
	pal.resize(32)
	grain.resize(32)
	for i in PARTS.size():
		var part: String = PARTS[i]
		if i == 0:
			pal[i] = Vector3(skin.r, skin.g, skin.b)
			continue
		var key: String = base[part][0]
		var fab: int = base[part][1]
		# the outfit can name the part itself (shorts: "knee": SKIN), or the piece it belongs to
		var v: Variant = c.get(part, c.get(key, null))
		if part == "arm_stripe" and c.has("arm_stripe_lo"):
			v = c.arm_stripe_lo
		var guard := 0
		while v == null and guard < 4:
			key = String(fallback.get(key, "top"))
			v = c.get(key, named.get(key, null))
			guard += 1
		var s := String(v if v != null else c.top)
		if s == "SKIN":
			pal[i] = Vector3(skin.r, skin.g, skin.b)
			fab = PLAIN
		else:
			if named.has(s.to_lower()):
				s = String(named[s.to_lower()])
			var col := _col(s).srgb_to_linear()
			pal[i] = Vector3(col.r, col.g, col.b)
		grain[i] = float(fab)
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("pal", pal)
	m.set_shader_parameter("grain", grain)
	m.set_shader_parameter("skin", Vector3(skin.r, skin.g, skin.b))
	return m
