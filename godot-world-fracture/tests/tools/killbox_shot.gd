extends SceneTree
## Look-dev for the Killbox arenas without the rest of the game: one arena, the operator running and firing, a frame
## saved. Usage: godot --path . --script res://tests/tools/killbox_shot.gd -- out.png <arena-id> [mode] [x,y,z] [yaw]
##        ... -- out.png <arena-id> tile     the picker tile: no HUD, no operator, an establishing view from above the
##                                           south edge (textures/ui/modes/pvp-<arena-id>.jpg is made from it)
const ArenaView := preload("res://scripts/killbox/arena_view.gd")
var _n := 0
var _view: Control
var _out := ""
var _tile := false

func _process(_d: float) -> bool:
	_n += 1
	if _n == 1:
		var a := OS.get_cmdline_user_args()
		_out = a[0]
		_view = ArenaView.new()
		_view.arena_id = a[1]
		_tile = a.size() > 2 and a[2] == "tile"
		if a.size() > 2 and a[2] != "-" and not _tile:
			_view.mode_id = a[2]
		root.add_child(_view)
		_view.controls.scripted = true
		if a.size() > 3:
			var p := a[3].split(",")
			_view.operator.position = Vector3(float(p[0]), float(p[1]), float(p[2]))
		if a.size() > 4:
			_view.operator.heading = deg_to_rad(float(a[4]))
			_view.operator.cam_yaw = deg_to_rad(float(a[4])) + PI
	if _tile and (_n == int(OS.get_environment("WF_SHOT_FRAMES")) - 10 or (_n == 40 and OS.get_environment("WF_SHOT_FRAMES") == "")):
		var b: Rect2 = _view.arena.bounds()
		var top := 0.0
		for r in _view.arena.def.roofs:
			top = maxf(top, float(r.top))
		_view.operator.visible = false
		var cam := Camera3D.new()
		cam.fov = 58.0
		cam.far = 2500.0
		_view.world.add_child(cam)
		var c := Vector3(b.get_center().x, top - 1.0, b.get_center().y)
		# a map on the ground has works or a colonnade round it: look in from above them, from just inside the wall
		var ground: bool = _view.arena.def.look in ["foundry", "sanctum"]
		cam.position = c + (Vector3(b.size.x * 0.3, 21.0, b.size.y * 0.5 + 2.0) if ground else Vector3(b.size.x * 0.28, 15.0, b.size.y * 0.5 + 16.0))
		cam.look_at(c + Vector3(-b.size.x * 0.05, 5.0 if ground else 9.0, -b.size.y * 0.3))
		cam.current = true
	if _n == int(OS.get_environment("WF_SHOT_FRAMES")) or (_n == 50 and OS.get_environment("WF_SHOT_FRAMES") == ""):
		var img: Image = _view.world.get_viewport().get_texture().get_image() if _tile else root.get_viewport().get_texture().get_image()
		img.save_png(_out)
		quit()
	return false
