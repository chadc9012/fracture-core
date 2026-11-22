extends SceneTree
## Look-dev for the Killbox arenas without the rest of the game: one arena, the operator running and firing, a frame
## saved. Usage: godot --path . --script res://tests/tools/killbox_shot.gd -- out.png <arena-id> [mode] [x,y,z] [yaw]
const ArenaView := preload("res://scripts/killbox/arena_view.gd")
var _n := 0
var _view: Control
var _out := ""

func _process(_d: float) -> bool:
	_n += 1
	if _n == 1:
		var a := OS.get_cmdline_user_args()
		_out = a[0]
		_view = ArenaView.new()
		_view.arena_id = a[1]
		if a.size() > 2 and a[2] != "-":
			_view.mode_id = a[2]
		root.add_child(_view)
		_view.controls.scripted = true
		if a.size() > 3:
			var p := a[3].split(",")
			_view.operator.position = Vector3(float(p[0]), float(p[1]), float(p[2]))
		if a.size() > 4:
			_view.operator.heading = deg_to_rad(float(a[4]))
			_view.operator.cam_yaw = deg_to_rad(float(a[4])) + PI
	if _n == 50:
		root.get_viewport().get_texture().get_image().save_png(_out)
		quit()
	return false
