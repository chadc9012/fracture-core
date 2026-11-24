extends SceneTree
## Look-dev: the operator creator as the player first sees it, with a chosen body, saved as a screenshot.
##   godot --path . --script res://tests/tools/creator_shot.gd -- out.png [male|female] [nyx|cipher|goliath] [yaw_deg] [face_index]

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out := args[0] if args.size() > 0 else "user://creator.png"
	var body := args[1] if args.size() > 1 else "male"
	var frame := args[2] if args.size() > 2 else "goliath"
	var yaw := float(args[3]) if args.size() > 3 else 0.0
	var face_i := int(args[4]) if args.size() > 4 else 0
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	await process_frame
	main._close_title()
	main._open_creator(true)
	for i in 6:
		await process_frame
	var c = main.creator
	var CS = load("res://scripts/character/character_store.gd")
	var faces: Array = load("res://scripts/character/catalog.gd").faces(body)
	c.look = CS.clean({"frame": frame, "body": body, "face": faces[face_i % faces.size()].id}, true)
	c._rebuild()
	for i in 20:
		await process_frame
	if yaw != 0.0 and "rig" in c and c.rig:
		c.rig.rotation.y = deg_to_rad(yaw)
	for i in 30:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_viewport().get_texture().get_image().save_png(out)
	quit()
