extends SceneTree
## Look-dev: the operator's three frames (nyx slim, cipher athletic, goliath heavy) side by side, in the civilian clothes
## and in the armour, front and three-quarter, under soft studio light.
##   godot --path . --script res://tests/tools/operator_lineup.gd -- out.png [male|female] [civ|armour] [clip:seconds]

const Rig := preload("res://scripts/character/character_rig.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Wardrobe := preload("res://scripts/character/wardrobe.gd")

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out := args[0]
	var body := args[1] if args.size() > 1 else "male"
	var civ := not (args.size() > 2 and args[2] == "armour")
	var world := Node3D.new()
	root.add_child(world)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.42, 0.46, 0.52)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.8, 0.82, 0.88)
	e.ambient_light_energy = 0.6
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	world.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35, 30, 0)
	sun.light_energy = 1.6
	world.add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-15, -140, 0)
	fill.light_energy = 0.6
	world.add_child(fill)
	var x := -3.0
	for frame: String in ["nyx", "cipher", "goliath"]:
		for yaw: float in [0.0, 40.0]:
			var r := Rig.new()
			world.add_child(r)
			var look := Store.clean({"frame": frame, "body": body, "face": "m-veteran" if body == "male" else ""}, true)
			r.build(Wardrobe.civ(look) if civ else look, false)
			r.position = Vector3(x, 0, 0)
			if args.size() > 3 and r.anim:
				var cs := args[3].split(":")
				if r.anim.has_animation(cs[0]):
					r.anim.play(cs[0])
					r.anim.seek(float(cs[1]) if cs.size() > 1 else 0.3, true)
					r.anim.pause()
			r.rotation_degrees.y = yaw
			x += 1.2
		x += 0.3
	var cam := Camera3D.new()
	cam.fov = 30
	world.add_child(cam)
	cam.position = Vector3(0.0, 1.0, 9.5)
	cam.look_at(Vector3(0.15, 0.95, 0))
	cam.current = true
	for i in 30:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out)
	quit(0)
