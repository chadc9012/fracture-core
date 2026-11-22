extends Control
## The skill tree screen (owner Nov 18, interfaceingame.com Watch Dogs: Legion "Skill Tree"): three branches side by
## side, each a column of perk nodes joined by a line from tier to tier — owned ones filled in the branch's colour,
## the ones you can buy now ringed and pulsing, the rest dim. Points to spend top right; the picked perk's name, what it
## does, and UNLOCK below. Rules in skills.gd. `closed` on BACK.
signal closed

const Skills := preload("res://scripts/progress/skills.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const NODE := 74.0

var _p: Dictionary
var _pick := ""
var _tree: Control
var _points: Label
var _detail: VBoxContainer
var _t := 0.0
var _nodes := {}   # perk id -> centre point in _tree

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	position = Vector2.ZERO
	size = get_viewport_rect().size
	_p = Gear.profile_load()
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.045, 0.98)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
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
	title.text = "SKILLS"
	title.theme_type_variation = &"HeaderLarge"
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	_points = _label("", 700, 3, 18, UiTheme.GOLD)
	_points.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.add_child(_points)
	var rule := ColorRect.new()
	rule.color = UiTheme.LINE
	rule.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	rule.offset_top = 78
	rule.offset_bottom = 79
	add_child(rule)
	var body := HBoxContainer.new()
	body.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	body.offset_top = 92
	body.offset_left = 24
	body.offset_right = -24
	body.offset_bottom = -16
	body.add_theme_constant_override("separation", 28)
	add_child(body)
	_tree = Control.new()
	_tree.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tree.size_flags_stretch_ratio = 1.6
	_tree.draw.connect(_draw_tree)
	_tree.gui_input.connect(_tree_input)
	_tree.resized.connect(_place)
	body.add_child(_tree)
	_detail = VBoxContainer.new()
	_detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail.alignment = BoxContainer.ALIGNMENT_CENTER
	_detail.add_theme_constant_override("separation", 8)
	body.add_child(_detail)
	_refresh()

func _process(dt: float) -> void:
	_t += dt
	_tree.queue_redraw()

func _place() -> void:
	_nodes.clear()
	var w := _tree.size.x
	var h := _tree.size.y
	for bi in Skills.BRANCHES.size():
		var b: Dictionary = Skills.BRANCHES[bi]
		var x := w * (bi + 0.5) / Skills.BRANCHES.size()
		for k in Skills.PERKS:
			if k.branch == b.id:
				_nodes[k.id] = Vector2(x, 60.0 + (h - 110.0) * (int(k.tier) - 1) / 3.0)

func _refresh() -> void:
	var pts := Skills.points(_p)
	_points.text = "◆ %d POINT%s TO SPEND" % [pts, "" if pts == 1 else "S"]
	if _pick == "":
		for k in Skills.PERKS:
			if Skills.can_buy(_p, k.id):
				_pick = k.id
				break
		if _pick == "":
			_pick = String(Skills.PERKS[0].id)
	for c in _detail.get_children():
		c.queue_free()
	var k := Skills.perk(_pick)
	var b: Dictionary = Skills.BRANCHES.filter(func(x): return x.id == k.branch)[0]
	var own := Skills.owned(_p).has(_pick)
	var can := Skills.can_buy(_p, _pick)
	_detail.add_child(_label("%s  ·  TIER %d" % [String(b.name), int(k.tier)], 700, 4, 13, b.color))
	var nm := _label(String(k.name).to_upper(), 700, 4, 30, UiTheme.INK)
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(nm)
	var d := _label(String(k.desc), 400, 0, 18, Color(0.93, 0.94, 0.95, 0.9))
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(d)
	var state := "UNLOCKED" if own else ("1 POINT" if can else ("NEEDS THE PERK ABOVE IT" if Skills.points(_p) > 0 else "LEVEL UP FOR A POINT"))
	_detail.add_child(_label(state, 600, 3, 13, b.color if own else UiTheme.INK_DIM))
	if not own:
		var u := Button.new()
		u.text = "UNLOCK"
		u.disabled = not can
		u.custom_minimum_size = Vector2(220, 50)
		u.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		u.add_theme_font_override("font", UiTheme.font(700, 6))
		u.pressed.connect(func():
			if Skills.buy(_p, _pick):
				Gear.profile_save(_p)
				_refresh())
		_detail.add_child(u)

func _tree_input(e: InputEvent) -> void:
	var at := Vector2.INF
	if e is InputEventMouseButton and (e as InputEventMouseButton).pressed:
		at = (e as InputEventMouseButton).position
	elif e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed:
		at = (e as InputEventScreenTouch).position
	if at == Vector2.INF:
		return
	for id in _nodes:
		if (_nodes[id] as Vector2).distance_to(at) <= NODE * 0.6:
			_pick = String(id)
			_refresh()
			return

func _draw_tree() -> void:
	if _nodes.is_empty():
		_place()
	var font := UiTheme.font(700, 3)
	for b in Skills.BRANCHES:
		var col: Color = b.color
		var ids: Array = Skills.PERKS.filter(func(x): return x.branch == b.id).map(func(x): return x.id)
		var top: Vector2 = _nodes[ids[0]]
		var hw := font.get_string_size(String(b.name), HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		_tree.draw_string(font, top + Vector2(-hw * 0.5, -NODE * 0.5 - 12), String(b.name), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, col)
		for i in ids.size() - 1:
			var a: Vector2 = _nodes[ids[i]]
			var c: Vector2 = _nodes[ids[i + 1]]
			var lit := Skills.owned(_p).has(ids[i + 1])
			_tree.draw_line(a + Vector2(0, NODE * 0.42 + 32.0), c - Vector2(0, NODE * 0.42 + 6.0), Color(col.r, col.g, col.b, 0.9 if lit else 0.22), 3.0 if lit else 2.0, true)
		for id in ids:
			var at: Vector2 = _nodes[id]
			var own := Skills.owned(_p).has(id)
			var can := Skills.can_buy(_p, id)
			var r := NODE * 0.42
			# a hexagon, as Legion's nodes are
			var pts := PackedVector2Array()
			for k in 7:
				var ang := PI / 6.0 + k * TAU / 6.0
				pts.append(at + Vector2(cos(ang), sin(ang)) * r)
			if own:
				_tree.draw_colored_polygon(pts.slice(0, 6), Color(col.r, col.g, col.b, 0.85))
			else:
				_tree.draw_colored_polygon(pts.slice(0, 6), Color(1, 1, 1, 0.04))
			var ring_a := 0.55 + 0.45 * sin(_t * 4.0) if can else (1.0 if own else 0.25)
			_tree.draw_polyline(pts, Color(col.r, col.g, col.b, ring_a), 3.0 if (can or id == _pick) else 1.5, true)
			if id == _pick:
				_tree.draw_arc(at, r + 9.0, 0.0, TAU, 48, Color(1, 1, 1, 0.7), 1.5, true)
			var k := Skills.perk(id)
			var label := String(k.name).to_upper()
			var lw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			_tree.draw_string(font, at + Vector2(-lw * 0.5, r + 22), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UiTheme.INK if (own or can) else UiTheme.INK_FAINT)
			var tn := str(int(k.tier))
			_tree.draw_string(UiTheme.font(700, 0), at + Vector2(-6, 8), tn, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(0.04, 0.05, 0.07) if own else Color(col.r, col.g, col.b, 0.9 if can else 0.35))

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	return l
