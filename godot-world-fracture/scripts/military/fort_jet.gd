extends RefCounted
## Fort Kessler's jets, flown (owner, Nov 23: "I need my game to look like this ... planes ... military", the Fort
## Zancudo frames). The fighters parked on the apron can be stolen: ENTER by one climbs in, the throttle rolls it down
## the taxiway and runway, past takeoff speed UP lifts it, and it flies by the fleet's JET handling (vehicle_handling.gd,
## the Skyways model). You get out on the ground at a crawl; a building or a hard landing at
## speed is a crash. Stealing one is three stars at once.
## FIRE (CANNON on the phone) runs the nose gun.

const Handling := preload("res://scripts/driving/vehicle_handling.gd")
const Sound := preload("res://scripts/audio/sound.gd")

const ENTER_R := 9.0
const AIRSPACE := 2200.0      # metres from the base centre; past it the jet is turned home
const GUN_EVERY := 0.06
const GUN_RANGE := 420.0
const GUN_DAMAGE := 34.0
const CRASH_SPEED := 18.0

var parked: Array[Node3D] = []
var node: Node3D              # the one being flown, or null
var state: Handling.State
var profile: Dictionary
var top := 0.0
var crashed := false          # set the frame a flight ends in a crash (the view decides what that costs)
var kills := 0
var _gun_t := 0.0
var _saved := {}
var _cam_yaw := 0.0

func near(me: Vector3) -> Node3D:
	var best: Node3D = null
	var best_d := ENTER_R
	for j in parked:
		if is_instance_valid(j):
			var d := Vector2(j.position.x - me.x, j.position.z - me.z).length()
			if d < best_d:
				best_d = d
				best = j
	return best

func flying() -> bool:
	return node != null

func airborne() -> bool:
	return node != null and state.airborne

func enter(j: Node3D, operator: Node3D, controls: Node) -> void:
	node = j
	crashed = false
	profile = Handling.profile("JET")
	top = Handling.BASE_SPEED * 1.4     # x the JET profile's 1.6: ~140 m/s flat out
	state = Handling.State.new()
	state.yaw = j.rotation.y
	state.y = 0.0
	_cam_yaw = j.rotation.y
	_saved = { "bounds": operator.bounds, "dist": operator.cam_dist, "pivot": operator.cam_pivot, "ground": operator.ground_at }
	operator.bounds = Rect2(-AIRSPACE * 1.3, -AIRSPACE * 1.3, AIRSPACE * 2.6, AIRSPACE * 2.6)
	operator.rig.visible = false
	operator.cam_dist = 24.0
	operator.cam_pivot = Vector3(0, 5.0, 0)
	operator.cam_yaw = j.rotation.y
	controls.set_armed_vehicle(true)
	controls.set_mode("fly")
	Sound.sfx("jet", -6.0)
	Sound.loop("fort_jet", "engine", -8.0, 1.4)

## out on the ground, beside the cockpit
func exit(operator: Node3D, controls: Node) -> void:
	if node == null:
		return
	var f := Vector3(-sin(state.yaw), 0, -cos(state.yaw))
	var out := node.position + Vector3(f.z, 0, -f.x) * 6.0
	out.y = 0.0
	operator.position = out
	operator.velocity = Vector3.ZERO
	operator.rig.visible = true
	operator.bounds = _saved.get("bounds", operator.bounds)
	operator.cam_dist = float(_saved.get("dist", operator.cam_dist))
	operator.cam_pivot = _saved.get("pivot", operator.cam_pivot)
	operator.ground_at = _saved.get("ground", operator.ground_at)
	if not crashed:
		node.rotation = Vector3(0, state.yaw, 0)
		node.position.y = 0.0
	node = null
	controls.set_armed_vehicle(false)
	controls.set_mode("foot")
	Sound.loop_stop("fort_jet")

## one frame in the cockpit. `obstacles`: the base's solid boxes; `foes`: enemies.gd rows (the cannon's targets);
## `spark`: gunplay.spark for the rounds' impacts; `ground`: the land's height at (x, z) — the ranges are solid
func step(dt: float, operator: Node3D, controls: Node, obstacles: Array, foes: Array, spark: Callable, ground := Callable()) -> void:
	var mv: Vector2 = controls.move
	var throttle := maxf(0.0, mv.y)
	var brake := maxf(0.0, -mv.y)
	var steer := -mv.x
	if not controls.touch_ui and not controls.scripted:
		throttle = 1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0
		brake = 1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0
		steer = (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0)
	var input := { "throttle": throttle, "brake": brake, "steer": steer, "ascend": controls.ascend(), "descend": controls.descend(),
		"handbrake": false, "boost": false }
	var floor_y := 0.0 if not ground.is_valid() else float(ground.call(node.position.x, node.position.z))
	var env := { "grip": 1.0, "slope": 0.0, "floor": floor_y, "water": -100.0, "over_water": false }
	var was_air := state.airborne
	var vy_before := state.vy
	Handling.step(profile, state, input, env, top, dt)
	var fwd := Vector3(-sin(state.yaw), 0, -cos(state.yaw))
	var want := node.position + fwd * state.speed * dt
	want.y = state.y
	# the airspace: past it the nose is turned back toward the base
	var flat := Vector2(want.x, want.z)
	if flat.length() > AIRSPACE:
		var home := atan2(want.x, want.z)    # yaw that points the nose (-z basis) at the origin
		state.yaw = lerp_angle(state.yaw, home, minf(1.0, 1.2 * dt))
		if flat.length() > AIRSPACE * 1.2:
			flat = flat.normalized() * AIRSPACE * 1.2
			want.x = flat.x
			want.z = flat.y
	# buildings: solid; touching one at speed is a crash, at a crawl just a stop
	for b in obstacles:
		var bb: AABB = b
		if bb.has_point(Vector3(want.x, want.y + 1.0, want.z)):
			if absf(state.speed) > CRASH_SPEED or state.airborne:
				_crash(operator, controls)
				return
			state.speed = 0.0
			want = node.position
			break
	# the ranges: flying into a slope (the wheels only ever touch the valley floor)
	if ground.is_valid() and want.y < float(ground.call(want.x, want.z)) + 0.5 and float(ground.call(want.x, want.z)) > 2.0:
		_crash(operator, controls)
		return
	# a hard landing: wheels down fast
	if was_air and not state.airborne and (state.hard_landing or vy_before < -14.0):
		_crash(operator, controls)
		return
	node.position = want
	node.rotation = Vector3(state.pitch, state.yaw, state.roll)
	operator.position = want
	operator.velocity = fwd * state.speed
	# the nose cannon
	_gun_t -= dt
	if controls.cannon() and _gun_t <= 0.0:
		_gun_t = GUN_EVERY
		_fire(fwd, foes, spark)
	# the chase camera: behind and above, swinging round after the heading
	var look: Vector2 = controls.take_look()
	_cam_yaw = lerp_angle(_cam_yaw, state.yaw, minf(1.0, 2.5 * dt))
	operator.cam_yaw = _cam_yaw - look.x * 0.0045
	if ground.is_valid():
		operator.ground_at = func(x: float, z: float) -> float: return float(ground.call(x, z))
	operator._place_camera(dt)
	Sound.loop_set("fort_jet", 1.0 + absf(state.speed) * 0.012, -8.0)

func _fire(fwd: Vector3, foes: Array, spark: Callable) -> void:
	var muzzle := node.position + fwd * 6.0 + Vector3(0, 1.0, 0)
	var dir := Vector3(fwd.x * cos(state.pitch), sin(state.pitch), fwd.z * cos(state.pitch)).normalized()
	var best: Variant = null
	var best_t := GUN_RANGE
	for e in foes:
		if not e.target.alive():
			continue
		var c: Vector3 = e.mover.position + Vector3(0, 1.0, 0)
		var t := (c - muzzle).dot(dir)
		if t < 0.0 or t > best_t:
			continue
		# a generous cone: the cannon walks its rounds across whatever is under the nose
		if (muzzle + dir * t).distance_to(c) < 2.5 + t * 0.02:
			best = e
			best_t = t
	var hit := muzzle + dir * best_t
	if best == null:
		# the rounds land where the line meets the ground, or fly off
		if dir.y < -0.02:
			hit = muzzle + dir * minf(GUN_RANGE, -muzzle.y / dir.y)
		else:
			Sound.sfx("heavy", -10.0)
			return
	else:
		var was: bool = best.target.alive()
		best.target.take(GUN_DAMAGE)
		if was and not best.target.alive():
			kills += 1
	spark.call(hit + Vector3(0, 0.1, 0), best != null)
	Sound.sfx("heavy", -8.0)

func _crash(operator: Node3D, controls: Node) -> void:
	crashed = true
	Sound.sfx("explosion", 0.0)
	var at := node.position
	parked.erase(node)
	node.queue_free()
	node = null
	operator.position = Vector3(at.x, 0.0, at.z)
	operator.rig.visible = true
	operator.bounds = _saved.get("bounds", operator.bounds)
	operator.cam_dist = float(_saved.get("dist", operator.cam_dist))
	operator.cam_pivot = _saved.get("pivot", operator.cam_pivot)
	operator.ground_at = _saved.get("ground", operator.ground_at)
	controls.set_armed_vehicle(false)
	controls.set_mode("foot")
	Sound.loop_stop("fort_jet")
