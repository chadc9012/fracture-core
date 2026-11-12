extends SceneTree
## heavy_weapons.gd headless (owner, Nov 11: "Work on the tanks shooting missiles ... should feel like call of duty fort
## nite"): a shell flies, stops on a wall and blows up; the blast hurts a dummy near it and not one far off; a missile
## steers onto a target off its launch line; a car in the blast is thrown, charred and later towed back to its lane.
const Heavy = preload("res://scripts/combat/heavy_weapons.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Traffic = preload("res://scripts/driving/traffic.gd")

var ok := true

func check(label: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + label)
	ok = ok and cond

var _f := 0

func _process(_d: float) -> bool:
	_f += 1
	if _f == 2:
		_run()
	return false

func _run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var gp: Node3D = Gunplay.new()
	world.add_child(gp)
	var near := Gunplay.Target.new(AABB(Vector3(-0.4, 0, -42.0), Vector3(0.8, 1.8, 0.8)), 100.0)
	var far := Gunplay.Target.new(AABB(Vector3(30.0, 0, -42.0), Vector3(0.8, 1.8, 0.8)), 100.0)
	gp.targets.append(near)
	gp.targets.append(far)
	var hv: Node3D = Heavy.new()
	world.add_child(hv)
	hv.gunplay = gp
	hv.ground_at = func(_x: float, _z: float) -> float: return 0.0
	var boxes: Array[AABB] = [AABB(Vector3(-5, 0, -45.0), Vector3(10, 8, 1))]    # a wall behind the dummy
	hv.obstacles = boxes
	var blasts: Array = []
	hv.exploded.connect(func(at: Vector3, _r: float) -> void: blasts.append(at))
	hv.fire_shell(Vector3(0, 1.2, 0), Vector3(0, 0, -1))
	check("a shell is in flight", hv.live() == 1)
	for i in 30:
		hv.step(0.02)
	check("the shell stops at the dummy or the wall and blows up (%s)" % [blasts], blasts.size() == 1 and (blasts[0] as Vector3).z < -40.0 and (blasts[0] as Vector3).z > -45.5)
	check("the dummy in the blast is dead", not near.alive())
	check("the dummy 30 m off is untouched", far.hp == 100.0)
	# a missile turns onto a target to the side of where it was fired
	far.hp = 100.0
	blasts.clear()
	hv.fire_missiles([Vector3(0, 2, 0)], Vector3.UP, Vector3(0, 0, -60), far)
	for i in 200:
		hv.step(0.02)
		if not blasts.is_empty():
			break
	check("the missile curls onto its lock (%s)" % [blasts], blasts.size() == 1 and (blasts[0] as Vector3).distance_to(far.box.get_center()) < 3.0)
	check("and kills it", not far.alive())
	# traffic in a blast: thrown, charred, towed back
	var tr: Node3D = Traffic.new()
	world.add_child(tr)
	var tb: Array[AABB] = []
	tr.setup(world, tb, Rect2(-10, -100, 20, 200), func(_x: float, _z: float) -> float: return 0.0, 200.0, 2, 3)
	var car = tr.cars[0]
	var n: Node3D = car.sc.node
	var wrecked: Array = tr.wreck(n.position + Vector3(0, 0.5, 0), 6.0)
	check("a car in the blast is wrecked", wrecked.size() >= 1 and car.wreck > 0.0)
	var peak := 0.0
	for i in 60:
		tr.step(0.02)
		peak = maxf(peak, n.position.y)
	check("it is thrown into the air (%.1f m)" % peak, peak > 1.0)
	var charred := false
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		charred = charred or (mi as MeshInstance3D).material_overlay != null
	check("and charred", charred)
	for i in 400:
		tr.step(0.02)
	check("then towed back upright to its lane", car.wreck <= 0.0 and absf(n.rotation.x) < 0.01 and absf(n.position.x - car.lane_x) < 0.5)
	print("heavy weapons: %s" % ("all ok" if ok else "FAILED"))
	quit(0 if ok else 1)
