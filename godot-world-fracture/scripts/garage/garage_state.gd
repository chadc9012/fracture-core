extends RefCounted
## What the player has in the garage system: credits, reputation with each shop, and each owned car's paint, finish, installed
## parts and damage. Saved as JSON in user://garage.json (written to a temp file, then renamed over the old save).

const Catalog := preload("res://scripts/garage/catalog.gd")
const SAVE_PATH := "user://garage.json"
const VERSION := 1

var credits := 40000
var rep := { "nexus-customs": 1, "neon-performance": 1, "ironworks": 1, "fracture-dynamics": 0 }
## vehicle id -> { "paint": item id, "finish": item id, "parts": { slot: item id }, "damage": 0..100 }
var cars := {}

static func fresh() -> RefCounted:
	var s = load("res://scripts/garage/garage_state.gd").new()
	for v in Catalog.VEHICLES:
		s.cars[v.id] = { "paint": "", "finish": "finish-gloss", "parts": {}, "damage": 0 }
	# a starter car comes in a little beaten up, so there is something to repair
	s.cars["tuner"].damage = 35
	s.cars["muscle-car"].damage = 12
	return s

func car(id: String) -> Dictionary:
	return cars.get(id, {})

## what is on the car per slot (paint and finish included), for pricing and drawing
func installed(id: String) -> Dictionary:
	var c := car(id)
	var out: Dictionary = c.get("parts", {}).duplicate()
	if c.get("paint", "") != "":
		out["paint"] = c.paint
	out["finish"] = c.get("finish", "finish-gloss")
	return out

func to_dict() -> Dictionary:
	return { "version": VERSION, "credits": credits, "rep": rep, "cars": cars }

func from_dict(d: Dictionary) -> void:
	if int(d.get("version", 0)) != VERSION:
		return
	credits = int(d.get("credits", credits))
	for k in d.get("rep", {}):
		rep[k] = int(d.rep[k])
	for id in d.get("cars", {}):
		if Catalog.vehicle(id).is_empty():
			continue  # a car this build doesn't know
		var c: Dictionary = d.cars[id]
		var parts := {}
		for slot in c.get("parts", {}):
			if not Catalog.item(c.parts[slot]).is_empty():
				parts[slot] = c.parts[slot]
		cars[id] = { "paint": String(c.get("paint", "")), "finish": String(c.get("finish", "finish-gloss")), "parts": parts, "damage": clampi(int(c.get("damage", 0)), 0, 100), "tune": Catalog.tune_clean(c.get("tune", {})) }

## a car's free tuning (ride height mm, camber degrees, rim inches, decal text and colour), filled with the defaults
func tune(id: String) -> Dictionary:
	return Catalog.tune_clean(car(id).get("tune", {}))

func set_tune(id: String, key: String, value) -> void:
	if not cars.has(id):
		return
	var t := tune(id)
	t[key] = value
	cars[id].tune = Catalog.tune_clean(t)

func save(path := SAVE_PATH) -> bool:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(to_dict()))
	f.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(path)) == OK

static func load_or_fresh(path := SAVE_PATH) -> RefCounted:
	var s := fresh()
	if FileAccess.file_exists(path):
		var d = JSON.parse_string(FileAccess.get_file_as_string(path))
		if d is Dictionary:
			s.from_dict(d)
	return s
