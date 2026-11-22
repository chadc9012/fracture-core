extends Control
## Overwatch 2's hero select (owner Nov 18, interfaceingame.com Overwatch 2 "Hero Select"), before a Killbox match:
## the arena and mode across the top with the clock counting down; your operator in the middle wearing the frame you
## have picked, turning slowly; down the left the frame's class in big caps, what it is, its SUPER and its three
## grenades; the frames as portrait tiles along the bottom with LOCK IN. The pick is for this match only (the arena
## builds the operator with it; your saved character keeps its frame). `locked(frame)` on LOCK IN or when the clock
## runs out (it locks what's picked).
##   var h := HeroSelect.new(); h.arena = "Neon Rooftops"; h.mode = "Clash"; h.locked.connect(...)
signal locked(frame: String)

const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const Catalog := preload("res://scripts/character/catalog.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Rig := preload("res://scripts/character/character_rig.gd")
const Super := preload("res://scripts/combat/super_ability.gd")
const Grenades := preload("res://scripts/combat/grenades.gd")
const ORANGE := Color(0.98, 0.62, 0.1)   # Overwatch's lock-in orange
const CLOCK := 20.0
## what each super does, in a line (super_ability.gd has the numbers)
const SUPER_LINE := {
	"slam": "Leap and smash the ground: everything within 9 m takes heavy damage and is thrown back. Your shield refills.",
	"gun": "Draw a golden pistol of light: your next three shots hit six times as hard.",
	"nova": "Hurl a ball of void along your aim; it bursts 7 m wide where it lands.",
}
const ROLE := { "TITAN": "FRONTLINE", "HUNTER": "SKIRMISH", "WARLOCK": "CONTROL" }

var arena := ""
var mode := ""
var frame := "goliath"
var _left := CLOCK
var _done := false
var _class: Label
var _blurb: Label
var _role: Label
var _super_name: Label
var _super_line: Label
var _nades: HBoxContainer
var _tiles := {}
var _clock: Label
var _ring: Control
var _stage: Node3D
var _rig: Node3D
var _look: Dictionary

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_look = CharacterStore.load_look()
	frame = String(_look.get("frame", "goliath"))
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.04, 0.07)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# the operator, turning on a lit stage
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	svc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	svc.add_child(vp)
	_stage = Node3D.new()
	vp.add_child(_stage)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_CLEAR_COLOR
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.55, 0.6, 0.75)
	env.environment.ambient_light_energy = 0.6
	env.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_stage.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation = Vector3(deg_to_rad(-30), deg_to_rad(-35), 0)
	key.light_energy = 1.3
	_stage.add_child(key)
	var rim := OmniLight3D.new()
	rim.position = Vector3(0, 2.2, -2.0)
	rim.omni_range = 6.0
	rim.light_energy = 3.0
	rim.light_color = Color(0.6, 0.75, 1.0)
	_stage.add_child(rim)
	var cam := Camera3D.new()
	cam.fov = 30.0
	cam.position = Vector3(0, 1.0, 6.2)
	cam.look_at(Vector3(0, 0.75, 0))
	_stage.add_child(cam)
	cam.current = true
	# a floor glow under the operator
	var disc := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.55
	cyl.bottom_radius = 0.55
	cyl.height = 0.02
	disc.mesh = cyl
	var dm := StandardMaterial3D.new()
	dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	dm.albedo_color = Color(ORANGE.r, ORANGE.g, ORANGE.b, 0.35)
	disc.material_override = dm
	_stage.add_child(disc)

	# the top bar: where, what, the clock
	var top := HBoxContainer.new()
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 32
	top.offset_right = -32
	top.offset_top = 22
	top.add_theme_constant_override("separation", 14)
	add_child(top)
	var where := VBoxContainer.new()
	where.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	where.add_theme_constant_override("separation", 0)
	where.add_child(_label("KILLBOX  ·  " + mode.to_upper(), 700, 5, 13, ORANGE))
	where.add_child(_label(arena.to_upper(), 800, 3, 24, UiTheme.INK))
	top.add_child(where)
	var choose := _label("CHOOSE YOUR FRAME", 700, 6, 15, UiTheme.INK_DIM)
	choose.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	top.add_child(choose)
	_ring = Control.new()
	_ring.custom_minimum_size = Vector2(64, 64)
	_ring.draw.connect(_draw_ring)
	top.add_child(_ring)
	_clock = _label("", 800, 0, 22, UiTheme.INK)
	_clock.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_clock.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_ring.add_child(_clock)

	# the frame, down the left
	var info := VBoxContainer.new()
	info.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	info.offset_left = 40
	info.offset_top = 120
	info.offset_bottom = -170
	info.offset_right = 40 + minf(440.0, get_viewport_rect().size.x * 0.32)
	info.alignment = BoxContainer.ALIGNMENT_CENTER
	info.add_theme_constant_override("separation", 6)
	add_child(info)
	_role = _label("", 700, 5, 13, ORANGE)
	info.add_child(_role)
	_class = _label("", 900, 2, 76, UiTheme.INK)
	_class.add_theme_font_override("font", _slant(UiTheme.font(900, 2)))
	info.add_child(_class)
	_blurb = _label("", 400, 0, 19, Color(0.93, 0.94, 0.95, 0.85))
	_blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(_blurb)
	var gap := Control.new()
	gap.custom_minimum_size.y = 12
	info.add_child(gap)
	info.add_child(_label("SUPER", 700, 4, 12, UiTheme.INK_DIM))
	_super_name = _label("", 800, 3, 26, UiTheme.INK)
	info.add_child(_super_name)
	_super_line = _label("", 400, 0, 17, Color(0.93, 0.94, 0.95, 0.75))
	_super_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(_super_line)
	var gap2 := Control.new()
	gap2.custom_minimum_size.y = 8
	info.add_child(gap2)
	info.add_child(_label("GRENADES", 700, 4, 12, UiTheme.INK_DIM))
	_nades = HBoxContainer.new()
	_nades.add_theme_constant_override("separation", 8)
	info.add_child(_nades)

	# the frames along the bottom, LOCK IN beside them
	var bottom := HBoxContainer.new()
	bottom.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	bottom.offset_top = -136
	bottom.offset_bottom = -28
	bottom.grow_horizontal = Control.GROW_DIRECTION_BOTH
	bottom.add_theme_constant_override("separation", 10)
	bottom.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(bottom)
	for f in Catalog.frames():
		var id := String(f.id)
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 104)
		b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(func(): _pick(id))
		var v := VBoxContainer.new()
		v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		v.alignment = BoxContainer.ALIGNMENT_CENTER
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_theme_constant_override("separation", 2)
		var sup: Dictionary = Super.SUPERS.get(id, Super.SUPERS.goliath)
		var icon := _label(_glyph(String(f.class)), 700, 0, 30, sup.color)
		icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(icon)
		var cl := _label(String(f.class), 800, 4, 14, UiTheme.INK)
		cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(cl)
		b.add_child(v)
		bottom.add_child(b)
		_tiles[id] = b
	var spacer := Control.new()
	spacer.custom_minimum_size.x = 18
	bottom.add_child(spacer)
	var lock := Button.new()
	lock.text = "LOCK IN"
	lock.custom_minimum_size = Vector2(220, 104)
	lock.add_theme_font_override("font", _slant(UiTheme.font(900, 6)))
	lock.add_theme_font_size_override("font_size", 24)
	var on := UiTheme.box(ORANGE, ORANGE, 1, Vector4(16, 8, 16, 8))
	var hi := UiTheme.box(ORANGE.lightened(0.2), ORANGE, 1, Vector4(16, 8, 16, 8))
	lock.add_theme_stylebox_override("normal", on)
	lock.add_theme_stylebox_override("hover", hi)
	lock.add_theme_stylebox_override("focus", hi)
	lock.add_theme_stylebox_override("pressed", hi)
	for k in ["font_color", "font_hover_color", "font_focus_color", "font_pressed_color"]:
		lock.add_theme_color_override(k, Color(0.06, 0.05, 0.04))
	lock.pressed.connect(_lock)
	bottom.add_child(lock)
	lock.grab_focus.call_deferred()
	_pick(frame)

func _process(dt: float) -> void:
	if _rig:
		# a slow sway either side of facing you, as the hero stands on Overwatch's select
		_rig.rotation.y = 0.35 * sin(Time.get_ticks_msec() / 1000.0 * 0.6)
	if _done:
		return
	_left -= dt
	_clock.text = str(maxi(0, int(ceil(_left))))
	_clock.add_theme_color_override("font_color", ORANGE if _left <= 5.0 else UiTheme.INK)
	_ring.queue_redraw()
	if _left <= 0.0:
		_lock()

func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventKey and (e as InputEventKey).pressed):
		return
	var k := (e as InputEventKey).keycode
	var ids: Array = Catalog.frames().map(func(f): return String(f.id))
	if k in [KEY_LEFT, KEY_RIGHT]:
		_pick(String(ids[wrapi(ids.find(frame) + (1 if k == KEY_RIGHT else -1), 0, ids.size())]))
	elif k >= KEY_1 and k < KEY_1 + ids.size():
		_pick(String(ids[k - KEY_1]))
	elif k in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
		_lock()
	else:
		return
	get_viewport().set_input_as_handled()

func _pick(id: String) -> void:
	if _done:
		return
	frame = id
	var f: Dictionary = Catalog.find("frames", id)
	var sup: Dictionary = Super.SUPERS.get(id, Super.SUPERS.goliath)
	_role.text = "%s  ·  %s" % [String(ROLE.get(String(f.class), "")), String(f.label).to_upper()]
	_class.text = String(f.class)
	_blurb.text = String(f.blurb)
	_super_name.text = String(sup.name)
	_super_name.add_theme_color_override("font_color", sup.color)
	_super_line.text = String(SUPER_LINE.get(String(sup.kind), ""))
	for c in _nades.get_children():
		c.queue_free()
	for kind in Grenades.kinds_for(id):
		var g: Dictionary = Grenades.GRENADES[kind]
		var chip := PanelContainer.new()
		chip.add_theme_stylebox_override("panel", UiTheme.box(Color(g.color.r, g.color.g, g.color.b, 0.14), Color(g.color.r, g.color.g, g.color.b, 0.6), 1, Vector4(10, 4, 10, 4)))
		chip.add_child(_label(String(g.name).to_upper(), 700, 2, 14, UiTheme.INK))
		_nades.add_child(chip)
	for t in _tiles:
		var col: Color = Super.SUPERS.get(t, Super.SUPERS.goliath).color
		var sel: bool = t == id
		var st := UiTheme.box(Color(col.r, col.g, col.b, 0.22) if sel else Color(1, 1, 1, 0.05), ORANGE if sel else UiTheme.LINE, 3 if sel else 1, Vector4(8, 8, 8, 8))
		for k in ["normal", "hover", "pressed", "focus"]:
			(_tiles[t] as Button).add_theme_stylebox_override(k, st)
	# the operator in that frame
	if _rig:
		_rig.queue_free()
	var lk := _look.duplicate()
	lk.frame = id
	_rig = Rig.new()
	_stage.add_child(_rig)
	_rig.build(CharacterStore.clean(lk))
	_rig.rotation.y = 0.0

func _lock() -> void:
	if _done:
		return
	_done = true
	_left = 0.0
	_clock.text = "✓"
	locked.emit(frame)
	var tw := create_tween()
	tw.tween_interval(0.25)
	tw.tween_property(self, "modulate:a", 0.0, 0.3)
	tw.tween_callback(queue_free)

func _draw_ring() -> void:
	var c := _ring.size * 0.5
	var r := minf(c.x, c.y) - 3.0
	_ring.draw_arc(c, r, 0.0, TAU, 48, Color(1, 1, 1, 0.12), 3.0, true)
	var frac := clampf(_left / CLOCK, 0.0, 1.0)
	if frac > 0.0:
		_ring.draw_arc(c, r, -PI * 0.5, -PI * 0.5 + TAU * frac, 48, ORANGE if _left <= 5.0 else UiTheme.INK, 3.0, true)

## a mark per class, as Overwatch's role icons
static func _glyph(cls: String) -> String:
	return { "TITAN": "◆", "HUNTER": "▲", "WARLOCK": "●" }.get(cls, "◆")

static func _slant(f: Font) -> Font:
	var fv := FontVariation.new()
	fv.base_font = f
	fv.variation_transform = Transform2D(Vector2(1, 0), Vector2(0.2, 1), Vector2.ZERO)
	return fv

func _label(t: String, weight: int, spacing: int, px: int, c: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", c)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
