extends RefCounted
## Need for Speed Heat's race screens (owner Nov 18, interfaceingame.com NFS Heat "Race Intro", "Race Start",
## "Cops Busted Sequence"), for the street races (street_life.gd):
##   intro(ev, km, names)   the event's card down the left while the grid counts down — the kind and whether it's legal,
##                          the name in wide caps, distance / laps, the heat it starts at, the prize for first, the rivals
##   Countdown              3 · 2 · 1 popping in the middle, each in a thin ring, then GO in gold
##   pursuit(won, title, line)  a band across the screen: ESCAPED (green) or BUSTED (red), with what it cost or paid
## Each returns a Control the caller adds to its HUD; they free themselves.
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const ILLEGAL := Color(1.0, 0.32, 0.4)
const LEGAL := Color(0.4, 0.85, 1.0)
const ESCAPE := Color(0.35, 1.0, 0.6)

static func _label(t: String, weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
	l.add_theme_constant_override("outline_size", 6)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

static func _comma(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out

## the race intro: holds `hold` seconds, then slides out left
static func intro(ev: Dictionary, km: float, rivals: Array, hold := 3.2) -> Control:
	var legal := bool(ev.get("legal", false))
	var accent := LEGAL if legal else ILLEGAL
	var root := PanelContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
	root.offset_left = 24
	root.offset_top = -150
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sb := UiTheme.box(Color(0.02, 0.025, 0.04, 0.82), Color(0, 0, 0, 0), 0, Vector4(22, 16, 26, 18))
	sb.border_width_left = 4
	sb.border_color = accent
	root.add_theme_stylebox_override("panel", sb)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(v)
	var kind := String(ev.get("kind", "sprint")).to_upper()
	v.add_child(_label("%s  ·  %s" % [kind, "SANCTIONED" if legal else "ILLEGAL"], 700, 5, 13, accent))
	v.add_child(_label(String(ev.get("name", "Street Race")).to_upper(), 700, 4, 34, UiTheme.INK))
	var facts: Array = ["%.1f KM" % km]
	if int(ev.get("laps", 0)) > 1:
		facts.append("%d LAPS" % int(ev.laps))
	if not legal and int(ev.get("heat", 0)) > 0:
		facts.append("HEAT %d" % int(ev.heat))
	v.add_child(_label("   ·   ".join(PackedStringArray(facts)), 600, 3, 14, UiTheme.INK_DIM))
	var rule := ColorRect.new()
	rule.color = Color(accent.r, accent.g, accent.b, 0.6)
	rule.custom_minimum_size = Vector2(260, 2)
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(rule)
	var prize: Array = ev.get("prize", [])
	if not prize.is_empty():
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 18)
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_child(_label("1ST  ◆ %s NEX" % _comma(int(prize[0])), 700, 2, 16, UiTheme.GOLD))
		var reps: Array = ev.get("rep", [])
		if not reps.is_empty():
			h.add_child(_label("+%d REP" % int(reps[0]), 700, 2, 16, UiTheme.INK))
		v.add_child(h)
	if not rivals.is_empty():
		v.add_child(_label("VS  " + "  ·  ".join(PackedStringArray(rivals.map(func(r): return String(r).to_upper()))), 600, 2, 13, UiTheme.INK))
	root.modulate.a = 0.0
	var tw := root.create_tween()
	tw.tween_property(root, "modulate:a", 1.0, 0.25)
	tw.parallel().tween_property(root, "offset_left", 24.0, 0.35).from(-30.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_interval(hold)
	tw.tween_property(root, "modulate:a", 0.0, 0.35)
	tw.parallel().tween_property(root, "offset_left", -60.0, 0.35)
	tw.tween_callback(root.queue_free)
	return root

## the start lights: call show(n) with the whole seconds left (3, 2, 1, 0 = GO); it pops on each change
class Countdown extends Control:
	var _shown := -1
	var _word: Label
	var _ring := 0.0
	var _go := false
	func _init() -> void:
		set_anchors_and_offsets_preset(Control.PRESET_CENTER)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		_word = Label.new()
		_word.add_theme_font_override("font", UiTheme.font(700, 0))
		_word.add_theme_font_size_override("font_size", 96)
		_word.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
		_word.add_theme_constant_override("outline_size", 10)
		_word.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_word.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_word.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		_word.position = Vector2(-160, -140)
		_word.size = Vector2(320, 160)
		_word.pivot_offset = Vector2(160, 80)
		add_child(_word)
	func show_count(n: int) -> void:
		if n == _shown:
			return
		_shown = n
		_go = n <= 0
		_word.text = "GO" if _go else str(n)
		_word.add_theme_color_override("font_color", UiTheme.GOLD if _go else UiTheme.INK)
		_word.add_theme_font_override("font", UiTheme.font(700, 12 if _go else 0))
		_word.scale = Vector2(1.6, 1.6)
		_word.modulate.a = 1.0
		_ring = 0.0
		var tw := create_tween().set_parallel(true)
		tw.tween_property(_word, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_method(func(v: float):
			_ring = v
			queue_redraw(), 0.0, 1.0, 0.9)
		if _go:
			tw.chain().tween_property(_word, "modulate:a", 0.0, 0.4).set_delay(0.5)
			tw.chain().tween_callback(queue_free)
	func _draw() -> void:
		if _shown < 0:
			return
		var c := Vector2(0, -60)
		var col := UiTheme.GOLD if _go else UiTheme.INK
		draw_arc(c, 92.0, 0.0, TAU, 72, Color(col.r, col.g, col.b, 0.12), 3.0, true)
		draw_arc(c, 92.0, -PI * 0.5, -PI * 0.5 + TAU * (1.0 - _ring), 72, Color(col.r, col.g, col.b, 0.85), 3.0, true)

## ESCAPED / BUSTED: a band across the middle with the word and what came of it
static func pursuit(escaped: bool, line: String, hold := 3.4) -> Control:
	var col := ESCAPE if escaped else ILLEGAL
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_HCENTER_WIDE)
	root.offset_top = -120
	root.offset_bottom = 10
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	g.colors = PackedColorArray([Color(0, 0, 0, 0), Color(0.02, 0.02, 0.03, 0.85), Color(0, 0, 0, 0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_to = Vector2(1, 0)
	var band := TextureRect.new()
	band.texture = gt
	band.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	band.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(band)
	for y in [0.0, 1.0]:
		var r := ColorRect.new()
		r.color = Color(col.r, col.g, col.b, 0.7)
		r.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE if y == 0.0 else Control.PRESET_BOTTOM_WIDE)
		r.offset_left = 120
		r.offset_right = -120
		if y == 0.0:
			r.offset_bottom = 2
		else:
			r.offset_top = -2
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(r)
	var v := VBoxContainer.new()
	v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(v)
	var w := _label("ESCAPED" if escaped else "BUSTED", 700, 18, 58, col)
	w.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(w)
	var l := _label(line.to_upper(), 600, 4, 15, UiTheme.INK)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	root.modulate.a = 0.0
	w.pivot_offset = Vector2(0, 30)
	var tw := root.create_tween()
	tw.tween_property(root, "modulate:a", 1.0, 0.2)
	tw.tween_interval(hold)
	tw.tween_property(root, "modulate:a", 0.0, 0.5)
	tw.tween_callback(root.queue_free)
	return root
