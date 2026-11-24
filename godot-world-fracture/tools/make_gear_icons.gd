extends SceneTree
## Gear tile art for the Character screen (Destiny's tiles show the item, not its name): each weapon frame's authored model
## rendered side-on, lit like a product shot, onto a transparent 256² PNG in res://ui/icons/weapon-<FRAME>.png.
##   xvfb-run -a godot --path godot-world-fracture --rendering-driver opengl3 --script res://tools/make_gear_icons.gd
const Weapons := preload("res://scripts/combat/weapons.gd")
const SIZE := 256

var _jobs: Array = []
var _vp: SubViewport
var _holder: Node3D
var _cam: Camera3D
var _frame := 0
var _cur := {}

func _init() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://ui/icons"))
	for f in Weapons.FRAMES:
		_jobs.append({ "id": f, "model": "res://models/weapons/" + String(Weapons.FRAMES[f].model) })
	_jobs.append({ "id": "LAUNCHER", "model": "res://models/weapons/launcher.glb" })
	_vp = SubViewport.new()
	_vp.size = Vector2i(SIZE * 2, SIZE * 2)
	_vp.transparent_bg = true
	_vp.msaa_3d = Viewport.MSAA_4X
	_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_root().add_child(_vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.58, 0.62)
	e.ambient_light_energy = 0.9
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	_vp.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-35, -40, 0)
	key.light_energy = 1.6
	_vp.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-10, 150, 0)
	rim.light_energy = 1.2
	rim.light_color = Color(0.75, 0.85, 1.0)
	_vp.add_child(rim)
	_holder = Node3D.new()
	_vp.add_child(_holder)
	_cam = Camera3D.new()
	_cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	_vp.add_child(_cam)
	_cam.current = true

func _process(_dt: float) -> bool:
	if _cur.is_empty():
		if _jobs.is_empty():
			print("gear icons: done")
			return true
		_cur = _jobs.pop_front()
		for c in _holder.get_children():
			c.free()
		var ps: PackedScene = load(_cur.model)
		if not ps:
			print("gear icons: missing ", _cur.model)
			_cur = {}
			return false
		var m: Node3D = ps.instantiate()
		_holder.add_child(m)
		# side profile, barrel to the right: the models' barrels run along +Z
		m.rotation_degrees = Vector3(0, 90, 0)
		var box := _aabb(m)
		m.position = -box.get_center()
		var span := maxf(box.size.z, maxf(box.size.y, box.size.x))
		_cam.size = span * 1.12
		_cam.position = Vector3(0, 0, span * 3.0)
		_cam.look_at(Vector3.ZERO, Vector3.UP)
		_frame = 0
		return false
	_frame += 1
	if _frame == 6:
		var img := _vp.get_texture().get_image()
		img.resize(SIZE, SIZE, Image.INTERPOLATE_LANCZOS)
		var path := "res://ui/icons/weapon-%s.png" % String(_cur.id)
		img.save_png(ProjectSettings.globalize_path(path))
		print("gear icons: ", path)
		_cur = {}
	return false

static func _aabb(n: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var b := mi.global_transform * mi.get_aabb()
		if first:
			out = b
			first = false
		else:
			out = out.merge(b)
	return out
