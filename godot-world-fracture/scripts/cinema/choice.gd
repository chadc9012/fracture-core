extends Control
## A story choice between cutscenes (owner's Phase 3 package: Mission 05's "cooperate" or "remain independent" with
## Captain Vale). A prompt over a dimmed screen and one big button per option (tap or click; 1 / 2 on a keyboard). It
## never times out: the story waits for the player. `ask(prompt, options)` shows it and emits `chosen(key)`.
## options: [[key, label, hint], …]

signal chosen(key: String)

var _keys: Array[String] = []

func ask(prompt: String, options: Array) -> void:
	for c in get_children():
		c.queue_free()
	_keys.clear()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(560, 0)
	box.position = Vector2(-280, -120)
	box.add_theme_constant_override("separation", 14)
	add_child(box)
	var q := Label.new()
	q.text = prompt
	q.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	q.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	q.add_theme_font_size_override("font_size", 26)
	q.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	box.add_child(q)
	for k in options.size():
		var o: Array = options[k]
		_keys.append(String(o[0]))
		var b := Button.new()
		b.text = "%d   %s" % [k + 1, String(o[1])]
		b.tooltip_text = String(o[2]) if o.size() > 2 else ""
		b.custom_minimum_size = Vector2(560, 64)
		b.add_theme_font_size_override("font_size", 22)
		var key := String(o[0])
		b.pressed.connect(func() -> void: _pick(key))
		box.add_child(b)
		if o.size() > 2 and String(o[2]) != "":
			var h := Label.new()
			h.text = String(o[2])
			h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			h.add_theme_font_size_override("font_size", 15)
			h.add_theme_color_override("font_color", Color(0.75, 0.82, 0.9))
			box.add_child(h)
	visible = true

func _unhandled_input(event: InputEvent) -> void:
	if not visible or not (event is InputEventKey) or not event.pressed:
		return
	var n: int = (event as InputEventKey).keycode - KEY_1
	if n >= 0 and n < _keys.size():
		_pick(_keys[n])
		get_viewport().set_input_as_handled()

func _pick(key: String) -> void:
	if not visible:
		return
	visible = false
	chosen.emit(key)
