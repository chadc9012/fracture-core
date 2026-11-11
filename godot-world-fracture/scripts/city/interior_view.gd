extends Control
## A walk-in building off the Nexus avenue (interiors.gd ROOMS): the room's shell, light and sound from its row, its set
## from interior_sets.gd, the operator on foot with weapons stowed, and the street door to walk back out of. main.gd
## `_street_door` opens it over the hidden street; `closed` brings the street back.
##
## The builders call the helpers here (box / cyl / panel / lamp / text / person / model); solid things also become the
## operator's obstacle boxes (axis-aligned, so pass yaw only in quarter turns for solid pieces). Static pieces go under
## `static_root` and are folded by StaticBatch; anything that moves goes under `world` and registers a step with
## `animate`.

signal closed

const Interiors := preload("res://scripts/city/interiors.gd")
const Sets := preload("res://scripts/city/interior_sets.gd")
const Phone := preload("res://scripts/phone.gd")
const Materials := preload("res://scripts/city/materials.gd")
const StaticBatch := preload("res://scripts/static_batch.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const Casino := preload("res://scripts/city/casino_interior.gd")
const Sound := preload("res://scripts/audio/sound.gd")

var room_id := "hospital"
var room: Dictionary
var world: Node3D
var static_root: Node3D
var cam: Camera3D
var operator: Node3D
var controls: Control
var obstacles: Array[AABB] = []
var spots: Array = []            # [{id, label, pos, r}]
var rng := RandomNumberGenerator.new()
var _vp: SubViewport
var _steps: Array[Callable] = []
var _t := 0.0
var _near := ""
var _look: Array = []
var _hud: Label
var _flats := {}

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	room = Interiors.room(room_id)
	if room.is_empty():
		room_id = "hospital"
		room = Interiors.room(room_id)
	rng.seed = hash(room_id)
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
	_shell()
	Sets.build(self, String(room.kind))
	StaticBatch.batch(static_root)
	cam = Camera3D.new()
	cam.fov = 66.0
	cam.near = 0.05
	cam.far = 400.0
	world.add_child(cam)
	cam.current = true
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	world.add_child(operator)
	operator.bounds = Interiors.bounds(room)
	operator.obstacles = obstacles
	operator.position = Interiors.spawn(room)
	operator.heading = PI
	operator.cam_dist = 3.4     # rooms are close: the chase camera stays in under the ceiling
	operator.build()
	operator.attach_camera(cam)
	var gear := Gear.load_save()
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	controls.set_armed(false)
	spots.append({ "id": "exit", "label": "EXIT TO STREET", "pos": Interiors.exit_spot(room), "r": 1.8 })
	_hud = Label.new()
	_hud.position = Vector2(16, 10)
	_hud.add_theme_font_size_override("font_size", 20)
	_hud.add_theme_color_override("font_outline_color", Color.BLACK)
	_hud.add_theme_constant_override("outline_size", 6)
	_hud.text = String(room.label)
	add_child(_hud)
	controls.toast(String(room.label))
	Sound.loops_stop()
	Sound.loop("bed", String(room.get("bed", "nexus-hum")), -20.0, 1.0)

func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	_t += dt
	for s in _steps:
		s.call(_t, dt)
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if not _look.is_empty():
		cam.position = _look[0]
		cam.look_at(_look[1])
	var near := ""
	var label := ""
	for s in spots:
		var p: Vector3 = s.pos
		if Vector2(operator.position.x - p.x, operator.position.z - p.z).length() < float(s.get("r", 2.0)):
			near = String(s.id)
			label = String(s.label)
			break
	if near != _near:
		_near = near
		controls.prompt(label)
	if controls.take_enter() and near != "":
		_use(near)

func _use(id: String) -> void:
	if id == "exit":
		Sound.sfx("door", -4.0)
		closed.emit()
		return
	var s: Dictionary = {}
	for x in spots:
		if String(x.id) == id:
			s = x
	if s.has("say"):
		controls.toast(String(s.say))

## a fixed camera for look-dev shots (main.gd --shot interior:<id>:x,y,z:tx,ty,tz)
func look_from(from: Vector3, to: Vector3) -> void:
	_look = [from, to]

func _exit_tree() -> void:
	Sound.loops_stop()

# --------------------------------------------------------------------------------------------- the room
func _environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.02, 0.03)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = (room.light as Color).lerp(Color(0.6, 0.62, 0.7), 0.4)
	env.ambient_light_energy = float(room.ambient)
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.05
	env.glow_hdr_threshold = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	# a soft key from above so the room reads in shape (no shadows: the lamps carry the mood)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-65, 30, 0)
	key.light_energy = 0.35
	key.light_color = room.light
	world.add_child(key)

## floor, ceiling, walls with a skirting line and the street door with the city glowing through it
func _shell() -> void:
	var w: float = room.w
	var d: float = room.d
	var h: float = room.h
	var fl: Array = room.floor
	var floor_mat := Materials.pbr(String(fl[0]), fl[1], float(fl[2]), 0.8) if Materials.has(String(fl[0])) else flat(fl[1], 0.6)
	box(Vector3(w, 0.2, d), Vector3(0, -0.1, -d * 0.5), floor_mat)
	var ceil := flat((room.wall as Color).lightened(0.25), 0.9)
	box(Vector3(w, 0.2, d), Vector3(0, h + 0.1, -d * 0.5), ceil)
	# painted walls: the plaster's relief under the room's own paint colour (its photo colour greyed every room)
	var wall := Materials.surface("painted_plaster_wall", room.wall, 3.0) if Materials.has("painted_plaster_wall") else flat(room.wall)
	var trim := flat(room.trim, 0.5, 0.1)
	# back and sides
	box(Vector3(w, h, 0.3), Vector3(0, h * 0.5, -d - 0.15), wall, true)
	for sx: float in [-1.0, 1.0]:
		box(Vector3(0.3, h, d), Vector3(sx * (w * 0.5 + 0.15), h * 0.5, -d * 0.5), wall, true)
		box(Vector3(0.04, 0.14, d), Vector3(sx * (w * 0.5 - 0.02), 0.07, -d * 0.5), trim)
	box(Vector3(w, 0.14, 0.04), Vector3(0, 0.07, -d + 0.02), trim)
	# the front wall with the street door (3 m wide, glass, the avenue's night light beyond)
	var side_w := (w - 3.0) * 0.5
	for sx: float in [-1.0, 1.0]:
		box(Vector3(side_w, h, 0.3), Vector3(sx * (1.5 + side_w * 0.5), h * 0.5, 0.15), wall, true)
	box(Vector3(3.0, h - 2.8, 0.3), Vector3(0, 2.8 + (h - 2.8) * 0.5, 0.15), wall)
	box(Vector3(3.0, 2.8, 0.05), Vector3(0, 1.4, 0.32), emissive(Color(0.25, 0.3, 0.55), 0.8))
	box(Vector3(3.2, 0.12, 0.2), Vector3(0, 2.86, 0.0), flat(Color(0.2, 0.2, 0.22), 0.4, 0.8))
	for sx: float in [-1.0, 1.0]:
		box(Vector3(0.1, 2.8, 0.2), Vector3(sx * 1.55, 1.4, 0.0), flat(Color(0.2, 0.2, 0.22), 0.4, 0.8))
	text("EXIT", Vector3(0, 3.15, -0.05), 0.0, Color(0.2, 1.0, 0.4), 48)
	box(Vector3(3.0, 0.02, 1.6), Vector3(0, 0.01, -0.9), flat(Color(0.12, 0.12, 0.13), 0.95))   # the door mat

# --------------------------------------------------------------------------------------------- helpers for the sets
func flat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f" % [c.to_html(), rough, metal]
	if _flats.has(key):
		return _flats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	# indoors there is no sky to reflect: full metal reads black, so brass and chrome keep half their colour
	m.metallic = minf(metal, 0.55)
	m.metallic_specular = 0.7
	if c.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_flats[key] = m
	return m

func emissive(c: Color, energy := 2.0) -> StandardMaterial3D:
	var key := "e|%s|%.2f" % [c.to_html(), energy]
	if _flats.has(key):
		return _flats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	_flats[key] = m
	return m

func pbr(set: String, tint: Color, tile := 1.0, rough := 1.0) -> BaseMaterial3D:
	return Materials.pbr(set, tint, tile, rough) if Materials.has(set) else flat(tint, 0.7 * rough)

## a box with its base centre at `pos` minus half its height (pos is the centre); solid: an obstacle box too
func box(size: Vector3, pos: Vector3, mat: Material, solid := false, yaw := 0.0, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation.y = yaw
	(parent if parent else static_root).add_child(mi)
	if solid:
		var s := size
		if absf(sin(yaw)) > 0.7:
			s = Vector3(size.z, size.y, size.x)
		obstacles.append(AABB(pos - s * 0.5, s))
	return mi

func cyl(r: float, h: float, pos: Vector3, mat: Material, solid := false, r_top := -1.0, segs := 16, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = r
	cm.top_radius = r if r_top < 0.0 else r_top
	cm.height = h
	cm.radial_segments = segs
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	mi.position = pos
	(parent if parent else static_root).add_child(mi)
	if solid:
		obstacles.append(AABB(pos - Vector3(r, h * 0.5, r), Vector3(r * 2.0, h, r * 2.0)))
	return mi

## an invisible obstacle (a counter's footprint drawn from several pieces, say)
func block(size: Vector3, centre: Vector3) -> void:
	obstacles.append(AABB(centre - size * 0.5, size))

## a lamp: a light (counted against the phone's budget by the caller) plus nothing visible
func lamp(pos: Vector3, c: Color, energy := 1.6, rng_m := 9.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = c
	l.light_energy = energy
	l.omni_range = rng_m
	l.omni_attenuation = 1.4
	l.shadow_enabled = false
	world.add_child(l)
	return l

## a lit ceiling panel with a lamp under every other one (the room's light grid)
func ceiling_panels(cols: int, rows: int, size: Vector2, c: Color, energy := 1.2, x0 := 0.0, z0 := 0.0, span := Vector2.ZERO) -> void:
	var w: float = room.w if span == Vector2.ZERO else span.x
	var d: float = room.d if span == Vector2.ZERO else span.y
	var h: float = room.h
	var mat := emissive(c, 2.4)
	var lit := 0
	for i in cols:
		for j in rows:
			var x := x0 - w * 0.5 + w * (i + 0.5) / cols
			var z := z0 - d * (j + 0.5) / rows
			box(Vector3(size.x, 0.05, size.y), Vector3(x, h - 0.03, z), mat)
			if (i + j) % 2 == 0 and lit < 12:
				lamp(Vector3(x, h - 0.6, z), c, energy, maxf(w / cols, d / rows) * 2.2)
				lit += 1

func text(t: String, pos: Vector3, yaw: float, c: Color, size := 64, px := 0.01, parent: Node3D = null) -> Label3D:
	var l := Label3D.new()
	l.text = t
	l.font_size = size
	l.pixel_size = px
	l.modulate = c
	l.outline_size = 0
	l.shaded = false
	l.position = pos
	l.rotation.y = yaw
	(parent if parent else world).add_child(l)
	return l

## a standing / seated person (casino_interior.gd's figure): pose 0 standing, 1 arms up, 2 one arm up, 3 seated
func person(pos: Vector3, yaw: float, pose: int, outfit: Color, solid := true) -> MeshInstance3D:
	if solid:
		block(Vector3(0.6, 1.8, 0.6), pos + Vector3(0, 0.9, 0))
	var figures: Script = Casino
	if not figures.can_instantiate():
		return null     # casino_interior.gd needs the game's autoloads (a --script test has none): the room without people
	var mi := MeshInstance3D.new()
	mi.mesh = Casino.figure(pose, rng.randf() < 0.5)
	mi.set_surface_override_material(0, flat(outfit, 0.6, 0.05))
	mi.set_surface_override_material(1, flat(Casino.SKINS[rng.randi() % Casino.SKINS.size()], 0.6))
	mi.set_surface_override_material(2, flat(Casino.HAIRS[rng.randi() % Casino.HAIRS.size()], 0.5))
	mi.position = pos
	mi.rotation.y = yaw
	mi.scale = Vector3.ONE * rng.randf_range(0.95, 1.05)
	world.add_child(mi)
	return mi

## an authored model scaled to `h` metres tall, standing on the floor at `pos`; solid: its footprint is an obstacle
func model(path: String, h: float, pos: Vector3, yaw := 0.0, solid := true, parent: Node3D = null) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var m := (load(path) as PackedScene).instantiate() as Node3D
	(parent if parent else static_root).add_child(m)
	var bb := _bounds(m)
	if bb.size.y <= 0.001:
		return m
	var s := h / bb.size.y
	m.scale = Vector3.ONE * s
	m.rotation.y = yaw
	m.position = pos - Vector3(0, bb.position.y * s, 0)
	var c := bb.get_center() * s
	m.position -= Basis(Vector3.UP, yaw) * Vector3(c.x, 0, c.z)
	if solid:
		var foot := Vector3(bb.size.x, bb.size.y, bb.size.z) * s
		if absf(sin(yaw)) > 0.7:
			foot = Vector3(foot.z, foot.y, foot.x)
		block(foot, pos + Vector3(0, foot.y * 0.5, 0))
	return m

func _bounds(n: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var xf := n.global_transform.affine_inverse() * mi.global_transform if n.is_inside_tree() else Transform3D()
		var b: AABB = xf * mi.get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out

## something to walk up to and use: ENTER shows `say`
func spot(id: String, label: String, pos: Vector3, say: String, r := 2.0) -> void:
	spots.append({ "id": id, "label": label, "pos": pos, "say": say, "r": r })

## a per-frame step for the things that move: f(t, dt)
func animate(f: Callable) -> void:
	_steps.append(f)
