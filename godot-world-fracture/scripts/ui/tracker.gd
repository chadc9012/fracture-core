extends VBoxContainer
## Destiny's tracked pursuit on the HUD (owner Nov 18, interfaceingame.com Destiny 2): the quest's title in gold caps
## behind a small diamond, the step under it, and a thin progress bar whenever the step counts "n / m".
## A drop-in for the old objective Label: set `text` to "Title\nstep" (the first line is the title).
const UiTheme := preload("res://scripts/ui/ui_theme.gd")

var text := "":
	set(v):
		if v == text:
			return
		text = v
		_apply()

var _title: Label
var _step: Label
var _bar_back: ColorRect
var _bar: ColorRect
const BAR_W := 220.0
static var _count := RegEx.create_from_string("(\\d+)\\s*/\\s*(\\d+)")

func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_theme_constant_override("separation", 2)
	_title = _label(700, 1, 12, UiTheme.GOLD)
	_title.uppercase = true
	add_child(_title)
	_step = _label(500, 0, 15, UiTheme.INK)
	_step.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_step.custom_minimum_size.x = 300
	add_child(_step)
	var bar_row := Control.new()
	bar_row.custom_minimum_size = Vector2(BAR_W, 6)
	bar_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar_row)
	_bar_back = ColorRect.new()
	_bar_back.color = Color(0, 0, 0, 0.45)
	_bar_back.size = Vector2(BAR_W, 3)
	_bar_back.position.y = 2
	_bar_back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_row.add_child(_bar_back)
	_bar = ColorRect.new()
	_bar.color = UiTheme.INK
	_bar.size = Vector2(0, 3)
	_bar.position.y = 2
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_row.add_child(_bar)
	_apply()

func _label(weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
	l.add_theme_constant_override("outline_size", 5)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _apply() -> void:
	if not _title:
		return
	var lines := text.split("\n", true, 1)
	_title.text = ("◆  " + lines[0]) if text != "" else ""
	_step.text = lines[1] if lines.size() > 1 else ""
	var m := _count.search(_step.text)
	var show := m != null and int(m.get_string(2)) > 0
	_bar_back.get_parent().visible = show
	if show:
		var f := clampf(float(m.get_string(1)) / float(m.get_string(2)), 0.0, 1.0)
		_bar.size.x = BAR_W * f
		_bar.color = UiTheme.GOLD if f >= 1.0 else UiTheme.INK
