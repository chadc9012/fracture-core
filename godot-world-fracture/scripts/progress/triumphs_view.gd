extends Control
## Destiny's Triumphs and Collections (owner Nov 18, interfaceingame.com Destiny 2): one screen, two tabs.
##   TRIUMPHS     the score out of the most there is, then each category's triumphs as tiles — title, what it asks, a
##                progress bar and count, the score it gives; met ones in gold
##   COLLECTIONS  how much of everything you've found, then weapons (their picture, in their rarity's colour), armor
##                sets (pieces found), outfits and vehicles; not-yet-found ones dimmed with a lock
## Rules in triumphs.gd. Opens from the title's TRIUMPHS row; `closed` on BACK.

signal closed

const Triumphs := preload("res://scripts/progress/triumphs.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const COL_W := 1100.0

var tab := "triumphs"
var _body: VBoxContainer
var _tabs: Dictionary = {}
var _p: Dictionary
var _gear: Dictionary

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	position = Vector2.ZERO
	size = get_viewport_rect().size
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.045, 0.98)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 24
	bar.offset_right = -24
	bar.offset_top = 18
	bar.add_theme_constant_override("separation", 10)
	add_child(bar)
	var back := Button.new()
	back.text = "✕  BACK"
	back.custom_minimum_size = Vector2(110, 44)
	back.pressed.connect(func(): closed.emit())
	bar.add_child(back)
	var gap := Control.new()
	gap.custom_minimum_size.x = 14
	bar.add_child(gap)
	for t in ["triumphs", "collections"]:
		var b := Button.new()
		b.text = t.to_upper()
		b.flat = true
		b.custom_minimum_size = Vector2(150, 44)
		b.add_theme_font_override("font", UiTheme.font(700, 4))
		b.add_theme_font_size_override("font_size", 16)
		b.pressed.connect(func(): show_tab(t))
		bar.add_child(b)
		_tabs[t] = b
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
	_body = VBoxContainer.new()
	_body.add_theme_constant_override("separation", 8)
	_body.custom_minimum_size.x = minf(COL_W, size.x - 40.0)
	center.add_child(_body)
	_p = Gear.profile_load()
	_gear = Gear.load_save()
	Triumphs.check(_p)   # anything met since the last payment
	Gear.profile_save(_p)
	show_tab(tab)

func show_tab(t: String) -> void:
	tab = t
	for k in _tabs:
		(_tabs[k] as Button).add_theme_color_override("font_color", UiTheme.INK if k == t else UiTheme.INK_FAINT)
		(_tabs[k] as Button).add_theme_color_override("font_hover_color", UiTheme.INK)
	for c in _body.get_children():
		c.queue_free()
	if t == "triumphs":
		_triumphs()
	else:
		_collections()

func _cols() -> int:
	return clampi(int(_body.custom_minimum_size.x / 340.0), 1, 3)

func _triumphs() -> void:
	var st := Triumphs.stats(_p)
	var sc := Triumphs.score(_p)
	_gap(18)
	_headline("TRIUMPH SCORE", "%d" % sc, " / %d" % Triumphs.max_score(), float(sc) / float(Triumphs.max_score()))
	var done: Dictionary = _p.get("triumphs", {})
	for cat in Triumphs.CATS:
		var rows := Triumphs.TRIUMPHS.filter(func(x): return x.cat == cat)
		var met := rows.filter(func(x): return done.has(x.id)).size()
		_section(cat, "%d / %d" % [met, rows.size()])
		var grid := GridContainer.new()
		grid.columns = _cols()
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		_body.add_child(grid)
		for tr in rows:
			grid.add_child(_triumph_tile(tr, Triumphs.progress(_p, tr, st), done.has(tr.id)))
	_gap(40)

func _triumph_tile(t: Dictionary, have: int, met: bool) -> Control:
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.custom_minimum_size = Vector2(320, 104)
	var sb := UiTheme.box(Color(1, 1, 1, 0.07) if met else Color(1, 1, 1, 0.035), UiTheme.GOLD if met else UiTheme.LINE, 1, Vector4(14, 10, 14, 12))
	if met:
		sb.border_width_left = 4
	p.add_theme_stylebox_override("panel", sb)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	p.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	var name_l := _label(String(t.title).to_upper(), 700, 2, 14, UiTheme.GOLD if met else UiTheme.INK)
	name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(name_l)
	top.add_child(_label("◆ %d" % int(t.score), 700, 0, 13, UiTheme.GOLD if met else UiTheme.INK_FAINT))
	var d := _label(String(t.desc), 400, 0, 13, UiTheme.INK_DIM)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(d)
	var target := int(t.target)
	v.add_child(_bar(float(mini(have, target)) / float(target), UiTheme.GOLD if met else UiTheme.INK))
	var cnt := _label("COMPLETE" if met else "%s / %s" % [_n(mini(have, target)), _n(target)], 600, 1, 11, UiTheme.GOLD if met else UiTheme.INK_DIM)
	cnt.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.add_child(cnt)
	return p

func _collections() -> void:
	var c := Triumphs.collections(_p, _gear)
	Gear.profile_save(_p)
	_gap(18)
	_headline("COLLECTION", "%d" % int(c.found), " / %d found" % int(c.total), float(c.found) / maxf(float(c.total), 1.0))
	for s in c.sections:
		var got := (s.entries as Array).filter(func(e): return bool(e.found)).size()
		_section(String(s.name), "%d / %d" % [got, (s.entries as Array).size()])
		var grid := GridContainer.new()
		grid.columns = clampi(int(_body.custom_minimum_size.x / 210.0), 2, 6)
		grid.add_theme_constant_override("h_separation", 6)
		grid.add_theme_constant_override("v_separation", 6)
		_body.add_child(grid)
		for e in s.entries:
			grid.add_child(_entry(e))
	_gap(40)

func _entry(e: Dictionary) -> Control:
	var found := bool(e.found)
	var col := UiTheme.rarity_color(String(e.get("rarity", "common")))
	var p := PanelContainer.new()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p.custom_minimum_size = Vector2(200, 92)
	var sb := UiTheme.box(Color(col.r, col.g, col.b, 0.16) if found else Color(1, 1, 1, 0.025), Color(col.r, col.g, col.b, 0.7) if found else UiTheme.LINE, 1, Vector4(10, 8, 10, 8))
	if bool(e.get("complete", false)):
		sb.border_width_left = 4
		sb.border_color = UiTheme.GOLD
	p.add_theme_stylebox_override("panel", sb)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	p.add_child(v)
	var frame := String(e.get("frame", ""))
	var icon_path := "res://ui/icons/weapon-%s.png" % frame
	if frame != "" and ResourceLoader.exists(icon_path):
		var full: Texture2D = load(icon_path)
		var at := AtlasTexture.new()
		at.atlas = full
		var w := float(full.get_width())
		at.region = Rect2(0, w * 0.25, w, w * 0.5)
		var tr := TextureRect.new()
		tr.texture = at
		tr.custom_minimum_size = Vector2(0, 40)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.modulate = Color.WHITE if found else Color(0, 0, 0, 0.55)
		v.add_child(tr)
	var name_l := _label(String(e.name).to_upper() if found else "◇  " + String(e.name).to_upper(), 700, 1, 12, UiTheme.INK if found else UiTheme.INK_FAINT)
	name_l.clip_text = true
	v.add_child(name_l)
	v.add_child(_label(String(e.sub).to_upper(), 600, 1, 10, col if found else UiTheme.INK_FAINT))
	return p

func _headline(cap: String, big: String, rest: String, f: float) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 20)
	_body.add_child(row)
	var v := VBoxContainer.new()
	v.add_child(_label(cap, 600, 4, 12, UiTheme.GOLD))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	h.add_child(_label(big, 700, 0, 44, UiTheme.INK))
	var r := _label(rest, 600, 0, 18, UiTheme.INK_DIM)
	r.size_flags_vertical = Control.SIZE_SHRINK_END
	h.add_child(r)
	v.add_child(h)
	row.add_child(v)
	var bv := VBoxContainer.new()
	bv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bv.alignment = BoxContainer.ALIGNMENT_END
	bv.add_child(_bar(f, UiTheme.GOLD))
	bv.add_child(_label("%d%%" % int(round(f * 100.0)), 600, 1, 12, UiTheme.INK_DIM))
	row.add_child(bv)

func _section(t: String, right: String) -> void:
	_gap(16)
	var h := HBoxContainer.new()
	var l := Label.new()
	l.text = t
	l.theme_type_variation = &"HeaderSmall"
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(l)
	h.add_child(_label(right, 600, 1, 12, UiTheme.INK_DIM))
	_body.add_child(h)
	var line := ColorRect.new()
	line.color = UiTheme.LINE_HI * Color(1, 1, 1, 0.5)
	line.custom_minimum_size = Vector2(0, 2)
	_body.add_child(line)

func _label(t: String, weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _bar(f: float, col: Color) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, 5)
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	c.draw.connect(func():
		c.draw_rect(Rect2(0, 1, c.size.x, 3), Color(1, 1, 1, 0.12))
		c.draw_rect(Rect2(0, 1, c.size.x * clampf(f, 0.0, 1.0), 3), col))
	return c

func _gap(h: float) -> void:
	var g := Control.new()
	g.custom_minimum_size = Vector2(0, h)
	_body.add_child(g)

static func _n(v: int) -> String:
	var s := str(v)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out
