extends Control
## The GPS (owner, Nov 18: "add it to flight mode and other parts of the game"): a round minimap that turns with your
## camera (what is ahead is up), centred on you. In a region it draws the region's own baked map (the region map's dark
## tones), the airports and main places, and the map's waypoint (waypoint.gd), pinned to the rim when it is off the dial.
## In flight (world_mode) it also points at the other regions round the planet with their distance, and says over what
## you are flying and where on the globe (world_geo.gd). Views without a region map hand it lines and marks instead
## (the Nexus street hub, the airport).
##
##   var g := Gps.new(); g.region = region; g.target = operator; add_child(g)
## Tap it to zoom (three ranges). Sits in the top-right corner under the corner buttons.

const Geo := preload("res://scripts/nav/world_geo.gd")
const Waypoint := preload("res://scripts/nav/waypoint.gd")

const DIAM := 172.0
var region: Node              # a region_3d.gd (or null)
var target: Node3D            # the thing at the centre (local coords of the region, or of the host's own world)
var cam: Camera3D             # what "ahead" means; defaults to the region's camera, then the viewport's
var ranges: Array = [90.0, 220.0, 600.0]   # metres from the centre to the rim, cycled by a tap
var range_i := 1
## flight: the planet layer (the other regions on the rim), and the craft's place on the globe / the place name
var world_mode := false
var world_pos: Callable = Callable()       # -> Vector3 unit vector (Vector3.ZERO: unknown)
var place_name: Callable = Callable()      # -> String
## hosts without a region map: [{a: Vector2, b: Vector2, w: float, color: Color}] and [{p: Vector2, color, label}]
var lines: Array = []
var marks: Array = []
var area := ""                             # the line under the dial when there is no region
var land_bg := false                       # the ground beyond the host's lines is land (dark slate), not sea
var offset := Vector2(-DIAM - 14.0, 70.0)  # from the top-right corner

var _tex: Texture2D
var _map_id := ""
var _dial: Control
var _mask: Control
var _ground: Control
var _lines: Control
var _label: Label
var _mat: ShaderMaterial

func _ready() -> void:
	# pinned to the top-right corner by its offsets (setting `position` in the tree would be in the parent's own
	# coordinates, off the left of the screen)
	set_anchors_preset(Control.PRESET_TOP_RIGHT)
	offset_left = offset.x
	offset_top = offset.y
	offset_right = offset.x + DIAM
	offset_bottom = offset.y + DIAM + 26.0
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# a round mask: the map and the roads are drawn inside it only (clip_children)
	_mask = Control.new()
	_mask.size = Vector2(DIAM, DIAM)
	_mask.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mask.clip_children = CanvasItem.CLIP_CHILDREN_ONLY
	_mask.draw.connect(func(): _mask.draw_circle(_mask.size * 0.5, DIAM * 0.5 - 2.0, Color.WHITE))
	add_child(_mask)
	_ground = Control.new()
	_ground.size = Vector2(DIAM, DIAM)
	_ground.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ground.draw.connect(_draw_ground)
	_mask.add_child(_ground)
	_lines = Control.new()
	_lines.size = Vector2(DIAM, DIAM)
	_lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_lines.draw.connect(_draw_lines)
	_mask.add_child(_lines)
	_dial = Control.new()
	_dial.size = Vector2(DIAM, DIAM)
	_dial.mouse_filter = Control.MOUSE_FILTER_STOP
	_dial.draw.connect(_draw_dial)
	_dial.gui_input.connect(func(ev: InputEvent):
		if (ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT) or (ev is InputEventScreenTouch and ev.pressed):
			range_i = (range_i + 1) % ranges.size()
			accept_event())
	add_child(_dial)
	_label = Label.new()
	_label.position = Vector2(-40, DIAM + 2.0)
	_label.size = Vector2(DIAM + 80.0, 22)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.add_theme_font_size_override("font_size", 13)
	_label.add_theme_color_override("font_color", Color(0.85, 0.95, 1.0))
	_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_label.add_theme_constant_override("outline_size", 5)
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_label)
	# the region map's "dark map" tones (region_map.gd): slate land, deep blue water
	_mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;
void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	float lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
	vec3 slate = mix(vec3(0.07, 0.09, 0.11), vec3(0.34, 0.38, 0.42), lum);
	bool water = c.b > c.r + 0.12 && c.b > c.g;
	vec3 o = water ? vec3(0.05, 0.13, 0.21) + c.rgb * 0.06 : mix(slate, c.rgb * 0.5, 0.35);
	COLOR = vec4(o, c.a);
}
"""
	_mat.shader = sh
	_ground.material = _mat
	refresh_map()

## call after the region changed what it shows (a new map, open sea)
func refresh_map() -> void:
	_map_id = ""
	_tex = null
	if region and not region.is_open_sea() and String(region.map_id) != "":
		_map_id = String(region.map_id)
		_tex = Data.texture("maps/%s.map.pngb" % _map_id, true)

## puts a GPS on `host` for an on-foot operator in a region (the arrow follows the camera: the operator's body turns on
## its own)
static func attach(host: Control, reg: Node, who: Node3D) -> Control:
	var g = load("res://scripts/nav/gps.gd").new()
	g.region = reg
	g.target = who
	if who:
		who.set_meta("gps_no_heading", true)
	g.ranges = [70.0, 160.0, 400.0]
	host.add_child(g)
	return g

func _process(_dt: float) -> void:
	if region != null and not is_instance_valid(region):
		region = null
		_tex = null
	if not is_visible_in_tree():
		return
	if region and String(region.map_id) != _map_id and not region.is_open_sea():
		refresh_map()
	_dial.queue_redraw()
	_ground.queue_redraw()
	_lines.queue_redraw()
	_label.text = _caption()

func _cam() -> Camera3D:
	if cam and is_instance_valid(cam):
		return cam
	if region and region.camera():
		return region.camera()
	return get_viewport().get_camera_3d()

## the compass heading the dial is turned to (what the camera looks along)
func view_heading() -> float:
	var c := _cam()
	if c == null:
		return 0.0
	var f := -c.global_transform.basis.z
	return atan2(f.x, -f.z)

## the target, else the camera (Street View: you are the camera)
func _who() -> Node3D:
	if target and is_instance_valid(target):
		return target
	return _cam()

func _centre() -> Vector2:
	var t := _who()
	if t:
		var p := t.global_position if t.is_inside_tree() else t.position
		return Vector2(p.x, p.z)
	return Vector2.ZERO

## a local point (x, z metres) -> the dial
func to_dial(p: Vector2) -> Vector2:
	var c := _dial.size * 0.5
	var k := (DIAM * 0.5 - 4.0) / float(ranges[range_i])
	return c + (p - _centre()).rotated(-view_heading()) * k

func _caption() -> String:
	var where := area
	if place_name.is_valid():
		where = String(place_name.call())
	elif region and String(region.map_id) != "":
		where = String(Data.map(String(region.map_id)).get("name", region.map_id))
		var a := _area_name()
		if a != "":
			where = "%s · %s" % [a, where]
	if world_mode and world_pos.is_valid():
		var g: Vector3 = world_pos.call()
		if g != Vector3.ZERO:
			where += "  " + Geo.lat_lon_text(Geo.vec_to_lat_lon(g))
	return where

## the named district / area nearest you (the map's areas), within 160 m
func _area_name() -> String:
	if region == null or region.is_open_sea():
		return ""
	var m: Dictionary = Data.map(String(region.map_id))
	var me: Vector2 = region.map_point(_centre().x, _centre().y)
	var best := ""
	var bd := 160.0
	for a in m.get("areas", []):
		var d := Vector2(float(a.x) - me.x, float(a.z) - me.y).length()
		if d < bd:
			bd = d
			best = String(a.name)
	return best

## the sea and the region's map, cut to the dial (its own layer: the dark-map shader tones only this)
func _draw_ground() -> void:
	var c := _ground.size * 0.5
	var r := DIAM * 0.5
	# toned by the shader: the deep-water blue, or dark slate for a city block / airfield
	_ground.draw_circle(c, r, Color(0.1, 0.1, 0.1, 0.9) if land_bg else Color(0.16, 0.42, 0.62, 0.88))
	if _tex == null or region == null:
		return
	var k := (r - 4.0) / float(ranges[range_i])
	var h := view_heading()
	var circle := PackedVector2Array()
	for i in 48:
		var a := TAU * i / 48.0
		circle.append(c + Vector2(cos(a), sin(a)) * (r - 2.0))
	var half: float = region.span() * 0.5
	var sq := PackedVector2Array()
	for q in [Vector2(-half, -half), Vector2(half, -half), Vector2(half, half), Vector2(-half, half)]:
		sq.append(to_dial(q))
	for poly in Geometry2D.intersect_polygons(circle, sq):
		var uvs := PackedVector2Array()
		for pt in poly:
			var local: Vector2 = _centre() + (pt - c).rotated(h) / k
			uvs.append(local / (half * 2.0) + Vector2(0.5, 0.5))
		_ground.draw_polygon(poly, PackedColorArray([Color(1, 1, 1, 0.95)]), uvs, _tex)

## the host's roads and areas (views without a region map), inside the mask
func _draw_lines() -> void:
	var c := _lines.size * 0.5
	var r := DIAM * 0.5
	var k := (r - 4.0) / float(ranges[range_i])
	# the host's lines and marks (views without a region map)
	var cull := float(ranges[range_i]) * 1.5 + 50.0
	var me := _centre()
	for l in lines:
		if (l.a as Vector2).distance_to(me) > cull and (l.b as Vector2).distance_to(me) > cull and (l.a as Vector2).distance_to(l.b) < cull:
			continue
		_lines.draw_line(to_dial(l.a), to_dial(l.b), l.get("color", Color(0.5, 0.6, 0.7, 0.8)), maxf(1.0, float(l.get("w", 8.0)) * k))

func _draw_dial() -> void:
	var s := _dial.size
	var c := s * 0.5
	var r := DIAM * 0.5
	var k := (r - 4.0) / float(ranges[range_i])
	var h := view_heading()
	# places: airports and the map's main places
	if region and _tex:
		var m: Dictionary = Data.map(String(region.map_id))
		for poi in m.get("pois", []):
			var cat := String(poi.get("cat", ""))
			var big := cat == "airport" or int(poi.get("rank", 3)) <= 1
			if not big:
				continue
			var lp: Vector2 = Vector2(float(poi.x), float(poi.z)) - region.map_point(0, 0)
			var dp := to_dial(lp)
			if dp.distance_to(c) < r - 8.0:
				_dial.draw_circle(dp, 4.0 if cat == "airport" else 3.0, Color(0.55, 0.9, 1.0) if cat == "airport" else Color(0.95, 0.9, 0.75, 0.9))
				if cat == "airport":
					_dial.draw_arc(dp, 7.0, 0, TAU, 16, Color(0.55, 0.9, 1.0), 1.5)
	# only the three nearest marks within their reach are named, so a busy strip stays readable
	var named := {}
	var cands: Array = []
	for i in marks.size():
		var mk0: Dictionary = marks[i]
		if String(mk0.get("label", "")) != "" and not mk0.has("node"):
			var dd := (mk0.p as Vector2).distance_to(_centre())
			if dd < float(mk0.get("near", 1e9)):
				cands.append([dd, i])
	cands.sort_custom(func(x, y): return x[0] < y[0])
	for e in cands.slice(0, 3):
		named[e[1]] = true
	for mi in marks.size():
		var mk: Dictionary = marks[mi]
		if mk.has("node"):
			if not is_instance_valid(mk.node):
				continue
			var np: Vector3 = (mk.node as Node3D).global_position
			mk.p = Vector2(np.x, np.z)
		var dp := to_dial(mk.p)
		var col: Color = mk.get("color", Color(1.0, 0.85, 0.4))
		if dp.distance_to(c) > r - 8.0:
			if not mk.get("pin", false):
				continue
			dp = c + (dp - c).limit_length(r - 8.0)
		_dial.draw_circle(dp, 3.5, col)
		if named.has(mi) and dp.distance_to(c) < r - 14.0:
			var lt := String(mk.label)
			var lw := ThemeDB.fallback_font.get_string_size(lt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
			var lpos := dp + Vector2(6, 4) if dp.x < c.x + 10.0 else dp + Vector2(-6 - lw, 4)
			lpos.x = clampf(lpos.x, 2.0, DIAM - lw - 2.0)
			_dial.draw_string_outline(ThemeDB.fallback_font, lpos, lt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 4, Color(0, 0, 0, 0.8))
			_dial.draw_string(ThemeDB.fallback_font, lpos, lt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, col)
	# the waypoint, pinned to the rim when it is further than the dial shows
	var wp := Waypoint.get_waypoint()
	if region and not wp.is_empty() and String(wp.get("map", "")) == String(region.map_id) and not region.is_open_sea():
		var lp: Vector2 = Vector2(float(wp.x), float(wp.z)) - region.map_point(0, 0)
		var dp := to_dial(lp)
		if dp.distance_to(c) > r - 9.0:
			dp = c + (dp - c).limit_length(r - 9.0)
		_dial.draw_colored_polygon(PackedVector2Array([dp + Vector2(0, -6), dp + Vector2(5, 0), dp + Vector2(0, 6), dp + Vector2(-5, 0)]), Color(1.0, 0.82, 0.3))
	# the planet: every other region on the rim (inside the dial when near enough), with its distance
	if world_mode and world_pos.is_valid():
		var g: Vector3 = world_pos.call()
		if g != Vector3.ZERO:
			var near: Array = []
			for st in Geo.sites():
				near.append([Geo.dist(g, st.v), st])
			near.sort_custom(func(x, y): return x[0] < y[0])
			var shown := 0
			for e in near:
				var d: float = e[0]
				var st: Dictionary = e[1]
				var here: bool = region != null and not region.is_open_sea() and String(st.map) == String(region.map_id)
				if here or shown >= 4:
					continue
				shown += 1
				var rel := Geo.bearing(g, st.v) - h
				var dir := Vector2(sin(rel), -cos(rel))
				var inside := d * k < r - 10.0
				var dp := c + dir * minf(d * k, r - 9.0)
				var col := Color(1.0, 0.85, 0.4) if shown == 1 else Color(0.75, 0.88, 1.0, 0.85)
				_dial.draw_circle(dp, 5.0 if inside else 4.0, col)
				if shown > 2:
					continue   # the two nearest are named; the rest are pips
				# the name sits inside the dial from its pip, on the side toward the centre
				var txt := "%s %s" % [_short(String(st.name)), _km(d)]
				var font := ThemeDB.fallback_font
				var tw := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
				var tp := dp - dir * 12.0
				if dir.x > 0.35:
					tp.x -= tw
				elif dir.x > -0.35:
					tp.x -= tw * 0.5
				tp.y += 4.0 + (8.0 if dir.y < -0.5 else (-4.0 if dir.y > 0.5 else 0.0))
				tp.x = clampf(tp.x, 2.0, DIAM - tw - 2.0)
				_dial.draw_string_outline(font, tp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0, 0, 0, 0.8))
				_dial.draw_string(font, tp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)
	# the rim, north, and you
	_dial.draw_arc(c, r - 1.0, 0, TAU, 64, Color(0.55, 0.85, 1.0, 0.55), 2.0)
	var nd := Vector2(sin(-h), -cos(-h))
	_dial.draw_circle(c + nd * (r - 10.0), 8.0, Color(0.02, 0.05, 0.09, 0.9))
	_dial.draw_string(ThemeDB.fallback_font, c + nd * (r - 10.0) + Vector2(-4.5, 4.5), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1, 0.45, 0.4))
	var th := h
	if target and is_instance_valid(target) and not target.has_meta("gps_no_heading"):
		th = Geo.yaw_to_heading(target.global_rotation.y if target.is_inside_tree() else target.rotation.y)
		if target.has_meta("gps_heading_off"):
			th += float(target.get_meta("gps_heading_off"))
	var ar := th - h
	var fw := Vector2(sin(ar), -cos(ar))
	var rt := Vector2(-fw.y, fw.x)
	_dial.draw_colored_polygon(PackedVector2Array([c + fw * 9.0, c - fw * 6.0 + rt * 6.0, c - fw * 3.0, c - fw * 6.0 - rt * 6.0]), Color(0.4, 0.95, 1.0))
	_dial.draw_string(ThemeDB.fallback_font, c + Vector2(r - 34.0, r - 6.0), "%dm" % int(ranges[range_i]) if ranges[range_i] < 1000 else "%.0fkm" % (ranges[range_i] / 1000.0), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.7, 0.85, 1.0, 0.8))

static func _km(d: float) -> String:
	return "%dm" % int(d) if d < 1000.0 else "%.1fkm" % (d / 1000.0)

static func _short(n: String) -> String:
	return n if n.length() <= 12 else n.substr(0, 11) + "…"
