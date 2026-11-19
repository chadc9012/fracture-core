extends SceneTree
## Look-dev for Mission 01's cinematic shots: a free camera in a room, the sleeper in bed if asked.
##   godot --path . --script res://tests/tools/m1_cam.gd -- out.png <moment> px,py,pz lx,ly,lz [fov] [sleep] [hide_op]
## positions are metres from the apartment's origin (APT); <moment> as m1_look.gd

func _initialize() -> void:
	_run.call_deferred()

func _v(s: String, base: Vector3) -> Vector3:
	var p := s.split(",")
	return base + Vector3(float(p[0]), float(p[1]), float(p[2]))

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://mission01.json"))
	var scene: PackedScene = load("res://scenes/main.tscn")
	var main: Node = scene.instantiate()
	root.add_child(main)
	await process_frame
	main._close_title()
	var M = load("res://scripts/mission/mission_01.gd")
	M.skip_cinema = true
	main._open_mission()
	for i in 4:
		await process_frame
	var m = main.mission
	m.shot(args[1])
	for i in 10:
		await process_frame
	if "sleep" in args:
		m._sleeping(true)
	if "hide_op" in args:
		m.op.rig.visible = false
	var cam := Camera3D.new()
	m.int_root.add_child(cam)
	cam.global_position = _v(args[2], m.APT)
	cam.look_at(_v(args[3], m.APT))
	cam.fov = float(args[4]) if args.size() > 4 and args[4].is_valid_float() else 45.0
	cam.current = true
	m.hud.visible = false
	for i in 40:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(args[0])
	quit(0)
