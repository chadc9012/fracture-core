extends Node3D
func _ready() -> void:
	for side in [-1, 1]:
		var pavement := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(7.0, 0.16, 245.0)
		pavement.mesh = mesh
		pavement.position = Vector3(side * 46.0, 0.1, 0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color("#85898c")
		pavement.material_override = mat
		add_child(pavement)
