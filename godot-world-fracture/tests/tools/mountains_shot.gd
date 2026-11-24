extends SceneTree
## Look-dev for the sky mountains (scripts/city/sky_mountains.gd): the night or day sky alone, looking across the
## avenue (+x) or down it (-z).
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/mountains_shot.gd -- out.png [day] [down]
var frames := 0
var out := "user://mountains.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var day := args.has("day")
	var root := Node3D.new()
	get_root().add_child(root)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = Sky.new()
	var m: ShaderMaterial = load("res://scripts/city/street_slice.gd").day_sky() if day else load("res://scripts/city/night_fx.gd").sky()
	m.set_shader_parameter("mountains", 1.0)
	m.set_shader_parameter("mtn_night", 0.0 if day else 1.0)
	if not day:
		m.set_shader_parameter("moon_dir", Vector3(0.1, 0.36, -0.93))
	env.sky.sky_material = m
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0 if day else 2.5
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-46.0, 152.0, 0.0)
	root.add_child(sun)
	var cam := Camera3D.new()
	cam.fov = 70.0
	root.add_child(cam)
	cam.position = Vector3(0, 1.7, 0)
	cam.rotation_degrees = Vector3(6, 0 if args.has("down") else -90, 0)
	cam.current = true

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 20:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
