extends Control
const Settings := preload("res://scripts/front/settings_store.gd")
const BoardHud := preload("res://scripts/player/board_hud.gd")
## the game screen from the owner's boards (board_hud.gd): weapon card, compass + place + quest, operator plate.
## Views set `hud.place`, `hud.set_quest(...)`, `hud.hull_max` / `hud.shield_max`; the old readouts stay as data.
var hud: Control
## On-foot input for the phone and the desk, one overlay over the 3D view: a virtual stick where the thumb lands on the left
## half of the screen, look-drag anywhere on the right half, JUMP, SPRINT, FIRE, RELOAD and SWAP buttons (phone), WASD / arrows + Space + Shift,
## left mouse to fire, right-drag look, R and Q on a keyboard, J / K (GRENADE / ⟳) for the Operator's grenades; a crosshair and the magazine read-out. Reads out `move` (x right, y forward, -1..1), `look_delta` (pixels this frame, consumed by
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
## Operator grenades (grenades.gd via gunplay): a throw and a cycle press, consumed by gunplay; the HUD line
var _grenade := false
var _cycle_grenade := false
var _grapple := false
## close combat (close_combat.gd): MELEE (tap / hold for the heavy), DODGE, BLOCK (held) — F / C or Ctrl / V on the desk
var _melee := false
var _melee_held := false
var _dodge := false
var _block_held := false
var _melee_button: Button
## the class's abilities (abilities.gd): three buttons wearing their names and readiness; 1 / 2 / 3 on the desk
var _ability := -1
## aim down sights: the phone's ADS toggle, the right mouse button held, a controller's left trigger
var _ads_on := false
var _ads_mouse := false
var _ads_button: Button
var _ability_buttons: Array = []
var _k1_was := false
var _k2_was := false
var _k3_was := false
var _dodge_button: Button
var _block_button: Button
var _grenade_button: Button
var _grapple_button: Button
var _cycle_button: Button
var grenade_label: Label
var ammo: Label
var weapon_name: Label
var hull_fill: ColorRect
var _shield_fill: ColorRect
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
var _stick_label: Label
var _gas_button: Button
var _gas_held := false
## an armed vehicle (the Goliath tank: heavy_weapons.gd): CANNON held fires the main gun as it reloads, MISSILES a tap
## fires the pod; on a computer the left mouse button is the cannon and the right button (or F) the missiles
var armed_vehicle := false
var _cannon_button: Button
var _missile_button: Button
var _cannon_held := false
var _missiles := false
var _f_was := false
## the hit marker over the crosshair (CoD / Fortnite style): white on a hit, yellow on a head, red on a kill
var _hitmark: Control
var _hit_t := 0.0
var _hit_col := Color.WHITE

func cannon() -> bool:
	return _cannon_held or (not touch_ui and fire)

func take_missiles() -> bool:
	var m := _missiles
	_missiles = false
	return m

func set_armed_vehicle(on: bool) -> void:
	armed_vehicle = on
	set_mode(mode)

## flashes the hit marker: "hit", "head", "kill" or "shield"
func hit_marker(kind: String) -> void:
	_hit_t = 0.26 if kind == "kill" else 0.16
	_hit_col = { "head": Color(1.0, 0.85, 0.2), "kill": Color(1.0, 0.25, 0.2), "shield": Color(0.4, 0.85, 1.0) }.get(kind, Color.WHITE)
	if _hitmark:
		_hitmark.queue_redraw()

## the GAS pedal held (driving)
func gas() -> bool:
	return _gas_held

## where the stick rests when no thumb is on it
func _stick_rest() -> Vector2:
	return Vector2(clampf(size.x * 0.13, 120.0, 190.0), size.y - clampf(size.y * 0.3, 150.0, 210.0))

func _rest_stick() -> void:
	if not _stick_base or _stick_id >= 0:
		return
	var p := _stick_rest()
	_stick_base.position = p - _stick_base.size * 0.5
	_stick_knob.position = p - _stick_knob.size * 0.5
	_stick_base.modulate.a = 0.55
	_stick_knob.modulate.a = 0.55
	if _stick_label:
		_stick_label.position = p + Vector2(-100, STICK_R + 30.0)

func _ready() -> void:
	add_to_group("touch_controls")
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	touch_ui = DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") or OS.has_environment("WF_TOUCH")
	if touch_ui:
		_stick_base = _ring(STICK_R + 24.0, Color(1, 1, 1, 0.12))
		_stick_knob = _ring(34.0, Color(1, 1, 1, 0.35))
		# the stick shows where it is (owner, Nov 11: "add controls to screen"): resting at the bottom left, dim, and
		# picked up wherever the left thumb lands; a label says what it does in each mode
		_stick_base.modulate = Color(1, 1, 1, 0.55)
		_stick_knob.modulate = Color(1, 1, 1, 0.55)
		add_child(_stick_base)
		add_child(_stick_knob)
		_stick_label = Label.new()
		_stick_label.add_theme_font_size_override("font_size", 13)
		_stick_label.modulate = Color(1, 1, 1, 0.6)
		_stick_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_stick_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_stick_label.custom_minimum_size = Vector2(200, 18)
		add_child(_stick_label)
		resized.connect(_rest_stick)
		_rest_stick.call_deferred()
		# driving: a held GAS pedal beside BRAKE (the stick steers, and pushes for gas too)
		var gas := _button("GAS")
		gas.custom_minimum_size = Vector2(120, 120)
		gas.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		gas.position = Vector2(-250, -160)
		gas.visible = false
		bind(gas, func(): _gas_held = true; _lit(gas, true), func(): _gas_held = false; _lit(gas, false))
		add_child(gas)
		_gas_button = gas
		var can := _button("CANNON")
		can.custom_minimum_size = Vector2(120, 110)
		can.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		can.position = Vector2(-250, -290)
		can.visible = false
		can.add_theme_color_override("font_color", Color(1.0, 0.75, 0.4))
		bind(can, func(): _cannon_held = true, func(): _cannon_held = false, func(rel: Vector2): look_delta += rel)
		add_child(can)
		_cannon_button = can
		var mis := _button("MISSILES")
		mis.custom_minimum_size = Vector2(120, 76)
		mis.add_theme_font_size_override("font_size", 16)
		mis.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		mis.position = Vector2(-380, -250)
		mis.visible = false
		mis.add_theme_color_override("font_color", Color(1.0, 0.5, 0.35))
		bind(mis, func(): _missiles = true)
		add_child(mis)
		_missile_button = mis
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
		var ml := _button("MELEE")
		ml.custom_minimum_size = Vector2(110, 110)
		ml.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		ml.position = Vector2(-380, -150)
		ml.add_theme_color_override("font_color", Color(1.0, 0.8, 0.45))
		bind(ml, func(): _melee = true; _melee_held = true, func(): _melee_held = false, func(rel: Vector2): look_delta += rel)
		add_child(ml)
		_melee_button = ml
		var dg := _button("DODGE")
		dg.custom_minimum_size = Vector2(104, 76)
		dg.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		dg.position = Vector2(-500, -110)
		dg.add_theme_color_override("font_color", Color(0.6, 0.95, 1.0))
		bind(dg, func(): _dodge = true)
		add_child(dg)
		_dodge_button = dg
		var bl := _button("BLOCK")
		bl.custom_minimum_size = Vector2(110, 70)
		bl.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		bl.position = Vector2(-500, -200)
		bind(bl, func(): _block_held = true, func(): _block_held = false, func(rel: Vector2): look_delta += rel)
		add_child(bl)
		_block_button = bl
		for i in 3:
			var ab := _button(["A1", "A2", "SUPER"][i])
			ab.custom_minimum_size = Vector2(96, 60) if i < 2 else Vector2(110, 66)
			ab.add_theme_font_size_override("font_size", 13)
			ab.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
			ab.position = [Vector2(-500, -280), Vector2(-500, -350), Vector2(-380, -330)][i]
			var idx := i
			bind(ab, func(): _ability = idx)
			add_child(ab)
			_ability_buttons.append(ab)
		# aim down sights: a tap raises the sights and another lowers them (a thumb cannot hold it and fire); a drag
		# on it aims, like FIRE
		var ad := _button("ADS")
		ad.custom_minimum_size = Vector2(110, 66)
		ad.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		ad.position = Vector2(-380, -240)
		ad.add_theme_color_override("font_color", Color(0.75, 1.0, 0.7))
		bind(ad, func(): _ads_on = not _ads_on; _lit(ad, _ads_on), Callable(), func(rel: Vector2): look_delta += rel)
		add_child(ad)
		_ads_button = ad
		var gb := _button("GRENADE")
		gb.custom_minimum_size = Vector2(120, 64)
		gb.add_theme_font_size_override("font_size", 16)
		gb.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		gb.position = Vector2(-250, -240)
		bind(gb, func(): _grenade = true)
		add_child(gb)
		_grenade_button = gb
		var gr := _button("GRAPPLE")
		gr.custom_minimum_size = Vector2(120, 56)
		gr.add_theme_font_size_override("font_size", 16)
		gr.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		gr.position = Vector2(-250, -300)
		bind(gr, func(): _grapple = true)
		add_child(gr)
		_grapple_button = gr
		var cy := _button("⟳")
		cy.custom_minimum_size = Vector2(56, 64)
		cy.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		cy.position = Vector2(-72, -432)     # above SWAP: the ADS button took its old place by GRENADE
		bind(cy, func(): _cycle_grenade = true)
		add_child(cy)
		_cycle_button = cy
	_hud()
	if touch_ui:
		_layout_ready()
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
	_hitmark = Control.new()
	_hitmark.set_anchors_preset(Control.PRESET_CENTER)
	_hitmark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hitmark.draw.connect(func():
		if _hit_t <= 0.0:
			return
		var a := clampf(_hit_t / 0.12, 0.0, 1.0)
		var c := Color(_hit_col.r, _hit_col.g, _hit_col.b, a)
		var big := 1.25 if _hit_col.g < 0.5 else 1.0
		for d in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
			_hitmark.draw_line(d * 7.0 * big, d * 16.0 * big, Color(0, 0, 0, a * 0.6), 4.5)
			_hitmark.draw_line(d * 7.0 * big, d * 16.0 * big, c, 2.5))
	add_child(_hitmark)
	weapon_name = Label.new()
	# the read-outs sit at the top left, out of the stick's way (owner, Nov 11: "add controls to screen")
	weapon_name.set_anchors_preset(Control.PRESET_TOP_LEFT)
	weapon_name.position = Vector2(20, 40)
	weapon_name.add_theme_font_size_override("font_size", 16)
	weapon_name.modulate = Color(0.75, 0.85, 0.95)
	add_child(weapon_name)
	# a tap on the weapon's name (or the magazine) swaps weapons: the simple HUD has no SWAP button
	var swap_tap := Control.new()
	swap_tap.set_anchors_preset(Control.PRESET_TOP_LEFT)
	swap_tap.position = Vector2(10, 34)
	swap_tap.size = Vector2(240, 90)
	swap_tap.mouse_filter = Control.MOUSE_FILTER_STOP
	swap_tap.gui_input.connect(func(e: InputEvent) -> void:
		if (e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed) or (e is InputEventMouseButton and (e as InputEventMouseButton).pressed):
			_next = true
			swap_tap.accept_event())
	add_child(swap_tap)
	ammo = Label.new()
	ammo.set_anchors_preset(Control.PRESET_TOP_LEFT)
	ammo.position = Vector2(20, 62)
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
	hull_back.set_anchors_preset(Control.PRESET_TOP_LEFT)
	hull_back.position = Vector2(20, 18)
	hull_back.size = Vector2(220, 14)
	hull_back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hull_back)
	hull_fill = ColorRect.new()
	hull_fill.color = Color(0.35, 0.95, 0.75)
	hull_fill.set_anchors_preset(Control.PRESET_TOP_LEFT)
	hull_fill.position = Vector2(22, 20)
	hull_fill.size = Vector2(216, 10)
	hull_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hull_fill)
	hud = BoardHud.new()
	hud.source = self
	add_child(hud)
	move_child(hud, 1)
	# the board's plates draw these now; the labels keep their text for the plates (and the swap tap stays)
	hull_back.visible = false
	hull_fill.visible = false
	weapon_name.self_modulate.a = 0.0
	ammo.self_modulate.a = 0.0
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
func show_hull(frac: float, hurt: float, down_left: float, shield := -1.0, hull_max := -1.0, shield_max := -1.0) -> void:
	hull_fill.size.x = 216.0 * clampf(frac, 0.0, 1.0)
	# the energy shield: a thin cyan bar over the hull's (asset catalog §5)
	if shield >= 0.0:
		if not _shield_fill:
			_shield_fill = ColorRect.new()
			_shield_fill.color = Color(0.35, 0.8, 1.0)
			_shield_fill.set_anchors_preset(Control.PRESET_TOP_LEFT)
			_shield_fill.position = Vector2(22, 12)
			_shield_fill.size = Vector2(216, 4)
			_shield_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
			add_child(_shield_fill)
		_shield_fill.size.x = 216.0 * clampf(shield, 0.0, 1.0)
		_shield_fill.visible = hull_fill.visible
	hull_fill.color = Color(0.35, 0.95, 0.75) if frac > 0.35 else Color(0.95, 0.4, 0.3)
	if hud:
		hud.hull = frac
		hud.shield = shield
		if hull_max > 0.0:
			hud.hull_max = hull_max
		if shield_max > 0.0:
			hud.shield_max = shield_max
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

## tests listen here for every toast asked for (tests/gear/loot_test.gd), before the queue drops repeats
var toast_hook: Callable

func toast(text: String) -> void:
	if toast_hook.is_valid():
		toast_hook.call(text)
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
		_sprint_button.visible = (not drive and (fly or not simple())) or (drive and has_nitro)
		_sprint_button.text = "DOWN" if fly else ("NOS" if drive else "SPRINT")
		_lit(_sprint_button, false)
	if _fire_button:
		_fire_button.visible = not drive and not fly and weapons_out
	if _gas_button:
		_gas_button.visible = drive
		_gas_held = false
		_lit(_gas_button, false)
	if _stick_label:
		_stick_label.text = "STEER" if drive else ("FLY" if fly else "MOVE")
	for b in [_reload_button, _swap_button, _grenade_button, _cycle_button, _grapple_button]:
		if b:
			b.visible = not drive and not fly and weapons_out and not simple()
	# the close-combat buttons stay on the simple screen too (owner, Nov 21: melee, dodge on the phone's combat HUD)
	for b in [_melee_button, _dodge_button, _block_button, _ads_button] + _ability_buttons:
		if b:
			b.visible = not drive and not fly and weapons_out
	if drive or fly or not weapons_out:
		_ads_on = false
		if _ads_button:
			_lit(_ads_button, false)
	if drive or fly:
		_melee_held = false
		_block_held = false
	var armed_drive := drive and armed_vehicle
	if _cannon_button:
		_cannon_button.visible = armed_drive
		_cannon_held = false
	if _missile_button:
		_missile_button.visible = armed_drive
	if _gas_button and armed_drive:
		_gas_button.position = Vector2(-380, -150)
	elif _gas_button:
		_gas_button.position = Vector2(-250, -160)
	if crosshair:
		crosshair.visible = (not fly and not drive and weapons_out) or armed_drive
	if drive or fly:
		_sprint_held = false
		fire = false

var crosshair: Control
var weapons_out := true
## the driven car has nitrous: in drive mode the SPRINT button becomes NOS (tap to fire it, tap again to stop; Shift on a
## keyboard, held)
var has_nitro := false

func set_nitro(on: bool) -> void:
	has_nitro = on
	set_mode(mode)

func nitro() -> bool:
	if mode != "drive" or not has_nitro:
		return false
	return _sprint_held or (not touch_ui and Input.is_key_pressed(KEY_SHIFT))

## the tank ran dry: the NOS button lets go
func nitro_off() -> void:
	if mode == "drive" and _sprint_held:
		_sprint_held = false
		if _sprint_button:
			_lit(_sprint_button, false)

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

func take_grapple() -> bool:
	var g := _grapple
	_grapple = false
	return g

func take_ability() -> int:
	var a := _ability
	_ability = -1
	return a

## the ability read-out: each button wears its name and fills as it readies; on the desk a line under the grenade's
var _ability_label: Label
func show_abilities(list: Array) -> void:
	for i in mini(list.size(), _ability_buttons.size()):
		var b: Button = _ability_buttons[i]
		var h: Dictionary = list[i]
		var r := clampf(float(h.ready), 0.0, 1.0)
		b.text = "%s\n%s" % [String(h.name).split(" ")[0], "READY" if r >= 1.0 else "%d%%" % int(r * 100.0)]
		b.modulate = (h.color as Color).lerp(Color.WHITE, 0.35) if r >= 1.0 else Color(0.7, 0.7, 0.75, 0.75)
	if touch_ui:
		return
	if not _ability_label:
		_ability_label = Label.new()
		_ability_label.set_anchors_preset(Control.PRESET_TOP_LEFT)
		_ability_label.position = Vector2(20, 118)
		_ability_label.add_theme_font_size_override("font_size", 13)
		_ability_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
		_ability_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(_ability_label)
	var parts: Array = []
	for i in list.size():
		var h2: Dictionary = list[i]
		var r2 := clampf(float(h2.ready), 0.0, 1.0)
		parts.append("%d %s %s" % [i + 1, String(h2.name), "●" if r2 >= 1.0 else "%d%%" % int(r2 * 100.0)])
	_ability_label.text = "   ".join(parts) if mode == "foot" and weapons_out else ""

## the sights are up: the phone's toggle, the right mouse button, the left trigger
func ads() -> bool:
	return mode == "foot" and weapons_out and (_ads_on or _ads_mouse or _pad_ads)

## a reload or a swap lowers a toggled ADS on the phone (the gun leaves the shoulder)
func drop_ads() -> void:
	_ads_on = false
	if _ads_button:
		_lit(_ads_button, false)

func take_melee() -> bool:
	var m := _melee
	_melee = false
	return m

func melee_held() -> bool:
	return _melee_held or _pad_melee

func take_dodge() -> bool:
	var d := _dodge
	_dodge = false
	return d

func block_held() -> bool:
	return _block_held or _pad_block

func take_grenade() -> bool:
	var g := _grenade
	_grenade = false
	return g

func take_cycle_grenade() -> bool:
	var c := _cycle_grenade
	_cycle_grenade = false
	return c

## the grenade read-out under the weapon's name: "BREACHER FRAG ●● ◔" in its colour ({} hides it); on the phone the
## GRENADE button wears the name and the charges
func show_grenade(h: Dictionary) -> void:
	if not grenade_label:
		grenade_label = Label.new()
		grenade_label.set_anchors_preset(Control.PRESET_TOP_LEFT)
		grenade_label.position = Vector2(20, 100)
		grenade_label.add_theme_font_size_override("font_size", 14)
		grenade_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
		grenade_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(grenade_label)
	if h.is_empty() or mode != "foot":
		grenade_label.text = ""
		return
	var pips := ""
	for i in int(h.max):
		pips += "●" if i < int(h.charges) else "○"
	var next := "" if int(h.charges) >= int(h.max) else "  %d%%" % int(float(h.recharge) * 100.0)
	grenade_label.text = "%s  %s%s%s" % [str(h.name).to_upper(), pips, next, "" if touch_ui else "   J throw · K switch"]
	grenade_label.modulate = h.color
	if _grenade_button:
		_grenade_button.text = "%s %d" % [str(h.name).split(" ")[0].to_upper(), int(h.charges)]

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
		if b.has_meta("editing"):
			var ed: Node = b.get_parent()
			if e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed and ed and ed.has_method("edit_touch"):
				ed.edit_touch(b, Vector2.ZERO)
			elif e is InputEventScreenDrag and ed and ed.has_method("edit_touch"):
				ed.edit_touch(b, (e as InputEventScreenDrag).relative)
			b.accept_event()
			return
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
	if _hit_t > 0.0:
		_hit_t -= _dt
		if _hitmark:
			_hitmark.queue_redraw()
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
		_pad(_dt)
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
	if Input.is_key_pressed(KEY_J) and not _j_was:
		_grenade = true
	_j_was = Input.is_key_pressed(KEY_J)
	if Input.is_key_pressed(KEY_K) and not _k_was:
		_cycle_grenade = true
	_k_was = Input.is_key_pressed(KEY_K)
	if Input.is_key_pressed(KEY_G) and not _g_was:
		_grapple = true
	_g_was = Input.is_key_pressed(KEY_G)
	if Input.is_key_pressed(KEY_E) and not _e_was:
		_enter = true
	_e_was = Input.is_key_pressed(KEY_E)
	var f_down := Input.is_key_pressed(KEY_F)
	if f_down and not _f_was:
		if mode == "foot":
			_melee = true
		else:
			_missiles = true
	_melee_held = f_down and mode == "foot"
	_f_was = f_down
	var dodge_down := Input.is_key_pressed(KEY_C) or Input.is_key_pressed(KEY_CTRL)
	if dodge_down and not _c_was and mode == "foot":
		_dodge = true
	_c_was = dodge_down
	_block_held = (Input.is_key_pressed(KEY_V) or _mouse4) and mode == "foot"
	for ki in 3:
		var down: bool = Input.is_key_pressed([KEY_1, KEY_2, KEY_3][ki])
		var was: bool = [_k1_was, _k2_was, _k3_was][ki]
		if down and not was and mode == "foot":
			_ability = ki
		if ki == 0: _k1_was = down
		elif ki == 1: _k2_was = down
		else: _k3_was = down
	_pad(_dt)
var _e_was := false
var _c_was := false
var _mouse4 := false
var _g_was := false
var _j_was := false
var _k_was := false
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
		elif mb.button_index == MOUSE_BUTTON_RIGHT and mode == "foot":
			_ads_mouse = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed and mode == "drive" and armed_vehicle:
			_missiles = true
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
					_stick_base.modulate.a = 1.0
					_stick_knob.modulate.a = 1.0
					move = Vector2.ZERO
				elif not left and _look_id < 0:
					_look_id = t.index
			else:
				if t.index == _stick_id:
					_stick_id = -1
					move = Vector2.ZERO
					_rest_stick()
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


# --------------------------------------------------------------------------------------------- controller (Nov 22)
## A controller (Xbox / PlayStation layout, any pad Godot sees): left stick moves, right stick looks, RT fires, LT aims
## down sights, A jumps, B dodges, X reloads, Y swaps, RB melee (held = heavy), LB grenade, d-pad ← / → the two
## abilities and ↑ the super, d-pad ↓ held blocks, L3 sprints. In a car: RT gas, LT brake, left stick steers, Y exits.
const PAD_DEAD := 0.18
const PAD_LOOK := 900.0          # px a second at full right stick (the same units as a drag)
var _pad_ads := false
var _pad_used := false
var _pad_was := {}
var _pad_fire := false
var _pad_melee := false
var _pad_block := false

func _pad_edge(btn: int, down: bool) -> bool:
	var was: bool = _pad_was.get(btn, false)
	_pad_was[btn] = down
	return down and not was

func _pad(dt: float) -> void:
	var pads := Input.get_connected_joypads()
	if pads.is_empty():
		if _pad_used:
			_pad_used = false
			_pad_ads = false
			if _pad_fire:
				fire = false
				_pad_fire = false
		return
	var id: int = pads[0]
	var lx := Input.get_joy_axis(id, JOY_AXIS_LEFT_X)
	var ly := Input.get_joy_axis(id, JOY_AXIS_LEFT_Y)
	var rx := Input.get_joy_axis(id, JOY_AXIS_RIGHT_X)
	var ry := Input.get_joy_axis(id, JOY_AXIS_RIGHT_Y)
	var lt := Input.get_joy_axis(id, JOY_AXIS_TRIGGER_LEFT)
	var rt := Input.get_joy_axis(id, JOY_AXIS_TRIGGER_RIGHT)
	var stick := Vector2(lx, -ly)
	var look := Vector2(rx, ry)
	var any := stick.length() > PAD_DEAD or look.length() > PAD_DEAD or lt > 0.3 or rt > 0.3
	for b in [JOY_BUTTON_A, JOY_BUTTON_B, JOY_BUTTON_X, JOY_BUTTON_Y, JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_RIGHT_SHOULDER, JOY_BUTTON_DPAD_UP, JOY_BUTTON_DPAD_DOWN, JOY_BUTTON_DPAD_LEFT, JOY_BUTTON_DPAD_RIGHT, JOY_BUTTON_LEFT_STICK]:
		any = any or Input.is_joy_button_pressed(id, b)
	if not any and not _pad_used:
		return
	_pad_used = true
	if stick.length() > PAD_DEAD:
		move = (stick - stick.normalized() * PAD_DEAD) / (1.0 - PAD_DEAD)
		move = move.limit_length(1.0)
	elif touch_ui and _stick_id < 0:
		move = Vector2.ZERO
	if look.length() > PAD_DEAD:
		var l := (look - look.normalized() * PAD_DEAD) / (1.0 - PAD_DEAD)
		look_delta += Vector2(l.x * absf(l.x), l.y * absf(l.y)) * PAD_LOOK * dt
	if mode == "drive":
		_gas_held = rt > 0.3
		_brake_held = lt > 0.3
		if _pad_edge(JOY_BUTTON_Y, Input.is_joy_button_pressed(id, JOY_BUTTON_Y)):
			_enter = true
		return
	var f := rt > 0.4
	if f != _pad_fire:
		fire = f
		_pad_fire = f
	_pad_ads = lt > 0.4
	if Input.is_joy_button_pressed(id, JOY_BUTTON_LEFT_STICK):
		sprint = true
	if _pad_edge(JOY_BUTTON_A, Input.is_joy_button_pressed(id, JOY_BUTTON_A)):
		_jump = true
	if _pad_edge(JOY_BUTTON_B, Input.is_joy_button_pressed(id, JOY_BUTTON_B)):
		_dodge = true
	if _pad_edge(JOY_BUTTON_X, Input.is_joy_button_pressed(id, JOY_BUTTON_X)):
		_reload = true
		_enter = true          # X also opens doors / cars, as A does on many pads' "interact"
	if _pad_edge(JOY_BUTTON_Y, Input.is_joy_button_pressed(id, JOY_BUTTON_Y)):
		_next = true
	var rb := Input.is_joy_button_pressed(id, JOY_BUTTON_RIGHT_SHOULDER)
	if _pad_edge(JOY_BUTTON_RIGHT_SHOULDER, rb):
		_melee = true
	_pad_melee = rb
	if _pad_edge(JOY_BUTTON_LEFT_SHOULDER, Input.is_joy_button_pressed(id, JOY_BUTTON_LEFT_SHOULDER)):
		_grenade = true
	if _pad_edge(JOY_BUTTON_DPAD_LEFT, Input.is_joy_button_pressed(id, JOY_BUTTON_DPAD_LEFT)):
		_ability = 0
	if _pad_edge(JOY_BUTTON_DPAD_RIGHT, Input.is_joy_button_pressed(id, JOY_BUTTON_DPAD_RIGHT)):
		_ability = 1
	if _pad_edge(JOY_BUTTON_DPAD_UP, Input.is_joy_button_pressed(id, JOY_BUTTON_DPAD_UP)):
		_ability = 2
	_pad_block = Input.is_joy_button_pressed(id, JOY_BUTTON_DPAD_DOWN)

# --------------------------------------------------------------------------------------------- HUD layout (Nov 22)
## The phone's buttons can be moved and resized (owner: "The HUD should be customizable"): ✎ HUD at the top right opens
## the editor — drag any button where the thumb wants it, tap one then SIZE − / + to scale it, OPACITY − / + for all,
## RESET puts the factory layout back, DONE saves to user://hud_layout.json. Positions are kept as offsets from the
## button's own anchor, so a layout survives a different screen size.
const LAYOUT_FILE := "user://hud_layout.json"
var editing := false
var _defaults := {}              # id -> [position, scale]
var _picked: Button
var _edit_bar: HBoxContainer
var _edit_button: Button
var hud_opacity := 0.85

func _layout_buttons() -> Dictionary:
	var out := {}
	for b in get_children():
		if b is Button and b.has_meta("hud_id"):
			out[String(b.get_meta("hud_id"))] = b
	return out

func _layout_ready() -> void:
	for b in get_children():
		if b is Button and b != _enter_button:
			var id := String((b as Button).text)
			if id == "" or b.has_meta("hud_id"):
				continue
			b.set_meta("hud_id", id)
			_defaults[id] = [(b as Button).position, 1.0]
	_edit_button = _button("✎ HUD")
	_edit_button.custom_minimum_size = Vector2(84, 40)
	_edit_button.add_theme_font_size_override("font_size", 14)
	_edit_button.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_edit_button.position = Vector2(-96, 8)
	bind(_edit_button, func(): set_editing(not editing))
	add_child(_edit_button)
	_load_layout()

func _load_layout() -> void:
	if not FileAccess.file_exists(LAYOUT_FILE):
		return
	var d: Variant = JSON.parse_string(FileAccess.get_file_as_string(LAYOUT_FILE))
	if not (d is Dictionary):
		return
	hud_opacity = clampf(float((d as Dictionary).get("opacity", 0.85)), 0.25, 1.0)
	var btns := _layout_buttons()
	for id in (d as Dictionary).get("buttons", {}):
		if not btns.has(id):
			continue
		var row: Array = d.buttons[id]
		var b: Button = btns[id]
		b.position = Vector2(float(row[0]), float(row[1]))
		b.scale = Vector2.ONE * clampf(float(row[2]), 0.6, 1.8)
	_apply_opacity()

func _save_layout() -> void:
	var rows := {}
	for id in _layout_buttons():
		var b: Button = _layout_buttons()[id]
		rows[id] = [b.position.x, b.position.y, b.scale.x]
	var f := FileAccess.open(LAYOUT_FILE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({ "opacity": hud_opacity, "buttons": rows }))

func _apply_opacity() -> void:
	for b in _layout_buttons().values():
		if not (b as Button).has_meta("lit"):
			(b as Button).modulate = Color(1, 1, 1, hud_opacity)

## the editor on / off: buttons stop answering and follow the finger instead
func set_editing(on: bool) -> void:
	editing = on
	_picked = null
	if _edit_button:
		_edit_button.text = "DONE" if on else "✎ HUD"
	for b in _layout_buttons().values():
		var btn := b as Button
		if on:
			btn.set_meta("editing", true)
			btn.visible = true
		else:
			btn.remove_meta("editing")
	if on:
		if not _edit_bar:
			_edit_bar = HBoxContainer.new()
			_edit_bar.set_anchors_preset(Control.PRESET_CENTER_TOP)
			_edit_bar.position = Vector2(-260, 56)
			_edit_bar.add_theme_constant_override("separation", 8)
			for item in [["SIZE −", func(): _resize(-0.1)], ["SIZE +", func(): _resize(0.1)], ["OPACITY −", func(): _fade(-0.1)], ["OPACITY +", func(): _fade(0.1)], ["RESET", _reset_layout]]:
				var eb := _button(String(item[0]))
				eb.custom_minimum_size = Vector2(96, 44)
				eb.add_theme_font_size_override("font_size", 14)
				bind(eb, item[1])
				_edit_bar.add_child(eb)
			add_child(_edit_bar)
		_edit_bar.visible = true
		toast("Drag a button to move it · tap one, then SIZE − / + · DONE saves")
	else:
		if _edit_bar:
			_edit_bar.visible = false
		_save_layout()
		set_mode(mode)

func _resize(by: float) -> void:
	if _picked:
		_picked.scale = Vector2.ONE * clampf(_picked.scale.x + by, 0.6, 1.8)

func _fade(by: float) -> void:
	hud_opacity = clampf(hud_opacity + by, 0.25, 1.0)
	_apply_opacity()

func _reset_layout() -> void:
	var btns := _layout_buttons()
	for id in _defaults:
		if btns.has(id):
			(btns[id] as Button).position = _defaults[id][0]
			(btns[id] as Button).scale = Vector2.ONE
	hud_opacity = 0.85
	_apply_opacity()

## a finger on a button while editing: picks it and drags it (bind() hands these over when the button has "editing")
func edit_touch(b: Button, rel: Vector2) -> void:
	_picked = b
	for o in _layout_buttons().values():
		(o as Button).modulate = Color(1, 1, 1, hud_opacity)
	b.modulate = Color(0.6, 1.0, 0.6, 1.0)
	b.position += rel
