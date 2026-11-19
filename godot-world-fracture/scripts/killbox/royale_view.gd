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
	preload("res://scripts/nav/gps.gd").attach(self, region, operator)   # the GPS (owner, Nov 18)
	gunplay = Gunplay.new()
	region.world().add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	enemies = Enemies.new()
	region.world().add_child(enemies)
	enemies.setup(operator, gunplay)
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
	for i in 2:
		var at := _ground(Vector2(operator.position.x, operator.position.z) + Vector2(cos(a + 1.3 + i * 1.6), sin(a + 1.3 + i * 1.6)) * 4.0)
		var e: RefCounted = enemies.spawn(SQUAD_TYPES[i], at, [], 1)
		e.state = Enemies.State.ENGAGE
		_allies.append(e)
	_wave()
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
	Sound.ambience("forest")
	controls.toast("FRACTURE ROYALE · %d squads · stay inside the circle" % match_state.squads())

func _ground(p: Vector2) -> Vector3:
	return Vector3(p.x, region.ground(p.x, p.y), p.y)

## a rival squad of three lands at the circle's edge, away from you and out of sight
func _wave() -> void:
	var me := Vector2(operator.position.x, operator.position.z)
	var best := Vector2.ZERO
	var best_d := -1.0
	for i in 6:
		var a := _rng.randf() * TAU
		var p := centre + Vector2(cos(a), sin(a)) * (match_state.radius - 10.0)
		var d := p.distance_to(me)
		if d > best_d and d > 60.0:
			best_d = d
			best = p
	if best_d < 0.0:
		best = centre + Vector2(1, 0).rotated(_rng.randf() * TAU) * (match_state.radius - 10.0)
	for i in 3:
		var at := _ground(best + Vector2(cos(i * 2.1), sin(i * 2.1)) * 3.0)
		var e: RefCounted = enemies.spawn(SQUAD_TYPES[(i + _rng.randi() % 3) % 3], at, [], 0)
		e.state = Enemies.State.ENGAGE
		e.goal = _ground(centre)
	controls.toast("A squad has landed")

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
	if en.team == 0:
		match_state.score(1, by_player)
	else:
		match_state.score(0)
		controls.toast("Squadmate down")

func _on_operator_down() -> void:
	match_state.player_died()

func _process(dt: float) -> void:
	if region == null or enemies == null or match_state == null:
		return
	dt = minf(dt, 0.05)
	if not match_state.over:
		operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
		if controls.take_next():
			gunplay.next_weapon()
		gunplay.step(dt, region.camera(), controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var was_over: bool = match_state.over
	match_state.tick(dt)
	if match_state.wave_due and not match_state.over:
		_wave()
	enemies.step(dt)
	_place_circle()
	# the fracture burns whoever stands outside the circle; bots head for the centre when they are out
	var me := Vector2(operator.position.x, operator.position.z)
	var burn := match_state.storm_damage(me.distance_to(centre))
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
				if e.team == 0 and dp > Enemies.SIGHT:
					var a := float(e.mover.get_instance_id() % 7)
					e.goal = _ground(me + Vector2(cos(a), sin(a)) * 18.0)
				elif e.team == 0:
					e.goal = null
				elif dp > 9.0:
					e.goal = _ground(me + (p - me).normalized() * 4.0)
				else:
					e.goal = null
	if burn > 0.0:
		controls.prompt("OUTSIDE THE CIRCLE · %d / s" % int(burn))
	else:
		controls.prompt("")
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down, enemies.shield_frac())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name()
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
	hud.text = "%d ALIVE · %d squads   ·   circle %s %d s   ·   %s %d m   ·   you %d" % [m.alive, m.placement(), "CLOSING" if m.closing else "holds", int(maxf(0.0, left)), arrow, int(me.distance_to(centre)), m.player_kills]
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
	var loot := ""
	for l in res.lines:
		if String(l).begins_with("LOOT · "):
			loot = String(l).substr(7)
		else:
			controls.toast(String(l))
	# Apex's match summary: CHAMPIONS or ELIMINATED, the placement, your eliminations and what it paid
	var place: int = match_state.placement()
	var summary = load("res://scripts/killbox/match_summary.gd").new()
	summary.data = { "result": "CHAMPIONS" if won else "ELIMINATED", "won": won,
		"score": ("#1 of %d" % match_state.squads()) if won else ("#%d of %d" % [place, match_state.squads()]),
		"sub": "Fracture Royale · the Verdant Forest", "teams": [],
		"stats": [["PLACED", "#%d" % (1 if won else place)], ["ELIMINATIONS", str(kills)], ["PHASE", str(int(match_state.phase) + 1)], ["SURVIVED", "%d:%02d" % [int(match_state.clock) / 60, int(match_state.clock) % 60]]],
		"nex": nex, "xp": xp, "loot": loot, "leave_text": "LEAVE" }
	summary.leave.connect(func(): closed.emit())
	_done_panel = summary
	controls.add_child(summary)

func _exit_tree() -> void:
	Sound.ambience("")
