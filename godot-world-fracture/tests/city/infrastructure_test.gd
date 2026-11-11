extends SceneTree
## City infrastructure (owner's pick, Nov 11), headless: the signal cycle; the hub's crossing on the street with its
## heads changing; the traffic holding at a red line; the four lots on their blocks — the facade open, no building over
## them, walkable into (the building site behind its hoarding is not); the parking garage's door; the metro: its door,
## the train coming in and standing, and a ride up the avenue.
##   godot --headless --path godot-world-fracture --script res://tests/city/infrastructure_test.gd
## Prints "infrastructure: N failed".

const Infra := preload("res://scripts/city/infrastructure.gd")
const InteriorView := preload("res://scripts/city/interior_view.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	_run.call_deferred()

func walk(st, to: Vector2, secs: float) -> void:
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < int(secs * 1000.0):
		var p: Vector3 = st.operator.position
		var d := Vector2(to.x - p.x, to.y - p.z)
		if d.length() < 0.5:
			break
		# screen-relative: forward is away from the camera; turn the wish into the camera's frame
		var yaw: float = st.operator.cam_yaw
		var fwd := Vector2(-sin(yaw), -cos(yaw))
		var right := Vector2(cos(yaw), -sin(yaw))
		var w := d.normalized()
		st.controls.move = Vector2(w.dot(right), w.dot(fwd))
		await process_frame
	st.controls.move = Vector2.ZERO

func _run() -> void:
	ok(Infra.light(0, 1.0) == "green" and Infra.light(0, 15.0) == "amber" and Infra.light(0, 20.0) == "red", "the cycle: green, amber, red")
	ok(Infra.light(1, 1.0) != Infra.light(0, 1.0) or Infra.light(1, 10.0) != Infra.light(0, 10.0), "neighbouring blocks are offset")
	ok(Infra.lot_at(2, -1.0, 90.0) == "gas" and Infra.lot_at(2, 1.0, 90.0) == "" and Infra.lot_at(-2, 1.0, 100.0) == "construction", "the lots stand where they're listed")

	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	main._open_street(false, "nexus", true)
	await frames(8)
	var st = main.street
	st.controls.scripted = true
	ok(st.signals.size() >= 1, "the hub's crossing has its signals (%d crossings loaded)" % st.signals.size())
	# the heads follow the cycle
	st._infra_t = 1.0
	await frames(2)
	var hub: Dictionary = {}
	for sg in st.signals:
		if int(sg.k) == 0:
			hub = sg
	var green_on: bool = hub.heads[0].lamps.green.node.material_override == hub.heads[0].lamps.green.on
	st._infra_t = 20.0
	await frames(2)
	var red_on: bool = hub.heads[0].lamps.red.node.material_override == hub.heads[0].lamps.red.on
	var walk_on := false
	for h in hub.heads:
		if h.kind == "walk":
			walk_on = h.lamps.walk.node.material_override == h.lamps.walk.on
	ok(green_on and red_on and walk_on, "the heads go green, then red with the walk sign lit")
	# the traffic holds at the red line
	ok(st.traffic.red_lines.has(float(hub.z)), "the traffic hears the red")
	var crossed := 0
	var watched := 0
	var before := {}
	for c in st.traffic.cars:
		var d: float = (float(hub.z) - c.sc.node.position.z) * c.dir - 7.0
		if d > 8.0 and d < 60.0:
			before[c] = true
	for i in 300:
		st._infra_t = 20.0      # hold the red
		await process_frame
	for c in before:
		watched += 1
		if (float(hub.z) - c.sc.node.position.z) * c.dir - 7.0 < -0.5:
			crossed += 1
	ok(watched == 0 or crossed == 0, "cars coming up to a red stop at the line (%d watched, %d ran it)" % [watched, crossed])

	# the lots
	for l in Infra.LOTS:
		var id := String(l[0])
		var side := float(l[2])
		var c := Infra.lot_center(id)
		var on_walk := Vector3(side * 12.5, 0.18, c.z)
		st.operator.position = on_walk
		st.operator.velocity = Vector3.ZERO
		await frames(6)
		var facade_blocks := false
		for b: AABB in st.operator.obstacles:
			if b.has_point(Vector3(side * 15.2, 1.0, c.z)) and b.size.x < 1.0:
				facade_blocks = true
		if id == "construction":
			await walk(st, Vector2(side * 22.0, c.z), 3.0)
			ok(absf(st.operator.position.x) < 15.6, "and keeps you out (%.1f)" % st.operator.position.x)
		else:
			ok(not facade_blocks, "%s: the facade line is open at the lot" % id)
			await walk(st, Vector2(side * 21.0, c.z + 4.0), 4.0)
			ok(absf(st.operator.position.x) > 17.0, "%s: you can walk in off the walk (x %.1f)" % [id, st.operator.position.x])
			if absf(st.operator.position.x) <= 17.0:
				for bi in st.operator.obstacles.size():
					var bb: AABB = st.operator.obstacles[bi]
					if bb.intersects(AABB(Vector3(minf(side * 13.0, side * 22.0), 0.2, c.z + 2.0), Vector3(9.0, 1.5, 4.0))):
						print("   blocking ", bi, " ", bb)
						for nd in st.world.find_children("*", "Node3D", true, false):
							if nd.has_meta("size") and absf(nd.global_position.z - bb.get_center().z) < 8.0 and absf(nd.global_position.x - bb.get_center().x) < 8.0:
								print("      node ", nd.name, " ", nd.get_meta("file", ""), " ", nd.global_position, " parent ", nd.get_parent().name)
	# the expressway over the far block: its traffic runs
	st.operator.position = Vector3(12.5, 0.18, Infra.lot_center("overpass").z)
	await frames(6)
	var live: Array = st.deck_cars.filter(func(d): return is_instance_valid(d.node))
	var x0: float = live[0].node.position.x if not live.is_empty() else 0.0
	st._infra_t += 2.0
	await frames(2)
	ok(live.size() >= 8 and absf(live[0].node.position.x - x0) > 20.0, "the expressway's traffic runs over the avenue (%d cars)" % live.size())
	var parking_door := false
	var metro_door := false
	for d in st._door_spots:
		if String(d.id) == "parking" and absf((d.pos as Vector3).z - Infra.lot_center("parkade").z) < 1.0:
			parking_door = true
		if String(d.id) == "metro":
			metro_door = true
	ok(parking_door, "the underground parking's door is at the parking garage")
	ok(metro_door, "the metro has its entrance on the walk")

	# the metro: the train comes in and stands, a ride brings you up at the far end
	st.operator.position = Vector3(12.0, 0.18, -115.0)
	await frames(4)
	st._enter_door("metro")
	await frames(4)
	var v = main._from_street
	ok(v != null and v.get("kind") == "metro", "the metro entrance goes down to the platform")
	if v:
		var t1 := Time.get_ticks_msec()
		while String(v.data.get("train", "")) != "docked" and Time.get_ticks_msec() - t1 < 120000:
			await process_frame
		ok(String(v.data.get("train", "")) == "docked", "a train comes in and stands at the platform")
		v.profile.nex = maxi(int(v.profile.get("nex", 0)), 10)
		v.use("ride")
		await frames(6)
		ok(main._from_street == null and absf(st.operator.position.z) > 800.0, "riding it brings you up at the far end of the avenue (z %.0f)" % st.operator.position.z)
	print("infrastructure: %d failed" % failed)
	quit(1 if failed > 0 else 0)
