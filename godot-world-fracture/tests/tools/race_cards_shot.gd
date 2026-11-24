extends SceneTree
## Look-dev for NFS Heat's race screens (scripts/ui/race_cards.gd): the intro + countdown, or BUSTED / ESCAPED.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/race_cards_shot.gd -- out.png [start|busted|escaped] [backdrop.png]
const RaceCards := preload("res://scripts/ui/race_cards.gd")
const Career := preload("res://scripts/racing/street_career.gd")
var frames := 0
var out := "user://race.png"
var cd: Control

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var which: String = args[1] if args.size() > 1 else "start"
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_root().add_child(root)
	if args.size() > 2:
		var bg := TextureRect.new()
		bg.texture = ImageTexture.create_from_image(Image.load_from_file(args[2]))
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		root.add_child(bg)
	match which:
		"start":
			root.add_child(RaceCards.intro(Career.event("neon-midnight"), 6.6, ["NightOwl", "Kira"]))
			cd = RaceCards.Countdown.new()
			root.add_child(cd)
			cd.show_count(2)
		"busted":
			root.add_child(RaceCards.pursuit(false, "−600 nex fine  ·  −80 rep"))
		"escaped":
			root.add_child(RaceCards.pursuit(true, "the heat is off  ·  +140 rep"))

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 30:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
