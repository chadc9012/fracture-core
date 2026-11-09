extends Control
## The Fracture Descent after Mission 01 (the Dec 4 plan, phase 4): fd-02, fd-03 and fd-04 from the web game's quest chain
## (src/game/quests.ts), played on foot in the Verdant Forest region (region_3d.gd in PLAY mode) with the shared operator,
## guns, troopers and gear. Objectives follow the web's: fd-02 clears five patrols, fd-03 traces the corrupted signal through
## three relays to its source and breaks it, fd-04 walks out to where the treeline ends and the swamp fog begins. Progress
## is user://quests.json (and rides the cloud save); rewards go to the profile as XP and Nex (the web's shards, 1:1).

signal closed

const Region3D := preload("res://scripts/region_3d.gd")
const WildlifeView := preload("res://scripts/wildlife/wildlife_view.gd")
var wildlife: Node3D
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const SAVE := "user://quests.json"
const REGION := "veridan"

## the chain, in the web game's words
const QUESTS := [
	{ "id": "fd-02", "title": "First Resonance", "line": "Past the city limits the Verdant Forest is fractured too — its wildlife corrupted, aggressive, and drawn to you specifically.", "kind": "kills", "amount": 5, "label": "Clear the forest patrols", "xp": 150, "nex": 150 },
	{ "id": "fd-03", "title": "Broken Signal", "line": "The signal isn't natural. Something built it, and it wants you to find the source.", "kind": "trace", "amount": 3, "label": "Trace the corrupted signal", "xp": 200, "nex": 200 },
	{ "id": "fd-04", "title": "Into the Shrouded Swamps", "line": "The treeline ends where the fog begins — the Shrouded Swamps, the forest's corrupted twin.", "kind": "reach", "amount": 1, "label": "Leave the treeline behind", "xp": 120, "nex": 120 },
]

var region: Control
var operator: Node3D
var controls: Control
var gunplay: Node3D
var enemies: Node3D
var progress := { "done": [], "current": "fd-02", "kills": 0, "relay": 0 }
var quest: Dictionary = {}
var waypoint := Vector3.ZERO
var waypoint_node: Node3D
var _objective: Label
var _spawn_t := 0.0
var _rng := RandomNumberGenerator.new()
var _spawn_origin := Vector3.ZERO
var _done_panel: Control
var _dir := Vector3(1, 0, 0)     # the direction the trace and the swamp lie in
var _relays: Array[Vector3] = []
var _edge := Vector3.ZERO

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_rng.seed = 23
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	# the chapter starts at the Fracture Crash Site, in the trees north of the Vanguard outpost
	var start: Vector2 = Vector2(495.0, -235.0)
	for poi in Data.map(REGION).get("pois", []):
		if poi.id == "crash-site":
			start = Vector2(poi.x, poi.z)
	region.show_region(REGION, start, Region3D.Mode.PLAY)
	_load()
	# the operator on the forest floor
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
	enemies = Enemies.new()
	region.world().add_child(enemies)
	enemies.setup(operator, gunplay)
	# the forest's wildlife (scripts/wildlife/): herds, a wolf pack, a bear, a panther, the raptor overhead, water life by the pond
	wildlife = WildlifeView.new()
	region.world().add_child(wildlife)
	wildlife.setup(operator, gunplay, func(x: float, z: float) -> float: return region.ground(x, z), func(x: float, z: float) -> bool: return region.over_water(x, z), 7)
	wildlife.water_level = region.water_level()
	wildlife.night = float(region._style.get("night", 0.0)) > 0.5
	wildlife.populate(Vector2(operator.position.x, operator.position.z))
	enemies.operator_down.connect(func(): _respawn_t = 5.0)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear)
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	gunplay.killed.connect(_on_kill)
	_spawn_origin = operator.position
	# the trace and the swamp edge lie east of where you stand, out toward the map's edge
	_dir = Vector3(1, 0, 0.35).normalized()
	for i in 3:
		_relays.append(_on_ground(_spawn_origin + _dir * (90.0 + i * 110.0) + Vector3(0, 0, (i - 1) * 40.0)))
	_edge = _on_ground(_spawn_origin + _dir * minf(520.0, half - 40.0))
	_objective = Label.new()
	_objective.position = Vector2(16, 60)
	_objective.add_theme_font_size_override("font_size", 16)
	_objective.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_objective.add_theme_constant_override("shadow_offset_x", 1)
	_objective.add_theme_constant_override("shadow_offset_y", 1)
	_objective.modulate = Color(0.95, 0.85, 0.5)
	add_child(_objective)
	var back := Button.new()
	back.text = "← GLOBE"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): _save(); closed.emit())
	add_child(back)
	_begin(progress.current)

## where a downed operator comes back: the last relay locked (not the chapter's start, up to 400 m back)
func _respawn_point() -> Vector3:
	if not quest.is_empty() and String(quest.kind) == "trace" and int(progress.relay) > 0:
		return _on_ground(_relays[mini(int(progress.relay), 3) - 1] - _dir * 15.0)
	if not quest.is_empty() and String(quest.kind) == "reach":
		return _on_ground(_relays[2] - _dir * 15.0)
	return _spawn_origin

func _on_ground(p: Vector3) -> Vector3:
	var half: float = region.span() * 0.5 - 25.0
	var q := Vector3(clampf(p.x, -half, half), 0, clampf(p.z, -half, half))
	q.y = region.ground(q.x, q.z)
	return q

# --------------------------------------------------------------------------------------------- the chain
func _begin(id: String) -> void:
	quest = {}
	for q in QUESTS:
		if q.id == id:
			quest = q
	if quest.is_empty():
		_chapter_done()
		return
	controls.toast("%s · %s" % [String(quest.id).to_upper(), quest.title])
	match String(quest.kind):
		"kills":
			_set_waypoint(Vector3.ZERO, false)
			_spawn_t = 1.0
		"trace":
			_set_waypoint(_relays[mini(int(progress.relay), 2)], true)
			if int(progress.relay) >= 3:
				# picked up at the source (a reload, or back from the globe): its guards are there again
				_spawn_guards()
		"reach":
			_set_waypoint(_edge, true)
	_refresh()

func _set_waypoint(p: Vector3, on: bool) -> void:
	waypoint = p
	if waypoint_node:
		waypoint_node.queue_free()
		waypoint_node = null
	if not on:
		return
	waypoint_node = Node3D.new()
	region.world().add_child(waypoint_node)
	waypoint_node.position = p
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.6
	cm.bottom_radius = 1.2
	cm.height = 60.0
	mi.mesh = cm
	mi.position.y = 30.0
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.6, 0.3, 1.0, 0.35)
	m.emission_enabled = true
	m.emission = Color(0.6, 0.3, 1.0)
	m.emission_energy_multiplier = 2.5
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = m
	waypoint_node.add_child(mi)
	var l := OmniLight3D.new()
	l.light_color = Color(0.6, 0.3, 1.0)
	l.light_energy = 3.0
	l.omni_range = 18.0
	l.position.y = 2.0
	waypoint_node.add_child(l)

func _on_kill(_t: Variant) -> void:
	if quest.is_empty():
		return
	if quest.kind == "kills":
		progress.kills = int(progress.kills) + 1
		if int(progress.kills) >= int(quest.amount):
			_complete()
	_refresh()

var _guards: Array = []      # the source's guards: fd-03 is done when all three are down
var _respawn_t := 0.0

func _complete() -> void:
	var id := String(quest.id)
	if id in progress.done:
		return
	progress.done.append(id)
	var p := Gear.profile_load()
	p.xp = int(p.xp) + int(quest.xp)
	p.nex = int(p.nex) + int(quest.nex)
	while int(p.xp) >= int(p.level) * 1000:
		p.level = int(p.level) + 1
	Gear.profile_save(p)
	controls.toast("%s complete · +%d XP · +%d Nex" % [quest.title, int(quest.xp), int(quest.nex)])
	var i := 0
	for q in QUESTS:
		if q.id == id:
			break
		i += 1
	progress.current = String(QUESTS[i + 1].id) if i + 1 < QUESTS.size() else "done"
	progress.kills = 0
	progress.relay = 0
	_save()
	_begin(progress.current)

func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	_objective.text = "Chapter complete. The Shrouded Swamps come with fd-05."
	if _done_panel:
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -70)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "THE FRACTURE DESCENT\nfd-02 · fd-03 · fd-04 cleared\nThe swamps are next."
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "BACK TO THE GLOBE"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): _save(); closed.emit())
	v.add_child(b)
	add_child(_done_panel)

func _refresh() -> void:
	if quest.is_empty():
		return
	var d := Vector2(waypoint.x - operator.position.x, waypoint.z - operator.position.z).length()
	match String(quest.kind):
		"kills":
			_objective.text = "%s\n%s · %d / %d" % [quest.title, quest.label, int(progress.kills), int(quest.amount)]
		"trace":
			if int(progress.relay) < 3:
				_objective.text = "%s\nRelay %d / 3 · %d m" % [quest.title, int(progress.relay) + 1, int(d)]
			else:
				_objective.text = "%s\nBreak the source: %d / 3 guards down" % [quest.title, _guards_down()]
		"reach":
			_objective.text = "%s\n%s · %d m" % [quest.title, quest.label, int(d)]

# --------------------------------------------------------------------------------------------- the frame
func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	enemies.step(dt)
	if wildlife:
		wildlife.step(dt)
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down)
	if _respawn_t > 0.0:
		_respawn_t -= dt
		if _respawn_t <= 0.0:
			operator.position = _respawn_point()
			operator.velocity = Vector3.ZERO
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if controls.take_next():
		gunplay.next_weapon()
	gunplay.step(dt, region.camera(), controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name()
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text())
	if quest.is_empty():
		return
	match String(quest.kind):
		"kills":
			# patrols come out of the trees two at a time until the count is met
			_spawn_t -= dt
			if _spawn_t <= 0.0 and _alive() < 2 and int(progress.kills) + _alive() < int(quest.amount) + 1:
				_spawn_patrol(_rng.randf() < 0.75)
				_spawn_t = 6.0
		"trace":
			var d := Vector2(waypoint.x - operator.position.x, waypoint.z - operator.position.z).length()
			if int(progress.relay) < 3 and d < 6.0:
				progress.relay = int(progress.relay) + 1
				controls.toast("Relay %d locked · the signal runs on" % int(progress.relay))
				if int(progress.relay) < 3:
					_set_waypoint(_relays[int(progress.relay)], true)
				else:
					_spawn_guards()
					controls.toast("The source is guarded")
				_save()
			elif int(progress.relay) >= 3 and _guards.size() == 3 and _guards_down() >= 3:
				# counted from the guards themselves: the kill counter only catches up on the next enemy step, so
				# checking it from the kill signal missed the third guard and left the chapter stuck
				_complete()
				return
			_refresh()
		"reach":
			var d2 := Vector2(waypoint.x - operator.position.x, waypoint.z - operator.position.z).length()
			if d2 < 8.0:
				_complete()
			elif Engine.get_process_frames() % 15 == 0:
				_refresh()

## the source: a marksman and two scouts guard it (once; they stay down when shot, they don't respawn into it)
func _spawn_guards() -> void:
	if not _guards.is_empty():
		return
	# the marker stays over the source until it's broken (picked up after a reload you start back at the crash site)
	_set_waypoint(_relays[2], true)
	for k in 3:
		var a := k * TAU / 3.0
		var e: RefCounted = enemies.spawn("marksman" if k == 0 else "scout", _on_ground(_relays[2] + Vector3(cos(a), 0, sin(a)) * 12.0))
		e.stays_down = true      # a shot guard stays down (they used to stand again 8 s later)
		_guards.append(e)

func _guards_down() -> int:
	var n := 0
	for e in _guards:
		if e.state == Enemies.State.DOWN or e.fell:
			n += 1
	return n

func _alive() -> int:
	var n := 0
	for e in enemies.enemies:
		if e.state != Enemies.State.DOWN:
			n += 1
	return n

func _spawn_patrol(scout: bool) -> void:
	var a := _rng.randf() * TAU
	var at := _on_ground(operator.position + Vector3(cos(a), 0, sin(a)) * _rng.randf_range(28.0, 42.0))
	var e: RefCounted = enemies.spawn("scout" if scout else "executor", at)
	e.state = Enemies.State.ALERT
	e.timer = 0.3
	_refresh()

# --------------------------------------------------------------------------------------------- saving
func _load() -> void:
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			progress.merge(d, true)
	if progress.current not in ["fd-02", "fd-03", "fd-04", "done"]:
		progress.current = "fd-02"

func _save() -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(progress))

static func chapter_cleared() -> bool:
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if not f:
		return false
	var d: Variant = JSON.parse_string(f.get_as_text())
	return d is Dictionary and d.get("current", "") == "done"
