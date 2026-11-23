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
## Fighting moves (Nov 22, owner: "enemy melee attacks and defensive behavior"): every hit carries poise; past the type's
## `poise` the bot STAGGERS (stumbles, stops shooting — a finisher target), a big shove KNOCKS IT DOWN (it lies there, then
## gets up). It flinches on lesser hits and falls when it dies (combat_clips.gd through the rig's action layer). The
## Executor fights hand to hand: a telegraphed wind-up (its optics flare), then a chain of up to three swings, the last a
## heavy; any trooper rifle-butts an operator who walks into arm's reach. Defence: scouts and marksmen side-step out of a
## held crosshair or away from a live grenade (`evade`), elites BRACE behind their plating under sustained fire (frontal
## bolts do 40%), Executors BLOCK a light swing (a heavy breaks the guard), and a gunner below 30% hull backs away to
## recover its shield before it comes back in.
##
## States: PATROL (walks its beat), ALERT (saw you: a beat before it moves), ENGAGE (holds its range and fires), DOWN
## (dead; stands again after RESPAWN seconds at its spawn). Sight is 40 m with a clear line past the scene's boxes.

const Player := preload("res://scripts/player/operator_player.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Weapons := preload("res://scripts/combat/weapons.gd")
const Clips := preload("res://scripts/character/combat_clips.gd")

const TYPES := {
	"scout": { "name": "Data Drone Scout", "frame": "cipher", "plating": "graphite", "optics": "cyan", "hull": 55.0, "range": 14.0, "speed": 0.75, "damage": 6.0, "cool": 1.4, "burst": 3, "spread": 0.05, "melee": false, "fly": 0.0, "weapon": "rifle.glb", "scale": 1.0, "poise": 40.0, "evade": 0.35, "guard": "", "role": "flank", "aggro": 0.6 },
	"elite": { "name": "Data Drone Elite", "frame": "goliath", "plating": "cobalt", "optics": "amber", "hull": 160.0, "range": 10.0, "speed": 0.55, "damage": 9.0, "cool": 1.8, "burst": 4, "spread": 0.07, "melee": false, "fly": 0.0, "weapon": "rifle-fusion.glb", "scale": 1.08, "shield": 30.0, "poise": 110.0, "evade": 0.0, "guard": "brace", "role": "assault", "aggro": 0.8 },
	"executor": { "name": "Executor", "frame": "nyx", "plating": "crimson", "optics": "red", "hull": 150.0, "range": 1.8, "speed": 1.0, "damage": 16.0, "cool": 1.1, "burst": 1, "spread": 0.0, "melee": true, "fly": 0.0, "weapon": "", "scale": 1.0, "poise": 70.0, "evade": 0.25, "guard": "block", "combo": 3, "role": "assault", "aggro": 1.0 },
	"marksman": { "name": "Grid Marksman", "frame": "cipher", "plating": "ivory", "optics": "violet", "hull": 45.0, "range": 30.0, "speed": 0.6, "damage": 28.0, "cool": 3.2, "burst": 1, "spread": 0.012, "melee": false, "fly": 0.0, "weapon": "rifle-sniper.glb", "scale": 1.0, "poise": 35.0, "evade": 0.5, "guard": "", "role": "cover", "aggro": 0.2 },
	"drone": { "name": "Surveillance Drone", "frame": "", "plating": "", "optics": "cyan", "hull": 22.0, "range": 9.0, "speed": 0.9, "damage": 3.0, "cool": 0.9, "burst": 2, "spread": 0.06, "melee": false, "fly": 4.0, "weapon": "", "scale": 1.0, "poise": 25.0, "evade": 0.0, "guard": "", "role": "suppress", "aggro": 0.5 },
}
const SIGHT := 40.0
const RESPAWN := 8.0
const STUCK_S := 1.2          # seconds wanting to move but going nowhere before a step-off
const STUCK_SPEED := 0.4      # m/s: slower than this while pushing is "going nowhere"
const STEP_OFF_M := 4.0       # the step-off distance
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
	var flinch := 0.0
	var flinch_dir := Vector3.ZERO
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
	## caught on a rail, a prop or a ledge corner (wanting to move, going nowhere): seconds so far, and the step-off
	var stuck := 0.0
	var step_off := Vector2.ZERO
	var step_t := 0.0
	## fighting moves: poise built by hits, the stagger / knockdown left, the wind-up of a swing and the swings left in the
	## chain, the brace, the side-step cooldown, the fall after death, the retreat, recent hits (for the brace)
	var poise := 0.0
	var stagger_t := 0.0
	var floor_t := 0.0
	var windup := 0.0
	var swing_len := 0.0
	var combo_left := 0
	var brace_t := 0.0
	var evade_cool := 0.0
	var dying := 0.0
	var retreat := 0.0
	var recent_hits := 0.0
	var guard_cool := 0.0
	## squad tactics (Nov 22): the role the squad gave it ("assault" pushes, "flank" swings round the side, "suppress"
	## holds range and keeps fire on, "cover" fights from behind a box), the cover spot and the peek cycle, the flank side
	var role := ""
	var cover := Vector3.INF
	var cover_side := Vector3.ZERO
	var cover_t := 0.0
	var peek_t := 0.0
	var flank_side := 1.0

var player: Node3D
var gunplay: Node3D
var enemies: Array[Enemy] = []
var _rng := RandomNumberGenerator.new()
## the operator's energy shield (asset catalog §5): takes hits before the hull, recharges SHIELD_RATE a second once
## SHIELD_DELAY seconds pass unhit; the hull itself only mends once the shield is full again
const SHIELD_MAX := 40.0
const SHIELD_DELAY := 3.0
const SHIELD_RATE := 20.0
var shield := SHIELD_MAX
var shield_max := SHIELD_MAX
func shield_frac() -> float:
	return shield / shield_max if shield_max > 0.0 else 0.0
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
## online raids (online_raid.gd): a bot's round landed on a "remote" body (another player's stand-in here; their own
## client takes the damage), and every bot bolt for the other screens' tracers
signal remote_hit(e: Enemy, damage: float)
signal shot(from: Vector3, to: Vector3, team: int)
## the operator's team for Killbox (bots of this team never target the operator)
var operator_team := 1
## which bot last hit each bot, for the kill credit
var _last_hitter := {}
## Killbox rounds: downed bots stay down until revive_all()
var respawn_enabled := true
## squad tactics on: roles, cover, flanking, fire tokens (off where a view runs its own bot brains)
var tactics := true
## no more than this many gunners fire on the operator at once (the rest hold, reposition, or wait their turn), and one
## melee fighter swings at a time while the others circle: a fight you can read
const FIRE_TOKENS := 2
const SQUAD_TICK := 1.0
var _squad_t := 0.0
## the last safe place the operator stood (out of a fight a few seconds, on the ground): where a death puts them back
var checkpoint := Vector3.INF
var _safe_t := 0.0
## where to stand the operator up after going down: the last checkpoint, else the view's own spawn
func respawn_point(fallback: Vector3) -> Vector3:
	return checkpoint if checkpoint != Vector3.INF else fallback
const TEAM_COLORS := [Color(1.0, 0.25, 0.25), Color(0.25, 0.6, 1.0), Color(1.0, 0.7, 0.2), Color(0.3, 1.0, 0.5), Color(0.85, 0.35, 1.0), Color(0.2, 0.95, 0.95), Color(1.0, 0.45, 0.75), Color(0.95, 0.95, 0.4), Color(0.6, 0.4, 0.2), Color(0.5, 0.75, 1.0), Color(1.0, 0.55, 0.3), Color(0.7, 1.0, 0.7)]
const OPERATOR_HIT := -2

func setup(p: Node3D, g: Node3D) -> void:
	player = p
	gunplay = g
	_rng.seed = 19
	g.killed.connect(_on_target_killed)
	if "roster" in g:
		g.roster = self      # grenades.gd's Rift Well heals the operator's hull here
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
	e.mover.surface_at = player.surface_at
	e.mover.listener = player    # their footsteps, heard within 16 m (operator_player.gd)
	e.mover.obstacles = player.obstacles
	e.mover.position = at
	e.mover.cam_yaw = 0.0
	if e.def.frame != "":
		var look := CharacterStore.clean({ "frame": e.def.frame, "body": "robot", "skin": e.def.plating, "eyes": e.def.optics })
		e.mover.build(look)
		e.mover.rig.scale = Vector3.ONE * float(e.def.scale)
		e.mover.armed_pose = String(e.def.weapon) != ""
		_arm(e)
		if team >= 0:
			e.team = team
			_tint(e, team_color(team))
	else:
		_drone_body(e)
	e.target = Gunplay.Target.new(_box(e), float(e.def.hull), null)
	e.target.shield_max = float(e.def.get("shield", 0.0))
	e.target.shield = e.target.shield_max
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
	spawn_guard = maxf(0.0, spawn_guard - dt)
	hurt = maxf(0.0, hurt - dt * 3.0)
	if down > 0.0:
		down -= dt
		if down <= 0.0:
			hull = hull_max
			shield = shield_max
			spawn_guard = SPAWN_GUARD
	elif since_hit > SHIELD_DELAY and shield < shield_max:
		shield = minf(shield_max, shield + SHIELD_RATE * dt)
	elif since_hit > 4.0:
		hull = minf(hull_max, hull + 12.0 * dt)
	_wear_step(dt)
	_checkpoint_step(dt)
	if tactics:
		_squad_t -= dt
		if _squad_t <= 0.0:
			_squad_t = SQUAD_TICK
			_squad()
	for e in enemies:
		_step_enemy(e, dt)
		e.target.box = _box(e)

func _step_enemy(e: Enemy, dt: float) -> void:
	if e.has_meta("puppet"):
		return      # moved from the network (online_raid.gd), never by the AI
	var m: Node3D = e.mover
	if e.state == State.DOWN:
		e.fell = true
		if e.dying > 0.0:
			# the body falls and lies a moment before it goes
			e.dying -= dt
			if e.dying <= 0.0:
				m.visible = false
		if e.stays_down:
			return
		if respawn_enabled:
			e.timer -= dt
		if e.timer <= 0.0:
			e.state = State.PATROL
			e.target.hp = e.target.max_hp
			e.target.shield = e.target.shield_max
			_set_wear(e.mover, 0)
			e.target.down = 0.0
			m.position = e.spawn
			m.visible = true
			_reset_moves(e)
		return
	if not e.target.alive():
		e.state = State.DOWN
		e.timer = RESPAWN
		if m.rig and m.rig.action and e.def.fly <= 0.0:
			m.rig.act("death")
			e.dying = 2.2
			m.guard = false
		else:
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
	# the hits it has taken: shoves, poise, staggers and knockdowns (combat_clips.gd moves)
	_react(e, dt)
	if e.stagger_t > 0.0 or e.floor_t > 0.0:
		e.target.set_meta("staggered", true)
		e.burst_left = 0
		e.windup = 0.0
		e.combo_left = 0
		if e.floor_t > 0.0:
			e.floor_t -= dt
			if e.floor_t <= 0.0:
				# back on its feet
				if m.rig:
					m.rig.act("get_up")
				e.stagger_t = 0.85
		else:
			e.stagger_t -= dt
		if e.def.fly <= 0.0:
			m.step(dt, Vector2.ZERO, Vector2.ZERO, false, false)
		return
	e.target.set_meta("staggered", false)
	# the hostile it fights: the operator (when on the other team) or the nearest bot of the other team
	var foe: Variant = _foe(e)
	var foe_pos: Vector3 = player.position if foe == null else (foe as Enemy).mover.position
	var to_player: Vector3 = foe_pos - m.position
	to_player.y = 0.0
	var dist := to_player.length()
	var foe_up := (foe == null and down <= 0.0) or (foe != null and (foe as Enemy).target.alive())
	# Shroud smoke (grenades.gd): nothing sees into or out of it past SMOKE_SIGHT of its range
	var sight := SIGHT
	var gr: Node = gunplay.get("grenades") if gunplay else null
	if gr and not gr.live.is_empty() and (gr.in_smoke(foe_pos) or gr.in_smoke(m.position)):
		sight = SIGHT * float(gr.SMOKE_SIGHT)
	# NYX's Shadow Step (abilities.gd): the operator is unseen past arm's reach while it lasts
	var cl: Node = gunplay.get("close") if gunplay else null
	if foe == null and cl and cl.abilities and float(cl.abilities.cloaked) > 0.0:
		sight = minf(sight, 2.5)
	var sees := dist < sight and foe_up and _clear(m.position + Vector3(0, 1.4, 0), foe_pos + Vector3(0, 1.2, 0))
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
				if e.stays_down:
					# a mission's wave (it stays down when beaten) never gives up the hunt: losing sight it comes looking,
					# so a fight that runs long cannot leave a wave wandering off and the objective stuck
					e.set_meta("hunting", true)
				else:
					e.state = State.PATROL
			_face(e, to_player)
			if sees and e.has_meta("hunting"):
				e.remove_meta("hunting")
				e.set_meta("lost_t", 0.0)
			var want: float = float(e.def.range)
			var fwd := _toward(to_player)
			_defend(e, dt, sees, dist, to_player)
			if not sees and e.goal != null:
				# nothing to shoot at: get to the objective
				var dg: Vector3 = (e.goal as Vector3) - m.position
				dg.y = 0.0
				if dg.length() > 1.5:
					move = _toward(dg) * 0.8
			elif e.has_meta("hunting") and not sees:
				move = fwd * float(e.def.speed)
				sprint = true
				# a wave member lost a long while far off (caught behind a building with no way round): it comes back in
				# from the edge of the fight, so an objective can never hang on one bot wedged out of reach
				var lost: float = float(e.get_meta("lost_t", 0.0)) + dt
				e.set_meta("lost_t", lost)
				if lost > 20.0 and dist > 35.0:
					var a := _rng.randf() * TAU
					var at: Vector3 = player.position + Vector3(cos(a), 0.0, sin(a)) * _rng.randf_range(18.0, 24.0)
					at.y = float(m.ground_at.call(at.x, at.z)) + (float(e.def.fly) if e.def.fly > 0.0 else 0.0)
					m.position = at
					e.set_meta("lost_t", 0.0)
			elif e.retreat > 0.0:
				# hurt: back away (and let the shield come back) before coming in again
				move = -fwd * 0.9
				sprint = true
			elif tactics and foe == null and e.role != "" and e.windup <= 0.0 and e.def.fly <= 0.0 and _tactical_move(e, dt, dist, to_player, sees) != Vector2.INF:
				move = e.get_meta("tac_move")
				sprint = bool(e.get_meta("tac_sprint", false))
			elif e.windup > 0.0:
				# mid-swing: a short step in behind the blow
				move = fwd * (0.35 if dist > 1.2 else 0.0)
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
			var press := 0.6 if tactics and foe == null and _pressing() and float(e.def.get("aggro", 0.5)) >= 0.5 else 1.0
			if sees and e.cool <= 0.0 and dist <= want / press + 2.5 and e.windup <= 0.0 and e.retreat <= 0.0 and _may_attack(e, foe):
				_attack(e, dist)
			# an operator at arm's reach gets the rifle butt from a gunner
			if sees and not e.def.melee and e.def.fly <= 0.0 and dist < 1.7 and e.windup <= 0.0 and e.swing_len <= 0.0 and e.cool <= 0.4:
				_swing(e, 0, 10.0, true)
				e.combo_left = 0
				e.cool = maxf(e.cool, 1.6)
	# stunned by a grenade (Concussion, Arc Chain, a Singularity's pull): it stands there and holds its fire
	if e.target.stun > 0.0:
		move = Vector2.ZERO
		sprint = false
		e.burst_left = 0
		e.cool = maxf(e.cool, e.target.stun)
	# a swing in flight: the wind-up runs out, the blow lands if the foe is still in reach, the chain carries on
	if e.windup > 0.0:
		e.windup -= dt
		if e.windup <= 0.0:
			var reach := float(e.def.range) + 0.9 if e.def.melee else 2.0
			if dist <= reach and foe_up:
				var k := int(e.get_meta("swing_k", 0))
				var dmg := float(e.get_meta("swing_dmg", e.def.damage))
				_damage_foe(e, dmg * (1.6 if k == 2 else 1.0), true)
			Sound.sfx_at("swing", m.position, player.position, -8.0)
	elif e.swing_len > 0.0:
		e.swing_len -= dt
		if e.swing_len <= 0.0 and e.combo_left > 0 and e.target.stun <= 0.0:
			e.combo_left -= 1
			_swing(e, int(e.get_meta("swing_k", 0)) + 1, float(e.def.damage), false)
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
		# stuck (killbox-bots.ts): wanting to move, going nowhere for STUCK_S — step off a few metres in a fresh direction
		# that keeps the ground level, then let the state pick the way again
		if e.step_t > 0.0:
			e.step_t -= dt
			move = e.step_off
			sprint = false
		var before: Vector3 = m.position
		m.step(dt, move, Vector2.ZERO, false, sprint)
		var went: Vector3 = m.position - before
		went.y = 0.0
		if move.length() > 0.2 and e.target.stun <= 0.0 and dt > 0.0 and went.length() / dt < STUCK_SPEED:
			e.stuck += dt
		else:
			e.stuck = 0.0
		if e.stuck > STUCK_S:
			e.stuck = 0.0
			var here: float = m.ground_at.call(m.position.x, m.position.z)
			for k in 8:
				var ang := _rng.randf() * TAU
				var dir := Vector2(cos(ang), sin(ang))
				var at: Vector3 = m.position + Vector3(dir.x, 0, -dir.y) * STEP_OFF_M
				if absf(float(m.ground_at.call(at.x, at.z)) - here) < 0.6:
					e.step_off = dir
					e.step_t = STEP_OFF_M / 4.0
					stepped_off += 1
					break
		if e.state == State.ENGAGE or e.state == State.ALERT:
			# in a fight the body faces the operator whichever way it steps
			m.heading = lerp_angle(m.heading, atan2(to_player.x, to_player.z), minf(1.0, 8.0 * dt))
			if m.rig:
				m.rig.rotation.y = m.heading
	# the flinch: a jolt back along the shot and a lean that eases out
	if e.flinch > 0.0:
		e.flinch = maxf(0.0, e.flinch - dt)
		m.position += e.flinch_dir * dt * 1.2 * e.flinch
		if m.rig:
			m.rig.rotation.x = -e.flinch * 0.6
	elif m.rig and m.rig.rotation.x != 0.0:
		m.rig.rotation.x = lerpf(m.rig.rotation.x, 0.0, minf(1.0, 10.0 * dt))

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
			e.target.shield = e.target.shield_max
			_set_wear(e.mover, 0)
			e.target.down = 0.0
			e.timer = 0.0
			e.mover.position = e.spawn
			e.mover.visible = true
			_reset_moves(e)

func alive_on(team: int) -> int:
	var n := 0
	for e in enemies:
		if e.team == team and e.target.alive():
			n += 1
	return n

## a team's band colour: 0 red, 1 blue, then the FFA palette
static func team_color(team: int) -> Color:
	return TEAM_COLORS[team % TEAM_COLORS.size()] if team >= 0 else Color(0.6, 0.6, 0.6)

## one downed bot back on its feet at `at` with a share of its health (Fracture Royale's squad revive)
func revive(e: Enemy, at: Vector3, share := 0.5) -> void:
	e.state = State.ENGAGE
	e.target.hp = e.target.max_hp * share
	e.target.shield = 0.0
	_set_wear(e.mover, 0)
	e.target.down = 0.0
	e.dying = 0.0
	e.timer = 0.0
	e.mover.position = at
	e.mover.visible = true
	_reset_moves(e)

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
		# a telegraphed chain: the optics flare, then up to `combo` swings, the last a heavy
		e.combo_left = int(e.def.get("combo", 1)) - 1
		_swing(e, 0, float(e.def.damage), true)
		e.cool += e.swing_len + float(e.def.cool) * 1.5
		return
	e.burst_left = int(e.def.burst)
	e.burst_cool = 0.0
	if e.role == "suppress":
		e.cool *= 0.7      # suppressing fire: more often, a little wilder (_shoot)

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
	var spread: float = float(e.def.spread) * (1.6 if Vector2(vel.x, vel.z).length() > 3.0 else 1.0) * (1.3 if e.role == "suppress" else 1.0)
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
	shot.emit(from, end, e.team)
	Sound.sfx_at("smg" if String(e.def.get("weapon", "")) in ["smg", "pistol"] else "rifle", from, player.position, -8.0)
	if hit:
		_damage_foe(e, float(e.def.damage))

## the hit lands on whoever this bot is fighting
func _damage_foe(e: Enemy, damage: float, melee := false) -> void:
	var foe: Variant = e.get_meta("foe") if e.has_meta("foe") else null
	if foe == null:
		for o in enemies:
			if o.has_meta("hit_operator"):
				o.remove_meta("hit_operator")
		e.set_meta("hit_operator", true)
		_hit_operator(damage, e.mover.position, melee, e)
		return
	var o := foe as Enemy
	if o.has_meta("remote"):
		remote_hit.emit(o, damage)
		return
	var res: Dictionary = o.target.take(damage)
	if melee:
		o.target.impact += damage * 1.5
		o.target.knock += (o.mover.position - e.mover.position).normalized() * 1.5
	if float(res.shield) > 0.0:
		gunplay._shield_flash(o.target, bool(res.broke))
	_wear_bot(o)
	_last_hitter[o] = e.team
	if o.target.hp <= 0.0:
		o.target.hp = 0.0

## environmental damage (the Royale's closing fracture): straight to the hull, past the shield, no spark
func burn(damage: float) -> void:
	if down > 0.0 or hull <= 0.0:
		return
	hull -= damage
	hurt = maxf(hurt, 0.6)
	since_hit = 0.0   # the fracture counts as a hit: no hull regeneration while it burns you (royale_play caught the regen outrunning it)
	if hull <= 0.0:
		hull = 0.0
		down = 5.0
		deaths += 1
		Sound.sfx("down", -2.0)
		operator_down.emit()

func _hit_operator(damage: float, src := Vector3.INF, melee := false, attacker: Variant = null) -> void:
	if down > 0.0 or spawn_guard > 0.0:
		return
	# the dodge's i-frames, the guard and the parry take their share first (close_combat.gd)
	var close: Node = gunplay.get("close") if gunplay else null
	if close:
		damage = close.incoming(damage, src, melee, attacker)
		if damage <= 0.0:
			return
	_operator_flinch(damage, src, melee)
	since_hit = 0.0
	operator_hit.emit(damage)
	var chest: Vector3 = player.position + Vector3(0, 1.2, 0)
	if shield > 0.0:
		# the shield takes it: the shell lights up round the operator; what gets past lands on the hull
		var on_shield := minf(shield, damage)
		shield -= on_shield
		damage -= on_shield
		gunplay._dot(chest - Vector3(0, 0.2, 0), Color(0.35, 0.8, 1.0, 0.22), 1.0, 0.14)
		Sound.sfx("shield_break" if shield <= 0.0 else "shield", -7.0)
		if shield <= 0.0:
			for i in 10:
				gunplay._dot(chest, Color(0.4, 0.9, 1.0), 0.04, 0.4, Vector3(randf() - 0.5, randf() * 0.7, randf() - 0.5) * 6.0)
		if damage <= 0.0:
			return
	hull -= damage
	hurt = 1.0
	# the armour takes the round: a spark off the plating
	gunplay._dot(chest + Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 0.3, Color(1.0, 0.7, 0.3), 0.05, 0.12)
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
		var hit_e: Enemy = t.get_meta("enemy")
		_last_hitter[hit_e] = OPERATOR_HIT
		_wear_bot(hit_e)
		_defend_hit(hit_e, t, _damage, head)
		if head:
			_tally("headshot", 1)

## the daily-goal counters (progression.gd): kills land at once, headshots every fourth so the profile file is not
## written on every bolt; a finished goal is toasted through `goal_done` (the view decides how to show it)
signal goal_done(line: String)
## the bots' stuck step-offs so far (the tests)
var stepped_off := 0
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

# --------------------------------------------------------------------------------------------- armour damage (§5)
## The plating shows the fight: below 60% hull a scorch overlay darkens the armour, below 30% it is burnt through and
## the operator throws sparks. The operator's wear follows its hull (and clears as it mends); a bot's follows its hull
## until it stands again. One overlay material per level, shared, on the body's meshes (not the head or the hair).
var _wear_mats: Array[StandardMaterial3D] = []
var _op_wear := 0
var _spark_t := 0.0

func _wear_level(frac: float) -> int:
	return 2 if frac < 0.3 else (1 if frac < 0.6 else 0)

func _set_wear(mover: Node3D, level: int) -> void:
	if not mover or not mover.rig or not mover.rig.body_root:
		return
	if int(mover.get_meta("wear", 0)) == level:
		return
	mover.set_meta("wear", level)
	if _wear_mats.is_empty():
		for a in [0.28, 0.5]:
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.03, 0.025, 0.02, a)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.roughness = 1.0
			m.metallic_specular = 0.1
			_wear_mats.append(m)
	var rig: Node3D = mover.rig
	for ch in rig.body_root.find_children("*", "MeshInstance3D", true, false):
		var mi := ch as MeshInstance3D
		if mi == rig.head_mesh or mi == rig.hair_mesh:
			continue
		mi.material_overlay = null if level == 0 else _wear_mats[level - 1]

func _wear_bot(e: Enemy) -> void:
	if e.def.frame == "":
		return
	_set_wear(e.mover, _wear_level(e.target.hp / maxf(e.target.max_hp, 1.0)))

func _wear_step(dt: float) -> void:
	var lvl := _wear_level(hull / maxf(hull_max, 1.0)) if down <= 0.0 else 2
	if lvl != _op_wear:
		_op_wear = lvl
		_set_wear(player, lvl)
	if lvl == 2 and down <= 0.0:
		_spark_t -= dt
		if _spark_t <= 0.0:
			_spark_t = 0.35 + randf() * 0.5
			var at: Vector3 = player.position + Vector3((randf() - 0.5) * 0.5, 0.9 + randf() * 0.7, (randf() - 0.5) * 0.5)
			gunplay._dot(at, Color(1.0, 0.75, 0.3), 0.03, 0.35, Vector3(randf() - 0.5, 0.6, randf() - 0.5) * 2.5)

# --------------------------------------------------------------------------------------------- fighting moves (Nov 22)
## the operator stands up guarded for a moment after a respawn (no spawn kills); views set it as they respawn
const SPAWN_GUARD := 2.0
var spawn_guard := 0.0

## what the bot does with the hits it took this frame: the shove slides it, poise builds; past its poise it staggers, a
## heavy blow with a big shove knocks it down, anything less is a flinch
func _react(e: Enemy, dt: float) -> void:
	var t := e.target
	var m: Node3D = e.mover
	e.poise = maxf(0.0, e.poise - 12.0 * dt)
	e.recent_hits = maxf(0.0, e.recent_hits - dt)
	e.brace_t = maxf(0.0, e.brace_t - dt)
	e.guard_cool = maxf(0.0, e.guard_cool - dt)
	e.evade_cool = maxf(0.0, e.evade_cool - dt)
	e.retreat = maxf(0.0, e.retreat - dt)
	if e.def.fly <= 0.0:
		m.guard = e.brace_t > 0.0
	var shove := t.knock.length()
	if shove > 0.01:
		if e.def.fly <= 0.0:
			m.knock(t.knock)
		else:
			m.position += t.knock * 0.15
		t.knock = Vector3.ZERO
	if t.impact <= 0.0:
		return
	e.poise += t.impact
	var heavy := t.heavy
	t.impact = 0.0
	t.heavy = false
	if e.def.fly > 0.0:
		if e.poise >= float(e.def.poise):
			e.poise = 0.0
			t.stun = maxf(t.stun, 1.0)
		return
	if not m.rig or not m.rig.action:
		return
	if heavy and shove >= 5.0:
		e.floor_t = 1.6
		e.stagger_t = 0.0
		e.poise = 0.0
		m.rig.act("knockdown")
		Sound.sfx_at("stagger", m.position, player.position, -6.0)
	elif heavy or e.poise >= float(e.def.poise):
		e.stagger_t = 0.9
		e.poise = 0.0
		m.rig.act("stagger")
		Sound.sfx_at("stagger", m.position, player.position, -8.0)
	elif not m.rig.action.busy():
		# a flinch: away from the blow
		var from_front := (player.position - m.position).dot(Vector3(sin(m.heading), 0, cos(m.heading))) > 0.0
		m.rig.act("hit" if from_front else "hit_back")

## a bolt or a blow landed (gunplay's hit signal): poise for the bolts (melee carries its own), the elite's brace and the
## Executor's block
func _defend_hit(e: Enemy, t: Gunplay.Target, damage: float, head: bool) -> void:
	var melee := t.impact > 0.0
	if not melee:
		t.impact += damage * (1.2 if head else 0.5)
	if not t.alive():
		return
	var front := (player.position - e.mover.position).dot(Vector3(sin(e.mover.heading), 0, cos(e.mover.heading))) > 0.0
	match String(e.def.get("guard", "")):
		"brace":
			e.recent_hits += 1.0
			if e.recent_hits >= 3.0 and e.brace_t <= 0.0 and e.guard_cool <= 0.0 and e.stagger_t <= 0.0:
				e.brace_t = 1.8
				e.guard_cool = 5.0
			if e.brace_t > 0.0 and front and not melee:
				# behind the plating: 60% of a frontal bolt comes back off
				t.hp = minf(t.max_hp, t.hp + damage * 0.6)
				t.impact *= 0.3
				gunplay._dot(t.box.get_center() + (player.position - e.mover.position).normalized() * 0.4, Color(1.0, 0.8, 0.4, 0.6), 0.12, 0.12)
		"block":
			if melee and front and e.windup <= 0.0 and e.guard_cool <= 0.0 and e.stagger_t <= 0.0:
				if t.heavy:
					# a heavy blow breaks the guard: the stagger follows from the poise
					t.impact += 200.0
					e.guard_cool = 3.0
				elif _rng.randf() < 0.45:
					t.hp = minf(t.max_hp, t.hp + damage * 0.75)
					t.impact *= 0.2
					e.guard_cool = 2.5
					blocks += 1
					if e.mover.rig:
						e.mover.rig.act("parry")
					Sound.sfx_at("block", e.mover.position, player.position, -5.0)
	# hurt: a gunner backs off once a life to recover
	if not e.def.melee and t.hp < t.max_hp * 0.3 and not e.has_meta("retreated") and e.def.fly <= 0.0:
		e.set_meta("retreated", true)
		e.retreat = 3.0

## the bots' defensive tallies (the tests): side-steps, blocks
var evades := 0
var blocks := 0

## the side-step: a scout or marksman (or an Executor closing) steps out of a held crosshair or away from a live grenade
func _defend(e: Enemy, _dt: float, sees: bool, dist: float, to_foe: Vector3) -> void:
	if float(e.def.get("evade", 0.0)) <= 0.0 or e.evade_cool > 0.0 or not sees or e.def.fly > 0.0:
		return
	if e.windup > 0.0 or (e.mover.rig and e.mover.rig.action and e.mover.rig.action.busy()):
		return
	var threat := Vector3.INF
	var cam: Camera3D = player.get("cam")
	if cam and is_instance_valid(cam) and gunplay and float(gunplay.warm) < 0.3 and dist < 35.0:
		var from := cam.global_position
		var dir := -cam.global_transform.basis.z
		var c := e.target.box.get_center()
		var off := (c - from) - dir * (c - from).dot(dir)
		if off.length() < 1.1:
			threat = player.position
	var gr: Node = gunplay.get("grenades") if gunplay else null
	if threat == Vector3.INF and gr:
		for g in gr.live:
			if (g.pos as Vector3).distance_to(e.mover.position) < 5.0:
				threat = g.pos
				break
	if threat == Vector3.INF:
		e.evade_cool = 0.5
		return
	e.evade_cool = 3.5 + _rng.randf() * 2.0
	if _rng.randf() >= float(e.def.evade):
		return
	var away := e.mover.position - threat
	away.y = 0.0
	var side := Vector3(-to_foe.z, 0, to_foe.x).normalized() * (1.0 if _rng.randf() < 0.5 else -1.0)
	var dir2 := (side + away.normalized() * 0.4).normalized() if away.length() > 0.1 else side
	e.mover.dodge(dir2, 3.4, 0.45, 0.2)
	e.burst_left = 0
	evades += 1

## one swing of a chain (k 0..2) or a gunner's butt-strike: the clip, the wind-up to the blow (the first of a chain
## telegraphed by a flare of the optics), then the recovery before the next
func _swing(e: Enemy, k: int, dmg: float, telegraph: bool) -> void:
	var m: Node3D = e.mover
	var cls: String = m.rig.combat_class() if m.rig and m.rig.has_method("combat_class") else "nyx"
	var name := "melee_%d" % (clampi(k, 0, 2) + 1)
	var clip: Dictionary = Clips.variant(cls, name)
	var len := float(clip.get("len", 0.5)) / Clips.speed_of(cls)
	var hit_u := 0.5
	for ev in clip.get("events", []):
		if String(ev[1]) == "hit":
			hit_u = float(ev[0])
	var extra := 0.35 if telegraph else 0.0
	e.windup = hit_u * len + extra
	e.swing_len = len * (1.0 - hit_u) * 0.7 + 0.05
	e.set_meta("swing_k", k)
	e.set_meta("swing_dmg", dmg)
	m.combat_hold = 1.5
	if m.rig:
		m.rig.act(name, len + extra)
	if telegraph and m.rig:
		var head: Vector3 = m.position + Vector3(0, 1.7 * float(e.def.scale), 0) + Vector3(sin(m.heading), 0, cos(m.heading)) * 0.15
		gunplay._dot(head, Color(1.0, 0.15, 0.1), 0.14, 0.4)
		gunplay._dot(head, Color(1.0, 0.5, 0.3, 0.5), 0.3, 0.25)

## the operator's own reaction to a blow that got through: a flinch, a shove for a big one
func _operator_flinch(damage: float, src: Vector3, melee: bool) -> void:
	if not player or not player.rig or not player.rig.action:
		return
	if damage >= 8.0 and not player.rig.action.busy():
		player.rig.act("hit")
	if (damage >= 25.0 or melee) and src != Vector3.INF:
		var away: Vector3 = player.position - src
		away.y = 0.0
		if away.length() > 0.05:
			player.knock(away.normalized() * clampf(damage * 0.15, 1.5, 6.0))

## a bot back from the dead stands clean
func _reset_moves(e: Enemy) -> void:
	e.poise = 0.0
	e.stagger_t = 0.0
	e.floor_t = 0.0
	e.windup = 0.0
	e.swing_len = 0.0
	e.combo_left = 0
	e.brace_t = 0.0
	e.dying = 0.0
	e.retreat = 0.0
	if e.has_meta("retreated"):
		e.remove_meta("retreated")
	e.target.knock = Vector3.ZERO
	e.target.impact = 0.0
	e.target.heavy = false
	if e.mover.rig and e.mover.rig.action:
		e.mover.rig.action.stop(0.0)
	e.mover.guard = false


# --------------------------------------------------------------------------------------------- squad tactics (Nov 22)
## the bot a bot is fighting (null: the operator, or nothing yet)
static func _foe_of(e: Enemy) -> Variant:
	return e.get_meta("foe") if e.has_meta("foe") else null

## The owner's list: "flanking, cover, aggression and coordinated attacks". Every SQUAD_TICK the bots fighting the
## operator are given roles (TYPES `role` is each type's own preference; the nearest gunner suppresses, the next flanks,
## the one after takes cover, round again), a spotter calls the rest in (anyone within 25 m who has not seen the
## operator turns to fight), cover spots are picked from the obstacle boxes, and the fire tokens are dealt.
func _squad() -> void:
	var squad: Array[Enemy] = []
	for e in enemies:
		if e.team == operator_team or not e.target.alive() or e.has_meta("puppet"):
			continue
		if e.state == State.ENGAGE and _foe_of(e) == null:
			squad.append(e)
	if squad.is_empty():
		return
	# the call-out: squadmates near a fighting bot join the fight
	for o in enemies:
		if o.team == operator_team or not o.target.alive() or o.state != State.PATROL or o.has_meta("puppet"):
			continue
		for e in squad:
			if o.mover.position.distance_to(e.mover.position) < 25.0 and down <= 0.0:
				o.state = State.ALERT
				o.timer = ALERT_BEAT + _rng.randf() * 0.6
				break
	squad.sort_custom(func(a: Enemy, b: Enemy) -> bool: return a.mover.position.distance_squared_to(player.position) < b.mover.position.distance_squared_to(player.position))
	var cycle := ["suppress", "flank", "cover"]
	var k := 0
	var centre := Vector3.ZERO
	for e in squad:
		centre += e.mover.position
	centre /= squad.size()
	var side_sign := 1.0
	for e in squad:
		var pref := String(e.def.get("role", "flank"))
		var role := pref
		if e.def.melee or e.def.fly > 0.0 or pref == "cover" or pref == "assault":
			role = pref
		elif squad.size() > 1:
			role = cycle[k % cycle.size()]
			k += 1
		if role == "flank" and squad.size() < 2:
			role = "assault"     # a lone bot has no line to flank round: it presses in
		if role == "flank" and e.role != "flank":
			# flankers go to alternate sides of the line from the squad to the operator, fixed when the flank starts
			# (measured from the moving squad it would chase its own tail round the operator)
			e.flank_side = side_sign
			side_sign = -side_sign
			var ref := player.position - centre
			ref.y = 0.0
			e.set_meta("flank_ref", ref.normalized() if ref.length() > 0.5 else Vector3(0, 0, 1))
		if role == "cover" and (e.cover == Vector3.INF or e.cover_t <= 0.0 or e.cover.distance_to(player.position) < 4.0):
			e.cover = _find_cover(e)
			e.cover_t = 5.0
		e.role = role
		e.set_meta("squad_centre", centre)

## the operator is open: reloading, low or just swapped — the aggressive bots press in to 60% of their range
func _pressing() -> bool:
	if down > 0.0:
		return false
	var g = gunplay.gun() if gunplay and gunplay.has_method("gun") and not gunplay.guns.is_empty() else null
	return hull < hull_max * 0.35 or (g != null and (float(g.reloading) > 0.0 or float(g.get("drawing")) > 0.0))

## a fire token for a gunner (no more than FIRE_TOKENS bursts on the operator at once); a melee bot waits while
## another is mid-swing at the operator
func _may_attack(e: Enemy, foe: Variant) -> bool:
	if not tactics or foe != null:
		return true
	var firing := 0
	var swinging := false
	for o in enemies:
		if o == e or o.team == operator_team or not o.target.alive() or _foe_of(o) != null:
			continue
		if o.burst_left > 0:
			firing += 1
		if o.def.melee and (o.windup > 0.0 or o.swing_len > 0.0 or o.combo_left > 0):
			swinging = true
	if e.def.melee:
		if swinging:
			e.cool = maxf(e.cool, 0.4)
			return false
		return true
	# a bot in cover shoots only from the peek
	if e.role == "cover" and e.cover != Vector3.INF and e.peek_t <= 0.0:
		return false
	if firing >= FIRE_TOKENS:
		e.cool = maxf(e.cool, 0.35)
		return false
	return true

## the move the role asks for, or Vector2.INF to fight the ordinary way (the result rides meta "tac_move")
func _tactical_move(e: Enemy, dt: float, dist: float, to_op: Vector3, sees: bool) -> Vector2:
	var m: Node3D = e.mover
	var want: float = float(e.def.range)
	if _pressing() and float(e.def.get("aggro", 0.5)) >= 0.5 and e.role in ["assault", "flank"]:
		want *= 0.6
	var goal := Vector3.INF
	var run := false
	match e.role:
		"flank":
			# out to the side: a point at the fighting range, square to the line from the squad to the operator
			var line: Vector3 = e.get_meta("flank_ref") if e.has_meta("flank_ref") else -to_op.normalized()
			var side := Vector3(-line.z, 0, line.x) * e.flank_side
			var spot := player.position + (side - line * 0.2).normalized() * want
			var ang := (-to_op).normalized().angle_to((spot - player.position).normalized())
			if ang < 0.4:
				return Vector2.INF   # round the side: fight from here
			goal = spot
			run = true
		"cover":
			if e.cover == Vector3.INF:
				return Vector2.INF
			e.cover_t -= dt
			var at := e.cover
			var d0 := at - m.position
			d0.y = 0.0
			if d0.length() > 0.7:
				goal = at
				run = d0.length() > 3.0
			else:
				# in cover: duck for a beat, lean out to shoot for a beat (the peek is a step to the side of the box)
				e.peek_t -= dt
				if e.peek_t < -1.8 - _rng.randf():
					e.peek_t = 1.4 + _rng.randf() * 0.8
				if e.peek_t > 0.0:
					goal = at + e.cover_side * 1.1
				else:
					e.set_meta("tac_move", Vector2.ZERO)
					e.set_meta("tac_sprint", false)
					m.guard = false
					return Vector2.ZERO
		"suppress":
			# hold back and keep fire on (fires a little more often, a little wilder); it gives ground only when crowded,
			# never so far it loses the fight
			if dist < want * 0.7:
				goal = m.position - to_op.normalized() * 2.0
			elif dist > want * 1.6:
				goal = player.position - to_op.normalized() * want * 1.3
			else:
				return Vector2.INF
		"assault":
			if dist > want + 1.0:
				goal = player.position - to_op.normalized() * (want - 0.5)
				run = true
			else:
				return Vector2.INF
	if goal == Vector3.INF:
		return Vector2.INF
	var dg := goal - m.position
	dg.y = 0.0
	if dg.length() < 0.5:
		return Vector2.INF
	var mv := _toward(dg) * (1.0 if run else 0.7)
	e.set_meta("tac_move", mv)
	e.set_meta("tac_sprint", run)
	return mv

## a cover spot for `e`: the far side (from the operator) of a box at least chest high, within 14 m of the bot, at a
## range it can fight from, whose box really blocks the line to the operator from a crouch. INF when there is none.
func _find_cover(e: Enemy) -> Vector3:
	var m: Node3D = e.mover
	var best := Vector3.INF
	var best_d := 14.0
	var op := player.position
	for b: AABB in player.obstacles:
		if b.size.y < 1.0 or b.size.y > 30.0 or b.position.y < -40.0:
			continue
		var w := maxf(b.size.x, b.size.z)
		if w > 14.0 or minf(b.size.x, b.size.z) < 0.4:
			continue
		var c := b.get_center()
		c.y = m.position.y
		if c.distance_to(m.position) > best_d + w * 0.5:
			continue
		var away := c - op
		away.y = 0.0
		if away.length() < 3.0:
			continue
		away = away.normalized()
		# the spot behind the box, a body's width off its face on the far side
		var half := absf(away.x) * b.size.x * 0.5 + absf(away.z) * b.size.z * 0.5
		var spot := c + away * (half + 0.6)
		spot.y = float(m.ground_at.call(spot.x, spot.z))
		var dop := Vector2(spot.x - op.x, spot.z - op.z).length()
		if dop < float(e.def.range) * 0.5 or dop > float(e.def.range) * 1.8 + 6.0:
			continue
		# a crouching body there is hidden from the operator by this box
		var low := spot + Vector3(0, 0.9, 0)
		var hit: Variant = b.intersects_segment(low, op + Vector3(0, 1.2, 0))
		if hit == null:
			continue
		var d := spot.distance_to(m.position)
		if d < best_d:
			best_d = d
			best = spot
			e.cover_side = Vector3(-away.z, 0, away.x) * (1.0 if _rng.randf() < 0.5 else -1.0)
	return best

## the checkpoint: a few seconds with nothing fighting the operator, standing on the ground, and that spot is kept
func _checkpoint_step(dt: float) -> void:
	if not player or down > 0.0:
		_safe_t = 0.0
		return
	var fighting := false
	for e in enemies:
		if e.team != operator_team and e.target.alive() and e.state in [State.ALERT, State.ENGAGE] and _foe_of(e) == null:
			fighting = true
			break
	var grounded: bool = bool(player.get("grounded")) if "grounded" in player else true
	if fighting or not grounded or since_hit < 4.0:
		_safe_t = 0.0
		return
	_safe_t += dt
	if _safe_t > 3.0:
		checkpoint = player.position
		_safe_t = -2.0       # then again every five seconds while it stays calm
