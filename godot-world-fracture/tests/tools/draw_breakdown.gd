extends SceneTree
## Where a street's draws come from: every visible mesh surface grouped by what holds it (prop file, batch, script).
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
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		if not (n as Node3D).is_visible_in_tree():
			continue
		var surf := 0
		if n is MeshInstance3D and (n as MeshInstance3D).mesh:
			surf = (n as MeshInstance3D).mesh.get_surface_count()
		elif n is MultiMeshInstance3D:
			surf = (n as MultiMeshInstance3D).multimesh.mesh.get_surface_count() if (n as MultiMeshInstance3D).multimesh and (n as MultiMeshInstance3D).multimesh.mesh else 0
		else:
			continue
		var key := n.get_class()
		var p: Node = n
		while p:
			if p.has_meta("file"):
				key += " " + String(p.get_meta("file"))
				break
			if p.get_script():
				key += " <" + (p.get_script() as Script).resource_path.get_file() + ">"
				break
			if p.has_meta("car"):
				key += " parked car"
				break
			p = p.get_parent()
		if String(n.name).begins_with("batch_"):
			key = "batch"
		c[key] = int(c.get(key, 0)) + surf
		if n is MultiMeshInstance3D and key.begins_with("MultiMeshInstance3D <street_slice"):
			var mmi := n as MultiMeshInstance3D
			var mesh_name := mmi.multimesh.mesh.resource_path.get_file() if mmi.multimesh.mesh.resource_path != "" else mmi.multimesh.mesh.resource_name
			if mesh_name == "":
				mesh_name = "mesh#%d" % (mmi.multimesh.mesh.get_rid().get_id() % 10000)
			var why := "MMI %s x%d inst, %d surf, vr=%.0f" % [mesh_name, mmi.multimesh.instance_count, surf, mmi.visibility_range_end]
			c["  · " + why] = int(c.get("  · " + why, 0)) + surf
		if key == "MeshInstance3D <street_slice.gd>":
			var mi := n as MeshInstance3D
			var why := "%s parent=%s kids=%d vr=%.0f skin=%s" % [mi.mesh.get_class(), mi.get_parent().name, mi.get_child_count(), mi.visibility_range_end, str(mi.skin != null)]
			c["  · " + why] = int(c.get("  · " + why, 0)) + surf
	var keys := c.keys()
	keys.sort_custom(func(a, b) -> bool: return c[a] > c[b])
	for k in keys.slice(0, 60):
		print("%6d  %s" % [c[k], k])
	quit()
