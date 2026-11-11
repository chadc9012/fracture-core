extends Node3D
const Materials := preload("res://scripts/city/materials.gd")
func _ready() -> void:
	for side in [-1, 1]:
		var pavement := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(7.0, 0.16, 245.0)
		pavement.mesh = mesh
		pavement.position = Vector3(side * 46.0, 0.1, 0)
		pavement.material_override = Materials.pbr("concrete_floor", Color(0.82, 0.8, 0.76), 1.5) if Materials.has("concrete_floor") else _flat()
		add_child(pavement)

static func _flat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color("#85898c")
	return m
