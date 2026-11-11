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

## the modelled garment pieces on every civ body (Piece_<kind> meshes, scripts/build-operator-civilian.py part 4) and the
## part of the palette each takes its colour and fabric from; an outfit's "pieces" says which it wears
const PIECE_PART := { "cuffs": "wrist", "sleeve_hems": "sleeve_hi", "shorts_hems": "thigh_lo", "ankle_cuffs": "ankle", "hem": "hem",
	"rib_collar": "hood_open", "shirt_collar": "hood", "strings": "string", "pocket": "pocket", "cargo": "cargo", "hood": "hood" }
## pieces the shader then leaves unpainted (outfit.gdshader `pieces`)
const PIECE_BIT := { "strings": 1, "pocket": 2, "cargo": 4 }

## a tank top's bare arms; a bare chest (outfit flags "tank", "bare_top")
const BARE_ARMS := ["sleeve_hi", "sleeve_lo", "forearm", "wrist", "arm_stripe", "arm_stripe_hi"]
const BARE_TOP := ["top", "hem", "zip", "string", "print", "print2", "pocket", "pocket_edge", "inner", "hood", "hood_open"]

const PLAIN := 0
const DENIM := 1
const RIB := 2
const SHEEN := 3

## each outfit: a name, the cut it suits (both, or one), and the colours of its pieces. Pieces not given take the
## garment's main colour; "SKIN" bares the part.
const LIST := [
	{ "id": "street-hoodie", "pieces": ["hood", "hem", "cuffs", "strings", "pocket", "ankle_cuffs", "cargo"], "name": "Street Hoodie", "for": "male", "c": {
		"top": "131315", "rib": "0d0d0f", "print": "d92420", "print2": "f2f2ee", "string": "ebebe6",
		"legs": "3d3d42", "legs2": "2c2c30", "stripe": "eeeeea", "shoe": "f0f0ec", "accent": "d92420", "sole": "f5f5f2", "midsole": "121214", "toe": "cfcfcf" } },
	{ "id": "sand-hoodie", "pieces": ["hood", "hem", "cuffs", "strings", "pocket", "cargo", "ankle_cuffs"], "name": "Sand Hoodie & Cargos", "for": "female", "c": {
		"top": "cdbda4", "rib": "b3a38b", "print": "151517", "print2": "cdbda4", "string": "1e1e1e",
		"legs": "4a4f33", "legs2": "3b402a", "stripe": "LEGS", "shoe": "f2f2ef", "accent": "151517", "sole": "f7f7f4", "midsole": "d9a86b", "toe": "d9d9d7" } },
	{ "id": "bomber", "pieces": ["rib_collar", "hem", "cuffs"], "name": "Bomber Jacket", "c": {
		"top": "3f4a2c", "fabric": SHEEN, "rib": "141414", "hood": "141414", "zip": "c9a54a", "inner": "efefeb", "string": "INNER",
		"print": "111111", "print2": "e0412f", "pocket": "TOP", "pocket_edge": "TOP",
		"legs": "1b1c20", "legs2": "16171a", "stripe": "LEGS", "legs_fabric": DENIM, "shoe": "f0f0ec", "accent": "141414", "sole": "f5f5f2", "midsole": "f5f5f2", "toe": "e6e6e3" } },
	{ "id": "tee-shorts", "pieces": ["sleeve_hems", "shorts_hems"], "name": "Tee & Shorts", "c": {
		"top": "f1f1ee", "rib": "e6e6e2", "hood": "f1f1ee", "hood_open": "e6e6e2", "string": "TOP", "pocket": "TOP", "pocket_edge": "TOP",
		"print": "f08a24", "print2": "1a1a1a", "sleeve_lo": "SKIN", "forearm": "SKIN", "wrist": "SKIN", "arm_stripe_lo": "SKIN",
		"legs": "1c1c1f", "legs2": "1c1c1f", "stripe": "LEGS", "knee": "SKIN", "shin": "SKIN", "ankle": "fafafa",
		"shoe": "18181a", "accent": "f5f5f2", "sole": "f5f5f2", "midsole": "18181a", "toe": "18181a" } },
	{ "id": "tracksuit", "pieces": ["rib_collar", "hem", "cuffs", "ankle_cuffs"], "name": "Tracksuit", "c": {
		"top": "1f3fa3", "fabric": SHEEN, "rib": "1a3285", "zip": "f2f2ee", "stripe_arm": "f2f2ee", "print": "TOP", "print2": "TOP", "string": "TOP",
		"pocket": "TOP", "pocket_edge": "TOP", "legs": "1f3fa3", "legs2": "1a3285", "stripe": "f2f2ee", "legs_fabric": SHEEN, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "121214", "accent": "f2f2ee", "sole": "f2f2ee", "midsole": "121214", "toe": "121214" } },
	{ "id": "varsity", "pieces": ["rib_collar", "hem", "cuffs"], "name": "Varsity Jacket", "c": {
		"top": "8f1c22", "rib": "121214", "hood": "121214", "sleeve": "e9e1cf", "fabric": PLAIN, "zip": "e9e1cf", "inner": "f3f3f0",
		"print": "8f1c22", "print2": "f3f3f0", "string": "INNER", "pocket": "TOP", "pocket_edge": "TOP",
		"legs": "35507a", "legs2": "2b4266", "stripe": "LEGS", "legs_fabric": DENIM, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "f3f3f0", "accent": "8f1c22", "sole": "f5f5f2", "midsole": "f5f5f2", "toe": "e9e9e6" } },
	{ "id": "denim", "pieces": ["shirt_collar", "hem", "cuffs"], "name": "Denim Jacket", "c": {
		"top": "3e5f8a", "fabric": DENIM, "rib": "34507a", "hood": "34507a", "zip": "b98a45", "inner": "17171a", "string": "INNER",
		"print": "17171a", "print2": "c8c8c4", "pocket": "TOP", "pocket_edge": "TOP",
		"legs": "7f9bbd", "legs2": "6e89aa", "stripe": "LEGS", "legs_fabric": DENIM, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "8a5a33", "accent": "6e4526", "sole": "2a211a", "midsole": "2a211a", "toe": "7a4e2b" } },
	{ "id": "techwear", "pieces": ["rib_collar", "cuffs", "cargo", "ankle_cuffs"], "name": "Techwear", "c": {
		"top": "111214", "fabric": SHEEN, "rib": "0b0b0d", "zip": "5e6266", "print": "111214", "print2": "8a9096", "string": "5e6266",
		"stripe_arm": "8a9096", "legs": "18191c", "legs2": "0f1012", "stripe": "8a9096", "legs_fabric": SHEEN, "cargo_flap": "5e6266",
		"shoe": "1c1d20", "accent": "8a9096", "sole": "0e0e10", "midsole": "8a9096", "toe": "26272b" } },
	{ "id": "pastel-set", "pieces": ["hood", "hem", "cuffs", "strings", "pocket", "ankle_cuffs"], "name": "Pastel Set", "c": {
		"top": "e8b4c4", "rib": "d79fb1", "print": "ffffff", "print2": "e8b4c4", "string": "ffffff",
		"legs": "e8b4c4", "legs2": "d79fb1", "stripe": "ffffff", "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "fafaf8", "accent": "e8b4c4", "sole": "fafaf8", "midsole": "fafaf8", "toe": "ededeb" } },
	{ "id": "workwear", "pieces": ["shirt_collar", "hem", "cuffs"], "name": "Work Jacket", "c": {
		"top": "a07a45", "rib": "8a683a", "hood": "4a3a28", "hood_open": "4a3a28", "zip": "3a2e22", "inner": "ecebe6", "string": "INNER",
		"print": "ecebe6", "print2": "ecebe6", "pocket": "TOP", "pocket_edge": "TOP",
		"legs": "23314a", "legs2": "1d293e", "stripe": "LEGS", "legs_fabric": DENIM, "cargo": "LEGS", "cargo_flap": "LEGS",
		"shoe": "5a3b22", "accent": "3d2716", "sole": "1e1813", "midsole": "1e1813", "toe": "4e321c" } },
	# colourways of the cuts above ("base"): their own colours over the base outfit's
	{ "id": "heather-hoodie", "name": "Heather Hoodie", "base": "street-hoodie", "c": {
		"top": "8a8c90", "rib": "76787c", "print": "15171a", "print2": "8a8c90", "string": "15171a",
		"legs": "1b1c20", "legs2": "141518", "stripe": "LEGS", "shoe": "15171a", "accent": "f2f2ee", "sole": "f2f2ee", "midsole": "15171a", "toe": "15171a" } },
	{ "id": "sunset-tee", "name": "Sunset Tee & Khakis", "base": "tee-shorts", "c": {
		"top": "e8794a", "rib": "d96a3c", "hood": "e8794a", "hood_open": "d96a3c", "print": "fff4e0", "print2": "e8794a",
		"legs": "cbbd9c", "legs2": "b9ab8a", "ankle": "f5f5f2", "shoe": "f5f5f2", "accent": "e8794a", "midsole": "f5f5f2", "toe": "e6e6e3" } },
	{ "id": "crimson-tracksuit", "name": "Crimson Tracksuit", "base": "tracksuit", "c": {
		"top": "a3201f", "rib": "851a19", "legs": "a3201f", "legs2": "851a19", "stripe": "f2f2ee", "stripe_arm": "f2f2ee", "zip": "f2f2ee" } },
	{ "id": "midnight-varsity", "name": "Midnight Varsity", "base": "varsity", "c": {
		"top": "15171c", "sleeve": "d9d9d4", "rib": "8f1c22", "hood": "8f1c22", "print": "15171c", "print2": "d9d9d4",
		"legs": "1b1c20", "legs2": "16171a", "shoe": "15171c", "accent": "d9d9d4", "sole": "f2f2ee", "midsole": "f2f2ee", "toe": "1b1c20" } },
	{ "id": "black-denim", "name": "Black Denim Jacket", "base": "denim", "c": {
		"top": "26272c", "rib": "1f2024", "hood": "1f2024", "zip": "b0b3b8", "inner": "f2f2ee", "print": "f2f2ee", "print2": "26272c",
		"legs": "3a3c42", "legs2": "303237", "shoe": "f2f2ee", "accent": "1a1a1c", "sole": "f2f2ee", "midsole": "f2f2ee", "toe": "e6e6e3" } },
	{ "id": "olive-utility", "name": "Olive Utility", "base": "techwear", "c": {
		"top": "3d4630", "rib": "323a27", "zip": "c9a54a", "print": "3d4630", "print2": "c9a54a", "string": "c9a54a", "stripe_arm": "3d4630",
		"legs": "4a4f33", "legs2": "3b402a", "stripe": "LEGS", "cargo_flap": "3b402a", "shoe": "5a3b22", "accent": "3d2716", "sole": "1e1813", "midsole": "1e1813", "toe": "4e321c" } },
	# work uniforms for the people in the city's buildings (owner's NPC lineup board, Nov 11: police, doctors, chefs,
	# firefighters, construction, paramedics, bartenders, security, office staff; city interiors, interiors.gd).
	# Colourways of the cuts above; `uniform` keeps them out of the shops' racks.
	{ "id": "uniform-police", "name": "Police Uniform", "base": "workwear", "uniform": true, "c": {
		"top": "1c2840", "rib": "16213a", "hood": "16213a", "hood_open": "16213a", "zip": "c9a54a", "inner": "1c2840", "print": "c9a54a", "print2": "1c2840",
		"pocket": "TOP", "legs": "1a2234", "legs2": "151c2c", "legs_fabric": PLAIN, "shoe": "0e0f12", "accent": "0e0f12", "sole": "0e0f12", "midsole": "0e0f12", "toe": "0e0f12" } },
	{ "id": "uniform-security", "name": "Security", "base": "bomber", "uniform": true, "c": {
		"top": "131417", "rib": "0e0f12", "print": "e8e8e2", "print2": "131417", "legs": "1b1c20", "legs2": "16171a", "shoe": "0e0f12", "accent": "0e0f12", "sole": "0e0f12", "midsole": "0e0f12", "toe": "0e0f12" } },
	{ "id": "uniform-doctor", "name": "Doctor's Coat", "base": "denim", "uniform": true, "c": {
		"top": "f1f2f0", "rib": "e2e4e2", "hood": "e2e4e2", "zip": "c8cbcc", "inner": "6f8fae", "print": "6f8fae", "print2": "f1f2f0",
		"legs": "4b5d74", "legs2": "425268", "legs_fabric": PLAIN, "shoe": "26282c", "accent": "26282c", "sole": "f2f2ee", "midsole": "26282c", "toe": "26282c" } },
	{ "id": "uniform-scrubs", "name": "Scrubs", "base": "tracksuit", "uniform": true, "c": {
		"top": "2d8c8a", "rib": "267876", "legs": "2d8c8a", "legs2": "267876", "stripe": "2d8c8a", "stripe_arm": "2d8c8a", "zip": "2d8c8a",
		"shoe": "f2f2ee", "accent": "f2f2ee", "sole": "f2f2ee", "midsole": "f2f2ee", "toe": "e6e6e3" } },
	{ "id": "uniform-paramedic", "name": "Paramedic", "base": "tracksuit", "uniform": true, "c": {
		"top": "b3221e", "rib": "931c19", "legs": "1d2433", "legs2": "171d2a", "stripe": "e8e84a", "stripe_arm": "e8e84a", "zip": "1d2433",
		"shoe": "0e0f12", "accent": "0e0f12", "sole": "0e0f12", "midsole": "0e0f12", "toe": "0e0f12" } },
	{ "id": "uniform-chef", "name": "Chef's Whites", "base": "denim", "uniform": true, "c": {
		"top": "f4f4f0", "rib": "e6e6e1", "hood": "e6e6e1", "zip": "1a1a1c", "inner": "f4f4f0", "print": "1a1a1c", "print2": "f4f4f0",
		"legs": "2a2a2c", "legs2": "222224", "legs_fabric": PLAIN, "shoe": "0e0f12", "accent": "0e0f12", "sole": "0e0f12", "midsole": "0e0f12", "toe": "0e0f12" } },
	{ "id": "uniform-firefighter", "name": "Turnout Gear", "base": "workwear", "uniform": true, "c": {
		"top": "b89a5a", "rib": "e8e84a", "hood": "e8e84a", "hood_open": "e8e84a", "zip": "e8e84a", "inner": "b89a5a", "print": "e8e84a", "print2": "b89a5a",
		"pocket": "TOP", "legs": "b89a5a", "legs2": "a68a4e", "legs_fabric": PLAIN, "shoe": "0e0f12", "accent": "0e0f12", "sole": "0e0f12", "midsole": "0e0f12", "toe": "0e0f12" } },
	{ "id": "uniform-hivis", "name": "Hi-Vis Workwear", "base": "workwear", "uniform": true, "c": {
		"top": "ff7a12", "rib": "e8e84a", "hood": "e8e84a", "hood_open": "e8e84a", "zip": "e8e84a", "inner": "3a3c42", "print": "e8e84a", "print2": "ff7a12",
		"pocket": "TOP", "legs": "2b3a52", "legs2": "243146", "shoe": "5a3b22", "accent": "3d2716", "sole": "1e1813", "midsole": "1e1813", "toe": "4e321c" } },
	{ "id": "uniform-delivery", "name": "Courier", "base": "bomber", "uniform": true, "c": {
		"top": "1f5fbf", "rib": "174a96", "print": "f2f2ee", "print2": "1f5fbf", "legs": "23314a", "legs2": "1d293e", "shoe": "15171a", "accent": "f2f2ee", "sole": "f2f2ee", "midsole": "15171a", "toe": "15171a" } },
	{ "id": "uniform-bartender", "name": "Bar Black", "base": "denim", "uniform": true, "c": {
		"top": "131417", "rib": "0e0f12", "hood": "0e0f12", "zip": "c9a54a", "inner": "e8e8e2", "print": "c9a54a", "print2": "131417",
		"legs": "15161a", "legs2": "111215", "legs_fabric": PLAIN, "shoe": "0e0f12", "accent": "0e0f12", "sole": "0e0f12", "midsole": "0e0f12", "toe": "0e0f12" } },
	{ "id": "uniform-office", "name": "Office Blazer", "base": "denim", "uniform": true, "c": {
		"top": "34405a", "rib": "2c374d", "hood": "2c374d", "zip": "2c374d", "inner": "e8e8e2", "print": "e8e8e2", "print2": "34405a",
		"legs": "2a2f3a", "legs2": "232731", "legs_fabric": PLAIN, "shoe": "1a1310", "accent": "1a1310", "sole": "1a1310", "midsole": "1a1310", "toe": "1a1310" } },
	# the city's people (owner's NPC lineup board, Nov 11: docs/reference/npc-lineup-full-body.png) — worn by NPCs,
	# not sold ("npc"); "hat" / "wear" are what they put on with it
	# civilians
	{ "id": "npc-tee-jeans", "npc": true, "name": "White Tee & Jeans", "base": "tee-shorts", "pieces": ["sleeve_hems"], "c": {
		"top": "f2f2ef", "rib": "e6e6e2", "print": "f2f2ef", "print2": "f2f2ef", "legs": "4f6f9a", "legs2": "46648c", "legs_fabric": DENIM,
		"knee": "LEGS", "shin": "LEGS", "ankle": "46648c", "shoe": "2b4fa8", "accent": "f2f2ef", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "2b4fa8" } },
	{ "id": "npc-crop-jeans", "npc": true, "name": "Crop Top & Jeans", "base": "tee-shorts", "pieces": [], "tank": true, "crop": 0.075, "c": {
		"top": "a9a9ad", "rib": "a9a9ad", "print": "a9a9ad", "print2": "a9a9ad", "legs": "7f9fc4", "legs2": "6f8fb4", "legs_fabric": DENIM,
		"knee": "c9d6e6", "shin": "LEGS", "ankle": "6f8fb4", "shoe": "f2f2ef", "accent": "d9534f", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "f2f2ef" } },
	{ "id": "npc-beige-suit", "npc": true, "name": "Beige Suit", "base": "denim", "pieces": ["shirt_collar", "cuffs"], "c": {
		"top": "c8b48e", "fabric": PLAIN, "rib": "c8b48e", "hood": "c8b48e", "zip": "2a2f3a", "inner": "f4f4f1", "print": "f4f4f1", "print2": "f4f4f1",
		"legs": "c8b48e", "legs2": "b9a57f", "legs_fabric": PLAIN, "shoe": "3a2a1e", "accent": "2a1d14", "sole": "1a1410", "midsole": "1a1410", "toe": "3a2a1e" } },
	{ "id": "npc-business", "npc": true, "name": "Black Blazer", "base": "denim", "pieces": ["shirt_collar", "cuffs"], "c": {
		"top": "1a1b1f", "fabric": PLAIN, "rib": "1a1b1f", "hood": "1a1b1f", "zip": "f4f4f1", "inner": "f4f4f1", "print": "f4f4f1", "print2": "f4f4f1",
		"legs": "1a1b1f", "legs2": "141518", "legs_fabric": PLAIN, "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	{ "id": "npc-hoodie-backpack", "npc": true, "name": "Grey Hoodie & Backpack", "base": "heather-hoodie", "wear": ["backpack"], "hat": "cap", "c": {
		"top": "b4b6ba", "rib": "a0a2a6", "print": "b4b6ba", "print2": "b4b6ba", "legs": "1c1d21", "shoe": "f2f2ef", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "e6e6e3" } },
	{ "id": "npc-summer", "npc": true, "name": "Yellow Tank & Shorts", "base": "tee-shorts", "pieces": ["shorts_hems"], "tank": true, "c": {
		"top": "e9c440", "rib": "d9b430", "print": "e9c440", "print2": "e9c440", "legs": "f2efe6", "legs2": "e6e2d6", "ankle": "SKIN",
		"shoe": "c9a06a", "accent": "8a6a3a", "sole": "8a6a3a", "midsole": "c9a06a", "toe": "c9a06a" } },
	{ "id": "npc-jersey-shorts", "npc": true, "name": "Jersey & Cargo Shorts", "base": "tee-shorts", "pieces": ["sleeve_hems", "shorts_hems", "cargo"], "c": {
		"top": "1e2024", "rib": "f2f2ef", "print": "f2f2ef", "print2": "1e2024", "legs": "b6a382", "legs2": "a69372", "cargo": "a69372",
		"shoe": "f2f2ef", "accent": "dd3333", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "e6e6e3" } },
	{ "id": "npc-elder", "npc": true, "name": "Print Shirt & Slacks", "base": "tee-shorts", "pieces": ["sleeve_hems"], "c": {
		"top": "d7b9c4", "rib": "c9a9b6", "print": "8fa8c8", "print2": "e7d27a", "legs": "a8957a", "legs2": "998670",
		"knee": "LEGS", "shin": "LEGS", "ankle": "998670", "shoe": "6a4a32", "accent": "4a3222", "sole": "2a2018", "midsole": "2a2018", "toe": "6a4a32" } },
	# police and security
	{ "id": "npc-police", "npc": true, "name": "Police", "base": "tracksuit", "pieces": ["hem", "cuffs"], "hat": "beanie", "c": {
		"top": "15171c", "fabric": PLAIN, "rib": "15171c", "sleeve": "1f2a44", "stripe_arm": "1f2a44", "zip": "15171c", "print": "15171c", "print2": "f2f2ef",
		"legs": "1f2a44", "legs2": "1a2439", "legs_fabric": PLAIN, "stripe": "LEGS", "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	{ "id": "npc-swat", "npc": true, "name": "Tactical Unit", "base": "techwear", "hat": "beanie", "wear": ["watch"], "c": {
		"top": "17181b", "legs": "17181b", "legs2": "121315", "print2": "3a3c40", "stripe_arm": "17181b", "stripe": "LEGS" } },
	{ "id": "npc-security", "npc": true, "name": "Security", "base": "tee-shorts", "pieces": ["cuffs", "hem"], "c": {
		"top": "f2f2ef", "rib": "e6e6e2", "zip": "15171a", "print": "f2f2ef", "print2": "15171a", "sleeve_lo": "f2f2ef", "forearm": "f2f2ef", "wrist": "e6e6e2", "arm_stripe_lo": "f2f2ef",
		"legs": "15171a", "legs2": "111215", "knee": "LEGS", "shin": "LEGS", "ankle": "111215", "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	{ "id": "npc-hivis", "npc": true, "name": "Hi-Vis Patrol", "base": "tracksuit", "pieces": ["hem", "cuffs"], "hat": "cap", "c": {
		"top": "c6f02a", "fabric": PLAIN, "rib": "1b1c20", "sleeve": "1b1c20", "stripe_arm": "c0c4c8", "zip": "c0c4c8", "print": "c0c4c8", "print2": "c0c4c8",
		"legs": "1b1c20", "legs2": "16171a", "legs_fabric": PLAIN, "stripe": "LEGS", "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	# business owners and workers
	{ "id": "npc-apron", "npc": true, "name": "Shop Apron", "base": "tee-shorts", "pieces": ["sleeve_hems"], "c": {
		"top": "33363b", "rib": "33363b", "print": "33363b", "print2": "33363b", "sleeve_hi": "f2f2ef",
		"legs": "1c1d21", "legs2": "16171a", "knee": "LEGS", "shin": "LEGS", "ankle": "16171a", "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	{ "id": "npc-chef", "npc": true, "name": "Chef Whites", "base": "tracksuit", "pieces": ["rib_collar", "cuffs"], "c": {
		"top": "f4f4f1", "fabric": PLAIN, "rib": "e8e8e4", "sleeve": "f4f4f1", "stripe_arm": "f4f4f1", "zip": "c8c8c4", "print": "f4f4f1", "print2": "f4f4f1",
		"legs": "2a2b2f", "legs2": "222327", "legs_fabric": PLAIN, "stripe": "LEGS", "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	{ "id": "npc-mechanic", "npc": true, "name": "Mechanic Coveralls", "base": "workwear", "c": {
		"top": "2c4166", "rib": "263a5c", "hood": "263a5c", "hood_open": "263a5c", "zip": "c8c8c4", "inner": "2c4166", "print": "dd3333", "print2": "f2f2ef",
		"legs": "2c4166", "legs2": "263a5c", "legs_fabric": PLAIN, "shoe": "1a1a1c", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "1a1a1c" } },
	{ "id": "npc-doctor", "npc": true, "name": "Lab Coat", "base": "denim", "pieces": ["shirt_collar", "cuffs"], "c": {
		"top": "f4f4f2", "fabric": PLAIN, "rib": "eaeae7", "hood": "f4f4f2", "zip": "2a3a5c", "inner": "9cc0e2", "print": "9cc0e2", "print2": "9cc0e2",
		"legs": "2a3346", "legs2": "232b3c", "legs_fabric": PLAIN, "shoe": "1a1a1c", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "1a1a1c" } },
	{ "id": "npc-construction", "npc": true, "name": "Construction Hi-Vis", "base": "tracksuit", "pieces": ["hem"], "c": {
		"top": "ff7a1a", "fabric": PLAIN, "rib": "ff7a1a", "sleeve": "6c6f75", "stripe_arm": "6c6f75", "zip": "c8ccd0", "print": "c8ccd0", "print2": "c8ccd0",
		"legs": "3e5a80", "legs2": "354e70", "legs_fabric": DENIM, "stripe": "LEGS", "shoe": "6a4a2a", "accent": "3a2a1a", "sole": "1a1410", "midsole": "1a1410", "toe": "6a4a2a" } },
	{ "id": "npc-delivery", "npc": true, "name": "Delivery Polo", "base": "tee-shorts", "pieces": ["sleeve_hems"], "hat": "cap", "c": {
		"top": "2161c4", "rib": "1a52a8", "print": "f2f2ef", "print2": "2161c4", "legs": "1d2a44", "legs2": "18233a",
		"knee": "LEGS", "shin": "LEGS", "ankle": "18233a", "shoe": "1a1a1c", "accent": "0e0e10", "sole": "f2f2ef", "midsole": "1a1a1c", "toe": "1a1a1c" } },
	# criminals and gangs
	{ "id": "npc-tank-cargo", "npc": true, "name": "Tank & Cargos", "base": "sand-hoodie", "pieces": ["cargo", "ankle_cuffs"], "tank": true, "wear": ["chain"], "c": {
		"top": "f2f2ef", "rib": "e6e6e2", "print": "f2f2ef", "print2": "f2f2ef", "string": "TOP", "legs": "1c1d20", "legs2": "16171a", "cargo": "16171a",
		"shoe": "f2f2ef", "accent": "1c1d20", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "e6e6e3" } },
	{ "id": "npc-crop-cargo", "npc": true, "name": "Crop Top & Cargos", "base": "sand-hoodie", "pieces": ["cargo", "ankle_cuffs"], "tank": true, "crop": 0.075, "c": {
		"top": "15161a", "rib": "15161a", "print": "15161a", "print2": "15161a", "string": "TOP", "legs": "5a6040", "legs2": "4a5034", "cargo": "4a5034",
		"shoe": "1a1a1c", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "1a1a1c" } },
	{ "id": "npc-jersey-23", "npc": true, "name": "Red Jersey", "base": "street-hoodie", "pieces": ["ankle_cuffs"], "tank": true, "hat": "bandana", "c": {
		"top": "c3202a", "rib": "f2f2ef", "print": "f2f2ef", "print2": "c3202a", "string": "TOP", "legs": "1a1a1d", "legs2": "141416", "stripe": "LEGS",
		"shoe": "f2f2ef", "accent": "c3202a", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "e6e6e3" } },
	{ "id": "npc-all-black", "npc": true, "name": "All Black", "base": "tee-shorts", "pieces": ["sleeve_hems"], "wear": ["chain"], "c": {
		"top": "141518", "rib": "141518", "print": "141518", "print2": "141518", "legs": "17181b", "legs2": "121315", "legs_fabric": DENIM,
		"knee": "LEGS", "shin": "LEGS", "ankle": "121315", "shoe": "c9a54a", "accent": "141518", "sole": "f2f2ef", "midsole": "c9a54a", "toe": "c9a54a" } },
	{ "id": "npc-leather", "npc": true, "name": "Leather Jacket", "base": "bomber", "c": {
		"top": "17171a", "rib": "101012", "hood": "101012", "zip": "b0b3b8", "inner": "17171a", "print": "17171a", "print2": "e6e6e3",
		"legs": "1c1c20", "legs2": "16161a", "shoe": "1a1a1c", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "1a1a1c" } },
	{ "id": "npc-shirtless", "npc": true, "name": "Shirtless & Cargos", "base": "sand-hoodie", "pieces": ["cargo", "ankle_cuffs"], "bare_top": true, "wear": ["chain"], "c": {
		"legs": "4f5536", "legs2": "42482c", "cargo": "42482c", "shoe": "f2f2ef", "accent": "1c1d20", "sole": "f2f2ef", "midsole": "f2f2ef", "toe": "e6e6e3" } },
	# workers and support
	{ "id": "npc-paramedic", "npc": true, "name": "Paramedic", "base": "tracksuit", "pieces": ["hem", "cuffs", "ankle_cuffs"], "c": {
		"top": "c9282c", "fabric": PLAIN, "rib": "a51f23", "sleeve": "c9282c", "stripe_arm": "d9dde0", "zip": "d9dde0", "print": "d9dde0", "print2": "d9dde0",
		"legs": "c9282c", "legs2": "a51f23", "legs_fabric": PLAIN, "stripe": "d9dde0", "shoe": "0e0e10", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "0e0e10" } },
	{ "id": "npc-firefighter", "npc": true, "name": "Firefighter", "base": "workwear", "c": {
		"top": "b89a3c", "rib": "a68a32", "hood": "a68a32", "hood_open": "a68a32", "zip": "d9dde0", "inner": "b89a3c", "print": "d9dde0", "print2": "d9dde0",
		"legs": "b89a3c", "legs2": "a68a32", "legs_fabric": PLAIN, "shoe": "141414", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "141414" } },
	{ "id": "npc-engineer", "npc": true, "name": "Engineer", "base": "workwear", "c": {
		"top": "55595f", "rib": "4a4e54", "hood": "4a4e54", "hood_open": "4a4e54", "zip": "c8ccd0", "inner": "55595f", "print": "55595f", "print2": "c8ccd0",
		"legs": "3a3e44", "legs2": "33363c", "legs_fabric": PLAIN, "shoe": "1a1a1c", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "1a1a1c" } },
	{ "id": "npc-hunter", "npc": true, "name": "Field Hunter", "base": "olive-utility", "hat": "cap", "c": { "top": "4e5a3a", "legs": "4e5a3a" } },
	{ "id": "npc-fisherman", "npc": true, "name": "Fisherman Overalls", "base": "tee-shorts", "pieces": ["sleeve_hems"], "hat": "beanie-red", "c": {
		"top": "f06a1e", "rib": "d95a12", "print": "f06a1e", "print2": "f06a1e", "sleeve_hi": "3a5a2a",
		"legs": "f06a1e", "legs2": "d95a12", "knee": "LEGS", "shin": "LEGS", "ankle": "d95a12", "shoe": "1e1e20", "accent": "0e0e10", "sole": "0e0e10", "midsole": "0e0e10", "toe": "1e1e20" } },
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
			if not o.has("base"):
				return o
			# a colourway: the base outfit's colours, pieces and fabrics, its own colours over them
			var b := find(String(o.base)).duplicate(true)
			var c: Dictionary = b.c
			c.merge(o.c, true)
			b.id = o.id
			b.name = o.name
			for k: String in ["pieces", "npc", "uniform", "tank", "bare_top", "crop", "hat", "wear"]:
				if o.has(k):
					b[k] = o[k]
			b.erase("for")
			return b
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
		if part in BARE_ARMS and (bool(o.get("tank", false)) or bool(o.get("bare_top", false))):
			v = "SKIN"
		elif part in BARE_TOP and bool(o.get("bare_top", false)):
			v = "SKIN"
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
	var bits := 0
	for pc: String in o.get("pieces", []):
		bits |= int(PIECE_BIT.get(pc, 0))
	m.set_shader_parameter("pieces", bits)
	m.set_shader_parameter("crop", float(o.get("crop", -1.0)))
	return m

## the material for one modelled piece of an outfit: its part's colour (linear, from the outfit material's palette) and fabric
static func piece_material(outfit_mat: ShaderMaterial, kind: String) -> StandardMaterial3D:
	var i := PARTS.find(String(PIECE_PART.get(kind, "top")))
	var pal: PackedVector3Array = outfit_mat.get_shader_parameter("pal")
	var grain: PackedFloat32Array = outfit_mat.get_shader_parameter("grain")
	var c := pal[i]
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(c.x, c.y, c.z).linear_to_srgb()
	var g := grain[i]
	sm.roughness = 0.45 if g > 2.5 else 0.9
	sm.metallic_specular = 0.35
	return sm

## the pieces an outfit wears
static func pieces_of(id: String) -> Array:
	var o := find(id)
	return o.get("pieces", []) if not o.is_empty() else []
