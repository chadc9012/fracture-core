extends Control
## The Vehicle Showroom (owner's "WORLD FRACTURE / VEHICLE SHOWROOM / EXPANDED VEHICLE ROSTER" sheet, Nov 12): a row of
## category tabs (hypercars … vans), the cars of the picked row as cards (name, price in Nex, OWNED), the picked car large
## on a lit turntable with its stats, and BUY. Opened from the garage (garage_view.gd SHOWROOM); buying goes through
## dealership.gd and saves the profile. Emits `closed`, and `bought(id)` after a purchase.

signal closed
signal bought(id: String)

const Phone := preload("res://scripts/phone.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
const Dealer := preload("res://scripts/garage/dealership.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const Kit := preload("res://scripts/garage/garage_kit.gd")

var profile: Dictionary = {}
## save the profile after a purchase (off in the headless tests)
var persist := true
var cat := "hyper"
var pick := ""

var _vp: SubViewport
var _world: Node3D
var _cam: Camera3D
var _turn: Node3D
var _car: Node3D
var _yaw := 0.6
var _dist := 8.0
var _split: BoxContainer
var _tabs: HBoxContainer
var _cards: GridContainer
var _name: Label
var _sub: Label
var _stats: VBoxContainer
var _buy: Button
var _status: Label
var _nex: Label
var _side: Control

func _ready() -> void:
	if profile.is_empty():
		profile = Gear.profile_load()
	var bg := ColorRect.new()
	bg.color = Color("#06080d")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.add_theme_constant_override("separation", 0)
	add_child(col)
	col.add_child(_header())
	var ts := ScrollContainer.new()
	ts.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	ts.custom_minimum_size = Vector2(0, 50)
	_tabs = HBoxContainer.new()
	_tabs.add_theme_constant_override("separation", 6)
	ts.add_child(_tabs)
	col.add_child(ts)
	_split = BoxContainer.new()
	_split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(_split)
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	svc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	svc.size_flags_stretch_ratio = 1.2
	svc.gui_input.connect(_drag)
	_split.add_child(svc)
	_vp = SubViewport.new()
	Phone.fit_viewport(_vp)
	_vp.own_world_3d = true
	svc.add_child(_vp)
	_side = _panel()
	_split.add_child(_side)
	resized.connect(_layout)
	_layout()
	_stage()
	_show_cat(cat)

func _header() -> Control:
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", Data.box(Color("#0b0e16"), Color("#5b2be0"), 0))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	head.add_child(hb)
	var back := Data.button("← GARAGE")
	back.pressed.connect(func(): closed.emit())
	hb.add_child(back)
	var t := Data.label("VEHICLE SHOWROOM", 22, Color(0.92, 0.9, 1.0))
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(t)
	_nex = Data.label("", 18, Data.GOLD)
	hb.add_child(_nex)
	return head

func _panel() -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Data.box(Data.PANEL, Data.RULE, 0))
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	p.add_child(v)
	_name = Data.label("", 22)
	v.add_child(_name)
	_sub = Data.label("", 14, Data.MUTED)
	v.add_child(_sub)
	_stats = VBoxContainer.new()
	v.add_child(_stats)
	var row := HBoxContainer.new()
	_buy = Data.button("BUY", true)
	_buy.custom_minimum_size = Vector2(220, 52)
	_buy.pressed.connect(_purchase)
	row.add_child(_buy)
	v.add_child(row)
	_status = Data.label("", 14, Color(0.6, 0.9, 1.0))
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(_status)
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_cards = GridContainer.new()
	_cards.columns = 2
	_cards.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cards.add_theme_constant_override("h_separation", 6)
	_cards.add_theme_constant_override("v_separation", 6)
	sc.add_child(_cards)
	v.add_child(sc)
	return p

func _layout() -> void:
	if _split == null:
		return
	var wide := size.x > size.y * 1.1
	_split.vertical = not wide
	_side.size_flags_stretch_ratio = 0.85 if wide else 1.0

## the turntable: a dark studio, a glossy disc, key and rim lights, a soft sky for reflections
func _stage() -> void:
	_world = Node3D.new()
	_vp.add_child(_world)
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.2, 0.26, 0.42)
	sm.sky_horizon_color = Color(0.55, 0.6, 0.72)
	sm.ground_bottom_color = Color(0.04, 0.04, 0.06)
	sm.ground_horizon_color = Color(0.25, 0.26, 0.3)
	sky.sky_material = sm
	env.sky = sky
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#0a0d16")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.glow_enabled = true
	env.glow_intensity = 0.5
	var we := WorldEnvironment.new()
	we.environment = env
	_world.add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-50, 35, 0)
	key.light_energy = 1.8
	key.shadow_enabled = true
	_world.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-20, 210, 0)
	rim.light_energy = 0.9
	rim.light_color = Color(0.7, 0.6, 1.0)
	_world.add_child(rim)
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 4.2
	cm.bottom_radius = 4.3
	cm.height = 0.12
	disc.mesh = cm
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color(0.1, 0.11, 0.14)
	dm.metallic = 0.6
	dm.roughness = 0.12
	disc.material_override = dm
	disc.position.y = -0.06
	_world.add_child(disc)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 4.25
	tm.outer_radius = 4.36
	ring.mesh = tm
	var rm := StandardMaterial3D.new()
	rm.emission_enabled = true
	rm.emission = Color(0.45, 0.2, 1.0)
	rm.emission_energy_multiplier = 3.0
	rm.albedo_color = Color(0.2, 0.1, 0.4)
	ring.material_override = rm
	ring.scale.y = 0.4
	_world.add_child(ring)
	_turn = Node3D.new()
	_world.add_child(_turn)
	_cam = Camera3D.new()
	_cam.fov = 38
	_world.add_child(_cam)

func _process(delta: float) -> void:
	_yaw += delta * 0.25
	if _cam:
		_cam.position = Vector3(sin(_yaw) * _dist, _dist * 0.32, cos(_yaw) * _dist)
		_cam.look_at(Vector3(0, 0.55, 0))

func _drag(e: InputEvent) -> void:
	if e is InputEventScreenDrag:
		_yaw -= (e as InputEventScreenDrag).relative.x * 0.01
	elif e is InputEventMouseMotion and ((e as InputEventMouseMotion).button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		_yaw -= (e as InputEventMouseMotion).relative.x * 0.01

func cars_in(c: String) -> Array:
	var out: Array = []
	for v in Catalog.SHOWROOM:
		if String(v.cat) == c:
			out.append(v)
	return out

func _show_cat(c: String) -> void:
	cat = c
	for ch in _tabs.get_children():
		ch.queue_free()
	for row in Catalog.SHOWROOM_CATS:
		if cars_in(String(row[0])).is_empty():
			continue
		var b := Data.button(String(row[1]), String(row[0]) == cat)
		var id := String(row[0])
		b.pressed.connect(func(): _show_cat(id))
		_tabs.add_child(b)
	var list := cars_in(cat)
	_cards_fill(list)
	if not list.is_empty():
		show_car(String(list[0].id))

func _cards_fill(list: Array) -> void:
	for ch in _cards.get_children():
		ch.queue_free()
	for v in list:
		var id := String(v.id)
		var own := Dealer.owns(profile, id)
		var b := Data.button("%s\n%s" % [String(v.name).to_upper(), "OWNED" if own else Dealer.money(int(v.price)) + " Nex"], id == pick)
		b.custom_minimum_size = Vector2(180, 60)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func(): show_car(id))
		_cards.add_child(b)

func show_car(id: String) -> void:
	pick = id
	var v := Catalog.vehicle(id)
	if _car:
		_car.queue_free()
		_car = null
	var scene: PackedScene = load(String(v.model))
	if scene:
		_car = scene.instantiate()
		_turn.add_child(_car)
		var f := Kit.frame(_car)
		_car.position = Vector3(-f.c.x, -f.floor, -f.c.z)
		_dist = clampf(maxf(float(f.hl), 1.2) * 3.4, 5.5, 12.0)
	_refresh()

func _refresh() -> void:
	var v := Catalog.vehicle(pick)
	_nex.text = "%s Nex" % Dealer.money(int(profile.get("nex", 0)))
	_name.text = String(v.get("name", "")).to_upper()
	var row := ""
	for c in Catalog.SHOWROOM_CATS:
		if c[0] == String(v.get("cat", "")):
			row = String(c[1])
	_sub.text = "%s  ·  %s Nex%s" % [row, Dealer.money(int(v.get("price", 0))), "" if Catalog.street_cat(String(v.get("cat", ""))) else "  ·  dealership only — never found on the street"]
	for ch in _stats.get_children():
		ch.queue_free()
	var st: Dictionary = v.get("stats", {})
	for k in [["speed", "TOP SPEED"], ["accel", "ACCELERATION"], ["handling", "HANDLING"], ["armor", "ARMOUR"]]:
		var h := HBoxContainer.new()
		var l := Data.label(String(k[1]), 13, Data.MUTED)
		l.custom_minimum_size = Vector2(130, 0)
		h.add_child(l)
		var bar := ProgressBar.new()
		bar.max_value = 100
		bar.value = int(st.get(k[0], 0))
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(160, 14)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(bar)
		_stats.add_child(h)
	var own := Dealer.owns(profile, pick)
	_buy.text = "OWNED" if own else "BUY · %s Nex" % Dealer.money(int(v.get("price", 0)))
	_buy.disabled = own
	_cards_fill(cars_in(cat))

func _purchase() -> void:
	var line := Dealer.buy(profile, pick)
	_status.text = line
	if Dealer.owns(profile, pick):
		if persist:
			Gear.profile_save(profile)
		Sound.sfx("car_chirp", -6.0)
		bought.emit(pick)
	_refresh()

const Sound := preload("res://scripts/audio/sound.gd")
