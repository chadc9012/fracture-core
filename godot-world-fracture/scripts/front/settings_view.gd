extends Control
## The settings screen (step 7 of the schedule): graphics tier, look sensitivity and inversion, volumes, HUD layout.
## Writes through settings_store.gd; graphics apply on the next view opened (Phone.fit_viewport reads the tier).

signal closed

const Store := preload("res://scripts/front/settings_store.gd")

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.05, 0.97)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var box := VBoxContainer.new()
	box.position = Vector2(24, 70)
	box.custom_minimum_size = Vector2(492, 0)
	box.add_theme_constant_override("separation", 10)
	add_child(box)
	var title := Label.new()
	title.text = "SETTINGS"
	title.add_theme_font_size_override("font_size", 26)
	box.add_child(title)
	var s := Store.load_all()
	# graphics
	box.add_child(_label("GRAPHICS · %s in force" % Store.tier().to_upper()))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	for t in ["auto", "low", "medium", "high"]:
		var b := Button.new()
		b.text = t.to_upper()
		b.toggle_mode = true
		b.button_pressed = String(s.graphics) == t
		b.custom_minimum_size = Vector2(110, 44)
		b.pressed.connect(func():
			Store.set_value("graphics", t)
			for o in row.get_children():
				(o as Button).button_pressed = (o as Button).text.to_lower() == t
			title.text = "SETTINGS · graphics %s" % Store.tier().to_upper())
		row.add_child(b)
	box.add_child(row)
	var note := Label.new()
	note.text = "Low: no shadows, 60 % scale. Medium (phones): 2× MSAA, 80 % scale, 2048 px shadows. High: 4× MSAA, full scale, soft shadows. Takes effect when you next enter a place."
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.custom_minimum_size = Vector2(492, 0)
	note.add_theme_font_size_override("font_size", 13)
	note.modulate = Color(0.65, 0.7, 0.78)
	box.add_child(note)
	# screen orientation
	box.add_child(_label("SCREEN"))
	var orow := HBoxContainer.new()
	orow.add_theme_constant_override("separation", 8)
	for o in Store.ORIENTATIONS:
		var ob := Button.new()
		ob.text = String(o).to_upper()
		ob.toggle_mode = true
		ob.button_pressed = String(s.get("orientation", "auto")) == o
		ob.custom_minimum_size = Vector2(150, 44)
		ob.pressed.connect(func():
			Store.set_value("orientation", o)
			Store.apply_orientation()
			for other in orow.get_children():
				(other as Button).button_pressed = (other as Button).text.to_lower() == o)
		orow.add_child(ob)
	box.add_child(orow)
	# look
	box.add_child(_label("LOOK SENSITIVITY"))
	box.add_child(_slider("sensitivity", 0.3, 3.0, 0.1, s))
	var inv := CheckButton.new()
	inv.text = "Invert look (up / down)"
	inv.button_pressed = bool(s.invert_look)
	inv.toggled.connect(func(on: bool): Store.set_value("invert_look", on))
	box.add_child(inv)
	var simple := CheckButton.new()
	simple.text = "Simple phone HUD (move, look, fire, enter)"
	simple.button_pressed = bool(s.simple_hud)
	simple.toggled.connect(func(on: bool): Store.set_value("simple_hud", on))
	box.add_child(simple)
	# gore: off (puffs), reduced (a spark of the right colour), full (a spray that lingers). Machines bleed coolant, Fracture
	# creatures violet, wildlife green — never a gore level on the troopers' faces (the owner's board)
	var gl := Label.new()
	gl.text = "Gore"
	gl.add_theme_font_size_override("font_size", 14)
	box.add_child(gl)
	var grow := HBoxContainer.new()
	grow.add_theme_constant_override("separation", 8)
	var gore_buttons: Array[Button] = []
	for opt in ["off", "reduced", "full"]:
		var gb := Button.new()
		gb.text = String(opt).to_upper()
		gb.toggle_mode = true
		gb.custom_minimum_size = Vector2(150, 44)
		gb.button_pressed = String(s.get("gore", "reduced")) == opt
		gb.pressed.connect(func():
			Store.set_value("gore", opt)
			for other in gore_buttons:
				other.button_pressed = other == gb)
		gore_buttons.append(gb)
		grow.add_child(gb)
	box.add_child(grow)
	var perf := CheckButton.new()
	perf.text = "Frame-time readout (fps · ms · draws · tris · vram)"
	perf.button_pressed = bool(s.get("perf_hud", true))
	perf.toggled.connect(func(on: bool): Store.set_value("perf_hud", on))
	box.add_child(perf)
	# audio
	box.add_child(_label("AUDIO"))
	for k in ["master", "music", "sfx", "voices"]:
		var l := Label.new()
		l.text = k.capitalize()
		l.add_theme_font_size_override("font_size", 14)
		box.add_child(l)
		box.add_child(_slider(k, 0.0, 1.0, 0.05, s))
	var back := Button.new()
	back.text = "← BACK"
	back.custom_minimum_size = Vector2(0, 48)
	back.pressed.connect(func(): closed.emit())
	box.add_child(back)

func _label(t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", 16)
	l.modulate = Color(0.5, 0.85, 1.0)
	return l

func _slider(key: String, lo: float, hi: float, stp: float, s: Dictionary) -> HSlider:
	var sl := HSlider.new()
	sl.min_value = lo
	sl.max_value = hi
	sl.step = stp
	sl.value = float(s.get(key, Store.DEFAULTS[key]))
	sl.custom_minimum_size = Vector2(480, 32)
	sl.value_changed.connect(func(v: float): Store.set_value(key, v); _apply_audio(key, v))
	return sl

func _apply_audio(key: String, v: float) -> void:
	var bus: String = { "master": "Master", "music": "Music", "sfx": "SFX", "voices": "Voices" }.get(key, "")
	var i := AudioServer.get_bus_index(bus)
	if i >= 0:
		AudioServer.set_bus_volume_db(i, linear_to_db(maxf(v, 0.001)))
