extends Control
## Destiny's "Increase reputation" card (owner Nov 18, interfaceingame.com Destiny 2): a ring that fills from the rep you
## had to the rep you have now round the rung's number, the ladder's name, the rung in wide caps, +N REP, how far to the
## next rung, and RANK UP with what it opens when a race takes you over a line. Fades after a few seconds; a tap closes it.
##   RankCard.make("STREET REPUTATION", tiers, rep_before, rep_now)  — tiers: [{name, rep, line}] as street_career.gd TIERS
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const RING := 64.0

var ladder := "STREET REPUTATION"
var tiers: Array = []
var before := 0
var now := 0
var _shown := 0.0   # the rep the ring shows (animated before → now)
var _ring: Control
var _rank_l: Label
var _name_l: Label
var _next_l: Label
var _bar: ColorRect
var _bar_w := 260.0

static func make(ladder_name: String, ladder_tiers: Array, rep_before: int, rep_now: int) -> Control:
	var c = load("res://scripts/ui/rank_card.gd").new()
	c.ladder = ladder_name
	c.tiers = ladder_tiers
	c.before = rep_before
	c.now = rep_now
	return c

func _tier(r: int) -> int:
	var t := 0
	for i in tiers.size():
		if r >= int(tiers[i].rep):
			t = i
	return t

func _frac(r: int) -> float:
	var t := _tier(r)
	if t >= tiers.size() - 1:
		return 1.0
	var lo := float(tiers[t].rep)
	var hi := float(tiers[t + 1].rep)
	return clampf((float(r) - lo) / maxf(hi - lo, 1.0), 0.0, 1.0)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	offset_left = -270
	offset_right = 270
	offset_top = 40
	offset_bottom = 230
	mouse_filter = Control.MOUSE_FILTER_STOP
	gui_input.connect(func(e: InputEvent):
		if (e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed) or (e is InputEventMouseButton and (e as InputEventMouseButton).pressed):
			_close())
	var panel := Panel.new()
	var sb := UiTheme.box(Color(0.03, 0.04, 0.055, 0.88), Color(0, 0, 0, 0), 0)
	sb.border_width_top = 2
	sb.border_color = UiTheme.GOLD
	panel.add_theme_stylebox_override("panel", sb)
	panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(panel)
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 22
	row.offset_right = -22
	row.add_theme_constant_override("separation", 22)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(row)
	_ring = Control.new()
	_ring.custom_minimum_size = Vector2(RING * 2 + 8, RING * 2 + 8)
	_ring.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ring.draw.connect(_draw_ring)
	row.add_child(_ring)
	_rank_l = _label(700, 0, 40, UiTheme.INK)
	_rank_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_rank_l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_rank_l.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ring.add_child(_rank_l)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 4)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(col)
	var up := _tier(now) > _tier(before)
	col.add_child(_label(600, 4, 12, UiTheme.GOLD if up else UiTheme.INK_DIM, "RANK UP  ·  " + ladder if up else ladder))
	_name_l = _label(700, 5, 28, UiTheme.INK)
	col.add_child(_name_l)
	var gain := _label(700, 1, 16, UiTheme.GOLD, "+%d REP" % (now - before))
	col.add_child(gain)
	var bar_row := Control.new()
	bar_row.custom_minimum_size = Vector2(_bar_w, 6)
	bar_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(bar_row)
	var back := ColorRect.new()
	back.color = Color(1, 1, 1, 0.14)
	back.size = Vector2(_bar_w, 3)
	back.position.y = 2
	bar_row.add_child(back)
	_bar = ColorRect.new()
	_bar.color = UiTheme.INK
	_bar.size = Vector2(0, 3)
	_bar.position.y = 2
	bar_row.add_child(_bar)
	_next_l = _label(500, 0, 13, UiTheme.INK_DIM)
	_next_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_next_l.custom_minimum_size.x = 300
	col.add_child(_next_l)
	_shown = float(before)
	_refresh()
	modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 1.0, 0.3)
	tw.tween_method(func(v: float):
		_shown = v
		_refresh(), float(before), float(now), 1.4).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_interval(4.0)
	tw.tween_callback(_close)

func _label(weight: int, spacing: int, px: int, col: Color, t := "") -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _refresh() -> void:
	var r := int(_shown)
	var t := _tier(r)
	_rank_l.text = str(t + 1)
	_name_l.text = String(tiers[t].name)
	_bar.size.x = _bar_w * _frac(r)
	if t >= tiers.size() - 1:
		_next_l.text = "%d rep  ·  the top of the ladder" % r
	else:
		_next_l.text = "%d / %d to %s  ·  %s" % [r, int(tiers[t + 1].rep), String(tiers[t + 1].name), String(tiers[t + 1].line).to_lower()]
	_ring.queue_redraw()

func _draw_ring() -> void:
	var c := Vector2(RING + 4, RING + 4)
	# a diamond frame (Destiny's ranks sit in a rotated square) round the progress ring
	var d := RING + 2.0
	_ring.draw_polyline(PackedVector2Array([c + Vector2(0, -d), c + Vector2(d, 0), c + Vector2(0, d), c + Vector2(-d, 0), c + Vector2(0, -d)]), Color(1, 1, 1, 0.18), 1.5, true)
	_ring.draw_arc(c, RING - 10.0, 0.0, TAU, 64, Color(1, 1, 1, 0.12), 5.0, true)
	var f := _frac(int(_shown))
	if f > 0.0:
		_ring.draw_arc(c, RING - 10.0, -PI * 0.5, -PI * 0.5 + TAU * f, 64, UiTheme.GOLD, 5.0, true)

func _close() -> void:
	if is_queued_for_deletion():
		return
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.4)
	tw.tween_callback(queue_free)
