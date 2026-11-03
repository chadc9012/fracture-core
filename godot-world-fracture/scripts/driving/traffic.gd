extends Node3D
## Traffic on the street slices (the Dec 4 plan, phase 5): civilian cars from the fleet running the block's two lanes on
## street_car.gd's rules — right-hand traffic, the near lane (+x) driving -z and the far lane driving +z — each holding its
## lane, keeping a gap behind the car ahead, stopping for the operator (on foot or in a car) in its lane, and looping back
## to the far end of the block when it leaves this one. A fixed budget of cars (the owner's performance notes: pooled
## vehicles, hard counts) whose boxes live in the scene's obstacle list and move with them, so the operator, the troopers
## and the player's car all keep out of them. Pure enough to test headless: give it the boxes, the bounds and a ground.

const StreetCar := preload("res://scripts/driving/street_car.gd")
const FLEET := "res://models/fleet/"
const FILES := ["tuner.glb", "muscle-car-lod.glb", "street-racer-lod.glb", "offroad-truck.glb", "security-suv.glb"]
const CRUISE := 9.0            # m/s on an open lane
const GAP := 7.0               # m kept to the car ahead (nose to tail)
const LOOK := 16.0             # m looked ahead for a stop
const LANE_X := 3.0

class Car:
	var sc: RefCounted           # street_car.gd
	var dir := -1.0              # -1 drives -z (near lane), +1 drives +z
	var box_index := -1
	var lane_x := 0.0
	var wait := 0.0

var cars: Array[Car] = []
var obstacles: Array[AABB]
var bounds: Rect2
var ground_at: Callable
var length := 200.0
## the operator's position and radius, and the player's car box when driving (the lane stops for them)
var watch_point := Vector3(0, -100, 0)
var watch_box := AABB()
var _rng := RandomNumberGenerator.new()
var _world: Node3D

func setup(world: Node3D, boxes: Array[AABB], b: Rect2, ground: Callable, street_length: float, budget := 8, seed := 5) -> void:
	_world = world
	obstacles = boxes
	bounds = b
	ground_at = ground
	length = street_length
	_rng.seed = seed
	var per := budget / 2
	for lane: float in [-1.0, 1.0]:
		for i in per:
			var z: float = -length * 0.5 + 10.0 + (i + 0.5) * (length - 20.0) / per + _rng.randf_range(-4.0, 4.0)
			_spawn(lane, z)

func _spawn(dir: float, z: float) -> Car:
	var f: String = FILES[_rng.randi() % FILES.size()]
	var node: Node3D
	if ResourceLoader.exists(FLEET + f):
		node = (load(FLEET + f) as PackedScene).instantiate() as Node3D
	else:
		node = Node3D.new()
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(1.9, 1.2, 4.2)
		mi.mesh = bm
		mi.position.y = 0.6
		node.add_child(mi)
	var c := Car.new()
	c.dir = dir
	c.lane_x = -LANE_X * dir     # -z lane on +x (right-hand traffic), +z lane on -x
	node.position = Vector3(c.lane_x, 0, z)
	node.rotation.y = 0.0 if dir < 0 else PI
	StreetCar.face_forward(node)
	_world.add_child(node)
	c.sc = StreetCar.new(node, "", { "max_speed": 14.0, "acceleration": 6.0, "steering": 1.1, "braking": 14.0 })
	c.sc.bounds = bounds
	c.sc.ground_at = ground_at
	c.sc.obstacles = obstacles
	c.box_index = obstacles.size()
	obstacles.append(c.sc.box())
	c.sc.skip = c.box_index
	cars.append(c)
	return c

func step(dt: float) -> void:
	for c in cars:
		_drive(c, dt)
		obstacles[c.box_index] = c.sc.box()

## how far ahead the lane is clear: the nearest car, the operator or the player's car within the lane's width
func clear_ahead(c: Car) -> float:
	var n: Node3D = c.sc.node
	var best := LOOK
	for o in cars:
		if o == c:
			continue
		var on: Node3D = o.sc.node
		var dz := (on.position.z - n.position.z) * c.dir
		if dz > 0.0 and absf(on.position.x - c.lane_x) < 2.2:
			best = minf(best, dz - StreetCar.HALF_LENGTH * 2.0)
	var pz := (watch_point.z - n.position.z) * c.dir
	if pz > 0.0 and absf(watch_point.x - c.lane_x) < 2.0:
		best = minf(best, pz - StreetCar.HALF_LENGTH - 0.6)
	if watch_box.size.x > 0.1:
		var wz := ((watch_box.get_center().z) - n.position.z) * c.dir
		if wz > 0.0 and watch_box.position.x - 1.0 < c.lane_x and watch_box.end.x + 1.0 > c.lane_x:
			best = minf(best, wz - watch_box.size.z * 0.5 - StreetCar.HALF_LENGTH)
	return maxf(best, 0.0)

func _drive(c: Car, dt: float) -> void:
	var n: Node3D = c.sc.node
	# past the end of the block: back in at the far end, pooled
	if n.position.z * c.dir > length * 0.5 - 4.0:
		n.position = Vector3(c.lane_x, 0, -c.dir * (length * 0.5 - 6.0))
		n.rotation.y = 0.0 if c.dir < 0 else PI
		c.sc.speed = 0.0
	var ahead := clear_ahead(c)
	var want := CRUISE * clampf((ahead - GAP) / 8.0, 0.0, 1.0)
	var spd: float = c.sc.speed
	var throttle := clampf((want - spd) / 3.0, -1.0, 1.0)
	var brake := 1.0 if (want < 0.5 and spd > 0.3) else 0.0
	# hold the lane: the heading error plus the lane offset
	var heading := 0.0 if c.dir < 0 else PI
	var err := wrapf(heading - n.rotation.y, -PI, PI)
	var off := (c.lane_x - n.position.x) * -c.dir
	var steer := clampf(err * 2.0 + off * 0.35, -1.0, 1.0)
	c.sc.step(dt, throttle, steer, brake)
	if c.sc.speed < 0.0:
		c.sc.speed = 0.0
