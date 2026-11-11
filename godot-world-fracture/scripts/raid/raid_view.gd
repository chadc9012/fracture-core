extends Control
const Progression := preload("res://scripts/progress/progression.gd")
## Raid 01 · The Hollow Star in Godot (hollow_star.gd holds the rules). You and a fireteam of five bots (enemies.gd team 1)
## against the void army (team 0, the trooper bodies tinted void-violet under raid names), on the shared operator, guns and
## gear stack (scripts/player, scripts/combat, scripts/gear), the same way the Killbox runs.
##
##   The Broken Gate   the Nexus subway gate hall: a cracked ring gate with the rift inside it, three stabilizer pylons
##                     that charge while someone of yours stands in their ring, six waves out of the rift.
##   The Hollow Star   the final chamber 3.8 km down: a round floor over the abyss, Astravore hanging over it — beams,
##                     shockwave rings, guardians; Phase II's three conduits; Phase III's split reality (half the floor
##                     is the wrong reality and burns); Phase IV's exposed core and the floor collapsing inward.
##
## A cleared gate is the checkpoint; DESCEND asks the host for the boss (signal `next`). The first full clear pays the
## Hollow Star Lens into the bag and the Starbreaker title into the profile.

signal closed
signal next(encounter: String)

const HollowStar := preload("res://scripts/raid/hollow_star.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const Materials := preload("res://scripts/city/materials.gd")
const VOID_TINT := Color(0.55, 0.2, 1.0)
const ALLY_TYPES := ["elite", "scout", "marksman", "scout", "elite"]
const ALLY_NAMES := ["Vance", "Iko", "Sable", "Ren", "Tamsin"]
const BOSS_HP_EQUIV := 140.0    # a gun's damage / this = Astravore percent
const ALLY_DPS := 7.0
const ARENA_R := 34.0

var start_at := "broken-gate"
## shots and tests: the operator holds still and the fireteam does the work
var autopilot := false

var raid: HollowStar
var world: Node3D
var cam: Camera3D
var controls: Control
var operator: Node3D
var gunplay: Node3D
var enemies: Node3D
var obstacles: Array[AABB] = []
var allies: Array = []
var spawn_point := Vector3.ZERO
var pylon_pos: Array[Vector3] = []
var pylon_rings: Array = []
var pylon_beams: Array = []
var rift_at := Vector3.ZERO
var _wave_t := 4.0
var _respawn_t := 0.0
var _rng := RandomNumberGenerator.new()
# the boss
var boss_root: Node3D
var boss_core: MeshInstance3D
var boss_mat: ShaderMaterial
var boss_target: Gunplay.Target
var shard_rings: Array = []
var _beam_t := 6.0
var _ring_t := 10.0
var _summon_t := 18.0
var _split_t := 0.0
var _split_side := 1.0
var split_plane: MeshInstance3D
var _beams: Array = []          # [{mesh, t, from, to, fired}]
var _rings: Array = []          # [{mesh, r}]
var safe_r := ARENA_R
var floor_tiles: Array = []
var _last_phase := 0
var _flash := 0.0
# hud
var title: Label
var objective: Label
var bars: Label
var boss_bar_back: ColorRect
var boss_bar: ColorRect
var boss_label: Label
var gauge: Label
var _panel: Control
var _ended := false

func _ready() -> void:
	_rng.seed = 23
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	raid = HollowStar.new(start_at)
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.0, 0.03)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	cam = Camera3D.new()
	cam.fov = 64.0
	cam.near = 0.08
	cam.far = 900.0
	world.add_child(cam)
	cam.current = true
	if start_at == "hollow-star-boss":
		_chamber()
	else:
		_gate_hall()
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	world.add_child(operator)
	operator.bounds = Rect2(-ARENA_R, -ARENA_R, ARENA_R * 2.0, ARENA_R * 2.0) if _boss() else Rect2(-29, -49, 58, 88)
	operator.ground_at = _ground_at
	operator.obstacles = obstacles
	operator.position = spawn_point
	operator.heading = PI
	operator.civilian = false   # the armour is for the fights (streetwear in the city)
	operator.build()
	operator.attach_camera(cam)
	gunplay = Gunplay.new()
	world.add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	gunplay.hit.connect(_on_hit)
	enemies = Enemies.new()
	world.add_child(enemies)
	enemies.setup(operator, gunplay)
	enemies.goal_done.connect(func(line: String): controls.toast(line))
	enemies.operator_team = 1
	enemies.operator_down.connect(_on_operator_down)
	enemies.bot_down.connect(_on_bot_down)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear) + Progression.hull_bonus(Gear.profile_load())   # armour and level
	enemies.hull = enemies.hull_max
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	# the fireteam: five bots, each holding a pylon or a conduit between fights
	for i in ALLY_TYPES.size():
		var at := spawn_point + Vector3(-7.0 + i * 3.5, 0, -4.0 - (i % 2) * 2.0)
		var hold: Vector3 = pylon_pos[i % pylon_pos.size()] if not pylon_pos.is_empty() else at
		var e: RefCounted = enemies.spawn(ALLY_TYPES[i], at, [hold + Vector3(1.5, 0, 0), hold + Vector3(-1.5, 0, 1.0)], 1)
		e.set_meta("name", ALLY_NAMES[i])
		allies.append(e)
	if _boss():
		_build_boss()
	_hud()
	var d := HollowStar.encounter_def(raid.encounter)
	controls.toast("%s · %s" % [String(d.name), String(d.objective)])

func _boss() -> bool:
	return start_at == "hollow-star-boss"

func _ground_at(x: float, z: float) -> float:
	if _boss():
		var r := Vector2(x, z).length()
		if r > safe_r:
			return -60.0
		return 0.0
	return 0.0

# --------------------------------------------------------------------------------------------- the look
func _mat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

func _box(size: Vector3, pos: Vector3, mat: Material, solid := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = mat
	world.add_child(mi)
	if solid:
		obstacles.append(AABB(pos - size * 0.5, size))
	return mi

func _env(bg: Color, ambient: Color, fog: Color, fog_d: float) -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = bg
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = ambient
	env.ambient_light_energy = 1.0
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = fog
	env.fog_density = fog_d
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.05
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)

func _label3d(text: String, pos: Vector3, size: int, col: Color, yaw := 0.0) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.01
	l.modulate = col
	l.shaded = false
	l.outline_size = 0
	l.position = pos
	l.rotation.y = yaw
	world.add_child(l)
	return l

## the swirling violet tear: an additive disc for the rift and the boss's corona
func _void_shader(hot: Color, cold: Color) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never;
uniform vec3 hot : source_color;
uniform vec3 cold : source_color;
uniform float power = 1.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	vec2 c = UV - 0.5;
	float r = clamp(length(c) * 2.0, 0.0, 1.0);
	float a = atan(c.y, c.x);
	float swirl = n(vec2(a * 3.0 + TIME * 0.6 + r * 6.0, r * 5.0 - TIME * 0.8));
	float rim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
	float core = 1.0 - smoothstep(0.0, 0.55, r);
	vec3 col = mix(cold, hot, swirl) * (core * 0.35 + rim * 1.4 + swirl * 0.35 * (1.0 - r));
	ALBEDO = col * power * (1.0 - smoothstep(0.97, 1.0, r));
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("hot", hot)
	m.set_shader_parameter("cold", cold)
	return m

func _quad(size: Vector2, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = size
	mi.mesh = q
	mi.position = pos
	mi.rotation = rot
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)
	return mi

## a stabilizer pylon / conduit: a steel column, a crystal that fills, a ring on the floor, a beam when it's online
func _pylon(at: Vector3, col: Color) -> void:
	var steel := Materials.pbr("metal_plate", Color(0.55, 0.57, 0.62), 1.0, 0.5, 0.8)
	_box(Vector3(1.2, 2.6, 1.2), at + Vector3(0, 1.3, 0), steel, true)
	_box(Vector3(1.8, 0.4, 1.8), at + Vector3(0, 0.2, 0), steel)
	var crystal := MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = Vector3(0.9, 1.6, 0.9)
	crystal.mesh = pm
	crystal.position = at + Vector3(0, 3.5, 0)
	crystal.material_override = _mat(col, 0.2, 0.0, 0.6)
	world.add_child(crystal)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 3.8
	tm.outer_radius = 4.1
	ring.mesh = tm
	ring.scale = Vector3(1, 0.05, 1)
	ring.position = at + Vector3(0, 0.03, 0)
	ring.material_override = _mat(Color(0.35, 0.35, 0.4), 0.5, 0.0, 0.4)
	world.add_child(ring)
	var beam := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.35
	cm.bottom_radius = 0.35
	cm.height = 40.0
	beam.mesh = cm
	beam.position = at + Vector3(0, 22.0, 0)
	beam.material_override = _mat(col, 0.2, 0.0, 4.0)
	beam.visible = false
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(beam)
	var light := OmniLight3D.new()
	light.light_color = col
	light.light_energy = 1.4
	light.omni_range = 9.0
	light.position = at + Vector3(0, 3.5, 0)
	world.add_child(light)
	pylon_pos.append(at)
	pylon_rings.append([ring, crystal])
	pylon_beams.append(beam)

## The Broken Gate: the Nexus subway gate hall, tiled and dark, the ring gate cracked open at the north end
func _gate_hall() -> void:
	_env(Color(0.02, 0.01, 0.04), Color(0.34, 0.32, 0.42), Color(0.22, 0.12, 0.36), 0.005)
	var key := DirectionalLight3D.new()
	key.light_color = Color(0.6, 0.55, 0.85)
	key.light_energy = 0.35
	key.rotation_degrees = Vector3(-60, 30, 0)
	world.add_child(key)
	# floor, platform edges, the trench and rails down both sides
	_box(Vector3(60, 0.2, 100), Vector3(0, -0.1, -5), Materials.pbr("concrete_floor", Color(0.55, 0.55, 0.58), 4.0, 0.8))
	var tiles := Materials.pbr("floor_tiles_06", Color(0.8, 0.84, 0.86), 0.7, 0.4)
	for s: float in [-1.0, 1.0]:
		_box(Vector3(1.0, 0.03, 100), Vector3(s * 24.0, 0.02, -5), _mat(Color(0.95, 0.75, 0.1), 0.6))
		_box(Vector3(5, 0.6, 100), Vector3(s * 27.5, -0.3, -5), _mat(Color(0.05, 0.05, 0.06), 0.9))
		for k in 2:
			_box(Vector3(0.15, 0.15, 100), Vector3(s * (26.5 + k * 2.0), 0.05, -5), _mat(Color(0.5, 0.45, 0.4), 0.4, 0.9))
		# the tiled walls with lit adverts gone dark, the ceiling strip lights
		_box(Vector3(0.6, 22, 100), Vector3(s * 30.3, 11, -5), tiles, true)
	_box(Vector3(60, 0.6, 100), Vector3(0, 22.3, -5), Materials.pbr("brushed_concrete", Color(0.3, 0.3, 0.33), 4.0))
	for z in range(-40, 40, 10):
		_box(Vector3(0.5, 0.12, 6), Vector3(-8, 22.0, z), _mat(Color(0.75, 0.85, 1.0), 0.3, 0.0, 2.5))
		_box(Vector3(0.5, 0.12, 6), Vector3(8, 22.0, z), _mat(Color(0.75, 0.85, 1.0), 0.3, 0.0, 2.5) if z % 20 == 0 else _mat(Color(0.2, 0.2, 0.22), 0.5))
	# pillars: cover, every 12 m in two rows
	var pillar := Materials.pbr("brushed_concrete", Color(0.55, 0.55, 0.58), 1.5, 0.7)
	var cap := Materials.pbr("metal_plate", Color(0.5, 0.52, 0.56), 1.0, 0.4, 0.7)
	var band := _mat(Color(0.3, 0.85, 1.0), 0.3, 0.0, 2.5)
	for z in range(-34, 36, 12):
		for x: float in [-13.0, 13.0]:
			_box(Vector3(2.0, 22, 2.0), Vector3(x, 11, z), pillar, true)
			_box(Vector3(2.6, 0.8, 2.6), Vector3(x, 0.4, z), cap)
			_box(Vector3(2.6, 1.2, 2.6), Vector3(x, 21.4, z), cap)
			_box(Vector3(2.08, 0.12, 2.08), Vector3(x, 3.2, z), band)
	# emergency strips along both walls, red beacons, the hanging line signs
	for sx: float in [-29.9, 29.9]:
		_box(Vector3(0.1, 0.12, 96), Vector3(sx, 2.6, -5), _mat(Color(0.3, 0.85, 1.0), 0.3, 0.0, 2.0))
		_box(Vector3(0.1, 0.08, 96), Vector3(sx, 9.0, -5), _mat(Color(0.75, 0.4, 1.0), 0.3, 0.0, 1.6))
	for z: float in [-20.0, 4.0, 28.0]:
		var bl := OmniLight3D.new()
		bl.light_color = Color(1.0, 0.25, 0.2)
		bl.light_energy = 1.2
		bl.omni_range = 14.0
		bl.position = Vector3(0, 12.0, z)
		world.add_child(bl)
		_box(Vector3(0.6, 0.6, 0.6), Vector3(0, 21.6, z), _mat(Color(1.0, 0.25, 0.2), 0.3, 0.0, 4.0))
	for z: float in [-8.0, 16.0]:
		_box(Vector3(0.08, 4.0, 0.08), Vector3(-4.0, 20.0, z), cap)
		_box(Vector3(0.08, 4.0, 0.08), Vector3(4.0, 20.0, z), cap)
		_box(Vector3(9.0, 1.4, 0.3), Vector3(0, 17.4, z), _mat(Color(0.05, 0.08, 0.12), 0.5))
		_label3d("◀ GATE 0   ·   LINE 1 ▶", Vector3(0, 17.4, z + 0.2), 70, Color(0.95, 0.8, 0.35))
		_label3d("◀ GATE 0   ·   LINE 1 ▶", Vector3(0, 17.4, z - 0.2), 70, Color(0.95, 0.8, 0.35), PI)
	# the wrecked train on the east platform edge, rubble, a toppled barrier
	var hull := Materials.pbr("metal_plate", Color(0.62, 0.64, 0.68), 2.0, 0.45, 0.7)
	_box(Vector3(3.2, 3.6, 18), Vector3(21.0, 1.8, 6.0), hull, true)
	_box(Vector3(3.25, 0.8, 18.05), Vector3(21.0, 2.6, 6.0), _mat(Color(0.1, 0.45, 0.85), 0.4, 0.3))
	for i in 5:
		_box(Vector3(1.4, 0.5, 0.06), Vector3(19.36, 2.4, -1.0 + i * 3.6), _mat(Color(0.9, 0.85, 0.6), 0.3, 0.0, 1.5))
	for r in [[Vector3(-6, 0.6, 8), Vector3(4, 1.2, 1.6)], [Vector3(7, 0.5, -4), Vector3(2.4, 1.0, 2.4)], [Vector3(-18, 0.7, -8), Vector3(3, 1.4, 2)], [Vector3(2, 0.6, 18), Vector3(5, 1.2, 1.2)]]:
		_box(r[1], r[0], Materials.pbr("brushed_concrete", Color(0.45, 0.44, 0.45), 1.0), true)
	_label3d("NEXUS SUBWAY · GATE 0", Vector3(0, 15.0, 39.5), 160, Color(0.75, 0.9, 1.0), PI)
	# the gate: a ring of steel segments with three blown out, the rift inside it
	var ring_c := Vector3(0, 10.5, -46.0)
	var seg_mat := Materials.pbr("metal_plate", Color(0.62, 0.58, 0.7), 1.0, 0.4, 0.6)
	var seg_glow := _mat(Color(0.75, 0.45, 1.0), 0.3, 0.0, 3.0)
	for k in 24:
		if k in [3, 4, 15]:
			continue
		var a := TAU * k / 24.0
		var seg := _box(Vector3(2.8, 1.5, 2.2), ring_c + Vector3(cos(a) * 9.6, sin(a) * 9.6, 0), seg_mat)
		seg.rotation.z = a + PI * 0.5
		var lip := _box(Vector3(2.4, 0.18, 2.3), ring_c + Vector3(cos(a) * 8.75, sin(a) * 8.75, 0), seg_glow)
		lip.rotation.z = a + PI * 0.5
	var rift := _quad(Vector2(18.5, 18.5), ring_c + Vector3(0, 0, 0.4), _void_shader(Color(0.8, 0.35, 1.0), Color(0.15, 0.05, 0.5)))
	rift.rotation.y = 0.0
	var rl := OmniLight3D.new()
	rl.light_color = Color(0.6, 0.25, 1.0)
	rl.light_energy = 3.0
	rl.omni_range = 34.0
	rl.position = ring_c + Vector3(0, -4, 6)
	world.add_child(rl)
	_box(Vector3(60, 24, 1), Vector3(0, 11, -50.5), Materials.pbr("brushed_concrete", Color(0.18, 0.17, 0.2), 4.0), true)
	rift_at = Vector3(0, 0, -42.0)
	# the three stabilizer pylons
	_pylon(Vector3(-15, 0, -16), Color(0.3, 0.85, 1.0))
	_pylon(Vector3(0, 0, -26), Color(0.3, 0.85, 1.0))
	_pylon(Vector3(15, 0, -16), Color(0.3, 0.85, 1.0))
	spawn_point = Vector3(0, 0, 30)

## The Hollow Star: a round floor of stone plates over the abyss, monoliths, the conduits, the star above
func _chamber() -> void:
	_env(Color(0.0, 0.0, 0.02), Color(0.2, 0.18, 0.3), Color(0.06, 0.05, 0.12), 0.006)
	var key := DirectionalLight3D.new()
	key.light_color = Color(1.0, 0.75, 0.5)
	key.light_energy = 0.5
	key.rotation_degrees = Vector3(-70, 10, 0)
	key.shadow_enabled = true
	world.add_child(key)
	# the floor: rings of stone plates, the outer ones will fall in Phase IV
	var stone := Materials.pbr("marble_01", Color(0.32, 0.3, 0.36), 2.0, 0.45)
	var dark := Materials.pbr("brushed_concrete", Color(0.18, 0.17, 0.2), 2.0)
	for ring in 5:
		var r0 := 6.0 + ring * 7.0
		var n := 10 + ring * 6
		for k in n:
			var a := TAU * (k + 0.5) / n
			var t := _box(Vector3(6.6, 1.2, TAU * (r0 + 3.5) / n - 0.25), Vector3(cos(a) * (r0 + 3.5), -0.6, sin(a) * (r0 + 3.5)), stone if (k + ring) % 3 != 0 else dark)
			t.rotation.y = -a
			floor_tiles.append([t, r0 + 3.5])
	var hub := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 6.2
	cm.bottom_radius = 6.2
	cm.height = 1.2
	hub.mesh = cm
	hub.position = Vector3(0, -0.6, 0)
	hub.material_override = Materials.pbr("metal_plate", Color(0.3, 0.28, 0.34), 1.0, 0.4, 0.8)
	world.add_child(hub)
	# glowing seams between the rings
	for ring in 5:
		var t := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 6.0 + ring * 7.0 - 0.08
		tm.outer_radius = 6.0 + ring * 7.0 + 0.08
		t.mesh = tm
		t.scale = Vector3(1, 0.2, 1)
		t.position.y = 0.01
		t.material_override = _mat(Color(0.9, 0.55, 0.2), 0.3, 0.0, 2.5)
		world.add_child(t)
	# monoliths for cover
	var mono := Materials.pbr("brushed_concrete", Color(0.25, 0.23, 0.27), 1.0)
	for k in 6:
		var a := TAU * k / 6.0
		var p := Vector3(cos(a) * 15.0, 2.0, sin(a) * 15.0)
		_box(Vector3(2.2, 4.0, 2.2), p, mono, true)
	# the walls of the shaft far out, ribbed, with the city's lights 3.8 km up as a pale disc
	for k in 28:
		var a := TAU * k / 28.0
		var w := _box(Vector3(10, 120, 3), Vector3(cos(a) * 70.0, 20, sin(a) * 70.0), dark)
		w.rotation.y = -a + PI * 0.5
	var sky := _quad(Vector2(60, 60), Vector3(0, 90, 0), _mat(Color(0.5, 0.45, 0.6), 1.0, 0.0, 0.6), Vector3(PI * 0.5, 0, 0))
	sky.material_override = _mat(Color(0.45, 0.4, 0.6), 1.0, 0.0, 0.5)
	# the split reality: a half-disc of burning red light laid on the floor in Phase III
	split_plane = _quad(Vector2(ARENA_R * 2.0, ARENA_R), Vector3(0, 0.05, ARENA_R * 0.5), _void_red(), Vector3(-PI * 0.5, 0, 0))
	split_plane.visible = false
	# the conduits (Phase II), hidden until then
	for k in 3:
		var a := TAU * k / 3.0 - PI * 0.5
		_pylon(Vector3(cos(a) * 22.0, 0, sin(a) * 22.0), Color(1.0, 0.7, 0.25))
	for i in pylon_pos.size():
		_conduit_visible(i, false)
	spawn_point = Vector3(0, 0, 28)

func _void_red() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1.0, 0.1, 0.2, 0.28)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _conduit_visible(i: int, on: bool) -> void:
	for n in pylon_rings[i]:
		(n as Node3D).visible = on

## Astravore (the web build's AstravoreBody.tsx): a colossal armoured upper body rising out of the abyss at the north
## edge, crowned, its arms lifting when it winds up a beam, a broken halo of plates orbiting behind its shoulders, and the
## Hollow Star caged in its chest — the star is the target. The star's colour follows the phase (violet, amber, cyan, red).
const PHASE_COLOR := [Color("#a463ff"), Color("#ff9a3c"), Color("#4fc3ff"), Color("#ff4a3a")]
var boss_body: Node3D
var arm_l: Node3D
var arm_r: Node3D
var boss_head: Node3D
var halo: Node3D

func _part(parent: Node3D, mesh: Mesh, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.rotation = rot
	mi.material_override = mat
	parent.add_child(mi)
	return mi

func _cyl(top: float, bottom: float, h: float, sides := 12) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = top
	c.bottom_radius = bottom
	c.height = h
	c.radial_segments = sides
	return c

func _bx(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b

func _build_boss() -> void:
	var armor := Materials.pbr("metal_plate", Color(0.36, 0.31, 0.48), 2.0, 0.4, 0.55)
	armor.emission_enabled = true
	armor.emission = Color("#2b1650")
	armor.emission_energy_multiplier = 0.5
	var trim := _mat(Color("#5a4a80"), 0.35, 0.5)
	trim.emission_enabled = true
	trim.emission = Color("#6a3cc0")
	trim.emission_energy_multiplier = 0.9
	var seam := _mat(Color("#c9a8ff"), 0.3, 0.0, 3.0)
	boss_body = Node3D.new()
	boss_body.position = Vector3(0, -9.0, -48.0)
	boss_body.scale = Vector3.ONE * 1.6
	world.add_child(boss_body)
	# torso and waist rising out of the abyss
	_part(boss_body, _cyl(8.5, 11.0, 8.0), Vector3(0, 4, 0), armor)
	_part(boss_body, _cyl(7.6, 8.8, 8.0), Vector3(0, 11.5, 0), trim)
	_part(boss_body, _bx(Vector3(17, 4.6, 8)), Vector3(0, 16, 0), armor)
	for x: float in [-5.2, 5.2]:
		_part(boss_body, _bx(Vector3(0.25, 17, 0.2)), Vector3(x, 9, 5.4), seam, Vector3(0, 0.45 if x > 0.0 else -0.45, 0))
	_part(boss_body, _bx(Vector3(16, 0.3, 0.2)), Vector3(0, 18.4, 4.1), seam)
	_part(boss_body, _bx(Vector3(18, 0.3, 0.2)), Vector3(0, 2.4, 10.6), seam)
	# the arms
	for side: float in [1.0, -1.0]:
		var arm := Node3D.new()
		arm.position = Vector3(side * 8.2, 15.5, 0)
		boss_body.add_child(arm)
		var sph := SphereMesh.new()
		sph.radius = 3.4
		sph.height = 6.8
		_part(arm, sph, Vector3.ZERO, armor)
		_part(arm, _cyl(2.0, 2.8, 11.0, 10), Vector3(side * 1.2, -5.5, 0.8), trim, Vector3(0, 0, side * 0.1))
		_part(arm, _bx(Vector3(4.6, 4.2, 5.2)), Vector3(side * 2.0, -12.5, 1.6), armor)
		for k: float in [-1.4, 0.0, 1.4]:
			var cone := _cyl(0.0, 0.7, 3.2, 6)
			_part(arm, cone, Vector3(side * 2.2 + k * 0.1, -15.3, 1.8 + k), trim, Vector3(0.3 + PI, 0, 0))
		if side > 0.0:
			arm_r = arm
		else:
			arm_l = arm
	# the head and its crown, two pale eyes
	boss_head = Node3D.new()
	boss_head.position = Vector3(0, 21.5, 0.6)
	boss_body.add_child(boss_head)
	var hs := SphereMesh.new()
	hs.radius = 3.2
	hs.height = 6.0
	hs.radial_segments = 10
	hs.rings = 6
	_part(boss_head, hs, Vector3.ZERO, armor)
	for x: float in [-1.1, 1.1]:
		var es := SphereMesh.new()
		es.radius = 0.5
		es.height = 1.0
		_part(boss_head, es, Vector3(x, 0.3, 2.9), _mat(Color("#e8d0ff"), 0.3, 0.0, 5.0))
	for i in 7:
		var a := float(i) / 7.0 * PI - PI * 0.5
		_part(boss_head, _cyl(0.0, 0.7, 4.2 + (i % 2) * 1.6, 5), Vector3(sin(a) * 3.4, 2.6 + cos(a) * 1.6, -0.4), trim, Vector3(0, 0, -a * 0.6))
	# the broken halo of plates behind the shoulders
	halo = Node3D.new()
	halo.position = Vector3(0, 17, -3)
	boss_body.add_child(halo)
	for i in 10:
		var a := float(i) / 10.0 * TAU
		_part(halo, _bx(Vector3(1.2, 4.0 + (i % 3), 3.0)), Vector3(cos(a) * 14.0, sin(a * 2.0) * 2.0, sin(a) * 14.0), trim, Vector3(a, a * 0.5, 0.4))
	# the star in the chest cage
	boss_root = Node3D.new()
	boss_root.position = Vector3(0, 11.5, 6.4)
	boss_body.add_child(boss_root)
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode specular_schlick_ggx;
uniform vec3 rim : source_color = vec3(0.64, 0.39, 1.0);
uniform float exposed = 0.0;
uniform float flash = 0.0;
varying vec3 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	float fres = pow(clamp(1.0 - abs(dot(normalize(NORMAL), VIEW)), 0.0, 1.0), 2.0);
	float bands = 0.5 + 0.5 * sin(lp.y * 9.0 + TIME * 2.0 + sin(lp.x * 4.0 + TIME) * 2.0);
	ALBEDO = vec3(0.03, 0.02, 0.06);
	ROUGHNESS = 0.2;
	EMISSION = rim * (fres * 3.0 + bands * 0.9) + vec3(0.62, 0.99, 1.0) * exposed * (2.0 + bands * 2.0) + vec3(1.0) * flash * 2.0;
}
"""
	boss_mat = ShaderMaterial.new()
	boss_mat.shader = sh
	boss_core = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 3.0
	sm.height = 6.0
	boss_core.mesh = sm
	boss_core.material_override = boss_mat
	boss_root.add_child(boss_core)
	var ring_a := MeshInstance3D.new()
	var ta := TorusMesh.new()
	ta.inner_radius = 4.3
	ta.outer_radius = 4.9
	ring_a.mesh = ta
	ring_a.rotation.x = PI * 0.5
	ring_a.material_override = _mat(Color("#c9a8ff"), 0.3, 0.0, 3.0)
	boss_root.add_child(ring_a)
	var ring_b := MeshInstance3D.new()
	var tb := TorusMesh.new()
	tb.inner_radius = 5.4
	tb.outer_radius = 5.8
	ring_b.mesh = tb
	ring_b.material_override = _mat(Color("#7ee8ff"), 0.3, 0.0, 3.0)
	boss_root.add_child(ring_b)
	shard_rings = [ring_a, ring_b]
	var l := OmniLight3D.new()
	l.light_color = Color("#a463ff")
	l.light_energy = 5.0
	l.omni_range = 70.0
	l.position = Vector3(0, 0, 3)
	boss_root.add_child(l)
	boss_root.set_meta("light", l)
	var el := OmniLight3D.new()
	el.light_color = Color("#c9a8ff")
	el.light_energy = 1.5
	el.omni_range = 30.0
	el.position = Vector3(0, 0, 4)
	boss_head.add_child(el)
	boss_target = Gunplay.Target.new(AABB(Vector3.ZERO, Vector3.ONE), 1e9, boss_core)
	gunplay.targets.append(boss_target)

func _star() -> Vector3:
	return boss_root.global_position

# --------------------------------------------------------------------------------------------- the hud
func _hud() -> void:
	var top := VBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_CENTER_TOP)
	top.position = Vector2(-260, 14)
	top.custom_minimum_size = Vector2(520, 0)
	add_child(top)
	title = _hud_label(14, Color(0.85, 0.7, 1.0))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_child(title)
	objective = _hud_label(18, Color(0.95, 0.95, 1.0))
	objective.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_child(objective)
	if _boss():
		boss_label = _hud_label(15, Color(1.0, 0.75, 0.45))
		boss_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		top.add_child(boss_label)
		var holder := Control.new()
		holder.custom_minimum_size = Vector2(520, 12)
		top.add_child(holder)
		boss_bar_back = ColorRect.new()
		boss_bar_back.color = Color(0.1, 0.05, 0.12, 0.85)
		boss_bar_back.size = Vector2(520, 10)
		holder.add_child(boss_bar_back)
		boss_bar = ColorRect.new()
		boss_bar.color = Color(1.0, 0.55, 0.25)
		boss_bar.size = Vector2(520, 10)
		holder.add_child(boss_bar)
	gauge = _hud_label(16, Color(1.0, 0.5, 0.45))
	gauge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_child(gauge)
	bars = _hud_label(15, Color(0.75, 0.92, 1.0))
	bars.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	bars.position = Vector2(-250, 70)
	add_child(bars)
	var back := Button.new()
	back.text = "← LEAVE RAID"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)

func _hud_label(size: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 1)
	return l

# --------------------------------------------------------------------------------------------- the fight
func _hostiles_alive() -> int:
	var n := 0
	for e in enemies.enemies:
		if e.team == 0 and e.target.alive() and not e.has_meta("gone"):
			n += 1
	return n

func _spawn_void(name: String, at: Vector3) -> void:
	var type: String = HollowStar.VOID.get(name, "scout")
	var e: RefCounted = enemies.spawn(type, at, [at, Vector3(0, 0, 0)], -1)
	e.team = 0
	if e.mover.rig:
		enemies._tint(e, VOID_TINT)
	e.state = Enemies.State.ENGAGE
	e.set_meta("name", name)

func _on_bot_down(e: RefCounted, _by_team: int, _by_player: bool) -> void:
	if e.team == 0:
		# the void doesn't come back (and gunplay mustn't stand its target up again)
		e.timer = INF
		e.set_meta("gone", true)
		gunplay.targets.erase(e.target)

func _on_operator_down() -> void:
	_respawn_t = 5.0
	if raid.lose_life():
		_wiped("The fireteam is out of lives")
	else:
		controls.toast("You're down · %d lives left" % raid.lives)

func _wiped(why: String) -> void:
	controls.toast("WIPE — %s. Back to the start of the encounter." % why)
	for e in enemies.enemies:
		if e.team == 0:
			e.target.hp = 0.0
			e.timer = INF
			e.set_meta("gone", true)
			e.mover.visible = false
			gunplay.targets.erase(e.target)
	operator.position = spawn_point
	enemies.hull = enemies.hull_max
	enemies.down = 0.0
	_wave_t = 5.0
	for b in _beams:
		(b.mesh as MeshInstance3D).queue_free()
		if b.beam != null:
			(b.beam as MeshInstance3D).queue_free()
	for r in _rings:
		(r.mesh as MeshInstance3D).queue_free()
	_beams.clear()
	_rings.clear()
	safe_r = ARENA_R
	for t in floor_tiles:
		(t[0] as MeshInstance3D).visible = true
	if split_plane:
		split_plane.visible = false
	for i in pylon_pos.size():
		if _boss():
			_conduit_visible(i, false)
		pylon_beams[i].visible = false
	_last_phase = 0

func _on_hit(t: Gunplay.Target, damage: float, _head: bool) -> void:
	if t == boss_target:
		var dealt := raid.hit_boss(damage / BOSS_HP_EQUIV)
		_flash = 0.6 if dealt > 0.0 else _flash
		boss_target.hp = 1e9

func _friendly_near(p: Vector3, r: float) -> bool:
	if enemies.down <= 0.0 and Vector2(operator.position.x - p.x, operator.position.z - p.z).length() < r:
		return true
	for a in allies:
		if a.target.alive() and Vector2(a.mover.position.x - p.x, a.mover.position.z - p.z).length() < r:
			return true
	return false

func _hostile_near(p: Vector3, r: float) -> bool:
	for e in enemies.enemies:
		if e.team == 0 and e.target.alive() and Vector2(e.mover.position.x - p.x, e.mover.position.z - p.z).length() < r:
			return true
	return false

func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	enemies.step(dt)
	if autopilot:
		# shots and tests: the operator can't go down
		enemies.hull = enemies.hull_max
		enemies.down = 0.0
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down, enemies.shield_frac())
	if _respawn_t > 0.0:
		_respawn_t -= dt
		if _respawn_t <= 0.0:
			operator.position = spawn_point
			operator.velocity = Vector3.ZERO
	# the fall into the abyss
	if operator.position.y < -8.0 and enemies.down <= 0.0:
		enemies.hull = 0.0
		enemies.down = 5.0
		enemies.deaths += 1
		_on_operator_down()
	for e in enemies.enemies:
		if e.state == Enemies.State.PATROL and e.team == 0:
			e.state = Enemies.State.ENGAGE
		if e.state != Enemies.State.DOWN and e.mover.position.y < -8.0:
			e.target.hp = 0.0
	if not _ended:
		var mv: Vector2 = controls.move
		if autopilot:
			mv = Vector2.ZERO
		operator.step(dt, mv, controls.take_look(), controls.take_jump(), controls.sprint)
		if controls.take_next():
			gunplay.next_weapon()
		gunplay.step(dt, cam, controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name()
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text())
	if _boss():
		_step_boss(dt)
	else:
		_step_gate(dt)

## three of the fireteam hold the pylons (the gate) or the conduits (Phase II) and fight from there; the other two roam
func _hold_posts(dt: float) -> void:
	var posts := not _boss() or (raid.phase == 1 and raid.shielded)
	for i in mini(3, allies.size()):
		var a: RefCounted = allies[i]
		if not posts or not a.target.alive() or pylon_pos.is_empty():
			if a.has_meta("posted"):
				a.remove_meta("posted")
			a.set_meta("going", 0.0)
			continue
		var post: Vector3 = pylon_pos[i] + Vector3(1.3, 0, 0.9)
		var off: Vector3 = a.mover.position - post
		off.y = 0.0
		if off.length() <= 2.0:
			a.set_meta("posted", true)
		elif a.has_meta("posted"):
			# once there it never strays more than 2.4 m from its post
			var keep := off.normalized() * 2.0
			a.mover.position = Vector3(post.x + keep.x, a.mover.position.y, post.z + keep.z)
		else:
			# on the way: a pillar or a wreck can hold it up, so after a few seconds it is simply there
			var going: float = float(a.get_meta("going", 0.0)) + dt
			a.set_meta("going", going)
			var back := off.normalized() * (2.0 if going > 5.0 else maxf(2.0, off.length() - 9.0 * dt))
			a.mover.position = Vector3(post.x + back.x, a.mover.position.y, post.z + back.z)

func _step_gate(dt: float) -> void:
	raid.tick(dt)
	_hold_posts(dt)
	for i in 3:
		raid.tick_pylon(i, dt, _friendly_near(pylon_pos[i], 4.0), _hostile_near(pylon_pos[i], 4.0))
		var p: float = raid.pylons[i]
		var ring: MeshInstance3D = pylon_rings[i][0]
		var m := ring.material_override as StandardMaterial3D
		m.albedo_color = Color(0.35, 0.35, 0.4).lerp(Color(0.3, 0.9, 1.0), p)
		m.emission = m.albedo_color
		m.emission_energy_multiplier = 0.4 + p * 2.5
		var was: bool = pylon_beams[i].visible
		pylon_beams[i].visible = p >= 1.0
		if p >= 1.0 and not was:
			controls.toast("Pylon %d online" % (i + 1))
	# the waves, out of the rift
	_wave_t -= dt
	if not raid.cleared and (_wave_t <= 0.0 or (_hostiles_alive() <= 1 and _wave_t < 22.0)) and raid.wave < HollowStar.GATE_WAVES.size():
		var w := raid.next_wave()
		for k in w.size():
			_spawn_void(String(w[k]), rift_at + Vector3(-6.0 + k * 2.4, 0, _rng.randf_range(-2.0, 2.0)))
		_wave_t = 30.0
		controls.toast("Wave %d / %d — they're coming through the gate" % [raid.wave, HollowStar.GATE_WAVES.size()])
	var d := HollowStar.encounter_def(raid.encounter)
	title.text = "%s  ·  %s" % [HollowStar.NAME.to_upper(), String(d.room).to_upper()]
	objective.text = String(d.objective)
	var line := ""
	for i in 3:
		line += "PYLON %d  %s %3d%%\n" % [i + 1, _bar(raid.pylons[i]), int(raid.pylons[i] * 100.0)]
	bars.text = line + "WAVE %d / %d   ·   HOSTILES %d\nLIVES  %s" % [raid.wave, HollowStar.GATE_WAVES.size(), _hostiles_alive(), "◆".repeat(raid.lives)]
	gauge.text = ""
	if raid.gate_check(_hostiles_alive()) and not _ended:
		_gate_cleared()

static func _bar(f: float) -> String:
	var n := int(clampf(f, 0.0, 1.0) * 10.0)
	return "▰".repeat(n) + "▱".repeat(10 - n)

func _step_boss(dt: float) -> void:
	var res := raid.tick(dt)
	_hold_posts(dt)
	if res == "wipe":
		_wiped("The machine overloaded" if raid.phase == 0 else "The overload took everyone")
	_flash = maxf(0.0, _flash - dt * 4.0)
	boss_mat.set_shader_parameter("flash", _flash)
	# the colossus sways; the arms lift while a beam winds up; the chest rings spin; the halo turns
	var t := Time.get_ticks_msec() * 0.001
	var tell := 0.0
	for b in _beams:
		if not b.fired:
			tell = maxf(tell, 1.0 - float(b.t) / 1.3)
	boss_body.position.y = -9.0 + sin(t * 0.5) * 0.6
	boss_body.rotation.y = sin(t * 0.21) * 0.08
	arm_r.rotation.x = -tell * 2.2 + sin(t * 0.7) * 0.05
	arm_l.rotation.x = -tell * 1.4 + sin(t * 0.7 + 1.0) * 0.05
	boss_head.rotation.x = -tell * 0.25
	halo.rotation.y = t * 0.15
	(shard_rings[0] as Node3D).rotation.z = t * 0.6
	(shard_rings[1] as Node3D).rotation = Vector3(PI * 0.5 + sin(t * 0.5) * 0.3, 0, -t * 0.9)
	var pc: Color = PHASE_COLOR[raid.phase]
	boss_mat.set_shader_parameter("rim", pc)
	(boss_root.get_meta("light") as OmniLight3D).light_color = pc
	var sp := _star()
	boss_target.box = AABB(sp - Vector3(3.6, 3.6, 3.6), Vector3(7.2, 7.2, 7.2))
	# the fireteam shoots the star when it can
	if not raid.shielded and not raid.cleared:
		for a in allies:
			if a.target.alive() and a.mover.position.distance_to(_star()) < 70.0:
				raid.hit_boss(ALLY_DPS * dt / BOSS_HP_EQUIV)
				if _rng.randf() < dt * 1.5:
					gunplay.tracer(a.mover.position + Vector3(0, 1.4, 0), _star() + Vector3(_rng.randf_range(-2, 2), _rng.randf_range(-2, 2), 0), Color(0.6, 0.85, 1.0))
	# phase changes
	if raid.phase != _last_phase:
		_last_phase = raid.phase
		controls.toast("%s — %s" % [String(HollowStar.PHASES[raid.phase].name), String(HollowStar.PHASES[raid.phase].call)])
		if raid.phase == 1:
			for i in 3:
				_conduit_visible(i, true)
			for k in 3:
				_spawn_void("Void Vanguard", pylon_pos[k] * 0.7)
		if raid.phase == 3:
			boss_mat.set_shader_parameter("exposed", 1.0)
	# Phase II: hold the conduits
	if raid.phase == 1:
		for i in 3:
			raid.tick_conduit(i, dt, _friendly_near(pylon_pos[i], 4.0))
			var c: float = raid.conduits[i]
			var m := (pylon_rings[i][0] as MeshInstance3D).material_override as StandardMaterial3D
			m.albedo_color = Color(0.35, 0.3, 0.3).lerp(Color(1.0, 0.7, 0.25), c)
			m.emission = m.albedo_color
			m.emission_energy_multiplier = 0.4 + c * 2.5
			pylon_beams[i].visible = c >= 1.0
		if not raid.shielded:
			for i in 3:
				_conduit_visible(i, false)
				pylon_beams[i].visible = false
	# Phase III: half the floor is the wrong reality, and it swaps
	split_plane.visible = raid.phase == 2
	if raid.phase == 2:
		_split_t -= dt
		if _split_t <= 0.0:
			_split_t = 8.0
			_split_side = -_split_side
			split_plane.position = Vector3(0, 0.05, ARENA_R * 0.5 * _split_side)
			controls.toast("Reality shifts — get to the %s side" % ("north" if _split_side > 0.0 else "south"))
		if enemies.down <= 0.0 and operator.position.z * _split_side > 0.0:
			enemies._hit_operator(9.0 * dt)
	# Phase IV: the floor falls in from the edge toward the centre
	if raid.phase == 3:
		safe_r = maxf(14.0, ARENA_R - (HollowStar.FINAL_CLOCK - raid.clock) * 0.28)
		for tl in floor_tiles:
			if float(tl[1]) > safe_r:
				var mi: MeshInstance3D = tl[0]
				if mi.visible:
					mi.position.y -= dt * 12.0
					if mi.position.y < -30.0:
						mi.visible = false
	_attacks(dt)
	# hud
	var d := HollowStar.encounter_def(raid.encounter)
	title.text = "%s  ·  %s" % [HollowStar.NAME.to_upper(), String(d.room).to_upper()]
	objective.text = String(HollowStar.PHASES[raid.phase].call)
	boss_label.text = "ASTRAVORE, THE HOLLOW STAR  ·  %s%s" % [String(HollowStar.PHASES[raid.phase].name).to_upper(), "  ·  SHIELDED" if raid.shielded else ""]
	boss_bar.size.x = 520.0 * clampf(raid.boss_hp / 100.0, 0.0, 1.0)
	boss_bar.color = Color(0.55, 0.55, 0.65) if raid.shielded else (Color(1.0, 0.95, 0.75) if raid.phase == 3 else Color(1.0, 0.55, 0.25))
	if raid.phase == 1 and raid.shielded:
		gauge.text = "OVERLOAD  %s  %d%%   ·   CONDUITS %d / 3" % [_bar(raid.overload), int(raid.overload * 100.0), raid.conduits_stable()]
	elif raid.phase == 3:
		gauge.text = "MACHINE OVERLOAD IN  %d s" % int(ceil(raid.clock))
	else:
		gauge.text = ""
	var line := ""
	for a in allies:
		line += "%s  %s\n" % [String(a.get_meta("name")), "▮" if a.target.alive() else "✕ reviving"]
	bars.text = line + "LIVES  %s" % "◆".repeat(raid.lives)
	if raid.cleared and not _ended:
		_raid_cleared()

## the star's attacks: beams at someone, shockwave rings out from under it, guardians
func _attacks(dt: float) -> void:
	if raid.cleared:
		return
	var rate := 1.0 + raid.phase * 0.25
	_beam_t -= dt * rate
	if _beam_t <= 0.0:
		_beam_t = 7.0
		var who: Vector3 = operator.position
		if _rng.randf() < 0.45:
			var live: Array = allies.filter(func(a): return a.target.alive())
			if not live.is_empty():
				who = (live[_rng.randi() % live.size()] as RefCounted).mover.position
		var from := Vector3(_star().x, 0.06, -ARENA_R)
		var dir := Vector3(who.x - from.x, 0, who.z - from.z).normalized()
		var to := from + dir * 60.0
		var line := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(1.6, 0.02, 60.0)
		line.mesh = bm
		line.position = (from + to) * 0.5
		line.rotation.y = atan2(dir.x, dir.z)
		line.material_override = _mat(Color(1.0, 0.2, 0.15), 0.5, 0.0, 2.0)
		world.add_child(line)
		_beams.append({ "mesh": line, "t": 1.3, "from": from, "dir": dir, "fired": false, "beam": null })
	for b in _beams.duplicate():
		b.t -= dt
		if b.t <= 0.0 and not b.fired:
			b.fired = true
			# the beam itself: from the star down onto the line, sweeping its length
			var star := _star()
			var end: Vector3 = (b.from as Vector3) + (b.dir as Vector3) * 60.0
			var beam := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.7
			cm.bottom_radius = 0.7
			cm.height = star.distance_to(end)
			cm.radial_segments = 10
			beam.mesh = cm
			beam.material_override = _mat(PHASE_COLOR[raid.phase].lerp(Color.WHITE, 0.5), 0.3, 0.0, 6.0)
			beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			world.add_child(beam)
			beam.position = (star + end) * 0.5
			beam.look_at(end, Vector3.UP if absf((end - star).normalized().y) < 0.99 else Vector3.FORWARD)
			beam.rotate_object_local(Vector3.RIGHT, PI * 0.5)
			b.beam = beam
			var lm := (b.mesh as MeshInstance3D).material_override as StandardMaterial3D
			lm.albedo_color = Color(1.0, 0.85, 0.6)
			lm.emission = Color(1.0, 0.7, 0.4)
			lm.emission_energy_multiplier = 4.0
			if _in_beam(operator.position, b) and enemies.down <= 0.0:
				enemies._hit_operator(38.0)
			for a in allies:
				if a.target.alive() and _in_beam(a.mover.position, b):
					a.target.hp -= 45.0
		if b.t < -0.35:
			(b.mesh as MeshInstance3D).queue_free()
			if b.get("beam") != null:
				(b.beam as MeshInstance3D).queue_free()
			_beams.erase(b)
	_ring_t -= dt * rate
	if _ring_t <= 0.0:
		_ring_t = 11.0
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.92
		tm.outer_radius = 1.0
		ring.mesh = tm
		ring.position = Vector3(0, 0.4, -ARENA_R + 2.0)
		ring.material_override = _mat(Color(1.0, 0.45, 0.85), 0.4, 0.0, 3.5)
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		world.add_child(ring)
		_rings.append({ "mesh": ring, "r": 1.0, "hit": false })
	for r in _rings.duplicate():
		r.r += 11.0 * dt
		var mi: MeshInstance3D = r.mesh
		mi.scale = Vector3(r.r, 1.2, r.r)
		var c := Vector2(mi.position.x, mi.position.z)
		var dop := Vector2(operator.position.x, operator.position.z).distance_to(c)
		if not r.hit and absf(dop - r.r) < 0.9 and operator.position.y < 0.5 and enemies.down <= 0.0:
			r.hit = true
			enemies._hit_operator(24.0)
		if r.r > ARENA_R * 2.0 + 4.0:
			mi.queue_free()
			_rings.erase(r)
	if raid.phase == 0 or raid.phase == 2:
		_summon_t -= dt
		if _summon_t <= 0.0 and _hostiles_alive() < 4:
			_summon_t = 24.0
			controls.toast("Astravore calls its guardians")
			for k in 2:
				var a := _rng.randf() * TAU
				_spawn_void("Void Vanguard" if k == 0 else "Void Reaver", Vector3(cos(a) * 10.0, 0, sin(a) * 10.0))

func _in_beam(p: Vector3, b: Dictionary) -> bool:
	var rel := Vector3(p.x, 0, p.z) - (b.from as Vector3)
	var along := rel.dot(b.dir as Vector3)
	if along < 0.0:
		return false
	var off := (rel - (b.dir as Vector3) * along).length()
	return off < 1.4

# --------------------------------------------------------------------------------------------- endings
func _gate_cleared() -> void:
	_ended = true
	var s := HollowStar.load_save()
	s.checkpoint = "hollow-star-boss"
	HollowStar.write_save(s)
	_end_panel("GATE STABILIZED", "Checkpoint reached · The Broken Gate\nThe way down is open: 3.8 km to the final chamber.", "DESCEND", func(): next.emit("hollow-star-boss"))

func _raid_cleared() -> void:
	_ended = true
	var s := HollowStar.load_save()
	var first := int(s.clears) == 0
	s.clears = int(s.clears) + 1
	s.checkpoint = ""
	if float(s.best) <= 0.0 or raid.time < float(s.best):
		s.best = raid.time
	HollowStar.write_save(s)
	var rw := HollowStar.reward(first)
	var p := Gear.profile_load()
	var res := Progression.grant(p, "raid", int(rw.nex), int(rw.xp), "The Hollow Star")
	for l in res.lines:
		controls.toast(String(l))
	if rw.title != "":
		var titles: Array = p.get("titles", [])
		if not titles.has(rw.title):
			titles.append(rw.title)
		p.titles = titles
	Gear.profile_save(p)
	var extra := ""
	if rw.item != "":
		var gear := Gear.load_save()
		gear.items.append({ "id": "drop-%d" % int(gear.next_id), "name": String(rw.item), "slot": "primary", "element": "Void", "frame": "SNIPER", "cls": "", "rarity": "Exotic", "power": int(Gear.operator_power(gear, int(p.level))) + 30, "level": 1, "source": "Raid 01 · The Hollow Star" })
		gear.next_id = int(gear.next_id) + 1
		Gear.save(gear)
		extra = "\nEXOTIC  %s\nTITLE  %s" % [rw.item, rw.title]
	boss_body.visible = false
	_end_panel("ASTRAVORE FALLS", "Raid 01 · The Hollow Star cleared%s\n+%d Nex   +%d XP%s" % [" — FIRST CLEAR" if first else "", int(rw.nex), int(rw.xp), extra], "LEAVE THE RAID", func(): closed.emit())

func _end_panel(head: String, body: String, button: String, act: Callable) -> void:
	_panel = PanelContainer.new()
	_panel.add_theme_stylebox_override("panel", Data.box(Color(0.04, 0.02, 0.08, 0.92), Color(0.75, 0.5, 1.0), 6, 2))
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.position = Vector2(-220, -120)
	_panel.custom_minimum_size = Vector2(440, 0)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	_panel.add_child(v)
	var h := _hud_label(28, Color(1.0, 0.8, 0.5))
	h.text = head
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(h)
	var b := _hud_label(16, Color(0.9, 0.9, 1.0))
	b.text = body
	b.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(b)
	var btn := Data.button(button, true)
	btn.custom_minimum_size = Vector2(300, 50)
	btn.pressed.connect(act)
	v.add_child(btn)
	add_child(_panel)

# the raid's 3D world is freed child by child before the view (and its SubViewport) goes: freeing the whole world root
# along with its viewport made the renderer look up a material it had already let go ('Parameter "material" is null',
# bug sweep Nov 9)
func _exit_tree() -> void:
	if is_instance_valid(world):
		for c in world.get_children():
			c.free()
