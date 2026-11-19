extends SceneTree
## Look-dev: the Nexus street (after Mission 01) from a free camera.
##   godot --path . --script res://tests/tools/street_shot.gd -- out.png px,py,pz lx,ly,lz [fov] [no_streaks] [neon]
## Positions are world space. no_streaks hides night_fx's wet-road reflection streaks (for A/B).

func _initialize() -> void:
	_run.call_deferred()

func _v(s: String) -> Vector3:
	var a := s.split(",")
	return Vector3(float(a[0]), float(a[1]), float(a[2]))

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	main._close_title()
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	main._open_street(true, "neon" if "neon" in args else "nexus", true)
	for i in 30:
		await process_frame
	var st = main.street
	if "car" in args and st:
		# into the nearest road car and up the avenue for `drive:N` seconds, the game's own chase camera
		st.controls.scripted = true
		var best: Node3D = null
		var bd := 1e9
		for c in st.parked:
			if is_instance_valid(c) and not String(c.get_meta("vehicle", "")) in ["goliath-tank", "hover-car"]:
				var d: float = c.global_position.distance_to(st.operator.global_position)
				if d < bd:
					bd = d
					best = c
		for a3 in args:
			if a3.begins_with("at:"):
				var q := a3.substr(3).split(",")
				best.global_position = Vector3(float(q[0]), best.global_position.y, float(q[1]))
				best.rotation.y = deg_to_rad(float(q[2]))
		st.enter_car(best)
		var secs := 6.0
		for a2 in args:
			if a2.begins_with("drive:"):
				secs = float(a2.substr(6))
		var t := 0.0
		while t < secs:
			st.controls.move = Vector2(0.0, 1.0)
			await physics_frame
			t += get_root().get_physics_process_delta_time()
		st.controls.move = Vector2.ZERO
	else:
		var cam := Camera3D.new()
		cam.fov = float(args[3]) if args.size() > 3 and args[3].is_valid_float() else 60.0
		st.add_child(cam)
		cam.global_position = _v(args[1])
		cam.look_at(_v(args[2]))
		cam.current = true
		cam.set_process(false)
		st.set_process(false)
	if "no_streaks" in args:
		for mm in root.find_children("*", "MultiMeshInstance3D", true, false):
			var m: Variant = (mm as MultiMeshInstance3D).material_override
			if m is ShaderMaterial and (m as ShaderMaterial).shader and "hit = D * h" in (m as ShaderMaterial).shader.code:
				(mm as MultiMeshInstance3D).visible = false
	for i in 30:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(args[0])
	print("SHOT")
	quit()
