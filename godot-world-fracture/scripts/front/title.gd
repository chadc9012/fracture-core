extends Control
const Sound := preload("res://scripts/audio/sound.gd")
## The front door (step 7 of the schedule): the title over the owner's Nexus City art, and the way in. CONTINUE takes an
## existing operator to the Nexus street hub (the game's home: every mode has a door there); NEW OPERATOR runs the creator
## and then Apartment 12-04, the opening; WORLD MAP is the globe; GAME MODES the PvP / Raids / Races hub; SETTINGS and
## ACCOUNT (cloud save) sit below. The first launch has no operator, so only NEW OPERATOR and SETTINGS show.
##
## Laid out as Destiny 2's start (owner Nov 18, interfaceingame.com "Press enter to play"): the key art full-bleed with
## the mark and name in the middle and PRESS ENTER TO PLAY (TAP on a phone) pulsing under it; any key, tap or pad button
## lifts the name to the top and brings the menu in as a plain list down the left, a white bar on the one under the
## finger. The press-to-play step shows once a session; coming back to the title goes straight to the menu.

signal pressed(action: String)

const CharacterStore := preload("res://scripts/character/character_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
## the owner's Nexus City key art (docs/reference/nexus-city-a.png, full size; the old billboard crop was 330 px)
const ART := "res://ui/art/title-nexus.jpg"

## the menu music (owner, Nov 13: "Change main menu music"): Kinggg Dream, "Write Your Own Name" (owner, then: "Choose a different kinggg dream song" than New Day)
const MUSIC := "res://audio/radio/kinggg-dream-write-your-own-name.mp3"

static var _seen := false   # the press-to-play step has been passed this session

var _logo: VBoxContainer
var _prompt: Control
var _menu: VBoxContainer
var _shade: TextureRect
var _open := false
var _t := 0.0

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
		art.modulate = Color(0.9, 0.9, 0.95)
		add_child(art)
	# a dark fall-off at the bottom (under the prompt) and, once the menu is in, down the left (under the list)
	add_child(_gradient(Vector2(0.5, 0.35), Vector2(0.5, 1.0), 0.85))
	_shade = _gradient(Vector2(0.62, 0.5), Vector2(0.0, 0.5), 0.88)
	_shade.modulate.a = 0.0
	add_child(_shade)
	_logo = _build_logo()
	add_child(_logo)
	_prompt = _build_prompt()
	add_child(_prompt)
	_menu = _build_menu()
	add_child(_menu)
	var build := Label.new()
	build.text = "Godot build · %s" % Engine.get_version_info().string
	build.theme_type_variation = &"Caption"
	build.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	build.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	build.grow_vertical = Control.GROW_DIRECTION_BEGIN
	build.offset_right = -16
	build.offset_bottom = -12
	add_child(build)
	resized.connect(_layout)
	_layout.call_deferred()
	if _seen:
		_reveal(false)

func _gradient(from: Vector2, to: Vector2, a: float) -> TextureRect:
	var g := Gradient.new()
	g.set_color(0, Color(0.01, 0.015, 0.03, 0.0))
	g.set_color(1, Color(0.01, 0.015, 0.03, a))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill_from = from
	t.fill_to = to
	var r := TextureRect.new()
	r.texture = t
	r.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

## the mark (a broken triangle), WORLD / FRACTURE in wide caps, a rule and the place
func _build_logo() -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mark := Control.new()
	mark.custom_minimum_size = Vector2(0, 64)
	mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mark.draw.connect(func():
		var c := Vector2(mark.size.x * 0.5, 30)
		var a := c + Vector2(-26, -20)
		var b := c + Vector2(26, -20)
		var d := c + Vector2(0, 26)
		var ink := Color(0.93, 0.94, 0.95)
		mark.draw_polyline(PackedVector2Array([a, b, d, a]), ink, 2.0, true)
		# the fracture: a crack down through the middle, offset where it breaks
		mark.draw_polyline(PackedVector2Array([c + Vector2(-3, -20), c + Vector2(3, -4), c + Vector2(-4, 6), c + Vector2(1, 26)]), Color(0.75, 0.5, 1.0), 2.0, true))
	v.add_child(mark)
	for word in ["WORLD", "FRACTURE"]:
		var l := Label.new()
		l.text = word
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.add_theme_font_override("font", UiTheme.font(700, 14))
		l.add_theme_font_size_override("font_size", 56)
		l.add_theme_color_override("font_color", UiTheme.INK)
		l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.35))
		l.add_theme_constant_override("outline_size", 8)
		l.add_theme_constant_override("line_spacing", -8)
		v.add_child(l)
	var rule := ColorRect.new()
	rule.color = Color(1, 1, 1, 0.45)
	rule.custom_minimum_size = Vector2(0, 2)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	rule.custom_minimum_size.x = 120
	v.add_child(rule)
	var sub := Label.new()
	sub.text = "NEXUS CITY  ·  CENTRAL DISTRICT"
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_override("font", UiTheme.font(600, 4))
	sub.add_theme_font_size_override("font_size", 13)
	sub.add_theme_color_override("font_color", Color(0.93, 0.94, 0.95, 0.85))
	sub.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	sub.add_theme_constant_override("outline_size", 6)
	v.add_child(sub)
	return v

func _build_prompt() -> Control:
	var touch := DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") or OS.has_environment("WF_TOUCH")
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 18)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for i in 2:
		var line := ColorRect.new()
		line.color = Color(1, 1, 1, 0.4)
		line.custom_minimum_size = Vector2(56, 1)
		line.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(line)
		if i == 0:
			var l := Label.new()
			l.text = "TAP TO PLAY" if touch else "PRESS ENTER TO PLAY"
			l.add_theme_font_override("font", UiTheme.font(600, 5))
			l.add_theme_font_size_override("font_size", 16)
			l.add_theme_color_override("font_color", UiTheme.INK)
			h.add_child(l)
	return h

## the list: CONTINUE big, then the rest; each a flat row with a white bar down its left edge when hovered or focused
func _build_menu() -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.modulate.a = 0.0
	v.visible = false
	var has_operator := CharacterStore.exists()
	if has_operator:
		v.add_child(_button("CONTINUE", "continue", true))
		var p := Gear.profile_load()
		var goals := Progression.daily(p)
		var open_goals := 0
		for g in goals:
			if not bool(g.done):
				open_goals += 1
		v.add_child(_button("OPERATOR", "operator", false, "%s  ·  %d GOAL%s TODAY" % [Progression.line(p), open_goals, "" if open_goals == 1 else "S"]))
		v.add_child(_button("GAME MODES", "modes", false, "PVP  ·  RAIDS  ·  RACES"))
		var Tri = load("res://scripts/progress/triumphs.gd")
		v.add_child(_button("TRIUMPHS", "triumphs", false, "SCORE %d  ·  COLLECTIONS" % Tri.score(p)))
		v.add_child(_button("WORLD MAP", "globe", false, "THE GLOBE AND ITS DESTINATIONS"))
		v.add_child(_button("NEW OPERATOR", "new"))
	else:
		var welcome := Label.new()
		welcome.text = "Make your operator, then wake up in Apartment 12-04."
		welcome.theme_type_variation = &"Caption"
		welcome.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		welcome.custom_minimum_size = Vector2(320, 0)
		v.add_child(welcome)
		v.add_child(_button("NEW OPERATOR", "new", true))
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 14)
	v.add_child(gap)
	v.add_child(_button("SETTINGS", "settings"))
	v.add_child(_button("ACCOUNT", "cloud", false, "CLOUD SAVE"))
	return v

func _button(text: String, action: String, big := false, hint := "") -> Button:
	var b := Button.new()
	b.text = text
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(380, 66 if big else (54 if hint != "" else 46))
	b.add_theme_font_override("font", UiTheme.font(700 if big else 600, 4 if big else 3))
	b.add_theme_font_size_override("font_size", 26 if big else 17)
	b.add_theme_color_override("font_color", UiTheme.INK if big else Color(0.93, 0.94, 0.95, 0.82))
	b.add_theme_color_override("font_hover_color", UiTheme.INK)
	b.add_theme_color_override("font_focus_color", UiTheme.INK)
	b.add_theme_color_override("font_pressed_color", UiTheme.INK)
	var flat := UiTheme.box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, Vector4(22, 6, 16, 6))
	var lit := UiTheme.box(Color(1, 1, 1, 0.07), Color(0, 0, 0, 0), 0, Vector4(22, 6, 16, 6))
	lit.border_width_left = 4
	lit.border_color = UiTheme.INK
	var down := lit.duplicate() as StyleBoxFlat
	down.bg_color = Color(1, 1, 1, 0.16)
	b.add_theme_stylebox_override("normal", flat)
	b.add_theme_stylebox_override("hover", lit)
	b.add_theme_stylebox_override("focus", lit)
	b.add_theme_stylebox_override("pressed", down)
	if hint != "":
		# the line under the name (the operator's level, what the modes are): a caption inside the row
		flat.content_margin_top = 4
		flat.content_margin_bottom = 20
		lit.content_margin_top = 4
		lit.content_margin_bottom = 20
		down.content_margin_top = 4
		down.content_margin_bottom = 20
		var cap := Label.new()
		cap.text = hint
		cap.add_theme_font_override("font", UiTheme.font(500, 2))
		cap.add_theme_font_size_override("font_size", 12)
		cap.add_theme_color_override("font_color", UiTheme.INK_DIM)
		cap.position = Vector2(26, 31)
		cap.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(cap)
	b.pressed.connect(func():
		Sound.sfx("confirm" if big else "click", -6.0)
		pressed.emit(action))
	b.mouse_entered.connect(func(): b.grab_focus())
	return b

## where things sit for the screen's shape: a phone held upright stacks everything down the middle
func _layout() -> void:
	var upright := size.y > size.x
	var lw := 600.0
	_logo.size = Vector2(lw, _logo.get_combined_minimum_size().y)
	var ms := _menu.get_combined_minimum_size()
	_menu.size = ms
	_prompt.size = Vector2(size.x, 30)
	_prompt.position = Vector2(0, size.y - (170.0 if upright else 110.0))
	if not _open:
		_logo.scale = Vector2.ONE
		_logo.position = Vector2((size.x - lw) * 0.5, size.y * (0.3 if upright else 0.24))
		return
	if upright:
		var k := 0.72
		_logo.scale = Vector2(k, k)
		_logo.position = Vector2((size.x - lw * k) * 0.5, 70)
		_menu.position = Vector2((size.x - ms.x) * 0.5, size.y - ms.y - 60.0)
	else:
		var k := 0.62
		_logo.scale = Vector2(k, k)
		_logo.position = Vector2(56.0 - lw * k * 0.5 + 190.0 * k, 40)
		_menu.position = Vector2(56, maxf(_logo.position.y + _logo.size.y * k + 20.0, size.y - ms.y - 56.0))

func _process(dt: float) -> void:
	_t += dt
	if not _open and _prompt:
		_prompt.modulate.a = 0.55 + 0.45 * sin(_t * 2.6)

func _unhandled_input(event: InputEvent) -> void:
	if _open:
		return
	var go := false
	if event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo:
		go = true
	elif event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		go = true
	elif event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed:
		go = true
	elif event is InputEventJoypadButton and (event as InputEventJoypadButton).pressed:
		go = true
	if go:
		get_viewport().set_input_as_handled()
		Sound.sfx("confirm", -6.0)
		_reveal(true)

## lift the name, dim the left, bring the list in (animated after a press; at once when coming back to the title)
func _reveal(animate: bool) -> void:
	_seen = true
	_open = true
	_menu.visible = true
	var from_pos := _logo.position
	var from_scale := _logo.scale
	_layout()
	if not animate:
		_prompt.visible = false
		_menu.modulate.a = 1.0
		_shade.modulate.a = 1.0
		_focus_first.call_deferred()
		return
	var to_pos := _logo.position
	var to_scale := _logo.scale
	_logo.position = from_pos
	_logo.scale = from_scale
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(_prompt, "modulate:a", 0.0, 0.2)
	tw.tween_property(_logo, "position", to_pos, 0.55)
	tw.tween_property(_logo, "scale", to_scale, 0.55)
	tw.tween_property(_shade, "modulate:a", 1.0, 0.55)
	var mx := _menu.position.x
	_menu.position.x = mx - 30.0
	tw.tween_property(_menu, "modulate:a", 1.0, 0.45).set_delay(0.2)
	tw.tween_property(_menu, "position:x", mx, 0.45).set_delay(0.2)
	tw.chain().tween_callback(func():
		_prompt.visible = false
		_focus_first())

func _focus_first() -> void:
	for c in _menu.get_children():
		if c is Button:
			(c as Button).grab_focus()
			return

func _exit_tree() -> void:
	Sound.music_stop()
