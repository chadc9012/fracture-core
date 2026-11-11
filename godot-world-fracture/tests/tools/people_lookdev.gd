extends SceneTree
## Look-dev for the street's people (GTA pass, Nov 11): a line-up of civilians as the street spawns them, in daylight,
## rendered to a PNG.  xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1280x720 --script res://tests/tools/people_lookdev.gd -- out.png [seed] [close]
const Civilians := preload("res://scripts/city/civilians.gd")
const Grade := preload("res://scripts/grade.gd")

var frames := 0
var out := "user://people.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var seed := int(args[1]) if args.size() > 1 else 9
	var close := args.size() > 2 and args[2] == "close"
	var root := Node3D.new()
	get_root().add_child(root)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/sky3d.gdshader")
	sky.sky_material = sm
	e.sky = sky
	e.background_mode = Environment.BG_SKY
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.adjustment_enabled = true
	e.adjustment_color_correction = Grade.lut("day")
	env.environment = e
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, -35, 0)
	sun.light_energy = 1.6
	sun.light_color = Color(1.0, 0.92, 0.8)
	sun.shadow_enabled = true
	root.add_child(sun)
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	ground.mesh = pm
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.5, 0.48, 0.45)
	ground.material_override = gm
	root.add_child(ground)
	var civ := Civilians.new()
	root.add_child(civ)
	var boxes: Array[AABB] = []
	civ.setup(null, boxes, Rect2(-30, -30, 60, 60), func(_p: Vector3) -> float: return 0.0, -20, 20, 0, seed)
	var n := 3 if close else 7
	for i in n:
		var w = civ._spawn(1.0, 0.0, 1.0)
		w.mover.position = Vector3((i - (n - 1) * 0.5) * (1.1 if close else 0.95), 0.0, 0.0)
		w.mover.rotation.y = 0.0
		w.mover.set_physics_process(false)
		w.mover.set_process(false)
	civ.set_process(false)
	civ.set_physics_process(false)
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.fov = 35.0 if close else 40.0
	var at := Vector3(0, 1.45, 4.2) if close else Vector3(0, 1.2, 8.5)
	cam.look_at_from_position(at, Vector3(0, 1.25 if close else 0.95, 0), Vector3.UP)
	cam.make_current()

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 30:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
