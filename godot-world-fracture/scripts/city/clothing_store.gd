extends Control
## A clothing store's dressing room (owner, Nov 11: "make clothing stores so user can buy stuff"): the operator on a lit
## plinth in their own clothes, the store's racks by kind (outfits, headwear, eyewear, jewellery & bags). Tap anything to
## try it on; BUY pays Nex from the profile and puts it on, WEAR / TAKE OFF changes what you have on. What the stores sell
## and what you own: scripts/character/wardrobe.gd. Emits `changed` after a purchase (the scene saves the profile) and
## `look_changed` when what the operator wears changed (the look is already saved; the scene re-dresses the operator).

signal closed
signal changed
signal look_changed

const Wardrobe := preload("res://scripts/character/wardrobe.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Rig := preload("res://scripts/character/character_rig.gd")
const Data := preload("res://scripts/data.gd")
const Phone := preload("res://scripts/phone.gd")

var store := "nova"
var profile: Dictionary = {}
var back_label := "← BACK"

var look: Dictionary
var _kind := "outfit"
var _sel := ""
var _turn := 0.4
var _drag := false
var _view: SubViewportContainer
var _panel: PanelContainer
var _rig: Node3D
var _turntable: Node3D
var _cam: Camera3D
var _nex: Label
var _tabs: HFlowContainer
var _grid: GridContainer
var _act: Button
var _line: Label
var _sel_name: Label

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	look = Store.load_look() if Store.exists() else Store.default_look()
	var info: Dictionary = Wardrobe.STORES.get(store, Wardrobe.STORES.nova)
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.035, 0.05)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# the dressing room
	_view = SubViewportContainer.new()
	_view.stretch = true
	add_child(_view)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	Phone.fit_viewport(vp)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_view.add_child(vp)
	_room(vp, info.color)
	_view.gui_input.connect(_on_view_input)
	# the racks
	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", Data.box(Color(0.03, 0.08, 0.12, 0.96), Data.RULE, 0, 1))
	add_child(_panel)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_panel.add_child(scroll)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 8)
	scroll.add_child(col)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	col.add_child(head)
	var back := Data.button(back_label)
	back.custom_minimum_size = Vector2(96, 42)
	back.pressed.connect(func(): closed.emit())
	head.add_child(back)
	var title := Data.label(String(info.name), 22, info.color)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(title)
	_nex = Data.label("", 17, Data.GOLD)
	head.add_child(_nex)
	var sub := Data.label(String(info.line), 13, Data.MUTED)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(sub)
	_tabs = HFlowContainer.new()
	_tabs.add_theme_constant_override("h_separation", 6)
	_tabs.add_theme_constant_override("v_separation", 6)
	col.add_child(_tabs)
	_grid = GridContainer.new()
	_grid.columns = 2
	_grid.add_theme_constant_override("h_separation", 6)
	_grid.add_theme_constant_override("v_separation", 6)
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_child(_grid)
	_sel_name = Data.label("", 15, Data.TEXT)
	col.add_child(_sel_name)
	_act = Data.button("", true)
	_act.custom_minimum_size = Vector2(0, 50)
	_act.add_theme_font_size_override("font_size", 17)
	_act.pressed.connect(_act_pressed)
	col.add_child(_act)
	_line = Data.label("", 13, Color(0.6, 1.0, 0.85))
	_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_line)
	if String(look.get("body", "male")) == "robot":
		_line.text = "Robot frames don't wear clothes."
	resized.connect(_layout)
	_layout()
	_kind = "outfit"
	_sel = String(look.get("outfit", ""))
	_refresh()
	_dress()

## landscape: the plinth on the left, the racks on the right; held upright, the plinth above the racks
func _layout() -> void:
	var w := size.x
	var h := size.y
	if h > w:
		_view.position = Vector2.ZERO
		_view.size = Vector2(w, h * 0.46)
		_panel.position = Vector2(0, h * 0.46)
		_panel.size = Vector2(w, h * 0.54)
	else:
		_view.position = Vector2.ZERO
		_view.size = Vector2(w * 0.44, h)
		_panel.position = Vector2(w * 0.44, 0)
		_panel.size = Vector2(w * 0.56, h)
	if _grid:
		_grid.columns = 2 if _panel.size.x < 900 else 3

func _room(vp: SubViewport, accent: Color) -> void:
	var world := Node3D.new()
	vp.add_child(world)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.05, 0.055, 0.07)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.57, 0.62)
	e.ambient_light_energy = 0.55
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	world.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation = Vector3(-0.55, 0.45, 0)
	key.light_energy = 1.3
	world.add_child(key)
	var rim := OmniLight3D.new()
	rim.position = Vector3(-1.2, 2.4, -1.4)
	rim.light_color = accent
	rim.light_energy = 2.5
	rim.omni_range = 5.0
	world.add_child(rim)
	# the plinth with a lit ring, a mirror wall and two clothes rails behind
	var plinth := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 0.75
	pm.bottom_radius = 0.8
	pm.height = 0.1
	plinth.mesh = pm
	plinth.position.y = -0.05
	plinth.material_override = _mat(Color(0.12, 0.12, 0.14), 0.35, 0.4)
	world.add_child(plinth)
	var ring := MeshInstance3D.new()
	var rm := TorusMesh.new()
	rm.inner_radius = 0.76
	rm.outer_radius = 0.8
	ring.mesh = rm
	ring.position.y = 0.0
	var glow := _mat(accent, 0.3, 0.0)
	glow.emission_enabled = true
	glow.emission = accent
	glow.emission_energy_multiplier = 2.0
	ring.material_override = glow
	world.add_child(ring)
	var floor_m := MeshInstance3D.new()
	var fm := PlaneMesh.new()
	fm.size = Vector2(12, 12)
	floor_m.mesh = fm
	floor_m.position.y = -0.1
	floor_m.material_override = _mat(Color(0.16, 0.15, 0.15), 0.6, 0.0)
	world.add_child(floor_m)
	var wall := MeshInstance3D.new()
	var wm := BoxMesh.new()
	wm.size = Vector3(8, 4, 0.1)
	wall.mesh = wm
	wall.position = Vector3(0, 1.9, -2.6)
	wall.material_override = _mat(Color(0.22, 0.21, 0.22), 0.8, 0.0)
	world.add_child(wall)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(store)
	for sx in [-1.0, 1.0]:
		var bar := MeshInstance3D.new()
		var bm := CylinderMesh.new()
		bm.top_radius = 0.015
		bm.bottom_radius = 0.015
		bm.height = 1.6
		bar.mesh = bm
		bar.rotation.z = PI * 0.5
		bar.position = Vector3(sx * 2.0, 1.75, -2.2)
		bar.material_override = _mat(Color(0.8, 0.8, 0.82), 0.25, 1.0)
		world.add_child(bar)
		for j in 7:
			# folded garments hanging on the rail, each its own colour
			var g := MeshInstance3D.new()
			var gm := BoxMesh.new()
			gm.size = Vector3(0.06, 0.75, 0.45)
			g.mesh = gm
			g.position = Vector3(sx * 2.0 - 0.65 + j * 0.21, 1.33, -2.2)
			g.material_override = _mat(Color.from_hsv(rng.randf(), rng.randf_range(0.2, 0.7), rng.randf_range(0.25, 0.9)), 0.9, 0.0)
			world.add_child(g)
	_turntable = Node3D.new()
	world.add_child(_turntable)
	_cam = Camera3D.new()
	_cam.fov = 38.0
	world.add_child(_cam)
	_cam.current = true
	_cam.position = Vector3(0, 1.05, 4.3)
	_cam.look_at(Vector3(0, 0.92, 0))

static func _mat(c: Color, rough: float, metal: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m

func _on_view_input(e: InputEvent) -> void:
	if e is InputEventScreenDrag:
		_turn += (e as InputEventScreenDrag).relative.x * 0.01
	elif e is InputEventMouseButton:
		_drag = (e as InputEventMouseButton).pressed
	elif e is InputEventMouseMotion and _drag:
		_turn += (e as InputEventMouseMotion).relative.x * 0.01

func _process(dt: float) -> void:
	if _turntable:
		if not _drag:
			_turn += dt * 0.15
		_turntable.rotation.y = _turn

## the operator in what they have on, with the selected item tried on over it
func _dress() -> void:
	if String(look.get("body", "male")) == "robot":
		return
	var trial: Dictionary = look.duplicate(true)
	if _sel != "" and not Wardrobe.wearing(look, _sel):
		Wardrobe.put_on(trial, _sel, false)
	if _rig:
		_rig.queue_free()
	_rig = Rig.new()
	_turntable.add_child(_rig)
	_rig.build(Wardrobe.civ(trial))
	# frame the whole body, whatever its height
	var h: float = maxf(_rig.head_point.y, 1.2) + 0.25
	_cam.position = Vector3(0, h * 0.56, h * 2.6)
	_cam.look_at(Vector3(0, h * 0.5, 0))

func _refresh() -> void:
	_nex.text = "%d Nex" % int(profile.get("nex", 0))
	for c in _tabs.get_children():
		c.queue_free()
	for k: String in Wardrobe.KINDS:
		if Wardrobe.stock(store, k).is_empty():
			continue
		var kk := k
		var t := Data.button(String(Wardrobe.KIND_NAME[k]), k == _kind)
		t.custom_minimum_size = Vector2(0, 38)
		if k == _kind:
			t.add_theme_stylebox_override("normal", Data.box(Color("#1d5370"), Data.GOLD, 7, 2))
		t.pressed.connect(func():
			_kind = kk
			_sel = ""
			_refresh()
			_dress())
		_tabs.add_child(t)
	for c in _grid.get_children():
		c.queue_free()
	for it: Dictionary in Wardrobe.stock(store, _kind):
		var id: String = it.id
		var owned := Wardrobe.owns(look, id)
		var on := Wardrobe.wearing(look, id)
		var tag := "WEARING" if on else ("OWNED" if owned else "%d Nex" % int(it.price))
		var b := Data.button("%s\n%s" % [Wardrobe.item_name(it), tag], id == _sel)
		b.custom_minimum_size = Vector2(0, 56)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 13)
		if id == _sel:
			b.add_theme_stylebox_override("normal", Data.box(Color("#1d5370"), Data.GOLD, 7, 2))
		elif on:
			b.modulate = Color(0.65, 1.0, 0.85)
		b.pressed.connect(func():
			_sel = id
			_line.text = ""
			_refresh()
			_dress())
		_grid.add_child(b)
	_update_action()

func _update_action() -> void:
	var it := Wardrobe.item(_sel)
	_act.visible = not it.is_empty() and String(look.get("body", "male")) != "robot"
	_sel_name.visible = _act.visible
	if it.is_empty():
		return
	_sel_name.text = "Trying on: %s" % Wardrobe.item_name(it)
	_act.disabled = false
	if not Wardrobe.owns(look, _sel):
		var nex := int(profile.get("nex", 0))
		if nex >= int(it.price):
			_act.text = "BUY · %d Nex" % int(it.price)
		else:
			_act.text = "NEED %d MORE NEX" % (int(it.price) - nex)
			_act.disabled = true
	elif not Wardrobe.wearing(look, _sel):
		_act.text = "WEAR"
	elif it.kind == "outfit":
		_act.text = "WEARING"
		_act.disabled = true
	else:
		_act.text = "TAKE OFF"

func _act_pressed() -> void:
	var it := Wardrobe.item(_sel)
	if it.is_empty():
		return
	if not Wardrobe.owns(look, _sel):
		_line.text = Wardrobe.buy(look, profile, _sel)
		Store.save_look(look)
		changed.emit()
	elif not Wardrobe.wearing(look, _sel):
		Wardrobe.put_on(look, _sel, false)
		Store.save_look(look)
		_line.text = "%s — on." % Wardrobe.item_name(it)
	else:
		Wardrobe.put_on(look, _sel, true)
		Store.save_look(look)
		_line.text = "%s — off." % Wardrobe.item_name(it)
	look = Store.clean(look)
	look_changed.emit()
	_refresh()
	_dress()
