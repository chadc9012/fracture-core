extends Control
## Fracture Royale (pvp.ts "royale", the one web mode that had no Godot rules): twenty squads of three on open ground —
## the Verdant Forest around a circle that closes in five phases (killbox_match.gd kind "royale"). You and two ally
## bots drop at the circle's edge; a fresh rival squad lands at the edge every WAVE_EVERY s out of sight (the sixty
## players, three at a time on the field, as the web plays it); nobody respawns. Outside the circle the fracture
## burns everyone by phase. Your death places you by the squads still up; the last squad standing wins. The purse is
## the Killbox's (a win 250 + 25 a kill, a loss 100 + 15), paid through Progression.

signal closed

const Region3D := preload("res://scripts/region_3d.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Arena := preload("res://scripts/killbox/arena.gd")
const Match := preload("res://scripts/killbox/killbox_match.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Phone := preload("res://scripts/phone.gd")
const Loot := preload("res://scripts/killbox/royale_loot.gd")
const Rides := preload("res://scripts/killbox/royale_rides.gd")
const Kit := preload("res://scripts/killbox/royale_kit.gd")

const WORLD := "veridan"
const SQUAD_TYPES := ["scout", "marksman", "executor"]
const WALL_H := 60.0

var region: Control
var operator: Node3D
var controls: Control
var gunplay: Node3D
var enemies: Node3D
var match_state: Match
var centre := Vector2.ZERO
var hud: Label
var _wall: MeshInstance3D
var _ring: MeshInstance3D
var _rng := RandomNumberGenerator.new()
var _paid := false
var _done_panel: Control
var _burn := 0.0
var _allies: Array = []
## the battle-royale layer (owner, Nov 22): you ride a dropship over the circle, jump, fall and open a canopy; you land
## with a sidearm and no armour, and the field's loot (royale_loot.gd) is how you arm up. A supply drop comes down every
## SUPPLY_EVERY s. `drop_in` false starts on the ground at the circle's edge (the play test's opening).
const SHIP_ALT := 150.0
const SHIP_V := 42.0
const FALL_V := 40.0
const CHUTE_V := 7.0
const CHUTE_AT := 55.0
const WING_V := 34.0            # the wingsuit's speed over the ground, and how fast it sinks
const WING_SINK := 11.0
const WING_CHUTE_AT := 38.0     # the canopy opens itself this low out of a wingsuit glide
const CHUTE_GLIDE := 12.0
const CUT_MIN := 25.0           # no cutting the canopy away below this
const ROUND_GLIDE := 4.0        # the standard round canopy: a slow drift, a steady sink
const ROUND_V := 7.5
const SUPPLY_EVERY := 75.0
var drop_in := true
var loot: Loot
var phase := ""               # ship | fall | chute | "" (on the ground)
var _ship: Node3D
var _ship_dir := Vector2.RIGHT
var _ship_pos := Vector3.ZERO
var _ship_run := 0.0
var _fall_v := Vector3.ZERO
var _canopy: Node3D
var _wings: MeshInstance3D
var _chute_yaw := 0.0
var wingsuit := false
## the drop kit (royale_kit.gd): the sport canopy and the wingsuit are bought; `show_kit` puts the kit screen up
## before the dropship flies (the ship holds until DEPLOY)
var kit: Dictionary = Kit.load_kit()
var show_kit := true
var _kit_panel: Control
var _cam_dist0 := 4.2
var _supply_t := SUPPLY_EVERY
var _feed: VBoxContainer
var _heal: Button
var _banner: Label
## the squad game: every rival squad is a team of its own (they fight each other as well as you), two land per wave
## while the field has room; a squadmate who goes down leaves a beacon you can stand on to bring them back, and when
## you go down with a squadmate still up you are knocked, not out — they come for you.
const FIELD_MAX := 15          # rivals on the field before a wave lands a single squad
const REVIVE_S := 4.0
const REVIVE_R := 2.2
const BEACON_S := 60.0
const BLEED_S := 14.0
const PICKUP_S := 3.0
var rides: Rides
var _gps: Control
var _next_team := 2
var _beacons: Array = []       # { e, node, left, prog }
var knocked := 0.0             # seconds left to be picked up; 0 = on your feet
var _pickup := 0.0
var revives := 0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_rng.seed = int(Time.get_unix_time_from_system()) % 100000
	match_state = Match.new(Arena.mode("royale"), [])
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	region.show_region(WORLD, null, Region3D.Mode.PLAY)
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	region.world().add_child(operator)
	var half: float = region.span() * 0.5 - 20.0
	operator.bounds = Rect2(-half, -half, half * 2.0, half * 2.0)
	operator.ground_at = func(x: float, z: float) -> float: return region.ground(x, z)
	operator.obstacles = region.building_boxes()
	operator.civilian = false
	operator.build()
	operator.attach_camera(region.camera())
	region.camera().current = true
	_gps = preload("res://scripts/nav/gps.gd").attach(self, region, operator)   # the GPS (owner, Nov 18)
	gunplay = Gunplay.new()
	region.world().add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	enemies = Enemies.new()
	region.world().add_child(enemies)
	enemies.setup(operator, gunplay)
	enemies.tactics = false     # PvP bots play like players (killbox-bots), not as a squad with fire tokens
	enemies.operator_team = 1
	enemies.respawn_enabled = false
	enemies.operator_down.connect(_on_operator_down)
	enemies.bot_down.connect(_on_bot_down)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear) + Progression.hull_bonus(Gear.profile_load())
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	gunplay.set_holstered(false)
	controls.set_armed(true)
	# everyone lands the same: a common sidearm, a full hull, no armour (plates are found), nothing regenerates
	gunplay.guns.clear()
	gunplay.guns.append(Loot.make_gun("SIDEARM", "common"))
	gunplay.current = 0
	gunplay._show_current()
	enemies.shield_max = Loot.PLATES_MAX
	enemies.shield = 0.0
	enemies.since_hit = 0.0
	# the circle: the first phase's radius round the stand point, kept inside the map; the squad lands at its edge
	var sp: Vector3 = region.stand_point()
	var r0 := Match.START_RADIUS
	centre = Vector2(clampf(sp.x, -half + r0, half - r0), clampf(sp.z, -half + r0, half - r0))
	# land in a gap between the trees: the bearing (of 24, from a random start) whose landing spot stands furthest from
	# any trunk — a squad dropped straight into a tree put the camera inside its crown (Nov 18)
	var a0 := _rng.randf() * TAU
	var a := a0
	var best := -1.0
	var trees: PackedVector2Array = region._tree_pts
	for k in 24:
		var ak := a0 + k * TAU / 24.0
		var q := centre + Vector2(cos(ak), sin(ak)) * (r0 - 12.0)
		var near := 99.0
		for tp in trees:
			if absf(tp.x - q.x) < 12.0 and absf(tp.y - q.y) < 12.0:
				near = minf(near, tp.distance_to(q))
		if near > best:
			best = near
			a = ak
		if best >= 9.0:
			break
	operator.position = _ground(centre + Vector2(cos(a), sin(a)) * (r0 - 12.0))
	loot = Loot.new()
	loot.ground_at = func(x: float, z: float) -> float: return region.ground(x, z)
	region.world().add_child(loot)
	loot.scatter(centre, r0, operator.obstacles)
	rides = Rides.new()
	rides.scatter(region.world(), centre, r0, _rng, operator.ground_at, operator.obstacles)
	# on the dial: the circle, the vehicles (white), the chests (gold)
	_gps.rings = [{ "p": centre, "r": r0, "color": Color(0.9, 0.5, 1.0) }]
	for c in rides.parked:
		_gps.marks.append({ "node": c, "p": Vector2.ZERO, "color": Color(0.95, 0.95, 1.0) })
	for it in loot.items:
		if it.kind == "chest":
			_gps.marks.append({ "node": it.node, "p": Vector2.ZERO, "color": Color(1.0, 0.72, 0.2) })
	if drop_in:
		_begin_drop()
	else:
		_land_squad()
	_build_circle()
	hud = Label.new()
	hud.position = Vector2(16, 118)   # under the hull bar, the weapon line and the ammo (touch_controls.gd)
	hud.add_theme_font_size_override("font_size", 22)
	hud.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	hud.add_theme_constant_override("shadow_offset_x", 1)
	hud.add_theme_constant_override("shadow_offset_y", 1)
	add_child(hud)
	var back := Button.new()
	back.text = "← LEAVE"
	back.position = Vector2(250, 8)   # right of the hull bar: the top left is the bar, the weapon line and the ammo
	back.custom_minimum_size = Vector2(96, 40)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	# the count everyone watches, top centre; the kill feed under the right edge; the med kit button
	_banner = Label.new()
	_banner.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_banner.position = Vector2(-220, 10)
	_banner.custom_minimum_size = Vector2(440, 0)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_theme_font_size_override("font_size", 30)
	_banner.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_banner.add_theme_constant_override("outline_size", 6)
	add_child(_banner)
	_feed = VBoxContainer.new()
	_feed.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_feed.position = Vector2(-380, 150)
	_feed.custom_minimum_size = Vector2(360, 0)
	_feed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_feed)
	_heal = Button.new()
	_heal.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_heal.position = Vector2(300, -90)
	_heal.custom_minimum_size = Vector2(130, 60)
	_heal.focus_mode = Control.FOCUS_NONE
	_heal.pressed.connect(func():
		if loot.heal(enemies):
			controls.toast("Med kit used"))
	add_child(_heal)
	Sound.ambience("forest")
	controls.toast("FRACTURE ROYALE · %d squads · %s" % [match_state.squads(), "JUMP when you are ready" if drop_in else "stay inside the circle"])

## the squad on the ground: two allies beside you, the first rivals at the far edge
func _land_squad() -> void:
	for i in 2:
		var at := _ground(Vector2(operator.position.x, operator.position.z) + Vector2(cos(1.3 + i * 1.6), sin(1.3 + i * 1.6)) * 4.0)
		var e: RefCounted = enemies.spawn(SQUAD_TYPES[i], at, [], 1)
		e.state = Enemies.State.ENGAGE
		_allies.append(e)
	_wave()

## a line in the kill feed, gone after a few seconds
func feed(text: String, col := Color(1, 1, 1)) -> void:
	if _feed == null:
		return
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	l.add_theme_font_size_override("font_size", 18)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("outline_size", 4)
	_feed.add_child(l)
	if _feed.get_child_count() > 5:
		_feed.get_child(0).queue_free()
	var tw := l.create_tween()
	tw.tween_interval(5.0)
	tw.tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)

# ------------------------------------------------------------------------------------------------ the drop

func _begin_drop() -> void:
	phase = "kit" if show_kit else "ship"
	var a := _rng.randf() * TAU
	_ship_dir = Vector2(cos(a), sin(a))
	var reach := Match.START_RADIUS * 0.95
	var gy: float = region.ground(centre.x, centre.y)
	_ship_pos = Vector3(centre.x - _ship_dir.x * reach, gy + SHIP_ALT, centre.y - _ship_dir.y * reach)
	_ship_run = 0.0
	_ship = Node3D.new()
	region.world().add_child(_ship)
	var path := "res://models/fleet/craft/horizon-dropship.glb"
	if ResourceLoader.exists(path):
		var m := (load(path) as PackedScene).instantiate() as Node3D
		_ship.add_child(m)
		# fitted to 22 m, whatever the model's own size
		var box := AABB()
		var first := true
		for mi in m.find_children("*", "MeshInstance3D", true, false):
			var b: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
			box = b if first else box.merge(b)
			first = false
		var longest := maxf(box.size.x, box.size.z)
		if longest > 0.01:
			m.scale = Vector3.ONE * (22.0 / longest)
			m.position = -box.get_center() * (22.0 / longest)
	_ship.position = _ship_pos
	_ship.rotation.y = atan2(_ship_dir.x, _ship_dir.y)
	operator.rig.visible = false
	_cam_dist0 = operator.cam_dist
	operator.cam_dist = 20.0
	operator.cam_yaw = atan2(-_ship_dir.x, -_ship_dir.y)
	operator.cam_pitch = -0.3
	operator.position = _ship_pos
	controls.set_armed(false)
	gunplay.set_holstered(true)
	Sound.loop("royale_ship", "jet", -10.0, 0.7)
	if show_kit:
		_open_kit()

## the drop kit screen: what you own, what you can buy with your Nex, and DEPLOY
func _open_kit() -> void:
	if _kit_panel:
		_kit_panel.queue_free()
	var p := Gear.profile_load()
	_kit_panel = PanelContainer.new()
	_kit_panel.set_anchors_preset(Control.PRESET_CENTER)
	_kit_panel.custom_minimum_size = Vector2(820, 0)
	_kit_panel.position = Vector2(-410, -250)
	var skin := StyleBoxFlat.new()
	skin.bg_color = Color(0.04, 0.05, 0.08, 0.94)     # solid: the dropship behind it was showing through the title
	skin.border_color = Color(0.75, 0.3, 1.0)
	skin.set_border_width_all(2)
	skin.set_corner_radius_all(8)
	_kit_panel.add_theme_stylebox_override("panel", skin)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	var pad := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		pad.add_theme_constant_override("margin_" + side, 18)
	pad.add_child(v)
	_kit_panel.add_child(pad)
	var title := Label.new()
	title.text = "DROP KIT   ·   %d Nex" % int(p.get("nex", 0))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 32)
	v.add_child(title)
	for id: String in Kit.ORDER:
		var it: Dictionary = Kit.ITEMS[id]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		var text := Label.new()
		text.text = "%s\n%s" % [String(it.name).to_upper(), String(it.blurb)]
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		text.add_theme_font_size_override("font_size", 21)
		row.add_child(text)
		var b := Button.new()
		b.custom_minimum_size = Vector2(230, 72)
		b.add_theme_font_size_override("font_size", 22)
		b.focus_mode = Control.FOCUS_NONE
		if Kit.owns(kit, id):
			b.text = "OWNED"
			b.disabled = true
		else:
			b.text = "BUY · %d Nex" % int(it.price)
			b.pressed.connect(func():
				var prof := Gear.profile_load()
				var line := Kit.buy(kit, prof, id)
				if Kit.owns(kit, id):
					Kit.save_kit(kit)
					Gear.profile_save(prof)
					Sound.sfx("confirm", -6.0)
				else:
					Sound.sfx("buzzer", -8.0)
				controls.toast(line)
				_open_kit())
		row.add_child(b)
		v.add_child(row)
	var go := Button.new()
	go.text = "DEPLOY"
	go.custom_minimum_size = Vector2(0, 76)
	go.focus_mode = Control.FOCUS_NONE
	go.add_theme_font_size_override("font_size", 30)
	go.pressed.connect(func():
		_kit_panel.queue_free()
		_kit_panel = null
		phase = "ship"
		controls.toast("JUMP when you are ready"))
	v.add_child(go)
	add_child(_kit_panel)

func _jump() -> void:
	phase = "fall"
	_fall_v = Vector3(_ship_dir.x, 0, _ship_dir.y) * SHIP_V * 0.5 + Vector3(0, -4.0, 0)
	operator.rig.visible = true
	operator.cam_dist = 8.0
	Sound.sfx("jump", -4.0)
	controls.toast(("Hold RUN for the wingsuit · " if Kit.owns(kit, "wingsuit") else "") + ("JUMP opens the canopy" if Kit.owns(kit, "canopy-sport") else "the canopy opens at %d m" % int(CHUTE_AT)))

## the wingsuit's membranes, on the rig (arm to hip each side, between the legs): shown while you hold RUN in the fall
func _build_wings() -> void:
	_wings = MeshInstance3D.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tris := [
		# a wing each side, shoulder out to the tip and back in to the hip (wider than the arms: it reads from far behind)
		Vector3(0.15, 1.5, 0), Vector3(1.55, 1.15, 0), Vector3(0.2, 0.8, 0),
		Vector3(-0.15, 1.5, 0), Vector3(-0.2, 0.8, 0), Vector3(-1.55, 1.15, 0),
		# the tail wing between the legs
		Vector3(-0.22, 0.9, 0), Vector3(0.22, 0.9, 0), Vector3(0.5, 0.02, 0),
		Vector3(-0.22, 0.9, 0), Vector3(0.5, 0.02, 0), Vector3(-0.5, 0.02, 0),
	]
	for v: Vector3 in tris:
		st.set_normal(Vector3(0, 0, -1))
		st.add_vertex(v + Vector3(0, 0, -0.06))
	_wings.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.75, 0.3, 1.0)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.roughness = 0.7
	m.emission_enabled = true
	m.emission = Color(0.75, 0.3, 1.0)
	m.emission_energy_multiplier = 0.25
	_wings.material_override = m
	_wings.visible = false
	operator.rig.add_child(_wings)

## a ram-air canopy: nine cells in an arc, striped, its lines down to the shoulders
func _open_canopy() -> void:
	phase = "chute"
	wingsuit = false
	if _wings:
		_wings.visible = false
	operator.rig.rotation.x = 0.0
	var flat := Vector2(_fall_v.x, _fall_v.z)
	_chute_yaw = atan2(flat.x, flat.y) if flat.length() > 3.0 else operator.heading
	_canopy = Node3D.new()
	operator.add_child(_canopy)
	if not Kit.owns(kit, "canopy-sport"):
		_round_canopy()
		_canopy.rotation.y = _chute_yaw
		Sound.sfx("grapple", -6.0)
		return
	var radius := 5.2
	var top := 6.4
	var stripe := StandardMaterial3D.new()
	stripe.albedo_color = Color(0.75, 0.3, 1.0)
	stripe.roughness = 0.8
	var pale := StandardMaterial3D.new()
	pale.albedo_color = Color(0.93, 0.92, 0.96)
	pale.roughness = 0.8
	var line_mat := StandardMaterial3D.new()
	line_mat.albedo_color = Color(0.1, 0.1, 0.12)
	for k in 9:
		var th := (float(k) - 4.0) * 0.115
		var cell := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.62, 0.2, 2.5)
		cell.mesh = bm
		cell.position = Vector3(sin(th) * radius, top - (1.0 - cos(th)) * radius, 0.0)
		cell.rotation.z = -th
		cell.material_override = stripe if k % 2 == 0 else pale
		_canopy.add_child(cell)
		if k % 2 == 0:
			for fz: float in [-1.1, 1.1]:
				var from: Vector3 = cell.position + Vector3(0, -0.1, fz)
				var to := Vector3(signf(th) * 0.2 if k != 4 else 0.0, 1.5, 0.0)
				var line := MeshInstance3D.new()
				var lm := BoxMesh.new()
				lm.size = Vector3(0.02, 0.02, from.distance_to(to))
				line.mesh = lm
				line.material_override = line_mat
				line.position = (from + to) * 0.5
				_canopy.add_child(line)
				line.look_at_from_position(line.position, to, Vector3.UP)
	_canopy.rotation.y = _chute_yaw
	Sound.sfx("grapple", -6.0)

## the standard-issue canopy: an olive dome on eight lines
func _round_canopy() -> void:
	var dome := SphereMesh.new()
	dome.radius = 2.7
	dome.height = 2.3
	dome.is_hemisphere = true
	dome.radial_segments = 16
	dome.rings = 6
	var mi := MeshInstance3D.new()
	mi.mesh = dome
	mi.position = Vector3(0, 5.2, 0)
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.42, 0.46, 0.3)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.roughness = 0.9
	mi.material_override = m
	_canopy.add_child(mi)
	var lm := StandardMaterial3D.new()
	lm.albedo_color = Color(0.1, 0.1, 0.12)
	for k in 8:
		var a := TAU * k / 8.0
		var from := Vector3(cos(a) * 2.6, 5.25, sin(a) * 2.6)
		var to := Vector3(0, 1.5, 0)
		var line := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.02, 0.02, from.distance_to(to))
		line.mesh = bm
		line.material_override = lm
		line.position = (from + to) * 0.5
		_canopy.add_child(line)
		line.look_at_from_position(line.position, to, Vector3.UP)

## let the canopy go and fall again (JUMP under it, with height to spare)
func _cut_away() -> void:
	if _canopy:
		_canopy.queue_free()
		_canopy = null
	phase = "fall"
	Sound.sfx("jump", -6.0)

func _land() -> void:
	phase = ""
	operator.position.y = region.ground(operator.position.x, operator.position.z)
	operator.velocity = Vector3.ZERO
	operator.rig.rotation.x = 0.0
	operator.rig.rotation.z = 0.0
	wingsuit = false
	if _wings:
		_wings.visible = false
	operator.cam_dist = _cam_dist0
	if _canopy:
		_canopy.queue_free()
		_canopy = null
	controls.set_armed(true)
	gunplay.set_holstered(false)
	Sound.sfx("land", -2.0)
	_land_squad()
	controls.toast("You are down · find a gun")

func _step_drop(dt: float) -> void:
	var look: Vector2 = controls.take_look()
	operator.cam_yaw -= look.x * 0.0045
	operator.cam_pitch = clampf(operator.cam_pitch - look.y * 0.0035, -0.9, 0.45)
	var jump: bool = controls.take_jump() or controls.take_enter()
	var gy: float = region.ground(operator.position.x, operator.position.z)
	if phase == "kit":
		operator.position = _ship_pos + Vector3(0, -2.5, 0)   # the ship holds at the edge while you choose
	elif phase == "ship":
		_ship_run += SHIP_V * dt
		operator.position = _ship_pos + Vector3(_ship_dir.x, 0, _ship_dir.y) * _ship_run + Vector3(0, -2.5, 0)
		if jump or _ship_run > Match.START_RADIUS * 1.6:
			_jump()
	else:
		var fwd := Vector3(-sin(operator.cam_yaw), 0, -cos(operator.cam_yaw))
		var right := Vector3(cos(operator.cam_yaw), 0, -sin(operator.cam_yaw))
		var mv: Vector2 = controls.move
		var alt: float = operator.position.y - gy
		if phase == "fall":
			# hold RUN for the wingsuit: it flies where you look, fast and flat; push forward to dive, pull back to
			# flare. Without it you drop straight and steer a little.
			wingsuit = bool(controls.sprint) and Kit.owns(kit, "wingsuit")
			if _wings == null:
				_build_wings()
			_wings.visible = wingsuit
			var want: Vector3
			var sink: float
			if wingsuit:
				want = fwd * (WING_V + 10.0 * mv.y) + right * mv.x * 7.0
				sink = WING_SINK + 14.0 * maxf(mv.y, 0.0) - 5.0 * maxf(-mv.y, 0.0)
			else:
				want = (fwd * mv.y + right * mv.x) * 20.0
				sink = FALL_V
			var flat := Vector3(_fall_v.x, 0, _fall_v.z).move_toward(want, (22.0 if wingsuit else 14.0) * dt)
			_fall_v = Vector3(flat.x, move_toward(_fall_v.y, -sink, 22.0 * dt), flat.z)
			operator.heading = atan2(fwd.x, fwd.z)
			operator.rig.rotation.y = operator.heading
			operator.rig.rotation.x = lerpf(operator.rig.rotation.x, 1.4 if wingsuit else 1.15, minf(1.0, 6.0 * dt))   # belly to the ground
			operator.rig.rotation.z = lerpf(operator.rig.rotation.z, -mv.x * 0.5 if wingsuit else 0.0, minf(1.0, 5.0 * dt))
			if alt < (WING_CHUTE_AT if wingsuit else CHUTE_AT) or (jump and Kit.owns(kit, "canopy-sport")):
				operator.rig.rotation.z = 0.0
				_open_canopy()
		else:
			# under the canopy: it flies forward on its own, the stick turns it; pull back to flare for a soft landing,
			# push forward to come down faster. JUMP lets it go.
			var sport := Kit.owns(kit, "canopy-sport")
			_chute_yaw -= mv.x * (1.5 if sport else 0.45) * dt
			var cf := Vector3(sin(_chute_yaw), 0, cos(_chute_yaw))
			# the standard round canopy drifts: little forward speed, no flare, no diving
			var glide := CHUTE_GLIDE * (1.0 - 0.5 * maxf(-mv.y, 0.0)) if sport else ROUND_GLIDE
			var sink2 := (CHUTE_V + 3.0 * maxf(mv.y, 0.0) - 3.2 * maxf(-mv.y, 0.0)) if sport else ROUND_V
			var flat2 := Vector3(_fall_v.x, 0, _fall_v.z).move_toward(cf * glide, 16.0 * dt)
			_fall_v = Vector3(flat2.x, move_toward(_fall_v.y, -sink2, 45.0 * dt), flat2.z)
			operator.heading = _chute_yaw
			operator.rig.rotation.y = _chute_yaw
			if _canopy:
				_canopy.rotation.y = _chute_yaw
				_canopy.rotation.z = lerpf(_canopy.rotation.z, mv.x * 0.3, minf(1.0, 4.0 * dt))
			if jump and alt > CUT_MIN and sport:
				_cut_away()
		operator.position += _fall_v * dt
		operator.position.x = clampf(operator.position.x, operator.bounds.position.x + 1.0, operator.bounds.end.x - 1.0)
		operator.position.z = clampf(operator.position.z, operator.bounds.position.y + 1.0, operator.bounds.end.y - 1.0)
		if operator.position.y <= gy + 0.05:
			_land()
	if _ship:
		_ship.position = _ship_pos + Vector3(_ship_dir.x, 0, _ship_dir.y) * _ship_run
		if phase != "ship":
			_ship_run += SHIP_V * dt
			if _ship_run > Match.START_RADIUS * 3.0:
				_ship.queue_free()
				_ship = null
				Sound.loop_stop("royale_ship")
	operator._place_camera(dt)

func _ground(p: Vector2) -> Vector3:
	return Vector3(p.x, region.ground(p.x, p.y), p.y)

## rivals still standing on the field (every squad but yours)
func rivals() -> int:
	var n := 0
	for e in enemies.enemies:
		if e.team != 1 and e.target.alive():
			n += 1
	return n

## rival squads of three land at the circle's edge, away from you and out of sight: two while the field has room, each
## a team of its own
func _wave() -> void:
	var me := Vector2(operator.position.x, operator.position.z)
	var landed: Array = []
	for squad in (2 if rivals() + 6 <= FIELD_MAX else 1):
		var best := Vector2.ZERO
		var best_d := -1.0
		for i in 8:
			var a := _rng.randf() * TAU
			var p := centre + Vector2(cos(a), sin(a)) * (match_state.radius - 10.0)
			var d := p.distance_to(me)
			for q: Vector2 in landed:
				d = minf(d, p.distance_to(q) * 1.5)   # and apart from the other squad of this wave
			if d > best_d and p.distance_to(me) > 60.0:
				best_d = d
				best = p
		if best_d < 0.0:
			best = centre + Vector2(1, 0).rotated(_rng.randf() * TAU) * (match_state.radius - 10.0)
		landed.append(best)
		var team := _next_team
		_next_team += 1
		for i in 3:
			var at := _ground(best + Vector2(cos(i * 2.1), sin(i * 2.1)) * 3.0)
			var e: RefCounted = enemies.spawn(SQUAD_TYPES[(i + _rng.randi() % 3) % 3], at, [], team)
			e.state = Enemies.State.ENGAGE
			e.goal = _ground(centre)
	controls.toast("A squad has landed" if landed.size() == 1 else "Two squads have landed")

## the fracture wall: a tall translucent cylinder on the circle, and its ring on the ground
func _build_circle() -> void:
	_wall = MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.0
	cyl.bottom_radius = 1.0
	cyl.height = WALL_H
	cyl.radial_segments = 96
	cyl.rings = 1
	cyl.cap_top = false
	cyl.cap_bottom = false
	_wall.mesh = cyl
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = Color(0.75, 0.3, 1.0, 0.16)
	m.emission_enabled = true
	m.emission = Color(0.75, 0.3, 1.0)
	m.emission_energy_multiplier = 1.4
	_wall.material_override = m
	_wall.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	region.world().add_child(_wall)
	_ring = MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 0.985
	tor.outer_radius = 1.0
	tor.rings = 96
	tor.ring_segments = 6
	_ring.mesh = tor
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.albedo_color = Color(0.9, 0.5, 1.0)
	rm.emission_enabled = true
	rm.emission = Color(0.9, 0.5, 1.0)
	rm.emission_energy_multiplier = 3.0
	_ring.material_override = rm
	_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	region.world().add_child(_ring)
	_place_circle()

func _place_circle() -> void:
	var r := match_state.radius
	var y: float = region.ground(centre.x, centre.y)
	_wall.position = Vector3(centre.x, y + WALL_H * 0.5 - 5.0, centre.y)
	_wall.scale = Vector3(r, 1.0, r)
	_ring.position = Vector3(centre.x, y + 0.6, centre.y)
	_ring.scale = Vector3(r, 1.0, r)

func _on_bot_down(e: RefCounted, _by_team: int, by_player: bool) -> void:
	var en := e as Enemies.Enemy
	if en.team != 1:
		match_state.score(1, by_player)
		loot.death_drop(en.mover.position)
		feed(("You eliminated a %s" if by_player else "Your squad eliminated a %s") % String(en.type).capitalize(), Color(1.0, 0.85, 0.3) if by_player else Color(0.8, 0.9, 1.0))
	else:
		match_state.score(0)
		controls.toast("Squadmate down · stand on the beacon to bring them back")
		feed("Squadmate down", Color(1.0, 0.4, 0.4))
		_drop_beacon(en)

func _on_operator_down() -> void:
	if rides.driving():
		rides.exit(operator, controls)
	if enemies.alive_on(1) > 0 and knocked <= 0.0:
		# knocked, not out: a squadmate has BLEED_S to reach you
		knocked = BLEED_S
		_pickup = 0.0
		controls.toast("KNOCKED · a squadmate is coming")
		feed("You are knocked", Color(1.0, 0.4, 0.4))
		return
	knocked = 0.0
	match_state.player_died()

## a downed squadmate's beacon: a green column where they fell
func _drop_beacon(e: RefCounted) -> void:
	var n := Node3D.new()
	var at: Vector3 = e.mover.position
	n.position = Vector3(at.x, region.ground(at.x, at.z), at.z)
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.08
	cyl.bottom_radius = 0.3
	cyl.height = 14.0
	cyl.radial_segments = 8
	cyl.cap_top = false
	cyl.cap_bottom = false
	var mi := MeshInstance3D.new()
	mi.mesh = cyl
	mi.position.y = 7.0
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.3, 1.0, 0.5, 0.5)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	n.add_child(mi)
	var ring := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = REVIVE_R - 0.12
	tor.outer_radius = REVIVE_R
	ring.mesh = tor
	ring.position.y = 0.08
	ring.material_override = m
	n.add_child(ring)
	region.world().add_child(n)
	_beacons.append({ "e": e, "node": n, "left": BEACON_S, "prog": 0.0 })
	_gps.marks.append({ "node": n, "p": Vector2.ZERO, "color": Color(0.3, 1.0, 0.5), "pin": true })

## the beacons on their clocks; standing in one for REVIVE_S brings the squadmate back. Returns the prompt to show.
func _step_beacons(dt: float) -> String:
	var prompt := ""
	var me := operator.position
	for b in _beacons.duplicate():
		b.left -= dt
		var n: Node3D = b.node
		var inside: bool = knocked <= 0.0 and enemies.down <= 0.0 and Vector2(n.position.x - me.x, n.position.z - me.z).length() < REVIVE_R
		b.prog = (float(b.prog) + dt) if inside else maxf(0.0, float(b.prog) - dt * 2.0)
		if inside:
			prompt = "REVIVING · %d%%" % int(100.0 * float(b.prog) / REVIVE_S)
		if float(b.prog) >= REVIVE_S:
			enemies.revive(b.e, n.position)
			revives += 1
			controls.toast("Squadmate back up")
			feed("Squadmate revived", Color(0.3, 1.0, 0.5))
			Sound.sfx("confirm", -6.0)
			b.left = 0.0
		if float(b.left) <= 0.0:
			_beacons.erase(b)
			n.queue_free()
	return prompt

## knocked: the nearest squadmate runs to you; PICKUP_S beside you and you are up on a third of your hull. Nobody
## left, or the clock out, and you are eliminated.
func _step_knocked(dt: float) -> void:
	knocked -= dt
	enemies.down = maxf(enemies.down, 1.0)       # held down (enemies.gd would stand you up on its own clock)
	var near: RefCounted = null
	var near_d := INF
	for e in enemies.enemies:
		if e.team == 1 and e.target.alive():
			var d: float = e.mover.position.distance_to(operator.position)
			if d < near_d:
				near_d = d
				near = e
	if near == null or knocked <= 0.0:
		knocked = 0.0
		match_state.player_died()
		return
	near.goal = operator.position
	_pickup = (_pickup + dt) if near_d < 3.5 else maxf(0.0, _pickup - dt)
	if _pickup >= PICKUP_S:
		knocked = 0.0
		enemies.down = 0.0
		enemies.hull = enemies.hull_max * 0.35
		enemies.spawn_guard = 2.0
		revives += 1
		controls.toast("Back on your feet")
		feed("A squadmate picked you up", Color(0.3, 1.0, 0.5))
		Sound.sfx("confirm", -6.0)

func _process(dt: float) -> void:
	if region == null or enemies == null or match_state == null:
		return
	dt = minf(dt, 0.05)
	# a bot put down by another bot or by the fracture stays down: gunplay stands a target back up when its `down`
	# clock runs out, and only its own kills set that clock (a rival killed by a rival was up again the next frame)
	for e in enemies.enemies:
		if not e.target.alive() and e.target.down <= 0.0:
			e.target.down = 1e9
	var ride_prompt := ""
	if phase != "":
		_step_drop(dt)
	elif knocked > 0.0 and not match_state.over:
		_step_knocked(dt)
		operator._place_camera(dt)
	elif rides.driving() and not match_state.over:
		rides.step(dt, operator, controls, enemies.enemies)
		ride_prompt = "EXIT" if absf(rides.car.speed) < 4.0 else ""
		if controls.take_enter() and absf(rides.car.speed) < 4.0:
			rides.exit(operator, controls)
			gunplay.set_holstered(false)
			controls.set_armed(true)
	elif not match_state.over:
		var rc := rides.near(operator.position)
		if rc != null:
			ride_prompt = "DRIVE"
			if controls.take_enter():
				rides.enter(rc, operator, controls)
				gunplay.set_holstered(true)
				controls.set_armed(false)
	if phase == "" and knocked <= 0.0 and not rides.driving() and not match_state.over:
		operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
		if controls.take_next():
			gunplay.next_weapon()
		gunplay.step(dt, region.camera(), controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var was_over: bool = match_state.over
	match_state.tick(dt)
	if match_state.wave_due and not match_state.over:
		_wave()
	enemies.since_hit = minf(enemies.since_hit, 1.0)
	enemies.step(dt)
	enemies.since_hit = minf(enemies.since_hit, 1.0)   # nothing regenerates: plates and med kits are found
	_place_circle()
	# the loot under your feet, the supply drop on its clock
	var loot_prompt := ""
	var revive_prompt := _step_beacons(dt)
	if phase == "" and knocked <= 0.0 and not rides.driving() and not match_state.over:
		var got: Dictionary = loot.step(dt, operator.position, gunplay, enemies, ride_prompt == "" and controls.take_enter())
		loot_prompt = String(got.prompt)
		if String(got.toast) != "":
			controls.toast(String(got.toast))
		_supply_t -= dt
		if _supply_t <= 0.0:
			_supply_t = SUPPLY_EVERY
			var sa := _rng.randf() * TAU
			var sp2 := centre + Vector2(cos(sa), sin(sa)) * _rng.randf() * maxf(10.0, match_state.radius * 0.6)
			loot.supply(sp2)
			controls.toast("SUPPLY DROP INBOUND · follow the blue beam")
			feed("Supply drop inbound", Color(0.4, 0.85, 1.0))
	else:
		loot.step(dt, Vector3(0, -9999, 0), gunplay, enemies, false)
	if Input.is_physical_key_pressed(KEY_H) and loot.heal(enemies):
		controls.toast("Med kit used")
	_heal.text = "MED KIT  %d" % loot.meds
	_heal.disabled = loot.meds <= 0
	# the fracture burns whoever stands outside the circle; bots head for the centre when they are out
	var me := Vector2(operator.position.x, operator.position.z)
	var burn := match_state.storm_damage(me.distance_to(centre)) if phase == "" else 0.0
	_burn += dt
	if _burn >= 0.5:
		_burn = 0.0
		if burn > 0.0 and enemies.down <= 0.0 and enemies.hull > 0.0:
			enemies.burn(burn * 0.5)
		for e in enemies.enemies:
			if not e.target.alive():
				continue
			var p := Vector2(e.mover.position.x, e.mover.position.z)
			var d := p.distance_to(centre)
			var b := match_state.storm_damage(d)
			if b > 0.0:
				e.target.take(b * 0.5)
				if e.target.hp <= 0.0:
					e.target.hp = 0.0
			if d > match_state.radius - 8.0:
				e.goal = _ground(centre + (p - centre).normalized() * maxf(0.0, match_state.radius - 20.0))
			else:
				# inside: rivals hunt toward where you are (a squad that only patrolled its landing spot was never
				# met in a 230 m circle), allies keep within a few metres of you
				var dp := p.distance_to(me)
				if e.team != 1 and e.team % 2 == 0 and dp > Enemies.SIGHT:
					var a := float(e.mover.get_instance_id() % 7)
					e.goal = _ground(me + Vector2(cos(a), sin(a)) * 18.0)
				elif e.team != 1 and dp > Enemies.SIGHT:
					# the other squads work the middle of the circle, and fight whoever they meet there
					var a2 := float(e.team) * 2.4
					e.goal = _ground(centre + Vector2(cos(a2), sin(a2)) * minf(40.0, match_state.radius * 0.4))
				elif e.team != 1:
					e.goal = null
				elif dp > 9.0:
					e.goal = _ground(me + (p - me).normalized() * 4.0)
				else:
					e.goal = null
	if burn > 0.0:
		controls.prompt("OUTSIDE THE CIRCLE · %d / s" % int(burn))
	elif phase == "kit":
		controls.prompt("")
	elif phase == "ship":
		controls.prompt("JUMP")
	elif knocked > 0.0:
		controls.prompt("KNOCKED · %d s" % int(ceil(knocked)))
	elif revive_prompt != "":
		controls.prompt(revive_prompt)
	elif ride_prompt != "":
		controls.prompt(ride_prompt)
	else:
		controls.prompt(loot_prompt)
	_gps.rings[0].r = match_state.radius
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down, enemies.shield_frac(), enemies.hull_max, enemies.shield_max)
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name()
	controls.weapon_name.add_theme_color_override("font_color", Loot.rarity_color(g.rarity) if Loot.RARITY.has(g.rarity) else Color.WHITE)
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text())
	var m := match_state
	var step := Match.PHASE_HOLD + Match.PHASE_SHRINK
	var into := fmod(m.clock, step)
	var left := (Match.PHASE_HOLD - into) if not m.closing else (step - into)
	# which way the circle's centre lies, against the way the camera faces (eight arrows)
	var to_c := (centre - me).normalized()
	var fwd := Vector2(-sin(operator.cam_yaw), -cos(operator.cam_yaw))
	var right := Vector2(cos(operator.cam_yaw), -sin(operator.cam_yaw))
	var rel := atan2(right.dot(to_c), fwd.dot(to_c))
	var arrow: String = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][posmod(int(round(rel / (PI / 4.0))), 8)]
	_banner.text = "%d ALIVE   ·   %d SQUADS   ·   %d KILLS" % [m.alive, m.placement(), m.player_kills]
	if phase != "":
		hud.text = "ALTITUDE %d m   ·   %s" % [int(operator.position.y - region.ground(operator.position.x, operator.position.z)), "aboard the dropship" if phase == "ship" else ("choose your drop kit" if phase == "kit" else (("WINGSUIT · %d m/s" % int(Vector2(_fall_v.x, _fall_v.z).length()) if wingsuit else ("free fall · hold RUN for the wingsuit" if Kit.owns(kit, "wingsuit") else "free fall")) if phase == "fall" else ("sport canopy · JUMP cuts it away" if Kit.owns(kit, "canopy-sport") else "standard canopy")))]
	else:
		hud.text = "circle %s %d s   ·   %s %d m   ·   armour %d   ·   med kits %d" % ["CLOSING" if m.closing else "holds", int(maxf(0.0, left)), arrow, int(me.distance_to(centre)), int(enemies.shield), loot.meds]
	if m.over and not was_over:
		Sound.sfx("confirm" if m.winner == "us" else "buzzer", -2.0)
	if m.over and not _paid:
		_finish()

func _finish() -> void:
	_paid = true
	var won := match_state.winner == "us"
	var kills := int(match_state.player_kills)
	var nex := mini(250 + 25 * kills, 600) if won else mini(100 + 15 * kills, 300)
	var xp := mini(200 + 20 * kills, 450) if won else mini(80 + 10 * kills, 220)
	var p := Gear.profile_load()
	var res := Progression.grant(p, "killbox_win" if won else "killbox", nex, xp, "Killbox · Fracture Royale")
	Gear.profile_save(p)
	var gear := Gear.load_save()
	var it := Gear.roll_drop(gear, "elite" if won else "enemy", randf(), Gear.operator_power(gear, int(p.level)), randi())
	if not it.is_empty():
		Gear.save(gear)
		res.lines.append("LOOT · %s (%d power)" % [String(it.name), int(it.power)])
	for l in res.lines:
		controls.toast(String(l))
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -90)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "%s\n%s\n%d eliminations\n+%d Nex   +%d XP" % ["VICTORY ROYALE" if won else "ELIMINATED", match_state.reason, kills, nex, xp]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 24)
	v.add_child(t)
	var b := Button.new()
	b.text = "LEAVE"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): closed.emit())
	v.add_child(b)
	add_child(_done_panel)

func _exit_tree() -> void:
	Sound.loop_stop("royale_ship")
	Sound.ambience("")
