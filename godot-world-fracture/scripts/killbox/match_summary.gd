extends Control
## The end of a match (owner Nov 18, interfaceingame.com: Valorant "Victory" / "Defeat" / "Scoreboard" / "MVP",
## Apex Legends "Match summary" / "Eliminated" / "Champion squad"). One screen for every PvP view:
##   the result word huge in its colour (gold for a win, red for a loss, white for a draw), the score and the mode under
##   it; the match MVP as a card; the scoreboard — each side's players with kills, deaths and K/D, you highlighted; your
##   own numbers as stat tiles; what it paid (Nex, XP, the drop); LEAVE.
##   var s := MatchSummary.new(); s.data = { … }; s.leave.connect(…); add_child(s)
## data: result, won (bool), draw (bool), score ("13 – 7"), sub ("Clash · Kaiju Complex"), teams ([{name, rows: [{name,
## k, d, you}]}], empty for none), stats ([[label, value], …]), nex, xp, loot (""), leave_text
signal leave

const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const WIN := Color(1.0, 0.82, 0.35)
const LOSS := Color(1.0, 0.36, 0.36)

var data: Dictionary = {}

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var won := bool(data.get("won", false))
	var draw := bool(data.get("draw", false))
	var col := WIN if won else (UiTheme.INK if draw else LOSS)
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.015, 0.03, 0.86)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# a band of the result's colour behind the word, fading out to the sides
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	g.colors = PackedColorArray([Color(col.r, col.g, col.b, 0.0), Color(col.r, col.g, col.b, 0.18), Color(col.r, col.g, col.b, 0.0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0.5)
	gt.fill_to = Vector2(1, 0.5)
	var band := TextureRect.new()
	band.texture = gt
	band.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	band.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	band.offset_top = 40
	band.offset_bottom = 170
	add_child(band)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(center)
	var col_v := VBoxContainer.new()
	col_v.add_theme_constant_override("separation", 10)
	col_v.custom_minimum_size.x = minf(980.0, get_viewport_rect().size.x - 40.0)
	center.add_child(col_v)
	_gap(col_v, 44)
	var word := _label(String(data.get("result", "VICTORY")), 700, 16, 64, col)
	word.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col_v.add_child(word)
	var score := _label(String(data.get("score", "")), 700, 4, 26, UiTheme.INK)
	score.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col_v.add_child(score)
	var sub := _label(String(data.get("sub", "")).to_upper(), 600, 4, 13, UiTheme.INK_DIM)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col_v.add_child(sub)
	_gap(col_v, 14)
	var teams: Array = data.get("teams", [])
	var mvp := _mvp(teams)
	if not mvp.is_empty():
		col_v.add_child(_mvp_card(mvp, col))
	# your numbers
	var stats: Array = data.get("stats", [])
	if not stats.is_empty():
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		for st in stats:
			row.add_child(_tile(String(st[0]), String(st[1])))
		col_v.add_child(row)
	# the scoreboard
	if not teams.is_empty():
		var board := HBoxContainer.new()
		board.add_theme_constant_override("separation", 14)
		col_v.add_child(board)
		for ti in teams.size():
			board.add_child(_team(teams[ti], WIN if (ti == 0) == won else Color(0.65, 0.72, 0.8)))
	# what it paid
	_gap(col_v, 6)
	var pay := HBoxContainer.new()
	pay.alignment = BoxContainer.ALIGNMENT_CENTER
	pay.add_theme_constant_override("separation", 24)
	pay.add_child(_label("◆ +%d NEX" % int(data.get("nex", 0)), 700, 2, 16, UiTheme.GOLD))
	pay.add_child(_label("+%d XP" % int(data.get("xp", 0)), 700, 2, 16, UiTheme.INK))
	if String(data.get("loot", "")) != "":
		pay.add_child(_label("ACQUIRED  ·  " + String(data.loot).to_upper(), 600, 2, 14, Color(0.8, 0.6, 1.0)))
	col_v.add_child(pay)
	_gap(col_v, 6)
	var b := Button.new()
	b.text = String(data.get("leave_text", "LEAVE"))
	b.custom_minimum_size = Vector2(300, 52)
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.add_theme_font_override("font", UiTheme.font(700, 3))
	b.pressed.connect(func(): leave.emit())
	col_v.add_child(b)
	_gap(col_v, 30)
	# in it comes: the word slides down and settles
	modulate.a = 0.0
	word.pivot_offset = Vector2(col_v.custom_minimum_size.x * 0.5, 40)
	word.scale = Vector2(1.25, 1.25)
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "modulate:a", 1.0, 0.35)
	tw.tween_property(word, "scale", Vector2.ONE, 0.6)

## the best line on the board: most kills, fewest deaths to break ties
static func _mvp(teams: Array) -> Dictionary:
	var best := {}
	for t in teams:
		for r in t.rows:
			if best.is_empty() or int(r.k) > int(best.k) or (int(r.k) == int(best.k) and int(r.d) < int(best.d)):
				best = r
	return best if not best.is_empty() and int(best.k) > 0 else {}

func _mvp_card(r: Dictionary, col: Color) -> Control:
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var sb := UiTheme.box(Color(col.r, col.g, col.b, 0.1), Color(col.r, col.g, col.b, 0.8), 1, Vector4(26, 10, 26, 12))
	sb.border_width_top = 3
	p.add_theme_stylebox_override("panel", sb)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	p.add_child(v)
	var cap := _label("MATCH MVP", 700, 6, 12, col)
	cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(cap)
	var you := bool(r.get("you", false))
	var nm := _label("YOU" if you else String(r.name).to_upper(), 700, 3, 24, UiTheme.INK)
	nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(nm)
	var line := _label("%d KILLS  ·  %d DEATHS" % [int(r.k), int(r.d)], 600, 2, 12, UiTheme.INK_DIM)
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(line)
	return p

func _team(t: Dictionary, col: Color) -> Control:
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 2)
	var head := HBoxContainer.new()
	var hn := _label(String(t.name).to_upper(), 700, 4, 13, col)
	hn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(hn)
	for h in ["K", "D", "K/D"]:
		var l := _label(h, 600, 2, 11, UiTheme.INK_DIM)
		l.custom_minimum_size.x = 44 if h != "K/D" else 52
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		head.add_child(l)
	v.add_child(head)
	var rule := ColorRect.new()
	rule.color = Color(col.r, col.g, col.b, 0.7)
	rule.custom_minimum_size.y = 2
	v.add_child(rule)
	var rows: Array = (t.rows as Array).duplicate()
	rows.sort_custom(func(a, b): return int(a.k) > int(b.k) or (int(a.k) == int(b.k) and int(a.d) < int(b.d)))
	for r in rows:
		var you := bool(r.get("you", false))
		var p := PanelContainer.new()
		p.add_theme_stylebox_override("panel", UiTheme.box(Color(1, 1, 1, 0.12) if you else Color(1, 1, 1, 0.035), Color(0, 0, 0, 0), 0, Vector4(10, 5, 10, 5)))
		var h := HBoxContainer.new()
		p.add_child(h)
		var n := _label(String(r.name).to_upper(), 700 if you else 500, 1, 14, UiTheme.INK if you else Color(0.93, 0.94, 0.95, 0.85))
		n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		n.clip_text = true
		h.add_child(n)
		var kd := float(r.k) / maxf(float(r.d), 1.0)
		for val in [str(int(r.k)), str(int(r.d)), "%.1f" % kd]:
			var l := _label(val, 600, 0, 14, UiTheme.INK)
			l.custom_minimum_size.x = 44 if val != "%.1f" % kd else 52
			l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			h.add_child(l)
		v.add_child(p)
	return v

func _tile(cap: String, value: String) -> Control:
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.add_theme_stylebox_override("panel", UiTheme.box(Color(1, 1, 1, 0.04), UiTheme.LINE, 1, Vector4(14, 8, 14, 10)))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	p.add_child(v)
	v.add_child(_label(cap, 600, 3, 11, UiTheme.INK_DIM))
	v.add_child(_label(value, 700, 0, 24, UiTheme.INK))
	return p

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _gap(parent: Control, h: float) -> void:
	var g := Control.new()
	g.custom_minimum_size = Vector2(0, h)
	parent.add_child(g)
