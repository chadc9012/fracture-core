extends Control
## Off the plane in another region (airport.gd DESTINATIONS): the region in 3D, walked on foot with the shared stack (the
## operator, the worn guns, region_3d.gd PLAY mode), from the region's airport if it has one, else its stand point. There is
## no terminal on this map (a region's airport is its own view: FLIGHTS walks you back in), so weapons are as in the wilds (out once the story has armed the operator). FLIGHTS opens the
## return desk: a one-way ticket to Nexus City or Neon City, bought and boarded on the spot (`flew(code)`).

signal closed
signal flew(code: String)
## the Sky Sovereign came down (sky_sovereign.gd): main.gd hides this view and opens his fight
signal unique_called(mission: String)

const Air := preload("res://scripts/airport/airport.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")
const NpcStreet := preload("res://scripts/npc/npc_street.gd")
const People := preload("res://scripts/npc/people.gd")
const Encounters := preload("res://scripts/mission/encounters.gd")
const Sovereign := preload("res://scripts/mission/sky_sovereign.gd")

var dest := "THA"
## walk a map straight from the street rather than off a flight (the HIGHLANDS FUNICULAR door: "nexus" with `on_cap`)
var region_id := ""
var on_cap := false
var overlook: Node     # scripts/city/overlook.gd, on a map that has a lookout crag
var region: Control
var operator: Node3D
var controls: Control
var gunplay: Node3D
var profile: Dictionary
var armed := false
var npcs: Node3D        # the people who meet you here (people.gd REGIONS: the Verdant Forest's Warden Ilya and Scout Mira)
var _near := ""
var _shots := 0
var _panel: Control
var beacon: Node3D     # the map's waypoint (waypoint_beacon.gd)
var map_id := ""

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	profile = Gear.profile_load()
	var d: Dictionary = Air.DESTINATIONS.get(dest, Air.DESTINATIONS.THA)
	var id := String(d.region) if region_id == "" else region_id
	# a destination whose region has no exported map yet (Frostveil, the Azure Isles, Goldenreach) lands on the
	# nearest mapped land rather than on nothing: without this the region built no world and the walk out crashed
	if Data.map(id).is_empty():
		id = Air.FALLBACK_REGION.get(id, "veridan")
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	var start: Variant = null
	for poi in Data.map(id).get("pois", []):
		if String(poi.id).contains("airport") or String(poi.get("kind", "")).to_lower() == "airport":
			start = Vector2(float(poi.x), float(poi.z))
	region.show_region(id, start, Region3D.Mode.PLAY)
	map_id = id
	controls = TouchControls.new()
	add_child(controls)
	beacon = load("res://scripts/nav/waypoint_beacon.gd").new()
	region.world().add_child(beacon)
	beacon.setup(region, controls, id)
	operator = Player.new()
	region.world().add_child(operator)
	var half: float = region.span() * 0.5 - 20.0
	operator.bounds = Rect2(-half, -half, half * 2.0, half * 2.0)
	operator.ground_at = func(x: float, z: float) -> float: return region.ground(x, z)
	operator.obstacles = region.building_boxes()
	operator.position = region.stand_point()
	operator.build()
	overlook = preload("res://scripts/city/overlook.gd").new()
	add_child(overlook)
	overlook.setup(self, id)
	if on_cap:
		overlook.arrive_on_cap()
	operator.attach_camera(region.camera())
	region.camera().current = true
	preload("res://scripts/nav/gps.gd").attach(self, region, operator)   # the GPS (owner, Nov 18)
	gunplay = Gunplay.new()
	region.world().add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	if People.ROSTERS.has(dest) and region_id == "":
		npcs = NpcStreet.new()
		npcs.origin = Vector3(operator.position.x, 0, operator.position.z)
		region.world().add_child(npcs)
		npcs.setup(operator, controls, self, operator.obstacles, operator.bounds, operator.ground_at, 11.5, Vector2(-100000.0, 100000.0), dest)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	armed = StreetSlice.force_armed or StreetSlice.story_armed()
	gunplay.set_holstered(not armed)
	controls.set_armed(armed)
	var row := HBoxContainer.new()
	row.position = Vector2(250, 8)   # right of the hull bar (HUD rule): it sat on it (polish, Nov 21)
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
	controls.toast("Highlands Overlook · Nexus City" if on_cap else "Welcome to %s." % String(d.name))
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
	if npcs:
		npcs.step(dt)
		if npcs.busy:
			operator.step(dt, Vector2.ZERO, Vector2.ZERO, false, false)
			return
		if gunplay.shots_fired != _shots:
			_shots = gunplay.shots_fired
			npcs.gunfire(operator.position)
	if overlook and overlook.step(dt):
		return
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if beacon:
		beacon.step(dt, operator)
	if Engine.get_process_frames() % 30 == 0:
		_clue_sense()
	_sovereign(dt)
	if npcs:
		var who: String = npcs.near(operator.position)
		if who != _near:
			_near = who
			# the Ashen Mark: people notice it (one remark per person per visit)
			if who != "" and _sov_marked and not _remarked.has(who):
				_remarked[who] = true
				controls.toast(String(Sovereign.REMARKS[_remarked.size() % Sovereign.REMARKS.size()]))
			controls.prompt(npcs.label_for(who) if who != "" else "")
		if who != "" and controls.take_enter():
			controls.prompt("")
			_near = ""
			npcs.talk(who)
			return
	if controls.take_next():
		gunplay.next_weapon()
	gunplay.step(dt, region.camera(), controls.fire and armed, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name() if armed else "UNARMED"
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text()) if armed else ""

## the unique encounters' world and site clues (encounters.gd): walking near one of this region's places records it
var _clue_seen := {}
func _clue_sense() -> void:
	var o: Vector2 = region.origin()
	var at := Vector2(operator.position.x + o.x, operator.position.z + o.y)
	for pl in Encounters.near(map_id, at):
		var k := "%s:%s" % [pl.e, pl.c]
		if _clue_seen.has(k):
			continue
		_clue_seen[k] = true
		var w := map_id
		for l in Encounters.with_profile(func(p: Dictionary) -> Array: return Encounters.sense(p, w, at)):
			controls.toast(String(l))

## Vyrak (sky_sovereign.gd): nothing points here. Alone in Solara, on foot, level 12+, at night by the device's clock, standing
## in the Ribcage crater long enough — and he comes down. The profile is re-read every few seconds, not every frame.
var _sov := Sovereign.new_watch()
var _sov_read := -1.0
var _sov_level := 0
var _sov_slain := true
var _sov_marked := false
var _remarked := {}
func _sovereign(dt: float) -> void:
	_sov_read -= dt
	if _sov_read <= 0.0:
		_sov_read = 3.0
		var p := Gear.profile_load()
		_sov_level = int(p.get("level", 1))
		_sov_slain = Sovereign.is_slain(p)
		_sov_marked = Sovereign.is_marked(p)
	if map_id != Sovereign.WORLD or _sov_slain:
		return
	var lair: Variant = Encounters.pois(map_id).get(Sovereign.LAIR)
	if not (lair is Vector2):
		return
	var o: Vector2 = region.origin()
	var at := Vector2(operator.position.x + o.x, operator.position.z + o.y)
	var c := { "dist": at.distance_to(lair), "night": Sovereign.is_night(), "level": _sov_level, "on_foot": true,
		"alone": not (npcs and npcs.busy) }
	if Sovereign.step(_sov, c, dt, _sov_slain):
		controls.toast("The wind over the crater stops dead.")
		get_tree().create_timer(1.5).timeout.connect(func(): unique_called.emit(Sovereign.MISSION))

## back from his fight: the mark (or its absence) shows on the operator at once
func refresh_mark() -> void:
	_sov_read = 0.0
	if region:
		region.camera().current = true
	if operator and operator.get("rig"):
		operator.rig.ashen_mark(Sovereign.is_marked(Gear.profile_load()))

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
		b.text = "✈ %s (%s) · %d Nex" % [String(Air.AIRPORTS[home].name), Air.tag(home), price]
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
