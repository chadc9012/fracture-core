extends Control
const Settings := preload("res://scripts/front/settings_store.gd")
## the Destiny-style look (scripts/ui/ui_theme.gd; owner Nov 18, interfaceingame.com Destiny 2): segmented hull, the gun's
## picture beside a big magazine count, a red edge vignette when hit, hairline capsule buttons, banner toasts
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const HULL_W := 220.0
const HULL_SEGS := 10
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
var _super := false
var _v_was := false
var _super_button: Button
var _super_meter: Control
var _super_hud := {}
var _cycle_grenade := false
var _grapple := false
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
		mis.add_theme_font_size_override("font_size", 13)
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
		ent.clip_text = false   # the prompt grows to fit ("TALK · MECHANIC")
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
		# a tap swaps; held, the weapon wheel opens and the finger's drag points at a gun (Cyberpunk / Apex circle menu)
		bind(nx, func():
			_swap_held = true
			_wheel_hold = 0.0
			_wheel_aim = Vector2.ZERO,
			func():
				_swap_held = false
				if _wheel_open():
					_close_wheel(true)
				else:
					_next = true,
			func(rel: Vector2): _wheel_aim += rel)
		add_child(nx)
		_swap_button = nx
		var gb := _button("GRENADE")
		gb.custom_minimum_size = Vector2(120, 64)
		gb.add_theme_font_size_override("font_size", 13)
		gb.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		gb.position = Vector2(-250, -240)
		bind(gb, func(): _grenade = true)
		add_child(gb)
		_grenade_button = gb
		var gr := _button("GRAPPLE")
		gr.custom_minimum_size = Vector2(120, 56)
		gr.add_theme_font_size_override("font_size", 13)
		gr.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		gr.position = Vector2(-250, -300)
		bind(gr, func(): _grapple = true)
		add_child(gr)
		_grapple_button = gr
		var cy := _button("⟳")
		cy.custom_minimum_size = Vector2(56, 64)
		cy.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		cy.position = Vector2(-316, -240)
		bind(cy, func(): _cycle_grenade = true)
		add_child(cy)
		_cycle_button = cy
		# the super: a round button above GRAPPLE wearing the meter round its edge (Destiny's super icon)
		var sp := _button("SUPER")
		sp.custom_minimum_size = Vector2(120, 56)
		sp.add_theme_font_size_override("font_size", 13)
		sp.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		sp.position = Vector2(-250, -372)
		bind(sp, func(): _super = true)
		add_child(sp)
		_super_button = sp
	_hud()
	if not touch_ui and not scripted:
		toast.call_deferred("Click to aim with the mouse · Esc frees the cursor")

## crosshair, the weapon's name and its magazine
func _hud() -> void:
	var cross := Control.new()
	cross.set_anchors_preset(Control.PRESET_CENTER)
	cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cross.draw.connect(func():
		# Destiny's reticle: four short ticks round a dot, each with a dark keyline so it reads on a bright sky
		var c := Color(1, 1, 1, 0.92)
		var k := Color(0, 0, 0, 0.45)
		for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
			cross.draw_line(d * 6.0, d * 13.0, k, 4.0)
		cross.draw_circle(Vector2.ZERO, 2.6, k)
		for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
			cross.draw_line(d * 6.5, d * 12.5, c, 1.6)
		cross.draw_circle(Vector2.ZERO, 1.5, c))
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
	# the gun's picture (ui/icons, tools/make_gear_icons.gd) left of the magazine count, as on Destiny's weapon slots
	_gun_icon = TextureRect.new()
	_gun_icon.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_gun_icon.position = Vector2(14, 56)
	_gun_icon.size = Vector2(76, 38)
	_gun_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_gun_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_gun_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_gun_icon.visible = false
	add_child(_gun_icon)
	_element_pip = Control.new()
	_element_pip.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_element_pip.position = Vector2(20, 42)
	_element_pip.size = Vector2(10, 10)
	_element_pip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_element_pip.visible = false
	_element_pip.draw.connect(func():
		_element_pip.draw_circle(Vector2(5, 5), 4.0, _element_col)
		_element_pip.draw_arc(Vector2(5, 5), 4.5, 0.0, TAU, 16, Color(0, 0, 0, 0.5), 1.0))
	add_child(_element_pip)
	weapon_name = Label.new()
	# the read-outs sit at the top left, out of the stick's way (owner, Nov 11: "add controls to screen")
	weapon_name.set_anchors_preset(Control.PRESET_TOP_LEFT)
	weapon_name.position = Vector2(20, 38)
	weapon_name.uppercase = true
	weapon_name.add_theme_font_override("font", UiTheme.font(600, 2))
	weapon_name.add_theme_font_size_override("font_size", 13)
	weapon_name.add_theme_color_override("font_color", UiTheme.INK)
	weapon_name.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	weapon_name.add_theme_constant_override("shadow_offset_y", 1)
	weapon_name.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
	weapon_name.add_theme_constant_override("outline_size", 6)
	weapon_name.mouse_filter = Control.MOUSE_FILTER_IGNORE
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
	ammo.position = Vector2(20, 56)
	ammo.add_theme_font_override("font", UiTheme.font(700, 0))
	ammo.add_theme_font_size_override("font_size", 30)
	ammo.add_theme_color_override("font_color", UiTheme.INK)
	ammo.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	ammo.add_theme_constant_override("shadow_offset_y", 1)
	ammo.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
	ammo.add_theme_constant_override("outline_size", 6)
	ammo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(ammo)
	# hit: Destiny reddens the screen's edges, not the whole picture (a shader vignette; `color.a` is how hard)
	hurt_flash = ColorRect.new()
	hurt_flash.color = Color(0.9, 0.1, 0.1, 0.0)
	hurt_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hurt_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = "shader_type canvas_item;\nvoid fragment() {\n\tvec2 q = UV - 0.5;\n\tfloat e = smoothstep(0.18, 0.62, length(q * vec2(1.0, 0.8)) * 1.25);\n\tCOLOR = vec4(COLOR.rgb, COLOR.a * (0.06 + 0.94 * e));\n}"
	var mat := ShaderMaterial.new()
	mat.shader = sh
	hurt_flash.material = mat
	add_child(hurt_flash)
	move_child(hurt_flash, 0)
	# hull: a segmented bar along the top left (Destiny's health bar); the shield rides above it as a thin line
	hull_back = ColorRect.new()
	hull_back.color = Color(0, 0, 0, 0.42)
	hull_back.set_anchors_preset(Control.PRESET_TOP_LEFT)
	hull_back.position = Vector2(20, 18)
	hull_back.size = Vector2(HULL_W, 10)
	hull_back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hull_back)
	hull_fill = ColorRect.new()
	hull_fill.color = Color(0.95, 0.96, 0.97)
	hull_fill.set_anchors_preset(Control.PRESET_TOP_LEFT)
	hull_fill.position = Vector2(20, 18)
	hull_fill.size = Vector2(HULL_W, 10)
	hull_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hull_fill)
	# the gaps between segments, cut over the fill (a child of the backing, so hiding the bar hides them)
	var cuts := Control.new()
	cuts.size = Vector2(HULL_W, 10)
	cuts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cuts.z_index = 1
	cuts.draw.connect(func():
		for i in range(1, HULL_SEGS):
			var x := HULL_W * float(i) / HULL_SEGS
			cuts.draw_rect(Rect2(x - 1.0, 0, 2.0, 10.0), Color(0.03, 0.04, 0.05, 0.9))
		cuts.draw_rect(Rect2(0, 0, HULL_W, 10), Color(1, 1, 1, 0.22), false, 1.0))
	hull_back.add_child(cuts)
	_prompt_label = Label.new()
	_prompt_label.set_anchors_preset(Control.PRESET_CENTER)
	_prompt_label.position = Vector2(-80, 120)
	_prompt_label.add_theme_font_size_override("font_size", 20)
	_prompt_label.modulate = Color(0.8, 0.95, 1.0)
	add_child(_prompt_label)
	# down: Destiny's "GUARDIAN DOWN" — wide-spaced caps over the red edges
	status = Label.new()
	status.set_anchors_preset(Control.PRESET_CENTER)
	status.position = Vector2(-200, -130)
	status.custom_minimum_size = Vector2(400, 44)
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.add_theme_font_override("font", UiTheme.font(700, 6))
	status.add_theme_font_size_override("font_size", 30)
	status.add_theme_color_override("font_color", Color(1.0, 0.36, 0.32))
	status.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.75))
	status.add_theme_constant_override("shadow_offset_y", 2)
	status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(status)

var _gun_icon: TextureRect
var _element_pip: Control
var _element_col := Color.WHITE
var _loadout_key := ""
var _icons := {}

## the gun in hand, for its picture and element pip (gunplay.step hands this over every frame; cheap when unchanged)
func show_loadout(frame: String, element := "") -> void:
	var key := frame + "|" + element + "|" + mode
	if key == _loadout_key:
		return
	_loadout_key = key
	var tex: Texture2D = null
	if frame != "" and mode == "foot":
		if not _icons.has(frame):
			var path := "res://ui/icons/weapon-%s.png" % frame
			# the icons are square with the gun across the middle: show only that 2:1 band
			var at: AtlasTexture = null
			if ResourceLoader.exists(path):
				var full: Texture2D = load(path)
				at = AtlasTexture.new()
				at.atlas = full
				var w := float(full.get_width())
				at.region = Rect2(0, w * 0.25, w, w * 0.5)
			_icons[frame] = at
		tex = _icons[frame]
	_gun_icon.texture = tex
	_gun_icon.visible = tex != null
	ammo.position.x = 96.0 if tex else 20.0
	_element_col = UiTheme.element_color(element) if element != "" else Color(0, 0, 0, 0)
	_element_pip.visible = tex != null and element != ""
	_element_pip.queue_redraw()
	weapon_name.position.x = 34.0 if _element_pip.visible else 20.0

## the hull read-out: `frac` 0..1, `hurt` 0..1 fades the wash, `down_left` seconds until the operator stands (0 = up)
func show_hull(frac: float, hurt: float, down_left: float, shield := -1.0) -> void:
	hull_fill.size.x = HULL_W * clampf(frac, 0.0, 1.0)
	# the energy shield: a thin bright line over the hull's (asset catalog §5)
	if shield >= 0.0:
		if not _shield_fill:
			_shield_fill = ColorRect.new()
			_shield_fill.color = Color(0.55, 0.85, 1.0)
			_shield_fill.set_anchors_preset(Control.PRESET_TOP_LEFT)
			_shield_fill.position = Vector2(20, 12)
			_shield_fill.size = Vector2(HULL_W, 3)
			_shield_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
			add_child(_shield_fill)
		_shield_fill.size.x = HULL_W * clampf(shield, 0.0, 1.0)
		_shield_fill.visible = hull_fill.visible
	# white while healthy, Destiny's red under a third
	hull_fill.color = Color(0.95, 0.96, 0.97) if frac > 0.35 else Color(0.95, 0.3, 0.26)
	hurt_flash.color.a = 0.35 * clampf(hurt, 0.0, 1.0) + (0.45 if down_left > 0.0 else 0.0)
	status.text = ("DOWN  ·  %d" % ceili(down_left)) if down_left > 0.0 else ""

var _toast: Label
var _toast_t := 0.0
## a line at the top of the screen for a few seconds (a pickup, a message)
## a message across the top. Two in the same moment used to overwrite each other (a quest's "complete · +XP · +Nex"
## was replaced by the next quest's title in the same frame and never seen): now each stays at least MIN_TOAST seconds
## and the next waits its turn; the same line twice is shown once.
const MIN_TOAST := 2.2
var _toast_queue: Array[String] = []

func toast(text: String) -> void:
	# Destiny's two special notices (Progression.grant's lines; the views toast every line): a level-up gets the big
	# centred banner, a drop gets an "acquired" card down the left side
	if text.begins_with("LEVEL ") and text.find(" — ") > 0:
		_level_up(text)
		return
	if text.begins_with("LOOT · "):
		_acquired(text.substr(7))
		return
	if text.begins_with("TRIUMPH · "):
		_acquired(text.substr(10), "TRIUMPH", UiTheme.GOLD)
		return
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
		# Destiny's notification banner: a dark strip, a gold rule along its top, light caps text
		var sb := UiTheme.box(Color(0.03, 0.04, 0.055, 0.78), Color(0, 0, 0, 0), 0, Vector4(18, 9, 18, 10))
		sb.border_width_top = 2
		sb.border_color = UiTheme.GOLD
		_toast.add_theme_stylebox_override("normal", sb)
		_toast.add_theme_font_override("font", UiTheme.font(600, 1))
		_toast.add_theme_font_size_override("font_size", 16)
		_toast.add_theme_color_override("font_color", Color(0.98, 0.93, 0.78))
		add_child(_toast)
	# a banner, not a full-width bar: centred, at most 620 px wide
	var side := maxf(24.0, (size.x - 620.0) * 0.5)
	_toast.offset_left = side
	_toast.offset_right = -side
	_toast.text = text
	_toast.visible = true
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
		_enter_button.text = text.to_upper()
		_enter_button.visible = text != ""
		return
	if not _prompt_label:
		_prompt_label = Label.new()
		_prompt_label.set_anchors_preset(Control.PRESET_CENTER)
		_prompt_label.position = Vector2(-150, 60)
		_prompt_label.custom_minimum_size = Vector2(300, 30)
		_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_prompt_label.add_theme_font_override("font", UiTheme.font(600, 2))
		_prompt_label.add_theme_font_size_override("font_size", 15)
		_prompt_label.add_theme_color_override("font_color", UiTheme.INK)
		_prompt_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
		_prompt_label.add_theme_constant_override("shadow_offset_y", 1)
		add_child(_prompt_label)
	# Destiny's interact prompt: the key in brackets, then the action in caps
	_prompt_label.text = ("[E]   " + text.to_upper()) if text != "" else ""

## the simple phone HUD (settings "simple_hud", the owner's ask): stick, FIRE, JUMP and ENTER only — sprint is the stick
## pushed to its edge, a tap on the weapon's name swaps, an empty magazine reloads itself (gunplay does that on the pull)
func simple() -> bool:
	return touch_ui and bool(Settings.get_value("simple_hud"))

func set_mode(m: String) -> void:
	mode = m
	if _gun_icon and m != "foot":
		_loadout_key = ""
		_gun_icon.visible = false
		_element_pip.visible = false
		ammo.position.x = 20.0
		weapon_name.position.x = 20.0
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
	for b in [_reload_button, _swap_button, _grenade_button, _cycle_button, _grapple_button, _super_button]:
		if b:
			b.visible = not drive and not fly and weapons_out and not simple()
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

func take_super() -> bool:
	var s := _super
	_super = false
	return s

## Destiny's super meter: a thin gold bar under the hull (full: it glows and says SUPER READY · V / on the button); while
## the Golden Gun is live the bar shows the shots left. {} hides it
func show_super(h: Dictionary) -> void:
	_super_hud = h
	if not _super_meter:
		_super_meter = Control.new()
		_super_meter.set_anchors_preset(Control.PRESET_TOP_LEFT)
		_super_meter.position = Vector2(20, 31)
		_super_meter.size = Vector2(HULL_W, 14)
		_super_meter.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_super_meter.draw.connect(func():
			if _super_hud.is_empty():
				return
			var f := float(_super_hud.charge)
			var col: Color = _super_hud.color
			var ready := f >= 1.0
			_super_meter.draw_rect(Rect2(0, 0, HULL_W, 3), Color(0, 0, 0, 0.45))
			var a := 0.65 + 0.35 * sin(Time.get_ticks_msec() / 160.0) if ready else 0.9
			_super_meter.draw_rect(Rect2(0, 0, HULL_W * clampf(f, 0.0, 1.0), 3), Color(col.r, col.g, col.b, a))
			if bool(_super_hud.active):
				var font := UiTheme.font(700, 2)
				_super_meter.draw_string(font, Vector2(HULL_W + 8, 8), "%s  ×%d" % [String(_super_hud.name), int(_super_hud.shots)], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)
			elif ready and not touch_ui:
				_super_meter.draw_string(UiTheme.font(700, 2), Vector2(HULL_W + 8, 8), "SUPER READY  ·  V", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col))
		add_child(_super_meter)
	_super_meter.visible = mode == "foot" and not h.is_empty()
	_super_meter.queue_redraw()
	if _super_button:
		if h.is_empty():
			_super_button.visible = false
		else:
			var full := float(h.charge) >= 1.0
			_super_button.text = (String(h.name).get_slice(" ", 0) + " ◆") if full else "SUPER %d%%" % int(float(h.charge) * 100.0)
			_super_button.modulate = Color(1.3, 1.15, 0.8) if full else Color(1, 1, 1, 0.85)

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
		grenade_label.add_theme_font_override("font", UiTheme.font(600, 1))
		grenade_label.add_theme_font_size_override("font_size", 13)
		grenade_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.55))
		grenade_label.add_theme_constant_override("outline_size", 5)
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
	c.draw.connect(func(): c.draw_circle(Vector2(r, r), r, Color(0.03, 0.04, 0.055, col.a * 2.4)); c.draw_arc(Vector2(r, r), r - 1.0, 0.0, TAU, 64, Color(1, 1, 1, 0.45), 1.5))
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
	b.clip_text = true
	# Destiny-style touch buttons: dark glass capsules with a hairline, wide-spaced caps; pressed fills white
	b.add_theme_font_override("font", UiTheme.font(600, 2))
	b.add_theme_font_size_override("font_size", 15)
	var normal := UiTheme.box(Color(0.03, 0.04, 0.055, 0.5), Color(1, 1, 1, 0.4), 1, Vector4(8, 6, 8, 6))
	normal.set_corner_radius_all(64)
	normal.anti_aliasing = true
	var pressed := UiTheme.box(Color(0.95, 0.96, 0.97, 0.92), Color(1, 1, 1, 0.9), 1, Vector4(8, 6, 8, 6))
	pressed.set_corner_radius_all(64)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", normal)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_color_override("font_color", UiTheme.INK)
	b.add_theme_color_override("font_hover_color", UiTheme.INK)
	b.add_theme_color_override("font_pressed_color", Color(0.05, 0.06, 0.08))
	# a radius past half the short side leaves a seam down a round button: fit it to the button's size
	var fit := func():
		var sz := b.size.max(b.custom_minimum_size)
		var r := int(minf(sz.x, sz.y) * 0.44)
		normal.set_corner_radius_all(r)
		pressed.set_corner_radius_all(r)
	b.resized.connect(fit)
	b.ready.connect(fit)
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
	# holding SWAP on the phone opens the weapon wheel; the drag aims it
	if _swap_held:
		_wheel_hold += _dt
		if _wheel_hold >= WHEEL_HOLD and not _wheel_open():
			_open_wheel()
	if _wheel_open():
		_wheel_aim = _wheel_aim.limit_length(220.0)
		_wheel.queue_redraw()
		look_delta = Vector2.ZERO
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
			_toast.visible = false
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
	# Q: a tap swaps to the next gun; held, it opens the weapon wheel and letting go equips what the mouse points at
	var q := Input.is_key_pressed(KEY_Q)
	if q and not _q_was:
		_wheel_hold = 0.0
		_wheel_aim = Vector2.ZERO
	if q:
		_wheel_hold += get_process_delta_time()
		if _wheel_hold >= WHEEL_HOLD and not _wheel_open():
			_open_wheel()
	if not q and _q_was:
		if _wheel_open():
			_close_wheel(true)
		else:
			_next = true
	_q_was = q
	if Input.is_key_pressed(KEY_J) and not _j_was:
		_grenade = true
	_j_was = Input.is_key_pressed(KEY_J)
	if Input.is_key_pressed(KEY_V) and not _v_was:
		_super = true
	_v_was = Input.is_key_pressed(KEY_V)
	if Input.is_key_pressed(KEY_K) and not _k_was:
		_cycle_grenade = true
	_k_was = Input.is_key_pressed(KEY_K)
	if Input.is_key_pressed(KEY_G) and not _g_was:
		_grapple = true
	_g_was = Input.is_key_pressed(KEY_G)
	if Input.is_key_pressed(KEY_E) and not _e_was:
		_enter = true
	_e_was = Input.is_key_pressed(KEY_E)
	if Input.is_key_pressed(KEY_F) and not _f_was:
		_missiles = true
	_f_was = Input.is_key_pressed(KEY_F)
var _e_was := false
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
		if _wheel_open():
			_wheel_aim += (event as InputEventMouseMotion).relative
			_wheel_aim = _wheel_aim.limit_length(220.0)
			_wheel.queue_redraw()
		else:
			look_delta += (event as InputEventMouseMotion).relative
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			fire = mb.pressed
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

# --------------------------------------------------------------------------------------- level up / acquired
var _level_banner: Control
var _acquired_col: VBoxContainer

## "LEVEL 7 — +2 power, +4 hull" as Destiny's level-up: gold rules opening out, LEVEL UP, the number, what it gave
func _level_up(text: String) -> void:
	var parts := text.split(" — ", true, 1)
	var num := parts[0].substr(6).strip_edges()
	var gave := parts[1].replace(", ", "   ·   ").to_upper() if parts.size() > 1 else ""
	if _level_banner:
		_level_banner.queue_free()
	var b := Control.new()
	b.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	b.offset_top = 270   # under the toast strip (offset 190)
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(b)
	_level_banner = b
	var rule_l := ColorRect.new()
	var rule_r := ColorRect.new()
	for r in [rule_l, rule_r]:
		r.color = UiTheme.GOLD
		r.size = Vector2(0, 2)
		r.position = Vector2(0, 24)
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(r)
	var cap := _banner_label("LEVEL UP", 600, 6, 15, UiTheme.GOLD)
	cap.position = Vector2(-150, 12)
	b.add_child(cap)
	var big := _banner_label(num, 700, 0, 64, UiTheme.INK)
	big.position = Vector2(-150, 34)
	b.add_child(big)
	var sub := _banner_label(gave, 600, 2, 13, UiTheme.INK_DIM)
	sub.position = Vector2(-150, 112)
	b.add_child(sub)
	b.modulate.a = 0.0
	var tw := b.create_tween()
	tw.tween_property(b, "modulate:a", 1.0, 0.25)
	tw.parallel().tween_method(func(w: float):
		rule_l.size.x = w
		rule_l.position.x = -84.0 - w
		rule_r.size.x = w
		rule_r.position.x = 84.0, 0.0, 170.0, 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_interval(3.2)
	tw.tween_property(b, "modulate:a", 0.0, 0.6)
	tw.tween_callback(func():
		if _level_banner == b:
			_level_banner = null
		b.queue_free())

func _banner_label(t: String, weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.custom_minimum_size = Vector2(300, 0)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.5))
	l.add_theme_constant_override("outline_size", 6)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

## "Void Sceptre (183 power)" as a Destiny pickup card down the left: a coloured edge, ACQUIRED, the name, the power
func _acquired(what: String, caption := "ACQUIRED", edge := Color(0, 0, 0, 0)) -> void:
	if not _acquired_col:
		_acquired_col = VBoxContainer.new()
		_acquired_col.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
		_acquired_col.offset_left = 20
		_acquired_col.offset_top = -40
		_acquired_col.add_theme_constant_override("separation", 6)
		_acquired_col.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(_acquired_col)
	var power := ""
	var name := what
	var at := what.rfind(" (")
	if at > 0 and what.ends_with(" power)"):
		name = what.substr(0, at)
		power = what.substr(at + 2, what.length() - at - 8)
	var card := PanelContainer.new()
	var sb := UiTheme.box(Color(0.03, 0.04, 0.055, 0.78), Color(0, 0, 0, 0), 0, Vector4(12, 7, 16, 8))
	sb.border_width_left = 3
	sb.border_color = UiTheme.rarity_color("epic") if edge.a == 0.0 else edge
	card.add_theme_stylebox_override("panel", sb)
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)
	card.add_child(col)
	var cap := Label.new()
	cap.text = caption
	cap.add_theme_font_override("font", UiTheme.font(600, 3))
	cap.add_theme_font_size_override("font_size", 10)
	cap.add_theme_color_override("font_color", UiTheme.INK_DIM)
	col.add_child(cap)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	col.add_child(row)
	var nm := Label.new()
	nm.text = name.to_upper()
	nm.add_theme_font_override("font", UiTheme.font(700, 1))
	nm.add_theme_font_size_override("font_size", 15)
	row.add_child(nm)
	if power != "":
		var pw := Label.new()
		pw.text = "◆ " + power
		pw.add_theme_font_override("font", UiTheme.font(600, 0))
		pw.add_theme_font_size_override("font_size", 14)
		pw.add_theme_color_override("font_color", UiTheme.GOLD)
		row.add_child(pw)
	_acquired_col.add_child(card)
	while _acquired_col.get_child_count() > 4:
		_acquired_col.get_child(0).free()
	card.modulate.a = 0.0
	var tw := card.create_tween()
	tw.tween_property(card, "modulate:a", 1.0, 0.2)
	tw.tween_interval(4.0)
	tw.tween_property(card, "modulate:a", 0.0, 0.5)
	tw.tween_callback(card.queue_free)

# ---------------------------------------------------------------------------------------------- new mission
var _mission_card: Control

## Destiny's "New mission" card (owner Nov 18): a gold kicker with the chapter's code, the title in wide caps between
## two rules, the chapter's opening line under it; holds a few seconds and fades. The story calls it as a chapter begins.
func mission_card(kicker: String, title: String, line := "") -> void:
	# a celebration on screen goes first; the next chapter's card waits for it
	var wait := (_celebrate_until - Time.get_ticks_msec()) / 1000.0
	if wait > 0.0 and is_inside_tree():
		get_tree().create_timer(wait).timeout.connect(func(): mission_card(kicker, title, line))
		return
	if _mission_card:
		_mission_card.queue_free()
	var b := VBoxContainer.new()
	b.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	b.offset_top = 300   # clear of the toast strip (190) and the crosshair
	b.offset_left = -360
	b.offset_right = 360
	b.alignment = BoxContainer.ALIGNMENT_BEGIN
	b.add_theme_constant_override("separation", 8)
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(b)
	_mission_card = b
	var k := _banner_label(kicker.to_upper(), 600, 5, 14, UiTheme.GOLD)
	k.custom_minimum_size.x = 720
	b.add_child(k)
	var top := ColorRect.new()
	top.color = Color(1, 1, 1, 0.5)
	top.custom_minimum_size = Vector2(0, 2)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(top)
	var t := _banner_label(title.to_upper(), 700, 8, 40, UiTheme.INK)
	t.custom_minimum_size.x = 720
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.add_child(t)
	var bottom := ColorRect.new()
	bottom.color = Color(1, 1, 1, 0.5)
	bottom.custom_minimum_size = Vector2(0, 2)
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(bottom)
	if line != "":
		var l := _banner_label(line, 400, 0, 17, Color(0.93, 0.94, 0.95, 0.85))
		l.custom_minimum_size.x = 720
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.add_child(l)
	# the rules draw in from the middle
	for r in [top, bottom]:
		(r as ColorRect).size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		(r as ColorRect).custom_minimum_size.x = 0.0
	b.modulate.a = 0.0
	var tw := b.create_tween()
	tw.tween_property(b, "modulate:a", 1.0, 0.35)
	tw.parallel().tween_method(func(w: float):
		top.custom_minimum_size.x = w
		bottom.custom_minimum_size.x = w, 0.0, 520.0, 0.7).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_interval(4.2)
	tw.tween_property(b, "modulate:a", 0.0, 0.8)
	tw.tween_callback(func():
		if _mission_card == b:
			_mission_card = null
		b.queue_free())

# ---------------------------------------------------------------------------------------------- weapon wheel
## Cyberpunk 2077's / Apex Legends' circle menu (owner Nov 18, interfaceingame.com): the carried guns round a ring, each
## with its picture; the mouse (or the finger held on SWAP) points at one, letting go equips it. gunplay feeds the list
## (set_wheel) and takes the pick (take_wheel_pick).
const WHEEL_HOLD := 0.28
const WHEEL_R := 190.0
var _wheel_guns: Array = []
var _wheel_current := 0
var _wheel_pick := -1
var _wheel_hold := 0.0
var _wheel_aim := Vector2.ZERO
var _swap_held := false
var _wheel: Control

func set_wheel(list: Array, current: int) -> void:
	_wheel_guns = list
	_wheel_current = current

func take_wheel_pick() -> int:
	var p := _wheel_pick
	_wheel_pick = -1
	return p

func _wheel_open() -> bool:
	return _wheel != null and _wheel.visible

## the slice the aim points at (-1 near the middle)
func _wheel_slot() -> int:
	var n := _wheel_guns.size()
	if n == 0 or _wheel_aim.length() < 24.0:
		return -1
	var a := fposmod(_wheel_aim.angle() + PI * 0.5 + PI / n, TAU)
	return int(a / (TAU / n)) % n

func _open_wheel() -> void:
	if _wheel_guns.size() < 2 or mode != "foot":
		return
	if not _wheel:
		_wheel = Control.new()
		_wheel.set_anchors_preset(Control.PRESET_CENTER)
		_wheel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_wheel.draw.connect(_draw_wheel)
		_wheel.z_index = 10
		add_child(_wheel)
	_wheel.visible = true
	if crosshair:
		crosshair.visible = false
	_wheel.queue_redraw()

func _close_wheel(pick: bool) -> void:
	if not _wheel:
		return
	var s := _wheel_slot()
	if pick and s >= 0:
		_wheel_pick = s
	_wheel.visible = false
	if crosshair:
		crosshair.visible = mode == "foot" and weapons_out

func _draw_wheel() -> void:
	var n := _wheel_guns.size()
	if n == 0:
		return
	var sel := _wheel_slot()
	_wheel.draw_circle(Vector2.ZERO, WHEEL_R + 70.0, Color(0.01, 0.015, 0.03, 0.82))
	_wheel.draw_arc(Vector2.ZERO, WHEEL_R + 70.0, 0.0, TAU, 96, Color(1, 1, 1, 0.18), 1.5, true)
	_wheel.draw_arc(Vector2.ZERO, 56.0, 0.0, TAU, 64, Color(1, 1, 1, 0.25), 1.5, true)
	var step := TAU / n
	for i in n:
		var mid := -PI * 0.5 + i * step
		var on := i == sel
		# the slice: an arc band, lit when pointed at
		var band := Color(1, 1, 1, 0.16) if on else Color(1, 1, 1, 0.05)
		_wheel.draw_arc(Vector2.ZERO, WHEEL_R, mid - step * 0.45, mid + step * 0.45, 32, band, 120.0, true)
		_wheel.draw_arc(Vector2.ZERO, WHEEL_R + 60.0, mid - step * 0.45, mid + step * 0.45, 32, UiTheme.GOLD if on else (UiTheme.INK if i == _wheel_current else Color(1, 1, 1, 0.3)), 3.0 if on else 1.5, true)
		var g: Dictionary = _wheel_guns[i]
		var c := Vector2(cos(mid), sin(mid)) * WHEEL_R
		var tex: Texture2D = null
		var f := String(g.frame)
		if not _icons.has(f):
			var path := "res://ui/icons/weapon-%s.png" % f
			_icons[f] = null
			if ResourceLoader.exists(path):
				var full: Texture2D = load(path)
				var at := AtlasTexture.new()
				at.atlas = full
				var w := float(full.get_width())
				at.region = Rect2(0, w * 0.25, w, w * 0.5)
				_icons[f] = at
		tex = _icons[f]
		if tex:
			_wheel.draw_texture_rect(tex, Rect2(c - Vector2(66, 33) + Vector2(0, -8), Vector2(132, 66)), false, Color(1, 1, 1, 1.0 if on else 0.75))
		var font := UiTheme.font(700, 1)
		var label := String(g.label).to_upper()
		var w2 := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		_wheel.draw_string(font, c + Vector2(-w2 * 0.5, 40), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, UiTheme.GOLD if on else UiTheme.INK)
	# the middle: what letting go will equip
	var mid_text := "LET GO TO EQUIP" if sel >= 0 else "POINT AT A WEAPON"
	var mf := UiTheme.font(600, 2)
	var mw := mf.get_string_size(mid_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
	_wheel.draw_string(mf, Vector2(-mw * 0.5, 4), mid_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, UiTheme.INK_DIM)

# ---------------------------------------------------------------------------------------------- kill medals
var _medal: Control

## Valorant's kill callout under the crosshair: a word in wide caps with a thin rule either side and a line under it;
## pops in, holds a moment, fades. A new one replaces the last.
func medal(word: String, line := "", col := Color(1.0, 0.82, 0.35)) -> void:
	if _medal:
		_medal.queue_free()
	var v := VBoxContainer.new()
	v.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	v.offset_left = -220
	v.offset_right = 220
	v.offset_top = 70
	v.add_theme_constant_override("separation", 0)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(v)
	_medal = v
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 12)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(h)
	for i in 3:
		if i == 1:
			var w := _banner_label(word, 700, 6, 22, col)
			w.custom_minimum_size.x = 0
			h.add_child(w)
		else:
			var r := ColorRect.new()
			r.color = Color(col.r, col.g, col.b, 0.7)
			r.custom_minimum_size = Vector2(40, 2)
			r.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			r.mouse_filter = Control.MOUSE_FILTER_IGNORE
			h.add_child(r)
	if line != "":
		var l := _banner_label(line, 600, 4, 12, Color(0.93, 0.94, 0.95, 0.85))
		l.custom_minimum_size.x = 440
		v.add_child(l)
	v.pivot_offset = Vector2(220, 14)
	v.scale = Vector2(1.35, 1.35)
	v.modulate.a = 0.0
	var tw := v.create_tween()
	tw.tween_property(v, "modulate:a", 1.0, 0.08)
	tw.parallel().tween_property(v, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(1.1)
	tw.tween_property(v, "modulate:a", 0.0, 0.35)
	tw.tween_callback(func():
		if _medal == v:
			_medal = null
		v.queue_free())

# ---------------------------------------------------------------------------------------------- enemy leader
## The Division 2's named-enemy banner (owner Nov 18): ENEMY LEADER DETECTED (red) when a boss appears, ENEMY LEADER
## DEFEATED (gold) when it falls — a strip across the top with the name in wide caps, a skull-diamond mark either side
func leader(boss_name: String, detected := true) -> void:
	var col := Color(1.0, 0.36, 0.32) if detected else UiTheme.GOLD
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	root.offset_left = -330
	root.offset_right = 330
	root.offset_top = 300   # under the toast strip, where a fight's own banners go
	root.add_theme_constant_override("separation", 2)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	var head := HBoxContainer.new()
	head.alignment = BoxContainer.ALIGNMENT_CENTER
	head.add_theme_constant_override("separation", 12)
	head.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(head)
	for i in 3:
		if i == 1:
			var cap := _banner_label("ENEMY LEADER DETECTED" if detected else "ENEMY LEADER DEFEATED", 700, 5, 13, col)
			cap.custom_minimum_size.x = 0
			head.add_child(cap)
		else:
			var m := _banner_label("◆", 700, 0, 12, col)
			m.custom_minimum_size.x = 0
			head.add_child(m)
	var bar := ColorRect.new()
	bar.color = Color(col.r, col.g, col.b, 0.55)
	bar.custom_minimum_size = Vector2(0, 2)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bar)
	var nm := _banner_label(boss_name.to_upper(), 700, 6, 30, UiTheme.INK)
	nm.custom_minimum_size.x = 660
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(nm)
	root.modulate.a = 0.0
	var tw := root.create_tween()
	tw.tween_property(root, "modulate:a", 1.0, 0.3)
	tw.parallel().tween_property(bar, "custom_minimum_size:x", 660.0, 0.5).from(0.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_interval(3.0)
	tw.tween_property(root, "modulate:a", 0.0, 0.6)
	tw.tween_callback(root.queue_free)

# ---------------------------------------------------------------------------------------------- mission complete
var _celebrate_until := 0

## the moment a job is done (owner Nov 18, interfaceingame.com: The Division 2 "Summary", Watch Dogs: Legion
## "Celebration"): MISSION COMPLETE / CHAPTER COMPLETE in gold wide caps, the job's name, what it paid; a burst of thin
## rays behind it. Holds ~3 s; a mission card asked for meanwhile waits its turn.
func celebrate(word: String, title: String, line := "") -> void:
	_celebrate_until = Time.get_ticks_msec() + 3400
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	root.offset_top = 260
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	var rays := Control.new()
	rays.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var spin := [0.0]
	rays.draw.connect(func():
		for i in 24:
			var a: float = float(spin[0]) + i * TAU / 24.0
			var d := Vector2(cos(a), sin(a) * 0.45)
			rays.draw_line(d * 90.0, d * (230.0 + 40.0 * float(i % 3)), Color(UiTheme.GOLD.r, UiTheme.GOLD.g, UiTheme.GOLD.b, 0.16), 2.0, true))
	rays.position = Vector2(0, 52)
	root.add_child(rays)
	var v := VBoxContainer.new()
	v.position = Vector2(-360, 0)
	v.custom_minimum_size.x = 720
	v.add_theme_constant_override("separation", 4)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(v)
	var w := _banner_label(word.to_upper(), 700, 10, 40, UiTheme.GOLD)
	w.custom_minimum_size.x = 720
	v.add_child(w)
	var t := _banner_label(title.to_upper(), 700, 4, 18, UiTheme.INK)
	t.custom_minimum_size.x = 720
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(t)
	if line != "":
		var l := _banner_label(line.to_upper(), 700, 3, 15, UiTheme.INK)
		l.custom_minimum_size.x = 720
		v.add_child(l)
	root.modulate.a = 0.0
	w.pivot_offset = Vector2(360, 24)
	w.scale = Vector2(1.3, 1.3)
	var tw := root.create_tween()
	tw.tween_property(root, "modulate:a", 1.0, 0.25)
	tw.parallel().tween_property(w, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_method(func(a: float):
		spin[0] = a
		rays.queue_redraw(), 0.0, 0.6, 3.4)
	tw.tween_interval(2.4)
	tw.tween_property(root, "modulate:a", 0.0, 0.6)
	tw.tween_callback(root.queue_free)
