extends SceneTree
## Look-dev for the on-foot HUD (touch_controls.gd) without loading a world: the overlay over a backdrop picture (or a
## dusk gradient), armed, hit, a toast and a prompt up.
##   WF_TOUCH=1 xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/hud_shot.gd -- out.png [backdrop.png] [down] [level]
const TouchControls := preload("res://scripts/player/touch_controls.gd")
var frames := 0
var out := "user://hud.png"
var c: Control
var down := false

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_root().add_child(root)
	if args.size() > 1 and FileAccess.file_exists(args[1]):
		var bg := TextureRect.new()
		bg.texture = ImageTexture.create_from_image(Image.load_from_file(args[1]))
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		root.add_child(bg)
	else:
		var g := Gradient.new()
		g.set_color(0, Color(0.22, 0.27, 0.36))
		g.set_color(1, Color(0.05, 0.06, 0.09))
		var gt := GradientTexture2D.new()
		gt.gradient = g
		gt.fill_from = Vector2(0.5, 0)
		gt.fill_to = Vector2(0.5, 1)
		var bg := TextureRect.new()
		bg.texture = gt
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		root.add_child(bg)
	down = args.has("down")
	c = TouchControls.new()
	c.scripted = true
	root.add_child(c)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 3:
		c.weapon_name.text = "Void Sceptre"
		c.ammo.text = "18 / 120"
		c.show_loadout("FUSION", "VOID")
		c.show_hull(0.3 if down else 0.72, 0.6 if down else 0.0, 4.2 if down else 0.0, 0.0 if down else 0.55)
		c.show_grenade({ "name": "Breacher Frag", "max": 2, "charges": 1, "recharge": 0.4, "color": Color(1.0, 0.7, 0.35) })
		c.toast("Daily goal complete  ·  +250 XP  ·  +120 Nex")
		c.prompt("Enter Neon Drift")
		c.hit_marker("head")
		if OS.get_cmdline_user_args().has("level"):
			c.toast("LEVEL 13 — +2 power, +4 hull")
			c.toast("LOOT · Void Sceptre (183 power)")
			c.toast("LOOT · Warden Hood (151 power)")
	if frames == 20:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
