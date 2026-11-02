extends Node3D
const LOCATION := Vector3(-32.0, 0.0, -80.0)
func _ready() -> void:
	var floor := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(20.0, 0.18, 20.0)
	floor.mesh = mesh
	floor.position = LOCATION + Vector3.UP * 0.08
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#164b57")
	mat.emission_enabled = true
	mat.emission = Color("#075469")
	floor.material_override = mat
	add_child(floor)
