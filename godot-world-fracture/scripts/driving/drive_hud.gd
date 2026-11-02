extends Control
var speed_label: Label
var info_label: Label
func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var stack := VBoxContainer.new()
	stack.position = Vector2(20, 20)
	add_child(stack)
	info_label = Label.new()
	stack.add_child(info_label)
	speed_label = Label.new()
	stack.add_child(speed_label)
func refresh(id: String, speed: float, distance: float) -> void:
	info_label.text = "%s  |  %.1f km driven" % [id, distance / 1000.0]
	speed_label.text = "%d km/h" % int(round(absf(speed) * 3.6))
