extends RefCounted
## What an outfit does to the operator's body until clothing is modelled (the web game's clothing-sets.ts does the same):
## the body's plate and undersuit take the outfit's armour and cloth colours as a tint over the body texture, the head,
## hair and gear untouched. Scene side of gear_store.gd's outfits.

static func apply(rig: Node3D, outfit: Dictionary) -> void:
	if not rig or not rig.body_root:
		return
	var tint := Color(1, 1, 1)
	var strength := 0.0
	if not outfit.is_empty():
		tint = Color(String(outfit.armor)).lerp(Color(String(outfit.cloth)), 0.35)
		strength = 0.75
	for c in rig.body_root.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		if mi == rig.head_mesh or mi == rig.hair_mesh:
			continue
		for i in mi.mesh.get_surface_count() if mi.mesh else 0:
			var base: Material = mi.mesh.surface_get_material(i)
			if not (base is StandardMaterial3D):
				continue
			var m := (base as StandardMaterial3D).duplicate() as StandardMaterial3D
			m.albedo_color = Color(1, 1, 1).lerp(tint * 1.6, strength)
			mi.set_surface_override_material(i, m if strength > 0.0 else null)
