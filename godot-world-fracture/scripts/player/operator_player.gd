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
## open water deep enough to swim in: the water's surface at a point, or -INF where you wade or stand (regions give
## region.swim_surface; scenes without open water leave it unset). Over it the operator swims instead of walking on
## the surface: head and shoulders out, slower, no jump, the guns stowed (gunplay reads `swimming`).
var swim_at: Callable
## the lowest the chase camera may go (ground_at when unset; regions keep it above the water's surface)
var cam_floor: Callable
var swimming := false
const SWIM := 1.6
const SWIM_FAST := 2.6
const SWIM_SINK := 1.3        # body origin (the feet) below the surface while swimming: head and shoulders out
var _swim_tilt := 0.0
## diving (the web's underwater.ts): JUMP in the water ducks under, then the stick swims where the camera looks (pitch
## down to go deeper); JUMP under water kicks up. Oxygen drains under the surface and comes back above it; with none
## left the operator is carried up and cannot go down again until they have breathed. `bed_at` is the true sea floor
## and `water_top` the sea level (region_3d.gd fit_walker); without them there is no diving.
var bed_at: Callable
var water_top := -INF
var diving := false
var oxygen := 100.0
const OXYGEN_MAX := 100.0
const OXYGEN_DRAIN := 5.5     # per second under (underwater.ts OXYGEN_DRAIN_PER_SEC)
const OXYGEN_REGEN := 14.0
const DIVE_V := 2.2           # m/s straight down or up at full stick
const BUOYANCY := 0.6         # m/s drift up when not swimming down
const KICK_V := 2.6
var _dive_vy := 0.0
var _under_fx: CanvasLayer

# camera
var cam: Camera3D
var _step_t := 0.6
var cam_yaw := 0.0
var cam_pitch := -0.18
## the kick the gun adds to the pitch (gunplay.gd), settling back at RECOIL_SETTLE a second
var recoil := 0.0
## camera shake (a tank shot, a blast nearby): 0..~1.5, decays on its own
var shake := 0.0
var _shake_t := 0.0

func add_shake(amount: float) -> void:
	shake = minf(1.6, shake + amount)
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
	var surf := -INF
	if swim_at.is_valid():
		surf = swim_at.call(position.x, position.z) as float
	swimming = surf > -INF
	if diving and not swimming:
		diving = false            # under water over shallows: stand on the bed
	if swimming:
		top = SWIM_FAST if sprint else SWIM
		if diving:
			top *= 0.85
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
	if swimming and not diving and jump and bed_at.is_valid() and oxygen > 15.0 and position.y < surf - SWIM_SINK + 0.3:
		diving = true             # duck under
		_dive_vy = -DIVE_V
		jump = false
		if cam:
			Sound.sfx("water", -10.0, 0.1)
	if swimming and diving:
		# under water: forward on the stick goes where the camera looks, up or down; buoyancy lifts a still body
		var floor_y: float = (bed_at.call(position.x, position.z) as float) + 0.15
		var pitch_k := clampf(sin(cam_pitch + 0.18) * 2.2, -1.0, 1.0)   # level-ish looks hold the depth
		var want_vy := move.y * mag * pitch_k * DIVE_V + BUOYANCY
		if jump:
			_dive_vy = KICK_V
		if oxygen <= 0.0:
			want_vy = maxf(want_vy, DIVE_V)                        # out of air: up to the surface
		_dive_vy = move_toward(_dive_vy, want_vy, 4.0 * dt)
		gy = surf - SWIM_SINK
		jump = false
		grounded = true
		y_vel = 0.0
		position.y = clampf(position.y + _dive_vy * dt, floor_y, gy)
		if position.y >= gy - 0.01 and _dive_vy >= 0.0:
			diving = false                                         # surfaced
	elif swimming:
		# float at the surface: settle to the swimming depth (a jump or a fall into the water eases down to it)
		gy = surf - SWIM_SINK
		jump = false
		grounded = true
		y_vel = 0.0
		position.y = lerpf(position.y, gy, minf(1.0, 6.0 * dt))
	# breath: the head (≈1.6 m up the body) under the surface drains it
	var head_under := water_top > -INF and position.y + 1.6 < water_top
	oxygen = clampf(oxygen + (-OXYGEN_DRAIN if head_under else OXYGEN_REGEN) * dt, 0.0, OXYGEN_MAX)
	var was_grounded := grounded
	if grounded and jump:
		y_vel = JUMP_V
		grounded = false
		if cam:
			Sound.sfx("jump", -10.0)
	if not grounded:
		y_vel -= GRAVITY * dt
	var ny := position.y + y_vel * dt
	if swimming:
		ny = position.y
	elif ny <= gy and y_vel <= 0.0:
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
	var s2 := (swim_at.call(nx, nz) as float) if swim_at.is_valid() else -INF
	if swimming and s2 > -INF:
		pass                                   # still in deep water
	elif swimming:
		# wading out onto the shore or a bank: climb up onto it (the beach rises gently; a quay wall is a ledge you pull
		# yourself onto)
		ny = g2
	elif grounded and g2 > ny and g2 - ny <= STEP:
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
		if swimming and sp > 0.3:
			_step_t -= dt * sp
			if _step_t <= 0.0:
				_step_t = 1.6
				Sound.sfx("water", -18.0, 0.2)
		elif grounded and sp > 0.5:
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
		_swim_pose(dt, flat.length())
	_animate(flat.length(), sprint)
	_place_camera(dt)
	_underwater_fx()

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

## swimming lays the body forward in the water as it moves (upright, treading water, when still); the rig tips about its
## feet, so it is lifted and drawn back to keep the chest where the upright body's was
func _swim_pose(dt: float, speed: float) -> void:
	var want := 0.0
	if swimming:
		want = lerpf(0.25, 1.25, clampf(speed / SWIM, 0.0, 1.0))
		if diving:
			want = clampf(1.35 - _dive_vy * 0.35, 0.6, 2.3)       # head down going deeper, up rising
	_swim_tilt = lerpf(_swim_tilt, want, minf(1.0, 5.0 * dt))
	rig.rotation.x = _swim_tilt
	var lift := sin(_swim_tilt) * 0.95
	rig.position = Vector3(-sin(heading), 0.0, -cos(heading)) * lift + Vector3(0, (1.0 - cos(_swim_tilt)) * 1.15, 0)

## the camera under the surface: a blue-green murk over the view, and the oxygen read-out while it is not full
func _underwater_fx() -> void:
	if not cam or water_top == -INF:
		return
	var under := cam.global_position.y < water_top if cam.is_inside_tree() else cam.position.y < water_top
	var show_o2 := oxygen < OXYGEN_MAX - 0.5 or diving
	if not under and not show_o2:
		if _under_fx:
			_under_fx.visible = false
		return
	if not _under_fx:
		_under_fx = CanvasLayer.new()
		_under_fx.layer = 5
		var murk := ColorRect.new()
		murk.name = "Murk"
		murk.set_anchors_preset(Control.PRESET_FULL_RECT)
		murk.mouse_filter = Control.MOUSE_FILTER_IGNORE
		murk.color = Color(0.03, 0.22, 0.26, 0.55)
		_under_fx.add_child(murk)
		var o2 := Label.new()
		o2.name = "O2"
		o2.set_anchors_preset(Control.PRESET_CENTER_TOP)
		o2.offset_top = 64
		o2.offset_left = -80
		o2.offset_right = 80
		o2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		o2.add_theme_font_size_override("font_size", 22)
		o2.add_theme_constant_override("outline_size", 6)
		o2.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		_under_fx.add_child(o2)
		add_child(_under_fx)
	_under_fx.visible = true
	(_under_fx.get_node("Murk") as ColorRect).visible = under
	var lab := _under_fx.get_node("O2") as Label
	lab.visible = show_o2
	lab.text = "O₂ %d%%" % int(round(oxygen / OXYGEN_MAX * 100.0))
	lab.add_theme_color_override("font_color", Color(1.0, 0.35, 0.3) if oxygen < 20.0 else Color(0.75, 0.95, 1.0))

func _animate(speed: float, sprint: bool) -> void:
	if not rig or not rig.anim:
		return
	var clip := "idle"
	if swimming:
		# no swim clip on the Mixamo set: the run's arm swing, slowed, reads as a crawl with the body laid forward; the
		# walk, slow, as treading water
		clip = "run" if speed > 0.4 else "walk"
		var a: AnimationPlayer = rig.anim
		if clip != _clip and a.has_animation(clip):
			a.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
			a.play(clip, 0.25)
			_clip = clip
		a.speed_scale = 0.55 if clip == "run" else 0.35
		return
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
	var floor_f: Callable = cam_floor if cam_floor.is_valid() and not diving else (bed_at if diving and bed_at.is_valid() else ground_at)
	want.y = maxf(want.y, (floor_f.call(want.x, want.z) as float) + 0.4)
	want = _clear_camera(pivot, want)
	# pulled in by a box right behind (a pillar, the overpass): never into the operator's head — up and over instead,
	# looking down past the shoulder (owner, Nov 11: the view was a face filling the screen)
	if (want - pivot).length() < 1.4:
		want = pivot + Vector3(back.x, 0.0, back.z).normalized() * 1.4 + Vector3(0, 1.1, 0)
	var k := 1.0 if dt >= 1.0 else 1.0 - exp(-14.0 * dt)
	cam.position = cam.position.lerp(want, k)
	# the eased camera can cut through a box on its way to a cleared spot (a car swinging past, the chase camera
	# swinging round as the car turns): it went inside parked cars and walls for a frame or two (owner's video, Nov 18)
	cam.position = _clear_camera(pivot, cam.position)
	cam.look_at(pivot + side * 0.6 + Vector3(0, 0.1, 0))
	if shake > 0.001:
		# a fast rumble plus a jolt, both fading with the shake (squared, so a big hit kicks and a small one tickles)
		_shake_t += maxf(dt, 0.016)
		var s := shake * shake
		cam.position += cam.global_transform.basis * Vector3(sin(_shake_t * 61.0) * 0.18, cos(_shake_t * 53.0) * 0.14, 0.0) * s
		cam.rotate_object_local(Vector3(0, 0, 1), sin(_shake_t * 47.0) * 0.035 * s)
		cam.rotate_object_local(Vector3(1, 0, 0), cos(_shake_t * 39.0) * 0.02 * s)
		shake = maxf(0.0, shake - (2.2 * dt if dt < 1.0 else shake))

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
