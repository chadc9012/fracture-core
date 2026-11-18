extends SceneTree
## Every upgrade machine on every vehicle it serves (owner, Nov 18: "does all the machines work for all the vehicles"):
##   the AVIATION HANGAR — each aircraft it services: its model on the pad, all five upgrades bought to level 3 on the
##     facility screen, and the work reaching the flight (skyways_view.gd reads it: speed, thrust, turn, climb, crash and
##     landing damage)
##   the MILITARY MOTOR POOL — each military vehicle: its model, all five upgrades to level 3, the camouflage painted on
##     the hull, and the work reaching the street drive (facility.gd apply_drive: speed, pull, steering, brakes, armour)
##   the CUSTOMS SHOPS — each car and bike in the garage (starters and showroom), each shop, each slot it sells: a part
##     that fits is sold and fitted, its stats reach the drive (drive_profile.gd), and the kit draws the whole build on
##     the car's own model
## Prints one line per vehicle and "machines: N failed".
##   godot --headless --path godot-world-fracture --script res://tests/garage/all_machines_test.gd   (FAST=1: no flights)

const Facility := preload("res://scripts/garage/facility.gd")
const State := preload("res://scripts/garage/garage_state.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
const Order := preload("res://scripts/garage/garage_order.gd")
const Kit := preload("res://scripts/garage/garage_kit.gd")
const DriveProfile := preload("res://scripts/driving/drive_profile.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")

var failed := 0
var notes: Array[String] = []

func ok(cond: bool, what: String) -> void:
	if not cond:
		failed += 1
		print("FAIL ", what)

func _initialize() -> void:
	_run.call_deferred()

func _meshes(n: Node) -> int:
	return n.find_children("*", "MeshInstance3D", true, false).size() if n else 0

func _run() -> void:
	var View = load("res://scripts/garage/facility_view.gd")
	var Sky = load("res://scripts/flying/skyways_view.gd")
	var all_opts := {}
	for fac in ["aviation", "military"]:
		all_opts[fac] = []
		for o in Facility.FACILITIES[fac].options:
			all_opts[fac].append(String(o.id))

	# ------------------------------------------------------------------ the two facilities, every vehicle, every upgrade
	for fac in ["aviation", "military"]:
		var vs: Array = Facility.vehicles(fac)
		var profile := { "nex": 0, "air": { "aircraft": { "NXC": [] } }, "cars_owned": [] }
		for v in vs:
			if fac == "aviation":
				profile.air.aircraft.NXC.append(String(v.id))
			else:
				profile.cars_owned.append(String(v.id))
		var st = State.fresh()
		st.credits = 10000000
		var view = View.new()
		view.fac = fac
		view.state = st
		view.persist = false
		view.profile = profile
		view.size = Vector2(1170, 540)
		root.add_child(view)
		await process_frame
		await process_frame
		for v in vs:
			var id := String(v.id)
			view.show_vehicle(id)
			await process_frame
			var model_ok: bool = view._model != null and _meshes(view._model) > 0
			ok(model_ok, "%s %s: its model on the pad" % [fac, id])
			var bought := 0
			for opt in all_opts[fac]:
				for l in Facility.MAX_LEVEL:
					if view.upgrade(opt) == "":
						bought += 1
				ok(view.upgrade(opt) != "", "%s %s: %s stops at level %d" % [fac, id, opt, Facility.MAX_LEVEL])
			ok(bought == all_opts[fac].size() * Facility.MAX_LEVEL, "%s %s: every upgrade bought to level 3 (%d of %d)" % [fac, id, bought, all_opts[fac].size() * Facility.MAX_LEVEL])
			if fac == "aviation":
				var kind := Handling.kind_of(id)
				var h: Dictionary = Handling.profile(kind)
				var f: Array = Facility.apply_flight(h, 100.0, st, id)
				var p: Dictionary = f[0]
				var fine := float(f[1]) > 100.0 and float(p.accel) > float(h.accel) and float(p.steer) > float(h.steer) and float(p.climb) > float(h.climb) and float(f[2]) < 1.0
				ok(fine, "aviation %s (%s): the work changes speed, thrust, turn, climb and crash damage" % [id, kind])
				print("ok   aviation %-18s %-7s model %s, 15 upgrades, speed %+d%% thrust %+d%% turn %+d%% climb %+d%% crash %d%%" % [id, kind, "yes" if model_ok else "NO", int(float(f[1]) - 100.0), int((float(p.accel) / float(h.accel) - 1.0) * 100.0), int((float(p.steer) / float(h.steer) - 1.0) * 100.0), int((float(p.climb) / float(h.climb) - 1.0) * 100.0), int(float(f[2]) * 100.0)])
			else:
				var base: Dictionary = DriveProfile.performance(st, id)
				if base.is_empty():
					base = { "max_speed": 20.0, "acceleration": 5.0, "steering": 1.0, "braking": 10.0, "armor": 40.0 }
				var d: Dictionary = Facility.apply_drive(base, st, id)
				var fine := float(d.max_speed) > float(base.max_speed) and float(d.acceleration) > float(base.acceleration) and float(d.steering) > float(base.steering) and float(d.braking) > float(base.braking) and float(d.armor) >= float(base.get("armor", 0.0)) + 48.0
				ok(fine, "military %s: the work changes speed, pull, steering, brakes and armour" % id)
				var tinted := false
				if view._model:
					for mi in view._model.find_children("*", "MeshInstance3D", true, false):
						if (mi as MeshInstance3D).material_overlay != null:
							tinted = true
				ok(tinted, "military %s: the camouflage is painted on its hull" % id)
				print("ok   military %-20s model %s, 15 upgrades, speed %+d%% steering %+d%% armour %+d, camo %s" % [id, "yes" if model_ok else "NO", int((float(d.max_speed) / float(base.max_speed) - 1.0) * 100.0), int((float(d.steering) / float(base.steering) - 1.0) * 100.0), int(float(d.armor) - float(base.get("armor", 0.0))), "on" if tinted else "MISSING"])
		view.queue_free()
		await process_frame

	# the aviation work in the air: every hangar aircraft flown stock and fully upgraded (skyways_view reads the garage save)
	if OS.get_environment("FAST") == "":
		var had := FileAccess.file_exists(State.SAVE_PATH)
		var saved := FileAccess.get_file_as_string(State.SAVE_PATH) if had else ""
		for v in Facility.aircraft():
			var id := String(v.id)
			if not Sky.CRAFT.has(id):
				ok(false, "aviation %s: the hangar services it but Skyways can't fly it" % id)
				continue
			var nums := []
			for up in [false, true]:
				var gs = State.fresh()
				if up:
					gs.upgrades[id] = { "engine": 3, "avionics": 3, "gear": 3, "cockpit": 3, "airframe": 3 }
				gs.save()
				var sv = Sky.new()
				sv.craft_id = id
				root.add_child(sv)
				for i in 3:
					await process_frame
				nums.append([float(sv.top_speed), float(sv.hull_take), float(sv.land_take)])
				sv.queue_free()
				await process_frame
			var s0: Array = nums[0]
			var s1: Array = nums[1]
			var flies: bool = s1[0] > s0[0] and s1[1] < s0[1] and s1[2] < s0[2]
			ok(flies, "aviation %s in flight: top speed %.0f -> %.0f, crash %.2f -> %.2f, landing %.2f -> %.2f" % [id, s0[0], s1[0], s0[1], s1[1], s0[2], s1[2]])
			print("ok   aviation %-18s in the air: top speed %.0f -> %.0f m/s, crash damage x%.1f -> x%.1f, landing damage x%.1f -> x%.1f" % [id, s0[0], s1[0], s0[1], s1[1], s0[2], s1[2]])
		if had:
			var fp := FileAccess.open(State.SAVE_PATH, FileAccess.WRITE)
			fp.store_string(saved)
			fp.close()
		else:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(State.SAVE_PATH))
		# aircraft Skyways flies that no hangar can service
		for id in Sky.CRAFT:
			if String(Sky.CRAFT[id].kind) in ["JET", "HELI", "AIRSHIP"]:
				var serviced := false
				for v in Facility.aircraft():
					if String(v.id) == String(id):
						serviced = true
				ok(serviced, "aviation %s: flies in Skyways but the Aviation Hangar can't service it (not sold at the airport)" % id)

	# ------------------------------------------------------------------ the customs shops: every car, every shop, every slot
	var st = State.fresh()
	st.credits = 100000000
	for s in Catalog.SHOPS:
		st.rep[String(s.id)] = 3
	if st.get("street_rep") != null:
		st.street_rep = 1000000
	var cars: Array = []
	for v in Catalog.VEHICLES + Catalog.SHOWROOM:
		if String(v.get("cat", "")) == "military":
			continue
		cars.append(v)
	for v in cars:
		var id := String(v.id)
		var cls := String(v.get("cls", ""))
		if not st.cars.has(id):
			st.cars[id] = { "paint": "", "finish": "finish-gloss", "parts": {}, "damage": 0 }
		var fitted := 0
		var offered := 0
		var empty_slots: Array[String] = []
		var stat_fail: Array[String] = []
		for s in Catalog.SHOPS:
			for slot in s.slots:
				var pick := ""
				for it in Catalog.items_for_slot(String(slot)):
					if Catalog.fits(it, cls):
						var o = Order.new(String(s.id), id)
						if o.block_reason(st, String(it.id)) == "" or o.block_reason(st, String(it.id)) == "Already fitted":
							pick = String(it.id)
							break
				offered += 1
				if pick == "":
					empty_slots.append("%s/%s" % [s.id, slot])
					continue
				if st.installed(id).get(slot, "") == pick:
					fitted += 1
					continue
				var before := DriveProfile.stats(st, id)
				var o = Order.new(String(s.id), id)
				o.add(st, pick)
				var why: String = o.checkout(st)
				ok(why == "", "customs %s at %s: %s %s sells and fits (%s)" % [id, s.id, slot, pick, why])
				if why == "":
					fitted += 1
					var it := Catalog.item(pick)
					if not it.get("stats", {}).is_empty():
						var after := DriveProfile.stats(st, id)
						var moved := false
						for k in it.stats:
							if int(after.get(k, 0)) != int(before.get(k, 0)) or int(before.get(k, 0)) in [0, 100]:
								moved = true
						if not moved:
							stat_fail.append(slot)
		ok(stat_fail.is_empty(), "customs %s: parts that change nothing in the drive: %s" % [id, stat_fail])
		# the whole build drawn on the car's own model
		var drawn := false
		var path := String(v.model)
		if ResourceLoader.exists(path):
			var car := (load(path) as PackedScene).instantiate() as Node3D
			root.add_child(car)
			Kit.apply(car, st.installed(id), String(v.get("paint", "#888888")), st.tune(id))
			var kit := car.get_node_or_null(Kit.KIT)
			drawn = kit != null and kit.get_child_count() > 0
			car.queue_free()
		ok(drawn, "customs %s: the kit draws the build on its model (%s)" % [id, path])
		var perf: Dictionary = DriveProfile.performance(st, id)
		print("ok   customs  %-20s %-8s %d of %d shop slots fitted, drawn on the model: %s, top speed %.0f m/s" % [id, cls, fitted, offered, "yes" if drawn else "NO", float(perf.get("max_speed", 0.0))])
		if not empty_slots.is_empty():
			notes.append("%s (%s): nothing to fit in %s" % [id, cls, ", ".join(empty_slots)])
	for n in notes:
		print("note ", n)
	print("machines: %d failed" % failed)
	quit(1 if failed > 0 else 0)
