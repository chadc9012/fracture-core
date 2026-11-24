extends SceneTree
## Look-dev for Mission 01's rooms: the operator stood at a spot, the camera turned a way, one picture.
##   godot --path . --script res://tests/tools/m1_look.gd -- out.png <moment> [x,z,yaw_deg[,pitch]] [hide_op] [hud] [say] [f:N]
## <moment> is a mission shot() moment (apt2, hall, lounge, lobby, surge …); x,z are metres from that room's origin
## (APT, HALL, LOUNGE, LOBBY), yaw 0 looks north (−z).

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out := args[0]
	var moment := args[1] if args.size() > 1 else "apt2"
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
	if moment.length() > 3 and moment[2] == "-":
		M.skip_cinema = false   # a cutscene moment plays (the opening's skip is behind us)
	m.shot(moment)
	for i in 10:
		await process_frame
	if args.size() > 2 and args[2].count(",") >= 2:
		var p := args[2].split(",")
		var base: Vector3 = {"apt": m.APT, "hall": m.HALL, "lounge": m.LOUNGE, "lobby": m.LOBBY}.get(m.room, Vector3.ZERO)
		if m.room == "street":
			base = Vector3.ZERO
		m.op.global_position = base + Vector3(float(p[0]), 0.05, float(p[1]))
		m.op.snap_camera(deg_to_rad(float(p[2])))
		if p.size() > 3:
			m.op.pitch = float(p[3])
	if "hide_op" in args:
		m.op.rig.visible = false
	m.hud.visible = "hud" in args
	if "say" in args:
		m._say([["NOVA", "I don't know yet either. Stay with me. We'll learn the rest as we go."]])
	var settle := 40
	for a in args:
		if a.begins_with("f:"):
			settle = int(a.substr(2))   # f:N — frames to wait (a cutscene moment moves on while it waits)
	for i in settle:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out)
	quit(0)
