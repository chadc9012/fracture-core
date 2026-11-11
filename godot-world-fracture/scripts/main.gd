extends Control
const Sound := preload("res://scripts/audio/sound.gd")
## World Fracture (Godot): the Planetary Director. The globe is home; tapping a continent twice (or OPEN MAP) opens its region
## map, and Back returns to the globe. Android's back gesture goes back too.

const PlanetView := preload("res://scripts/planet_view.gd")
const RegionMap := preload("res://scripts/region_map.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const GarageView := preload("res://scripts/garage/garage_view.gd")
const DriveView := preload("res://scripts/driving/drive_view.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")
const CharacterCreator := preload("res://scripts/character/character_creator.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const CloudSave := preload("res://scripts/cloud/cloud_save.gd")
const CloudPanel := preload("res://scripts/cloud/cloud_panel.gd")
const RaceView := preload("res://scripts/racing/race_view.gd")
const Descent := preload("res://scripts/mission/descent.gd")
const ArenaView := preload("res://scripts/killbox/arena_view.gd")
const SkywaysView := preload("res://scripts/flying/skyways_view.gd")
var skyways: Control
const BossArena := preload("res://scripts/combat/boss_arena.gd")
const Airport := preload("res://scripts/airport/airport.gd")
const AirportView := preload("res://scripts/airport/airport_view.gd")
const ArrivalView := preload("res://scripts/airport/arrival_view.gd")
var boss_arena: Control
const Title := preload("res://scripts/front/title.gd")
const SettingsView := preload("res://scripts/front/settings_view.gd")
const PerfHud := preload("res://scripts/front/perf_hud.gd")
const ProfileView := preload("res://scripts/progress/profile_view.gd")
var title: Control
var settings_view: Control
## the view a street door opened; when it closes the street comes back
var _from_street: Control
var _mission_from_onboarding := false
const ModesHub := preload("res://scripts/modes/modes_hub.gd")
const Interiors := preload("res://scripts/city/interiors.gd")
const InteriorView := preload("res://scripts/city/interior_view.gd")
var modes: Control
var descent: Control
var killbox: Control
var race_view: Control
var cloud: Node
var cloud_panel: Control
var cloud_line: Label
const Mission01 := preload("res://scripts/mission/mission_01.gd")

var planet_view: Control
var region_map: Control
var region_3d: Control
var garage: Control
var driving: Control

func _ready() -> void:
	preload("res://scripts/front/settings_store.gd").apply_orientation()   # the player's saved screen orientation
	# the UI is laid out for a 540 px wide portrait phone; turned sideways the same rule would shrink every button to half
	# its size, so the design size turns with the screen (540 × 1170 upright, 1170 × 540 on its side)
	get_tree().root.size_changed.connect(_fit_design_size)
	_fit_design_size()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)   # the overlays (title, settings, operator) fill the window
	var bg := ColorRect.new()
	bg.color = Data.BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# the front-door overlays (title, settings, operator panel) live on their own layer, over whatever the globe or a mode
	# adds later and under the frame-time readout
	_overlays = CanvasLayer.new()
	_overlays.layer = 50
	add_child(_overlays)
	add_child(PerfHud.new())   # the frame-time readout over everything (settings: perf_hud)
	planet_view = PlanetView.new()
	planet_view.set_anchors_preset(Control.PRESET_FULL_RECT)
	planet_view.open_map.connect(_open_map)
	add_child(planet_view)
	# the garage (scripts/garage): a button over the globe
	var gb := Data.button("GARAGE", true)
	gb.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	gb.position = Vector2(-150, -70)
	gb.custom_minimum_size = Vector2(130, 52)
	gb.pressed.connect(_open_garage)
	add_child(gb)
	var drive_button := Data.button("DRIVE", true)
	drive_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	drive_button.position = Vector2(-290, -70)
	drive_button.custom_minimum_size = Vector2(130, 52)
	drive_button.pressed.connect(_open_drive)
	add_child(drive_button)
	var street_button := Data.button("NEXUS STREET", true)
	street_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	street_button.position = Vector2(-450, -70)
	street_button.custom_minimum_size = Vector2(150, 52)
	street_button.pressed.connect(_open_street)
	add_child(street_button)
	var play := Data.button("▶ PLAY · M1 THE FRACTURE", true)
	play.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	play.position = Vector2(-450, -134)
	play.custom_minimum_size = Vector2(430, 56)
	play.add_theme_font_size_override("font_size", 18)
	play.pressed.connect(_open_mission)
	add_child(play)
	var op_button := Data.button("OPERATOR", true)
	op_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	op_button.position = Vector2(-590, -70)
	op_button.custom_minimum_size = Vector2(130, 52)
	op_button.pressed.connect(_open_creator)
	# cloud save (scripts/cloud): sign-in and sync from the globe; a sync runs on launch and whenever a view closes
	cloud = CloudSave.new()
	add_child(cloud)
	var cloud_button := Data.button("CLOUD", true)
	cloud_button.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	cloud_button.position = Vector2(20, -70)
	cloud_button.custom_minimum_size = Vector2(110, 52)
	cloud_button.pressed.connect(_open_cloud)
	add_child(cloud_button)
	# Game Modes (scripts/modes): PvP, Raids and Races, each its own mode
	var gm := Data.button("⚔ GAME MODES · PVP · RAIDS · RACES", true)
	gm.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	gm.position = Vector2(-450, -262)
	gm.custom_minimum_size = Vector2(430, 56)
	gm.add_theme_font_size_override("font_size", 18)
	gm.add_theme_color_override("font_color", Color(1.0, 0.8, 0.5))
	gm.pressed.connect(_open_modes)
	add_child(gm)
	var fd := Data.button("▶ FRACTURE DESCENT · ACT 1 · fd-02…07", true)
	fd.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	fd.position = Vector2(-450, -198)
	fd.custom_minimum_size = Vector2(430, 56)
	fd.add_theme_font_size_override("font_size", 18)
	fd.pressed.connect(_open_descent)
	add_child(fd)
	var race_button := Data.button("RACE", true)
	race_button.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	race_button.position = Vector2(140, -70)
	race_button.custom_minimum_size = Vector2(110, 52)
	race_button.pressed.connect(_open_race)
	add_child(race_button)
	var kb := Data.button("KILLBOX", true)
	kb.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	kb.position = Vector2(260, -70)
	kb.custom_minimum_size = Vector2(130, 52)
	kb.add_theme_color_override("font_color", Color(1.0, 0.45, 0.7))
	kb.pressed.connect(_open_killbox)
	add_child(kb)
	var sky := Data.button("SKYWAYS", true)
	sky.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	sky.position = Vector2(400, -70)
	sky.custom_minimum_size = Vector2(130, 52)
	sky.add_theme_color_override("font_color", Color(0.5, 0.9, 1.0))
	sky.pressed.connect(_open_skyways)
	add_child(sky)
	var settings_b := Data.button("SETTINGS", true)
	settings_b.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	settings_b.position = Vector2(400, -130)
	settings_b.custom_minimum_size = Vector2(130, 52)
	settings_b.pressed.connect(_open_settings)
	add_child(settings_b)
	var rift := Data.button("RIFT GATE", true)
	rift.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	rift.position = Vector2(260, -130)
	rift.custom_minimum_size = Vector2(130, 52)
	rift.add_theme_color_override("font_color", Color(0.85, 0.55, 1.0))
	rift.pressed.connect(_open_boss)
	add_child(rift)
	cloud_line = Label.new()
	cloud_line.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	cloud_line.position = Vector2(20, -96)
	cloud_line.add_theme_font_size_override("font_size", 13)
	cloud_line.modulate = Color(0.7, 0.85, 0.95)
	cloud_line.text = cloud.status()
	add_child(cloud_line)
	cloud.status_changed.connect(func(t: String): cloud_line.text = t)
	if cloud.signed_in() and OS.get_cmdline_user_args().find("--shot") < 0:
		_sync_later.call_deferred()
	add_child(op_button)
	get_tree().set_auto_accept_quit(false)
	get_tree().set_quit_on_go_back(false)
	# the front door: the title screen (step 7); shots skip it
	if OS.get_cmdline_user_args().find("--shot") < 0:
		_open_title.call_deferred()
	# a capture hook for checking the look off-device: --shot <png> [map:<id>] [sat]
	var args := OS.get_cmdline_user_args()
	var i := args.find("--shot")
	if i >= 0 and i + 1 < args.size():
		_shoot.call_deferred(args[i + 1], args.slice(i + 2))

func _open_map(map_id: String) -> void:
	if region_map:
		region_map.queue_free()
	region_map = RegionMap.new()
	region_map.set_anchors_preset(Control.PRESET_FULL_RECT)
	region_map.closed.connect(_close_map)
	region_map.open_3d.connect(_open_3d)
	add_child(region_map)
	region_map.show_map(map_id)
	planet_view.visible = false
	planet_view.set_process(false)

func _open_3d(map_id: String, at: Variant, street: bool) -> void:
	_close_3d()
	region_3d = Region3D.new()
	region_3d.set_anchors_preset(Control.PRESET_FULL_RECT)
	region_3d.closed.connect(_close_3d)
	add_child(region_3d)
	region_3d.show_region(map_id, at, Region3D.Mode.STREET if street else Region3D.Mode.CITY)
	if region_map:
		region_map.visible = false

func _close_3d() -> void:
	if region_3d:
		region_3d.queue_free()
		region_3d = null
	if region_map:
		region_map.visible = true

func _open_drive() -> void:
	if driving or garage:
		return
	driving = DriveView.new()
	driving.set_anchors_preset(Control.PRESET_FULL_RECT)
	driving.closed.connect(_close_drive)
	add_child(driving)
	planet_view.set_process(false)

var street: Control
## Nexus City opens at night (the owner's Nov 8 references: neon, wet streets, the spire's rings); DAY toggles it back
func _open_street(night := true, style := "nexus", walk := true) -> void:
	if street or driving or garage:
		return
	street = StreetSlice.new()
	street.night = night
	street.style = style
	street.walk = walk
	street.toggle_style.connect(func():
		var n: bool = street.night
		var st: String = street.style
		_close_street()
		_open_street(n, StreetSlice.STYLES[(StreetSlice.STYLES.find(st) + 1) % StreetSlice.STYLES.size()], walk))
	street.toggle_night.connect(func():
		var was: bool = street.night
		var st2: String = street.style
		_close_street()
		_open_street(not was, st2, walk))
	street.closed.connect(_close_street)
	street.door.connect(_street_door)
	add_child(street)
	planet_view.set_process(false)

## a hub door on the street: the street waits (hidden, not processing) while the mode runs, then comes back
func _street_door(id: String) -> void:
	if not street or _from_street:
		return
	var view: Control = null
	match id:
		"modes":
			view = ModesHub.new()
		"skyways":
			view = SkywaysView.new()
		"rift":
			view = BossArena.new()
		"descent":
			view = Descent.new()
		"apartment":
			view = Mission01.new()
			view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		"airport":
			# the city's own airport: Neon City International from Neon City's street, Nexus City International otherwise
			view = _airport_view("NEC" if street.style == "neon" else "NXC", false)
		_:
			if Interiors.has(id):
				# a walk-in building off the avenue (interiors.gd)
				var iv := InteriorView.new()
				iv.room_id = id
				view = iv
	if view == null:
		return
	street.visible = false
	street.set_process(false)
	street._vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	street.sound_off()
	_show_from_street(view)

## puts a system over the hidden street; closing it brings the street back (in the city you left from, if you flew)
func _show_from_street(view: Control) -> void:
	_from_street = view
	view.closed.connect(func():
		var come_back: String = String(_from_street.get("return_style")) if _from_street.get("return_style") != null else ""
		_from_street.queue_free()
		_from_street = null
		Sound.loops_stop()
		if street and come_back != "" and come_back != street.style:
			# you flew to the other city: its street, at its usual hour
			var walk: bool = street.walk
			_close_street()
			_open_street(come_back == "neon", come_back, walk)
		elif street:
			street.visible = true
			street.set_process(true)
			street._vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			street.sound_on()
		_sync_later())
	if view.has_signal("flew"):
		view.flew.connect(_flown.bind(view))
	if view.has_signal("outside"):
		view.outside.connect(_walk_out.bind(view))
	add_child(view)

func _airport_view(code: String, arriving: bool) -> Control:
	var v := AirportView.new()
	v.code = code
	v.arriving = arriving
	return v

## walked out of a region's airport (Azure Isles, Frostveil, Solara): that region on foot
func _walk_out(code: String, from_view: Control) -> void:
	if _from_street != from_view:
		return
	var next := ArrivalView.new()
	next.dest = code
	_from_street = null
	from_view.queue_free()
	Sound.loops_stop()
	_show_from_street(next)

## a flight took off: the old view goes, the destination opens over the street (the other airport, or a region)
func _flown(to: String, from_view: Control) -> void:
	if _from_street != from_view:
		return
	var next: Control
	if Airport.AIRPORTS.has(to):
		next = _airport_view(to, true)
	else:
		next = ArrivalView.new()
		next.dest = to
	_from_street = null
	from_view.queue_free()
	Sound.loops_stop()
	_show_from_street(next)

## the title screen and what its buttons do
func _open_title() -> void:
	if title:
		return
	title = Title.new()
	title.pressed.connect(_title_action)
	_overlays.add_child(title)
	planet_view.set_process(false)

func _close_title() -> void:
	if title:
		title.queue_free()
		title = null
	planet_view.set_process(true)

func _title_action(action: String) -> void:
	match action:
		"continue":
			_close_title()
			_open_street(true, "nexus", true)
		"new":
			_close_title()
			_open_creator(true)
		"modes":
			_close_title()
			_open_modes()
		"globe":
			_close_title()
		"settings":
			_open_settings()
		"operator":
			_open_profile()
		"cloud":
			_close_title()
			_open_cloud()

func _open_settings() -> void:
	if settings_view:
		return
	settings_view = SettingsView.new()
	settings_view.closed.connect(func():
		settings_view.queue_free()
		settings_view = null)
	_overlays.add_child(settings_view)

var profile_view: Control
var _overlays: CanvasLayer
func _open_profile() -> void:
	if profile_view:
		return
	profile_view = ProfileView.new()
	profile_view.closed.connect(func():
		profile_view.queue_free()
		profile_view = null)
	_overlays.add_child(profile_view)

func _close_street() -> void:
	if street:
		street.queue_free()
		street = null
	Sound.ambience("")
	planet_view.set_process(true)
	_sync_later()

func _open_descent() -> void:
	if descent:
		return
	descent = Descent.new()
	descent.closed.connect(_close_descent)
	add_child(descent)
	planet_view.set_process(false)

func _close_descent() -> void:
	if descent:
		descent.queue_free()
		descent = null
	planet_view.set_process(true)
	_sync_later()

func _open_race() -> void:
	if race_view:
		return
	race_view = RaceView.new()
	race_view.closed.connect(_close_race)
	add_child(race_view)
	planet_view.set_process(false)

func _close_race() -> void:
	if race_view:
		race_view.queue_free()
		race_view = null

## Game Modes: the hub hosts the PvP, Raids and Races views itself (scripts/modes/modes_hub.gd)
func _open_modes() -> void:
	if modes:
		return
	modes = ModesHub.new()
	modes.closed.connect(_close_modes)
	add_child(modes)
	planet_view.set_process(false)

func _close_modes() -> void:
	if modes:
		modes.queue_free()
		modes = null
	planet_view.set_process(true)
	_sync_later()

## the Killbox: Kaiju Complex, Clash against bots (scripts/killbox/)
func _open_killbox() -> void:
	if killbox:
		return
	killbox = ArenaView.new()
	killbox.closed.connect(_close_killbox)
	add_child(killbox)

## the Rift Gate: the six Fracture bosses (scripts/combat/boss*.gd)
func _open_boss() -> void:
	if boss_arena:
		return
	boss_arena = BossArena.new()
	boss_arena.closed.connect(_close_boss)
	add_child(boss_arena)

func _close_boss() -> void:
	if boss_arena:
		boss_arena.queue_free()
		boss_arena = null

## Skyways: aircraft and watercraft over Nexus City (scripts/flying/)
func _open_skyways() -> void:
	if skyways:
		return
	skyways = SkywaysView.new()
	skyways.closed.connect(_close_skyways)
	add_child(skyways)

func _close_skyways() -> void:
	if skyways:
		skyways.queue_free()
		skyways = null

func _close_killbox() -> void:
	if killbox:
		killbox.queue_free()
		killbox = null
	planet_view.set_process(true)
	_sync_later()

func _open_cloud() -> void:
	if cloud_panel:
		return
	cloud_panel = CloudPanel.new()
	cloud_panel.cloud = cloud
	cloud_panel.closed.connect(_close_cloud)
	add_child(cloud_panel)
	planet_view.set_process(false)

func _close_cloud() -> void:
	if cloud_panel:
		cloud_panel.queue_free()
		cloud_panel = null
	planet_view.set_process(true)

## a background sync when signed in (the files may have changed while a view was open)
func _sync_later() -> void:
	if cloud and cloud.signed_in() and not cloud.busy:
		cloud.sync()

var creator: Control
func _open_creator(first := false) -> void:
	if creator:
		return
	creator = CharacterCreator.new()
	creator.onboarding = first
	creator.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	creator.closed.connect(_close_creator)
	creator.confirmed.connect(func(_l: Dictionary) -> void:
		var was_first: bool = creator.onboarding
		_close_creator()
		if was_first:
			_mission_from_onboarding = true
			_open_mission())
	add_child(creator)
	planet_view.set_process(false)

var mission: Control
func _open_mission() -> void:
	if mission or creator:
		return
	mission = Mission01.new()
	mission.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mission.closed.connect(_close_mission)
	add_child(mission)
	planet_view.set_process(false)
	planet_view.visible = false

func _close_mission() -> void:
	if mission:
		mission.queue_free()
		mission = null
	planet_view.visible = true
	planet_view.set_process(true)
	_sync_later()
	if _mission_from_onboarding:
		# the opening done: the city is home
		_mission_from_onboarding = false
		_open_street(true, "nexus", true)

func _close_creator() -> void:
	if creator:
		creator.queue_free()
		creator = null
	planet_view.set_process(true)
	_sync_later()

func _close_drive() -> void:
	if driving:
		driving.queue_free()
		driving = null
	planet_view.set_process(true)

func _open_garage() -> void:
	if garage:
		return
	garage = GarageView.new()
	garage.set_anchors_preset(Control.PRESET_FULL_RECT)
	garage.closed.connect(_close_garage)
	add_child(garage)
	planet_view.set_process(false)

func _close_garage() -> void:
	if garage:
		garage.queue_free()
		garage = null
	planet_view.set_process(true)

func _close_map() -> void:
	if region_map:
		region_map.queue_free()
		region_map = null
	planet_view.visible = true
	planet_view.set_process(true)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if mission:
			_close_mission()
		elif creator and not creator.onboarding:
			_close_creator()
		elif modes and modes.view:
			modes._view_closed()
		elif modes and modes._mode != "":
			modes.show_hub()
		elif modes:
			_close_modes()
		elif street and street.sports_overlay:
			street.close_sports()
		elif street and street.casino_overlay:
			street.close_casino()
		elif street and street.mall_overlay and street.mall_overlay.shop_overlay:
			street.mall_overlay.close_shop()
		elif street and street.mall_overlay:
			street.close_mall()
		elif street and street.garage_overlay:
			street.close_garage()
		elif street:
			_close_street()
		elif driving and driving.garage_overlay != null:
			driving._close_city_garage()
		elif driving:
			_close_drive()
		elif garage:
			_close_garage()
		elif region_3d:
			_close_3d()
		elif region_map:
			_close_map()
		elif what == NOTIFICATION_WM_CLOSE_REQUEST:
			get_tree().quit()

func _shoot(path: String, opts: Array) -> void:
	for o in opts:
		if String(o).begins_with("select:"):
			planet_view.select(String(o).substr(7))
		if String(o).begins_with("map:"):
			_open_map(String(o).substr(4))
		# garage[:shop[:car[:item,item...]]]  e.g. garage:neon-performance:street-racer:paint-red,spoiler-gt,glow-cyan
		if String(o).begins_with("garage"):
			var g := String(o).split(":")
			_open_garage()
			if g.size() > 1 and g[1] != "":
				garage._enter_shop(g[1])
			if g.size() > 2 and g[2] != "":
				garage.show_car(g[2])
			if g.size() > 3:
				garage.state.rep = { "nexus-customs": 3, "neon-performance": 3, "ironworks": 3, "fracture-dynamics": 3 }
				garage.pick(Array(g[3].split(",")))
		# drive[:vehicle index[:throttle]]  e.g. drive:0:1 drives the first car flat out
		if String(o).begins_with("drive"):
			var d := String(o).split(":")
			_open_drive()
			await get_tree().process_frame
			if d.size() > 1:
				driving._select_index(int(d[1]))
			if d.size() > 2:
				driving._touch_changed(float(d[2]), float(d[3]) if d.size() > 3 else 0.0, 0.0)
			# drive:i:0:0:garage parks at Nexus Customs and opens it over the street
			if d.size() > 4 and d[4] == "garage":
				driving.vehicle.position = Vector3(-32, 0, -66)
				driving.vehicle.rotation.y = 0.0
				for k in 20:
					await get_tree().process_frame
				driving._open_city_garage()
		# slice[day][coast|neon][walk][garage]  the street slice as a look-dev shot (fixed camera), or on foot with "walk"
		if String(o).begins_with("slice"):
			_open_street(String(o).contains("night") or not String(o).contains("day"), "coast" if String(o).contains("coast") else ("neon" if String(o).contains("neon") else "nexus"), String(o).contains("walk"))
			# slice:look=x,y,z,tx,ty,tz  the look-dev camera from a point at a target (street set and wet-night checks)
			if String(o).contains("look="):
				var v := String(o).split("look=")[1].split(",")
				if v.size() >= 6:
					street.look_from(Vector3(float(v[0]), float(v[1]), float(v[2])), Vector3(float(v[3]), float(v[4]), float(v[5])))
			# slicewalk:run holds the stick forward-right with sprint for the shot; slicewalk:jump also jumps once
			if String(o).contains("walk:"):
				street.controls.scripted = true
				street.controls.move = Vector2(0.35, 1.0) if String(o).contains("run") else Vector2(0.0, 1.0)
				street.controls.sprint = String(o).contains("run")
				if String(o).contains("jump"):
					street.controls._jump = true
			# slicewalk:doors stands at the Killbox terminal with its ENTER prompt up
			if String(o).contains("walk:doors"):
				street.operator.position = Vector3(-10.0, 0.18, -40.6)
				street.operator.heading = PI * 1.5
				street.operator.cam_yaw = PI * 0.5
			# slicewalk:court=<id>[:still]  starts at a Nexus district court's side street (nexus_districts.gd COURTS ids) and walks in
			if String(o).contains("court="):
				street.go_to_court(String(o).split("court=")[1].split(":")[0])
				if String(o).contains("still"):
					street.controls.move = Vector2.ZERO
			# slicewalk:tank walks the operator to the Goliath tank by the garage and climbs in (then drives)
			if String(o).contains("walk:tank"):
				for c in street.parked:
					if String(c.get_meta("vehicle", "")) == "goliath-tank":
						street.operator.position = c.position + Vector3(3.0, 0.18, 0.0)
						street.enter_car(c)
				street.controls.scripted = true
				street.controls.move = Vector2(0.6, 0.8)
			# slicewalk:district starts at the far end of the hub block walking +z across the tile boundary
			if String(o).contains("walk:district"):
				street.controls.scripted = true
				street.operator.position = Vector3(8.0 + 3.4, 0.18, 125.0)
				street.operator.heading = 0.0
				street.operator.cam_yaw = PI
				street.controls.move = Vector2(0.0, 1.0)
				street.controls.sprint = true
			# slicewalk:fire stands and holds the trigger at the dummies; :sniper / :fusion swap first
			if String(o).contains("walk:fight"):
				street.controls.scripted = true
				street.controls.move = Vector2(0.0, 1.0)
				street.controls.sprint = true
			# slicewalk:drive[:N] takes the nearest parked car and drives forward with the stick for N frames
			if String(o).contains("walk:drive"):
				street.controls.scripted = true
				# a frame later: the street's first frame settles the operator and the parked cars before anyone climbs in
				var st := street
				get_tree().process_frame.connect(func():
					var nearest: Node3D = null
					for c in st.parked:
						if nearest == null or c.position.distance_to(st.operator.position) < nearest.position.distance_to(st.operator.position):
							nearest = c
					if nearest:
						st.enter_car(nearest)
						st.controls.move = Vector2(-0.12, 1.0)   # pull out toward the road
					, CONNECT_ONE_SHOT)
			if String(o).contains("walk:shop"):
				street.open_mall()
				street.mall_overlay.open_shop("haven" if String(o).contains("haven") else "nova")
			if String(o).contains("walk:inventory"):
				street.open_inventory()
			if String(o).contains("walk:fire"):
				street.controls.scripted = true
				street.controls.move = Vector2.ZERO
				street.controls.fire = true
				if String(o).contains("sniper"):
					street.gunplay.next_weapon()
				elif String(o).contains("fusion"):
					street.gunplay.next_weapon(); street.gunplay.next_weapon()
				if String(o).contains("aim"):
					await get_tree().process_frame
					street.gunplay.aim_at(street.gunplay.targets[0], street.cam)
			if String(o).contains("garage"):
				street.open_garage()
			var cam_q := String(o).split(":")
			if cam_q.size() > 2:
				var cf := cam_q[1].split(","); var ct := cam_q[2].split(",")
				street.look_from(Vector3(float(cf[0]), float(cf[1]), float(cf[2])), Vector3(float(ct[0]), float(ct[1]), float(ct[2])))
		# interior:<id>[:x,y,z:tx,ty,tz]  a walk-in building off the Nexus avenue (interiors.gd ROOMS), entered from the street
		if String(o).begins_with("interior:"):
			var iq := String(o).split(":")
			_open_street(false, "nexus", true)
			await get_tree().process_frame
			_street_door(iq[1])
			if iq.size() > 3 and _from_street:
				var i_f := iq[2].split(","); var i_t := iq[3].split(",")
				_from_street.look_from(Vector3(float(i_f[0]), float(i_f[1]), float(i_f[2])), Vector3(float(i_t[0]), float(i_t[1]), float(i_t[2])))
		# casino[:view]  the Neon City Grand Casino (Neon City's alone): 0-3 the floor, 4-6 the penthouse, 7-8 the skydeck concert
		if String(o).begins_with("casino"):
			_open_street(true, "neon", false)
			street.open_casino()
			var cv := String(o).split(":")
			if cv.size() > 1:
				street.casino_overlay.show_view(int(cv[1]))
		# sports[:view]  the sports district: 0-2 Pulse Arena, 3-4 Sunset Courts, 5-7 Iron Pulse gym
		if String(o).begins_with("sports"):
			_open_street(false, "nexus", false)
			street.open_sports()
			var sv := String(o).split(":")
			if sv.size() > 1:
				street.sports_overlay.show_view(int(sv[1]))
		# airport[:NXC|NEC[:x,y,z:tx,ty,tz]]  Nexus / Neon City International from its street's door; a camera to look from
		if String(o).begins_with("airport"):
			var aq := String(o).split(":")
			var ac := aq[1] if aq.size() > 1 else "NXC"
			_open_street(ac == "NEC", "neon" if ac == "NEC" else "nexus", true)
			await get_tree().process_frame
			_street_door("airport")
			if ac not in ["NXC", "NEC"] and _from_street:
				_flown(ac, _from_street)   # a region's airport: as if flown in
			if aq.size() > 3 and _from_street:
				var af := aq[2].split(","); var at := aq[3].split(",")
				_from_street.look_from(Vector3(float(af[0]), float(af[1]), float(af[2])), Vector3(float(at[0]), float(at[1]), float(at[2])))
		# mall[:view]  the Galleria mall interior
		if String(o).begins_with("mall"):
			_open_street(false, "nexus", false)
			street.open_mall()
			var mv := String(o).split(":")
			if mv.size() > 1:
				street.mall_overlay.show_view(int(mv[1]))
			var sl := street
			var q := String(o).split(":")
			if q.size() > 2:
				var f := q[1].split(","); var t := q[2].split(",")
				sl.look_from(Vector3(float(f[0]), float(f[1]), float(f[2])), Vector3(float(t[0]), float(t[1]), float(t[2])))
		# m1[:moment]  Mission 01: apt (default), apt2, hall, lobby, lounge, cine, dazed, surge, anchor, done
		if String(o).begins_with("m1"):
			var mm := String(o).split(":")
			_open_mission()
			if mm.size() > 1:
				await get_tree().process_frame
				mission.shot(mm[1])
		# char[:body[:face[:tab[:key=value,...]]]]  the operator creator, e.g. char:female:f-cyber:HAIR or char:male:m-rebel:FACE:hair=afro,beard=full
		if String(o) == "cloud":
			_open_cloud()
		# descent[:fight|:wild]  the Fracture Descent in the Verdant Forest; :fight sprints and fires; :wild stands by the deer herd
		if String(o).begins_with("descent"):
			# descent[:wild] [:fd-05|:fd-06|:fd-07] [:vyrak]: the quest to stand in (the chain is set to it), vyrak summons the boss
			for qid in ["fd-05", "fd-06", "fd-07"]:
				if String(o).contains(qid):
					var f := FileAccess.open("user://quests.json", FileAccess.WRITE)
					f.store_string(JSON.stringify({ "done": [], "current": qid, "kills": 0, "relay": 0, "timer": 0.0, "wave": 3 if String(o).contains("vyrak") else 0, "stage": 1 if qid == "fd-05" else 0 }))
					f.close()
			_open_descent()
			if descent.cutscene and descent.cutscene.playing:
				descent.cutscene._end()
			if String(o).contains("vyrak") and descent.quest.get("id", "") == "fd-07":
				descent.operator.position = descent.waypoint + Vector3(6, 0, 10)
				descent.operator.position.y = descent.region.ground(descent.operator.position.x, descent.operator.position.z)
				descent.operator.heading = 0.0
				descent.operator.cam_yaw = 0.0
				if descent.boss:
					descent.boss.position = descent.waypoint + Vector3(2, 0, -6)
					descent.boss.position.y = descent.region.ground(descent.boss.position.x, descent.boss.position.z)
			elif String(o).contains("fd-0"):
				descent.operator.position = descent.waypoint + Vector3(5, 0, 9)
				descent.operator.position.y = descent.region.ground(descent.operator.position.x, descent.operator.position.z)
				descent.operator.heading = 0.0
				descent.operator.cam_yaw = 0.0
			if String(o).contains("wild"):
				# the shot: bring a deer herd, the fox and a wolf to the open ground at the crash site so the bodies show
				var sp: Vector3 = descent.region.stand_point()
				var k := 0
				for c in descent.wildlife.rules.critters:
					if c.species in ["DEER", "FOX", "WOLF", "BOAR", "BEAR"]:
						c.home = Vector2(sp.x, sp.z) + Vector2(-6.0 + 3.0 * (k % 5), -14.0 - 3.0 * (k / 5))
						c.pos = c.home
						c.target = c.home
						c.state = 1 if c.species == "DEER" else 0   # GRAZE / IDLE
						c.timer = 30.0
						k += 1
				descent.operator.position = sp
				descent.operator.heading = PI
				descent.operator.cam_yaw = 0.0
				descent.operator.cam_pitch = -0.25
			if String(o).contains("fight"):
				descent.controls.scripted = true
				descent.controls.move = Vector2(0.0, 1.0)
				descent.controls.sprint = true
				descent.controls.fire = true
		# title / settings  the front door and the settings screen
		if String(o) == "title":
			_open_title()
		if String(o) == "settings":
			_open_settings()
		if String(o) == "operator":
			_open_profile()
		# creator[:<tab>]  the operator creator on a tab (body by default)
		if String(o).begins_with("creator"):
			_open_creator()
			if String(o).contains(":"):
				creator.show_tab(String(o).get_slice(":", 1).to_upper())
		# boss[:<id>][:fight]  a Fracture boss at the crash-site clearing (rift-hound by default); :fight holds fire
		if String(o).begins_with("boss"):
			boss_arena = BossArena.new()
			boss_arena.boss_id = "rift-hound"
			for id in ["crystal-stalker", "abyssal-leviathan", "vyrak", "astravore", "colossus"]:
				if String(o).contains(id):
					boss_arena.boss_id = id
			boss_arena.closed.connect(_close_boss)
			add_child(boss_arena)
			if String(o).contains("fight"):
				boss_arena.controls.scripted = true
				boss_arena.controls.fire = true
				boss_arena.operator.heading = PI
				boss_arena.operator.cam_yaw = 0.0
		# skyways[:heli|:jet|:boat|:sub][:go]  a craft over Nexus City; :go holds throttle and UP
		if String(o).begins_with("skyways"):
			skyways = SkywaysView.new()
			skyways.craft_id = "rift-helicopter"
			for pair in [["jet", "vanguard-jet"], ["boat", "scrap-patrol-boat"], ["sub", "hydro-sub-skiff"], ["airship", "leviathan"]]:
				if String(o).contains(String(pair[0])):
					skyways.craft_id = String(pair[1])
			skyways.closed.connect(_close_skyways)
			add_child(skyways)
			if String(o).contains("go"):
				skyways.controls.scripted = true
				skyways.controls.move = Vector2(0.0, 1.0)
				skyways.controls._brake_held = true
		# killbox[:fracture|:prime|:skydock][:dominion|:freefall|:lockdown|:ascendancy][:fight]  an arena (Kaiju Complex by
		# default) in a mode (Clash by default); :fight sprints and fires
		if String(o).begins_with("killbox"):
			killbox = ArenaView.new()
			killbox.arena_id = "kaiju-complex"
			for mid in ["dominion", "freefall", "lockdown", "ascendancy", "extraction", "ranked"]:
				if String(o).contains(mid):
					killbox.mode_id = mid
			for id in ["fracture-floor", "killbox-prime", "skydock", "neon-yard", "glass-spire", "riverfront", "solara-outpost", "frostveil-ring", "thalassia-dome", "void-rift"]:
				if String(o).contains(String(id).split("-")[0] if id != "killbox-prime" else "prime"):
					killbox.arena_id = id
			killbox.closed.connect(_close_killbox)
			add_child(killbox)
			if String(o).contains("fight"):
				killbox.controls.scripted = true
				if killbox.arena_id == "kaiju-complex":
					killbox.operator.position = Vector3(0, 20, 26)   # the top of the billboard bridge
				killbox.controls.move = Vector2(0.0, 1.0)
				killbox.controls.sprint = true
				killbox.controls.fire = true
		# modes[:pvp|:raids|:races]  the Game Modes hub, or one mode's lobby
		if String(o).begins_with("modes"):
			_open_modes()
			var mm := String(o).split(":")
			if mm.size() > 1:
				modes.open_mode(mm[1])
		# raid[:boss][:fight]  Raid 01 from the gate (or the boss); :fight turns the operator to the fight and fires
		if String(o).begins_with("raid"):
			_open_modes()
			modes.open_mode("raids")
			modes._launch_raid("hollow-star-boss" if String(o).contains("boss") else "broken-gate")
			var rv: Control = modes.view
			if String(o).contains("fight"):
				rv.controls.scripted = true
				rv.controls.fire = true
				rv.autopilot = true
				if String(o).contains("boss"):
					rv.operator.cam_yaw = 0.0
					rv.operator.cam_pitch = 0.12
				else:
					rv.operator.cam_yaw = 0.0
		# street-race[:go]  the Neon Night Circuit; :go skips the lights and drives itself
		if String(o).begins_with("street-race"):
			_open_modes()
			modes.open_mode("races")
			modes._launch_race("neon-circuit")
			if String(o).contains("go"):
				modes.view.countdown = 0.05
				modes.view.controls.scripted = true
				modes.view.autopilot = true
		# race[:go]  Nexus Speedway from the grid; :go skips the lights and holds the throttle
		if String(o).begins_with("race"):
			_open_race()
			if String(o).contains("go"):
				race_view.countdown = 0.05
				race_view.controls.scripted = true
				race_view.autopilot = true
		if String(o).begins_with("char"):
			var c := String(o).split(":")
			var lk := CharacterStore.default_look()
			if c.size() > 1 and c[1] != "":
				lk = CharacterStore.clean({"frame": "goliath" if c[1] != "female" else "nyx", "body": c[1], "face": c[2] if c.size() > 2 else ""}, true)
			if c.size() > 4:
				for kv in c[4].split(","):
					var pair := kv.split("=")
					if pair.size() == 2:
						lk[pair[0]] = Array(pair[1].split("+")) if pair[0] in ["marks", "wear"] else pair[1]
				lk = CharacterStore.clean(lk)
			creator = CharacterCreator.new()
			creator.look = lk
			if c.size() > 3 and c[3] != "":
				creator.tab = c[3].replace("_", " ")
			creator.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			add_child(creator)
		if String(o) == "sat" and region_map:
			region_map.set_satellite(true)
		if String(o).begins_with("zoom:") and region_map:
			region_map.zoom_by(float(String(o).substr(5)))
		# season:0..3 shows the regions in spring / summer / autumn / winter
		if String(o).begins_with("season:"):
			Region3D.season = int(String(o).substr(7))
		# bolt: the region's lightning strikes at once and stays lit (Storm Islands, swamps)
		if String(o) == "bolt":
			preload("res://scripts/region_weather.gd").hold = true
		if String(o) == "3d" and region_map:
			_open_3d(region_map.map_id, null, false)
		if String(o).begins_with("street:") and region_map:
			var p: Dictionary = {}
			for q in Data.map(region_map.map_id).pois:
				if q.id == String(o).substr(7):
					p = q
			_open_3d(region_map.map_id, Vector2(p.x, p.z) if not p.is_empty() else null, true)
	var frames := 150
	for o in opts:
		if String(o).begins_with("frames:"):
			frames = int(String(o).substr(7))
	var perf := ""
	for o in opts:
		if String(o).begins_with("perf:"):
			perf = String(o).substr(5)
	var times: Array[float] = []
	for f in frames:
		var t0 := Time.get_ticks_usec()
		await get_tree().process_frame
		times.append((Time.get_ticks_usec() - t0) / 1000.0)
	if street and street.gunplay:
		print("gunplay: shots ", street.gunplay.shots_fired, " hits ", street.gunplay.hits_landed, " kills ", street.gunplay.kills, " mag ", street.gunplay.gun().ammo_text())
	if descent and descent.enemies:
		print("descent: ", descent.progress, " objective '", descent._objective.text.replace("\n", " / "), "' at ", descent.operator.position.round(), " enemies ", descent.enemies.enemies.size(), " hull ", descent.enemies.hull)
	if boss_arena and boss_arena.boss:
		var br: RefCounted = boss_arena.boss.rules
		print("boss: ", br.id, " hull ", br.hull, "/", br.hull_max, " phase ", br.phase, " step ", br.step, " poise ", br.poise, " at ", boss_arena.boss.position.round(), " operator hull ", boss_arena.enemies.hull, " adds ", boss_arena.enemies.enemies.size())
	if skyways and skyways.state:
		var sk := skyways
		print("skyways: ", sk.craft_id, " speed ", sk.state.speed, " y ", sk.hull.position.y, " airborne ", sk.state.airborne, " at ", sk.hull.position.round(), " pad ", sk.pad.round(), " rings ", sk.next_ring, " hull ", sk.hull_hp)
	if descent and descent.wildlife:
		var wl: Node3D = descent.wildlife
		var counts := {}
		for c in wl.rules.critters:
			counts[c.species] = int(counts.get(c.species, 0)) + 1
		print("wildlife: ", counts, " alive ", wl.rules.alive(), " catches ", wl.rules.catches, " night ", wl.night)
	if killbox and killbox.match_state:
		var kb := killbox
		print("killbox: ", kb.mode_id, " us ", kb.match_state.us, " them ", kb.match_state.them, " clock ", kb.match_state.clock_text(), " zones ", kb.match_state.zones.map(func(z): return [z.id, z.owner]), " rounds ", kb.match_state.us_rounds, "-", kb.match_state.them_rounds, " board ", kb.match_state.board, " at ", kb.operator.position.round(), " bots ", kb.enemies.enemies.size(), " hull ", kb.enemies.hull, " shots ", kb.gunplay.shots_fired, " hits ", kb.gunplay.hits_landed)
	if street and street.district:
		print("district: focus ", street.district.focus_k, " counts ", street.district.counts(), " tiles built ", street.tiles.keys(), " operator z ", street.operator.position.z, " boxes ", street.operator.obstacles.size())
	if modes and modes.view and "raid" in modes.view:
		var rd: Control = modes.view
		print("raid: ", rd.raid.encounter, " pylons ", rd.raid.pylons, " wave ", rd.raid.wave, " boss ", rd.raid.boss_hp, " phase ", rd.raid.phase, " lives ", rd.raid.lives, " hostiles ", rd._hostiles_alive(), " hull ", rd.enemies.hull, " shots ", rd.gunplay.shots_fired, " hits ", rd.gunplay.hits_landed)
	if modes and modes.view and "race" in modes.view and modes.view.race:
		var sr: Control = modes.view
		print("street race: t ", sr.race.time, " speed ", sr.player.speed, " place ", sr.race.position_of(sr.race.player()), " at ", sr.player.node.position.round())
	if race_view and race_view.race:
		var rv := race_view
		print("race: t ", rv.race.time, " player ", rv.player.node.position, " speed ", rv.player.speed, " laps ", rv.race.player().laps, " place ", rv.race.position_of(rv.race.player()), " rivals ", rv.rivals.map(func(r: Dictionary) -> String: return "%s@%.2f" % [r.entry.name, r.entry.frac]))
	if street and street.driving_car:
		print("driving: ", street.driving_car.id, " speed ", street.driving_car.speed, " hits ", street.driving_car.hits, " at ", street.driving_car.node.position, " yaw ", street.driving_car.node.rotation.y)
	if street and street.enemies:
		var st: Array = []
		for e in street.enemies.enemies:
			st.append("%s:%d:%.0f@%s" % [e.type, e.state, e.target.hp, str(e.mover.position.round())])
		print("enemies: hull ", street.enemies.hull, " deaths ", street.enemies.deaths, " kills ", street.enemies.kills, " ", ", ".join(st))
	get_viewport().get_texture().get_image().save_png(path)
	if perf != "":
		_write_perf(perf, opts, times)
	get_tree().quit()

## --shot ... perf:<file.json>: what the last frame cost (draw calls, objects, primitives are what limit a phone; frame
## times on a software renderer only compare scenes with each other)
func _write_perf(file: String, opts: Array, times: Array[float]) -> void:
	var tail := times.slice(maxi(0, times.size() - 30))
	tail.sort()
	var out := {
		"scene": " ".join(opts.filter(func(o): return not String(o).begins_with("perf:") and not String(o).begins_with("frames:"))),
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"nodes": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
		"static_mb": Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0,
		"video_mb": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0,
		"frame_ms_median": tail[tail.size() / 2] if not tail.is_empty() else 0.0,
	}
	out["heaviest"] = _heaviest_geometry()
	out["most_drawn"] = _most_drawn()
	var f := FileAccess.open(file, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(out))

## the scene's biggest triangle counts (whole node, before culling), named by the node and its parent's script
func _heaviest_geometry() -> Array:
	var rows: Array = []
	var stack: Array[Node] = [get_tree().root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		var tris := 0
		var count := 1
		if n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh and (n as MultiMeshInstance3D).multimesh.mesh:
			var mm := (n as MultiMeshInstance3D).multimesh
			tris = _mesh_tris(mm.mesh)
			count = mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count
		elif n is MeshInstance3D and (n as MeshInstance3D).mesh:
			tris = _mesh_tris((n as MeshInstance3D).mesh)
		if tris * count < 20000:
			continue
		var gi := n as GeometryInstance3D
		var owner_script: Script = n.get_parent().get_script() if n.get_parent() else null
		rows.append({"node": "%s/%s" % [owner_script.resource_path.get_file() if owner_script else n.get_parent().name, n.name],
			"tris": tris * count, "per": tris, "count": count, "shadow": gi.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF,
			"range": gi.visibility_range_end})
	rows.sort_custom(func(a, b): return a.tris > b.tris)
	return rows.slice(0, 12)

## separate (non-instanced) mesh nodes grouped by their parent's name and mesh class: what costs draw calls one by one
func _most_drawn() -> Array:
	var groups := {}
	var stack: Array[Node] = [get_tree().root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		if n is MeshInstance3D and (n as MeshInstance3D).mesh and (n as Node3D).is_visible_in_tree():
			var mesh := (n as MeshInstance3D).mesh
			var key := "%s/%s x%d surf" % [n.get_parent().name.left(24), mesh.get_class() if mesh.resource_path == "" else mesh.resource_path.get_file(), mesh.get_surface_count()]
			groups[key] = groups.get(key, 0) + mesh.get_surface_count()
	var rows: Array = []
	for k in groups:
		rows.append({"what": k, "draws": groups[k]})
	rows.sort_custom(func(a, b): return a.draws > b.draws)
	return rows.slice(0, 15)

func _mesh_tris(mesh: Mesh) -> int:
	var t := 0
	for s in mesh.get_surface_count():
		var arr := mesh.surface_get_arrays(s)
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		t += (idx.size() if idx.size() > 0 else (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()) / 3
	return t

func _fit_design_size() -> void:
	var r := get_tree().root
	var sz := Vector2(DisplayServer.window_get_size())
	if sz.x <= 0 or sz.y <= 0:
		return
	var want := Vector2i(1170, 540) if sz.x > sz.y else Vector2i(540, 1170)
	if r.content_scale_size != want:
		r.content_scale_size = want
