extends Node
## look-dev: the named people's job idles in a row (work_idle.gd): OUT=x.png — counter, tool, sit, busk, wait, and the stand
const NpcStreet := preload("res://scripts/npc/npc_street.gd")
const People := preload("res://scripts/npc/people.gd")
const Player := preload("res://scripts/player/operator_player.gd")
func _ready() -> void:
	_run()
func _run() -> void:
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
	var clips := ["work_counter", "work_tool", "sit", "busk", "wait", "idle"]
	var ids := ["rosa", "marcus", "dana", "priya", "luis", "rosa"]
	for i in clips.size():
		var m: Node3D = Player.new()
		w.add_child(m)
		m.position = Vector3(-4.0 + i * 1.6, 0, 0)
		m.civilian = true
		var p: Dictionary = People.by_id(ids[i])
		m.build(NpcStreet.look_for(p))
		m.cam_yaw = PI
		m.idle_clip = clips[i]
		if clips[i] == "sit":
			var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1.4, 0.46, 0.6); b.mesh = bm; b.position = m.position + Vector3(0, 0.23, -0.2); w.add_child(b)
	var cam := Camera3D.new(); w.add_child(cam); cam.position = Vector3(0, 1.5, 4.6); cam.look_at(Vector3(0, 0.9, 0)); cam.current = true; cam.fov = 70
	for i in 24:
		for m in w.get_children():
			if m.has_method("attach_camera"):
				m.step(0.05, Vector2.ZERO, Vector2.ZERO, false, false)
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT"))
	get_tree().quit()
