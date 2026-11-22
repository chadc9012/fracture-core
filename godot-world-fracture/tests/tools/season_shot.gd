extends SceneTree
## Look-dev for the season pass (scripts/progress/season_view.gd): a profile seven tiers in with three claimed; the
## saved profile is put back after the shot.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/season_shot.gd -- out.png
const Gear := preload("res://scripts/gear/gear_store.gd")
const Season := preload("res://scripts/progress/season_pass.gd")
var frames := 0
var out := "user://season.png"
var _was: Dictionary

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	_was = Gear.profile_load()
	var p := _was.duplicate(true)
	p.season = { "id": int(Season.current().id), "xp": Season.TIER_XP * 7 + 320, "claimed": [1, 2, 3] }
	Gear.profile_save(p)
	get_root().add_child(load("res://scripts/progress/season_view.gd").new())

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 30:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		Gear.profile_save(_was)
		return true
	return false
