extends Node3D
func _ready() -> void:
	for side in [-1, 1]:
		for i in range(7):
			var building := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(14.0, 9.0 + (i % 4) * 7.0, 12.0)
			building.mesh = box
			building.position = Vector3(side * 59.0, box.size.y * 0.5, -100.0 + i * 31.0)
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color("#46545c") if i % 2 == 0 else Color("#303c4b")
			mat.metallic = 0.22
			building.material_override = mat
			add_child(building)
