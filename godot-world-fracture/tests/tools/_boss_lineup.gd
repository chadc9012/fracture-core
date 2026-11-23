extends Node
## look-dev: boss hulls (boss.gd BOSSES / STORY / UNIQUE rows) fitted as boss_view.gd fits them, in a row at their
## sizes. OUT=x.png IDS="fracture-commander,subject-zero,…" (default: the six STORY rows) YAW=radians (default 0.5).
const Boss := preload("res://scripts/combat/boss.gd")
const BossView := preload("res://scripts/combat/boss_view.gd")

func _ready() -> void:
	_run()

func _run() -> void:
	var w := Node3D.new()
	add_child(w)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.55, 0.58, 0.64)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.82, 0.85)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; w.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, 30, 0); sun.light_energy = 1.4; sun.shadow_enabled = true; w.add_child(sun)
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(120, 60); fl.mesh = pm; w.add_child(fl)
	var ids := (OS.get_environment("IDS") if OS.has_environment("IDS") else ",".join(Boss.STORY.keys())).split(",")
	var yaw := float(OS.get_environment("YAW")) if OS.has_environment("YAW") else 0.5
	var fitter := BossView.new()
	var x := 0.0
	var tallest := 0.0
	var marks: Array = []
	for id in ids:
		var row := Boss.row(id)
		if row.is_empty():
			push_error("no boss row " + id)
			continue
		var size := float(row.size)
		var path := BossView.MODELS + String(row.model)
		var hull := (load(path) as PackedScene).instantiate() as Node3D
		var wrap := Node3D.new()
		w.add_child(wrap)
		wrap.add_child(hull)
		fitter._fit(hull, wrap, size)
		x += size * 0.6
		wrap.position = Vector3(x, 0, 0)
		wrap.rotation.y = yaw
		marks.append([x, size, String(row.name)])
		x += size * 0.6 + 0.8
		tallest = maxf(tallest, size)
	fitter.free()
	for m in marks:
		var l := Label3D.new(); l.text = "%s · %.1f m" % [m[2], m[1]]; l.position = Vector3(m[0], float(m[1]) + 0.4, 0); l.font_size = 36; l.pixel_size = 0.006; w.add_child(l)
	var cam := Camera3D.new(); w.add_child(cam)
	var mid := x * 0.5
	cam.position = Vector3(mid, tallest * 0.55, maxf(6.0, x * 0.62)); cam.look_at(Vector3(mid, tallest * 0.42, 0)); cam.current = true; cam.fov = 58
	for i in 20:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT"))
	get_tree().quit()
