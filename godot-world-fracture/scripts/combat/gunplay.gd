extends Node3D
const Sound := preload("res://scripts/audio/sound.gd")
## Shooting on foot (the Dec 4 plan, phase 2): the operator's gun in the right hand (the web game's authored rifle GLBs —
## rifle, rifle-sniper, rifle-fusion — on the RightHand bone, barrel along the bone's +Z as OperatorModel.tsx mounts them),
## hitscan bolts from the muzzle toward where the chase camera's crosshair points, stopped by the scene's obstacle boxes,
## landing on `targets` (practice dummies now, enemies next), tracers, a muzzle flash and impact sparks, and the combat clip
## while the trigger is warm. weapons.gd holds the frames and the magazine; this node is the scene side.

## the shot cue per frame (audio/sfx, scripts/build-sfx.py)
const SHOT_CUES := { "AUTO": "rifle", "SNIPER": "sniper", "FUSION": "fusion", "SMG": "smg", "SHOTGUN": "shotgun", "SIDEARM": "sidearm", "LMG": "lmg", "HEAVY": "heavy" }
const Weapons := preload("res://scripts/combat/weapons.gd")
const MODELS := "res://models/weapons/"

## something a bolt can hit: a world box, hull points, and the node that shows it (optional)
class Target:
	var box: AABB
	var hp: float
	var max_hp: float
	var node: Node3D
	var down := 0.0          # seconds until it stands again
	func _init(b: AABB, h: float, n: Node3D = null) -> void:
		box = b; hp = h; max_hp = h; node = n
	func alive() -> bool:
		return hp > 0.0

signal hit(target: Target, damage: float, head: bool)
signal killed(target: Target)

var player: Node3D            # operator_player.gd
var obstacles: Array[AABB] = []
var targets: Array[Target] = []
var guns: Array = []
var current := 0
var warm := 0.0               # seconds since the last shot, for the combat clip
var kills := 0
## no weapon in hand: before Mission 01's Fracture arms the operator the street is walked unarmed (owner, Nov 9)
var holstered := false
## aim help: shots go to a live foe within this many degrees of the crosshair (on by default on a touch screen)
var assist_deg := 4.5 if (DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")) else 0.0
var shots_fired := 0
var hits_landed := 0

var _hand: BoneAttachment3D
var _held: Node3D
var _models := {}
var _tracers: Array = []
var _flash: OmniLight3D
var _flash_t := 0.0
var _rng := RandomNumberGenerator.new()

## a kill resupplies: every carried gun gets half a magazine back into its reserve (to the frame's full reserve), so a
## long fight — a Fracture boss, a lockdown — is paced by kills rather than ended by an empty bag
func scavenge() -> void:
	for g in guns:
		var f: Dictionary = Weapons.FRAMES.get(g.frame, {})
		g.reserve = mini(int(g.reserve) + maxi(1, int(f.get("mag", 10)) / 2), int(f.get("reserve", 0)))

func gun() -> Weapons.Gun:
	return guns[current]

func setup(p: Node3D, boxes: Array[AABB]) -> void:
	player = p
	obstacles = boxes
	for f in Weapons.ORDER:
		guns.append(Weapons.Gun.new(f))
	_rng.seed = 7
	_mount()

## the gun models ride the body's RightHand bone; only the current frame's is visible
func _mount() -> void:
	if _hand:
		_hand.queue_free()
		_hand = null
	var rig: Node3D = player.rig
	if not rig or not rig.skeleton:
		return
	var sk: Skeleton3D = rig.skeleton
	var hb := -1
	for i in sk.get_bone_count():
		if sk.get_bone_name(i).ends_with("RightHand"):
			hb = i
			break
	if hb < 0:
		return
	_hand = BoneAttachment3D.new()
	_hand.bone_idx = hb
	sk.add_child(_hand)
	# the bone's world scale is undone so the gun stays metric (OperatorModel.tsx attachWeapons)
	var ws := _hand.global_transform.basis.get_scale().y
	_held = Node3D.new()
	_held.scale = Vector3.ONE / maxf(ws, 1e-4)
	_held.rotation.y = PI
	_hand.add_child(_held)
	for f in Weapons.ORDER:
		var path: String = MODELS + String(Weapons.FRAMES[f].model)
		if not ResourceLoader.exists(path):
			continue
		var m := (load(path) as PackedScene).instantiate() as Node3D
		_held.add_child(m)
		_models[f] = m
	_show_current()

func _show_current() -> void:
	for f in _models:
		(_models[f] as Node3D).visible = f == gun().frame and not holstered

func set_holstered(on: bool) -> void:
	holstered = on
	_show_current()

## the worn weapons from the gear (gear_store.gd loadout): one gun per worn slot, its item's name and power multiplier
func set_loadout(list: Array) -> void:
	if list.is_empty():
		return
	var was := gun().frame if not guns.is_empty() else ""
	guns.clear()
	for w in list:
		var g := Weapons.Gun.new(Weapons.known(String(w.frame)))
		g.label = String(w.name)
		g.mult = float(w.mult)
		guns.append(g)
	current = 0
	for i in guns.size():
		if guns[i].frame == was:
			current = i
			break
	_show_current()

func next_weapon() -> void:
	current = (current + 1) % guns.size()
	_show_current()

## the muzzle, world space (the viewmodel's muzzle sits 0.8 m down the barrel, further for the sniper)
func muzzle() -> Vector3:
	if _held:
		var dz := 0.8 + float(gun().def().muzzle_dz)
		return _held.global_transform * Vector3(0, 0.07, dz)
	return player.eye() + Vector3(0, -0.2, 0)

## where the crosshair points: the camera's forward ray, stopped by the first obstacle or target, else far away
func aim_point(cam: Camera3D) -> Vector3:
	var from := cam.global_position
	var dir := -cam.global_transform.basis.z
	# only what lies past the operator counts: a box between the camera and the operator's shoulder (a wall the camera
	# backed against, a parked car behind) pulled the aim point to the camera and every shot went sideways
	var near := from.distance_to(player.eye()) + 0.4 if player else 1.5
	var best := 400.0
	for b in obstacles:
		var p: Variant = b.intersects_ray(from, dir)
		if p != null:
			var dd := from.distance_to(p)
			if dd > near:
				best = minf(best, dd)
			elif b.has_point(from + dir * (near + 0.1)):
				best = minf(best, near + 0.1)     # the box reaches past the operator: it is the first thing hit
	for t in targets:
		if t.alive():
			var p2: Variant = t.box.intersects_ray(from, dir)
			if p2 != null and from.distance_to(p2) > near:
				best = minf(best, from.distance_to(p2))
	# aim help on a touch screen: a live target within `assist_deg` of the crosshair, nearer than what the ray hits, is
	# where the shot goes (thumbs cannot hold a crosshair on a strafing trooper the way a mouse can)
	if assist_deg > 0.0:
		var pick: Target = null
		var pick_a := deg_to_rad(assist_deg)
		for t in targets:
			if not t.alive():
				continue
			if t.has_meta("roster") and t.get_meta("enemy").team == t.get_meta("roster").operator_team:
				continue     # an ally bot
			var c: Vector3 = t.box.get_center()
			var to_c := c - from
			var dc := to_c.length()
			if dc <= near or dc > minf(best + 1.0, 120.0):
				continue
			var a := dir.angle_to(to_c)
			if a < pick_a:
				pick_a = a
				pick = t
		if pick:
			return pick.box.get_center() + Vector3(0, pick.box.size.y * 0.15, 0)
	return from + dir * maxf(best, near + 0.1)

func step(dt: float, cam: Camera3D, trigger: bool, reload: bool, moving_speed: float) -> void:
	warm += dt
	if holstered:
		trigger = false
		reload = false
	if reload and gun().reload():
		Sound.sfx("reload", -4.0)
	var was_reloading := gun().reloading > 0.0
	var empty_before := gun().mag <= 0
	var n := gun().step(dt, trigger)
	if trigger and empty_before and not was_reloading and gun().reloading > 0.0:
		Sound.sfx("dry", -6.0)
		Sound.sfx("reload", -4.0)
	for i in n:
		Sound.sfx(SHOT_CUES.get(gun().frame, "rifle"), -2.0, 0.05)
		for k in Weapons.pellets(gun().frame):
			_fire_one(cam, moving_speed)
	# tracers and the flash fade
	var keep: Array = []
	for tr in _tracers:
		tr.t -= dt
		if tr.t <= 0.0:
			tr.node.queue_free()
		else:
			(tr.node as MeshInstance3D).transparency = 1.0 - clampf(tr.t / 0.09, 0.0, 1.0)
			keep.append(tr)
	_tracers = keep
	if _flash:
		_flash_t -= dt
		_flash.visible = _flash_t > 0.0
	for t in targets:
		if not t.alive():
			t.down -= dt
			if t.down <= 0.0:
				t.hp = t.max_hp
				if t.node:
					t.node.visible = true
func _fire_one(cam: Camera3D, moving_speed: float) -> void:
	shots_fired += 1
	warm = 0.0
	player.combat_hold = 1.5
	var d: Dictionary = gun().def()
	var from := muzzle()
	var to := aim_point(cam)
	var dir := (to - from).normalized()
	# standing still steadies the gun toward its aimed spread; running opens it to the hip spread
	var steady := clampf(moving_speed / 5.4, 0.0, 1.0)
	var spread := float(d.spread) * lerpf(float(d.ads_spread), 1.0, steady)
	var side := dir.cross(Vector3.UP).normalized()
	var up := side.cross(dir)
	dir = (dir + side * _rng.randfn(0.0, spread) + up * _rng.randfn(0.0, spread)).normalized()
	player.recoil = minf(player.recoil + float(d.recoil), 0.25)
	# the body squares up to where it shoots
	player.heading = lerp_angle(player.heading, atan2(dir.x, dir.z), 0.6)
	# the first thing along the bolt: an obstacle or a target
	var dist := 400.0
	var hit_t: Target = null
	for b in obstacles:
		var p: Variant = b.intersects_ray(from, dir)
		if p != null:
			dist = minf(dist, from.distance_to(p))
	for t in targets:
		if not t.alive():
			continue
		var p2: Variant = t.box.intersects_ray(from, dir)
		if p2 != null and from.distance_to(p2) < dist:
			dist = from.distance_to(p2)
			hit_t = t
	var end := from + dir * dist
	tracer(from, end)
	spark(end, hit_t != null)
	if hit_t:
		var head := end.y > hit_t.box.position.y + hit_t.box.size.y * 0.82
		var dmg := Weapons.damage(gun().frame, dist, head) * gun().mult
		hit_t.hp -= dmg
		hits_landed += 1
		hit.emit(hit_t, dmg, head)
		Sound.sfx_at("headshot" if head else "hit", end, from, -3.0)
		if hit_t.hp <= 0.0:
			hit_t.hp = 0.0
			hit_t.down = 5.0
			kills += 1
			if hit_t.node:
				hit_t.node.visible = false
			Sound.sfx_at("down", end, from, -4.0)
			scavenge()
			killed.emit(hit_t)

func tracer(from: Vector3, to: Vector3, col := Color(1.0, 0.85, 0.55)) -> void:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	var len := from.distance_to(to)
	box.size = Vector3(0.02, 0.02, maxf(len - 0.3, 0.05))
	mi.mesh = box
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = 3.0
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = m
	add_child(mi)
	mi.global_position = (from + to) * 0.5
	if len > 0.05:
		mi.look_at(to, Vector3.UP if absf((to - from).normalized().dot(Vector3.UP)) < 0.99 else Vector3.RIGHT)
	_tracers.append({ "node": mi, "t": 0.09 })
	if not _flash:
		_flash = OmniLight3D.new()
		_flash.light_color = Color(1.0, 0.8, 0.5)
		_flash.light_energy = 3.0
		_flash.omni_range = 4.0
		add_child(_flash)
	if col.r > 0.9:
		_flash.global_position = from
		_flash_t = 0.05

func spark(at: Vector3, flesh: bool) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.06
	s.height = 0.12
	mi.mesh = s
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.3, 0.2) if flesh else Color(1.0, 0.9, 0.6)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = m
	add_child(mi)
	mi.global_position = at
	_tracers.append({ "node": mi, "t": 0.12 })

## a practice dummy: a post with a plate, standing on the ground at `at`
func add_dummy(at: Vector3, hp := 30.0) -> Target:
	var n := Node3D.new()
	n.position = at
	add_child(n)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.2, 0.21, 0.23)
	var plate := StandardMaterial3D.new()
	plate.albedo_color = Color(0.85, 0.45, 0.12)
	for spec in [[Vector3(0.12, 0.9, 0.12), Vector3(0, 0.45, 0), dark], [Vector3(0.6, 0.9, 0.08), Vector3(0, 1.3, 0), plate], [Vector3(0.3, 0.3, 0.1), Vector3(0, 1.9, 0), plate]]:
		var mi := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = spec[0]
		mi.mesh = b
		mi.position = spec[1]
		mi.material_override = spec[2]
		n.add_child(mi)
	var t := Target.new(AABB(at + Vector3(-0.3, 0, -0.1), Vector3(0.6, 2.05, 0.2)), hp, n)
	targets.append(t)
	return t

## turns the chase camera so the crosshair sits on the target's plate (tests and shots; the player does this by looking)
func aim_at(t: Target, cam: Camera3D) -> void:
	for i in 3:
		var centre := t.box.get_center() + Vector3(0, t.box.size.y * 0.15, 0)
		var dir := (centre - cam.global_position).normalized()
		player.cam_yaw = atan2(-dir.x, -dir.z)
		player.cam_pitch = asin(clampf(dir.y, -1.0, 1.0))
		player._place_camera(1.0)
