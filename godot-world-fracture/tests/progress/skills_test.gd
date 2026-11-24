extends SceneTree
## The skill tree's rules (scripts/progress/skills.gd) and the numbers its perks reach.
const Skills := preload("res://scripts/progress/skills.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Career := preload("res://scripts/racing/street_career.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _init() -> void:
	var p := { "xp": 0, "nex": 0 }
	ok(Skills.points(p) == 0, "level 1 has no points")
	p.xp = 4200
	var lv := Progression.level_for(int(p.xp))
	ok(Skills.points(p) == lv - 1, "a point per level past the first (%d at level %d)" % [Skills.points(p), lv])
	ok(not Skills.can_buy(p, "marksman"), "a tier-2 perk needs the one above it")
	ok(Skills.buy(p, "steady-hands"), "a tier-1 perk can be bought")
	ok(Skills.can_buy(p, "marksman"), "then the next one opens")
	ok(not Skills.buy(p, "steady-hands"), "a perk is bought once")
	ok(absf(Skills.value(p, "dmg") - 1.08) < 0.001, "its factor reaches the number (dmg ×1.08)")
	Skills.buy(p, "marksman")
	Skills.buy(p, "close-quarters")
	ok(absf(Skills.value(p, "dmg") - 1.08 * 1.08) < 0.001, "two perks on one number multiply")
	ok(Skills.value(p, "shield") == 1.0, "an unbought key stays ×1")
	var q := { "xp": 99999999, "nex": 0, "skills": ["hustler"] }
	var g := Progression.grant(q, "test", 100, 0)
	ok(int(g.nex) == 110 and int(q.nex) == 110, "Hustler: a 100 Nex payment pays 110")
	var c = Career.new()
	c.rep_mult = 1.2
	var got: Dictionary = c.finish("", 1, { "prize": [100], "rep": [100] })
	ok(int(got.rep) == 120, "Known Face: race rep ×1.2")
	c.escape_mult = 2.0
	ok(c.escaped(1) == 80, "Ghost: escapes pay double")
	print("skills test: " + str(fails == 0))
	quit(0 if fails == 0 else 1)
