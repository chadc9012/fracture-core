extends Control
## Fort Kessler (owner, Nov 23, with frames of GTA V's Fort Zancudo: "I need my game to look like this — builds floor
## characters weapons planes vehicles tanks military"). A military airbase in the Wastelands under a hard midday sun:
## a 760 m runway with its markings, slab tarmac, hangars, a red-and-white control tower, barracks, a fenced perimeter
## with barbed wire and a guarded gate (canopy, booth, barrier arm, STOP sign); jets on the apron, tanks and trucks by
## the barracks; a garrison in desert uniform; brown ranges all round.
##
## The wanted level: the garrison leaves you alone outside the wire. Past the gate you get a warning, then a star;
## shooting near them or putting one down adds stars. Stars bring more soldiers from the barracks, and from four stars
## jets come in low along the runway and strafe. Get outside the wire and out of sight a while and they lose you.

signal closed

const Look := preload("res://scripts/military/fort_look.gd")
const Phone := preload("res://scripts/phone.gd")
const StaticBatch := preload("res://scripts/static_batch.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Rides := preload("res://scripts/killbox/royale_rides.gd")

const MIL := "res://models/military/"
const FortJet := preload("res://scripts/military/fort_jet.gd")

## the wire: x -260..260, z -520..300; the gate on the south side at x = GATE_X; the road runs out to z = ROAD_END
const WIRE := Rect2(-260, -520, 520, 820)
const GATE_X := -200.0
const GATE_Z := 300.0
const ROAD_END := 450.0
const RUNWAY_X := 150.0
const RUNWAY_W := 46.0
const RUNWAY := Vector2(-500.0, 260.0)     # z from .. to
const TAXI_X := 95.0
const APRON := Rect2(-40, -300, 124, 360)
const HANGAR_Z := [-260.0, -180.0, -100.0, -20.0]
const HANGAR_X := -112.0
const TOWER := Vector3(-30, 0, 110)
const TOWER_H := 34.0
const HANGAR_YAW := PI * 0.5   # the Meshy hangar faces +z; turned so its doors face the apron (+x)
const SPAWN := Vector3(GATE_X, 0, 395)
const WARN_S := 6.0
const LOSE_S := 16.0
const JET_EVERY := { 4: 26.0, 5: 15.0 }
const GARRISON_MAX := 18

var world: Node3D
var static_root: Node3D
var cam: Camera3D
var operator: Node3D
var controls: Control
var gunplay: Node3D
var enemies: Node3D
var rides: Rides
var air := FortJet.new()     # the apron fighters you can steal and fly
var obstacles: Array[AABB] = []
var stars := 0
var _warn := 0.0
var _unseen := 0.0
var _jet_t := 0.0
var _jets: Array = []          # { node, t, from, to, fired }
var _reinforce_t := 0.0
var _garrison: Array = []      # the Enemy rows of the soldiers here
var _barrier: Node3D
var _stars_lbl: Label
var _banner: Label
var _vp: SubViewport
var _rng := RandomNumberGenerator.new()
var _wasted := 0.0
var _near := ""
var _hs := PackedFloat32Array()   # the ranges' heights (terrain())
var _hs_cells := 1
var _hs_size := 1.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_rng.seed = 5150
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	_vp = SubViewport.new()
	_vp.own_world_3d = true
	Phone.fit_viewport(_vp)
	_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(_vp)
	world = Node3D.new()
	_vp.add_child(world)
	static_root = Node3D.new()
	static_root.name = "Static"
	world.add_child(static_root)
	_environment()
	_land()
	_ranges()
	_airfield()
	_hangars()
	_tower()
	_barracks()
	_wire()
	_gate()
	_yard_props()
	StaticBatch.batch(static_root, 240.0)
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.05
	cam.far = 6000.0
	world.add_child(cam)
	cam.current = true
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	world.add_child(operator)
	operator.bounds = Rect2(WIRE.position.x - 60.0, WIRE.position.y - 60.0, WIRE.size.x + 120.0, ROAD_END + 20.0 - WIRE.position.y + 60.0)
	operator.ground_at = func(_x: float, _z: float) -> float: return 0.0
	operator.obstacles = obstacles
	operator.position = SPAWN
	operator.heading = PI
	operator.cam_yaw = 0.0
	operator.civilian = true
	operator.build()
	operator.attach_camera(cam)
	gunplay = Gunplay.new()
	world.add_child(gunplay)
	gunplay.setup(operator, obstacles)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	gunplay.set_holstered(false)
	controls.set_armed(true)
	enemies = Enemies.new()
	world.add_child(enemies)
	enemies.setup(operator, gunplay)
	enemies.respawn_enabled = false
	enemies.checkpoint = SPAWN
	enemies.bot_down.connect(_on_soldier_down)
	enemies.operator_down.connect(_on_operator_down)
	_garrison_calm()
	rides = Rides.new()
	_vehicles()
	_hud()
	Sound.loops_stop()
	Sound.ambience("wasteland-wind", -12.0)
	controls.toast("FORT KESSLER · RESTRICTED MILITARY AREA")

# ------------------------------------------------------------------------------------------------ the sky and the land

func _environment() -> void:
	var sun_rot := Vector3(-52, -35, 0)      # a high midday sun from the south-west
	var day := { "top": "#3f78c9", "hor": "#c9dcef", "fog": "#cdd8e2", "sun_col": "#fff6e6",
		"sky_set": { "cover": 0.18, "cloud_lit": Color(1, 1, 1), "cloud_dark": Color(0.78, 0.82, 0.88), "cloud_scale": 1.4 } }
	var s := Sky.new()
	s.sky_material = load("res://scripts/region_sky.gd").make("day", day, Basis.from_euler(sun_rot * PI / 180.0).z)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = s
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.6
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 0.85
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.1
	env.adjustment_contrast = 1.05
	# the haze that makes distance: the ranges go pale blue the further they stand
	env.fog_enabled = true
	env.fog_light_color = Color(0.66, 0.76, 0.88)
	env.fog_density = 0.00016
	env.fog_aerial_perspective = 0.2
	env.fog_sky_affect = 0.1
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = sun_rot
	sun.light_energy = 1.7
	sun.light_color = Color(1.0, 0.96, 0.88)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 160.0
	Phone.fit_sun(sun)
	world.add_child(sun)

func _plane(size: Vector2, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	mi.position = pos
	mi.material_override = mat
	(parent if parent else static_root).add_child(mi)
	return mi

func _box(size: Vector3, pos: Vector3, mat: Material, solid := false, parent: Node3D = null, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.rotation = rot
	mi.material_override = mat
	(parent if parent else static_root).add_child(mi)
	if solid:
		obstacles.append(AABB(pos - size * 0.5, size))
	return mi

func _cyl(r: float, h: float, pos: Vector3, mat: Material, r_top := -1.0, segs := 16, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = r
	cm.top_radius = r if r_top < 0.0 else r_top
	cm.height = h
	cm.radial_segments = segs
	cm.rings = 1
	mi.mesh = cm
	mi.position = pos
	mi.material_override = mat
	(parent if parent else static_root).add_child(mi)
	return mi

func _mm(mesh: Mesh, mat: Material, xfs: Array, shadows := true) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	if not shadows:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)

## the valley floor: dry scrub and dirt for kilometres round the base
## a Meshy model from models/military/ (Nov 24: hangar, control-tower), fitted so its longest side is `span` metres
## (or its height `tall` metres when given), standing on the ground at `at`, turned `yaw`. null when the file is missing.
func _model(file: String, at: Vector3, yaw: float, span := 0.0, tall := 0.0) -> Node3D:
	var path := MIL + file
	if not ResourceLoader.exists(path):
		return null
	var n := (load(path) as PackedScene).instantiate() as Node3D
	world.add_child(n)
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = n.global_transform.affine_inverse() * (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	var k := 1.0
	if tall > 0.0 and box.size.y > 0.01:
		k = tall / box.size.y
	elif span > 0.0 and maxf(box.size.x, box.size.z) > 0.01:
		k = span / maxf(box.size.x, box.size.z)
	n.scale = Vector3.ONE * k
	n.rotation.y = yaw
	var c := box.get_center() * k
	n.position = at - Vector3(c.x, 0, c.z).rotated(Vector3.UP, yaw) - Vector3(0, box.position.y * k, 0)
	return n

func _land() -> void:
	_plane(Vector2(3600, 3600), Vector3(0, -0.02, -100), Look.scrub())

## the ranges: one heightfield ring, flat across the valley, rising into ridges beyond ~900 m
func _ranges() -> void:
	var n := FastNoiseLite.new()
	n.seed = 77
	n.frequency = 0.0016
	n.fractal_octaves = 5
	var ridge := FastNoiseLite.new()
	ridge.seed = 12
	ridge.frequency = 0.0007
	var size := 7000.0
	var cells := 150
	var step := size / cells
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var hs := PackedFloat32Array()
	hs.resize((cells + 1) * (cells + 1))
	for j in cells + 1:
		for i in cells + 1:
			var x := -size * 0.5 + i * step
			var z := -size * 0.5 + j * step - 100.0
			# distance outside the valley's oval: nothing inside, ridges climbing beyond (higher to the north, like the
			# frames' mountain over the hangars)
			var d := Vector2(x / 1.1, (z + 100.0) / 1.25).length() - 950.0
			var rise := clampf(d / 900.0, 0.0, 1.0)
			var north := 1.0 + 0.6 * clampf(-(z + 300.0) / 1500.0, 0.0, 1.0)
			var h := rise * rise * (380.0 + 420.0 * absf(ridge.get_noise_2d(x, z))) * north * (0.65 + 0.7 * (n.get_noise_2d(x, z) * 0.5 + 0.5))
			hs[j * (cells + 1) + i] = h - 4.0 * (1.0 - rise)
	_hs = hs
	_hs_cells = cells
	_hs_size = size
	for j in cells:
		for i in cells:
			var x0 := -size * 0.5 + i * step
			var z0 := -size * 0.5 + j * step - 100.0
			var p := [Vector3(x0, hs[j * (cells + 1) + i], z0), Vector3(x0 + step, hs[j * (cells + 1) + i + 1], z0),
				Vector3(x0, hs[(j + 1) * (cells + 1) + i], z0 + step), Vector3(x0 + step, hs[(j + 1) * (cells + 1) + i + 1], z0 + step)]
			if p[0].y < 0.5 and p[1].y < 0.5 and p[2].y < 0.5 and p[3].y < 0.5:
				continue      # the valley floor is the scrub plane
			for v in [p[0], p[1], p[2], p[1], p[3], p[2]]:
				st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = Look.range_rock()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)

## the land's height at x, z: the valley floor (0) or the ranges' heightfield (what a jet flies into)
func terrain(x: float, z: float) -> float:
	if _hs.is_empty():
		return 0.0
	var step := _hs_size / _hs_cells
	var fx := clampf((x + _hs_size * 0.5) / step, 0.0, _hs_cells - 0.001)
	var fz := clampf((z + 100.0 + _hs_size * 0.5) / step, 0.0, _hs_cells - 0.001)
	var i := int(fx)
	var j := int(fz)
	var tx := fx - i
	var tz := fz - j
	var w := _hs_cells + 1
	var a := lerpf(_hs[j * w + i], _hs[j * w + i + 1], tx)
	var b := lerpf(_hs[(j + 1) * w + i], _hs[(j + 1) * w + i + 1], tx)
	return maxf(0.0, lerpf(a, b, tz))

# ------------------------------------------------------------------------------------------------ the airfield

## a painted line: a thin slab just above the tarmac
func _paint(size: Vector2, at: Vector3, col: Color) -> void:
	_box(Vector3(size.x, 0.02, size.y), at + Vector3(0, 0.04, 0), Look.flat(col, 0.7))

func _airfield() -> void:
	var tar := Look.tarmac(Color(0.44, 0.41, 0.37))
	var runway := Look.tarmac(Color(0.27, 0.27, 0.27), 1.0)
	var len := RUNWAY.y - RUNWAY.x
	var cz := (RUNWAY.x + RUNWAY.y) * 0.5
	_box(Vector3(RUNWAY_W + 6.0, 0.06, len + 6.0), Vector3(RUNWAY_X, 0.0, cz), Look.flat(Color(0.5, 0.48, 0.44), 0.95))
	_box(Vector3(RUNWAY_W, 0.08, len), Vector3(RUNWAY_X, 0.01, cz), runway)
	var white := Color(0.92, 0.92, 0.9)
	var yellow := Color(0.95, 0.78, 0.2)
	# edge lines, the centreline dashes, threshold piano keys and touchdown blocks at both ends
	for sx: float in [-1.0, 1.0]:
		_paint(Vector2(0.9, len - 4.0), Vector3(RUNWAY_X + sx * (RUNWAY_W * 0.5 - 1.2), 0, cz), white)
	var z := RUNWAY.x + 60.0
	while z < RUNWAY.y - 60.0:
		_paint(Vector2(0.9, 30.0), Vector3(RUNWAY_X, 0, z), white)
		z += 55.0
	for end: float in [RUNWAY.x + 12.0, RUNWAY.y - 12.0]:
		for k in 8:
			var off := -RUNWAY_W * 0.5 + 4.0 + k * ((RUNWAY_W - 8.0) / 7.0)
			if absf(off) > 2.0:
				_paint(Vector2(1.8, 30.0), Vector3(RUNWAY_X + off, 0, end + (15.0 if end < 0.0 else -15.0)), white)
		var inward := 1.0 if end < 0.0 else -1.0
		for k2 in 3:
			for sx2: float in [-1.0, 1.0]:
				_paint(Vector2(3.0, 22.0), Vector3(RUNWAY_X + sx2 * 8.0, 0, end + inward * (110.0 + k2 * 70.0)), white)
		var num := Label3D.new()
		num.text = "36" if end > 0.0 else "18"
		num.font_size = 512
		num.pixel_size = 0.03
		num.modulate = white
		num.rotation_degrees = Vector3(-90, 0 if end > 0.0 else 180, 0)
		num.position = Vector3(RUNWAY_X, 0.07, end + inward * 50.0)
		num.shaded = true
		static_root.add_child(num)
	# the taxiway and its links, the apron
	_box(Vector3(22.0, 0.07, len - 40.0), Vector3(TAXI_X, 0.0, cz), tar)
	_paint(Vector2(0.5, len - 40.0), Vector3(TAXI_X, 0, cz), yellow)
	for lz: float in [RUNWAY.x + 30.0, -100.0, RUNWAY.y - 30.0]:
		_box(Vector3(RUNWAY_X - TAXI_X, 0.07, 22.0), Vector3((RUNWAY_X + TAXI_X) * 0.5, 0.0, lz), tar)
		_paint(Vector2(RUNWAY_X - TAXI_X - 20.0, 0.5), Vector3((RUNWAY_X + TAXI_X) * 0.5, 0, lz), yellow)
	_box(Vector3(APRON.size.x, 0.07, APRON.size.y), Vector3(APRON.get_center().x, 0.0, APRON.get_center().y), tar)
	# parking stands: yellow T marks for the jets
	for k3 in 4:
		var sz := APRON.position.y + 40.0 + k3 * 45.0
		_paint(Vector2(0.45, 26.0), Vector3(55.0, 0, sz), yellow)
		_paint(Vector2(8.0, 0.45), Vector3(55.0, 0, sz - 13.0), yellow)
	# the road in from the gate, and the base's own roads
	var road := Look.tarmac(Color(0.3, 0.3, 0.31))
	_box(Vector3(12.0, 0.07, ROAD_END - WIRE.position.y - 40.0), Vector3(GATE_X, 0.0, (ROAD_END + WIRE.position.y + 40.0) * 0.5), road)
	_paint(Vector2(0.3, ROAD_END - WIRE.position.y - 40.0), Vector3(GATE_X, 0, (ROAD_END + WIRE.position.y + 40.0) * 0.5), yellow)
	for rz: float in [200.0, 60.0, -140.0, -360.0]:
		_box(Vector3(GATE_X * -1.0 + APRON.position.x, 0.07, 10.0), Vector3((GATE_X + APRON.position.x) * 0.5, 0.0, rz), road)
	# the hangar yards in front of their doors
	_box(Vector3(70.0, 0.07, HANGAR_Z[-1] - HANGAR_Z[0] + 70.0), Vector3(HANGAR_X + 50.0, 0.0, (HANGAR_Z[0] + HANGAR_Z[-1]) * 0.5), tar)
	# runway edge lights and the approach lights past both ends
	var lamp := SphereMesh.new()
	lamp.radius = 0.25
	lamp.height = 0.5
	lamp.radial_segments = 6
	lamp.rings = 3
	var lights: Array = []
	var lz2 := RUNWAY.x
	while lz2 <= RUNWAY.y:
		for sx3: float in [-1.0, 1.0]:
			lights.append(Transform3D(Basis(), Vector3(RUNWAY_X + sx3 * (RUNWAY_W * 0.5 + 1.5), 0.3, lz2)))
		lz2 += 30.0
	_mm(lamp, Look.flat(Color(1.0, 0.95, 0.75), 0.4, 0.0, 2.0), lights, false)

# ------------------------------------------------------------------------------------------------ the buildings

## an aircraft hangar: corrugated walls, a curved roof, big sliding doors facing the apron, a number on the front
func _hangars() -> void:
	var walls := Look.corrugated(Color(0.84, 0.82, 0.78))
	var doors := Look.corrugated(Color(0.6, 0.62, 0.62))
	var roof := Look.corrugated(Color(0.66, 0.66, 0.66))
	for i in HANGAR_Z.size():
		var z: float = HANGAR_Z[i]
		var w := 64.0      # along z
		var d := 56.0      # along x
		var h := 15.0
		var c := Vector3(HANGAR_X, 0, z)
		# the Meshy hangar (arched corrugated roof, sliding doors) with its doors to the apron (+x); the primitive one
		# below when the model is missing
		if _model("hangar.glb", c, HANGAR_YAW, w):
			obstacles.append(AABB(c - Vector3(d * 0.5, 0, w * 0.5), Vector3(d, h, w)))
			continue
		_box(Vector3(d, h, w), c + Vector3(0, h * 0.5, 0), walls, true)
		# the curved roof: a shallow drum along x
		var drum := _cyl(w * 0.62, d + 1.0, c + Vector3(0, h - w * 0.62 + 6.0, 0), roof, -1.0, 40)
		drum.rotation.z = PI * 0.5
		drum.scale = Vector3(1, 1, 1)
		# keep only the cap above the walls: hide the drum's lower half inside them (it is wider than the walls)
		drum.scale.z = (w * 0.5 + 0.6) / (w * 0.62)
		# the door wall on the east (+x) face: two leaves, a header, a light over each
		var fx := HANGAR_X + d * 0.5 + 0.15
		for s in [-1.0, 1.0]:
			_box(Vector3(0.3, h - 2.5, w * 0.46), Vector3(fx, (h - 2.5) * 0.5, z + s * w * 0.24), doors)
		_box(Vector3(0.5, 2.5, w), Vector3(fx, h - 1.25, z), Look.flat(Color(0.3, 0.3, 0.32), 0.6, 0.4))
		var num := Label3D.new()
		num.text = "HANGAR %d" % (i + 1)
		num.font_size = 200
		num.pixel_size = 0.02
		num.modulate = Color(0.12, 0.12, 0.12)
		num.outline_size = 0
		num.shaded = true
		num.position = Vector3(fx + 0.3, h - 1.2, z)
		num.rotation_degrees.y = 90.0
		static_root.add_child(num)
		var l := OmniLight3D.new()
		l.position = Vector3(fx + 3.0, h - 3.0, z)
		l.omni_range = 18.0
		l.light_energy = 0.6
		static_root.add_child(l)

## the control tower: a red-and-white banded shaft, a glass cab, a gallery and the radar on top (the frames' tower)
func _tower() -> void:
	var red := Look.render_wall(Color(0.72, 0.18, 0.16))
	var white := Look.render_wall(Color(0.9, 0.88, 0.84))
	var base := Look.render_wall(Color(0.76, 0.72, 0.64))
	# the operations block at its foot
	_box(Vector3(24.0, 7.0, 16.0), TOWER + Vector3(10.0, 3.5, 0), base, true)
	_box(Vector3(24.4, 0.4, 16.4), TOWER + Vector3(10.0, 7.2, 0), Look.flat(Color(0.35, 0.35, 0.36)))
	for k in 6:
		_box(Vector3(2.2, 1.3, 0.1), TOWER + Vector3(2.0 + k * 3.4, 4.2, 8.02), Look.glass())
	var side := 7.0
	var band := 3.2
	# the Meshy tower (banded shaft, glass cab, radar); the primitive one below when the model is missing
	if _model("control-tower.glb", TOWER, 0.0, 0.0, TOWER_H):
		obstacles.append(AABB(TOWER - Vector3(side * 0.5, 0, side * 0.5), Vector3(side, TOWER_H, side)))
		_tower_old()
		return
	for k2 in 7:
		_box(Vector3(side, band, side), TOWER + Vector3(0, band * 0.5 + k2 * band, 0), red if k2 % 2 == 0 else white, k2 == 0)
	var top := 7 * band
	_box(Vector3(side + 2.4, 0.5, side + 2.4), TOWER + Vector3(0, top + 0.25, 0), Look.flat(Color(0.3, 0.3, 0.32)))
	# the cab: glass all round under a dark roof, a rail on the gallery
	_box(Vector3(side + 1.2, 3.4, side + 1.2), TOWER + Vector3(0, top + 2.2, 0), Look.glass(Color(0.2, 0.3, 0.36)))
	_box(Vector3(side + 3.2, 0.6, side + 3.2), TOWER + Vector3(0, top + 4.2, 0), Look.flat(Color(0.82, 0.18, 0.15), 0.6))
	for s in [-1.0, 1.0]:
		_box(Vector3(side + 2.4, 1.0, 0.08), TOWER + Vector3(0, top + 1.0, s * (side * 0.5 + 1.2)), Look.flat(Color(0.85, 0.85, 0.85), 0.4, 0.8))
		_box(Vector3(0.08, 1.0, side + 2.4), TOWER + Vector3(s * (side * 0.5 + 1.2), top + 1.0, 0), Look.flat(Color(0.85, 0.85, 0.85), 0.4, 0.8))
	# the mast and the radar dish
	_cyl(0.18, 9.0, TOWER + Vector3(1.5, top + 9.0, 0), Look.flat(Color(0.7, 0.7, 0.72), 0.4, 0.8))
	_cyl(0.12, 6.0, TOWER + Vector3(-2.0, top + 7.5, 1.0), Look.flat(Color(0.7, 0.7, 0.72), 0.4, 0.8))
	var dish := _cyl(1.6, 0.4, TOWER + Vector3(-1.5, top + 5.6, -1.5), Look.flat(Color(0.92, 0.92, 0.9), 0.5), 0.6)
	dish.rotation.x = 0.9
	_cyl(0.2, 0.2, TOWER + Vector3(1.5, top + 13.6, 0), Look.flat(Color(1.0, 0.1, 0.05), 0.4, 0.0, 6.0))
	_tower_old()

## a second, older tower by the hangars, the frames' grey one
func _tower_old() -> void:
	var old := TOWER + Vector3(-70.0, 0, 70.0)
	_box(Vector3(9.0, 16.0, 9.0), old + Vector3(0, 8.0, 0), Look.render_wall(Color(0.74, 0.7, 0.62)), true)
	_box(Vector3(10.4, 3.0, 10.4), old + Vector3(0, 17.5, 0), Look.glass(Color(0.22, 0.3, 0.34)))
	_box(Vector3(11.0, 0.5, 11.0), old + Vector3(0, 19.2, 0), Look.flat(Color(0.5, 0.48, 0.44)))
	var radar := _cyl(1.2, 0.35, old + Vector3(0, 20.6, 0), Look.flat(Color(0.9, 0.9, 0.88)), 0.4)
	radar.rotation.x = 1.1

## the barracks and the motor pool: long low blocks with flat roofs and rows of windows
func _barracks() -> void:
	var wall := Look.render_wall(Color(0.78, 0.74, 0.66))
	var roof := Look.flat(Color(0.32, 0.32, 0.33), 0.9)
	for i in 3:
		var c := Vector3(GATE_X + 46.0, 0, 210.0 - i * 44.0)
		_box(Vector3(60.0, 6.0, 16.0), c + Vector3(0, 3.0, 0), wall, true)
		_box(Vector3(61.0, 0.4, 17.0), c + Vector3(0, 6.2, 0), roof)
		for k in 12:
			for s in [-1.0, 1.0]:
				_box(Vector3(2.2, 1.3, 0.1), c + Vector3(-26.0 + k * 4.75, 3.6, s * 8.02), Look.glass())
		_box(Vector3(2.4, 2.6, 0.12), c + Vector3(0, 1.3, 8.05), Look.flat(Color(0.25, 0.3, 0.25), 0.6))
		for k2 in 3:
			_box(Vector3(1.6, 1.0, 1.4), c + Vector3(-18.0 + k2 * 18.0, 6.9, 0), Look.flat(Color(0.6, 0.6, 0.6), 0.5, 0.6))
	# the motor pool: an open steel shed over the vehicles
	var mp := Vector3(GATE_X + 10.0, 0, 60.0)
	for k3 in 5:
		for s2 in [-1.0, 1.0]:
			_box(Vector3(0.5, 7.0, 0.5), mp + Vector3(-28.0 + k3 * 14.0, 3.5, s2 * 9.0), Look.flat(Color(0.45, 0.45, 0.46), 0.5, 0.7), true)
	_box(Vector3(60.0, 0.4, 20.0), mp + Vector3(0, 7.2, 0), Look.corrugated(Color(0.6, 0.6, 0.58)))
	# the water tower
	var wt := Vector3(-235.0, 0, -60.0)
	for s3 in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		_box(Vector3(0.4, 18.0, 0.4), wt + Vector3(s3.x * 3.0, 9.0, s3.y * 3.0), Look.flat(Color(0.6, 0.6, 0.6), 0.5, 0.7))
	_cyl(5.0, 6.0, wt + Vector3(0, 21.0, 0), Look.flat(Color(0.82, 0.82, 0.8), 0.6, 0.3))
	_cyl(5.2, 1.5, wt + Vector3(0, 24.7, 0), Look.flat(Color(0.82, 0.82, 0.8), 0.6, 0.3), 0.5)

# ------------------------------------------------------------------------------------------------ the wire and the gate

## the perimeter: chain-link on steel posts, three strands on outward arms and a coil of razor wire along the top; a gap
## at the gate
func _wire() -> void:
	var link := Look.chain_link()
	var h := 3.0
	var r := WIRE
	var sides := [
		[Vector2(r.position.x, r.position.y), Vector2(r.end.x, r.position.y), Vector2(0, -1)],
		[Vector2(r.end.x, r.position.y), Vector2(r.end.x, r.end.y), Vector2(1, 0)],
		[Vector2(r.position.x, r.position.y), Vector2(r.position.x, r.end.y), Vector2(-1, 0)],
		[Vector2(r.position.x, r.end.y), Vector2(GATE_X - 10.0, r.end.y), Vector2(0, 1)],
		[Vector2(GATE_X + 10.0, r.end.y), Vector2(r.end.x, r.end.y), Vector2(0, 1)],
	]
	var posts: Array = []
	var arms: Array = []
	var coils: Array = []
	for sd in sides:
		var a: Vector2 = sd[0]
		var b: Vector2 = sd[1]
		var out: Vector2 = sd[2]
		var mid := (a + b) * 0.5
		var length := a.distance_to(b)
		var along_x := absf(b.x - a.x) > absf(b.y - a.y)
		_box(Vector3(length if along_x else 0.05, h, 0.05 if along_x else length), Vector3(mid.x, h * 0.5, mid.y), link)
		obstacles.append(AABB(Vector3(minf(a.x, b.x) - 0.3, 0, minf(a.y, b.y) - 0.3), Vector3(absf(b.x - a.x) + 0.6, 4.0, absf(b.y - a.y) + 0.6)))
		var n := int(length / 3.0)
		for k in n + 1:
			var p := a.lerp(b, float(k) / maxf(n, 1))
			posts.append(Transform3D(Basis().scaled(Vector3(0.09, h + 0.6, 0.09)), Vector3(p.x, (h + 0.6) * 0.5, p.y)))
			var arm_basis := Basis(Vector3(-out.y, 0, out.x).normalized(), 0.6).scaled(Vector3(0.06, 0.8, 0.06))
			arms.append(Transform3D(arm_basis, Vector3(p.x + out.x * 0.2, h + 0.9, p.y + out.y * 0.2)))
		var nc := int(length / 0.9)
		for k2 in nc:
			var q := a.lerp(b, (float(k2) + 0.5) / nc)
			var cb := Basis(Vector3.UP, 0.0 if not along_x else PI * 0.5) * Basis(Vector3.RIGHT, PI * 0.5 + 0.25 * sin(k2 * 1.7))
			coils.append(Transform3D(cb.scaled(Vector3(0.45, 0.45, 0.45)), Vector3(q.x, h + 0.55, q.y)))
		# three strands along the arms
		for s in 3:
			var off := out * (0.15 + 0.22 * s)
			_box(Vector3(length if along_x else 0.02, 0.02, 0.02 if along_x else length), Vector3(mid.x + off.x, h + 0.45 + 0.27 * s, mid.y + off.y), Look.flat(Color(0.5, 0.5, 0.5), 0.4, 0.9))
	var post := CylinderMesh.new()
	post.radial_segments = 6
	post.rings = 1
	post.top_radius = 1.0
	post.bottom_radius = 1.0
	post.height = 1.0
	_mm(post, Look.flat(Color(0.55, 0.56, 0.57), 0.45, 0.8), posts)
	_mm(post, Look.flat(Color(0.55, 0.56, 0.57), 0.45, 0.8), arms, false)
	var tor := TorusMesh.new()
	tor.inner_radius = 0.82
	tor.outer_radius = 1.0
	tor.rings = 12
	tor.ring_segments = 4
	_mm(tor, Look.flat(Color(0.7, 0.72, 0.74), 0.3, 0.95), coils, false)

## the gate: a canopy over both lanes on square pillars, a guard booth, a red-and-white barrier arm and a STOP sign
func _gate() -> void:
	var c := Vector3(GATE_X, 0, GATE_Z)
	var concrete := Look.render_wall(Color(0.8, 0.78, 0.72))
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_box(Vector3(0.8, 6.0, 0.8), c + Vector3(sx * 11.0, 3.0, sz * 7.0), concrete, true)
	_box(Vector3(26.0, 1.0, 18.0), c + Vector3(0, 6.5, 0), Look.corrugated(Color(0.72, 0.7, 0.66)))
	for k in 3:
		var strip := _box(Vector3(5.0, 0.12, 1.2), c + Vector3(-6.0 + k * 6.0, 5.94, 0), Look.flat(Color(1.0, 0.98, 0.9), 0.3, 0.0, 3.0))
		strip.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the booth on the island between the lanes
	_box(Vector3(2.0, 0.25, 9.0), c + Vector3(0, 0.12, 0), Look.flat(Color(0.95, 0.8, 0.15), 0.7), true)
	_box(Vector3(3.0, 2.6, 3.4), c + Vector3(0, 1.55, 1.5), concrete, true)
	for s in [-1.0, 1.0]:
		_box(Vector3(0.08, 1.1, 2.6), c + Vector3(s * 1.52, 1.9, 1.5), Look.glass())
	_box(Vector3(3.4, 0.25, 3.8), c + Vector3(0, 2.95, 1.5), Look.flat(Color(0.3, 0.3, 0.3)))
	# the barrier arm across the inbound lane, striped, on its post
	_barrier = Node3D.new()
	_barrier.position = c + Vector3(-1.2, 1.1, -3.0)
	world.add_child(_barrier)
	_box(Vector3(0.6, 1.2, 0.6), c + Vector3(-1.2, 0.6, -3.0), Look.flat(Color(0.85, 0.85, 0.8)), true)
	for k2 in 9:
		_box(Vector3(1.2, 0.18, 0.18), Vector3(-0.6 - k2 * 1.2, 0, 0), Look.flat(Color(0.85, 0.12, 0.1) if k2 % 2 == 0 else Color(0.95, 0.95, 0.93), 0.5), false, _barrier)
	# the STOP sign on the island
	var pole := c + Vector3(0.0, 0, -2.0)
	_cyl(0.05, 2.2, pole + Vector3(0, 1.1, 0), Look.flat(Color(0.6, 0.6, 0.6), 0.4, 0.8))
	var oct := _cyl(0.55, 0.04, pole + Vector3(0, 2.35, 0.05), Look.flat(Color(0.8, 0.07, 0.07), 0.5), -1.0, 8)
	oct.rotation = Vector3(PI * 0.5, 0, PI / 8.0)
	var stop := Label3D.new()
	stop.text = "STOP"
	stop.font_size = 96
	stop.pixel_size = 0.0055
	stop.modulate = Color(1, 1, 1)
	stop.outline_size = 0
	stop.shaded = true
	stop.position = pole + Vector3(0, 2.35, 0.08)
	static_root.add_child(stop)
	# the sign over the road outside
	var board := c + Vector3(0, 0, 40.0)
	for s2 in [-1.0, 1.0]:
		_box(Vector3(0.3, 4.0, 0.3), board + Vector3(s2 * 9.0, 2.0, 0), Look.flat(Color(0.4, 0.4, 0.4), 0.5, 0.7))
	_box(Vector3(16.0, 2.4, 0.3), board + Vector3(0, 4.6, 0), Look.flat(Color(0.18, 0.26, 0.18), 0.8))
	var name := Label3D.new()
	name.text = "FORT KESSLER\nRESTRICTED AREA · USE OF DEADLY FORCE AUTHORISED"
	name.font_size = 64
	name.pixel_size = 0.012
	name.modulate = Color(0.95, 0.95, 0.9)
	name.outline_size = 0
	name.shaded = true
	name.position = board + Vector3(0, 4.6, 0.17)
	static_root.add_child(name)
	# jersey barriers either side of the road outside, funnelling into the gate
	for k3 in 6:
		for s3 in [-1.0, 1.0]:
			_box(Vector3(0.6, 0.85, 3.6), c + Vector3(s3 * 7.5, 0.42, 14.0 + k3 * 4.0), concrete, true)

## the yard: sandbags, crates, fuel drums, floodlight masts, a few portable cabins
func _yard_props() -> void:
	var sand := Look.flat(Color(0.66, 0.6, 0.46), 0.95)
	for pos in [Vector3(-180, 0, 270), Vector3(-220, 0, 270), Vector3(70, 0, -320), Vector3(-30, 0, 40)]:
		for k in 5:
			for row in 2:
				var b := _box(Vector3(0.9, 0.35, 0.5), pos + Vector3(-2.0 + k * 0.95 + row * 0.45, 0.18 + row * 0.33, 0), sand)
				b.rotation.y = 0.05 * sin(k * 3.0 + row)
		obstacles.append(AABB(pos + Vector3(-2.5, 0, -0.4), Vector3(5.0, 0.8, 0.8)))
	var drum := Look.flat(Color(0.25, 0.32, 0.22), 0.6, 0.3)
	for k2 in 14:
		_cyl(0.3, 0.9, Vector3(30.0 + (k2 % 7) * 0.65, 0.45, -330.0 + (k2 / 7) * 0.65), drum)
	var crate := Look.flat(Color(0.34, 0.38, 0.24), 0.85)
	for k3 in 8:
		_box(Vector3(2.4, 1.4, 1.6), Vector3(-40.0 + (k3 % 4) * 2.6, 0.7 + (k3 / 4) * 1.4, -310.0), crate, k3 < 4)
	for p2 in [Vector3(-30, 0, -200), Vector3(85, 0, -40), Vector3(85, 0, -260), Vector3(-170, 0, 150), Vector3(GATE_X + 18.0, 0, GATE_Z - 20.0)]:
		_cyl(0.25, 16.0, p2 + Vector3(0, 8.0, 0), Look.flat(Color(0.55, 0.55, 0.56), 0.5, 0.7))
		_box(Vector3(2.4, 0.9, 0.5), p2 + Vector3(0, 16.2, 0), Look.flat(Color(0.3, 0.3, 0.3), 0.5, 0.6))
	var cabin := Look.render_wall(Color(0.85, 0.84, 0.8))
	for k4 in 3:
		_box(Vector3(9.0, 2.8, 3.0), Vector3(-60.0, 1.4, 180.0 + k4 * 6.0), cabin, true)

# ------------------------------------------------------------------------------------------------ what stands on it

## a fleet model where it parks; `drive` makes it one you can get into
func _park(file: String, id: String, length: float, at: Vector3, yaw: float, drive := false) -> Node3D:
	var n: Node3D = rides.add_spec(world, file, id, length, at, yaw)
	if n and not drive:
		rides.parked.erase(n)
		var box := AABB(at - Vector3(length * 0.35, 0, length * 0.35), Vector3(length * 0.7, 3.0, length * 0.7))
		obstacles.append(box)
		n.set_meta("box", box)
	return n

## the base's fighter: the Meshy olive-green jet (Nov 24) when it is in, else the fleet's Vanguard
static func jet_file() -> String:
	return "military-jet.glb" if ResourceLoader.exists(Rides.FLEET + "military-jet.glb") else "vanguard-jet.glb"

func _vehicles() -> void:
	var jf := jet_file()
	for k in 3:
		var j := _park(jf, "vanguard-jet", 19.0, Vector3(55.0, 0, APRON.position.y + 40.0 + k * 45.0), -PI * 0.5)
		if j:
			air.parked.append(j)
	_park(jf, "vanguard-jet", 19.0, Vector3(HANGAR_X + 10.0, 0, HANGAR_Z[1]), PI * 0.5)
	# Humvees: two at the gate, a line in the motor pool, one on the apron road (drivable)
	if ResourceLoader.exists(Rides.FLEET + "humvee.glb"):
		_park("humvee.glb", "offroad-truck", 4.9, Vector3(GATE_X + 14.0, 0, GATE_Z - 30.0), PI * 0.5, true)
		_park("humvee.glb", "offroad-truck", 4.9, Vector3(GATE_X - 14.0, 0, GATE_Z - 30.0), -PI * 0.5)
		for k2 in 3:
			_park("humvee.glb", "offroad-truck", 4.9, Vector3(GATE_X + 36.0 + k2 * 7.0, 0, 62.0), 0.0, k2 == 0)
		_park("humvee.glb", "offroad-truck", 4.9, Vector3(TAXI_X - 20.0, 0, 20.0), PI, true)
	_park("rift-helicopter.glb", "rift-helicopter", 16.0, Vector3(10.0, 0, 120.0), 0.4)
	_park("goliath-tank.glb", "goliath-tank", 8.5, Vector3(GATE_X - 8.0, 0, 60.0), 0.0, true)
	_park("goliath-tank.glb", "goliath-tank", 8.5, Vector3(GATE_X + 8.0, 0, 60.0), 0.0)
	_park("goliath-tank.glb", "goliath-tank", 8.5, Vector3(GATE_X + 24.0, 0, 60.0), 0.0)
	_park("offroad-truck.glb", "offroad-truck", 5.6, Vector3(GATE_X - 22.0, 0, 64.0), 0.0, true)
	_park("security-suv.glb", "security-suv", 5.0, Vector3(GATE_X + 14.0, 0, GATE_Z - 18.0), PI * 0.5, true)
	_park("war-rig.glb", "war-rig", 9.0, Vector3(30.0, 0, -360.0), PI * 0.5)
	_park("offroad-truck.glb", "offroad-truck", 5.6, Vector3(-70.0, 0, -320.0), 0.3, true)

# ------------------------------------------------------------------------------------------------ the garrison

## the soldiers while you are no threat: the gate line, sentries at the tower and patrols on the apron and the wire.
## They stand on the operator's side (team) so they hold their fire; a star turns them.
func _garrison_calm() -> void:
	var spots: Array = []
	for k in 8:
		var p := Vector3(GATE_X - 9.0 + k * 2.6, 0, GATE_Z - 12.0 - (k % 2) * 1.5)
		spots.append([p, [p]])
	spots.append([TOWER + Vector3(6, 0, 10), [TOWER + Vector3(6, 0, 10), TOWER + Vector3(30, 0, 10)]])
	spots.append([Vector3(20, 0, -100), [Vector3(20, 0, -100), Vector3(20, 0, -260), Vector3(70, 0, -260)]])
	spots.append([Vector3(-60, 0, -200), [Vector3(-60, 0, -200), Vector3(-60, 0, 20)]])
	spots.append([Vector3(-240, 0, -300), [Vector3(-240, 0, -300), Vector3(-240, 0, 200)]])
	spots.append([Vector3(240, 0, 100), [Vector3(240, 0, 100), Vector3(240, 0, -400)]])
	for s in spots:
		var e: RefCounted = enemies.spawn("soldier", s[0], s[1])
		e.team = enemies.operator_team
		e.mover.heading = 0.0
		e.mover.rig.rotation.y = 0.0
		_garrison.append(e)

func _alive_soldiers() -> int:
	var n := 0
	for e in enemies.enemies:
		if e.type == "soldier" and e.target.alive():
			n += 1
	return n

## a star (or more): every soldier turns on you
func _raise(to: int, why: String) -> void:
	to = clampi(to, 0, 5)
	if to <= stars:
		return
	var first := stars == 0
	stars = to
	_unseen = 0.0
	for e in enemies.enemies:
		if e.type == "soldier" and e.target.alive():
			e.team = 0
			if e.state == Enemies.State.PATROL:
				e.state = Enemies.State.ALERT
				e.timer = 0.4
	if first:
		_reinforce_t = 4.0
		_jet_t = JET_EVERY.get(4, 26.0)
		Sound.sfx("siren", -6.0)
	controls.toast(why)
	_draw_stars()

## lost them: the stars go, the survivors stand down where they are
func _lose() -> void:
	stars = 0
	for e in enemies.enemies:
		if e.type == "soldier" and e.target.alive():
			e.team = enemies.operator_team
			e.state = Enemies.State.PATROL
			e.goal = null
	controls.toast("You lost them")
	_draw_stars()

## reinforcements from the barracks and the hangars, out of sight of you, while the stars call for more
func _reinforce(dt: float) -> void:
	_reinforce_t -= dt
	if _reinforce_t > 0.0:
		return
	_reinforce_t = 9.0 - stars
	var want := mini(GARRISON_MAX, 4 + stars * 3)
	var have := 0
	for e in enemies.enemies:
		if e.type == "soldier" and e.target.alive() and e.team != enemies.operator_team:
			have += 1
	var doors := [Vector3(GATE_X + 46.0, 0, 200.0), Vector3(GATE_X + 46.0, 0, 156.0), Vector3(GATE_X + 46.0, 0, 112.0)]
	for z in HANGAR_Z:
		doors.append(Vector3(HANGAR_X + 32.0, 0, z))
	doors.shuffle()
	for d in doors:
		if have >= want:
			break
		if d.distance_to(operator.position) < 45.0:
			continue
		var e: RefCounted = enemies.spawn("soldier", d + Vector3(_rng.randf_range(-3, 3), 0, 9.0), [d])
		e.team = 0
		e.state = Enemies.State.ENGAGE
		e.goal = operator.position
		have += 1

func _on_soldier_down(e: RefCounted, _by: int, by_player: bool) -> void:
	if not by_player:
		return
	_raise(maxi(stars + 1, 2), "Soldier down · the base is on alert")

func _on_operator_down() -> void:
	_wasted = 3.0
	_banner.text = "WASTED"
	_banner.visible = true

func _respawn() -> void:
	_banner.visible = false
	for e in enemies.enemies:
		if e.type == "soldier" and e.target.alive():
			e.team = enemies.operator_team
			e.state = Enemies.State.PATROL
	stars = 0
	_draw_stars()
	operator.position = SPAWN
	operator.heading = PI
	operator.cam_yaw = 0.0
	enemies.down = 0.0
	enemies.hull = enemies.hull_max
	enemies.shield = enemies.shield_max

# ------------------------------------------------------------------------------------------------ the jets

## a jet in low along the runway, guns on the operator as it passes; its model is the fleet's Vanguard
## a flight that ended in a building or the ground: the jet is gone and so, most likely, are you
func _jet_down() -> void:
	air.crashed = false
	gunplay.spark(operator.position + Vector3(0, 1, 0), false)
	gunplay.set_holstered(false)
	controls.set_armed(true)
	controls.toast("CRASHED")
	enemies._hit_operator(enemies.hull_max * 0.9)

func _send_jet() -> void:
	var path := Rides.FLEET + jet_file()
	if not ResourceLoader.exists(path):
		return
	var j := (load(path) as PackedScene).instantiate() as Node3D
	world.add_child(j)
	var box := AABB()
	var first := true
	for mi in j.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	if maxf(box.size.x, box.size.z) > 0.01:
		j.scale = Vector3.ONE * (19.0 / maxf(box.size.x, box.size.z))
	var me := operator.position
	var dir := Vector3(0, 0, -1) if _rng.randf() < 0.5 else Vector3(0, 0, 1)
	var from := Vector3(me.x + _rng.randf_range(-20, 20), 45.0, me.z) - dir * 700.0
	var to := Vector3(me.x, 18.0, me.z) + dir * 500.0
	j.position = from
	j.look_at(to, Vector3.UP)
	_jets.append({ "node": j, "t": 0.0, "from": from, "to": to, "fired": 0.0 })
	Sound.sfx("jet", 0.0)
	controls.toast("JETS INBOUND")

func _step_jets(dt: float) -> void:
	for jt in _jets.duplicate():
		jt.t += dt / 5.5
		var j: Node3D = jt.node
		var p: Vector3 = (jt.from as Vector3).lerp(jt.to, jt.t)
		j.position = p
		# strafe: bursts while it is 250..60 m short of the operator, each round a puff on the ground near them
		var to_me := operator.position - p
		var ahead := to_me.dot(((jt.to as Vector3) - (jt.from as Vector3)).normalized())
		if ahead > 40.0 and ahead < 260.0:
			jt.fired = float(jt.fired) - dt
			if float(jt.fired) <= 0.0:
				jt.fired = 0.07
				var hit := operator.position + Vector3(_rng.randf_range(-6, 6), 0, _rng.randf_range(-10, 10))
				gunplay.spark(hit + Vector3(0, 0.1, 0), false)
				if hit.distance_to(operator.position) < 2.6 and enemies.down <= 0.0:
					enemies._hit_operator(9.0, p)
		if jt.t >= 1.0:
			j.queue_free()
			_jets.erase(jt)

# ------------------------------------------------------------------------------------------------ the frame

func _hud() -> void:
	_stars_lbl = Label.new()
	_stars_lbl.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_stars_lbl.position = Vector2(-300, 70)
	_stars_lbl.custom_minimum_size = Vector2(280, 0)
	_stars_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_stars_lbl.add_theme_font_size_override("font_size", 40)
	_stars_lbl.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_stars_lbl.add_theme_constant_override("outline_size", 8)
	add_child(_stars_lbl)
	_banner = Label.new()
	_banner.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_banner.position = Vector2(-300, -60)
	_banner.custom_minimum_size = Vector2(600, 0)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_theme_font_size_override("font_size", 72)
	_banner.add_theme_color_override("font_color", Color(0.85, 0.12, 0.1))
	_banner.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.95))
	_banner.add_theme_constant_override("outline_size", 10)
	_banner.visible = false
	add_child(_banner)
	_draw_stars()

func _draw_stars() -> void:
	if _stars_lbl == null:
		return
	_stars_lbl.text = "★".repeat(stars) + "☆".repeat(5 - stars)
	_stars_lbl.add_theme_color_override("font_color", Color(1.0, 0.8, 0.2) if stars > 0 else Color(1, 1, 1, 0.35))

func inside_wire(p: Vector3) -> bool:
	return WIRE.has_point(Vector2(p.x, p.z)) and p.z < GATE_Z - 1.0

func _seen() -> bool:
	for e in enemies.enemies:
		if e.type == "soldier" and e.target.alive() and e.team != enemies.operator_team:
			if e.mover.position.distance_to(operator.position) < Enemies.SIGHT and enemies._clear(e.mover.position + Vector3(0, 1.4, 0), operator.position + Vector3(0, 1.2, 0)):
				return true
	return false

func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	if _wasted > 0.0:
		_wasted -= dt
		operator.step(dt, Vector2.ZERO, controls.take_look(), false, false)
		enemies.step(dt)
		if _wasted <= 0.0:
			_respawn()
		return
	# a soldier put down by anything but the operator's own gun (a jet's run, a test) stays down: gunplay stands a target
	# back up when its `down` clock runs out, and only its own kills set that clock (royale_view.gd, the same fix)
	for e in enemies.enemies:
		if not e.target.alive() and e.target.down <= 0.0:
			e.target.down = 1e9
	var prompt := ""
	if air.flying():
		air.step(dt, operator, controls, obstacles, enemies.enemies, gunplay.spark, terrain)
		if air.crashed:
			_jet_down()
		elif not air.airborne() and absf(air.state.speed) < 4.0:
			prompt = "EXIT"
			if controls.take_enter():
				air.exit(operator, controls)
				gunplay.set_holstered(false)
				controls.set_armed(true)
		else:
			prompt = "UP TO CLIMB" if not air.airborne() and air.state.speed > 30.0 else ""
	elif rides.driving():
		rides.step(dt, operator, controls, enemies.enemies)
		if absf(rides.car.speed) < 4.0:
			prompt = "EXIT"
			if controls.take_enter():
				rides.exit(operator, controls)
				gunplay.set_holstered(false)
				controls.set_armed(true)
	else:
		operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
		if controls.take_next():
			gunplay.next_weapon()
		gunplay.step(dt, cam, controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
		var jet := air.near(operator.position)
		var rc := rides.near(operator.position)
		if jet != null:
			prompt = "FLY"
			if controls.take_enter():
				# its parking box goes with it
				if jet.has_meta("box"):
					obstacles.erase(jet.get_meta("box"))
					jet.remove_meta("box")
				air.enter(jet, operator, controls)
				gunplay.set_holstered(true)
				controls.set_armed(false)
				controls.fire = false
				if stars < 3:
					_raise(3, "Military aircraft stolen")
		elif rc != null:
			prompt = "DRIVE"
			if controls.take_enter():
				rides.enter(rc, operator, controls)
				gunplay.set_holstered(true)
				controls.set_armed(false)
		elif operator.position.z > ROAD_END - 15.0:
			prompt = "LEAVE FORT KESSLER"
			if controls.take_enter():
				closed.emit()
				return
		# a shot fired near the garrison: a star
		if controls.fire and stars == 0 and operator.position.distance_to(Vector3(GATE_X, 0, GATE_Z)) < 420.0:
			_raise(1, "Shots fired at a military installation")
	enemies.step(dt)
	# the gate and the warning
	var inside := inside_wire(operator.position)
	if stars == 0:
		if inside:
			_warn += dt
			if _warn > 0.2 and _warn - dt <= 0.2:
				controls.toast("RESTRICTED AREA · LEAVE NOW OR YOU WILL BE FIRED UPON")
			if _warn >= WARN_S:
				_raise(1, "Trespassing on a military base")
		else:
			_warn = maxf(0.0, _warn - dt * 2.0)
	else:
		if inside and stars < 2 and _warn > WARN_S + 20.0:
			_raise(2, "Still on the base")
		_warn += dt if inside else 0.0
		_reinforce(dt)
		if stars >= 4:
			_jet_t -= dt
			if _jet_t <= 0.0:
				_jet_t = float(JET_EVERY.get(stars, 26.0))
				_send_jet()
		# rising with time spent fighting inside
		if inside and _warn > WARN_S + 45.0 and stars < 4:
			_raise(stars + 1, "More units responding")
			_warn = WARN_S + 21.0
		if not inside and not _seen():
			_unseen += dt
			if _unseen > LOSE_S + stars * 3.0:
				_lose()
		else:
			_unseen = 0.0
	_step_jets(dt)
	# the barrier lifts for a vehicle at the gate
	if _barrier:
		var want_up := rides.driving() and operator.position.distance_to(Vector3(GATE_X, 0, GATE_Z)) < 20.0
		_barrier.rotation.z = move_toward(_barrier.rotation.z, (-1.4 if want_up else 0.0), dt * 1.5)
	if prompt != _near:
		_near = prompt
		controls.prompt(prompt)
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down, enemies.shield_frac(), enemies.hull_max, enemies.shield_max)

func _exit_tree() -> void:
	Sound.loops_stop()
	Sound.ambience("")
