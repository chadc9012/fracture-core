extends SceneTree
## traffic.gd headless: the cars run their lanes, keep a gap, stop for the operator and loop round the block.
const Traffic = preload("res://scripts/driving/traffic.gd")

func _init() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var t := Traffic.new()
	world.add_child(t)
	var boxes: Array[AABB] = []
	t.setup(world, boxes, Rect2(-15, -130, 30, 260), func(_x: float, _z: float) -> float: return 0.0, 260.0, 6, 3)
	var ok := true
	var r1: bool = t.cars.size() == 6 and boxes.size() == 6
	print("six cars, six boxes: ", r1)
	ok = ok and r1
	for i in 60 * 6:
		t.step(1.0 / 60.0)
	var lanes := true
	var moving := 0
	for c in t.cars:
		var n: Node3D = c.sc.node
		lanes = lanes and absf(n.position.x - c.lane_x) < 1.2
		if c.sc.speed > 3.0:
			moving += 1
	var r2: bool = lanes and moving >= 4
	print("hold their lanes and move: ", r2, " moving ", moving)
	ok = ok and r2
	# no two cars in a lane closer than the gap allows
	var closest := 1000.0
	for a in t.cars:
		for b in t.cars:
			if a != b and a.dir == b.dir:
				closest = minf(closest, absf(a.sc.node.position.z - b.sc.node.position.z))
	var r3: bool = closest > 4.5
	print("keep apart: ", r3, " ", closest)
	ok = ok and r3
	# the operator stands in the near lane ahead of a car: it stops short
	var c0: Traffic.Car = t.cars[0]
	var n0: Node3D = c0.sc.node
	t.watch_point = n0.position + Vector3(0, 0, c0.dir * 14.0)
	for i in 60 * 5:
		t.step(1.0 / 60.0)
	var gap := (t.watch_point.z - n0.position.z) * c0.dir
	var r4: bool = c0.sc.speed < 0.5 and gap > 2.5 and gap < 14.5
	print("stops for the operator: ", r4, " speed ", c0.sc.speed, " gap ", gap)
	ok = ok and r4
	# boxes follow the cars
	var r5: bool = boxes[0].has_point(n0.position + Vector3(0, 0.5, 0))
	print("boxes move with them: ", r5)
	ok = ok and r5
	print("Traffic test: ", ok)
	quit(0 if ok else 1)
