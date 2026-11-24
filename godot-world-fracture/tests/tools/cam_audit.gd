extends SceneTree
## Audit: does the chase camera end up inside something while driving or flying?
##   godot --path . --script res://tests/tools/cam_audit.gd -- <drive|fly:heli|fly:jet|fly:airship> seconds out_dir
## Drives / flies a scripted route (full throttle, steering swinging left and right, aircraft climbing then dropping low
## between the towers) and every frame tests the camera against the boxes the view itself uses (the street's obstacle
## list; Skyways' building boxes and the ground). Prints CAM_AUDIT lines and saves a picture of each bad moment.

func _initialize() -> void:
	_run.call_deferred()

func _inside(p: Vector3, boxes: Array) -> int:
	for i in boxes.size():
		var b: AABB = boxes[i]
		if b.size.x < 0.05 or b.position.y < -40.0:
			continue
		if b.grow(-0.05).has_point(p):
			return i
	return -1

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var mode := args[0]
	var secs := float(args[1])
	var out := args[2]
	DirAccess.make_dir_recursive_absolute(out)
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	main._close_title()
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	var cam: Camera3D
	var boxes: Array = []
	var ground := func(_x: float, _z: float) -> float: return -1000.0
	var controls: Control
	var subject := func() -> Vector3: return Vector3.ZERO
	var sk = null
	var st = null
	if mode == "walk":
		main._open_street(true, "nexus", true)
		for i in 30:
			await process_frame
		st = main.street
		controls = st.controls
		controls.scripted = true
		cam = st.operator.cam
		boxes = st.operator.obstacles
		ground = st.operator.ground_at
		subject = func() -> Vector3: return st.operator.global_position
	elif mode == "drive":
		main._open_street(true, "nexus", true)
		for i in 30:
			await process_frame
		st = main.street
		controls = st.controls
		controls.scripted = true
		var best: Node3D = null
		var bd := 1e9
		for c in st.parked:
			if is_instance_valid(c) and not String(c.get_meta("vehicle", "")) in ["goliath-tank", "hover-car"]:
				var d: float = c.global_position.distance_to(st.operator.global_position)
				if d < bd:
					bd = d
					best = c
		st.enter_car(best)
		cam = st.operator.cam
		boxes = st.operator.obstacles
		ground = st.operator.ground_at
		subject = func() -> Vector3: return st.driving_car.node.global_position if st.driving_car else st.operator.global_position
	else:
		var kind := mode.get_slice(":", 1)
		main._open_skyways()
		sk = main.skyways
		sk.craft_id = {"heli": "rift-helicopter", "jet": "vanguard-jet", "airship": "leviathan", "boat": "scrap-patrol-boat", "sub": "hydro-sub-skiff"}.get(kind, "rift-helicopter")
		if sk._picker:
			sk._picker.queue_free()
			sk._picker = null
		sk._start()
		for i in 20:
			await process_frame
		cam = sk.cam
		boxes = sk._boxes
		ground = func(x: float, z: float) -> float: return sk.region.ground(x, z)
		controls = sk.controls
		controls.scripted = true
		subject = func() -> Vector3: return sk.hull.global_position
	var start: Vector3 = subject.call()
	var travel := 0.0
	var prev := start
	var t := 0.0
	var frames := 0
	var inside := 0
	var under := 0
	var blocked := 0
	var shots := 0
	var last_shot := -10.0
	var worst := []
	var still := 0.0
	var backing := 0.0
	var far := 0
	var far_max := 0.0
	while t < secs:
		var steer := sin(t * 0.9) * (1.0 if fmod(t, 9.0) < 6.0 else 0.0)
		controls.move = Vector2(steer, 1.0)
		# a car that stops (traffic, a kerb, a wall) backs off turning, then carries on (as the recording bot drives)
		if mode == "walk":
			# walk and sprint the sidewalk, turning the camera with the look drag now and then
			controls._sprint_held = fmod(t, 10.0) > 5.0
			controls.look_delta = Vector2(6.0 * sin(t * 0.7), 0.0)
		if not sk:
			if backing > 0.0:
				backing -= root.get_physics_process_delta_time()
				controls.move = Vector2(0.9, -1.0)
			elif still > 1.0:
				backing = 1.4
				still = 0.0
		if sk:
			# climb for a while, then dive low between the towers and hold just over the roofs
			var phase := fmod(t, 16.0)
			controls._brake_held = phase < 6.0
			controls._sprint_held = phase > 9.0 and phase < 12.0
		await physics_frame
		t += root.get_physics_process_delta_time()
		frames += 1
		var now: Vector3 = subject.call()
		travel += now.distance_to(prev)
		still = still + root.get_physics_process_delta_time() if now.distance_to(prev) < 0.4 * root.get_physics_process_delta_time() else 0.0
		prev = now
		var p := cam.global_position
		var bi := _inside(p, boxes)
		var g: float = ground.call(p.x, p.z)
		var bad := ""
		var lag := p.distance_to(subject.call())
		far_max = maxf(far_max, lag)
		if mode == "walk" and lag > 9.0:
			far += 1
			bad = "camera %.1f m from the operator" % lag
		elif bi >= 0:
			inside += 1
			bad = "inside box %d %s" % [bi, str(boxes[bi])]
		elif p.y < g + 0.05:
			under += 1
			bad = "under ground %.2f < %.2f" % [p.y, g]
		else:
			# the subject hidden: a box between the camera and the car / craft
			var s: Vector3 = subject.call() + Vector3(0, 1.0, 0)
			for b: AABB in boxes:
				if b.size.x < 0.05 or b.position.y < -40.0 or b.has_point(s) or b.has_point(p):
					continue
				if b.grow(-0.2).intersects_segment(p, s) != null:
					blocked += 1
					bad = "view blocked by %s" % str(b)
					break
		if bad != "":
			worst.append("%.1fs %s cam %s" % [t, bad, str(p.snapped(Vector3.ONE * 0.1))])
			if DisplayServer.get_name() != "headless" and t - last_shot > 1.5 and shots < 6:
				last_shot = t
				shots += 1
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png("%s/%s_%02d.png" % [out, mode.replace(":", "_"), shots])
	print("CAM_AUDIT %s camera too far %d frames (furthest %.1f m)" % [mode, far, far_max])
	print("CAM_AUDIT %s frames %d inside %d under %d blocked %d · travelled %.0f m, ended %.0f m from the start, %d boxes" % [mode, frames, inside, under, blocked, travel, prev.distance_to(start), boxes.size()])
	for w in worst.slice(0, 12):
		print("CAM_AUDIT   ", w)
	quit()
