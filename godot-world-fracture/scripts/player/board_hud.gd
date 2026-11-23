extends Control
## The game screen from the owner's boards (Nov 22, docs/reference/nfs-night/skydeck-board-1/2.png): one frame every
## view gets through touch_controls.gd —
##   top left    the weapon card: a slanted dark plate, the gun's name, the magazine big and the reserve small
##   top centre  the compass strip (W · NW · ◆ · N · NE …, turning with the camera) and the place line under it,
##               then the quest panel (gold diamond, title, checkbox lines)
##   top right   the operator plate: the chevron emblem, "Operator Lv. N", the green hull bar and the blue shield bar
##               with their numbers, Nex and shards
## Data: hull / shield come from touch_controls.show_hull; the weapon from its ammo / weapon_name labels (the views
## keep writing those); level / Nex / shards from user://profile.json (re-read every 2 s); place and quest from the
## host view (`place`, `set_quest`) — when a view sets no quest, the day's goals (progression.gd) fill the panel.
## Everything draws in _draw on this one Control (no theme, no per-element nodes): cheap on the phone.

const Progression := preload("res://scripts/progress/progression.gd")

const GOLD := Color(1.0, 0.78, 0.32)
const PLATE := Color(0.03, 0.025, 0.06, 0.72)
const EDGE := Color(0.62, 0.3, 1.0, 0.9)
const GREEN := Color(0.25, 0.95, 0.45)
const BLUE := Color(0.25, 0.65, 1.0)

var source: Control            # the touch_controls.gd this sits in (ammo / weapon_name)
var place := ""                # "Neon City • Grand Casino Skydeck (380 m)"
var hull := 1.0
var shield := -1.0
var hull_max := 100.0
var shield_max := 40.0
var quest_title := ""
var quest_lines: Array = []    # [{text, done}]
var compass_on := true

var _level := 1
var _nex := 0
var _shards := 0
var _profile_t := 0.0
var _font: Font
var cam: Camera3D               # the view's camera; found by itself when a view keeps its 3D in a SubViewport
var _cam_t := 0.0
## a view's own top-row buttons (LEAVE at (250, 8), CO-OP, …) under the compass push the centre block down
var _top := 0.0
var _top_t := 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font
	_read_profile()

var _view_quest := false
func set_quest(title: String, lines: Array) -> void:
	quest_title = title
	quest_lines = lines
	_view_quest = title != ""
	queue_redraw()

## the ability tiles (close_combat → touch_controls.show_abilities): [{name, ready 0..1, color, super}]
var abilities: Array = []
var ability_keys := ["1", "2", "3"]
var tiles_on := true

func _process(dt: float) -> void:
	_profile_t -= dt
	_top_t -= dt
	if _top_t <= 0.0:
		_top_t = 1.0
		_top = _clear_top()
	if _profile_t <= 0.0:
		_profile_t = 2.0
		_read_profile()
	queue_redraw()

func _clear_top() -> float:
	var host := source.get_parent() if source else null
	if host == null:
		return 0.0
	var cx := size.x * 0.5
	var lo := 0.0
	for b in host.find_children("*", "BaseButton", true, false):
		var c := b as Control
		if c == null or not c.is_visible_in_tree() or c.is_ancestor_of(self) or (source and source.is_ancestor_of(c)):
			continue
		var r := c.get_global_rect()
		if r.position.y < 50.0 and r.end.x > cx - 180.0 and r.position.x < cx + 180.0:
			lo = maxf(lo, r.end.y + 4.0)
	return lo

func _read_profile() -> void:
	var f := FileAccess.open("user://profile.json", FileAccess.READ)
	if f == null:
		return
	var p = JSON.parse_string(f.get_as_text())
	if not (p is Dictionary):
		return
	_level = Progression.level_for(int(p.get("xp", 0)))
	_nex = int(p.get("nex", 0))
	_shards = int(p.get("shards", 0))
	if not _view_quest:
		var lines: Array = []
		for g in Progression.daily(p):
			lines.append({ "text": "%s  %d/%d" % [g.label, g.progress, g.target], "done": g.done })
		quest_title = "Daily Goals"
		quest_lines = lines

func _draw() -> void:
	var w := size.x
	_weapon_card()
	if compass_on:
		_compass(w * 0.5)
	_quest(w * 0.5)
	_operator(w - 92.0)
	if tiles_on and not abilities.is_empty():
		for i in abilities.size():
			var r := Rect2(w - 20.0 - (abilities.size() - i) * 74.0, size.y - 86.0, 66.0, 66.0)
			tile(self, r, abilities[i], i, ability_keys[i] if i < ability_keys.size() else "", _font)

# --------------------------------------------------------------------------------------------- pieces
func _text(t: String, at: Vector2, sz: int, c: Color, align := HORIZONTAL_ALIGNMENT_LEFT, width := -1.0) -> void:
	draw_string(_font, at + Vector2(1, 1), t, align, width, sz, Color(0, 0, 0, 0.75))
	draw_string(_font, at, t, align, width, sz, c)

func _slant(x: float, y: float, w: float, h: float, fill: Color, edge: Color) -> void:
	var k := h * 0.35
	var pts := PackedVector2Array([Vector2(x + k, y), Vector2(x + w, y), Vector2(x + w - k, y + h), Vector2(x, y + h)])
	draw_colored_polygon(pts, fill)
	pts.append(pts[0])
	draw_polyline(pts, edge, 1.5, true)

func _weapon_card() -> void:
	if source == null:
		return
	var name: String = source.weapon_name.text if source.weapon_name else ""
	var am: String = source.ammo.text if source.ammo else ""
	if name == "" and am == "":
		return
	_slant(12, 12, 230, 74, PLATE, EDGE)   # ends before x 250, where views put their LEAVE button (HUD rule)
	draw_line(Vector2(30, 12), Vector2(230, 12), GOLD, 2.0)
	_text(name.to_upper(), Vector2(30, 34), 14, Color(0.85, 0.88, 0.95))
	# "30 / 270" → the board's big magazine and small reserve
	var parts := am.split("/")
	if parts.size() == 2:
		var mag := parts[0].strip_edges()
		_text(mag, Vector2(30, 74), 34, Color.WHITE)
		var mw := _font.get_string_size(mag, HORIZONTAL_ALIGNMENT_LEFT, -1, 34).x
		draw_line(Vector2(38 + mw, 50), Vector2(32 + mw, 76), Color(1, 1, 1, 0.6), 2.0)
		_text(parts[1].strip_edges(), Vector2(44 + mw, 74), 18, Color(0.8, 0.82, 0.9))
	else:
		_text(am, Vector2(30, 72), 26 if am.length() < 10 else 18, Color.WHITE)

func _compass(cx: float) -> void:
	_cam_t -= get_process_delta_time()
	if (cam == null or not is_instance_valid(cam) or not cam.current) and _cam_t <= 0.0:
		_cam_t = 1.0
		cam = get_viewport().get_camera_3d()
		if cam == null:
			for c in get_tree().root.find_children("*", "Camera3D", true, false):
				if (c as Camera3D).current and (c as Camera3D).is_visible_in_tree():
					cam = c
					break
	if cam == null or not is_instance_valid(cam):
		return
	var fwd := -cam.global_transform.basis.z
	var heading := rad_to_deg(atan2(fwd.x, -fwd.z))   # 0 = north (-z), clockwise
	var half := 170.0
	var y := 22.0 + _top
	draw_line(Vector2(cx - half, y + 10), Vector2(cx + half, y + 10), Color(1, 1, 1, 0.35), 1.0)
	var names := { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" }
	var px_per_deg := half / 80.0
	var start := int(floor((heading - 80.0) / 15.0)) * 15
	for d in range(start, int(heading + 81.0), 15):
		var x := cx + (d - heading) * px_per_deg
		if absf(x - cx) > half:
			continue
		var a := 1.0 - absf(x - cx) / half
		var key := posmod(d, 360)
		if names.has(key):
			_text(names[key], Vector2(x - 20, y + 4), 16, Color(1, 1, 1, 0.4 + 0.6 * a), HORIZONTAL_ALIGNMENT_CENTER, 40)
		else:
			draw_line(Vector2(x, y + 4), Vector2(x, y + 10), Color(1, 1, 1, 0.5 * a), 1.0)
	# the gold diamond at the heading
	var dp := PackedVector2Array([Vector2(cx, y - 14), Vector2(cx + 6, y - 8), Vector2(cx, y - 2), Vector2(cx - 6, y - 8)])
	draw_colored_polygon(dp, GOLD)
	if place != "":
		_text(place, Vector2(cx - 300, y + 34), 16, Color(0.95, 0.95, 1.0), HORIZONTAL_ALIGNMENT_CENTER, 600)

func _quest(cx: float) -> void:
	if quest_title == "" or quest_lines.is_empty():
		return
	var x := cx - 160.0
	var y := 66.0 + _top
	var h := 30.0 + 22.0 * quest_lines.size()
	draw_rect(Rect2(x, y, 320, h), Color(0.02, 0.02, 0.05, 0.55))
	draw_rect(Rect2(x, y, 2, h), GOLD)
	var dp := PackedVector2Array([Vector2(x + 16, y + 8), Vector2(x + 24, y + 16), Vector2(x + 16, y + 24), Vector2(x + 8, y + 16)])
	draw_colored_polygon(dp, GOLD)
	_text(quest_title, Vector2(x + 32, y + 22), 16, GOLD)
	for i in quest_lines.size():
		var q: Dictionary = quest_lines[i]
		var ly := y + 30.0 + i * 22.0
		draw_rect(Rect2(x + 12, ly + 3, 12, 12), Color(1, 1, 1, 0.8), false, 1.5)
		if q.get("done", false):
			draw_line(Vector2(x + 14, ly + 9), Vector2(x + 17, ly + 13), GOLD, 2.0)
			draw_line(Vector2(x + 17, ly + 13), Vector2(x + 23, ly + 4), GOLD, 2.0)
		_text(String(q.get("text", "")), Vector2(x + 32, ly + 15), 13, Color(1, 1, 1, 0.55 if q.get("done", false) else 0.92))

func _operator(right: float) -> void:
	var x := right - 300.0
	var y := 10.0
	draw_rect(Rect2(x, y, 300, 66), PLATE)
	draw_line(Vector2(x, y), Vector2(x + 300, y), EDGE, 1.5)
	# the chevron emblem
	var e := Vector2(x + 26, y + 32)
	for k in 2:
		var o := k * 9.0
		draw_polyline(PackedVector2Array([e + Vector2(-16, -14 + o), e + Vector2(0, 2 + o), e + Vector2(16, -14 + o)]), Color(0.92, 0.92, 1.0), 3.0, true)
	_text("Operator Lv. %d" % _level, Vector2(x + 54, y + 18), 15, Color.WHITE)
	# hull and shield with their numbers
	var bw := 236.0
	draw_rect(Rect2(x + 54, y + 24, bw, 11), Color(0, 0, 0, 0.6))
	draw_rect(Rect2(x + 54, y + 24, bw * clampf(hull, 0.0, 1.0), 11), GREEN if hull > 0.35 else Color(0.95, 0.35, 0.3))
	_text("%d / %d" % [roundi(hull * hull_max), roundi(hull_max)], Vector2(x + 54, y + 34), 11, Color.WHITE, HORIZONTAL_ALIGNMENT_RIGHT, bw - 4)
	if shield >= 0.0:
		draw_rect(Rect2(x + 54, y + 38, bw, 8), Color(0, 0, 0, 0.6))
		draw_rect(Rect2(x + 54, y + 38, bw * clampf(shield, 0.0, 1.0), 8), BLUE)
	# Nex (gold coin) and shards (violet crystal)
	draw_circle(Vector2(x + 62, y + 57), 6.0, GOLD)
	_text(_thousands(_nex), Vector2(x + 74, y + 63), 14, Color.WHITE)
	var sx := x + 190.0
	draw_colored_polygon(PackedVector2Array([Vector2(sx, y + 49), Vector2(sx + 6, y + 57), Vector2(sx, y + 65), Vector2(sx - 6, y + 57)]), Color(0.7, 0.4, 1.0))
	_text(_thousands(_shards), Vector2(sx + 12, y + 63), 14, Color.WHITE)

static func _thousands(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out

## one ability tile in the boards' style: a dark rounded plate, a glowing rim and glyph in the ability's colour, the
## cooldown as a dark sweep closing clockwise, the key in a chip under it. Shared with the phone's ability buttons.
static func tile(ci: CanvasItem, r: Rect2, a: Dictionary, idx: int, key: String, font: Font) -> void:
	var col: Color = a.get("color", Color(0.6, 0.4, 1.0))
	var ready := clampf(float(a.get("ready", 0.0)), 0.0, 1.0)
	var c := r.get_center()
	var rad := r.size.x * 0.5
	var lit := ready >= 1.0
	ci.draw_rect(r, Color(0.03, 0.025, 0.06, 0.82))
	# the glyph: a burst for the first, a crest for the second, a vortex ring for the super
	var gc := col.lerp(Color.WHITE, 0.35) if lit else Color(col.r, col.g, col.b, 0.45)
	if bool(a.get("super", false)) or idx == 2:
		for k in 3:
			ci.draw_arc(c, rad * (0.28 + k * 0.16), k * 1.3, k * 1.3 + 4.4, 24, gc, 3.0 - k * 0.6, true)
		ci.draw_circle(c, rad * 0.12, gc)
	elif idx == 0:
		for k in 8:
			var d := Vector2.from_angle(k * TAU / 8.0)
			ci.draw_line(c + d * rad * 0.18, c + d * rad * (0.72 if k % 2 == 0 else 0.48), gc, 3.0, true)
		ci.draw_circle(c, rad * 0.16, gc)
	else:
		var pts := PackedVector2Array()
		for k in 6:
			pts.append(c + Vector2.from_angle(k * TAU / 6.0 - PI / 2) * rad * 0.62)
		pts.append(pts[0])
		ci.draw_polyline(pts, gc, 3.0, true)
		ci.draw_line(c + Vector2(0, -rad * 0.35), c + Vector2(-rad * 0.18, rad * 0.05), gc, 3.0, true)
		ci.draw_line(c + Vector2(-rad * 0.18, rad * 0.05), c + Vector2(rad * 0.12, rad * 0.05), gc, 3.0, true)
		ci.draw_line(c + Vector2(rad * 0.12, rad * 0.05), c + Vector2(-rad * 0.05, rad * 0.4), gc, 3.0, true)
	# cooldown sweep (what is still charging stays dark)
	if not lit:
		var pts2 := PackedVector2Array([c])
		var start := -PI / 2 + TAU * ready
		var n := 24
		for k in n + 1:
			pts2.append(c + Vector2.from_angle(start + (TAU * (1.0 - ready)) * k / n) * rad * 1.42)
		var clip := PackedVector2Array()
		for p in pts2:
			clip.append(Vector2(clampf(p.x, r.position.x, r.end.x), clampf(p.y, r.position.y, r.end.y)))
		ci.draw_colored_polygon(clip, Color(0, 0, 0, 0.55))
	# rim: glowing when ready
	var rim := col if lit else Color(col.r, col.g, col.b, 0.5)
	ci.draw_rect(r, rim, false, 2.0)
	if lit:
		ci.draw_rect(r.grow(2.0), Color(col.r, col.g, col.b, 0.35), false, 2.0)
	if key != "" and font:
		var kr := Rect2(c.x - 10, r.end.y - 9, 20, 16)
		ci.draw_rect(kr, Color(0.9, 0.9, 0.95))
		ci.draw_string(font, Vector2(kr.position.x, kr.end.y - 3), key, HORIZONTAL_ALIGNMENT_CENTER, 20, 12, Color(0.05, 0.05, 0.08))
	if not lit and font:
		ci.draw_string(font, Vector2(r.position.x, c.y + 6), "%d%%" % int(ready * 100.0), HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 15, Color(1, 1, 1, 0.9))

