extends HBoxContainer
signal direction_changed(throttle: float, steer: float, brake: float)
var forward := false
var reverse := false
var left := false
var right := false
var braking := false
func _ready() -> void:
	for spec in [["◀", "left"], ["▶", "right"], ["GO", "forward"], ["REV", "reverse"], ["BRAKE", "braking"]]:
		var button := Button.new()
		button.text = spec[0]
		button.custom_minimum_size = Vector2(70, 54)
		add_child(button)
		if DisplayServer.is_touchscreen_available() or OS.has_feature("mobile"):
			# any finger: steering and GO held together (a Button alone only hears the first finger)
			preload("res://scripts/player/touch_controls.gd").bind(button, _set_flag.bind(spec[1], true), _set_flag.bind(spec[1], false))
		else:
			button.button_down.connect(_set_flag.bind(spec[1], true))
			button.button_up.connect(_set_flag.bind(spec[1], false))
func _set_flag(flag: String, value: bool) -> void:
	set(flag, value)
	direction_changed.emit((1.0 if forward else 0.0) - (1.0 if reverse else 0.0), (1.0 if left else 0.0) - (1.0 if right else 0.0), (1.0 if braking else 0.0))
