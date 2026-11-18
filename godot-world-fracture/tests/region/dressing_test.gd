extends SceneTree
## The regions' natural dressing (region_flora.gd): root flares under the forest trunks, underwater cave mouths in the
## coast maps' drop-offs — each where it belongs, above the water for the roots, below it on a slope for the caves.
##   godot --headless --path . --script res://tests/region/dressing_test.gd

var ok := true
func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	ok = ok and cond

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	for id in ["veridan", "shattered-reefs", "thalassia", "crystal-badlands"]:
		main._open_map(id)
		main._open_3d(id, null, false)
		for i in 3:
			await process_frame
		var r: Node = main.region_3d
		if id == "veridan":
			check("the Verdant Forest's trunks carry root flares (%d)" % r.root_spots.size(), r.root_spots.size() >= 200)
			var dry := true
			for p in r.root_spots:
				dry = dry and p.y > r._water
			check("every root flare stands above the water", dry)
			check("no sea caves inland", r.sea_caves.is_empty())
			check("the forest is green: nothing corrupted away from the fracture", r.corrupt_spots.is_empty())
		elif id == "crystal-badlands":
			check("the badlands' crystal fields grow corrupted trees (%d)" % r.corrupt_spots.size(), r.corrupt_spots.size() >= 60)
		elif id == "thalassia":
			# Thalassia's ground lies wholly above its water line (the drowned city is the map's story, not its heights)
			check("thalassia, with no sea floor to cut, has no cave mouths", r.sea_caves.is_empty())
		else:
			check("%s has underwater cave mouths (%d)" % [id, r.sea_caves.size()], r.sea_caves.size() >= 3)
			var under := true
			for p in r.sea_caves:
				under = under and p.y < r._water - 2.0
			check("%s: every cave mouth lies under the water" % id, under)
			check("%s: a quarter of the reef's trees are corrupted (%d)" % [id, r.corrupt_spots.size()], r.corrupt_spots.size() >= 40)
		main._close_3d()
		main._close_map()
		await process_frame
	print("dressing: ", "0 failed" if ok else "FAILED")
	quit(0 if ok else 1)
