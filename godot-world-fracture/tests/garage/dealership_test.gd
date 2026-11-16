extends SceneTree
## The Vehicle Showroom (owner, Nov 12; filled from the owner's vehicle roster boards, Nov 15): every showroom vehicle
## loads with its 4K paint texture and a phone triangle budget, buying with Nex, the everyday ones on the street and the
## high-end ones only ever bought; then the showroom screen itself (categories, a car on the turntable, BUY). Also the
## board's aircraft and boats in Skyways and the airport, and the fleet files that now hold board models.
##   godot --headless --path godot-world-fracture --script res://tests/garage/dealership_test.gd
## Prints "dealership: N failed".

const Catalog := preload("res://scripts/garage/catalog.gd")
const Dealer := preload("res://scripts/garage/dealership.gd")
const Air := preload("res://scripts/airport/airport.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func _initialize() -> void:
	_run.call_deferred()

## the largest base-colour texture and the triangle count of a model
func _look(path: String) -> Dictionary:
	var scene: PackedScene = load(path)
	if scene == null:
		return {}
	var n := scene.instantiate() as Node3D
	var tex := 0
	var tris := 0
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := (mi as MeshInstance3D).mesh
		for s in m.get_surface_count():
			tris += m.surface_get_array_index_len(s) / 3
			var mat := (mi as MeshInstance3D).get_active_material(s) as BaseMaterial3D
			if mat and mat.albedo_texture:
				tex = maxi(tex, mat.albedo_texture.get_width())
	n.free()
	return { "tex": tex, "tris": tris }

func _run() -> void:
	# the roster
	ok(Catalog.SHOWROOM.size() == 32, "the showroom holds the board's 32 finished vehicles (%d)" % Catalog.SHOWROOM.size())
	var ids := {}
	var cats := {}
	for v in Catalog.SHOWROOM:
		ids[v.id] = true
		cats[v.cat] = true
		ok(Catalog.vehicle(String(v.id)) == v, "%s: found by id" % v.id)
		ok(String(v.cls) in Catalog.ALL, "%s: a garage class the parts know" % v.id)
		ok(int(v.price) > 0, "%s: priced (%d Nex)" % [v.id, int(v.price)])
		var l := _look(String(v.model))
		ok(not l.is_empty(), "%s: the model loads" % v.id)
		if not l.is_empty():
			ok(int(l.tex) >= 4096, "%s: 4K paint texture (%d px)" % [v.id, int(l.tex)])
			ok(int(l.tris) > 20000 and int(l.tris) <= 125000, "%s: phone triangle budget (%d)" % [v.id, int(l.tris)])
	ok(ids.size() == Catalog.SHOWROOM.size(), "ids are unique")
	for c in Catalog.SHOWROOM_CATS:
		ok(cats.has(c[0]), "the %s row has vehicles" % c[1])
	# the starters hold the board's models too
	for v in Catalog.VEHICLES:
		if String(v.id) == "aurora-gt":
			continue   # the CC-BY Car Concept, not a board model
		var l := _look(String(v.model))
		ok(not l.is_empty() and int(l.tex) >= 2048, "starter %s (%s) loads with its texture" % [v.id, v.name])
	# high end only by buying; everyday on the street
	ok(Catalog.high_end("void-chaser") and Catalog.high_end("venom-rs") and Catalog.high_end("shadow-r1") and Catalog.high_end("revenant-tank"), "hypercars, supercars, bikes and military are dealership only")
	ok(not Catalog.high_end("atlas-overland") and not Catalog.high_end("service-van") and not Catalog.high_end("nightshade"), "SUVs, vans and tuners are everyday")
	var street := Catalog.street_models()
	ok(street.size() >= 12, "everyday showroom vehicles join traffic and parking (%d)" % street.size())
	for m in street:
		ok(not Catalog.high_end(Catalog.id_for_model(m)), "no high-end vehicle in the street pool: " + m.get_file())
	# the street's lighter cuts: every street vehicle has one, a third of the triangles, the same 4K paint (shared file)
	for m in street + ["res://models/fleet/tuner.glb", "res://models/fleet/muscle-car-lod.glb", "res://models/fleet/war-rig.glb"]:
		var cut := Catalog.street_cut(m)
		var l := _look(cut)
		ok(cut != m and not l.is_empty() and int(l.tex) >= 4096 and int(l.tris) <= 40000, "street cut of %s: %d tris, %d px" % [m.get_file(), int(l.get("tris", 0)), int(l.get("tex", 0))])
	# buying
	var p := { "nex": 1000 }
	ok(Dealer.owned(p).size() == Catalog.VEHICLES.size(), "the garage's starters are owned from the start")
	ok(not Dealer.owns(p, "zenith-v12"), "a showroom car is not yours until bought")
	var line := Dealer.buy(p, "zenith-v12")
	ok(not Dealer.owns(p, "zenith-v12") and int(p.nex) == 1000 and line.contains("needs"), "short of Nex: no sale (%s)" % line)
	p.nex = 30000
	line = Dealer.buy(p, "zenith-v12")
	ok(Dealer.owns(p, "zenith-v12") and int(p.nex) == 30000 - Dealer.price("zenith-v12"), "bought with Nex (%s)" % line)
	line = Dealer.buy(p, "zenith-v12")
	ok(int(p.nex) == 30000 - Dealer.price("zenith-v12") and line.contains("already"), "never sold twice")
	# Skyways craft and airport aircraft
	# (skyways_view.gd needs the Data autoload, so its CRAFT rows are checked through their files)
	for f in DirAccess.get_files_at("res://models/fleet/craft"):
		if f.ends_with(".glb"):
			var l := _look("res://models/fleet/craft/" + f)
			ok(not l.is_empty() and int(l.tex) >= 4096 and int(l.tris) <= 125000, "craft %s loads, 4K, %d tris" % [f, int(l.get("tris", 0))])
	for id in Air.AIRCRAFT:
		var path := "res://models/fleet/" + String(Air.AIRCRAFT[id].get("model", id + ".glb"))
		ok(ResourceLoader.exists(path), "the hangar's %s has its model" % id)
	for liner in ["a320n-aerolink", "b737-atlas", "a330-solmara-air", "b787-dreamliner", "a350-horizon", "b777-veyron", "a380-world-fracture", "l1011-tristar"]:
		ok(ResourceLoader.exists("res://models/fleet/airliners/%s.glb" % liner), "airliner %s" % liner)
	# the screen
	var v = load("res://scripts/garage/showroom_view.gd").new()
	v.profile = { "nex": 9000 }
	v.persist = false
	v.size = Vector2(1600, 900)
	root.add_child(v)
	for i in 4:
		await process_frame
	ok(v._tabs.get_child_count() == Catalog.SHOWROOM_CATS.size(), "a tab per showroom row (%d)" % v._tabs.get_child_count())
	ok(v._car != null and v.pick != "", "a vehicle stands on the turntable (%s)" % v.pick)
	v._show_cat("sports")
	await process_frame
	ok(v.cars_in("sports").size() == 1 and String(Catalog.vehicle(v.pick).cat) == "sports", "picking SPORTS shows its cars")
	v.show_car("crimson-z")
	v._purchase()
	ok(Dealer.owns(v.profile, "crimson-z") and int(v.profile.nex) == 500, "BUY takes the Nex and the car is yours")
	ok(v._buy.disabled and v._buy.text == "OWNED", "the button reads OWNED after")
	v.queue_free()
	await process_frame
	print("dealership: %d failed" % failed)
	quit(1 if failed > 0 else 0)
