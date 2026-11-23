extends Control
## The SIDE MISSIONS board (☰ MENU): every side mission by category — character quests, faction missions, world
## events — with who gives it and where; locked until the main story opens it (side_mission.gd `is_open`), ✓ when done.
## `play(id)` asks main.gd to open it.

signal play(id: String)
signal closed

const SideMission := preload("res://scripts/mission/side_mission.gd")
const TITLES := { "character": "CHARACTER QUESTS", "faction": "FACTION MISSIONS", "event": "WORLD EVENTS" }

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.035, 0.05, 0.94)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var head := Label.new()
	head.text = "SIDE MISSIONS"
	head.position = Vector2(24, 14)
	head.add_theme_font_size_override("font_size", 26)
	head.modulate = Color(1.0, 0.85, 0.5)
	add_child(head)
	var back := Button.new()
	back.text = "← BACK"
	back.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	back.position = Vector2(-130, 12)
	back.custom_minimum_size = Vector2(110, 40)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_top = 64
	scroll.offset_left = 16
	scroll.offset_right = -16
	scroll.offset_bottom = -12
	add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	scroll.add_child(list)
	var p: Dictionary = SideMission._profile()
	var story_done: Array = p.get("aftershock_done", [])
	var choice := String(p.get("a05_choice", ""))
	for cat in ["character", "faction", "event"]:
		var h := Label.new()
		h.text = TITLES[cat]
		h.add_theme_font_size_override("font_size", 18)
		h.modulate = Color(0.55, 0.85, 1.0)
		list.add_child(h)
		for m in SideMission.missions():
			if String(m.get("category", "")) != cat:
				continue
			var open := SideMission.is_open(m, story_done, choice)
			var done := SideMission.is_done(String(m.id))
			var b := Button.new()
			var who := String(m.get("giver", "")).capitalize()
			var tag := ("✓ " if done else "") + String(m.title)
			if not open:
				tag = "🔒 " + String(m.title) + "  · after Mission " + String(m.get("after", "")).trim_prefix("0")
			b.text = "%s\n%s%s · %s" % [tag, (who + " · ") if who != "" else "", String(m.get("region", "")), String(m.get("beat", ""))]
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.custom_minimum_size = Vector2(0, 58)
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			b.disabled = not open
			b.clip_text = true
			var id := String(m.id)
			b.pressed.connect(func(): play.emit(id))
			list.add_child(b)
