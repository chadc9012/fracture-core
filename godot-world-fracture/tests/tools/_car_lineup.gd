extends SceneTree
## look-dev: the road cars in a row in daylight (not a test)
var files := ["concept-gt.glb", "tuner.glb", "street-racer-lod.glb", "muscle-car-lod.glb", "luxury-sedan.glb", "security-suv.glb", "city-pod.glb", "offroad-truck.glb"]
func _initialize() -> void:
	_run.call_deferred()
func _run() -> void:
	var w := Node3D.new()
	root.add_child(w)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.7, 0.75, 0.8)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.82, 0.85)
	env.ambient_light_energy = 0.6
	var we := WorldEnvironment.new(); we.environment = env; w.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, 30, 0); sun.light_energy = 1.4; sun.shadow_enabled = true; w.add_child(sun)
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(80, 40); fl.mesh = pm; w.add_child(fl)
	if OS.has_environment("ONLY"):
		files = [OS.get_environment("ONLY")]
	for i in files.size():
		var n: Node3D = (load("res://models/fleet/" + files[i]) as PackedScene).instantiate()
		n.position = Vector3(-15 + i * 5.0, 0, 0)
		n.rotation.y = 0.6
		w.add_child(n)
	if OS.has_environment("ONLY"):
		files = [OS.get_environment("ONLY")]
	var cam := Camera3D.new(); w.add_child(cam); cam.position = Vector3(0, 5, 14); cam.look_at(Vector3(0, 0.8, 0)); cam.current = true; cam.fov = 60
	if OS.has_environment("ONLY"):
		cam.position = Vector3(-15 + 4.0, 2.2, 5.0); cam.look_at(Vector3(-15, 0.6, 0))
	for i in 20: await process_frame
	root.get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT"))
	quit()
