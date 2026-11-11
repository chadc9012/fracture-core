extends Node3D
const Sound := preload("res://scripts/audio/sound.gd")
## The operator on foot (owner's Dec 4 plan, phase 2): the saved character (character_store.gd) built by character_rig.gd, walked
## with its own movement rules rather than the physics server — a ground height function, a list of obstacle boxes to slide
## around, a step onto kerbs, a jump — because the street slices are built from merged visual meshes with no collision shapes,
## and this stays cheap on the phone. Metres on a 1.85 m human; the body faces its local +Z (Mixamo), so `heading` is the yaw
## of the direction it walks. A chase camera (yaw, pitch, distance) follows from behind. The body's clips (idle / walk / run)
## follow the speed. `sprint` runs faster. Whoever owns the scene gives it `ground_at`, `obstacles` and `bounds`.

const Rig := preload("res://scripts/character/character_rig.gd")
const Settings := preload("res://scripts/front/settings_store.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")

const WALK := 2.3
const RUN := 5.4
const SPRINT := 7.2
const ACCEL := 16.0
const DECEL := 22.0
const TURN := 11.0           # rad/s toward the move direction
const JUMP_V := 5.6
const GRAVITY := 17.0
const RADIUS := 0.36
const STEP := 0.35           # the kerb and small ledges are stepped onto, higher is a wall
const EYE := 1.55

var rig: Node3D
var heading := 0.0           # yaw the body faces
var velocity := Vector3.ZERO
var grounded := true
var y_vel := 0.0
## x0, x1, z0, z1 the operator may walk within
var bounds := Rect2(-1000, -1000, 2000, 2000)
## [Vector3 min, Vector3 max] world boxes to slide around (only those taller than STEP block)
var obstacles: Array[AABB] = []
## ground height under (x, z); set by the scene
var ground_at: Callable = func(_x: float, _z: float) -> float: return 0.0

# camera
var cam: Camera3D
var _step_t := 0.6
var cam_yaw := 0.0
var cam_pitch := -0.18
## the kick the gun adds to the pitch (gunplay.gd), settling back at RECOIL_SETTLE a second
var recoil := 0.0
const RECOIL_SETTLE := 1.2
var cam_dist := 4.2
var cam_pivot := Vector3(0, 1.55, 0)
const CAM_SIDE := 0.45       # over the right shoulder

var _clip := ""
## seconds the combat stance holds after a shot (gunplay.gd sets it); standing still plays the combat clip meanwhile
var combat_hold := 0.0

## out in the city the operator is in their own clothes, urban streetwear (owner, Nov 10: "regular civilian clothing urban
## style"); the armour is for the fights (raids, PvP, Killbox, bosses, Mission 01 after the Fracture)
var civilian := true

func build(look: Dictionary = {}) -> void:
	if rig:
		rig.queue_free()
	rig = Rig.new()
	add_child(rig)
	var l: Dictionary = look if not look.is_empty() else CharacterStore.load_look()
	if civilian:
		l = preload("res://scripts/character/wardrobe.gd").civ(l)
	rig.build(l)
	rig.rotation.y = heading

func attach_camera(c: Camera3D) -> void:
	cam = c
	cam_yaw = heading + PI    # behind the body
	_place_camera(1.0)

## `move`: x right / y forward on the screen, relative to the camera; `look`: drag in px
func step(dt: float, move: Vector2, look: Vector2, jump: bool, sprint: bool) -> void:
	# look
	var sens := Settings.sensitivity()
	cam_yaw -= look.x * 0.0045 * sens
	cam_pitch = clampf(cam_pitch - look.y * 0.0035 * sens * (-1.0 if Settings.invert() else 1.0), -0.9, 0.45)
	# the camera looks along -Z of its yaw: forward on the stick walks away from the camera
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
	var want := (fwd * move.y + right * move.x)
	var mag := minf(want.length(), 1.0)
	var top := (SPRINT if sprint else RUN) if mag > 0.6 else WALK
	var target := want.normalized() * top * mag if mag > 0.02 else Vector3.ZERO
	var rate := ACCEL if mag > 0.02 else DECEL
	var flat := Vector3(velocity.x, 0, velocity.z).move_toward(target, rate * dt)
	if combat_hold > 0.0 and not sprint:
		# in a fight the body faces where the camera looks and strafes, the way a shooter plays; it no longer turns to
		# face the camera when the stick pulls back
		heading = lerp_angle(heading, cam_yaw + PI, minf(1.0, TURN * dt))
	elif mag > 0.02:
		var want_heading := atan2(want.x, want.z)
		heading = lerp_angle(heading, want_heading, minf(1.0, TURN * dt))
	# vertical
	var gy := ground_at.call(position.x, position.z) as float
	var was_grounded := grounded
	if grounded and jump:
		y_vel = JUMP_V
		grounded = false
		if cam:
			Sound.sfx("jump", -10.0)
	if not grounded:
		y_vel -= GRAVITY * dt
	var ny := position.y + y_vel * dt
	if ny <= gy and y_vel <= 0.0:
		ny = gy
		y_vel = 0.0
		grounded = true
	elif ny > gy + 0.02:
		grounded = false
	# horizontal, sliding on obstacles and the bounds
	var nx := position.x + flat.x * dt
	var nz := position.z + flat.z * dt
	var p := _slide(Vector2(nx, nz), Vector2(position.x, position.z), ny)
	nx = p.x
	nz = p.y
	# a kerb or a low ledge is stepped onto; a drop is just a fall
	var g2 := ground_at.call(nx, nz) as float
	if grounded and g2 > ny and g2 - ny <= STEP:
		ny = g2
	elif grounded and g2 < ny - 0.02:
		grounded = false
	velocity = Vector3(flat.x, y_vel, flat.z)
	position = Vector3(nx, ny, nz)
	# footsteps and the landing, for the operator the camera follows (walkers and bots share this mover, silently)
	if cam:
		if grounded and not was_grounded and y_vel <= 0.0:
			Sound.sfx("land", -8.0)
		var sp := flat.length()
		if grounded and sp > 0.5:
			_step_t -= dt * sp
			if _step_t <= 0.0:
				_step_t = 2.1
				Sound.sfx("step", -14.0 + minf(sp, 7.0) * 0.6, 0.15)
		else:
			_step_t = minf(_step_t, 0.6)
	combat_hold = maxf(0.0, combat_hold - dt)
	recoil = maxf(0.0, recoil - RECOIL_SETTLE * dt * maxf(recoil, 0.05) * 4.0)
	if rig:
		rig.rotation.y = heading
	_animate(flat.length(), sprint)
	_place_camera(dt)

func _slide(to: Vector2, from: Vector2, y: float) -> Vector2:
	var p := to
	p.x = clampf(p.x, bounds.position.x + RADIUS, bounds.end.x - RADIUS)
	p.y = clampf(p.y, bounds.position.y + RADIUS, bounds.end.y - RADIUS)
	# the boxes within reach this step, found once: every walker, enemy and the operator runs this over every box on the
	# street (~1,000), and most are far away
	var reach := RADIUS + (to - from).length() + 0.5
	var near: Array[AABB] = []
	for box in obstacles:
		if p.x < box.position.x - reach or p.x > box.end.x + reach or p.y < box.position.z - reach or p.y > box.end.z + reach:
			continue
		if box.end.y <= y + STEP or box.position.y > y + 1.7:
			continue
		near.append(box)
	for i in 2:   # two passes settle corners
		for box in near:
			var cx := clampf(p.x, box.position.x, box.end.x)
			var cz := clampf(p.y, box.position.z, box.end.z)
			var d := p - Vector2(cx, cz)
			var dist := d.length()
			if dist >= RADIUS:
				continue
			if dist < 1e-4:
				# inside the box: push out along the shortest axis toward where we came from
				var dl := p.x - box.position.x; var dr := box.end.x - p.x
				var dn := p.y - box.position.z; var df := box.end.z - p.y
				var m := minf(minf(dl, dr), minf(dn, df))
				if m == dl: p.x = box.position.x - RADIUS
				elif m == dr: p.x = box.end.x + RADIUS
				elif m == dn: p.y = box.position.z - RADIUS
				else: p.y = box.end.z + RADIUS
			else:
				p = Vector2(cx, cz) + d / dist * RADIUS
	return p

func _animate(speed: float, sprint: bool) -> void:
	if not rig or not rig.anim:
		return
	var clip := "idle"
	if speed > 3.2:
		clip = "run"
	elif speed > 0.3:
		clip = "walk"
	elif combat_hold > 0.0 and rig.anim.has_animation("combat"):
		clip = "combat"
	var anim: AnimationPlayer = rig.anim
	if clip != _clip and anim.has_animation(clip):
		anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
		anim.play(clip, 0.18)
		_clip = clip
	if _clip == "run":
		anim.speed_scale = 1.25 if sprint else 1.0
	elif _clip == "walk":
		anim.speed_scale = clampf(speed / WALK, 0.6, 1.4)
	else:
		anim.speed_scale = 1.0

func _place_camera(dt: float) -> void:
	if not cam:
		return
	var pivot := position + cam_pivot
	var pitch := clampf(cam_pitch + recoil, -0.9, 0.6)
	var back := Vector3(sin(cam_yaw) * cos(pitch), -sin(pitch), cos(cam_yaw) * cos(pitch))
	var side := Vector3(cos(cam_yaw), 0, -sin(cam_yaw)) * CAM_SIDE
	var want := pivot + back * cam_dist + side
	# keep the camera out of the walls: pull it in along the bounds, and never below the ground
	want.x = clampf(want.x, bounds.position.x + 0.3, bounds.end.x - 0.3)
	want.z = clampf(want.z, bounds.position.y + 0.3, bounds.end.y - 0.3)
	want.y = maxf(want.y, (ground_at.call(want.x, want.z) as float) + 0.4)
	want = _clear_camera(pivot, want)
	# pulled in by a box right behind (a pillar, the overpass): never into the operator's head — up and over instead,
	# looking down past the shoulder (owner, Nov 11: the view was a face filling the screen)
	if (want - pivot).length() < 1.4:
		want = pivot + Vector3(back.x, 0.0, back.z).normalized() * 1.4 + Vector3(0, 1.1, 0)
	var k := 1.0 if dt >= 1.0 else 1.0 - exp(-14.0 * dt)
	cam.position = cam.position.lerp(want, k)
	cam.look_at(pivot + side * 0.6 + Vector3(0, 0.1, 0))

## where the eyes are, for anything that wants to look from the operator
func eye() -> Vector3:
	return position + Vector3(0, EYE, 0)

## the camera pulled in toward the pivot until it sits outside every obstacle (a facade, a parked car, a planter)
func _clear_camera(pivot: Vector3, want: Vector3) -> Vector3:
	# the first box the line from the pivot to the camera crosses: the camera stops just short of it
	var best := 1.0
	var dir := want - pivot
	var len := dir.length()
	if len < 0.01:
		return want
	var lo := Vector3(minf(pivot.x, want.x), minf(pivot.y, want.y), minf(pivot.z, want.z)) - Vector3.ONE * 0.25
	var hi := Vector3(maxf(pivot.x, want.x), maxf(pivot.y, want.y), maxf(pivot.z, want.z)) + Vector3.ONE * 0.25
	for box in obstacles:
		# only boxes the camera line's own bounds touch (a cheap reject for the ~1,000 on the street)
		if box.end.x < lo.x or box.position.x > hi.x or box.end.z < lo.z or box.position.z > hi.z or box.end.y < lo.y or box.position.y > hi.y:
			continue
		var g := box.grow(0.25)
		if g.has_point(pivot):
			continue
		var hit: Variant = g.intersects_segment(pivot, want)
		if hit != null:
			best = minf(best, maxf(0.15, (pivot.distance_to(hit) - 0.3) / len))
	return pivot.lerp(want, best)
