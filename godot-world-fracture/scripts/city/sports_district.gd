extends "res://scripts/city/casino_interior.gd"
## The sports district, three places in one scene (the casino's helpers, figures and crowd are reused):
##  - PULSE ARENA: the home of the Nexus Voltage — a maple court under a centre-hung scoreboard, a full seating bowl with a
##    crowd on its feet, ribbon boards, benches and the scorer's table, and a game in progress.
##  - SUNSET COURTS: floodlit street courts by the water with palms, chain-link, a mural wall, bleachers and pickup games.
##  - IRON PULSE FITNESS: a gym floor — squat racks, benches and barbells, dumbbell racks, cable towers, treadmills and
##    bikes, kettlebells, heavy bags and a boxing ring, mirrors and screens, people training.
## All original names. NEXT VIEW and the place buttons move between them.

const ARENA := Vector3(0, 0, 0)
const COURTS := Vector3(420, 0, 0)
const GYM := Vector3(-420, 0, 0)
const HOME := Color(0.1, 0.85, 1.0)
const AWAY := Color(1.0, 0.45, 0.1)

func _ready() -> void:
	_views = [
		["PULSE ARENA", ARENA + Vector3(0, 7.5, 13.2), ARENA + Vector3(0, 1.2, -1)],
		["PULSE ARENA — COURTSIDE", ARENA + Vector3(-9, 1.3, 9.2), ARENA + Vector3(6, 2.2, -2)],
		["PULSE ARENA — THE BOWL", ARENA + Vector3(15.5, 1.7, 4), ARENA + Vector3(-22, 9, -8)],
		["SUNSET COURTS", COURTS + Vector3(-24, 5.0, 22), COURTS + Vector3(0, 0.5, -2)],
		["SUNSET COURTS — BASELINE", COURTS + Vector3(-17, 1.6, -4), COURTS + Vector3(-2, 2.6, -4)],
		["IRON PULSE — FREE WEIGHTS", GYM + Vector3(-6, 1.7, 1.5), GYM + Vector3(-13, 1.0, -9)],
		["IRON PULSE — CARDIO", GYM + Vector3(5, 1.8, 2.5), GYM + Vector3(12, 0.9, -6)],
		["IRON PULSE — THE RING", GYM + Vector3(4, 2.6, 4), GYM + Vector3(14, 1.2, -7)],
	]
	_rng.seed = 91
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.02, 0.04)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	_environment()
	_arena()
	_courts()
	_gym()
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.05
	cam.far = 2000.0
	world.add_child(cam)
	cam.current = true
	var row := HBoxContainer.new()
	row.position = Vector2(16, 16)
	row.add_theme_constant_override("separation", 8)
	add_child(row)
	var add := func(text: String, f: Callable) -> void:
		var b := Button.new()
		b.text = text
		b.pressed.connect(f)
		row.add_child(b)
	add.call("← STREET", func(): closed.emit())
	add.call("NEXT VIEW", func(): show_view(_view + 1))
	add.call("ARENA", func(): show_view(0))
	add.call("STREET COURTS", func(): show_view(3))
	add.call("GYM", func(): show_view(5))
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_color_override("font_color", HOME)
	_title.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	_title.add_theme_constant_override("outline_size", 6)
	_title.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_title.position = Vector2(20, -56)
	add_child(_title)
	show_view(0)

func show_view(i: int) -> void:
	_view = posmod(i, _views.size())
	cam.position = _views[_view][1]
	cam.look_at(_views[_view][2])
	_title.text = "SPORTS DISTRICT · " + String(_views[_view][0])

# --------------------------------------------------------------------------------------------- shared pieces
## a basketball court surface with its lines, centred at `at`, 28 x 15 m; `wood` for the arena's maple, else painted asphalt
func _court(at: Vector3, wood: bool, key: Color, field: Color) -> void:
	var m := _shader("""
shader_type spatial;
uniform bool wood = true;
uniform vec3 key_col : source_color = vec3(0.0, 0.5, 0.7);
uniform vec3 field : source_color = vec3(0.2, 0.4, 0.3);
uniform sampler2D surf : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D surf_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_surf = false;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float line(float d, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.02, abs(d)); }
void fragment() {
	// court space in metres: x along the length (-16..16), z across (-9..9); the playing area is 28 x 15
	vec2 p = vec2((UV.x - 0.5) * 32.0, (UV.y - 0.5) * 18.0);
	vec3 base;
	vec3 tex = has_surf ? texture(surf, p * (wood ? 0.42 : 0.3)).rgb : vec3(0.5);
	if (wood && has_surf) {
		base = tex * vec3(1.25, 1.05, 0.82);
	} else if (wood) {
		float plank = floor(p.y / 0.07);
		float seg = floor((p.x + h(vec2(plank, 1.0)) * 3.0) / 2.4);
		float grain = sin(p.x * 30.0 + h(vec2(plank, seg)) * 10.0) * 0.5 + 0.5;
		base = mix(vec3(0.78, 0.55, 0.32), vec3(0.88, 0.67, 0.42), h(vec2(plank, seg)) * 0.6 + grain * 0.15);
		base *= 1.0 - 0.25 * step(0.97, fract(p.y / 0.07));
	} else {
		base = field * (has_surf ? 0.65 + 0.8 * dot(tex, vec3(0.33)) : 0.85 + 0.15 * h(floor(p * 40.0)));
	}
	vec2 a = abs(p);
	bool inside = a.x < 14.0 && a.y < 7.5;
	if (!inside) base = wood ? base * 0.55 + vec3(0.02, 0.05, 0.08) : field * 0.6;
	// the key (paint) and the centre circle
	float in_key = step(a.x, 14.0) * step(14.0 - 5.8, a.x) * step(a.y, 2.45);
	base = mix(base, key_col, in_key * (wood ? 0.85 : 1.0));
	float l = 0.0;
	float w = 0.05;
	l = max(l, line(a.x - 14.0, w) * step(a.y, 7.5));
	l = max(l, line(a.y - 7.5, w) * step(a.x, 14.0));
	l = max(l, line(p.x, w) * step(a.y, 7.5));
	l = max(l, line(length(p) - 1.8, w));
	// the key's edges and free-throw circle
	l = max(l, line(a.y - 2.45, w) * step(14.0 - 5.8, a.x) * step(a.x, 14.0));
	l = max(l, line(a.x - (14.0 - 5.8), w) * step(a.y, 2.45));
	l = max(l, line(length(vec2(a.x - (14.0 - 5.8), p.y)) - 1.8, w) * step(a.x, 14.0 - 5.8));
	// three-point line: arc of 6.75 m round the basket (1.575 m in from the baseline), straight near the corners
	vec2 hoop = vec2(14.0 - 1.575, 0.0);
	float arc = line(length(vec2(a.x - hoop.x, p.y)) - 6.75, w) * step(a.x, hoop.x + 0.01) * step(a.y, 6.6);
	float corner = line(a.y - 6.6, w) * step(hoop.x, a.x) * step(a.x, 14.0);
	l = max(l, max(arc, corner));
	base = mix(base, vec3(0.97), l);
	ALBEDO = base;
	ROUGHNESS = wood ? 0.25 : 0.85;
	if (has_surf) { NORMAL_MAP = texture(surf_n, p * (wood ? 0.42 : 0.3)).xyz; NORMAL_MAP_DEPTH = wood ? 0.5 : 1.0; }
	SPECULAR = wood ? 0.6 : 0.3;
}
""", {"wood": wood, "key_col": key, "field": field})
	var set := "wood_floor" if wood else "asphalt_02"
	if Materials.has(set):
		m.set_shader_parameter("surf", load("res://textures/pbr/%s_diff.jpg" % set))
		m.set_shader_parameter("surf_n", load("res://textures/pbr/%s_nor.jpg" % set))
		m.set_shader_parameter("has_surf", true)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(32, 18)
	fl.mesh = pm
	fl.material_override = m
	fl.position = at + Vector3(0, 0.01, 0)
	world.add_child(fl)

## a hoop at the end of the court (`dir` +1 east, -1 west): pole or stanchion, backboard, rim and net
func _hoop(at: Vector3, dir: float, arena: bool) -> void:
	var base_x := at.x + dir * (14.0 + (1.2 if arena else 0.6))
	var board_x := at.x + dir * (14.0 - 1.2)
	var pad := flat(Color(0.08, 0.08, 0.1), 0.6)
	if arena:
		_box(Vector3(1.6, 1.0, 2.0), Vector3(base_x + dir * 0.6, at.y + 0.5, at.z), pad)
		_box(Vector3(0.3, 3.0, 0.4), Vector3(base_x, at.y + 2.0, at.z), pad)
		var arm := _box(Vector3(2.6, 0.25, 0.25), Vector3((base_x + board_x) * 0.5, at.y + 3.55, at.z), flat(Color(0.75, 0.76, 0.8), 0.3, 0.8))
		arm.rotation.z = dir * 0.08
	else:
		_cyl(0.09, 3.4, Vector3(base_x, at.y + 1.7, at.z), flat(Color(0.25, 0.3, 0.32), 0.4, 0.8))
		_box(Vector3(absf(base_x - board_x), 0.1, 0.1), Vector3((base_x + board_x) * 0.5, at.y + 3.3, at.z), flat(Color(0.25, 0.3, 0.32), 0.4, 0.8))
	# backboard: glass with a white frame and target square
	var g := glass(Color(0.85, 0.92, 1.0, 0.25)) if arena else flat(Color(0.92, 0.92, 0.9), 0.6)
	_box(Vector3(0.04, 1.05, 1.8), Vector3(board_x, at.y + 3.4, at.z), g)
	var frame := flat(Color(0.95, 0.95, 0.95), 0.4)
	for dz: float in [-0.9, 0.9]:
		_box(Vector3(0.06, 1.05, 0.05), Vector3(board_x, at.y + 3.4, at.z + dz), frame)
	for dy: float in [-0.52, 0.52]:
		_box(Vector3(0.06, 0.05, 1.8), Vector3(board_x, at.y + 3.4 + dy, at.z), frame)
	_box(Vector3(0.05, 0.45, 0.04), Vector3(board_x - dir * 0.01, at.y + 3.27, at.z - 0.29), frame)
	_box(Vector3(0.05, 0.45, 0.04), Vector3(board_x - dir * 0.01, at.y + 3.27, at.z + 0.29), frame)
	_box(Vector3(0.05, 0.04, 0.6), Vector3(board_x - dir * 0.01, at.y + 3.48, at.z), frame)
	# rim at 3.05 m and a net
	var rim := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.215
	t.outer_radius = 0.235
	t.rings = 24
	rim.mesh = t
	rim.position = Vector3(board_x - dir * 0.38, at.y + 3.05, at.z)
	rim.material_override = flat(Color(1.0, 0.35, 0.05), 0.3, 0.6)
	world.add_child(rim)
	var net := flat(Color(0.95, 0.95, 0.95, 0.55), 0.8)
	net.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	net.cull_mode = BaseMaterial3D.CULL_DISABLED
	var n := _cyl(0.22, 0.42, rim.position + Vector3(0, -0.21, 0), net, null, 0.13, 12)
	(n.mesh as CylinderMesh).cap_top = false
	(n.mesh as CylinderMesh).cap_bottom = false

## players on a court: two teams in the given colours, spread over the half-court in play, plus a ball
func _players(at: Vector3, a: Color, b: Color, seed: int, n := 5) -> void:
	var r := RandomNumberGenerator.new()
	r.seed = seed
	for k in n * 2:
		var team := k % 2
		var p := at + Vector3(r.randf_range(-12.5, 2.0), 0, r.randf_range(-6.5, 6.5))
		var face := (at + Vector3(-12.4, 0, 0) - p).normalized()
		var mi := _person(p, atan2(face.x, face.z) + (PI if team == 1 else 0.0), [0, 2, 1, 0, 3][k % 5], a if team == 0 else b, r)
		mi.scale = Vector3.ONE * r.randf_range(1.05, 1.16)   # players run tall
	_ball(0.12, at + Vector3(-10.5, 2.4, 0.6), flat(Color(0.85, 0.38, 0.12), 0.7))

## rows of seated fans: one multimesh per block, cheering in _process (the casino's crowd)
func _seat_fans(points: Array[Vector3], yaw_to: Vector3, cols: Array) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = figure(1)
	mm.instance_count = points.size()
	var r := RandomNumberGenerator.new()
	r.seed = points.size()
	var start := _crowd_base.size()
	for k in points.size():
		var p := points[k]
		var d := yaw_to - p
		var xf := Transform3D(Basis(Vector3.UP, atan2(d.x, d.z)).scaled(Vector3.ONE * r.randf_range(0.9, 1.02)), p + Vector3(0, -0.45, 0))
		mm.set_instance_transform(k, xf)
		var c: Color = cols[r.randi() % cols.size()]
		mm.set_instance_color(k, c)
		_crowd_base.append(xf)
		_crowd_phase.append(r.randf() * TAU)
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.7
	mmi.material_override = m
	world.add_child(mmi)
	_fan_blocks.append([mmi, start])

## the casino's _process animates one crowd; here every block bobs
var _fan_blocks: Array = []
func _process(delta: float) -> void:
	_t += delta
	for b: Array in _fan_blocks:
		var mmi: MultiMeshInstance3D = b[0]
		var start: int = b[1]
		for k in mmi.multimesh.instance_count:
			var xf := _crowd_base[start + k]
			xf.origin.y += absf(sin(_t * 3.6 + _crowd_phase[start + k])) * 0.12
			mmi.multimesh.set_instance_transform(k, xf)
	for w in _wheels:
		w.rotation.y += delta * 0.3

# --------------------------------------------------------------------------------------------- the arena
func _arena() -> void:
	var o := ARENA
	_court(o, true, Color(0.0, 0.35, 0.55), Color(0.2, 0.2, 0.2))
	# apron beyond the court, dark
	_box(Vector3(44, 0.02, 28), o + Vector3(0, -0.005, 0), flat(Color(0.06, 0.07, 0.09), 0.5))
	_hoop(o, 1.0, true)
	_hoop(o, -1.0, true)
	_label("VOLTAGE", o + Vector3(0, 0.03, 0), 0.0, HOME, 160, 0.012).rotation.x = -PI / 2
	# the bowl: rows rising on all four sides (a rounded rectangle), 22 rows, lower and upper decks
	var seat_cols := [HOME, HOME, Color(0.06, 0.06, 0.08), Color(0.9, 0.9, 0.92), HOME.darkened(0.4), AWAY, Color(0.5, 0.05, 0.08), Color(0.15, 0.25, 0.5)]
	var riser: Material = Materials.pbr("brushed_concrete", Color(0.3, 0.31, 0.34), 3.0)
	var seat := flat(Color(0.05, 0.25, 0.45), 0.5)
	var fans: Array[Vector3] = []
	for row in 22:
		var deck_gap := 2.0 if row >= 12 else 0.0
		var hx := 19.0 + row * 0.85 + deck_gap
		var hz := 12.0 + row * 0.85 + deck_gap
		var yy := o.y + 0.5 + row * 0.55 + (1.6 if row >= 12 else 0.0)
		for side in 4:
			var along_x := side < 2
			var sgn := 1.0 if side % 2 == 0 else -1.0
			var length := (hx * 2.0) if along_x else (hz * 2.0)
			var pos := Vector3(0, yy, sgn * hz) if along_x else Vector3(sgn * hx, yy, 0)
			var size := Vector3(length, 0.55, 0.85) if along_x else Vector3(0.85, 0.55, length)
			_box(size, o + pos - Vector3(0, 0.275, 0), riser)
			_box(size * Vector3(1, 0.18, 0.55) if along_x else size * Vector3(0.55, 0.18, 1), o + pos + Vector3(0, 0.08, 0), seat)
			# fans: most seats full
			var count := int(length / 0.62)
			for k in count:
				if _rng.randf() < 0.12:
					continue
				var t := (k + 0.5) / count - 0.5
				var fp := o + (Vector3(t * length, yy, sgn * hz) if along_x else Vector3(sgn * hx, yy, t * length))
				fans.append(fp)
	# split into blocks so each multimesh stays a sensible size
	var block: Array[Vector3] = []
	for k in fans.size():
		block.append(fans[k])
		if block.size() >= 900 or k == fans.size() - 1:
			_seat_fans(block, o + Vector3(0, 1, 0), seat_cols)
			block = []
	# ribbon boards round the front of each deck
	var ribbon := _shader("""
shader_type spatial;
render_mode unshaded;
void fragment() {
	float x = UV.x * 60.0 - TIME * 3.0;
	float band = step(0.5, fract(x * 0.25));
	vec3 a = vec3(0.1, 0.85, 1.0), b = vec3(1.0, 0.45, 0.1);
	float chev = step(0.5, fract(x + abs(UV.y - 0.5) * 2.0));
	ALBEDO = mix(a, b, band) * (0.6 + 0.6 * chev) * 1.6;
}
""")
	for deck: float in [0.0, 12.0]:
		var hx2 := 19.0 + deck * 0.85 + (2.0 if deck > 0.0 else 0.0) - 0.5
		var hz2 := 12.0 + deck * 0.85 + (2.0 if deck > 0.0 else 0.0) - 0.5
		var yy2 := o.y + 0.4 + deck * 0.55 + (1.6 if deck > 0.0 else 0.0)
		_box(Vector3(hx2 * 2.0, 0.7, 0.05), o + Vector3(0, yy2, hz2), ribbon)
		_box(Vector3(hx2 * 2.0, 0.7, 0.05), o + Vector3(0, yy2, -hz2), ribbon)
		_box(Vector3(0.05, 0.7, hz2 * 2.0), o + Vector3(hx2, yy2, 0), ribbon)
		_box(Vector3(0.05, 0.7, hz2 * 2.0), o + Vector3(-hx2, yy2, 0), ribbon)
	# roof: a dark bowl with a ring of lights
	_box(Vector3(90, 1, 70), o + Vector3(0, 28, 0), flat(Color(0.03, 0.03, 0.04), 0.8))
	for k in 24:
		var a := TAU * k / 24.0
		_ball(0.4, o + Vector3(cos(a) * 24.0, 25.0, sin(a) * 16.0), flat(Color(1.0, 0.96, 0.9), 0.3, 0.0, 8.0))
	# the centre-hung scoreboard
	var screen := _shader("""
shader_type spatial;
render_mode unshaded;
void fragment() {
	vec2 px = floor(UV * vec2(120.0, 60.0)) / vec2(120.0, 60.0);
	float pulse = 0.5 + 0.5 * sin(TIME * 2.0);
	vec3 top = mix(vec3(0.02, 0.2, 0.35), vec3(0.05, 0.45, 0.7), px.y);
	vec3 c = top * (0.7 + 0.3 * pulse);
	float dots = step(0.2, fract(UV.x * 120.0)) * step(0.2, fract(UV.y * 60.0));
	ALBEDO = c * dots * 1.6;
}
""")
	var sb := Node3D.new()
	sb.position = o + Vector3(0, 16, 0)
	world.add_child(sb)
	_box(Vector3(9, 5, 6), Vector3.ZERO, flat(Color(0.04, 0.04, 0.05), 0.5), sb)
	for side2 in 4:
		var yaw := side2 * PI / 2
		var long_side := side2 % 2 == 0
		var dist := 3.03 if long_side else 4.53
		var face := Vector3(sin(yaw), 0, cos(yaw)) * dist
		var s := _box(Vector3(8.6 if long_side else 5.6, 4.4, 0.04), face, screen, sb)
		s.rotation.y = yaw
		_label("VOLTAGE  88", face * 1.002 + Vector3(0, 1.1, 0), yaw, HOME, 120, 0.012, sb)
		_label("TIDE  84", face * 1.002 + Vector3(0, -0.1, 0), yaw, AWAY, 120, 0.012, sb)
		_label("Q4  2:31", face * 1.002 + Vector3(0, -1.3, 0), yaw, Color(1.0, 0.9, 0.5), 90, 0.012, sb)
	_box(Vector3(9.4, 0.5, 6.4), Vector3(0, -2.8, 0), ribbon, sb)
	_wheels.append(sb)
	# benches, the scorer's table, court-side seats
	_box(Vector3(9, 0.9, 0.8), o + Vector3(0, 0.45, 8.6), flat(Color(0.05, 0.05, 0.06), 0.4))
	_box(Vector3(9, 0.5, 0.05), o + Vector3(0, 0.6, 8.18), ribbon)
	for sx: float in [-1.0, 1.0]:
		for k in 8:
			_box(Vector3(0.5, 0.45, 0.5), o + Vector3(sx * (6.5 + k * 0.6), 0.23, 8.9), flat(HOME if sx < 0 else AWAY, 0.5))
	# light: bright, even arena light from above, cool fill
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-80, 20, 0)
	key.light_energy = 0.0   # the arena is lit by its own rig below; the moon from the base scene lights the outside
	world.add_child(key)
	for k in 6:
		var px := -15.0 + k * 6.0
		_light(o + Vector3(px, 18, -6), Color(1.0, 0.97, 0.92), 6.0, 30.0)
		_light(o + Vector3(px, 18, 6), Color(1.0, 0.97, 0.92), 6.0, 30.0)
	_light(o + Vector3(0, 10, 22), Color(0.6, 0.8, 1.0), 3.0, 26.0)
	_light(o + Vector3(0, 10, -22), Color(0.6, 0.8, 1.0), 3.0, 26.0)
	_players(o, Color(0.95, 0.95, 0.97), AWAY, 3)
	var ref_r := RandomNumberGenerator.new()
	ref_r.seed = 4
	_person(o + Vector3(-5.0, 0, -7.0), 0.5, 0, Color(0.15, 0.15, 0.15), ref_r)
	_label("PULSE ARENA · HOME OF THE NEXUS VOLTAGE", o + Vector3(0, 24, -40), 0.0, HOME, 160, 0.03)

# --------------------------------------------------------------------------------------------- the street courts
func _courts() -> void:
	var o := COURTS
	# the lot: two courts side by side on a slab by the water
	_box(Vector3(80, 0.4, 60), o + Vector3(0, -0.2, 0), Materials.pbr("asphalt_02", Color(0.8, 0.8, 0.82), 4.0))
	_court(o + Vector3(0, 0, -10), false, Color(0.75, 0.2, 0.18), Color(0.12, 0.3, 0.5))
	_court(o + Vector3(0, 0, 10), false, Color(0.95, 0.65, 0.15), Color(0.15, 0.38, 0.25))
	for z: float in [-10.0, 10.0]:
		_hoop(o + Vector3(0, 0, z), 1.0, false)
		_hoop(o + Vector3(0, 0, z), -1.0, false)
	# water beyond the south fence
	var sea := _shader("""
shader_type spatial;
void fragment() {
	float w = sin(UV.x * 300.0 + TIME) * cos(UV.y * 260.0 - TIME * 0.8);
	ALBEDO = vec3(0.01, 0.04, 0.07);
	ROUGHNESS = 0.05;
	METALLIC = 0.2;
	NORMAL_MAP = vec3(0.5 + 0.06 * w, 0.5 + 0.06 * sin(UV.y * 400.0 + TIME), 1.0);
}
""")
	var water := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1200, 600)
	water.mesh = pm
	water.material_override = sea
	water.position = o + Vector3(0, -1.2, 330)
	world.add_child(water)
	# chain-link fence round the lot
	var link := _shader("""
shader_type spatial;
render_mode cull_disabled;
void fragment() {
	vec2 p = UV * vec2(260.0, 40.0);
	vec2 d = abs(fract(vec2(p.x + p.y, p.x - p.y) * 0.5) - 0.5);
	float wire = 1.0 - smoothstep(0.03, 0.08, min(d.x, d.y));
	if (wire < 0.5) discard;
	ALBEDO = vec3(0.55, 0.58, 0.6);
	METALLIC = 0.8;
	ROUGHNESS = 0.4;
}
""")
	var post := flat(Color(0.4, 0.42, 0.44), 0.4, 0.8)
	for side in 4:
		var along_x := side < 2
		var sgn := 1.0 if side % 2 == 0 else -1.0
		var length := 70.0 if along_x else 50.0
		var pos := o + (Vector3(0, 2.0, sgn * 25.0) if along_x else Vector3(sgn * 35.0, 2.0, 0))
		var f := _box(Vector3(length, 4.0, 0.02) if along_x else Vector3(0.02, 4.0, length), pos, link)
		f.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		for k in int(length / 3.0) + 1:
			var t := -length * 0.5 + k * 3.0
			_cyl(0.04, 4.1, pos + (Vector3(t, 0, 0) if along_x else Vector3(0, 0, t)), post, null, -1.0, 6)
	# a mural wall on the north side
	var mural := _shader("""
shader_type spatial;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	vec2 p = UV * vec2(14.0, 3.0);
	float a = n(p * 1.5) + 0.5 * n(p * 4.0);
	vec3 c1 = vec3(1.0, 0.25, 0.55), c2 = vec3(0.1, 0.8, 1.0), c3 = vec3(1.0, 0.8, 0.15), c4 = vec3(0.45, 0.2, 0.9);
	vec3 c = mix(mix(c1, c2, smoothstep(0.4, 0.6, a)), mix(c3, c4, smoothstep(0.6, 0.9, a)), smoothstep(0.5, 1.0, n(p * 0.7 + 3.0)));
	float stroke = smoothstep(0.02, 0.0, abs(fract(a * 3.0) - 0.5) - 0.46);
	ALBEDO = mix(c * 0.85, vec3(0.05), stroke);
	ROUGHNESS = 0.9;
}
""")
	_box(Vector3(60, 5, 0.6), o + Vector3(0, 2.5, -27.5), mural)
	_label("SUNSET COURTS", o + Vector3(0, 6.0, -27.1), 0.0, Color(1.0, 0.6, 0.3), 220, 0.022)
	# floodlights: tall poles with heads, real lights
	var head := flat(Color(1.0, 0.97, 0.9), 0.3, 0.0, 7.0)
	for px: float in [-24.0, 0.0, 24.0]:
		for pz: float in [-23.0, 23.0]:
			_cyl(0.12, 11, o + Vector3(px, 5.5, pz), post, null, 0.08, 8)
			_box(Vector3(2.0, 0.6, 0.4), o + Vector3(px, 11, pz - signf(pz) * 0.3), head)
			var sp := SpotLight3D.new()
			sp.position = o + Vector3(px, 10.8, pz)
			sp.look_at_from_position(sp.position, o + Vector3(px * 0.5, 0, pz * 0.25))
			sp.light_energy = 18.0
			sp.spot_range = 34.0
			sp.spot_angle = 55.0
			sp.light_color = Color(1.0, 0.95, 0.85)
			sp.shadow_enabled = px == 0.0
			world.add_child(sp)
	# the floods' spill: an even wash over both courts (spots alone fall short on phones)
	for z2: float in [-10.0, 10.0]:
		for x2: float in [-8.0, 8.0]:
			_light(o + Vector3(x2, 9.0, z2), Color(1.0, 0.95, 0.85), 3.2, 20.0)
	# bleachers on the east side
	for row in 5:
		_box(Vector3(1.0, 0.1, 22.0), o + Vector3(30.0 + row * 0.9, 0.5 + row * 0.5, 0), flat(Color(0.55, 0.57, 0.6), 0.4, 0.7))
	var r := RandomNumberGenerator.new()
	r.seed = 12
	var outfits := [Color(0.95, 0.95, 0.95), Color(0.06, 0.06, 0.07), Color(0.8, 0.1, 0.15), Color(0.1, 0.3, 0.7), Color(0.95, 0.7, 0.1)]
	for k in 14:
		var row2 := r.randi() % 5
		_person(o + Vector3(30.0 + row2 * 0.9, 0.55 + row2 * 0.5 - 0.45, r.randf_range(-10, 10)), -PI / 2, 3 if r.randf() < 0.6 else 1, outfits[r.randi() % outfits.size()], r)
	# palms along the water and benches
	for k in 6:
		_palm(o + Vector3(-30.0 + k * 12.0, 0, 28.5), r.randf_range(7.0, 10.0))
	for k in 4:
		_box(Vector3(2.4, 0.45, 0.6), o + Vector3(-20.0 + k * 12.0, 0.23, 23.5), flat(Color(0.35, 0.22, 0.12), 0.8))
	# pickup games on both courts
	_players(o + Vector3(0, 0, -10), Color(0.95, 0.95, 0.95), Color(0.08, 0.08, 0.1), 21)
	_players(o + Vector3(0, 0, 10), Color(0.85, 0.15, 0.2), Color(0.15, 0.4, 0.85), 22, 3)

# --------------------------------------------------------------------------------------------- the gym
func _gym() -> void:
	var o := GYM
	var Wd := 36.0
	var Ln := 26.0
	var rubber := _shader("""
shader_type spatial;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec2 p = UV * 900.0;
	float fleck = step(0.93, h(floor(p)));
	vec2 tile = fract(UV * vec2(36.0, 26.0));
	float seam = step(0.985, max(tile.x, tile.y));
	ALBEDO = vec3(0.06, 0.062, 0.066) + vec3(0.3, 0.31, 0.33) * fleck * 0.12 - seam * 0.02;
	ROUGHNESS = 0.9;
}
""")
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(Wd, Ln)
	fl.mesh = pm
	fl.material_override = Materials.pbr("rubber_tiles", Color(0.9, 0.9, 0.95), 1.0) if Materials.has("rubber_tiles") else rubber
	fl.position = o
	world.add_child(fl)
	var wall: Material = Materials.pbr("brushed_concrete", Color(0.55, 0.56, 0.6), 3.0)
	_box(Vector3(Wd, 6, 0.3), o + Vector3(0, 3, -Ln * 0.5), wall)
	_box(Vector3(Wd, 6, 0.3), o + Vector3(0, 3, Ln * 0.5), wall)
	_box(Vector3(0.3, 6, Ln), o + Vector3(Wd * 0.5, 3, 0), wall)
	_box(Vector3(0.3, 6, Ln), o + Vector3(-Wd * 0.5, 3, 0), wall)
	_box(Vector3(Wd, 0.3, Ln), o + Vector3(0, 6, 0), flat(Color(0.08, 0.08, 0.09), 0.8))
	# exposed ceiling: ducts and linear lights
	for k in 5:
		_box(Vector3(Wd - 1, 0.08, 0.2), o + Vector3(0, 5.6, -10 + k * 5.0), flat(Color(0.95, 0.97, 1.0), 0.3, 0.0, 5.0))
	_cyl(0.5, Wd - 1, o + Vector3(0, 5.2, -12), flat(Color(0.5, 0.52, 0.55), 0.4, 0.9)).rotation.z = PI / 2
	# mirror wall on the north and a green neon line
	var mirror := StandardMaterial3D.new()
	mirror.albedo_color = Color(0.85, 0.88, 0.9)
	mirror.metallic = 1.0
	mirror.roughness = 0.02
	_box(Vector3(Wd - 2, 2.6, 0.05), o + Vector3(0, 1.6, -Ln * 0.5 + 0.2), mirror)
	_box(Vector3(Wd - 2, 0.08, 0.06), o + Vector3(0, 3.05, -Ln * 0.5 + 0.22), flat(Color(0.3, 1.0, 0.5), 0.3, 0.0, 5.0))
	_label("IRON PULSE FITNESS", o + Vector3(0, 4.3, -Ln * 0.5 + 0.2), 0.0, Color(0.3, 1.0, 0.5), 160, 0.016)
	_label("NO EXCUSES · 24 / 7", o + Vector3(Wd * 0.5 - 0.2, 4.2, 0), -PI / 2, Color(1.0, 1.0, 1.0), 110, 0.012)
	for k in 4:
		_light(o + Vector3(-12 + k * 8, 5.0, 0), Color(0.95, 0.97, 1.0), 3.0, 16.0)
	var steel := flat(Color(0.18, 0.19, 0.2), 0.35, 0.85)
	var chrome := flat(Color(0.8, 0.82, 0.85), 0.15, 1.0)
	var black: Material = Materials.surface("leather_red_02", Color(0.045, 0.045, 0.05), 0.4, 0.8)
	var green := flat(Color(0.2, 0.8, 0.4), 0.5)
	# squat racks along the mirror
	for k in 4:
		var x := -15.0 + k * 4.5
		var z := -Ln * 0.5 + 2.6
		for dx: float in [-0.6, 0.6]:
			for dz: float in [-0.6, 0.6]:
				_box(Vector3(0.08, 2.4, 0.08), o + Vector3(x + dx, 1.2, z + dz), steel)
		_box(Vector3(1.3, 0.08, 0.08), o + Vector3(x, 2.4, z - 0.6), steel)
		_box(Vector3(1.3, 0.08, 0.08), o + Vector3(x, 2.4, z + 0.6), steel)
		_box(Vector3(1.4, 0.02, 1.4), o + Vector3(x, 0.01, z), flat(Color(0.25, 0.18, 0.12), 0.8))   # platform
		_barbell(o + Vector3(x, 1.45, z + 0.62), k)
	# flat benches with barbells
	for k in 3:
		var bx := -12.0 + k * 5.0
		var bz := -2.5
		_box(Vector3(0.3, 0.08, 1.2), o + Vector3(bx, 0.45, bz), black)
		_box(Vector3(0.08, 0.45, 0.08), o + Vector3(bx, 0.22, bz - 0.5), steel)
		_box(Vector3(0.08, 0.45, 0.08), o + Vector3(bx, 0.22, bz + 0.5), steel)
		for dx2: float in [-0.55, 0.55]:
			_box(Vector3(0.06, 1.1, 0.06), o + Vector3(bx + dx2, 0.55, bz - 0.55), steel)
		_barbell(o + Vector3(bx, 1.08, bz - 0.55), k + 2, true)
	# dumbbell rack: three tiers, pairs from light to heavy
	var rack_x := -Wd * 0.5 + 1.0
	for tier in 3:
		_box(Vector3(0.7, 0.06, 12.0), o + Vector3(rack_x, 0.35 + tier * 0.35, 2.0), steel)
	for tier in 3:
		for k in 10:
			var w := 0.08 + (tier * 10 + k) * 0.004
			var dz := -3.5 + k * 1.15
			for pair in 2:
				var at := o + Vector3(rack_x - 0.15 + pair * 0.3, 0.45 + tier * 0.35, 2.0 + dz)
				_cyl(0.015, 0.22, at, chrome, null, -1.0, 8).rotation.z = 0.0
				var bell := _cyl(w * 0.5, 0.06, at + Vector3(0, 0, -0.12), black, null, -1.0, 8)
				bell.rotation.x = PI / 2
				var bell2 := _cyl(w * 0.5, 0.06, at + Vector3(0, 0, 0.12), black, null, -1.0, 8)
				bell2.rotation.x = PI / 2
	# kettlebells on the floor
	for k in 8:
		var kp := o + Vector3(rack_x + 1.4, 0.13, -4.0 + k * 0.5)
		_ball(0.1 + k * 0.006, kp, [black, green, flat(Color(0.9, 0.2, 0.2), 0.5)][k % 3])
		var handle := MeshInstance3D.new()
		var t := TorusMesh.new()
		t.inner_radius = 0.05
		t.outer_radius = 0.07
		handle.mesh = t
		handle.rotation.x = PI / 2
		handle.position = kp + Vector3(0, 0.12, 0)
		handle.material_override = black
		world.add_child(handle)
	# a cable crossover
	var cx := -2.0
	var cz := -Ln * 0.5 + 6.0
	for sx: float in [-1.6, 1.6]:
		_box(Vector3(0.25, 2.6, 0.4), o + Vector3(cx + sx, 1.3, cz), steel)
		_box(Vector3(0.18, 0.9, 0.3), o + Vector3(cx + sx, 0.6, cz - 0.05), black)   # weight stack
		_cyl(0.006, 1.6, o + Vector3(cx + sx * 0.8, 1.6, cz), chrome).rotation.z = sx * 0.4
	_box(Vector3(3.5, 0.15, 0.4), o + Vector3(cx, 2.6, cz), steel)
	# cardio: rows of treadmills and bikes facing screens on the east wall
	for k in 5:
		var tz := -9.0 + k * 2.2
		var tx := 9.5
		_box(Vector3(1.9, 0.22, 0.8), o + Vector3(tx, 0.11, tz), black)
		_box(Vector3(1.6, 0.02, 0.5), o + Vector3(tx, 0.23, tz), flat(Color(0.1, 0.1, 0.1), 0.95))
		for dz2: float in [-0.38, 0.38]:
			var arm := _box(Vector3(0.06, 1.2, 0.06), o + Vector3(tx + 0.8, 0.7, tz + dz2), steel)
			arm.rotation.z = -0.15
		_box(Vector3(0.3, 0.35, 0.8), o + Vector3(tx + 0.95, 1.3, tz), black)
		_box(Vector3(0.02, 0.22, 0.5), o + Vector3(tx + 0.79, 1.35, tz), flat(Color(0.3, 0.7, 1.0), 0.3, 0.0, 3.0))
		# a bike beside each
		var bxp := o + Vector3(14.0, 0, tz)
		_box(Vector3(1.1, 0.08, 0.4), bxp + Vector3(0, 0.05, 0), black)
		_cyl(0.28, 0.06, bxp + Vector3(0.35, 0.4, 0), steel).rotation.x = PI / 2
		_box(Vector3(0.06, 0.9, 0.06), bxp + Vector3(-0.2, 0.5, 0), steel)
		_box(Vector3(0.3, 0.06, 0.2), bxp + Vector3(-0.25, 0.98, 0), black)
		_box(Vector3(0.06, 1.0, 0.06), bxp + Vector3(0.4, 0.55, 0), steel)
		_box(Vector3(0.1, 0.06, 0.45), bxp + Vector3(0.42, 1.08, 0), black)
	for k in 3:
		_box(Vector3(0.08, 1.2, 2.0), o + Vector3(Wd * 0.5 - 0.2, 2.6, -8.0 + k * 4.0), flat(Color(0.2, 0.5, 0.9), 0.3, 0.0, 2.2))
	# the boxing corner: a ring and heavy bags
	var ring_at := o + Vector3(12.0, 0, -7.5)
	_box(Vector3(6, 0.9, 6), ring_at + Vector3(0, 0.45, 0), flat(Color(0.12, 0.12, 0.14), 0.6))
	_box(Vector3(5.8, 0.05, 5.8), ring_at + Vector3(0, 0.92, 0), Materials.surface("velour_velvet", Color(0.2, 0.35, 0.75), 0.5))
	var rope_cols := [flat(Color(0.9, 0.1, 0.15), 0.5), flat(Color(0.95, 0.95, 0.95), 0.5), flat(Color(0.1, 0.3, 0.9), 0.5)]
	for cx2: float in [-2.8, 2.8]:
		for cz2: float in [-2.8, 2.8]:
			_cyl(0.07, 1.5, ring_at + Vector3(cx2, 1.65, cz2), steel)
	for lvl in 3:
		var yy := 1.3 + lvl * 0.35
		var mat: Material = rope_cols[lvl]
		_box(Vector3(5.6, 0.04, 0.04), ring_at + Vector3(0, yy, -2.8), mat)
		_box(Vector3(5.6, 0.04, 0.04), ring_at + Vector3(0, yy, 2.8), mat)
		_box(Vector3(0.04, 0.04, 5.6), ring_at + Vector3(-2.8, yy, 0), mat)
		_box(Vector3(0.04, 0.04, 5.6), ring_at + Vector3(2.8, yy, 0), mat)
	for k in 4:
		var bag_at := o + Vector3(4.0 + k * 2.0, 0, -11.5)
		_cyl(0.01, 1.2, bag_at + Vector3(0, 5.2, 0), chrome)
		var bag := MeshInstance3D.new()
		var cap := CapsuleMesh.new()
		cap.radius = 0.22
		cap.height = 1.2
		bag.mesh = cap
		bag.position = bag_at + Vector3(0, 3.9 - 1.6, 0)
		bag.material_override = flat([Color(0.6, 0.05, 0.08), Color(0.05, 0.05, 0.06)][k % 2], 0.45, 0.1)
		world.add_child(bag)
	# people training
	var r := RandomNumberGenerator.new()
	r.seed = 31
	var kit := [Color(0.06, 0.06, 0.07), Color(0.2, 0.8, 0.4), Color(0.85, 0.85, 0.87), Color(0.15, 0.3, 0.7), Color(0.75, 0.1, 0.15)]
	_person(o + Vector3(-15.0 + 4.5, 0, -Ln * 0.5 + 3.2), PI, 1, kit[0], r)       # squatting under the bar
	_person(o + Vector3(-6.0, 0, -Ln * 0.5 + 3.4), PI, 1, kit[1], r)
	_person(o + Vector3(rack_x + 1.0, 0, 0.5), PI / 2, 0, kit[2], r)
	_person(o + Vector3(rack_x + 1.1, 0, 4.0), PI / 2 + 0.5, 3, kit[3], r)
	for k in 3:
		_person(o + Vector3(9.4, 0.23, -9.0 + k * 4.4), PI / 2, 0, kit[(k + 1) % kit.size()], r)
	_person(ring_at + Vector3(-0.9, 0.92, 0.2), PI / 2, 3, kit[4], r)
	_person(ring_at + Vector3(0.9, 0.92, -0.2), -PI / 2, 3, kit[0], r)
	_person(o + Vector3(6.0, 0, -10.8), 0.0, 3, kit[2], r)

func _barbell(at: Vector3, seed: int, flat_bench := false) -> void:
	var chrome := flat(Color(0.8, 0.82, 0.85), 0.15, 1.0)
	var bar := _cyl(0.014, 2.2, at, chrome, null, -1.0, 8)
	bar.rotation.z = PI / 2
	var plate_cols := [Color(0.75, 0.1, 0.12), Color(0.1, 0.3, 0.8), Color(0.95, 0.75, 0.1), Color(0.1, 0.6, 0.3), Color(0.05, 0.05, 0.06)]
	var n := 1 + seed % 3 if not flat_bench else 1
	for sx: float in [-1.0, 1.0]:
		for k in n:
			var p := _cyl(0.225 - k * 0.04, 0.05, at + Vector3(sx * (0.72 + k * 0.055), 0, 0), flat(plate_cols[(seed + k) % plate_cols.size()], 0.5), null, -1.0, 20)
			p.rotation.z = PI / 2
