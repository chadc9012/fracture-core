extends Control
## The settings screen (step 7 of the schedule): graphics tier, look sensitivity and inversion, volumes, HUD layout.
## Writes through settings_store.gd; graphics apply on the next view opened (Phone.fit_viewport reads the tier).
## Laid out as Destiny's settings (owner Nov 18, interfaceingame.com Destiny 2): a top bar, then sections with small-caps
## headers over hairlines, one row per setting — its name on the left, the control on the right.

signal closed

const Store := preload("res://scripts/front/settings_store.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const COL_W := 680.0

var _column: VBoxContainer
var _tier_note: Label

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.045, 0.97)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# top bar: BACK, SETTINGS
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 24
	bar.offset_right = -24
	bar.offset_top = 18
	bar.add_theme_constant_override("separation", 18)
	add_child(bar)
	var back := Button.new()
	back.text = "✕  BACK"
	back.custom_minimum_size = Vector2(110, 44)
	back.pressed.connect(func(): closed.emit())
	bar.add_child(back)
	var title := Label.new()
	title.text = "SETTINGS"
	title.theme_type_variation = &"HeaderLarge"
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	var rule := ColorRect.new()
	rule.color = UiTheme.LINE
	rule.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	rule.offset_top = 78
	rule.offset_bottom = 79
	add_child(rule)
	# the scrolling column of sections
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_top = 80
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(center)
	_column = VBoxContainer.new()
	_column.add_theme_constant_override("separation", 0)
	center.add_child(_column)
	resized.connect(_fit)
	_fit()
	var s := Store.load_all()

	_section("GRAPHICS")
	_tier_note = _note("")
	_row("Quality", _choices(["auto", "low", "medium", "high"], String(s.graphics), func(t: String):
		Store.set_value("graphics", t)
		_show_tier()))
	_column.add_child(_tier_note)
	_show_tier()
	_row("Screen", _choices(Store.ORIENTATIONS, String(s.get("orientation", "auto")), func(o: String):
		Store.set_value("orientation", o)
		Store.apply_orientation()))
	# gore: off (puffs), reduced (a spark of the right colour), full (a spray that lingers). Machines bleed coolant, Fracture
	# creatures violet, wildlife green — never a gore level on the troopers' faces (the owner's board)
	_row("Gore", _choices(["off", "reduced", "full"], String(s.get("gore", "reduced")), func(o: String):
		Store.set_value("gore", o)))
	_row("Frame-time readout", _toggle(bool(s.get("perf_readout", false)), func(on: bool): Store.set_value("perf_readout", on)),
		"fps · ms · draws · tris · vram")

	_section("CONTROLS")
	_row("Look sensitivity", _slider("sensitivity", 0.3, 3.0, 0.1, s, func(v: float) -> String: return "%.1f×" % v))
	_row("Invert look", _toggle(bool(s.invert_look), func(on: bool): Store.set_value("invert_look", on)), "up / down")
	_row("Simple phone HUD", _toggle(bool(s.simple_hud), func(on: bool): Store.set_value("simple_hud", on)),
		"move, look, fire, enter")

	_section("AUDIO")
	for k in ["master", "music", "sfx", "voices"]:
		_row({ "master": "Master volume", "music": "Music", "sfx": "Effects", "voices": "Voices" }[k],
			_slider(k, 0.0, 1.0, 0.05, s, func(v: float) -> String: return "%d" % int(round(v * 100.0))))
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(0, 40)
	_column.add_child(pad)

func _fit() -> void:
	if _column:
		_column.custom_minimum_size.x = minf(COL_W, size.x - 40.0)

func _show_tier() -> void:
	_tier_note.text = "In force: %s.  Low: no shadows, 60%% scale.  Medium (phones): 2× MSAA, 80%% scale, 2048 px shadows.  High: 4× MSAA, full scale, soft shadows.  Applies when you next enter a place." % Store.tier().to_upper()

func _section(t: String) -> void:
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 26)
	_column.add_child(gap)
	var l := Label.new()
	l.text = t
	l.theme_type_variation = &"HeaderSmall"
	_column.add_child(l)
	var line := ColorRect.new()
	line.color = UiTheme.LINE_HI * Color(1, 1, 1, 0.5)
	line.custom_minimum_size = Vector2(0, 2)
	_column.add_child(line)

func _note(t: String) -> Label:
	var l := Label.new()
	l.text = t
	l.theme_type_variation = &"Caption"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(200, 0)
	return l

## one setting: its name (and a dim hint) on the left, the control on the right, a hairline under it
func _row(name: String, control: Control, hint := "") -> void:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(0, 58)
	row.add_theme_constant_override("separation", 16)
	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.alignment = BoxContainer.ALIGNMENT_CENTER
	left.add_theme_constant_override("separation", 0)
	var l := Label.new()
	l.text = name
	l.add_theme_font_override("font", UiTheme.font(500, 0))
	l.add_theme_font_size_override("font_size", 16)
	left.add_child(l)
	if hint != "":
		var h := Label.new()
		h.text = hint
		h.theme_type_variation = &"Caption"
		left.add_child(h)
	row.add_child(left)
	control.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(control)
	_column.add_child(row)
	var line := ColorRect.new()
	line.color = UiTheme.LINE
	line.custom_minimum_size = Vector2(0, 2)
	_column.add_child(line)

## a row of options, one lit (the theme's pressed look: white fill, dark text)
func _choices(opts: Array, current: String, pick: Callable) -> HBoxContainer:
	var box := HBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	for o in opts:
		var b := Button.new()
		b.text = String(o).to_upper()
		b.toggle_mode = true
		b.button_pressed = String(o) == current
		b.custom_minimum_size = Vector2(88, 40)
		b.pressed.connect(func():
			for other in box.get_children():
				(other as Button).button_pressed = other == b
			pick.call(String(o)))
		box.add_child(b)
	return box

func _toggle(on: bool, flip: Callable) -> CheckButton:
	var c := CheckButton.new()
	c.button_pressed = on
	c.toggled.connect(func(v: bool): flip.call(v))
	return c

func _slider(key: String, lo: float, hi: float, stp: float, s: Dictionary, fmt: Callable) -> HBoxContainer:
	var box := HBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	var sl := HSlider.new()
	sl.min_value = lo
	sl.max_value = hi
	sl.step = stp
	sl.value = float(s.get(key, Store.DEFAULTS[key]))
	sl.custom_minimum_size = Vector2(240, 32)
	var val := Label.new()
	val.custom_minimum_size = Vector2(44, 0)
	val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	val.add_theme_font_override("font", UiTheme.font(600, 0))
	val.text = fmt.call(sl.value)
	sl.value_changed.connect(func(v: float):
		Store.set_value(key, v)
		_apply_audio(key, v)
		val.text = fmt.call(v))
	box.add_child(sl)
	box.add_child(val)
	return box

func _apply_audio(key: String, v: float) -> void:
	var bus: String = { "master": "Master", "music": "Music", "sfx": "SFX", "voices": "Voices" }.get(key, "")
	var i := AudioServer.get_bus_index(bus)
	if i >= 0:
		AudioServer.set_bus_volume_db(i, linear_to_db(maxf(v, 0.001)))
