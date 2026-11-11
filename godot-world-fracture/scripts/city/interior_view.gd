extends Control
## A building you walk into off the avenue (owner's pick, Nov 11: "City interiors"; asset catalog part 2 §2). One view for
## all of them: its own 3D world, the operator on foot with the street's controls and camera, the walls and furniture
## as obstacle boxes (the camera pulls in off them), the people standing about, and the spots ENTER uses — the way out
## and each building's counter or attraction. interiors.gd builds the rooms; `kind` picks one, `style` the city.
## Weapons stay holstered indoors.
signal closed

const Interiors := preload("res://scripts/city/interiors.gd")
const Phone := preload("res://scripts/phone.gd")
const StaticBatch := preload("res://scripts/static_batch.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const Crowd := preload("res://scripts/city/crowd.gd")
const Sound := preload("res://scripts/audio/sound.gd")

var kind := "hospital"
var style := "nexus"
var profile: Dictionary
var world: Node3D
var static_root: Node3D
var cam: Camera3D
var operator: Node3D
var controls: Control
var obstacles: Array[AABB] = []
var spots: Array = []                  # [{id, label, pos, r}]
var room := Rect2(-15, -30, 30, 30)    # x, z extent the operator keeps inside
var spawn := Vector3(0, 0, -2)
var title := ""
## per-frame animation the builders hang on (a dance floor, a ceiling fan): Callable(dt)
var animate: Array[Callable] = []
## what the builder keeps for its own use (counters cycled, labels to refresh)
var data := {}
var _vp: SubViewport
var _hud: Label
var _near := ""
var _t := 0.0
var _look: Array = []

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	profile = Gear.profile_load()
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
	Interiors.build(self)
	StaticBatch.batch(static_root, 40.0)
	cam = Camera3D.new()
	cam.fov = 66.0
	cam.near = 0.05
	cam.far = 200.0
	world.add_child(cam)
	cam.current = true
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	world.add_child(operator)
	operator.bounds = room
	operator.obstacles = obstacles
	operator.position = spawn
	operator.heading = PI          # in through the street door, facing into the building (-z)
	operator.cam_dist = 3.4        # a closer shoulder camera indoors
	operator.build()
	operator.attach_camera(cam)
	OutfitLook.apply(operator.rig, Gear.outfit(str(Gear.load_save().get("outfit", ""))))
	controls.weapon_name.text = ""
	controls.ammo.text = ""
	_head()
	controls.toast(title)

## the top bar: where you are, your Nex, the way out
func _head() -> void:
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 12
	bar.offset_top = 8
	bar.offset_right = -12
	add_child(bar)
	var out := Button.new()
	out.text = "← STREET"
	out.pressed.connect(leave)
	bar.add_child(out)
	_hud = Label.new()
	_hud.add_theme_font_size_override("font_size", 16)
	_hud.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	bar.add_child(_hud)

func leave() -> void:
	Sound.sfx("door", -4.0)
	Interiors.left(self)
	closed.emit()

## a fixed camera for look-dev shots (main.gd --shot interior:<kind>:look=…)
func look_from(from: Vector3, to: Vector3) -> void:
	_look = [from, to]

func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	_t += dt
	for f in animate:
		f.call(dt)
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if not _look.is_empty():
		cam.position = _look[0]
		cam.look_at(_look[1])
	var near := ""
	var label := ""
	for s in spots:
		var p: Vector3 = s.pos
		if Vector2(operator.position.x - p.x, operator.position.z - p.z).length() < float(s.get("r", 2.6)):
			near = String(s.id)
			label = String(s.label)
			break
	if near != _near:
		_near = near
		controls.prompt(label)
	if controls.take_enter() and near != "":
		use(near)
	controls.take_next()
	controls.take_reload()
	_hud.text = "  %s   %d Nex" % [title, int(profile.get("nex", 0))]

## ENTER at a spot: the door out, or the building's own (interiors.gd)
func use(id: String) -> void:
	if id == "exit":
		leave()
		return
	Interiors.use(self, id)

## pay for something here; false (and a toast) if the Nex isn't there
func pay(nex: int, what: String) -> bool:
	if int(profile.get("nex", 0)) < nex:
		controls.toast("Not enough Nex for %s (%d)" % [what, nex])
		Sound.sfx("buzzer", -8.0)
		return false
	profile.nex = int(profile.get("nex", 0)) - nex
	Gear.profile_save(profile)
	Sound.sfx("confirm", -6.0)
	return true

# --------------------------------------------------------------------------------------------- the builders' kit
var _mats := {}

func mat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var k := "%s|%.2f|%.2f" % [c.to_html(), rough, metal]
	if not _mats.has(k):
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.roughness = rough
		m.metallic = metal
		_mats[k] = m
	return _mats[k]

func glow(c: Color, energy := 2.5) -> StandardMaterial3D:
	var k := "glow|%s|%.2f" % [c.to_html(), energy]
	if not _mats.has(k):
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = energy
		_mats[k] = m
	return _mats[k]

func glass(c := Color(0.6, 0.75, 0.85, 0.25)) -> StandardMaterial3D:
	var k := "glass|%s" % c.to_html()
	if not _mats.has(k):
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.roughness = 0.05
		m.metallic = 0.3
		_mats[k] = m
	return _mats[k]

## a box at `center`; solid ones (taller than a step) are obstacles the operator and the camera stop at.
## `moving` keeps it out of the static batch (something animate[] changes)
func box(size: Vector3, center: Vector3, m: Material, solid := true, moving := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	mi.position = center
	(world if moving else static_root).add_child(mi)
	if solid and size.y > 0.35:
		obstacles.append(AABB(center - size * 0.5, size))
	return mi

func cyl(r: float, h: float, base: Vector3, m: Material, solid := true, r_top := -1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r if r_top < 0.0 else r_top
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = 14
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = m
	mi.position = base + Vector3(0, h * 0.5, 0)
	static_root.add_child(mi)
	if solid:
		obstacles.append(AABB(base - Vector3(r, 0, r), Vector3(r * 2.0, h, r * 2.0)))
	return mi

func light(pos: Vector3, c: Color, energy := 1.2, range_m := 14.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = c
	l.light_energy = energy
	l.omni_range = range_m
	l.shadow_enabled = false
	world.add_child(l)
	return l

func sign(text: String, pos: Vector3, yaw: float, c: Color, size := 64, lit := true) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.008
	l.position = pos
	l.rotation.y = yaw
	l.modulate = c * (1.6 if lit else 1.0)
	l.shaded = not lit
	l.outline_size = 0 if lit else 8
	world.add_child(l)
	return l

func spot(id: String, label: String, pos: Vector3, r := 2.6) -> void:
	spots.append({ "id": id, "label": label, "pos": pos, "r": r })

## a model from res://models, scaled so its longest side is `fit` metres, standing on the floor at `pos`
func model(path: String, pos: Vector3, yaw: float, fit: float, solid := true) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var n: Node3D = (load(path) as PackedScene).instantiate()
	var bb := _bounds(n)
	var s := fit / maxf(maxf(bb.size.x, bb.size.z), 0.01)
	n.scale = Vector3.ONE * s
	n.rotation.y = yaw
	var c := bb.get_center() * s
	var off := Basis(Vector3.UP, yaw) * Vector3(c.x, 0, c.z)
	n.position = pos - off - Vector3(0, bb.position.y * s, 0)
	static_root.add_child(n)
	if solid:
		var sz := Basis(Vector3.UP, yaw) * (bb.size * s)
		var size := Vector3(absf(sz.x), bb.size.y * s, absf(sz.z))
		obstacles.append(AABB(Vector3(pos.x - size.x * 0.5, pos.y, pos.z - size.z * 0.5), size))
	return n

static func _bounds(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var t := Transform3D()
		var p: Node = m
		while p and p != n:
			if p is Node3D:
				t = (p as Node3D).transform * t
			p = p.get_parent()
		var b := t * m.mesh.get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out

## people standing about: [[pos, yaw], ...] as one crowd multimesh
func people(at: Array, seed := 7) -> void:
	if at.is_empty():
		return
	var c: MultiMeshInstance3D = Crowd.new()
	world.add_child(c)
	c.place(at, seed)

## the room: floor, ceiling and four walls round `r` (x, z), `h` tall, the street door (4 m) in the +z wall at x 0
func shell(r: Rect2, h: float, floor_m: Material, wall_m: Material, ceil_m: Material, door_w := 4.0) -> void:
	room = Rect2(r.position + Vector2(0.4, 0.4), r.size - Vector2(0.8, 0.8))
	var cx := r.get_center().x
	var cz := r.get_center().y
	box(Vector3(r.size.x, 0.2, r.size.y), Vector3(cx, -0.1, cz), floor_m, false)
	box(Vector3(r.size.x, 0.2, r.size.y), Vector3(cx, h + 0.1, cz), ceil_m, false)
	box(Vector3(0.3, h, r.size.y), Vector3(r.position.x, h * 0.5, cz), wall_m)
	box(Vector3(0.3, h, r.size.y), Vector3(r.end.x, h * 0.5, cz), wall_m)
	box(Vector3(r.size.x, h, 0.3), Vector3(cx, h * 0.5, r.position.y), wall_m)
	var side := (r.size.x - door_w) * 0.5
	box(Vector3(side, h, 0.3), Vector3(r.position.x + side * 0.5, h * 0.5, r.end.y), wall_m)
	box(Vector3(side, h, 0.3), Vector3(r.end.x - side * 0.5, h * 0.5, r.end.y), wall_m)
	box(Vector3(door_w, h - 3.0, 0.3), Vector3(0, 3.0 + (h - 3.0) * 0.5, r.end.y), wall_m, false)
	# the doorway glows with the street beyond
	box(Vector3(door_w, 3.0, 0.05), Vector3(0, 1.5, r.end.y + 0.2), glow(Color(0.75, 0.8, 0.9), 1.2), false)
	spawn = Vector3(0, 0, r.end.y - 3.0)
	spot("exit", "BACK TO THE STREET", Vector3(0, 0, r.end.y - 0.8), 1.8)

## the indoor light: an environment (ambient from a colour, no sky), and a soft key light
func environment(ambient: Color, energy := 0.9, bg := Color(0.04, 0.04, 0.05), glow_on := false) -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = bg
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = ambient
	env.ambient_light_energy = energy
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	if glow_on:
		env.glow_enabled = true
		env.glow_intensity = 0.9
		env.glow_bloom = 0.08
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-60, 30, 0)
	key.light_energy = 0.35
	key.shadow_enabled = false
	world.add_child(key)
