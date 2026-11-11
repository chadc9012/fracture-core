extends RefCounted
## Vehicle customization catalog (owner's Vehicle Garage design, Nov 2026: GTA-style mod shops with body kits, performance
## upgrades, paint and repairs, for street cars, supercars, muscle cars, motorcycles and off-road, with armour and futuristic
## parts in the specialist shops). Pure data and lookups; garage_order.gd prices and checks an order, garage_state.gd owns
## what the player has, garage_kit.gd draws the parts on the car.
##
## One coherent system in place of the six Unity prototype packages (106 C# scripts with several parallel order, checkout and
## save paths): one catalog, one order, one checkout, one save.

## the cars a garage can work on, from the web game's fleet models (public/models/fleet -> res://models/fleet)
## stats are 0..100: top speed, acceleration, handling, armour
const VEHICLES := [
	# a detailed, realistic model (Khronos glTF sample "Car Concept", CC-BY 4.0 — credited in CREDITS.md; simplified for the
	# phone by gltfpack and fitted to Godot by tools/fix_glb_materials.py)
	{ "id": "aurora-gt", "name": "Aurora GT", "cls": "super", "model": "res://models/fleet/concept-gt.glb", "paint": "#b3121a", "stats": { "speed": 84, "accel": 80, "handling": 74, "armor": 16 } },
	{ "id": "street-racer", "name": "Vex GT Street Racer", "cls": "super", "model": "res://models/fleet/street-racer-lod.glb", "paint": "#c8102e", "stats": { "speed": 78, "accel": 74, "handling": 70, "armor": 18 } },
	{ "id": "muscle-car", "name": "Rift Runner Muscle", "cls": "muscle", "model": "res://models/fleet/muscle-car-lod.glb", "paint": "#d9dde2", "stats": { "speed": 70, "accel": 72, "handling": 52, "armor": 26 } },
	{ "id": "tuner", "name": "Kaido Street Tuner", "cls": "street", "model": "res://models/fleet/tuner.glb", "paint": "#2a5bd7", "stats": { "speed": 58, "accel": 60, "handling": 66, "armor": 20 } },
	{ "id": "offroad-truck", "name": "Ironback 4x4", "cls": "offroad", "model": "res://models/fleet/offroad-truck.glb", "paint": "#3d4a2f", "stats": { "speed": 48, "accel": 46, "handling": 44, "armor": 42 } },
	{ "id": "security-suv", "name": "Bastion Security SUV", "cls": "armored", "model": "res://models/fleet/security-suv.glb", "paint": "#1f2328", "stats": { "speed": 50, "accel": 44, "handling": 46, "armor": 60 } },
	{ "id": "aether-hoverbike", "name": "Aether Hoverbike", "cls": "bike", "model": "res://models/fleet/aether-hoverbike.glb", "paint": "#5b2be0", "stats": { "speed": 74, "accel": 82, "handling": 76, "armor": 8 } },
]

## the shops and what each specialises in (owner's planned garage types). `slots`: what it fits; `mult`: its price level;
## `rep`: reputation needed to deal with it at all; `accent`: its neon.
const SHOPS := [
	{ "id": "nexus-customs", "name": "Nexus Customs", "city": "Nexus City", "blurb": "Everyday repairs, body kits, paint and wheels.", "slots": ["front", "rear", "skirts", "fenders", "spoiler", "aero", "hood", "exhaust", "wheels", "tyres", "brakes", "decals", "interior", "paint", "finish", "tint"], "mult": 1.0, "rep": 0, "accent": "#3fd0ff", "repairs": true },
	{ "id": "neon-performance", "name": "Neon Performance", "city": "Neon City", "blurb": "Racing upgrades, exotic body kits and lighting.", "slots": ["front", "rear", "skirts", "fenders", "spoiler", "aero", "exhaust", "wheels", "engine", "turbo", "gearbox", "brakes", "suspension", "tyres", "nitrous", "electronics", "underglow", "decals", "interior", "paint", "finish"], "mult": 1.15, "rep": 1, "accent": "#ff3fb4", "repairs": true },
	{ "id": "ironworks", "name": "Ironworks Garage", "city": "The Wastelands", "blurb": "Off-road gear, armour and reinforced parts.", "slots": ["bullbar", "roof", "armor", "glass", "suspension", "tyres", "wheels", "paint", "finish"], "mult": 0.95, "rep": 1, "accent": "#ff9a2e", "repairs": true },
	{ "id": "sunset-kustoms", "name": "Sunset Kustoms", "city": "Coastline", "blurb": "Candy paint, chrome wheels and low stance.", "slots": ["front", "rear", "skirts", "spoiler", "wheels", "suspension", "underglow", "tint", "decals", "interior", "paint", "finish"], "mult": 1.05, "rep": 0, "accent": "#ffb347", "repairs": true },
	{ "id": "fracture-dynamics", "name": "Fracture Dynamics", "city": "Aegis Spire", "blurb": "Advanced futuristic modifications.", "slots": ["fracture", "shield", "engine", "underglow", "finish"], "mult": 1.35, "rep": 2, "accent": "#9f6bff", "repairs": false },
]

## slot -> menu group, label; one part per slot on a car
const SLOTS := {
	"front": ["BODY KIT", "Front bumper"], "rear": ["BODY KIT", "Rear bumper"], "skirts": ["BODY KIT", "Side skirts"],
	"fenders": ["BODY KIT", "Fenders"], "spoiler": ["BODY KIT", "Spoiler / wing"], "exhaust": ["BODY KIT", "Exhaust"],
	"hood": ["BODY KIT", "Hood"], "bullbar": ["BODY KIT", "Bull bar"], "roof": ["BODY KIT", "Roof rack"],
	"wheels": ["WHEELS", "Rims"], "tyres": ["WHEELS", "Tyres"],
	"engine": ["PERFORMANCE", "Engine"], "turbo": ["PERFORMANCE", "Turbo"], "gearbox": ["PERFORMANCE", "Transmission"],
	"brakes": ["PERFORMANCE", "Brakes"], "suspension": ["PERFORMANCE", "Suspension"],
	"armor": ["ARMOUR", "Body armour"], "glass": ["ARMOUR", "Bulletproof glass"],
	"aero": ["BODY KIT", "Aero package"], "nitrous": ["PERFORMANCE", "Nitrous"], "electronics": ["PERFORMANCE", "Electronics"],
	"decals": ["DECALS", "Decals and livery"], "interior": ["INTERIOR", "Interior"],
	"underglow": ["LIGHTS", "Underglow"], "tint": ["LIGHTS", "Window tint"],
	"fracture": ["FRACTURE MODS", "Fracture core"], "shield": ["FRACTURE MODS", "Shield emitter"],
	"paint": ["PAINT", "Colour"], "finish": ["PAINT", "Finish"],
}
const GROUPS := ["PAINT", "DECALS", "BODY KIT", "WHEELS", "PERFORMANCE", "INTERIOR", "ARMOUR", "LIGHTS", "FRACTURE MODS"]
## the free TUNING tab (ride height, camber, rim size, the decal's text and colour) is open in any shop that sells wheels
const TUNE_DEFAULT := { "ride": 0, "camber": 0, "rim": 19, "text": "WF", "decal_color": "#e8eaec" }
const TUNE_LIMITS := { "ride": [-60, 60], "camber": [-10, 10], "rim": [15, 24] }
const DECAL_COLORS := ["#e8eaec", "#0c0d0f", "#c8102e", "#18b8d8", "#e8b416", "#5b2be0", "#1f9b5a", "#f05a14"]

const ALL := ["street", "super", "muscle", "offroad", "armored", "bike"]
const CARS := ["street", "super", "muscle", "offroad", "armored"]

## parts: id, slot, name, price (credits, before the shop's multiplier), the classes it fits, stat changes, and `look` (how
## garage_kit.gd draws it). Prices follow the web game's economy scale (a car is 8-60k).
const PARTS := [
	# body kits
	{ "id": "front-street", "slot": "front", "name": "Street lip", "price": 900, "fits": ["street", "muscle", "super"], "stats": { "handling": 2 }, "look": { "kind": "splitter", "depth": 0.12 } },
	{ "id": "front-race", "slot": "front", "name": "Carbon race splitter", "price": 2600, "fits": ["street", "super"], "stats": { "handling": 4, "speed": 1 }, "look": { "kind": "splitter", "depth": 0.28, "carbon": true }, "rep": 1 },
	{ "id": "rear-street", "slot": "rear", "name": "Street diffuser", "price": 1200, "fits": ["street", "muscle", "super"], "stats": { "handling": 1 }, "look": { "kind": "diffuser", "fins": 3 } },
	{ "id": "rear-race", "slot": "rear", "name": "Carbon race diffuser", "price": 3400, "fits": ["street", "super", "muscle"], "stats": { "handling": 3, "speed": 1 }, "look": { "kind": "diffuser", "fins": 6, "carbon": true }, "rep": 1 },
	{ "id": "fenders-vented", "slot": "fenders", "name": "Vented fenders", "price": 2200, "fits": ["street", "super", "muscle"], "stats": { "handling": 2 }, "look": { "kind": "fenders" } },
	{ "id": "exhaust-quad", "slot": "exhaust", "name": "Quad chrome tips", "price": 1100, "fits": ["street", "super", "muscle", "offroad"], "stats": { "accel": 1 }, "look": { "kind": "exhaust", "color": "#d6dade", "n": 4 } },
	{ "id": "exhaust-titanium", "slot": "exhaust", "name": "Burnt titanium twin", "price": 2400, "fits": ["street", "super", "muscle", "bike"], "stats": { "accel": 2, "speed": 1 }, "look": { "kind": "exhaust", "color": "#5a6fb0", "n": 2 }, "rep": 1 },
	{ "id": "skirts-street", "slot": "skirts", "name": "Painted side skirts", "price": 1100, "fits": ["street", "muscle", "super"], "stats": { "handling": 1 }, "look": { "kind": "skirts" } },
	{ "id": "skirts-wide", "slot": "skirts", "name": "Widebody arches", "price": 4800, "fits": ["street", "super", "muscle"], "stats": { "handling": 5 }, "look": { "kind": "skirts", "wide": true, "carbon": true }, "rep": 1 },
	{ "id": "spoiler-duck", "slot": "spoiler", "name": "Ducktail", "price": 800, "fits": ["street", "muscle", "super"], "stats": { "handling": 1 }, "look": { "kind": "spoiler", "height": 0.05 } },
	{ "id": "spoiler-gt", "slot": "spoiler", "name": "GT wing", "price": 3200, "fits": ["street", "super", "muscle"], "stats": { "handling": 5, "speed": -1 }, "look": { "kind": "spoiler", "height": 0.32, "carbon": true }, "rep": 1 },
	{ "id": "hood-vented", "slot": "hood", "name": "Vented hood", "price": 1500, "fits": ["street", "muscle", "super"], "stats": { "accel": 1 }, "look": { "kind": "hood" } },
	{ "id": "bullbar-steel", "slot": "bullbar", "name": "Steel bull bar", "price": 1400, "fits": ["offroad", "armored"], "stats": { "armor": 6, "speed": -1 }, "look": { "kind": "bullbar" } },
	{ "id": "roof-rack", "slot": "roof", "name": "Roof rack and light bar", "price": 1700, "fits": ["offroad", "armored"], "stats": {}, "look": { "kind": "roof" } },
	# wheels
	{ "id": "rims-chrome", "slot": "wheels", "name": "Chrome five-spoke", "price": 1300, "fits": ALL, "stats": {}, "look": { "kind": "rims", "color": "#d8dde2", "metal": 1.0, "rough": 0.08 } },
	{ "id": "rims-black", "slot": "wheels", "name": "Satin black forged", "price": 1600, "fits": ALL, "stats": { "accel": 1 }, "look": { "kind": "rims", "color": "#141516", "metal": 0.7, "rough": 0.45 } },
	{ "id": "rims-gold", "slot": "wheels", "name": "Bronze mesh", "price": 2100, "fits": ALL, "stats": { "accel": 1 }, "look": { "kind": "rims", "color": "#a87a3c", "metal": 1.0, "rough": 0.25 } },
	{ "id": "tyres-sport", "slot": "tyres", "name": "Sport tyres", "price": 900, "fits": ["street", "super", "muscle", "bike"], "stats": { "handling": 4 }, "look": {} },
	{ "id": "tyres-terrain", "slot": "tyres", "name": "All-terrain tyres", "price": 1100, "fits": ["offroad", "armored", "muscle"], "stats": { "handling": 3, "armor": 2 }, "look": {} },
	# performance
	{ "id": "engine-1", "slot": "engine", "name": "Engine tune I", "price": 2500, "fits": ALL, "stats": { "speed": 3, "accel": 4 }, "look": {} },
	{ "id": "engine-2", "slot": "engine", "name": "Engine tune II", "price": 6000, "fits": ALL, "stats": { "speed": 6, "accel": 8 }, "look": {}, "rep": 1 },
	{ "id": "engine-3", "slot": "engine", "name": "Race engine", "price": 14000, "fits": ["street", "super", "muscle", "bike"], "stats": { "speed": 10, "accel": 12, "handling": -1 }, "look": {}, "rep": 2 },
	{ "id": "turbo", "slot": "turbo", "name": "Turbocharger", "price": 5500, "fits": CARS, "stats": { "accel": 7, "speed": 2 }, "look": {} },
	{ "id": "gearbox-sport", "slot": "gearbox", "name": "Close-ratio gearbox", "price": 3600, "fits": ALL, "stats": { "accel": 5 }, "look": {} },
	{ "id": "brakes-sport", "slot": "brakes", "name": "Ceramic brakes", "price": 3000, "fits": ALL, "stats": { "handling": 5 }, "look": { "kind": "calipers", "color": "#e8361a" } },
	{ "id": "susp-low", "slot": "suspension", "name": "Lowered coilovers", "price": 2800, "fits": ["street", "super", "muscle"], "stats": { "handling": 6 }, "look": { "kind": "ride", "drop": -0.05 } },
	{ "id": "susp-lift", "slot": "suspension", "name": "Lift kit", "price": 3200, "fits": ["offroad", "armored"], "stats": { "handling": 3, "armor": 2 }, "look": { "kind": "ride", "drop": 0.12 } },
	# armour
	{ "id": "armor-1", "slot": "armor", "name": "Plated doors", "price": 4500, "fits": CARS, "stats": { "armor": 12, "speed": -2, "accel": -2 }, "look": { "kind": "plates", "heavy": false } },
	{ "id": "armor-2", "slot": "armor", "name": "Reinforced war plating", "price": 11000, "fits": ["muscle", "offroad", "armored"], "stats": { "armor": 24, "speed": -4, "accel": -4, "handling": -2 }, "look": { "kind": "plates", "heavy": true }, "rep": 2 },
	{ "id": "glass-armored", "slot": "glass", "name": "Bulletproof glass", "price": 6500, "fits": CARS, "stats": { "armor": 8 }, "look": { "kind": "glass", "color": "#3a4a52" } },
	# lights
	{ "id": "glow-cyan", "slot": "underglow", "name": "Cyan underglow", "price": 700, "fits": ALL, "stats": {}, "look": { "kind": "underglow", "color": "#30e3ff" } },
	{ "id": "glow-magenta", "slot": "underglow", "name": "Magenta underglow", "price": 700, "fits": ALL, "stats": {}, "look": { "kind": "underglow", "color": "#ff2fb0" } },
	{ "id": "glow-violet", "slot": "underglow", "name": "Fracture violet underglow", "price": 900, "fits": ALL, "stats": {}, "look": { "kind": "underglow", "color": "#9c5bff" } },
	{ "id": "tint-dark", "slot": "tint", "name": "Limo tint", "price": 500, "fits": CARS, "stats": {}, "look": { "kind": "glass", "color": "#0b0d10" } },
	# from the owner's garage file (Nov 11): the drive-changing ones carry `tune` — nos (nitrous: bigger = longer, harder
	# boost), slide (the car lets its tail out: drift parts), grip (sticks harder through corners: slicks), launch (a
	# harder start from rest), telemetry (a live readout on the dash) — read by drive_profile.gd and street_car.gd
	{ "id": "aero-canards", "slot": "aero", "name": "Canards and splitter", "price": 2600, "fits": ["street", "super", "muscle"], "stats": { "handling": 3 }, "look": { "kind": "aero", "full": false } },
	{ "id": "aero-full", "slot": "aero", "name": "Full aero package", "price": 8400, "fits": ["street", "super", "muscle"], "stats": { "handling": 7, "speed": -1 }, "look": { "kind": "aero", "full": true, "carbon": true }, "rep": 1, "street": "OUTLAW" },
	{ "id": "nos-street", "slot": "nitrous", "name": "Street nitrous", "price": 4200, "fits": ["street", "super", "muscle", "offroad", "armored", "bike"], "stats": { "accel": 2 }, "look": {}, "tune": { "nos": 1.0 } },
	{ "id": "nos-race", "slot": "nitrous", "name": "Race nitrous", "price": 8800, "fits": ["street", "super", "muscle", "bike"], "stats": { "accel": 3 }, "look": {}, "tune": { "nos": 1.6 }, "rep": 1, "street": "STREET RACER" },
	{ "id": "elec-telemetry", "slot": "electronics", "name": "Telemetry system", "price": 2300, "fits": ALL, "stats": { "handling": 1 }, "look": {}, "tune": { "telemetry": 1.0 } },
	{ "id": "elec-launch", "slot": "electronics", "name": "Launch control", "price": 4200, "fits": ALL, "stats": { "accel": 2 }, "look": {}, "tune": { "launch": 1.0 } },
	{ "id": "elec-track", "slot": "electronics", "name": "Track ECU suite", "price": 7400, "fits": ["street", "super", "muscle", "bike"], "stats": { "speed": 2, "handling": 3 }, "look": {}, "tune": { "launch": 1.0, "telemetry": 1.0 }, "rep": 1, "street": "OUTLAW" },
	{ "id": "tyres-slick", "slot": "tyres", "name": "Slick tyres", "price": 5800, "fits": ["street", "super", "muscle"], "stats": { "handling": 8 }, "look": {}, "tune": { "grip": 0.5 }, "rep": 1 },
	{ "id": "tyres-drift", "slot": "tyres", "name": "Drift tyres", "price": 1700, "fits": ["street", "super", "muscle"], "stats": { "handling": 2 }, "look": {}, "tune": { "slide": 0.6 } },
	{ "id": "susp-race", "slot": "suspension", "name": "Race suspension", "price": 6200, "fits": ["street", "super", "muscle"], "stats": { "handling": 9 }, "look": { "kind": "ride", "drop": -0.07 }, "tune": { "grip": 0.2 }, "rep": 1 },
	{ "id": "susp-drift", "slot": "suspension", "name": "Drift suspension", "price": 4100, "fits": ["street", "super", "muscle"], "stats": { "handling": 5 }, "look": { "kind": "ride", "drop": -0.04 }, "tune": { "slide": 0.4 } },
	{ "id": "brakes-pads", "slot": "brakes", "name": "Performance pads", "price": 1400, "fits": ALL, "stats": { "handling": 2 }, "look": {} },
	{ "id": "brakes-bbk", "slot": "brakes", "name": "Big brake kit", "price": 5200, "fits": CARS, "stats": { "handling": 7 }, "look": { "kind": "calipers", "color": "#ffd21a" } },
	{ "id": "supercharger", "slot": "turbo", "name": "Supercharger", "price": 7200, "fits": CARS, "stats": { "accel": 6, "speed": 3 }, "look": {}, "rep": 1, "street": "ELITE" },
	{ "id": "rims-deepdish", "slot": "wheels", "name": "Deep-dish wide lip", "price": 3200, "fits": ALL, "stats": {}, "look": { "kind": "rims", "color": "#cfd3d6", "metal": 1.0, "rough": 0.12 } },
	{ "id": "decal-stripes", "slot": "decals", "name": "Racing stripes", "price": 900, "fits": CARS, "stats": {}, "look": { "kind": "decal", "style": "stripes" } },
	{ "id": "decal-street", "slot": "decals", "name": "Street graphics", "price": 1800, "fits": ["street", "super", "muscle", "offroad", "armored", "bike"], "stats": {}, "look": { "kind": "decal", "style": "graphics" } },
	{ "id": "decal-livery", "slot": "decals", "name": "Full race livery", "price": 3800, "fits": ["street", "super", "muscle", "offroad", "armored", "bike"], "stats": {}, "look": { "kind": "decal", "style": "livery" }, "rep": 1 },
	{ "id": "int-sport", "slot": "interior", "name": "Sport seats", "price": 2200, "fits": CARS, "stats": { "handling": 1 }, "look": {} },
	{ "id": "int-leather", "slot": "interior", "name": "Luxury leather", "price": 4800, "fits": CARS, "stats": {}, "look": {} },
	{ "id": "int-cage", "slot": "interior", "name": "Race cockpit and roll cage", "price": 7000, "fits": ["street", "super", "muscle", "offroad"], "stats": { "armor": 3, "handling": 2 }, "look": { "kind": "cage" }, "rep": 1 },
	# fracture mods (Fracture Dynamics)
	{ "id": "fracture-phase", "slot": "fracture", "name": "Phase-boost core", "price": 22000, "fits": ALL, "stats": { "speed": 8, "accel": 10 }, "look": { "kind": "core", "color": "#9f6bff" }, "rep": 2 },
	{ "id": "shield-emitter", "slot": "shield", "name": "Hard-light shield emitter", "price": 26000, "fits": ALL, "stats": { "armor": 20 }, "look": { "kind": "shield", "color": "#5fe4ff" }, "rep": 3 },
]

## paint: colours and finishes are parts of their own slots (one colour, one finish on a car)
const COLORS := [
	["paint-red", "Fracture Red", "#c8102e"], ["paint-white", "Arctic White", "#e8eaec"], ["paint-black", "Obsidian", "#0c0d0f"],
	["paint-silver", "Liquid Silver", "#a9afb5"], ["paint-blue", "Nexus Blue", "#1f4fd6"], ["paint-cyan", "Grid Cyan", "#18b8d8"],
	["paint-green", "Verdant Green", "#1f6b3a"], ["paint-olive", "Wasteland Olive", "#4b5132"], ["paint-orange", "Ember Orange", "#f05a14"],
	["paint-yellow", "Solara Gold", "#e8b416"], ["paint-violet", "Rift Violet", "#5b2be0"], ["paint-pink", "Neon Pink", "#ff2f9a"],
]
const FINISHES := [
	{ "id": "finish-gloss", "name": "Gloss", "price": 0, "metal": 0.15, "rough": 0.32, "coat": 1.0 },
	{ "id": "finish-metallic", "name": "Metallic", "price": 800, "metal": 0.75, "rough": 0.28, "coat": 1.0 },
	{ "id": "finish-matte", "name": "Matte", "price": 1200, "metal": 0.05, "rough": 0.85, "coat": 0.0 },
	{ "id": "finish-pearl", "name": "Pearlescent", "price": 2400, "metal": 0.55, "rough": 0.18, "coat": 1.0, "rep": 1 },
	{ "id": "finish-chrome", "name": "Chrome", "price": 9000, "metal": 1.0, "rough": 0.05, "coat": 0.4, "rep": 2 },
]
## one-tap body-kit presets (owner's Nexus Customs sheets: Street, Racing and Widebody kits); the order takes every piece that
## fits the car and the shop
const PRESETS := [
	{ "id": "street", "name": "STREET KIT", "blurb": "Balanced", "items": ["front-street", "rear-street", "skirts-street", "spoiler-duck", "rims-chrome", "exhaust-quad"] },
	{ "id": "racing", "name": "RACING KIT", "blurb": "Performance", "items": ["front-race", "rear-race", "skirts-street", "spoiler-gt", "hood-vented", "rims-black", "exhaust-titanium"] },
	{ "id": "widebody", "name": "WIDEBODY KIT", "blurb": "Ultimate", "items": ["front-race", "rear-race", "skirts-wide", "fenders-vented", "spoiler-gt", "hood-vented", "rims-gold", "exhaust-titanium", "glow-violet"] },
]
const PAINT_PRICE := 1000
const REPAIR_PER_POINT := 60  ## credits per 1% of damage (0..100), before the shop multiplier

static func vehicle(id: String) -> Dictionary:
	for v in VEHICLES:
		if v.id == id:
			return v
	return {}

static func shop(id: String) -> Dictionary:
	for s in SHOPS:
		if s.id == id:
			return s
	return {}

## every sellable item, paint and finishes included, in one shape: id, slot, name, price, fits, stats, look, rep
static func item(id: String) -> Dictionary:
	for p in PARTS:
		if p.id == id:
			return p
	for c in COLORS:
		if c[0] == id:
			return { "id": c[0], "slot": "paint", "name": c[1], "price": PAINT_PRICE, "fits": ALL, "stats": {}, "look": { "kind": "paint", "color": c[2] } }
	for f in FINISHES:
		if f.id == id:
			return { "id": f.id, "slot": "finish", "name": f.name, "price": f.price, "fits": ALL, "stats": {}, "look": { "kind": "finish", "metal": f.metal, "rough": f.rough, "coat": f.coat }, "rep": f.get("rep", 0) }
	return {}

static func items_for_slot(slot: String) -> Array:
	var out := []
	if slot == "paint":
		for c in COLORS:
			out.append(item(c[0]))
	elif slot == "finish":
		for f in FINISHES:
			out.append(item(f.id))
	else:
		for p in PARTS:
			if p.slot == slot:
				out.append(p)
	return out

## the slots of one menu group a shop sells
static func shop_slots(shop_id: String, group: String) -> Array:
	var out := []
	for s in shop(shop_id).get("slots", []):
		if SLOTS[s][0] == group:
			out.append(s)
	return out

## does this part go on this car class?
static func fits(it: Dictionary, cls: String) -> bool:
	return cls in it.get("fits", [])

## a stat line: the car's base stats plus every installed part's changes, clamped 0..100
static func stats_with(vehicle_id: String, parts: Dictionary) -> Dictionary:
	var out: Dictionary = vehicle(vehicle_id).get("stats", {}).duplicate()
	for slot in parts:
		var it := item(parts[slot])
		for k in it.get("stats", {}):
			out[k] = clampi(int(out.get(k, 0)) + int(it.stats[k]), 0, 100)
	return out

## what a car's parts do to the drive beyond the stat bars: the sum of every installed part's `tune`
static func tune_with(parts: Dictionary) -> Dictionary:
	var out := {}
	for slot in parts:
		var t: Dictionary = item(parts[slot]).get("tune", {})
		for k in t:
			out[k] = float(out.get(k, 0.0)) + float(t[k])
	return out

## a car's free tuning (garage_state cars[id].tune), filled and clamped
static func tune_clean(t: Dictionary) -> Dictionary:
	var out: Dictionary = TUNE_DEFAULT.duplicate()
	for k in TUNE_LIMITS:
		if t.has(k):
			out[k] = clampi(int(t[k]), int(TUNE_LIMITS[k][0]), int(TUNE_LIMITS[k][1]))
	if t.has("text"):
		out.text = String(t.text).strip_edges().substr(0, 12)
	if t.has("decal_color") and String(t.decal_color) in DECAL_COLORS:
		out.decal_color = String(t.decal_color)
	return out
