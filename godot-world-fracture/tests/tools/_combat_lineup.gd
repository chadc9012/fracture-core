extends Node
## look-dev: combat clips (combat_clips.gd) held at one moment each, in a row. OUT=x.png CLS=goliath|nyx|cipher
## POSES="melee_1@0.45,heavy@0.66,…" (name@u; reload/<FRAME>@u for reloads). YAW=radians the bodies face (default 0.7).
const Player := preload("res://scripts/player/operator_player.gd")
const Clips := preload("res://scripts/character/combat_clips.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
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
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; w.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, 30, 0); sun.light_energy = 1.4; sun.shadow_enabled = true; w.add_child(sun)
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(80, 40); fl.mesh = pm; w.add_child(fl)
	var cls := OS.get_environment("CLS") if OS.has_environment("CLS") else "goliath"
	var poses := (OS.get_environment("POSES") if OS.has_environment("POSES") else "melee_1@0.45,melee_2@0.48,melee_3@0.62,heavy@0.66,finisher@0.75,block@0.5,dodge_f@0.5,death@1.0").split(",")
	var yaw := float(OS.get_environment("YAW")) if OS.has_environment("YAW") else 0.7
	var gap := 1.7
	var bodies: Array = []
	for i in poses.size():
		var m: Node3D = Player.new()
		w.add_child(m)
		m.civilian = false
		m.position = Vector3(-gap * (poses.size() - 1) * 0.5 + i * gap, 0, 0)
		m.heading = yaw
		m.build(CharacterStore.clean({ "frame": cls, "body": "male" if cls == "goliath" else "female" }))
		m.rig.rotation.y = yaw
		var spec: PackedStringArray = poses[i].split("@")
		var nm := spec[0]
		var u := float(spec[1]) if spec.size() > 1 else 0.5
		var clip: Dictionary = Clips.reload_for(nm.get_slice("/", 1)) if nm.begins_with("reload/") else Clips.variant(cls, nm)
		if m.rig.action and not clip.is_empty():
			m.rig.action.freeze_at(nm, clip, u)
		var l := Label3D.new(); l.text = poses[i]; l.position = m.position + Vector3(0, 2.15, 0); l.font_size = 28; l.pixel_size = 0.004; w.add_child(l)
		bodies.append(m)
	var cam := Camera3D.new(); w.add_child(cam)
	var span := gap * poses.size()
	cam.position = Vector3(0, 1.3, maxf(3.2, span * 0.36)); cam.look_at(Vector3(0, 0.9, 0)); cam.current = true; cam.fov = 62
	for i in 20:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT"))
	get_tree().quit()
