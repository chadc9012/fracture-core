extends Control
## The Skyline Casino: the tower at the head of the Nexus block, three places stacked in one scene.
##  - THE FLOOR: a gold-and-crimson gaming hall under coffered chandeliers — banks of slot machines with live screens,
##    blackjack, roulette and craps tables, a round centre bar with a lit bottle wall, the cashier cage and the elevators.
##  - THE PENTHOUSE: the prestige residence on the 60th floor — a glass-walled living room over the night city, a grand
##    piano, a kitchen island and a bedroom, the private crafting studio, a lit weapon wall and the equipment vault, and a
##    terrace with an infinity pool.
##  - THE SKYDECK: the rooftop concert venue — a truss stage with an LED wall, speaker stacks, sweeping beams, a band and a
##    crowd that moves to the beat, the skyline all round.
## All original names. Views step through NEXT VIEW; the level buttons ride the elevator.
signal closed

const FLOOR_Y := 0.0
const PENT_Y := 240.0
const ROOF_Y := 262.0
const GOLD := Color(0.95, 0.72, 0.32)
const CRIMSON := Color(0.55, 0.05, 0.09)

var cam: Camera3D
var world: Node3D
var _rng := RandomNumberGenerator.new()
var _t := 0.0
var _wheels: Array[Node3D] = []
var _beams: Array[Node3D] = []
var _crowd: MultiMeshInstance3D
var _crowd_base: Array[Transform3D] = []
var _crowd_phase := PackedFloat32Array()
## [name, from, to]
var _views := [
	["THE FLOOR", Vector3(0, 2.2, 34), Vector3(0, 3.2, -10)],
	["THE FLOOR — SLOTS", Vector3(-13, 1.75, 6.5), Vector3(-30, 1.3, 5.0)],
	["THE FLOOR — TABLES", Vector3(7, 2.3, 12), Vector3(15, 0.9, 3)],
	["THE FLOOR — BAR", Vector3(-8, 1.8, 6), Vector3(0, 1.8, -6)],
	["PENTHOUSE", Vector3(12, PENT_Y + 1.7, 3), Vector3(-10, PENT_Y + 1.0, -6)],
	["PENTHOUSE — STUDIO & VAULT", Vector3(-3, PENT_Y + 1.7, 1.5), Vector3(-8, PENT_Y + 1.3, 9.4)],
	["PENTHOUSE — TERRACE", Vector3(-12, PENT_Y + 2.4, -12), Vector3(6, PENT_Y - 0.5, -28)],
	["SKYDECK — CROWD", Vector3(3, ROOF_Y + 3.4, 29), Vector3(0, ROOF_Y + 5.5, -14)],
	["SKYDECK — STAGE", Vector3(14, ROOF_Y + 6.0, -2), Vector3(-4, ROOF_Y + 3.0, -14)],
]
var _view := 0
var _title: Label

func _ready() -> void:
	_rng.seed = 77
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
	_skyline()
	_floor()
	_penthouse()
	_skydeck()
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.05
	cam.far = 2500.0
	world.add_child(cam)
	cam.current = true
	# buttons
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
	add.call("FLOOR", func(): show_view(0))
	add.call("PENTHOUSE", func(): show_view(4))
	add.call("SKYDECK", func(): show_view(7))
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 22)
	_title.add_theme_color_override("font_color", GOLD)
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
	_title.text = "SKYLINE CASINO · " + String(_views[_view][0])

func _process(delta: float) -> void:
	_t += delta
	for w in _wheels:
		w.rotation.y += delta * 1.6
	for k in _beams.size():
		var b := _beams[k]
		b.rotation.z = sin(_t * 0.9 + k * 0.8) * 0.55
		b.rotation.x = -0.25 + cos(_t * 0.7 + k) * 0.25
	if _crowd:
		for k in _crowd_base.size():
			var xf := _crowd_base[k]
			xf.origin.y += absf(sin(_t * 4.2 + _crowd_phase[k])) * 0.16
			_crowd.multimesh.set_instance_transform(k, xf)

# --------------------------------------------------------------------------------------------- helpers
static func flat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

static func glass(tint := Color(0.6, 0.75, 0.85, 0.12)) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = tint
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.03
	m.metallic = 0.5
	return m

func _shader(code: String, params := {}) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = code
	var m := ShaderMaterial.new()
	m.shader = sh
	for k: String in params:
		m.set_shader_parameter(k, params[k])
	return m

func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null, yaw := 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.rotation.y = yaw
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

func _cyl(r: float, h: float, pos: Vector3, mat: Material, parent: Node3D = null, r_top := -1.0, sides := 24) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r if r_top < 0.0 else r_top
	c.bottom_radius = r
	c.height = h
	c.radial_segments = sides
	mi.mesh = c
	mi.position = pos
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

func _ball(r: float, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = 16
	s.rings = 8
	mi.mesh = s
	mi.position = pos
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

func _label(text: String, pos: Vector3, yaw: float, c: Color, size := 96, px := 0.008, parent: Node3D = null) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = px
	l.modulate = c * 2.4
	l.outline_size = 0
	l.shaded = false
	l.double_sided = false
	l.position = pos
	l.rotation.y = yaw
	(parent if parent else world).add_child(l)
	return l

func _light(pos: Vector3, c: Color, energy: float, rng: float, shadow := false) -> OmniLight3D:
	var o := OmniLight3D.new()
	o.position = pos
	o.light_color = c
	o.light_energy = energy
	o.omni_range = rng
	o.shadow_enabled = shadow
	world.add_child(o)
	return o

## a simple person in one mesh: surface 0 clothes, surface 1 skin, surface 2 hair. pose 0 standing, 1 both arms up,
## 2 one arm up, 3 seated-ish (arms forward). About 1.75 m tall, feet at y 0, facing +Z.
static var _figures := {}
static func figure(pose: int, female := false) -> ArrayMesh:
	var key := pose * 2 + (1 if female else 0)
	if _figures.has(key):
		return _figures[key]
	var surf := [SurfaceTool.new(), SurfaceTool.new(), SurfaceTool.new()]
	for st: SurfaceTool in surf:
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var put := func(idx: int, pm: PrimitiveMesh, xf: Transform3D) -> void:
		(surf[idx] as SurfaceTool).append_from(pm, 0, xf)
	var limb := func(r: float, a: Vector3, b: Vector3) -> Array:
		var c := CapsuleMesh.new()
		c.radius = r
		c.height = a.distance_to(b) + r * 2.0
		c.radial_segments = 8
		c.rings = 2
		var d := (b - a).normalized()
		var x := d.cross(Vector3.FORWARD if absf(d.z) < 0.9 else Vector3.RIGHT).normalized()
		return [c, Transform3D(Basis(x, d, x.cross(d)), (a + b) * 0.5)]
	var hip_w := 0.11 if female else 0.1
	var sh_w := 0.17 if female else 0.21
	for sx: float in [-1.0, 1.0]:
		var l: Array = limb.call(0.07, Vector3(sx * hip_w, 0.88, 0), Vector3(sx * hip_w * 0.9, 0.07, 0.02))
		put.call(0, l[0], l[1])
		var shoe := BoxMesh.new()
		shoe.size = Vector3(0.1, 0.07, 0.24)
		put.call(0, shoe, Transform3D(Basis(), Vector3(sx * hip_w * 0.9, 0.035, 0.05)))
	var torso := CapsuleMesh.new()
	torso.radius = 0.17 if not female else 0.15
	torso.height = 0.72
	torso.radial_segments = 10
	torso.rings = 3
	put.call(0, torso, Transform3D(Basis().scaled(Vector3(1.0, 1.0, 0.62)), Vector3(0, 1.17, 0)))
	if female:
		var skirt := CylinderMesh.new()
		skirt.top_radius = 0.16
		skirt.bottom_radius = 0.24
		skirt.height = 0.42
		skirt.radial_segments = 12
		put.call(0, skirt, Transform3D(Basis(), Vector3(0, 0.78, 0)))
	var neck := CylinderMesh.new()
	neck.top_radius = 0.045
	neck.bottom_radius = 0.05
	neck.height = 0.1
	neck.radial_segments = 8
	put.call(1, neck, Transform3D(Basis(), Vector3(0, 1.53, 0)))
	var head := SphereMesh.new()
	head.radius = 0.105
	head.height = 0.25
	head.radial_segments = 12
	head.rings = 8
	put.call(1, head, Transform3D(Basis(), Vector3(0, 1.66, 0.01)))
	var hair := SphereMesh.new()
	hair.radius = 0.113
	hair.height = 0.2 if not female else 0.3
	hair.radial_segments = 12
	hair.rings = 6
	put.call(2, hair, Transform3D(Basis(), Vector3(0, 1.7 if not female else 1.67, -0.015)))
	for sx2: float in [-1.0, 1.0]:
		var sh := Vector3(sx2 * sh_w, 1.42, 0)
		var hand: Vector3
		match pose:
			1: hand = sh + Vector3(sx2 * 0.12, 0.62, 0.05)
			2: hand = sh + (Vector3(sx2 * 0.1, 0.62, 0.08) if sx2 > 0 else Vector3(sx2 * 0.04, -0.58, 0.02))
			3: hand = sh + Vector3(sx2 * 0.02, -0.25, 0.45)
			_: hand = sh + Vector3(sx2 * 0.05, -0.6, 0.03)
		var elbow := sh.lerp(hand, 0.5) + Vector3(sx2 * 0.05, 0, -0.03)
		var up: Array = limb.call(0.055, sh, elbow)
		put.call(0, up[0], up[1])
		var fore: Array = limb.call(0.045, elbow, hand)
		put.call(0, fore[0], fore[1])
		var palm := SphereMesh.new()
		palm.radius = 0.045
		palm.height = 0.1
		palm.radial_segments = 6
		palm.rings = 4
		put.call(1, palm, Transform3D(Basis(), hand))
	var m := ArrayMesh.new()
	for st2: SurfaceTool in surf:
		st2.generate_normals()
		st2.commit(m)
	_figures[key] = m
	return m

const SKINS := [Color(0.85, 0.65, 0.5), Color(0.6, 0.4, 0.28), Color(0.38, 0.24, 0.16), Color(0.95, 0.78, 0.65), Color(0.72, 0.52, 0.36)]
const HAIRS := [Color(0.05, 0.04, 0.03), Color(0.25, 0.15, 0.08), Color(0.55, 0.4, 0.2), Color(0.75, 0.72, 0.68)]

## one dressed person (separate materials per part)
func _person(at: Vector3, yaw: float, pose: int, outfit: Color, r: RandomNumberGenerator) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = figure(pose, r.randf() < 0.5)
	mi.set_surface_override_material(0, flat(outfit, 0.55, 0.05))
	mi.set_surface_override_material(1, flat(SKINS[r.randi() % SKINS.size()], 0.6))
	mi.set_surface_override_material(2, flat(HAIRS[r.randi() % HAIRS.size()], 0.5))
	mi.position = at
	mi.rotation.y = yaw
	mi.scale = Vector3.ONE * r.randf_range(0.94, 1.06)
	world.add_child(mi)
	return mi

# --------------------------------------------------------------------------------------------- light and sky
func _environment() -> void:
	var sky := ProceduralSkyMaterial.new()
	sky.sky_top_color = Color(0.02, 0.025, 0.07)
	sky.sky_horizon_color = Color(0.22, 0.1, 0.2)
	sky.ground_bottom_color = Color(0.01, 0.01, 0.02)
	sky.ground_horizon_color = Color(0.2, 0.09, 0.16)
	sky.sun_angle_max = 0.0
	var s := Sky.new()
	s.sky_material = sky
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = s
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.38, 0.32)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 0.95
	env.ssr_enabled = true
	env.ssao_enabled = true
	env.glow_enabled = true
	env.glow_intensity = 0.8
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.1
	env.fog_enabled = true
	env.fog_light_color = Color(0.2, 0.12, 0.2)
	env.fog_density = 0.0016
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var moon := DirectionalLight3D.new()
	moon.rotation_degrees = Vector3(-38, -140, 0)
	moon.light_energy = 0.25
	moon.light_color = Color(0.6, 0.7, 1.0)
	world.add_child(moon)

## the night city round the tower: towers of lit windows and a few neon crowns, far out so the penthouse and the
## skydeck look out over it
func _skyline() -> void:
	var win := _shader("""
shader_type spatial;
render_mode unshaded;
uniform vec3 base : source_color = vec3(0.02, 0.025, 0.035);
uniform float seed = 0.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453); }
void fragment() {
	vec2 cell = floor(UV * vec2(18.0, 60.0));
	vec2 f = fract(UV * vec2(18.0, 60.0));
	float lit = step(0.62, h(cell)) * step(0.15, f.x) * step(f.x, 0.85) * step(0.2, f.y) * step(f.y, 0.8);
	vec3 warm = mix(vec3(1.0, 0.75, 0.4), vec3(0.6, 0.85, 1.0), step(0.7, h(cell + 3.1)));
	ALBEDO = base + warm * lit * (0.8 + 0.8 * h(cell + 7.7));
}
""")
	var crowns := [Color(1.0, 0.3, 0.6), Color(0.3, 0.9, 1.0), Color(1.0, 0.75, 0.3), Color(0.6, 0.4, 1.0)]
	for i in 150:
		var a := _rng.randf() * TAU
		var d := _rng.randf_range(120.0, 620.0)
		var hgt := _rng.randf_range(40.0, 200.0) * (1.25 if d > 300.0 else 1.0)
		var w := _rng.randf_range(16.0, 40.0)
		var pos := Vector3(cos(a) * d, hgt * 0.5 - 20.0, sin(a) * d)
		var mi := _box(Vector3(w, hgt, w), pos, win)
		mi.rotation.y = _rng.randf() * PI
		if _rng.randf() < 0.25:
			_box(Vector3(w * 1.02, 1.2, w * 1.02), pos + Vector3(0, hgt * 0.5, 0), flat(crowns[i % crowns.size()], 0.4, 0.0, 5.0)).rotation.y = mi.rotation.y
	# the street grid far below: lines of light
	var road := flat(Color(1.0, 0.7, 0.35), 1.0, 0.0, 2.5)
	for k in range(-6, 7):
		_box(Vector3(1.2, 0.2, 1300), Vector3(k * 95.0, -20.0, 0), road)
		_box(Vector3(1300, 0.2, 1.2), Vector3(0, -20.0, k * 95.0), road)

# --------------------------------------------------------------------------------------------- the floor
func _floor() -> void:
	var y := FLOOR_Y
	# carpet: a crimson field with gold medallions
	var carpet := _shader("""
shader_type spatial;
uniform vec3 field : source_color = vec3(0.32, 0.03, 0.06);
uniform vec3 trim : source_color = vec3(0.55, 0.36, 0.12);
void fragment() {
	vec2 p = UV * vec2(44.0, 50.0);
	vec2 f = fract(p) - 0.5;
	float r = length(f);
	float ring = smoothstep(0.03, 0.0, abs(r - 0.32)) + smoothstep(0.025, 0.0, abs(r - 0.18));
	float diamond = smoothstep(0.02, 0.0, abs(abs(f.x) + abs(f.y) - 0.42));
	float swirl = 0.5 + 0.5 * sin(atan(f.y, f.x) * 8.0 + r * 30.0);
	vec3 c = field * (0.8 + 0.25 * swirl * step(r, 0.3));
	c = mix(c, trim, clamp(ring + diamond * 0.8, 0.0, 1.0));
	ALBEDO = c;
	ROUGHNESS = 0.95;
}
""")
	var L := 80.0
	var W := 70.0
	var H := 9.0
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(W, L)
	fl.mesh = pm
	fl.material_override = carpet
	fl.position = Vector3(0, y, 0)
	world.add_child(fl)
	var wall := flat(Color(0.16, 0.06, 0.06), 0.6)
	var panel := flat(Color(0.25, 0.13, 0.07), 0.35, 0.3)
	for sx: float in [-1.0, 1.0]:
		_box(Vector3(0.6, H, L), Vector3(sx * W * 0.5, y + H * 0.5, 0), wall)
		# gold pilasters and sconces
		for k in 9:
			var z := -L * 0.5 + 6.0 + k * 8.5
			_box(Vector3(0.5, H, 1.2), Vector3(sx * (W * 0.5 - 0.5), y + H * 0.5, z), flat(GOLD, 0.25, 0.9))
			_ball(0.25, Vector3(sx * (W * 0.5 - 0.9), y + 3.2, z), flat(Color(1.0, 0.8, 0.5), 0.3, 0.0, 6.0))
	_box(Vector3(W, H, 0.6), Vector3(0, y + H * 0.5, -L * 0.5), wall)
	_box(Vector3(W, H, 0.6), Vector3(0, y + H * 0.5, L * 0.5), wall)
	# coffered ceiling with chandeliers
	_box(Vector3(W, 0.4, L), Vector3(0, y + H, 0), flat(Color(0.12, 0.05, 0.04), 0.7))
	for i in range(-3, 4):
		_box(Vector3(0.5, 0.6, L), Vector3(i * 10.0, y + H - 0.5, 0), panel)
	for j in range(-4, 5):
		_box(Vector3(W, 0.6, 0.5), Vector3(0, y + H - 0.5, j * 9.0), panel)
	for i in range(-2, 3):
		for j in range(-3, 4, 2):
			_chandelier(Vector3(i * 12.0, y + H - 0.8, j * 9.0))
	# lights: warm pools down the hall (kept few for phones; the glow carries the rest)
	for p: Vector3 in [Vector3(-18, y + 6, 14), Vector3(18, y + 6, 14), Vector3(-18, y + 6, -14), Vector3(18, y + 6, -14), Vector3(0, y + 6, 0), Vector3(0, y + 6, 26)]:
		_light(p, Color(1.0, 0.78, 0.55), 2.2, 22.0)
	# slots: banks either side of the left aisle
	for bank in 4:
		var z0 := -26.0 + bank * 13.0
		for side: float in [-1.0, 1.0]:
			for k in 6:
				_slot(Vector3(-30.0 + k * 2.0 + 3.0, y, z0 + side * 1.3), PI if side < 0 else 0.0, bank * 6 + k + (0 if side < 0 else 50))
		_label("JACKPOT  $ %s" % ["2,481,900", "731,250", "1,090,400", "466,820"][bank], Vector3(-22.0, y + 4.2, z0), 0.0, Color(1.0, 0.25, 0.35), 80, 0.01)
	# tables on the right
	for k in 3:
		_blackjack(Vector3(10.0 + k * 7.5, y, 18.0))
	for k in 2:
		_roulette(Vector3(12.0 + k * 10.0, y, 4.0))
	_craps(Vector3(17.0, y, -10.0))
	# the centre bar
	_bar(Vector3(0, y, -2))
	# cashier cage and elevators at the back
	_box(Vector3(14, 3.2, 1.2), Vector3(-20, y + 1.6, -L * 0.5 + 1.2), flat(Color(0.2, 0.12, 0.05), 0.4, 0.6))
	for k in 7:
		_box(Vector3(0.06, 2.0, 0.06), Vector3(-26.5 + k * 2.0, y + 2.8, -L * 0.5 + 1.9), flat(GOLD, 0.2, 1.0))
	_label("CASHIER · CAGE", Vector3(-20, y + 4.0, -L * 0.5 + 1.95), 0.0, GOLD, 80, 0.009)
	for k in 3:
		var x := 10.0 + k * 4.0
		_box(Vector3(2.4, 3.4, 0.2), Vector3(x, y + 1.7, -L * 0.5 + 0.5), flat(GOLD, 0.15, 1.0))
		_box(Vector3(0.04, 3.4, 0.22), Vector3(x, y + 1.7, -L * 0.5 + 0.52), flat(Color(0.1, 0.07, 0.03), 0.4, 0.5))
	_label("ELEVATORS · PENTHOUSE · SKYDECK", Vector3(14, y + 4.3, -L * 0.5 + 0.7), 0.0, Color(0.95, 0.85, 0.65), 70, 0.009)
	# the name over the hall
	_label("SKYLINE", Vector3(0, y + 7.4, -L * 0.5 + 0.7), 0.0, GOLD, 200, 0.017)
	_label("C A S I N O", Vector3(0, y + 6.1, -L * 0.5 + 0.7), 0.0, Color(1.0, 0.3, 0.4), 110, 0.012)
	# guests
	_people(y, Rect2(-32, -36, 64, 70), 70, 11)

func _chandelier(at: Vector3) -> void:
	var gold := flat(GOLD, 0.2, 1.0)
	var crystal := flat(Color(1.0, 0.92, 0.78), 0.1, 0.0, 7.0)
	_cyl(0.03, 0.8, at + Vector3(0, 0.4, 0), gold)
	for ring in 3:
		var r := 0.6 + ring * 0.45
		var yy := at.y - ring * 0.35
		var tor := MeshInstance3D.new()
		var t := TorusMesh.new()
		t.inner_radius = r - 0.03
		t.outer_radius = r + 0.03
		tor.mesh = t
		tor.material_override = gold
		tor.position = Vector3(at.x, yy, at.z)
		world.add_child(tor)
		var n := 8 + ring * 4
		for k in n:
			var a := TAU * k / n
			_ball(0.07, Vector3(at.x + cos(a) * r, yy - 0.12, at.z + sin(a) * r), crystal)

var _screen_mat: ShaderMaterial
func _slot(at: Vector3, yaw: float, seed: int) -> void:
	if not _screen_mat:
		_screen_mat = _shader("""
shader_type spatial;
render_mode unshaded;
uniform float seed = 0.0;
float h(float x) { return fract(sin(x * 91.7 + seed) * 43758.5453); }
void fragment() {
	// three reels of symbols scrolling, with a bright frame
	float reel = floor(UV.x * 3.0);
	float sp = 0.6 + h(reel) * 1.2;
	float v = UV.y * 3.0 + TIME * sp + reel * 1.7 + seed * 0.37;
	float sym = floor(v);
	vec2 f = vec2(fract(UV.x * 3.0), fract(v)) - 0.5;
	vec3 cols[4] = vec3[](vec3(1.0, 0.2, 0.3), vec3(1.0, 0.8, 0.2), vec3(0.3, 0.9, 1.0), vec3(0.4, 1.0, 0.4));
	vec3 c = cols[int(mod(sym + reel, 4.0))];
	float shape = smoothstep(0.32, 0.26, length(f));
	vec3 bg = vec3(0.05, 0.02, 0.12) + vec3(0.25, 0.05, 0.3) * UV.y;
	float frame = step(0.94, abs(fract(UV.x * 3.0) - 0.5) * 2.0);
	ALBEDO = mix(bg, c * 2.2, shape) + vec3(1.0, 0.8, 0.4) * frame;
}
""")
	var holder := Node3D.new()
	holder.position = at
	holder.rotation.y = yaw
	world.add_child(holder)
	var hue: Color = [Color(0.5, 0.05, 0.1), Color(0.08, 0.1, 0.35), Color(0.35, 0.2, 0.04)][seed % 3]
	_box(Vector3(1.4, 1.1, 0.8), Vector3(0, 0.55, 0), flat(hue, 0.35, 0.5), holder)
	_box(Vector3(1.4, 1.3, 0.55), Vector3(0, 1.75, -0.12), flat(hue.darkened(0.3), 0.35, 0.5), holder)
	_box(Vector3(1.2, 0.08, 0.45), Vector3(0, 1.13, 0.12), flat(GOLD, 0.2, 1.0), holder)
	# each machine's reels run on their own (its own seed)
	var scr := _box(Vector3(1.1, 0.9, 0.02), Vector3(0, 1.75, 0.16), _screen_mat, holder)
	scr.material_override = _screen_mat.duplicate()
	(scr.material_override as ShaderMaterial).set_shader_parameter("seed", float(seed) * 3.7)
	_box(Vector3(1.4, 0.25, 0.6), Vector3(0, 2.55, -0.1), flat([Color(1, 0.25, 0.4), Color(0.3, 0.8, 1.0), Color(1, 0.8, 0.3)][seed % 3], 0.3, 0.0, 4.0), holder)
	# stool
	_cyl(0.28, 0.08, Vector3(0, 0.75, 0.85), flat(CRIMSON, 0.6), holder)
	_cyl(0.05, 0.72, Vector3(0, 0.36, 0.85), flat(GOLD, 0.2, 1.0), holder)

func _felt() -> StandardMaterial3D:
	return flat(Color(0.03, 0.28, 0.14), 0.95)

func _blackjack(at: Vector3) -> void:
	var t := _cyl(1.6, 0.12, at + Vector3(0, 0.9, 0), _felt(), null, -1.0, 32)
	t.scale = Vector3(1.0, 1.0, 0.65)
	var rim := _cyl(1.7, 0.1, at + Vector3(0, 0.86, 0), flat(Color(0.25, 0.12, 0.05), 0.4, 0.2), null, -1.0, 32)
	rim.scale = Vector3(1.0, 1.0, 0.68)
	_cyl(0.25, 0.85, at + Vector3(0, 0.42, 0), flat(Color(0.1, 0.06, 0.03), 0.5))
	# cards, chips, the dealer's shoe and lamp
	for k in 5:
		var a := PI * 0.15 + k * PI * 0.175
		var p := at + Vector3(cos(a) * 1.0, 0.97, sin(a) * 0.62)
		_box(Vector3(0.09, 0.005, 0.13), p, flat(Color(0.95, 0.95, 0.92), 0.5)).rotation.y = a
		for c in 3:
			_cyl(0.035, 0.012, p + Vector3(0.15, 0.006 + c * 0.013, 0.05), flat([Color(0.9, 0.1, 0.1), Color(0.1, 0.2, 0.9), Color(0.1, 0.1, 0.1)][(k + c) % 3], 0.4), null, -1.0, 12)
	_box(Vector3(0.25, 0.12, 0.15), at + Vector3(0.6, 1.0, -0.42), flat(Color(0.1, 0.1, 0.12), 0.4, 0.5))
	_cyl(0.3, 0.2, at + Vector3(0, 3.2, 0), flat(Color(0.1, 0.3, 0.15), 0.3, 0.6), null, 0.1)
	_light(at + Vector3(0, 2.6, 0), Color(1.0, 0.9, 0.7), 1.4, 4.5)
	for k in 5:
		var a2 := PI * 0.15 + k * PI * 0.175
		_cyl(0.22, 0.08, at + Vector3(cos(a2) * 1.95, 0.72, sin(a2) * 1.3), flat(CRIMSON, 0.6))

func _roulette(at: Vector3) -> void:
	_box(Vector3(4.4, 0.12, 1.8), at + Vector3(0.6, 0.9, 0), _felt())
	_box(Vector3(4.6, 0.85, 2.0), at + Vector3(0.6, 0.42, 0), flat(Color(0.2, 0.1, 0.04), 0.4, 0.2))
	# the layout: red and black numbers
	for r in 3:
		for c in 12:
			_box(Vector3(0.22, 0.004, 0.36), at + Vector3(0.05 + c * 0.24, 0.965, -0.45 + r * 0.42), flat(Color(0.7, 0.05, 0.05) if (r + c) % 2 == 0 else Color(0.04, 0.04, 0.04), 0.7))
	var wheel := Node3D.new()
	wheel.position = at + Vector3(-1.2, 0.98, 0)
	world.add_child(wheel)
	_cyl(0.62, 0.1, Vector3.ZERO, flat(Color(0.25, 0.12, 0.05), 0.3, 0.4), wheel, -1.0, 37)
	for k in 37:
		var a := TAU * k / 37.0
		_box(Vector3(0.1, 0.02, 0.2), Vector3(cos(a) * 0.45, 0.06, sin(a) * 0.45), flat(Color(0.05, 0.4, 0.1) if k == 0 else (Color(0.7, 0.05, 0.05) if k % 2 else Color(0.04, 0.04, 0.04)), 0.4), wheel).rotation.y = -a
	_cyl(0.18, 0.18, Vector3(0, 0.12, 0), flat(GOLD, 0.2, 1.0), wheel, 0.05)
	_wheels.append(wheel)
	_light(at + Vector3(0, 2.8, 0), Color(1.0, 0.85, 0.65), 1.2, 5.0)

func _craps(at: Vector3) -> void:
	_box(Vector3(6.0, 0.9, 2.6), at + Vector3(0, 0.45, 0), flat(Color(0.2, 0.1, 0.04), 0.4, 0.2))
	_box(Vector3(5.6, 0.04, 2.2), at + Vector3(0, 0.82, 0), _felt())
	_box(Vector3(6.0, 0.25, 0.15), at + Vector3(0, 1.0, 1.25), flat(Color(0.3, 0.15, 0.06), 0.3, 0.3))
	_box(Vector3(6.0, 0.25, 0.15), at + Vector3(0, 1.0, -1.25), flat(Color(0.3, 0.15, 0.06), 0.3, 0.3))
	_label("PASS LINE", at + Vector3(0, 0.85, 0.6), 0.0, Color(0.9, 0.9, 0.8), 40, 0.01).rotation.x = -PI / 2
	_box(Vector3(0.08, 0.08, 0.08), at + Vector3(0.5, 0.88, 0), flat(Color(0.9, 0.1, 0.1), 0.2))
	_box(Vector3(0.08, 0.08, 0.08), at + Vector3(0.7, 0.88, 0.15), flat(Color(0.9, 0.1, 0.1), 0.2))

func _bar(at: Vector3) -> void:
	var r := 6.0
	var tor := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = r - 0.6
	t.outer_radius = r + 0.6
	t.rings = 48
	tor.mesh = t
	tor.scale = Vector3(1, 1.6, 1)
	tor.position = at + Vector3(0, 1.1, 0)
	tor.material_override = flat(Color(0.12, 0.06, 0.04), 0.25, 0.3)
	world.add_child(tor)
	_cyl(r + 0.7, 0.08, at + Vector3(0, 1.15, 0), flat(Color(0.95, 0.92, 0.88), 0.1, 0.0), null, -1.0, 48)  # marble top
	_cyl(r - 0.65, 0.1, at + Vector3(0, 1.16, 0), flat(Color(0.06, 0.03, 0.02), 0.5), null, -1.0, 48)
	_cyl(r + 0.62, 0.06, at + Vector3(0, 0.25, 0), flat(GOLD, 0.2, 1.0), null, -1.0, 48)
	# the bottle tower in the middle
	_cyl(1.8, 4.5, at + Vector3(0, 2.25, 0), flat(Color(0.1, 0.05, 0.03), 0.4, 0.2), null, -1.0, 24)
	var bottle_cols := [Color(0.9, 0.55, 0.15), Color(0.3, 0.8, 0.4), Color(0.9, 0.2, 0.3), Color(0.5, 0.7, 1.0), Color(0.95, 0.9, 0.6)]
	for shelf in 4:
		_cyl(1.95, 0.05, at + Vector3(0, 1.4 + shelf * 0.8, 0), flat(GOLD, 0.2, 1.0, 1.5), null, -1.0, 24)
		for k in 18:
			var a := TAU * k / 18.0 + shelf * 0.3
			_cyl(0.06, 0.32, at + Vector3(cos(a) * 1.85, 1.6 + shelf * 0.8, sin(a) * 1.85), flat(bottle_cols[(k + shelf) % 5], 0.1, 0.0, 2.2), null, 0.035, 8)
	var crown := MeshInstance3D.new()
	var ct := TorusMesh.new()
	ct.inner_radius = 1.9
	ct.outer_radius = 2.15
	crown.mesh = ct
	crown.position = at + Vector3(0, 4.6, 0)
	crown.material_override = flat(GOLD, 0.2, 1.0, 1.2)
	world.add_child(crown)
	_label("THE GILDED ROUND", at + Vector3(0, 4.85, 1.86), 0.0, GOLD, 48, 0.008)
	for k in 14:
		var a2 := TAU * k / 14.0
		_cyl(0.24, 0.08, at + Vector3(cos(a2) * (r + 1.2), 0.85, sin(a2) * (r + 1.2)), flat(CRIMSON, 0.6))
		_cyl(0.05, 0.8, at + Vector3(cos(a2) * (r + 1.2), 0.42, sin(a2) * (r + 1.2)), flat(GOLD, 0.2, 1.0))
	_light(at + Vector3(0, 4.0, 0), Color(1.0, 0.7, 0.4), 2.5, 12.0)

## standing figures in evening colours, scattered in `area` (xz); a capsule body and a head
func _people(y: float, area: Rect2, n: int, seed: int) -> void:
	var r := RandomNumberGenerator.new()
	r.seed = seed
	var outfits := [Color(0.05, 0.05, 0.06), Color(0.5, 0.04, 0.08), Color(0.9, 0.85, 0.75), Color(0.1, 0.15, 0.35), Color(0.6, 0.45, 0.1), Color(0.25, 0.25, 0.28)]
	var skins := [Color(0.85, 0.65, 0.5), Color(0.6, 0.4, 0.28), Color(0.38, 0.24, 0.16), Color(0.95, 0.78, 0.65)]
	for k in n:
		var p := Vector3(area.position.x + r.randf() * area.size.x, y, area.position.y + r.randf() * area.size.y)
		# keep the bar and the tables clear
		if Vector2(p.x, p.z + 2.0).length() < 8.5 or (p.x > 6.0 and p.z > -14.0 and p.z < 22.0 and r.randf() < 0.7) or (p.x < -18.0 and r.randf() < 0.6):
			continue
		# and never in front of a camera view
		if _views.any(func(v: Array) -> bool: return (v[1] as Vector3).distance_to(p + Vector3(0, 1.6, 0)) < 3.5):
			continue
		_person(p, r.randf() * TAU, 0 if r.randf() < 0.85 else 2, outfits[r.randi() % outfits.size()], r)

# --------------------------------------------------------------------------------------------- the penthouse
func _penthouse() -> void:
	var y := PENT_Y
	var marble := _shader("""
shader_type spatial;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	vec2 p = UV * 3.0;
	float v = n(p * 2.0) * 0.5 + n(p * 5.0) * 0.3 + n(p * 11.0) * 0.2;
	float vein = smoothstep(0.06, 0.0, abs(sin((p.x + p.y * 0.6 + v * 2.4) * 1.6))) * (0.4 + 0.6 * n(p * 3.0));
	vec2 tile = fract(UV * 12.0);
	float joint = step(0.985, max(tile.x, tile.y));
	ALBEDO = mix(vec3(0.9, 0.88, 0.84), vec3(0.6, 0.56, 0.5), vein * 0.45) * (0.96 + 0.04 * v) * (1.0 - joint * 0.25);
	ROUGHNESS = 0.16;
	METALLIC = 0.0;
	SPECULAR = 0.5;
}
""")
	# the slab: 28 x 18 living space at z -9..9, the terrace beyond z -9 to -30
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(30, 20)
	fl.mesh = pm
	fl.material_override = marble
	fl.position = Vector3(0, y, 0)
	world.add_child(fl)
	_box(Vector3(30, 0.4, 20), Vector3(0, y + 4.4, 0), flat(Color(0.12, 0.11, 0.1), 0.6))                  # ceiling
	_box(Vector3(30, 3, 22), Vector3(0, y - 1.6, -1), flat(Color(0.08, 0.08, 0.09), 0.6))                   # the slab edge
	# glass walls to the terrace (north) and the city (west), solid walls east and south
	_box(Vector3(30, 4.4, 0.06), Vector3(0, y + 2.2, -10), glass())
	_box(Vector3(0.06, 4.4, 20), Vector3(-15, y + 2.2, 0), glass())
	for k in 7:
		_box(Vector3(0.1, 4.4, 0.1), Vector3(-15 + k * 5.0, y + 2.2, -10), flat(Color(0.1, 0.1, 0.1), 0.3, 0.8))
		_box(Vector3(0.1, 4.4, 0.1), Vector3(-15, y + 2.2, -10 + k * 3.33), flat(Color(0.1, 0.1, 0.1), 0.3, 0.8))
	_box(Vector3(0.3, 4.4, 20), Vector3(15, y + 2.2, 0), flat(Color(0.18, 0.15, 0.13), 0.7))
	_box(Vector3(30, 4.4, 0.3), Vector3(0, y + 2.2, 10), flat(Color(0.2, 0.17, 0.14), 0.7))
	# cove lights in the ceiling
	for k in 4:
		_box(Vector3(26, 0.05, 0.12), Vector3(0, y + 4.18, -7.5 + k * 5.0), flat(Color(1.0, 0.85, 0.65), 1.0, 0.0, 3.5))
	_light(Vector3(-4, y + 3.6, -2), Color(1.0, 0.82, 0.62), 2.0, 14.0, true)
	_light(Vector3(8, y + 3.6, 5), Color(1.0, 0.82, 0.62), 1.6, 12.0)
	# living room: a sunken lounge round a fire table, rug, sofas
	_box(Vector3(9, 0.02, 7), Vector3(-6, y + 0.01, -3), flat(Color(0.35, 0.3, 0.26), 1.0))
	var sofa := flat(Color(0.82, 0.78, 0.72), 0.95)
	_box(Vector3(6.5, 0.45, 1.1), Vector3(-6, y + 0.23, 0.2), sofa)
	_box(Vector3(6.5, 0.7, 0.3), Vector3(-6, y + 0.6, 0.65), sofa)
	_box(Vector3(1.1, 0.45, 4.0), Vector3(-9.8, y + 0.23, -2.2), sofa)
	_box(Vector3(0.3, 0.7, 4.0), Vector3(-10.25, y + 0.6, -2.2), sofa)
	for k in 4:
		_box(Vector3(0.55, 0.4, 0.15), Vector3(-8.2 + k * 1.4, y + 0.65, 0.42), flat([Color(0.55, 0.08, 0.1), GOLD, Color(0.1, 0.12, 0.2), Color(0.55, 0.08, 0.1)][k], 0.9))
	_box(Vector3(2.6, 0.35, 1.3), Vector3(-6, y + 0.18, -2.6), flat(Color(0.08, 0.08, 0.09), 0.2, 0.5))
	_box(Vector3(2.2, 0.06, 0.5), Vector3(-6, y + 0.39, -2.6), flat(Color(1.0, 0.5, 0.15), 1.0, 0.0, 6.0))   # fire line
	_light(Vector3(-6, y + 0.8, -2.6), Color(1.0, 0.55, 0.25), 1.2, 5.0)
	# a grand piano by the glass
	var piano := Node3D.new()
	piano.position = Vector3(-11.5, y, -7.0)
	piano.rotation.y = 0.6
	world.add_child(piano)
	var black := flat(Color(0.02, 0.02, 0.025), 0.08, 0.2)
	var body := _box(Vector3(1.5, 0.35, 2.0), Vector3(0, 0.85, 0), black, piano)
	body.scale = Vector3(1, 1, 1)
	_box(Vector3(1.5, 0.04, 1.8), Vector3(0.1, 1.45, -0.1), black, piano).rotation.x = -0.6
	_box(Vector3(1.3, 0.08, 0.25), Vector3(0, 0.9, 1.1), flat(Color(0.95, 0.95, 0.92), 0.3), piano)
	for lx: float in [-0.6, 0.6]:
		_cyl(0.05, 0.7, Vector3(lx, 0.35, 0.7), black, piano)
	_cyl(0.05, 0.7, Vector3(0, 0.35, -0.8), black, piano)
	# the kitchen island and bar stools, a wine wall
	_box(Vector3(5, 0.95, 1.4), Vector3(7, y + 0.48, -5.5), flat(Color(0.95, 0.94, 0.92), 0.12))
	_box(Vector3(5.1, 0.05, 1.5), Vector3(7, y + 0.98, -5.5), flat(Color(0.1, 0.1, 0.1), 0.05, 0.3))
	for k in 4:
		_cyl(0.22, 0.06, Vector3(5.3 + k * 1.1, y + 0.75, -4.4), flat(GOLD, 0.25, 0.9))
		_cyl(0.03, 0.74, Vector3(5.3 + k * 1.1, y + 0.37, -4.4), flat(GOLD, 0.25, 0.9))
	for k in 3:
		_ball(0.18, Vector3(5.6 + k * 1.4, y + 2.6, -5.5), flat(Color(1.0, 0.85, 0.6), 0.3, 0.0, 5.0))
	_box(Vector3(0.4, 3.2, 5.0), Vector3(14.6, y + 1.6, -6.5), flat(Color(0.15, 0.1, 0.08), 0.5))
	for r in 6:
		for c in 8:
			_cyl(0.04, 0.28, Vector3(14.35, y + 0.4 + r * 0.5, -8.7 + c * 0.6), flat([Color(0.35, 0.04, 0.06), Color(0.85, 0.75, 0.4)][(r + c) % 2], 0.1, 0.0, 0.6), null, 0.03, 8).rotation.z = PI / 2
	# the bedroom behind a half wall at the south-east
	_box(Vector3(0.2, 2.2, 6.0), Vector3(3.0, y + 1.1, 6.6), flat(Color(0.2, 0.17, 0.14), 0.6))
	_box(Vector3(3.2, 0.5, 3.6), Vector3(9.0, y + 0.25, 7.6), flat(Color(0.2, 0.15, 0.12), 0.6))
	_box(Vector3(3.1, 0.25, 3.4), Vector3(9.0, y + 0.62, 7.5), flat(Color(0.92, 0.9, 0.87), 0.95))
	_box(Vector3(3.4, 1.3, 0.2), Vector3(9.0, y + 0.9, 9.6), flat(Color(0.4, 0.06, 0.1), 0.9))
	# the private crafting studio, the weapon wall and the equipment vault along the south wall (west end)
	_studio(Vector3(-9.0, y, 7.2))
	# the terrace and its infinity pool
	_terrace(y)
	_label("SKYLINE PENTHOUSE · LEVEL 60", Vector3(-3, y + 3.5, 9.8), PI, GOLD, 50, 0.006)
	# art, plants, pendants
	var art_cols := [Color(0.7, 0.2, 0.25), Color(0.2, 0.45, 0.7), Color(0.85, 0.65, 0.3)]
	for k in 3:
		_box(Vector3(0.06, 1.6, 2.2), Vector3(14.8, y + 2.0, 1.0 + k * 2.8), flat(Color(0.08, 0.07, 0.06), 0.4))
		_box(Vector3(0.04, 1.4, 2.0), Vector3(14.75, y + 2.0, 1.0 + k * 2.8), flat(art_cols[k], 0.7, 0.0, 0.4))
		_light(Vector3(14.0, y + 3.6, 1.0 + k * 2.8), Color(1.0, 0.9, 0.75), 0.6, 3.0)
	for p: Vector3 in [Vector3(-13.8, y, 8.8), Vector3(-13.8, y, -8.6), Vector3(2.0, y, -8.6), Vector3(13.8, y, 0.0)]:
		_cyl(0.35, 0.7, p + Vector3(0, 0.35, 0), flat(Color(0.1, 0.1, 0.1), 0.3, 0.3))
		for k in 7:
			var a := TAU * k / 7.0
			var lf := _box(Vector3(0.18, 0.02, 1.1), p + Vector3(cos(a) * 0.35, 1.2, sin(a) * 0.35), flat(Color(0.12, 0.32, 0.12), 0.8))
			lf.rotation = Vector3(0.9, -a + PI / 2, 0)
	for k in 3:
		_cyl(0.01, 1.4, Vector3(-6 + (k - 1) * 1.2, y + 3.5, -2.6), flat(Color(0.1, 0.1, 0.1), 0.3, 0.8))
		_ball(0.2, Vector3(-6 + (k - 1) * 1.2, y + 2.75, -2.6), flat(Color(1.0, 0.85, 0.6), 0.3, 0.0, 5.0))
	# a few guests
	var gr := RandomNumberGenerator.new()
	gr.seed = 9
	_person(Vector3(6.2, y, -3.9), PI, 0, Color(0.06, 0.06, 0.07), gr)
	_person(Vector3(7.4, y, -3.8), PI + 0.4, 0, Color(0.5, 0.05, 0.1), gr)
	_person(Vector3(-11.0, y, -5.8), 2.2, 3, Color(0.85, 0.82, 0.75), gr)

func _studio(at: Vector3) -> void:
	var steel := flat(Color(0.25, 0.26, 0.28), 0.35, 0.8)
	# workbench with a lit hood and a holo-blueprint
	_box(Vector3(3.6, 0.9, 1.0), at + Vector3(-1.8, 0.45, 1.6), steel)
	_box(Vector3(3.6, 0.06, 1.05), at + Vector3(-1.8, 0.93, 1.6), flat(Color(0.12, 0.12, 0.13), 0.5, 0.5))
	_box(Vector3(3.4, 0.08, 0.8), at + Vector3(-1.8, 2.4, 1.6), flat(Color(0.9, 0.95, 1.0), 0.4, 0.0, 4.0))
	var holo := flat(Color(0.3, 0.9, 1.0), 0.2, 0.0, 3.0)
	holo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	holo.albedo_color.a = 0.35
	_box(Vector3(1.4, 0.8, 0.02), at + Vector3(-1.8, 1.55, 1.3), holo).rotation.x = -0.3
	_label("FORGE · BLUEPRINT 07", at + Vector3(-1.8, 2.05, 1.29), PI, Color(0.4, 0.9, 1.0), 40, 0.006)
	for k in 5:
		_box(Vector3(0.05, 0.5, 0.05), at + Vector3(-3.4 + k * 0.25, 1.7, 2.05), steel)          # tool rail
	# the weapon wall: lit niches
	_box(Vector3(4.2, 2.8, 0.4), at + Vector3(2.4, 1.4, 2.4), flat(Color(0.06, 0.06, 0.07), 0.4, 0.4))
	for r in 3:
		for c in 3:
			var p := at + Vector3(1.0 + c * 1.4, 0.6 + r * 0.85, 2.15)
			_box(Vector3(1.2, 0.05, 0.3), p + Vector3(0, -0.25, 0), flat(Color(1.0, 0.8, 0.5), 0.5, 0.0, 3.0))
			# a rifle silhouette: stock, receiver, barrel, magazine
			var g := Node3D.new()
			g.position = p
			world.add_child(g)
			var gun := flat([Color(0.08, 0.08, 0.09), Color(0.3, 0.25, 0.18), Color(0.35, 0.38, 0.4)][(r + c) % 3], 0.35, 0.7)
			_box(Vector3(0.6, 0.09, 0.05), Vector3(0, 0, 0), gun, g)
			_box(Vector3(0.3, 0.035, 0.035), Vector3(0.45, 0.02, 0), gun, g)
			_box(Vector3(0.18, 0.12, 0.05), Vector3(-0.34, -0.03, 0), gun, g)
			_box(Vector3(0.05, 0.13, 0.04), Vector3(0.05, -0.1, 0), gun, g)
			if (r + c) % 4 == 0:
				_box(Vector3(0.12, 0.012, 0.012), Vector3(0.2, 0.06, 0.03), flat(Color(0.3, 0.9, 1.0), 0.2, 0.0, 4.0), g)
	_label("ARMORY", at + Vector3(2.4, 2.65, 2.18), PI, GOLD, 50, 0.008)
	# the vault: a round steel door set in the east end of the wall
	var door := _cyl(1.0, 0.25, at + Vector3(6.2, 1.25, 2.4), flat(Color(0.45, 0.46, 0.48), 0.25, 0.95), null, -1.0, 40)
	door.rotation.x = PI / 2
	var ring := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.55
	t.outer_radius = 0.65
	ring.mesh = t
	ring.rotation.x = PI / 2
	ring.position = at + Vector3(6.2, 1.25, 2.25)
	ring.material_override = flat(Color(0.7, 0.7, 0.72), 0.2, 1.0)
	world.add_child(ring)
	for k in 6:
		var a := TAU * k / 6.0
		_box(Vector3(0.08, 0.5, 0.08), at + Vector3(6.2 + cos(a) * 0.3, 1.25 + sin(a) * 0.3, 2.15), flat(Color(0.7, 0.7, 0.72), 0.2, 1.0)).rotation.z = a
	_label("EQUIPMENT VAULT", at + Vector3(6.2, 2.5, 2.18), PI, Color(0.6, 0.9, 1.0), 44, 0.007)
	_light(at + Vector3(2.0, 2.2, 1.0), Color(0.85, 0.92, 1.0), 1.2, 6.0)

func _terrace(y: float) -> void:
	var deck := flat(Color(0.32, 0.22, 0.14), 0.8)
	_box(Vector3(30, 0.1, 22), Vector3(0, y - 0.05, -21), deck)
	for k in 30:
		_box(Vector3(0.02, 0.105, 22), Vector3(-14.5 + k, y - 0.05, -21), flat(Color(0.18, 0.12, 0.08), 0.9))
	_box(Vector3(30, 3, 22), Vector3(0, y - 1.6, -21), flat(Color(0.08, 0.08, 0.09), 0.6))
	# glass balustrade
	_box(Vector3(30, 1.1, 0.04), Vector3(0, y + 0.55, -32), glass())
	_box(Vector3(0.04, 1.1, 22), Vector3(-15, y + 0.55, -21), glass())
	_box(Vector3(0.04, 1.1, 22), Vector3(15, y + 0.55, -21), glass())
	# the infinity pool: its far edge spills over the city
	var water := _shader("""
shader_type spatial;
render_mode specular_schlick_ggx;
uniform vec3 deep : source_color = vec3(0.0, 0.28, 0.42);
uniform vec3 glow : source_color = vec3(0.2, 0.8, 1.0);
void vertex() { VERTEX.y += sin(VERTEX.x * 1.7 + TIME * 1.3) * 0.015 + cos(VERTEX.z * 2.1 + TIME) * 0.015; }
void fragment() {
	float w = sin(UV.x * 40.0 + TIME * 1.4) * cos(UV.y * 36.0 - TIME) * 0.5 + 0.5;
	ALBEDO = deep;
	EMISSION = glow * (0.25 + 0.35 * w);
	ROUGHNESS = 0.02;
	METALLIC = 0.1;
	NORMAL_MAP = vec3(0.5 + 0.08 * sin(UV.x * 60.0 + TIME * 2.0), 0.5 + 0.08 * cos(UV.y * 55.0 + TIME * 1.7), 1.0);
}
""")
	_box(Vector3(16.4, 0.6, 7.4), Vector3(3, y - 0.3, -25.3), flat(Color(0.9, 0.9, 0.88), 0.2))
	var pool := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(16, 7)
	pm.subdivide_width = 40
	pm.subdivide_depth = 20
	pool.mesh = pm
	pool.material_override = water
	pool.position = Vector3(3, y + 0.02, -25.3)
	world.add_child(pool)
	_box(Vector3(16.4, 0.04, 0.3), Vector3(3, y - 0.02, -29.0), flat(Color(0.3, 0.9, 1.0), 0.2, 0.0, 3.0))
	_light(Vector3(3, y + 0.6, -25.3), Color(0.3, 0.85, 1.0), 1.5, 10.0)
	# loungers, umbrellas, planters with palms
	for k in 5:
		var x := -12.0 + k * 2.2
		_box(Vector3(0.8, 0.3, 2.0), Vector3(x, y + 0.15, -19.5), flat(Color(0.95, 0.94, 0.9), 0.9))
		var back := _box(Vector3(0.8, 0.08, 0.8), Vector3(x, y + 0.5, -18.6), flat(Color(0.95, 0.94, 0.9), 0.9))
		back.rotation.x = -0.9
	for x2: float in [-13.0, 13.0]:
		_box(Vector3(1.4, 0.9, 1.4), Vector3(x2, y + 0.45, -30.5), flat(Color(0.2, 0.2, 0.2), 0.5))
		_palm(Vector3(x2, y + 0.9, -30.5), 5.0)
	_cyl(0.05, 2.4, Vector3(-9, y + 1.2, -21.5), flat(Color(0.9, 0.9, 0.88), 0.4))
	_cyl(1.6, 0.4, Vector3(-9, y + 2.4, -21.5), flat(Color(0.95, 0.9, 0.82), 0.9), null, 0.05)
	for k in 6:
		_ball(0.12, Vector3(-14 + k * 5.6, y + 1.2, -31.9), flat(Color(1.0, 0.8, 0.5), 0.3, 0.0, 6.0))
	var bulb := flat(Color(1.0, 0.8, 0.5), 0.3, 0.0, 8.0)
	for row in 3:
		for k in 28:
			var x := -14.0 + k
			_ball(0.06, Vector3(x, y + 3.2 - 0.35 * sin(float(k % 7) / 7.0 * PI), -14.0 - row * 6.0), bulb)
	_light(Vector3(-8, y + 2.8, -16), Color(1.0, 0.78, 0.5), 1.6, 14.0)
	_light(Vector3(8, y + 2.8, -20), Color(1.0, 0.78, 0.5), 1.4, 14.0)

func _palm(base: Vector3, h: float) -> void:
	var trunk := flat(Color(0.35, 0.26, 0.17), 0.9)
	for k in 6:
		var t := k / 6.0
		_cyl(0.16 - t * 0.06, h / 6.0 + 0.05, base + Vector3(sin(t * 1.4) * 0.4, h * (t + 1.0 / 12.0), 0), trunk, null, -1.0, 8)
	var top := base + Vector3(sin(1.4) * 0.4, h, 0)
	var leaf := flat(Color(0.12, 0.35, 0.12), 0.8)
	leaf.cull_mode = BaseMaterial3D.CULL_DISABLED
	for k in 9:
		var a := TAU * k / 9.0
		var f := _box(Vector3(0.5, 0.02, 2.4), top + Vector3(cos(a) * 1.0, -0.35, sin(a) * 1.0), leaf)
		f.rotation = Vector3(0.45, -a + PI / 2, 0)

# --------------------------------------------------------------------------------------------- the skydeck
func _skydeck() -> void:
	var y := ROOF_Y
	_box(Vector3(60, 1.0, 64), Vector3(0, y - 0.5, 0), flat(Color(0.09, 0.09, 0.1), 0.55, 0.3))
	for k in 16:
		_box(Vector3(60, 0.02, 0.06), Vector3(0, y + 0.005, -32 + k * 4.0), flat(Color(0.2, 0.2, 0.22), 0.6))
	# glass edge with a cyan glow line
	for sx: float in [-1.0, 1.0]:
		_box(Vector3(0.05, 1.2, 64), Vector3(sx * 30, y + 0.6, 0), glass())
		_box(Vector3(0.12, 0.06, 64), Vector3(sx * 30, y + 0.03, 0), flat(Color(0.3, 0.9, 1.0), 0.3, 0.0, 4.0))
	_box(Vector3(60, 1.2, 0.05), Vector3(0, y + 0.6, 32), glass())
	# the stage at the north end
	var sz := -18.0
	_box(Vector3(26, 1.6, 12), Vector3(0, y + 0.8, sz), flat(Color(0.05, 0.05, 0.06), 0.5, 0.2))
	_box(Vector3(26, 0.06, 0.2), Vector3(0, y + 1.6, sz + 6.0), flat(Color(1.0, 0.25, 0.55), 0.3, 0.0, 5.0))
	# truss: four towers and a roof grid
	var truss := flat(Color(0.65, 0.66, 0.7), 0.3, 0.9)
	for px: float in [-13.0, 13.0]:
		for pz: float in [-6.0, 6.0]:
			_truss_tower(Vector3(px, y + 1.6, sz + pz), 12.0, truss)
	for pz2: float in [-6.0, 6.0]:
		_box(Vector3(26.6, 0.5, 0.5), Vector3(0, y + 13.6, sz + pz2), truss)
	for px2: float in [-13.0, 0.0, 13.0]:
		_box(Vector3(0.5, 0.5, 12.6), Vector3(px2, y + 13.6, sz), truss)
	# the LED wall
	var led := _shader("""
shader_type spatial;
render_mode unshaded;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec2 px = floor(UV * vec2(160.0, 70.0));
	vec2 uv = px / vec2(160.0, 70.0);
	// a pulsing equaliser over a slow colour sweep, with the venue's name
	float bar = floor(uv.x * 32.0);
	float lvl = 0.25 + 0.6 * abs(sin(TIME * (2.0 + h(vec2(bar, 1.0)) * 3.0) + bar));
	float eq = step(1.0 - uv.y, lvl) * step(0.15, fract(uv.x * 32.0));
	vec3 sweep = 0.5 + 0.5 * cos(6.2831 * (uv.x * 0.6 + TIME * 0.12 + vec3(0.0, 0.33, 0.67)));
	vec3 c = sweep * 0.18 + mix(vec3(1.0, 0.2, 0.6), vec3(0.2, 0.9, 1.0), uv.y) * eq * 1.6;
	float dot_mask = step(0.18, fract(UV.x * 160.0)) * step(0.18, fract(UV.y * 70.0));
	ALBEDO = c * dot_mask * 1.8;
}
""")
	_box(Vector3(22, 9, 0.3), Vector3(0, y + 6.4, sz - 5.6), led)
	_label("SKYDECK LIVE", Vector3(0, y + 12.4, sz - 5.3), 0.0, Color(1.0, 0.85, 0.5), 160, 0.018)
	# speaker stacks and line arrays
	var spk := flat(Color(0.04, 0.04, 0.045), 0.6, 0.2)
	for sx2: float in [-1.0, 1.0]:
		for k in 3:
			_box(Vector3(2.2, 1.3, 1.6), Vector3(sx2 * 15.8, y + 0.65 + k * 1.35, sz + 4.5), spk)
			_cyl(0.45, 0.05, Vector3(sx2 * 15.8, y + 0.65 + k * 1.35, sz + 5.31), flat(Color(0.15, 0.15, 0.16), 0.4, 0.4)).rotation.x = PI / 2
		for k2 in 7:
			var a := _box(Vector3(1.6, 0.5, 1.0), Vector3(sx2 * 11.5, y + 12.8 - k2 * 0.55, sz + 6.5), spk)
			a.rotation.x = 0.05 * k2
	# the band: drum riser, a keys rig, guitar and vocals
	_box(Vector3(5, 0.6, 3.5), Vector3(0, y + 1.9, sz - 3.0), flat(Color(0.08, 0.08, 0.09), 0.4))
	for dx: float in [-0.8, 0.0, 0.8]:
		_cyl(0.32, 0.4, Vector3(dx, y + 2.6, sz - 2.6), flat(Color(0.7, 0.1, 0.15), 0.3, 0.5)).rotation.x = 0.0
	_ball(0.5, Vector3(0, y + 2.8, sz - 3.4), flat(Color(0.9, 0.9, 0.92), 0.4))
	_box(Vector3(2.0, 0.1, 0.7), Vector3(-6, y + 2.5, sz - 1.0), flat(Color(0.05, 0.05, 0.05), 0.3))
	_performer(Vector3(0, y + 1.6, sz + 3.5), Color(0.9, 0.85, 0.8), true)
	_performer(Vector3(-4.5, y + 1.6, sz + 1.5), Color(0.1, 0.1, 0.12), false)
	_performer(Vector3(4.5, y + 1.6, sz + 1.5), Color(0.55, 0.05, 0.1), false)
	_performer(Vector3(0, y + 2.2, sz - 2.0), Color(0.15, 0.15, 0.17), false)
	_performer(Vector3(-6, y + 1.6, sz - 0.3), Color(0.2, 0.25, 0.4), false)
	# sweeping beams: emissive cones hung from the roof truss
	var beam_cols := [Color(1.0, 0.2, 0.6), Color(0.2, 0.9, 1.0), Color(1.0, 0.8, 0.3), Color(0.6, 0.3, 1.0)]
	for k in 8:
		var pivot := Node3D.new()
		pivot.position = Vector3(-12.0 + k * 3.4, y + 13.2, sz + 5.8)
		world.add_child(pivot)
		var cone := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.15
		cm.bottom_radius = 2.2
		cm.height = 26.0
		cm.radial_segments = 16
		cm.cap_top = false
		cm.cap_bottom = false
		cone.mesh = cm
		cone.position = Vector3(0, -13.0, 0)
		var bm := StandardMaterial3D.new()
		var bc: Color = beam_cols[k % beam_cols.size()]
		bm.albedo_color = Color(bc.r, bc.g, bc.b, 0.09)
		bm.emission_enabled = true
		bm.emission = bc
		bm.emission_energy_multiplier = 1.4
		bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bm.cull_mode = BaseMaterial3D.CULL_DISABLED
		bm.no_depth_test = false
		cone.material_override = bm
		cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		pivot.add_child(cone)
		_ball(0.3, Vector3.ZERO, flat(bc, 0.3, 0.0, 6.0), pivot)
		_beams.append(pivot)
	# stage wash and audience lights
	_light(Vector3(0, y + 8, sz + 8), Color(1.0, 0.4, 0.7), 3.0, 22.0)
	_light(Vector3(-8, y + 6, sz + 2), Color(0.3, 0.8, 1.0), 2.0, 14.0)
	_light(Vector3(8, y + 6, sz + 2), Color(1.0, 0.7, 0.3), 2.0, 14.0)
	_light(Vector3(0, y + 5, 10), Color(0.6, 0.4, 1.0), 1.2, 26.0)
	# the front-of-house mix tent and a bar on the south side
	_box(Vector3(5, 0.9, 3), Vector3(0, y + 0.45, 18), flat(Color(0.06, 0.06, 0.07), 0.5))
	_box(Vector3(4.6, 0.1, 2.2), Vector3(0, y + 0.95, 18), flat(Color(0.2, 0.9, 0.5), 0.3, 0.0, 1.5))
	_box(Vector3(12, 1.1, 1.2), Vector3(-17, y + 0.55, 26), flat(Color(0.12, 0.08, 0.06), 0.4, 0.3))
	_label("ROOFTOP BAR", Vector3(-17, y + 2.4, 26.7), PI, Color(1.0, 0.4, 0.6), 70, 0.01)
	_crowd_build(y, sz)

func _truss_tower(base: Vector3, h: float, mat: Material) -> void:
	for cx: float in [-0.25, 0.25]:
		for cz: float in [-0.25, 0.25]:
			_cyl(0.04, h, base + Vector3(cx, h * 0.5, cz), mat, null, -1.0, 6)
	for k in int(h / 0.6):
		var b := _box(Vector3(0.5, 0.03, 0.03), base + Vector3(0, 0.3 + k * 0.6, 0.25), mat)
		b.rotation.z = 0.8 if k % 2 == 0 else -0.8
		var b2 := _box(Vector3(0.03, 0.03, 0.5), base + Vector3(0.25, 0.3 + k * 0.6, 0), mat)
		b2.rotation.x = 0.8 if k % 2 == 0 else -0.8

func _performer(at: Vector3, outfit: Color, mic: bool) -> void:
	var r := RandomNumberGenerator.new()
	r.seed = int(at.x * 10.0 + at.z)
	_person(at, 0.0, 2 if mic else 3, outfit, r)
	if mic:
		_cyl(0.02, 1.5, at + Vector3(0, 0.75, 0.5), flat(Color(0.7, 0.7, 0.72), 0.2, 1.0))
		_ball(0.05, at + Vector3(0, 1.55, 0.45), flat(Color(0.2, 0.2, 0.2), 0.3, 0.8))
		_light(at + Vector3(0, 4.0, 2.5), Color(1.0, 0.95, 0.9), 3.0, 7.0)

## the audience: one multimesh of figures, each bobbing to its own beat in _process
func _crowd_build(y: float, sz: float) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = figure(1)
	var pts: Array[Vector3] = []
	var r := RandomNumberGenerator.new()
	r.seed = 5
	while pts.size() < 520:
		var p := Vector3(r.randf_range(-24, 24), y, r.randf_range(sz + 8.5, 22.0))
		if absf(p.x) < 3.2 and p.z > 15.5 and p.z < 20.5:
			continue  # the mix tent
		# denser near the stage
		if r.randf() > 1.15 - (p.z - (sz + 8.5)) / 40.0:
			pts.append(p)
	mm.instance_count = pts.size()
	var cols := [Color(0.06, 0.06, 0.07), Color(0.5, 0.5, 0.52), Color(0.4, 0.05, 0.08), Color(0.08, 0.12, 0.3), Color(0.1, 0.3, 0.2), Color(0.45, 0.35, 0.1), Color(0.25, 0.08, 0.3)]
	_crowd_phase.resize(pts.size())
	for k in pts.size():
		var xf := Transform3D(Basis(Vector3.UP, PI + r.randf_range(-0.5, 0.5)).scaled(Vector3.ONE * r.randf_range(0.92, 1.06)), pts[k])
		_crowd_base.append(xf)
		_crowd_phase[k] = r.randf() * TAU
		mm.set_instance_transform(k, xf)
		mm.set_instance_color(k, cols[r.randi() % cols.size()])
	_crowd = MultiMeshInstance3D.new()
	_crowd.multimesh = mm
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.7
	_crowd.material_override = m
	world.add_child(_crowd)
	# raised hands and phone lights scattered through it
	var phone := flat(Color(0.9, 0.95, 1.0), 0.2, 0.0, 6.0)
	for k in 60:
		var p2: Vector3 = pts[r.randi() % pts.size()]
		_box(Vector3(0.06, 0.1, 0.01), p2 + Vector3(0.2, 2.1, -0.05), phone)
