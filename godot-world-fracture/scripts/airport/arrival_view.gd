extends Control
## Off the plane in another region (airport.gd DESTINATIONS): the region in 3D, walked on foot with the shared stack (the
## operator, the worn guns, region_3d.gd PLAY mode), from the region's airport if it has one, else its stand point. There is
## no terminal on this map (a region's airport is its own view: FLIGHTS walks you back in), so weapons are as in the wilds (out once the story has armed the operator). FLIGHTS opens the
## return desk: a one-way ticket to Nexus City or Neon City, bought and boarded on the spot (`flew(code)`).

signal closed
signal flew(code: String)

const Air := preload("res://scripts/airport/airport.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")

var dest := "THA"
var region: Control
var operator: Node3D
var controls: Control
var gunplay: Node3D
var profile: Dictionary
var armed := false
var _panel: Control

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	profile = Gear.profile_load()
	var d: Dictionary = Air.DESTINATIONS.get(dest, Air.DESTINATIONS.THA)
	var id := String(d.region)
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	var start: Variant = null
	for poi in Data.map(id).get("pois", []):
		if String(poi.id).contains("airport") or String(poi.get("kind", "")).to_lower() == "airport":
			start = Vector2(float(poi.x), float(poi.z))
	region.show_region(id, start, Region3D.Mode.PLAY)
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	region.world().add_child(operator)
	var half: float = region.span() * 0.5 - 20.0
	operator.bounds = Rect2(-half, -half, half * 2.0, half * 2.0)
	operator.ground_at = func(x: float, z: float) -> float: return region.ground(x, z)
	operator.obstacles = region.building_boxes()
	operator.position = region.stand_point()
	operator.build()
	operator.attach_camera(region.camera())
	region.camera().current = true
	gunplay = Gunplay.new()
	region.world().add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	armed = StreetSlice.force_armed or StreetSlice.story_armed()
	gunplay.set_holstered(not armed)
	controls.set_armed(armed)
	var row := HBoxContainer.new()
	row.position = Vector2(16, 16)
	row.add_theme_constant_override("separation", 8)
	add_child(row)
	var back := Button.new()
	back.text = "← STREET"
	back.custom_minimum_size = Vector2(96, 44)
	back.pressed.connect(func(): closed.emit())
	row.add_child(back)
	var fl := Button.new()
	fl.text = "✈ FLIGHTS"
	fl.custom_minimum_size = Vector2(110, 44)
	fl.pressed.connect(_flights)
	row.add_child(fl)
	controls.toast("Welcome to %s." % String(d.name))
	# out of the cloud deck the flight came down through (airport_view.gd fades to the same veil)
	var veil := ColorRect.new()
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veil.color = Color(0.9, 0.92, 0.95)
	add_child(veil)
	create_tween().tween_property(veil, "color:a", 0.0, 1.6)
	get_tree().create_timer(1.7).timeout.connect(veil.queue_free)

func _process(dt: float) -> void:
	if _panel or not operator:
		return
	dt = minf(dt, 0.05)
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if controls.take_next():
		gunplay.next_weapon()
	gunplay.step(dt, region.camera(), controls.fire and armed, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name() if armed else "UNARMED"
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text()) if armed else ""

## the return desk: a ticket home, paid and boarded in one press
func _flights() -> void:
	_panel = Control.new()
	_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_panel)
	controls.visible = false
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.06, 0.94)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(bg)
	var box := VBoxContainer.new()
	box.position = Vector2(24, 60)
	box.custom_minimum_size = Vector2(480, 0)
	box.add_theme_constant_override("separation", 10)
	_panel.add_child(box)
	var t := Label.new()
	t.text = "FLIGHTS FROM %s · %d Nex" % [String(Air.DESTINATIONS[dest].name).to_upper(), int(profile.get("nex", 0))]
	t.add_theme_font_size_override("font_size", 22)
	box.add_child(t)
	var msg := Label.new()
	msg.modulate = Color(1.0, 0.7, 0.6)
	if Air.AIRPORTS.has(dest):
		# this region has its own airport: walk back into the terminal (tickets, shops, hangars there)
		var walk := Button.new()
		walk.text = "✈ %s · walk in" % String(Air.AIRPORTS[dest].name)
		walk.custom_minimum_size = Vector2(0, 48)
		walk.alignment = HORIZONTAL_ALIGNMENT_LEFT
		walk.pressed.connect(func(): flew.emit(dest))
		box.add_child(walk)
	for home in Air.AIRPORTS:
		if home == dest:
			continue
		var price := Air.fare(home)
		var b := Button.new()
		b.text = "✈ %s (%s) · %d Nex" % [String(Air.AIRPORTS[home].name), home, price]
		b.custom_minimum_size = Vector2(0, 48)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.pressed.connect(func():
			if int(profile.get("nex", 0)) < price:
				msg.text = "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
				return
			profile.nex = int(profile.nex) - price
			Gear.profile_save(profile)
			flew.emit(home))
		box.add_child(b)
	box.add_child(msg)
	var back := Button.new()
	back.text = "← BACK"
	back.custom_minimum_size = Vector2(0, 48)
	back.pressed.connect(func():
		_panel.queue_free()
		_panel = null
		controls.visible = true)
	box.add_child(back)
