extends Control
const Outfits := preload("res://scripts/character/outfits.gd")
const Wardrobe := preload("res://scripts/character/wardrobe.gd")
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
const START_TURN := -0.35
var turn := START_TURN
var _shown_turn := START_TURN
var _spin := 0.0
var _pan := 0.0
var _touches := {}
var _pinch := 0.0
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
	_view_buttons(self)
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

## The stage is a photo studio, as GTA V's creator shows its character (owner, Nov 22: "Fix this so it can look like GTA 5"):
## a seamless grey cyclorama, a soft warm key, a cool fill, two white rims and a hair light, a soft contact shadow under the
## feet, and the background falling out of focus. The camera frames the whole body, the outfit or the face by tab; drag
## turns the character, a vertical drag moves the view up and down, a pinch / the wheel / the + − buttons zoom.
func _stage(vp: SubViewport) -> void:
	var world := Node3D.new()
	vp.add_child(world)
	var hi := Phone.tier() != "low"
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.11, 0.115, 0.125)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.64, 0.68)
	env.ambient_light_energy = 0.42
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.25
	env.glow_bloom = 0.02
	env.ssao_enabled = hi and not Phone.on_phone()
	env.ssao_radius = 0.6
	env.ssao_intensity = 1.2
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 0.95
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	# the cyclorama: a floor that curves up into the back wall, one seamless surface, lit grey falling to dark at the top
	var cyc := MeshInstance3D.new()
	cyc.mesh = _cyclorama()
	var cm := ShaderMaterial.new()
	cm.shader = Shader.new()
	cm.shader.code = """shader_type spatial;
render_mode cull_disabled;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	float up = clamp(wp.y / 5.0, 0.0, 1.0);
	float side = clamp(abs(wp.x) / 7.0, 0.0, 1.0);
	vec3 c = mix(vec3(0.42, 0.43, 0.45), vec3(0.11, 0.115, 0.13), smoothstep(0.05, 0.85, up));
	c *= 1.0 - 0.45 * side * side;
	ALBEDO = c;
	ROUGHNESS = 0.92;
	SPECULAR = 0.2;
}"""
	cyc.material_override = cm
	world.add_child(cyc)
	# a soft contact shadow under the feet (the shadow map alone leaves them floating at this softness)
	var blob := Decal.new()
	var gt := GradientTexture2D.new()
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	var gr := Gradient.new()
	gr.set_color(0, Color(0, 0, 0, 0.55))
	gr.set_color(1, Color(0, 0, 0, 0.0))
	gt.gradient = gr
	gt.width = 128
	gt.height = 128
	blob.texture_albedo = gt
	blob.size = Vector3(1.1, 0.4, 0.9)
	blob.position = Vector3(0, 0.0, 0)
	world.add_child(blob)
	# key: a warm soft light high and to the left of camera
	var key := DirectionalLight3D.new()
	key.light_color = Color(1.0, 0.94, 0.86)
	key.light_energy = 2.1
	key.shadow_enabled = true
	key.light_angular_distance = 3.0
	key.shadow_blur = 2.0
	key.rotation = Vector3(deg_to_rad(-38), deg_to_rad(-34), 0)
	world.add_child(key)
	# fill: cool and dim from the right, so the shadow side keeps detail
	var fill := OmniLight3D.new()
	fill.light_color = Color(0.78, 0.86, 1.0)
	fill.light_energy = 0.75
	fill.omni_range = 8.0
	fill.position = Vector3(2.4, 1.4, 2.2)
	world.add_child(fill)
	# rims: two white lights behind, outlining the shoulders and hair against the backdrop
	for sx: float in [-1.0, 1.0]:
		var rim := SpotLight3D.new()
		rim.light_color = Color(1.0, 0.98, 0.95)
		rim.light_energy = 3.2
		rim.spot_range = 6.0
		rim.spot_angle = 30.0
		rim.position = Vector3(sx * 1.6, 2.4, -1.8)
		world.add_child(rim)
		rim.look_at(Vector3(0, 1.2, 0))
	# a hair light from above
	var top := SpotLight3D.new()
	top.light_energy = 1.4
	top.spot_range = 4.0
	top.spot_angle = 22.0
	top.position = Vector3(0, 3.4, -0.4)
	world.add_child(top)
	top.look_at(Vector3(0, 1.6, 0))
	rig = Rig.new()
	world.add_child(rig)
	cam = Camera3D.new()
	cam.fov = 30
	cam.current = true
	if hi:
		var ca := CameraAttributesPractical.new()
		ca.dof_blur_far_enabled = true
		ca.dof_blur_far_distance = 4.5
		ca.dof_blur_far_transition = 3.0
		ca.dof_blur_amount = 0.06
		cam.attributes = ca
	world.add_child(cam)

## the studio's sweep: a flat floor in front that bends up into a wall behind (radius 2.5 m), 14 m wide
func _cyclorama() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var prof: Array[Vector2] = []           # (z, y) along the sweep, front to back
	prof.append(Vector2(8.0, 0.0))
	prof.append(Vector2(-2.0, 0.0))
	for k in range(1, 13):
		var a := float(k) / 12.0 * PI * 0.5
		prof.append(Vector2(-2.0 - sin(a) * 2.5, 2.5 - cos(a) * 2.5))
	prof.append(Vector2(-4.5, 9.0))
	for i in prof.size() - 1:
		var p0: Vector2 = prof[i]
		var p1: Vector2 = prof[i + 1]
		var n0 := Vector3(0, p1.x - p0.x, -(p1.y - p0.y)).normalized() * -1.0
		for q in [[-7.0, p0], [7.0, p1], [7.0, p0], [-7.0, p0], [-7.0, p1], [7.0, p1]]:
			var pp: Vector2 = q[1]
			st.set_normal(Vector3(0, absf(n0.y), absf(n0.z)))
			st.add_vertex(Vector3(q[0], pp.y, pp.x))
	return st.commit()

## the view: the whole body, the outfit at three-quarters, or the face, then the player's zoom and height on top
func _frame_camera() -> void:
	var face := tab in FACE_TABS
	var hp: Vector3 = rig.head_world() if rig else Vector3(0, 1.6, 0)
	var tall: float = rig.head_point.y if rig else 1.7
	# full length with room above the head and for the view buttons under the feet; the outfit a little closer
	var base_d := 1.0 if face else (3.9 if tab == "OUTFIT" else 4.5)
	var close_d := 0.55 if face else 1.2
	var dist := lerpf(base_d, close_d, _zoom)
	var aim_y := hp.y + 0.04 if face else lerpf(tall * 0.5, hp.y - 0.1, _zoom * 0.7)
	aim_y = clampf(aim_y + _pan, 0.25, hp.y + 0.15)
	var target := Vector3(0, aim_y, 0)
	_cam_target = target if _cam_target == Vector3.ZERO else _cam_target.lerp(target, 0.12)
	var want := _cam_target + Vector3(0, 0.02 if face else 0.12, dist)
	cam.position = want if cam.position == Vector3.ZERO else cam.position.lerp(want, 0.15)
	cam.look_at(_cam_target)

func _process(delta: float) -> void:
	_since += delta
	if _dirty and _since > 0.12:
		_dirty = false
		_since = 0.0
		_rebuild()
	if rig:
		turn += _spin * delta * 1.6
		_shown_turn = lerp_angle(_shown_turn, turn, minf(1.0, delta * 10.0))
		rig.rotation.y = _shown_turn
	_frame_camera()

func _stage_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_drag = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom = clampf(_zoom + 0.08, 0.0, 1.0)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom = clampf(_zoom - 0.08, 0.0, 1.0)
	elif e is InputEventMagnifyGesture:
		_zoom = clampf(_zoom + ((e as InputEventMagnifyGesture).factor - 1.0) * 0.8, 0.0, 1.0)
	elif e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed:
			_touches[t.index] = t.position
		else:
			_touches.erase(t.index)
		_pinch = 0.0
		_drag = _touches.size() == 1
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		_touches[d.index] = d.position
		if _touches.size() >= 2:
			# two fingers: pinch to zoom
			var ks := _touches.keys()
			var gap: float = (_touches[ks[0]] as Vector2).distance_to(_touches[ks[1]])
			if _pinch > 0.0:
				_zoom = clampf(_zoom + (gap - _pinch) * 0.004, 0.0, 1.0)
			_pinch = gap
		else:
			_drag_by(d.relative)
	elif e is InputEventMouseMotion and _drag:
		_drag_by((e as InputEventMouseMotion).relative)

## a drag: sideways turns the character, up and down moves the view along the body
func _drag_by(rel: Vector2) -> void:
	turn += rel.x * 0.012
	_pan = clampf(_pan + rel.y * 0.003, -1.2, 0.4)

func _view_button(what: String) -> void:
	if what == "in":
		_zoom = clampf(_zoom + 0.25, 0.0, 1.0)
	elif what == "out":
		_zoom = clampf(_zoom - 0.25, 0.0, 1.0)
	else:
		_zoom = 0.0
		_pan = 0.0
		turn = START_TURN

## the view buttons over the stage: turn left / right, zoom in / out, and back to the tab's framing
func _view_buttons(svc: Control) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	row.offset_top = -64
	row.offset_bottom = -14
	row.offset_right = -460            # over the stage, left of the panel
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	svc.add_child(row)
	for spec in [["⟲", "turn_l"], ["⟳", "turn_r"], ["−", "out"], ["+", "in"], ["RESET", "reset"]]:
		var b := Data.button(spec[0])
		b.custom_minimum_size = Vector2(64 if spec[1] == "reset" else 50, 46)
		b.add_theme_font_size_override("font_size", 20 if spec[1] != "reset" else 13)
		var what: String = spec[1]
		if what in ["turn_l", "turn_r"]:
			# held to keep turning
			b.button_down.connect(func() -> void: _spin = -1.0 if what == "turn_l" else 1.0)
			b.button_up.connect(func() -> void: _spin = 0.0)
		else:
			b.pressed.connect(_view_button.bind(what))
		row.add_child(b)

func _rebuild() -> void:
	# the person in their own clothes (urban streetwear): no armour, no helmet
	var shown: Dictionary = Wardrobe.civ(look)
	rig.build(shown)

func _changed(rebuild_panel := false) -> void:
	_dirty = true
	if rebuild_panel:
		_fill()

func _set_tab(t: String) -> void:
	tab = t
	_zoom = 0.0
	_pan = 0.0
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
			for it: Dictionary in Wardrobe.ITEMS:
				if it.kind != "outfit":
					continue
				var oid: String = it.id
				if Wardrobe.owns(look, oid):
					_choice(go, Wardrobe.item_name(it), String(look.get("outfit", "")) == oid, func() -> void:
						look.outfit = oid
						_changed(true))
				else:
					# sold in the city's clothing stores (scripts/city/clothing_store.gd)
					var b := _choice(go, "🔒 %s" % Wardrobe.item_name(it), false, func() -> void: pass,
						"%d Nex at %s" % [int(it.price), String(Wardrobe.STORES[String(it.stores[0])].name)])
					b.disabled = true
			var hint := Label.new()
			hint.text = "More outfits, headwear, eyewear and jewellery at Nova Threads and Lumen Luxe in the Galleria, and Block Supply on the avenue."
			hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			hint.add_theme_font_size_override("font_size", 12)
			hint.modulate = Color(0.7, 0.85, 0.95)
			go.get_parent().add_child(hint)
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

