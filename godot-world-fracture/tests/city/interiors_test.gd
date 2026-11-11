extends SceneTree
## The walk-in buildings (scripts/city/interiors.gd, interior_view.gd, interior_sets.gd): every ROOMS row builds its set,
## the operator walks in clear of every obstacle with the way to the street door open, there is room to walk, and each
## building's street door stands clear of the hub's other doors.
## Run: godot --headless --path . --script res://tests/city/interiors_test.gd

const Interiors := preload("res://scripts/city/interiors.gd")
const InteriorView := preload("res://scripts/city/interior_view.gd")

func _initialize() -> void:
	_run.call_deferred()

func _blocked(p: Vector3, boxes: Array[AABB], r := 0.45) -> bool:
	for b in boxes:
		if b.size.y < 0.3 or b.position.y > 1.6:
			continue
		if p.x > b.position.x - r and p.x < b.end.x + r and p.z > b.position.z - r and p.z < b.end.z + r:
			return true
	return false

func _run() -> void:
	var ok := true
	# the street doors: the hub's own and the buildings', none closer than 9 m to another on the same side
	# (street_slice.gd needs the game's autoloads, so its DOORS rows are read from the source)
	var doors: Array = []
	var src := FileAccess.get_file_as_string("res://scripts/city/street_slice.gd")
	var rx := RegEx.new()
	rx.compile('\\{ "id": "(\\w+)", "label": "[^"]*", "x": (-?[\\d.]+), "z": (-?[\\d.]+)[^}]*\\}')
	for m in rx.search_all(src.substr(src.find("const DOORS"), 3000)):
		if not m.get_string(0).contains('"style": "neon"'):
			doors.append({ "id": m.get_string(1), "x": float(m.get_string(2)), "z": float(m.get_string(3)) })
	var hub_doors := doors.size()
	doors.append_array(Interiors.door_rows())
	var crowded := []
	for i in doors.size():
		for j in range(i + 1, doors.size()):
			var a: Dictionary = doors[i]
			var b: Dictionary = doors[j]
			if float(a.x) == float(b.x) and absf(float(a.z) - float(b.z)) < 9.0:
				crowded.append("%s / %s" % [a.id, b.id])
	print("street doors stand apart (%d hub + %d buildings): " % [hub_doors, doors.size() - hub_doors], crowded.is_empty(), " ", crowded)
	ok = ok and crowded.is_empty() and hub_doors >= 8
	for id in Interiors.ROOMS:
		var v := InteriorView.new()
		v.room_id = id
		root.add_child(v)
		for k in 3:
			await process_frame
		var r: Dictionary = Interiors.room(id)
		var spawn := Interiors.spawn(r)
		var walk_in := not _blocked(spawn, v.obstacles)
		# the line from the door to the spawn and two metres on in is clear
		var path_clear := true
		for t in 10:
			if _blocked(Vector3(0, 0, -0.8 - t * 0.5), v.obstacles, 0.4):
				path_clear = false
		var sets := v.obstacles.size() > 10 and v.static_root.get_child_count() > 20
		var has_use := v.spots.size() >= 2
		# a few metres walked straight in: the operator moves and stays inside the room
		var start: Vector3 = v.operator.position
		for k in 40:
			v.operator.step(1.0 / 30.0, Vector2(0, 1), Vector2.ZERO, false, false)
		var moved: float = v.operator.position.distance_to(start)
		var inside: bool = Interiors.bounds(r).has_point(Vector2(v.operator.position.x, v.operator.position.z))
		var good := walk_in and path_clear and sets and has_use and moved > 1.5 and inside
		print("%s: walk in clear %s, door path clear %s, set built %s (%d boxes), use spots %s, walks %.1f m inside %s" % [id, walk_in, path_clear, sets, v.obstacles.size(), has_use, moved, inside])
		ok = ok and good
		v.queue_free()
		await process_frame
	print("interiors: ", "ok" if ok else "FAILED")
	quit(0 if ok else 1)
