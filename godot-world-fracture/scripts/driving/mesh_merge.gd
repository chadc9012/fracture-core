extends RefCounted
## Folds a node's static MeshInstance3D children into one MeshInstance3D per material. Each child is its own draw call
## (two with shadows); the practice district builds its lane dashes, zebra stripes and barrier blocks as hundreds of
## little boxes, which a phone pays for every frame. Merged, the whole road is a handful of draws.
## Only direct children without children of their own, a material_override and an identity-scaled parent are merged.

static func merge_children(parent: Node3D, cast_shadow := true) -> void:
	var groups := {}
	for c in parent.get_children():
		var mi := c as MeshInstance3D
		if mi == null or mi.mesh == null or mi.get_child_count() > 0 or mi.material_override == null:
			continue
		if not groups.has(mi.material_override):
			groups[mi.material_override] = []
		groups[mi.material_override].append(mi)
	for mat in groups:
		var list: Array = groups[mat]
		if list.size() < 2:
			continue
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for mi in list:
			for s in mi.mesh.get_surface_count():
				st.append_from(mi.mesh, s, mi.transform)
		var merged := MeshInstance3D.new()
		merged.mesh = st.commit()
		merged.material_override = mat
		merged.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if cast_shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		for mi in list:
			parent.remove_child(mi)
			mi.queue_free()
		parent.add_child(merged)
