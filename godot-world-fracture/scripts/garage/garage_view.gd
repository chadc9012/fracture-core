extends Control
## The garage (owner's Vehicle Garage design, Nov 2026): drive a car into one of four shops, look it over on the turntable,
## pick paint, body kit, wheels, performance, armour, lights and Fracture mods, see each change on the car and in the stat bars
## before paying, then buy the whole order (or repair the damage) at the shop's prices. Rules: catalog.gd, garage_order.gd,
## garage_state.gd; the parts on the car: garage_kit.gd.

signal closed

const Catalog := preload("res://scripts/garage/catalog.gd")
const State := preload("res://scripts/garage/garage_state.gd")
const Order := preload("res://scripts/garage/garage_order.gd")
const Kit := preload("res://scripts/garage/garage_kit.gd")

var state
var order
var shop_id := "nexus-customs"
var vehicle_i := 0
var group := "PAINT"

var _vp: SubViewport
var _world: Node3D
var _cam: Camera3D
var _turn: Node3D
var _car: Node3D
var _room: Node3D
var _yaw := 0.7
var _pitch := 17.0
var _dist := 7.2
var _drag := false
var _auto := true

var _split: BoxContainer
var _panel_node: Control
var _title: Label
var _credits: Label
var _shop_pick: OptionButton
var _car_name: Label
var _cond: Label
var _tabs: HBoxContainer
var _list: GridContainer
var _stats: VBoxContainer
var _order_box: VBoxContainer
var _total: Label
var _status: Label
var _buy: Button
var _repair: Button

func _ready() -> void:
	state = State.load_or_fresh()
	var bg := ColorRect.new()
	bg.color = Data.BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.add_theme_constant_override("separation", 0)
	add_child(col)
	col.add_child(_header())
	# landscape: the car large on the left, the customization panel on the right (owner's Nexus Customs sheets);
	# portrait (a phone held upright): the car above, the panel below
	_split = BoxContainer.new()
	_split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_split.add_theme_constant_override("separation", 0)
	col.add_child(_split)
	resized.connect(_layout)
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	svc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	svc.size_flags_stretch_ratio = 1.15
	svc.gui_input.connect(_input_3d)
	_split.add_child(svc)
	_vp = SubViewport.new()
	_vp.msaa_3d = Viewport.MSAA_4X
	_vp.own_world_3d = true
	svc.add_child(_vp)
	svc.add_child(_car_bar())
	_panel_node = _panel()
	_split.add_child(_panel_node)
	_layout()
	_world = Node3D.new()
	_vp.add_child(_world)
	_cam = Camera3D.new()
	_cam.fov = 40
	_world.add_child(_cam)
	_turn = Node3D.new()
	_world.add_child(_turn)
	_build_room()
	_enter_shop(shop_id)

# ------------------------------------------------------------------------------------------------ the shop
func _enter_shop(id: String) -> void:
	shop_id = id
	order = Order.new(shop_id, _vehicle().id)
	var sh := Catalog.shop(id)
	_title.text = sh.name.to_upper()
	_title.add_theme_color_override("font_color", Color(sh.accent))
	_build_room()
	var groups := []
	for g in Catalog.GROUPS:
		if Catalog.shop_slots(id, g).size() > 0:
			groups.append(g)
	if not (group in groups):
		group = groups[0]
	_load_car()
	_refresh()

func _vehicle() -> Dictionary:
	return Catalog.VEHICLES[vehicle_i]

func _switch_car(d: int) -> void:
	vehicle_i = posmod(vehicle_i + d, Catalog.VEHICLES.size())
	order = Order.new(shop_id, _vehicle().id)
	_load_car()
	_refresh()

func _load_car() -> void:
	if _car:
		_car.queue_free()
		_car = null
	var v := _vehicle()
	var scene: PackedScene = load(v.model)
	if scene == null:
		_status.text = "Couldn't load %s" % v.name
		return
	_car = scene.instantiate()
	_turn.add_child(_car)
	# fit the car on the turntable: its floor on the deck, centred
	_car.position = Vector3.ZERO
	var f := Kit.frame(_car)
	_car.position = Vector3(-f.c.x, 0.12 - f.floor, -f.c.z)
	var length: float = f.hl * 2.0
	_dist = clampf(length * 2.0, 6.0, 11.0)
	_apply_preview()

func _apply_preview() -> void:
	if _car:
		Kit.apply(_car, order.preview_parts(state), _vehicle().paint)

# ------------------------------------------------------------------------------------------------ the interior
func _build_room() -> void:
	if _room:
		_room.queue_free()
	_room = Node3D.new()
	_world.add_child(_room)
	var accent := Color(Catalog.shop(shop_id).get("accent", "#3fd0ff"))
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#07090c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#6a7486")
	env.ambient_light_energy = 1.1
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.1
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	_room.add_child(we)
	# polished concrete floor with painted bay lines; dark panelled walls; a lit ceiling grid
	var floor_m := StandardMaterial3D.new()
	floor_m.albedo_color = Color("#9a9ea4")
	floor_m.roughness = 0.22
	floor_m.metallic = 0.1
	floor_m.albedo_texture = _concrete_texture()
	floor_m.uv1_scale = Vector3(6, 6, 1)
	_slab(Vector3(34, 0.2, 34), Vector3(0, -0.1, 0), floor_m)
	var paint := _flat(Color("#e6b422"), 0.6)
	for x in [-3.4, 3.4]:
		_slab(Vector3(0.12, 0.01, 9.5), Vector3(x, 0.005, 0), paint)
	_slab(Vector3(6.92, 0.01, 0.12), Vector3(0, 0.005, -4.75), paint)
	var wall := StandardMaterial3D.new()
	wall.albedo_color = Color("#2b3038")
	wall.roughness = 0.6
	wall.metallic = 0.3
	_slab(Vector3(34, 9, 0.3), Vector3(0, 4.5, -13), wall)
	_slab(Vector3(0.3, 9, 34), Vector3(-14, 4.5, 0), wall)
	_slab(Vector3(0.3, 9, 34), Vector3(14, 4.5, 0), wall)
	var panel := StandardMaterial3D.new()
	panel.albedo_color = Color("#3a404a")
	panel.roughness = 0.45
	panel.metallic = 0.6
	for i in 7:  # wall panels with seams
		_slab(Vector3(3.3, 5.6, 0.08), Vector3(-10.0 + 2.0 + i * 3.4, 3.4, -12.82), panel)
	_slab(Vector3(34, 0.4, 34), Vector3(0, 8.2, 0), wall)
	# the front wall, with the roller door the cars drive in through
	_slab(Vector3(34, 9, 0.3), Vector3(0, 4.5, 13), wall)
	var door := StandardMaterial3D.new()
	door.albedo_color = Color("#5d636b")
	door.metallic = 0.7
	door.roughness = 0.4
	for k in 22:
		_slab(Vector3(7.6, 0.24, 0.06), Vector3(0, 0.15 + k * 0.27, 12.8), door)
	for x in [-3.95, 3.95]:
		_slab(Vector3(0.3, 6.2, 0.4), Vector3(x, 3.1, 12.8), panel)
	# neon: the shop's accent along the walls and a sign over the bay
	var neon := StandardMaterial3D.new()
	neon.albedo_color = accent
	neon.emission_enabled = true
	neon.emission = accent
	neon.emission_energy_multiplier = 4.0
	_slab(Vector3(20, 0.06, 0.06), Vector3(0, 6.3, -12.8), neon)
	_slab(Vector3(20, 0.06, 0.06), Vector3(0, 0.6, -12.8), neon)
	for x in [-13.8, 13.8]:
		_slab(Vector3(0.06, 0.06, 26), Vector3(x, 6.3, 0), neon)
	var sign := Label3D.new()
	sign.text = Catalog.shop(shop_id).name.to_upper()
	sign.font_size = 160
	sign.pixel_size = 0.006
	sign.modulate = accent.lightened(0.35)
	sign.outline_modulate = Color(accent, 0.6)
	sign.outline_size = 24
	sign.position = Vector3(0, 5.2, -12.7)
	_room.add_child(sign)
	var sub := Label3D.new()
	sub.text = Catalog.shop(shop_id).blurb.to_upper()
	sub.font_size = 54
	sub.pixel_size = 0.006
	sub.modulate = Color("#c9d6e2")
	sub.position = Vector3(0, 4.25, -12.7)
	_room.add_child(sub)
	# workshop dressing: tool chests, tyre stacks, a two-post lift, a parts shelf
	var red := StandardMaterial3D.new()
	red.albedo_color = Color("#a3191b")
	red.roughness = 0.3
	red.metallic = 0.4
	var dark := _flat(Color("#141619"), 0.5)
	for i in 3:
		_slab(Vector3(1.6, 1.1, 0.7), Vector3(-7.6 + i * 1.7, 0.55, -12.3), red)
		for d in 5:
			_slab(Vector3(1.5, 0.02, 0.02), Vector3(-7.6 + i * 1.7, 0.22 + d * 0.18, -11.94), dark)
	var rubber := _flat(Color("#111214"), 0.85)
	for s in 2:
		for k in 4:
			var t := MeshInstance3D.new()
			var tm := TorusMesh.new()
			tm.inner_radius = 0.22; tm.outer_radius = 0.36
			t.mesh = tm
			t.material_override = rubber
			t.position = Vector3(7.4 + s * 0.85, 0.12 + k * 0.26, -11.9)
			_room.add_child(t)
	var steel := StandardMaterial3D.new()
	steel.albedo_color = Color("#3d6fa8")
	steel.roughness = 0.35
	steel.metallic = 0.5
	for x in [6.2, 9.0]:
		_slab(Vector3(0.3, 4.2, 0.3), Vector3(x, 2.1, 3.5), steel)
	_slab(Vector3(3.1, 0.2, 0.3), Vector3(7.6, 4.1, 3.5), steel)
	for y in [0.9, 1.9, 2.9]:
		_slab(Vector3(3.0, 0.06, 0.6), Vector3(-8.6, y, 2.5), dark)
		for k in 4:
			_slab(Vector3(0.45, 0.35, 0.4), Vector3(-8.6 + (k - 1.5) * 0.7, y + 0.2, 2.5), _flat(Color.from_hsv(0.55 + k * 0.08, 0.25, 0.35), 0.6))
	# the turntable: a dark steel disc with a lit rim
	var deck := StandardMaterial3D.new()
	deck.albedo_color = Color("#22262c")
	deck.metallic = 0.85
	deck.roughness = 0.3
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 3.3; cm.bottom_radius = 3.35; cm.height = 0.12; cm.radial_segments = 96
	disc.mesh = cm
	disc.material_override = deck
	disc.position = Vector3(0, 0.06, 0)
	_room.add_child(disc)
	var ring := MeshInstance3D.new()
	var rm := TorusMesh.new()
	rm.inner_radius = 3.28; rm.outer_radius = 3.34; rm.rings = 96
	ring.mesh = rm
	ring.material_override = neon
	ring.position = Vector3(0, 0.12, 0)
	_room.add_child(ring)
	# light: a key from above front, a cool fill, strip lights overhead and the accent bouncing off the back wall
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-55, 30, 0)
	key.light_energy = 1.6
	key.light_color = Color("#fff3e4")
	key.shadow_enabled = true
	_room.add_child(key)
	for x in [-3.0, 0.0, 3.0]:
		_slab(Vector3(0.25, 0.06, 7.0), Vector3(x, 7.9, 0), _emit(Color("#f4f7ff"), 3.0))
		var sp := SpotLight3D.new()
		sp.position = Vector3(x, 7.7, 0)
		sp.rotation_degrees = Vector3(-90, 0, 0)
		sp.spot_range = 14
		sp.spot_angle = 50
		sp.light_energy = 6.0
		sp.light_color = Color("#eef3ff")
		_room.add_child(sp)
	for at in [Vector3(-5, 3, 5), Vector3(5, 3, 5), Vector3(0, 3, -7)]:  # soft fills round the bay
		var fl := OmniLight3D.new()
		fl.position = at
		fl.light_energy = 1.4
		fl.omni_range = 11
		fl.light_color = Color("#dfe8ff")
		_room.add_child(fl)
	var back := OmniLight3D.new()
	back.position = Vector3(0, 3.5, -11.5)
	back.light_color = accent
	back.light_energy = 2.5
	back.omni_range = 9
	_room.add_child(back)
	# a reflection probe so the paint and chrome pick up the room
	var probe := ReflectionProbe.new()
	probe.size = Vector3(27, 8.5, 27)
	probe.position = Vector3(0, 2.0, 0)
	probe.update_mode = ReflectionProbe.UPDATE_ONCE
	probe.intensity = 1.0
	probe.box_projection = true
	_room.add_child(probe)

func _slab(size: Vector3, at: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	_room.add_child(mi)
	return mi

func _flat(c: Color, rough: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m

func _emit(c: Color, e: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = e
	return m

## a mottled, lightly scuffed concrete (noise, made once)
func _concrete_texture() -> Texture2D:
	var n := FastNoiseLite.new()
	n.frequency = 0.02
	n.fractal_octaves = 5
	var t := NoiseTexture2D.new()
	t.width = 512
	t.height = 512
	t.seamless = true
	t.noise = n
	var g := Gradient.new()
	g.set_color(0, Color("#8a8d92"))
	g.set_color(1, Color("#c3c5c8"))
	t.color_ramp = g
	return t

# ------------------------------------------------------------------------------------------------ camera
func _process(delta: float) -> void:
	if _auto and not _drag:
		_yaw += delta * 0.18
	var p := deg_to_rad(_pitch)
	var target := Vector3(0, 0.55, 0)
	_cam.position = target + Vector3(sin(_yaw) * cos(p), sin(p), cos(_yaw) * cos(p)) * _dist
	_cam.look_at(target)

func _input_3d(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_drag = mb.pressed
			_auto = false
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_dist = maxf(3.0, _dist * 0.9)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_dist = minf(12.0, _dist * 1.1)
	elif e is InputEventMouseMotion and _drag:
		var mm := e as InputEventMouseMotion
		_yaw -= mm.relative.x * 0.008
		_pitch = clampf(_pitch + mm.relative.y * 0.2, 2.0, 60.0)
	elif e is InputEventScreenDrag:
		var sd := e as InputEventScreenDrag
		_auto = false
		_yaw -= sd.relative.x * 0.008
		_pitch = clampf(_pitch + sd.relative.y * 0.2, 2.0, 60.0)

# ------------------------------------------------------------------------------------------------ UI
func _header() -> Control:
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", Data.box(Data.BG, Data.RULE, 0))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 10)
	head.add_child(hb)
	var back := Data.button("← EXIT")
	back.pressed.connect(func(): closed.emit())
	hb.add_child(back)
	_title = Data.label("", 20)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(_title)
	_shop_pick = OptionButton.new()
	for s in Catalog.SHOPS:
		_shop_pick.add_item(s.name)
	_shop_pick.item_selected.connect(func(i): _enter_shop(Catalog.SHOPS[i].id))
	hb.add_child(_shop_pick)
	_credits = Data.label("", 18, Data.GOLD)
	hb.add_child(_credits)
	return head

func _car_bar() -> Control:
	var bar := HBoxContainer.new()
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 12
	bar.offset_right = -12
	bar.offset_top = 10
	var prev := Data.button("◀")
	prev.pressed.connect(func(): _switch_car(-1))
	bar.add_child(prev)
	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_car_name = Data.label("", 18)
	_car_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid.add_child(_car_name)
	_cond = Data.label("", 13, Data.MUTED)
	_cond.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mid.add_child(_cond)
	bar.add_child(mid)
	var next := Data.button("▶")
	next.pressed.connect(func(): _switch_car(1))
	bar.add_child(next)
	return bar

func _panel() -> Control:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", Data.box(Data.PANEL, Data.RULE, 0))
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	panel.add_child(v)
	var ts := ScrollContainer.new()
	ts.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	ts.custom_minimum_size = Vector2(0, 46)
	_tabs = HBoxContainer.new()
	_tabs.add_theme_constant_override("separation", 6)
	ts.add_child(_tabs)
	v.add_child(ts)
	var ls := ScrollContainer.new()
	ls.size_flags_vertical = Control.SIZE_EXPAND_FILL
	ls.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_list = GridContainer.new()
	_list.columns = 3
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("h_separation", 6)
	_list.add_theme_constant_override("v_separation", 6)
	ls.add_child(_list)
	v.add_child(ls)
	# under the parts: the stat bars (now vs with the order) beside the order and its total
	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", 14)
	v.add_child(foot)
	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.add_child(Data.label("PERFORMANCE", 13, Data.CYAN))
	_stats = VBoxContainer.new()
	left.add_child(_stats)
	foot.add_child(left)
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 4)
	foot.add_child(right)
	right.add_child(Data.label("ORDER", 13, Data.CYAN))
	var os := ScrollContainer.new()
	os.custom_minimum_size = Vector2(0, 104)
	os.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_order_box = VBoxContainer.new()
	_order_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	os.add_child(_order_box)
	right.add_child(os)
	_total = Data.label("", 18, Data.GOLD)
	right.add_child(_total)
	var btns := HBoxContainer.new()
	btns.add_theme_constant_override("separation", 6)
	_repair = Data.button("REPAIR")
	_repair.pressed.connect(_toggle_repair)
	btns.add_child(_repair)
	var clear := Data.button("CLEAR")
	clear.pressed.connect(func():
		order = Order.new(shop_id, _vehicle().id)
		_apply_preview()
		_refresh())
	btns.add_child(clear)
	_buy = Data.button("BUY", true)
	_buy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_buy.pressed.connect(_checkout)
	btns.add_child(_buy)
	right.add_child(btns)
	_status = Data.label("", 13, Data.MUTED)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	right.add_child(_status)
	return panel

func _layout() -> void:
	if _split == null:
		return
	var wide := size.x > size.y * 1.1
	_split.vertical = not wide
	_panel_node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_panel_node.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_panel_node.size_flags_stretch_ratio = 0.8 if wide else 1.0
	_list.columns = 3 if (size.x * (0.44 if wide else 1.0)) > 470 else 2

func _refresh() -> void:
	var v := _vehicle()
	var car: Dictionary = state.car(v.id)
	_credits.text = "₵ %s" % Order._money(int(state.credits))
	_car_name.text = v.name.to_upper()
	var rep := int(state.rep.get(shop_id, 0))
	_cond.text = "Condition %d%%  ·  %s  ·  Standing here: %s" % [100 - int(car.get("damage", 0)), Order._cls_label(v.cls).capitalize(), "★".repeat(rep) + "☆".repeat(3 - rep)]
	_shop_pick.select(Catalog.SHOPS.find(Catalog.shop(shop_id)))
	# tabs
	_clear(_tabs)
	for g in Catalog.GROUPS:
		if Catalog.shop_slots(shop_id, g).is_empty():
			continue
		var b := Data.button(g, g == group)
		b.pressed.connect(func():
			group = g
			_refresh())
		_tabs.add_child(b)
	# items in this group, by slot
	_clear(_list)
	if group == "BODY KIT":
		_list.add_child(Data.label("KIT PRESETS", 12, Data.MUTED))
		_pad_row()
		for p in Catalog.PRESETS:
			var pb := Data.button("%s\n%s" % [p.name, p.blurb], true)
			pb.custom_minimum_size = Vector2(0, 58)
			pb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			pb.pressed.connect(func():
				var n: int = order.add_preset(state, p.id)
				_status.text = "%s: %d parts added to the order" % [p.name.capitalize(), n] if n > 0 else "Nothing in that kit fits this car here"
				_status.add_theme_color_override("font_color", Data.MUTED)
				_apply_preview()
				_refresh())
			_list.add_child(pb)
	for slot in Catalog.shop_slots(shop_id, group):
		_pad_row()
		var head := Data.label(Catalog.SLOTS[slot][1].to_upper(), 12, Data.MUTED)
		_list.add_child(head)
		_pad_row()
		for it in Catalog.items_for_slot(slot):
			_list.add_child(_item_button(it))
	# stats: what the car has now vs with the order fitted
	_clear(_stats)
	var now: Dictionary = Catalog.stats_with(v.id, state.installed(v.id))
	var then: Dictionary = Catalog.stats_with(v.id, order.preview_parts(state))
	for k in [["speed", "Top speed"], ["accel", "Acceleration"], ["handling", "Handling"], ["armor", "Armour"]]:
		_stats.add_child(_stat_bar(k[1], int(now.get(k[0], 0)), int(then.get(k[0], 0))))
	# order lines
	_clear(_order_box)
	for slot in order.lines:
		var it := Catalog.item(order.lines[slot])
		var row := HBoxContainer.new()
		var nl := Data.label(it.name, 13)
		nl.clip_text = true
		nl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(nl)
		row.add_child(Data.label("₵ %s" % Order._money(order.price_of(it.id)), 13, Data.GOLD))
		var x := Data.button("✕")
		x.custom_minimum_size = Vector2(30, 26)
		x.add_theme_font_size_override("font_size", 11)
		x.pressed.connect(func():
			order.remove_slot(slot)
			_apply_preview()
			_refresh())
		row.add_child(x)
		_order_box.add_child(row)
	if order.repair:
		_order_box.add_child(Data.label("Repair %d%% damage: ₵ %s" % [int(car.damage), Order._money(order.repair_price(state))], 13))
	if order.is_empty():
		_order_box.add_child(Data.label("Pick parts to preview them on the car.", 13, Data.MUTED))
	_total.text = "TOTAL  ₵ %s" % Order._money(order.total(state))
	_buy.disabled = order.is_empty()
	var can_fix: bool = Catalog.shop(shop_id).get("repairs", false) and int(car.get("damage", 0)) > 0
	_repair.disabled = not can_fix
	_repair.text = ("REPAIR ✓" if order.repair else "REPAIR ₵ %s" % Order._money(order.repair_price(state))) if can_fix else "REPAIR"

## empty a container now (a queue_free'd child still counts until the frame ends, which shifted the grid)
func _clear(box: Node) -> void:
	for c in box.get_children():
		box.remove_child(c)
		c.queue_free()

## fill out the grid's current row (section headers start on a fresh row)
func _pad_row() -> void:
	while _list.get_child_count() % _list.columns != 0:
		_list.add_child(Control.new())

func _item_button(it: Dictionary) -> Button:
	var why: String = order.block_reason(state, it.id)
	var picked: bool = order.lines.get(it.slot, "") == it.id
	var fitted: bool = state.installed(_vehicle().id).get(it.slot, "") == it.id
	var price: int = order.price_of(it.id)
	var b := Data.button("%s\n%s" % [it.name, "FITTED" if fitted else ("₵ %s" % Order._money(price) if why == "" else "🔒 " + why.replace("Needs reputation", "Standing").replace(" here", ""))], picked)
	b.custom_minimum_size = Vector2(0, 56)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 13)
	b.disabled = why != "" and not fitted
	b.clip_text = true
	if it.slot == "paint":  # a swatch on the button
		var sw := ColorRect.new()
		sw.color = Color(it.look.color)
		sw.custom_minimum_size = Vector2(14, 14)
		sw.position = Vector2(6, 6)
		sw.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(sw)
	b.pressed.connect(func():
		if picked:
			order.remove_slot(it.slot)
		elif not fitted:
			order.add(state, it.id)
		_apply_preview()
		_refresh())
	return b

func _stat_bar(label: String, now: int, then: int) -> Control:
	var row := HBoxContainer.new()
	var l := Data.label(label, 12, Data.MUTED)
	l.custom_minimum_size = Vector2(96, 0)
	row.add_child(l)
	var bar := Control.new()
	bar.custom_minimum_size = Vector2(0, 14)
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.draw.connect(func():
		var w := bar.size.x
		bar.draw_rect(Rect2(0, 3, w, 8), Color("#0a1824"))
		bar.draw_rect(Rect2(0, 3, w * minf(now, then) / 100.0, 8), Color("#8ce9ff"))
		if then > now:
			bar.draw_rect(Rect2(w * now / 100.0, 3, w * (then - now) / 100.0, 8), Color("#7dff8a"))
		elif then < now:
			bar.draw_rect(Rect2(w * then / 100.0, 3, w * (now - then) / 100.0, 8), Color("#ff6a5a")))
	row.add_child(bar)
	var d := then - now
	row.add_child(Data.label(("%d" % then) + ("  +%d" % d if d > 0 else ("  %d" % d if d < 0 else "")), 12, Color("#7dff8a") if d > 0 else (Color("#ff6a5a") if d < 0 else Data.TEXT)))
	return row

func _toggle_repair() -> void:
	order.set_repair(state, not order.repair)
	_refresh()

func _checkout() -> void:
	var why: String = order.checkout(state)
	if why != "":
		_status.text = why
		_status.add_theme_color_override("font_color", Color("#ff8a7a"))
		return
	state.save()
	_status.text = "Done. The work's fitted and paid for."
	_status.add_theme_color_override("font_color", Color("#7dff8a"))
	_apply_preview()
	_refresh()

## for the screenshot hook and tests: put items in the order as if tapped
func pick(ids: Array) -> void:
	for id in ids:
		if String(id).begins_with("kit-"):
			order.add_preset(state, String(id).substr(4))
		else:
			order.add(state, id)
	_apply_preview()
	_refresh()

func show_car(id: String) -> void:
	for i in Catalog.VEHICLES.size():
		if Catalog.VEHICLES[i].id == id:
			vehicle_i = i
	order = Order.new(shop_id, _vehicle().id)
	_load_car()
	_refresh()
