extends SceneTree
## Look-dev for the mission briefing (scripts/ui/briefing.gd) with fd-03's data.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/briefing_shot.gd -- out.png
const Briefing := preload("res://scripts/ui/briefing.gd")
var frames := 0
var out := "user://briefing.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var b := Briefing.new()
	b.data = { "code": "fd-03", "title": "Broken Signal", "place": "Verdant Forest", "art": "load-fracture",
		"text": "The signal isn't natural. Something built it, and it wants you to find the source.",
		"objectives": ["Trace the corrupted signal", "Lock all three relays"], "threats": ["Corrupted wildlife", "Fracture patrols"],
		"reward": "◆ 200 nex  ·  200 xp  ·  a chance at elite gear" }
	get_root().add_child(b)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 20:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
