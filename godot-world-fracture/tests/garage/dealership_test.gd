extends SceneTree
## The Vehicle Showroom (owner, Nov 12): the 30 showroom cars, buying them with Nex, the everyday ones on the street and
## the high-end ones only ever bought; then the showroom screen itself (categories, a car on the turntable, BUY) and the
## garage stepping only through the cars you own.
##   godot --headless --path godot-world-fracture --script res://tests/garage/dealership_test.gd
## Prints "dealership: N failed".

const Catalog := preload("res://scripts/garage/catalog.gd")
const Dealer := preload("res://scripts/garage/dealership.gd")
const CarDetail := preload("res://scripts/driving/car_detail.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	# the roster
	ok(Catalog.SHOWROOM.size() == 30, "the showroom holds all 30 vehicles (%d)" % Catalog.SHOWROOM.size())
	var ids := {}
	var cats := {}
	for v in Catalog.SHOWROOM:
		ids[v.id] = true
		cats[v.cat] = true
		ok(Catalog.vehicle(String(v.id)) == v, "%s: found by id" % v.id)
		ok(String(v.cls) in Catalog.ALL, "%s: a garage class the parts know" % v.id)
		ok(int(v.price) > 0, "%s: priced (%d Nex)" % [v.id, int(v.price)])
		var scene: PackedScene = load(String(v.model))
		ok(scene != null, "%s: the model loads" % v.id)
		if scene:
			var car := scene.instantiate() as Node3D
			var kinds := {}
			for mi in car.find_children("*", "MeshInstance3D", true, false):
				for sidx in (mi as MeshInstance3D).mesh.get_surface_count():
					kinds[CarDetail.kind((mi as MeshInstance3D).get_active_material(sidx))] = true
			ok(kinds.has("paint") and (kinds.has("glass") or String(v.cat) == "bike"), "%s: paint and glass materials (car_detail can dress it) %s" % [v.id, kinds.keys()])
			car.free()
	ok(ids.size() == 30, "ids are unique")
	for c in Catalog.SHOWROOM_CATS:
		ok(cats.has(c[0]), "the %s row has cars" % c[1])
	# high end only by buying; everyday on the street
	ok(Catalog.high_end("aether-hyper-gt") and Catalog.high_end("solaris-v12") and Catalog.high_end("phantom-racer"), "hypercars, supercars and bikes are high end / dealership only")
	ok(not Catalog.high_end("vanguard-suv") and not Catalog.high_end("neon-express"), "SUVs and vans are everyday cars")
	ok(Catalog.high_end("street-racer"), "the starter super car counts as high end on the street")
	var street := Catalog.street_models()
	ok(street.size() >= 12, "everyday showroom cars join traffic and parking (%d)" % street.size())
	for m in street:
		ok(not Catalog.high_end(Catalog.id_for_model(m)), "no high-end car in the street pool: " + m.get_file())
	# buying
	var p := { "nex": 1000 }
	ok(Dealer.owned(p).size() == Catalog.VEHICLES.size(), "the garage's starters are owned from the start")
	ok(not Dealer.owns(p, "nova-xr"), "a showroom car is not yours until bought")
	var line := Dealer.buy(p, "nova-xr")
	ok(not Dealer.owns(p, "nova-xr") and int(p.nex) == 1000 and line.contains("needs"), "short of Nex: no sale (%s)" % line)
	p.nex = 30000
	line = Dealer.buy(p, "nova-xr")
	ok(Dealer.owns(p, "nova-xr") and int(p.nex) == 30000 - Dealer.price("nova-xr"), "bought with Nex (%s)" % line)
	line = Dealer.buy(p, "nova-xr")
	ok(int(p.nex) == 30000 - Dealer.price("nova-xr") and line.contains("already"), "never sold twice")
	ok(Dealer.money(1234567) == "1,234,567", "prices read with thousands separators")
	# the screen
	var v = load("res://scripts/garage/showroom_view.gd").new()
	v.profile = { "nex": 9000 }
	v.persist = false
	v.size = Vector2(1600, 900)
	root.add_child(v)
	for i in 4:
		await process_frame
	ok(v._tabs.get_child_count() == Catalog.SHOWROOM_CATS.size(), "a tab per showroom row (%d)" % v._tabs.get_child_count())
	ok(v._car != null and v.pick != "", "a car stands on the turntable (%s)" % v.pick)
	v._show_cat("sports")
	await process_frame
	ok(v.cars_in("sports").size() == 3 and String(Catalog.vehicle(v.pick).cat) == "sports", "picking SPORTS shows its cars")
	v.show_car("midnight-coupe")
	v._purchase()
	ok(Dealer.owns(v.profile, "midnight-coupe") and int(v.profile.nex) == 1500, "BUY takes the Nex and the car is yours")
	ok(v._buy.disabled and v._buy.text == "OWNED", "the button reads OWNED after")
	v.queue_free()
	await process_frame
	print("dealership: %d failed" % failed)
	quit(1 if failed > 0 else 0)
