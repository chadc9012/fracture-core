extends Control
## The Planetary Director's globe: the canon "12 Continents, 7 Oceans" board on a sphere you spin (drag), zoom (pinch, wheel,
## the buttons) and tap. A pin on every continent (cyan: flights open, gold: make landfall first, grey: on the map only), the
## air routes, the seven oceans' names. Tapping a continent turns the globe to it; tapping it again, or OPEN MAP, opens its
## region map. Under the globe: the continent's card (its places, status and map) and the strip of all twelve.

signal open_map(map_id: String)

const START_WORLD := "aetheria"
const PIN_OPEN := Color("#7ee8ff")
const PIN_LANDFALL := Color("#ffc860")
const PIN_MAP := Color("#8a97a3")

var selected := "nexus-city"
var here := "nexus-city"

var _vp: SubViewport
var _cam: Camera3D
var _globe: Node3D
var _overlay: Control
var _pins := {}
var _ocean_labels := {}
var _card: VBoxContainer
var _body: BoxContainer
var _side: VBoxContainer
var _strip: HBoxContainer
var _cam_dir := Vector3(0, 0, -1)
var _dist := 3.7
var _goal: Variant = null
var _touches := {}
var _pinch_d := 0.0
var _press_at := Vector2.ZERO
var _press_t := 0
var _moved := 0.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.add_theme_constant_override("separation", 0)
	add_child(col)
	col.add_child(_header())
	# the body: globe and card side by side in landscape, stacked in portrait
	_body = BoxContainer.new()
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 0)
	col.add_child(_body)
	var globe_area := Control.new()
	globe_area.size_flags_vertical = Control.SIZE_EXPAND_FILL
	globe_area.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	globe_area.size_flags_stretch_ratio = 1.6
	globe_area.clip_contents = true
	_body.add_child(globe_area)
	_build_globe(globe_area)
	_side = VBoxContainer.new()
	_side.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_side.add_theme_constant_override("separation", 0)
	_body.add_child(_side)
	_side.add_child(_build_strip())
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var cardbox := PanelContainer.new()
	cardbox.add_theme_stylebox_override("panel", Data.box(Data.PANEL, Data.RULE, 0))
	cardbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cardbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.add_child(cardbox)
	_card = VBoxContainer.new()
	_card.add_theme_constant_override("separation", 6)
	cardbox.add_child(_card)
	_side.add_child(scroll)
	resized.connect(_layout)
	_layout()
	var start = Data.continent(here)
	if not start.is_empty():
		_cam_dir = Data.lat_lon_to_vec(start.lat, start.lon)
	_refresh()

func _layout() -> void:
	var landscape := size.x > size.y * 1.15
	_body.vertical = not landscape
	_side.custom_minimum_size = Vector2(minf(460.0, size.x * 0.38), 0) if landscape else Vector2(0, size.y * 0.36)
	_side.size_flags_horizontal = Control.SIZE_FILL if landscape else Control.SIZE_EXPAND_FILL
	_side.size_flags_vertical = Control.SIZE_EXPAND_FILL if landscape else Control.SIZE_FILL

func _header() -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Data.box(Data.BG, Data.RULE, 0))
	var h := HBoxContainer.new()
	p.add_child(h)
	var t := VBoxContainer.new()
	t.add_theme_constant_override("separation", 0)
	var a := Data.label("WORLD FRACTURE", 20)
	t.add_child(a)
	t.add_child(Data.label("PLANETARY DIRECTOR · ONE WORLD · MANY REALITIES", 11, Data.MUTED))
	h.add_child(t)
	return p

## the twelve continents as chips, the board's list (scrolls sideways on a phone)
func _build_strip() -> Control:
	var s := ScrollContainer.new()
	s.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	s.custom_minimum_size = Vector2(0, 56)
	_strip = HBoxContainer.new()
	_strip.add_theme_constant_override("separation", 6)
	s.add_child(_strip)
	for c in Data.continents():
		var b := Data.button("%d  %s" % [c.n, c.name])
		b.add_theme_font_size_override("font_size", 13)
		b.pressed.connect(select.bind(c.id))
		b.set_meta("id", c.id)
		_strip.add_child(b)
	return s

func _build_globe(area: Control) -> void:
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.set_anchors_preset(Control.PRESET_FULL_RECT)
	svc.mouse_filter = Control.MOUSE_FILTER_STOP
	svc.gui_input.connect(_globe_input)
	area.add_child(svc)
	_vp = SubViewport.new()
	_vp.msaa_3d = Viewport.MSAA_4X
	_vp.own_world_3d = true
	svc.add_child(_vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/stars.gdshader")
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_DISABLED
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	e.glow_enabled = true
	e.glow_intensity = 0.6
	e.glow_bloom = 0.05
	env.environment = e
	_vp.add_child(env)
	_globe = Node3D.new()
	_vp.add_child(_globe)
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 1.0
	sphere.height = 2.0
	sphere.radial_segments = 128
	sphere.rings = 64
	mesh.mesh = sphere
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/planet.gdshader")
	var tex := Data.texture("veyra.jpgb", true)
	if tex:
		mat.set_shader_parameter("albedo", tex)
	mesh.material_override = mat
	_globe.add_child(mesh)
	var atm := MeshInstance3D.new()
	var asphere := SphereMesh.new()
	asphere.radius = 1.09
	asphere.height = 2.18
	asphere.radial_segments = 64
	asphere.rings = 32
	atm.mesh = asphere
	var am := ShaderMaterial.new()
	am.shader = load("res://shaders/atmosphere.gdshader")
	atm.material_override = am
	_globe.add_child(atm)
	_cam = Camera3D.new()
	_cam.fov = 38
	_cam.near = 0.05
	_vp.add_child(_cam)
	# overlay: routes, ocean names and pins in screen space
	_overlay = Control.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.draw.connect(_draw_overlay)
	area.add_child(_overlay)
	for o in Data.planet.get("oceans", []):
		var l := Data.label(o.name.to_upper(), 11, Color(0.75, 0.88, 1.0, 0.85))
		l.add_theme_color_override("font_outline_color", Color("#021c3a"))
		l.add_theme_constant_override("outline_size", 4)
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_overlay.add_child(l)
		_ocean_labels[o.id] = l
	for c in Data.continents():
		var b := Button.new()
		b.flat = true
		b.custom_minimum_size = Vector2(44, 44)
		b.mouse_filter = Control.MOUSE_FILTER_STOP
		b.pressed.connect(_pin_pressed.bind(c.id))
		b.focus_mode = Control.FOCUS_NONE
		b.draw.connect(_draw_pin.bind(b, c.id))
		var name := Data.label(c.name.to_upper(), 11)
		name.add_theme_color_override("font_outline_color", Color("#06101b"))
		name.add_theme_constant_override("outline_size", 5)
		name.position = Vector2(-60, 34)
		name.size = Vector2(164, 18)
		name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		name.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(name)
		_overlay.add_child(b)
		_pins[c.id] = b
	# zoom buttons and the legend
	var tools := VBoxContainer.new()
	tools.position = Vector2(10, 10)
	for z in [["+", 0.78], ["−", 1.28]]:
		var zb := Data.button(z[0])
		zb.pressed.connect(func(): _dist = clampf(_dist * z[1], 1.3, 5.0))
		tools.add_child(zb)
	area.add_child(tools)
	var hint := Data.label("Drag to spin · pinch to zoom · tap a continent", 11, Data.MUTED)
	hint.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	hint.position = Vector2(-330, -26)
	hint.size = Vector2(320, 20)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	area.add_child(hint)

func _state(c: Dictionary) -> Color:
	if c.tier == "BACKDROP":
		return PIN_MAP
	return PIN_OPEN if c.world == START_WORLD else PIN_LANDFALL

func _draw_pin(b: Button, id: String) -> void:
	var c = Data.continent(id)
	var col := _state(c)
	var ctr := b.size / 2
	var sel := id == selected
	if id == here:
		var t := fmod(Time.get_ticks_msec() / 1200.0, 1.0)
		b.draw_circle(ctr, 9 + t * 12, Color(Data.YOU, 0.45 * (1.0 - t)))
	b.draw_circle(ctr, 11 if sel else 8, Color(col, 0.25))
	b.draw_circle(ctr, 7 if sel else 5.5, Data.YOU if id == here else (col if sel else Color("#06101b")))
	b.draw_arc(ctr, 7 if sel else 5.5, 0, TAU, 24, col, 2.5, true)

func _process(delta: float) -> void:
	if _goal != null:
		var g: Vector3 = _goal
		var ang := _cam_dir.angle_to(g)
		if ang < 0.002:
			_goal = null
		else:
			_cam_dir = _cam_dir.slerp(g, minf(1.0, delta * 3.2)).normalized()
	var aspect := _vp.size.x / maxf(1.0, _vp.size.y)
	_cam.keep_aspect = Camera3D.KEEP_WIDTH if aspect < 1.0 else Camera3D.KEEP_HEIGHT
	_cam.position = _cam_dir * _dist
	_cam.look_at(Vector3.ZERO, Vector3.UP if absf(_cam_dir.y) < 0.98 else Vector3.FORWARD)
	_place_labels()
	_overlay.queue_redraw()

func _visible_at(p: Vector3) -> float:
	return p.normalized().dot(_cam_dir)

func _place_labels() -> void:
	for c in Data.continents():
		var b: Button = _pins[c.id]
		var p := Data.lat_lon_to_vec(c.lat, c.lon) * 1.012
		var f := _visible_at(p)
		b.visible = f > 0.15
		if b.visible:
			b.position = _cam.unproject_position(p) - b.size / 2
			b.modulate.a = clampf((f - 0.15) / 0.25, 0.0, 1.0)
			b.get_child(0).visible = c.id == selected or _dist < 2.6
			b.queue_redraw()
	for o in Data.planet.get("oceans", []):
		var l: Label = _ocean_labels[o.id]
		var p := Data.lat_lon_to_vec(o.lat, o.lon) * 1.005
		var f := _visible_at(p)
		l.visible = f > 0.2
		if l.visible:
			l.position = _cam.unproject_position(p) - l.size / 2
			l.modulate.a = clampf((f - 0.2) / 0.3, 0.0, 1.0)

## the air routes: great-circle arcs lifted off the surface, dashed, hidden where they pass behind the planet
func _draw_overlay() -> void:
	for r in Data.planet.get("routes", []):
		var a = Data.continent(r[0])
		var b = Data.continent(r[1])
		if a.is_empty() or b.is_empty():
			continue
		var A := Data.lat_lon_to_vec(a.lat, a.lon)
		var B := Data.lat_lon_to_vec(b.lat, b.lon)
		var arc := A.angle_to(B)
		var open: bool = a.world == START_WORLD and b.world == START_WORLD
		var col := Color(1, 1, 1, 0.8) if open else Color(PIN_LANDFALL, 0.75)
		var prev: Variant = null
		for i in 41:
			var t := i / 40.0
			var p := A.slerp(B, t) * (1.01 + sin(PI * t) * arc * 0.09)
			var s := _cam.unproject_position(p)
			var vis := not _occluded(p)
			if prev != null and vis and i % 2 == 0:
				_overlay.draw_line(prev, s, col, 2.0, true)
			prev = s if vis else null

## is a point behind the planet as the camera sees it (the line of sight meets the sphere first)?
func _occluded(p: Vector3) -> bool:
	var c := _cam.position
	var d := p - c
	var a := d.dot(d)
	var b := 2.0 * c.dot(d)
	var cc := c.dot(c) - 1.0
	var disc := b * b - 4.0 * a * cc
	if disc < 0.0:
		return false
	var t := (-b - sqrt(disc)) / (2.0 * a)
	return t > 0.0 and t < 0.999

func _pin_pressed(id: String) -> void:
	if id == selected:
		_open_selected()
	else:
		select(id)

func select(id: String) -> void:
	var c = Data.continent(id)
	if c.is_empty():
		return
	selected = id
	_goal = Data.lat_lon_to_vec(c.lat, c.lon)
	_refresh()

func _open_selected() -> void:
	var c = Data.continent(selected)
	if c.get("maps", []).size() > 0:
		open_map.emit(c.maps[0])

func _globe_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.device != InputEvent.DEVICE_ID_EMULATION:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP and ev.pressed:
			_dist = clampf(_dist * 0.9, 1.3, 5.0)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN and ev.pressed:
			_dist = clampf(_dist * 1.1, 1.3, 5.0)
		elif ev.button_index == MOUSE_BUTTON_LEFT:
			_press(ev.pressed, ev.position)
	elif ev is InputEventMouseMotion and ev.device != InputEvent.DEVICE_ID_EMULATION and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		_spin(ev.relative)
	elif ev is InputEventScreenTouch:
		if ev.pressed:
			_touches[ev.index] = ev.position
		else:
			_touches.erase(ev.index)
		_pinch_d = 0.0
		if _touches.size() <= 1:
			_press(ev.pressed, ev.position)
	elif ev is InputEventScreenDrag:
		_touches[ev.index] = ev.position
		if _touches.size() >= 2:
			var k := _touches.keys()
			var d: float = (_touches[k[0]] as Vector2).distance_to(_touches[k[1]])
			if _pinch_d > 0.0:
				_dist = clampf(_dist * _pinch_d / maxf(1.0, d), 1.3, 5.0)
			_pinch_d = d
			_moved += 100.0
		else:
			_spin(ev.relative)
	elif ev is InputEventMagnifyGesture:
		_dist = clampf(_dist / ev.factor, 1.3, 5.0)

func _press(down: bool, pos: Vector2) -> void:
	if down:
		_press_at = pos
		_press_t = Time.get_ticks_msec()
		_moved = 0.0
	elif _moved < 12.0 and Time.get_ticks_msec() - _press_t < 600:
		_tap(pos)

func _spin(rel: Vector2) -> void:
	_moved += rel.length()
	_goal = null
	var k := 0.0045 * clampf(_dist / 3.7, 0.3, 1.2)
	var right := _cam_dir.cross(Vector3.UP).normalized()
	var d := _cam_dir.rotated(Vector3.UP, -rel.x * k)
	var pitched := d.rotated(right, -rel.y * k)
	if absf(pitched.y) < 0.97:
		d = pitched
	_cam_dir = d.normalized()

func _tap(pos: Vector2) -> void:
	var o := _cam.project_ray_origin(pos)
	var n := _cam.project_ray_normal(pos)
	var b := o.dot(n)
	var c := o.dot(o) - 1.0
	var disc := b * b - c
	if disc < 0.0:
		return
	var hit := o + n * (-b - sqrt(disc))
	var id := Data.continent_at(Data.vec_to_lat_lon(hit))
	if id != "":
		if id == selected:
			_open_selected()
		else:
			select(id)

func _refresh() -> void:
	for b in _strip.get_children():
		var on: bool = b.get_meta("id") == selected
		b.add_theme_color_override("font_color", Data.GOLD if on else Data.TEXT)
	for k in _pins:
		_pins[k].queue_redraw()
	for ch in _card.get_children():
		ch.queue_free()
	var c = Data.continent(selected)
	if c.is_empty():
		return
	_card.add_child(Data.label("CONTINENT %d · %s" % [c.n, String(c.tagline).to_upper()], 11, Data.CYAN))
	var title := Data.label(c.name, 24, Color(c.color))
	_card.add_child(title)
	_card.add_child(Data.label(c.epithet, 13, Data.MUTED))
	var status := "You are here" if c.id == here else ("Not yet explorable" if c.tier == "BACKDROP" else ("Reached by air drop" if c.tier == "EXPANSION" else ("Open to flights" if c.world == START_WORLD else "Make landfall first")))
	_card.add_child(Data.label("%s · %s · %s" % [status, c.capital, c.climate], 12, Data.MUTED))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 18)
	for p in c.places:
		var mark := "★ " if p.kind == "CAPITAL" else ("✈ " if p.kind == "AIRPORT" else ("⚓ " if p.kind == "PORT" else "• "))
		grid.add_child(Data.label(mark + p.name, 12, Data.TEXT if p.live else Data.MUTED))
	_card.add_child(grid)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var maps: Array = c.get("maps", [])
	var names := []
	for m in maps:
		names.append(Data.map_name(m))
	var ob := Data.button(("OPEN MAP · " + " · ".join(names)) if maps.size() > 0 else "NOT IN THE GAME YET", true)
	ob.disabled = maps.is_empty()
	ob.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ob.pressed.connect(_open_selected)
	row.add_child(ob)
	if maps.size() > 1:
		for m in maps.slice(1):
			var mb := Data.button(Data.map_name(m))
			mb.pressed.connect(func(): open_map.emit(m))
			row.add_child(mb)
	_card.add_child(row)
	var look := Data.label(c.look, 12, Data.MUTED)
	look.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_card.add_child(look)
