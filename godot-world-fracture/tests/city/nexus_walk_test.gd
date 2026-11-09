extends SceneTree
## Walks the Nexus avenue's district courts (scripts/city/nexus_districts.gd) the way a player does, headless: for every
## court, stand at its side street, walk in, and check the operator got in (not stopped by a wall in the mouth), stands in
## no box, and the area name is the court's. Then the court shops: Apex Gear and Rusty Trigger open their stock and sell,
## Cylinder & Co opens the heavy garage, and the casino stays shut on the Nexus street (Neon City's alone).
##   godot --headless --path godot-world-fracture --script res://tests/city/nexus_walk_test.gd
## Prints "nexus walk: N failed".

const Nexus := preload("res://scripts/city/nexus_districts.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
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
