extends SceneTree
## Look-dev for the Killbox hero select (scripts/killbox/hero_select.gd).
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/hero_select_shot.gd -- out.png [frame]
const HeroSelect := preload("res://scripts/killbox/hero_select.gd")
var frames := 0
var out := "user://hero_select.png"
var h: Control
var pick := ""

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	if args.size() > 1:
		pick = args[1]
	h = HeroSelect.new()
	h.arena = "Neon Rooftops"
	h.mode = "Clash"
	get_root().add_child(h)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 3 and pick != "":
		h._pick(pick)
	if frames == 90:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
