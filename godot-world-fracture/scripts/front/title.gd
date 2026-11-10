extends Control
const Sound := preload("res://scripts/audio/sound.gd")
## The front door (step 7 of the schedule): the title over the owner's Nexus City art, and the way in. CONTINUE takes an
## existing operator to the Nexus street hub (the game's home: every mode has a door there); NEW OPERATOR runs the creator
## and then Apartment 12-04, the opening; WORLD MAP is the globe; GAME MODES the PvP / Raids / Races hub; SETTINGS and
## ACCOUNT (cloud save) sit below. The first launch has no operator, so only NEW OPERATOR and SETTINGS show.

signal pressed(action: String)

const CharacterStore := preload("res://scripts/character/character_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const ART := "res://textures/billboards/wf-nexus.jpg"

const MUSIC := "res://audio/radio/instrumental-night-drive.ogg"

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	Sound.ambience("")
	Sound.music(MUSIC, -8.0)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.02, 0.05)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	if ResourceLoader.exists(ART):
		var art := TextureRect.new()
		art.texture = load(ART)
		art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		art.modulate = Color(0.6, 0.6, 0.7)
		add_child(art)
		var fade := ColorRect.new()
		fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		fade.color = Color(0.02, 0.02, 0.05, 0.55)
		add_child(fade)
	var box := VBoxContainer.new()
	box.custom_minimum_size = Vector2(460, 0)
	box.add_theme_constant_override("separation", 12)
	add_child(box)
	# the menu sits on the lower part of the art, upright; on a phone turned sideways it would run off the top, so it is
	# placed (and shrunk if it must be) to fit whatever height there is
	var fit := func() -> void:
		var h := box.get_combined_minimum_size().y
		var room := size.y - 40.0
		var k := minf(1.0, room / maxf(h, 1.0))
		box.scale = Vector2(k, k)
		box.size = Vector2(460, h)
		var top := size.y - 740.0 if size.y > size.x else (size.y - h * k) * 0.5
		box.position = Vector2(size.x * 0.5 - 230.0 * k, maxf(20.0, minf(top, size.y - h * k - 20.0)))
	resized.connect(fit)
	box.resized.connect(fit)
	fit.call_deferred()
	var mark := Label.new()
	mark.text = "▽"
	mark.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mark.add_theme_font_size_override("font_size", 54)
	mark.modulate = Color(0.75, 0.5, 1.0)
	box.add_child(mark)
	var title := Label.new()
	title.text = "WORLD\nFRACTURE"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 50)
	title.add_theme_color_override("font_shadow_color", Color(0.3, 0.9, 1.0, 0.6))
	title.add_theme_constant_override("shadow_offset_x", 2)
	title.add_theme_constant_override("shadow_offset_y", 2)
	box.add_child(title)
	var sub := Label.new()
	sub.text = "Nexus City · Central District"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_size_override("font_size", 16)
	sub.modulate = Color(0.5, 0.85, 1.0)
	box.add_child(sub)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 8)
	box.add_child(spacer)
	var has_operator := CharacterStore.exists()
	if has_operator:
		box.add_child(_button("CONTINUE", "continue", Color(0.3, 0.95, 1.0), 60))
		var p := Gear.profile_load()
		var goals := Progression.daily(p)
		var open_goals := 0
		for g in goals:
			if not bool(g.done):
				open_goals += 1
		box.add_child(_button("OPERATOR · %s · %d GOAL%s TODAY" % [Progression.line(p), open_goals, "" if open_goals == 1 else "S"], "operator", Color(0.95, 0.85, 0.4)))
		box.add_child(_button("GAME MODES · PVP · RAIDS · RACES", "modes", Color(1.0, 0.45, 0.75)))
		box.add_child(_button("WORLD MAP", "globe", Color(0.85, 0.9, 1.0)))
		box.add_child(_button("NEW OPERATOR", "new", Color(0.8, 0.8, 0.85)))
	else:
		var welcome := Label.new()
		welcome.text = "Make your operator, then wake up in Apartment 12-04."
		welcome.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		welcome.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		welcome.add_theme_font_size_override("font_size", 15)
		welcome.modulate = Color(0.8, 0.85, 0.9)
		box.add_child(welcome)
		box.add_child(_button("NEW OPERATOR", "new", Color(0.3, 0.95, 1.0), 60))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	var st := _button("SETTINGS", "settings", Color(0.8, 0.8, 0.85))
	st.custom_minimum_size = Vector2(224, 48)
	row.add_child(st)
	var acc := _button("ACCOUNT", "cloud", Color(0.8, 0.8, 0.85))
	acc.custom_minimum_size = Vector2(224, 48)
	row.add_child(acc)
	box.add_child(row)
	var build := Label.new()
	build.text = "Godot build · %s" % Engine.get_version_info().string
	build.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	build.position = Vector2(16, -30)
	build.add_theme_font_size_override("font_size", 12)
	build.modulate = Color(0.5, 0.55, 0.6)
	add_child(build)

func _button(text: String, action: String, col: Color, h := 50) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(460, h)
	b.add_theme_font_size_override("font_size", 20 if h >= 60 else 16)
	b.add_theme_color_override("font_color", col)
	b.pressed.connect(func():
		Sound.sfx("confirm" if h >= 60 else "click", -6.0)
		pressed.emit(action))
	return b

func _exit_tree() -> void:
	Sound.music_stop()
