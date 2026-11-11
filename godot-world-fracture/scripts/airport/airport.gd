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
	"NXC": { "name": "Nexus City International Airport", "city": "Nexus City", "region": "nexus", "style": "nexus", "night": false, "street": true },
	"NEC": { "name": "Neon City International Airport", "city": "Neon City", "region": "neon-city", "style": "neon", "night": true, "street": true },
	"AZI": { "name": "Azure Isles International Airport", "city": "Azure Isles", "region": "azure-isles", "style": "tropical", "night": false, "street": false },
	"FRV": { "name": "Frostveil International Airport", "city": "Frostveil", "region": "frostveil", "style": "arctic", "night": false, "street": false },
	"SOL": { "name": "Solara Desert International Airport", "city": "Solara", "region": "solara", "style": "desert", "night": false, "street": false },
	# Nov 10, the rest of the owner's list that has land in the game (docs/asset-catalog.md maps the biomes): the seaplane
	# terminal on the coast for underwater Thalassia, Obsidian Reach's industrial airport in the volcanic Ember Peaks, and
	# the Shattered Expanse's expedition airfield in the Crystal Badlands' reality rifts
	"THA": { "name": "Thalassia Coast Seaplane Terminal", "city": "Thalassia Coast", "region": "thalassia", "style": "coastal", "night": false, "street": false },
	"OBS": { "name": "Obsidian Reach Airport", "city": "Obsidian Reach", "region": "ember", "style": "volcanic", "night": false, "street": false },
	"SHX": { "name": "Shattered Expanse Expedition Airfield", "city": "Shattered Expanse", "region": "crystal-badlands", "style": "expedition", "night": false, "street": false },
}
## where flights go: code -> name, the region you land in ("" = on the owner's boards but not open yet, shown and not sold),
## the fare in Nex, and the region's own name for arrivals. NXC / NEC land in the other airport's terminal.
const DESTINATIONS := {
	"NXC": { "name": "Nexus City", "region": "nexus", "fare": 150 },
	"NEC": { "name": "Neon City", "region": "neon-city", "fare": 150 },
	"THA": { "name": "Thalassia Coast", "region": "thalassia", "fare": 260 },
	"SOL": { "name": "Solara Desert", "region": "solara", "fare": 220 },
	"AZI": { "name": "Azure Isles", "region": "azure-isles", "fare": 300 },
	"FRV": { "name": "Frostveil Ice Cap", "region": "frostveil", "fare": 340 },
	"OBS": { "name": "Obsidian Reach", "region": "ember", "fare": 300 },
	"SHX": { "name": "Shattered Expanse", "region": "crystal-badlands", "fare": 380 },
	"GLD": { "name": "Goldenreach", "region": "goldenreach", "fare": 200 },
	"RVD": { "name": "Riverdale", "region": "riverdale", "fare": 160 },
	"OHR": { "name": "Old Harrow", "region": "old-harrow", "fare": 210 },
	"VRD": { "name": "Verdant Forest", "region": "veridan", "fare": 190 },
	"WST": { "name": "The Wastelands", "region": "wastelands", "fare": 240 },
	# on the Neon City board, not built yet
	"AET": { "name": "Aetherion", "region": "", "fare": 0 },
	"ELD": { "name": "Eldergrove", "region": "", "fare": 0 },
}
const GATES := ["A1", "A2", "A3", "B1", "B2", "B3"]
const FLIGHT_EVERY := 45          # minutes between departures to one destination
## the private hangars on each apron, and what they and the aircraft cost
const BAYS := ["H1", "H2", "H3"]
const HANGAR_PRICE := 6000
const AIRCRAFT := {
	"rift-helicopter": { "name": "Rift-Jumper Attack Helicopter", "price": 8000 },
	"vanguard-jet": { "name": "Resonant Strike Jet", "price": 15000 },
	"leviathan": { "name": "Leviathan Cargo Airship", "price": 25000 },
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
## buys one economy ticket from -> to with the profile's Nex; returns the line for the counter ("" never)
static func buy_ticket(profile: Dictionary, from: String, to: String) -> String:
	if not bookable(from, to):
		return "No flights to %s yet" % String(DESTINATIONS.get(to, {}).get("name", to))
	var price := fare(to)
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	var a := air(profile)
	profile.nex = int(profile.nex) - price
	var id := "%s-%s-%d" % [from, to, a.tickets.size() + int(Time.get_unix_time_from_system()) % 100000]
	a.tickets.append({ "id": id, "from": from, "to": to, "fare": price })
	return "Ticket %s → %s · gate %s · -%d Nex" % [from, to, gate(from, to), price]

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
