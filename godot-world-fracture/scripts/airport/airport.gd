extends RefCounted
## The airports' rules (owner, Nov 9: "allow users to buy tickets for flights, have stores and shops, and you can not come in
## the airport with weapons — you can only have weapons on the air strip or in your air hangar when you buy one").
## Node-free so tests/airport/airport_test.gd runs headless; airport_view.gd is the scene.
##
## State lives in the profile (gear_store.gd profile_load / profile_save, so it rides the cloud save) under "air":
##   { "tickets": [{ "id", "from", "to", "fare" }], "hangars": { "<airport>": "<bay>" }, "aircraft": { "<airport>": [craft ids] } }

## the two international airports, after the owner's reference renders (Nexus by day, Neon City at night)
## `street` airports open from a city street (AIRPORT EXPRESS) and leave back onto it; the others stand in a region (Nov 9,
## the owner's network: Azure Isles, Frostveil, Solara first) — you fly in, and walk out into the region.
const AIRPORTS := {
	# Nov 15, the owner's network board ("THE 12 AIRPORTS"): each airport's board name, its board code (`tag`, shown on
	# every sign, ticket and departures row; the key stays the save's id), the board's four lines (`lines`) and which
	# take aircraft customization (`custom`: the Aviation Hangar, facility.gd) or have a military sector (`military`)
	"NXC": { "name": "Nexus City International Airport", "tag": "NCI", "city": "Nexus City", "region": "nexus", "style": "nexus", "night": false, "street": true, "custom": true, "military": true,
		"lines": ["Aetherion – main hub (global)", "International & domestic", "Cargo & private terminals", "VIP / executive lounge"] },
	"NEC": { "name": "Neon City International Airport", "tag": "NCA", "city": "Neon City", "region": "neon-city", "style": "neon", "night": true, "street": true, "custom": true,
		"lines": ["The night city's gateway", "International & domestic", "Private hangars", "VIP lounge"] },
	"SOL": { "name": "Solmara Skyport", "tag": "SSP", "city": "Solmara", "region": "solara", "style": "desert", "night": false, "street": false,
		"lines": ["Regional international", "Desert & trade routes", "Cargo & resource exports", "Charter & luxury flights"] },
	"ELD": { "name": "Eldergrove Airfield", "tag": "EGA", "city": "Eldergrove", "region": "riverdale", "style": "forest", "night": false, "street": false,
		"lines": ["Regional hub", "Eco-friendly design", "Cargo (timber, flora, goods)", "Air taxi & tourism"] },
	"FRV": { "name": "Frostveil International Airport", "tag": "FVI", "city": "Frostveil", "region": "frostveil", "style": "arctic", "night": false, "street": false,
		"lines": ["Regional international", "Cold-weather operations", "Research & supply flights", "Reinforced, all-weather"] },
	"OBS": { "name": "Obsidian Reach Airport", "tag": "ORA", "city": "Obsidian Reach", "region": "ember", "style": "volcanic", "night": false, "street": false, "custom": true, "military": true,
		"lines": ["Regional hub", "Heavy cargo & minerals", "Heat-resistant facilities", "Military airstrip (restricted)"] },
	"AZI": { "name": "Azure Isles Airport", "tag": "AZI", "city": "Azure Isles", "region": "azure-isles", "style": "tropical", "night": false, "street": false,
		"lines": ["Regional international", "Tourism & luxury travel", "Cargo (goods, seafood)", "Island hopping routes"] },
	"VRD": { "name": "Verdant Forest Airport", "tag": "VFA", "city": "Verdant Forest", "region": "veridan", "style": "verdant", "night": false, "street": false,
		"lines": ["Regional hub", "Eco & exploration flights", "Cargo (materials, goods)", "Links to Thalassia & Nexus City"] },
	"THA": { "name": "Thalassia Oceanic Airport", "tag": "THA", "city": "Thalassia", "region": "thalassia", "style": "coastal", "night": false, "street": false,
		"lines": ["Unique oceanic airport", "Surface & submersible hangars", "Research & trade access", "Direct link to Verdant Forest"] },
	"SKA": { "name": "Skyhaven Airport", "tag": "SKA", "city": "Skyhaven", "region": "storm", "style": "skyhaven", "night": false, "street": false, "custom": true,
		"lines": ["Aerial gateway (high altitude)", "Special & research flights", "Airship / VTOL operations", "Limited commercial access"] },
	"AGA": { "name": "Aurora Gate Airport", "tag": "AGA", "city": "Aurora Gate", "region": "frostspire", "style": "aurora", "night": true, "street": false,
		"lines": ["Regional international", "Northern trade routes", "Exploration & research", "Aurora viewing terminal"] },
	"HGA": { "name": "Horizon Gate Airport", "tag": "HGA", "city": "Horizon Gate", "region": "wastelands", "style": "horizon", "night": false, "street": false,
		"lines": ["Regional international", "Trade & expedition hub", "Cargo & logistics center", "Strategic west gate"] },
	"SHX": { "name": "Shattered Expanse Airport", "tag": "SEA", "city": "Shattered Expanse", "region": "crystal-badlands", "style": "expedition", "night": false, "street": false, "custom": true, "military": true,
		"lines": ["Specialized airport", "Rift & anomaly operations", "High security", "Research & military support"] },
}
## where flights go: code -> name, the region you land in ("" = on the owner's boards but not open yet, shown and not sold),
## the fare in Nex, and the region's own name for arrivals. NXC / NEC land in the other airport's terminal.
const DESTINATIONS := {
	"NXC": { "name": "Nexus City", "region": "nexus", "fare": 150 },
	"NEC": { "name": "Neon City", "region": "neon-city", "fare": 150 },
	"SOL": { "name": "Solmara", "region": "solara", "fare": 220 },
	"ELD": { "name": "Eldergrove", "region": "riverdale", "fare": 190 },
	"FRV": { "name": "Frostveil", "region": "frostveil", "fare": 340 },
	"OBS": { "name": "Obsidian Reach", "region": "ember", "fare": 300 },
	"AZI": { "name": "Azure Isles", "region": "azure-isles", "fare": 300 },
	"VRD": { "name": "Verdant Forest", "region": "veridan", "fare": 190 },
	"THA": { "name": "Thalassia", "region": "thalassia", "fare": 260 },
	"SKA": { "name": "Skyhaven", "region": "storm", "fare": 360 },
	"AGA": { "name": "Aurora Gate", "region": "frostspire", "fare": 320 },
	"HGA": { "name": "Horizon Gate", "region": "wastelands", "fare": 280 },
	"SHX": { "name": "Shattered Expanse", "region": "crystal-badlands", "fare": 380 },
	# towns without an airport of their own: you land on their strip and walk out
	"GLD": { "name": "Goldenreach", "region": "goldenreach", "fare": 200 },
	"RVD": { "name": "Riverdale", "region": "riverdale", "fare": 160 },
	"OHR": { "name": "Old Harrow", "region": "old-harrow", "fare": 210 },
}

## the board code an airport shows (the owner's network board: NCI, SSP, EGA …); any other place keeps its own
static func tag(code: String) -> String:
	return String(AIRPORTS[code].get("tag", code)) if AIRPORTS.has(code) else code
const GATES := ["A1", "A2", "A3", "B1", "B2", "B3"]
const FLIGHT_EVERY := 45          # minutes between departures to one destination
## the private hangars on each apron, and what they and the aircraft cost
const BAYS := ["H1", "H2", "H3"]
const HANGAR_PRICE := 6000
const AIRCRAFT := {
	"rift-helicopter": { "name": "Rift-Jumper Attack Helicopter", "price": 8000 },
	"vanguard-jet": { "name": "F-39 Jupiter", "price": 15000 },
	"leviathan": { "name": "Leviathan Cargo Airship", "price": 25000 },
	# the owner's roster boards (Nov 15, Meshy): `model` under models/fleet when it isn't <id>.glb
	"skyhawk": { "name": "Skyhawk", "price": 6000, "model": "craft/skyhawk.glb" },
	"valkyrie-vtol": { "name": "Valkyrie VTOL-MkII", "price": 14000, "model": "craft/valkyrie-vtol.glb" },
	"riftwing": { "name": "Riftwing", "price": 18000, "model": "craft/riftwing.glb" },
	"solara-falcon": { "name": "Solara Falcon", "price": 20000, "model": "craft/solara-falcon.glb" },
	"thunderbolt-a7": { "name": "Thunderbolt A-7", "price": 22000, "model": "craft/thunderbolt-a7.glb" },
	"void-skimmer": { "name": "Void-Skimmer Prototype", "price": 30000 },
}
## where weapons may be out: the airstrip (apron, taxiways, runway) and inside a hangar you own; never landside, in the
## terminal, the shops or the gate lounges
const ARMED_ZONES := ["apron", "runway"]

# --------------------------------------------------------------------------------------------- state
static func air(profile: Dictionary) -> Dictionary:
	var a: Variant = profile.get("air", {})
	if not (a is Dictionary):
		a = {}
	for k in ["tickets", "hangars", "aircraft"]:
		if not a.has(k) or typeof(a[k]) != (TYPE_ARRAY if k == "tickets" else TYPE_DICTIONARY):
			a[k] = [] if k == "tickets" else {}
	profile["air"] = a
	return a

## every destination sold from `from` (open regions only, never itself), in the order the board lists them
static func routes(from: String) -> Array:
	var out: Array = []
	for c in DESTINATIONS:
		if c != from and String(DESTINATIONS[c].region) != "":
			out.append(c)
	return out

static func bookable(from: String, to: String) -> bool:
	return AIRPORTS.has(from) and DESTINATIONS.has(to) and to != from and String(DESTINATIONS[to].region) != ""

static func fare(to: String) -> int:
	return int(DESTINATIONS.get(to, {}).get("fare", 0))

static func gate(from: String, to: String) -> String:
	var all := DESTINATIONS.keys()
	return GATES[(all.find(to) + (0 if from == "NXC" else 2)) % GATES.size()]

# --------------------------------------------------------------------------------------------- the board
## the departures board at minute-of-day `minute`: the next flight to every destination (open or not), soonest first.
## Within 15 minutes a flight is BOARDING; a destination not open yet is NOT YET OPEN.
static func departures(from: String, minute: int) -> Array:
	var out: Array = []
	var i := 0
	for c in DESTINATIONS:
		if c == from:
			continue
		i += 1
		var offset := (i * 17 + (7 if from == "NEC" else 0)) % FLIGHT_EVERY
		var next := minute + posmod(offset - minute, FLIGHT_EVERY)
		var open := String(DESTINATIONS[c].region) != ""
		var wait := next - minute
		out.append({ "to": c, "name": DESTINATIONS[c].name, "minute": next % 1440, "time": clock(next), "gate": gate(from, c),
			"status": ("NOT YET OPEN" if not open else ("BOARDING" if wait <= 15 else "ON TIME")), "open": open })
	out.sort_custom(func(a, b): return (1 if a.open else 0) > (1 if b.open else 0) or (a.open == b.open and a.minute < b.minute))
	return out

static func clock(minute: int) -> String:
	var m := posmod(minute, 1440)
	return "%02d:%02d" % [m / 60, m % 60]

# --------------------------------------------------------------------------------------------- tickets
## First Class costs this many times the economy fare and opens the VIP lounge airside
const FIRST_CLASS := 2.5
## paint jobs for owned aircraft (hangar → YOUR AIRCRAFT → PAINT), and what a respray costs
const PAINTS := {
	"factory": Color(0, 0, 0, 0), "gunmetal": Color(0.28, 0.3, 0.33), "arctic white": Color(0.92, 0.94, 0.96),
	"midnight": Color(0.08, 0.1, 0.2), "crimson": Color(0.62, 0.08, 0.1), "gold": Color(0.85, 0.66, 0.25),
	"neon violet": Color(0.55, 0.2, 0.9), "rift teal": Color(0.1, 0.7, 0.72), "desert camo": Color(0.66, 0.55, 0.38),
}
const PAINT_PRICE := 750

static func fare_for(to: String, cls: String) -> int:
	return int(round(fare(to) * (FIRST_CLASS if cls == "first" else 1.0)))

## buys one ticket from -> to (`cls` "economy" or "first") with the profile's Nex; returns the line for the counter
static func buy_ticket(profile: Dictionary, from: String, to: String, cls := "economy") -> String:
	if not bookable(from, to):
		return "No flights to %s yet" % String(DESTINATIONS.get(to, {}).get("name", to))
	var price := fare_for(to, cls)
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	var a := air(profile)
	profile.nex = int(profile.nex) - price
	var id := "%s-%s-%d" % [from, to, a.tickets.size() + int(Time.get_unix_time_from_system()) % 100000]
	a.tickets.append({ "id": id, "from": from, "to": to, "fare": price, "class": cls })
	return "%sTicket %s → %s · gate %s · -%d Nex" % ["First Class · " if cls == "first" else "", from, to, gate(from, to), price]

static func tickets_from(profile: Dictionary, from: String) -> Array:
	return air(profile).tickets.filter(func(t): return String(t.from) == from)

## boarding uses up the ticket; false without one
static func board(profile: Dictionary, from: String, to: String) -> bool:
	var a := air(profile)
	for i in a.tickets.size():
		var t: Dictionary = a.tickets[i]
		if String(t.from) == from and String(t.to) == to:
			a.tickets.remove_at(i)
			return true
	return false

## a refund at the counter, less a 10% fee
static func refund(profile: Dictionary, ticket_id: String) -> String:
	var a := air(profile)
	for i in a.tickets.size():
		if String(a.tickets[i].id) == ticket_id:
			var back := int(round(int(a.tickets[i].fare) * 0.9))
			a.tickets.remove_at(i)
			profile.nex = int(profile.get("nex", 0)) + back
			return "Refunded %d Nex" % back
	return "No such ticket"

## the VIP lounge: a First Class pass from this airport, or a hangar here (private aviation)
static func vip(profile: Dictionary, at: String) -> bool:
	return owns_hangar(profile, at) or tickets_from(profile, at).any(func(t): return String(t.get("class", "economy")) == "first")

## security lets you airside with a boarding pass from this airport, or with a hangar here
static func can_go_airside(profile: Dictionary, at: String) -> bool:
	return not tickets_from(profile, at).is_empty() or owns_hangar(profile, at)

# --------------------------------------------------------------------------------------------- hangars and aircraft
static func owns_hangar(profile: Dictionary, at: String) -> bool:
	return air(profile).hangars.has(at)

static func hangar_bay(profile: Dictionary, at: String) -> String:
	return String(air(profile).hangars.get(at, ""))

## one hangar per airport; buying gives airside access and somewhere to keep aircraft
static func buy_hangar(profile: Dictionary, at: String, bay: String) -> String:
	if not AIRPORTS.has(at) or bay not in BAYS:
		return "No such hangar"
	var a := air(profile)
	if a.hangars.has(at):
		return "You already lease hangar %s here" % String(a.hangars[at])
	if int(profile.get("nex", 0)) < HANGAR_PRICE:
		return "Needs %d Nex (you have %d)" % [HANGAR_PRICE, int(profile.get("nex", 0))]
	profile.nex = int(profile.nex) - HANGAR_PRICE
	a.hangars[at] = bay
	return "Hangar %s is yours · -%d Nex · weapons allowed inside" % [bay, HANGAR_PRICE]

static func aircraft_at(profile: Dictionary, at: String) -> Array:
	return Array(air(profile).aircraft.get(at, []))

static func buy_aircraft(profile: Dictionary, at: String, craft: String) -> String:
	if not AIRCRAFT.has(craft):
		return "No such aircraft"
	if not owns_hangar(profile, at):
		return "Lease a hangar here first"
	var a := air(profile)
	var list: Array = Array(a.aircraft.get(at, []))
	if craft in list:
		return "%s is already in your hangar" % String(AIRCRAFT[craft].name)
	var price := int(AIRCRAFT[craft].price)
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	profile.nex = int(profile.nex) - price
	list.append(craft)
	a.aircraft[at] = list
	return "%s delivered to hangar %s · -%d Nex" % [String(AIRCRAFT[craft].name), hangar_bay(profile, at), price]

# --------------------------------------------------------------------------------------------- weapons
## may weapons be out in `zone` ("landside", "terminal", "shops", "lounge", "apron", "runway", "hangar:<bay>")?
static func weapons_allowed(profile: Dictionary, at: String, zone: String) -> bool:
	if zone in ARMED_ZONES:
		return true
	if zone.begins_with("hangar:"):
		return hangar_bay(profile, at) == zone.substr(7)
	return false

## a respray for an aircraft you own here; "factory" puts its own colours back (free)
static func paint(profile: Dictionary, at: String, craft: String, name: String) -> String:
	if craft not in aircraft_at(profile, at):
		return "That aircraft isn't in your hangar here"
	if not PAINTS.has(name):
		return "No such paint"
	var a := air(profile)
	var paints: Dictionary = a.get("paint", {})
	var price := 0 if name == "factory" else PAINT_PRICE
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	profile.nex = int(profile.nex) - price
	if name == "factory":
		paints.erase(craft)
	else:
		paints[craft] = name
	a["paint"] = paints
	return "%s: %s%s" % [String(AIRCRAFT[craft].name), name.capitalize(), "" if price == 0 else " · -%d Nex" % price]

static func paint_of(profile: Dictionary, craft: String) -> String:
	return String(air(profile).get("paint", {}).get(craft, "factory"))

# --------------------------------------------------------------------------------------------- upkeep
## the owner's airport board (Nov 15): the maintenance hangar and refuelling as places. Every owned aircraft carries a
## condition (0-100: the hull Skyways takes off with, and brings back) and a tank (0-100: burnt by the throttle in
## flight; an empty tank means no thrust, so you glide it down). Both live under air.condition / air.fuel by craft id.
const REPAIR_PER_PT := 12     # Nex per point of condition at the maintenance hangar
const FUEL_PER_PT := 3        # Nex per point of tank at the bowser
const TANK_MINUTES := 9.0     # a full tank at full throttle
static func condition(profile: Dictionary, craft: String) -> int:
	return clampi(int(air(profile).get("condition", {}).get(craft, 100)), 0, 100)
static func fuel(profile: Dictionary, craft: String) -> int:
	return clampi(int(air(profile).get("fuel", {}).get(craft, 100)), 0, 100)
static func set_condition(profile: Dictionary, craft: String, v: int) -> void:
	var a := air(profile)
	var d: Dictionary = a.get("condition", {})
	d[craft] = clampi(v, 0, 100)
	a["condition"] = d
static func set_fuel(profile: Dictionary, craft: String, v: int) -> void:
	var a := air(profile)
	var d: Dictionary = a.get("fuel", {})
	d[craft] = clampi(v, 0, 100)
	a["fuel"] = d
static func repair_price(profile: Dictionary, craft: String) -> int:
	return (100 - condition(profile, craft)) * REPAIR_PER_PT
static func refuel_price(profile: Dictionary, craft: String) -> int:
	return (100 - fuel(profile, craft)) * FUEL_PER_PT
## the maintenance hangar puts an aircraft you keep here back to 100; the line for the panel
static func repair(profile: Dictionary, at: String, craft: String) -> String:
	if craft not in aircraft_at(profile, at):
		return "That aircraft isn't in your hangar here"
	var price := repair_price(profile, craft)
	if price <= 0:
		return "%s is airworthy — nothing to repair" % String(AIRCRAFT[craft].name)
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	profile.nex = int(profile.nex) - price
	set_condition(profile, craft, 100)
	return "%s repaired to 100%% · -%d Nex" % [String(AIRCRAFT[craft].name), price]
## the bowser fills an aircraft you keep here
static func refuel(profile: Dictionary, at: String, craft: String) -> String:
	if craft not in aircraft_at(profile, at):
		return "That aircraft isn't in your hangar here"
	var price := refuel_price(profile, craft)
	if price <= 0:
		return "%s is full" % String(AIRCRAFT[craft].name)
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	profile.nex = int(profile.nex) - price
	set_fuel(profile, craft, 100)
	return "%s fuelled · -%d Nex" % [String(AIRCRAFT[craft].name), price]
