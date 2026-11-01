extends Control
## A region's full map, as in the web game's street maps (same data, exported): the land cover, white streets and highways,
## buildings coloured by use, paved ground, rings (domes, arenas, hazards), places with icons and names that never overlap,
## and area names. Map / Satellite toggle (the satellite look is recoloured on the GPU from the baked data). Drag to pan,
## pinch / wheel / buttons to zoom, tap a place or building for its card. Chips switch maps and filter the places.

signal closed
## open this region in 3D (the 3D City or Street View) at a world point (null: the map's centre)
signal open_3d(map_id: String, at: Variant, street: bool)

const ROAD := {
	"highway": ["#fcd462", "#e3a93a", 4.0, ""], "main": ["#ffffff", "#c9c9c9", 3.0, ""], "street": ["#ffffff", "#d6d6d6", 2.0, ""],
	"track": ["#c8ad85", "#c8ad85", 1.6, "dash"], "runway": ["#8d9299", "#6f747b", 5.0, ""], "taxiway": ["#a7acb2", "#8d9299", 2.0, ""],
	"bridge": ["#ffffff", "#8f969d", 4.0, ""], "boardwalk": ["#c79a63", "#a07444", 2.0, ""], "rail": ["#ffffff", "#7b8188", 3.0, "rail"],
	"trail": ["#a07444", "#a07444", 1.4, "dash"], "powerline": ["#8a8f96", "#8a8f96", 1.0, "dot"], "race": ["#d0287f", "#d0287f", 1.6, "dash"],
	"skybridge": ["#e9e4f7", "#9a8fc0", 2.5, ""], "ferry": ["#1a73e8", "#1a73e8", 1.4, "dash"],
}
const AREA := {
	"city": ["#202124", 20], "district": ["#5f6368", 12], "mountain": ["#6d4c41", 16], "valley": ["#6d4c41", 13], "lake": ["#1967d2", 13],
	"sea": ["#1967d2", 14], "desert": ["#8a5a19", 15], "forest": ["#2e7d32", 14], "lava": ["#c2410c", 14], "snow": ["#546e7a", 13],
	"marsh": ["#33691e", 14], "river": ["#1967d2", 12], "hazard": ["#d93025", 12],
}
## one letter per place kind on its round icon (the default font has no emoji)
const GLYPH := {
	"store": "S", "mall": "M", "school": "Sc", "university": "U", "entertainment": "E", "casino": "$", "nightclub": "♪", "park": "P",
	"transit": "T", "dock": "D", "civic": "C", "landmark": "★", "garage": "G", "village": "V", "camp": "c", "cave": "◒", "ruins": "R",
	"peak": "▲", "lake": "L", "falls": "≈", "lava": "!", "research": "+", "temple": "Π", "spire": "◆", "airport": "✈", "outpost": "O",
	"terminal": "✈", "port": "⚓", "station": "T", "hazard": "!", "arena": "A", "viewpoint": "◉", "wreck": "×",
}
const SAT_ROOF := {
	"apartment": ["#9b948a", "#5c564e"], "house": ["#8a5a48", "#4e3328"], "store": ["#a7b0b8", "#5d656c"], "mall": ["#b9c2ca", "#6a737b"],
	"school": ["#a58e6a", "#5d4f39"], "entertainment": ["#8f6e86", "#4e3a49"], "office": ["#7f868e", "#454b51"], "civic": ["#b3aa98", "#6a6252"],
	"industrial": ["#80796f", "#4a453e"], "transport": ["#8e979f", "#525960"], "garage": ["#6e7176", "#3e4044"], "dome": ["#a8d6e2", "#5fa3b6"],
}

var map_id := ""
var m: Dictionary = {}
var sat := false
var cx := 0.0
var cz := 0.0
var zoom := 1.0
var _map_tex: Texture2D
var _data_tex: Texture2D
var _sat_mat: ShaderMaterial
var _area: Control
var _ground: Control
var _vec: Control
var _title: Label
var _sub: Label
var _sat_btn: Button
var _chips: HBoxContainer
var _filters: HBoxContainer
var _card: PanelContainer
var _off := {}
var _picked: Variant = null
var _touches := {}
var _pinch_d := 0.0
var _moved := 0.0
var _press_t := 0
var _last_tap := 0
var _font: Font
var _touched := false

func _ready() -> void:
	_font = get_theme_default_font()
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.add_theme_constant_override("separation", 0)
	add_child(col)
	# header: back, name, satellite
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", Data.box(Data.BG, Data.RULE, 0))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 10)
	head.add_child(hb)
	var back := Data.button("← PLANET")
	back.pressed.connect(func(): closed.emit())
	hb.add_child(back)
	var t := VBoxContainer.new()
	t.add_theme_constant_override("separation", 0)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title = Data.label("", 18)
	_sub = Data.label("", 11, Data.MUTED)
	t.add_child(_title)
	t.add_child(_sub)
	hb.add_child(t)
	_sat_btn = Data.button("SATELLITE")
	_sat_btn.pressed.connect(func(): set_satellite(not sat))
	hb.add_child(_sat_btn)
	col.add_child(head)
	# map chips
	var cs := ScrollContainer.new()
	cs.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	cs.custom_minimum_size = Vector2(0, 54)
	var csbg := PanelContainer.new()
	csbg.add_theme_stylebox_override("panel", Data.box(Data.PANEL, Data.RULE, 0))
	_chips = HBoxContainer.new()
	_chips.add_theme_constant_override("separation", 6)
	cs.add_child(_chips)
	csbg.add_child(cs)
	col.add_child(csbg)
	for mi in Data.map_index:
		var b := Data.button(mi.name)
		b.add_theme_font_size_override("font_size", 13)
		b.set_meta("id", mi.id)
		b.pressed.connect(show_map.bind(mi.id))
		_chips.add_child(b)
	# the map
	_area = Control.new()
	_area.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_area.clip_contents = true
	_area.mouse_filter = Control.MOUSE_FILTER_STOP
	_area.gui_input.connect(_map_input)
	_area.resized.connect(func():
		if not _touched:
			_fit()
		_clamp(); _redraw())
	col.add_child(_area)
	var water := ColorRect.new()
	water.color = Color("#9ccbf0")
	water.set_anchors_preset(Control.PRESET_FULL_RECT)
	water.mouse_filter = Control.MOUSE_FILTER_IGNORE
	water.name = "Water"
	_area.add_child(water)
	_ground = Control.new()
	_ground.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ground.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ground.draw.connect(_draw_ground)
	_area.add_child(_ground)
	_vec = Control.new()
	_vec.set_anchors_preset(Control.PRESET_FULL_RECT)
	_vec.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vec.draw.connect(_draw_vectors)
	_area.add_child(_vec)
	# filters over the map
	var fs := ScrollContainer.new()
	fs.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	fs.position = Vector2(8, 8)
	fs.custom_minimum_size = Vector2(600, 50)
	_filters = HBoxContainer.new()
	_filters.add_theme_constant_override("separation", 6)
	fs.add_child(_filters)
	_area.add_child(fs)
	# zoom
	var zb := VBoxContainer.new()
	zb.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
	zb.position = Vector2(-62, -50)
	for z in [["+", 1.6], ["−", 0.625]]:
		var b := Data.button(z[0])
		b.custom_minimum_size = Vector2(48, 48)
		b.pressed.connect(zoom_by.bind(z[1]))
		zb.add_child(b)
	_area.add_child(zb)
	# the place card
	_card = PanelContainer.new()
	_card.add_theme_stylebox_override("panel", Data.box(Data.PANEL_2, Data.RULE, 12))
	_card.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_card.visible = false
	_area.add_child(_card)
	_sat_mat = ShaderMaterial.new()
	_sat_mat.shader = load("res://shaders/satellite.gdshader")
	var covers: Array = Data.styles.get("covers", [])
	var pal := PackedVector3Array()
	for cv in covers:
		var rgb: Array = Data.styles.satColor[cv]
		pal.append(Vector3(rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0))
	while pal.size() < 32:
		pal.append(Vector3(0.07, 0.19, 0.32))
	_sat_mat.set_shader_parameter("pal", pal)
	for pair in [["i_deep", "deep"], ["i_sea", "sea"], ["i_shallow", "shallow"], ["i_lake", "lake"], ["i_river", "river"], ["i_forest", "forest"],
			["i_dense", "denseForest"], ["i_marsh", "marsh"], ["i_meadow", "meadow"], ["i_grass", "grass"], ["i_scrub", "scrub"], ["i_desert", "desert"],
			["i_dunes", "dunes"], ["i_sandstone", "sandstone"], ["i_wash", "wash"], ["i_lava", "lava"], ["i_magma", "magma"]]:
		_sat_mat.set_shader_parameter(pair[0], covers.find(pair[1]))

func show_map(id: String) -> void:
	map_id = id
	m = Data.map(id)
	if m.is_empty():
		return
	_title.text = m.name
	_sub.text = m.sub
	_map_tex = Data.texture("maps/%s.map.pngb" % id, true)
	_data_tex = Data.texture("maps/%s.data.pngb" % id)
	var b: Dictionary = m.bounds
	cx = b.x0 + b.span / 2.0
	cz = b.z0 + b.span / 2.0
	_touched = false
	_fit()
	_picked = null
	_card.visible = false
	_sat_mat.set_shader_parameter("bounds", Vector4(b.x0, b.z0, b.span, 0))
	for ch in _chips.get_children():
		ch.add_theme_color_override("font_color", Data.GOLD if ch.get_meta("id") == id else Data.TEXT)
	_build_filters()
	_redraw()

## open filling the screen (a portrait phone would otherwise show water above and below the square map)
func _fit() -> void:
	var s := _area.size
	zoom = maxf(1.0, maxf(s.x, s.y) / maxf(1.0, minf(s.x, s.y))) if s.x > 0 else 1.0
	_redraw()

func set_satellite(on: bool) -> void:
	sat = on and _data_tex != null
	_sat_btn.text = "MAP" if sat else "SATELLITE"
	_ground.material = _sat_mat if sat else null
	_ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST if sat else CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	(_area.get_node("Water") as ColorRect).color = Color("#12304f") if sat else Color("#9ccbf0")
	_redraw()

func _build_filters() -> void:
	for ch in _filters.get_children():
		ch.queue_free()
	var cats := {}
	for p in m.pois:
		cats[p.cat] = true
	for g in Data.styles.get("groups", []):
		var any := false
		for c in g.cats:
			if cats.has(c):
				any = true
		if not any:
			continue
		var b := Data.button(g.label)
		b.add_theme_font_size_override("font_size", 12)
		b.custom_minimum_size = Vector2(0, 36)
		b.toggle_mode = true
		b.button_pressed = not _off.has(g.id)
		b.toggled.connect(_toggle_group.bind(g.id))
		_filters.add_child(b)

func _toggle_group(on: bool, gid: String) -> void:
	if on:
		_off.erase(gid)
	else:
		_off[gid] = true
	_redraw()

func _hidden_cat(cat: String) -> bool:
	for g in Data.styles.get("groups", []):
		if _off.has(g.id) and cat in g.cats:
			return true
	return false

# ---------------- view ----------------

func _ppm() -> float:
	var s := _area.size
	return minf(s.x, s.y) / float(m.bounds.span) * zoom

func w2s(x: float, z: float) -> Vector2:
	var k := _ppm()
	return Vector2((x - cx) * k + _area.size.x / 2.0, (z - cz) * k + _area.size.y / 2.0)

func s2w(p: Vector2) -> Vector2:
	var k := _ppm()
	return Vector2((p.x - _area.size.x / 2.0) / k + cx, (p.y - _area.size.y / 2.0) / k + cz)

func zoom_by(f: float, at: Variant = null) -> void:
	_touched = true
	if _area.size.x < 1.0 or m.is_empty():
		zoom = clampf(zoom * f, 1.0, 24.0)
		return
	var p: Vector2 = at if at != null else _area.size / 2.0
	var before := s2w(p)
	zoom = clampf(zoom * f, 1.0, 24.0)
	var after := s2w(p)
	cx += before.x - after.x
	cz += before.y - after.y
	_clamp()
	_redraw()

func _clamp() -> void:
	if m.is_empty():
		return
	var b: Dictionary = m.bounds
	cx = clampf(cx, b.x0, b.x0 + b.span)
	cz = clampf(cz, b.z0, b.z0 + b.span)

func _redraw() -> void:
	_ground.queue_redraw()
	_vec.queue_redraw()

# ---------------- drawing ----------------

func _draw_ground() -> void:
	if m.is_empty():
		return
	var b: Dictionary = m.bounds
	var a := w2s(b.x0, b.z0)
	var size := Vector2.ONE * float(b.span) * _ppm()
	var tex := _data_tex if sat else _map_tex
	if tex:
		_ground.draw_texture_rect(tex, Rect2(a, size), false)

func _rect_pts(x: float, z: float, hx: float, hz: float, yaw: float) -> PackedVector2Array:
	var c := cos(yaw)
	var s := sin(yaw)
	var out := PackedVector2Array()
	for uv in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		var lx: float = uv.x * hx
		var lz: float = uv.y * hz
		out.append(w2s(x + lx * c + lz * s, z - lx * s + lz * c))
	return out

func _onscreen(pts: PackedVector2Array, pad := 40.0) -> bool:
	var r := Rect2(Vector2.ZERO, _area.size).grow(pad)
	for p in pts:
		if r.has_point(p):
			return true
	return false

func _draw_vectors() -> void:
	if m.is_empty():
		return
	var k := _ppm()
	var view := Rect2(Vector2.ZERO, _area.size).grow(60)
	# paved ground
	for p in m.pavements:
		var pts := _rect_pts(p[0], p[1], p[2], p[3], p[4])
		if not _onscreen(pts, 200):
			continue
		var fill := Color("#ffffff")
		if sat:
			fill = Color("#8d8a84") if p[5] == "plaza" else (Color("#6a6e73") if p[5] == "apron" else Color("#3e4247"))
		elif p[5] == "apron":
			fill = Color("#d9dce0")
		elif p[5] == "plaza":
			fill = Color("#f4efe4")
		_vec.draw_colored_polygon(pts, fill)
	# rings
	for r in m.rings:
		var c := w2s(r[0], r[1])
		var rad: float = r[2] * k
		match r[3]:
			"hazard":
				_vec.draw_circle(c, rad, Color("#d93025", 0.1))
				_dashed_arc(c, rad, Color("#d93025", 0.75))
			"arena":
				_vec.draw_circle(c, rad, Color("#e8d6b8"))
				_vec.draw_arc(c, rad, 0, TAU, 48, Color("#a07444"), 2.0, true)
			"pad":
				_vec.draw_circle(c, maxf(3.0, rad), Color("#e2e6ea"))
				_vec.draw_arc(c, maxf(3.0, rad), 0, TAU, 32, Color("#8f969d"), 1.5, true)
			"fence":
				_dashed_arc(c, rad, Color("#8d6e63"))
			"dome":
				_vec.draw_circle(c, rad, Color("#c9ecf5", 0.85))
				_vec.draw_arc(c, rad, 0, TAU, 48, Color("#5fb4cc"), 1.5, true)
			"dock":
				_vec.draw_circle(c, rad, Color("#e2e6ea"))
			_:
				_vec.draw_arc(c, rad, 0, TAU, 64, Color.WHITE, maxf(3.0, 6.0 * k), true)
	# roads: casings, then fills
	for layer in ["casing", "fill"]:
		for r in m.roads:
			var st: Array = ROAD.get(r.cls, ROAD.street)
			var pts := PackedVector2Array()
			for q in r.pts:
				pts.append(w2s(q[0], q[1]))
			if pts.size() < 2 or not _onscreen(pts, 400):
				continue
			var w := maxf(st[2], float(r.w) * k)
			var style: String = st[3]
			var casing := Color(r.color) if r.color != "" else Color(st[1])
			if layer == "casing":
				if style == "dash" or style == "dot":
					_dashed_poly(pts, casing, clampf(w, 1.2, 4.0), 6.0 if style == "dash" else 2.0, 5.0 if style == "dash" else 7.0)
				elif not sat or r.color != "":
					_vec.draw_polyline(pts, casing, w + 2.0, true)
			elif style != "dash" and style != "dot":
				var fill := Color(st[0])
				if sat:
					fill = Color("#f2c94c") if r.cls == "highway" else (Color("#b48a5a") if r.cls == "boardwalk" else (Color("#55595e") if r.cls == "runway" else Color("#d9d4c8")))
					fill.a = 0.85
				if style == "rail":
					_dashed_poly(pts, Color.WHITE, maxf(1.0, w * 0.45), 8.0, 6.0)
				else:
					_vec.draw_polyline(pts, fill, w if not sat else maxf(1.2, w * 0.7), true)
	# buildings
	if k > 0.35:
		for bd in m.buildings:
			var pts := _rect_pts(bd[0], bd[1], bd[2], bd[3], bd[4])
			if not _onscreen(pts):
				continue
			var use: String = bd[5]
			var fill: Color
			var line: Color
			if sat:
				fill = Color(SAT_ROOF.get(use, SAT_ROOF.office)[0])
				line = Color(SAT_ROOF.get(use, SAT_ROOF.office)[1])
			else:
				var us: Dictionary = Data.styles.use.get(use, Data.styles.use.office)
				fill = Color(us.fill)
				line = Color(us.stroke)
			if bd[6] > 0.25 and k > 1.0:
				var sh := PackedVector2Array()
				for p in pts:
					sh.append(p + Vector2(1, 1) * float(bd[6]) * 2.2 * k)
				_vec.draw_colored_polygon(sh, Color(0, 0, 0, 0.12))
			_vec.draw_colored_polygon(pts, fill)
			var outline := pts.duplicate()
			outline.append(pts[0])
			_vec.draw_polyline(outline, Color("#1a73e8") if _picked is Array and _picked == bd else line, 2.5 if _picked is Array and _picked == bd else 1.0, true)
	# places and names (labels never overlap; detail grows with zoom)
	var max_rank := 1 if zoom < 1.6 else (2 if zoom < 3.2 else 3)
	var placed: Array[Rect2] = []
	var labels := []
	for p in m.pois:
		if _hidden_cat(p.cat) or p.rank > max_rank:
			continue
		var s := w2s(p.x, p.z)
		if not view.has_point(s):
			continue
		var col := Color(Data.styles.poi.get(p.cat, {"color": "#5f6368"}).color)
		var r := 12.0 if _picked is Dictionary and _picked.get("id", "") == p.id else 10.0
		_vec.draw_circle(s, r + 2.0, Color.WHITE)
		_vec.draw_circle(s, r, col)
		var g: String = GLYPH.get(p.cat, "•")
		var gs := _font.get_string_size(g, HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
		_vec.draw_string(_font, s + Vector2(-gs.x / 2.0, 4), g, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)
		placed.append(Rect2(s - Vector2(r, r), Vector2(r, r) * 2))
		labels.append({"text": p.name, "pos": s + Vector2(r + 4, 4), "rank": p.rank, "color": col, "size": 13, "left": true})
	for a in m.areas:
		if a.rank > max_rank:
			continue
		var st: Array = AREA.get(a.kind, ["#3c4043", 12])
		var txt: String = a.name.to_upper() if a.kind == "district" else a.name
		labels.append({"text": txt, "pos": w2s(a.x, a.z), "rank": a.rank - 0.5, "color": Color(st[0]), "size": st[1], "left": false})
	labels.sort_custom(func(x, y): return x.rank < y.rank)
	for l in labels:
		var sz := _font.get_string_size(l.text, HORIZONTAL_ALIGNMENT_LEFT, -1, l.size)
		var origin: Vector2 = l.pos if l.left else l.pos - Vector2(sz.x / 2.0, -sz.y / 4.0)
		var rect := Rect2(origin - Vector2(0, sz.y * 0.8), sz).grow(2)
		if not Rect2(Vector2.ZERO, _area.size).encloses(rect):
			continue
		var clash := false
		for q in placed:
			if q.intersects(rect):
				clash = true
				break
		if clash:
			continue
		placed.append(rect)
		var fill: Color = Color.WHITE if sat else l.color
		var outline := Color("#1b1f24") if sat else Color.WHITE
		_vec.draw_string_outline(_font, origin, l.text, HORIZONTAL_ALIGNMENT_LEFT, -1, l.size, 4, outline)
		_vec.draw_string(_font, origin, l.text, HORIZONTAL_ALIGNMENT_LEFT, -1, l.size, fill)
	# scale bar
	var target := 90.0 / k
	var step := 1.0
	for v in [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]:
		if v <= target:
			step = v
	var y := _area.size.y - 16.0
	_vec.draw_rect(Rect2(10, y - 18, step * k + 16, 24), Color(1, 1, 1, 0.85))
	_vec.draw_line(Vector2(18, y), Vector2(18 + step * k, y), Color("#3c4043"), 2.0)
	_vec.draw_string(_font, Vector2(18, y - 4), ("%d km" % int(step / 1000)) if step >= 1000 else ("%d m" % int(step)), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#3c4043"))

func _dashed_poly(pts: PackedVector2Array, col: Color, w: float, dash: float, gap: float) -> void:
	for i in pts.size() - 1:
		var a := pts[i]
		var b := pts[i + 1]
		var L := a.distance_to(b)
		var t := 0.0
		while t < L:
			var e := minf(L, t + dash)
			_vec.draw_line(a.lerp(b, t / L), a.lerp(b, e / L), col, w, true)
			t += dash + gap

func _dashed_arc(c: Vector2, r: float, col: Color) -> void:
	var n := int(clampf(r * 0.6, 16, 160))
	for i in n:
		if i % 2 == 0:
			_vec.draw_arc(c, r, TAU * i / n, TAU * (i + 1) / n, 3, col, 1.5, true)

# ---------------- input ----------------

func _map_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.device != InputEvent.DEVICE_ID_EMULATION:
		if ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom_by(1.15, ev.position)
		elif ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom_by(1.0 / 1.15, ev.position)
		elif ev.button_index == MOUSE_BUTTON_LEFT:
			_press(ev.pressed, ev.position)
	elif ev is InputEventMouseMotion and ev.device != InputEvent.DEVICE_ID_EMULATION and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		_pan(ev.relative)
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
			var ks := _touches.keys()
			var a: Vector2 = _touches[ks[0]]
			var b: Vector2 = _touches[ks[1]]
			var d := a.distance_to(b)
			if _pinch_d > 0.0:
				zoom_by(d / _pinch_d, (a + b) / 2.0)
			_pinch_d = d
			_moved += 100.0
		else:
			_pan(ev.relative)
	elif ev is InputEventMagnifyGesture:
		zoom_by(ev.factor, ev.position)
	elif ev is InputEventPanGesture:
		_pan(-ev.delta * 8.0)

func _pan(rel: Vector2) -> void:
	_touched = true
	_moved += rel.length()
	var k := _ppm()
	cx -= rel.x / k
	cz -= rel.y / k
	_clamp()
	_redraw()

func _press(down: bool, pos: Vector2) -> void:
	if down:
		_moved = 0.0
		_press_t = Time.get_ticks_msec()
		return
	if _moved > 12.0:
		return
	var now := Time.get_ticks_msec()
	if now - _last_tap < 300:
		zoom_by(2.0, pos)
		_last_tap = 0
		return
	_last_tap = now
	_pick(pos)

func _pick(pos: Vector2) -> void:
	# a place first (icons are the touch targets), then the building under the finger
	var best: Variant = null
	var bd := 22.0
	var max_rank := 1 if zoom < 1.6 else (2 if zoom < 3.2 else 3)
	for p in m.pois:
		if _hidden_cat(p.cat) or p.rank > max_rank:
			continue
		var d := w2s(p.x, p.z).distance_to(pos)
		if d < bd:
			bd = d
			best = p
	if best == null:
		var w := s2w(pos)
		for b in m.buildings:
			var c := cos(-float(b[4]))
			var s := sin(-float(b[4]))
			var dx := w.x - float(b[0])
			var dz := w.y - float(b[1])
			var lx := dx * c + dz * s
			var lz := -dx * s + dz * c
			if absf(lx) <= b[2] and absf(lz) <= b[3]:
				best = b
				break
	_picked = best
	_show_card()
	_redraw()

func _show_card() -> void:
	for ch in _card.get_children():
		ch.queue_free()
	if _picked == null:
		_card.visible = false
		return
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	_card.add_child(v)
	if _picked is Dictionary:
		var p: Dictionary = _picked
		var style: Dictionary = Data.styles.poi.get(p.cat, {"color": "#9dbed2", "label": p.cat})
		v.add_child(Data.label(p.name, 18))
		v.add_child(Data.label("%s · %s" % [style.label, m.name], 12, Color(style.color).lightened(0.35)))
		if p.blurb != "":
			var bl := Data.label(p.blurb, 12, Data.MUTED)
			bl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			v.add_child(bl)
	else:
		var b: Array = _picked
		var us: Dictionary = Data.styles.use.get(b[5], {"label": "Building"})
		var kind: String = String(us.label).trim_suffix("s")
		v.add_child(Data.label(b[7] if b[7] != "" else kind, 18))
		v.add_child(Data.label("%s · %d × %d m" % [kind, int(b[2] * 2), int(b[3] * 2)], 12, Data.MUTED))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var zh := Data.button("ZOOM HERE", true)
	var at := Vector2(_picked.x, _picked.z) if _picked is Dictionary else Vector2(_picked[0], _picked[1])
	zh.pressed.connect(func(): cx = at.x; cz = at.y; zoom = maxf(zoom, 4.0); _clamp(); _redraw())
	row.add_child(zh)
	var v3 := Data.button("3D", true)
	v3.pressed.connect(func(): open_3d.emit(map_id, at, false))
	row.add_child(v3)
	var sv := Data.button("STREET VIEW", true)
	sv.pressed.connect(func(): open_3d.emit(map_id, at, true))
	row.add_child(sv)
	var cl := Data.button("CLOSE")
	cl.pressed.connect(func(): _picked = null; _show_card(); _redraw())
	row.add_child(cl)
	v.add_child(row)
	_card.visible = true
	_card.reset_size()
	_card.position = Vector2(8, _area.size.y - _card.size.y - 8)
	_card.size.x = _area.size.x - 16
