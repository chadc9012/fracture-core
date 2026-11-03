extends SceneTree
## enemies.gd headless: a scout sees the operator, closes to its range, shoots and wears the hull down; the operator's bolts
## put it down and it stands again at its spawn; a wall between them keeps it on patrol.
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")

func _init() -> void:
	var ok := true
	var p := Player.new()
	root.add_child(p)
	p.bounds = Rect2(-20, -120, 40, 240)
	p.ground_at = func(_x: float, _z: float) -> float: return 0.0
	p.obstacles = [AABB(Vector3(-20, 0, -60.5), Vector3(40, 6, 1))]   # a wall across the street at z = -60
	var g := Gunplay.new()
	root.add_child(g)
	g.setup(p, p.obstacles)
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.position = Vector3(0, 1.6, 4)
	cam.look_at(Vector3(0, 1.2, -10))
	var en := Enemies.new()
	root.add_child(en)
	en.setup(p, g)
	var scout := en.spawn("scout", Vector3(0, 0, -30))
	var far := en.spawn("drone", Vector3(0, 4, -90))     # behind the wall: never sees the operator
	for i in 60 * 8:
		en.step(1.0 / 60.0)
	var engaged := scout.state == Enemies.State.ENGAGE
	var closed := scout.mover.position.distance_to(p.position) < 14.0 + 2.5
	var shot := en.hull < 100.0
	print("scout engages, closes to range, lands hits: ", engaged, " ", closed, " ", shot, " hull ", en.hull, " at ", scout.mover.position.round())
	ok = ok and engaged and closed and shot
	var blind := far.state == Enemies.State.PATROL
	print("the drone behind the wall stays on patrol: ", blind)
	ok = ok and blind
	# the operator aims at the scout and holds the trigger: it goes down and comes back at its spawn
	g.aim_at(scout.target, cam)
	for i in 60 * 3:
		g.step(1.0 / 60.0, cam, true, false, 0.0)
		en.step(1.0 / 60.0)
	var downed := scout.state == Enemies.State.DOWN and g.kills >= 1
	print("the scout goes down: ", downed, " shots ", g.shots_fired, " hits ", g.hits_landed)
	ok = ok and downed
	for i in 60 * 9:
		en.step(1.0 / 60.0)
	var back := scout.state != Enemies.State.DOWN and scout.target.alive() and scout.mover.visible
	print("and stands again: ", back, " ", scout.mover.position.round())
	ok = ok and back
	print("Enemies test: ", ok)
	quit(0 if ok else 1)
