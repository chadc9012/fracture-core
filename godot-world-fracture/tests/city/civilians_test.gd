extends SceneTree
## Civilians (scripts/city/civilians.gd): a budget of walkers on both sidewalks, they stroll along z, turn at the span's
## ends, hurry when scattered, and never leave the span. Run: godot --headless --path . --script res://tests/city/civilians_test.gd

const Civilians := preload("res://scripts/city/civilians.gd")
const Player := preload("res://scripts/player/operator_player.gd")

func _init() -> void:
	var ok := true
	var root := Node3D.new()
	get_root().add_child(root)
	var op := Player.new()
	root.add_child(op)
	op.position = Vector3(11.5, 0.18, 500.0)   # far away
	var civ := Civilians.new()
	root.add_child(civ)
	var boxes: Array[AABB] = [AABB(Vector3(10.5, 0, 20.0), Vector3(2.0, 3.0, 2.0))]   # a planter on the +x sidewalk
	civ.setup(op, boxes, Rect2(-20, -200, 40, 400), func(_x: float, _z: float) -> float: return 0.18, -60.0, 60.0, 6, 3)
	var r1: bool = civ.walkers.size() == 6
	var sides := 0
	for w in civ.walkers:
		sides += 1 if w.side > 0 else 0
		r1 = r1 and w.mover.rig != null and absf(absf(w.mover.position.x) - 11.5) < 1.6
	r1 = r1 and sides == 3
	print("six walkers built on the two sidewalks: ", r1)
	ok = ok and r1
	var start: Array = []
	for w in civ.walkers:
		start.append(w.mover.position)
	for i in 120:
		civ.step(1.0 / 30.0)
	var moved := true
	var inside := true
	for i in civ.walkers.size():
		var w: Walker = civ.walkers[i]
		moved = moved and absf(w.mover.position.z - (start[i] as Vector3).z) > 2.0
		inside = inside and w.mover.position.z > -61.0 and w.mover.position.z < 61.0
	var r2: bool = moved and inside
	print("after 4 s every walker has strolled on and stayed in the span: ", r2)
	ok = ok and r2
	# a walker put right at the end turns back
	var w0: Walker = civ.walkers[0]
	w0.dir = 1.0
	w0.mover.position.z = 56.0
	w0.pause = 0.0
	for i in 60:
		civ.step(1.0 / 30.0)
	var r3: bool = w0.dir < 0.0 and w0.mover.position.z < 60.0
	print("turns back at the span's end: ", r3)
	ok = ok and r3
	# gunfire nearby: they hurry away from it
	var w1: Walker = civ.walkers[1]
	w1.pause = 0.0
	civ.scatter(w1.mover.position + Vector3(0, 0, 3.0))
	var r4: bool = w1.scare > 0.0 and w1.dir < 0.0
	var z0: float = w1.mover.position.z
	for i in 30:
		civ.step(1.0 / 30.0)
	r4 = r4 and (z0 - w1.mover.position.z) > 1.8   # faster than a stroll over a second
	print("scattered walkers hurry away: ", r4, " ", z0 - w1.mover.position.z)
	ok = ok and r4
	print("Civilians test: ", ok)
	quit(0 if ok else 1)

const Walker := Civilians.Walker
