extends Control
## The Aviation Hangar and the Military Motor Pool (owner's "Three Vehicle Facilities" V3/V4, Nov 15): the facility's
## vehicles as cards, the picked one on a lit pad (its real model, turning; drag to orbit), and the facility's five upgrades
## with their level (three each) and the next level's price in Nex. Only vehicles you own take work: aircraft in one of
## your airport hangars, military vehicles bought at the dealership. Rules and effects: facility.gd; the wallet: wallet.gd.
## Opened from the airport hangar (AVIATION HANGAR) and the street's motor pool door. Emits `closed`.

signal closed

const Phone := preload("res://scripts/phone.gd")
const Facility := preload("res://scripts/garage/facility.gd")
const State := preload("res://scripts/garage/garage_state.gd")
const Wallet := preload("res://scripts/garage/wallet.gd")
const Dealer := preload("res://scripts/garage/dealership.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Kit := preload("res://scripts/garage/garage_kit.gd")
const Sound := preload("res://scripts/audio/sound.gd")

var fac := "aviation"
var state            # garage_state.gd; set before adding to skip the save (tests)
var profile: Dictionary = {}
## write the garage save and the wallet back after a purchase (off in the headless tests)
var persist := true
var pick := ""

var _vp: SubViewport
var _world: Node3D
var _cam: Camera3D
var _turn: Node3D
var _model: Node3D
var _yaw := 0.7
var _dist := 10.0
var _look_y := 0.8
var _split: BoxContainer
var _side: Control
var _cards: GridContainer
var _name: Label
var _sub: Label
var _rows: VBoxContainer
var _status: Label
var _nex: Label
var _nomodel: Label

func _ready() -> void:
	if state == null:
		state = State.load_or_fresh()
		Wallet.open(state)
	if profile.is_empty():
		profile = Gear.profile_load()
	var accent := Color(String(Facility.FACILITIES[fac].accent))
	var bg := ColorRect.new()
	bg.color = Color("#06080d")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.add_theme_constant_override("separation", 0)
	add_child(col)
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", Data.box(Color("#0b0e16"), accent, 0))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	head.add_child(hb)
	var back := Data.button("← BACK")
	back.pressed.connect(func(): closed.emit())
	hb.add_child(back)
	var t := Data.label(String(Facility.FACILITIES[fac].name), 22, accent.lightened(0.3))
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(t)
	_nex = Data.label("", 18, Data.GOLD)
	hb.add_child(_nex)
	col.add_child(head)
	_split = BoxContainer.new()
	_split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(_split)
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	svc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	svc.size_flags_stretch_ratio = 1.15
	svc.gui_input.connect(_drag)
	_split.add_child(svc)
	_vp = SubViewport.new()
	Phone.fit_viewport(_vp)
	_vp.own_world_3d = true
	svc.add_child(_vp)
	_nomodel = Data.label("", 16, Data.MUTED)
	_nomodel.set_anchors_preset(Control.PRESET_CENTER)
	svc.add_child(_nomodel)
	_side = _panel()
	_split.add_child(_side)
	resized.connect(_layout)
	_layout()
	_stage(accent)
	var list := Facility.vehicles(fac)
	# open on the first one you own
	for v in list:
		if Facility.owned(fac, String(v.id), profile):
			pick = String(v.id)
			break
	if pick == "" and not list.is_empty():
		pick = String(list[0].id)
	show_vehicle(pick)

func _panel() -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Data.box(Data.PANEL, Data.RULE, 0))
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	p.add_child(sc)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 8)
	sc.add_child(v)
	_name = Data.label("", 22)
	v.add_child(_name)
	_sub = Data.label("", 13, Data.MUTED)
	_sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_sub)
	_rows = VBoxContainer.new()
	_rows.add_theme_constant_override("separation", 6)
	v.add_child(_rows)
	_status = Data.label("", 14, Color(0.6, 0.9, 1.0))
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_status)
	v.add_child(Data.label("VEHICLES", 13, Data.MUTED))
	_cards = GridContainer.new()
	_cards.columns = 2
	_cards.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cards.add_theme_constant_override("h_separation", 6)
	_cards.add_theme_constant_override("v_separation", 6)
	v.add_child(_cards)
	return p

func _layout() -> void:
	if _split == null:
		return
	var wide := size.x > size.y * 1.1
	_split.vertical = not wide
	_side.size_flags_stretch_ratio = 0.95 if wide else 1.0

## the pad: a hangar floor with its markings in the facility's colour, a key and a rim light
func _stage(accent: Color) -> void:
	_world = Node3D.new()
	_vp.add_child(_world)
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.22, 0.26, 0.34)
	sm.sky_horizon_color = Color(0.55, 0.58, 0.64)
	sm.ground_bottom_color = Color(0.05, 0.05, 0.06)
	sm.ground_horizon_color = Color(0.26, 0.27, 0.3)
	sky.sky_material = sm
	env.sky = sky
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#0b0e14")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.glow_enabled = true
	env.glow_intensity = 0.4
	var we := WorldEnvironment.new()
	we.environment = env
	_world.add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-52, 30, 0)
	key.light_energy = 1.8
	key.shadow_enabled = true
	_world.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-18, 205, 0)
	rim.light_energy = 0.8
	rim.light_color = accent.lightened(0.4)
	_world.add_child(rim)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(120, 120)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.13, 0.135, 0.15)
	fm.roughness = 0.35
	fm.metallic = 0.2
	floor_mi.material_override = fm
	_world.add_child(floor_mi)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 7.6
	tm.outer_radius = 7.8
	ring.mesh = tm
	var rm := StandardMaterial3D.new()
	rm.emission_enabled = true
	rm.emission = accent
	rm.emission_energy_multiplier = 2.5
	rm.albedo_color = accent.darkened(0.6)
	ring.material_override = rm
	ring.scale.y = 0.2
	ring.position.y = 0.01
	_world.add_child(ring)
	_turn = Node3D.new()
	_world.add_child(_turn)
	_cam = Camera3D.new()
	_cam.fov = 40
	_cam.far = 400.0
	_world.add_child(_cam)

func _process(delta: float) -> void:
	_yaw += delta * 0.2
	if _cam:
		_cam.position = Vector3(sin(_yaw) * _dist, _look_y + _dist * 0.3, cos(_yaw) * _dist)
		_cam.look_at(Vector3(0, _look_y, 0))

func _drag(e: InputEvent) -> void:
	if e is InputEventScreenDrag:
		_yaw -= (e as InputEventScreenDrag).relative.x * 0.01
	elif e is InputEventMouseMotion and ((e as InputEventMouseMotion).button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		_yaw -= (e as InputEventMouseMotion).relative.x * 0.01

func vehicle(id: String) -> Dictionary:
	for v in Facility.vehicles(fac):
		if String(v.id) == id:
			return v
	return {}

## the vehicle on the pad: its own model, never a stand-in — without one the pad stays empty and says so
func show_vehicle(id: String) -> void:
	pick = id
	if _model:
		_model.queue_free()
		_model = null
	var v := vehicle(id)
	var path := String(v.get("model", ""))
	_nomodel.text = ""
	var scene: PackedScene = load(path) if path != "" and ResourceLoader.exists(path) else null
	if scene:
		_model = scene.instantiate() as Node3D
		_turn.add_child(_model)
		var f := Kit.frame(_model)
		_model.position = Vector3(-f.c.x, -f.floor, -f.c.z)
		var hl := maxf(float(f.hl), 1.2)
		_dist = clampf(hl * 3.2, 6.0, 80.0)
		_look_y = clampf(hl * 0.25, 0.6, 8.0)
		if fac == "military":
			Facility.paint_camo(_model, Facility.camo(state, id), int(state.cars[id].get("damage", 0)) if state.cars.has(id) else 0)
	else:
		_nomodel.text = "%s\nmodel coming" % String(v.get("name", "")).to_upper()
	_refresh()

func _refresh() -> void:
	var v := vehicle(pick)
	var own := Facility.owned(fac, pick, profile)
	_nex.text = "%s Nex" % Dealer.money(int(state.credits))
	_name.text = String(v.get("name", "")).to_upper()
	if own:
		_sub.text = String(Facility.FACILITIES[fac].blurb)
	elif fac == "aviation":
		_sub.text = "Not yours yet — buy it for a hangar at the airport (%s Nex) to work on it here." % Dealer.money(int(v.get("price", 0)))
	else:
		_sub.text = "Not yours yet — buy it at the dealership (%s Nex) to work on it here." % Dealer.money(int(v.get("price", 0)))
	for ch in _rows.get_children():
		ch.queue_free()
	for o in Facility.FACILITIES[fac].options:
		var oid := String(o.id)
		var lv := Facility.level(state, pick, oid)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var title := String(o.name)
		if oid == "camo":
			title += " · " + String(Facility.CAMO_NAMES[lv])
		info.add_child(Data.label("%s   %s" % [title, "■".repeat(lv) + "□".repeat(Facility.MAX_LEVEL - lv)], 15))
		var line := Data.label(String(o.line), 12, Data.MUTED)
		line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		info.add_child(line)
		row.add_child(info)
		var b: Button
		if lv >= Facility.MAX_LEVEL:
			b = Data.button("MAX")
			b.disabled = true
		else:
			b = Data.button("LV %d · %s Nex" % [lv + 1, Dealer.money(Facility.price(fac, oid, lv))], own)
			b.disabled = not own
			b.pressed.connect(func(): upgrade(oid))
		b.custom_minimum_size = Vector2(150, 46)
		row.add_child(b)
		_rows.add_child(row)
	for ch in _cards.get_children():
		ch.queue_free()
	for c in Facility.vehicles(fac):
		var id := String(c.id)
		var mine := Facility.owned(fac, id, profile)
		var total := 0
		for k in Facility.levels(state, id):
			total += int(Facility.levels(state, id)[k])
		var b := Data.button("%s\n%s" % [String(c.name).to_upper(), ("YOURS · %d levels fitted" % total) if mine else "not owned"], id == pick)
		b.custom_minimum_size = Vector2(170, 56)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func(): show_vehicle(id))
		_cards.add_child(b)

## buy the next level of `opt` on the picked vehicle; "" when it went through
func upgrade(opt: String) -> String:
	if not Facility.owned(fac, pick, profile):
		_status.text = "You don't own this one."
		return _status.text
	var why := Facility.buy(state, fac, pick, opt)
	if why != "":
		_status.text = why
		_status.add_theme_color_override("font_color", Color("#ff8a7a"))
		_refresh()
		return why
	if persist:
		state.save()
		Wallet.close(state)
	profile["nex"] = int(state.credits)
	var o := Facility.option(fac, opt)
	_status.text = "%s fitted — level %d." % [String(o.name), Facility.level(state, pick, opt)]
	_status.add_theme_color_override("font_color", Color("#7dff8a"))
	Sound.sfx("click", -6.0)
	if opt == "camo" and _model:
		Facility.paint_camo(_model, Facility.camo(state, pick))
	_refresh()
	return ""
