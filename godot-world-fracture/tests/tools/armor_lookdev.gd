extends SceneTree
## Look-dev for worn armour (scripts/gear/armor_look.gd): the three frames side by side, front then back, each in a set.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x900 --script res://tests/tools/armor_lookdev.gd -- out.png [back|close] [sets,comma] [body]
const Rig := preload("res://scripts/character/character_rig.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const ArmorLook := preload("res://scripts/gear/armor_look.gd")
const Grade := preload("res://scripts/grade.gd")
var frames := 0
var out := "user://armor.png"

static func gear_in(set_id: String) -> Dictionary:
	var g := Gear.fresh()
	var s := Gear.armor_set(set_id)
	for slot in Gear.ARMOR_SLOTS:
		var id := "t-%s-%s" % [set_id, slot]
		g.items.append({ "id": id, "name": String(s.pieces[slot]) if not s.is_empty() else slot, "slot": slot, "power": 120, "level": 1, "element": String(s.get("element", "KINETIC")), "set": set_id, "frame": "", "cls": "" })
		g.equipped[slot] = id
	return g

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var view := args[1] if args.size() > 1 else "front"
	var sets: Array = (args[2] if args.size() > 2 else "dragonite,frostwrought-aegis,verdant-warden").split(",")
	var body := args[3] if args.size() > 3 else "male"
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
	e.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.adjustment_enabled = true
	e.adjustment_color_correction = Grade.lut("day")
	env.environment = e
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, -35 if view != "back" else 145, 0)
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
	var fr: Array = (args[4] if args.size() > 4 else "goliath,goliath,goliath").split(",")
	var n := fr.size()
	for i in n:
		var look: Dictionary = Store.default_look()
		look.frame = fr[i]
		look.body = body
		look = Store.clean(look)
		var r = Rig.new()
		root.add_child(r)
		r.build(look, true)
		# a clip mid-stride (args[5]: walk / run / any clip name) to check the armour deforms with the body
		var clip := args[5] if args.size() > 5 else ""
		if clip != "" and r.anim:
			var names: PackedStringArray = r.anim.get_animation_list()
			if i == 0:
				print("clips: ", names)
			for nm in names:
				if nm.to_lower().contains(clip):
					r.anim.play(nm)
					r.anim.advance(0.3 + i * 0.25)
					r.anim.speed_scale = 0.0
					break
		r.position = Vector3((i - (n - 1) * 0.5) * 1.15, 0, 0)
		r.rotation.y = PI if view == "back" else (0.6 if i == 2 else 0.0)
		var g := gear_in(String(sets[i % sets.size()]))
		if i == 0:
			g.equipped.erase("helmet")
		ArmorLook.apply(r, g)
		print("worn pieces: ", ArmorLook.worn_count(r))
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.fov = 38.0
	var at := Vector3(0, 1.25, 5.0)
	var aim := Vector3(0, 1.0, 0)
	if view == "close":
		at = Vector3(0, 1.45, 1.25)
		aim = Vector3(0, 1.3, 0)
		cam.fov = 40.0
	cam.look_at_from_position(at, aim, Vector3.UP)
	cam.make_current()

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 40:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
