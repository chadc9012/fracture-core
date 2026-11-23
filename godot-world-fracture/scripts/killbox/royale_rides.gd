extends RefCounted
## Fracture Royale's vehicles (owner, Nov 22: "start filling gaps"): a handful of the fleet's off-roaders parked on the
## field. ENTER by one gets in, ENTER when it has slowed gets out; it drives by the street's rules (street_car.gd) on the
## forest's ground, runs down whoever is in front of it, and gets you to the circle. You cannot shoot from the wheel.

const StreetCar := preload("res://scripts/driving/street_car.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
const Sound := preload("res://scripts/audio/sound.gd")

const FLEET := "res://models/fleet/"
## file, vehicle id, length in metres
const RIDES := [["raider-buggy.glb", "raider-buggy", 4.2], ["offroad-truck.glb", "offroad-truck", 5.4], ["security-suv.glb", "security-suv", 5.0]]
const ENTER_R := 3.6
const RAM_SPEED := 7.0

var parked: Array[Node3D] = []
var car: StreetCar          # the one being driven, or null
var rammed := 0
var _cam_dist := 4.2
var _cam_pivot := Vector3(0, 1.55, 0)

static func perf(id: String) -> Dictionary:
	var kind := Handling.kind_of(id)
	var p: Dictionary = Handling.profile(kind)
	var fleet := float(Handling.FLEET_SPEED.get(id, 1.0))
	return { "max_speed": Handling.BASE_SPEED * float(p.top) * fleet * 0.55, "acceleration": float(p.accel) * 0.35, "steering": float(p.steer), "braking": float(p.brake) * 0.4, "pivot": bool(p.pivot) }

func add(world: Node3D, k: int, at: Vector3, yaw: float) -> Node3D:
	var spec: Array = RIDES[k % RIDES.size()]
	var path: String = Catalog.street_cut(FLEET + String(spec[0]))
	var n: Node3D
	if ResourceLoader.exists(path):
		n = (load(path) as PackedScene).instantiate() as Node3D
	else:
		return null
	world.add_child(n)
	StreetCar.face_forward(n)
	# fitted to its real length, standing on its wheels
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = n.global_transform.affine_inverse() * (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	var longest := maxf(box.size.x, box.size.z)
	if longest > 0.01:
		n.scale = Vector3.ONE * (float(spec[2]) / longest)
	n.position = at
	n.rotation.y = yaw
	n.set_meta("vehicle", String(spec[1]))
	parked.append(n)
	return n

## any fleet model by file, `length` metres long (Fort Kessler's tanks and trucks): parked, and drivable while in `parked`
func add_spec(world: Node3D, file: String, id: String, length: float, at: Vector3, yaw: float) -> Node3D:
	var path: String = Catalog.street_cut(FLEET + file)
	if not ResourceLoader.exists(path):
		path = FLEET + file
		if not ResourceLoader.exists(path):
			return null
	var n := (load(path) as PackedScene).instantiate() as Node3D
	world.add_child(n)
	StreetCar.face_forward(n)
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = n.global_transform.affine_inverse() * (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	var longest := maxf(box.size.x, box.size.z)
	if longest > 0.01:
		n.scale = Vector3.ONE * (length / longest)
	n.position = at
	n.rotation.y = yaw
	n.set_meta("vehicle", id)
	parked.append(n)
	return n

## vehicles spread through the first circle, clear of the buildings
func scatter(world: Node3D, centre: Vector2, radius: float, rng: RandomNumberGenerator, ground_at: Callable, obstacles: Array, n := 8) -> void:
	var tries := 0
	while parked.size() < n and tries < 200:
		tries += 1
		var a := rng.randf() * TAU
		var p := centre + Vector2(cos(a), sin(a)) * sqrt(rng.randf()) * (radius - 15.0)
		var ok := true
		for b: AABB in obstacles:
			if p.x > b.position.x - 4.0 and p.x < b.end.x + 4.0 and p.y > b.position.z - 4.0 and p.y < b.end.z + 4.0:
				ok = false
				break
		if ok:
			add(world, parked.size(), Vector3(p.x, float(ground_at.call(p.x, p.y)), p.y), rng.randf() * TAU)

func near(me: Vector3) -> Node3D:
	var best: Node3D = null
	var best_d := ENTER_R
	for c in parked:
		if is_instance_valid(c):
			var d := Vector2(c.position.x - me.x, c.position.z - me.z).length()
			if d < best_d:
				best_d = d
				best = c
	return best

func driving() -> bool:
	return car != null

func enter(c: Node3D, operator: Node3D, controls: Node) -> void:
	car = StreetCar.new(c, String(c.get_meta("vehicle", "")), perf(String(c.get_meta("vehicle", ""))))
	car.bounds = operator.bounds
	car.ground_at = operator.ground_at
	car.obstacles = operator.obstacles
	_cam_dist = operator.cam_dist
	_cam_pivot = operator.cam_pivot
	operator.rig.visible = false
	operator.cam_dist = 9.0
	operator.cam_pivot = Vector3(0, 2.4, 0)
	operator.cam_yaw = c.rotation.y
	controls.set_mode("drive")
	Sound.sfx("car_chirp", -10.0)
	Sound.loop("royale_engine", "engine", -9.0, 0.8)

func exit(operator: Node3D, controls: Node) -> void:
	if car == null:
		return
	var f: Vector3 = car.forward()
	var side := Vector3(f.z, 0, -f.x)
	var out: Vector3 = car.node.position + side * 2.2
	out.y = float(operator.ground_at.call(out.x, out.z))
	operator.position = out
	operator.velocity = Vector3.ZERO
	operator.rig.visible = true
	operator.cam_dist = _cam_dist
	operator.cam_pivot = _cam_pivot
	car.speed = 0.0
	car = null
	controls.set_mode("foot")
	Sound.loop_stop("royale_engine")
	Sound.sfx("door", -8.0)

## one frame at the wheel. `foes`: the bots (enemies.gd Enemy) — whoever the nose hits at speed is run down.
func step(dt: float, operator: Node3D, controls: Node, foes: Array) -> void:
	var throttle: float = 1.0 if controls.gas() else controls.move.y
	var steer: float = -controls.move.x
	if not controls.touch_ui and not controls.scripted:
		throttle = (1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0)
		steer = (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0)
	car.step(dt, throttle, steer, controls.brake(), false)
	var c: Node3D = car.node
	operator.position = c.position
	operator.velocity = car.forward() * car.speed
	if absf(car.speed) > RAM_SPEED:
		var nose: Vector3 = c.position + car.forward() * signf(car.speed) * 2.0
		for e in foes:
			if e.team != 1 and e.target.alive() and Vector2(e.mover.position.x - nose.x, e.mover.position.z - nose.z).length() < 1.9:
				e.target.take(absf(car.speed) * 9.0)
				car.speed *= 0.8
				rammed += 1
				Sound.sfx("hit", -2.0)
	var look: Vector2 = controls.take_look()
	operator.cam_yaw -= look.x * 0.0045
	operator.cam_yaw = lerp_angle(operator.cam_yaw, c.rotation.y, minf(1.0, 2.5 * dt) if look.x == 0.0 else 0.0)
	operator._place_camera(dt)
	Sound.loop_set("royale_engine", 0.7 + absf(car.speed) * 0.03, -9.0)
