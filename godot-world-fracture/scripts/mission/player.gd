extends CharacterBody3D
## The Operator on foot: the player's own character (character_rig.gd, from the creator's save) with a third-person shoulder
## camera, walk/run/idle/combat animations from the body, and the powers the story wakes (m01_story.gd powers()):
##   0  civilian: walk and run only
##   1  the rifle (hitscan, 30-round magazine) and a melee strike
##   2  + the resonance blast (area burst, cooldown) and a dash
##   3  everything
## Input comes from mission_01.gd (keyboard/mouse or the touch controls) through move/look/aim/fire fields each frame.

signal fired(from: Vector3, to: Vector3, hit: Object)
signal blasted(at: Vector3, radius: float)
signal hurt(hp: float)

const Rig := preload("res://scripts/character/character_rig.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Weapons := preload("res://scripts/combat/weapons.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const WALK := 2.4
const RUN := 5.6
const MAG := 30
const FIRE_RATE := 9.0
const DAMAGE := 20.0
## the worn weapon (gear_store.gd loadout, phase 2/4 merge): its frame sets the magazine, rate and damage; its model rides
## the hand (the authored rifle GLBs, as gunplay.gd mounts them); the worn outfit tints the body. Bare values are the
## mission's own carbine, so a fresh save plays as before.
var mag_size := MAG
var fire_rate := FIRE_RATE
var damage := DAMAGE
var frame := "AUTO"
var weapon_name := "Resonance carbine"
const MELEE_DAMAGE := 40.0
const BLAST_DAMAGE := 140.0
const BLAST_RADIUS := 6.5
const BLAST_COOLDOWN := 6.0
const DASH_COOLDOWN := 2.5

var rig: Node3D
var yaw_pivot: Node3D
var pitch_pivot: Node3D
var arm: SpringArm3D
var cam: Camera3D
var rifle: Node3D
var muzzle: Node3D
var _flash: OmniLight3D

# input, written by the mission every frame
var move := Vector2.ZERO        # x right, y forward, length 0..1
var run := false
var fire_held := false
var look_delta := Vector2.ZERO  # pixels this frame

var powers := 0
var hp := 100.0
var hp_floor := 0.0
var ammo := MAG
var reserve := 210
var blast_cd := 0.0
var dash_cd := 0.0
var _fire_cd := 0.0
var _reload := 0.0
var _dash_t := 0.0
var _dash_dir := Vector3.ZERO
var _since_hurt := 99.0
var _anim := ""
var pitch := -0.12
var frozen := false

func _ready() -> void:
	collision_layer = 2
	collision_mask = 1 | 4
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.34
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	add_child(shape)
	rig = Rig.new()
	add_child(rig)
	rig.build(Store.load_look() if Store.exists() else Store.default_look())
	_lock_root_motion()
	_fit_gear()
	_make_rifle()
	# camera: yaw on the body's position, pitch, a spring arm over the right shoulder
	yaw_pivot = Node3D.new()
	yaw_pivot.top_level = true
	add_child(yaw_pivot)
	pitch_pivot = Node3D.new()
	pitch_pivot.position = Vector3(0, 1.62, 0)
	yaw_pivot.add_child(pitch_pivot)
	arm = SpringArm3D.new()
	arm.spring_length = 2.5
	arm.collision_mask = 1
	arm.margin = 0.15
	arm.position = Vector3(0.62, 0.05, 0)
	var probe := SphereShape3D.new()
	probe.radius = 0.2
	arm.shape = probe
	pitch_pivot.add_child(arm)
	cam = Camera3D.new()
	cam.fov = 60.0
	cam.near = 0.05
	cam.far = 1800.0
	arm.add_child(cam)

## Mixamo clips carry the walk in the hips: keep the bob, drop the drift, and loop them
func _lock_root_motion() -> void:
	var ap: AnimationPlayer = rig.anim
	if not ap:
		return
	for nm in ap.get_animation_list():
		var an := ap.get_animation(nm)
		an.loop_mode = Animation.LOOP_LINEAR
		for t in an.get_track_count():
			if an.track_get_type(t) == Animation.TYPE_POSITION_3D and String(an.track_get_path(t)).ends_with("mixamorig_Hips"):
				var first: Vector3 = an.track_get_key_value(t, 0)
				for k in an.track_get_key_count(t):
					var v: Vector3 = an.track_get_key_value(t, k)
					an.track_set_key_value(t, k, Vector3(first.x, v.y, first.z))

## the worn primary from the inventory (gear_store.gd): frame numbers in the mission's units, the outfit on the body
func _fit_gear() -> void:
	var gear := Gear.load_save()
	var lo := Gear.loadout(gear)
	if not lo.is_empty():
		var w: Dictionary = lo[0]
		frame = String(w.frame)
		weapon_name = String(w.name)
		var f: Dictionary = Weapons.FRAMES[frame]
		mag_size = int(f.mag)
		fire_rate = float(f.burst) / float(f.fire_rate) if int(f.burst) > 1 else 1.0 / float(f.fire_rate)
		damage = DAMAGE * float(f.damage) * float(w.mult) / (1.0 if int(f.burst) <= 1 else 1.4)
		ammo = mag_size
		reserve = int(f.reserve)
	if not civilian:
		OutfitLook.apply(rig, Gear.outfit(str(gear.get("outfit", ""))))

func _make_rifle() -> void:
	var sk: Skeleton3D = rig.skeleton
	if not sk:
		return
	var hand := sk.find_bone("mixamorig_RightHand")
	if hand < 0:
		return
	var att := BoneAttachment3D.new()
	att.bone_idx = hand
	sk.add_child(att)
	rifle = Node3D.new()
	rifle.position = Vector3(0.0, 0.1, 0.05)
	rifle.rotation_degrees = Vector3(0, 0, -90)
	att.add_child(rifle)
	# the worn weapon's authored model when it exists (gunplay.gd's mount: bone scale undone, barrel along the bone's +z)
	var model_path: String = "res://models/weapons/" + String(Weapons.FRAMES[frame].model)
	if ResourceLoader.exists(model_path):
		var held := Node3D.new()
		held.scale = Vector3.ONE / maxf(att.global_transform.basis.get_scale().y, 1e-4)
		held.rotation.y = PI
		att.add_child(held)
		held.add_child((load(model_path) as PackedScene).instantiate())
		rifle.visible = false
		rifle.set_meta("authored", held)
		muzzle = Node3D.new()
		muzzle.position = Vector3(0, 0.07, 0.8 + float(Weapons.FRAMES[frame].muzzle_dz))
		held.add_child(muzzle)
		_flash = OmniLight3D.new()
		_flash.light_color = Color(1.0, 0.8, 0.5)
		_flash.omni_range = 4.0
		_flash.light_energy = 0.0
		muzzle.add_child(_flash)
		held.visible = false
		return
	var body := StandardMaterial3D.new()
	body.albedo_color = Color(0.09, 0.095, 0.1)
	body.metallic = 0.7
	body.roughness = 0.35
	var accent := StandardMaterial3D.new()
	accent.albedo_color = Color(0.3, 0.85, 1.0)
	accent.emission_enabled = true
	accent.emission = Color(0.3, 0.85, 1.0)
	accent.emission_energy_multiplier = 3.0
	var part := func(size: Vector3, pos: Vector3, mat: Material) -> void:
		var mi := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = size
		mi.mesh = b
		mi.position = pos
		mi.material_override = mat
		rifle.add_child(mi)
	# a compact carbine: receiver, barrel and shroud, stock, magazine, optic, the Resonance strip
	part.call(Vector3(0.05, 0.09, 0.42), Vector3(0, 0, 0.12), body)
	part.call(Vector3(0.03, 0.03, 0.3), Vector3(0, 0.015, 0.48), body)
	part.call(Vector3(0.045, 0.055, 0.2), Vector3(0, 0.01, 0.38), body)
	part.call(Vector3(0.04, 0.1, 0.18), Vector3(0, -0.01, -0.17), body)
	part.call(Vector3(0.035, 0.13, 0.06), Vector3(0, -0.1, 0.12), body)
	part.call(Vector3(0.035, 0.04, 0.1), Vector3(0, 0.07, 0.1), body)
	part.call(Vector3(0.052, 0.012, 0.3), Vector3(0, 0.03, 0.15), accent)
	muzzle = Node3D.new()
	muzzle.position = Vector3(0, 0.015, 0.64)
	rifle.add_child(muzzle)
	_flash = OmniLight3D.new()
	_flash.light_color = Color(1.0, 0.8, 0.5)
	_flash.omni_range = 4.0
	_flash.light_energy = 0.0
	muzzle.add_child(_flash)
	rifle.visible = false

## Mission 01 opens at home: the operator wakes in regular clothes (a sweater, jeans and trainers; the civ bodies,
## scripts/build-operator-civilian.py) and is only in the armour the player built once the Fracture wakes their powers
## (owner, Nov 10: "have on regular clothes instead of armor"). A robot stays a robot.
var civilian := false

func dress(civ: bool) -> void:
	if civ == civilian:
		return
	var look: Dictionary = Store.load_look() if Store.exists() else Store.default_look()
	if civ and String(look.get("body", "male")) == "robot":
		return
	civilian = civ
	if civ:
		look = preload("res://scripts/character/wardrobe.gd").civ(look)
	rig.build(look)
	_lock_root_motion()
	_fit_gear()
	_make_rifle()
	set_powers(powers)

func set_powers(p: int) -> void:
	powers = p
	if p >= 1 and civilian:
		dress(false)
		return
	if rifle:
		var held: Variant = rifle.get_meta("authored") if rifle.has_meta("authored") else null
		if held != null:
			(held as Node3D).visible = p >= 1
		else:
			rifle.visible = p >= 1

## the point the camera's centre looks at (for aiming and the crosshair)
func aim_ray() -> Array:
	var from := cam.global_position
	var dir := -cam.global_transform.basis.z
	return [from, dir]

func _physics_process(delta: float) -> void:
	yaw_pivot.global_position = global_position
	if frozen:
		velocity = Vector3.ZERO
		_play("idle")
		return
	# look
	yaw_pivot.rotation.y -= look_delta.x * 0.005
	pitch = clampf(pitch - look_delta.y * 0.004, -1.1, 0.75)
	pitch_pivot.rotation.x = pitch
	look_delta = Vector2.ZERO
	# move relative to the camera
	var basis_y := Basis(Vector3.UP, yaw_pivot.rotation.y)
	var wish := basis_y * Vector3(move.x, 0, -move.y)
	if wish.length() > 1.0:
		wish = wish.normalized()
	var speed := RUN if run and not fire_held else WALK
	if _dash_t > 0.0:
		_dash_t -= delta
		velocity.x = _dash_dir.x * 14.0
		velocity.z = _dash_dir.z * 14.0
	else:
		var target := wish * speed
		velocity.x = move_toward(velocity.x, target.x, 30.0 * delta)
		velocity.z = move_toward(velocity.z, target.z, 30.0 * delta)
	if not is_on_floor():
		velocity.y -= 22.0 * delta
	else:
		velocity.y = -0.5
	move_and_slide()
	# face where we go, or where we aim when armed and shooting
	var face_dir := Vector3.ZERO
	if powers >= 1 and fire_held:
		face_dir = basis_y * Vector3.FORWARD
	elif Vector2(velocity.x, velocity.z).length() > 0.3:
		face_dir = Vector3(velocity.x, 0, velocity.z)
	if face_dir != Vector3.ZERO:
		var want := atan2(face_dir.x, face_dir.z)
		rig.rotation.y = lerp_angle(rig.rotation.y, want, minf(1.0, 12.0 * delta))
	# animation
	var flat_speed := Vector2(velocity.x, velocity.z).length()
	if flat_speed > 3.6:
		_play("run")
	elif flat_speed > 0.4:
		_play("walk")
	elif powers >= 1:
		_play("combat")
	else:
		_play("idle")
	_point_rifle()
	# weapon
	_fire_cd -= delta
	blast_cd = maxf(0.0, blast_cd - delta)
	dash_cd = maxf(0.0, dash_cd - delta)
	if _flash:
		_flash.light_energy = maxf(0.0, _flash.light_energy - delta * 40.0)
	if _reload > 0.0:
		_reload -= delta
		if _reload <= 0.0:
			var take := mini(mag_size - ammo, reserve)
			ammo += take
			reserve -= take
	elif powers >= 1 and fire_held and _fire_cd <= 0.0:
		if ammo > 0:
			_shoot()
		else:
			reload()
	# health comes back after a few quiet seconds
	_since_hurt += delta
	if _since_hurt > 4.0 and hp < 100.0:
		hp = minf(100.0, hp + 12.0 * delta)

## the authored rifle points down the camera's line from the hand (the walk and run clips swing an empty hand, which
## left the gun pointing at the sky or hanging upside down; owner's phone test, Nov 9)
func _point_rifle() -> void:
	if not rifle or not cam or not rifle.has_meta("authored"):
		return
	var held: Node3D = rifle.get_meta("authored")
	if not held.visible:
		return
	var at := held.global_position
	var r := aim_ray()
	var target: Vector3 = r[0] + r[1] * 30.0
	var dir := (target - at).normalized()
	if absf(dir.y) > 0.98:
		return
	held.global_transform = Transform3D(Basis.looking_at(-dir, Vector3.UP), at)

func _play(nm: String) -> void:
	if _anim == nm or not rig.anim or not rig.anim.has_animation(nm):
		return
	_anim = nm
	rig.anim.play(nm, 0.2)

func reload() -> void:
	if _reload > 0.0 or ammo >= mag_size or reserve <= 0:
		return
	_reload = float(Weapons.FRAMES[frame].reload) if Weapons.FRAMES.has(frame) else 1.6

func reloading() -> bool:
	return _reload > 0.0

func _shoot() -> void:
	_fire_cd = 1.0 / fire_rate
	ammo -= 1
	var r := aim_ray()
	var from: Vector3 = r[0]
	var dir: Vector3 = (r[1] as Vector3).rotated(Vector3.UP, randf_range(-0.008, 0.008))
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from + dir * 1.0, from + dir * 90.0, 1 | 4)
	q.exclude = [get_rid()]
	var hit := space.intersect_ray(q)
	var to: Vector3 = hit.position if hit else from + dir * 90.0
	var collider: Object = hit.collider if hit else null
	if collider and collider.has_method("take_damage"):
		collider.take_damage(damage)
	if _flash:
		_flash.light_energy = 3.0
	fired.emit(muzzle.global_position if muzzle else global_position + Vector3(0, 1.4, 0), to, collider)

func melee() -> void:
	if powers < 1:
		return
	var fwd := Basis(Vector3.UP, rig.rotation.y) * Vector3.BACK
	for e in get_tree().get_nodes_in_group("echo"):
		var n := e as Node3D
		var d := n.global_position - global_position
		if d.length() < 2.4 and d.normalized().dot(fwd) > 0.2:
			n.call("take_damage", MELEE_DAMAGE)

func blast() -> bool:
	if powers < 2 or blast_cd > 0.0:
		return false
	blast_cd = BLAST_COOLDOWN
	var fwd := Basis(Vector3.UP, yaw_pivot.rotation.y) * Vector3.FORWARD
	var at := global_position + fwd * 3.5 + Vector3(0, 1.0, 0)
	for e in get_tree().get_nodes_in_group("echo"):
		var n := e as Node3D
		if n.global_position.distance_to(at) < BLAST_RADIUS:
			n.call("take_damage", BLAST_DAMAGE)
			if n.has_method("knock"):
				n.call("knock", (n.global_position - global_position).normalized() * 9.0)
	blasted.emit(at, BLAST_RADIUS)
	return true

func dash() -> bool:
	if powers < 2 or dash_cd > 0.0:
		return false
	dash_cd = DASH_COOLDOWN
	var basis_y := Basis(Vector3.UP, yaw_pivot.rotation.y)
	_dash_dir = (basis_y * Vector3(move.x, 0, -move.y)).normalized() if move.length() > 0.2 else basis_y * Vector3.FORWARD
	_dash_t = 0.22
	return true

func take_damage(d: float) -> void:
	hp = maxf(hp_floor, hp - d)
	_since_hurt = 0.0
	hurt.emit(hp)

## face the camera the way the body faces (after a teleport)
func snap_camera(yaw: float) -> void:
	yaw_pivot.rotation.y = yaw
	rig.rotation.y = yaw + PI
	pitch = -0.12
