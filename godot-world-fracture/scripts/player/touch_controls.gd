extends Control
const Settings := preload("res://scripts/front/settings_store.gd")
## On-foot input for the phone and the desk, one overlay over the 3D view: a virtual stick where the thumb lands on the left
## half of the screen, look-drag anywhere on the right half, JUMP, SPRINT, FIRE, RELOAD and SWAP buttons (phone), WASD / arrows + Space + Shift,
## left mouse to fire, right-drag look, R and Q on a keyboard; a crosshair and the magazine read-out. Reads out `move` (x right, y forward, -1..1), `look_delta` (pixels this frame, consumed by
## whoever reads it), `jump` (edge, consumed) and `sprint` (held). Owner, Oct 26: the phone screen keeps only walk, look,
## jump and sprint until more is asked for; fire comes with the weapons task.

var move := Vector2.ZERO
var look_delta := Vector2.ZERO
var sprint := false
var fire := false
var _jump := false
var _enter := false
## "foot" or "drive": the phone buttons relabel (JUMP → BRAKE, SPRINT → EXIT) and the keys remap
var mode := "foot"
var _jump_button: Button
var _sprint_button: Button
var _enter_button: Button
var _fire_button: Button
var _reload_button: Button
var _swap_button: Button
var _reload := false
var _next := false
var ammo: Label
var weapon_name: Label
var hull_fill: ColorRect
var hull_back: ColorRect
var hurt_flash: ColorRect
var status: Label
var touch_ui := false
## set by a test or a shot: the inputs are written by code, not read from the keyboard
var scripted := false

const STICK_R := 70.0           # stick travel in px
var _stick_id := -1
var _stick_origin := Vector2.ZERO
var _look_id := -1
var _mouse_look := false
## on a computer: a click into the game takes the mouse (look by moving it, left button fires), Esc gives it back
var _captured := false
var _stick_base: Control
var _stick_knob: Control
var _sprint_held := false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	touch_ui = DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")
	if touch_ui:
		_stick_base = _ring(STICK_R + 24.0, Color(1, 1, 1, 0.12))
		_stick_knob = _ring(34.0, Color(1, 1, 1, 0.35))
		_stick_base.visible = false
		_stick_knob.visible = false
		add_child(_stick_base)
		add_child(_stick_knob)
		var jump := _button("JUMP")
		jump.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		jump.position = Vector2(-120, -140)
		bind(jump, func(): _jump = true; _brake_held = true, func(): _brake_held = false)
		add_child(jump)
		_jump_button = jump
		var run := _button("SPRINT")
		run.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		run.position = Vector2(-120, -230)
		bind(run, func(): _sprint_held = not _sprint_held; _lit(run, _sprint_held))
		add_child(run)
		_sprint_button = run
		var ent := _button("ENTER")
		ent.custom_minimum_size = Vector2(150, 64)
		ent.set_anchors_preset(Control.PRESET_CENTER)
		ent.position = Vector2(-75, 120)
		ent.visible = false
		bind(ent, func(): _enter = true)
		add_child(ent)
		_enter_button = ent
		var shoot := _button("FIRE")
		shoot.custom_minimum_size = Vector2(120, 120)
		shoot.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		shoot.position = Vector2(-250, -160)
		# hold FIRE and slide the thumb to aim while shooting (the button keeps the touch, so the drag is read there)
		bind(shoot, func(): fire = true, func(): fire = false, func(rel: Vector2): look_delta += rel)
		add_child(shoot)
		_fire_button = shoot
		var rl := _button("RELOAD")
		rl.custom_minimum_size = Vector2(104, 56)
		rl.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		rl.position = Vector2(-120, -300)
		bind(rl, func(): _reload = true)
		add_child(rl)
		_reload_button = rl
		var nx := _button("SWAP")
		nx.custom_minimum_size = Vector2(104, 56)
		nx.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		nx.position = Vector2(-120, -365)
		bind(nx, func(): _next = true)
		add_child(nx)
		_swap_button = nx
	_hud()
	if not touch_ui and not scripted:
		toast.call_deferred("Click to aim with the mouse · Esc frees the cursor")

## crosshair, the weapon's name and its magazine
func _hud() -> void:
	var cross := Control.new()
	cross.set_anchors_preset(Control.PRESET_CENTER)
	cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cross.draw.connect(func():
		var c := Color(1, 1, 1, 0.85)
		for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
			cross.draw_line(d * 5.0, d * 14.0, c, 2.0)
		cross.draw_circle(Vector2.ZERO, 1.6, c))
	add_child(cross)
	crosshair = cross
	weapon_name = Label.new()
	weapon_name.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	weapon_name.position = Vector2(20, -80)
	weapon_name.add_theme_font_size_override("font_size", 16)
	weapon_name.modulate = Color(0.75, 0.85, 0.95)
	add_child(weapon_name)
	# a tap on the weapon's name (or the magazine) swaps weapons: the simple HUD has no SWAP button
	var swap_tap := Control.new()
	swap_tap.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	swap_tap.position = Vector2(10, -96)
	swap_tap.size = Vector2(240, 90)
	swap_tap.mouse_filter = Control.MOUSE_FILTER_STOP
	swap_tap.gui_input.connect(func(e: InputEvent) -> void:
		if (e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed) or (e is InputEventMouseButton and (e as InputEventMouseButton).pressed):
			_next = true
			swap_tap.accept_event())
	add_child(swap_tap)
	ammo = Label.new()
	ammo.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	ammo.position = Vector2(20, -56)
	ammo.add_theme_font_size_override("font_size", 30)
	add_child(ammo)
	# hull: a bar at the bottom left above the magazine, and a red wash when hit
	hurt_flash = ColorRect.new()
	hurt_flash.color = Color(0.9, 0.1, 0.1, 0.0)
	hurt_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hurt_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hurt_flash)
	move_child(hurt_flash, 0)
	hull_back = ColorRect.new()
	hull_back.color = Color(0, 0, 0, 0.45)
	hull_back.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hull_back.position = Vector2(20, -112)
	hull_back.size = Vector2(220, 14)
	hull_back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hull_back)
	hull_fill = ColorRect.new()
	hull_fill.color = Color(0.35, 0.95, 0.75)
	hull_fill.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hull_fill.position = Vector2(22, -110)
	hull_fill.size = Vector2(216, 10)
	hull_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hull_fill)
	_prompt_label = Label.new()
	_prompt_label.set_anchors_preset(Control.PRESET_CENTER)
	_prompt_label.position = Vector2(-80, 120)
	_prompt_label.add_theme_font_size_override("font_size", 20)
	_prompt_label.modulate = Color(0.8, 0.95, 1.0)
	add_child(_prompt_label)
	status = Label.new()
	status.set_anchors_preset(Control.PRESET_CENTER)
	status.position = Vector2(-120, -120)
	status.add_theme_font_size_override("font_size", 34)
	status.modulate = Color(1.0, 0.3, 0.3)
	add_child(status)

## the hull read-out: `frac` 0..1, `hurt` 0..1 fades the wash, `down_left` seconds until the operator stands (0 = up)
func show_hull(frac: float, hurt: float, down_left: float) -> void:
	hull_fill.size.x = 216.0 * clampf(frac, 0.0, 1.0)
	hull_fill.color = Color(0.35, 0.95, 0.75) if frac > 0.35 else Color(0.95, 0.4, 0.3)
	hurt_flash.color.a = 0.35 * clampf(hurt, 0.0, 1.0) + (0.45 if down_left > 0.0 else 0.0)
	status.text = ("DOWN · %d" % ceili(down_left)) if down_left > 0.0 else ""

var _toast: Label
var _toast_t := 0.0
## a line at the top of the screen for a few seconds (a pickup, a message)
## a message across the top. Two in the same moment used to overwrite each other (a quest's "complete · +XP · +Nex"
## was replaced by the next quest's title in the same frame and never seen): now each stays at least MIN_TOAST seconds
## and the next waits its turn; the same line twice is shown once.
const MIN_TOAST := 2.2
var _toast_queue: Array[String] = []

func toast(text: String) -> void:
	if _toast and _toast_t > 0.0 and _toast.text != "":
		if _toast.text == text or _toast_queue.has(text):
			return
		if 3.0 - _toast_t < MIN_TOAST:
			_toast_queue.append(text)
			return
	_show_toast(text)

func _show_toast(text: String) -> void:
	if not _toast:
		_toast = Label.new()
		# across the top, centred and wrapped: a fixed 150 px offset put long lines off-centre and off a phone's edge
		_toast.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
		_toast.offset_top = 190   # under the street's top bar, which wraps to three rows on an upright phone
		_toast.offset_left = 24
		_toast.offset_right = -24
		_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_toast.add_theme_font_size_override("font_size", 18)
		_toast.modulate = Color(0.95, 0.85, 0.5)
		add_child(_toast)
	_toast.text = text
	_toast_t = 3.0

var _brake_held := false
## the brake while driving: the JUMP button held on the phone, Space on the desk
func brake() -> float:
	if mode != "drive":
		return 0.0
	return 1.0 if (_brake_held or (not touch_ui and Input.is_key_pressed(KEY_SPACE))) else 0.0

## the ENTER / EXIT press since the last call (the phone button, or E on the desk)
func take_enter() -> bool:
	var e := _enter
	_enter = false
	return e

## shows the enter prompt ("" hides it)
var _prompt_label: Label
## the interaction prompt: the ENTER button carries it on touch; a keyboard player sees "<text> · E" under the crosshair
func prompt(text: String) -> void:
	if _enter_button:
		_enter_button.text = text
		_enter_button.visible = text != ""
		return
	if not _prompt_label:
		_prompt_label = Label.new()
		_prompt_label.set_anchors_preset(Control.PRESET_CENTER)
		_prompt_label.position = Vector2(-150, 60)
		_prompt_label.custom_minimum_size = Vector2(300, 30)
		_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_prompt_label.add_theme_font_size_override("font_size", 18)
		_prompt_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
		_prompt_label.modulate = Color(0.5, 0.95, 1.0)
		add_child(_prompt_label)
	_prompt_label.text = (text + "  ·  E") if text != "" else ""

## the simple phone HUD (settings "simple_hud", the owner's ask): stick, FIRE, JUMP and ENTER only — sprint is the stick
## pushed to its edge, a tap on the weapon's name swaps, an empty magazine reloads itself (gunplay does that on the pull)
func simple() -> bool:
	return touch_ui and bool(Settings.get_value("simple_hud"))

func set_mode(m: String) -> void:
	mode = m
	var drive := m == "drive"
	var fly := m == "fly"
	if _jump_button:
		_jump_button.text = "BRAKE" if drive else ("UP" if fly else "JUMP")
	if _sprint_button:
		_sprint_button.visible = not drive and (fly or not simple())
		_sprint_button.text = "DOWN" if fly else "SPRINT"
		_lit(_sprint_button, false)
	if _fire_button:
		_fire_button.visible = not drive and not fly and weapons_out
	for b in [_reload_button, _swap_button]:
		if b:
			b.visible = not drive and not fly and weapons_out and not simple()
	if crosshair:
		crosshair.visible = not fly and (weapons_out or drive)
	if drive or fly:
		_sprint_held = false
		fire = false

var crosshair: Control
var weapons_out := true

## unarmed (before Mission 01 arms the operator): no FIRE / RELOAD / SWAP and no crosshair on foot
func set_armed(on: bool) -> void:
	weapons_out = on
	if not on:
		fire = false
	set_mode(mode)

## flight (mode "fly"): UP held (or Space) climbs, DOWN toggled (or Shift) descends — 0..1
func ascend() -> float:
	return 1.0 if (_brake_held or (not touch_ui and Input.is_key_pressed(KEY_SPACE))) else 0.0

func descend() -> float:
	return 1.0 if (_sprint_held or (not touch_ui and Input.is_key_pressed(KEY_SHIFT))) else 0.0

func take_reload() -> bool:
	var r := _reload
	_reload = false
	return r

func take_next() -> bool:
	var n := _next
	_next = false
	return n

func _ring(r: float, col: Color) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(r * 2, r * 2)
	c.size = c.custom_minimum_size
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func(): c.draw_circle(Vector2(r, r), r, col); c.draw_arc(Vector2(r, r), r - 1.0, 0.0, TAU, 48, Color(1, 1, 1, 0.5), 2.0))
	return c

## a phone button that answers any finger. A Button only hears the first finger on the glass (Godot turns touch 0 into
## a mouse click and no other), so with a thumb on the move stick ENTER, FIRE, RELOAD and SWAP ignored the other hand
## (owner's phone test, Nov 9: "I couldn't enter cars"). Each touch on the button is read here, whatever its index, and
## the mouse click Godot makes from touch 0 is swallowed so nothing fires twice.
static func bind(b: Button, down: Callable, up := Callable(), drag := Callable()) -> void:
	var held := [-1]
	b.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventScreenTouch:
			var t := e as InputEventScreenTouch
			if t.pressed and held[0] < 0:
				held[0] = t.index
				b.modulate = Color(0.6, 0.95, 1.0, 1.0)
				down.call()
			elif not t.pressed and t.index == held[0]:
				held[0] = -1
				b.modulate = Color(0.6, 0.95, 1.0, 1.0) if b.has_meta("lit") else Color(1, 1, 1, 0.85)
				if up.is_valid():
					up.call()
			b.accept_event()
		elif e is InputEventScreenDrag:
			if drag.is_valid() and (e as InputEventScreenDrag).index == held[0]:
				drag.call((e as InputEventScreenDrag).relative)
			b.accept_event()
		elif e is InputEventMouseButton or e is InputEventMouseMotion:
			b.accept_event())

## a toggle button's lit look (SPRINT on)
func _lit(b: Button, on: bool) -> void:
	if on:
		b.set_meta("lit", true)
		b.modulate = Color(0.6, 0.95, 1.0, 1.0)
	else:
		b.remove_meta("lit")
		b.modulate = Color(1, 1, 1, 0.85)

func _button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(104, 76)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 20)
	b.modulate = Color(1, 1, 1, 0.85)
	return b

## the jump press since the last call
func take_jump() -> bool:
	var j := _jump
	_jump = false
	return j

## the look drag since the last call (px)
func take_look() -> Vector2:
	var d := look_delta
	look_delta = Vector2.ZERO
	return d

func _process(_dt: float) -> void:
	if _toast and _toast_t > 0.0:
		_toast_t -= _dt
		if not _toast_queue.is_empty() and 3.0 - _toast_t >= MIN_TOAST:
			_show_toast(_toast_queue.pop_front())
		elif _toast_t <= 0.0:
			_toast.text = ""
	if scripted:
		return
	if touch_ui:
		sprint = _sprint_held or (simple() and mode == "foot" and move.length() > 0.92)
		return
	# keyboard
	var k := Vector2.ZERO
	k.x = (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0)
	k.y = (1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0)
	move = k.limit_length(1.0)
	sprint = Input.is_key_pressed(KEY_SHIFT)
	if Input.is_key_pressed(KEY_SPACE) and not _space_was:
		_jump = true
	_space_was = Input.is_key_pressed(KEY_SPACE)
	if Input.is_key_pressed(KEY_R) and not _r_was:
		_reload = true
	_r_was = Input.is_key_pressed(KEY_R)
	if Input.is_key_pressed(KEY_Q) and not _q_was:
		_next = true
	_q_was = Input.is_key_pressed(KEY_Q)
	if Input.is_key_pressed(KEY_E) and not _e_was:
		_enter = true
	_e_was = Input.is_key_pressed(KEY_E)
var _e_was := false
var _r_was := false
var _q_was := false
var _space_was := false

func _capture(on: bool) -> void:
	if touch_ui or scripted:
		return
	if on == _captured:
		return
	_captured = on
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if on else Input.MOUSE_MODE_VISIBLE
	if not on:
		fire = false
		_mouse_look = false

func _exit_tree() -> void:
	_capture(false)

## while the mouse is taken every move looks and the left button fires (the cursor is hidden, so nothing else is clicked)
func _input(event: InputEvent) -> void:
	if touch_ui or not _captured:
		return
	if not is_visible_in_tree():
		_capture(false)
		return
	if event is InputEventMouseMotion:
		look_delta += (event as InputEventMouseMotion).relative
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			fire = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			if mb.pressed:
				_next = true
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		_capture(false)
		get_viewport().set_input_as_handled()

func _gui_input(event: InputEvent) -> void:
	if touch_ui:
		if event is InputEventScreenTouch:
			var t := event as InputEventScreenTouch
			var left := t.position.x < size.x * 0.45
			if t.pressed:
				if left and _stick_id < 0:
					_stick_id = t.index
					_stick_origin = t.position
					_stick_base.position = t.position - _stick_base.size * 0.5
					_stick_knob.position = t.position - _stick_knob.size * 0.5
					_stick_base.visible = true
					_stick_knob.visible = true
					move = Vector2.ZERO
				elif not left and _look_id < 0:
					_look_id = t.index
			else:
				if t.index == _stick_id:
					_stick_id = -1
					move = Vector2.ZERO
					_stick_base.visible = false
					_stick_knob.visible = false
				elif t.index == _look_id:
					_look_id = -1
			accept_event()
		elif event is InputEventScreenDrag:
			var d := event as InputEventScreenDrag
			if d.index == _stick_id:
				var v := (d.position - _stick_origin)
				var lim := v.limit_length(STICK_R)
				_stick_knob.position = _stick_origin + lim - _stick_knob.size * 0.5
				move = Vector2(lim.x, -lim.y) / STICK_R
			elif d.index == _look_id:
				look_delta += d.relative
			accept_event()
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and not scripted:
				_capture(true)     # the first click takes the mouse; it does not fire
			else:
				fire = mb.pressed
			accept_event()
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			_mouse_look = mb.pressed
			accept_event()
	elif event is InputEventMouseMotion and _mouse_look:
		look_delta += (event as InputEventMouseMotion).relative
		accept_event()
