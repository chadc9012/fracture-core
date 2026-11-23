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
	print("fort play: ", "0 failed" if ok else "FAILED")
	get_tree().quit()
