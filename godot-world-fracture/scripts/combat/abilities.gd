extends Node3D
## Operator abilities (owner, Nov 21: "class-specific powers with cooldowns … spectacular anime-inspired abilities"): two
## abilities on cooldowns and a super charged by the fight, per class, cast through the class's `cast` clip with
## ability_fx.gd's look. close_combat.gd owns and steps it (so every combat view has them); damage lands through
## gunplay.melee_hit (kills, drops, goals, a boss's poise all follow).
##
##   GOLIATH  BULWARK (a hard-light wall in front: cover for 8 s)   SEISMIC SLAM (leap-slam, knocks down all round)
##            super JUGGERNAUT (12 s: 70% less damage taken, melee ×2, shield refilled)
##   NYX      SHADOW STEP (blink 8 m ahead, unseen for 3 s)         PHANTOM BLADES (three blades seek three foes)
##            super BLADE DANCE (six dashes through the nearest foes, untouchable throughout)
##   CIPHER   ARC SURGE (lightning chains through four foes, stuns) GRAVITY WELL (a field at the crosshair holds foes)
##            super RESONANCE BLAST (the charge and the blast: 10 m, everything knocked down)
## Super energy: SUPER_PER_DAMAGE per point of damage the operator deals plus SUPER_PASSIVE a second; SUPER_COST to cast.
## Keys 1 / 2 / 3 on the desk, the three ability buttons on the phone.

const Sound := preload("res://scripts/audio/sound.gd")
const AbilityFx := preload("res://scripts/vfx/ability_fx.gd")

const SUPER_COST := 100.0
const SUPER_PER_DAMAGE := 0.06
const SUPER_PASSIVE := 0.45

const KITS := {
	"goliath": [
		{ "id": "bulwark", "name": "BULWARK", "cool": 18.0, "color": Color(1.0, 0.62, 0.2) },
		{ "id": "slam", "name": "SEISMIC SLAM", "cool": 14.0, "color": Color(1.0, 0.45, 0.15), "dmg": 60.0, "radius": 6.0 },
		{ "id": "juggernaut", "name": "JUGGERNAUT", "super": true, "color": Color(1.0, 0.7, 0.25), "seconds": 12.0 },
	],
	"nyx": [
		{ "id": "shadow_step", "name": "SHADOW STEP", "cool": 12.0, "color": Color(0.7, 0.4, 1.0), "dist": 8.0, "seconds": 3.0 },
		{ "id": "blades", "name": "PHANTOM BLADES", "cool": 12.0, "color": Color(0.85, 0.5, 1.0), "dmg": 35.0, "count": 3, "reach": 22.0 },
		{ "id": "blade_dance", "name": "BLADE DANCE", "super": true, "color": Color(0.8, 0.35, 1.0), "dmg": 80.0, "count": 6, "reach": 14.0 },
	],
	"cipher": [
		{ "id": "arc_surge", "name": "ARC SURGE", "cool": 10.0, "color": Color(0.4, 0.9, 1.0), "dmg": 40.0, "count": 4, "reach": 16.0 },
		{ "id": "gravity_well", "name": "GRAVITY WELL", "cool": 16.0, "color": Color(0.55, 0.4, 1.0), "radius": 5.0, "seconds": 5.0, "reach": 30.0 },
		{ "id": "resonance", "name": "RESONANCE BLAST", "super": true, "color": Color(0.35, 0.9, 1.0), "dmg": 200.0, "radius": 10.0 },
	],
}

var close: Node3D            # close_combat.gd
var cls := "goliath"
var cool := [0.0, 0.0]
var energy := 0.0
## active effects: the Juggernaut's seconds, the Shadow Step's seconds unseen, the wells, the wall, the dance
var juggernaut := 0.0
var cloaked := 0.0
var _wells: Array = []
var _wall := {}
var _dance: Array = []
var _dance_t := 0.0
var _pending := {}           # a cast waiting for its clip's moment: {i, at}
var casts := 0

func setup(c: Node3D) -> void:
	close = c
	cls = String(c.cls)

func kit() -> Array:
	return KITS.get(cls, KITS.goliath)

func _player() -> Node3D:
	return close.player

func _gunplay() -> Node3D:
	return close.gunplay

## damage the operator dealt (gunplay's hit signal) fills the super
func on_damage(dmg: float) -> void:
	energy = minf(SUPER_COST, energy + dmg * SUPER_PER_DAMAGE)

func ready_frac(i: int) -> float:
	var k: Dictionary = kit()[i]
	if bool(k.get("super", false)):
		return energy / SUPER_COST
	return 1.0 - cool[i] / float(k.cool)

func can_cast(i: int) -> bool:
	return ready_frac(i) >= 1.0 and _pending.is_empty() and _dance.is_empty()

## the HUD: each ability's name, readiness 0..1 and colour
func hud() -> Array:
	var out: Array = []
	for i in 3:
		var k: Dictionary = kit()[i]
		out.append({ "name": String(k.name), "ready": ready_frac(i), "color": k.color, "super": bool(k.get("super", false)) })
	return out

func cast(i: int) -> bool:
	if i < 0 or i > 2 or not can_cast(i):
		return false
	var p := _player()
	if not p or not p.rig:
		return false
	var k: Dictionary = kit()[i]
	if bool(k.get("super", false)):
		energy = 0.0
	else:
		cool[i] = float(k.cool)
	casts += 1
	# the cast clip's moment (its "cast" mark), then the effect
	var clip_len := 0.55
	var at := 0.3
	if p.rig.has_method("act"):
		p.rig.act("cast")
		var c: Dictionary = preload("res://scripts/character/combat_clips.gd").variant(cls, "cast")
		clip_len = float(c.get("len", 0.6)) / preload("res://scripts/character/combat_clips.gd").speed_of(cls)
		for e in c.get("events", []):
			if String(e[1]) == "cast":
				at = float(e[0]) * clip_len
	p.combat_hold = maxf(p.combat_hold, 1.5)
	if String(k.id) in ["juggernaut", "shadow_step"]:
		at = 0.05
	_pending = { "i": i, "at": at }
	if String(k.id) == "resonance":
		AbilityFx.charge(p.rig, at, k.color)
	Sound.sfx("shield", -6.0)
	return true

func step(dt: float) -> void:
	var p := _player()
	if not p:
		return
	energy = minf(SUPER_COST, energy + SUPER_PASSIVE * dt)
	for i in 2:
		cool[i] = maxf(0.0, cool[i] - dt)
	juggernaut = maxf(0.0, juggernaut - dt)
	cloaked = maxf(0.0, cloaked - dt)
	if not _pending.is_empty():
		_pending.at = float(_pending.at) - dt
		if float(_pending.at) <= 0.0:
			var i := int(_pending.i)
			_pending = {}
			_fire(i)
	_step_wells(dt)
	_step_wall(dt)
	_step_dance(dt)

func _fire(i: int) -> void:
	var k: Dictionary = kit()[i]
	match String(k.id):
		"bulwark":
			_bulwark(k)
		"slam":
			_blast(k, float(k.radius), float(k.dmg), 8.0)
		"juggernaut":
			juggernaut = float(k.seconds)
			var r: Node = _gunplay().roster
			if r:
				r.shield = r.shield_max
			AbilityFx.charge(_player().rig, 0.6, k.color)
			Sound.sfx("shield_break", -3.0)
		"shadow_step":
			var p := _player()
			var fwd := Vector3(-sin(p.cam_yaw), 0, -cos(p.cam_yaw))
			AbilityFx.dash(_gunplay(), p.rig, fwd, k.color, null)
			p.dodge(fwd, float(k.dist), 0.2, 0.3)
			cloaked = float(k.seconds)
		"blades":
			_seek(k, int(k.count), float(k.dmg), float(k.reach), false)
		"blade_dance":
			_start_dance(k)
		"arc_surge":
			_seek(k, int(k.count), float(k.dmg), float(k.reach), true)
		"gravity_well":
			_well(k)
		"resonance":
			_blast(k, float(k.radius), float(k.dmg), 9.0)

## the foes an ability can touch (close_combat's rules: never allies, cover or props)
func _foes() -> Array:
	return close._foes()

## a ring blast round the operator: everything inside takes the hit and the heavy shove (knocked down)
func _blast(k: Dictionary, radius: float, dmg: float, knock: float) -> void:
	var p := _player()
	var g := _gunplay()
	var at: Vector3 = p.position + Vector3(0, 0.95, 0)
	AbilityFx.blast(g, at, radius, k.color, Color(1, 1, 1), null, func(s: float) -> void: p.add_shake(s))
	for t in _foes():
		var c: Vector3 = t.box.get_center()
		var d := Vector2(c.x - p.position.x, c.z - p.position.z).length()
		if d > radius:
			continue
		var away := Vector3(c.x - p.position.x, 0, c.z - p.position.z)
		away = away.normalized() if away.length() > 0.05 else Vector3(0, 0, -1)
		g.melee_hit(t, dmg * (1.0 - 0.4 * d / radius), c, away * knock, 150.0, true, cls == "cipher")
	p.add_shake(0.8)
	Sound.sfx("explosion", -3.0)
	if is_inside_tree():
		AbilityFx.hit_stop(self, 0.1, 0.25)

## blades or arcs: one bolt to each of the nearest `n` foes in front (arcs hop foe to foe and stun)
func _seek(k: Dictionary, n: int, dmg: float, reach: float, chain: bool) -> void:
	var p := _player()
	var g := _gunplay()
	var from: Vector3 = p.position + Vector3(0, 1.4, 0)
	var fwd := Vector3(-sin(p.cam_yaw), 0, -cos(p.cam_yaw))
	var picks: Array = []
	var pool := _foes()
	pool.sort_custom(func(a, b) -> bool: return from.distance_to(a.box.get_center()) < from.distance_to(b.box.get_center()))
	for t in pool:
		if picks.size() >= n:
			break
		var to: Vector3 = t.box.get_center() - from
		if to.length() > reach:
			continue
		if not chain and fwd.angle_to(Vector3(to.x, 0, to.z)) > deg_to_rad(70.0):
			continue
		picks.append(t)
	for t in picks:
		var c: Vector3 = t.box.get_center()
		g.tracer(from, c, k.color)
		g.tracer(from + Vector3(0, 0.05, 0), c + Vector3(0, 0.05, 0), Color(1, 1, 1))
		g.melee_hit(t, dmg, c, (c - from).normalized() * 1.5, 40.0, false, chain)
		if chain:
			t.stun = maxf(float(t.stun), 1.0)
			from = c
		else:
			t.mark = maxf(float(t.mark), 4.0)
	Sound.sfx("fusion" if chain else "swing", -4.0)

## GOLIATH's wall: a box of hard light across the front, in the shared obstacle list (cover for both sides) for 8 s
func _bulwark(k: Dictionary) -> void:
	var p := _player()
	var g := _gunplay()
	var fwd := Vector3(-sin(p.cam_yaw), 0, -cos(p.cam_yaw))
	var c: Vector3 = p.position + fwd * 2.2
	var side := Vector3(-fwd.z, 0, fwd.x)
	var half := side.abs() * 1.8 + fwd.abs() * 0.25 + Vector3(0, 1.1, 0)
	var box := AABB(c - Vector3(half.x, 0, half.z), Vector3(half.x * 2.0, 2.2, half.z * 2.0))
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = box.size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(k.color.r, k.color.g, k.color.b, 0.35)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.emission_enabled = true
	m.emission = k.color
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(mi)
	mi.global_position = box.get_center()
	g.obstacles.append(box)
	_wall = { "node": mi, "index": g.obstacles.size() - 1, "t": 8.0 }
	Sound.sfx("shield", -2.0)

func _step_wall(dt: float) -> void:
	if _wall.is_empty():
		return
	_wall.t = float(_wall.t) - dt
	if float(_wall.t) <= 0.0:
		var g := _gunplay()
		var idx := int(_wall.index)
		if idx < g.obstacles.size():
			g.obstacles[idx] = g.GONE_BOX
		if is_instance_valid(_wall.node):
			(_wall.node as Node).queue_free()
		_wall = {}

## CIPHER's well: a field at the crosshair's point; foes in it are pulled in and held
func _well(k: Dictionary) -> void:
	var p := _player()
	var g := _gunplay()
	var cam: Camera3D = p.cam
	var at: Vector3 = p.position + Vector3(-sin(p.cam_yaw), 0, -cos(p.cam_yaw)) * 8.0
	if cam and is_instance_valid(cam):
		at = g.aim_point(cam)
		if at.distance_to(p.position) > float(k.reach):
			at = p.position + (at - p.position).normalized() * float(k.reach)
	at.y = p.position.y
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = float(k.radius)
	sm.height = float(k.radius) * 0.6
	mi.mesh = sm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(k.color.r, k.color.g, k.color.b, 0.22)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(mi)
	mi.global_position = at
	_wells.append({ "at": at, "t": float(k.seconds), "node": mi, "r": float(k.radius) })
	Sound.sfx("portal", -4.0)

func _step_wells(dt: float) -> void:
	var keep: Array = []
	for w in _wells:
		w.t = float(w.t) - dt
		if float(w.t) <= 0.0:
			if is_instance_valid(w.node):
				(w.node as Node).queue_free()
			continue
		for t in _foes():
			var c: Vector3 = t.box.get_center()
			var to: Vector3 = (w.at as Vector3) - c
			to.y = 0.0
			if to.length() < float(w.r):
				t.stun = maxf(float(t.stun), 0.3)
				t.knock += to.normalized() * 6.0 * dt
		(w.node as Node3D).rotate_y(dt * 1.5)
		keep.append(w)
	_wells = keep

## NYX's dance: up to six dashes, each through the nearest foe not yet cut, untouchable to the last
func _start_dance(k: Dictionary) -> void:
	var p := _player()
	var pool := _foes()
	pool.sort_custom(func(a, b) -> bool: return p.position.distance_to(a.box.get_center()) < p.position.distance_to(b.box.get_center()))
	_dance = []
	for t in pool:
		if _dance.size() >= int(k.count):
			break
		if p.position.distance_to(t.box.get_center()) <= float(k.reach):
			_dance.append(t)
	_dance_t = 0.0
	p.iframes = maxf(p.iframes, 0.3 + 0.28 * _dance.size())
	set_meta("dance_kit", k)

func _step_dance(dt: float) -> void:
	if _dance.is_empty():
		return
	_dance_t -= dt
	if _dance_t > 0.0:
		return
	var t = _dance.pop_front()
	var k: Dictionary = get_meta("dance_kit", kit()[2])
	var p := _player()
	if t == null or not t.alive():
		return
	var c: Vector3 = t.box.get_center()
	var to := Vector3(c.x - p.position.x, 0, c.z - p.position.z)
	var dir := to.normalized() if to.length() > 0.05 else Vector3(0, 0, -1)
	AbilityFx.dash(_gunplay(), p.rig, dir, k.color, null)
	p.dodge(dir, to.length() + 1.2, 0.18, 0.3)
	p.heading = atan2(dir.x, dir.z)
	if p.rig:
		p.rig.act("melee_%d" % (1 + (_dance.size() % 3)), 0.28)
	_gunplay().melee_hit(t, float(k.dmg), c, dir * 3.0, 120.0, true)
	Sound.sfx("swing_heavy", -4.0, 0.1)
	_dance_t = 0.28

## the Juggernaut's share of a blow (close_combat.incoming asks)
func damage_taken_mult() -> float:
	return 0.3 if juggernaut > 0.0 else 1.0

func melee_mult() -> float:
	return 2.0 if juggernaut > 0.0 else 1.0
