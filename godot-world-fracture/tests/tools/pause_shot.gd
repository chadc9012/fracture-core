extends SceneTree
## Look-dev for the pause menu (scripts/front/pause_menu.gd) over a backdrop picture.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/pause_shot.gd -- out.png [backdrop.png]
const PauseMenu := preload("res://scripts/front/pause_menu.gd")
var frames := 0
var out := "user://pause.png"
var menu: Control

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	if args.size() > 1 and FileAccess.file_exists(args[1]):
		var bg := TextureRect.new()
		bg.texture = ImageTexture.create_from_image(Image.load_from_file(args[1]))
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		get_root().add_child(bg)
	var p := PauseMenu.new()
	p.activity = "Story  ·  Broken Signal"
	p.objective = "Broken Signal\nTrace the corrupted signal · 1 / 3"
	get_root().add_child(p)
	menu = p

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 3:
		menu._hover(1)
	if frames == 20:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
