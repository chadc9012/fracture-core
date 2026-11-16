extends SceneTree
## The Meshy-made characters (catalog.gd HEROES / PEOPLE): every file there loads as a rig with a skeleton and the clips
## the game plays, the player's armoured look takes its frame's hero, a city look naming a model wears it, and the
## city's own looks (no "hero") keep the built bodies.

const Rig := preload("res://scripts/character/character_rig.gd")
const Catalog := preload("res://scripts/character/catalog.gd")
const Store := preload("res://scripts/character/character_store.gd")

var fails := 0

func check(ok: bool, what: String) -> void:
	if not ok:
		fails += 1
		print("FAIL ", what)

func _init() -> void:
	var ids: Array = Catalog.HEROES.values()
	for list: Array in Catalog.PEOPLE.values():
		ids.append_array(list)
	var have := 0
	for id: String in ids:
		if not ResourceLoader.exists(Catalog.model_path(id)):
			print("missing ", id)
			continue
		have += 1
		var r := Rig.new()
		root.add_child(r)
		r.build({ "frame": "goliath", "body": "male", "model": id })
		check(r.skeleton != null, id + " skeleton")
		check(r.anim != null and r.anim.has_animation("idle") and r.anim.has_animation("walk") and r.anim.has_animation("run"), id + " clips")
		check(r.head_point.y > 1.3 and r.head_point.y < 2.1, id + " head height %.2f" % r.head_point.y)
		r.free()
	check(have >= 3, "at least three Meshy characters")
	var me := Store.load_look()
	check(bool(me.get("hero", false)), "player look is a hero")
	var hero := Catalog.hero_model({ "frame": "goliath", "body": "male", "hero": true })
	check(hero.ends_with("titan.glb"), "titan for the heavy male frame")
	check(Catalog.hero_model({ "frame": "goliath", "body": "male" }) == "", "city looks keep their bodies")
	check(Catalog.hero_model({ "frame": "goliath", "body": "male", "hero": true, "civ": true }) == "", "out of armour keeps the civ body")
	print("meshy people: %d models, %d fails" % [have, fails])
	quit(1 if fails else 0)
