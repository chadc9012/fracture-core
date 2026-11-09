extends Control
const Progression := preload("res://scripts/progress/progression.gd")
const Sound := preload("res://scripts/audio/sound.gd")
## The Fracture Descent after Mission 01 — Act 1 (schedule step 11): fd-02 to fd-04 in the Verdant Forest (clear the patrols,
## trace the signal, walk to the treeline), fd-05 across the Shrouded Swamps (hold out in the fog, purge the Drowned Relay),
## fd-06 and fd-07 in Neon City (the Blackout Protocol terminal, then the Stitched Neon Core and Vyrak, the act boss). The
## chain, words and rewards are the web game's (src/game/quests.ts; shards 1:1 as XP and Nex). Each quest names its world:
## moving on rebuilds the region (region_3d.gd in PLAY mode) under the same operator, guns, troopers and gear; the
## cutscenes (cutscene.gd) carry the owner's recorded lines — Mara at the crash site, Dr Aris's World Anchor log at the
## terminal, Serik Vale's recording at the core, Vaelith's first contact as the act's last word. Progress is
## user://quests.json (and rides the cloud save).

signal closed

const Region3D := preload("res://scripts/region_3d.gd")
const WildlifeView := preload("res://scripts/wildlife/wildlife_view.gd")
const Cutscene := preload("res://scripts/mission/cutscene.gd")
const BossView := preload("res://scripts/combat/boss_view.gd")
const Boss := preload("res://scripts/combat/boss.gd")
var wildlife: Node3D
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const SAVE := "user://quests.json"
const REGION := "veridan"

## the chain, in the web game's words. `world` is the region (region_3d), `start` the POI the chapter stands at
const QUESTS := [
	{ "id": "fd-02", "title": "First Resonance", "world": "veridan", "start": "crash-site", "line": "Past the city limits the Verdant Forest is fractured too — its wildlife corrupted, aggressive, and drawn to you specifically.", "kind": "kills", "amount": 5, "label": "Clear the forest patrols", "xp": 150, "nex": 150 },
	{ "id": "fd-03", "title": "Broken Signal", "world": "veridan", "start": "crash-site", "line": "The signal isn't natural. Something built it, and it wants you to find the source.", "kind": "trace", "amount": 3, "label": "Trace the corrupted signal", "xp": 200, "nex": 200 },
	{ "id": "fd-04", "title": "Into the Shrouded Swamps", "world": "veridan", "start": "crash-site", "line": "The treeline ends where the fog begins — the Shrouded Swamps, the forest's corrupted twin.", "kind": "reach", "amount": 1, "label": "Leave the treeline behind", "xp": 120, "nex": 120 },
	{ "id": "fd-05", "title": "Crossing the Shrouded Swamps", "world": "swamps", "start": "ss-drowned-ruins", "line": "Bio-tech mutation thick enough to breathe. Something in the reeds is watching you cross.", "kind": "survive", "amount": 90, "label": "Hold out in the fog", "stage2": "Purge the Drowned Relay", "xp": 260, "nex": 260 },
	{ "id": "fd-06", "title": "Signals in the Static", "world": "neon-city", "start": "neon-underground", "line": "Neon City: the Syndicate's corporate war-machine, sold as civilization. You just tripped a wire.", "kind": "hack", "amount": 30, "label": "Pull off the Blackout Protocol", "xp": 220, "nex": 220 },
	{ "id": "fd-07", "title": "Full Lockdown", "world": "neon-city", "start": "aegis-quartermaster", "line": "Full lockdown. Every drone in the district is hunting one signature — a Resonant Carrier. You.", "kind": "core", "amount": 3, "label": "Breach the Stitched Neon Core", "xp": 320, "nex": 320 },
]
const ACT_END := "done"

var region: Control
var operator: Node3D
var controls: Control
var gunplay: Node3D
var enemies: Node3D
var progress := { "done": [], "current": "fd-02", "kills": 0, "relay": 0, "timer": 0.0, "wave": 0, "stage": 0 }
var world_id := ""
var cutscene: Control
var boss: Node3D
var _terminal: Node3D
var _wave_t := 0.0
var _seen := {}           # cutscenes shown this session, by key
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
	_load()
	controls = TouchControls.new()
	var q0 := _quest_def(progress.current)
	_setup_world(String(q0.get("world", REGION)), String(q0.get("start", "crash-site")))
	add_child(controls)
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
	cutscene = Cutscene.new()
	add_child(cutscene)
	_begin(progress.current)

func _quest_def(id: String) -> Dictionary:
	for q in QUESTS:
		if q.id == id:
			return q
	return {}

## the region a quest plays in, with the operator, guns, troopers, gear and (in the wilds) the wildlife on its ground
func _setup_world(world: String, start_poi: String) -> void:
	world_id = world
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	move_child(region, 0)
	var start: Vector2 = Vector2(495.0, -235.0)
	for poi in Data.map(world).get("pois", []):
		if poi.id == start_poi:
			start = Vector2(poi.x, poi.z)
	region.show_region(world, start, Region3D.Mode.PLAY)
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
	enemies.goal_done.connect(func(line: String): controls.toast(line))
	wildlife = null
	if world in ["veridan", "swamps"]:
		# the wilds' wildlife (scripts/wildlife/): herds, a wolf pack, a bear, a panther, the raptor overhead, water life
		wildlife = WildlifeView.new()
		region.world().add_child(wildlife)
		wildlife.setup(operator, gunplay, func(x: float, z: float) -> float: return region.ground(x, z), func(x: float, z: float) -> bool: return region.over_water(x, z), 7)
		wildlife.water_level = region.water_level()
		wildlife.night = float(region._style.get("night", 0.0)) > 0.5
		wildlife.populate(Vector2(operator.position.x, operator.position.z))
	enemies.operator_down.connect(func(): _respawn_t = 5.0)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear) + Progression.hull_bonus(Gear.profile_load())   # armour and level
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	gunplay.killed.connect(_on_kill)
	_spawn_origin = operator.position
	# the trace, the swamp edge, the relay, the terminal and the core all lie out from where you stand, toward the map's edge
	_dir = Vector3(1, 0, 0.35).normalized()
	_relays.clear()
	for i in 3:
		_relays.append(_on_ground(_spawn_origin + _dir * (90.0 + i * 110.0) + Vector3(0, 0, (i - 1) * 40.0)))
	_edge = _on_ground(_spawn_origin + _dir * minf(520.0, half - 40.0))
	_guards.clear()
	_terminal = null
	boss = null
	waypoint_node = null

## where a quest's site stands: out along the chapter's direction, on land, inside the map — the relay 120 m into the
## swamp, the terminal and the core 60 m into the city so they stay among the blocks
func _site(dist: float) -> Vector3:
	# the farthest point along the line whose whole walk from the start stays on land
	var best := _on_ground(_spawn_origin + _dir * 20.0)
	var d := 10.0
	while d <= dist:
		var p := _on_ground(_spawn_origin + _dir * d)
		if region.over_water(p.x, p.z):
			break
		best = p
		d += 10.0
	return best

func _teardown_world() -> void:
	if region:
		region.queue_free()
		region = null
	operator = null
	gunplay = null
	enemies = null
	wildlife = null
	boss = null
	_terminal = null
	waypoint_node = null
	_guards.clear()

## a quest in another region: rebuild the world there (the cutscene, HUD and controls stay)
func _travel(world: String, start_poi: String) -> void:
	_teardown_world()
	_setup_world(world, start_poi)
	Sound.sfx("portal", -4.0)

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
	quest = _quest_def(id)
	if quest.is_empty():
		_chapter_done()
		return
	if String(quest.world) != world_id:
		_travel(String(quest.world), String(quest.start))
	controls.toast("%s · %s" % [String(quest.id).to_upper(), quest.title])
	if id == "fd-02":
		# Mara's crash-site line, recorded (audio/voices)
		Sound.voice("mara-crash-site")
	_opening(id)
	_wave_t = 0.0
	match String(quest.kind):
		"survive":
			if int(progress.stage) == 0:
				_set_waypoint(Vector3.ZERO, false)
				_spawn_t = 2.0
			else:
				_set_waypoint(_site(120.0), true)
				_spawn_guards_at(waypoint)
		"hack":
			_set_waypoint(_site(60.0), true)
			_place_terminal(waypoint)
		"core":
			_set_waypoint(_site(60.0), true)
			_place_terminal(waypoint, true)
			if int(progress.wave) >= int(quest.amount) and boss == null:
				_summon_vyrak()
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
	var res := Progression.grant(p, "quest", int(quest.nex), int(quest.xp), "%s complete" % String(quest.title))
	Gear.profile_save(p)
	# a quest drops from the elite pool
	var gear := Gear.load_save()
	var it := Gear.roll_drop(gear, "elite", randf(), Gear.operator_power(gear, int(p.level)), randi())
	if not it.is_empty():
		Gear.save(gear)
		res.lines.append("LOOT · %s (%d power)" % [String(it.name), int(it.power)])
	for l in res.lines:
		controls.toast(String(l))
	Sound.sfx("confirm", -3.0)
	var i := 0
	for q in QUESTS:
		if q.id == id:
			break
		i += 1
	progress.current = String(QUESTS[i + 1].id) if i + 1 < QUESTS.size() else ACT_END
	progress.kills = 0
	progress.relay = 0
	progress.timer = 0.0
	progress.wave = 0
	progress.stage = 0
	_save()
	_begin(progress.current)

func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	_objective.text = "Act 1 complete."
	if _done_panel:
		return
	if not _seen.has("act-end"):
		_seen["act-end"] = true
		# the act's last word: Vaelith, somewhere in the Ember Peaks (the owner's recording)
		var look := operator.position + Vector3(0, 0, -30)
		cutscene.play([
			Cutscene.beat("NOVA", "Massive life-form on the long-range scan. Thermal reading is impossible. It appears to be burning without consuming oxygen.", 5.0, look, { "orbit": { "radius": 14.0, "height": 6.0, "deg0": 200.0, "deg1": 240.0 } }),
			Cutscene.beat("Vaelith · the Ember Peaks", "", 7.0, look, { "voice": "vaelith-first-contact", "orbit": { "radius": 11.0, "height": 4.0, "deg0": 240.0, "deg1": 290.0 } }),
			Cutscene.beat("NOVA", "That was not a Fracture creature. Act 2 begins at the Ember Peaks.", 4.0, look, { "orbit": { "radius": 16.0, "height": 8.0, "deg0": 290.0, "deg1": 320.0 } }),
		], region.camera())
		cutscene.finished.connect(_chapter_done, CONNECT_ONE_SHOT)
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -70)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "ACT 1 COMPLETE\nfd-02 to fd-07 cleared · Vyrak walks beside you\nAct 2: the Ember Peaks"
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
		"survive":
			if int(progress.stage) == 0:
				_objective.text = "%s\n%s · %d / %d s" % [quest.title, quest.label, int(progress.timer), int(quest.amount)]
			else:
				_objective.text = "%s\n%s · %d / 3 guards down · %d m" % [quest.title, String(quest.stage2), _guards_down(), int(d)]
		"hack":
			_objective.text = "%s\n%s · %d / %d s%s" % [quest.title, quest.label, int(progress.timer), int(quest.amount), "" if d < 9.0 else " · terminal %d m" % int(d)]
		"core":
			if boss:
				_objective.text = "%s\nVYRAK, THE ASHEN COVENANT · break the plates" % quest.title
			else:
				_objective.text = "%s\n%s · wave %d / %d%s" % [quest.title, quest.label, mini(int(progress.wave) + 1, int(quest.amount)), int(quest.amount), "" if d < 14.0 else " · core %d m" % int(d)]

# --------------------------------------------------------------------------------------------- the frame
func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	if region == null or enemies == null:
		return
	if cutscene and cutscene.playing:
		# the scene plays; the world idles under it
		enemies.step(dt)
		if boss:
			boss.step(dt)
		return
	enemies.step(dt)
	if boss:
		boss.step(dt)
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
		"survive":
			if int(progress.stage) == 0:
				# the fog: patrols keep coming out of the reeds until the timer runs out
				progress.timer = float(progress.timer) + dt
				_spawn_t -= dt
				if _spawn_t <= 0.0 and _alive() < 3:
					_spawn_patrol(_rng.randf() < 0.7)
					_spawn_t = 8.0
				if float(progress.timer) >= float(quest.amount):
					progress.stage = 1
					progress.timer = 0.0
					controls.toast("The fog thins · the Drowned Relay is close")
					_set_waypoint(_site(120.0), true)
					_spawn_guards_at(waypoint)
					_save()
				if Engine.get_process_frames() % 10 == 0:
					_refresh()
			elif _guards.size() == 3 and _guards_down() >= 3:
				_complete()
				return
		"hack":
			var d3 := Vector2(waypoint.x - operator.position.x, waypoint.z - operator.position.z).length()
			if d3 < 9.0:
				progress.timer = float(progress.timer) + dt
				_wave_t -= dt
				if _wave_t <= 0.0:
					# the Syndicate's drones answer the breach: heat rises
					_wave_t = 10.0
					progress.wave = int(progress.wave) + 1
					for k in 3:
						var a := _rng.randf() * TAU
						var e: RefCounted = enemies.spawn("drone" if k < 2 else "scout", _on_ground(waypoint + Vector3(cos(a), 0, sin(a)) * 26.0))
						e.state = Enemies.State.ENGAGE
						e.stays_down = true
					controls.toast("HEAT %d · the district answers" % mini(int(progress.wave), 5))
				if float(progress.timer) >= float(quest.amount):
					_hack_done()
					return
			if Engine.get_process_frames() % 10 == 0:
				_refresh()
		"core":
			var d4 := Vector2(waypoint.x - operator.position.x, waypoint.z - operator.position.z).length()
			if boss == null and int(progress.wave) < int(quest.amount) and d4 < 14.0:
				_wave_t -= dt
				if _wave_t <= 0.0 and _alive() == 0:
					progress.wave = int(progress.wave) + 1
					_wave_t = 14.0
					_spawn_core_wave(int(progress.wave))
					controls.toast("LOCKDOWN · wave %d of %d" % [int(progress.wave), int(quest.amount)])
					_save()
			elif boss == null and int(progress.wave) >= int(quest.amount) and _alive() == 0:
				_core_breached()
				return
			if Engine.get_process_frames() % 10 == 0:
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
	var ids: Array[String] = [ACT_END]
	for q in QUESTS:
		ids.append(String(q.id))
	if progress.current not in ids:
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
	return d is Dictionary and d.get("current", "") == ACT_END

# --------------------------------------------------------------------------------------------- Act 1 past the forest
## the openings: a short scene the first time a quest starts this session (the owner's recordings where there is one)
func _opening(id: String) -> void:
	if _seen.has(id) or cutscene == null:
		return
	_seen[id] = true
	var look := operator.position
	match id:
		"fd-05":
			cutscene.play([
				Cutscene.beat("NOVA", String(quest.line), 5.0, look, { "orbit": { "radius": 9.0, "height": 3.0, "deg0": 20.0, "deg1": 70.0 } }),
				Cutscene.beat("NOVA", "Hold out until the fog thins, then find the Drowned Relay. It is what the signal was feeding.", 4.5, look, { "orbit": { "radius": 7.0, "height": 2.5, "deg0": 70.0, "deg1": 110.0 } }),
			], region.camera())
		"fd-06":
			cutscene.play([
				Cutscene.beat("NOVA", String(quest.line), 5.0, look, { "orbit": { "radius": 9.0, "height": 3.5, "deg0": 200.0, "deg1": 250.0 } }),
				Cutscene.beat("NOVA", "The Blackout Protocol terminal is in the Underlink. Stay on it while I pull the archive — the district will notice.", 4.5, look, { "orbit": { "radius": 7.0, "height": 2.5, "deg0": 250.0, "deg1": 290.0 } }),
			], region.camera())
		"fd-07":
			cutscene.play([
				Cutscene.beat("NOVA", String(quest.line), 5.0, look, { "orbit": { "radius": 10.0, "height": 4.0, "deg0": 0.0, "deg1": 50.0 } }),
				Cutscene.beat("NOVA", "The Stitched Neon Core is ahead. Hold the breach through the lockdown; something older than the Syndicate is waiting behind it.", 4.5, look, { "orbit": { "radius": 7.0, "height": 2.5, "deg0": 50.0, "deg1": 90.0 } }),
			], region.camera())

## the relay's guards (fd-05) stand around the given point: a marksman and two scouts, down for good when shot
func _spawn_guards_at(at: Vector3) -> void:
	if not _guards.is_empty():
		return
	for k in 3:
		var a := k * TAU / 3.0
		var e: RefCounted = enemies.spawn("marksman" if k == 0 else "scout", _on_ground(at + Vector3(cos(a), 0, sin(a)) * 12.0))
		e.stays_down = true
		_guards.append(e)

## the terminal (fd-06) or the core (fd-07): a pillar with a lit face
func _place_terminal(at: Vector3, core := false) -> void:
	if _terminal:
		return
	_terminal = Node3D.new()
	region.world().add_child(_terminal)
	_terminal.position = at
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.6, 2.6, 0.8) if not core else Vector3(4.0, 7.0, 4.0)
	mi.mesh = bm
	mi.position.y = bm.size.y * 0.5
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.12, 0.12, 0.16)
	m.metallic = 0.6
	m.roughness = 0.35
	mi.material_override = m
	_terminal.add_child(mi)
	var face := MeshInstance3D.new()
	var fm := BoxMesh.new()
	fm.size = Vector3(1.2, 0.8, 0.1) if not core else Vector3(3.2, 5.0, 0.2)
	face.mesh = fm
	face.position = Vector3(0, bm.size.y * 0.6, bm.size.z * 0.5 + 0.02)
	var em := StandardMaterial3D.new()
	em.albedo_color = Color(0.1, 0.9, 1.0) if not core else Color(1.0, 0.3, 0.6)
	em.emission_enabled = true
	em.emission = em.albedo_color
	em.emission_energy_multiplier = 3.0
	face.material_override = em
	_terminal.add_child(face)
	var l := OmniLight3D.new()
	l.light_color = em.albedo_color
	l.light_energy = 2.5
	l.omni_range = 14.0
	l.position.y = bm.size.y * 0.7
	_terminal.add_child(l)
	operator.obstacles.append(AABB(at + Vector3(-bm.size.x * 0.5, 0, -bm.size.z * 0.5), bm.size))

## fd-06 done: the terminal gives up Dr Aris's World Anchor log (the owner's recording), then the quest pays
func _hack_done() -> void:
	if _seen.has("fd-06-log"):
		return
	_seen["fd-06-log"] = true
	var look: Vector3 = waypoint
	cutscene.play([
		Cutscene.beat("NOVA", "Archive open. One file survived the purge: a research log, stamped World Anchor Project.", 4.0, look, { "orbit": { "radius": 7.0, "height": 2.5, "deg0": 180.0, "deg1": 220.0 }, "look_up": 1.8 }),
		Cutscene.beat("Dr Aris · World Anchor log", "", 9.0, look, { "voice": "dr-aris-world-anchor-log", "orbit": { "radius": 5.5, "height": 2.0, "deg0": 220.0, "deg1": 270.0 }, "look_up": 1.8 }),
		Cutscene.beat("NOVA", "So the Fracture was anchored on purpose. Somebody built the thing that broke the world.", 4.0, look, { "orbit": { "radius": 8.0, "height": 3.0, "deg0": 270.0, "deg1": 300.0 }, "look_up": 1.8 }),
	], region.camera())
	cutscene.finished.connect(_complete, CONNECT_ONE_SHOT)

## fd-07: the lockdown's waves at the core, heavier each time
func _spawn_core_wave(n: int) -> void:
	var roster: Array = [["drone", "drone", "scout"], ["scout", "scout", "marksman", "drone"], ["elite", "marksman", "scout", "drone", "drone"]]
	var types: Array = roster[clampi(n - 1, 0, roster.size() - 1)]
	for k in types.size():
		var a := _rng.randf() * TAU
		var e: RefCounted = enemies.spawn(String(types[k]), _on_ground(waypoint + Vector3(cos(a), 0, sin(a)) * _rng.randf_range(22.0, 32.0)))
		e.state = Enemies.State.ENGAGE
		e.stays_down = true      # a wave is beaten when it is down, it does not stand again

## the core breached: Serik Vale's recording (the owner's), then Vyrak drops in — the act boss
func _core_breached() -> void:
	if _seen.has("fd-07-core"):
		return
	_seen["fd-07-core"] = true
	var look: Vector3 = waypoint
	cutscene.play([
		Cutscene.beat("NOVA", "Core open. There is a recording wired into it — Vanguard, old. Serik Vale.", 4.0, look, { "orbit": { "radius": 12.0, "height": 4.0, "deg0": 160.0, "deg1": 200.0 }, "look_up": 3.0 }),
		Cutscene.beat("Serik Vale · recording", "", 9.0, look, { "voice": "serik-vale-warning", "orbit": { "radius": 9.0, "height": 3.5, "deg0": 200.0, "deg1": 250.0 }, "look_up": 3.0 }),
		Cutscene.beat("Serik Vale · recording", "If the Anchor wakes again, don't let the system make the choice for you.", 4.0, look, { "orbit": { "radius": 9.0, "height": 3.5, "deg0": 250.0, "deg1": 280.0 }, "look_up": 3.0 }),
		Cutscene.beat("Vyrak", "Another small thing with a borrowed spark. Show me why the Fracture chose you.", 5.0, look + Vector3(0, 0, -20), { "orbit": { "radius": 16.0, "height": 5.0, "deg0": 60.0, "deg1": 110.0 }, "look_up": 2.5 }),
		Cutscene.beat("NOVA", "Its armor sheds under heat. Break the chest plates and the core is exposed.", 4.0, look + Vector3(0, 0, -20), { "orbit": { "radius": 12.0, "height": 4.0, "deg0": 110.0, "deg1": 140.0 }, "look_up": 2.5 }),
	], region.camera())
	_summon_vyrak()
	cutscene.finished.connect(func(): controls.toast("VYRAK, THE ASHEN COVENANT"), CONNECT_ONE_SHOT)

func _summon_vyrak() -> void:
	if boss:
		return
	boss = BossView.new()
	region.world().add_child(boss)
	var at := _on_ground(waypoint + Vector3(0, 0, -20.0))
	boss.setup("vyrak", at, operator, gunplay, enemies, operator.ground_at)
	boss.obstacles = operator.obstacles
	boss.heading = PI
	boss.toast = func(t: String) -> void: controls.toast(t)
	boss.killed.connect(_on_vyrak_down)
	Sound.sfx("roar", -2.0)

## Vyrak down: the Covenant — it chooses to walk beside you (dragon-covenant.ts); the boss pays as a Rift Gate clear too
func _on_vyrak_down(_id: String, reward: Dictionary) -> void:
	var p := Gear.profile_load()
	var clears: Dictionary = p.get("boss_clears", {})
	var first: bool = not clears.has("vyrak")
	var res := Progression.grant(p, "boss", int(reward.nex) / (1 if first else 3), int(reward.xp) / (1 if first else 3), "Vyrak, the Ashen Covenant")
	clears["vyrak"] = int(clears.get("vyrak", 0)) + 1
	p.boss_clears = clears
	Gear.profile_save(p)
	for l in res.lines:
		controls.toast(String(l))
	var look: Vector3 = boss.position
	cutscene.play([
		Cutscene.beat("Vyrak", "Enough. You fight like one who will not be ruled. Then I will not rule you — I will walk beside you.", 6.0, look, { "orbit": { "radius": 14.0, "height": 5.0, "deg0": 40.0, "deg1": 100.0 }, "look_up": 2.0 }),
		Cutscene.beat("NOVA", "Its mass is collapsing… it's choosing a smaller form. I think it just joined us.", 4.5, look, { "orbit": { "radius": 10.0, "height": 3.5, "deg0": 100.0, "deg1": 150.0 }, "look_up": 2.0 }),
	], region.camera())
	cutscene.finished.connect(_complete, CONNECT_ONE_SHOT)
