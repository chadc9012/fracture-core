extends Node3D
func _ready() -> void:
	var label := Label3D.new()
	label.text = "NEXUS CUSTOMS"
	label.font_size = 90
	label.pixel_size = 0.012
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(-32.0, 5.5, -80.0)
	label.modulate = Color("#6ce6ff")
	add_child(label)
