extends SceneTree
## look-dev: every enemies.gd trooper type standing in a row, rifles up, close camera. OUT=<png> TYPES=a,b,… CAM=x,y,z
## Not a test.
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")

var en: Node
var p: Node3D
var bots: Array = []
var frame := 0
var cam: Camera3D

func _initialize() -> void:
	var w := Node3D.new()
	root.add_child(w)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.1, 0.11, 0.14)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.6, 0.64, 0.75)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	w.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35, 30, 0)
	sun.light_energy = 1.4
	sun.shadow_enabled = true
	w.add_child(sun)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-20, 200, 0)
	rim.light_energy = 0.8
	rim.light_color = Color(0.5, 0.7, 1.0)
	w.add_child(rim)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	fl.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.2, 0.21, 0.23)
	fl.material_override = fm
	w.add_child(fl)
	p = Player.new()
	w.add_child(p)
	p.bounds = Rect2(-30, -30, 60, 60)
	p.ground_at = func(_x: float, _z: float) -> float: return 0.0
	var boxes: Array[AABB] = [AABB(Vector3(-200, 0, 200), Vector3(1, 1, 1))]
	p.obstacles = boxes
	p.position = Vector3(0, 0, float(OS.get_environment("PZ")) if OS.has_environment("PZ") else 25.0)
	p.visible = false
	var g := Gunplay.new()
	w.add_child(g)
	g.setup(p, p.obstacles)
	en = Enemies.new()
	w.add_child(en)
	en.setup(p, g)
	var types: PackedStringArray = (OS.get_environment("TYPES") if OS.has_environment("TYPES") else "scout,elite,executor,marksman").split(",")
	var models: PackedStringArray = OS.get_environment("MODELS").split(",") if OS.has_environment("MODELS") else PackedStringArray()
	for i in types.size():
		var x := (i - (types.size() - 1) * 0.5) * 1.6
		var e = en.spawn(types[i], Vector3(x, 0, 0), [Vector3(x, 0, 0)])
		if i < models.size() and models[i] != "":
			var m := models[i].split(":")      # model[:frame:body]
			var look := { "frame": m[1] if m.size() > 1 else "goliath", "body": m[2] if m.size() > 2 else "male", "model": m[0] }
			if m[0] == "-":
				look.erase("model")
			e.mover.build(load("res://scripts/character/character_store.gd").clean(look))
			e.mover.armed_pose = true
		bots.append(e)
	cam = Camera3D.new()
	w.add_child(cam)
	var cp := Vector3(0.6, 1.5, 4.6)
	if OS.has_environment("CAM"):
		var c := OS.get_environment("CAM").split(",")
		cp = Vector3(float(c[0]), float(c[1]), float(c[2]))
	cam.position = cp
	cam.fov = 45.0
	cam.current = true

func _process(_dt: float) -> bool:
	frame += 1
	if frame == 2:
		cam.look_at(Vector3(0, 1.1, 0))
	en.step(1.0 / 60.0)
	if not OS.has_environment("FREE"):
		for e in bots:
			e.mover.position.z = 0.0
			e.mover.set("heading", 0.0)
	if frame == (int(OS.get_environment("AT")) if OS.has_environment("AT") else 90):
		var img := root.get_viewport().get_texture().get_image()
		img.save_png(OS.get_environment("OUT") if OS.has_environment("OUT") else "/tmp/enemy_lineup.png")
		quit()
	return false
