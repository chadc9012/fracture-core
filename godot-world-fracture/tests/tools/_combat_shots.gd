extends Node
## look-dev: a scripted fight on a plain lot with the chase camera and the phone HUD (WF_TOUCH=1), saving frames as the
## moves play. OUT=<dir> CLS=goliath|nyx|cipher. Not a test.
const Player := preload("res://scripts/player/operator_player.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Touch := preload("res://scripts/player/touch_controls.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
var p: Node3D
var g: Node3D
var en: Node3D
var cam: Camera3D
var tc: Control
func _ready() -> void:
	_run()
func _frames(n: int) -> void:
	for i in n:
		var dt := 1.0 / 30.0
		p.step(dt, tc.move, tc.take_look(), false, false)
		g.step(dt, cam, tc.fire, false, 0.0)
		en.step(dt)
		await get_tree().process_frame
func _shot(name: String) -> void:
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(OS.get_environment("OUT") + "/" + name + ".png")
func _run() -> void:
	var cls := OS.get_environment("CLS") if OS.has_environment("CLS") else "goliath"
	var w := Node3D.new(); add_child(w)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.32, 0.36, 0.44)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.7, 0.72, 0.8); env.ambient_light_energy = 0.7
	env.fog_enabled = true; env.fog_light_color = Color(0.32, 0.36, 0.44); env.fog_density = 0.01
	var we := WorldEnvironment.new(); we.environment = env; w.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-50, 40, 0); sun.light_energy = 1.3; sun.shadow_enabled = true; w.add_child(sun)
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(120, 120); fl.mesh = pm
	var fm := StandardMaterial3D.new(); fm.albedo_color = Color(0.28, 0.29, 0.31); fm.roughness = 0.6; fl.material_override = fm; w.add_child(fl)
	for i in 10:
		var b := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(4, 3 + (i % 3) * 2, 4); b.mesh = bm
		b.position = Vector3(-16 + (i % 5) * 8, bm.size.y * 0.5, -22 - (i / 5) * 10); w.add_child(b)
	p = Player.new(); w.add_child(p)
	p.civilian = false
	p.build(CharacterStore.clean({ "frame": cls, "body": "male" if cls == "goliath" else "female" }))
	var none: Array[AABB] = []
	p.obstacles = none
	p.heading = PI
	cam = Camera3D.new(); w.add_child(cam); cam.current = true; cam.fov = 62
	p.attach_camera(cam)
	p.cam_yaw = 0.0
	p.cam_pitch = -0.12
	var ui := CanvasLayer.new(); add_child(ui)
	tc = Touch.new(); tc.scripted = true; ui.add_child(tc)
	g = Gunplay.new(); w.add_child(g); g.controls = tc
	g.setup(p, p.obstacles)
	en = Enemies.new(); w.add_child(en); en.setup(p, g)
	var ex = en.spawn("executor", Vector3(0.4, 0, -2.4)); ex.state = Enemies.State.ENGAGE
	var sc = en.spawn("scout", Vector3(-2.0, 0, -3.0)); sc.state = Enemies.State.ENGAGE
	var el = en.spawn("elite", Vector3(3.0, 0, -7.0)); el.state = Enemies.State.ENGAGE
	await _frames(20)
	# light chain
	tc._melee = true
	await _frames(9); await _shot("01_melee_1")
	await _frames(6); tc._melee = true
	await _frames(10); await _shot("02_melee_2")
	await _frames(6); tc._melee = true
	await _frames(14); await _shot("03_melee_3")
	await _frames(12)
	# the guard against the Executor
	tc._block_held = true
	await _frames(16); await _shot("04_block")
	tc._block_held = false
	await _frames(4)
	# the heavy
	tc._melee = true; tc._melee_held = true
	await _frames(12); tc._melee_held = false
	await _frames(8); await _shot("05_heavy")
	await _frames(14); await _shot("06_knocked")
	# dodge left
	tc.move = Vector2(-1, 0); tc._dodge = true
	await _frames(6); await _shot("07_dodge")
	tc.move = Vector2.ZERO
	await _frames(20)
	# reload
	g.gun().mag = 0
	g.step(0.016, cam, true, false, 0.0)
	await _frames(14); await _shot("08_reload")
	await _frames(40)
	# finisher on whoever is weak
	for e in en.enemies:
		if e.target.alive():
			e.target.hp = e.target.max_hp * 0.2; e.target.shield = 0.0
	tc._melee = true
	await _frames(18); await _shot("09_finisher")
	await _frames(30); await _shot("10_after")
	# the abilities: the second, then the super
	for e in en.enemies:
		e.target.hp = e.target.max_hp; e.target.shield = e.target.shield_max; e.state = Enemies.State.ENGAGE; e.mover.visible = true
	await _frames(10)
	tc._ability = 1
	await _frames(16); await _shot("11_ability")
	await _frames(30)
	g.close.abilities.energy = 100.0
	tc._ability = 2
	await _frames(14); await _shot("12_super")
	await _frames(10); await _shot("13_super_b")
	get_tree().quit()
