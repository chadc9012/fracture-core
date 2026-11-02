extends Node3D
func _ready() -> void:
	for i in range(8):
		for side in [-1, 1]:
			var pole := MeshInstance3D.new()
			var cylinder := CylinderMesh.new()
			cylinder.height = 7.0
			cylinder.top_radius = 0.09
			cylinder.bottom_radius = 0.14
			pole.mesh = cylinder
			pole.position = Vector3(side * 44.0, 3.5, -105.0 + i * 30.0)
			add_child(pole)
			var lamp := OmniLight3D.new()
			lamp.position = pole.position + Vector3.UP * 3.4
			lamp.light_energy = 0.65
			lamp.omni_range = 9.0
			add_child(lamp)
