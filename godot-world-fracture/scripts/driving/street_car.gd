extends RefCounted
## A car driven on the street slices (the Dec 4 plan, phase 5): the driving module's rules (drive_physics.gd advance and
## yaw_delta, drive_profile.gd performance from the garage build) applied to a parked car's node, with collisions against
## the scene's obstacle boxes — three discs along the car (nose, middle, tail) are kept out of every box, and a hit scrubs the
## speed — and the slice's bounds. Pure except for moving the node, so tests/driving/street_car_test.gd runs it headless.

const Physics := preload("res://scripts/driving/drive_physics.gd")

const HALF_LENGTH := 2.1
const RADIUS := 1.0

var node: Node3D
var id: String
var profile: Dictionary
var speed := 0.0
var bounds := Rect2(-1000, -1000, 2000, 2000)
var obstacles: Array[AABB] = []
## the index of this car's own box in `obstacles` (shared with the scene), never collided with
var skip := -1
var ground_at: Callable = func(_x: float, _z: float) -> float: return 0.0
var hits := 0
## nitrous (profile `nos` from the garage: 1 street, 1.6 race): the tank empties while boosting and refills slowly
var nos_tank := 1.0
var boosting := false
## the direction the car is actually travelling (its heading pulls it round at the tyres' grip): drift parts (`slide`)
## let it lag, so the tail steps out through a fast corner; slicks (`grip`) hold it tighter
var travel := NAN
## launch control: a harder start for a moment after pulling away from rest
var _launch_t := 0.0
## telemetry: the best speed this drive (m/s), shown on the dash when the car has the system
var top_speed := 0.0

func _init(car: Node3D, vehicle_id: String, perf: Dictionary) -> void:
	node = car
	id = vehicle_id
	profile = perf

func yaw() -> float:
	return node.rotation.y

## The fleet GLBs are modelled nose along +z, but drive_vehicle.gd (and this) move a car along -basis.z, so a spawned model
## is turned half a turn inside its node once: the node's -z is then the nose, the camera sits at +z.
static func face_forward(car: Node3D) -> void:
	if car.has_meta("faced"):
		return
	for ch in car.get_children():
		if ch is Node3D:
			(ch as Node3D).rotation.y += PI
			(ch as Node3D).position = Vector3(-(ch as Node3D).position.x, (ch as Node3D).position.y, -(ch as Node3D).position.z)
	car.set_meta("faced", true)

## the forward axis: the node's -z (drive_vehicle.gd moves along -basis.z)
func forward() -> Vector3:
	return -node.transform.basis.z

## `throttle` -1..1, `steer` -1..1 (left positive, as drive_input.gd), `brake` 0..1
func step(dt: float, throttle: float, steer: float, brake: float, boost := false) -> void:
	var prof := profile
	var nos := float(profile.get("nos", 0.0))
	boosting = boost and nos > 0.0 and nos_tank > 0.02 and throttle > 0.1
	if boosting:
		nos_tank = maxf(0.0, nos_tank - dt / (2.5 + nos * 1.5))
	else:
		nos_tank = minf(1.0, nos_tank + dt * 0.06)
	if absf(speed) < 1.5 and throttle > 0.5 and float(profile.get("launch", 0.0)) > 0.0:
		_launch_t = 2.5
	_launch_t = maxf(0.0, _launch_t - dt)
	if boosting or _launch_t > 0.0:
		prof = profile.duplicate()
		if boosting:
			prof.acceleration = float(profile.get("acceleration", 8.0)) * (1.35 + 0.25 * nos)
			prof.max_speed = float(profile.get("max_speed", 30.0)) * (1.0 + 0.1 * nos)
		if _launch_t > 0.0:
			prof.acceleration = float(prof.get("acceleration", 8.0)) * 1.35
	speed = Physics.advance(speed, throttle, brake, prof, dt)
	top_speed = maxf(top_speed, speed)
	var slide := clampf(float(profile.get("slide", 0.0)), 0.0, 1.0)
	node.rotation.y += Physics.yaw_delta(speed, steer, prof, dt) * (1.0 + slide * 0.35 * clampf(absf(speed) / 20.0, 0.0, 1.0))
	# the travel direction follows the heading at the grip's rate (instant on the old cars: no drift parts, no change)
	if is_nan(travel):
		travel = node.rotation.y
	var rate := 14.0 * (1.0 - 0.75 * slide) * (1.0 + clampf(float(profile.get("grip", 0.0)), 0.0, 1.0))
	if slide <= 0.0:
		rate = 1000.0
	travel = lerp_angle(travel, node.rotation.y, minf(1.0, rate * dt))
	var slip := absf(angle_difference(travel, node.rotation.y))
	if slip > 0.05:
		speed = move_toward(speed, 0.0, absf(speed) * sin(slip) * 0.5 * dt)     # a slide scrubs speed
	var dir := Vector3(-sin(travel), 0.0, -cos(travel))     # the node's -z at yaw `travel`
	var before := node.position
	var moved := before + dir * speed * dt
	var p := _resolve(moved)
	if p != moved:
		# a kerb, a wall or another car: the car stops short and loses most of its speed
		speed = move_toward(speed, 0.0, absf(speed) * 0.6 + 2.0 * dt)
		hits += 1
	p.y = (ground_at.call(p.x, p.z) as float) + (0.9 + sin(Time.get_ticks_msec() * 0.003) * 0.08 if bool(profile.get("hover", false)) else 0.0)
	node.position = p

## how far the car is sliding (radians between where it points and where it goes)
func slip_angle() -> float:
	return 0.0 if is_nan(travel) else absf(angle_difference(travel, node.rotation.y))

## the three discs along the car, kept inside the bounds and out of the boxes
func _resolve(p: Vector3) -> Vector3:
	var f := forward()
	var out := p
	# the boxes within reach of the car this step, found once (the street has ~1,000; a car touches a handful)
	var reach := HALF_LENGTH + RADIUS * 2.0 + 1.0
	var near: Array[int] = []
	for bi in obstacles.size():
		if bi == skip:
			continue
		var bb: AABB = obstacles[bi]
		if p.x < bb.position.x - reach or p.x > bb.end.x + reach or p.z < bb.position.z - reach or p.z > bb.end.z + reach:
			continue
		if bb.end.y < 0.3 or bb.position.y > 1.5:
			continue
		near.append(bi)
	for pass_ in 2:
		for k: float in [-1.0, 0.0, 1.0]:
			var c := out + f * (k * HALF_LENGTH)
			var cx := clampf(c.x, bounds.position.x + RADIUS, bounds.end.x - RADIUS)
			var cz := clampf(c.z, bounds.position.y + RADIUS, bounds.end.y - RADIUS)
			if cx != c.x or cz != c.z:
				out += Vector3(cx - c.x, 0, cz - c.z)
				c = Vector3(cx, c.y, cz)
			for bi in near:
				var box: AABB = obstacles[bi]
				if c.x < box.position.x - RADIUS or c.x > box.end.x + RADIUS or c.z < box.position.z - RADIUS or c.z > box.end.z + RADIUS:
					continue
				var qx := clampf(c.x, box.position.x, box.end.x)
				var qz := clampf(c.z, box.position.z, box.end.z)
				var d := Vector2(c.x - qx, c.z - qz)
				var dist := d.length()
				if dist >= RADIUS:
					continue
				var push: Vector2
				if dist < 1e-4:
					var dl := c.x - box.position.x; var dr := box.end.x - c.x
					var dn := c.z - box.position.z; var df := box.end.z - c.z
					var m := minf(minf(dl, dr), minf(dn, df))
					push = Vector2(-(dl + RADIUS), 0) if m == dl else (Vector2(dr + RADIUS, 0) if m == dr else (Vector2(0, -(dn + RADIUS)) if m == dn else Vector2(0, df + RADIUS)))
				else:
					push = d / dist * (RADIUS - dist)
				out += Vector3(push.x, 0, push.y)
				c += Vector3(push.x, 0, push.y)
	return out

## the car's world box, for the operator and the other cars to walk and drive around
func box() -> AABB:
	var f := forward()
	var s := Vector3(f.z, 0, -f.x) * 0.95
	var lo := node.position
	var hi := node.position
	for k: float in [-1.0, 1.0]:
		for j: float in [-1.0, 1.0]:
			var c := node.position + f * (k * HALF_LENGTH) + s * j
			lo = Vector3(minf(lo.x, c.x), 0, minf(lo.z, c.z))
			hi = Vector3(maxf(hi.x, c.x), 1.6, maxf(hi.z, c.z))
	lo.y = node.position.y
	hi.y = node.position.y + 1.6
	return AABB(lo, hi - lo)

## the nitrous flame: two blue cones out of the tail while the car boosts (made on first use, kept with the car)
func nitro_fx() -> void:
	var c: Node3D = node
	var fx: Node3D = c.get_node_or_null("NitroFx")
	if not boosting:
		if fx:
			fx.visible = false
		return
	if not fx:
		fx = Node3D.new()
		fx.name = "NitroFx"
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.albedo_color = Color(0.35, 0.6, 1.0, 0.8)
		for sx: float in [-0.45, 0.45]:
			var mi := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.02
			cm.bottom_radius = 0.13
			cm.height = 0.9
			cm.radial_segments = 8
			mi.mesh = cm
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			# the tail is the node's +z (the nose is -z); the cone points backwards
			mi.position = Vector3(sx, 0.42, HALF_LENGTH + 0.55)
			mi.rotation.x = PI * 0.5
			fx.add_child(mi)
		c.add_child(fx)
	fx.visible = true
	fx.scale = Vector3(1, 1, 0.8 + randf() * 0.5)
