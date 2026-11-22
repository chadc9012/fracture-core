extends SceneTree
## Squad tactics (enemies.gd, Nov 22 — owner: "flanking, cover, aggression and coordinated attacks"), headless:
##   a squad fighting the operator is dealt roles (a suppressor, flankers, cover-takers; the marksman always covers);
##   the marksman's cover spot really hides it from the operator behind a box; a flanker gets round the side of the
##   squad's line; no more than FIRE_TOKENS gunners fire at once; two Executors never swing together; a reloading or
##   battered operator is pressed; a squadmate near the fight is called in; a calm spot becomes the checkpoint and a
##   death puts the operator back there.
##   godot --headless --path godot-world-fracture --script res://tests/combat/squad_test.gd
## Prints "squad: N failed".
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func _init() -> void:
	var p := Player.new()
	root.add_child(p)
	p.bounds = Rect2(-60, -120, 120, 240)
	p.ground_at = func(_x: float, _z: float) -> float: return 0.0
	# crates and a low wall to hide behind, out between the squad and the operator
	p.obstacles = [
		AABB(Vector3(4.0, 0, -17.0), Vector3(2.2, 1.5, 2.2)),
		AABB(Vector3(-7.0, 0, -21.0), Vector3(3.0, 1.4, 1.2)),
		AABB(Vector3(-1.0, 0, -26.0), Vector3(2.0, 1.6, 2.0)),
	]
	var g := Gunplay.new()
	root.add_child(g)
	g.setup(p, p.obstacles)
	var en := Enemies.new()
	root.add_child(en)
	en.setup(p, g)
	var squad: Array = []
	for x in [-4.0, -1.5, 1.5, 4.0]:
		squad.append(en.spawn("scout", Vector3(x, 0, -34)))
	var mk = en.spawn("marksman", Vector3(0, 0, -38))
	# a squadmate round the corner, behind a wall, 12 m from the fight: it never sees the operator, but is called in
	p.obstacles.append(AABB(Vector3(14.0, 0, -40.0), Vector3(1.0, 4.0, 14.0)))
	var called = en.spawn("scout", Vector3(18, 0, -34), [Vector3(18, 0, -34), Vector3(18, 0, -30)])
	var max_firing := 0
	var flank_angle := 0.0
	for i in 60 * 10:
		en.step(1.0 / 60.0)
		var firing := 0
		for e in en.enemies:
			if e.burst_left > 0:
				firing += 1
		max_firing = maxi(max_firing, firing)
		if i > 60 * 4:
			for e in squad:
				if e.role == "flank":
					var c: Vector3 = e.get_meta("squad_centre", Vector3.ZERO)
					var line := (c - p.position)
					line.y = 0.0
					var me: Vector3 = e.mover.position - p.position
					me.y = 0.0
					flank_angle = maxf(flank_angle, rad_to_deg(line.angle_to(me)))
	var roles := {}
	for e in en.enemies:
		roles[e.role] = int(roles.get(e.role, 0)) + 1
	ok(roles.has("flank") and roles.has("suppress") and mk.role == "cover", "the squad is dealt roles: %s (the marksman covers)" % str(roles))
	var hidden := false
	if mk.cover != Vector3.INF:
		for b in p.obstacles:
			if b.intersects_segment(mk.cover + Vector3(0, 0.9, 0), p.position + Vector3(0, 1.2, 0)) != null:
				hidden = true
	ok(mk.cover != Vector3.INF and hidden, "the marksman's cover spot hides it behind a box (%s)" % str(mk.cover.round() if mk.cover != Vector3.INF else mk.cover))
	ok(mk.cover == Vector3.INF or mk.mover.position.distance_to(mk.cover) < 2.5, "and it gets there (%.1f m off)" % (mk.mover.position.distance_to(mk.cover) if mk.cover != Vector3.INF else -1.0))
	ok(flank_angle > 50.0, "a flanker swings round the side of the squad's line (%.0f°)" % flank_angle)
	ok(max_firing <= Enemies.FIRE_TOKENS and max_firing >= 1, "no more than %d gunners fire at once (most at once: %d)" % [Enemies.FIRE_TOKENS, max_firing])
	ok(called.state != Enemies.State.PATROL, "a squadmate near the fight is called in without seeing the operator")
	# pressing: a reload opens the operator up
	en.down = 0.0
	en.hull = en.hull_max
	g.gun().mag = 3
	g.gun().reload()
	ok(en._pressing(), "a reloading operator is pressed")
	g.gun().cancel_reload()
	en.hull = en.hull_max * 0.3
	ok(en._pressing(), "so is a battered one")
	en.hull = en.hull_max
	# two Executors: one swings, the other waits its turn
	for e in en.enemies:
		e.target.hp = 0.0
		e.stays_down = true
	for i in 3:
		en.step(1.0 / 60.0)
	var x1 = en.spawn("executor", p.position + Vector3(1.2, 0, -1.2))
	var x2 = en.spawn("executor", p.position + Vector3(-1.2, 0, -1.2))
	var both := false
	var swings := 0
	for i in 60 * 6:
		en.step(1.0 / 60.0)
		en.hull = en.hull_max
		en.shield = en.shield_max
		var a: bool = x1.windup > 0.0 or x1.swing_len > 0.0
		var b2: bool = x2.windup > 0.0 or x2.swing_len > 0.0
		if a and b2:
			both = true
		if x1.windup > 0.0 and x1.windup < 1.0 / 60.0 + 1e-4 or x2.windup > 0.0 and x2.windup < 1.0 / 60.0 + 1e-4:
			swings += 1
	ok(not both, "two Executors never swing together")
	# the checkpoint: everything down, the operator stands somewhere calm, a death brings them back there
	for e in en.enemies:
		e.target.hp = 0.0
		e.stays_down = true
	for i in 3:
		en.step(1.0 / 60.0)
	p.position = Vector3(6, 0, 8)
	en.since_hit = 10.0
	for i in 60 * 5:
		en.step(1.0 / 60.0)
	ok(en.checkpoint.is_equal_approx(Vector3(6, 0, 8)) and en.respawn_point(Vector3(0, 0, 50)).is_equal_approx(Vector3(6, 0, 8)), "a calm spot becomes the checkpoint and a death goes back there (%s)" % str(en.checkpoint))
	print("squad: %d failed" % failed)
	quit(1 if failed > 0 else 0)
