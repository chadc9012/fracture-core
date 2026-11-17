extends SceneTree
## The on-foot operator's movement rules without a body: kerb step, wall slide, bounds, jump arc, run clip thresholds.
const Player = preload("res://scripts/player/operator_player.gd")

func _init() -> void:
	var p := Player.new()
	root.add_child(p)
	p.bounds = Rect2(-10, -50, 20, 100)
	p.ground_at = func(x: float, _z: float) -> float: return 0.18 if absf(x) > 4.0 else 0.0
	p.obstacles = [AABB(Vector3(-1, 0, -6), Vector3(2, 3, 1))]     # a planter across the path at z = -6..-5
	p.position = Vector3(0, 0, 0)
	var ok := true
	# walking forward (stick up, camera behind looking -z) goes toward -z and stops short of the planter
	for i in 120:
		p.step(1.0 / 60.0, Vector2(0, 1), Vector2.ZERO, false, false)
	ok = ok and p.position.z > -5.0 - Player.RADIUS - 0.05 and p.position.z < -4.5 and absf(p.position.x) < 0.01
	print("stops at the planter: ", ok, " ", p.position)
	# sliding sideways along it, then onto the kerb: the step up is free
	for i in 90:
		p.step(1.0 / 60.0, Vector2(1, 0.3), Vector2.ZERO, false, true)
	var slid := p.position.x > 1.5
	ok = ok and slid
	for i in 120:
		p.step(1.0 / 60.0, Vector2(1, 0), Vector2.ZERO, false, true)
	ok = ok and absf(p.position.y - 0.18) < 1e-3 and p.position.x <= 10.0 - Player.RADIUS + 1e-3
	print("slides, steps onto the kerb, stays in bounds: ", ok, " ", p.position)
	# a jump leaves the ground and lands back on it
	var top := p.position.y
	p.step(1.0 / 60.0, Vector2.ZERO, Vector2.ZERO, true, false)
	var left_ground := false
	for i in 90:
		p.step(1.0 / 60.0, Vector2.ZERO, Vector2.ZERO, false, false)
		top = maxf(top, p.position.y)
		left_ground = left_ground or not p.grounded
	ok = ok and left_ground and top > 0.18 + 0.6 and p.grounded and absf(p.position.y - 0.18) < 1e-3
	print("jumps and lands: ", ok, " top ", top)
	# sprinting reaches the sprint speed, walking the walk speed
	for i in 60:
		p.step(1.0 / 60.0, Vector2(0, -1), Vector2.ZERO, false, true)
	var v := Vector2(p.velocity.x, p.velocity.z).length()
	ok = ok and absf(v - Player.SPRINT) < 0.05
	for i in 60:
		p.step(1.0 / 60.0, Vector2(0, -0.3), Vector2.ZERO, false, false)
	var w := Vector2(p.velocity.x, p.velocity.z).length()
	ok = ok and absf(w - Player.WALK * 0.3) < 0.05
	print("sprint and walk speeds: ", ok, " ", v, " ", w)
	# the grapple: reeled toward a ledge 12 m away and 5 m up over the ground, released short of it with momentum, then
	# falling back to the ground; a second pull during the cooldown is refused
	p.position = Vector3(0, 0.18, 20)
	p.velocity = Vector3.ZERO
	p.y_vel = 0.0
	var anchor := Vector3(0, 5.0, 8)
	ok = ok and p.grapple_to(anchor) and p.grappling() and not p.grapple_to(anchor)
	var highest := p.position.y
	var arrived := false
	for i in 150:
		p.step(1.0 / 60.0, Vector2.ZERO, Vector2.ZERO, false, false)
		highest = maxf(highest, p.position.y)
		if not p.grappling() and not arrived:
			arrived = true
			ok = ok and p.position.distance_to(anchor) < 3.0 and p.velocity.y > 0.0 and p.grapple_cool > 0.0 and not p.grapple_to(anchor)
	ok = ok and arrived and highest > 3.0 and p.grounded and absf(p.position.y) < 1e-3   # the ground is 0 at x = 0
	print("grapples to the ledge, lets go with momentum, lands: ", ok, " highest ", highest)
	print("Operator player test: ", ok)
	quit(0 if ok else 1)
