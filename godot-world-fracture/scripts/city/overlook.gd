extends Node
## The Nexus Highlands Overlook (owner's pick, Nov 24; the Package Audit's next step, after the concept frame
## docs/reference/target-overlook-day.png): a crag above the capital with the funicular up its side. From its cap the
## VIEW frames the operator against the city like the concept and names what you see — Nexus City, the airport, the
## harbour, the coastal highway — and, on the horizon at their real bearings from planet.json, the lands beyond.
## Nexus's land is a low plateau (the map's relief is about 40 m), so the height is the crag's own: region_board.gd
## `_overlook` builds it at SPOTS' place (a deck on the cap, a box round the cliffs), data.gd puts the POI on the map.
## arrival_view.gd hosts this when it walks a map with a spot (street_slice's HIGHLANDS FUNICULAR door opens it there).

## per map: the crag's centre (map coordinates), its radius and height, and what the view faces (a map point)
const SPOTS := {
	"nexus": { "x": 30.4, "z": -20.1, "rad": 11.0, "h": 40.0, "face_x": 69.6, "face_z": -259.6,
		"title": "AETHERIA REGION", "sub": "Nexus Highlands" },
}
const POI := { "id": "nexus-overlook", "name": "Highlands Overlook", "cat": "park", "rank": 1,
	"blurb": "A crag above the capital: the city, the airport and the coast in one look." }
## the map places named from the cap (POI ids, or "@city" for the towers' middle, "@highway" for the nearest highway)
const NEAR := [["@city", "NEXUS CITY"], ["nexus-airport", "NEXUS AIRPORT"], ["nexus-harbor", "HARBOR DISTRICT"],
	["nexus-university", "UNIVERSITY DISTRICT"], ["@highway", "COASTAL HIGHWAY"]]
## the lands on the horizon (planet.json continent ids)
const FAR := [["thalassia", "THALASSIA", "Underwater City"], ["neon-city", "NEON CITY", ""],
	["scorched-plains", "SOLARA DESERT", ""], ["verdant-forest", "VERDANT FOREST", "Riverdale"],
	["frost-spire", "MOUNTAIN RANGE", "Frostspire"], ["wastelands", "THE WASTELANDS", ""]]
const UP_R := 4.0      # metres from the funicular's car (foot or cap) that offer the ride
const VIEW_R := 6.5    # metres from the cap's middle that offer the VIEW

static func spot_for(map_id: String) -> Dictionary:
	return SPOTS.get(map_id, {})

## the POI the map shows (data.gd adds it to the map's pois once)
static func poi_for(map_id: String) -> Dictionary:
	var s := spot_for(map_id)
	if s.is_empty():
		return {}
	var p := POI.duplicate()
	p["x"] = float(s.x)
	p["z"] = float(s.z)
	return p

## compass bearing (degrees, 0 = north, 90 = east) and great-circle distance (km) from one continent to another
static func bearing(from: Dictionary, to: Dictionary) -> Vector2:
	var la1 := deg_to_rad(float(from.lat))
	var la2 := deg_to_rad(float(to.lat))
	var dl := deg_to_rad(float(to.lon) - float(from.lon))
	var b := rad_to_deg(atan2(sin(dl) * cos(la2), cos(la1) * sin(la2) - sin(la1) * cos(la2) * cos(dl)))
	var c := clampf(sin(la1) * sin(la2) + cos(la1) * cos(la2) * cos(dl), -1.0, 1.0)
	return Vector2(fposmod(b, 360.0), rad_to_deg(acos(c)) * 111.19)

## a compass bearing as a local map direction (map +x is east, -z is north)
static func dir_of(bearing_deg: float) -> Vector2:
	var a := deg_to_rad(bearing_deg)
	return Vector2(sin(a), -cos(a))

# ------------------------------------------------------------------------------------------------ the scene side
var host: Control          # arrival_view.gd
var region: Control
var operator: Node3D
var controls: Control
var map_id := ""
var spot := {}
var cap := Vector3.ZERO    # local: the cap's middle, on the deck
var foot := Vector3.ZERO   # local: the funicular's lower car
var face := Vector3.ZERO   # local: what the view looks at
var viewing := false
var _here := ""            # the offer showing: "up" | "down" | "view" | ""
var _overlay: Control
var _marks: Array = []     # [Label, local Vector3]

func setup(h: Control, id: String) -> void:
	host = h
	region = h.region
	operator = h.operator
	controls = h.controls
	map_id = id
	spot = spot_for(id)
	var top: float = region.get_meta("overlook_cap", -INF)
	if spot.is_empty() or top == -INF:
		return
	var c: Vector2 = region.local_point(float(spot.x), float(spot.z))
	cap = Vector3(c.x, top, c.y)
	var f: Vector2 = region.local_point(float(spot.face_x), float(spot.face_z))
	face = Vector3(f.x, region.ground(f.x, f.y), f.y)
	var away := (c - f).normalized()   # the funicular runs up the back of the crag, away from the view
	var fp := c + away * (float(spot.rad) + 4.0)
	foot = Vector3(fp.x, region.ground(fp.x, fp.y), fp.y)

func active() -> bool:
	return not spot.is_empty() and cap != Vector3.ZERO

## stands the operator on the cap (the street's funicular door arrives up here)
func arrive_on_cap() -> void:
	if not active():
		return
	var back := Vector3(foot.x - cap.x, 0, foot.z - cap.z).normalized()
	operator.position = cap + back * 2.5
	operator.position.y = region.ground(operator.position.x, operator.position.z)

## per frame, before the operator steps; true while the view holds the screen (the operator stands still)
func step(_dt: float) -> bool:
	if not active():
		return false
	if viewing:
		_place_marks()
		if Input.is_action_just_pressed("ui_cancel") or controls.take_enter():
			_end_view()
		return true
	var at: Vector3 = operator.position
	var flat_cap := Vector2(at.x - cap.x, at.z - cap.z).length()
	var on_cap := at.y > cap.y - 2.0
	var offer := ""
	if on_cap and flat_cap <= VIEW_R:
		offer = "view"
	if on_cap and Vector2(at.x - foot.x, at.z - foot.z).length() <= float(spot.rad) + 6.0 and flat_cap > VIEW_R - 1.5:
		offer = "down"
	if not on_cap and Vector2(at.x - foot.x, at.z - foot.z).length() <= UP_R:
		offer = "up"
	if offer != _here:
		_here = offer
		controls.prompt({ "view": "VIEW", "down": "FUNICULAR ↓", "up": "FUNICULAR ↑ · HIGHLANDS OVERLOOK" }.get(offer, ""))
	if offer != "" and controls.take_enter():
		_here = ""
		controls.prompt("")
		match offer:
			"view":
				_begin_view()
				return true
			"down":
				operator.position = foot
				controls.toast("Down the funicular.")
			"up":
				arrive_on_cap()
				controls.toast("Highlands Overlook")
	return false

func _begin_view() -> void:
	viewing = true
	var to := Vector3(face.x - cap.x, 0, face.z - cap.z).normalized()
	# the operator at the lip, facing the city; the camera over their shoulder, a little behind and above (the concept's frame)
	operator.position = cap + to * 3.0
	operator.position.y = region.ground(operator.position.x, operator.position.z)
	operator.heading = atan2(to.x, to.z)
	operator.velocity = Vector3.ZERO
	operator.step(1.0 / 30.0, Vector2.ZERO, Vector2.ZERO, false, false)   # settle into the idle before the camera is set
	if operator.rig:
		operator.rig.rotation.y = operator.heading
	var cam: Camera3D = region.camera()
	var side := Vector3(-to.z, 0, to.x)
	cam.global_position = operator.global_position - to * 5.5 + side * 1.6 + Vector3(0, 3.2, 0)
	cam.look_at(Vector3(face.x, face.y + 25.0, face.z))
	_build_overlay()
	# the frame is the view's alone: the HUD and the GPS step aside
	_hidden = []
	for n in host.get_children():
		if n != region and n != _overlay and n is CanvasItem and (n as CanvasItem).visible:
			(n as CanvasItem).visible = false
			_hidden.append(n)
	var bc: Variant = host.get("beacon")
	if bc is Node3D and (bc as Node3D).visible:
		(bc as Node3D).visible = false   # the waypoint's beam and orb hung over the city in the frame
		_hidden.append(bc)

var _hidden: Array = []
func _end_view() -> void:
	viewing = false
	for n in _hidden:
		if is_instance_valid(n):
			n.visible = true
	_hidden.clear()
	if _overlay:
		_overlay.queue_free()
		_overlay = null
	_marks.clear()
	operator.attach_camera(region.camera())

func _build_overlay() -> void:
	_overlay = Control.new()
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	host.add_child(_overlay)
	# the place card, top right
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.08, 0.14, 0.82)
	sb.border_color = Color(0.45, 0.8, 1.0, 0.7)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(10)
	card.add_theme_stylebox_override("panel", sb)
	card.anchor_left = 1.0
	card.anchor_right = 1.0
	card.offset_left = -300
	card.offset_right = -16
	card.offset_top = 16
	_overlay.add_child(card)
	var v := VBoxContainer.new()
	card.add_child(v)
	var t := Label.new()
	t.text = String(spot.title)
	t.add_theme_font_size_override("font_size", 18)
	v.add_child(t)
	var s := Label.new()
	var now := Time.get_datetime_dict_from_system()
	s.text = "%s · %02d:%02d" % [String(spot.sub), int(now.hour), int(now.minute)]
	s.modulate = Color(0.75, 0.88, 1.0)
	v.add_child(s)
	var back := Button.new()
	back.text = "← STEP BACK"
	back.custom_minimum_size = Vector2(130, 44)
	back.position = Vector2(16, 16)
	back.pressed.connect(_end_view)
	_overlay.add_child(back)
	# the places in view
	var m: Dictionary = Data.map(map_id)
	for row in NEAR:
		var at := _near_point(m, String(row[0]))
		if at != Vector3.INF:
			_mark(String(row[1]), "", at)
	var home: Dictionary = Data.continent(_continent_of(map_id))
	if not home.is_empty():
		for row in FAR:
			var to: Dictionary = Data.continent(String(row[0]))
			if to.is_empty():
				continue
			var bd := bearing(home, to)
			var dir := dir_of(bd.x)
			var far := cap + Vector3(dir.x, 0, dir.y) * 2400.0 + Vector3(0, 40.0, 0)
			var sub := "%s · %s km" % [String(row[2]), _km(bd.y)] if String(row[2]) != "" else "%s km" % _km(bd.y)
			_mark(String(row[1]), sub, far)
	_place_marks()

func _near_point(m: Dictionary, key: String) -> Vector3:
	if key == "@city":
		var bs: Array = m.get("buildings", [])
		if bs.is_empty():
			return Vector3.INF
		var s := Vector2.ZERO
		for b in bs:
			s += Vector2(float(b[0]), float(b[1]))
		s /= bs.size()
		var c: Vector2 = region.local_point(s.x, s.y)
		return Vector3(c.x, region.ground(c.x, c.y) + 70.0, c.y)
	if key == "@highway":
		var best := Vector3.INF
		var bd := INF
		var net: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/road_net.json"))
		var roads: Array = (net as Dictionary).get(map_id, []) if net is Dictionary else []
		for r in roads:
			if String(r.get("cls", "")) != "highway":
				continue
			for p in r.pts:
				var c: Vector2 = region.local_point(float(p[0]), float(p[1]))
				# the stretch in front of the view, not one behind the crag
				var ahead := Vector2(face.x - cap.x, face.z - cap.z).normalized().dot((c - Vector2(cap.x, cap.z)).normalized())
				var d := c.distance_to(Vector2(cap.x, cap.z)) - ahead * 120.0
				if ahead > 0.2 and d < bd:
					bd = d
					best = Vector3(c.x, region.ground(c.x, c.y) + 8.0, c.y)
		return best
	for p in m.get("pois", []):
		if String(p.id) == key:
			var c: Vector2 = region.local_point(float(p.x), float(p.z))
			return Vector3(c.x, region.ground(c.x, c.y) + 18.0, c.y)
	return Vector3.INF

func _continent_of(id: String) -> String:
	for c in Data.continents():
		if (c.get("maps", []) as Array).has(id):
			return String(c.id)
	return ""

static func _km(d: float) -> String:
	var s := str(int(round(d)))
	var out := ""
	while s.length() > 3:
		out = "," + s.right(3) + out
		s = s.left(s.length() - 3)
	return s + out

func _mark(name: String, sub: String, at: Vector3) -> void:
	var l := Label.new()
	l.text = "◆ " + name + ("\n" + sub if sub != "" else "")
	l.add_theme_font_size_override("font_size", 17)
	var pill := StyleBoxFlat.new()
	pill.bg_color = Color(0.03, 0.07, 0.12, 0.72)
	pill.set_corner_radius_all(5)
	pill.set_content_margin_all(5)
	l.add_theme_stylebox_override("normal", pill)
	l.add_theme_color_override("font_outline_color", Color(0.02, 0.05, 0.09))
	l.add_theme_constant_override("outline_size", 6)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay.add_child(l)
	_marks.append([l, at])

func _place_marks() -> void:
	var cam: Camera3D = region.camera()
	var vp := cam.get_viewport()
	var size: Vector2 = vp.get_visible_rect().size if vp else Vector2(960, 540)
	for mk in _marks:
		var l: Label = mk[0]
		var at: Vector3 = mk[1]
		if cam.is_position_behind(at):
			l.visible = false
			continue
		var p := cam.unproject_position(at)
		l.visible = p.x > -40.0 and p.x < size.x + 40.0 and p.y > -20.0 and p.y < size.y
		l.position = p - Vector2(l.size.x * 0.5, l.size.y)

## the marks that are on screen right now (tests)
func shown() -> Array:
	var out := []
	for mk in _marks:
		if (mk[0] as Label).visible:
			out.append((mk[0] as Label).text.get_slice("\n", 0).trim_prefix("◆ "))
	return out
