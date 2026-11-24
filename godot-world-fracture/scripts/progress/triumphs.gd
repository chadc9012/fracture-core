extends RefCounted
## Triumphs and Collections (owner Nov 18, interfaceingame.com Destiny 2 "Triumphs" / "Collections"). Pure rules over the
## profile and the other saves; triumphs_view.gd draws them.
##
## Lifetime counters: Progression.event bumps `profile.lifetime[kind]` beside the daily goal counter, so every kind a mode
## already reports (kill, headshot, killbox, killbox_win, boss, quest, race, street_race, ring, drive_m, shop, …) counts
## here for good. A triumph is a row in TRIUMPHS: a counter (or a `stat` worked out from the saves) and a target; its
## `score` adds to the operator's triumph score. `check(p, stats)` marks the newly met ones in `profile.triumphs` and
## returns them (Progression.grant toasts them as "TRIUMPH · title").
##
## Collections: every weapon and armor set in data/gear.json, every outfit, every vehicle. Found = owned now or ever
## (`profile.collected`, kept as a union by `remember`, so selling or scrapping an item doesn't lose it).

const Gear := preload("res://scripts/gear/gear_store.gd")

## `kinds`: lifetime counters summed; `stat`: one of the values `stats()` works out from the saves instead
const TRIUMPHS := [
	{ "id": "first-blood", "cat": "COMBAT", "title": "First Blood", "desc": "Drop your first hostile.", "kinds": ["kill"], "target": 1, "score": 5 },
	{ "id": "hostile-100", "cat": "COMBAT", "title": "Hostile Takeover", "desc": "Drop 100 hostiles.", "kinds": ["kill"], "target": 100, "score": 10 },
	{ "id": "hostile-1000", "cat": "COMBAT", "title": "Fracture Purge", "desc": "Drop 1,000 hostiles.", "kinds": ["kill"], "target": 1000, "score": 40 },
	{ "id": "head-50", "cat": "COMBAT", "title": "Sharpshooter", "desc": "Land 50 headshots.", "kinds": ["headshot"], "target": 50, "score": 10 },
	{ "id": "head-500", "cat": "COMBAT", "title": "Deadeye", "desc": "Land 500 headshots.", "kinds": ["headshot"], "target": 500, "score": 40 },
	{ "id": "kb-1", "cat": "KILLBOX", "title": "Killbox Debut", "desc": "Play a Killbox match.", "kinds": ["killbox"], "target": 1, "score": 5 },
	{ "id": "kb-win-10", "cat": "KILLBOX", "title": "Arena Victor", "desc": "Win 10 Killbox matches.", "kinds": ["killbox_win"], "target": 10, "score": 20 },
	{ "id": "kb-win-50", "cat": "KILLBOX", "title": "Killbox Legend", "desc": "Win 50 Killbox matches.", "kinds": ["killbox_win"], "target": 50, "score": 50 },
	{ "id": "quest-1", "cat": "STORY", "title": "First Resonance", "desc": "Finish a Descent quest.", "kinds": ["quest"], "target": 1, "score": 5 },
	{ "id": "quest-5", "cat": "STORY", "title": "Into the Fracture", "desc": "Finish five Descent quests.", "kinds": ["quest"], "target": 5, "score": 20 },
	{ "id": "boss-1", "cat": "STORY", "title": "Rift Walker", "desc": "Clear a Fracture boss.", "stat": "bosses", "target": 1, "score": 10 },
	{ "id": "boss-all", "cat": "STORY", "title": "Fracture Breaker", "desc": "Clear every Fracture boss at least once.", "stat": "bosses", "target": 6, "score": 50 },
	{ "id": "raid-1", "cat": "STORY", "title": "Starbreaker", "desc": "Clear Raid 01 · The Hollow Star.", "stat": "raid_clears", "target": 1, "score": 50 },
	{ "id": "race-1", "cat": "RACING", "title": "Off the Line", "desc": "Finish a race.", "kinds": ["race", "street_race"], "target": 1, "score": 5 },
	{ "id": "race-25", "cat": "RACING", "title": "Regular", "desc": "Finish 25 races.", "kinds": ["race", "street_race"], "target": 25, "score": 20 },
	{ "id": "outlaw", "cat": "RACING", "title": "Outlaw", "desc": "Reach OUTLAW on the street ladder.", "stat": "street_tier", "target": 3, "score": 20 },
	{ "id": "legend", "cat": "RACING", "title": "Street Legend", "desc": "Reach LEGEND on the street ladder.", "stat": "street_tier", "target": 5, "score": 50 },
	{ "id": "road-50", "cat": "EXPLORER", "title": "Road Warrior", "desc": "Drive 50 km in the cities.", "kinds": ["drive_m"], "target": 50000, "score": 20 },
	{ "id": "rings-100", "cat": "EXPLORER", "title": "Ring Runner", "desc": "Fly 100 Skyways rings.", "kinds": ["ring"], "target": 100, "score": 20 },
	{ "id": "shop-10", "cat": "EXPLORER", "title": "Big Spender", "desc": "Buy 10 things in the city's shops.", "kinds": ["shop"], "target": 10, "score": 10 },
	{ "id": "level-10", "cat": "OPERATOR", "title": "Seasoned", "desc": "Reach level 10.", "stat": "level", "target": 10, "score": 10 },
	{ "id": "level-25", "cat": "OPERATOR", "title": "Veteran", "desc": "Reach level 25.", "stat": "level", "target": 25, "score": 30 },
	{ "id": "collector", "cat": "OPERATOR", "title": "Collector", "desc": "Find half of everything in Collections.", "stat": "collection_pct", "target": 50, "score": 30 },
]
const CATS := ["COMBAT", "KILLBOX", "STORY", "RACING", "EXPLORER", "OPERATOR"]

static func count(p: Dictionary, kind: String, n := 1) -> void:
	var life: Dictionary = p.get("lifetime", {})
	life[kind] = int(life.get(kind, 0)) + n
	p.lifetime = life

## the values the `stat` rows read, from the profile and the other saves (`extra` overrides any, for tests)
static func stats(p: Dictionary, extra := {}) -> Dictionary:
	var out := {
		"bosses": (p.get("boss_clears", {}) as Dictionary).size(),
		"level": int(p.get("level", 1)),
		"raid_clears": 0,
		"street_tier": 0,
		"collection_pct": 0,
	}
	if not extra.has("raid_clears"):
		out.raid_clears = int(load("res://scripts/raid/hollow_star.gd").load_save().get("clears", 0))
	if not extra.has("street_tier"):
		var Career = load("res://scripts/racing/street_career.gd")
		out.street_tier = Career.load_or_fresh().tier()
	if not extra.has("collection_pct"):
		var c := collections(p, Gear.load_save())
		out.collection_pct = int(round(100.0 * float(c.found) / maxf(float(c.total), 1.0)))
	for k in extra:
		out[k] = extra[k]
	return out

static func progress(p: Dictionary, t: Dictionary, st: Dictionary) -> int:
	if t.has("stat"):
		return int(st.get(t.stat, 0))
	var life: Dictionary = p.get("lifetime", {})
	var n := 0
	for k in t.kinds:
		n += int(life.get(k, 0))
	return n

## marks the triumphs met now and returns them (each once, ever)
static func check(p: Dictionary, st := {}) -> Array:
	var done: Dictionary = p.get("triumphs", {})
	var fresh: Array = []
	var s := st if not st.is_empty() else stats(p)
	for t in TRIUMPHS:
		if done.has(t.id):
			continue
		if progress(p, t, s) >= int(t.target):
			done[t.id] = int(Time.get_unix_time_from_system())
			fresh.append(t)
	p.triumphs = done
	return fresh

static func score(p: Dictionary) -> int:
	var done: Dictionary = p.get("triumphs", {})
	var n := 0
	for t in TRIUMPHS:
		if done.has(t.id):
			n += int(t.score)
	return n

static func max_score() -> int:
	var n := 0
	for t in TRIUMPHS:
		n += int(t.score)
	return n

## everything the operator owns now goes into `profile.collected` (kept for good)
static func remember(p: Dictionary, gear: Dictionary) -> void:
	var c: Dictionary = p.get("collected", {})
	for k in ["weapons", "armor", "outfits"]:
		if not c.has(k):
			c[k] = []
	for it in gear.get("items", []):
		var name := String(it.get("name", ""))
		var bucket := "weapons" if String(it.get("slot", "")) in ["primary", "secondary", "heavy", "melee"] else "armor"
		if name != "" and not (c[bucket] as Array).has(name):
			(c[bucket] as Array).append(name)
	for o in gear.get("outfits", []):
		if not (c.outfits as Array).has(String(o)):
			(c.outfits as Array).append(String(o))
	p.collected = c

## the collection book: {sections: [{name, entries: [{name, sub, rarity, found, frame}]}], found, total}
static func collections(p: Dictionary, gear: Dictionary) -> Dictionary:
	remember(p, gear)
	var c: Dictionary = p.collected
	var sections: Array = []
	var found := 0
	var total := 0
	var weapons: Array = []
	var seen := {}
	for w in Gear.data().get("weapons", []):
		var nm := String(w.name)
		if seen.has(nm):
			continue
		seen[nm] = true
		var f: bool = (c.weapons as Array).has(nm)
		# melee items carry a gun frame for their stats; they get no gun picture
		weapons.append({ "name": nm, "sub": "%s · %s" % [Gear.SLOT_NAME.get(String(w.slot), String(w.slot)), String(w.get("element", "")).capitalize()], "rarity": String(w.get("rarity", "common")), "found": f, "frame": "" if String(w.slot) == "melee" else String(w.get("frame", "")), "slot": String(w.slot) })
	# grouped by slot as Destiny's collection is (kinetic, energy, power, melee), catalogue order within
	var order := ["primary", "secondary", "heavy", "melee"]
	var by_slot: Array = []
	for sl in order:
		by_slot.append_array(weapons.filter(func(x): return x.slot == sl))
	by_slot.append_array(weapons.filter(func(x): return not (x.slot in order)))
	sections.append({ "name": "WEAPONS", "entries": by_slot })
	var armor: Array = []
	for s in Gear.data().get("armorSets", []):
		var pieces: Dictionary = s.get("pieces", {})
		var have := 0
		for slot in pieces:
			if (c.armor as Array).has(String(pieces[slot])):
				have += 1
		armor.append({ "name": String(s.get("name", s.id)), "sub": "%d / %d pieces · %s" % [have, pieces.size(), String(s.get("element", "")).capitalize()], "rarity": "epic", "found": have > 0, "complete": have == pieces.size() })
	sections.append({ "name": "ARMOR SETS", "entries": armor })
	var outfits: Array = []
	for o in Gear.data().get("outfits", []):
		outfits.append({ "name": String(o.name), "sub": String(o.get("style", "")), "rarity": "rare", "found": (c.outfits as Array).has(String(o.id)) })
	sections.append({ "name": "OUTFITS", "entries": outfits })
	var Dealer = load("res://scripts/garage/dealership.gd")
	var Catalog = load("res://scripts/garage/catalog.gd")
	var owned: Array = Dealer.owned(p)
	var cars: Array = []
	for v in Catalog.VEHICLES + Catalog.SHOWROOM:
		cars.append({ "name": String(v.name), "sub": String(v.get("cls", "")).capitalize(), "rarity": "exotic" if v.has("price") and int(v.price) >= 25000 else ("epic" if v.has("price") else "uncommon"), "found": owned.has(String(v.id)) })
	sections.append({ "name": "VEHICLES", "entries": cars })
	for s in sections:
		for e in s.entries:
			total += 1
			if bool(e.found):
				found += 1
	return { "sections": sections, "found": found, "total": total }
