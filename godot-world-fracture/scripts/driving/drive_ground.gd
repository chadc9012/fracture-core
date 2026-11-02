extends Node3D
func _ready() -> void:
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(600, 600)
	ground.mesh = plane
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#363c41")
	material.roughness = 0.95
	ground.material_override = material
	add_child(ground)
