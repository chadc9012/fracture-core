extends SceneTree
## Look-dev for the settings screen (scripts/front/settings_view.gd).
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/settings_shot.gd -- out.png [keys]
const SettingsView := preload("res://scripts/front/settings_view.gd")
var frames := 0
var out := "user://settings.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var v := SettingsView.new()
	get_root().add_child(v)
	if args.has("keys"):
		(func():
			var sc: ScrollContainer = v.find_children("*", "ScrollContainer", true, false)[0]
			sc.scroll_vertical = 560).call_deferred()

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 10:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
