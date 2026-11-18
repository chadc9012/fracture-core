extends SceneTree
## online_world.gd against the local stand-in (tests/net/realtime_mock.py on 4501): two players in one city's room — each
## draws the other on foot in their own look, then in the car they drive (their model, never a stand-in), with their
## name over them; and one leaving takes them off the street.
## Prints "online world: N failed".

const Online := preload("res://scripts/net/online.gd")
const OnlineWorld := preload("res://scripts/net/online_world.gd")
var failed := 0

func ok(c: bool, what: String) -> void:
	print(("ok   " if c else "FAIL ") + what)
	if not c:
		failed += 1

func _initialize() -> void:
	_run.call_deferred()

func _wait(cond: Callable, secs := 6.0) -> bool:
	var t0 := Time.get_ticks_msec()
	while not cond.call() and Time.get_ticks_msec() - t0 < secs * 1000.0:
		await process_frame
	return cond.call()

## a street slice's few fields online_world reads
class Slice extends Control:
	var style := "neon"
	var world := Node3D.new()
	var operator: CharacterBody3D
	var driving_car: RefCounted
	func _init() -> void:
		add_child(world)
		operator = CharacterBody3D.new()
		operator.set_meta("x", 1)
		world.add_child(operator)

class Car extends RefCounted:
	var node: Node3D
	var speed := 20.0

func _net(id: String, nm: String) -> Node:
	var n: Node = Online.new()
	n.name = "Online-" + id
	root.add_child(n)
	n.id = id
	n.display = nm
	n.rt.me = id
	return n

func _run() -> void:
	Online.url_override = "ws://127.0.0.1:4501"
	var sa := Slice.new()
	var sb := Slice.new()
	root.add_child(sa)
	root.add_child(sb)
	var wa: Node = OnlineWorld.new()
	var wb: Node = OnlineWorld.new()
	sa.add_child(wa)
	sb.add_child(wb)
	wa.setup(sa, _net("alice", "Alice"))
	wb.setup(sb, _net("bob", "Bob"))
	sa.operator.position = Vector3(3, 0, -40)
	var step := func():
		wa.step(1.0 / 60.0)
		wb.step(1.0 / 60.0)
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 4000 and not (wb.players.has("alice") and wb.players.alice.body != null):
		step.call()
		await process_frame
	ok(wb.players.has("alice") and wb.players.alice.body != null, "Bob sees Alice on foot")
	ok(wb.players.has("alice") and String(wb.players.alice.name) == "Alice" and wb.players.alice.tag != null, "with her name over her")
	for i in 40:
		step.call()
		await process_frame
	ok(wb.players.has("alice") and (wb.players.alice.body as Node3D).position.distance_to(Vector3(3, 0, -40)) < 0.5, "where she stands")
	# Alice takes a car
	var c := Car.new()
	c.node = (load("res://models/fleet/concept-gt.glb") as PackedScene).instantiate()
	sa.world.add_child(c.node)
	c.node.position = Vector3(-2, 0, 100)
	sa.driving_car = c
	t0 = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 4000 and not (wb.players.alice.car != null):
		step.call()
		await process_frame
	ok(wb.players.alice.car != null and String(wb.players.alice.car_file).ends_with("concept-gt.glb") and bool(wb.players.alice.driving), "then in the car she drives (her model)")
	ok(not (wb.players.alice.body as Node3D).visible, "her body hides while she drives")
	ok(wa.drivers_near(Vector3(0, 0, 0), 30.0).is_empty() and wb.drivers_near(Vector3(-2, 0, 95), 30.0).size() == 1, "a driver near you is found for a challenge")
	# a message passes up to street_life
	var got := []
	wb.message.connect(func(e, d, f): got.append([e, f]))
	wa.send("race_open", { "rid": "alice-1", "ev_id": "neon-midnight" })
	ok(await _wait(func(): return got.size() == 1 and got[0][0] == "race_open" and got[0][1] == "alice"), "race messages reach the other street")
	# Alice leaves
	wa.queue_free()
	t0 = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 5000 and wb.players.has("alice"):
		wb.step(1.0 / 60.0)
		await process_frame
	ok(not wb.players.has("alice"), "she leaves the street when she goes")
	print("online world: %d failed" % failed)
	quit(1 if failed > 0 else 0)
