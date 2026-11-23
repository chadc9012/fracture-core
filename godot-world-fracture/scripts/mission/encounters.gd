extends RefCounted
## The 18 hidden unique encounters (owner, Nov 23: "how each of the unique encounters are triggered and missions to go
## behind them"): pure rules over data/dialogue/unique_encounters.json (tools/campaign/unique_encounters.py) and the
## profile, node-free so tests run headless. Mirrors the web's encounter journal (src/game/encounter-journal.ts) key for
## key, in the profile's `enc` list:
##   enc-clue:<encounter>:<clue>   a clue found — ACCOUNT-wide, so another operator never searches again
##   enc-found:<encounter>         discovered (two clues, or every clue when it has fewer)
##   enc-done:<operator>:<encounter>  cleared by THIS operator: the reward is personal
## An encounter's clues can only be found once the main story has finished its `after` mission. Routes:
##   story  — finishing a main mission (`after` on the clue) hands it over (`on_story`)
##   npc    — the person's "Strange stories?" answer (npc_street.gd → `npc_clue` / `record_clue`)
##   world / site — standing within reach of a POI of that world (`sense`, from descent.gd and arrival_view.gd)
##   combat — a kill in that world, with the clue's element if it names one, at its `chance` (`on_kill`)
## Discovered, the ENCOUNTER JOURNAL (encounter_journal.gd) offers its lead-in mission (unique_encounter.gd); the fight
## pays through `clear`.

const DATA := "res://data/dialogue/unique_encounters.json"
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const WORLD_R := 30.0    # metres from a clue's POI
const SITE_R := 45.0     # metres from the lair
## completion is per operator; this build has one operator per profile, so its id is fixed (the web keys by class)
const OPERATOR := "op"

static var _data: Dictionary = {}
static var _pois := {}     # world -> {poi id: Vector2 map position}

static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(DATA, FileAccess.READ)
		var d: Variant = JSON.parse_string(f.get_as_text()) if f else null
		_data = d if d is Dictionary else { "encounters": [], "missions": [], "lines": [], "bosses": {} }
	return _data

static func all() -> Array:
	return data().get("encounters", [])

static func by_id(id: String) -> Dictionary:
	for e in all():
		if String(e.id) == id:
			return e
	return {}

static func by_mission(mid: String) -> Dictionary:
	for e in all():
		if String(e.mission) == mid:
			return e
	return {}

# --------------------------------------------------------------------------------------------- the journal's state
static func _keys(p: Dictionary) -> Array:
	if not p.has("enc") or not (p.enc is Array):
		p["enc"] = []
	return p.enc

static func has_key(p: Dictionary, k: String) -> bool:
	return _keys(p).has(k)

static func _add(p: Dictionary, k: String) -> void:
	if not has_key(p, k):
		_keys(p).append(k)

static func clue_key(e: String, c: String) -> String:
	return "enc-clue:%s:%s" % [e, c]

static func found_key(e: String) -> String:
	return "enc-found:%s" % e

static func done_key(e: String) -> String:
	return "enc-done:%s:%s" % [OPERATOR, e]

static func threshold(e: Dictionary) -> int:
	return mini((e.clues as Array).size(), 2)

static func known(p: Dictionary, e: Dictionary) -> Array:
	var out := []
	for c in e.clues:
		if has_key(p, clue_key(String(e.id), String(c.id))):
			out.append(c)
	return out

static func is_discovered(p: Dictionary, eid: String) -> bool:
	return has_key(p, found_key(eid))

static func is_done(p: Dictionary, eid: String) -> bool:
	return has_key(p, done_key(eid))

## the main story has reached the place where its rumours start
static func is_open(p: Dictionary, e: Dictionary) -> bool:
	var after := String(e.get("after", ""))
	return after == "" or (p.get("aftershock_done", []) as Array).has(after)

## records a clue (idempotent). {"new": bool, "discovered": bool, "toast": [lines]}
static func record_clue(p: Dictionary, eid: String, cid: String) -> Dictionary:
	var out := { "new": false, "discovered": false, "toast": [] }
	var e := by_id(eid)
	if e.is_empty() or has_key(p, clue_key(eid, cid)):
		return out
	var clue := {}
	for c in e.clues:
		if String(c.id) == cid:
			clue = c
	if clue.is_empty():
		return out
	_add(p, clue_key(eid, cid))
	out.new = true
	out.toast.append("CLUE · %s" % String(clue.get("found", clue.text)))
	if not is_discovered(p, eid) and known(p, e).size() >= threshold(e):
		_add(p, found_key(eid))
		out.discovered = true
		out.toast.append("ENCOUNTER DISCOVERED · %s — open the Encounter Journal" % String(e.name))
	elif not is_discovered(p, eid):
		out.toast.append("Something unknown in %s. One lead is not a pattern." % String(e.region))
	return out

## NOVA's optional hint: none with no clues, vague with one, pointed with more. Never the trigger itself.
static func hint(p: Dictionary, e: Dictionary) -> String:
	var n := known(p, e).size()
	if n == 0 or is_discovered(p, String(e.id)):
		return ""
	if n == 1:
		return "NOVA: One lead is not a pattern. Look for a second clue in a different place."
	return "NOVA: Your clues point toward %s. Compare them and look for the odd detail." % String(e.region)

# --------------------------------------------------------------------------------------------- finding clues
## every clue whose main mission is done (call when a story mission finishes, and when the journal opens)
static func on_story(p: Dictionary) -> Array:
	var toast := []
	var done: Array = p.get("aftershock_done", [])
	for e in all():
		if not is_open(p, e):
			continue
		for c in e.clues:
			if String(c.route) == "story" and done.has(String(c.get("after", ""))):
				toast.append_array(record_clue(p, String(e.id), String(c.id)).toast)
	return toast

## the POIs of a world, by id (map coordinates)
static func pois(world: String) -> Dictionary:
	if not _pois.has(world):
		var m := {}
		var f := FileAccess.open("res://generated/maps/%s.json" % world, FileAccess.READ)
		var d: Variant = JSON.parse_string(f.get_as_text()) if f else null
		if d is Dictionary:
			for poi in d.get("pois", []):
				m[String(poi.id)] = Vector2(float(poi.x), float(poi.z))
		_pois[world] = m
	return _pois[world]

## the place clues of a world: [{e, c, at, r}] — cheap to test against every frame without the profile
static func places(world: String) -> Array:
	var out := []
	var at := pois(world)
	for e in all():
		for c in e.clues:
			var route := String(c.route)
			if (route == "site" or route == "world") and String(c.get("world", e.world)) == world and at.has(String(c.poi)):
				out.append({ "e": String(e.id), "c": String(c.id), "at": at[String(c.poi)], "r": SITE_R if route == "site" else WORLD_R })
	return out

## the place clues within reach of `map_pos` (no profile read): the caller then records them with `sense`
static func near(world: String, map_pos: Vector2) -> Array:
	var out := []
	for pl in places(world):
		if map_pos.distance_to(pl.at) <= float(pl.r):
			out.append(pl)
	return out

## records the place clues within reach; returns the lines to toast
static func sense(p: Dictionary, world: String, map_pos: Vector2) -> Array:
	var toast := []
	for pl in near(world, map_pos):
		if is_open(p, by_id(String(pl.e))):
			toast.append_array(record_clue(p, String(pl.e), String(pl.c)).toast)
	return toast

## any combat clue in this world (a kill checks this before reading the profile)
static func combat_in(world: String) -> bool:
	for e in all():
		for c in e.clues:
			if String(c.route) == "combat" and String(c.get("world", e.world)) == world:
				return true
	return false

## a kill in `world` with `kind` (the gun's element, MELEE, GRENADE): the combat clues it can turn up
static func on_kill(p: Dictionary, world: String, kind: String, roll := -1.0) -> Array:
	var toast := []
	for e in all():
		if not is_open(p, e):
			continue
		for c in e.clues:
			if String(c.route) != "combat" or String(c.get("world", e.world)) != world:
				continue
			if String(c.get("element", "")) != "" and String(c.element) != kind:
				continue
			if has_key(p, clue_key(String(e.id), String(c.id))):
				continue
			var r := roll if roll >= 0.0 else randf()
			if r <= float(c.get("chance", 1.0)):
				toast.append_array(record_clue(p, String(e.id), String(c.id)).toast)
	return toast

## the first rumour this person has that the player doesn't: {"e": id, "c": clue} or {}
static func npc_clue(p: Dictionary, npc: String) -> Dictionary:
	for e in all():
		if not is_open(p, e):
			continue
		for c in e.clues:
			if String(c.route) == "npc" and String(c.npc) == npc and not has_key(p, clue_key(String(e.id), String(c.id))):
				return { "e": String(e.id), "c": c }
	return {}

## does this person know any rumour at all (open, known or not) — they keep telling it once you have it
static func npc_rumour(p: Dictionary, npc: String) -> Dictionary:
	for e in all():
		if not is_open(p, e):
			continue
		for c in e.clues:
			if String(c.route) == "npc" and String(c.npc) == npc:
				return { "e": String(e.id), "c": c }
	return {}

# --------------------------------------------------------------------------------------------- the fight
## a clear by this operator: marks it done (and discovered), pays the encounter's own reward — in full and its drop the
## first time, a third and no drop after. Returns the lines to toast.
static func clear(p: Dictionary, eid: String) -> Array:
	var e := by_id(eid)
	if e.is_empty():
		return []
	var first := not is_done(p, eid)
	_add(p, found_key(eid))
	_add(p, done_key(eid))
	var nex := int(e.get("nex", 0)) / (1 if first else 3)
	var xp := int(e.get("xp", 0)) / (1 if first else 3)
	var res: Dictionary = Progression.grant(p, "unique", nex, xp, String(e.name) + ("" if first else " (again)"))
	var lines: Array = res.get("lines", []).duplicate()
	if first:
		var relics: Dictionary = p.get("relics", {})
		relics[String(e.drop)] = int(relics.get(String(e.drop), 0)) + 1
		p["relics"] = relics
		lines.append("%s recovered" % String(e.drop_name))
	return lines

## the journal's counts: discovered / done / all
static func tally(p: Dictionary) -> Dictionary:
	var found := 0
	var done := 0
	for e in all():
		if is_discovered(p, String(e.id)):
			found += 1
		if is_done(p, String(e.id)):
			done += 1
	return { "found": found, "done": done, "all": all().size() }

# --------------------------------------------------------------------------------------------- with the save
## load the profile, apply `f` (which returns toast lines), save if it changed anything; returns the lines
static func with_profile(f: Callable) -> Array:
	var p := Gear.profile_load()
	var before := (p.get("enc", []) as Array).size()
	var lines: Array = f.call(p)
	if (p.get("enc", []) as Array).size() != before or not lines.is_empty():
		Gear.profile_save(p)
	return lines
