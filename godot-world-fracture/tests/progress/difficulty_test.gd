extends SceneTree
## Story difficulty (scripts/progress/difficulty.gd): the levels, the saved pick, and what it does to hostiles.
const Difficulty := preload("res://scripts/progress/difficulty.gd")
const Store := preload("res://scripts/front/settings_store.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _init() -> void:
	var before := String(Store.load_all().get("difficulty", "normal"))
	ok(Difficulty.LEVELS.size() == 4, "four levels, easy to legendary")
	ok(String(Difficulty.level("nonsense").id) == "normal", "an unknown id reads as normal")
	var hp := 0.0
	var dmg := 0.0
	var ordered := true
	for l in Difficulty.LEVELS:
		ordered = ordered and float(l.hp) > hp and float(l.dmg) > dmg
		hp = float(l.hp)
		dmg = float(l.dmg)
	ok(ordered, "each level is harder than the one before it")
	ok(float(Difficulty.level("normal").hp) == 1.0 and float(Difficulty.level("normal").xp) == 1.0, "normal changes nothing")
	Difficulty.set_level("legendary")
	ok(String(Difficulty.level().id) == "legendary", "the pick is saved")
	var en = Enemies.new()
	Difficulty.apply(en)
	ok(en.hp_mult == 1.6 and en.dmg_mult == 2.0, "apply hands the roster legendary's numbers")
	en.set_difficulty(1.0, 1.0)
	ok(en.hp_mult == 1.0 and en.dmg_mult == 1.0, "set_difficulty takes a new pick mid-mission")
	en.free()
	ok(Enemies.new().hp_mult == 1.0, "a roster nobody applied it to (the Killbox) stays ×1")
	Difficulty.set_level(before)
	print("DIFFICULTY %s (%d failed)" % ["PASS" if fails == 0 else "FAIL", fails])
	quit(1 if fails else 0)
