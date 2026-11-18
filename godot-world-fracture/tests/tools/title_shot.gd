extends SceneTree
## Look-dev for the title (scripts/front/title.gd): the press-to-play step, or the menu after the press.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/title_shot.gd -- out.png [menu]
const Title := preload("res://scripts/front/title.gd")
var frames := 0
var out := "user://title.png"
var t: Control
var menu := false

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	menu = args.has("menu")
	t = Title.new()
	get_root().add_child(t)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 4 and menu:
		t._reveal(true)
	if frames == (90 if menu else 12):
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
