extends SceneTree
## Builds each region's 3D view and reports how many scattered trees, rocks, boulders and crystals region_3d.gd dropped
## because they would have stood inside another (its spacing hash). Run before and after a scatter change to compare.
##   godot --headless --path godot-world-fracture --script res://tests/tools/region_spacing.gd
func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	for id in ["veridan", "frostspire", "storm-islands", "crystal-badlands", "shrouded-swamps", "solara", "ember", "wastelands"]:
		main._open_map(id)
		main._open_3d(id, null, false)
		for i in 3:
			await process_frame
		var r: Node = main.region_3d
		if r:
			print("%-18s dropped for standing inside another: %d" % [id, r.space_rejected])
		main._close_3d()
		main._close_map()
		await process_frame
	quit()
