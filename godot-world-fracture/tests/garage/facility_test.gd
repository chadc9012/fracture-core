extends SceneTree
## The Aviation Hangar and the Military Motor Pool (facility.gd, facility_view.gd) and the shared wallet (wallet.gd),
## headless: the owner's prices and three levels, buying spends the wallet and stops at the top, the levels survive a save,
## the upgrades change the flight and drive numbers, armour cuts crash damage, the old garage credits move into Nex once,
## and the facility screen shows real models (never a stand-in), refuses vehicles you don't own and fits an upgrade.
##   godot --headless --path godot-world-fracture --script res://tests/garage/facility_test.gd
## Prints "facilities: N failed".

const Facility := preload("res://scripts/garage/facility.gd")
const State := preload("res://scripts/garage/garage_state.gd")
const Wallet := preload("res://scripts/garage/wallet.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")
var View
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	View = load("res://scripts/garage/facility_view.gd")
	# prices and levels
	ok(Facility.price("aviation", "engine", 0) == 5000 and Facility.price("aviation", "engine", 2) == 15000, "Engine Service: 5,000 then ×2, ×3")
	ok(Facility.price("military", "defense", 1) == 12400, "Defensive Systems level 2: 12,400")
	var st = State.fresh()
	st.credits = 20000
	ok(Facility.buy(st, "military", "bastion-apc", "armor") == "" and st.credits == 14200 and Facility.level(st, "bastion-apc", "armor") == 1, "Armor Package 1 bought: 5,800 spent")
	ok(Facility.buy(st, "military", "bastion-apc", "armor") == "" and Facility.buy(st, "military", "bastion-apc", "armor").begins_with("Need"), "level 3 waits for the Nex")
	st.credits = 100000
	Facility.buy(st, "military", "bastion-apc", "armor")
	ok(Facility.level(st, "bastion-apc", "armor") == 3 and Facility.buy(st, "military", "bastion-apc", "armor") != "", "three levels, then no more")
	ok(Facility.buy(st, "military", "bastion-apc", "warp-drive") != "", "an upgrade that isn't on the list is refused")
	# the save
	Facility.buy(st, "aviation", "skyhawk", "engine")
	var back = State.new()
	back.from_dict(JSON.parse_string(JSON.stringify(st.to_dict())))
	ok(Facility.level(back, "bastion-apc", "armor") == 3 and Facility.level(back, "skyhawk", "engine") == 1, "levels survive the save")
	var bad = State.new()
	bad.from_dict({ "version": 1, "upgrades": { "x": { "armor": 99, "camo": -4 }, "y": "junk" } })
	ok(Facility.level(bad, "x", "armor") == 3 and not bad.upgrades["x"].has("camo") and not bad.upgrades.has("y"), "a damaged save is clamped")
	# effects
	var h: Dictionary = Handling.profile("JET")
	var plain: Array = Facility.apply_flight(h, 100.0, State.fresh(), "skyhawk")
	ok(is_equal_approx(float(plain[1]), 100.0) and is_equal_approx(float(plain[0].accel), float(h.accel)) and is_equal_approx(float(plain[2]), 1.0), "no work, no change")
	var up = State.fresh()
	up.upgrades["skyhawk"] = { "engine": 2, "avionics": 3, "gear": 1, "cockpit": 1, "airframe": 3 }
	var f: Array = Facility.apply_flight(h, 100.0, up, "skyhawk")
	ok(is_equal_approx(float(f[1]), 112.0) and is_equal_approx(float(f[0].accel), float(h.accel) * 1.16) and is_equal_approx(float(f[0].steer), float(h.steer) * 1.24), "engine 2, avionics 3: +12% speed, +16% thrust, +24% turn")
	ok(float(f[0].takeoff) < float(h.takeoff) and float(f[0].climb) > float(h.climb) and is_equal_approx(float(f[2]), 0.7), "gear lifts off sooner, cockpit climbs harder, airframe takes 30% less")
	ok(float(h.accel) == float(Handling.profile("JET").accel), "the shared handling table is untouched")
	up.upgrades["bastion-apc"] = { "powertrain": 3, "tracks": 2, "armor": 2, "defense": 1 }
	var perf := { "max_speed": 20.0, "acceleration": 5.0, "steering": 1.0, "braking": 10.0, "armor": 50.0 }
	var d: Dictionary = Facility.apply_drive(perf, up, "bastion-apc")
	ok(is_equal_approx(float(d.max_speed), 23.0) and is_equal_approx(float(d.acceleration), 6.05) and is_equal_approx(float(d.steering), 1.14) and is_equal_approx(float(d.armor), 76.0), "motor pool: powertrain 3, tracks 2, armour +26")
	ok(Facility.apply_drive(perf, up, "tuner") == perf, "a car with no work drives as before")
	ok(Facility.damage_through(0.0) == 1.0 and Facility.damage_through(75.0) == 0.5 and Facility.damage_through(400.0) == 0.25, "armour cuts crash damage (never below a quarter)")
	up.upgrades["bastion-apc"]["camo"] = 2
	ok(Facility.camo(up, "bastion-apc") == Facility.CAMO[2] and Facility.CAMO_NAMES[2] == "Woodland", "camouflage level 2 is woodland")
	# the lists: real vehicles with real models
	var models_ok := true
	for fac in ["aviation", "military"]:
		for v in Facility.vehicles(fac):
			if not ResourceLoader.exists(String(v.model)):
				models_ok = false
				print("  no model: ", v.id, " ", v.model)
	ok(Facility.aircraft().size() == 12 and Facility.military().size() == 5 and models_ok, "twelve aircraft (the Nov 18 three sold at the airport too) and five military vehicles, every one with its model")
	var prof := { "nex": 0, "air": { "aircraft": { "NXC": ["skyhawk"] } }, "cars_owned": ["havoc-ifv"] }
	ok(Facility.owned("aviation", "skyhawk", prof) and not Facility.owned("aviation", "riftwing", prof) and Facility.owned("military", "havoc-ifv", prof) and not Facility.owned("military", "warden-mech", prof), "only what you own")

	# the wallet: old garage credits move into Nex once
	var had := FileAccess.file_exists(Gear.PROFILE)
	var saved_profile := FileAccess.get_file_as_string(Gear.PROFILE) if had else ""
	var had_garage := FileAccess.file_exists(State.SAVE_PATH)
	var saved_garage := FileAccess.get_file_as_string(State.SAVE_PATH) if had_garage else ""
	Gear.profile_save({ "xp": 0, "nex": 500, "level": 1 })
	var w = State.fresh()
	w.credits = 40000
	Wallet.open(w)
	ok(w.wallet_merged and w.credits == 40500 and int(Gear.profile_load().nex) == 40500, "the garage's 40,000 credits join the 500 Nex")
	var w2 = State.load_or_fresh()
	Wallet.open(w2)
	ok(w2.credits == 40500, "and only once")
	w2.credits -= 1500
	Wallet.close(w2)
	ok(int(Gear.profile_load().nex) == 39000, "spending in the garage spends Nex")
	# restore the player's files
	if had:
		var fp := FileAccess.open(Gear.PROFILE, FileAccess.WRITE)
		fp.store_string(saved_profile)
		fp.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Gear.PROFILE))
	if had_garage:
		var fg := FileAccess.open(State.SAVE_PATH, FileAccess.WRITE)
		fg.store_string(saved_garage)
		fg.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(State.SAVE_PATH))

	# the screen
	for fac in ["aviation", "military"]:
		var vs = State.fresh()
		vs.credits = 30000
		var v = View.new()
		v.fac = fac
		v.state = vs
		v.persist = false
		v.profile = prof.duplicate(true)
		v.size = Vector2(1170, 540)
		root.add_child(v)
		await process_frame
		await process_frame
		var mine := "skyhawk" if fac == "aviation" else "havoc-ifv"
		ok(v.pick == mine and v._model != null and v._nomodel.text == "", "%s opens on yours (%s) with its model on the pad" % [fac, mine])
		var opt := "engine" if fac == "aviation" else "camo"
		ok(v.upgrade(opt) == "" and Facility.level(vs, mine, opt) == 1 and vs.credits < 30000, "%s: an upgrade fitted and paid" % fac)
		if fac == "military":
			var tinted := false
			for mi in v._model.find_children("*", "MeshInstance3D", true, false):
				if (mi as MeshInstance3D).material_overlay != null:
					tinted = true
			ok(tinted, "the desert camouflage is on the hull")
		var other := "riftwing" if fac == "aviation" else "warden-mech"
		v.show_vehicle(other)
		ok(v.upgrade(opt) != "" and Facility.level(vs, other, opt) == 0, "%s: not yours, no work" % fac)
		v.queue_free()
		await process_frame
	print("facilities: %d failed" % failed)
	quit(1 if failed > 0 else 0)
