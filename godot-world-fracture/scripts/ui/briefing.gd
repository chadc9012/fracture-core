extends Control
## Helldivers' mission briefing (owner Nov 18, interfaceingame.com Helldivers "Mission briefing" / "Mission"): before
## the drop — the place's art on the left with the region named, then the operation's code and title, the briefing
## text, MISSION OBJECTIVES (each with its marker), what's waiting there, the reward, and DEPLOY. `deploy` on the
## button (or Enter / pad ✕); the story view shows it over the world when it opens.
##   var b := Briefing.new(); b.data = {code, title, place, art, text, objectives: [..], threats: [..], reward}
signal deploy

const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const ACCENT := Color(1.0, 0.82, 0.3)   # Helldivers' super-earth yellow, close to our gold

var data: Dictionary = {}

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.color = Color(0.015, 0.02, 0.03, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 28
	# the briefing column stays a readable width; the space beyond it stays dark
	var vw := get_viewport_rect().size.x
	row.offset_right = -maxf(28.0, vw - 28.0 - minf(560.0, vw * 0.42) - 28.0 - 760.0)
	row.offset_top = 24
	row.offset_bottom = -24
	row.add_theme_constant_override("separation", 28)
	add_child(row)
	var upright := get_viewport_rect().size.y > get_viewport_rect().size.x
	# the place, framed like a recon picture
	var pic := PanelContainer.new()
	pic.custom_minimum_size.x = 0.0 if upright else minf(560.0, get_viewport_rect().size.x * 0.42)
	pic.visible = not upright
	pic.add_theme_stylebox_override("panel", UiTheme.box(Color(0, 0, 0, 0.4), Color(ACCENT.r, ACCENT.g, ACCENT.b, 0.5), 1, Vector4(0, 0, 0, 0)))
	row.add_child(pic)
	var art_path := "res://ui/art/%s.jpg" % String(data.get("art", "load-fracture"))
	if ResourceLoader.exists(art_path):
		var tr := TextureRect.new()
		tr.texture = load(art_path)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		tr.modulate = Color(0.85, 0.85, 0.9)
		pic.add_child(tr)
		var tag := _label("REGION  ·  " + String(data.get("place", "")).to_upper(), 700, 4, 14, ACCENT)
		tag.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		tag.add_theme_constant_override("outline_size", 8)
		tag.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
		tag.offset_left = 16
		tag.offset_top = -40
		tr.add_child(tag)
	# the briefing
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 8)
	row.add_child(col)
	col.add_child(_label("MISSION BRIEFING  ·  " + String(data.get("code", "")).to_upper(), 700, 5, 13, ACCENT))
	var t := _label(String(data.get("title", "")).to_upper(), 700, 5, 40, UiTheme.INK)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(t)
	var rule := ColorRect.new()
	rule.color = ACCENT
	rule.custom_minimum_size = Vector2(140, 3)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	col.add_child(rule)
	var txt := _label(String(data.get("text", "")), 400, 0, 20, Color(0.93, 0.94, 0.95, 0.9))
	txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(txt)
	_section(col, "MISSION OBJECTIVES")
	var objs: Array = data.get("objectives", [])
	for i in objs.size():
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 12)
		var num := _label("%02d" % (i + 1), 700, 0, 18, ACCENT)
		h.add_child(num)
		var o := _label(String(objs[i]), 600, 1, 19, UiTheme.INK)
		o.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		o.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(o)
		col.add_child(h)
	var threats: Array = data.get("threats", [])
	if not threats.is_empty():
		_section(col, "EXPECTED RESISTANCE")
		col.add_child(_label("   ·   ".join(PackedStringArray(threats)).to_upper(), 600, 2, 16, Color(1.0, 0.5, 0.45)))
	if String(data.get("reward", "")) != "":
		_section(col, "REWARD")
		col.add_child(_label(String(data.reward).to_upper(), 700, 2, 18, UiTheme.GOLD))
	var gap := Control.new()
	gap.custom_minimum_size.y = 10
	col.add_child(gap)
	var b := Button.new()
	b.text = "DEPLOY"
	b.custom_minimum_size = Vector2(260, 56)
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	b.add_theme_font_override("font", UiTheme.font(700, 8))
	b.add_theme_font_size_override("font_size", 18)
	var y := UiTheme.box(ACCENT, ACCENT, 1, Vector4(16, 8, 16, 8))
	var y2 := UiTheme.box(ACCENT.lightened(0.2), ACCENT, 1, Vector4(16, 8, 16, 8))
	b.add_theme_stylebox_override("normal", y)
	b.add_theme_stylebox_override("hover", y2)
	b.add_theme_stylebox_override("focus", y2)
	b.add_theme_stylebox_override("pressed", y2)
	for k in ["font_color", "font_hover_color", "font_focus_color", "font_pressed_color"]:
		b.add_theme_color_override(k, Color(0.05, 0.05, 0.06))
	b.pressed.connect(_go)
	col.add_child(b)
	b.grab_focus.call_deferred()
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.3)

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and (e as InputEventKey).pressed and (e as InputEventKey).keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
		get_viewport().set_input_as_handled()
		_go()

func _go() -> void:
	if is_queued_for_deletion():
		return
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	deploy.emit()
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.3)
	tw.tween_callback(queue_free)

func _section(col: VBoxContainer, t: String) -> void:
	var g := Control.new()
	g.custom_minimum_size.y = 6
	col.add_child(g)
	col.add_child(_label(t, 700, 4, 13, UiTheme.INK_DIM))
	var r := ColorRect.new()
	r.color = UiTheme.LINE
	r.custom_minimum_size.y = 1
	col.add_child(r)

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
