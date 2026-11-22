extends SceneTree
## Look-dev for the skill tree (scripts/progress/skills_view.gd) on a level-9 profile with three perks bought.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/skills_shot.gd -- out.png
const View := preload("res://scripts/progress/skills_view.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
var frames := 0
var out := "user://skills.png"
var _was: Dictionary

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var p := Gear.profile_load()
	_was = p.duplicate(true)   # put back after the shot: the tests read this profile
	p.xp = 4200
	p.skills = ["steady-hands", "marksman", "capacitor"]
	Gear.profile_save(p)
	get_root().add_child(View.new())

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 15:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		Gear.profile_save(_was)
		return true
	return false
