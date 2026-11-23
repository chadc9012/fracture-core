extends Control
## The ENCOUNTER JOURNAL (☰ MENU): the hidden unique encounters as the web's journal shows them (encounter-journal.ts
## `journalFor`) — only the ones you hold a clue for, "Unknown encounter" with ??? for the clues not yet found and NOVA's
## hint until two clues discover it; then its name, where, what it takes to make it show itself, and FOLLOW THE LEAD
## (its lead-in mission, unique_encounter.gd). Cleared ones say so and offer the fight again. Opening the journal also
## hands over any story clues the main story has already reached (encounters.gd `on_story`).

signal play(mission: String, rematch: bool)
signal closed

const Encounters := preload("res://scripts/mission/encounters.gd")
const Sovereign := preload("res://scripts/mission/sky_sovereign.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const ROUTE := { "site": "the place itself", "story": "the story", "npc": "someone who heard", "world": "a place", "combat": "a fight" }

var _list: VBoxContainer

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.035, 0.05, 0.95)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var p := Gear.profile_load()
	var news := Encounters.on_story(p)
	if not news.is_empty():
		Gear.profile_save(p)
	var t := Encounters.tally(p)
	var head := Label.new()
	head.text = "ENCOUNTER JOURNAL"
	head.position = Vector2(24, 10)
	head.add_theme_font_size_override("font_size", 24)
	head.modulate = Color(1.0, 0.85, 0.5)
	add_child(head)
	var sub := Label.new()
	sub.text = "%d of %d found · %d cleared" % [t.found, t.all, t.done]
	sub.position = Vector2(24, 42)
	sub.modulate = Color(0.6, 0.65, 0.75)
	add_child(sub)
	var back := Button.new()
	back.text = "← BACK"
	back.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	back.position = Vector2(-130, 12)
	back.custom_minimum_size = Vector2(110, 40)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_top = 74
	scroll.offset_left = 16
	scroll.offset_right = -16
	scroll.offset_bottom = -12
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 10)
	scroll.add_child(_list)
	for l in news:
		_note(String(l), Color(0.6, 1.0, 0.7))
	var hidden := 0
	for e in Encounters.all():
		var eid := String(e.id)
		# a Unique (sky_sovereign.gd): absent until met, then an unnamed entry (the Ashen Mark) or his name (the kill); never a lead
		if bool(e.get("unique", false)):
			if Sovereign.has_met(p):
				_unique(e, Sovereign.is_slain(p))
			continue
		var known: Array = Encounters.known(p, e)
		var found := Encounters.is_discovered(p, eid)
		var done := Encounters.is_done(p, eid)
		if known.is_empty() and not found and not done:
			hidden += 1
			continue
		_entry(p, e, known, found, done)
	if hidden > 0:
		_note("%d more encounter%s still hidden. Rumours start as the story reaches them — ask people for strange stories, walk the regions, fight in them." % [hidden, "" if hidden == 1 else "s"], Color(0.6, 0.65, 0.75))

func _note(text: String, c: Color) -> void:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.modulate = c
	l.add_theme_font_size_override("font_size", 15)
	_list.add_child(l)

func _entry(p: Dictionary, e: Dictionary, known: Array, found: bool, done: bool) -> void:
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.08, 0.11, 0.95)
	sb.border_color = Color(1.0, 0.8, 0.4, 0.7) if done else (Color(0.45, 0.8, 1.0, 0.7) if found else Color(0.4, 0.4, 0.5, 0.6))
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(8)
	sb.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", sb)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	panel.add_child(v)
	var title_l := Label.new()
	title_l.text = ("✓ " if done else "") + (String(e.name) if found else "Unknown encounter")
	title_l.add_theme_font_size_override("font_size", 19)
	title_l.modulate = Color(1.0, 0.9, 0.6) if found else Color(0.75, 0.75, 0.85)
	v.add_child(title_l)
	var where := Label.new()
	where.text = String(e.region) + ("   · %s" % _gimmick(String(e.gimmick)) if found else "")
	where.modulate = Color(0.55, 0.85, 1.0)
	v.add_child(where)
	for c in e.clues:
		var has := known.has(c)
		var cl := Label.new()
		cl.text = ("• " + String(c.text) + "   (" + String(ROUTE.get(String(c.route), "")) + ")") if has else "• ???"
		cl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		cl.modulate = Color(0.85, 0.85, 0.9) if has else Color(0.45, 0.45, 0.55)
		v.add_child(cl)
	if not found:
		var h := Encounters.hint(p, e)
		if h != "":
			_line(v, h, Color(0.7, 0.6, 1.0))
		return
	_line(v, "How it shows itself: " + String(e.trigger), Color(0.95, 0.75, 0.5))
	_line(v, "Reward: %s%s · %s" % ["%d Nex · " % int(e.nex) if int(e.nex) > 0 else "", "%d XP" % int(e.xp), String(e.drop_name)], Color(0.7, 0.9, 0.7))
	var b := Button.new()
	var started := FileAccess.file_exists("user://unique_%s.json" % String(e.mission))
	b.text = "FIGHT AGAIN" if done else ("CONTINUE THE LEAD" if started else "FOLLOW THE LEAD")
	b.custom_minimum_size = Vector2(240, 46)
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	var mid := String(e.mission)
	b.pressed.connect(func(): play.emit(mid, done))
	v.add_child(b)

func _unique(e: Dictionary, slain: bool) -> void:
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.06, 0.05, 0.95)
	sb.border_color = Color(1.0, 0.45, 0.15, 0.8)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(8)
	sb.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", sb)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_child(panel)
	var v := VBoxContainer.new()
	panel.add_child(v)
	var t := Label.new()
	t.text = ("✓ " + String(e.name)) if slain else "Unknown"
	t.add_theme_font_size_override("font_size", 19)
	t.modulate = Color(1.0, 0.7, 0.45)
	v.add_child(t)
	_line(v, "Unique · slain. There was only ever one of it." if slain else "Ash burned into your armor at the end of the Glass Flats. It will not wipe off.", Color(0.9, 0.75, 0.65))

func _line(v: Control, text: String, c: Color) -> void:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.modulate = c
	v.add_child(l)

static func _gimmick(g: String) -> String:
	return { "poise": "only its stagger window really hurts", "adaptive": "it learns your damage — keep changing it",
		"attune": "only its halo's element lands", "closing": "shots from range are cut — fight up close",
		"trial": "a trial, not a kill" }.get(g, "")
