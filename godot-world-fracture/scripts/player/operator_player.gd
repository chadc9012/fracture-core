extends Node3D
## The operator on foot (owner's Dec 4 plan, phase 2): the saved character (character_store.gd) built by character_rig.gd, walked
## with its own movement rules rather than the physics server — a ground height function, a list of obstacle boxes to slide
## around, a step onto kerbs, a jump — because the street slices are built from merged visual meshes with no collision shapes,
## and this stays cheap on the phone. Metres on a 1.85 m human; the body faces its local +Z (Mixamo), so `heading` is the yaw
## of the direction it walks. A chase camera (yaw, pitch, distance) follows from behind. The body's clips (idle / walk / run)
## follow the speed. `sprint` runs faster. Whoever owns the scene gives it `ground_at`, `obstacles` and `bounds`.

const Rig := preload("res://scripts/character/character_rig.gd")
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
var cam_yaw := 0.0
var cam_pitch := -0.18
var cam_dist := 4.2
const CAM_PIVOT := Vector3(0, 1.55, 0)
const CAM_SIDE := 0.45       # over the right shoulder

var _clip := ""

func build(look: Dictionary = {}) -> void:
	if rig:
		rig.queue_free()
	rig = Rig.new()
	add_child(rig)
	rig.build(look if not look.is_empty() else CharacterStore.load_look())
	rig.rotation.y = heading

func attach_camera(c: Camera3D) -> void:
	cam = c
	cam_yaw = heading + PI    # behind the body
	_place_camera(1.0)

## `move`: x right / y forward on the screen, relative to the camera; `look`: drag in px
func step(dt: float, move: Vector2, look: Vector2, jump: bool, sprint: bool) -> void:
	# look
	cam_yaw -= look.x * 0.0045
	cam_pitch = clampf(cam_pitch - look.y * 0.0035, -0.9, 0.45)
	# the camera looks along -Z of its yaw: forward on the stick walks away from the camera
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
	var want := (fwd * move.y + right * move.x)
	var mag := minf(want.length(), 1.0)
	var top := (SPRINT if sprint else RUN) if mag > 0.6 else WALK
	var target := want.normalized() * top * mag if mag > 0.02 else Vector3.ZERO
	var rate := ACCEL if mag > 0.02 else DECEL
	var flat := Vector3(velocity.x, 0, velocity.z).move_toward(target, rate * dt)
	if mag > 0.02:
		var want_heading := atan2(want.x, want.z)
		heading = lerp_angle(heading, want_heading, minf(1.0, TURN * dt))
	# vertical
	var gy := ground_at.call(position.x, position.z) as float
	if grounded and jump:
		y_vel = JUMP_V
		grounded = false
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
	if rig:
		rig.rotation.y = heading
	_animate(flat.length(), sprint)
	_place_camera(dt)

func _slide(to: Vector2, from: Vector2, y: float) -> Vector2:
	var p := to
	p.x = clampf(p.x, bounds.position.x + RADIUS, bounds.end.x - RADIUS)
	p.y = clampf(p.y, bounds.position.y + RADIUS, bounds.end.y - RADIUS)
	for i in 2:   # two passes settle corners
		for box in obstacles:
			if box.end.y <= y + STEP or box.position.y > y + 1.7:
				continue
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
	var pivot := position + CAM_PIVOT
	var back := Vector3(sin(cam_yaw) * cos(cam_pitch), -sin(cam_pitch), cos(cam_yaw) * cos(cam_pitch))
	var side := Vector3(cos(cam_yaw), 0, -sin(cam_yaw)) * CAM_SIDE
	var want := pivot + back * cam_dist + side
	# keep the camera out of the walls: pull it in along the bounds, and never below the ground
	want.x = clampf(want.x, bounds.position.x + 0.3, bounds.end.x - 0.3)
	want.z = clampf(want.z, bounds.position.y + 0.3, bounds.end.y - 0.3)
	want.y = maxf(want.y, (ground_at.call(want.x, want.z) as float) + 0.4)
	want = _clear_camera(pivot, want)
	var k := 1.0 if dt >= 1.0 else 1.0 - exp(-14.0 * dt)
	cam.position = cam.position.lerp(want, k)
	cam.look_at(pivot + side * 0.6 + Vector3(0, 0.1, 0))

## where the eyes are, for anything that wants to look from the operator
func eye() -> Vector3:
	return position + Vector3(0, EYE, 0)

## the camera pulled in toward the pivot until it sits outside every obstacle (a facade, a parked car, a planter)
func _clear_camera(pivot: Vector3, want: Vector3) -> Vector3:
	var t := 1.0
	while t > 0.15:
		var p := pivot.lerp(want, t)
		var hit := false
		for box in obstacles:
			if box.grow(0.25).has_point(p):
				hit = true
				break
		if not hit:
			return p
		t -= 0.05
	return pivot.lerp(want, 0.15)
