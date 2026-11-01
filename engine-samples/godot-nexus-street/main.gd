extends Node3D
## World Fracture engine sample (Godot 4.6): a Nexus City street at night, built from code so it matches the Unity
## sample piece for piece. Left half of the screen: drag to walk. Right half: drag to look. Keyboard: WASD + mouse drag.

const STREET_LEN := 160.0
var player: CharacterBody3D
var cam_pivot: Node3D
var cam: Camera3D
var car: Node3D
var car_t := 0.0
var yaw := 0.0
var pitch := -0.25
var move_touch := -1
var move_origin := Vector2.ZERO
var move_vec := Vector2.ZERO
var look_touch := -1
var fps_label: Label
var env: Environment
var sky_mat: ProceduralSkyMaterial
var sun: DirectionalLight3D
var night_lights: Array[Light3D] = []
var window_mats: Array[StandardMaterial3D] = []
var is_day := false
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	_environment()
	_street()
	for i in range(14):
		var side := -1.0 if i % 2 == 0 else 1.0
		var z := -70.0 + float(i / 2) * 22.0
		_tower(Vector3(side * (22.0 + randf_range(0.0, 6.0)), 0, z), randf_range(10.0, 16.0), randf_range(40.0, 120.0), i)
	for k in range(9):
		var zz := -64.0 + k * 16.0
		_lamp(Vector3(-8.6, 0, zz))
		_lamp(Vector3(8.6, 0, zz + 8.0))
	car = _car(Color(0.55, 0.06, 0.1))
	rng.seed = 77
	_war_zone()
	_player()
	_hud()
	_set_day(false)

# ---------------------------------------------------------------- the night
func _environment() -> void:
	env = Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sky_mat = sm
	sm.sky_top_color = Color(0.03, 0.03, 0.09)
	sm.sky_horizon_color = Color(0.22, 0.12, 0.3)
	sm.ground_bottom_color = Color(0.02, 0.02, 0.03)
	sm.ground_horizon_color = Color(0.2, 0.11, 0.25)
	sky.sky_material = sm
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_bloom = 0.15
	env.fog_enabled = true
	env.fog_light_color = Color(0.18, 0.12, 0.26)
	env.fog_density = 0.008
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 30, 0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 80.0
	add_child(sun)

func _mat(color: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m

func _glow(color: Color, energy := 3.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = energy
	return m

func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = self, collide := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	parent.add_child(mi)
	if collide:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		shape.shape = bs
		body.add_child(shape)
		mi.add_child(body)
	return mi

# ---------------------------------------------------------------- the street
func _street() -> void:
	_box(Vector3(14, 0.2, STREET_LEN), Vector3(0, -0.1, 0), _mat(Color(0.07, 0.07, 0.08), 0.35, 0.2), self, true)   # wet asphalt
	for s in [-1.0, 1.0]:
		_box(Vector3(6, 0.35, STREET_LEN), Vector3(s * 10.0, 0.0, 0), _mat(Color(0.32, 0.31, 0.3), 0.85), self, true)  # sidewalks
		_box(Vector3(0.25, 0.4, STREET_LEN), Vector3(s * 7.1, 0.05, 0), _mat(Color(0.5, 0.5, 0.48), 0.8))             # kerbs
	for z in range(-76, 80, 8):
		_box(Vector3(0.18, 0.02, 3.2), Vector3(0, 0.01, z), _glow(Color(0.9, 0.85, 0.6), 0.6))                        # lane dashes
	_box(Vector3(200, 0.2, 200), Vector3(0, -0.35, 0), _mat(Color(0.05, 0.05, 0.06)), self, true)                    # ground

func _windows_texture(seed_i: int) -> ImageTexture:
	var img := Image.create(64, 128, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_i * 7919 + 1204
	img.fill(Color(0.03, 0.035, 0.05))
	for j in range(32):
		for i in range(16):
			var r := rng.randf()
			var c := Color(1.0, 0.82, 0.55) if r < 0.25 else (Color(0.7, 0.85, 1.0) if r < 0.33 else (Color(0.8, 0.55, 1.0) if r < 0.36 else Color(0.05, 0.06, 0.08)))
			for y in range(1, 3):
				for x in range(1, 3):
					img.set_pixel(i * 4 + x, j * 4 + y, c)
	return ImageTexture.create_from_image(img)

func _tower(base: Vector3, w: float, h: float, i: int) -> void:
	var m := StandardMaterial3D.new()
	var tex := _windows_texture(i)
	m.albedo_color = Color(0.12, 0.13, 0.16)
	m.albedo_texture = tex
	m.emission_enabled = true
	m.emission_texture = tex
	m.emission_energy_multiplier = 1.6
	m.roughness = 0.3
	m.metallic = 0.6
	m.uv1_scale = Vector3(w / 10.0, h / 20.0, 1)
	window_mats.append(m)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
	_box(Vector3(w, h, w), base + Vector3(0, h / 2.0, 0), m, self, true)
	_box(Vector3(w + 0.4, 0.5, w + 0.4), base + Vector3(0, h + 0.25, 0), _glow(Color(0.7, 0.4, 1.0), 2.0))          # crown light

func _lamp(at: Vector3) -> void:
	_box(Vector3(0.18, 6, 0.18), at + Vector3(0, 3, 0), _mat(Color(0.12, 0.12, 0.13), 0.5, 0.8))
	var arm_dir := 1.0 if at.x < 0.0 else -1.0
	_box(Vector3(1.6, 0.12, 0.2), at + Vector3(arm_dir * 0.8, 6, 0), _mat(Color(0.12, 0.12, 0.13), 0.5, 0.8))
	_box(Vector3(0.6, 0.14, 0.35), at + Vector3(arm_dir * 1.5, 5.9, 0), _glow(Color(1.0, 0.78, 0.5), 4.0))
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.75, 0.48)
	l.light_energy = 2.2
	l.omni_range = 13.0
	l.position = at + Vector3(arm_dir * 1.5, 5.5, 0)
	add_child(l)
	night_lights.append(l)

func _car(paint: Color) -> Node3D:
	var root := Node3D.new()
	add_child(root)
	var body := _mat(paint, 0.25, 0.7)
	_box(Vector3(1.9, 0.55, 4.4), Vector3(0, 0.6, 0), body, root)
	_box(Vector3(1.6, 0.5, 2.2), Vector3(0, 1.1, -0.2), _mat(Color(0.05, 0.07, 0.1), 0.05, 0.9), root)        # glass cabin
	for x in [-0.95, 0.95]:
		for z in [-1.4, 1.4]:
			var wheel := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.36
			cyl.bottom_radius = 0.36
			cyl.height = 0.28
			wheel.mesh = cyl
			wheel.material_override = _mat(Color(0.03, 0.03, 0.03), 0.9)
			wheel.rotation_degrees = Vector3(0, 0, 90)
			wheel.position = Vector3(x, 0.36, z)
			root.add_child(wheel)
	for x in [-0.65, 0.65]:
		_box(Vector3(0.4, 0.12, 0.05), Vector3(x, 0.72, -2.21), _glow(Color(1.0, 0.1, 0.12), 5.0), root)       # tail lights
		_box(Vector3(0.4, 0.12, 0.05), Vector3(x, 0.72, 2.21), _glow(Color(0.9, 0.95, 1.0), 4.0), root)        # headlights
	var head := SpotLight3D.new()
	head.light_energy = 3.0
	head.spot_range = 22.0
	head.spot_angle = 28.0
	head.position = Vector3(0, 0.8, 2.3)
	root.add_child(head)
	night_lights.append(head)
	return root

# ---------------------------------------------------------------- the war zone (south of the city)
## A two-lane forest road through pines, like the Road to Vostok shot: a checkpoint of wrecked armour, tyres, sandbags,
## a gravel berm and a graffiti bus shelter, all in fog. Trees are one MultiMesh per part (a few draw calls for 600 pines).
func _war_zone() -> void:
	_box(Vector3(240, 0.2, 200), Vector3(0, -0.35, -180), _mat(Color(0.2, 0.22, 0.14), 1.0), self, true)       # forest floor
	_box(Vector3(9, 0.2, 200), Vector3(0, -0.12, -180), _mat(Color(0.3, 0.3, 0.3), 0.9), self, true)           # worn asphalt
	for z in range(-90, -270, -9):
		_box(Vector3(0.15, 0.02, 3.0), Vector3(0, 0.0, z), _mat(Color(0.75, 0.75, 0.7), 0.9))
	_pines()
	var rust := _mat(Color(0.32, 0.2, 0.12), 0.95, 0.3)
	var olive := _mat(Color(0.26, 0.27, 0.18), 0.85, 0.2)
	_apc(Vector3(-2.5, 0, -132), 0.4, rust)
	_apc(Vector3(3.2, 0, -140), -0.25, olive)
	_tank(Vector3(-1.0, 0, -158), 0.15, rust)
	var bag := _mat(Color(0.45, 0.4, 0.3), 1.0)
	for i in range(10):
		_box(Vector3(1.0, 0.45, 0.55), Vector3(-4.0 + i * 0.95, 0.22, -126.0 + (i % 2) * 0.1), bag, self, i % 3 == 0)
		_box(Vector3(1.0, 0.45, 0.55), Vector3(-3.5 + i * 0.95, 0.66, -126.0), bag)
	var tyre := _mat(Color(0.05, 0.05, 0.05), 0.9)
	for i in range(6):
		var t := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.22
		tm.outer_radius = 0.42
		t.mesh = tm
		t.material_override = tyre
		t.position = Vector3(-6.5 + (i % 2) * 0.3, 0.12 + (i / 2) * 0.2, -134.0 - (i % 3) * 0.9)
		add_child(t)
	var berm := MeshInstance3D.new()                                                                        # gravel berm
	var bm := SphereMesh.new()
	bm.radius = 4.0
	bm.height = 3.0
	berm.mesh = bm
	berm.scale = Vector3(1.4, 0.6, 0.8)
	berm.position = Vector3(-9.5, -0.2, -136)
	berm.material_override = _mat(Color(0.5, 0.46, 0.4), 1.0)
	add_child(berm)
	_shelter(Vector3(7.5, 0, -150))

func _pines() -> void:
	var trunk_mm := MultiMesh.new()
	trunk_mm.transform_format = MultiMesh.TRANSFORM_3D
	var tc := CylinderMesh.new()
	tc.top_radius = 0.12
	tc.bottom_radius = 0.3
	tc.height = 1.0
	tc.radial_segments = 7
	trunk_mm.mesh = tc
	var crown_mm := MultiMesh.new()
	crown_mm.transform_format = MultiMesh.TRANSFORM_3D
	crown_mm.use_colors = true
	var cc := CylinderMesh.new()
	cc.top_radius = 0.0
	cc.bottom_radius = 1.0
	cc.height = 1.0
	cc.radial_segments = 9
	crown_mm.mesh = cc
	var spots: Array[Transform3D] = []
	var crowns: Array[Transform3D] = []
	var tints: Array[Color] = []
	for i in range(620):
		var x := rng.randf_range(-110.0, 110.0)
		var z := rng.randf_range(-275.0, -85.0)
		if absf(x) < 8.5 or (absf(x) < 14.0 and z > -165.0 and z < -120.0):
			continue                                                                                    # keep the road and checkpoint open
		var h := rng.randf_range(14.0, 26.0)
		spots.append(Transform3D(Basis().scaled(Vector3(1, h, 1)), Vector3(x, h / 2.0, z)))
		var tint := Color(0.1, 0.2, 0.1).lerp(Color(0.18, 0.26, 0.14), rng.randf())
		for k in range(3):                                                                              # three stacked tiers
			var r := (1.0 - k * 0.28) * rng.randf_range(2.2, 3.2)
			var ch := h * 0.42
			crowns.append(Transform3D(Basis().scaled(Vector3(r, ch, r)), Vector3(x, h * 0.32 + k * h * 0.2 + ch / 2.0, z)))
			tints.append(tint)
	trunk_mm.instance_count = spots.size()
	for i in spots.size():
		trunk_mm.set_instance_transform(i, spots[i])
	crown_mm.instance_count = crowns.size()
	for i in crowns.size():
		crown_mm.set_instance_transform(i, crowns[i])
		crown_mm.set_instance_color(i, tints[i])
	var trunks := MultiMeshInstance3D.new()
	trunks.multimesh = trunk_mm
	trunks.material_override = _mat(Color(0.25, 0.18, 0.12), 1.0)
	add_child(trunks)
	var leaves := MultiMeshInstance3D.new()
	leaves.multimesh = crown_mm
	var lm := _mat(Color(1, 1, 1), 0.95)
	lm.vertex_color_use_as_albedo = true
	leaves.material_override = lm
	add_child(leaves)

func _wheel_row(root: Node3D, xs: Array, zs: Array, r: float, mat: Material) -> void:
	for x in xs:
		for z in zs:
			var w := MeshInstance3D.new()
			var c := CylinderMesh.new()
			c.top_radius = r
			c.bottom_radius = r
			c.height = 0.4
			w.mesh = c
			w.material_override = mat
			w.rotation_degrees = Vector3(0, 0, 90)
			w.position = Vector3(x, r, z)
			root.add_child(w)

func _apc(at: Vector3, turn: float, paint: Material) -> void:
	var root := Node3D.new()
	root.position = at
	root.rotation.y = turn
	add_child(root)
	_box(Vector3(2.7, 1.3, 6.4), Vector3(0, 1.35, 0), paint, root, true)
	_box(Vector3(2.3, 0.7, 2.0), Vector3(0, 2.3, 2.4), paint, root)                                       # sloped nose
	_box(Vector3(1.2, 0.5, 1.4), Vector3(0, 2.25, -0.6), paint, root)                                      # turret
	_box(Vector3(0.12, 0.12, 2.2), Vector3(0, 2.3, 0.9), _mat(Color(0.1, 0.1, 0.1), 0.6, 0.8), root)        # gun
	_wheel_row(root, [-1.4, 1.4], [-2.2, -0.7, 0.8, 2.3], 0.55, _mat(Color(0.06, 0.06, 0.06), 0.9))

func _tank(at: Vector3, turn: float, paint: Material) -> void:
	var root := Node3D.new()
	root.position = at
	root.rotation.y = turn
	add_child(root)
	var track := _mat(Color(0.08, 0.07, 0.06), 0.9, 0.4)
	_box(Vector3(3.4, 1.0, 7.0), Vector3(0, 1.0, 0), paint, root, true)
	for x in [-1.75, 1.75]:
		_box(Vector3(0.7, 0.9, 7.2), Vector3(x, 0.45, 0), track, root)
	var turret := MeshInstance3D.new()
	var tc := CylinderMesh.new()
	tc.top_radius = 1.2
	tc.bottom_radius = 1.5
	tc.height = 0.8
	turret.mesh = tc
	turret.material_override = paint
	turret.position = Vector3(0, 1.9, -0.4)
	root.add_child(turret)
	var barrel := _box(Vector3(0.2, 0.2, 4.5), Vector3(0.3, 1.95, 2.6), paint, root)
	barrel.rotation_degrees = Vector3(-6, 8, 0)

func _shelter(at: Vector3) -> void:
	var frame := _mat(Color(0.35, 0.3, 0.26), 0.8, 0.5)
	for x in [-1.6, 1.6]:
		_box(Vector3(0.1, 2.4, 0.1), at + Vector3(x, 1.2, 0.7), frame)
	_box(Vector3(3.4, 0.1, 1.8), at + Vector3(0, 2.45, 0), frame)
	var img := Image.create(64, 32, false, Image.FORMAT_RGB8)                                               # a tagged back panel
	img.fill(Color(0.7, 0.68, 0.62))
	for k in range(260):
		var c: Color = [Color(0.1, 0.1, 0.12), Color(0.2, 0.3, 0.75), Color(0.75, 0.15, 0.15)][k % 3]
		var px := rng.randi_range(0, 60)
		var py := rng.randi_range(4, 26)
		for d in range(3):
			img.set_pixel(clampi(px + d, 0, 63), clampi(py + (k % 5) - 2, 0, 31), c)
	var m := _mat(Color(1, 1, 1), 0.9)
	m.albedo_texture = ImageTexture.create_from_image(img)
	_box(Vector3(3.3, 2.2, 0.06), at + Vector3(0, 1.25, -0.8), m, self, true)
	_box(Vector3(2.8, 0.08, 0.5), at + Vector3(0, 0.5, -0.4), frame)                                       # bench

# ---------------------------------------------------------------- the operator
func _player() -> void:
	player = CharacterBody3D.new()
	player.position = Vector3(3, 1.0, 30)
	add_child(player)
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.8
	shape.shape = cap
	player.add_child(shape)
	var suit := _mat(Color(0.12, 0.13, 0.16), 0.5, 0.3)
	var torso := MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.36
	cm.height = 1.5
	torso.mesh = cm
	torso.material_override = suit
	torso.position = Vector3(0, -0.1, 0)
	player.add_child(torso)
	var head := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.2
	sm.height = 0.4
	head.mesh = sm
	head.material_override = _mat(Color(0.36, 0.24, 0.17), 0.6)
	head.position = Vector3(0, 0.82, 0)
	player.add_child(head)
	_box(Vector3(0.5, 0.07, 0.05), Vector3(0, 0.85, 0.19), _glow(Color(0.3, 0.9, 1.0), 4.0), player)          # visor
	_box(Vector3(0.06, 0.9, 0.06), Vector3(0.3, 0.1, 0.0), _glow(Color(0.3, 0.9, 1.0), 2.5), player)          # suit light line
	cam_pivot = Node3D.new()
	cam_pivot.position = Vector3(0, 0.9, 0)
	player.add_child(cam_pivot)
	var arm := SpringArm3D.new()
	arm.spring_length = 4.2
	arm.position = Vector3(0.6, 0, 0)
	cam_pivot.add_child(arm)
	cam = Camera3D.new()
	cam.fov = 65
	arm.add_child(cam)

func _hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var title := Label.new()
	title.text = "GODOT 4.6 · World Fracture sample · Nexus City street"
	title.position = Vector2(16, 12)
	title.add_theme_color_override("font_color", Color(0.75, 0.92, 1.0))
	layer.add_child(title)
	var help := Label.new()
	help.text = "Left side: drag to walk   ·   Right side: drag to look   ·   Keyboard: WASD, N day/night, T travel"
	help.position = Vector2(16, 36)
	help.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
	layer.add_child(help)
	fps_label = Label.new()
	fps_label.position = Vector2(16, 60)
	fps_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	layer.add_child(fps_label)
	var w := get_viewport().get_visible_rect().size.x
	var day_btn := _button(layer, "DAY / NIGHT", Vector2(w - 200, 14))
	day_btn.pressed.connect(func() -> void: _set_day(not is_day))
	var go_btn := _button(layer, "CITY / WAR ZONE", Vector2(w - 200, 74))
	go_btn.pressed.connect(_teleport)

func _teleport() -> void:
	player.position = Vector3(0, 1.0, -112) if player.position.z > -90.0 else Vector3(3, 1.0, 30)
	player.velocity = Vector3.ZERO
	yaw = 0.0

func _button(layer: CanvasLayer, text: String, at: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.position = at
	b.custom_minimum_size = Vector2(184, 50)
	b.focus_mode = Control.FOCUS_NONE
	layer.add_child(b)
	return b

# ---------------------------------------------------------------- day and night
func _set_day(day: bool) -> void:
	is_day = day
	if day:
		sky_mat.sky_top_color = Color(0.22, 0.45, 0.85)
		sky_mat.sky_horizon_color = Color(0.68, 0.78, 0.9)
		sky_mat.ground_horizon_color = Color(0.6, 0.66, 0.7)
		sky_mat.ground_bottom_color = Color(0.2, 0.22, 0.2)
		sun.light_color = Color(1.0, 0.95, 0.86)
		sun.light_energy = 1.15
		sun.rotation_degrees = Vector3(-42, 35, 0)
		env.ambient_light_energy = 0.55
		env.glow_intensity = 0.3
	else:
		sky_mat.sky_top_color = Color(0.03, 0.03, 0.09)
		sky_mat.sky_horizon_color = Color(0.22, 0.12, 0.3)
		sky_mat.ground_horizon_color = Color(0.2, 0.11, 0.25)
		sky_mat.ground_bottom_color = Color(0.02, 0.02, 0.03)
		sun.light_color = Color(0.55, 0.62, 0.9)
		sun.light_energy = 0.35
		sun.rotation_degrees = Vector3(-50, 30, 0)
		env.ambient_light_energy = 0.6
		env.glow_intensity = 0.9
	for l in night_lights:
		l.visible = not day
	for m in window_mats:
		m.emission_energy_multiplier = 0.15 if day else 1.6
		m.albedo_color = Color(0.55, 0.6, 0.68) if day else Color(0.12, 0.13, 0.16)

# ---------------------------------------------------------------- input and motion
func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_N:
			_set_day(not is_day)
		elif event.keycode == KEY_T:
			_teleport()
	var half := get_viewport().get_visible_rect().size.x * 0.5
	if event is InputEventScreenTouch:
		if event.pressed:
			if event.position.x < half and move_touch == -1:
				move_touch = event.index
				move_origin = event.position
			elif event.position.x >= half and look_touch == -1:
				look_touch = event.index
		else:
			if event.index == move_touch:
				move_touch = -1
				move_vec = Vector2.ZERO
			if event.index == look_touch:
				look_touch = -1
	elif event is InputEventScreenDrag:
		if event.index == move_touch:
			move_vec = ((event.position - move_origin) / 70.0).limit_length(1.0)
		elif event.index == look_touch:
			yaw -= event.relative.x * 0.006
			pitch = clamp(pitch - event.relative.y * 0.004, -1.1, 0.35)

func _physics_process(delta: float) -> void:
	var input := move_vec
	if Input.is_key_pressed(KEY_W): input.y -= 1
	if Input.is_key_pressed(KEY_S): input.y += 1
	if Input.is_key_pressed(KEY_A): input.x -= 1
	if Input.is_key_pressed(KEY_D): input.x += 1
	input = input.limit_length(1.0)
	var basis := Basis(Vector3.UP, yaw)
	var dir := basis * Vector3(input.x, 0, input.y)
	var v := player.velocity
	v.x = dir.x * 5.5
	v.z = dir.z * 5.5
	v.y = v.y - 20.0 * delta if not player.is_on_floor() else -0.5
	player.velocity = v
	player.move_and_slide()
	if dir.length() > 0.1:
		player.rotation.y = lerp_angle(player.rotation.y, atan2(dir.x, dir.z), 10.0 * delta)
	cam_pivot.global_rotation = Vector3(pitch, yaw, 0)
	# the car loops up and down the street
	car_t += delta * 0.09
	var lane := 3.2 if fmod(car_t, 2.0) < 1.0 else -3.2
	var u := fmod(car_t, 1.0)
	var z: float = lerp(-74.0, 74.0, u) if lane > 0 else lerp(74.0, -74.0, u)
	car.position = Vector3(lane, 0, z)
	car.rotation.y = 0.0 if lane > 0 else PI
	# the war zone is a foggy pine forest; the city is clear
	var war := clampf((-player.position.z - 80.0) / 30.0, 0.0, 1.0)
	env.fog_density = lerp(0.006 if is_day else 0.008, 0.016, war)
	var city_fog := Color(0.55, 0.62, 0.72) if is_day else Color(0.18, 0.12, 0.26)
	var war_fog := Color(0.5, 0.55, 0.52) if is_day else Color(0.1, 0.12, 0.13)
	env.fog_light_color = city_fog.lerp(war_fog, war)
	fps_label.text = "%d fps · %s · %s" % [Engine.get_frames_per_second(), "war zone" if war > 0.5 else "Nexus City", "day" if is_day else "night"]
