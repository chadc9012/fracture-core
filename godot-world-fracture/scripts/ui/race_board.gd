extends Control
## The Crew Motorfest's event leaderboard (owner Nov 18, interfaceingame.com The Crew Motorfest "Leaderboard"), shown
## when a street race ends (street_life.gd): down the left the event, your placing in big slanted caps, your time (or
## drift score), PERSONAL BEST when you beat yours and what you beat, and what it paid; on the right the board — rank,
## driver, time, gap to the leader — with your row lit in the festival's pink. Holds HOLD seconds (or until ENTER /
## a tap), fades, and emits `closed`.
##   var b := RaceBoard.new(); b.data = {event, kind, place, rows: [{name, value, you}], value, pb, prev, nex, rep}
## rows() builds the board for a run: the crew who raced you, then the meet's regulars around the event's pace.
signal closed

const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const PINK := Color(1.0, 0.28, 0.55)
const HOLD := 8.0
const ORDINAL := ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH"]
## the meet's regulars, filling the board out past the crew you raced
const REGULARS := ["Tidewater", "Kaimana", "Lowrider_77", "Saffron", "Halo-9", "Brakeless", "M. Reyes", "Crosswind"]

var data: Dictionary = {}
var _t := 0.0

## the board for one run, best first: the rivals the event names, then the meet's regulars, and you. The first three
## sit exactly on the marks that decide your placing (the pace and +6% / +12% of it, street_life._clock_place; a drift
## battle's targets), so where you land on the board is the placing you were paid for; the rest trail behind (seeded
## by the event, so a board reads the same every time). `value` is your time or score. Up to 8 rows, you always on it.
static func rows(ev_id: String, ev: Dictionary, value: float, par: float) -> Array:
	var drift := String(ev.get("kind", "")) == "drift"
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(ev_id if ev_id != "" else String(ev.get("name", "")))
	var names: Array = (ev.get("rivals", []) as Array).duplicate()
	for n in REGULARS:
		if names.size() >= 7:
			break
		if not names.has(n):
			names.append(n)
	var marks: Array = (ev.get("targets", [9000, 6000, 3500]) as Array) if drift else [par, par * 1.06, par * 1.12]
	var out: Array = []
	for i in names.size():
		var v := 0.0
		if i < marks.size():
			v = float(marks[i])
		elif drift:
			v = round(float(marks[-1]) * (1.0 - (i - marks.size() + 1) * 0.16 - rng.randf_range(0.0, 0.05)))
		else:
			v = float(marks[-1]) * (1.0 + (i - marks.size() + 1) * 0.04 + rng.randf_range(0.0, 0.02))
		out.append({ "name": String(names[i]), "value": v, "you": false })
	# you go ahead of anyone you tie, as the placing does
	var at := 0
	while at < out.size() and (float(out[at].value) > value if drift else float(out[at].value) < value):
		at += 1
	out.insert(at, { "name": "YOU", "value": value, "you": true })
	for i in out.size():
		out[i].rank = i + 1
	if at < 8:
		return out.slice(0, 8)
	return out.slice(0, 7) + [out[at]]

## the board an online race ends on: the players in it by the order they crossed, their times where known
static func crew_rows(order: Array, times: Dictionary) -> Array:
	var out: Array = []
	for n in order:
		out.append({ "name": String(n), "value": float(times.get(n, -1.0)), "you": String(n) == "You", "rank": out.size() + 1 })
	return out

static func fmt(t: float) -> String:
	return "%d:%06.3f" % [int(t / 60.0), fmod(t, 60.0)]

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var drift := String(data.get("kind", "")) == "drift"
	var place := int(data.get("place", 1))
	var shade := ColorRect.new()
	shade.color = Color(0.01, 0.015, 0.03, 0.72)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	var vw := get_viewport_rect().size.x
	var upright := get_viewport_rect().size.y > vw
	var row := BoxContainer.new()
	row.vertical = upright
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var side := maxf(28.0, (vw - 1280.0) * 0.5)
	row.offset_left = side
	row.offset_right = -side
	row.offset_top = 36
	row.offset_bottom = -36
	row.add_theme_constant_override("separation", 40)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(row)

	# your result
	var left := VBoxContainer.new()
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left.alignment = BoxContainer.ALIGNMENT_CENTER
	left.add_theme_constant_override("separation", 6)
	row.add_child(left)
	left.add_child(_label("EVENT COMPLETE", 700, 5, 13, PINK))
	var ev := _label(String(data.get("event", "")).to_upper(), 800, 3, 30, UiTheme.INK)
	ev.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	left.add_child(ev)
	var big := _label(ORDINAL[clampi(place - 1, 0, ORDINAL.size() - 1)], 900, 2, 112, UiTheme.GOLD if place == 1 else UiTheme.INK)
	big.add_theme_font_override("font", _slant(UiTheme.font(900, 2)))
	left.add_child(big)
	var val := float(data.get("value", -1.0))
	if val >= 0.0:
		left.add_child(_label(("%s PTS" % _comma(int(val))) if drift else fmt(val), 700, 2, 34, UiTheme.INK))
	if bool(data.get("pb", false)):
		var tag := PanelContainer.new()
		tag.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		tag.add_theme_stylebox_override("panel", UiTheme.box(PINK, PINK, 1, Vector4(12, 4, 12, 4)))
		tag.add_child(_label("NEW PERSONAL BEST", 800, 4, 14, Color(1, 1, 1)))
		left.add_child(tag)
		var prev := float(data.get("prev", -1.0))
		if prev >= 0.0:
			var d := absf(val - prev)
			left.add_child(_label(("previous %s pts  ·  +%s" % [_comma(int(prev)), _comma(int(d))]) if drift else ("previous %s  ·  −%.3fs" % [fmt(prev), d]), 500, 1, 15, UiTheme.INK_DIM))
	elif float(data.get("prev", -1.0)) >= 0.0:
		var prev := float(data.prev)
		left.add_child(_label("PERSONAL BEST  " + (("%s pts" % _comma(int(prev))) if drift else fmt(prev)), 600, 3, 15, UiTheme.INK_DIM))
	var gap := Control.new()
	gap.custom_minimum_size.y = 14
	left.add_child(gap)
	left.add_child(_section("REWARDS"))
	var pay := HBoxContainer.new()
	pay.add_theme_constant_override("separation", 26)
	pay.add_child(_reward("NEX", "+" + _comma(int(data.get("nex", 0))), UiTheme.GOLD))
	pay.add_child(_reward("REPUTATION", "+" + _comma(int(data.get("rep", 0))), PINK))
	pay.add_child(_reward("XP", "+" + _comma(int(data.get("xp", 0))), Color(0.5, 0.85, 1.0)))
	left.add_child(pay)

	# the board
	var board := PanelContainer.new()
	board.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	board.size_flags_stretch_ratio = 1.25
	board.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	board.add_theme_stylebox_override("panel", UiTheme.box(Color(0.03, 0.04, 0.07, 0.86), UiTheme.LINE, 1, Vector4(0, 0, 0, 10)))
	row.add_child(board)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 2)
	board.add_child(col)
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", UiTheme.box(Color(1, 1, 1, 0.04), Color(0, 0, 0, 0), 0, Vector4(20, 12, 20, 12)))
	var hh := HBoxContainer.new()
	var ht := _label("LEADERBOARD", 800, 5, 16, UiTheme.INK)
	ht.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hh.add_child(ht)
	hh.add_child(_label("SCORE" if drift else "TIME", 700, 4, 12, UiTheme.INK_DIM))
	var gh := _label("GAP", 700, 4, 12, UiTheme.INK_DIM)
	gh.custom_minimum_size.x = 96
	gh.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hh.add_child(gh)
	head.add_child(hh)
	col.add_child(head)
	var rws: Array = data.get("rows", [])
	var lead := float(rws[0].value) if not rws.is_empty() else 0.0
	for i in rws.size():
		var r: Dictionary = rws[i]
		var you := bool(r.get("you", false))
		var line := PanelContainer.new()
		line.add_theme_stylebox_override("panel", UiTheme.box(PINK if you else (Color(1, 1, 1, 0.025) if i % 2 == 0 else Color(0, 0, 0, 0)), Color(0, 0, 0, 0), 0, Vector4(20, 9, 20, 9)))
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 14)
		var ink := Color(1, 1, 1) if you else UiTheme.INK
		var rk := _label(str(int(r.get("rank", i + 1))), 800, 0, 18, ink if you else (UiTheme.GOLD if i == 0 else UiTheme.INK_DIM))
		rk.custom_minimum_size.x = 30
		h.add_child(rk)
		var nm := _label(String(r.name).to_upper(), 700 if you else 600, 2, 17, ink)
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nm.clip_text = true
		h.add_child(nm)
		var v := float(r.value)
		h.add_child(_label((_comma(int(v)) if drift else fmt(v)) if v >= 0.0 else "—", 600, 1, 17, ink))
		var gp := "—" if i == 0 or v < 0.0 else (("−%s" % _comma(int(lead - v))) if drift else ("+%.3f" % (v - lead)))
		var g := _label(gp, 500, 1, 15, ink if you else UiTheme.INK_DIM)
		g.custom_minimum_size.x = 96
		g.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		h.add_child(g)
		line.add_child(h)
		col.add_child(line)
	var hint := _label("ENTER  ·  CONTINUE", 600, 4, 12, UiTheme.INK_FAINT)
	hint.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	hint.offset_top = -34
	hint.offset_left = -120
	hint.offset_right = 120
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(hint)
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.35)

func _process(dt: float) -> void:
	_t += dt
	if _t >= HOLD:
		_close()

func _gui_input(e: InputEvent) -> void:
	if _t > 0.6 and ((e is InputEventMouseButton and (e as InputEventMouseButton).pressed) or (e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed)):
		_close()

func _unhandled_input(e: InputEvent) -> void:
	if _t > 0.6 and e is InputEventKey and (e as InputEventKey).pressed and (e as InputEventKey).keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
		get_viewport().set_input_as_handled()
		_close()

func _close() -> void:
	if is_queued_for_deletion() or mouse_filter == Control.MOUSE_FILTER_IGNORE:
		return
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(false)
	closed.emit()
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.3)
	tw.tween_callback(queue_free)

func _reward(what: String, amount: String, c: Color) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	v.add_child(_label(amount, 800, 1, 26, c))
	v.add_child(_label(what, 600, 4, 11, UiTheme.INK_DIM))
	return v

func _section(t: String) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	v.add_child(_label(t, 700, 4, 12, UiTheme.INK_DIM))
	var r := ColorRect.new()
	r.color = UiTheme.LINE
	r.custom_minimum_size = Vector2(260, 1)
	r.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	v.add_child(r)
	return v

## Motorfest's placings lean forward
static func _slant(f: Font) -> Font:
	var fv := FontVariation.new()
	fv.base_font = f
	fv.variation_transform = Transform2D(Vector2(1, 0), Vector2(0.2, 1), Vector2.ZERO)
	return fv

static func _comma(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
