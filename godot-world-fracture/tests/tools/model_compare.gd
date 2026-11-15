extends SceneTree
## Look-dev for the Meshy upgrade (docs/reference/MESHY_UPGRADE.md): renders GLBs side by side under the street's
## daylight, a wide view and a close crop, to check placement against the model they replace and to look for
## pixelation at play distance and close up.
## Usage: godot --path . --script res://tests/tools/model_compare.gd -- out.png a.glb [b.glb ...] [--close]

var _frames := 0
var _out := ""
var _cam: Camera3D

func _build() -> void:
	var args := OS.get_cmdline_user_args()
	_out = args[0]
	var paths: Array = Array(args.slice(1)).filter(func(s: String) -> bool: return not s.begins_with("--"))
	var close := "--close" in args
	var world := Node3D.new()
	root.add_child(world)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.55, 0.6, 0.66)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.78, 0.85)
	e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	world.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 35, 0)
	sun.light_energy = 1.5
	sun.shadow_enabled = true
	world.add_child(sun)
	var x := 0.0
	var span := 0.0
	var h := 0.0
	for p: String in paths:
		var inst := (load(p) as PackedScene).instantiate() as Node3D
		world.add_child(inst)
		var b0 := _aabb(inst)
		if b0.size.z > b0.size.x * 1.3:
			inst.rotation.y = PI * 0.5     # long things side on
		var b := _aabb(inst)
		inst.position.x += x - b.position.x
		x += b.size.x + maxf(b.size.x, b.size.z) * 0.3
		span = x
		h = maxf(h, b.size.y + b.position.y)
		var l := Label3D.new()
		l.text = p.get_file()
		l.pixel_size = maxf(b.size.length(), 0.3) * 0.002
		l.position = Vector3(x - b.size.x * 0.5 - maxf(b.size.x, b.size.z) * 0.3, b.position.y - 0.08 * b.size.length(), b.get_center().z + b.size.z)
		world.add_child(l)
	_cam = Camera3D.new()
	_cam.fov = 40.0
	world.add_child(_cam)
	var c := Vector3(span * 0.5, h * 0.5, 0)
	var d := maxf(span, h) * (0.45 if close else 1.25)
	_cam.position = c + Vector3(0, h * 0.25, d)
	_cam.look_at(c)

func _aabb(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var b: AABB = m.global_transform * m.get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out

func _process(_d: float) -> bool:
	_frames += 1
	if _frames == 1:
		_build()
	if _frames == 12:
		root.get_viewport().get_texture().get_image().save_png(_out)
		quit()
	return false
