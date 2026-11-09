extends SceneTree
## Plays the whole game the way a player does, headless: boots main.tscn, goes through onboarding, the garage (every shop,
## every car, fitting parts, checkout), driving (every car, throttle, steering, braking, reset, the city garage), the street
## (every style, day and night, the garage, mall, casino and sports overlays and their views), the operator creator, and
## every region's map (satellite, zoom) and 3D view (orbit, move, zoom, Street View, walking, jump-to-place).
##
## Engine errors print to the log between the "STEP" lines, so a run's log says which step raised them. It also checks
## what a player would notice: a screen that does not open or close, a car that does not move, nodes left behind after
## closing a screen (a leak that slows the game the longer you play).
##   godot --headless --path godot-world-fracture --script res://tests/play/playthrough.gd
## Prints "playthrough: N steps, M problems" and exits non-zero on any problem.

var main: Node
var steps := 0
var problems: Array[String] = []

func _initialize() -> void:
	_run.call_deferred()

func step(name: String) -> void:
	if steps > 0:
		_finite_check()
	steps += 1
	print("STEP %d %s" % [steps, name])

## a 3D node with a NaN / infinite transform is never drawn and the renderer rejects it every frame (the street's
## civilians spawned at z = NaN for a while); any such node is a problem for the step that made it
func _finite_check() -> void:
	var bad := 0
	var first := ""
	for n in root.find_children("*", "Node3D", true, false):
		if not (n as Node3D).transform.is_finite():
			bad += 1
			if first == "":
				first = "%s (%s)" % [n.name, n.get_parent().get_script().resource_path.get_file() if n.get_parent() and n.get_parent().get_script() else n.get_parent().name]
	if bad > 0:
		problem("%d nodes have a non-finite transform, first %s" % [bad, first])

func problem(text: String) -> void:
	problems.append(text)
	print("PROBLEM ", text)

func frames(n: int) -> void:
	for i in n:
		await process_frame

func nodes() -> int:
	return int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))

## open something, use it, close it: the node count must come back to where it was
func leak_check(label: String, before: int) -> void:
	await frames(4)
	var after := nodes()
	if after > before + 8:
		problem("%s left %d nodes behind after closing" % [label, after - before])

func _run() -> void:
	var scene: PackedScene = load("res://scenes/main.tscn")
	main = scene.instantiate()
	root.add_child(main)
	await frames(20)
	step("boot")
	if main.planet_view == null:
		problem("the planet view did not open")

	# onboarding: the first launch opens the operator creator; confirm a look to get in
	if main.creator:
		step("onboarding creator")
		await frames(10)
		main.creator.confirmed.emit(main.creator.look)
		await frames(5)
		if main.creator:
			problem("confirming the onboarding look did not close the creator")
			main._close_creator()
	var base := nodes()

	await _play_garage()
	await leak_check("garage", base)
	await _play_drive()
	await leak_check("driving", base)
	await _play_street()
	await leak_check("street", base)
	await _play_creator()
	await leak_check("operator creator", base)
	await _play_regions()
	await leak_check("regions", base)
	await _play_modes()
	await leak_check("missions and modes", base)

	_finite_check()
	print("playthrough: %d steps, %d problems" % [steps, problems.size()])
	for p in problems:
		print("  - ", p)
	quit(1 if not problems.is_empty() else 0)

# ---------------------------------------------------------------- garage

func _play_garage() -> void:
	step("garage open")
	main._open_garage()
	await frames(10)
	var g = main.garage
	if g == null:
		problem("the garage did not open")
		return
	var Catalog = load("res://scripts/garage/catalog.gd")
	for s in Catalog.SHOPS:
		step("garage shop %s" % s.id)
		g._enter_shop(s.id)
		await frames(4)
		for d in 3:
			g._switch_car(1)
			await frames(3)
	# fit a few parts and check out (credits permitting)
	step("garage fit and checkout")
	g.state.rep = {"nexus-customs": 3, "neon-performance": 3, "ironworks": 3, "fracture-dynamics": 3}
	g._enter_shop("nexus-customs")
	await frames(3)
	g.pick(["paint-red", "spoiler-gt"])
	await frames(3)
	g._checkout()
	await frames(3)
	g._toggle_repair()
	await frames(3)
	step("garage close")
	main._close_garage()
	await frames(4)
	if main.garage:
		problem("the garage did not close")

# ---------------------------------------------------------------- driving

func _play_drive() -> void:
	step("drive open")
	main._open_drive()
	await frames(10)
	var dv = main.driving
	if dv == null:
		problem("driving did not open")
		return
	for car in 6:
		step("drive car %d" % car)
		dv._select_index(car)
		await frames(5)
		if dv.vehicle == null:
			problem("car %d did not load" % car)
			continue
		var start: Vector3 = dv.vehicle.global_position
		# game time, not frames: headless frames run far faster than 60 a second
		dv._touch_changed(1.0, 0.0, 0.0)
		await create_timer(2.0).timeout
		var moved: float = dv.vehicle.global_position.distance_to(start)
		if moved < 8.0:
			problem("car %d moved only %.1f m in 2 s flat out" % [car, moved])
		var heading: float = dv.vehicle.global_rotation.y
		dv._touch_changed(0.6, 0.8, 0.0)
		await create_timer(1.0).timeout
		if absf(angle_difference(heading, dv.vehicle.global_rotation.y)) < 0.05:
			problem("car %d did not turn when steering" % car)
		dv._touch_changed(0.0, 0.0, 1.0)
		await create_timer(1.5).timeout
		dv._touch_changed(0.0, 0.0, 0.0)
		dv._reset_car()
		await frames(5)
	step("drive city garage")
	dv.vehicle.position = Vector3(-32, 0, -66)
	await frames(20)
	dv._open_city_garage()
	await frames(10)
	if dv.garage_overlay == null:
		problem("the city garage did not open from the street")
	else:
		dv._close_city_garage()
		await frames(5)
	step("drive close")
	main._close_drive()
	await frames(4)

# ---------------------------------------------------------------- the street

func _play_street() -> void:
	var StreetSlice = load("res://scripts/city/street_slice.gd")
	for style in StreetSlice.STYLES:
		for night in [false, true]:
			step("street %s %s" % [style, "night" if night else "day"])
			main._open_street(night, style)
			await frames(10)
			var sl = main.street
			if sl == null:
				problem("the %s street did not open" % style)
				continue
			sl.look_from(Vector3(0, 12, 30), Vector3(0, 2, 0))
			await frames(3)
			for overlay in [["garage", "garage_overlay"], ["mall", "mall_overlay"], ["casino", "casino_overlay"], ["sports", "sports_overlay"]]:
				if not sl.has_method("open_" + overlay[0]):
					continue
				if overlay[0] == "casino" and style != "neon":
					# the casino is Neon City's alone: it must stay shut anywhere else
					sl.open_casino()
					await frames(2)
					if sl.casino_overlay != null:
						problem("a casino opened on the %s street" % style)
						sl.close_casino()
					continue
				step("street %s %s" % [style, overlay[0]])
				sl.call("open_" + overlay[0])
				await frames(8)
				var ov = sl.get(overlay[1])
				if ov == null:
					problem("the %s did not open on the %s street" % [overlay[0], style])
					continue
				if ov.has_method("show_view"):
					for v in 9:
						ov.show_view(v)
						await frames(2)
				sl.call("close_" + overlay[0])
				await frames(4)
				if sl.get(overlay[1]) != null:
					problem("the %s did not close on the %s street" % [overlay[0], style])
			main._close_street()
			await frames(4)

# ---------------------------------------------------------------- the operator creator

func _play_creator() -> void:
	step("creator open")
	main._open_creator()
	await frames(10)
	var c = main.creator
	if c == null:
		problem("the operator creator did not open")
		return
	var CS = load("res://scripts/character/character_store.gd")
	for body in ["male", "female", "robot"]:
		step("creator body %s" % body)
		c.look = CS.clean({"frame": "goliath" if body != "female" else "nyx", "body": body}, true)
		if c.has_method("_rebuild"):
			c._rebuild()
		await frames(5)
	main._close_creator()
	await frames(4)

# ---------------------------------------------------------------- maps and 3D regions

func _play_regions() -> void:
	var index: Array = []
	var f := FileAccess.open("res://generated/maps/index.json", FileAccess.READ)
	if f:
		index = JSON.parse_string(f.get_as_text())
	if index.is_empty():
		problem("no exported maps (run bun scripts/export-godot-data.ts)")
	for r in index:
		var id := String(r.id)
		step("map %s" % id)
		main._open_map(id)
		await frames(6)
		if main.region_map == null:
			problem("the %s map did not open" % id)
			continue
		main.region_map.set_satellite(true)
		await frames(2)
		main.region_map.set_satellite(false)
		main.region_map.zoom_by(2.0)
		await frames(2)
		step("3d %s" % id)
		var before := nodes()
		main._open_3d(id, null, false)
		await frames(6)
		var r3 = main.region_3d
		if r3 == null:
			problem("the %s 3D view did not open" % id)
		else:
			r3._move = Vector2(0, -1)
			await frames(20)
			r3._move = Vector2.ZERO
			r3._zoom(0.7)
			r3._turn(Vector2(40, 10))
			await frames(3)
			step("street view %s" % id)
			r3.set_mode(r3.Mode.STREET)
			await frames(3)
			var eye: Vector3 = r3._eye
			r3._move = Vector2(0, -1)
			await frames(30)
			r3._move = Vector2.ZERO
			if r3._eye.distance_to(eye) < 0.5:
				problem("walking in %s street view did not move" % id)
			if r3._eye.y < r3._ground(r3._eye.x, r3._eye.z):
				problem("%s street view put the camera under the ground" % id)
			if r3.has_method("_on_jump"):
				r3._on_jump(1)
				await frames(3)
			main._close_3d()
			await frames(4)
		main._close_map()
		await frames(4)

# ---------------------------------------------------------------- missions and game modes
## each one opened, played for a stretch (the operator or the car moving) and closed: errors, NaNs and leaks show here
func _play_modes() -> void:
	step("mission 01")
	main._open_mission()
	await frames(30)
	if main.mission == null:
		problem("Mission 01 did not open")
	else:
		main._close_mission()
	await frames(4)
	step("fracture descent")
	main._open_descent()
	await frames(10)
	if main.descent == null:
		problem("the Fracture Descent did not open")
	else:
		main.descent.controls.move = Vector2(0, 1)
		await frames(40)
		main.descent.controls.move = Vector2.ZERO
		main._close_descent()
	await frames(4)
	for id in load("res://scripts/killbox/arena.gd").arena_ids():
		step("killbox %s" % id)
		main._open_killbox()
		await frames(3)
		var kb = main.killbox
		if kb == null:
			problem("the Killbox did not open")
			break
		if kb._picker:
			kb._picker.queue_free()
			kb._picker = null
		kb.arena_id = String(id)
		kb._start()
		await frames(10)
		kb.controls.move = Vector2(0, 1)
		kb.controls.fire = true
		await frames(60)
		kb.controls.fire = false
		kb.controls.move = Vector2.ZERO
		main._close_killbox()
		await frames(4)
	step("raid 01")
	main._open_modes()
	main.modes.open_mode("raids")
	main.modes._launch_raid("broken-gate")
	await frames(60)
	main._close_modes()
	await frames(4)
	step("street race")
	main._open_modes()
	main.modes.open_mode("races")
	main.modes._launch_race("neon-circuit")
	await frames(60)
	main._close_modes()
	await frames(4)
	step("speedway")
	main._open_race()
	await frames(60)
	main._close_race()
	await frames(4)
