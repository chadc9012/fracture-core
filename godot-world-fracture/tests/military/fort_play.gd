extends Node
## Fort Kessler's rules in play: calm outside the wire, a warning then a star past the gate, a kill adds stars, the
## garrison turns hostile and reinforces, jets come at four stars, and getting away unseen loses them.
const FortView := preload("res://scripts/military/fort_view.gd")
var ok := true

func check(what: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	ok = ok and cond

func _ready() -> void:
	var v := FortView.new()
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	v.set_process(false)
	v.controls.scripted = true
	var hostile := func() -> int:
		var n := 0
		for e in v.enemies.enemies:
			if e.type == "soldier" and e.target.alive() and e.team != v.enemies.operator_team:
				n += 1
		return n
	check("a garrison stands at the base (%d)" % v._alive_soldiers(), v._alive_soldiers() >= 12)
	check("vehicles to drive (%d)" % v.rides.parked.size(), v.rides.parked.size() >= 3)
	for i in 100:
		v._process(0.05)
	check("outside the wire: no stars, nobody hostile", v.stars == 0 and hostile.call() == 0 and v.enemies.hull > 0.0)
	v.operator.position = Vector3(-200, 0, 240)
	for i in 60:
		v._process(0.05)
	check("past the gate: warned, not yet starred", v.stars == 0 and v._warn > 2.0)
	for i in 100:
		v.operator.position = Vector3(-200, 0, 240)
		v._process(0.05)
	check("loitering: one star, the garrison turns (%d hostile)" % hostile.call(), v.stars >= 1 and hostile.call() >= 10)
	var sol: RefCounted = null
	var best := INF
	for e in v.enemies.enemies:
		if e.type == "soldier" and e.target.alive() and e.mover.position.distance_to(v.operator.position) < best:
			best = e.mover.position.distance_to(v.operator.position)
			sol = e
	v.enemies._last_hitter.erase(sol)
	sol.target.take(9999.0)
	for i in 4:
		v._process(0.05)
	check("a soldier put down: two stars (%d)" % v.stars, v.stars >= 2)
	v.enemies.hull = 1e9
	v.enemies.hull_max = 1e9
	for i in 300:
		v.operator.position = Vector3(-200, 0, 240)
		v._process(0.05)
	check("reinforcements come (%d hostile)" % hostile.call(), hostile.call() >= 8)
	v._raise(4, "test")
	v._jet_t = 0.1
	for i in 10:
		v._process(0.05)
	check("four stars: a jet comes in", v._jets.size() >= 1)
	# away: outside the wire, out of everyone's sight
	for i in 1200:
		v.operator.position = Vector3(-600, 0, 440)
		v._process(0.05)
	check("away and unseen: they lose you (%d)" % v.stars, v.stars == 0 and hostile.call() == 0)
	# a jet off the apron: in, down the runway, up, the cannon, back down and out
	check("apron fighters to steal (%d)" % v.air.parked.size(), v.air.parked.size() >= 3)
	var jet: Node3D = v.air.parked[0]
	v.operator.position = jet.position + Vector3(0, 0, 4)
	v.controls._enter = true
	v._process(0.05)
	check("ENTER by a jet: flying it, three stars", v.air.flying() and v.stars >= 3)
	var start := jet.position
	v.controls.move = Vector2(0, 1)
	for i in 40:
		v._process(0.05)
	check("throttle: rolling (%.0f m/s)" % v.air.state.speed, v.air.state.speed > 30.0)
	v.controls._brake_held = true
	v.controls.move = Vector2(-0.6, 0.3)     # climbing, banked round inside the valley
	for i in 60:
		v._process(0.05)
	check("UP past takeoff speed: airborne (%.0f m)" % jet.position.y, v.air.airborne() and jet.position.y > 10.0 and not v.air.crashed)
	v.controls._brake_held = false
	var sol2: RefCounted = null
	for e in v.enemies.enemies:
		if e.type == "soldier" and e.target.alive():
			sol2 = e
			break
	if sol2:
		# put a soldier right under the gun line and fire
		var f := Vector3(-sin(v.air.state.yaw), 0, -cos(v.air.state.yaw))
		sol2.mover.position = jet.position + f * 60.0 + Vector3(0, -jet.position.y, 0)
		v.air.state.pitch = atan2(-(jet.position.y - 1.0), 54.0)
		var hp: float = sol2.target.hp + sol2.target.shield
		v.air._fire(f, [sol2], v.gunplay.spark)
		check("the cannon hits what is under the nose", sol2.target.hp + sol2.target.shield < hp)
	check("it flew (%.0f m from the apron)" % jet.position.distance_to(start), jet.position.distance_to(start) > 150.0)
	# the ranges are solid: a jet flown into a slope is a crash
	var ridge := Vector3(0, 0, -100) + Vector3(1, 0, 0) * 1500.0
	check("the ranges stand above the valley (%.0f m)" % v.terrain(ridge.x, ridge.z), v.terrain(ridge.x, ridge.z) > 50.0 and v.terrain(0, 0) == 0.0)
	# back down: no throttle, descend, wait for the wheels
	v.controls.move = Vector2(0, -1)
	v.controls._sprint_held = true
	for i in 400:
		v._process(0.05)
		if not v.air.airborne() and v.air.flying() and absf(v.air.state.speed) < 4.0:
			break
	v.controls._sprint_held = false
	v.controls.move = Vector2.ZERO
	if v.air.flying():
		v.controls._enter = true
		v._process(0.05)
	check("landed and out (crashed: %s)" % str(v.air.crashed), not v.air.flying() and v.operator.rig.visible)
	print("fort play: ", "0 failed" if ok else "FAILED")
	get_tree().quit()
