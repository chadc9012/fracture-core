extends Control
const Progression := preload("res://scripts/progress/progression.gd")
const StaticBatch = preload("res://scripts/static_batch.gd")
const Phone := preload("res://scripts/phone.gd")
## The racing venue (the Dec 4 plan, phase 5): Nexus Speedway as a scene — the track laid along track.gd's centreline (asphalt
## segments, red-and-white kerbs, grass, a wall at the edge), grandstands full of seats on the straights, the pit lane and
## pit wall, a start-light gantry — with the player's car (the garage's build) on the grid against three rivals driven on the
## centreline, a countdown, three laps, live positions and lap times, the best lap saved to drive_records and the prize Nex
## paid into the profile. The chase camera, the stick / WASD and BRAKE come from touch_controls.gd in drive mode.

signal closed

const Track := preload("res://scripts/racing/track.gd")
const Race := preload("res://scripts/racing/race.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const GarageState := preload("res://scripts/garage/garage_state.gd")
const DriveProfile := preload("res://scripts/driving/drive_profile.gd")
const Records := preload("res://scripts/driving/drive_records.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
const SessionStore := preload("res://scripts/driving/drive_session_store.gd")
const Materials := preload("res://scripts/city/materials.gd")
const CinematicSky := preload("res://scripts/vfx/cinematic_sky.gd")
const Facade := preload("res://scripts/vfx/facade.gd")
const Turf := preload("res://scripts/vfx/turf.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const FLEET := "res://models/fleet/"
const PROFILE := "user://profile.json"
const RIVAL_FILES := ["muscle-car-lod.glb", "street-racer-lod.glb", "tuner.glb"]
const RIVAL_NAMES := ["K. Voss", "Mara Lin", "D. Okafor"]
## the street racers (Neon Night Circuit)
const STREET_NAMES := ["Ghost", "Vex", "Nightjar"]

var track_id := "nexus-speedway"
var vehicle_id := "tuner"
var track: Track
var race: Race
var world: Node3D
var cam: Camera3D
var controls: Control
var player: RefCounted        # street_car.gd
var rivals: Array = []        # [{sc, entry, skill}]
var obstacles: Array[AABB] = []
var countdown := 3.5
var _barks: Control
var cam_yaw := 0.0
var hud: Label
var board: Label
var lights: Array = []
var finish_panel: Control
var _rng := RandomNumberGenerator.new()
var _prize_paid := false
## shots and tests: the player's car drives itself like a rival
var autopilot := false

func _ready() -> void:
	_rng.seed = 11
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.06, 0.08)
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
	# you race the car you last drove (drive_session.json), the tuner until then
	var last: String = String(SessionStore.load_data().last_vehicle)
	if last != "" and not Catalog.vehicle(last).is_empty():
		vehicle_id = last
	track = Track.new(track_id)
	if track.street():
		_night()
		_build_streets()
	else:
		_environment()
		_build_track()
		_stands()
		_pit()
	_gantry()
	# the venue's static pieces (stands, kerbs, barriers, pit garages: ~2,500 boxes) folded for the phone; before the cars
	StaticBatch.batch(world)
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.1
	cam.far = 1500.0
	world.add_child(cam)
	cam.current = true
	_grid()
	controls = TouchControls.new()
	add_child(controls)
	controls.set_mode("drive")
	# a race has no gun and no hull: no crosshair, no hull bar, no weapon read-out
	if controls.crosshair:
		controls.crosshair.visible = false
	for n in [controls.hull_back, controls.hull_fill, controls.weapon_name, controls.ammo]:
		if n:
			n.visible = false
	if controls.touch_ui:
		controls.toast.call_deferred("The car drives itself · steer with your left thumb · hold BRAKE for the corners")
	hud = Label.new()
	hud.position = Vector2(16, 60)
	hud.add_theme_font_size_override("font_size", 22)
	hud.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	hud.add_theme_constant_override("shadow_offset_x", 1)
	hud.add_theme_constant_override("shadow_offset_y", 1)
	add_child(hud)
	board = Label.new()
	board.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	board.position = Vector2(-230, 60)
	board.add_theme_font_size_override("font_size", 15)
	board.modulate = Color(1.0, 1.0, 1.0)
	board.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	board.add_theme_constant_override("shadow_offset_x", 1)
	board.add_theme_constant_override("shadow_offset_y", 1)
	add_child(board)
	var back := Button.new()
	back.text = "← LEAVE"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	_place_camera(1.0)

# --------------------------------------------------------------------------------------------- the venue
func _mat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m

func _box(size: Vector3, pos: Vector3, mat: Material, yaw := 0.0, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.rotation.y = yaw
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

func _environment() -> void:
	# a clear late afternoon after the owner's day frame: warm low sun, clouds, the cracked planet over the far stand
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.84, 0.64)
	sun.light_energy = 2.3
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-26, 35, 0)
	Phone.fit_sun(sun)
	world.add_child(sun)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var look := CinematicSky.golden_day()
	look.merge({"top": Color(0.18, 0.38, 0.72), "horizon": Color(0.92, 0.8, 0.64), "clouds": 0.45, "planet_dir": Vector3(0.6, 0.32, -0.73)}, true)
	look["planet_tex"] = Data.texture("veyra.jpgb", true)
	env.sky = CinematicSky.make(look)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.7
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.5
	env.glow_hdr_threshold = 1.15
	env.fog_enabled = true
	env.fog_light_color = Color(0.85, 0.78, 0.68)
	env.fog_density = 0.0008
	env.fog_aerial_perspective = 0.35
	env.fog_sky_affect = 0.0     # the haze sits on the land, the sky keeps its clouds and the planet
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 1.08
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	# the city beyond the circuit's walls: a lit skyline on the horizon (one merged mesh)
	Facade.skyline(world, Vector3(-45, 0, 0), 330.0, 520.0, 36, Facade.material({"lit": 0.12, "frame": Color(0.08, 0.085, 0.1), "glass": Color(0.05, 0.07, 0.11), "sky": Color(0.85, 0.75, 0.65)}), 77, TAU, 0.0, 30.0, 95.0)

## asphalt segments along the centreline with kerbs at both edges; grass under everything; a wall past the run-off
func _build_track() -> void:
	# mown turf with the groundskeeper's stripes, and real asphalt (world-mapped, so the segments join seamlessly)
	var grass := Turf.material({"stripes": 6.0, "stripe_dir": 0.4})
	_box(Vector3(1100, 0.1, 1100), Vector3(-45, -0.06, 0), grass)
	var asphalt: BaseMaterial3D = Materials.pbr("asphalt_02", Color(0.42, 0.42, 0.44), 6.0, 0.9) if Materials.has("asphalt_02") else _mat(Color(0.11, 0.11, 0.12), 0.9)
	var red := _mat(Color(0.8, 0.12, 0.1), 0.6)
	var white := _mat(Color(0.9, 0.9, 0.88), 0.6)
	var line := _mat(Color(0.95, 0.95, 0.9), 0.5)
	var step := 3.0
	var d := 0.0
	var k := 0
	while d < track.length:
		var c := track.at(d + step * 0.5)
		var f := track.dir_at(d + step * 0.5)
		var yaw := atan2(f.x, f.z)
		var side := Vector3(f.z, 0, -f.x)
		_box(Vector3(track.width + 0.6, 0.08, step + 1.8), c, asphalt, yaw)
		var kerb := red if k % 2 == 0 else white
		_box(Vector3(1.0, 0.1, step + 0.9), c + side * (track.width * 0.5 + 0.4), kerb, yaw)
		_box(Vector3(1.0, 0.1, step + 0.9), c - side * (track.width * 0.5 + 0.4), kerb, yaw)
		# a tyre wall past 9 m of run-off, as an obstacle on both sides
		if k % 3 == 0:
			var w := _mat(Color(0.1, 0.1, 0.11), 0.9)
			for s: float in [-1.0, 1.0]:
				var wp := c + side * s * (track.width * 0.5 + 9.0)
				_box(Vector3(1.2, 1.1, step * 3.0 + 1.0), wp + Vector3(0, 0.55, 0), w, yaw)
				var fw := Vector3(f.x, 0, f.z) * (step * 1.5 + 0.5)
				var sw := Vector3(side.x, 0, side.z) * 0.6
				var lo := Vector3(minf(minf(wp.x - fw.x - sw.x, wp.x + fw.x - sw.x), minf(wp.x - fw.x + sw.x, wp.x + fw.x + sw.x)), 0, minf(minf(wp.z - fw.z - sw.z, wp.z + fw.z - sw.z), minf(wp.z - fw.z + sw.z, wp.z + fw.z + sw.z)))
				var hi := Vector3(maxf(maxf(wp.x - fw.x - sw.x, wp.x + fw.x - sw.x), maxf(wp.x - fw.x + sw.x, wp.x + fw.x + sw.x)), 1.1, maxf(maxf(wp.z - fw.z - sw.z, wp.z + fw.z - sw.z), maxf(wp.z - fw.z + sw.z, wp.z + fw.z + sw.z)))
				obstacles.append(AABB(lo, hi - lo))
		d += step
		k += 1
	# the start line and the lap marker
	var s0 := track.at(float(track.def.start))
	var f0 := track.dir_at(float(track.def.start))
	_box(Vector3(track.width, 0.09, 0.6), s0 + Vector3(0, 0.01, 0), line, atan2(f0.x, f0.z))

## grandstands: tiers of seats in team colours, a roof, on the main straight and the back straight
func _stands() -> void:
	var concrete := _mat(Color(0.55, 0.55, 0.52), 0.9)
	var roof := _mat(Color(0.2, 0.22, 0.26), 0.5, 0.5)
	var seats := [_mat(Color(0.15, 0.5, 0.85), 0.7), _mat(Color(0.85, 0.2, 0.2), 0.7), _mat(Color(0.95, 0.75, 0.2), 0.7)]
	for st in track.def.stands:
		var len: float = float(st.z1) - float(st.z0)
		var zc: float = (float(st.z0) + float(st.z1)) * 0.5
		var x: float = float(st.x)
		var toward := -1.0 if x > 0 else 1.0     # the seats face the track
		for tier in 8:
			var h := 0.8 + tier * 0.8
			var off := tier * 1.6
			_box(Vector3(1.6, h, len), Vector3(x - toward * off, h * 0.5, zc), concrete)
			var row: Material = seats[tier % 3]
			var n := int(len / 1.1)
			for i in n:
				var seat := MeshInstance3D.new()
				var bm := BoxMesh.new()
				bm.size = Vector3(0.9, 0.5, 0.8)
				seat.mesh = bm
				seat.position = Vector3(x - toward * off + toward * 0.2, h + 0.25, float(st.z0) + 0.55 + i * 1.1)
				seat.material_override = row
				world.add_child(seat)
		_box(Vector3(16.0, 0.3, len + 4.0), Vector3(x - toward * 6.0, 9.4, zc), roof)
		for z: float in [float(st.z0), zc, float(st.z1)]:
			_box(Vector3(0.4, 9.4, 0.4), Vector3(x - toward * 13.0, 4.7, z), concrete)
		# a crowd: coloured heads along the tiers
		var crowd := _mat(Color(0.9, 0.8, 0.7), 0.9)
		for i in 160:
			var tier := _rng.randi() % 8
			var head := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.16
			sm.height = 0.32
			head.mesh = sm
			head.position = Vector3(x - toward * (tier * 1.6) + toward * 0.2, 0.8 + tier * 0.8 + 0.9, float(st.z0) + _rng.randf() * len)
			head.material_override = crowd
			world.add_child(head)

## the pit lane beside the main straight: its own asphalt, the pit wall, garages behind
func _pit() -> void:
	var p: Dictionary = track.def.pit
	var len: float = float(p.z1) - float(p.z0)
	var zc: float = (float(p.z0) + float(p.z1)) * 0.5
	var x: float = float(p.x)
	_box(Vector3(8.0, 0.08, len), Vector3(x, 0.0, zc), _mat(Color(0.2, 0.2, 0.21), 0.85))
	_box(Vector3(0.5, 1.0, len), Vector3(x - 4.6, 0.5, zc), _mat(Color(0.75, 0.75, 0.72), 0.7))
	var g := _mat(Color(0.3, 0.32, 0.36), 0.6, 0.3)
	for i in 6:
		_box(Vector3(8.0, 4.0, 10.0), Vector3(x + 9.0, 2.0, float(p.z0) + 6.0 + i * 13.0), g)
	obstacles.append(AABB(Vector3(x - 4.85, 0, float(p.z0)), Vector3(0.5, 1.0, len)))

## the start-light gantry over the line
func _gantry() -> void:
	var s0 := track.at(float(track.def.start))
	var f0 := track.dir_at(float(track.def.start))
	var side := Vector3(f0.z, 0, -f0.x)
	var steel := _mat(Color(0.3, 0.32, 0.35), 0.4, 0.7)
	for s: float in [-1.0, 1.0]:
		_box(Vector3(0.4, 7.0, 0.4), s0 + side * s * (track.width * 0.5 + 1.5) + Vector3(0, 3.5, 0), steel)
	_box(Vector3(track.width + 3.4, 0.4, 0.4), s0 + Vector3(0, 7.0, 0), steel, atan2(f0.x, f0.z))
	for i in 5:
		var mi := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.22
		sm.height = 0.44
		mi.mesh = sm
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.2, 0.05, 0.05)
		m.emission_enabled = true
		m.emission = Color(0.8, 0.05, 0.05)
		m.emission_energy_multiplier = 0.0
		mi.material_override = m
		mi.position = s0 + side * ((i - 2) * 1.2) + Vector3(0, 6.5, 0)
		mi.set_meta("dynamic", true)   # the start lights change colour
		world.add_child(mi)
		lights.append(mi)

# --------------------------------------------------------------------------------------------- the street circuit
## Neon City at night: a wet black sky, violet fog, the city's glow (the owner's Neon City target frame)
func _night() -> void:
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.55, 0.6, 1.0)
	moon.light_energy = 0.35
	moon.rotation_degrees = Vector3(-50, 30, 0)
	world.add_child(moon)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.03, 0.02, 0.07)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.3, 0.25, 0.45)
	env.ambient_light_energy = 0.9
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = Color(0.3, 0.12, 0.4)
	env.fog_density = 0.006
	env.glow_enabled = true
	env.glow_intensity = 0.8
	env.glow_bloom = 0.05
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)

func _glow(c: Color, energy := 3.0) -> StandardMaterial3D:
	var m := _mat(c, 0.4)
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

## the circuit through the blocks: wet asphalt, lane paint, pavements, concrete barriers both sides (the obstacles),
## towers on every free lot with lit windows and neon signs, street lights; whatever is off the road is pavement
func _build_streets() -> void:
	const NEON := [Color(1.0, 0.18, 0.62), Color(0.15, 0.85, 1.0), Color(0.62, 0.3, 1.0), Color(1.0, 0.62, 0.15), Color(0.25, 1.0, 0.55)]
	var pave := Materials.pbr("brushed_concrete", Color(0.32, 0.31, 0.34), 3.0, 0.7)
	_box(Vector3(460, 0.1, 460), Vector3(-70, -0.06, 10), pave)
	var asphalt := Materials.pbr("asphalt_02", Color(0.42, 0.42, 0.46), 4.0, 0.35)
	var paint := _mat(Color(0.9, 0.9, 0.85), 0.5)
	var barrier := Materials.pbr("concrete_floor", Color(0.7, 0.7, 0.68), 1.0, 0.8)
	var stripe := [_mat(Color(0.85, 0.12, 0.1), 0.6), _mat(Color(0.92, 0.92, 0.9), 0.6)]
	var step := 3.0
	var d := 0.0
	var k := 0
	while d < track.length:
		var c := track.at(d + step * 0.5)
		var f := track.dir_at(d + step * 0.5)
		var yaw := atan2(f.x, f.z)
		var side := Vector3(f.z, 0, -f.x)
		_box(Vector3(track.width + 1.0, 0.08, step + 1.8), c, asphalt, yaw)
		if k % 3 == 0:
			_box(Vector3(0.18, 0.09, 2.2), c, paint, yaw)
		for s: float in [-1.0, 1.0]:
			_box(Vector3(0.15, 0.09, step + 0.4), c + side * s * (track.width * 0.5 - 0.6), paint, yaw)
			# the barrier: a jersey wall, striped where the corners are
			var bp := c + side * s * (track.width * 0.5 + 0.9)
			var curved: bool = track.curvature_ahead(c, 6.0) > 0.25
			_box(Vector3(0.6, 0.9, step + 0.6), bp + Vector3(0, 0.45, 0), stripe[k % 2] if curved else barrier, yaw)
			# a street light every 8 samples, leaning over the road
			if k % 8 == 4:
				var lp := c + side * s * (track.width * 0.5 + 2.4)
				_box(Vector3(0.18, 7.0, 0.18), lp + Vector3(0, 3.5, 0), _mat(Color(0.2, 0.2, 0.22), 0.4, 0.8))
				_box(Vector3(2.2, 0.12, 0.35), lp + Vector3(0, 7.0, 0) - side * s * 1.0, _mat(Color(0.2, 0.2, 0.22), 0.4, 0.8), yaw + PI * 0.5)
				_box(Vector3(1.2, 0.06, 0.3), lp + Vector3(0, 6.92, 0) - side * s * 1.4, _glow(Color(1.0, 0.82, 0.55), 4.0), yaw + PI * 0.5)
				if k % 24 == 4:
					var l := OmniLight3D.new()
					l.light_color = Color(1.0, 0.8, 0.55)
					l.light_energy = 1.6
					l.omni_range = 18.0
					l.position = lp + Vector3(0, 6.5, 0) - side * s * 1.4
					world.add_child(l)
		d += step
		k += 1
	# the towers: on a 16 m grid, wherever a lot is clear of the road by 5 m
	var facade_mats := [Materials.pbr("painted_plaster_wall", Color(0.25, 0.25, 0.3), 3.0), Materials.pbr("brick_4", Color(0.45, 0.4, 0.42), 3.0), Materials.pbr("metal_plate", Color(0.3, 0.32, 0.38), 3.0, 0.5, 0.6)]
	var win := _glow(Color(1.0, 0.85, 0.6), 1.6)
	var win_cool := _glow(Color(0.6, 0.85, 1.0), 1.6)
	var signs := 0
	for gx in range(-190, 60, 16):
		for gz in range(-180, 200, 16):
			var p := Vector3(gx, 0, gz)
			var half := 6.5
			var clear := track.width * 0.5 + 5.0
			var ok := true
			for q in [p, p + Vector3(half, 0, half), p + Vector3(-half, 0, half), p + Vector3(half, 0, -half), p + Vector3(-half, 0, -half)]:
				if float(track.nearest(q)[1]) < clear:
					ok = false
					break
			if not ok:
				continue
			var near := float(track.nearest(p)[1])
			var h := _rng.randf_range(14.0, 34.0) if near < 40.0 else _rng.randf_range(30.0, 70.0)
			_box(Vector3(13, h, 13), p + Vector3(0, h * 0.5, 0), facade_mats[_rng.randi() % 3])
			if near > 45.0:
				continue
			# lit windows on the face toward the road, a neon sign on some
			var toward: Vector3 = track.at(float(track.nearest(p)[0])) - p
			var face := Vector3(signf(toward.x), 0, 0) if absf(toward.x) > absf(toward.z) else Vector3(0, 0, signf(toward.z))
			var across := Vector3(face.z, 0, face.x)
			for fl in int(h / 3.4):
				for col in 3:
					if _rng.randf() < 0.55:
						_box(Vector3(2.2, 1.3, 2.2) * (Vector3.ONE - Vector3(absf(face.x), 0, absf(face.z))) + Vector3(absf(face.x), 0, absf(face.z)) * 0.08, p + face * 6.52 + across * (-4.0 + col * 4.0) + Vector3(0, 2.4 + fl * 3.4, 0), win if (fl + col) % 4 else win_cool)
			if signs < 22 and _rng.randf() < 0.6:
				signs += 1
				var nc: Color = NEON[_rng.randi() % NEON.size()]
				var sp := p + face * 6.75 + Vector3(0, _rng.randf_range(5.0, minf(h - 3.0, 14.0)), 0)
				var sg := _box(Vector3(6.0, 1.6, 6.0) * (Vector3.ONE - Vector3(absf(face.x), 0, absf(face.z))) + Vector3(absf(face.x), 0, absf(face.z)) * 0.2, sp, _glow(nc, 3.5))
				sg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				if signs % 4 == 0:
					var l := OmniLight3D.new()
					l.light_color = nc
					l.light_energy = 2.0
					l.omni_range = 16.0
					l.position = sp + face * 2.0
					world.add_child(l)
	# the start line and a banner over it
	var s0 := track.at(float(track.def.start))
	var f0 := track.dir_at(float(track.def.start))
	var check := [_mat(Color(0.95, 0.95, 0.95), 0.5), _mat(Color(0.05, 0.05, 0.05), 0.5)]
	var side0 := Vector3(f0.z, 0, -f0.x)
	for i in 12:
		for j in 2:
			_box(Vector3(track.width / 12.0, 0.09, 0.5), s0 + side0 * (-track.width * 0.5 + (i + 0.5) * track.width / 12.0) + f0 * (j * 0.5) + Vector3(0, 0.01, 0), check[(i + j) % 2], atan2(f0.x, f0.z))
	var banner := Label3D.new()
	banner.text = "NEON NIGHT CIRCUIT"
	banner.font_size = 150
	banner.pixel_size = 0.012
	banner.modulate = Color(1.0, 0.35, 0.75)
	banner.shaded = false
	banner.position = s0 + Vector3(0, 8.4, 0)
	banner.rotation.y = atan2(f0.x, f0.z) + PI
	world.add_child(banner)

# --------------------------------------------------------------------------------------------- the cars
func _spawn_car(file: String, at: Transform3D, vehicle: String) -> RefCounted:
	var node: Node3D
	if ResourceLoader.exists(FLEET + file):
		node = (load(FLEET + file) as PackedScene).instantiate() as Node3D
	else:
		node = Node3D.new()
	StreetCar.face_forward(node)
	StaticBatch.compact(node)
	world.add_child(node)
	node.transform = at
	var perf := { "max_speed": 34.0, "acceleration": 11.0, "steering": 1.1, "braking": 16.0 }
	if vehicle != "":
		var state := GarageState.load_or_fresh()
		var pp: Dictionary = DriveProfile.performance(state, vehicle)
		if not pp.is_empty():
			perf = pp
	var sc := StreetCar.new(node, vehicle, perf)
	sc.bounds = Rect2(-250, -250, 500, 500)
	sc.obstacles = obstacles
	sc.skip = obstacles.size()
	obstacles.append(sc.box())
	sc.set_meta("box_index", sc.skip)
	return sc

func _grid() -> void:
	race = Race.new(track, int(track.def.laps))
	var v := Catalog.vehicle(vehicle_id)
	var file := String(v.get("model", FLEET + "tuner.glb")).get_file() if not v.is_empty() else "tuner.glb"
	# rivals take the front rows, you start last
	for i in 3:
		var sc := _spawn_car(RIVAL_FILES[i], track.grid(i), "")
		var e := race.add(STREET_NAMES[i] if track.street() else RIVAL_NAMES[i])
		rivals.append({ "sc": sc, "entry": e, "skill": 0.86 + i * 0.05 })
	player = _spawn_car(file, track.grid(3), vehicle_id)
	race.add("You", true)
	cam_yaw = player.yaw()

var _engine_on := false
var _lit_was := 0

func _exit_tree() -> void:
	Sound.loop_stop("race_engine")

func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	# the race had no sound at all: the engine idles on the grid and climbs with the speed, the lights beep
	if not _engine_on:
		_engine_on = true
		Sound.loop("race_engine", "engine", -10.0, 0.6)
	Sound.loop_set("race_engine", 0.6 + clampf(absf(player.speed) / maxf(float(player.profile.max_speed), 1.0), 0.0, 1.0) * 1.3, -10.0 + clampf(absf(player.speed) / 30.0, 0.0, 1.0) * 5.0)
	if countdown > 0.0:
		countdown -= dt
		var lit := clampi(int(ceil((3.5 - countdown) / 0.7)), 0, 5)
		if lit != _lit_was:
			_lit_was = lit
			if lit > 0:
				Sound.sfx("click", -4.0, 0.0)
		for i in lights.size():
			(lights[i].material_override as StandardMaterial3D).emission_energy_multiplier = 3.0 if i < lit else 0.0
		if countdown <= 0.0:
			for l in lights:
				(l.material_override as StandardMaterial3D).emission = Color(0.1, 0.9, 0.2)
				(l.material_override as StandardMaterial3D).emission_energy_multiplier = 3.0
			race.start()
			# the owner's campaign draft: a rival's needle on the street, NOVA on the line (VEHICLES_005 / 004)
			if _barks == null:
				_barks = preload("res://scripts/cinema/barks.gd").new()
				add_child(_barks)
			_barks.say("VEHICLES_005" if track.street() else "VEHICLES_004")
		hud.text = "GET READY" if countdown > 0.5 else "GO"
		_place_camera(dt)
		return
	# the player's car
	var throttle: float = controls.move.y
	var steer: float = -controls.move.x
	if controls.touch_ui and not controls.scripted:
		# phone racing (owner's phone test, Nov 9: "racing sucks"): the car drives itself forward, the left thumb only
		# steers (pull the stick down to reverse), BRAKE slows for the corners, and a light steering assist holds the
		# racing line when the thumb is off the stick
		throttle = controls.move.y if controls.move.y < -0.45 else 1.0
		steer = -controls.move.x
		if absf(steer) < 0.12:
			var ahead: Vector3 = track.ahead(player.node.position, 16.0)
			var to2: Vector3 = ahead - player.node.position
			var err2 := wrapf(atan2(-to2.x, -to2.z) - player.node.rotation.y, -PI, PI)
			steer = clampf(err2 * 1.2, -0.4, 0.4)
	if not controls.touch_ui and not controls.scripted:
		throttle = (1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0)
		steer = (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0)
	if autopilot:
		var aim: Vector3 = track.ahead(player.node.position, 14.0)
		var to: Vector3 = aim - player.node.position
		var err := wrapf(atan2(-to.x, -to.z) - player.node.rotation.y, -PI, PI)
		steer = clampf(err * 2.5, -1.0, 1.0)
		var pc: float = maxf(track.curvature_ahead(player.node.position, 26.0), track.curvature_ahead(player.node.position, 44.0) if track.street() else 0.0)
		throttle = clampf((float(player.profile.max_speed) * (1.0 - (0.68 if track.street() else 0.55) * pc) - player.speed) / 4.0, -1.0, 1.0)
	if race.finished or race.player().finished_at >= 0.0:
		throttle = 0.0
	_step_car(player, dt, throttle, steer, controls.brake())
	# the rivals: aim at a point ahead on the centreline, ease off for the corners, skill sets the pace
	for r in rivals:
		var sc: RefCounted = r.sc
		var n: Node3D = sc.node
		var aim: Vector3 = track.ahead(n.position, 14.0)
		var to := aim - n.position
		var want_yaw := atan2(-to.x, -to.z)
		var err := wrapf(want_yaw - n.rotation.y, -PI, PI)
		var curve: float = maxf(track.curvature_ahead(n.position, 26.0), track.curvature_ahead(n.position, 44.0) if track.street() else 0.0)
		var top: float = float(sc.profile.max_speed) * float(r.skill) * (1.0 - (0.68 if track.street() else 0.55) * curve)
		var thr := clampf((top - sc.speed) / 4.0, -1.0, 1.0)
		var e: Dictionary = r.entry
		if e.finished_at >= 0.0:
			thr = -0.2
		_step_car(sc, dt, thr, clampf(err * 2.5, -1.0, 1.0), 0.0)
	# the race
	var positions: Array = [rivals[0].sc.node.position, rivals[1].sc.node.position, rivals[2].sc.node.position, player.node.position]
	race.tick(dt, positions)
	var me: Dictionary = race.player()
	var place := race.position_of(me)
	hud.text = "P%d / 4   LAP %d / %d   %s\n%d km/h%s" % [place, mini(me.laps + 1, race.laps_to_go), race.laps_to_go, _fmt(race.time - me.lap_start), int(absf(player.speed) * 3.6), ("   best " + _fmt(me.best_lap)) if me.best_lap > 0.0 else ""]
	var lines: Array = []
	var i := 1
	for e in race.order():
		lines.append("%d  %s%s" % [i, e.name, ("  ✓" if e.finished_at >= 0.0 else "")])
		i += 1
	board.text = "\n".join(lines)
	if me.finished_at >= 0.0 and not _prize_paid:
		_finish()
	_place_camera(dt)

## grass slows a car, and the tyre walls stop it (the obstacle list); on a street circuit the barriers are the track's edge:
## a car that reaches one is held on the road and scrubs speed along it
func _step_car(sc: RefCounted, dt: float, throttle: float, steer: float, brake: float) -> void:
	sc.step(dt, throttle, steer, brake)
	if track.street():
		var n: Array = track.nearest(sc.node.position)
		var lim := track.width * 0.5 + 0.2
		if float(n[1]) > lim:
			var q := track.at(float(n[0]))
			var out := Vector3(sc.node.position.x - q.x, 0, sc.node.position.z - q.z).normalized()
			sc.node.position = Vector3(q.x + out.x * lim, sc.node.position.y, q.z + out.z * lim)
			sc.speed *= pow(0.3, dt)
		obstacles[int(sc.get_meta("box_index"))] = sc.box()
		return
	if track.off_track(sc.node.position):
		# grass: no grip past a crawl
		var crawl: float = float(sc.profile.max_speed) * 0.35
		if absf(sc.speed) > crawl:
			sc.speed = move_toward(sc.speed, signf(sc.speed) * crawl, (4.0 + absf(sc.speed) * 0.9) * dt)
	obstacles[int(sc.get_meta("box_index"))] = sc.box()

func _place_camera(dt: float) -> void:
	var n: Node3D = player.node
	var look: Vector2 = controls.take_look() if controls else Vector2.ZERO
	cam_yaw -= look.x * 0.0045
	cam_yaw = lerp_angle(cam_yaw, n.rotation.y, minf(1.0, 2.5 * dt) if look.x == 0.0 else 0.0)
	var pivot := n.position + Vector3(0, 1.4, 0)
	var back := Vector3(sin(cam_yaw), 0.28, cos(cam_yaw)).normalized()
	var want := pivot + back * 8.5
	var k := 1.0 if dt >= 1.0 else 1.0 - exp(-10.0 * dt)
	cam.position = cam.position.lerp(want, k)
	cam.look_at(pivot + Vector3(0, 0.6, 0))
	# an upright phone keeps the width of the road in view rather than the sky
	var vs := get_viewport_rect().size
	cam.keep_aspect = Camera3D.KEEP_WIDTH if vs.y > vs.x else Camera3D.KEEP_HEIGHT
	cam.fov = 78.0 if vs.y > vs.x else 62.0

static func _fmt(t: float) -> String:
	if t <= 0.0:
		return "--:--.-"
	return "%d:%04.1f" % [int(t / 60.0), fmod(t, 60.0)]

## the chequered flag: the best lap to drive_records, the prize into the profile
func _finish() -> void:
	_prize_paid = true
	var me: Dictionary = race.player()
	var rec := Records.new()
	rec.load_records()
	var prev: float = float(rec.best.get(vehicle_id, 0.0))
	if me.best_lap > 0.0 and (prev <= 0.0 or me.best_lap < prev):
		rec.best[vehicle_id] = me.best_lap
	rec.laps[vehicle_id] = int(rec.laps.get(vehicle_id, 0)) + me.laps
	rec.save_records()
	var prize := race.prize()
	var profile := { "xp": 0, "nex": 0, "level": 1 }
	var f := FileAccess.open(PROFILE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			profile.merge(d, true)
	var res := Progression.grant(profile, "race", prize, 150, "Race")
	for l in res.lines:
		controls.toast(String(l))
	var w := FileAccess.open(PROFILE, FileAccess.WRITE)
	if w:
		w.store_string(JSON.stringify(profile))
	finish_panel = PanelContainer.new()
	finish_panel.set_anchors_preset(Control.PRESET_CENTER)
	finish_panel.position = Vector2(-170, -90)
	var v := VBoxContainer.new()
	finish_panel.add_child(v)
	var t := Label.new()
	t.text = "P%d · %s\nbest lap %s\n+%d Nex   +150 XP" % [race.position_of(me), String(track.def.name), _fmt(me.best_lap), prize]
	t.add_theme_font_size_override("font_size", 22)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var b := Button.new()
	b.text = "LEAVE THE TRACK"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): closed.emit())
	v.add_child(b)
	add_child(finish_panel)
