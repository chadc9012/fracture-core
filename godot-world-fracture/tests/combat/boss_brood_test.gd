extends SceneTree
## Boss adds (boss_view.gd, Nov 24 — the owner judged the Lockdown Warden fight swarmed with drones): a boss keeps no
## more than ADD_CAP of its adds up however often it summons, a stray add is brought back within ADD_LEASH of it,
## and its brood falls when it does.
##   godot --headless --path godot-world-fracture --script res://tests/combat/boss_brood_test.gd
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")
const BossView = preload("res://scripts/combat/boss_view.gd")
var failed := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		failed += 1

func _init() -> void:
	var p := Player.new()
	root.add_child(p)
	p.bounds = Rect2(-200, -200, 400, 400)
	p.ground_at = func(_x: float, _z: float) -> float: return 0.0
	var g := Gunplay.new()
	root.add_child(g)
	g.setup(p, [])
	var en := Enemies.new()
	root.add_child(en)
	en.setup(p, g)
	var b := BossView.new()
	root.add_child(b)
	b.setup("lockdown-warden", Vector3(0, 0, -20), p, g, en, func(_x: float, _z: float) -> float: return 0.0)
	# summon five times over (the rules' own event, as boss.gd raises it)
	for i in 5:
		b.rules.events.append({ "kind": "summon", "type": "drone", "count": 4 })
		b.step(1.0 / 60.0)
	var up := 0
	for e in en.enemies:
		if e.target.alive():
			up += 1
	ok(up <= BossView.ADD_CAP and up >= 3, "five summons keep at most %d adds up (%d)" % [BossView.ADD_CAP, up])
	# one drifts off 120 m: it is brought back in
	var stray: RefCounted = b._adds[0]
	stray.mover.position = Vector3(120, 6, -20)
	b._leash_adds()
	ok(Vector2(stray.mover.position.x, stray.mover.position.z).distance_to(Vector2(0, -20)) < BossView.ADD_LEASH, "a stray add is brought back to the fight")
	# killing some frees room for the next summon
	b._adds[0].target.hp = 0.0
	b.rules.events.append({ "kind": "summon", "type": "drone", "count": 4 })
	b.step(1.0 / 60.0)
	ok(b._adds.size() <= BossView.ADD_CAP, "a summon after a kill tops the brood back up, no further")
	# the boss falls: so does its brood
	b.rules.events.append({ "kind": "dead" })
	b.step(1.0 / 60.0)
	var left := 0
	for e in en.enemies:
		if e.target.alive():
			left += 1
	ok(left == 0, "its brood falls with it (%d left)" % left)
	# enemy level (enemies.gd, Nov 24): a level-20 hostile carries ×level_hull and hits ×level_damage; a boss too
	en.level = 20
	var sc: RefCounted = en.spawn("scout", Vector3(30, 0, 30))
	ok(is_equal_approx(sc.target.max_hp, float(Enemies.TYPES.scout.hull) * Enemies.level_hull(20)), "a level-20 scout carries ×%.2f hull" % Enemies.level_hull(20))
	en.shield = en.shield_max
	en.spawn_guard = 0.0
	en._hit_operator(10.0)
	ok(is_equal_approx(en.shield_max - en.shield, 10.0 * Enemies.level_damage(20)), "and its hits land ×%.2f" % Enemies.level_damage(20))
	var b2 := BossView.new()
	root.add_child(b2)
	b2.setup("lockdown-warden", Vector3(0, 0, 40), p, g, en, func(_x: float, _z: float) -> float: return 0.0)
	ok(is_equal_approx(b2.rules.hull_max, b.rules.hull_max * Enemies.level_hull(20)), "a boss meets the operator's level too (×%.2f hull)" % (b2.rules.hull_max / b.rules.hull_max))
	print("boss brood: %d failed" % failed)
	quit(1 if failed > 0 else 0)
