extends SceneTree
## Portrait fit: on a 540 × 1170 phone screen no visible text runs off the edge. Opens the screens a new player sees first
## (the title, the operator creator, Mission 01's cinematics and HUD, the Nexus street), shows the longest lines and
## titles they carry, and checks every visible Label and Button lies inside the screen. Also checks the creator's
## stage is wide enough to see the operator, and that the mission's cinematic camera never ends up inside a wall.
##   godot --headless --path . --script res://tests/ui/portrait_fit_test.gd

const W := 540.0
const H := 1170.0
var main: Node
var fails := 0

func _initialize() -> void:
	_run.call_deferred()

func frames(n: int) -> void:
	for i in n:
		await process_frame

func check(ok: bool, what: String) -> void:
	if not ok:
		fails += 1
	print(("ok   " if ok else "FAIL ") + what)

## every visible Label / Button under `n` with text must sit inside the screen (2 px grace)
func audit(n: Node, where: String) -> void:
	var screen := Rect2(Vector2(-2, -2), Vector2(W + 4, H + 4))
	var bad: Array = []
	for c in _all(n):
		var ci := c as Control
		if ci == null or not ci.is_visible_in_tree() or ci.modulate.a < 0.01:
			continue
		var t := ""
		if ci is Label:
			t = (ci as Label).text
		elif ci is Button:
			t = (ci as Button).text
		if t.strip_edges() == "":
			continue
		var r := ci.get_global_rect()
		# a label wider than its rect (no wrap, no clip) still draws past it: measure the text too
		if ci is Label and (ci as Label).autowrap_mode == TextServer.AUTOWRAP_OFF and not (ci as Label).clip_text:
			var l := ci as Label
			var f := l.get_theme_font("font")
			var fs := l.get_theme_font_size("font_size")
			var tw := 0.0
			for line in l.text.split("\n"):
				tw = maxf(tw, f.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x)
			if tw > r.size.x + 1.0:
				var grow := tw - r.size.x
				var x0 := r.position.x
				match l.horizontal_alignment:
					HORIZONTAL_ALIGNMENT_CENTER: x0 -= grow * 0.5
					HORIZONTAL_ALIGNMENT_RIGHT: x0 -= grow
				r = Rect2(Vector2(x0, r.position.y), Vector2(tw, r.size.y))
		if not screen.encloses(r):
			bad.append("'%s' %s" % [t.left(40).replace("\n", " "), r])
	check(bad.is_empty(), "%s: all text on screen%s" % [where, "" if bad.is_empty() else "\n       " + "\n       ".join(bad)])
	# with a display (xvfb), a picture of each screen for a look: --shots <dir>
	var args := OS.get_cmdline_user_args()
	var i := args.find("--shots")
	if i >= 0 and i + 1 < args.size() and DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("%s/%s.png" % [args[i + 1], where.validate_filename().replace(" ", "_")])

func _all(n: Node) -> Array:
	var out: Array = [n]
	for c in n.get_children():
		out.append_array(_all(c))
	return out

func _run() -> void:
	root.size = Vector2i(int(W), int(H))
	root.content_scale_size = Vector2i(int(W), int(H))
	for f in ["user://mission01.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(f))
	var scene: PackedScene = load("res://scenes/main.tscn")
	main = scene.instantiate()
	root.add_child(main)
	await frames(10)
	main._close_title()
	root.content_scale_size = Vector2i(int(W), int(H))
	# the creator: the stage shows the operator, the panel and its buttons fit
	main._open_creator()
	await frames(6)
	var c: Control = main.creator
	await audit(c, "creator")
	var stage: Control = null
	for n in _all(c):
		if n is SubViewportContainer:
			stage = n
	check(stage != null and stage.get_global_rect().size.x >= W * 0.9 and stage.get_global_rect().size.y >= H * 0.3, "creator: the stage spans the screen (%s)" % (stage.get_global_rect() if stage else "none"))
	main._close_creator()
	await frames(2)
	# Mission 01: the cinematic's title card and a long subtitle
	main._open_mission()
	await frames(6)
	var m: Control = main.mission
	var cs = m._cs
	for title: Array in [["NEXUS CITY", "THE LAST ORDINARY MORNING"], ["APARTMENT 12-04", "NEXUS CITY RESIDENCES"], ["THE FRACTURE", "CHAPTER ONE"]]:
		cs._title_big.text = title[0]
		cs._title_small.text = title[1]
		cs.fit_title()
		cs._title.modulate.a = 1.0
		cs.visible = true
		cs._show_line("RADIO", "Good morning, Nexus City. Clear skies over the harbour, the stability towers finish their maintenance loop by noon. Stay with us.")
		await frames(3)
		await audit(cs, "cinematic '%s'" % title[0])
	cs._title.modulate.a = 0.0
	cs.visible = false
	# the HUD: a long line, the abilities row, the objective
	m.hud.visible = true
	m._say([["CIVILIAN", "Please! The stairwell is blocked — my daughter is on the other side of the door and the support beam is coming down."]], true)
	m._abil.text = "Q  RESONANCE BLAST READY   SPACE  DASH READY   LMB fire · F melee · R reload"
	m._prompt.text = "[E]  Stairs down to the lobby"
	m._title_card.text = "M1 · THE FRACTURE"
	m._fit_hud()
	m._title_card.modulate.a = 1.0
	await frames(3)
	check(m._sub_box.visible, "mission HUD: a line said outside a cinematic shows")
	await audit(m.hud, "mission HUD")
	# the cinematic camera stays out of the walls: a close shot placed through a wall comes in front of it
	var wall := StaticBody3D.new()
	wall.collision_layer = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(4, 4, 0.2)
	shape.shape = box
	wall.add_child(shape)
	m.street_root.add_child(wall)
	wall.global_position = Vector3(500, 1, 500)
	await physics_frame
	await physics_frame
	cs.cam.global_position = Vector3(500, 1, 501.5)     # behind the wall
	var target := Vector3(500, 1, 498.5)                # in front of it
	cs._unclip(target)
	check(cs.cam.global_position.z < 499.95, "cinematic camera: a close shot behind a wall comes in front of it (z %.2f)" % cs.cam.global_position.z)
	cs.cam.global_position = Vector3(500, 1, 530.0)     # a wide shot far off is left where it was framed
	cs._unclip(target)
	check(is_equal_approx(cs.cam.global_position.z, 530.0), "cinematic camera: a wide shot is left alone")
	# the shoulder camera narrows its offset on an upright screen
	m.op.frozen = false
	await physics_frame
	await physics_frame
	check(m.op.arm.position.x < 0.4, "shoulder camera: the offset narrows upright (%.2f)" % m.op.arm.position.x)
	# out on the Nexus street after the mission: the street HUD, on foot and in a car
	m.closed.emit()
	await frames(30)
	if main.street == null:
		main._open_street(true, "nexus", true)
		await frames(30)
	var st = main.street
	check(st != null, "street: opened after the mission")
	if st:
		await audit(st, "street on foot")
		var best: Node3D = null
		for c2 in st.parked:
			if is_instance_valid(c2):
				best = c2
				break
		if best:
			st.enter_car(best)
			await frames(20)
			await audit(st, "street in a car")
	print("\n%s" % ("PASS" if fails == 0 else "%d FAILED" % fails))
	quit(0 if fails == 0 else 1)
