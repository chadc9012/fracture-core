extends Node
## look-dev: outfits side by side at chest height, to check prints and seams (not a test): OUT=x.png [OUTFITS=a,b,...]
## [CAM=height,distance,look-at height] [YAW=degrees turned]
const Store := preload("res://scripts/character/character_store.gd")
const Player := preload("res://scripts/player/operator_player.gd")
func _ready() -> void:
	var w := Node3D.new()
	add_child(w)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.32, 0.36, 0.42)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.82, 0.85)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; w.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-35, 20, 0); sun.light_energy = 1.3; w.add_child(sun)
	var ids := (OS.get_environment("OUTFITS") if OS.has_environment("OUTFITS") else "street-hoodie,sand-hoodie,bomber,tracksuit,varsity,heather-hoodie").split(",")
	for i in ids.size():
		# an entry is outfit[:frame[:body]]
		var e := ids[i].split(":")
		var female := e[0] in ["sand-hoodie", "pastel-set", "npc-crop-jeans"]
		if e.size() > 2:
			female = e[2] == "female"
		var lk := Store.clean({"frame": e[1] if e.size() > 1 else "goliath", "body": "female" if female else "male", "face": "f-ace" if female else "m-veteran", "outfit": e[0]}, true)
		var m := Player.new()
		w.add_child(m)
		m.position = Vector3((i - (ids.size() - 1) * 0.5) * 0.95, 0, 0)
		m.build(lk)
		m.cam_yaw = PI
	var cv := (OS.get_environment("CAM") if OS.has_environment("CAM") else "1.4,3.4,1.3").split(",")
	if OS.has_environment("YAW"):
		for m in w.get_children():
			if m is Node3D and m.has_method("attach_camera"):
				m.rotation.y = deg_to_rad(float(OS.get_environment("YAW")))
	var cam := Camera3D.new(); w.add_child(cam); cam.position = Vector3(0, float(cv[0]), float(cv[1])); cam.look_at(Vector3(0, float(cv[2]), 0)); cam.current = true; cam.fov = 45
	for i in 20:
		for m in w.get_children():
			if m.has_method("attach_camera"):
				m.step(0.05, Vector2.ZERO, Vector2.ZERO, false, false)
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT"))
	get_tree().quit()
