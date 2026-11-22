extends Control
## The season pass screen (owner Nov 18, interfaceingame.com The Finals "Battle Pass"): the season's number and name in
## big slanted caps with the days left, the tier you're on and the XP to the next; the picked reward large on the left
## with CLAIM, CLAIM ALL beside it; the thirty tiers as cards along a track at the bottom — claimable ones edged in red,
## claimed ones ticked, ones ahead dim — with the line under them filled to your tier. Rules in season_pass.gd.
## `closed` on BACK.
signal closed

const Season := preload("res://scripts/progress/season_pass.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const RED := Color(1.0, 0.24, 0.24)   # The Finals' red
const CARD := Vector2(112, 150)
const KIND := {
	"nex": ["◆", Color(1.0, 0.82, 0.35), "NEX"],
	"outfit": ["✦", Color(1.0, 0.45, 0.75), "OUTFIT"],
	"furniture": ["▣", Color(0.5, 0.85, 1.0), "APARTMENT"],
	"drop": ["⬢", Color(0.75, 0.5, 1.0), "GEAR"],
}

var _p: Dictionary
var _pick := 1
var _t := 0.0
var _head_tier: Label
var _head_xp: Label
var _xp_fill: ColorRect
var _detail: VBoxContainer
var _cards: HBoxContainer
var _track: Control
var _scroll: ScrollContainer
var _all: Button
var _said: Label

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	position = Vector2.ZERO
	size = get_viewport_rect().size
	_p = Gear.profile_load()
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.03, 0.04, 0.98)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var season := Season.current()
	# the top bar
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
	title.text = "SEASON PASS"
	title.theme_type_variation = &"HeaderLarge"
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	var ends := _label("ENDS IN %d DAY%s" % [int(season.days_left), "" if int(season.days_left) == 1 else "S"], 700, 4, 14, UiTheme.INK_DIM)
	ends.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.add_child(ends)

	# the season and your tier, the picked reward
	var top := HBoxContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	top.offset_left = 32
	top.offset_right = -32
	top.offset_top = 84
	top.offset_bottom = -(CARD.y + 70)
	top.add_theme_constant_override("separation", 40)
	add_child(top)
	var head := VBoxContainer.new()
	head.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.alignment = BoxContainer.ALIGNMENT_CENTER
	head.add_theme_constant_override("separation", 2)
	top.add_child(head)
	head.add_child(_label("SEASON %d" % int(season.id), 800, 6, 20, RED))
	var nm := _label(String(season.name), 900, 2, 96, UiTheme.INK)
	nm.add_theme_font_override("font", _slant(UiTheme.font(900, 2)))
	head.add_child(nm)
	_head_tier = _label("", 800, 4, 30, UiTheme.INK)
	head.add_child(_head_tier)
	var xb := ColorRect.new()
	xb.custom_minimum_size = Vector2(480, 10)
	xb.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	xb.color = Color(1, 1, 1, 0.12)
	head.add_child(xb)
	_xp_fill = ColorRect.new()
	_xp_fill.color = RED
	_xp_fill.size = Vector2(0, 10)
	xb.add_child(_xp_fill)
	_head_xp = _label("", 600, 2, 16, UiTheme.INK_DIM)
	head.add_child(_head_xp)
	var gap := Control.new()
	gap.custom_minimum_size.y = 8
	head.add_child(gap)
	head.add_child(_label("EARN XP ANYWHERE — MISSIONS, RACES, THE KILLBOX — TO CLIMB", 600, 3, 13, UiTheme.INK_FAINT))
	_detail = VBoxContainer.new()
	_detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail.alignment = BoxContainer.ALIGNMENT_CENTER
	_detail.add_theme_constant_override("separation", 6)
	top.add_child(_detail)

	# the track
	_scroll = ScrollContainer.new()
	_scroll.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_scroll.offset_left = 24
	_scroll.offset_right = -24
	_scroll.offset_top = -(CARD.y + 56)
	_scroll.offset_bottom = -16
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(_scroll)
	var lane := VBoxContainer.new()
	lane.add_theme_constant_override("separation", 10)
	_scroll.add_child(lane)
	_cards = HBoxContainer.new()
	_cards.add_theme_constant_override("separation", 8)
	lane.add_child(_cards)
	_track = Control.new()
	_track.custom_minimum_size = Vector2(Season.TIERS * (CARD.x + 8) - 8, 6)
	_track.draw.connect(_draw_track)
	lane.add_child(_track)
	for t in range(1, Season.TIERS + 1):
		var b := Button.new()
		b.custom_minimum_size = CARD
		b.focus_mode = Control.FOCUS_NONE
		var tt := t
		b.pressed.connect(func():
			_pick = tt
			_refresh())
		_cards.add_child(b)
	# start on the first reward waiting, else the tier you're on
	_pick = maxi(1, Season.tier(_p))
	for t in range(1, Season.tier(_p) + 1):
		if Season.can_claim(_p, t):
			_pick = t
			break
	_refresh()
	_scroll_to.call_deferred(_pick)

func _process(dt: float) -> void:
	_t += dt
	# claimable cards breathe
	for i in _cards.get_child_count():
		if Season.can_claim(_p, i + 1):
			(_cards.get_child(i) as Control).modulate = Color(1, 1, 1, 0.8 + 0.2 * sin(_t * 4.0))
		else:
			(_cards.get_child(i) as Control).modulate = Color.WHITE

func _scroll_to(t: int) -> void:
	_scroll.scroll_horizontal = int(maxf(0.0, (t - 1) * (CARD.x + 8) - _scroll.size.x * 0.4))

func _refresh() -> void:
	var tier := Season.tier(_p)
	var b := Season.bar(_p)
	_head_tier.text = "TIER %d  /  %d" % [tier, Season.TIERS]
	_xp_fill.size.x = 480.0 * float(b.x) / float(b.y)
	_head_xp.text = "TRACK COMPLETE" if tier >= Season.TIERS else "%d / %d XP TO TIER %d" % [b.x, b.y, tier + 1]
	for i in _cards.get_child_count():
		_card(_cards.get_child(i) as Button, i + 1, tier)
	_track.queue_redraw()
	# the picked reward
	for c in _detail.get_children():
		c.queue_free()
	var r: Dictionary = Season.REWARDS[_pick - 1]
	var k: Array = KIND[String(r.kind)]
	_detail.add_child(_label("TIER %d  ·  %s" % [_pick, String(k[2])], 700, 5, 16, k[1]))
	var big := _label(String(k[0]), 400, 0, 110, k[1])
	_detail.add_child(big)
	var n := _label(Season.label(r).to_upper(), 800, 3, 40, UiTheme.INK)
	n.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(n)
	_detail.add_child(_label(_blurb(r), 400, 0, 19, Color(0.93, 0.94, 0.95, 0.8)))
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 10)
	_detail.add_child(buttons)
	var claim := Button.new()
	claim.custom_minimum_size = Vector2(220, 58)
	claim.add_theme_font_override("font", UiTheme.font(800, 6))
	if Season.claimed(_p, _pick):
		claim.text = "CLAIMED  ✓"
		claim.disabled = true
	elif _pick > tier:
		claim.text = "REACH TIER %d" % _pick
		claim.disabled = true
	else:
		claim.text = "CLAIM"
		_red(claim)
		claim.pressed.connect(func(): _claim([_pick]))
	buttons.add_child(claim)
	var waiting: Array = range(1, tier + 1).filter(func(t): return Season.can_claim(_p, t))
	_all = Button.new()
	_all.text = "CLAIM ALL  (%d)" % waiting.size()
	_all.custom_minimum_size = Vector2(220, 58)
	_all.disabled = waiting.size() < 2
	_all.add_theme_font_override("font", UiTheme.font(800, 5))
	_all.pressed.connect(func(): _claim(waiting))
	buttons.add_child(_all)
	_said = _label("", 600, 2, 14, UiTheme.GOLD)
	_said.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(_said)

func _claim(tiers: Array) -> void:
	var g := Gear.load_save()
	var lines: Array = []
	var lv := Progression.level_for(int(_p.get("xp", 0)))
	var power := Gear.operator_power(g, lv)
	for t in tiers:
		var line := Season.claim(_p, g, int(t), power)
		if line != "":
			lines.append(line)
	if lines.is_empty():
		return
	Gear.save(g)
	Gear.profile_save(_p)
	_refresh()
	_said.text = "\n".join(PackedStringArray(lines.slice(0, 4))) + ("\n+ %d more" % (lines.size() - 4) if lines.size() > 4 else "")
	var s = load("res://scripts/audio/sound.gd")
	s.sfx("capture", -6.0)

func _card(b: Button, t: int, tier: int) -> void:
	for c in b.get_children():
		c.queue_free()
	var r: Dictionary = Season.REWARDS[t - 1]
	var k: Array = KIND[String(r.kind)]
	var got := Season.claimed(_p, t)
	var can := Season.can_claim(_p, t)
	var ahead := t > tier
	var edge: Color = RED if can else (Color(1, 1, 1, 0.9) if t == _pick else UiTheme.LINE)
	var fill := Color(1, 1, 1, 0.08) if t == _pick else (Color(1, 1, 1, 0.025) if ahead else Color(1, 1, 1, 0.05))
	var st := UiTheme.box(fill, edge, 2 if (can or t == _pick) else 1, Vector4(8, 6, 8, 6))
	for s in ["normal", "hover", "pressed", "focus", "disabled"]:
		b.add_theme_stylebox_override(s, st)
	var v := VBoxContainer.new()
	v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 8
	v.offset_right = -8
	v.offset_top = 6
	v.offset_bottom = -6
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_theme_constant_override("separation", 0)
	b.add_child(v)
	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var num := _label(str(t), 900, 0, 22, UiTheme.INK_FAINT if ahead else UiTheme.INK)
	num.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(num)
	top.add_child(_label("✓" if got else ("·" if ahead else ""), 700, 0, 14, Color(0.45, 1.0, 0.6) if got else UiTheme.INK_FAINT))
	v.add_child(top)
	var ic := _label(String(k[0]), 400, 0, 38, Color(k[1].r, k[1].g, k[1].b, 0.35 if ahead else 1.0))
	ic.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ic.size_flags_vertical = Control.SIZE_EXPAND_FILL
	ic.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	v.add_child(ic)
	var nm := _label(Season.label(r).to_upper(), 700, 1, 10, UiTheme.INK_FAINT if ahead else UiTheme.INK_DIM)
	nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	nm.custom_minimum_size.x = CARD.x - 16
	v.add_child(nm)

func _draw_track() -> void:
	var w := _track.size.x
	_track.draw_rect(Rect2(0, 2, w, 2), Color(1, 1, 1, 0.12))
	var tier := Season.tier(_p)
	var b := Season.bar(_p)
	var step := CARD.x + 8.0
	# filled to the middle of your tier's card, and part-way to the next by the XP
	var reach := 0.0 if tier == 0 else (tier - 1) * step + CARD.x * 0.5
	if tier < Season.TIERS:
		reach += step * float(b.x) / float(b.y) * (1.0 if tier > 0 else 0.5)
	_track.draw_rect(Rect2(0, 1, minf(w, reach), 4), RED)

func _blurb(r: Dictionary) -> String:
	match String(r.kind):
		"nex": return "Nex, straight to your balance."
		"outfit": return String(Gear.outfit(String(r.id)).get("blurb", "")) + "  Worn from the wardrobe."
		"furniture": return String(Gear.furniture(String(r.id)).get("blurb", "")) + "  Delivered to Apartment 12-04."
		"drop": return "A guaranteed boss-grade weapon or armour piece at your power."
	return ""

func _red(b: Button) -> void:
	var on := UiTheme.box(RED, RED, 1, Vector4(14, 8, 14, 8))
	var hi := UiTheme.box(RED.lightened(0.15), RED, 1, Vector4(14, 8, 14, 8))
	b.add_theme_stylebox_override("normal", on)
	b.add_theme_stylebox_override("hover", hi)
	b.add_theme_stylebox_override("focus", hi)
	b.add_theme_stylebox_override("pressed", hi)
	for k in ["font_color", "font_hover_color", "font_focus_color", "font_pressed_color"]:
		b.add_theme_color_override(k, Color(1, 1, 1))

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
