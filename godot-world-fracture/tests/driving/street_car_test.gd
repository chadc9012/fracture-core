extends SceneTree
## street_car.gd headless: throttle moves the car along its nose, a wall stops it and scrubs the speed, the bounds hold, the
## box follows the car.
const Car = preload("res://scripts/driving/street_car.gd")

func _init() -> void:
	var n := Node3D.new()
	root.add_child(n)
	n.rotation.y = 0.0   # nose along -z
	var car := Car.new(n, "tuner", { "max_speed": 30.0, "acceleration": 9.0, "steering": 1.0, "braking": 14.0 })
	car.bounds = Rect2(-10, -100, 20, 200)
	car.obstacles = [AABB(Vector3(-10, 0, -41), Vector3(20, 4, 1))]   # a wall across the road at z = -40
	var ok := true
	for i in 120:
		car.step(1.0 / 60.0, 1.0, 0.0, 0.0)
	var r1: bool = n.position.z < -5.0 and car.speed > 5.0 and absf(n.position.x) < 0.01
	print("drives forward: ", r1, " ", n.position, " ", car.speed)
	ok = ok and r1
	for i in 600:
		car.step(1.0 / 60.0, 1.0, 0.0, 0.0)
	var r2: bool = n.position.z >= -40.0 + Car.HALF_LENGTH + Car.RADIUS - 0.05 and car.speed < 4.0 and car.hits > 0
	print("the wall stops it: ", r2, " ", n.position, " ", car.speed)
	ok = ok and r2
	# reverse out of the wall: the brake bleeds the speed off
	for i in 60:
		car.step(1.0 / 60.0, -1.0, 0.0, 0.0)
	var v0 := absf(car.speed)
	for i in 60:
		car.step(1.0 / 60.0, 0.0, 0.0, 1.0)
	var r5: bool = v0 > 4.0 and absf(car.speed) < v0 * 0.5
	print("brakes: ", r5, " ", v0, " -> ", car.speed)
	ok = ok and r5
	# steering while backing away turns the car; the kerbs (bounds) hold it
	for i in 240:
		car.step(1.0 / 60.0, -1.0, 1.0, 0.0)
	var r3: bool = n.position.x >= -10.0 + Car.RADIUS - 0.05 and n.position.x <= 10.0 - Car.RADIUS + 0.05 and absf(n.rotation.y) > 0.3 and n.position.z > -36.0
	print("steers and stays in bounds: ", r3, " ", n.position, " yaw ", n.rotation.y)
	ok = ok and r3
	var b := car.box()
	var r4: bool = b.has_point(n.position + Vector3(0, 0.5, 0)) and b.size.x > 1.5 and b.size.z > 1.5
	print("box follows the car: ", r4, " ", b)
	ok = ok and r4
	print("Street car test: ", ok)
	quit(0 if ok else 1)
