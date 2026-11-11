extends SceneTree
## The racing garage (owner's garage file, Nov 11): the new parts and slots, the free tuning (clamped, saved), and what the
## parts do on the road — nitrous makes a car faster for a few seconds and the tank refills, drift parts let the tail
## slide, launch control pulls harder from rest — plus the kit drawing the decals, the cage and the wheel tuning.
##   godot --headless --path godot-world-fracture --script res://tests/garage/tuning_test.gd
const Catalog := preload("res://scripts/garage/catalog.gd")
const State := preload("res://scripts/garage/garage_state.gd")
const Order := preload("res://scripts/garage/garage_order.gd")
const Kit := preload("res://scripts/garage/garage_kit.gd")
const DriveProfile := preload("res://scripts/driving/drive_profile.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
var failed := 0

func ok(c: bool, what: String) -> void:
	print(("ok   " if c else "FAIL ") + what)
	if not c:
		failed += 1

func _initialize() -> void:
	# the catalogue
	for slot in ["decals", "interior", "nitrous", "aero", "electronics"]:
		ok(Catalog.SLOTS.has(slot) and Catalog.items_for_slot(slot).size() > 0, "the %s slot has parts" % slot)
	ok("nitrous" in Catalog.shop("neon-performance").slots and "decals" in Catalog.shop("nexus-customs").slots, "Neon Performance sells nitrous, Nexus Customs decals")
	var t := Catalog.tune_clean({ "ride": -200, "camber": 4, "rim": 30, "text": "  NIGHTJAR-RACING-CLUB ", "decal_color": "#123456" })
	ok(t.ride == -60 and t.camber == 4 and t.rim == 24 and t.text == "NIGHTJAR-RAC" and t.decal_color == Catalog.TUNE_DEFAULT.decal_color, "tuning is clamped (%s)" % str(t))
	# buying and saving
	var s := State.fresh()
	s.credits = 100000
	var o := Order.new("neon-performance", "tuner")
	ok(o.add(s, "nos-street") and o.add(s, "tyres-drift") and o.add(s, "susp-drift") and o.add(s, "elec-launch") and o.add(s, "decal-livery"), "a drift build goes in the order")
	ok(o.checkout(s) == "", "and is bought")
	s.set_tune("tuner", "rim", 22)
	s.set_tune("tuner", "text", "KAIDO")
	var back := State.new()
	back.from_dict(JSON.parse_string(JSON.stringify(s.to_dict())))
	ok(back.tune("tuner").rim == 22 and back.tune("tuner").text == "KAIDO", "the tuning survives a save")
	var perf := DriveProfile.performance(s, "tuner")
	ok(float(perf.get("nos", 0)) == 1.0 and is_equal_approx(float(perf.get("slide", 0)), 1.0) and float(perf.get("launch", 0)) == 1.0, "the drive profile carries nitrous, slide and launch (%s)" % str(perf))
	# on the road: nitrous
	var plain := { "max_speed": 40.0, "acceleration": 10.0, "steering": 1.2, "braking": 14.0 }
	var a := StreetCar.new(Node3D.new(), "tuner", plain)
	var b := StreetCar.new(Node3D.new(), "tuner", plain.merged({ "nos": 1.6 }))
	for i in 120:
		a.step(1.0 / 60.0, 1.0, 0.0, 0.0)
		b.step(1.0 / 60.0, 1.0, 0.0, 0.0, true)
	ok(b.speed > a.speed * 1.4 and b.nos_tank < 0.8, "nitrous pulls harder (%.1f vs %.1f m/s) and drains the tank (%.2f)" % [b.speed, a.speed, b.nos_tank])
	for i in 600:
		b.step(1.0 / 60.0, 0.0, 0.0, 0.0)
	ok(b.nos_tank > 0.95 or b.nos_tank >= 0.99, "the tank refills off the button (%.2f)" % b.nos_tank)
	# drift: the same corner at speed, with and without the drift parts
	var grip := StreetCar.new(Node3D.new(), "tuner", plain)
	var drift := StreetCar.new(Node3D.new(), "tuner", plain.merged({ "slide": 1.0 }))
	grip.speed = 28.0
	drift.speed = 28.0
	var most := 0.0
	for i in 60:
		grip.step(1.0 / 60.0, 1.0, 1.0, 0.0)
		drift.step(1.0 / 60.0, 1.0, 1.0, 0.0)
		most = maxf(most, drift.slip_angle())
	ok(grip.slip_angle() < 0.01 and most > 0.12, "drift parts let the tail out (%.0f° at most; grip car %.1f°)" % [rad_to_deg(most), rad_to_deg(grip.slip_angle())])
	# launch control
	var l0 := StreetCar.new(Node3D.new(), "tuner", plain)
	var l1 := StreetCar.new(Node3D.new(), "tuner", plain.merged({ "launch": 1.0 }))
	for i in 90:
		l0.step(1.0 / 60.0, 1.0, 0.0, 0.0)
		l1.step(1.0 / 60.0, 1.0, 0.0, 0.0)
	ok(l1.speed > l0.speed * 1.2, "launch control pulls away harder (%.1f vs %.1f m/s)" % [l1.speed, l0.speed])
	# the kit draws it
	var car: Node3D = (load(Catalog.vehicle("tuner").model) as PackedScene).instantiate()
	root.add_child(car)
	var wheel: Node3D = null
	for n in car.find_children("Wheel*", "Node3D", true, false):
		wheel = n
		break
	var before_scale := wheel.basis.get_scale().x if wheel else 1.0
	Kit.apply(car, s.installed("tuner").merged({ "interior": "int-cage", "aero": "aero-full" }), "#2a5bd7", s.tune("tuner"))
	var kit := car.get_node("GarageKit")
	ok(kit.find_children("*", "Label3D", true, false).size() == 2, "the livery puts the text on both doors")
	ok(kit.get_child_count() > 12, "the cage, aero and decals are on the car (%d pieces)" % kit.get_child_count())
	ok(wheel == null or wheel.basis.get_scale().x > before_scale * 1.05, "22-inch rims are bigger than the model's own")
	print("tuning test: %d failed" % failed)
	quit(1 if failed > 0 else 0)
