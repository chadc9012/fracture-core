extends SceneTree
## Where a scene's triangles come from: every visible mesh, triangles × instances, grouped by what holds it.
##   godot --headless --script res://tests/tools/prim_breakdown.gd -- [neon|nexus]
func _initialize() -> void:
	_run.call_deferred()

static func tris_of(mesh: Mesh) -> int:
	if mesh == null:
		return 0
	var n := 0
	for s in mesh.get_surface_count():
		var arr := mesh.surface_get_arrays(s)
		if arr.is_empty():
			continue
		var idx = arr[Mesh.ARRAY_INDEX]
		if idx != null and idx.size() > 0:
			n += idx.size() / 3
		elif arr[Mesh.ARRAY_VERTEX] != null:
			n += arr[Mesh.ARRAY_VERTEX].size() / 3
	return n

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var city := "neon" if args.has("neon") else "nexus"
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	main._open_street(true, city, true)
	for i in 30:
		await process_frame
	var c := {}
	var total := 0
	for n in root.find_children("*", "GeometryInstance3D", true, false):
		if not (n as Node3D).is_visible_in_tree():
			continue
		var t := 0
		if n is MeshInstance3D:
			t = tris_of((n as MeshInstance3D).mesh)
		elif n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh:
			var mm := (n as MultiMeshInstance3D).multimesh
			t = tris_of(mm.mesh) * (mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count)
		else:
			continue
		var key := n.get_class()
		var p: Node = n
		while p:
			if p.has_meta("file"):
				key += " " + String(p.get_meta("file")).get_file()
				break
			if p.get_script():
				key += " <" + (p.get_script() as Script).resource_path.get_file() + ">"
				break
			if p.has_meta("car"):
				key += " parked car"
				break
			p = p.get_parent()
		if n is MultiMeshInstance3D:
			var mesh: Mesh = (n as MultiMeshInstance3D).multimesh.mesh
			var mn := mesh.resource_path.get_file() if mesh and mesh.resource_path != "" else (mesh.resource_name if mesh else "")
			key += " [%s %d tris x%d]" % [mn, tris_of(mesh), (n as MultiMeshInstance3D).multimesh.instance_count]
		elif n is MeshInstance3D and (n as MeshInstance3D).mesh and (n as MeshInstance3D).mesh.resource_path != "":
			key += " [" + (n as MeshInstance3D).mesh.resource_path.get_file() + "]"
		c[key] = int(c.get(key, 0)) + t
		total += t
	var keys := c.keys()
	keys.sort_custom(func(a, b) -> bool: return c[a] > c[b])
	print("total tris in tree (not culled): ", total)
	for k in keys.slice(0, 45):
		print("%9d  %s" % [c[k], k])
	quit()
