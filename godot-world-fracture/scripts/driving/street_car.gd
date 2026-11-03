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
func step(dt: float, throttle: float, steer: float, brake: float) -> void:
	speed = Physics.advance(speed, throttle, brake, profile, dt)
	node.rotation.y += Physics.yaw_delta(speed, steer, profile, dt)
	var before := node.position
	var moved := before + forward() * speed * dt
	var p := _resolve(moved)
	if p != moved:
		# a kerb, a wall or another car: the car stops short and loses most of its speed
		speed = move_toward(speed, 0.0, absf(speed) * 0.6 + 2.0 * dt)
		hits += 1
	p.y = (ground_at.call(p.x, p.z) as float)
	node.position = p

## the three discs along the car, kept inside the bounds and out of the boxes
func _resolve(p: Vector3) -> Vector3:
	var f := forward()
	var out := p
	for pass_ in 2:
		for k: float in [-1.0, 0.0, 1.0]:
			var c := out + f * (k * HALF_LENGTH)
			var cx := clampf(c.x, bounds.position.x + RADIUS, bounds.end.x - RADIUS)
			var cz := clampf(c.z, bounds.position.y + RADIUS, bounds.end.y - RADIUS)
			if cx != c.x or cz != c.z:
				out += Vector3(cx - c.x, 0, cz - c.z)
				c = Vector3(cx, c.y, cz)
			for bi in obstacles.size():
				if bi == skip:
					continue
				var box: AABB = obstacles[bi]
				if box.end.y < 0.3 or box.position.y > 1.5:
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
