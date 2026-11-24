extends SceneTree
## Look-dev for Valorant's round banner (scripts/killbox/round_banner.gd) over a backdrop.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/round_banner_shot.gd -- out.png [lost] [backdrop.png]
const RoundBanner := preload("res://scripts/killbox/round_banner.gd")
var frames := 0
var out := "user://round_banner.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var lost := args.has("lost")
	for a in args:
		if String(a).ends_with(".jpg") and FileAccess.file_exists(a):
			var bg := TextureRect.new()
			bg.texture = ImageTexture.create_from_image(Image.load_from_file(a))
			bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			get_root().add_child(bg)
	var b := RoundBanner.new()
	b.data = { "round": 4, "result": -1 if lost else 1, "why": "Objective lost" if lost else "Team wiped",
		"us": 2 if lost else 3, "them": 2 if lost else 1, "to_win": 4, "accolade": "" if lost else "CLUTCH",
		"next": "Next: attack the objective" }
	get_root().add_child(b)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 25:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
