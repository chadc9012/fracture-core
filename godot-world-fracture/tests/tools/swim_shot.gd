extends SceneTree
## Look-dev: swimming and diving in the Fracture Descent's water, the game's own chase camera.
##   godot --path . --script res://tests/tools/swim_shot.gd -- out_prefix [dive] [world:<region id>]
## Finds deep water near the crash site, swims out for a few seconds (dive: ducks under with the camera pitched down
## and swims along the bottom), prints the operator's state each second and saves a picture every 2 s.

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out := args[0]
	var dive := "dive" in args
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	main._close_title()
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	main._open_descent()
	for i in 20:
		await process_frame
	var d = main.descent
	if d.cutscene and d.cutscene.playing:
		d.cutscene._end()
	for a0 in args:
		if a0.begins_with("world:"):
			d._travel(a0.substr(6), "")
			for i in 20:
				await process_frame
	var region = d.region
	var b: Rect2 = d.operator.bounds
	var lo := INF
	var wet := 0
	var n := 0
	for gx in range(int(b.position.x), int(b.end.x), 8):
		for gz in range(int(b.position.y), int(b.end.y), 8):
			n += 1
			lo = minf(lo, region.terrain(gx, gz))
			if region.swim_surface(gx, gz) > -INF:
				wet += 1
	print("SWIM_SHOT bounds ", b, " lowest bed ", lo, " swimmable cells ", wet, " of ", n)
	# the deepest swimmable water inside the bounds; face across it toward the most open water
	var best := Vector3.INF
	var deepest := INF
	for gx in range(int(b.position.x) + 4, int(b.end.x) - 4, 4):
		for gz in range(int(b.position.y) + 4, int(b.end.y) - 4, 4):
			if region.swim_surface(gx, gz) > -INF and region.terrain(gx, gz) < deepest:
				deepest = region.terrain(gx, gz)
				best = Vector3(gx, 0, gz)
	var heading := 0.0
	var open_best := -1
	for k in 16:
		var a := TAU * k / 16.0
		var run := 0
		while run < 40 and region.swim_surface(best.x + cos(a) * run, best.z + sin(a) * run) > -INF:
			run += 1
		if run > open_best:
			open_best = run
			heading = atan2(cos(a), sin(a))
	if best != Vector3.INF:
		best -= Vector3(sin(heading), 0, cos(heading)) * minf(6.0, open_best * 0.3)
	print("SWIM_SHOT ", d.world_id, " at ", best, " water ", region.water_level(), " bed ", region.terrain(best.x, best.z) if best != Vector3.INF else 0.0)
	if best == Vector3.INF:
		quit(1)
		return
	var op = d.operator
	best.y = region.wade_ground(best.x, best.z)
	op.position = best
	op.heading = heading
	op.cam_yaw = heading + PI
	d.controls.scripted = true
	d.controls.move = Vector2(0, 1)
	var t := 0.0
	var shot := 0
	var next_print := 0.0
	var next_shot := 1.5
	var dove := false
	while t < 7.0:
		if dive and not dove and t > 0.5:
			d.controls._jump = true
			op.cam_pitch = -0.6
			dove = true
		if dive and t > 3.5:
			op.cam_pitch = -0.12   # level off along the bottom
		await physics_frame
		t += root.get_physics_process_delta_time()
		if t >= next_print:
			next_print += 1.0
			print("SWIM_SHOT t %.1f swimming %s diving %s y %.2f (surface %.2f, bed %.2f) oxygen %.0f cam y %.2f" % [t, op.swimming, op.diving, op.position.y, region.water_level(), region.terrain(op.position.x, op.position.z), op.oxygen, op.cam.global_position.y])
		if t >= next_shot:
			next_shot += 2.0
			shot += 1
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png("%s_%d.png" % [out, shot])
	quit()
