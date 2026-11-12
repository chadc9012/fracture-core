extends SceneTree
## Walks the Nexus avenue's district courts (scripts/city/nexus_districts.gd) the way a player does, headless: for every
## court, stand at its side street, walk in, and check the operator got in (not stopped by a wall in the mouth), stands in
## no box, and the area name is the court's. Then the court shops: Apex Gear and Rusty Trigger open their stock and sell,
## Cylinder & Co opens the heavy garage, and the casino stays shut on the Nexus street (Neon City's alone).
##   godot --headless --path godot-world-fracture --script res://tests/city/nexus_walk_test.gd
## Prints "nexus walk: N failed".

const Nexus := preload("res://scripts/city/nexus_districts.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	main._open_street(true, "nexus", true)
	await frames(10)
	var st = main.street
	ok(st != null and st.operator != null, "the Nexus street opens on foot")
	if st == null:
		_done()
		return
	st.controls.scripted = true
	# DRIVE OUT from the garage (owner, Nov 12): your car rolls out at the door and you are in it, unlocked and yours
	st.drive_out("tuner")
	await frames(3)
	ok(st.driving_car != null and String(st.driving_car.node.get_meta("vehicle", "")) == "tuner", "DRIVE OUT puts you in your own car")
	if st.driving_car:
		var mine: Node3D = st.driving_car.node
		st.exit_car()
		await frames(3)
		ok(st.driving_car == null and not bool(mine.get_meta("locked", true)), "out of it again; your own car is never locked")
	st.operator.position = Vector3(10.0, 0.18, 0.0)
	await frames(2)
	var seen := {}
	for k in Nexus.COURTS:
		for i in 2:
			var id := String(Nexus.COURTS[k][i])
			ok(st.go_to_court(id, -1.0 if i == 0 else 1.0), "%s: found on tile %d" % [id, k])
			await frames(4)
			var start: Vector3 = st.operator.position
			st.controls.move = Vector2(0.0, 1.0)
			await create_timer(2.5).timeout
			st.controls.move = Vector2.ZERO
			await frames(2)
			var p: Vector3 = st.operator.position
			var sd := -1.0 if i == 0 else 1.0
			ok(p.x * sd > Nexus.MOUTH_OUT + 8.0, "%s: walked into the court (%.1f m in, from %.1f)" % [id, absf(p.x), absf(start.x)])
			var inside := ""
			for b: AABB in st.operator.obstacles:
				if b.size.y > 0.4 and b.size.x > 0.2 and b.size.z > 0.2 and b.grow(-0.05).has_point(p + Vector3(0, 0.5, 0)):
					inside = str(b)
			ok(inside == "", "%s: the operator stands in no box %s" % [id, inside])
			ok(Nexus.area_at(p) == String(Nexus.NAMES[id]), "%s: the area reads %s" % [id, Nexus.area_at(p)])
			seen[id] = true
	ok(seen.size() == 11, "all eleven named districts are walkable (%d)" % seen.size())
	# a car parked on any block can be taken (it leaves its block, so the block can unload behind it)
	# most parked cars are someone's and locked (car_detail.gd): the door sets the alarm off instead of opening
	var tile_car: Node3D = null
	var locked_car: Node3D = null
	var n_locked := 0
	for c in st.parked:
		if not is_instance_valid(c):
			continue
		if bool(c.get_meta("locked", false)):
			n_locked += 1
			if locked_car == null and c.get_parent() != st.world:
				locked_car = c
		elif tile_car == null and c.get_parent() != st.world:
			tile_car = c
	ok(n_locked > 0 and n_locked < st.parked.size(), "some parked cars are locked, not all (%d of %d)" % [n_locked, st.parked.size()])
	var paints := {}
	for c in st.parked:
		if is_instance_valid(c) and c.has_meta("paint"):
			paints[c.get_meta("paint")] = true
	ok(paints.size() >= 4, "the parked cars wear different paints (%d)" % paints.size())
	var showroom_parked := 0
	var high_open := 0
	for c in st.parked:
		if is_instance_valid(c) and String(c.get_meta("vehicle", "")) != "":
			if String(Catalog.vehicle(String(c.get_meta("vehicle"))).get("model", "")).contains("/showroom/"):
				showroom_parked += 1
			if Catalog.high_end(String(c.get_meta("vehicle"))) and not bool(c.get_meta("locked", false)) and not c.has_meta("yours"):
				high_open += 1
	ok(showroom_parked == 0, "none of the pulled pack models park on the street (%d)" % showroom_parked)
	ok(high_open == 0, "no high-end car on the street is unlocked (%d)" % high_open)
	if locked_car:
		st.operator.position = locked_car.global_position + Vector3(2.4, 0, 0)
		st.operator.position.y = 0.18
		await frames(3)
		ok(st._near_car == locked_car, "walking up to a locked car offers it (LOCKED)")
		st.controls._enter = true
		await frames(3)
		ok(st.driving_car == null, "ENTER on a locked car does not get in")
		ok(locked_car.has_node("Alarm"), "and its alarm goes off")
		await create_timer(2.8).timeout
		ok(not locked_car.has_node("Alarm"), "the alarm stops after a few seconds")
	ok(tile_car != null, "the streamed blocks' unlocked parked cars are takeable (%d in the list)" % st.parked.size())
	if tile_car:
		st.operator.position = tile_car.global_position + Vector3(2.4, 0, 0)
		st.operator.position.y = 0.18
		await frames(3)
		ok(st._near_car == tile_car, "walking up to it offers ENTER")
		st.controls._enter = true
		await frames(3)
		ok(st.driving_car != null and tile_car.get_parent() == st.world, "ENTER drives it, and it now belongs to the world")
		if st.driving_car:
			st.exit_car()
			await frames(2)
	# aiming: a box between the camera and the operator does not pull the aim point back to the camera
	var gp = st.gunplay
	var cam: Camera3D = st.cam
	var keep: Array[AABB] = gp.obstacles.duplicate()
	gp.obstacles.append(AABB(cam.global_position - Vector3(0.3, 0.3, 0.3), Vector3(0.6, 0.6, 0.6)))
	var ap: Vector3 = gp.aim_point(cam)
	ok(cam.global_position.distance_to(ap) > cam.global_position.distance_to(st.operator.eye()), "the aim point lies past the operator with a box at the camera (%.1f m)" % cam.global_position.distance_to(ap))
	gp.obstacles.resize(keep.size())
	# unarmed until Mission 01 arms the operator: no gun in hand, no FIRE, no shots
	st.armed = false
	st._fit_gear()
	var shots: int = gp.shots_fired
	st.controls.fire = true
	await create_timer(0.5).timeout
	st.controls.fire = false
	ok(gp.holstered and gp.shots_fired == shots and not st.controls.weapons_out, "unarmed: holstered, FIRE hidden, nothing fired")
	st.armed = true
	st._fit_gear()
	ok(not gp.holstered and st.controls.weapons_out, "armed again: the gun is back")
	# the court shops
	for shop in ["apex", "rusty"]:
		st._enter_door(shop)
		await frames(3)
		ok(st.shop_overlay != null, "%s opens its shop" % shop)
		var stock := Gear.shop_stock(shop, Gear.today())
		ok(stock.size() >= 4, "%s has stock today (%d)" % [shop, stock.size()])
		var prof := { "nex": 100000 }
		var bag := Gear.fresh()
		var before: int = bag.items.size()
		var line := Gear.buy_offer(bag, prof, shop, stock[0], 120.0)
		ok(bag.items.size() == before + 1 and int(prof.nex) == 100000 - int(stock[0].price), "%s sells: %s" % [shop, line])
		st.close_shop()
		await frames(2)
	st._enter_door("cylinder")
	await frames(3)
	ok(st.garage_overlay != null and String(st.garage_overlay.shop_id) == "ironworks", "Cylinder & Co opens the heavy garage")
	st.close_garage()
	await frames(2)
	st.open_casino()
	await frames(2)
	ok(st.casino_overlay == null, "no casino on the Nexus street")
	_done()

func _done() -> void:
	print("nexus walk: %d failed" % failed)
	quit(1 if failed > 0 else 0)
