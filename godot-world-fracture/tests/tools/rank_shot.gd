extends SceneTree
## Look-dev for the reputation card (scripts/ui/rank_card.gd): a race that crosses ROOKIE → STREET RACER.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/rank_shot.gd -- out.png
const RankCard := preload("res://scripts/ui/rank_card.gd")
const Career := preload("res://scripts/racing/street_career.gd")
var frames := 0
var out := "user://rank.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var bg := ColorRect.new()
	bg.color = Color(0.1, 0.12, 0.18)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_root().add_child(bg)
	get_root().add_child(RankCard.make("STREET REPUTATION", Career.TIERS, 720, 840))

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 150:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
