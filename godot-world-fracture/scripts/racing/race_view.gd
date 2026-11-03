extends Control
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
const FLEET := "res://models/fleet/"
const PROFILE := "user://profile.json"
const RIVAL_FILES := ["muscle-car-lod.glb", "street-racer-lod.glb", "tuner.glb"]
const RIVAL_NAMES := ["K. Voss", "Mara Lin", "D. Okafor"]

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
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	# you race the car you last drove (drive_session.json), the tuner until then
	var last: String = String(SessionStore.load_data().last_vehicle)
	if last != "" and not Catalog.vehicle(last).is_empty():
		vehicle_id = last
	track = Track.new(track_id)
	_environment()
	_build_track()
	_stands()
	_pit()
	_gantry()
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
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.86, 0.7)
	sun.light_energy = 2.4
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-48, 35, 0)
	world.add_child(sun)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var psm := ProceduralSkyMaterial.new()
	psm.sky_top_color = Color(0.22, 0.42, 0.72)
	psm.sky_horizon_color = Color(0.82, 0.72, 0.6)
	psm.ground_bottom_color = Color(0.2, 0.2, 0.18)
	psm.ground_horizon_color = Color(0.6, 0.55, 0.45)
	sky.sky_material = psm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = Color(0.8, 0.75, 0.65)
	env.fog_density = 0.0004
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)

## asphalt segments along the centreline with kerbs at both edges; grass under everything; a wall past the run-off
func _build_track() -> void:
	var grass := _mat(Color(0.26, 0.42, 0.18), 1.0)
	_box(Vector3(400, 0.1, 400), Vector3(-45, -0.06, 0), grass)
	var asphalt := _mat(Color(0.11, 0.11, 0.12), 0.9)
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
		world.add_child(mi)
		lights.append(mi)

# --------------------------------------------------------------------------------------------- the cars
func _spawn_car(file: String, at: Transform3D, vehicle: String) -> RefCounted:
	var node: Node3D
	if ResourceLoader.exists(FLEET + file):
		node = (load(FLEET + file) as PackedScene).instantiate() as Node3D
	else:
		node = Node3D.new()
	StreetCar.face_forward(node)
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
		var e := race.add(RIVAL_NAMES[i])
		rivals.append({ "sc": sc, "entry": e, "skill": 0.86 + i * 0.05 })
	player = _spawn_car(file, track.grid(3), vehicle_id)
	race.add("You", true)
	cam_yaw = player.yaw()

func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	if countdown > 0.0:
		countdown -= dt
		var lit := clampi(int(ceil((3.5 - countdown) / 0.7)), 0, 5)
		for i in lights.size():
			(lights[i].material_override as StandardMaterial3D).emission_energy_multiplier = 3.0 if i < lit else 0.0
		if countdown <= 0.0:
			for l in lights:
				(l.material_override as StandardMaterial3D).emission = Color(0.1, 0.9, 0.2)
				(l.material_override as StandardMaterial3D).emission_energy_multiplier = 3.0
			race.start()
		hud.text = "GET READY" if countdown > 0.5 else "GO"
		_place_camera(dt)
		return
	# the player's car
	var throttle: float = controls.move.y
	var steer: float = -controls.move.x
	if not controls.touch_ui and not controls.scripted:
		throttle = (1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0)
		steer = (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0)
	if autopilot:
		var aim: Vector3 = track.ahead(player.node.position, 14.0)
		var to: Vector3 = aim - player.node.position
		var err := wrapf(atan2(-to.x, -to.z) - player.node.rotation.y, -PI, PI)
		steer = clampf(err * 2.5, -1.0, 1.0)
		throttle = clampf((float(player.profile.max_speed) * (1.0 - 0.55 * track.curvature_ahead(player.node.position, 26.0)) - player.speed) / 4.0, -1.0, 1.0)
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
		var curve: float = track.curvature_ahead(n.position, 26.0)
		var top: float = float(sc.profile.max_speed) * float(r.skill) * (1.0 - 0.55 * curve)
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

## grass slows a car, and the tyre walls stop it (the obstacle list)
func _step_car(sc: RefCounted, dt: float, throttle: float, steer: float, brake: float) -> void:
	sc.step(dt, throttle, steer, brake)
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
	profile.nex = int(profile.nex) + prize
	profile.xp = int(profile.xp) + 150
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
