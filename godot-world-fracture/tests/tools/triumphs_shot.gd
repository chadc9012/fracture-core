extends SceneTree
## Look-dev for Triumphs / Collections (scripts/progress/triumphs_view.gd) over a scratch profile with some progress.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/triumphs_shot.gd -- out.png [collections]
const View := preload("res://scripts/progress/triumphs_view.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
var frames := 0
var out := "user://triumphs.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var p := Gear.profile_load()
	for k in [["kill", 140], ["headshot", 31], ["killbox", 6], ["killbox_win", 4], ["quest", 2], ["race", 9], ["drive_m", 18400], ["ring", 40], ["shop", 3]]:
		Progression.event(p, k[0], k[1])
	Gear.profile_save(p)
	var v := View.new()
	v.tab = "collections" if args.has("collections") else "triumphs"
	get_root().add_child(v)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 12:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
