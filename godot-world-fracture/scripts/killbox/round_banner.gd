extends Control
## Valorant's round banners (owner Nov 18, interfaceingame.com Valorant "Round won" / "Round lost"), over the pause
## between Killbox rounds (arena_view._new_round): a band across the middle with ROUND n above, ROUND WON in teal or
## ROUND LOST in red, why underneath, the score with a pip per round on each side, and the accolade you earned in it —
## ACE, CLUTCH, FLAWLESS — as a tag. Holds HOLD seconds and fades.
##   var b := RoundBanner.new(); b.data = {round, result 1/-1/0, why, us, them, to_win, accolade, next}
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const WIN := Color(0.35, 0.95, 0.8)    # Valorant's teal
const LOSS := Color(1.0, 0.27, 0.33)   # and its red
const HOLD := 2.8

var data: Dictionary = {}
var _t := 0.0

## the round's accolade, as Valorant names them: ACE (you took every one of theirs), CLUTCH (you won it as the last of
## yours standing), FLAWLESS (won without losing anyone); "" for none. A loss has none.
static func accolade(won: bool, your_kills: int, their_size: int, ours_down: int, clutch: bool) -> String:
	if not won:
		return ""
	if their_size > 0 and your_kills >= their_size:
		return "ACE"
	if clutch:
		return "CLUTCH"
	if ours_down == 0:
		return "FLAWLESS"
	return ""

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var res := int(data.get("result", 0))
	var col := WIN if res > 0 else (LOSS if res < 0 else UiTheme.INK)
	var band := ColorRect.new()
	band.set_anchors_and_offsets_preset(Control.PRESET_HCENTER_WIDE)
	band.offset_top = -200
	band.offset_bottom = 70
	band.color = Color(0.02, 0.03, 0.04, 0.78)
	band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(band)
	for y in [0.0, 1.0]:
		var edge := ColorRect.new()
		edge.anchor_right = 1.0
		edge.anchor_top = y
		edge.anchor_bottom = y
		edge.offset_top = -1 if y > 0 else 0
		edge.offset_bottom = 0 if y > 0 else 1
		edge.color = Color(col.r, col.g, col.b, 0.7)
		band.add_child(edge)
	var v := VBoxContainer.new()
	v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	band.add_child(v)
	v.add_child(_label("ROUND %d" % int(data.get("round", 1)), 700, 8, 18, UiTheme.INK_DIM))
	var word := "ROUND WON" if res > 0 else ("ROUND LOST" if res < 0 else "ROUND DRAWN")
	v.add_child(_label(word, 900, 12, 92, col))
	v.add_child(_label(String(data.get("why", "")).to_upper(), 600, 4, 17, UiTheme.INK))
	# the score, a pip per round each side needs
	var score := HBoxContainer.new()
	score.alignment = BoxContainer.ALIGNMENT_CENTER
	score.add_theme_constant_override("separation", 14)
	score.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var to_win := maxi(1, int(data.get("to_win", 3)))
	score.add_child(_pips(int(data.get("us", 0)), to_win, WIN, true))
	score.add_child(_label(str(int(data.get("us", 0))), 800, 0, 36, WIN))
	score.add_child(_label("—", 600, 0, 20, UiTheme.INK_FAINT))
	score.add_child(_label(str(int(data.get("them", 0))), 800, 0, 36, LOSS))
	score.add_child(_pips(int(data.get("them", 0)), to_win, LOSS, false))
	v.add_child(score)
	var acc := String(data.get("accolade", ""))
	if acc != "":
		var tag := PanelContainer.new()
		tag.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		tag.add_theme_stylebox_override("panel", UiTheme.box(Color(UiTheme.GOLD.r, UiTheme.GOLD.g, UiTheme.GOLD.b, 0.18), UiTheme.GOLD, 1, Vector4(16, 3, 16, 3)))
		tag.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tag.add_child(_label(acc, 900, 10, 22, UiTheme.GOLD))
		v.add_child(tag)
	var nxt := String(data.get("next", ""))
	if nxt != "":
		v.add_child(_label(nxt.to_upper(), 700, 4, 15, UiTheme.INK_DIM))
	# in from a stretch, as Valorant's word lands
	pivot_offset = get_viewport_rect().size * 0.5
	scale = Vector2(1.08, 1.08)
	modulate.a = 0.0
	var tw := create_tween().set_parallel()
	tw.tween_property(self, "modulate:a", 1.0, 0.18)
	tw.tween_property(self, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var out := create_tween()
	out.tween_interval(HOLD)
	out.tween_property(self, "modulate:a", 0.0, 0.35)
	out.tween_callback(queue_free)

func _pips(n: int, of: int, col: Color, right_to_left: bool) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 5)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	for i in of:
		var lit := (of - 1 - i < n) if right_to_left else (i < n)
		var p := ColorRect.new()
		p.custom_minimum_size = Vector2(20, 7)
		p.color = col if lit else Color(1, 1, 1, 0.14)
		p.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_child(p)
	return h

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
