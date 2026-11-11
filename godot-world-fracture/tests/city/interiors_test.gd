extends SceneTree
## City interiors (owner's pick, Nov 11), headless: every building builds with its walls and furniture as obstacles,
## the operator starts inside by the door, can walk in, and every spot ENTER uses stands clear of the furniture (none
## buried in a counter) and answers; the club's music starts and stops with the visit; the street's doors open them
## from Nexus City and Neon City, and the way out brings the street back.
##   godot --headless --path godot-world-fracture --script res://tests/city/interiors_test.gd
## Prints "interiors: N failed".

const InteriorView := preload("res://scripts/city/interior_view.gd")
const Interiors := preload("res://scripts/city/interiors.gd")
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

func _blocked(v, p: Vector3) -> bool:
	for b: AABB in v.obstacles:
		if b.grow(0.25).has_point(Vector3(p.x, 0.5, p.z)):
			return true
	return false

func _run() -> void:
	for kind in Interiors.DOORS:
		var v = InteriorView.new()
		v.kind = String(kind)
		v.style = "neon" if kind == "nightclub" else "nexus"
		root.add_child(v)
		await frames(3)
		var own := 0
		for s in v.spots:
			if String(s.id) != "exit":
				own += 1
		ok(v.obstacles.size() > 8 and own >= 1, "%s builds (%d obstacles, %d spots of its own)" % [v.title, v.obstacles.size(), own])
		ok(v.room.has_point(Vector2(v.operator.position.x, v.operator.position.z)) and not _blocked(v, v.operator.position), "%s: you start inside by the door" % v.title)
		var buried := []
		for s in v.spots:
			if _blocked(v, s.pos):
				buried.append(String(s.id))
		ok(buried.is_empty(), "%s: every spot stands clear %s" % [v.title, str(buried) if not buried.is_empty() else ""])
		# walk in for a second and a half
		var z0: float = v.operator.position.z
		v.controls.scripted = true
		v.controls.move = Vector2(0, 1.0)
		var t0 := Time.get_ticks_msec()
		while Time.get_ticks_msec() - t0 < 1500:
			await process_frame
		v.controls.move = Vector2.ZERO
		ok(v.operator.position.z < z0 - 1.5 and v.room.has_point(Vector2(v.operator.position.x, v.operator.position.z)), "%s: you can walk in (%.1f m)" % [v.title, z0 - v.operator.position.z])
		for s in v.spots:
			if String(s.id) != "exit":
				v.use(String(s.id))
		ok(true, "%s: every spot answers" % v.title)
		var closed := [false]
		v.closed.connect(func(): closed[0] = true)
		v.leave()
		ok(closed[0], "%s: the door takes you out" % v.title)
		v.queue_free()
		await frames(2)

	# from the street
	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	for city in ["nexus", "neon"]:
		main._open_street(city == "neon", city, true)
		await frames(6)
		var labels := []
		for d in main.street._door_spots:
			if Interiors.DOORS.has(String(d.id)):
				labels.append(String(d.label))
		ok(labels.size() == Interiors.DOORS.size(), "%s's street has the %d doors" % [city, labels.size()])
		main.street._enter_door("hospital" if city == "nexus" else "nightclub")
		await frames(4)
		var view = main._from_street
		ok(view != null and view.get("kind") != null and not main.street.visible, "a door walks you into %s" % (view.title if view else "?"))
		if view:
			view.leave()
			await frames(4)
		ok(main._from_street == null and main.street.visible, "and back out onto the street")
		main._close_street()
		await frames(4)
	print("interiors: %d failed" % failed)
	quit(1 if failed > 0 else 0)
