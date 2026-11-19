extends SceneTree
## Look-dev for the loading card (scripts/ui/loading_card.gd).
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/loading_shot.gd -- out.png <place> [name]
const LoadingCard := preload("res://scripts/ui/loading_card.gd")
var frames := 0
var out := "user://loading.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var c := LoadingCard.new()
	c.place = args[1] if args.size() > 1 else "nexus"
	c.title_override = args[2] if args.size() > 2 else ""
	get_root().add_child(c)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 10:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
