extends RefCounted
## The season pass (owner Nov 18, interfaceingame.com The Finals "Battle Pass"): a season runs SEASON_DAYS days; every
## TIER_XP of the XP you earn anywhere (Progression.grant hands it over) climbs a tier, up to TIERS; each tier holds a
## reward you claim on the pass screen (season_view.gd). A new season starts the track over. Pure rules over the profile
## (`profile.season` = {id, xp, claimed: [tier numbers]}) and the gear save for what lands in the bag.
##   rewards: nex (Nex), outfit (an outfit id, worn from the wardrobe), drop (a guaranteed boss-grade drop at your power),
##            furniture (a piece for Apartment 12-04)
const Gear := preload("res://scripts/gear/gear_store.gd")

const SEASON_DAYS := 56
const TIER_XP := 500
const TIERS := 30
## day 20775 is Nov 18 2026, when the first season opened
const EPOCH_DAY := 20775
const NAMES := ["FRACTURE", "NEON NIGHTS", "IRON TIDE", "GHOST SIGNAL"]

const REWARDS := [
	{ "kind": "nex", "n": 300 }, { "kind": "furniture", "id": "plant-fern" }, { "kind": "nex", "n": 400 },
	{ "kind": "outfit", "id": "casual" }, { "kind": "drop" }, { "kind": "nex", "n": 500 },
	{ "kind": "furniture", "id": "lamp-neon" }, { "kind": "nex", "n": 600 }, { "kind": "outfit", "id": "gym" },
	{ "kind": "drop" }, { "kind": "nex", "n": 750 }, { "kind": "furniture", "id": "rug-circuit" },
	{ "kind": "nex", "n": 800 }, { "kind": "outfit", "id": "athletic" }, { "kind": "drop" },
	{ "kind": "nex", "n": 1000 }, { "kind": "furniture", "id": "art-fracture" }, { "kind": "nex", "n": 1100 },
	{ "kind": "outfit", "id": "explorer" }, { "kind": "drop" }, { "kind": "nex", "n": 1300 },
	{ "kind": "furniture", "id": "table-oak" }, { "kind": "nex", "n": 1500 }, { "kind": "outfit", "id": "racer" },
	{ "kind": "drop" }, { "kind": "nex", "n": 1800 }, { "kind": "furniture", "id": "sofa-velvet" },
	{ "kind": "nex", "n": 2200 }, { "kind": "drop" }, { "kind": "outfit", "id": "cyberpunk" },
]

static func day(now_unix := -1) -> int:
	return int((now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())) / 86400)

## the season in force: {id 1.., name, days_left}
static func current(now_unix := -1) -> Dictionary:
	var d := maxi(0, day(now_unix) - EPOCH_DAY)
	var id := d / SEASON_DAYS + 1
	return { "id": id, "name": String(NAMES[(id - 1) % NAMES.size()]), "days_left": SEASON_DAYS - d % SEASON_DAYS }

## the profile's season record, started over when the season has turned
static func state(p: Dictionary, now_unix := -1) -> Dictionary:
	var id := int(current(now_unix).id)
	var s: Variant = p.get("season", {})
	if not (s is Dictionary) or int((s as Dictionary).get("id", 0)) != id:
		s = { "id": id, "xp": 0, "claimed": [] }
		p.season = s
	return s

static func tier(p: Dictionary, now_unix := -1) -> int:
	return mini(TIERS, int(state(p, now_unix).xp) / TIER_XP)

## XP towards the next tier and the tier's cost (TIER_XP; full once the track is done)
static func bar(p: Dictionary, now_unix := -1) -> Vector2i:
	if tier(p, now_unix) >= TIERS:
		return Vector2i(TIER_XP, TIER_XP)
	return Vector2i(int(state(p, now_unix).xp) % TIER_XP, TIER_XP)

## XP earned (Progression.grant): returns the tiers it newly reached
static func add_xp(p: Dictionary, xp: int, now_unix := -1) -> Array:
	var before := tier(p, now_unix)
	var s := state(p, now_unix)
	s.xp = int(s.xp) + maxi(0, xp)
	var out: Array = []
	for t in range(before + 1, tier(p, now_unix) + 1):
		out.append(t)
	return out

static func claimed(p: Dictionary, t: int, now_unix := -1) -> bool:
	# the save comes back as floats (JSON): compare as whole numbers
	return (state(p, now_unix).claimed as Array).any(func(c): return int(c) == t)

static func can_claim(p: Dictionary, t: int, now_unix := -1) -> bool:
	return t >= 1 and t <= tier(p, now_unix) and not claimed(p, t, now_unix)

## a reward's name for the track and the claim line
static func label(r: Dictionary) -> String:
	match String(r.kind):
		"nex": return "%d Nex" % int(r.n)
		"outfit": return String(Gear.outfit(String(r.id)).get("name", r.id)) + " outfit"
		"furniture": return String(Gear.furniture(String(r.id)).get("name", r.id))
		"drop": return "Elite gear drop"
	return "?"

## claims tier `t` into the profile and the gear save `g` (both changed; the caller saves). Returns the line said, ""
## when it can't be claimed. An outfit or piece already owned pays its price in Nex instead.
static func claim(p: Dictionary, g: Dictionary, t: int, op_power := 100.0, now_unix := -1) -> String:
	if not can_claim(p, t, now_unix):
		return ""
	var r: Dictionary = REWARDS[t - 1]
	var line := label(r)
	match String(r.kind):
		"nex":
			p.nex = int(p.get("nex", 0)) + int(r.n)
		"outfit":
			var owned: Array = g.get("outfits", [])
			if owned.has(String(r.id)):
				var refund := int(Gear.outfit(String(r.id)).get("price", 0) if Gear.outfit(String(r.id)).get("price") != null else 0)
				p.nex = int(p.get("nex", 0)) + refund
				line += " (owned: +%d Nex)" % refund
			else:
				owned.append(String(r.id))
				g.outfits = owned
		"furniture":
			var have: Array = g.get("furniture", [])
			if have.has(String(r.id)):
				var refund := int(Gear.furniture(String(r.id)).get("price", 0))
				p.nex = int(p.get("nex", 0)) + refund
				line += " (owned: +%d Nex)" % refund
			else:
				have.append(String(r.id))
				g.furniture = have
		"drop":
			var it := Gear.roll_drop(g, "boss", 0.0, op_power, hash("season-%d-%d" % [int(state(p, now_unix).id), t]))
			if not it.is_empty():
				line = String(it.name)
	(state(p, now_unix).claimed as Array).append(t)
	return "SEASON TIER %d  ·  %s" % [t, line]
