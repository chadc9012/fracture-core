extends Control
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
	var bg := ColorRect.new()
	bg.color = Data.BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
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
	var fd := Data.button("▶ FRACTURE DESCENT · fd-02…04", true)
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
	# onboarding: the first launch starts in the operator creator
	if not CharacterStore.exists() and OS.get_cmdline_user_args().find("--shot") < 0:
		_open_creator.call_deferred(true)
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
func _open_street(night := false, style := "nexus", walk := true) -> void:
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
	add_child(street)
	planet_view.set_process(false)

func _close_street() -> void:
	if street:
		street.queue_free()
		street = null
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

## the Killbox: Kaiju Complex, Clash against bots (scripts/killbox/)
func _open_killbox() -> void:
	if killbox:
		return
	killbox = ArenaView.new()
	killbox.closed.connect(_close_killbox)
	add_child(killbox)

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
		# slice[night][coast|neon][walk][garage]  the street slice as a look-dev shot (fixed camera), or on foot with "walk"
		if String(o).begins_with("slice"):
			_open_street(String(o).contains("night"), "coast" if String(o).contains("coast") else ("neon" if String(o).contains("neon") else "nexus"), String(o).contains("walk"))
			# slicewalk:run holds the stick forward-right with sprint for the shot; slicewalk:jump also jumps once
			if String(o).contains("walk:"):
				street.controls.scripted = true
				street.controls.move = Vector2(0.35, 1.0) if String(o).contains("run") else Vector2(0.0, 1.0)
				street.controls.sprint = String(o).contains("run")
				if String(o).contains("jump"):
					street.controls._jump = true
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
				var nearest: Node3D = null
				for c in street.parked:
					if nearest == null or c.position.distance_to(street.operator.position) < nearest.position.distance_to(street.operator.position):
						nearest = c
				street.enter_car(nearest)
				street.controls.move = Vector2(-0.12, 1.0)   # pull out toward the road
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
		# casino[:view]  the Skyline Casino: 0-3 the floor, 4-6 the penthouse, 7-8 the skydeck concert
		if String(o).begins_with("casino"):
			_open_street(false, "nexus", false)
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
		# descent[:fight]  the Fracture Descent in the Verdant Forest; :fight sprints and fires
		if String(o).begins_with("descent"):
			_open_descent()
			if String(o).contains("fight"):
				descent.controls.scripted = true
				descent.controls.move = Vector2(0.0, 1.0)
				descent.controls.sprint = true
				descent.controls.fire = true
		# killbox[:fracture|:prime|:skydock][:fight]  Kaiju Complex (or Fracture Floor / Killbox Prime), Clash; :fight sprints and fires
		if String(o).begins_with("killbox"):
			killbox = ArenaView.new()
			killbox.arena_id = "kaiju-complex"
			for id in ["fracture-floor", "killbox-prime", "skydock"]:
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
						lk[pair[0]] = Array(pair[1].split("+")) if pair[0] == "marks" else pair[1]
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
	for f in frames:
		await get_tree().process_frame
	if street and street.gunplay:
		print("gunplay: shots ", street.gunplay.shots_fired, " hits ", street.gunplay.hits_landed, " kills ", street.gunplay.kills, " mag ", street.gunplay.gun().ammo_text())
	if descent and descent.enemies:
		print("descent: ", descent.progress, " objective '", descent._objective.text.replace("\n", " / "), "' at ", descent.operator.position.round(), " enemies ", descent.enemies.enemies.size(), " hull ", descent.enemies.hull)
	if killbox and killbox.match_state:
		var kb := killbox
		print("killbox: us ", kb.match_state.us, " them ", kb.match_state.them, " clock ", kb.match_state.clock_text(), " at ", kb.operator.position.round(), " bots ", kb.enemies.enemies.size(), " hull ", kb.enemies.hull, " shots ", kb.gunplay.shots_fired, " hits ", kb.gunplay.hits_landed)
	if street and street.district:
		print("district: focus ", street.district.focus_k, " counts ", street.district.counts(), " tiles built ", street.tiles.keys(), " operator z ", street.operator.position.z, " boxes ", street.operator.obstacles.size())
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
	get_tree().quit()
