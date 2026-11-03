extends "res://scripts/city/street_slice.gd"
## Mission 01 — THE FRACTURE, playable. One Nexus City block and the Nexus City Residences above it:
##   Apartment 1204 (wardrobe, kitchen, phone, TV) -> the 12th-floor corridor -> the lobby (Mara, Ellis, the mail room)
##   -> the Fracture: elevators dead, the stairs to the Sky Lounge on 11 (Mara is trapped there) -> the lobby doors ->
##   the street breaks open (cinematic) -> the Breach fight, powers waking (m01_story.gd) -> mission complete.
## The street is the street slice's (wet asphalt, palms, café, Meshy blocks, cars); the interiors are built here with real
## PBR materials (materials.gd). Third-person on foot (player.gd), Fracture echoes (echo.gd), a HUD in the style of the
## owner's reference frame, keyboard + mouse or touch.

signal finished

const Story := preload("res://scripts/mission/m01_story.gd")
const Player := preload("res://scripts/mission/player.gd")
const Echo := preload("res://scripts/mission/echo.gd")
const Rig := preload("res://scripts/character/character_rig.gd")
const CStore := preload("res://scripts/character/character_store.gd")
const Materials := preload("res://scripts/city/materials.gd")
const SAVE := "user://mission01.json"
const PROFILE := "user://profile.json"

const INT := Vector3(3000, 0, 0)        # the interiors, far from the street so nothing overlaps
const APT := INT
const HALL := INT + Vector3(0, 0, 40)
const LOUNGE := INT + Vector3(50, 0, 0)
const LOBBY := INT + Vector3(100, 0, 0)
const RES_DOOR := Vector3(-14.2, 0, -18.0)   # the Residences' doors on the street (west side)
const BOUNDS := Rect2(-14.4, -66.0, 28.8, 112.0)
const PURPLE := Color(0.62, 0.32, 1.0)
const GOLD := Color(0.95, 0.75, 0.4)

var story := Story.new()
var player: CharacterBody3D
var street_root: Node3D
var int_root: Node3D
var street_env: Environment
var int_env: Environment
var fracture_env: Environment
var we: WorldEnvironment
var sun: DirectionalLight3D
var int_sun: DirectionalLight3D
var room := "apt"
var _vp3: SubViewport
var _now := 0.0
var _interacts: Array = []
var _focus: Dictionary = {}
var _lines: Array = []      # queued [speaker, text]
var _line_t := 0.0
var _fade: ColorRect
var _busy := false
var _cine_t := -1.0
var _cine_cam: Camera3D
var _echoes: Array = []
var _wave_pending := false
var _npcs := {}
var _alarm_lights: Array = []
var _fracture_nodes: Array = []
var _complete_shown := false
var profile := { "xp": 0, "nex": 0, "level": 1 }
var touch := false
var _mouse_captured := false

# HUD
var hud: Control
var _obj_box: VBoxContainer
var _sub_name: Label
var _sub_text: Label
var _prompt: Label
var _ammo: Label
var _hp_bar: ProgressBar
var _compass: Label
var _xp: Label
var _cross: Control
var _marker: Label
var _location: Label
var _mini: Control
var _abil: Label
var _title_card: Label
var _complete: PanelContainer
# touch
var _joy_id := -1
var _joy_origin := Vector2.ZERO
var _joy_vec := Vector2.ZERO
var _look_id := -1
var _look_last := Vector2.ZERO
var _fire_btn: Button
var _btns: Array = []
var _keys := {}

func _ready() -> void:
	_rng.seed = 2207
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	touch = DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")
	_load_profile()
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	_vp3 = SubViewport.new()
	_vp3.msaa_3d = Viewport.MSAA_4X
	_vp3.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	_vp3.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_vp3.positional_shadow_atlas_size = 2048
	svc.add_child(_vp3)
	_vp = _vp3
	# the street (the slice's own builders, into street_root)
	street_root = Node3D.new()
	_vp3.add_child(street_root)
	world = street_root
	_environment()
	_street()
	_buildings()
	_skyline()
	_props()
	_cars()
	_residences_front()
	_street_collision()
	for c in street_root.get_children():
		if c is WorldEnvironment:
			street_env = (c as WorldEnvironment).environment
			c.queue_free()
		elif c is DirectionalLight3D and not sun:
			sun = c
	# the interiors
	int_root = Node3D.new()
	_vp3.add_child(int_root)
	world = int_root
	_interior_env()
	_apartment()
	_hallway()
	_lounge()
	_lobby()
	_interior_skyline()
	world = street_root
	we = WorldEnvironment.new()
	_vp3.add_child(we)
	# the player
	player = Player.new()
	_vp3.add_child(player)
	player.fired.connect(_on_fired)
	player.blasted.connect(_on_blast)
	player.hurt.connect(_on_hurt)
	_cine_cam = Camera3D.new()
	_cine_cam.fov = 55.0
	_cine_cam.far = 2500.0
	street_root.add_child(_cine_cam)
	_build_hud()
	_load()
	if story.phase == "DONE":
		_go_street(RES_DOOR + Vector3(3, 0, 0), -PI / 2, false)
		_set_fracture(true)
		player.set_powers(3)
	elif story.phase == "ALARM":
		_go_room("hall", HALL + Vector3(0, 0, 4), PI, false)
		_alarm_on()
	else:
		_go_room("apt", APT + Vector3(-5.4, 0, -1.4), -1.25, false)
		_say([["", "Apartment 1204. Morning light through the glass. Just another day in Nexus City."]])
	_update_hud()

# --------------------------------------------------------------------------------------------- saving
func _load() -> void:
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			story.restore(d)

func _save() -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(story.save()))

func _load_profile() -> void:
	var f := FileAccess.open(PROFILE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			profile.merge(d, true)

func _save_profile() -> void:
	var f := FileAccess.open(PROFILE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(profile))

static func done_before() -> bool:
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if not f:
		return false
	var d: Variant = JSON.parse_string(f.get_as_text())
	return d is Dictionary and d.get("phase", "") == "DONE"

# --------------------------------------------------------------------------------------------- building helpers
## a box that blocks the player (walls, counters, furniture)
func _solid(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := _box(size, pos, mat, parent)
	var body := StaticBody3D.new()
	body.collision_layer = 1
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	mi.add_child(body)
	return mi

func _block(size: Vector3, pos: Vector3, parent: Node3D = null) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	body.position = pos
	(parent if parent else world).add_child(body)

func _cyl(r: float, h: float, pos: Vector3, mat: Material, r_top := -1.0, sides := 20) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r if r_top < 0.0 else r_top
	c.bottom_radius = r
	c.height = h
	c.radial_segments = sides
	mi.mesh = c
	mi.position = pos
	mi.material_override = mat
	world.add_child(mi)
	return mi

func _ball(r: float, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	mi.mesh = s
	mi.position = pos
	mi.material_override = mat
	world.add_child(mi)
	return mi

func _lamp(pos: Vector3, c: Color, energy: float, rng: float, shadow := false) -> OmniLight3D:
	var o := OmniLight3D.new()
	o.position = pos
	o.light_color = c
	o.light_energy = energy
	o.omni_range = rng
	o.shadow_enabled = shadow
	world.add_child(o)
	return o

func _text(t: String, pos: Vector3, yaw: float, c: Color, size := 64, px := 0.006) -> Label3D:
	var l := Label3D.new()
	l.text = t
	l.font_size = size
	l.pixel_size = px
	l.modulate = c * 2.0
	l.shaded = false
	l.double_sided = false
	l.outline_size = 0
	l.position = pos
	l.rotation.y = yaw
	world.add_child(l)
	return l

var _stone: StandardMaterial3D
## polished white stone for counters and tables (the tile sets read as tiles on furniture)
func _stone_top() -> StandardMaterial3D:
	if not _stone:
		_stone = StandardMaterial3D.new()
		_stone.albedo_color = Color(0.93, 0.92, 0.9)
		_stone.roughness = 0.12
		_stone.metallic = 0.0
		if ResourceLoader.exists("res://textures/pbr/marble_01_nor.jpg"):
			_stone.normal_enabled = true
			_stone.normal_texture = load("res://textures/pbr/marble_01_nor.jpg")
			_stone.normal_scale = 0.15
	return _stone

func _glass_mat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.7, 0.82, 0.9, 0.14)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.02
	m.metallic = 0.6
	return m

func _plant(at: Vector3, h := 1.6) -> void:
	# the Meshy planter when it's there; a simple one otherwise
	if prop("planter.glb", h * 0.95, at) != null:
		return
	_cyl(0.32, 0.6, at + Vector3(0, 0.3, 0), flat(Color(0.12, 0.12, 0.13), 0.3, 0.3))
	var leaf := flat(Color(0.14, 0.36, 0.14), 0.7)
	leaf.cull_mode = BaseMaterial3D.CULL_DISABLED
	for k in 9:
		var a := TAU * k / 9.0
		var lf := _box(Vector3(0.22, 0.02, h * 0.6), at + Vector3(cos(a) * 0.3, 0.6 + h * 0.45, sin(a) * 0.3), leaf)
		lf.rotation = Vector3(0.75 + 0.2 * (k % 3), -a + PI / 2, 0)

## a room shell: floor, ceiling, four walls (each wall a list of solids so doors and windows can be cut)
func _shell(c: Vector3, w: float, d: float, h: float, floor_m: Material, wall_m: Material, ceil_m: Material, glass_side := "") -> void:
	_solid(Vector3(w, 0.2, d), c + Vector3(0, -0.1, 0), floor_m)
	_box(Vector3(w, 0.2, d), c + Vector3(0, h + 0.1, 0), ceil_m)
	for side: String in ["n", "s", "e", "w"]:
		var horiz := side == "n" or side == "s"
		var sgn := -1.0 if side == "n" or side == "w" else 1.0
		var size := Vector3(w, h, 0.2) if horiz else Vector3(0.2, h, d)
		var pos := c + (Vector3(0, h * 0.5, sgn * d * 0.5) if horiz else Vector3(sgn * w * 0.5, h * 0.5, 0))
		if side == glass_side:
			_solid(size, pos, _glass_mat())
			# mullions
			var n := int((w if horiz else d) / 2.4)
			for k in n + 1:
				var t := -0.5 + float(k) / n
				_box(Vector3(0.08, h, 0.12) if horiz else Vector3(0.12, h, 0.08), pos + (Vector3(t * w, 0, 0) if horiz else Vector3(0, 0, t * d)), flat(Color(0.08, 0.08, 0.09), 0.3, 0.8))
		else:
			_solid(size, pos, wall_m)

# --------------------------------------------------------------------------------------------- the street
func _residences_front() -> void:
	var x := RES_DOOR.x - 0.6
	var z := RES_DOOR.z
	var dark := flat(Color(0.07, 0.07, 0.09), 0.35, 0.6)
	# a dark stone podium front with a glass lobby, a canopy and the purple crest, in front of the block behind
	_box(Vector3(0.6, 9.0, 16.0), Vector3(x - 0.3, 4.5, z), Materials.pbr("marble_01", Color(0.35, 0.33, 0.36), 2.0, 0.5))
	_box(Vector3(0.1, 4.2, 9.0), Vector3(x + 0.05, 2.1, z), _glass_mat())
	_box(Vector3(0.12, 4.4, 0.25), Vector3(x + 0.08, 2.2, z - 4.6), dark)
	_box(Vector3(0.12, 4.4, 0.25), Vector3(x + 0.08, 2.2, z + 4.6), dark)
	# warm lobby light behind the glass
	_box(Vector3(0.05, 3.8, 8.6), Vector3(x - 0.2, 2.0, z), flat(Color(1.0, 0.82, 0.6), 1.0, 0.0, 0.9))
	# canopy with purple underglow
	_box(Vector3(4.2, 0.35, 11.0), Vector3(x + 2.0, 4.6, z), dark)
	_box(Vector3(0.08, 0.06, 11.0), Vector3(x + 4.05, 4.42, z), flat(PURPLE, 0.3, 0.0, 5.0))
	_box(Vector3(4.0, 0.03, 10.6), Vector3(x + 2.0, 4.41, z), flat(Color(1.0, 0.9, 0.75), 0.4, 0.0, 1.5))
	_text("NEXUS CITY", Vector3(x + 0.12, 6.4, z), PI / 2, Color(0.95, 0.95, 1.0), 120, 0.012)
	_text("RESIDENCES", Vector3(x + 0.12, 5.5, z), PI / 2, PURPLE, 90, 0.011)
	# the crest: a shield outline in purple neon
	var crest := flat(PURPLE, 0.3, 0.0, 6.0)
	for k in 8:
		var a := TAU * k / 8.0
		_box(Vector3(0.08, 0.6, 0.08), Vector3(x + 0.12, 7.9 + sin(a) * 0.6, z + cos(a) * 0.5), crest).rotation.x = a
	_lamp(Vector3(x + 2.5, 3.6, z), Color(1.0, 0.85, 0.65), 2.0, 8.0)
	_lamp(Vector3(x + 1.0, 1.5, z), PURPLE, 1.2, 6.0)
	for dz: float in [-6.5, 6.5]:
		_plant(Vector3(x + 1.2, 0.18, z + dz), 1.6)

## what you can't walk through on the street: the building line, the ends of the block (police barricades), the props
func _street_collision() -> void:
	_block(Vector3(400, 1, 400), Vector3(0, -0.5, 0))
	_block(Vector3(1, 30, 300), Vector3(BOUNDS.position.x - 0.5, 15, 0))
	_block(Vector3(1, 30, 300), Vector3(BOUNDS.end.x + 0.5, 15, 0))
	for zz: float in [BOUNDS.position.y, BOUNDS.end.y]:
		_block(Vector3(40, 30, 1), Vector3(0, 15, zz))
		# barricades and flashing lights across the street
		var bar := flat(Color(0.9, 0.9, 0.92), 0.5)
		var stripe := flat(Color(0.9, 0.1, 0.1), 0.5)
		for k in 7:
			var bx := -12.0 + k * 4.0
			_box(Vector3(3.2, 0.35, 0.2), Vector3(bx, 0.9, zz), bar)
			_box(Vector3(0.8, 0.36, 0.21), Vector3(bx - 0.8, 0.9, zz), stripe)
			_box(Vector3(0.8, 0.36, 0.21), Vector3(bx + 0.8, 0.9, zz), stripe)
			_box(Vector3(0.12, 1.0, 0.5), Vector3(bx - 1.4, 0.5, zz), bar)
			_box(Vector3(0.12, 1.0, 0.5), Vector3(bx + 1.4, 0.5, zz), bar)
		var lr := OmniLight3D.new()
		lr.light_color = Color(1.0, 0.15, 0.2)
		lr.omni_range = 9.0
		lr.light_energy = 0.0
		lr.position = Vector3(-6, 2.0, zz)
		street_root.add_child(lr)
		var lb := OmniLight3D.new()
		lb.light_color = Color(0.2, 0.4, 1.0)
		lb.omni_range = 9.0
		lb.light_energy = 0.0
		lb.position = Vector3(6, 2.0, zz)
		street_root.add_child(lb)
		_alarm_lights.append(lr)
		_alarm_lights.append(lb)
		_text("NEXUS PD · EVACUATION ZONE", Vector3(0, 1.6, zz + (0.15 if zz < 0 else -0.15)), 0.0 if zz < 0 else PI, Color(1.0, 0.9, 0.3), 64, 0.01)
	# the parked cars
	for c0 in street_root.get_children():
		if c0 is Node3D and String(c0.scene_file_path).contains("fleet"):
			var car := c0 as Node3D
			_block(Vector3(2.1, 1.5, 4.6), car.position + Vector3(0, 0.75, 0))
	# props the slice placed (palms, lamps, planters...): a box each
	for c in street_root.get_children():
		if c is Node3D and c.has_meta("size"):
			var sz: Vector3 = c.get_meta("size")
			var n := c as Node3D
			if absf(n.position.x) < 14.5 and sz.y < 12.0:
				var w := minf(sz.x, sz.z) if sz.y > 4.0 else maxf(sz.x, sz.z)
				var foot := Vector3(minf(sz.x, 0.8), sz.y, minf(sz.z, 0.8)) if sz.y > 4.0 else sz
				var rotated := Basis(Vector3.UP, n.rotation.y) * foot
				_block(Vector3(absf(rotated.x), foot.y, absf(rotated.z)), n.position + Vector3(0, foot.y * 0.5, 0))
				var _w := w

# --------------------------------------------------------------------------------------------- the interiors
func _interior_env() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.32, 0.5, 0.78)
	sky_mat.sky_horizon_color = Color(1.0, 0.78, 0.55)
	sky_mat.ground_horizon_color = Color(0.7, 0.55, 0.45)
	sky_mat.ground_bottom_color = Color(0.2, 0.18, 0.18)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	int_env = Environment.new()
	int_env.background_mode = Environment.BG_SKY
	int_env.sky = sky
	int_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	int_env.ambient_light_color = Color(1.0, 0.9, 0.8)
	int_env.ambient_light_energy = 0.45
	int_env.tonemap_mode = Environment.TONE_MAPPER_AGX
	int_env.tonemap_exposure = 1.0
	int_env.glow_enabled = true
	int_env.glow_intensity = 0.55
	int_env.glow_hdr_threshold = 1.1
	int_env.ssao_enabled = true
	int_env.ssr_enabled = true
	int_sun = DirectionalLight3D.new()
	int_sun.light_color = Color(1.0, 0.8, 0.6)
	int_sun.light_energy = 1.8
	int_sun.shadow_enabled = true
	int_sun.rotation_degrees = Vector3(-16, 20, 0)   # low morning sun through the north glass
	int_root.add_child(int_sun)

func _interior_skyline() -> void:
	var glass_tower := Materials.pbr("brushed_concrete", Color(0.55, 0.62, 0.72), 6.0, 0.4)
	var win := StandardMaterial3D.new()
	win.albedo_color = Color(0.35, 0.48, 0.62)
	win.metallic = 0.8
	win.roughness = 0.08
	var r := RandomNumberGenerator.new()
	r.seed = 12
	for i in 110:
		var a := r.randf() * TAU
		var dist := r.randf_range(140.0, 520.0)
		var h := r.randf_range(50.0, 230.0)
		var w := r.randf_range(18.0, 40.0)
		var c := INT + Vector3(50, 0, 0) + Vector3(cos(a) * dist, h * 0.5 - 45.0, sin(a) * dist)
		var mi := _box(Vector3(w, h, w), c, win if i % 3 else glass_tower)
		mi.rotation.y = r.randf() * PI
		if i % 4 == 0:
			_box(Vector3(w * 0.7, 12.0, w * 0.7), c + Vector3(0, h * 0.5 + 6.0, 0), win).rotation.y = mi.rotation.y

func _apartment() -> void:
	var c := APT
	var wood := Materials.pbr("wood_floor", Color(1.0, 0.92, 0.85), 1.6, 0.8)
	var plaster := Materials.pbr("painted_plaster_wall", Color(0.93, 0.9, 0.86), 3.0)
	_shell(c, 16.0, 11.0, 3.2, wood, plaster, flat(Color(0.95, 0.94, 0.92), 0.9), "n")
	# cove light and pendant
	_box(Vector3(15.0, 0.04, 0.1), c + Vector3(0, 3.15, 5.3), flat(Color(1.0, 0.88, 0.7), 1.0, 0.0, 3.0))
	_lamp(c + Vector3(-4.5, 2.8, 0.5), Color(1.0, 0.86, 0.7), 1.3, 9.0)
	_lamp(c + Vector3(4.0, 2.8, 0.5), Color(1.0, 0.86, 0.7), 1.3, 9.0, true)
	# bedroom (west): bed, nightstands, wardrobe
	var frame := Materials.pbr("wood_floor", Color(0.45, 0.3, 0.2), 1.0, 0.7)
	_solid(Vector3(2.2, 0.45, 2.3), c + Vector3(-6.4, 0.23, -2.6), frame)
	_box(Vector3(2.1, 0.25, 2.2), c + Vector3(-6.4, 0.58, -2.6), Materials.surface("velour_velvet", Color(0.9, 0.9, 0.92), 0.6))
	_box(Vector3(2.1, 0.12, 1.3), c + Vector3(-6.4, 0.75, -2.1), Materials.surface("velour_velvet", Color(0.35, 0.2, 0.5), 0.6))
	for dx: float in [-0.5, 0.5]:
		_box(Vector3(0.75, 0.18, 0.4), c + Vector3(-6.4 + dx, 0.82, -3.45), Materials.surface("fabric_pattern_07", Color(0.95, 0.95, 0.95), 0.4))
	_solid(Vector3(2.4, 1.1, 0.12), c + Vector3(-6.4, 0.55, -3.8), Materials.surface("leather_red_02", Color(0.22, 0.16, 0.12), 0.5))
	for dx2: float in [-1.6, 1.6]:
		_solid(Vector3(0.6, 0.55, 0.5), c + Vector3(-6.4 + dx2, 0.28, -3.4), frame)
		_ball(0.12, c + Vector3(-6.4 + dx2, 0.75, -3.4), flat(Color(1.0, 0.85, 0.6), 0.3, 0.0, 4.0))
	_solid(Vector3(2.6, 2.6, 0.7), c + Vector3(-6.3, 1.3, 4.8), frame)
	_box(Vector3(0.02, 2.4, 0.02), c + Vector3(-6.3, 1.3, 4.44), flat(Color(0.8, 0.7, 0.5), 0.3, 0.9))
	_interact("apt", c + Vector3(-6.3, 0, 3.9), 1.6, "Get dressed", func() -> void: _morning("dress"), func() -> bool: return _todo("dress"), "dress")
	# living room: rug, L sofa, coffee table with the phone, TV wall
	_box(Vector3(5.0, 0.02, 3.6), c + Vector3(2.0, 0.01, -0.6), Materials.surface("velour_velvet", Color(0.4, 0.36, 0.33), 0.6))
	var sofa := Materials.surface("fabric_pattern_07", Color(0.32, 0.33, 0.36), 0.5)
	_solid(Vector3(4.0, 0.45, 1.0), c + Vector3(2.0, 0.23, 1.4), sofa)
	_box(Vector3(4.0, 0.7, 0.3), c + Vector3(2.0, 0.6, 1.85), sofa)
	_solid(Vector3(1.0, 0.45, 2.2), c + Vector3(-0.4, 0.23, 0.2), sofa)
	for k in 3:
		_box(Vector3(0.55, 0.4, 0.15), c + Vector3(1.0 + k * 1.1, 0.68, 1.65), Materials.surface("velour_velvet", [PURPLE.darkened(0.3), Color(0.9, 0.85, 0.75), PURPLE.darkened(0.3)][k], 0.5))
	_solid(Vector3(1.6, 0.4, 0.9), c + Vector3(2.0, 0.2, -0.4), _stone_top())
	_box(Vector3(0.09, 0.01, 0.17), c + Vector3(2.4, 0.41, -0.3), flat(Color(0.4, 0.75, 1.0), 0.2, 0.0, 3.0))
	_interact("apt", c + Vector3(2.4, 0, -0.3), 1.6, "Check your messages", func() -> void: _morning("phone"), func() -> bool: return _todo("phone"), "phone")
	# the TV wall on the east wall
	_box(Vector3(0.3, 2.8, 5.0), c + Vector3(7.8, 1.4, -0.5), Materials.pbr("wood_floor", Color(0.3, 0.22, 0.16), 1.2, 0.6))
	var tv := _box(Vector3(0.05, 1.5, 2.7), c + Vector3(7.62, 1.6, -0.5), _news_mat())
	tv.name = "TV"
	_text("NEXUS NEWS", c + Vector3(7.58, 2.2, -0.5), -PI / 2, Color(1.0, 1.0, 1.0), 48, 0.006)
	_interact("apt", c + Vector3(6.6, 0, -0.5), 1.8, "Watch the morning news", func() -> void: _morning("news"), func() -> bool: return _todo("news"), "news")
	# kitchen (south-east): counter run, island, stools, fridge, pendants
	var cab := Materials.pbr("wood_floor", Color(0.25, 0.25, 0.27), 1.0, 0.6)
	_solid(Vector3(5.0, 0.95, 0.7), c + Vector3(4.6, 0.48, 5.1), cab)
	_box(Vector3(5.0, 0.05, 0.72), c + Vector3(4.6, 0.98, 5.1), _stone_top())
	_solid(Vector3(0.9, 2.1, 0.75), c + Vector3(7.4, 1.05, 5.0), flat(Color(0.75, 0.77, 0.8), 0.25, 0.9))
	_solid(Vector3(3.0, 0.95, 1.1), c + Vector3(4.2, 0.48, 3.0), _stone_top())
	for k in 3:
		_cyl(0.2, 0.06, c + Vector3(3.2 + k * 1.0, 0.75, 2.2), flat(GOLD, 0.25, 0.9))
		_cyl(0.025, 0.74, c + Vector3(3.2 + k * 1.0, 0.37, 2.2), flat(GOLD, 0.25, 0.9))
		_ball(0.15, c + Vector3(3.2 + k * 1.0, 2.5, 3.0), flat(Color(1.0, 0.85, 0.6), 0.3, 0.0, 5.0))
	_box(Vector3(0.3, 0.12, 0.2), c + Vector3(3.6, 1.02, 3.0), flat(Color(0.95, 0.95, 0.95), 0.4))
	_interact("apt", c + Vector3(4.2, 0, 2.2), 1.6, "Make breakfast", func() -> void: _morning("breakfast"), func() -> bool: return _todo("breakfast"), "breakfast")
	# plants, art, a floor lamp
	_plant(c + Vector3(-1.8, 0, -4.7), 1.8)
	_plant(c + Vector3(7.2, 0, -4.7), 1.5)
	_box(Vector3(2.2, 1.3, 0.04), c + Vector3(-2.0, 1.8, 5.38), flat(PURPLE.darkened(0.2), 0.7, 0.0, 0.3))
	# the door to the corridor, and the number
	_box(Vector3(1.1, 2.3, 0.1), c + Vector3(1.0, 1.15, 5.42), Materials.pbr("wood_floor", Color(0.2, 0.15, 0.12), 1.0, 0.5))
	_text("12-04", c + Vector3(1.0, 2.55, 5.36), PI, GOLD, 48, 0.006)
	_interact("apt", c + Vector3(1.0, 0, 4.8), 1.4, "Go out to the corridor", func() -> void: _go_room("hall", HALL + Vector3(1.0, 0, -6.0), 0.0), func() -> bool: return true, "to_hall")

var _news: ShaderMaterial
func _news_mat() -> ShaderMaterial:
	if _news:
		return _news
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded;
uniform float alarm = 0.0;
void fragment() {
	vec2 uv = UV;
	vec3 bg = mix(vec3(0.05, 0.12, 0.3), vec3(0.1, 0.25, 0.5), uv.y);
	float ticker = step(uv.y, 0.16) * (0.6 + 0.4 * step(0.5, fract(uv.x * 12.0 + TIME * 0.6)));
	float anchor = smoothstep(0.2, 0.18, length((uv - vec2(0.3, 0.55)) * vec2(1.0, 1.6)));
	vec3 c = bg + vec3(0.9, 0.2, 0.25) * ticker * 0.5 + vec3(0.8, 0.7, 0.6) * anchor;
	c = mix(c, vec3(1.0, 0.1, 0.1) * (0.5 + 0.5 * sin(TIME * 8.0)), alarm);
	ALBEDO = c * 1.4;
}
"""
	_news = ShaderMaterial.new()
	_news.shader = sh
	return _news

func _hallway() -> void:
	var c := HALL
	var runner := Materials.surface("quatrefoil_jacquard_fabric", Color(0.28, 0.16, 0.42), 0.6)
	var panel := Materials.pbr("wood_floor", Color(0.28, 0.24, 0.26), 1.5, 0.6)
	_shell(c, 3.4, 26.0, 3.0, runner, panel, flat(Color(0.12, 0.11, 0.13), 0.8))
	for k in 8:
		var z := -10.0 + k * 3.0
		var sx := -1.0 if k % 2 == 0 else 1.0
		_box(Vector3(0.06, 2.3, 1.1), c + Vector3(sx * 1.62, 1.15, z), Materials.pbr("wood_floor", Color(0.18, 0.13, 0.1), 1.0, 0.5))
		_box(Vector3(0.04, 0.05, 1.1), c + Vector3(sx * 1.6, 2.35, z), flat(PURPLE, 0.3, 0.0, 4.0))
		_text("12-0%d" % (k + 1), c + Vector3(sx * 1.58, 2.6, z), -sx * PI / 2, GOLD, 40, 0.005)
		_box(Vector3(0.08, 0.3, 0.12), c + Vector3(-sx * 1.6, 2.0, z), flat(Color(1.0, 0.8, 0.55), 0.3, 0.0, 5.0))
	for k in 4:
		_lamp(c + Vector3(0, 2.6, -9.0 + k * 6.0), Color(1.0, 0.82, 0.62), 0.9, 6.0)
	# the elevators at the south end, the emergency stairs at the north end
	for dx: float in [-0.75, 0.75]:
		_box(Vector3(1.1, 2.4, 0.08), c + Vector3(dx, 1.2, 12.9), flat(GOLD, 0.2, 1.0))
	_text("ELEVATORS", c + Vector3(0, 2.7, 12.85), PI, Color(0.9, 0.9, 1.0), 40, 0.006)
	_interact("hall", c + Vector3(0, 0, 11.8), 1.6, "Elevator · down to the lobby", func() -> void:
		if story.phase == "ALARM":
			_say([["BUILDING", "Elevators offline. Use the emergency stairs."]])
		else:
			_go_room("lobby", LOBBY + Vector3(-9.0, 0, -6.0), PI / 2), func() -> bool: return true, "elev_down")
	_box(Vector3(1.2, 2.3, 0.08), c + Vector3(0, 1.15, -12.9), flat(Color(0.6, 0.08, 0.08), 0.5, 0.3))
	_text("EXIT · STAIRS", c + Vector3(0, 2.6, -12.85), 0.0, Color(0.2, 1.0, 0.3), 40, 0.006)
	_interact("hall", c + Vector3(0, 0, -11.8), 1.6, "Emergency stairs", func() -> void:
		if story.phase == "ALARM":
			_say([["", "Twelve flights of dark stairwell. On 11, a slab of ceiling blocks the way down. The only way through is the Sky Lounge."]])
			_go_room("lounge", LOUNGE + Vector3(-5.5, 0, 4.0), PI * 0.8)
		else:
			_go_room("lobby", LOBBY + Vector3(9.0, 0, -6.0), -PI / 2), func() -> bool: return true, "stairs")
	_interact("hall", c + Vector3(1.0, 0, -6.6), 1.2, "Back into 12-04", func() -> void: _go_room("apt", APT + Vector3(1.0, 0, 4.0), PI), func() -> bool: return story.phase == "MORNING", "to_apt")

func _lounge() -> void:
	var c := LOUNGE
	_shell(c, 16.0, 12.0, 3.4, Materials.pbr("floor_tiles_06", Color(0.6, 0.58, 0.62), 2.0, 0.5), Materials.pbr("painted_plaster_wall", Color(0.3, 0.27, 0.34), 3.0), flat(Color(0.08, 0.07, 0.1), 0.8), "n")
	_box(Vector3(15.0, 0.05, 0.1), c + Vector3(0, 3.3, -5.7), flat(PURPLE, 0.3, 0.0, 4.0))
	# the screen and theatre seats
	_box(Vector3(6.0, 2.6, 0.08), c + Vector3(-3.0, 1.9, 5.85), _news_mat())
	_text("WORLD FRACTURE", c + Vector3(-3.0, 2.0, 5.8), PI, Color(0.9, 0.85, 1.0), 90, 0.009)
	for row in 2:
		for k in 5:
			_solid(Vector3(0.8, 0.9, 0.8), c + Vector3(-5.4 + k * 1.2, 0.45, 2.0 - row * 1.4), Materials.surface("velour_velvet", Color(0.45, 0.06, 0.12), 0.5))
	# pool table and arcades
	_solid(Vector3(2.6, 0.85, 1.4), c + Vector3(4.0, 0.43, -1.5), Materials.pbr("wood_floor", Color(0.3, 0.18, 0.1), 1.0, 0.5))
	_box(Vector3(2.4, 0.04, 1.2), c + Vector3(4.0, 0.87, -1.5), Materials.surface("velour_velvet", Color(0.05, 0.5, 0.55), 0.4))
	for k in 3:
		_solid(Vector3(0.8, 1.8, 0.8), c + Vector3(6.8, 0.9, 1.5 + k * 1.1), flat(Color(0.1, 0.05, 0.2), 0.4, 0.3))
		_box(Vector3(0.05, 0.6, 0.6), c + Vector3(6.38, 1.4, 1.5 + k * 1.1), flat([Color(1.0, 0.3, 0.6), Color(0.3, 0.9, 1.0), Color(1.0, 0.8, 0.3)][k], 0.3, 0.0, 4.0))
	_solid(Vector3(3.0, 0.45, 1.0), c + Vector3(2.0, 0.23, 3.8), Materials.surface("fabric_pattern_07", Color(0.25, 0.24, 0.3), 0.5))
	_plant(c + Vector3(-7.0, 0, -5.0), 1.6)
	_lamp(c + Vector3(0, 2.9, 0), Color(0.9, 0.75, 1.0), 1.0, 12.0)
	# debris from the ceiling by the far stairs, sparks
	for k in 6:
		var d := _solid(Vector3(randf_range(0.6, 1.4), randf_range(0.2, 0.5), randf_range(0.6, 1.4)), c + Vector3(6.0 + randf_range(-1, 1), 0.2, -4.0 + randf_range(-1, 1)), Materials.pbr("brushed_concrete", Color(0.6, 0.6, 0.62), 1.0))
		d.rotation = Vector3(randf() * 0.4, randf() * PI, randf() * 0.4)
	# Mara, trapped by the seats; the stairs on down
	_npc("mara_trapped", "f-athletic", "female", "nyx", c + Vector3(-4.6, 0, 0.6), PI * 0.2)
	_interact("lounge", c + Vector3(-4.6, 0, 0.6), 2.0, "Free Mara", func() -> void:
		_say(story.rescue())
		_update_hud()
		var m: Node3D = _npcs.get("mara_trapped")
		if m:
			m.visible = false, func() -> bool: return story.phase == "ALARM" and not story.rescued, "mara")
	_box(Vector3(1.2, 2.3, 0.08), c + Vector3(-7.9, 1.15, 4.0), flat(Color(0.6, 0.08, 0.08), 0.5, 0.3)).rotation.y = PI / 2
	_text("EXIT · STAIRS", c + Vector3(-7.85, 2.6, 4.0), PI / 2, Color(0.2, 1.0, 0.3), 40, 0.006)
	_interact("lounge", c + Vector3(-7.0, 0, 4.0), 1.6, "Stairs down to the lobby", func() -> void: _go_room("lobby", LOBBY + Vector3(9.0, 0, -6.0), -PI / 2), func() -> bool: return true, "stairs")

func _lobby() -> void:
	var c := LOBBY
	var marble := Materials.pbr("floor_tiles_06", Color(1.0, 0.98, 0.96), 2.6, 0.35)
	var stone := Materials.pbr("painted_plaster_wall", Color(0.62, 0.58, 0.56), 3.0)
	_shell(c, 26.0, 18.0, 7.0, marble, stone, flat(Color(0.1, 0.09, 0.11), 0.6), "e")
	# double ring chandelier
	for ring: float in [2.4, 3.6]:
		var t := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = ring - 0.05
		tm.outer_radius = ring + 0.05
		tm.rings = 48
		t.mesh = tm
		t.position = c + Vector3(0, 5.6 + (ring - 2.4) * 0.5, 0)
		t.material_override = flat(Color(1.0, 0.86, 0.6), 0.3, 0.0, 6.0)
		world.add_child(t)
	_lamp(c + Vector3(0, 5.0, 0), Color(1.0, 0.86, 0.66), 2.6, 18.0, true)
	_lamp(c + Vector3(-8, 4.5, 5), Color(1.0, 0.82, 0.62), 1.2, 10.0)
	_lamp(c + Vector3(8, 4.5, 5), PURPLE, 1.0, 10.0)
	# the crest wall behind reception (north)
	_box(Vector3(8.0, 5.5, 0.1), c + Vector3(0, 3.2, -8.85), flat(Color(0.12, 0.06, 0.2), 0.4, 0.2))
	_text("NEXUS CITY", c + Vector3(0, 4.4, -8.78), 0.0, Color(0.95, 0.95, 1.0), 110, 0.01)
	_text("RESIDENCES", c + Vector3(0, 3.6, -8.78), 0.0, PURPLE, 80, 0.009)
	_box(Vector3(8.0, 0.06, 0.12), c + Vector3(0, 0.6, -8.8), flat(PURPLE, 0.3, 0.0, 5.0))
	# reception desk with a purple glowing front, Ellis behind it
	_solid(Vector3(5.0, 1.1, 1.0), c + Vector3(0, 0.55, -6.0), _stone_top())
	_box(Vector3(5.02, 0.06, 0.02), c + Vector3(0, 0.3, -5.49), flat(PURPLE, 0.3, 0.0, 5.0))
	_npc("ellis", "m-distinguished", "male", "cipher", c + Vector3(0, 0, -7.0), 0.0)
	_interact("lobby", c + Vector3(0, 0, -5.0), 1.6, "Talk to Ellis", func() -> void: _say([["ELLIS", ["Welcome home. Lifts are behind you, the directory lists every floor.", "Something came for 12-04 this morning. It's in your box.", "The court on 3 is free most mornings."][randi() % 3]]]), func() -> bool: return story.phase == "MORNING")
	# the lounge (south-west) where Mara sits in the morning
	var sofa := Materials.surface("fabric_pattern_07", Color(0.55, 0.53, 0.56), 0.5)
	_solid(Vector3(3.6, 0.45, 1.0), c + Vector3(-7.0, 0.23, 6.8), sofa)
	_box(Vector3(3.6, 0.7, 0.3), c + Vector3(-7.0, 0.6, 7.25), sofa)
	_solid(Vector3(1.0, 0.45, 2.6), c + Vector3(-9.6, 0.23, 5.0), sofa)
	_solid(Vector3(1.8, 0.4, 1.0), c + Vector3(-6.6, 0.2, 4.8), _stone_top())
	_npc("mara", "f-athletic", "female", "nyx", c + Vector3(-5.0, 0, 5.2), PI * 0.8)
	_interact("lobby", c + Vector3(-5.0, 0, 5.2), 2.0, "Say hi to Mara", func() -> void: _morning("neighbour"), func() -> bool: return _todo("neighbour"), "neighbour")
	# the mail room alcove (west wall): a grid of lockers
	_solid(Vector3(0.6, 3.0, 6.0), c + Vector3(-12.6, 1.5, -2.0), flat(Color(0.2, 0.2, 0.22), 0.4, 0.6))
	for r in 5:
		for k in 8:
			_box(Vector3(0.04, 0.5, 0.65), c + Vector3(-12.28, 0.5 + r * 0.55, -4.6 + k * 0.72), flat(Color(0.55, 0.56, 0.6), 0.25, 0.9))
	_text("MAIL & PACKAGES", c + Vector3(-12.26, 3.4, -2.0), PI / 2, Color(0.6, 0.85, 1.0), 64, 0.008)
	_interact("lobby", c + Vector3(-11.4, 0, -2.0), 1.8, "Pick up your mail", func() -> void: _morning("mail"), func() -> bool: return _todo("mail"), "mail")
	# elevators (west, north end) and the stair door (east, north end)
	for dz: float in [-1.2, 0.0, 1.2]:
		_box(Vector3(0.08, 2.6, 1.0), c + Vector3(-12.85, 1.3, -7.0 + dz * 0.0 + dz), flat(GOLD, 0.2, 1.0))
	_interact("lobby", c + Vector3(-11.8, 0, -7.0), 1.6, "Elevator · up to 12", func() -> void:
		if story.phase == "ALARM":
			_say([["BUILDING", "Elevators offline."]])
		else:
			_go_room("hall", HALL + Vector3(0, 0, 11.0), PI), func() -> bool: return story.phase == "MORNING", "elev_up")
	_box(Vector3(0.08, 2.3, 1.2), c + Vector3(12.85, 1.15, -6.0), flat(Color(0.6, 0.08, 0.08), 0.5, 0.3))
	_text("STAIRS", c + Vector3(12.8, 2.6, -6.0), -PI / 2, Color(0.2, 1.0, 0.3), 40, 0.006)
	_interact("lobby", c + Vector3(11.8, 0, -6.0), 1.6, "Stairs up to 12", func() -> void: _go_room("hall", HALL + Vector3(0, 0, -11.0), 0.0), func() -> bool: return story.phase == "MORNING")
	# plants and the front doors (east glass wall, the street beyond)
	for p: Vector3 in [Vector3(-11, 0, 7.5), Vector3(11, 0, 7.5), Vector3(-3.5, 0, -7.6), Vector3(3.5, 0, -7.6)]:
		_plant(c + p, 2.2)
	_box(Vector3(0.1, 3.4, 3.6), c + Vector3(12.9, 1.7, 3.0), flat(Color(1.0, 0.95, 0.85), 1.0, 0.0, 1.2))
	_text("EXIT", c + Vector3(12.8, 3.8, 3.0), -PI / 2, Color(0.2, 1.0, 0.3), 48, 0.007)
	_interact("lobby", c + Vector3(11.6, 0, 3.0), 2.0, "Out to the street", func() -> void:
		if story.phase == "MORNING":
			_say([["ELLIS", "Heading out already? Finish your morning first — Mara's been asking after you."]])
		else:
			_exit_to_street(), func() -> bool: return true, "front")
	# background residents
	var r := RandomNumberGenerator.new()
	r.seed = 4
	for k in 3:
		var mi := MeshInstance3D.new()
		mi.mesh = Casino.figure(0, k % 2 == 0)
		mi.set_surface_override_material(0, flat([Color(0.1, 0.1, 0.12), Color(0.6, 0.5, 0.4), Color(0.2, 0.25, 0.4)][k], 0.6))
		mi.set_surface_override_material(1, flat(Color(0.7, 0.5, 0.36), 0.6))
		mi.set_surface_override_material(2, flat(Color(0.1, 0.07, 0.05), 0.6))
		mi.position = c + Vector3(-2.0 + k * 3.5, 0, 2.0 + k)
		mi.rotation.y = r.randf() * TAU
		world.add_child(mi)

func _npc(id: String, face: String, body: String, frame: String, at: Vector3, yaw: float) -> void:
	var rig := Rig.new()
	world.add_child(rig)
	rig.build(CStore.clean({"frame": frame, "body": body, "face": face}, true))
	rig.position = at
	rig.rotation.y = yaw
	_npcs[id] = rig
	if rig.anim and rig.anim.has_animation("idle"):
		rig.anim.get_animation("idle").loop_mode = Animation.LOOP_LINEAR
		rig.anim.play("idle")
		rig.anim.seek(randf() * 1.5, true)

# --------------------------------------------------------------------------------------------- interaction and rooms
func _interact(rm: String, at: Vector3, r: float, label: String, act: Callable, cond: Callable, tag := "") -> void:
	_interacts.append({ "room": rm, "at": at, "r": r, "label": label, "act": act, "cond": cond, "tag": tag })

func _todo(step: String) -> bool:
	return story.phase == "MORNING" and not story.done.has(step)

func _morning(step: String) -> void:
	var lines := story.mark(step, _now)
	_say(lines)
	if story.phase == "ALARM":
		_alarm_on()
	_save()
	_update_hud()

func _go_room(rm: String, at: Vector3, yaw: float, fade := true) -> void:
	if fade:
		await _fade_out()
	room = rm
	_set_world(false)
	player.global_position = at + Vector3(0, 0.05, 0)
	player.velocity = Vector3.ZERO
	player.snap_camera(yaw)
	_location_text()
	if fade:
		await _fade_in()

func _go_street(at: Vector3, yaw: float, fade := true) -> void:
	if fade:
		await _fade_out()
	room = "street"
	_set_world(true)
	player.global_position = at + Vector3(0, 0.1, 0)
	player.velocity = Vector3.ZERO
	player.snap_camera(yaw)
	_location_text()
	if fade:
		await _fade_in()

func _set_world(street: bool) -> void:
	street_root.visible = street
	int_root.visible = not street
	if street:
		we.environment = fracture_env if fracture_env and story.phase != "MORNING" and story.phase != "ALARM" else street_env
	else:
		we.environment = int_env
	player.cam.current = true

func _location_text() -> void:
	if _location:
		_location.text = { "apt": "Nexus City Residences · 12-04", "hall": "Residences · Floor 12", "lounge": "Residences · Sky Lounge, 11", "lobby": "Residences · Main Lobby", "street": "Nexus City · District 1" }.get(room, "")

func _fade_out() -> void:
	_busy = true
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 1.0, 0.3)
	await tw.finished

func _fade_in() -> void:
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 0.0, 0.35)
	await tw.finished
	_busy = false

# --------------------------------------------------------------------------------------------- the alarm
func _alarm_on() -> void:
	_news_mat().set_shader_parameter("alarm", 1.0)
	# every interior light goes red and pulses; the sun dims to a bruised violet through the glass
	for l in int_root.find_children("*", "OmniLight3D", true, false):
		var o := l as OmniLight3D
		o.light_color = Color(1.0, 0.12, 0.1)
		_alarm_lights.append(o)
	int_sun.light_color = Color(0.6, 0.35, 0.9)
	int_sun.light_energy = 0.7
	int_env.ambient_light_color = Color(0.75, 0.55, 0.6)
	int_env.ambient_light_energy = 0.45
	(int_env.sky.sky_material as ProceduralSkyMaterial).sky_top_color = Color(0.1, 0.03, 0.2)
	(int_env.sky.sky_material as ProceduralSkyMaterial).sky_horizon_color = Color(0.6, 0.2, 0.6)
	var mara: Node3D = _npcs.get("mara")
	if mara:
		mara.visible = false
	var ellis: Node3D = _npcs.get("ellis")
	if ellis:
		ellis.visible = false

func _exit_to_street() -> void:
	if not story.exit_building(_now):
		return
	_save()
	await _fade_out()
	room = "street"
	_set_world(true)
	we.environment = street_env
	player.global_position = RES_DOOR + Vector3(2.5, 0.1, 0)
	player.snap_camera(-PI / 2)
	player.frozen = true
	_location_text()
	_cine_t = 0.0
	_cine_cam.current = true
	_title_card.text = "M1 · THE FRACTURE"
	_title_card.modulate.a = 0.0
	await _fade_in()

## the street breaks: the sky splits, the light goes, tears open in the asphalt
func _set_fracture(on: bool) -> void:
	if not fracture_env:
		fracture_env = street_env.duplicate(true)
		var sky_mat := ProceduralSkyMaterial.new()
		sky_mat.sky_top_color = Color(0.04, 0.02, 0.1)
		sky_mat.sky_horizon_color = Color(0.45, 0.12, 0.42)
		sky_mat.ground_horizon_color = Color(0.25, 0.08, 0.2)
		sky_mat.ground_bottom_color = Color(0.03, 0.02, 0.04)
		var sky := Sky.new()
		sky.sky_material = sky_mat
		fracture_env.sky = sky
		fracture_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		fracture_env.ambient_light_color = Color(0.5, 0.35, 0.7)
		fracture_env.ambient_light_energy = 0.4
		fracture_env.fog_enabled = true
		fracture_env.fog_light_color = Color(0.35, 0.15, 0.45)
		fracture_env.fog_density = 0.012
		fracture_env.glow_enabled = true
		fracture_env.glow_intensity = 1.0
		fracture_env.glow_bloom = 0.1
		_build_fracture()
	we.environment = fracture_env if on else street_env
	if sun:
		sun.light_color = Color(0.55, 0.4, 1.0) if on else Color(1.0, 0.78, 0.55)
		sun.light_energy = 0.6 if on else 2.6
	for n in _fracture_nodes:
		(n as Node3D).visible = on

func _build_fracture() -> void:
	world = street_root
	# the crack across the sky: a jagged glowing seam with branches
	var seam := StandardMaterial3D.new()
	seam.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	seam.albedo_color = Color(0.85, 0.6, 1.0)
	seam.emission_enabled = true
	seam.emission = Color(0.8, 0.5, 1.0)
	seam.emission_energy_multiplier = 8.0
	var crack := Node3D.new()
	crack.position = Vector3(0, 220, -520)
	street_root.add_child(crack)
	_fracture_nodes.append(crack)
	var p := Vector2(-320, 60)
	var r := RandomNumberGenerator.new()
	r.seed = 9
	for k in 26:
		var q := p + Vector2(r.randf_range(18, 34), r.randf_range(-22, 22))
		var seg := MeshInstance3D.new()
		var bm := BoxMesh.new()
		var d := q - p
		bm.size = Vector3(d.length() + 2.0, r.randf_range(1.5, 4.5), 1.0)
		seg.mesh = bm
		seg.position = Vector3((p.x + q.x) * 0.5, (p.y + q.y) * 0.5, 0)
		seg.rotation.z = atan2(d.y, d.x)
		seg.material_override = seam
		crack.add_child(seg)
		if k % 4 == 1:
			var b := MeshInstance3D.new()
			var bb := BoxMesh.new()
			bb.size = Vector3(r.randf_range(30, 60), 1.2, 1.0)
			b.mesh = bb
			b.position = seg.position + Vector3(0, r.randf_range(-20, 20), 0)
			b.rotation.z = r.randf_range(-1.2, 1.2)
			b.material_override = seam
			crack.add_child(b)
		p = q
	var glow := OmniLight3D.new()
	glow.light_color = Color(0.7, 0.4, 1.0)
	glow.omni_range = 400.0
	glow.light_energy = 0.6
	glow.position = Vector3(0, 0, 60)
	crack.add_child(glow)
	# tears in the street: tall violet slits with light, debris lifting round them
	var tear_sh := Shader.new()
	tear_sh.code = """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never;
void fragment() {
	// a seam of light: white-hot at the core, violet at the edges, flickering along its length
	float x = abs(UV.x - 0.5) * 2.0;
	float core = pow(1.0 - x, 6.0);
	float edge = pow(1.0 - x, 1.6);
	float f = 0.85 + 0.15 * sin(TIME * 23.0 + UV.y * 3.0);
	float ends = smoothstep(0.0, 0.2, UV.y) * smoothstep(1.0, 0.75, UV.y);
	ALBEDO = (vec3(1.0, 0.9, 1.0) * core * 0.8 + vec3(0.5, 0.2, 1.0) * edge * 0.3) * f * ends;
}
"""
	var tear_mat := ShaderMaterial.new()
	tear_mat.shader = tear_sh
	for at: Vector3 in [Vector3(-3, 0, -38), Vector3(5, 0, -10), Vector3(-6, 0, 18), Vector3(4, 0, 30)]:
		var t := Node3D.new()
		t.position = at
		street_root.add_child(t)
		_fracture_nodes.append(t)
		for k in 4:
			var sl := MeshInstance3D.new()
			var pm := QuadMesh.new()
			pm.size = Vector2(0.7 - k * 0.12, 5.0 + k * 1.1)
			sl.mesh = pm
			sl.position = Vector3(0, (5.0 + k * 1.1) * 0.5, 0)
			sl.rotation = Vector3(0, k * PI / 4, 0.06 * (k - 1.5))
			sl.material_override = tear_mat
			sl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			t.add_child(sl)
		t.add_child(_sparks(Color(0.75, 0.5, 1.0), 40, 2.5))
		var tl := OmniLight3D.new()
		tl.light_color = Color(0.7, 0.4, 1.0)
		tl.omni_range = 12.0
		tl.light_energy = 3.0
		tl.position.y = 2.0
		t.add_child(tl)
		for k in 8:
			var chunk := MeshInstance3D.new()
			var cb := BoxMesh.new()
			cb.size = Vector3(r.randf_range(0.2, 0.7), r.randf_range(0.1, 0.3), r.randf_range(0.2, 0.7))
			chunk.mesh = cb
			chunk.material_override = Materials.pbr("asphalt_02", Color(0.6, 0.6, 0.62), 1.0)
			chunk.position = Vector3(r.randf_range(-2.5, 2.5), r.randf_range(0.5, 6.0), r.randf_range(-2.5, 2.5))
			chunk.rotation = Vector3(r.randf() * 3, r.randf() * 3, r.randf() * 3)
			chunk.set_meta("spin", r.randf_range(0.3, 1.2))
			t.add_child(chunk)
	# small fires and smoke-lit cars: orange lights low on the street
	for at2: Vector3 in [Vector3(7, 0.5, -24), Vector3(-8, 0.5, 6), Vector3(8, 0.5, 22)]:
		var f := OmniLight3D.new()
		f.light_color = Color(1.0, 0.45, 0.15)
		f.light_energy = 2.5
		f.omni_range = 9.0
		f.position = at2
		street_root.add_child(f)
		_fracture_nodes.append(f)
		var fire := _fire()
		fire.position = at2 - Vector3(0, 0.45, 0)
		street_root.add_child(fire)
		_fracture_nodes.append(fire)

## rising glowing motes
func _sparks(c: Color, n: int, spread: float) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = n
	p.lifetime = 2.2
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(spread * 0.4, 0.2, spread * 0.4)
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 25.0
	pm.initial_velocity_min = 0.6
	pm.initial_velocity_max = 2.0
	pm.gravity = Vector3(0, 0.4, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.3
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.06, 0.06)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_color = c * 0.6
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	q.material = m
	p.draw_pass_1 = q
	return p

## a car fire: flame particles over a hot core, and dark smoke above
func _fire() -> Node3D:
	var root := Node3D.new()
	var flame := GPUParticles3D.new()
	flame.amount = 60
	flame.lifetime = 0.9
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = 0.5
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 15.0
	pm.initial_velocity_min = 1.2
	pm.initial_velocity_max = 2.4
	pm.gravity = Vector3(0, 1.5, 0)
	pm.scale_min = 0.6
	pm.scale_max = 1.4
	var curve := CurveTexture.new()
	var cv := Curve.new()
	cv.add_point(Vector2(0, 0.4))
	cv.add_point(Vector2(0.3, 1.0))
	cv.add_point(Vector2(1, 0.0))
	curve.curve = cv
	pm.scale_curve = curve
	var grad := Gradient.new()
	grad.set_color(0, Color(1.0, 0.9, 0.5, 1.0))
	grad.set_color(1, Color(1.0, 0.25, 0.05, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	flame.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.55, 0.7)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var img := Image.create(32, 32, false, Image.FORMAT_RGBA8)
	for y in 32:
		for x in 32:
			var d := Vector2(x - 15.5, (y - 15.5) * 0.8).length() / 16.0
			img.set_pixel(x, y, Color(1, 1, 1, clampf(1.0 - d, 0.0, 1.0) ** 1.5))
	m.albedo_texture = ImageTexture.create_from_image(img)
	q.material = m
	flame.draw_pass_1 = q
	root.add_child(flame)
	var smoke := GPUParticles3D.new()
	smoke.amount = 24
	smoke.lifetime = 4.0
	var sp := pm.duplicate() as ParticleProcessMaterial
	sp.initial_velocity_min = 0.8
	sp.initial_velocity_max = 1.4
	sp.gravity = Vector3(0.3, 0.5, 0)
	var sg := Gradient.new()
	sg.set_color(0, Color(0.15, 0.12, 0.16, 0.6))
	sg.set_color(1, Color(0.1, 0.08, 0.12, 0.0))
	var st := GradientTexture1D.new()
	st.gradient = sg
	sp.color_ramp = st
	sp.scale_min = 2.0
	sp.scale_max = 3.5
	smoke.process_material = sp
	smoke.position.y = 1.0
	var sq := QuadMesh.new()
	sq.size = Vector2(1.0, 1.0)
	var smm := m.duplicate() as StandardMaterial3D
	smm.blend_mode = BaseMaterial3D.BLEND_MODE_MIX
	sq.material = smm
	smoke.draw_pass_1 = sq
	root.add_child(smoke)
	return root

# --------------------------------------------------------------------------------------------- the fight
func _spawn_wave() -> void:
	var w := story.wave()
	var count: int = w[0]
	var elites: int = w[1]
	var yaw: float = player.yaw_pivot.rotation.y
	for k in count + elites:
		var e := Echo.new()
		e.setup(k >= count, player)
		var a := yaw + (k - (count + elites - 1) * 0.5) * 0.45
		var dist := 12.0 + (3.0 if k >= count else 0.0)
		var at := player.global_position + Vector3(-sin(a), 0, -cos(a)) * dist
		at.x = clampf(at.x, BOUNDS.position.x + 1.5, BOUNDS.end.x - 1.5)
		at.z = clampf(at.z, BOUNDS.position.y + 2.0, BOUNDS.end.y - 2.0)
		e.position = at
		e.died.connect(_on_echo_died)
		street_root.add_child(e)
		_echoes.append(e)

func _on_echo_died(e: Node3D) -> void:
	_echoes.erase(e)
	_burst(e.global_position + Vector3(0, 1.0, 0), Color(0.7, 0.4, 1.0), 14)
	if (e as Object).get("elite"):
		_story_event("anchor_down")
	elif _echoes.is_empty():
		_story_event("wave_clear")

func _on_hurt(_h: float) -> void:
	if story.phase == "DAZED":
		_story_event("threat")

func _story_event(ev: String) -> void:
	var before := story.phase
	var lines := story.event(ev, _now)
	_say(lines)
	if story.phase != before:
		_on_phase()

func _on_phase() -> void:
	player.set_powers(story.powers())
	player.hp_floor = Story.HP_FLOOR if story.phase in ["DAZED", "SURGE", "ANCHOR"] else 0.0
	if story.phase in ["DAZED", "SURGE", "ANCHOR"]:
		if story.phase == "SURGE":
			_burst(player.global_position + Vector3(0, 1.0, 0), Color(0.3, 0.85, 1.0), 24)
		if story.phase != "DAZED" or _echoes.is_empty():
			_spawn_wave.call_deferred()
	if story.phase == "DONE":
		_mission_complete()
	_save()
	_update_hud()

func _mission_complete() -> void:
	if _complete_shown:
		return
	_complete_shown = true
	var rw := story.reward()
	profile.xp = int(profile.xp) + int(rw.xp)
	profile.nex = int(profile.nex) + int(rw.nex)
	while int(profile.xp) >= int(profile.level) * 1000:
		profile.level = int(profile.level) + 1
	_save_profile()
	(_complete.get_child(0).get_child(1) as Label).text = "+%d XP    +%d Nex%s" % [rw.xp, rw.nex, "\nMara got out with you." if story.rescued else ""]
	_complete.visible = true
	_release_mouse()
	finished.emit()

# --------------------------------------------------------------------------------------------- effects
func _on_fired(from: Vector3, to: Vector3, hit: Object) -> void:
	var tr := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.012
	cm.bottom_radius = 0.012
	cm.height = from.distance_to(to)
	cm.radial_segments = 4
	tr.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.85, 0.5)
	m.emission_enabled = true
	m.emission = Color(1.0, 0.8, 0.4)
	m.emission_energy_multiplier = 6.0
	tr.material_override = m
	street_root.add_child(tr) if room == "street" else int_root.add_child(tr)
	tr.global_position = (from + to) * 0.5
	tr.look_at(to, Vector3.UP if absf((to - from).normalized().y) < 0.99 else Vector3.RIGHT)
	tr.rotate_object_local(Vector3.RIGHT, PI / 2)
	get_tree().create_timer(0.05).timeout.connect(tr.queue_free)
	_burst(to, Color(1.0, 0.75, 0.4) if not (hit and hit.has_method("take_damage")) else Color(0.7, 0.4, 1.0), 4)

func _burst(at: Vector3, c: Color, n: int) -> void:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 6.0
	var parent: Node3D = street_root if room == "street" else int_root
	for k in n:
		var s := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = Vector3.ONE * randf_range(0.04, 0.1)
		s.mesh = b
		s.material_override = m
		parent.add_child(s)
		s.global_position = at
		var tw := s.create_tween()
		tw.tween_property(s, "global_position", at + Vector3(randf_range(-1, 1), randf_range(-0.2, 1.4), randf_range(-1, 1)) * 0.9, 0.35)
		tw.parallel().tween_property(s, "scale", Vector3.ZERO, 0.35)
		tw.tween_callback(s.queue_free)

func _on_blast(at: Vector3, radius: float) -> void:
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.8
	tm.outer_radius = 1.0
	tm.rings = 40
	ring.mesh = tm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.4, 0.9, 1.0, 0.8)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.emission_enabled = true
	m.emission = Color(0.3, 0.85, 1.0)
	m.emission_energy_multiplier = 6.0
	ring.material_override = m
	street_root.add_child(ring)
	ring.global_position = at - Vector3(0, 0.8, 0)
	var fl := OmniLight3D.new()
	fl.light_color = Color(0.4, 0.9, 1.0)
	fl.omni_range = radius * 2.0
	fl.light_energy = 8.0
	street_root.add_child(fl)
	fl.global_position = at
	var tw := ring.create_tween()
	tw.tween_property(ring, "scale", Vector3.ONE * radius, 0.35)
	tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.45)
	tw.parallel().tween_property(fl, "light_energy", 0.0, 0.45)
	tw.tween_callback(ring.queue_free)
	tw.tween_callback(fl.queue_free)
	_burst(at, Color(0.4, 0.9, 1.0), 20)

# --------------------------------------------------------------------------------------------- the frame loop
func _process(delta: float) -> void:
	_now += delta
	# subtitles
	if _line_t > 0.0:
		_line_t -= delta
		if _line_t <= 0.0:
			_next_line()
	# alarm strobes
	if story.phase != "MORNING":
		var pulse := 0.5 + 0.5 * sin(_now * 6.0)
		for l in _alarm_lights:
			if is_instance_valid(l):
				var o := l as OmniLight3D
				if o.get_parent() == street_root:
					o.light_energy = 3.0 * pulse if o.light_color.r > 0.5 else 3.0 * (1.0 - pulse)
				elif story.phase == "ALARM":
					o.light_energy = 0.8 + 1.8 * pulse
	# the rising debris round the tears
	for n in _fracture_nodes:
		if n is Node3D and (n as Node3D).visible:
			for c in (n as Node3D).get_children():
				if c.has_meta("spin"):
					var s: float = c.get_meta("spin")
					(c as Node3D).rotation += Vector3(s, s * 0.7, 0) * delta
					(c as Node3D).position.y = fmod((c as Node3D).position.y + delta * s * 0.4, 7.0)
	# the cinematic
	if _cine_t >= 0.0:
		_cinematic(delta)
	elif story.phase in ["DAZED", "SURGE", "ANCHOR", "CLEAR"]:
		_story_event("tick")
		if story.phase == "DAZED" and _echoes.size() > 0 and (_echoes[0] as Node3D).global_position.distance_to(player.global_position) < 2.2:
			_story_event("threat")
	_read_input()
	_find_focus()
	_update_hud()

func _cinematic(delta: float) -> void:
	_cine_t += delta
	var t := _cine_t
	# 0-3 s: out of the doors, the camera rises from the canopy looking up the avenue at the morning
	# 3 s: the sky splits; 3-8 s: the light dies to violet, tears open, the title
	var from := RES_DOOR + Vector3(5.0, 2.0, 6.0)
	var to := Vector3(2.0, 18.0, 24.0)
	var k := smoothstep(0.0, 8.0, t)
	_cine_cam.global_position = from.lerp(to, k)
	_cine_cam.look_at(Vector3(0, 6.0 + 30.0 * smoothstep(2.0, 6.0, t), -60.0))
	if t > 3.0 and we.environment != fracture_env:
		_set_fracture(true)
		_flash_white()
	_title_card.modulate.a = smoothstep(4.0, 5.0, t) * (1.0 - smoothstep(7.6, 8.4, t))
	if t > 8.6:
		_cine_t = -1.0
		_title_card.modulate.a = 0.0
		player.frozen = false
		player.cam.current = true
		player.snap_camera(PI)
		_story_event("cine_done")

func _flash_white() -> void:
	_fade.color = Color(1, 1, 1, 0.9)
	var tw := create_tween()
	tw.tween_property(_fade, "color", Color(0, 0, 0, 0), 0.9)

func _find_focus() -> void:
	_focus = {}
	if _busy or _cine_t >= 0.0:
		return
	var best := 999.0
	for it: Dictionary in _interacts:
		if it.room != room:
			continue
		var d := Vector2(player.global_position.x - it.at.x, player.global_position.z - it.at.z).length()
		if d < it.r and d < best and (it.cond as Callable).call():
			best = d
			_focus = it

func _use() -> void:
	if _focus.is_empty() or _busy:
		return
	(_focus.act as Callable).call()

# --------------------------------------------------------------------------------------------- subtitles
func _say(lines: Array) -> void:
	for l in lines:
		_lines.append(l)
	if _line_t <= 0.0:
		_next_line()

func _next_line() -> void:
	if _lines.is_empty():
		_sub_name.text = ""
		_sub_text.text = ""
		_sub_text.get_parent().visible = false
		return
	var l: Array = _lines.pop_front()
	_sub_name.text = String(l[0])
	_sub_name.add_theme_color_override("font_color", { "NOVA": Color(0.4, 0.9, 1.0), "MARA": Color(1.0, 0.7, 0.4), "ELLIS": GOLD, "BUILDING": Color(1.0, 0.35, 0.3), "NEXUS ALERT": Color(1.0, 0.35, 0.3) }.get(String(l[0]), Color(0.85, 0.85, 0.9)))
	_sub_text.text = String(l[1])
	_sub_text.get_parent().visible = true
	_line_t = clampf(String(l[1]).length() * 0.06, 2.6, 6.5)

# --------------------------------------------------------------------------------------------- input
func _read_input() -> void:
	if _complete.visible:
		player.move = Vector2.ZERO
		player.fire_held = false
		return
	var mv := Vector2.ZERO
	if _keys.get(KEY_W, false) or _keys.get(KEY_UP, false): mv.y += 1
	if _keys.get(KEY_S, false) or _keys.get(KEY_DOWN, false): mv.y -= 1
	if _keys.get(KEY_A, false) or _keys.get(KEY_LEFT, false): mv.x -= 1
	if _keys.get(KEY_D, false) or _keys.get(KEY_RIGHT, false): mv.x += 1
	if _joy_id >= 0:
		mv = _joy_vec
	player.move = mv.limit_length(1.0)
	player.run = _keys.get(KEY_SHIFT, false) or _joy_vec.length() > 0.85

func _input(e: InputEvent) -> void:
	if e is InputEventKey:
		var k := e as InputEventKey
		_keys[k.keycode] = k.pressed
		if k.pressed and not k.echo:
			match k.keycode:
				KEY_E: _use()
				KEY_R: player.reload()
				KEY_Q: player.blast()
				KEY_SPACE: player.dash()
				KEY_F: player.melee()
				KEY_ESCAPE: _release_mouse()
	elif e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if touch:
			return
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and not _mouse_captured and not _over_ui(mb.position):
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
				_mouse_captured = true
				return
			player.fire_held = mb.pressed and _mouse_captured
		elif mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
			player.blast()
	elif e is InputEventMouseMotion and _mouse_captured:
		player.look_delta += (e as InputEventMouseMotion).relative
	elif e is InputEventScreenTouch:
		var st := e as InputEventScreenTouch
		var w := get_viewport_rect().size.x
		if st.pressed:
			if _over_ui(st.position):
				return
			if st.position.x < w * 0.45 and _joy_id < 0:
				_joy_id = st.index
				_joy_origin = st.position
				_joy_vec = Vector2.ZERO
			elif _look_id < 0:
				_look_id = st.index
				_look_last = st.position
		else:
			if st.index == _joy_id:
				_joy_id = -1
				_joy_vec = Vector2.ZERO
			elif st.index == _look_id:
				_look_id = -1
	elif e is InputEventScreenDrag:
		var sd := e as InputEventScreenDrag
		if sd.index == _joy_id:
			var d := (sd.position - _joy_origin) / 90.0
			_joy_vec = Vector2(d.x, -d.y).limit_length(1.0)
		elif sd.index == _look_id:
			player.look_delta += (sd.position - _look_last) * 1.4
			_look_last = sd.position

func _over_ui(p: Vector2) -> bool:
	for b: Control in _btns:
		if b.visible and b.get_global_rect().has_point(p):
			return true
	return _complete.visible and _complete.get_global_rect().has_point(p)

func _release_mouse() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_mouse_captured = false
	player.fire_held = false

# --------------------------------------------------------------------------------------------- HUD
func _hud_label(t: String, size: int, c: Color, parent: Control) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", c)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 2)
	parent.add_child(l)
	return l

func _panel_box(c: Color, border: Color, r := 8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = c
	sb.border_color = border
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(r)
	sb.content_margin_left = 14
	sb.content_margin_right = 14
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	return sb

## anchor a control and place it by offsets from that anchor (position alone is lost to the anchor on resize)
static func _place(c: Control, preset: int, left: float, top: float, w: float, h: float) -> void:
	c.set_anchors_preset(preset)
	c.offset_left = left
	c.offset_top = top
	c.offset_right = left + w
	c.offset_bottom = top + h

func _build_hud() -> void:
	hud = Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud)
	# objective tracker, top left
	var ob := PanelContainer.new()
	ob.add_theme_stylebox_override("panel", _panel_box(Color(0.02, 0.03, 0.06, 0.55), Color(1, 1, 1, 0.06)))
	ob.position = Vector2(24, 64)
	ob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(ob)
	_obj_box = VBoxContainer.new()
	_obj_box.add_theme_constant_override("separation", 6)
	ob.add_child(_obj_box)
	# compass, top centre
	_compass = _hud_label("", 18, Color(0.92, 0.95, 1.0), hud)
	_compass.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_compass.offset_top = 10
	_compass.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# level and XP, top right
	_xp = _hud_label("", 16, Color(0.9, 0.95, 1.0), hud)
	_xp.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_xp.offset_top = 18
	_xp.offset_right = -24
	_xp.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	# minimap and location, bottom left
	_mini = Control.new()
	_place(_mini, Control.PRESET_BOTTOM_LEFT, 24, -210, 170, 170)
	_mini.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mini.draw.connect(_draw_minimap)
	hud.add_child(_mini)
	_location = _hud_label("", 15, Color(0.92, 0.95, 1.0), hud)
	_place(_location, Control.PRESET_BOTTOM_LEFT, 30, -34, 360, 24)
	# ammo and abilities, bottom right
	_ammo = _hud_label("", 34, Color(1, 1, 1), hud)
	_place(_ammo, Control.PRESET_BOTTOM_RIGHT, -260, -170 if touch else -110, 230, 44)
	_ammo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_abil = _hud_label("", 15, Color(0.75, 0.9, 1.0), hud)
	_place(_abil, Control.PRESET_BOTTOM_RIGHT, -620, -126 if touch else -62, 590, 24)
	_abil.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	# health, bottom centre
	_hp_bar = ProgressBar.new()
	_hp_bar.show_percentage = false
	_place(_hp_bar, Control.PRESET_CENTER_BOTTOM, -160, -40, 320, 8)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.45)
	bg.set_corner_radius_all(4)
	var fg := StyleBoxFlat.new()
	fg.bg_color = Color(0.35, 0.9, 1.0)
	fg.set_corner_radius_all(4)
	_hp_bar.add_theme_stylebox_override("background", bg)
	_hp_bar.add_theme_stylebox_override("fill", fg)
	_hp_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(_hp_bar)
	# subtitles
	var sub := PanelContainer.new()
	sub.add_theme_stylebox_override("panel", _panel_box(Color(0, 0, 0, 0.5), Color(1, 1, 1, 0.0)))
	_place(sub, Control.PRESET_CENTER_BOTTOM, -380, -160, 760, 0)
	sub.grow_vertical = Control.GROW_DIRECTION_BEGIN
	sub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sub.visible = false
	hud.add_child(sub)
	var sv := VBoxContainer.new()
	sub.add_child(sv)
	_sub_name = _hud_label("", 15, Color(0.4, 0.9, 1.0), sv)
	_sub_text = _hud_label("", 20, Color(1, 1, 1), sv)
	_sub_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_sub_text.custom_minimum_size = Vector2(730, 0)
	# interaction prompt
	_prompt = _hud_label("", 20, Color(1, 1, 1), hud)
	_place(_prompt, Control.PRESET_CENTER, -250, 60, 500, 30)
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# crosshair
	_cross = Control.new()
	_cross.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cross.draw.connect(func() -> void:
		var col := Color(1, 1, 1, 0.85)
		for d: Vector2 in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
			_cross.draw_line(d * 6.0, d * 14.0, col, 2.0)
		_cross.draw_circle(Vector2.ZERO, 1.6, col))
	hud.add_child(_cross)
	# the objective marker
	_marker = _hud_label("◆", 22, Color(1.0, 0.82, 0.3), hud)
	# title card for the cinematic
	_title_card = _hud_label("", 64, Color(1, 1, 1), hud)
	_place(_title_card, Control.PRESET_CENTER, -500, -60, 1000, 90)
	_title_card.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# mission complete
	_complete = PanelContainer.new()
	_complete.add_theme_stylebox_override("panel", _panel_box(Color(0.02, 0.04, 0.08, 0.9), Color(1.0, 0.82, 0.3, 0.6), 12))
	_place(_complete, Control.PRESET_CENTER, -230, -120, 460, 0)
	_complete.visible = false
	hud.add_child(_complete)
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 12)
	_complete.add_child(cv)
	var ct := _hud_label("MISSION COMPLETE\nM1 · THE FRACTURE", 28, Color(1.0, 0.85, 0.4), cv)
	ct.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var cr := _hud_label("", 20, Color(1, 1, 1), cv)
	cr.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	cv.add_child(row)
	var cont := Data.button("FREE ROAM", true)
	cont.custom_minimum_size = Vector2(160, 50)
	cont.pressed.connect(func() -> void: _complete.visible = false)
	row.add_child(cont)
	var home := Data.button("TO THE GLOBE")
	home.custom_minimum_size = Vector2(160, 50)
	home.pressed.connect(func() -> void: _release_mouse(); closed.emit())
	row.add_child(home)
	# fade
	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_fade)
	# buttons: back always; touch gets the action pad
	var back := Data.button("☰")
	back.position = Vector2(16, 12)
	back.custom_minimum_size = Vector2(46, 42)
	back.pressed.connect(func() -> void: _release_mouse(); closed.emit())
	hud.add_child(back)
	_btns.append(back)
	var use := Data.button("USE", true)
	_place(use, Control.PRESET_CENTER, -70, 100, 140, 52)
	use.pressed.connect(_use)
	hud.add_child(use)
	_btns.append(use)
	use.name = "USE"
	if touch:
		var pad := [["FIRE", Vector2(-150, -230), Vector2(110, 110)], ["BLAST", Vector2(-290, -190), Vector2(84, 84)], ["DASH", Vector2(-150, -330), Vector2(84, 70)], ["MELEE", Vector2(-270, -290), Vector2(84, 70)], ["RELOAD", Vector2(-380, -120), Vector2(90, 54)], ["RUN", Vector2(-40, -330), Vector2(0, 0)]]
		for p: Array in pad:
			if p[0] == "RUN":
				continue
			var b := Data.button(p[0], p[0] == "FIRE")
			_place(b, Control.PRESET_BOTTOM_RIGHT, (p[1] as Vector2).x, (p[1] as Vector2).y, (p[2] as Vector2).x, (p[2] as Vector2).y)
			hud.add_child(b)
			_btns.append(b)
			match p[0]:
				"FIRE":
					_fire_btn = b
					b.button_down.connect(func() -> void: player.fire_held = true)
					b.button_up.connect(func() -> void: player.fire_held = false)
				"BLAST": b.pressed.connect(func() -> void: player.blast())
				"DASH": b.pressed.connect(func() -> void: player.dash())
				"MELEE": b.pressed.connect(func() -> void: player.melee())
				"RELOAD": b.pressed.connect(func() -> void: player.reload())
	_location_text()

func _update_hud() -> void:
	if not hud:
		return
	# tracker (rebuilt only when it changes)
	var sig := JSON.stringify(story.tracker())
	if sig != _tracker_sig:
		_tracker_sig = sig
		_rebuild_tracker()
	_update_hud_rest()

var _tracker_sig := ""
func _rebuild_tracker() -> void:
	for c in _obj_box.get_children():
		c.free()
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	_obj_box.add_child(head)
	_hud_label("◈", 18, Color(1.0, 0.82, 0.3), head)
	_hud_label("M1: The Fracture", 19, Color(1.0, 0.82, 0.3), head)
	for t: Dictionary in story.tracker():
		var r := HBoxContainer.new()
		r.add_theme_constant_override("separation", 8)
		_obj_box.add_child(r)
		_hud_label("✓" if t.done else "◇", 16, Color(0.5, 1.0, 0.6) if t.done else Color(1.0, 0.82, 0.3), r)
		var txt: String = t.label + ("   · " + t.hint if t.hint != "" and not t.done else "")
		_hud_label(txt, 16, Color(0.75, 0.78, 0.82) if t.done else Color(0.95, 0.97, 1.0), r)

func _update_hud_rest() -> void:
	# compass
	var deg := fposmod(-rad_to_deg(player.yaw_pivot.rotation.y), 360.0)
	var names := ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
	var near: String = names[int(round(deg / 45.0)) % 8]
	_compass.text = "%s      %s      %s\n%d°" % [names[(int(round(deg / 45.0)) + 7) % 8], near, names[(int(round(deg / 45.0)) + 1) % 8], int(deg)]
	_xp.text = "LV %d     XP %d / %d" % [profile.level, profile.xp, int(profile.level) * 1000]
	# weapon
	var armed: bool = player.powers >= 1
	_ammo.visible = armed
	_cross.visible = armed and room == "street"
	_cross.queue_redraw()
	_ammo.text = ("RELOADING" if player.reloading() else "%d | %d" % [player.ammo, player.reserve])
	var ab := []
	if player.powers >= 2:
		ab.append("Q  RESONANCE BLAST " + ("READY" if player.blast_cd <= 0.0 else "%.0fs" % player.blast_cd))
		ab.append("SPACE  DASH " + ("READY" if player.dash_cd <= 0.0 else "…"))
	if armed and not touch:
		ab.append("LMB fire · F melee · R reload")
	_abil.text = "   ".join(ab)
	_hp_bar.value = player.hp
	_hp_bar.visible = story.phase in ["DAZED", "SURGE", "ANCHOR", "CLEAR"] or player.hp < 100.0
	# prompt
	var use: Control = hud.get_node_or_null("USE")
	if not _focus.is_empty():
		_prompt.text = ("" if touch else "[E]  ") + String(_focus.label)
		if use:
			use.visible = true
	else:
		_prompt.text = "" if _mouse_captured or touch or room != "street" or story.powers() == 0 else "Click to aim"
		if use:
			use.visible = false
	_marker_update()
	_mini.queue_redraw()
	for b: Control in _btns:
		if b != use and b.name != "USE" and b is Button and (b as Button).text != "☰":
			b.visible = armed
	if _fire_btn:
		_fire_btn.visible = armed

const STEP_ROOM := { "dress": "apt", "breakfast": "apt", "phone": "apt", "news": "apt", "neighbour": "lobby", "mail": "lobby" }
## where the objective is, as a point in the current room
func _objective_point() -> Variant:
	var tag := ""
	match story.phase:
		"MORNING":
			var nxt := ""
			for s: Dictionary in Story.MORNING:
				if not story.done.has(s.id):
					nxt = s.id
					break
			var want: String = STEP_ROOM.get(nxt, "apt")
			if want == room:
				tag = nxt
			else:
				tag = { "apt": "to_hall", "hall": "elev_down" if want == "lobby" else "to_apt", "lobby": "elev_up" }.get(room, "")
		"ALARM":
			tag = { "apt": "to_hall", "hall": "stairs", "lounge": "mara" if not story.rescued else "stairs", "lobby": "front" }.get(room, "")
		"DONE":
			return Vector3(0, 0, BOUNDS.position.y + 3.0)
		"SURGE", "ANCHOR", "DAZED":
			if not _echoes.is_empty() and is_instance_valid(_echoes[_echoes.size() - 1]):
				return (_echoes[_echoes.size() - 1] as Node3D).global_position
	for it: Dictionary in _interacts:
		if it.room == room and it.tag == tag:
			return it.at
	return null

func _marker_update() -> void:
	var p: Variant = _objective_point()
	var c: Camera3D = player.cam if _cine_t < 0.0 else _cine_cam
	if p == null or not c or c.is_position_behind((p as Vector3) + Vector3(0, 1.4, 0)) or _cine_t >= 0.0:
		_marker.visible = false
		return
	var at: Vector3 = (p as Vector3) + Vector3(0, 1.6, 0)
	var sp := c.unproject_position(at) * (get_viewport_rect().size / Vector2(_vp3.size))
	var d := player.global_position.distance_to(p as Vector3)
	_marker.visible = true
	_marker.text = "◆\n%dm" % int(d)
	_marker.position = sp - Vector2(14, 20)

func _draw_minimap() -> void:
	var s := _mini.size
	var c := s * 0.5
	var r := s.x * 0.5
	_mini.draw_circle(c, r, Color(0.02, 0.04, 0.07, 0.7))
	_mini.draw_arc(c, r, 0, TAU, 48, Color(0.6, 0.8, 1.0, 0.35), 2.0)
	if room == "street":
		var scale := r / 40.0
		var yaw: float = player.yaw_pivot.rotation.y
		var pp: Vector3 = player.global_position
		var to_map := func(w: Vector3) -> Vector2:
			var v := Vector2(w.x - pp.x, w.z - pp.z).rotated(yaw)
			return c + v * scale
		# the road and sidewalks as a band, the block ends
		var z0 := pp.z - 34.0
		var z1 := pp.z + 34.0
		var corners := [Vector3(-8, 0, z0), Vector3(8, 0, z0), Vector3(8, 0, z1), Vector3(-8, 0, z1)]
		var pts := PackedVector2Array()
		for q: Vector3 in corners:
			pts.append(to_map.call(q))
		_mini.draw_colored_polygon(pts, Color(0.25, 0.3, 0.38, 0.8))
		var p2 := PackedVector2Array()
		for sx: float in [-15.0, 15.0]:
			_mini.draw_line(to_map.call(Vector3(sx, 0, pp.z - 30.0)), to_map.call(Vector3(sx, 0, pp.z + 30.0)), Color(0.5, 0.6, 0.7, 0.6), 1.5)
		for e in _echoes:
			if is_instance_valid(e):
				var mp: Vector2 = to_map.call((e as Node3D).global_position)
				if mp.distance_to(c) < r - 4:
					_mini.draw_circle(mp, 4.0, Color(0.8, 0.3, 1.0))
		var op: Variant = _objective_point()
		if op != null:
			var mo: Vector2 = to_map.call(op as Vector3)
			mo = c + (mo - c).limit_length(r - 8)
			_mini.draw_circle(mo, 5.0, Color(1.0, 0.82, 0.3))
	# the player arrow, always up
	_mini.draw_colored_polygon(PackedVector2Array([c + Vector2(0, -9), c + Vector2(6, 6), c + Vector2(-6, 6)]), Color(0.4, 0.9, 1.0))
	_mini.draw_string(ThemeDB.fallback_font, c + Vector2(-5, -r + 16), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1, 1, 1, 0.8))

# --------------------------------------------------------------------------------------------- shots (testing)
## jump straight to a moment: "apt", "lobby", "hall", "lounge", "street", "cine", "dazed", "surge", "anchor", "done"
func shot(moment: String) -> void:
	match moment:
		"lobby":
			for s: String in ["dress", "breakfast", "phone", "news"]:
				story.mark(s, 0.0)
			_go_room("lobby", LOBBY + Vector3(6.0, 0, 6.0), 0.46, false)
		"hall":
			_go_room("hall", HALL + Vector3(0.5, 0, 9.0), 0.0, false)
		"lounge":
			for s: String in ["dress", "breakfast", "phone", "news", "neighbour", "mail"]:
				story.mark(s, 0.0)
			_alarm_on()
			_go_room("lounge", LOUNGE + Vector3(2.0, 0, 3.0), 1.22, false)
		"apt2":
			_go_room("apt", APT + Vector3(6.5, 0, 3.8), 0.76, false)
		"cine", "dazed", "surge", "anchor", "done":
			for s: String in ["dress", "breakfast", "phone", "news", "neighbour", "mail"]:
				story.mark(s, 0.0)
			_alarm_on()
			if moment == "cine":
				_exit_to_street()
				return
			story.exit_building(0.0)
			_go_street(Vector3(1.0, 0, -6.0), 0.0, false)
			_set_fracture(true)
			story.event("cine_done", _now)
			if moment != "dazed":
				story.event("threat", _now)
			if moment == "anchor" or moment == "done":
				story.event("wave_clear", _now)
			if moment == "done":
				story.event("anchor_down", _now)
				story.event("tick", _now + 20.0)
			_on_phase()
			if moment != "done":
				player.fire_held = moment != "dazed"
