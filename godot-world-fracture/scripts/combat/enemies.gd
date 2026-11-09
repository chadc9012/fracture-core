extends Node3D
const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Sound := preload("res://scripts/audio/sound.gd")
## Enemies on foot (the Dec 4 plan, phase 2): Nexus City's cyber troopers (the web game's OVERCLOCKED faction, sim.ts),
## five types built on the robot operator bodies so they walk, run and fight with real clips, moved by the same rules as
## the player (operator_player.gd with no camera), shooting back with gunplay.gd's bolts. Each is a gunplay Target, so the
## player's bolts land on them. Hull points are the web game's trooper hull × 10 (a base bullet is 10, weapons.gd).
##
##   scout     Data Drone Scout    cipher-robot   rifle, keeps 14 m, strafes            hull 30
##   elite     Data Drone Elite    goliath-robot  heavy bursts, walks in to 10 m        hull 60
##   executor  Executor            nyx-robot      blade, runs you down, swings at 2 m   hull 50
##   marksman  Grid Marksman       cipher-robot   one hard shot, holds 30 m             hull 30
##   drone     Surveillance Drone  built          hovers at 4 m, weak zaps              hull 15
##
## States: PATROL (walks its beat), ALERT (saw you: a beat before it moves), ENGAGE (holds its range and fires), DOWN
## (dead; stands again after RESPAWN seconds at its spawn). Sight is 40 m with a clear line past the scene's boxes.

const Player := preload("res://scripts/player/operator_player.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Weapons := preload("res://scripts/combat/weapons.gd")

const TYPES := {
	"scout": { "name": "Data Drone Scout", "frame": "cipher", "plating": "graphite", "optics": "cyan", "hull": 30.0, "range": 14.0, "speed": 0.75, "damage": 6.0, "cool": 1.4, "burst": 3, "spread": 0.05, "melee": false, "fly": 0.0, "weapon": "rifle.glb", "scale": 1.0 },
	"elite": { "name": "Data Drone Elite", "frame": "goliath", "plating": "cobalt", "optics": "amber", "hull": 60.0, "range": 10.0, "speed": 0.55, "damage": 9.0, "cool": 1.8, "burst": 4, "spread": 0.07, "melee": false, "fly": 0.0, "weapon": "rifle-fusion.glb", "scale": 1.08 },
	"executor": { "name": "Executor", "frame": "nyx", "plating": "crimson", "optics": "red", "hull": 50.0, "range": 1.8, "speed": 1.0, "damage": 16.0, "cool": 1.1, "burst": 1, "spread": 0.0, "melee": true, "fly": 0.0, "weapon": "", "scale": 1.0 },
	"marksman": { "name": "Grid Marksman", "frame": "cipher", "plating": "ivory", "optics": "violet", "hull": 30.0, "range": 30.0, "speed": 0.6, "damage": 28.0, "cool": 3.2, "burst": 1, "spread": 0.012, "melee": false, "fly": 0.0, "weapon": "rifle-sniper.glb", "scale": 1.0 },
	"drone": { "name": "Surveillance Drone", "frame": "", "plating": "", "optics": "cyan", "hull": 15.0, "range": 9.0, "speed": 0.9, "damage": 3.0, "cool": 0.9, "burst": 2, "spread": 0.06, "melee": false, "fly": 4.0, "weapon": "", "scale": 1.0 },
}
const SIGHT := 40.0
const RESPAWN := 8.0
const ALERT_BEAT := 0.5

enum State { PATROL, ALERT, ENGAGE, DOWN }

class Enemy:
	var type: String
	var def: Dictionary
	var mover: Node3D          # operator_player.gd
	var target: Gunplay.Target
	var state := State.PATROL
	var spawn: Vector3
	var beat: Array[Vector3] = []
	var beat_i := 0
	## an objective to walk to when no foe is in sight (Killbox zones / tags); null = the beat
	var goal: Variant = null
	var cool := 0.0
	var timer := 0.0
	var strafe := 1.0
	var burst_left := 0
	var burst_cool := 0.0
	var held: Node3D
	var hover := 0.0
	## 0 = hostile to the operator (the default); 1 = the operator's own team (Killbox allies): bots fight the other team
	var team := 0
	var tint := Color(0, 0, 0, 0)
	## a one-off (a mission's guard): once down it stays down instead of standing again at its spawn
	var stays_down := false
	var fell := false          # has been down at least once

var player: Node3D
var gunplay: Node3D
var enemies: Array[Enemy] = []
var _rng := RandomNumberGenerator.new()
## the operator's hull, damage this frame for the HUD flash, and the down state
var hull := 100.0
const HULL_MAX := 100.0
## the hull the operator can have, armour included (street_slice _fit_gear)
var hull_max := HULL_MAX
var hurt := 0.0
var down := 0.0
var since_hit := 10.0
var deaths := 0
var kills := 0
signal operator_hit(damage: float)
signal operator_down
## a bot went down: who it was, and the team that got the kill (0 rivals, 1 the operator's side; -1 unknown)
## `by_player`: the operator's own bolt made the kill (an ally bot's kill carries the operator's team but not the credit)
signal bot_down(e: Enemy, by_team: int, by_player: bool)
## the operator's team for Killbox (bots of this team never target the operator)
var operator_team := 1
## which bot last hit each bot, for the kill credit
var _last_hitter := {}
## Killbox rounds: downed bots stay down until revive_all()
var respawn_enabled := true
const TEAM_COLORS := [Color(1.0, 0.25, 0.25), Color(0.25, 0.6, 1.0), Color(1.0, 0.7, 0.2), Color(0.3, 1.0, 0.5), Color(0.85, 0.35, 1.0), Color(0.2, 0.95, 0.95), Color(1.0, 0.45, 0.75), Color(0.95, 0.95, 0.4), Color(0.6, 0.4, 0.2), Color(0.5, 0.75, 1.0), Color(1.0, 0.55, 0.3), Color(0.7, 1.0, 0.7)]
const OPERATOR_HIT := -2

func setup(p: Node3D, g: Node3D) -> void:
	player = p
	gunplay = g
	_rng.seed = 19
	g.killed.connect(_on_target_killed)
	g.hit.connect(_on_target_hit)

## spawns one enemy of `type` at `at` with a patrol beat (world points it walks between)
## a team colour band on a bot's body (Killbox): a tint over the plating
func _tint(e: Enemy, c: Color) -> void:
	e.tint = c
	var rig: Node3D = e.mover.rig
	if not rig or not rig.body_root:
		return
	for ch in rig.body_root.find_children("*", "MeshInstance3D", true, false):
		var mi := ch as MeshInstance3D
		if mi == rig.head_mesh or mi == rig.hair_mesh or not mi.mesh:
			continue
		for i in mi.mesh.get_surface_count():
			var base: Material = mi.mesh.surface_get_material(i)
			if base is StandardMaterial3D:
				var m := (base as StandardMaterial3D).duplicate() as StandardMaterial3D
				m.albedo_color = Color(1, 1, 1).lerp(c * 1.5, 0.55)
				mi.set_surface_override_material(i, m)

func spawn(type: String, at: Vector3, beat: Array = [], team := -1) -> Enemy:
	var e := Enemy.new()
	e.type = type
	e.def = TYPES[type]
	e.spawn = at
	for b in (beat if not beat.is_empty() else [at, at + Vector3(0, 0, -12.0)]):
		e.beat.append(b)
	e.mover = Player.new()
	add_child(e.mover)
	e.mover.bounds = player.bounds
	e.mover.ground_at = player.ground_at
	e.mover.obstacles = player.obstacles
	e.mover.position = at
	e.mover.cam_yaw = 0.0
	if e.def.frame != "":
		var look := CharacterStore.clean({ "frame": e.def.frame, "body": "robot", "skin": e.def.plating, "eyes": e.def.optics })
		e.mover.build(look)
		e.mover.rig.scale = Vector3.ONE * float(e.def.scale)
		_arm(e)
		if team >= 0:
			e.team = team
			_tint(e, team_color(team))
	else:
		_drone_body(e)
	e.target = Gunplay.Target.new(_box(e), float(e.def.hull), null)
	# what it bleeds (gunplay.spark): machines coolant, people red
	e.target.set_meta("blood", Color(0.2, 0.9, 1.0) if type in ["drone", "sentinel", "turret"] else Color(0.85, 0.1, 0.08))
	e.target.set_meta("enemy", e)
	e.target.set_meta("roster", self)     # gunplay's aim help skips the operator's own team
	gunplay.targets.append(e.target)
	enemies.append(e)
	return e

func _box(e: Enemy) -> AABB:
	var p: Vector3 = e.mover.position
	if e.def.fly > 0.0:
		return AABB(p + Vector3(-0.5, -0.3, -0.5), Vector3(1.0, 0.6, 1.0))
	return AABB(p + Vector3(-0.35, 0, -0.35), Vector3(0.7, 1.9 * float(e.def.scale), 0.7))

## the rifle in the right hand, as gunplay mounts the player's
func _arm(e: Enemy) -> void:
	if e.def.weapon == "":
		return
	var path: String = "res://models/weapons/" + String(e.def.weapon)
	if not ResourceLoader.exists(path) or not e.mover.rig.skeleton:
		return
	var sk: Skeleton3D = e.mover.rig.skeleton
	for i in sk.get_bone_count():
		if sk.get_bone_name(i).ends_with("RightHand"):
			var att := BoneAttachment3D.new()
			att.bone_idx = i
			sk.add_child(att)
			var ws := att.global_transform.basis.get_scale().y
			e.held = Node3D.new()
			e.held.scale = Vector3.ONE / maxf(ws, 1e-4)
			e.held.rotation.y = PI
			att.add_child(e.held)
			e.held.add_child((load(path) as PackedScene).instantiate())
			return

## a hovering surveillance drone: a disc, a lens and four rotor pods
func _drone_body(e: Enemy) -> void:
	var n := Node3D.new()
	e.mover.add_child(n)
	var body := StandardMaterial3D.new()
	body.albedo_color = Color(0.16, 0.17, 0.2)
	body.metallic = 0.7
	body.roughness = 0.35
	var lens := StandardMaterial3D.new()
	lens.albedo_color = Color(0.1, 0.9, 1.0)
	lens.emission_enabled = true
	lens.emission = Color(0.1, 0.9, 1.0)
	lens.emission_energy_multiplier = 3.0
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.45; cm.bottom_radius = 0.5; cm.height = 0.18
	disc.mesh = cm
	disc.material_override = body
	n.add_child(disc)
	var eye := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.1; sm.height = 0.2
	eye.mesh = sm
	eye.position = Vector3(0, -0.05, 0.45)
	eye.material_override = lens
	n.add_child(eye)
	for a in 4:
		var pod := MeshInstance3D.new()
		var pm := CylinderMesh.new()
		pm.top_radius = 0.16; pm.bottom_radius = 0.16; pm.height = 0.06
		pod.mesh = pm
		pod.position = Vector3(cos(a * TAU / 4 + PI / 4) * 0.6, 0.08, sin(a * TAU / 4 + PI / 4) * 0.6)
		pod.material_override = body
		n.add_child(pod)
	e.hover = float(e.def.fly)

func step(dt: float) -> void:
	since_hit += dt
	hurt = maxf(0.0, hurt - dt * 3.0)
	if down > 0.0:
		down -= dt
		if down <= 0.0:
			hull = hull_max
	elif since_hit > 4.0:
		hull = minf(hull_max, hull + 12.0 * dt)
	for e in enemies:
		_step_enemy(e, dt)
		e.target.box = _box(e)

func _step_enemy(e: Enemy, dt: float) -> void:
	var m: Node3D = e.mover
	if e.state == State.DOWN:
		e.fell = true
		if e.stays_down:
			return
		if respawn_enabled:
			e.timer -= dt
		if e.timer <= 0.0:
			e.state = State.PATROL
			e.target.hp = e.target.max_hp
			e.target.down = 0.0
			m.position = e.spawn
			m.visible = true
		return
	if not e.target.alive():
		e.state = State.DOWN
		e.timer = RESPAWN
		m.visible = false
		var by: int = int(_last_hitter.get(e, OPERATOR_HIT))
		var by_player := by == OPERATOR_HIT   # no bot hit it last: the operator's bolt did
		if by_player:
			by = operator_team
		if e.team != operator_team and by_player:
			kills += 1
			_tally("kill", 1)
		bot_down.emit(e, by, by_player)
		_last_hitter.erase(e)
		return
	# the hostile it fights: the operator (when on the other team) or the nearest bot of the other team
	var foe: Variant = _foe(e)
	var foe_pos: Vector3 = player.position if foe == null else (foe as Enemy).mover.position
	var to_player: Vector3 = foe_pos - m.position
	to_player.y = 0.0
	var dist := to_player.length()
	var foe_up := (foe == null and down <= 0.0) or (foe != null and (foe as Enemy).target.alive())
	var sees := dist < SIGHT and foe_up and _clear(m.position + Vector3(0, 1.4, 0), foe_pos + Vector3(0, 1.2, 0))
	e.set_meta("foe", foe)
	var move := Vector2.ZERO
	var sprint := false
	e.cool = maxf(0.0, e.cool - dt)
	match e.state:
		State.PATROL:
			var goal: Vector3 = (e.goal as Vector3) if e.goal != null else e.beat[e.beat_i]
			var d := goal - m.position
			d.y = 0.0
			if d.length() < 1.0:
				if e.goal == null:
					e.beat_i = (e.beat_i + 1) % e.beat.size()
			else:
				move = _toward(d) * (0.8 if e.goal != null else 0.4)
			if sees:
				e.state = State.ALERT
				e.timer = ALERT_BEAT
		State.ALERT:
			e.timer -= dt
			_face(e, to_player)
			if e.timer <= 0.0:
				e.state = State.ENGAGE
				e.strafe = 1.0 if _rng.randf() < 0.5 else -1.0
		State.ENGAGE:
			if not sees and dist > SIGHT * 1.2:
				e.state = State.PATROL
			_face(e, to_player)
			var want: float = float(e.def.range)
			var fwd := _toward(to_player)
			if not sees and e.goal != null:
				# nothing to shoot at: get to the objective
				var dg: Vector3 = (e.goal as Vector3) - m.position
				dg.y = 0.0
				if dg.length() > 1.5:
					move = _toward(dg) * 0.8
			elif dist > want + 1.5:
				move = fwd * float(e.def.speed)
				sprint = e.def.melee
			elif dist < want - 1.5 and not e.def.melee:
				move = -fwd * 0.5
			else:
				# hold the range and strafe
				move = Vector2(-fwd.y, fwd.x) * e.strafe * 0.35
				e.timer -= dt
				if e.timer <= 0.0:
					e.strafe = -e.strafe
					e.timer = 1.5 + _rng.randf() * 2.0
			if sees and e.cool <= 0.0 and dist <= want + 2.5:
				_attack(e, dist)
	# bursts in flight
	if e.burst_left > 0:
		e.burst_cool -= dt
		if e.burst_cool <= 0.0:
			_shoot(e)
			e.burst_left -= 1
			e.burst_cool = 0.12
	if e.def.fly > 0.0:
		# the drone floats: no gravity, a gentle bob
		m.position += Vector3(move.x, 0, -move.y) * 4.0 * dt
		e.hover += dt
		m.position.y = (m.ground_at.call(m.position.x, m.position.z) as float) + float(e.def.fly) + sin(e.hover * 2.0) * 0.25
		var yaw := atan2(to_player.x, to_player.z)
		m.rotation.y = lerp_angle(m.rotation.y, yaw, minf(1.0, 4.0 * dt))
	else:
		m.step(dt, move, Vector2.ZERO, false, sprint)
		if e.state == State.ENGAGE or e.state == State.ALERT:
			# in a fight the body faces the operator whichever way it steps
			m.heading = lerp_angle(m.heading, atan2(to_player.x, to_player.z), minf(1.0, 8.0 * dt))
			if m.rig:
				m.rig.rotation.y = m.heading

func _toward(d: Vector3) -> Vector2:
	# operator_player with cam_yaw 0: stick y walks -z, stick x walks +x
	var n := Vector3(d.x, 0, d.z).normalized()
	return Vector2(n.x, -n.z)

func _face(e: Enemy, d: Vector3) -> void:
	if e.mover.rig:
		e.mover.heading = lerp_angle(e.mover.heading, atan2(d.x, d.z), 0.25)

func _clear(from: Vector3, to: Vector3) -> bool:
	var dir := to - from
	var len := dir.length()
	if len < 0.01:
		return true
	dir /= len
	var lo := Vector3(minf(from.x, to.x), minf(from.y, to.y), minf(from.z, to.z))
	var hi := Vector3(maxf(from.x, to.x), maxf(from.y, to.y), maxf(from.z, to.z))
	for b in player.obstacles:
		# only boxes inside the sight line's own bounds can block it
		if b.end.x < lo.x or b.position.x > hi.x or b.end.z < lo.z or b.position.z > hi.z or b.end.y < lo.y or b.position.y > hi.y:
			continue
		var p: Variant = b.intersects_ray(from, dir)
		if p != null and from.distance_to(p) < len:
			return false
	return true

## the nearest live bot of the other team, or null for the operator (when hostile to this bot and nearer)
## bring every downed bot back at its spawn (a new Killbox round)
func revive_all() -> void:
	for e in enemies:
		if e.state == State.DOWN or not e.target.alive():
			e.state = State.ENGAGE
			e.target.hp = e.target.max_hp
			e.target.down = 0.0
			e.timer = 0.0
			e.mover.position = e.spawn
			e.mover.visible = true

func alive_on(team: int) -> int:
	var n := 0
	for e in enemies:
		if e.team == team and e.target.alive():
			n += 1
	return n

## a team's band colour: 0 red, 1 blue, then the FFA palette
static func team_color(team: int) -> Color:
	return TEAM_COLORS[team % TEAM_COLORS.size()] if team >= 0 else Color(0.6, 0.6, 0.6)

func _foe(e: Enemy) -> Variant:
	var best: Variant = null
	var best_d := INF
	if e.team != operator_team and down <= 0.0:
		best_d = e.mover.position.distance_to(player.position)
	for o in enemies:
		if o == e or o.team == e.team or not o.target.alive():
			continue
		var d := e.mover.position.distance_to(o.mover.position)
		if d < best_d:
			best_d = d
			best = o
	return best

func _attack(e: Enemy, dist: float) -> void:
	e.cool = float(e.def.cool) * (0.8 + _rng.randf() * 0.4)
	e.mover.combat_hold = 1.5
	if e.def.melee:
		if dist <= float(e.def.range) + 0.6:
			_damage_foe(e, float(e.def.damage))
		return
	e.burst_left = int(e.def.burst)
	e.burst_cool = 0.0

func _muzzle(e: Enemy) -> Vector3:
	if e.held:
		return e.held.global_transform * Vector3(0, 0.07, 0.8)
	return e.mover.position + Vector3(0, 1.3 if e.def.fly <= 0.0 else -0.05, 0)

## one bolt at the operator: a hit when the line passes within the body's radius, else a miss into the scene
func _shoot(e: Enemy) -> void:
	var from := _muzzle(e)
	var foe: Variant = e.get_meta("foe") if e.has_meta("foe") else null
	var aim: Vector3 = (player.position if foe == null else (foe as Enemy).mover.position) + Vector3(0, 1.1, 0)
	var dir := (aim - from).normalized()
	var side := dir.cross(Vector3.UP).normalized()
	var up := side.cross(dir)
	var vel: Vector3 = player.velocity if foe == null else (foe as Enemy).mover.velocity
	var spread: float = float(e.def.spread) * (1.6 if Vector2(vel.x, vel.z).length() > 3.0 else 1.0)
	dir = (dir + side * _rng.randfn(0.0, spread) + up * _rng.randfn(0.0, spread)).normalized()
	var len := from.distance_to(aim)
	var closest := (aim - from) - dir * (aim - from).dot(dir)
	var hit := closest.length() < 0.45 and _clear(from, aim)
	var end := aim if hit else from + dir * minf(len + 20.0, 80.0)
	if not hit:
		for b in player.obstacles:
			var p: Variant = b.intersects_ray(from, dir)
			if p != null and from.distance_to(p) < from.distance_to(end):
				end = p
	gunplay.tracer(from, end, Color(0.4, 0.9, 1.0) if e.team == 0 else Color(1.0, 0.75, 0.3))
	gunplay.spark(end, hit)
	Sound.sfx_at("smg" if String(e.def.get("weapon", "")) in ["smg", "pistol"] else "rifle", from, player.position, -8.0)
	if hit:
		_damage_foe(e, float(e.def.damage))

## the hit lands on whoever this bot is fighting
func _damage_foe(e: Enemy, damage: float) -> void:
	var foe: Variant = e.get_meta("foe") if e.has_meta("foe") else null
	if foe == null:
		for o in enemies:
			if o.has_meta("hit_operator"):
				o.remove_meta("hit_operator")
		e.set_meta("hit_operator", true)
		_hit_operator(damage)
		return
	var o := foe as Enemy
	o.target.hp -= damage
	_last_hitter[o] = e.team
	if o.target.hp <= 0.0:
		o.target.hp = 0.0

func _hit_operator(damage: float) -> void:
	if down > 0.0:
		return
	hull -= damage
	hurt = 1.0
	since_hit = 0.0
	operator_hit.emit(damage)
	Sound.sfx("hurt", -6.0)
	if hull <= 0.0:
		hull = 0.0
		down = 5.0
		deaths += 1
		Sound.sfx("down", -2.0)
		operator_down.emit()

func _on_target_killed(_t: Gunplay.Target) -> void:
	pass

func _on_target_hit(t: Gunplay.Target, _damage: float, head: bool) -> void:
	if t.has_meta("enemy"):
		_last_hitter[t.get_meta("enemy")] = OPERATOR_HIT
		if head:
			_tally("headshot", 1)

## the daily-goal counters (progression.gd): kills land at once, headshots every fourth so the profile file is not
## written on every bolt; a finished goal is toasted through `goal_done` (the view decides how to show it)
signal goal_done(line: String)
var _pending_head := 0

func _tally(kind: String, n: int) -> void:
	if kind == "headshot":
		_pending_head += n
		if _pending_head < 4:
			return
		n = _pending_head
		_pending_head = 0
	var p := Gear.profile_load()
	for g in Progression.event(p, kind, n):
		goal_done.emit("DAILY GOAL · %s — +%d Nex" % [String(g.label), int(g.nex)])
	Gear.profile_save(p)
