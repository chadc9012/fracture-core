extends Node3D
## The ground round the practice district: paved plazas near the road, worn concrete beyond.
const Materials := preload("res://scripts/city/materials.gd")
func _ready() -> void:
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(600, 600)
	ground.mesh = plane
	ground.material_override = Materials.pbr("brushed_concrete", Color(0.62, 0.6, 0.57), 8.0) if Materials.has("brushed_concrete") else _flat()
	add_child(ground)

static func _flat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color("#363c41")
	m.roughness = 0.95
	return m
