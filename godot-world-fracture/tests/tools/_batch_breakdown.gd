extends SceneTree
## which merged batches a street has: by look (albedo, emission), range and cell
func _initialize() -> void:
	_run.call_deferred()
func _run() -> void:
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	main._open_street(true, "nexus", true)
	for i in 30:
		await process_frame
	var c := {}
	var cells := {}
	for n in root.find_children("batch_*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		var m := mi.get_active_material(0) as StandardMaterial3D
		var look := "?"
		if m:
			look = "%s e%.1f r%.1f %s" % [m.albedo_color.to_html(false), m.emission_energy_multiplier if m.emission_enabled else 0.0, m.roughness, "glow" if m.emission_enabled else ""]
		var key := "%s vr=%d-%d" % [look, int(mi.visibility_range_begin), int(mi.visibility_range_end)]
		c[key] = int(c.get(key, 0)) + 1
		var cell := "%d,%d" % [floori(mi.global_position.x / 40.0), floori(mi.global_position.z / 40.0)]
		cells[cell] = int(cells.get(cell, 0)) + 1
	var keys := c.keys()
	keys.sort_custom(func(a, b) -> bool: return c[a] > c[b])
	print("batches: ", root.find_children("batch_*", "MeshInstance3D", true, false).size(), " looks: ", keys.size(), " cells: ", cells.size())
	for k in keys.slice(0, 40):
		print("%4d  %s" % [c[k], k])
	quit()
