extends RefCounted
## Nexus City's named people (owner, Nov 11: realistic NPCs with jobs, homes, personalities and daily schedules; three
## tiers — background crowds are crowd.gd / civilians.gd, these are tier 2 "interactive", tier 3 unique story people
## come later). Pure data and rules, node-free: npc_street.gd puts them on the street, tests/npc/npc_test.gd checks them.
##
## A person: id, name, age, body ("male" / "female"), build ("slim" / "athletic" / "heavy"), job, personality, their
## workplace and a schedule of [from_hour, to_hour, place, activity] (hours 0-24 on the device clock; a block that
## crosses midnight is written 22 → 4). Off-schedule they're "home" (not on the street). Activities: work (stand at the
## place), patrol (walk the avenue between `beat` z's), route (walk between the places in `route`), sit, play (busk),
## shop, wait (a commuter at a stop).

## places on the Nexus avenue: which sidewalk (side -1 west / +1 east) and z, a little off the hub doors so nobody
## stands in a doorway (street_slice.gd DOORS)
const PLACES := {
	"cafe": { "side": -1.0, "z": 36.0, "label": "the café" },
	"garage": { "side": 1.0, "z": 13.0, "label": "the garage" },
	"plaza": { "side": 1.0, "z": 30.0, "label": "the plaza stalls" },
	"block": { "side": 1.0, "z": 67.0, "label": "Block Supply" },
	"mall": { "side": -1.0, "z": -95.0, "label": "the Galleria" },
	"apartments": { "side": -1.0, "z": 57.0, "label": "the apartment block" },
	"sports": { "side": -1.0, "z": 25.0, "label": "the Sports District" },
	"killbox": { "side": -1.0, "z": -47.0, "label": "the Killbox terminal" },
	"airport": { "side": 1.0, "z": -35.0, "label": "the Airport Express stop" },
	"skyways": { "side": 1.0, "z": -69.0, "label": "the Skyways stop" },
	"descent": { "side": 1.0, "z": 83.0, "label": "the crash-site works" },
	"rift": { "side": -1.0, "z": 104.0, "label": "the Rift Gate" },
	"precinct": { "side": 1.0, "z": -12.0, "label": "the police kiosk" },
}

## personality: how they talk and how fast they warm to you (warmth multiplies affinity gains)
const PERSONALITIES := {
	"warm": 1.3, "gruff": 0.7, "nervous": 0.9, "cheerful": 1.2, "cynical": 0.6, "proud": 0.8, "shy": 1.0, "chatty": 1.2,
}

## the roster. `outfit` is what they wear (scripts/character/outfits.gd ids, on the realistic civ bodies); `police`
## makes them the law on the avenue.
const PEOPLE := [
	{ "id": "rosa", "name": "Rosa Delgado", "age": 34, "body": "female", "build": "athletic", "job": "barista", "personality": "warm",
		"outfit": "denim", "schedule": [[6, 15, "cafe", "work"], [16, 18, "mall", "shop"]] },
	{ "id": "marcus", "name": "Marcus “Wrench” Okafor", "age": 41, "body": "male", "build": "heavy", "job": "mechanic", "personality": "gruff",
		"outfit": "workwear", "schedule": [[8, 18, "garage", "work"], [18, 20, "plaza", "sit"]] },
	{ "id": "dana", "name": "Officer Dana Kim", "age": 29, "body": "female", "build": "athletic", "job": "police officer", "personality": "proud",
		"outfit": "black-denim", "police": true, "beat": [-90.0, 90.0], "schedule": [[8, 20, "precinct", "patrol"]] },
	{ "id": "luis", "name": "Officer Luis Moreno", "age": 45, "body": "male", "build": "heavy", "job": "police officer", "personality": "cynical",
		"outfit": "black-denim", "police": true, "beat": [-110.0, 110.0], "schedule": [[20, 8, "precinct", "patrol"]] },
	{ "id": "priya", "name": "Priya Raman", "age": 26, "body": "female", "build": "slim", "job": "courier", "personality": "chatty",
		"outfit": "tracksuit", "route": ["garage", "block", "cafe", "mall", "airport"], "schedule": [[9, 17, "garage", "route"]] },
	{ "id": "theo", "name": "Theo Brandt", "age": 58, "body": "male", "build": "heavy", "job": "food-stall owner", "personality": "chatty",
		"outfit": "sunset-tee", "schedule": [[11, 22, "plaza", "work"]] },
	{ "id": "jade", "name": "Jade Walker", "age": 22, "body": "female", "build": "slim", "job": "clothing clerk", "personality": "cheerful",
		"outfit": "pastel-set", "schedule": [[10, 19, "block", "work"], [19, 21, "sports", "shop"]] },
	{ "id": "samuel", "name": "Samuel Adeyemi", "age": 63, "body": "male", "build": "slim", "job": "retired teacher", "personality": "chatty",
		"outfit": "heather-hoodie", "schedule": [[9, 12, "apartments", "sit"], [14, 16, "cafe", "sit"], [17, 19, "plaza", "sit"]] },
	{ "id": "nina", "name": "Nina Petrova", "age": 31, "body": "female", "build": "slim", "job": "Galleria concierge", "personality": "proud",
		"outfit": "techwear", "schedule": [[10, 20, "mall", "work"]] },
	{ "id": "kofi", "name": "Kofi Mensah", "age": 38, "body": "male", "build": "athletic", "job": "Operator recruiter", "personality": "cynical",
		"outfit": "crimson-tracksuit", "schedule": [[12, 23, "killbox", "work"]] },
	{ "id": "elena", "name": "Elena Cruz", "age": 27, "body": "female", "build": "athletic", "job": "nurse", "personality": "shy",
		"outfit": "sand-hoodie", "schedule": [[7, 8, "airport", "wait"], [19, 20, "airport", "wait"], [20, 21, "cafe", "sit"]] },
	{ "id": "ravi", "name": "Ravi “Ghost” Shah", "age": 24, "body": "male", "build": "slim", "job": "freelance hacker", "personality": "nervous",
		"outfit": "street-hoodie", "schedule": [[21, 3, "skyways", "work"]] },
	{ "id": "tony", "name": "Big Tony Russo", "age": 50, "body": "male", "build": "heavy", "job": "“import consultant”", "personality": "gruff",
		"outfit": "bomber", "schedule": [[22, 4, "rift", "work"]] },
	{ "id": "mei", "name": "Mei Lin", "age": 35, "body": "female", "build": "athletic", "job": "Sports District attendant", "personality": "cheerful",
		"outfit": "varsity", "schedule": [[14, 23, "sports", "work"]] },
	{ "id": "jonah", "name": "Jonah Price", "age": 19, "body": "male", "build": "slim", "job": "street musician", "personality": "shy",
		"outfit": "tee-shorts", "schedule": [[16, 23, "plaza", "play"]] },
	{ "id": "gloria", "name": "Gloria Haynes", "age": 52, "body": "female", "build": "heavy", "job": "construction foreman", "personality": "gruff",
		"outfit": "olive-utility", "schedule": [[7, 16, "descent", "work"]] },
]

static func by_id(id: String) -> Dictionary:
	for p in PEOPLE:
		if String(p.id) == id:
			return p
	return {}

## is `hour` (0-23.99) inside [from, to)? Handles blocks across midnight (22 → 4).
static func in_block(hour: float, from: float, to: float) -> bool:
	if from <= to:
		return hour >= from and hour < to
	return hour >= from or hour < to

## where someone is at `hour`: {place, activity} or {} when they're home
static func where(p: Dictionary, hour: float) -> Dictionary:
	for b in p.schedule:
		if in_block(hour, float(b[0]), float(b[1])):
			return { "place": String(b[2]), "activity": String(b[3]) }
	return {}

## everyone out on the street at `hour`, as [{person, place, activity}]
static func out_at(hour: float) -> Array:
	var out: Array = []
	for p in PEOPLE:
		var w := where(p, hour)
		if not w.is_empty():
			out.append({ "person": p, "place": w.place, "activity": w.activity })
	return out

## the point on the avenue for a place (x from the sidewalk line, a per-person shuffle so two at one place don't stack)
static func spot(place: String, id: String, walk_x := 11.5) -> Vector3:
	var pl: Dictionary = PLACES.get(place, PLACES.plaza)
	var h := hash(id)
	var dz := float(h % 7) - 3.0
	var dx := float((h / 7) % 3) * 0.6
	return Vector3(float(pl.side) * (walk_x + 1.6 + dx), 0.18, float(pl.z) + dz)

static func is_police(p: Dictionary) -> bool:
	return bool(p.get("police", false))
