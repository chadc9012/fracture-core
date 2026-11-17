extends RefCounted
## The two specialist vehicle facilities (owner's "Three Vehicle Facilities" V3/V4 code, Nov 15): the AVIATION HANGAR for
## aircraft and the MILITARY MOTOR POOL for the armoured fleet, beside the street customs garage. Their upgrade lists and
## prices are the owner's (each option three levels; a level costs its base price × the level it takes you to), but here
## they're bought with the player's own Nex (one wallet for every facility: wallet.gd) and they change the vehicle:
##   aviation — Airframe Finish (hull takes less from a crash), Engine Service (top speed and thrust), Avionics (turn),
##     Landing Gear (lifts off sooner), Cabin / Cockpit (climbs harder); read by skyways_view.gd when you fly
##   military — Camouflage (a pattern on the hull: desert, woodland, urban night), Armor Package and Defensive Systems
##     (armour: crash damage on the street is cut by it), Powertrain (speed and acceleration), Suspension / Tracks
##     (steering and braking); read by street_slice.gd when you drive
## Levels are saved per vehicle in the garage save (garage_state.gd `upgrades`). Only owned vehicles take upgrades: an
## aircraft in one of your hangars (airport.gd), a military vehicle bought at the dealership (dealership.gd). Pure.

const Catalog := preload("res://scripts/garage/catalog.gd")
const MAX_LEVEL := 3

const FACILITIES := {
	"aviation": { "name": "AVIATION HANGAR", "blurb": "Airframes, engines and avionics for the aircraft in your hangars.", "accent": "#5ab4ff",
		"options": [
			{ "id": "airframe", "name": "Airframe Finish", "price": 1500, "line": "Hardened coating: −10% hull damage per level" },
			{ "id": "engine", "name": "Engine Service", "price": 5000, "line": "+6% top speed, +8% thrust per level" },
			{ "id": "avionics", "name": "Avionics", "price": 3200, "line": "+8% turn rate per level" },
			{ "id": "gear", "name": "Landing Gear", "price": 2600, "line": "Lifts off 8% sooner per level" },
			{ "id": "cockpit", "name": "Cabin / Cockpit", "price": 1800, "line": "+8% climb per level" },
		] },
	"military": { "name": "MILITARY MOTOR POOL", "blurb": "Armour, powertrains and camouflage for the armoured fleet.", "accent": "#9fb36a",
		"options": [
			{ "id": "camo", "name": "Camouflage", "price": 1200, "line": "Desert, then woodland, then urban night" },
			{ "id": "armor", "name": "Armor Package", "price": 5800, "line": "+10 armour per level" },
			{ "id": "powertrain", "name": "Powertrain", "price": 4500, "line": "+5% top speed, +7% acceleration per level" },
			{ "id": "tracks", "name": "Suspension / Tracks", "price": 3400, "line": "+7% steering, +5% braking per level" },
			{ "id": "defense", "name": "Defensive Systems", "price": 6200, "line": "+6 armour per level (smoke, reactive plates)" },
		] },
}
## the camouflage each level paints: stock, desert, woodland, urban night
const CAMO := [Color(0, 0, 0, 0), Color("#b39a6a"), Color("#4f5a34"), Color("#2a2e36")]
const CAMO_NAMES := ["Stock", "Desert", "Woodland", "Urban Night"]

static func option(fac: String, opt: String) -> Dictionary:
	for o in FACILITIES.get(fac, {}).get("options", []):
		if String(o.id) == opt:
			return o
	return {}

## what the next level of `opt` costs at `level` (the level you have now)
static func price(fac: String, opt: String, level: int) -> int:
	return int(option(fac, opt).get("price", 0)) * (level + 1)

static func level(state, vehicle_id: String, opt: String) -> int:
	return clampi(int(state.upgrades.get(vehicle_id, {}).get(opt, 0)), 0, MAX_LEVEL)

static func levels(state, vehicle_id: String) -> Dictionary:
	return state.upgrades.get(vehicle_id, {})

## buy the next level: "" when done, else why not. Spends state.credits (the shared Nex wallet while a facility is open)
static func buy(state, fac: String, vehicle_id: String, opt: String) -> String:
	if option(fac, opt).is_empty():
		return "No such upgrade"
	var l := level(state, vehicle_id, opt)
	if l >= MAX_LEVEL:
		return "Already at the top level"
	var cost := price(fac, opt, l)
	if int(state.credits) < cost:
		return "Need %d more Nex" % (cost - int(state.credits))
	state.credits = int(state.credits) - cost
	var u: Dictionary = state.upgrades.get(vehicle_id, {})
	u[opt] = l + 1
	state.upgrades[vehicle_id] = u
	return ""

# --------------------------------------------------------------------------------------------- what each facility services
## aviation: every aircraft the airport sells (airport.gd AIRCRAFT), with its model (skyways_view.gd's file)
static func aircraft() -> Array:
	var Airport = load("res://scripts/airport/airport.gd")
	var Sky = load("res://scripts/flying/skyways_view.gd")
	var out: Array = []
	for id in Airport.AIRCRAFT:
		var model := "res://models/fleet/" + String(Airport.AIRCRAFT[id].get("model", String(id) + ".glb"))
		if Sky.CRAFT.has(id):
			model = Sky.model_of(String(id))
		out.append({ "id": String(id), "name": String(Airport.AIRCRAFT[id].name), "model": model, "price": int(Airport.AIRCRAFT[id].price) })
	return out

## military: the catalog's military vehicles (bought at the dealership)
static func military() -> Array:
	var out: Array = []
	for v in Catalog.VEHICLES + Catalog.SHOWROOM:
		if String(v.get("cat", "")) == "military":
			out.append({ "id": String(v.id), "name": String(v.name), "model": String(v.model), "price": int(v.get("price", 0)) })
	return out

static func vehicles(fac: String) -> Array:
	return aircraft() if fac == "aviation" else military()

## is it yours: an aircraft in any of your hangars, a military vehicle you bought
static func owned(fac: String, vehicle_id: String, profile: Dictionary) -> bool:
	if fac == "aviation":
		var a: Variant = profile.get("air", {})
		if a is Dictionary:
			for at in (a as Dictionary).get("aircraft", {}):
				if vehicle_id in (a as Dictionary).aircraft[at]:
					return true
		return false
	return vehicle_id in load("res://scripts/garage/dealership.gd").owned(profile)

# --------------------------------------------------------------------------------------------- the effects
## a flight handling profile (vehicle_handling.gd) and top speed with the aircraft's upgrades:
## [profile, top_speed, hull damage multiplier]
static func apply_flight(handling: Dictionary, top_speed: float, state, vehicle_id: String) -> Array:
	var p := handling.duplicate()
	var engine := level(state, vehicle_id, "engine")
	p.accel = float(p.get("accel", 0.0)) * (1.0 + 0.08 * engine)
	p.steer = float(p.get("steer", 1.0)) * (1.0 + 0.08 * level(state, vehicle_id, "avionics"))
	p.takeoff = float(p.get("takeoff", 0.0)) * (1.0 - 0.08 * level(state, vehicle_id, "gear"))
	p.climb = float(p.get("climb", 0.0)) * (1.0 + 0.08 * level(state, vehicle_id, "cockpit"))
	var hull := 1.0 - 0.1 * level(state, vehicle_id, "airframe")
	return [p, top_speed * (1.0 + 0.06 * engine), hull]

## a street driving performance (street_car.gd) with a military vehicle's upgrades
static func apply_drive(perf: Dictionary, state, vehicle_id: String) -> Dictionary:
	var u := levels(state, vehicle_id)
	if u.is_empty():
		return perf
	var p := perf.duplicate()
	var pt := level(state, vehicle_id, "powertrain")
	var tr := level(state, vehicle_id, "tracks")
	p.max_speed = float(p.get("max_speed", 20.0)) * (1.0 + 0.05 * pt)
	p.acceleration = float(p.get("acceleration", 6.0)) * (1.0 + 0.07 * pt)
	p.steering = float(p.get("steering", 1.0)) * (1.0 + 0.07 * tr)
	p.braking = float(p.get("braking", 12.0)) * (1.0 + 0.05 * tr)
	p.armor = float(p.get("armor", 0.0)) + 10.0 * level(state, vehicle_id, "armor") + 6.0 * level(state, vehicle_id, "defense")
	return p

## how much of a crash's damage gets through `armor` (100 armour stops two thirds of it)
static func damage_through(armor: float) -> float:
	return clampf(1.0 - armor / 150.0, 0.25, 1.0)

static func camo(state, vehicle_id: String) -> Color:
	return CAMO[level(state, vehicle_id, "camo")]

## lay the camouflage over a hull's own paint (a multiply over every mesh, so markings and tyres stay dark); a clear
## colour takes it off
## `damage` (0-100, the garage's repair state) dirties the paint: scuffed and soot-dark as it climbs (asset catalog
## "vehicle damage"); street_car.gd adds the bonnet smoke past 60. Both ride the one multiply overlay with the camo.
static func paint_camo(hull: Node, c: Color, damage := 0) -> void:
	if c.a <= 0.0 and damage <= 0 and not hull.has_meta("camo"):
		return     # nothing on it, and it may wear other overlays (burns) we'd wipe
	var m: StandardMaterial3D = null
	if c.a > 0.0 or damage > 0:
		hull.set_meta("camo", true)
	else:
		hull.remove_meta("camo")
	if c.a > 0.0 or damage > 0:
		m = StandardMaterial3D.new()
		m.blend_mode = BaseMaterial3D.BLEND_MODE_MUL
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		var tint := Color.WHITE.lerp(c, 0.7).lightened(0.15) if c.a > 0.0 else Color.WHITE
		var k := clampf(damage / 100.0, 0.0, 1.0)
		m.albedo_color = tint.lerp(Color(0.42, 0.38, 0.34), k * 0.75)
	hull.set_meta("damage", damage)
	for mi in hull.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_overlay = m
	if hull is MeshInstance3D:
		(hull as MeshInstance3D).material_overlay = m
