extends Control
## The operator panel (schedule step 10): what the one profile holds — level and the XP bar, Nex, the operator's power
## and hull, today's three goals with progress, and the last payments (progression.gd's ledger). Opens from the title's
## OPERATOR button and the street's OPERATOR button; read-only, `closed` on BACK.
## Laid out as Destiny's (owner Nov 18, interfaceingame.com Destiny 2): a top bar, the level in a diamond beside the XP
## bar, stat tiles, today's goals as pursuits with progress bars, recent earnings as a ledger.

signal closed

const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const COL_W := 720.0

var _col: VBoxContainer

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# the host may not be laid out yet (the globe scene sizes itself): take the window's size outright
	position = Vector2.ZERO
	size = get_viewport_rect().size
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.045, 0.97)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 24
	bar.offset_top = 18
	bar.add_theme_constant_override("separation", 18)
	add_child(bar)
	var back := Button.new()
	back.text = "✕  BACK"
	back.custom_minimum_size = Vector2(110, 44)
	back.pressed.connect(func(): closed.emit())
	bar.add_child(back)
	var title := Label.new()
	title.text = "OPERATOR"
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
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_top = 80
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(center)
	_col = VBoxContainer.new()
	_col.add_theme_constant_override("separation", 8)
	_col.custom_minimum_size.x = minf(COL_W, size.x - 40.0)
	center.add_child(_col)

	var p := Gear.profile_load()
	var gear := Gear.load_save()
	var level := Progression.level_for(int(p.get("xp", 0)))
	var xpbar := Progression.xp_bar(p)
	_gap(22)
	# the level in a diamond, the XP bar beside it
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 22)
	_col.add_child(head)
	var dia := Control.new()
	dia.custom_minimum_size = Vector2(96, 96)
	dia.draw.connect(func():
		var c := Vector2(48, 48)
		var pts := PackedVector2Array([c + Vector2(0, -44), c + Vector2(44, 0), c + Vector2(0, 44), c + Vector2(-44, 0)])
		dia.draw_colored_polygon(pts, Color(1, 1, 1, 0.05))
		pts.append(pts[0])
		dia.draw_polyline(pts, UiTheme.GOLD, 2.0, true))
	head.add_child(dia)
	var lv := _label(str(level), 700, 0, 36, UiTheme.INK)
	lv.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	lv.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lv.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	dia.add_child(lv)
	var hv := VBoxContainer.new()
	hv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hv.alignment = BoxContainer.ALIGNMENT_CENTER
	hv.add_theme_constant_override("separation", 6)
	head.add_child(hv)
	hv.add_child(_label("LEVEL %d" % level, 600, 4, 13, UiTheme.GOLD))
	hv.add_child(_label(Progression.line(p), 600, 1, 20, UiTheme.INK))
	hv.add_child(_bar(float(xpbar.x) / maxf(float(xpbar.y), 1.0), UiTheme.INK, 6))
	hv.add_child(_label("%d / %d XP to level %d" % [xpbar.x, xpbar.y, level + 1], 500, 0, 13, UiTheme.INK_DIM))
	# stat tiles
	var tiles := HBoxContainer.new()
	tiles.add_theme_constant_override("separation", 8)
	_col.add_child(tiles)
	tiles.add_child(_tile("POWER", str(int(Gear.operator_power(gear, level)))))
	tiles.add_child(_tile("ARMOR HULL", "+%d" % int(Gear.hull_bonus(gear))))
	tiles.add_child(_tile("LEVEL HULL", "+%d" % int(Progression.hull_bonus(p))))
	tiles.add_child(_tile("NEX", _thousands(int(p.get("nex", 0)))))
	var titles: Array = p.get("titles", [])
	if not titles.is_empty():
		_col.add_child(_label("TITLES   " + "   ·   ".join(PackedStringArray(titles)).to_upper(), 600, 2, 13, UiTheme.GOLD))

	_section("TODAY'S PURSUITS")
	for g in Progression.daily(p):
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		row.custom_minimum_size.y = 58
		var mark := _label("◆" if bool(g.done) else "◇", 600, 0, 18, UiTheme.GOLD if bool(g.done) else UiTheme.INK_DIM)
		mark.custom_minimum_size.x = 22
		row.add_child(mark)
		var v := VBoxContainer.new()
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		v.alignment = BoxContainer.ALIGNMENT_CENTER
		v.add_theme_constant_override("separation", 4)
		var name_l := _label(String(g.label), 500, 0, 16, UiTheme.INK)
		name_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(name_l)
		v.add_child(_bar(float(g.progress) / maxf(float(g.target), 1.0), UiTheme.GOLD if bool(g.done) else UiTheme.INK, 3))
		row.add_child(v)
		var right := VBoxContainer.new()
		right.alignment = BoxContainer.ALIGNMENT_CENTER
		var cnt := _label("%d / %d" % [int(g.progress), int(g.target)], 600, 0, 14, UiTheme.INK)
		cnt.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		right.add_child(cnt)
		var pay := _label("+%d NEX" % int(g.nex), 600, 1, 12, UiTheme.GOLD)
		pay.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		right.add_child(pay)
		row.add_child(right)
		_col.add_child(row)
		_line()
	Gear.profile_save(p)   # daily() may have turned the day

	_section("RECENT")
	var ledger: Array = p.get("ledger", [])
	if ledger.is_empty():
		_col.add_child(_label("Nothing earned yet — every mode pays into this profile.", 400, 0, 14, UiTheme.INK_DIM))
	for e in ledger.slice(0, 10):
		var row := HBoxContainer.new()
		row.custom_minimum_size.y = 40
		var what := String(e.get("note", e.source)) if String(e.get("note", "")) != "" else String(e.source).capitalize()
		var l := _label(what, 500, 0, 15, UiTheme.INK)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.clip_text = true
		row.add_child(l)
		row.add_child(_label("+%d NEX   +%d XP" % [int(e.nex), int(e.xp)], 600, 1, 13, UiTheme.INK_DIM))
		_col.add_child(row)
		_line()
	_gap(40)

func _label(t: String, weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	return l

func _bar(f: float, col: Color, h: int) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h + 2)
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	c.draw.connect(func():
		c.draw_rect(Rect2(0, 1, c.size.x, h), Color(1, 1, 1, 0.12))
		c.draw_rect(Rect2(0, 1, c.size.x * clampf(f, 0.0, 1.0), h), col))
	return c

func _tile(cap: String, value: String) -> Control:
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.add_theme_stylebox_override("panel", UiTheme.box(Color(1, 1, 1, 0.04), UiTheme.LINE, 1, Vector4(14, 10, 14, 12)))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	p.add_child(v)
	v.add_child(_label(cap, 600, 3, 11, UiTheme.INK_DIM))
	v.add_child(_label(value, 700, 0, 24, UiTheme.INK))
	return p

func _section(t: String) -> void:
	_gap(18)
	var l := Label.new()
	l.text = t
	l.theme_type_variation = &"HeaderSmall"
	_col.add_child(l)
	var line := ColorRect.new()
	line.color = UiTheme.LINE_HI * Color(1, 1, 1, 0.5)
	line.custom_minimum_size = Vector2(0, 2)
	_col.add_child(line)

func _line() -> void:
	var line := ColorRect.new()
	line.color = UiTheme.LINE
	line.custom_minimum_size = Vector2(0, 1)
	_col.add_child(line)

func _gap(h: float) -> void:
	var g := Control.new()
	g.custom_minimum_size = Vector2(0, h)
	_col.add_child(g)

static func _thousands(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out
