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
	_player()
	_hud()

# ---------------------------------------------------------------- the night
func _environment() -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
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
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.55, 0.62, 0.9)
	moon.light_energy = 0.35
	moon.rotation_degrees = Vector3(-50, 30, 0)
	moon.shadow_enabled = true
	add_child(moon)

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
	return root

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
	help.text = "Left side: drag to walk   ·   Right side: drag to look   ·   Keyboard: WASD + mouse drag"
	help.position = Vector2(16, 36)
	help.add_theme_color_override("font_color", Color(0.7, 0.7, 0.8))
	layer.add_child(help)
	fps_label = Label.new()
	fps_label.position = Vector2(16, 60)
	fps_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	layer.add_child(fps_label)

# ---------------------------------------------------------------- input and motion
func _input(event: InputEvent) -> void:
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
	fps_label.text = "%d fps" % Engine.get_frames_per_second()
