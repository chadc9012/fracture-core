extends "res://scripts/city/casino_interior.gd"
## The entertainment district (owner, Nov 11: "work on the casino and entertainment areas in Nexus and Neon City";
## Nexus stays casino-free — Neon City's Grand Casino is the only casino). One scene, dressed per city:
##  - NEXUS NIGHTS (Nexus City): cream stone, gold and ice-blue light, the ordered capital look.
##  - THE NEON STRIP (Neon City): black glass, magenta and cyan, cyberpunk.
## Four places, stepped through with NEXT VIEW (the buttons jump):
##  - THE STRIP: a pedestrian plaza at night under string lights — the nightclub with its rope line and bouncer, the
##    arcade, the cinema's chasing-bulb marquee and posters, the live hall's LED banner; food carts, palms, a crowd.
##  - THE NIGHTCLUB: an LED dance floor, a DJ booth under an LED wall, sweeping beams in the haze, a bar, dancers.
##  - THE ARCADE: rows of cabinets with live screens, claw machines, air hockey, the prize counter, neon tubes.
##  - THE CINEMA: a stepped auditorium of red seats facing a playing screen, the projector beam overhead.
## People are the street's dressed civilian bodies (civilians.gd guests); the cinema audience is seated stand-ins.

## "nexus" or "neon": set before the node enters the tree
var city := "nexus"

const CLUB := Vector3(300, 0, 0)
const ARCADE := Vector3(-300, 0, 0)
const CINEMA := Vector3(0, 0, 300)

var _names := {}
var _a := Color(0.3, 0.75, 1.0)      # the city's first accent
var _b := Color(0.95, 0.72, 0.32)    # second accent
var _dancers: Array[Node3D] = []
var _dancer_base: Array[Vector3] = []
var _led_strips: Array[MeshInstance3D] = []

func _ready() -> void:
	_rng.seed = 91 if city == "nexus" else 92
	if city == "neon":
		_a = Color(1.0, 0.2, 0.75)
		_b = Color(0.2, 0.95, 1.0)
		_names = { "title": "THE NEON STRIP", "club": "VOLTAGE", "arcade": "NEO ARCADE", "cinema": "NEON CINEPLEX", "hall": "NEON AMPHITHEATRE" }
	else:
		_names = { "title": "NEXUS NIGHTS", "club": "PULSE", "arcade": "PIXEL VAULT", "cinema": "NEXUS GRAND CINEMA", "hall": "NEXUS LIVE HALL" }
	_views = [
		["THE STRIP", Vector3(0, 2.1, 58), Vector3(0, 4.0, -20)],
		["THE STRIP — " + _names.club, Vector3(-5, 1.8, 18), Vector3(-17, 2.6, 6)],
		["THE STRIP — " + _names.cinema, Vector3(4, 1.9, 2), Vector3(17, 4.0, -14)],
		["THE NIGHTCLUB", CLUB + Vector3(0, 2.4, 13), CLUB + Vector3(0, 2.2, -8)],
		["THE NIGHTCLUB — DJ", CLUB + Vector3(7, 1.8, -2), CLUB + Vector3(0, 2.6, -10)],
		["THE ARCADE", ARCADE + Vector3(-15, 1.7, -5.8), ARCADE + Vector3(8, 1.2, -5.8)],
		["THE CINEMA", CINEMA + Vector3(0, 7.2, 15.5), CINEMA + Vector3(0, 4.2, -15)],
	]
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
	Phone.fit_viewport(vp)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	_night_env()
	_skyline()
	_strip()
	_club()
	_arcade()
	_cinema()
	_merge_static()
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.05
	cam.far = 2500.0
	world.add_child(cam)
	cam.current = true
	var row := HBoxContainer.new()
	row.position = Vector2(16, 16)
	row.add_theme_constant_override("separation", 8)
	add_child(row)
	var add := func(text: String, f: Callable) -> void:
		var bt := Button.new()
		bt.text = text
		bt.pressed.connect(f)
		row.add_child(bt)
	add.call("← STREET", func(): closed.emit())
	add.call("NEXT VIEW", func(): show_view(_view + 1))
	add.call("THE STRIP", func(): show_view(0))
	add.call("CLUB", func(): show_view(3))
	add.call("ARCADE", func(): show_view(5))
	add.call("CINEMA", func(): show_view(6))
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_color_override("font_color", _b)
	_title.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.4))
	_title.add_theme_constant_override("outline_size", 6)
	_title.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_title.position = Vector2(20, -56)
	add_child(_title)
	show_view(0)

func show_view(i: int) -> void:
	_view = posmod(i, _views.size())
	# the rooms are closed boxes 300 m from the strip: inside one, draw nothing past its walls (the phone budget)
	cam.far = 2500.0 if _view < 3 else 60.0
	cam.position = _views[_view][1]
	cam.look_at(_views[_view][2])
	_title.text = String(_names.title) + " · " + String(_views[_view][0])

func _process(delta: float) -> void:
	super(delta)
	for k in _dancers.size():
		var d := _dancers[k]
		var ph := k * 1.7
		d.position = _dancer_base[k] + Vector3(sin(_t * 2.1 + ph) * 0.08, absf(sin(_t * 4.2 + ph)) * 0.07, 0)
		d.rotation.y = d.get_meta("yaw", 0.0) + sin(_t * 1.3 + ph) * 0.5

# --------------------------------------------------------------------------------------------- light
func _night_env() -> void:
	var sky := ShaderMaterial.new()
	sky.shader = load("res://shaders/sky3d.gdshader")
	sky.set_shader_parameter("top_col", Color(0.02, 0.025, 0.07))
	sky.set_shader_parameter("hor_col", Color(0.24, 0.12, 0.3) if city == "neon" else Color(0.2, 0.17, 0.3))
	sky.set_shader_parameter("ground_col", Color(0.02, 0.02, 0.03))
	sky.set_shader_parameter("night", 1.0)
	sky.set_shader_parameter("cloud_cover", 0.45)
	sky.set_shader_parameter("cloud_tint", Color(0.85, 0.6, 1.0) if city == "neon" else Color(0.75, 0.75, 0.95))
	var s := Sky.new()
	s.sky_material = sky
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = s
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.42, 0.62) if city == "neon" else Color(0.55, 0.5, 0.6)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.1
	env.ssr_enabled = Data.forward_plus()
	env.ssao_enabled = Data.forward_plus()
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_bloom = 0.1
	env.glow_hdr_threshold = 1.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.25, 0.12, 0.3) if city == "neon" else Color(0.2, 0.18, 0.28)
	env.fog_density = 0.004
	env.adjustment_enabled = true
	env.adjustment_color_correction = Grade.lut("night")
	env.adjustment_saturation = 1.15 if city == "neon" else 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var moon := DirectionalLight3D.new()
	moon.rotation_degrees = Vector3(-42, -130, 0)
	moon.light_energy = 0.22
	moon.light_color = Color(0.6, 0.7, 1.0)
	world.add_child(moon)

## an animated emissive panel: kind 0 LED dance floor, 1 LED wall (equaliser bars), 2 arcade screen, 3 film,
## 4 chasing bulbs, 5 poster, 6 LED banner
func _anim(kind: int, a: Color, b: Color, seed := 0.0, strength := 2.0) -> ShaderMaterial:
	return _shader("""
shader_type spatial;
uniform int kind = 0;
uniform vec3 ca : source_color = vec3(1.0, 0.2, 0.7);
uniform vec3 cb : source_color = vec3(0.2, 0.9, 1.0);
uniform float seed = 0.0;
uniform float strength = 2.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 13.1) * 43758.5453); }
void fragment() {
	vec2 uv = UV;
	float t = TIME;
	vec3 c = vec3(0.0);
	if (kind == 0) {
		vec2 cell = floor(uv * 12.0);
		vec2 f = fract(uv * 12.0);
		float wave = sin(length(cell - 6.0) * 0.8 - t * 3.0) * 0.5 + 0.5;
		float on = step(0.45, fract(h(cell) + t * 0.6 + wave));
		c = mix(ca, cb, wave) * on * smoothstep(0.0, 0.08, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
	} else if (kind == 1) {
		float bar = floor(uv.x * 32.0);
		float lvl = 0.25 + 0.7 * abs(sin(t * (2.0 + h(vec2(bar, 1.0)) * 4.0) + bar));
		float on = step(1.0 - uv.y, lvl) * step(0.15, fract(uv.x * 32.0)) * step(0.2, fract(uv.y * 24.0));
		c = mix(cb, ca, uv.y) * on;
	} else if (kind == 2) {
		vec2 p = uv * vec2(8.0, 6.0);
		float scan = 0.85 + 0.15 * sin(uv.y * 300.0);
		float sprite = step(0.72, h(floor(p + vec2(floor(t * 2.0 + seed), 0.0))));
		vec3 bg = mix(ca * 0.25, cb * 0.25, uv.y);
		c = (bg + mix(ca, cb, h(floor(p))) * sprite) * scan;
		c += vec3(1.0, 0.9, 0.3) * step(0.94, uv.y) * step(fract(uv.x * 10.0 + t), 0.5);
	} else if (kind == 3) {
		float sky = smoothstep(0.0, 1.0, uv.y);
		c = mix(vec3(0.9, 0.5, 0.25), vec3(0.15, 0.25, 0.5), 1.0 - sky);
		float x = fract(uv.x * 0.6 + t * 0.03);
		float ridge = 0.35 + 0.1 * sin(x * 18.0) + 0.05 * sin(x * 51.0);
		c = mix(c, vec3(0.04, 0.03, 0.05), step(1.0 - uv.y, ridge));
		float ship = 1.0 - smoothstep(0.0, 0.02, length((uv - vec2(fract(t * 0.05), 0.3)) * vec2(1.0, 3.0)) - 0.03);
		c = mix(c, vec3(0.9), ship);
	} else if (kind == 4) {
		float bulb = 1.0 - smoothstep(0.25, 0.35, length(fract(uv * vec2(40.0, 1.0)) - 0.5));
		float chase = step(0.5, fract(floor(uv.x * 40.0) / 3.0 - t * 2.0));
		c = ca * bulb * (0.25 + 0.75 * chase);
	} else if (kind == 5) {
		c = mix(ca, cb, uv.y) * 0.6;
		float fig = 1.0 - smoothstep(0.0, 0.01, length((uv - vec2(0.5, 0.42)) * vec2(1.6, 1.0)) - 0.2);
		c = mix(c, vec3(0.05), fig * 0.85);
		c += vec3(1.0) * step(0.82, 1.0 - uv.y) * step(0.12, uv.x) * step(uv.x, 0.88) * step(0.5, h(floor(uv * vec2(14.0, 30.0))));
	} else {
		float x = fract(uv.x - t * 0.15);
		float letter = step(0.5, h(floor(vec2(x * 26.0, uv.y * 5.0)))) * step(0.2, uv.y) * step(uv.y, 0.8);
		c = mix(ca, cb, x) * (0.2 + letter);
	}
	ALBEDO = vec3(0.0);
	ROUGHNESS = 0.35;
	EMISSION = c * strength;
}
""", { "kind": kind, "ca": a, "cb": b, "seed": seed, "strength": strength })

# --------------------------------------------------------------------------------------------- the strip
func _strip() -> void:
	var nexus := city == "nexus"
	var stone := Materials.pbr("painted_plaster_wall", Color(0.78, 0.74, 0.66) if nexus else Color(0.09, 0.09, 0.11), 4.0)
	# wet, reflective paving
	var paving := _shader("""
shader_type spatial;
uniform vec3 lo : source_color = vec3(0.12, 0.12, 0.14);
uniform vec3 hi : source_color = vec3(0.2, 0.2, 0.22);
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void fragment() {
	vec2 g = wp.xz / 1.2;
	vec2 f = abs(fract(g) - 0.5);
	float joint = 1.0 - smoothstep(0.47, 0.49, max(f.x, f.y));
	vec3 c = mix(lo, hi, h(floor(g)));
	ALBEDO = c * mix(0.5, 1.0, joint);
	ROUGHNESS = mix(0.4, 0.06, h(floor(g * 0.5) + 3.0) * joint);
	SPECULAR = 0.7;
}
""", { "lo": Color(0.16, 0.15, 0.15) if nexus else Color(0.07, 0.07, 0.09), "hi": Color(0.26, 0.24, 0.22) if nexus else Color(0.13, 0.12, 0.15) })
	_box(Vector3(40, 0.2, 140), Vector3(0, -0.1, 0), paving)
	# --- the nightclub (west, z 0..18): a black box in an LED frame, the rope line and the bouncer
	var black := flat(Color(0.03, 0.03, 0.035), 0.3, 0.5)
	_box(Vector3(4, 14, 20), Vector3(-20, 7, 9), black)
	for e: Array in [[Vector3(0.2, 0.25, 20.4), Vector3(-17.9, 13.9, 9)], [Vector3(0.2, 14, 0.125), Vector3(-17.9, 7, -1.1)], [Vector3(0.2, 14, 0.125), Vector3(-17.9, 7, 19.1)]]:
		_led_strips.append(_box(e[0], e[1], _anim(4, _a, _b, 1.0, 3.0)))
	_box(Vector3(0.1, 3.4, 2.6), Vector3(-17.95, 1.7, 9), flat(Color(0.01, 0.01, 0.01), 0.2))
	_label(String(_names.club), Vector3(-17.8, 8.5, 9), PI * 0.5, _a, 260, 0.011)
	_box(Vector3(0.1, 0.5, 9.0), Vector3(-17.9, 4.2, 9), _anim(6, _a, _b, 2.0, 2.5))
	_light(Vector3(-15, 4, 9), _a, 3.0, 12.0)
	# rope line: brass posts and a red velvet rope, the queue beside it
	for k in 6:
		_cyl(0.05, 1.0, Vector3(-15.6, 0.5, 11.0 + k * 1.6), flat(_b if not nexus else GOLD, 0.2, 1.0))
		_ball(0.07, Vector3(-15.6, 1.02, 11.0 + k * 1.6), flat(GOLD, 0.2, 1.0))
		if k < 5:
			var rope := _cyl(0.025, 1.6, Vector3(-15.6, 0.85, 11.8 + k * 1.6), flat(CRIMSON, 0.6))
			rope.rotation.x = PI * 0.5
	var n_queue := int(round(6 * Phone.crowd()))
	for k in n_queue:
		_guest(Vector3(-14.6 + _rng.randf_range(-0.2, 0.2), 0.0, 11.4 + k * 1.3), PI * 0.5 + 2.6 + _rng.randf_range(-0.3, 0.3))
	if _has_role("security"):
		_guest(Vector3(-16.6, 0.0, 9.6), PI * 0.5, "security")
	# --- the arcade (west, z -34..-12): a glass front full of cabinets
	_box(Vector3(4, 10, 22), Vector3(-20, 5, -23), stone)
	_box(Vector3(0.1, 4.2, 20), Vector3(-17.95, 2.3, -23), _anim(2, _a, _b, 4.0, 1.4))
	_box(Vector3(0.3, 0.2, 21), Vector3(-17.9, 4.5, -23), flat(Color(0.06, 0.06, 0.07), 0.3, 0.6))
	_label(String(_names.arcade), Vector3(-17.8, 6.6, -23), PI * 0.5, _b, 220, 0.01)
	_box(Vector3(0.12, 0.16, 20), Vector3(-17.85, 5.6, -23), _anim(4, _b, _a, 3.0, 3.0))
	_light(Vector3(-15, 3, -23), _b, 2.5, 12.0)
	# --- the cinema (east, z -28..-2): a stone front, the marquee with chasing bulbs, posters, the box office
	_box(Vector3(4, 16, 26), Vector3(20, 8, -15), stone)
	_box(Vector3(3.0, 0.5, 18), Vector3(16.6, 5.6, -15), flat(Color(0.08, 0.06, 0.05), 0.3, 0.6))
	for yy: float in [5.38, 5.82]:
		_box(Vector3(0.06, 0.1, 18), Vector3(15.1, yy, -15), _anim(4, Color(1.0, 0.85, 0.5), _b, 5.0, 4.0))
	_label(String(_names.cinema), Vector3(17.9, 8.2, -15), -PI * 0.5, Color(1.0, 0.9, 0.7), 200, 0.009)
	_label("NOW SHOWING", Vector3(15.05, 5.6, -15), -PI * 0.5, Color(1.0, 0.85, 0.55), 90, 0.011)
	for k in 4:
		_box(Vector3(0.1, 2.6, 1.7), Vector3(17.95, 2.3, -24.0 + k * 3.0 + (6.0 if k > 1 else 0.0)), _anim(5, [_a, _b, Color(1.0, 0.5, 0.2), Color(0.5, 0.9, 0.4)][k], Color(0.05, 0.05, 0.1), k, 1.3))
	_box(Vector3(1.2, 2.4, 3.0), Vector3(17.4, 1.2, -15), flat(Color(0.25, 0.12, 0.06), 0.4, 0.4))
	_box(Vector3(0.05, 1.0, 2.6), Vector3(16.79, 1.7, -15), glass())
	_label("BOX OFFICE", Vector3(16.75, 2.55, -15), -PI * 0.5, Color(1.0, 0.85, 0.55), 60, 0.009)
	_light(Vector3(15, 4, -15), Color(1.0, 0.8, 0.55), 3.0, 14.0)
	# --- the live hall (east, z 2..40): a tall front with an LED banner and the doors
	_box(Vector3(4, 20, 38), Vector3(20, 10, 21), stone if nexus else black)
	_box(Vector3(0.1, 5.0, 30), Vector3(17.95, 13, 21), _anim(1, _a, _b, 7.0, 1.2))
	_box(Vector3(0.1, 1.2, 30), Vector3(17.95, 9.4, 21), _anim(6, _b, _a, 8.0, 2.4))
	_label(String(_names.hall), Vector3(17.8, 17.4, 21), -PI * 0.5, Color(1.0, 0.95, 0.85), 220, 0.011)
	for k in 4:
		_box(Vector3(0.1, 3.2, 2.2), Vector3(17.95, 1.6, 12.0 + k * 3.0), flat(Color(0.02, 0.02, 0.02), 0.2, 0.3))
		_box(Vector3(0.12, 0.12, 2.2), Vector3(17.9, 3.3, 12.0 + k * 3.0), flat(_b, 0.4, 0.0, 3.0))
	# wall washers: light pooled up the venue fronts so the stone and glass read at night
	for spec: Array in [[Vector3(-16.5, 0.6, 9), _a], [Vector3(-16.5, 0.6, -23), _b], [Vector3(16.5, 0.6, -15), Color(1.0, 0.8, 0.55)], [Vector3(16.5, 0.6, 21), _b], [Vector3(16.5, 0.6, 32), _a], [Vector3(0, 0.6, -68), _b]]:
		_light(spec[0], spec[1], 2.6, 14.0)
	# the plaza's back walls so the strip reads as a street, not a stage set
	_box(Vector3(40, 14, 4), Vector3(0, 7, -72), stone)
	_label(String(_names.title), Vector3(0, 10, -69.9), 0.0, _b, 320, 0.014)
	_box(Vector3(4, 12, 30), Vector3(-20, 6, 40), stone)
	_box(Vector3(4, 12, 28), Vector3(-20, 6, -52), stone)
	_box(Vector3(4, 12, 28), Vector3(20, 6, -48), stone)
	_box(Vector3(4, 12, 30), Vector3(20, 6, 56), stone)
	# string lights across the plaza: warm bulbs on a sagging line
	var bulb := flat(Color(1.0, 0.82, 0.55), 0.4, 0.0, 5.0)
	for k in 9:
		var z := -56.0 + k * 13.0
		for j in 17:
			var t := j / 16.0
			var x := lerpf(-17.5, 17.5, t)
			var y := 7.2 - sin(t * PI) * 1.4
			_ball(0.09, Vector3(x, y, z + sin(t * PI) * 2.0), bulb)
	for k in 5:
		_light(Vector3(0, 6.0, -48.0 + k * 22.0), Color(1.0, 0.8, 0.55), 2.2, 18.0)
	# palms in planters and food carts down the middle
	for k in 5:
		var z2 := -44.0 + k * 22.0
		_box(Vector3(2.2, 0.7, 2.2), Vector3(0, 0.35, z2), stone)
		_palm(Vector3(0, 0.7, z2), 6.5)
	for spec: Array in [[Vector3(-7, 0, -38), _a], [Vector3(7, 0, -6), _b], [Vector3(-6, 0, 30), Color(1.0, 0.55, 0.2)]]:
		var at: Vector3 = spec[0]
		_box(Vector3(2.6, 1.0, 1.4), at + Vector3(0, 0.7, 0), flat(Color(0.82, 0.8, 0.76), 0.4, 0.3))
		_box(Vector3(2.9, 0.08, 1.9), at + Vector3(0, 2.4, 0), flat(spec[1], 0.6, 0.0, 0.6))
		for sx: float in [-1.2, 1.2]:
			_box(Vector3(0.05, 1.2, 0.05), at + Vector3(sx, 1.8, -0.6), flat(Color(0.7, 0.7, 0.72), 0.3, 0.8))
		_light(at + Vector3(0, 2.0, 0.8), Color(1.0, 0.8, 0.55), 1.2, 5.0)
	# the crowd on the strip
	var n := int(round(18 * Phone.crowd()))
	for k in n:
		var p := Vector3(_rng.randf_range(-13.0, 13.0), 0.0, _rng.randf_range(-50.0, 45.0))
		if absf(p.x) < 2.2 or _views.any(func(v: Array) -> bool: return (v[1] as Vector3).distance_to(p + Vector3(0, 1.6, 0)) < 4.0):
			continue
		var street_wear := _rng.randf() < 0.6
		_civ_guest(p, _rng.randf() * TAU, "" if street_wear else "evening")

func _has_role(id: String) -> bool:
	for r in Civilians.roles():
		if r.id == id:
			return true
	return false

## a guest from a role group ("" = the street mix)
func _civ_guest(at: Vector3, yaw: float, group: String) -> Node3D:
	if not _civ:
		_civ = Civilians.new()
		world.add_child(_civ)
		_civ._rng.seed = 5511
	return _civ.guest(world, at, yaw, group)

# --------------------------------------------------------------------------------------------- the nightclub
func _club() -> void:
	var o := CLUB
	var wall := flat(Color(0.03, 0.03, 0.04), 0.4, 0.3)
	_box(Vector3(30, 0.2, 26), o + Vector3(0, -0.1, 0), flat(Color(0.04, 0.04, 0.05), 0.15, 0.6))
	_box(Vector3(30, 0.3, 26), o + Vector3(0, 8, 0), wall)
	for sx: float in [-1.0, 1.0]:
		_box(Vector3(0.4, 8, 26), o + Vector3(sx * 15, 4, 0), wall)
	_box(Vector3(30, 8, 0.2), o + Vector3(0, 4, -13), wall)
	_box(Vector3(30, 8, 0.2), o + Vector3(0, 4, 13), wall)
	# the LED dance floor
	var df := _box(Vector3(12, 0.06, 12), o + Vector3(0, 0.03, 0), _anim(0, _a, _b, 1.0, 0.85))
	df.mesh = PlaneMesh.new()
	(df.mesh as PlaneMesh).size = Vector2(12, 12)
	# the DJ booth and the LED wall behind it
	_box(Vector3(5, 1.2, 1.6), o + Vector3(0, 0.6 + 0.6, -9.5), flat(Color(0.08, 0.08, 0.09), 0.3, 0.7))
	_box(Vector3(5.2, 0.1, 1.8), o + Vector3(0, 1.85, -9.5), _anim(4, _a, _b, 2.0, 3.0))
	_box(Vector3(5.6, 1.2, 2.4), o + Vector3(0, 0.6, -9.5), flat(Color(0.05, 0.05, 0.06), 0.3, 0.6))
	_box(Vector3(18, 5.2, 0.2), o + Vector3(0, 4.6, -12.7), _anim(1, _a, _b, 3.0, 1.1))
	_guest(o + Vector3(0, 1.2, -10.4), 0.0)
	# speaker stacks
	for sx: float in [-1.0, 1.0]:
		for k in 3:
			_box(Vector3(1.4, 1.2, 1.2), o + Vector3(sx * 8.5, 0.6 + k * 1.22, -10.5), flat(Color(0.04, 0.04, 0.045), 0.5, 0.2))
			_cyl(0.42, 0.05, o + Vector3(sx * 8.5, 0.6 + k * 1.22, -9.88), flat(Color(0.12, 0.12, 0.13), 0.6), null, -1.0, 20).rotation.x = PI * 0.5
	# sweeping beams from the rig
	for k in 8:
		var pivot := Node3D.new()
		pivot.position = o + Vector3(-10.5 + k * 3.0, 7.6, -6.0)
		world.add_child(pivot)
		var beam := _cyl(0.03, 14.0, Vector3(0, -7.0, 0), _beam_mat(_a if k % 2 == 0 else _b), pivot, 0.32, 10)
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_beams.append(pivot)
	# the bar along the right wall
	_box(Vector3(1.4, 1.1, 14), o + Vector3(12.4, 0.55, 2), flat(Color(0.08, 0.06, 0.05), 0.2, 0.4))
	_box(Vector3(1.6, 0.06, 14.2), o + Vector3(12.4, 1.13, 2), flat(Color(0.9, 0.9, 0.92), 0.05, 0.2))
	_box(Vector3(0.1, 0.08, 14.2), o + Vector3(11.6, 1.0, 2), flat(_a, 0.4, 0.0, 4.0))
	_box(Vector3(0.3, 3.0, 12), o + Vector3(14.7, 2.4, 2), _anim(2, _b, _a, 9.0, 0.6))
	_label(String(_names.club), o + Vector3(0, 6.8, -12.55), 0.0, Color(1, 1, 1), 300, 0.01)
	# haze-lit pools and dancers
	_light(o + Vector3(0, 5, 0), _a, 3.0, 16.0)
	_light(o + Vector3(-8, 4, 6), _b, 2.0, 12.0)
	_light(o + Vector3(8, 4, 6), _a, 2.0, 12.0)
	var n := int(round(16 * Phone.crowd()))
	for k in n:
		var p := o + Vector3(_rng.randf_range(-5.5, 5.5), 0.0, _rng.randf_range(-5.0, 5.5))
		if _views.any(func(v: Array) -> bool: return (v[1] as Vector3).distance_to(p + Vector3(0, 1.6, 0)) < 2.5):
			continue
		var yaw := _rng.randf_range(-0.8, 0.8)
		var d := _civ_guest(p, yaw, "evening" if _rng.randf() < 0.5 else "")
		d.set_meta("yaw", yaw)
		_dancers.append(d)
		_dancer_base.append(p)
	for k in int(round(4 * Phone.crowd())):
		_civ_guest(o + Vector3(10.8, 0.0, -3.0 + k * 2.2), -PI * 0.5, "evening")

## move a holder's pieces straight under the world (keeping where they are) so the static merge can fold them
func _flatten(holder: Node3D) -> void:
	for c in holder.get_children():
		var n3 := c as Node3D
		var xf := holder.transform * n3.transform
		holder.remove_child(n3)
		world.add_child(n3)
		n3.transform = xf
	holder.queue_free()

func _beam_mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(c.r, c.g, c.b, 0.07)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

# --------------------------------------------------------------------------------------------- the arcade
func _arcade() -> void:
	var o := ARCADE
	var wall := flat(Color(0.06, 0.05, 0.09), 0.6)
	var carpet := _shader("""
shader_type spatial;
uniform vec3 ca : source_color;
uniform vec3 cb : source_color;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz * 1.8;
	float sq = step(0.5, fract(p.x + floor(p.y) * 0.5)) * step(0.82, fract(p.y));
	float circ = 1.0 - smoothstep(0.04, 0.07, abs(length(fract(p * 0.5) - 0.5) - 0.3));
	vec3 c = vec3(0.03, 0.02, 0.06);
	ALBEDO = c;
	EMISSION = (ca * circ + cb * sq * 0.6) * 0.22;
	ROUGHNESS = 0.95;
}
""", { "ca": _a, "cb": _b })
	_box(Vector3(34, 0.2, 24), o + Vector3(0, -0.1, 0), carpet)
	_box(Vector3(34, 0.3, 24), o + Vector3(0, 5.5, 0), wall)
	for sx: float in [-1.0, 1.0]:
		_box(Vector3(0.4, 5.5, 24), o + Vector3(sx * 17, 2.75, 0), wall)
	_box(Vector3(34, 5.5, 0.4), o + Vector3(0, 2.75, -12), wall)
	_box(Vector3(34, 5.5, 0.4), o + Vector3(0, 2.75, 12), wall)
	# neon tubes on the ceiling
	for k in 7:
		_box(Vector3(30, 0.06, 0.06), o + Vector3(0, 5.25, -9 + k * 3.0), flat(_a if k % 2 == 0 else _b, 0.4, 0.0, 1.6))
	# rows of cabinets facing each other across aisles; six shared screen looks (one material each, so the static merge
	# can fold the cabinets into a handful of meshes on the phone)
	var screens: Array = []
	for k in 6:
		screens.append(_anim(2, _a, _b, float(k * 11), 1.5))
	for row in 4:
		var z := -8.0 + row * 4.4
		for k in 9:
			for face: float in [-1.0, 1.0]:
				var at := o + Vector3(-12.0 + k * 2.0, 0.0, z + face * 0.75)
				var yaw := 0.0 if face > 0 else PI
				var holder := Node3D.new()
				holder.position = at
				holder.rotation.y = yaw
				world.add_child(holder)
				var body_c: Color = [Color(0.12, 0.1, 0.2), Color(0.2, 0.06, 0.1), Color(0.05, 0.12, 0.2), Color(0.1, 0.1, 0.1)][(k + row) % 4]
				_box(Vector3(0.95, 1.9, 0.8), Vector3(0, 0.95, 0), flat(body_c, 0.4, 0.2), holder)
				var scr := _box(Vector3(0.8, 0.62, 0.05), Vector3(0, 1.45, 0.38), screens[(k * 7 + row * 3 + int(face + 1.0)) % 6], holder)
				scr.rotation.x = -0.25
				_box(Vector3(0.95, 0.28, 0.1), Vector3(0, 2.02, 0.36), flat([_a, _b, Color(1.0, 0.6, 0.2)][(k + row) % 3], 0.4, 0.0, 1.3), holder)
				_box(Vector3(0.9, 0.08, 0.35), Vector3(0, 1.0, 0.55), flat(Color(0.08, 0.08, 0.09), 0.3, 0.5), holder)
				_flatten(holder)
	# claw machines along the back wall, the prize counter, two air hockey tables
	var plush := [Color(1.0, 0.4, 0.6), Color(0.4, 0.8, 1.0), Color(1.0, 0.85, 0.3), Color(0.6, 1.0, 0.5), Color(0.8, 0.5, 1.0)]
	for k in 5:
		var at := o + Vector3(-12.0 + k * 2.4, 0.0, -10.6)
		_box(Vector3(1.6, 0.9, 1.4), at + Vector3(0, 0.45, 0), flat(_b if k % 2 else _a, 0.4, 0.2, 0.4))
		_box(Vector3(1.6, 1.3, 1.4), at + Vector3(0, 1.55, 0), glass(Color(0.7, 0.8, 0.9, 0.1)))
		for j in 9:
			_ball(0.15, at + Vector3(_rng.randf_range(-0.6, 0.6), 1.05 + _rng.randf() * 0.25, _rng.randf_range(-0.5, 0.5)), flat(plush[(j + k) % plush.size()], 0.8))
		_box(Vector3(1.7, 0.2, 1.5), at + Vector3(0, 2.3, 0), flat(Color(0.9, 0.9, 0.95), 0.3, 0.0, 2.0))
	_box(Vector3(8, 1.1, 1.2), o + Vector3(10, 0.55, -10.8), flat(Color(0.1, 0.08, 0.14), 0.3, 0.3))
	_box(Vector3(8, 2.6, 0.3), o + Vector3(10, 2.4, -11.6), _anim(5, _a, _b, 3.0, 0.9))
	_label("PRIZES", o + Vector3(10, 4.2, -11.4), 0.0, _b, 160, 0.009)
	for sx: float in [-1.0, 1.0]:
		var at := o + Vector3(sx * 8.0, 0.0, 9.0)
		_box(Vector3(2.4, 0.85, 1.3), at + Vector3(0, 0.42, 0), flat(Color(0.1, 0.1, 0.12), 0.3, 0.5))
		_box(Vector3(2.3, 0.04, 1.2), at + Vector3(0, 0.86, 0), flat(Color(0.85, 0.9, 0.95), 0.1, 0.0, 0.4))
		_box(Vector3(0.04, 0.05, 1.2), at + Vector3(0, 0.89, 0), flat(_a, 0.4, 0.0, 3.0))
	_label(String(_names.arcade), o + Vector3(0, 4.2, 11.7), PI, _a, 240, 0.008)
	_light(o + Vector3(-6, 4, 0), _a, 2.2, 14.0)
	_light(o + Vector3(6, 4, 0), _b, 2.2, 14.0)
	# players at the cabinets
	var n := int(round(10 * Phone.crowd()))
	for k in n:
		var row := _rng.randi() % 4
		var face := 1.0 if _rng.randf() < 0.5 else -1.0
		var cab := _rng.randi() % 9
		var p := o + Vector3(-12.0 + cab * 2.0, 0.0, -8.0 + row * 4.4 + face * 1.6)
		_civ_guest(p, PI if face > 0 else 0.0, "")

# --------------------------------------------------------------------------------------------- the cinema
func _cinema() -> void:
	var o := CINEMA
	var wall := Materials.pbr("painted_plaster_wall", Color(0.2, 0.05, 0.07), 3.0)
	_box(Vector3(28, 12, 0.2), o + Vector3(0, 6, -16), flat(Color(0.02, 0.02, 0.02), 0.6))
	_box(Vector3(28, 0.3, 34), o + Vector3(0, 12, 0), flat(Color(0.03, 0.02, 0.03), 0.8))
	for sx: float in [-1.0, 1.0]:
		_box(Vector3(0.4, 12, 34), o + Vector3(sx * 14, 6, 0), wall)
		for k in 6:
			_box(Vector3(0.2, 0.6, 0.25), o + Vector3(sx * 13.7, 3.0, -10.0 + k * 4.5), flat(Color(1.0, 0.75, 0.45), 0.4, 0.0, 2.0))
	_box(Vector3(28, 12, 0.2), o + Vector3(0, 6, 17), wall)
	# the screen, playing
	var scr := _box(Vector3(22, 9.4, 0.05), o + Vector3(0, 6.2, -15.7), _anim(3, Color.WHITE, Color.WHITE, 0.0, 1.6))
	scr.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_light(o + Vector3(0, 6, -10), Color(0.9, 0.7, 0.55), 1.4, 22.0)
	_light(o + Vector3(0, 8, 8), Color(1.0, 0.7, 0.5), 2.0, 24.0)
	_light(o + Vector3(-12, 5, 2), Color(1.0, 0.75, 0.5), 1.4, 12.0)
	_light(o + Vector3(12, 5, 2), Color(1.0, 0.75, 0.5), 1.4, 12.0)
	# stepped rows of red seats, an audience in them
	var seat := flat(Color(0.5, 0.05, 0.08), 0.75)
	var step := flat(Color(0.2, 0.1, 0.09), 0.9)
	var r := RandomNumberGenerator.new()
	r.seed = 5
	for row in 10:
		var z := -6.0 + row * 2.0
		var y := row * 0.45
		_box(Vector3(26, 0.45 + y, 2.0), o + Vector3(0, (0.45 + y) * 0.5, z), step)
		for k in 16:
			var x := -11.25 + k * 1.5
			if absf(x) < 1.0:
				continue
			var at := o + Vector3(x, y + 0.45, z)
			_box(Vector3(1.2, 0.45, 0.6), at + Vector3(0, 0.25, 0.1), seat)
			_box(Vector3(1.2, 0.85, 0.15), at + Vector3(0, 0.6, 0.48), seat)
			if r.randf() < 0.55:
				# seated stand-ins: only the upper body shows over the seat in front (full rigs are kept for the standing
				# crowds; a cinema seats hundreds)
				_person(at + Vector3(0, -0.45, 0.1), PI, 0, [Color(0.1, 0.1, 0.12), Color(0.5, 0.06, 0.1), Color(0.8, 0.78, 0.7), Color(0.12, 0.2, 0.35)][r.randi() % 4], r)
	# the projector beam from the booth
	var beam := _cyl(0.2, 34.0, o + Vector3(0, 9.0, 1.0), _beam_mat(Color(0.9, 0.9, 1.0)), null, 3.5, 16)
	beam.rotation.x = PI * 0.5 - 0.08
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	(beam.material_override as StandardMaterial3D).albedo_color.a = 0.05
