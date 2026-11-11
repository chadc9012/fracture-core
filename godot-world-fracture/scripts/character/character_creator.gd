extends Control
const Outfits := preload("res://scripts/character/outfits.gd")
const Phone := preload("res://scripts/phone.gd")
## Onboarding: the operator creator. A lit turntable of the character (drag to turn it) beside tabs for the body, a named face
## (20 male, 20 female), the ten sculpt sliders, skin tone (plating and optics for robots), hairstyle and colour, facial hair
## and markings, and gear; a name and CONFIRM save it to user://character.json (character_store.gd).

signal closed
signal confirmed(look: Dictionary)

const Catalog := preload("res://scripts/character/catalog.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Rig := preload("res://scripts/character/character_rig.gd")
const FaceMorphs := preload("res://scripts/character/face_morphs.gd")
# the creator makes the person: body, face, skin, hair, facial hair and markings, shown in regular clothes. Armour and gear
# are not chosen here (owner, Nov 10: "operators creator shouldn't have a armor option"); the build picked here is the
# one the armour is fitted to in the game
const TABS := ["BODY", "FACE", "SCULPT", "SKIN", "HAIR", "BEARD & MARKS", "OUTFIT"]
const FACE_TABS := ["FACE", "SCULPT", "SKIN", "HAIR", "BEARD & MARKS"]

var look: Dictionary = {}
var tab := "BODY"
## first run: no BACK, only CONFIRM
var onboarding := false
var rig: Node3D
var cam: Camera3D
var turn := -0.75
var _drag := false
var _dirty := false
var _since := 0.0
var _content: VBoxContainer
var _tab_row: HBoxContainer
var _name: LineEdit
var _title: Label
var _zoom := 0.0
var _tab_buttons := {}
var _cam_target := Vector3.ZERO

func _ready() -> void:
	# a tab asked for by name in any case ("face", "Beard & Marks"); anything unknown opens BODY rather than an empty panel
	tab = tab.to_upper()
	if not tab in TABS:
		tab = "BODY"
	if look.is_empty():
		look = Store.load_look() if Store.exists() else Store.default_look()
	var bg := ColorRect.new()
	bg.color = Color("#04101b")
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# the stage
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.offset_right = -460
	svc.gui_input.connect(_stage_input)
	add_child(svc)
	var vp := SubViewport.new()
	Phone.fit_viewport(vp)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	_stage(vp)
	# the panel
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Data.box(Color(0.03, 0.1, 0.16, 0.96), Data.RULE, 0))
	panel.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	panel.offset_left = -460
	add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	panel.add_child(col)
	var pad := MarginContainer.new()
	for side: String in ["left", "right", "top", "bottom"]:
		pad.add_theme_constant_override("margin_" + side, 16)
	pad.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(pad)
	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 10)
	pad.add_child(inner)
	_title = Data.label("CREATE YOUR OPERATOR" if onboarding else "OPERATOR", 22, Data.GOLD)
	inner.add_child(_title)
	inner.add_child(Data.label("Choose a body and a face, then make it yours.", 13, Data.MUTED))
	var tabs_flow := HFlowContainer.new()
	tabs_flow.add_theme_constant_override("h_separation", 6)
	tabs_flow.add_theme_constant_override("v_separation", 6)
	inner.add_child(tabs_flow)
	for t: String in TABS:
		var b := Data.button(t, t == tab)
		b.custom_minimum_size = Vector2(0, 38)
		b.add_theme_font_size_override("font_size", 13)
		b.pressed.connect(func() -> void: _set_tab(t))
		tabs_flow.add_child(b)
		_tab_buttons[t] = b
	_tab_row = HBoxContainer.new()
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	inner.add_child(scroll)
	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 8)
	scroll.add_child(_content)
	# name and confirm
	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", 8)
	inner.add_child(foot)
	_name = LineEdit.new()
	_name.placeholder_text = "Operator name"
	_name.max_length = 18
	_name.text = look.get("name", "")
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name.custom_minimum_size = Vector2(0, 46)
	_name.add_theme_font_size_override("font_size", 16)
	_name.text_changed.connect(func(t: String) -> void: look.name = t)
	foot.add_child(_name)
	if not onboarding:
		var back := Data.button("BACK")
		back.custom_minimum_size = Vector2(90, 46)
		back.pressed.connect(func() -> void: closed.emit())
		foot.add_child(back)
	var ok := Data.button("CONFIRM", true)
	ok.custom_minimum_size = Vector2(120, 46)
	ok.pressed.connect(_confirm)
	foot.add_child(ok)
	_rebuild()
	_fill()

func _stage(vp: SubViewport) -> void:
	var world := Node3D.new()
	vp.add_child(world)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#06131f")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#3a5670")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var key := DirectionalLight3D.new()
	key.light_color = Color("#ffe6cc")
	key.light_energy = 1.6
	key.shadow_enabled = true
	key.rotation = Vector3(deg_to_rad(-32), deg_to_rad(28), 0)
	world.add_child(key)
	var fill := OmniLight3D.new()
	fill.light_color = Color("#9fc8ff")
	fill.light_energy = 0.9
	fill.omni_range = 6.0
	fill.position = Vector3(-1.6, 1.5, 1.6)
	world.add_child(fill)
	for sx: float in [-1.0, 1.0]:
		var rim := OmniLight3D.new()
		rim.light_color = Color("#36d6ff") if sx < 0 else Color("#ff5fa8")
		rim.light_energy = 2.2
		rim.omni_range = 4.0
		rim.position = Vector3(sx * 1.3, 1.9, -1.4)
		world.add_child(rim)
	# a plinth with a glowing ring
	var plinth := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.75
	cyl.bottom_radius = 0.8
	cyl.height = 0.08
	plinth.mesh = cyl
	var pm := StandardMaterial3D.new()
	pm.albedo_color = Color("#101820")
	pm.metallic = 0.7
	pm.roughness = 0.3
	plinth.material_override = pm
	plinth.position.y = -0.04
	world.add_child(plinth)
	var ring := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 0.74
	tor.outer_radius = 0.77
	ring.mesh = tor
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color("#8ce9ff")
	rm.emission_enabled = true
	rm.emission = Color("#5fd8ff")
	rm.emission_energy_multiplier = 3.0
	ring.material_override = rm
	ring.position.y = 0.0
	world.add_child(ring)
	# a back wall with faint grid glow
	var wall := MeshInstance3D.new()
	var pl := PlaneMesh.new()
	pl.size = Vector2(12, 6)
	wall.mesh = pl
	wall.rotation.x = PI / 2
	wall.position = Vector3(0, 3, -3)
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color("#0a1824")
	wm.roughness = 0.9
	wall.material_override = wm
	world.add_child(wall)
	rig = Rig.new()
	world.add_child(rig)
	cam = Camera3D.new()
	cam.fov = 32
	cam.current = true
	world.add_child(cam)

func _frame_camera() -> void:
	var face := tab in FACE_TABS
	var hp: Vector3 = rig.head_world() if rig else Vector3(0, 1.6, 0)
	var target := hp + Vector3(0, 0.1, 0) if face else Vector3(0, rig.head_point.y * 0.55, 0)
	_cam_target = target if _cam_target == Vector3.ZERO else _cam_target.lerp(target, 0.15)
	var dist := (1.25 if face else 3.9) * (1.0 - _zoom * 0.5)
	cam.position = _cam_target + Vector3(0, 0.03 if face else 0.25, dist)
	cam.look_at(_cam_target)

func _process(delta: float) -> void:
	_since += delta
	if _dirty and _since > 0.12:
		_dirty = false
		_since = 0.0
		_rebuild()
	if rig:
		if not _drag:
			turn += delta * 0.12
		rig.rotation.y = turn
	_frame_camera()

func _stage_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_drag = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom = clampf(_zoom + 0.1, 0.0, 1.0)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom = clampf(_zoom - 0.1, 0.0, 1.0)
	elif e is InputEventScreenTouch:
		_drag = (e as InputEventScreenTouch).pressed
	elif e is InputEventMouseMotion and _drag:
		turn += (e as InputEventMouseMotion).relative.x * 0.01
	elif e is InputEventScreenDrag:
		turn += (e as InputEventScreenDrag).relative.x * 0.01

func _rebuild() -> void:
	# the person in their own clothes (urban streetwear): no armour, no helmet
	var shown := look.duplicate(true)
	shown.civ = true
	shown.headgear = "none"
	rig.build(shown)

func _changed(rebuild_panel := false) -> void:
	_dirty = true
	if rebuild_panel:
		_fill()

func _set_tab(t: String) -> void:
	tab = t
	_fill()

func show_tab(t: String) -> void:
	tab = t
	if _content:
		_fill()

func _confirm() -> void:
	look.name = _name.text.strip_edges()
	Store.save_look(look)
	confirmed.emit(Store.clean(look))

# --- the panel

func _section(text: String) -> void:
	var l := Data.label(text, 14, Data.CYAN)
	_content.add_child(l)

func _grid(cols := 3) -> GridContainer:
	var g := GridContainer.new()
	g.columns = cols
	g.add_theme_constant_override("h_separation", 6)
	g.add_theme_constant_override("v_separation", 6)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_child(g)
	return g

func _choice(parent: Control, text: String, on: bool, f: Callable, tip := "") -> Button:
	var b := Data.button(text, on)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 13)
	b.clip_text = true
	b.tooltip_text = tip
	if on:
		b.add_theme_stylebox_override("normal", Data.box(Color("#1d5370"), Data.GOLD, 7, 2))
	b.pressed.connect(f)
	parent.add_child(b)
	return b

func _swatches(key: String, current: String, f: Callable) -> void:
	var g := _grid(5)
	for s: Dictionary in Catalog.list(key):
		var b := Button.new()
		b.custom_minimum_size = Vector2(0, 44)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.tooltip_text = s.label
		var c: Color = Color(s.hex) if s.hex != "" else Color("#3a4752")
		b.add_theme_stylebox_override("normal", Data.box(c, Data.GOLD if s.id == current else Color(0, 0, 0, 0.4), 6, 3 if s.id == current else 1))
		b.add_theme_stylebox_override("hover", Data.box(c.lightened(0.15), Data.GOLD, 6, 2))
		b.add_theme_stylebox_override("pressed", Data.box(c, Color.WHITE, 6, 3))
		if s.hex == "":
			b.text = "AUTO"
			b.add_theme_font_size_override("font_size", 11)
		var id: String = s.id
		b.pressed.connect(func() -> void: f.call(id))
		g.add_child(b)
	var name_l := Data.label(Catalog.find(key, current).get("label", ""), 12, Data.MUTED)
	_content.add_child(name_l)

func _fill() -> void:
	for t: String in _tab_buttons:
		var tb: Button = _tab_buttons[t]
		tb.add_theme_stylebox_override("normal", Data.box(Color("#1d5370") if t == tab else Color("#0b2335"), Data.GOLD if t == tab else Data.RULE, 7, 2 if t == tab else 1))
	for c in _content.get_children():
		c.free()
	var robot: bool = look.body == "robot"
	match tab:
		"BODY":
			_section("GENDER")
			var g := _grid(3)
			for b: String in ["male", "female", "robot"]:
				_choice(g, b.to_upper(), look.body == b, func() -> void:
					look = Store.clean({"frame": look.frame, "body": b, "name": look.get("name", ""), "face": Catalog.faces(b)[0].id if Catalog.faces(b).size() else ""}, true)
					_changed(true))
			_section("BODY TYPE")
			var gb := _grid(3)
			for fid: String in ["nyx", "cipher", "goliath"]:
				var bl: Array = Catalog.BUILDS[fid]
				_choice(gb, String(bl[0]), look.frame == fid, func() -> void:
					look.frame = fid
					look.head = look.head if not robot else Catalog.default_head(fid, "robot")
					_changed(true), String(bl[1]))
		"OUTFIT":
			# the clothes they wear in the city (not armour): scripts/character/outfits.gd
			_section("OUTFIT")
			var go := _grid(2)
			for o: Dictionary in Outfits.LIST:
				var oid: String = o.id
				_choice(go, String(o.name), String(look.get("outfit", "")) == oid, func() -> void:
					look.outfit = oid
					_changed(true))
		"FACE":
			if robot:
				_section("HEAD")
			else:
				_section("NAMED FACES")
				var g2 := _grid(2)
				for f: Dictionary in Catalog.faces(look.body):
					var id: String = f.id
					_choice(g2, f.label, look.get("face", "") == id, func() -> void:
						look = Store.apply_face(look, id)
						_changed(true), f.blurb)
				_section("HEAD SHAPE")
			var g3 := _grid(2)
			for h: Dictionary in Catalog.heads(look.body):
				var hid: String = h.id
				_choice(g3, h.label, look.head == hid, func() -> void:
					look.head = hid
					look.face = ""
					_changed(true), h.blurb)
		"SCULPT":
			if robot:
				_content.add_child(Data.label("Robot heads keep their plates — pick a head in FACE.", 13, Data.MUTED))
				return
			for m: Dictionary in Catalog.list("morphs"):
				var row := HBoxContainer.new()
				row.add_child(Data.label(m.label, 13))
				var sp := Control.new()
				sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_child(sp)
				row.add_child(Data.label("%s · %s" % [m.low, m.high], 11, Data.MUTED))
				_content.add_child(row)
				var s := HSlider.new()
				s.min_value = -1.0
				s.max_value = 1.0
				s.step = 0.05
				s.value = float(look.morphs.get(m.id, 0.0))
				s.custom_minimum_size = Vector2(0, 30)
				var mid: String = m.id
				s.value_changed.connect(func(v: float) -> void:
					var mm: Dictionary = look.morphs.duplicate()
					mm[mid] = v
					look.morphs = FaceMorphs.clean(mm)
					look.face = ""
					_changed())
				_content.add_child(s)
			_choice(_content, "RESET SCULPT", false, func() -> void:
				look.morphs = {}
				_changed(true))
		"SKIN":
			if robot:
				_section("PLATING")
				_swatches("plating", look.skin, func(id: String) -> void:
					look.skin = id
					_changed(true))
				_section("OPTICS")
				_swatches("optics", look.eyes, func(id: String) -> void:
					look.eyes = id
					_changed(true))
			else:
				_section("SKIN TONE")
				_swatches("skin", look.skin, func(id: String) -> void:
					look.skin = id
					look.face = ""
					_changed(true))
		"HAIR":
			if robot:
				_content.add_child(Data.label("Robots don't wear hair — try GEAR.", 13, Data.MUTED))
				return
			_section("HAIR COLOUR")
			_swatches("hairColors", look.hairColor, func(id: String) -> void:
				look.hairColor = id
				_changed(true))
			_section("HAIRSTYLE")
			if look.head in Store.WILD_HEADS:
				_content.add_child(Data.label("This head keeps its own hair — pick another head shape in FACE for new styles.", 13, Data.MUTED))
				return
			var g4 := _grid(2)
			for h: Dictionary in Catalog.hair_for(look.body):
				var hid: String = h.id
				_choice(g4, h.label, look.hair == hid, func() -> void:
					look.hair = hid
					look = Store.clean(look)
					_changed(true), h.blurb)
		"BEARD & MARKS":
			if robot:
				_content.add_child(Data.label("Robot plates take no markings.", 13, Data.MUTED))
				return
			_section("FACIAL HAIR")
			var g5 := _grid(2)
			for b: Dictionary in Catalog.list("beards"):
				var bid: String = b.id
				_choice(g5, b.label, look.beard == bid, func() -> void:
					look.beard = bid
					_changed(true), b.blurb)
			_section("MARKINGS (up to %d)" % int(Catalog.data().get("maxMarkings", 4)))
			var g6 := _grid(2)
			for m: Dictionary in Catalog.list("markings"):
				var mid: String = m.id
				_choice(g6, m.label, mid in look.marks, func() -> void:
					var marks: Array = look.marks.duplicate()
					if mid in marks:
						marks.erase(mid)
					elif marks.size() < int(Catalog.data().get("maxMarkings", 4)):
						marks.append(mid)
					look.marks = marks
					_changed(true), m.blurb)

