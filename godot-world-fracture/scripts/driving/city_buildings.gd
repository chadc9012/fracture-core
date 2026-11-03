extends Node3D
const MeshMerge = preload("res://scripts/driving/mesh_merge.gd")
func _ready() -> void:
	var mats: Array[StandardMaterial3D] = []
	for c in [Color("#46545c"), Color("#303c4b")]:
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.metallic = 0.22
		mats.append(m)
	for side in [-1, 1]:
		for i in range(7):
			var building := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(14.0, 9.0 + (i % 4) * 7.0, 12.0)
			building.mesh = box
			building.position = Vector3(side * 59.0, box.size.y * 0.5, -100.0 + i * 31.0)
			building.material_override = mats[i % 2]
			add_child(building)
	MeshMerge.merge_children(self)
