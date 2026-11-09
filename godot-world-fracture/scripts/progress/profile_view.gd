extends Control
## The operator panel (schedule step 10): what the one profile holds — level and the XP bar, Nex, the operator's power
## and hull, today's three goals with progress, and the last payments (progression.gd's ledger). Opens from the title's
## OPERATOR button and the street's OPERATOR button; read-only, `closed` on BACK.

signal closed

const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# the host may not be laid out yet (the globe scene sizes itself): take the window's size outright
	position = Vector2.ZERO
	size = get_viewport_rect().size
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.03, 0.06, 0.97)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_top = 70
	scroll.offset_left = 20
	scroll.offset_right = -20
	scroll.offset_bottom = -20
	add_child(scroll)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(500, 0)
	box.add_theme_constant_override("separation", 10)
	scroll.add_child(box)
	var p := Gear.profile_load()
	var gear := Gear.load_save()
	var level := Progression.level_for(int(p.get("xp", 0)))
	var bar := Progression.xp_bar(p)
	_h(box, "OPERATOR", 26)
	_line(box, Progression.line(p), 20, Color(0.3, 0.95, 1.0))
	var xp := ProgressBar.new()
	xp.min_value = 0
	xp.max_value = bar.y
	xp.value = bar.x
	xp.custom_minimum_size = Vector2(0, 18)
	xp.show_percentage = false
	box.add_child(xp)
	_line(box, "%d / %d XP to level %d" % [bar.x, bar.y, level + 1], 13, Color(0.6, 0.65, 0.75))
	_line(box, "Power %d · hull +%d from armour, +%d from level" % [int(Gear.operator_power(gear, level)), int(Gear.hull_bonus(gear)), int(Progression.hull_bonus(p))], 14, Color(0.8, 0.85, 0.9))
	var titles: Array = p.get("titles", [])
	if not titles.is_empty():
		_line(box, "Titles: " + ", ".join(PackedStringArray(titles)), 13, Color(0.95, 0.8, 0.4))
	_h(box, "TODAY'S GOALS", 20)
	for g in Progression.daily(p):
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var mark := Label.new()
		mark.text = "✓" if bool(g.done) else "○"
		mark.custom_minimum_size = Vector2(24, 0)
		mark.modulate = Color(0.4, 1.0, 0.6) if bool(g.done) else Color(0.6, 0.65, 0.75)
		row.add_child(mark)
		var l := Label.new()
		l.text = "%s  (%d / %d)" % [String(g.label), int(g.progress), int(g.target)]
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.add_theme_font_size_override("font_size", 14)
		row.add_child(l)
		var pay := Label.new()
		pay.text = "+%d Nex" % int(g.nex)
		pay.add_theme_font_size_override("font_size", 13)
		pay.modulate = Color(0.95, 0.85, 0.4)
		row.add_child(pay)
		box.add_child(row)
	Gear.profile_save(p)   # daily() may have turned the day
	_h(box, "RECENT", 20)
	var ledger: Array = p.get("ledger", [])
	if ledger.is_empty():
		_line(box, "Nothing earned yet — every mode pays into this profile.", 13, Color(0.6, 0.65, 0.75))
	for e in ledger.slice(0, 10):
		_line(box, "%s · +%d Nex · +%d XP" % [String(e.get("note", e.source)) if String(e.get("note", "")) != "" else String(e.source).capitalize(), int(e.nex), int(e.xp)], 13, Color(0.75, 0.8, 0.88))
	var back := Button.new()
	back.text = "← BACK"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)

func _h(box: VBoxContainer, text: String, size: int) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	box.add_child(l)

func _line(box: VBoxContainer, text: String, size: int, col: Color) -> void:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override("font_size", size)
	l.modulate = col
	box.add_child(l)
