extends SceneTree
## Look-dev for the settings screen (scripts/front/settings_view.gd).
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/settings_shot.gd -- out.png
const SettingsView := preload("res://scripts/front/settings_view.gd")
var frames := 0
var out := "user://settings.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	get_root().add_child(SettingsView.new())

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 10:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
