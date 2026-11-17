extends Node
## look-dev: civilians carrying the everyday props in a row (not a test): OUT=x.png
const Civilians := preload("res://scripts/city/civilians.gd")
func _ready() -> void:
	_run()
func _run() -> void:
	seed(int(OS.get_environment("SEED")) if OS.has_environment("SEED") else 3)
	var w := Node3D.new()
	add_child(w)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.7, 0.75, 0.8)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.82, 0.85)
	env.ambient_light_energy = 0.6
	var we := WorldEnvironment.new(); we.environment = env; w.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, 30, 0); sun.light_energy = 1.4; sun.shadow_enabled = true; w.add_child(sun)
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(80, 40); fl.mesh = pm; w.add_child(fl)
	var civ := Civilians.new()
	civ._rng.seed = 3
	w.add_child(civ)
	var items := ["bag", "phone", "coffee", "package", "umbrella", "stroller"]
	for i in items.size():
		var m: Node3D = civ.Player.new()
		w.add_child(m)
		m.position = Vector3(-6.25 + i * 2.5, 0, 0)
		var lk: Dictionary = civ.random_look()
		lk.wear = [items[i]]
		m.build(lk)
		m.cam_yaw = PI
	var cam := Camera3D.new(); w.add_child(cam); cam.position = Vector3(0, 2.0, 7.5); cam.look_at(Vector3(0, 1.0, 0)); cam.current = true; cam.fov = 60
	for i in 30:
		for m in w.get_children():
			if m.has_method("attach_camera"):
				m.step(0.05, Vector2.ZERO, Vector2.ZERO, false, false)
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT"))
	get_tree().quit()
