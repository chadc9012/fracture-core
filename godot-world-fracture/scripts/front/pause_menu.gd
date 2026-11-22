extends Control
## The pause menu (owner Nov 18, interfaceingame.com Titanfall 2 "Pause"), over whatever is being played: what you're
## in and the tracked objective across the top left, PAUSED in big slanted caps, the options down the left as large
## text rows with a bar beside the picked one, and your operator down the right — level and XP, Nex, the season tier,
## today's goals. main.gd opens it on Esc / pad Start, pauses the tree (not in an online match: it says the match goes
## on), and does what's picked. Runs while paused.
##   signals: resume, quit, open(what)  what: "journal" | "skills" | "season" | "settings"
signal resume
signal quit
signal open(what: String)

const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const ACCENT := Color(1.0, 0.55, 0.2)   # Titanfall's orange
const OPTIONS := [["RESUME", "resume"], ["JOURNAL", "journal"], ["SKILLS", "skills"], ["SEASON PASS", "season"], ["SETTINGS", "settings"], ["QUIT TO MENU", "quit"]]

var activity := ""
var objective := ""
var live := false
var _rows: Array[Button] = []
var _at := 0
var _confirm := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.color = Color(0.01, 0.015, 0.025, 0.78)
	add_child(dim)
	# a fade from the left, so the column reads over anything
	var grad := TextureRect.new()
	var g := Gradient.new()
	g.set_color(0, Color(0, 0, 0, 0.7))
	g.set_color(1, Color(0, 0, 0, 0))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_to = Vector2(1, 0)
	grad.texture = gt
	grad.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	grad.offset_right = 720
	grad.stretch_mode = TextureRect.STRETCH_SCALE
	grad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(grad)

	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	col.offset_left = 56
	col.offset_right = 56 + 560
	col.offset_top = 40
	col.offset_bottom = -40
	col.add_theme_constant_override("separation", 4)
	add_child(col)
	col.add_child(_label(activity.to_upper(), 700, 5, 14, ACCENT))
	if objective != "":
		var lines := objective.split("\n", true, 1)
		col.add_child(_label(String(lines[0]).to_upper(), 700, 3, 18, UiTheme.INK))
		if lines.size() > 1:
			var st := _label(String(lines[1]), 400, 0, 16, UiTheme.INK_DIM)
			st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			col.add_child(st)
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(sp)
	var big := _label("PAUSED", 900, 6, 72, UiTheme.INK)
	big.add_theme_font_override("font", _slant(UiTheme.font(900, 6)))
	col.add_child(big)
	if live:
		col.add_child(_label("ONLINE MATCH  ·  THE MATCH GOES ON", 700, 4, 13, Color(1.0, 0.4, 0.38)))
	var gap := Control.new()
	gap.custom_minimum_size.y = 14
	col.add_child(gap)
	for i in OPTIONS.size():
		var b := Button.new()
		b.text = String(OPTIONS[i][0])
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(420, 50)
		b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_override("font", UiTheme.font(800, 5))
		b.add_theme_font_size_override("font_size", 22)
		var empty := StyleBoxEmpty.new()
		empty.content_margin_left = 22
		for k in ["normal", "hover", "pressed", "focus"]:
			b.add_theme_stylebox_override(k, empty)
		var ii := i
		b.mouse_entered.connect(func(): _hover(ii))
		b.pressed.connect(func(): _do(ii))
		b.draw.connect(func(): _draw_row(b, ii))
		col.add_child(b)
		_rows.append(b)
	var sp2 := Control.new()
	sp2.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(sp2)
	col.add_child(_label("ESC  ·  RESUME        ↑ ↓  ·  ENTER", 600, 4, 12, UiTheme.INK_FAINT))

	# the operator, down the right
	var side := VBoxContainer.new()
	side.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	side.offset_left = -400
	side.offset_right = -56
	side.offset_top = 40
	side.offset_bottom = -40
	side.alignment = BoxContainer.ALIGNMENT_CENTER
	side.add_theme_constant_override("separation", 6)
	add_child(side)
	var p := Gear.profile_load()
	var lv := Progression.level_for(int(p.get("xp", 0)))
	var xb := Progression.xp_bar(p)
	side.add_child(_label("OPERATOR", 700, 5, 12, UiTheme.INK_DIM))
	side.add_child(_label("LEVEL %d" % lv, 800, 4, 30, UiTheme.INK))
	side.add_child(_bar(float(xb.x) / maxf(1.0, float(xb.y)), ACCENT))
	side.add_child(_label("%d / %d XP" % [xb.x, xb.y], 600, 2, 13, UiTheme.INK_DIM))
	side.add_child(_rule())
	side.add_child(_stat("NEX", _comma(int(p.get("nex", 0))), UiTheme.GOLD))
	var Season = load("res://scripts/progress/season_pass.gd")
	side.add_child(_stat("SEASON %d" % int(Season.current().id), "TIER %d / %d" % [Season.tier(p), Season.TIERS], Color(1.0, 0.3, 0.3)))
	side.add_child(_rule())
	side.add_child(_label("TODAY'S GOALS", 700, 5, 12, UiTheme.INK_DIM))
	for gl in Progression.daily(p):
		var done := bool(gl.done)
		var l := _label(("✓  " if done else "○  ") + String(gl.label), 500, 0, 15, UiTheme.INK_DIM if done else UiTheme.INK)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		side.add_child(l)
	_hover(0)
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.15)

func _unhandled_input(e: InputEvent) -> void:
	if not visible:
		return
	var k := -1
	if e is InputEventKey and (e as InputEventKey).pressed and not (e as InputEventKey).echo:
		k = (e as InputEventKey).keycode
	elif e is InputEventJoypadButton and (e as InputEventJoypadButton).pressed:
		k = { JOY_BUTTON_START: KEY_ESCAPE, JOY_BUTTON_B: KEY_ESCAPE, JOY_BUTTON_A: KEY_ENTER, JOY_BUTTON_DPAD_UP: KEY_UP, JOY_BUTTON_DPAD_DOWN: KEY_DOWN }.get((e as InputEventJoypadButton).button_index, -1)
	match k:
		KEY_ESCAPE:
			resume.emit()
		KEY_UP:
			_hover(wrapi(_at - 1, 0, _rows.size()))
		KEY_DOWN:
			_hover(wrapi(_at + 1, 0, _rows.size()))
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE:
			_do(_at)
		_:
			return
	get_viewport().set_input_as_handled()

func _hover(i: int) -> void:
	_at = i
	if _confirm and String(OPTIONS[i][1]) != "quit":
		_confirm = false
		_rows[_rows.size() - 1].text = "QUIT TO MENU"
	for j in _rows.size():
		_rows[j].add_theme_color_override("font_color", UiTheme.INK if j == i else UiTheme.INK_DIM)
		_rows[j].add_theme_color_override("font_hover_color", UiTheme.INK)
		_rows[j].queue_redraw()

func _do(i: int) -> void:
	var what := String(OPTIONS[i][1])
	match what:
		"resume":
			resume.emit()
		"quit":
			# asks once: progress since the last checkpoint may not keep
			if not _confirm:
				_confirm = true
				_rows[i].text = "QUIT?  PRESS AGAIN"
				_hover(i)
				return
			quit.emit()
		_:
			open.emit(what)

func _draw_row(b: Button, i: int) -> void:
	if i != _at:
		return
	b.draw_rect(Rect2(0, 8, 6, b.size.y - 16), ACCENT)
	b.draw_rect(Rect2(6, 8, b.size.x - 6, b.size.y - 16), Color(1, 1, 1, 0.06))

func _stat(what: String, value: String, c: Color) -> HBoxContainer:
	var h := HBoxContainer.new()
	var a := _label(what, 700, 4, 13, UiTheme.INK_DIM)
	a.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(a)
	h.add_child(_label(value, 800, 2, 20, c))
	return h

func _bar(frac: float, c: Color) -> ColorRect:
	var back := ColorRect.new()
	back.custom_minimum_size = Vector2(0, 6)
	back.color = Color(1, 1, 1, 0.12)
	var fill := ColorRect.new()
	fill.color = c
	fill.anchor_right = clampf(frac, 0.0, 1.0)
	fill.anchor_bottom = 1.0
	back.add_child(fill)
	return back

func _rule() -> ColorRect:
	var r := ColorRect.new()
	r.custom_minimum_size = Vector2(0, 1)
	r.color = UiTheme.LINE
	return r

static func _comma(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out

static func _slant(f: Font) -> Font:
	var fv := FontVariation.new()
	fv.base_font = f
	fv.variation_transform = Transform2D(Vector2(1, 0), Vector2(0.2, 1), Vector2.ZERO)
	return fv

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
