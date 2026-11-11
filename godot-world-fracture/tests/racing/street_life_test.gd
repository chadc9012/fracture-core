extends SceneTree
## Street racing life (Nov 11), headless: the ladder, the payouts, the heat rules and the street lines on their own, then
## on Neon City's avenue: a meet offers its race, a locked one says what it needs, the countdown and the GO, the police
## on an illegal race, the rivals running, the finish and the pay, a bust, an escape; on Nexus's avenue a sanctioned race
## closes the road and never draws the police, and leaving the car forfeits it; the garage holds parts back by rung.
##   godot --headless --path godot-world-fracture --script res://tests/racing/street_life_test.gd
## Prints "street life: N failed".

const Career := preload("res://scripts/racing/street_career.gd")
const Route := preload("res://scripts/racing/street_route.gd")
const Life := preload("res://scripts/racing/street_life.gd")
const GarageState := preload("res://scripts/garage/garage_state.gd")
const Order := preload("res://scripts/garage/garage_order.gd")
const TEST_SAVE := "user://street_career_test.json"
var failed := 0

class Stub:
	var hits := 0
	var speed := 16.0
	var slip := 0.5
	func slip_angle() -> float:
		return slip

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func road_car(st) -> Node3D:
	for pc in st.parked:
		if is_instance_valid(pc) and pc.visible and String(pc.get_meta("vehicle", "")) in ["tuner", "street-racer", "muscle-car"]:
			return pc
	return null

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	# ---- the ladder and the pay
	var c := Career.new()
	c.path = TEST_SAVE
	ok(c.tier_name() == "UNKNOWN" and Career.tier_index(250) == 1 and Career.tier_index(9000) == 5, "the ladder runs UNKNOWN → LEGEND")
	ok(c.unlocked("neon-backstreet") and not c.unlocked("neon-midnight"), "a newcomer gets local races only")
	var g1: Dictionary = c.finish("neon-backstreet", 1)
	ok(int(g1.nex) == 700 and int(g1.rep) == 120 and c.wins == 1, "a win pays its prize and reputation")
	c.finish("neon-backstreet", 1)
	var g3: Dictionary = c.finish("neon-backstreet", 2)
	ok(String(g3.tier_up) == "ROOKIE" and c.unlocked("neon-midnight"), "climbing a rung says so and opens its races (%d rep)" % c.rep)
	var b: Dictionary = c.busted(2, 300)
	ok(int(b.fine) == 300 and int(b.rep) == 160, "a bust fines (no more than you hold) and costs reputation")
	ok(Career.events_for("neon").size() == 5 and Career.events_for("nexus").size() == 4, "Neon City holds the underground, Nexus the sanctioned")
	var legal_police := false
	for id in Career.EVENTS:
		if bool(Career.EVENTS[id].legal) and Career.EVENTS[id].has("heat"):
			legal_police = true
	ok(not legal_police, "no sanctioned race carries heat")

	# ---- the heat
	var h := Career.Heat.new()
	h.start(1)
	var ups := 0
	for i in 36:
		if h.step(1.0, true, false, false) == "up":
			ups += 1
	ok(ups == 1 and h.level == 2, "seen for %ds the heat climbs a level" % int(Career.Heat.ESCALATE))
	var t := 0.0
	var res := ""
	while res == "" and t < 60.0:
		res = h.step(0.5, false, false, false)
		t += 0.5
	ok(res == "escaped" and absf(t - 12.0) < 0.6, "out of sight for 6 + 3×level s, they lose you (%.1fs)" % t)
	h.start(2)
	t = 0.0
	res = ""
	while res == "" and t < 60.0:
		res = h.step(0.5, false, false, true)
		t += 0.5
	ok(res == "escaped" and t < 7.0, "hidden in a court it's twice as quick (%.1fs)" % t)
	h.start(1)
	t = 0.0
	res = ""
	while res == "" and t < 10.0:
		res = h.step(0.25, true, true, false)
		t += 0.25
	ok(res == "busted" and absf(t - 3.0) < 0.3, "held stopped by a unit for 3s is a bust")

	# ---- the lines
	var lp: RefCounted = Route.loop(420.0, -420.0, 2, 60.0)
	ok(lp.race_length() > 3300.0 and lp.race_length() < 3700.0, "a two-lap Avenue Cup is ~3.4 km (%.0f m)" % lp.race_length())
	ok(lp.at(lp.length).distance_to(lp.at(Route.START)) < 3.0, "a loop finishes on its start line")
	var out: Array = lp.nearest_from(Vector3(-1.0, 0, -100.0), Route.START + 150.0)
	ok(float(out[1]) > 1.5, "a car on the way out isn't taken for one on the way back (%.1f m off)" % float(out[1]))
	var sp: RefCounted = Route.sprint(60.0, -840.0)
	ok(absf(sp.race_length() - 900.0) < 40.0 and sp.at(sp.length).z < -830.0, "a sprint runs from the meet to the far end")

	# ---- drift scoring
	var life0 := Life.new()
	life0.ev = Career.event("neon-drift")
	var stub := Stub.new()
	for i in 120:
		life0._drift(1.0 / 30.0, stub)
	ok(life0._chain_pts > 2000.0 and life0.multiplier() > 2.9, "a 4s slide builds a chain (%d, ×%.1f)" % [int(life0._chain_pts), life0.multiplier()])
	stub.slip = 0.0
	for i in 40:
		life0._drift(1.0 / 30.0, stub)
	ok(life0.drift_score > 2000.0 and life0._chain_pts == 0.0, "straightening up banks it")
	stub.slip = 0.5
	for i in 30:
		life0._drift(1.0 / 30.0, stub)
	stub.hits = 1
	life0.slice = null
	ok(life0._chain_pts > 0.0, "a chain builds again")
	life0.free()

	# ---- the garage holds parts back by rung
	var gs := GarageState.fresh()
	gs.street_rep = 0
	var o := Order.new("neon-performance", "tuner")
	ok(o.block_reason(gs, "nos-race").contains("STREET RACER"), "race nitrous needs STREET RACER")
	gs.street_rep = 900
	ok(o.block_reason(gs, "nos-race") == "", "with the rep it sells")

	# ---- on Neon City's avenue
	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	main._open_street(true, "neon", true)
	await frames(10)
	var st = main.street
	var life = st.life if st else null
	ok(life != null and life.markers.size() == 5, "five meets stand on Neon City's avenue")
	if life == null:
		_done()
		return
	life.career = Career.new()
	life.career.path = TEST_SAVE
	life.refresh_markers()
	st.controls.scripted = true
	var car_node := road_car(st)
	ok(car_node != null, "a parked road car to take")
	st.enter_car(car_node)
	var car = st.driving_car
	car.node.position = Vector3(0, 0, -60.0)
	await frames(3)
	ok(life.offer == "neon-ring" and life.take_offer() and life.state == "", "a locked meet says what it needs and doesn't start")
	ok(life.ok_car(car) and not life.ok_car(load("res://scripts/driving/street_car.gd").new(Node3D.new(), "goliath-tank", { "pivot": true })), "tanks don't street race")
	car.node.position = Vector3(0, 0, 60.0)
	await frames(3)
	ok(life.offer == "neon-backstreet", "driving into a meet offers its race")
	ok(life.take_offer() and life.state == "countdown" and life.rivals.size() == 2, "ENTER puts you on the grid with the rivals")
	for i in 900:
		await process_frame
		if life.state == "racing":
			break
	ok(life.state == "racing" and life.heat.level == 1, "GO — and an underground race starts the heat")
	await frames(4)
	ok(life.units.size() >= 1, "a police unit comes up")
	# drive the line for a while
	var start_along: float = life.along
	var rival_start: float = life.rivals[0].along
	var t0 := Time.get_ticks_msec()
	var race_t0: float = life.time
	while life.time - race_t0 < 8.0 and Time.get_ticks_msec() - t0 < 120000:
		var look: float = life.along + 12.0 + absf(car.speed) * 0.4
		var aim: Vector3 = life.route.at(look)
		var to: Vector3 = aim - car.node.position
		var err := wrapf(atan2(-to.x, -to.z) - car.node.rotation.y, -PI, PI)
		st.controls.move = Vector2(-clampf(err * 2.5, -1.0, 1.0), 1.0)
		await process_frame
	ok(life.along > start_along + 40.0, "you make way down the line (%.0f m)" % (life.along - start_along))
	ok(float(life.rivals[0].along) > rival_start + 40.0, "the rivals race it (%.0f m)" % (float(life.rivals[0].along) - rival_start))
	ok(life.position_now() >= 1 and life.position_now() <= 3 and life.hud.text.contains("GATE"), "the HUD shows place and gates")
	# skip to the last stretch and cross the line
	var dz: float = life.route.length - 22.0
	var f: Vector3 = life.route.dir_at(dz)
	car.node.position = life.route.at(dz)
	car.node.rotation.y = atan2(-f.x, -f.z)
	car.travel = NAN
	life.along = dz - 2.0
	life.gate_i = life.gates.size() - 1
	var nex_before := int(load("res://scripts/gear/gear_store.gd").profile_load().get("nex", 0))
	t0 = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 8000:
		var fa: Vector3 = life.route.at(life.along + 12.0) - car.node.position
		st.controls.move = Vector2(-clampf(wrapf(atan2(-fa.x, -fa.z) - car.node.rotation.y, -PI, PI) * 2.5, -1.0, 1.0), 1.0)
		await process_frame
		if life.state == "done":
			break
	ok(life.state == "done" and life.place >= 1 and life.career.rep > 0 and life.career.races == 1, "the finish pays (P%d, %d rep)" % [life.place, life.career.rep])
	ok(int(load("res://scripts/gear/gear_store.gd").profile_load().get("nex", 0)) > nex_before, "the prize lands in the profile")
	ok(life.result.visible, "the result shows")
	# a bust: stop with a unit alongside
	st.controls.move = Vector2.ZERO
	car.speed = 0.0
	var rep_before: int = life.career.rep
	t0 = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 8000:
		car.speed = 0.0
		if life.units.size() > 0:
			var u = life.units[0]
			u.sc.node.position = car.node.position + Vector3(0, 0, 4.0)
		await process_frame
		if not life.heat.active():
			break
	ok(not life.heat.active() and life.career.busts == 1 and life.career.rep < rep_before and life.units.is_empty(), "held stopped by a unit: busted")
	# an escape: the units kept far off
	life.heat.start(2)
	await frames(3)
	var rep2: int = life.career.rep
	for i in 3000:
		for u in life.units:
			u.sc.node.position = Vector3(0, 0, clampf(car.node.position.z + 500.0, -880.0, 880.0) if car.node.position.z < 0.0 else car.node.position.z - 500.0)
		await process_frame
		if not life.heat.active():
			break
	ok(not life.heat.active() and life.career.escapes == 1 and life.career.rep > rep2, "out of their sight: escaped, +rep")
	await frames(320)
	ok(life.state == "" and life.rivals.is_empty(), "after the finish the rivals leave")

	# ---- Nexus: a sanctioned race closes the road and draws no police
	main._close_street()
	await frames(5)
	main._open_street(true, "nexus", true)
	await frames(10)
	st = main.street
	life = st.life
	life.career = Career.new()
	life.career.path = TEST_SAVE
	life.refresh_markers()
	st.controls.scripted = true
	car_node = road_car(st)
	st.enter_car(car_node)
	car = st.driving_car
	car.node.position = Vector3(0, 0, 60.0)
	await frames(3)
	ok(life.offer == "nexus-avenue-cup" and life.take_offer(), "the Avenue Cup starts")
	ok(st.traffic.closed, "a sanctioned race closes the road")
	for i in 900:
		await process_frame
		if life.state == "racing":
			break
	await frames(60)
	ok(life.state == "racing" and not life.heat.active() and life.units.is_empty(), "and the police stay away")
	ok(life._cleared.size() > 0, "the turnarounds are cleared of parked cars (%d)" % life._cleared.size())
	car.speed = 0.0
	st.exit_car()
	await frames(2)
	ok(life.state == "" and not st.traffic.closed and life._cleared.is_empty(), "leaving the car forfeits it and the road reopens")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_SAVE))
	_done()

func _done() -> void:
	print("street life: %d failed" % failed)
	quit(1 if failed > 0 else 0)
