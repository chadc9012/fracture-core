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
	# tier 3: the story's own people (docs/story/WorldFracture_Dialogue_Bible_Draft1.md). Captain Vale leads the Operator
	# response team; she's on the avenue only once you've met her in Mission 01's chapters 04-05 (profile m05_choice)
	{ "id": "vale", "name": "Captain Vale", "age": 44, "body": "female", "build": "athletic", "job": "Operator response captain", "personality": "proud",
		"outfit": "olive-utility", "tier": 3, "needs": "m05_choice", "beat": [-40.0, 40.0], "schedule": [[9, 13, "precinct", "patrol"], [13, 19, "plaza", "work"]] },
	{ "id": "gloria", "name": "Gloria Haynes", "age": 52, "body": "female", "build": "heavy", "job": "construction foreman", "personality": "gruff",
		"outfit": "olive-utility", "schedule": [[7, 16, "descent", "work"]] },
]

# --------------------------------------------------------------------------------------------- Neon City (Nov 11)
## Neon City's avenue (the same street, Neon style): its doors are the casino (z -82), the metro (-118), the garage (8),
## the Airport Express (-40) and Block Supply (62); people stand a little off them
const NEON_PLACES := {
	"casino": { "side": -1.0, "z": -76.0, "label": "the Grand Casino doors" },
	"garage": { "side": 1.0, "z": 13.0, "label": "the garage" },
	"noodles": { "side": 1.0, "z": 30.0, "label": "the noodle stall" },
	"market": { "side": -1.0, "z": 36.0, "label": "the night market" },
	"metro": { "side": 1.0, "z": -112.0, "label": "the metro steps" },
	"block": { "side": 1.0, "z": 67.0, "label": "Block Supply" },
	"airport": { "side": 1.0, "z": -35.0, "label": "the Airport Express stop" },
	"arcade": { "side": -1.0, "z": 12.0, "label": "the arcade" },
	"corner": { "side": -1.0, "z": 96.0, "label": "the corner by the hologram" },
	"alley": { "side": -1.0, "z": -58.0, "label": "the alley mouth" },
}

## Neon City wakes up at night: racers, the casino, the night market, hackers; the law works both shifts
const NEON := [
	{ "id": "kai", "name": "Kai “Redline” Tanaka", "age": 27, "body": "male", "build": "athletic", "job": "street racer", "personality": "proud",
		"outfit": "midnight-varsity", "schedule": [[20, 4, "garage", "work"]] },
	{ "id": "vex", "name": "Vex Morales", "age": 30, "body": "female", "build": "heavy", "job": "casino door", "personality": "gruff",
		"outfit": "black-denim", "schedule": [[18, 6, "casino", "work"]] },
	{ "id": "hana", "name": "Hana Sato", "age": 24, "body": "female", "build": "slim", "job": "nightlife promoter", "personality": "chatty",
		"outfit": "pastel-set", "schedule": [[21, 3, "casino", "work"]] },
	{ "id": "dex", "name": "Dex Okoro", "age": 33, "body": "male", "build": "athletic", "job": "tech-repair stall", "personality": "cynical",
		"outfit": "techwear", "schedule": [[16, 2, "market", "work"]] },
	{ "id": "lin", "name": "Lin Yue", "age": 45, "body": "female", "build": "athletic", "job": "noodle-stall owner", "personality": "warm",
		"outfit": "heather-hoodie", "schedule": [[17, 3, "noodles", "work"]] },
	{ "id": "rhea", "name": "Officer Rhea Banks", "age": 36, "body": "female", "build": "athletic", "job": "police officer", "personality": "proud",
		"outfit": "black-denim", "police": true, "beat": [-100.0, 100.0], "schedule": [[18, 6, "metro", "patrol"]] },
	{ "id": "marco", "name": "Officer Marco Diaz", "age": 41, "body": "male", "build": "heavy", "job": "police officer", "personality": "cynical",
		"outfit": "black-denim", "police": true, "beat": [-90.0, 90.0], "schedule": [[6, 18, "metro", "patrol"]] },
	{ "id": "juno", "name": "Juno Park", "age": 19, "body": "female", "build": "slim", "job": "freelance hacker", "personality": "nervous",
		"outfit": "street-hoodie", "schedule": [[22, 4, "metro", "work"]] },
	{ "id": "silas", "name": "Silas Crane", "age": 52, "body": "male", "build": "slim", "job": "casino pit boss", "personality": "proud",
		"outfit": "bomber", "schedule": [[19, 5, "casino", "work"]] },
	{ "id": "tasha", "name": "Tasha Greene", "age": 28, "body": "female", "build": "athletic", "job": "mechanic", "personality": "cheerful",
		"outfit": "workwear", "schedule": [[10, 22, "garage", "work"]] },
	{ "id": "benny", "name": "Benny “Bolt” Reyes", "age": 23, "body": "male", "build": "slim", "job": "courier", "personality": "chatty",
		"outfit": "tracksuit", "route": ["garage", "noodles", "block", "metro", "airport"], "schedule": [[12, 24, "garage", "route"]] },
	{ "id": "ivy", "name": "Ivy Chen", "age": 31, "body": "female", "build": "slim", "job": "arcade attendant", "personality": "cheerful",
		"outfit": "varsity", "schedule": [[6, 17, "arcade", "work"], [17, 19, "noodles", "sit"]] },
	{ "id": "moss", "name": "Old Moss", "age": 70, "body": "male", "build": "slim", "job": "street preacher", "personality": "cynical",
		"outfit": "sand-hoodie", "schedule": [[14, 22, "corner", "work"]] },
	# tier 3: Fixer Sable (the dialogue draft's Neon City fixer, open-world ambient): jobs pay three times as much and
	# draw the law's attention
	{ "id": "sable", "name": "Fixer Sable", "age": 38, "body": "female", "build": "slim", "job": "fixer", "personality": "cynical",
		"outfit": "techwear", "tier": 3, "pay": 3, "heat": 3.0, "schedule": [[20, 4, "alley", "work"]] },
]

const ROSTERS := { "nexus": PEOPLE, "neon": NEON }
const CITY_PLACES := { "nexus": PLACES, "neon": NEON_PLACES }

static func roster(city: String) -> Array:
	return ROSTERS.get(city, PEOPLE)

static func places(city: String) -> Dictionary:
	return CITY_PLACES.get(city, PLACES)

static func by_id(id: String) -> Dictionary:
	for city in ROSTERS:
		for p in ROSTERS[city]:
			if String(p.id) == id:
				return p
	return {}

static func city_of(id: String) -> String:
	for city in ROSTERS:
		for p in ROSTERS[city]:
			if String(p.id) == id:
				return city
	return "nexus"

## a tier 3 person may wait on the story: `needs` names a profile key that must be set (Captain Vale: m05_choice)
static func available(p: Dictionary, profile: Dictionary) -> bool:
	var need := String(p.get("needs", ""))
	return need == "" or String(profile.get(need, "")) != ""

static func tier(p: Dictionary) -> int:
	return int(p.get("tier", 2))

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
static func out_at(hour: float, city := "nexus", profile := {}) -> Array:
	var out: Array = []
	for p in roster(city):
		if not available(p, profile):
			continue
		var w := where(p, hour)
		if not w.is_empty():
			out.append({ "person": p, "place": w.place, "activity": w.activity })
	return out

## the point on the avenue for a place (x from the sidewalk line, a per-person shuffle so two at one place don't stack)
static func spot(place: String, id: String, walk_x := 11.5) -> Vector3:
	var all := places(city_of(id))
	var pl: Dictionary = all.get(place, all.values()[0])
	var h := hash(id)
	var dz := float(h % 7) - 3.0
	var dx := float((h / 7) % 3) * 0.6
	return Vector3(float(pl.side) * (walk_x + 1.6 + dx), 0.18, float(pl.z) + dz)

static func is_police(p: Dictionary) -> bool:
	return bool(p.get("police", false))
