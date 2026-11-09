extends Node3D
## Draws and runs the wildlife (wildlife.gd rules) over a region in PLAY mode. Bodies: the fox is the real rigged fox GLB
## (models/animals/fox.glb, Khronos sample: Survey / Walk / Run clips driven by speed); every other species is a stand-in
## of boxes in the species colour, sized by its `body`, with a head that dips to graze and legs that swing with the gait
## phase — to be replaced by Meshy animals (docs/asset-catalog.md, Animals & creatures) without touching the rules.
## Every ground animal is a gunplay Target: a hit drops it (wildlife.shoot) and it lies there before a new one comes home.

const Wildlife := preload("res://scripts/wildlife/wildlife.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const FOX := "res://models/animals/fox.glb"

var rules: Wildlife
var ground_at: Callable = func(_x: float, _z: float) -> float: return 0.0
var is_wet: Callable = func(_x: float, _z: float) -> bool: return false
var water_level := -2.5
var night := false
var bodies := {}        # Critter -> Node3D
var gunplay: Node3D
var _targets := {}      # Critter -> Target
var _player: Node3D
var _last_pos := Vector3.ZERO
var _speed := 0.0

func setup(player: Node3D, g: Node3D, ground: Callable, wet: Callable, seed := 7) -> void:
	rules = Wildlife.new(seed)
	_player = player
	gunplay = g
	ground_at = ground
	is_wet = wet
	if gunplay:
		gunplay.hit.connect(_on_hit)

## the forest population round a centre: deer herds, boar, rabbits, a fox, a wolf pack, a bear, a panther, a raptor,
## songbirds, and by any water a crocodile, fish and a shark
func populate(centre: Vector2, radius := 160.0) -> void:
	var r := RandomNumberGenerator.new()
	r.seed = 21
	var spot := func(dist_lo: float, dist_hi: float, want_wet: bool) -> Vector2:
		for tries in 40:
			var a := r.randf() * TAU
			var d := r.randf_range(dist_lo, dist_hi)
			var p := centre + Vector2(cos(a), sin(a)) * d
			if bool(is_wet.call(p.x, p.y)) == want_wet:
				return p
		return centre + Vector2(dist_lo, 0)
	for i in 2:
		_group("DEER", spot.call(40.0, radius, false), 3 + i)
	_group("BOAR", spot.call(50.0, radius, false), 3)
	_group("RABBIT", spot.call(25.0, 80.0, false), 4, 3.0)
	_one("FOX", spot.call(30.0, radius, false))
	_group("WOLF", spot.call(90.0, radius, false), 3, 3.0)
	_one("BEAR", spot.call(80.0, radius, false))
	_one("PANTHER", spot.call(70.0, radius, false))
	_one("RAPTOR", centre)
	_group("SONGBIRD", spot.call(20.0, 60.0, false), 5, 2.0)
	_one("REPTILE", spot.call(20.0, 70.0, false))
	var pond: Vector2 = spot.call(30.0, radius, true)
	if bool(is_wet.call(pond.x, pond.y)):
		_group("FISH", pond, 6, 2.0)
		_one("SHARK", pond)
		# the crocodile lies on the bank: the nearest dry spot to the water
		var bank := pond
		for k in 24:
			var a := TAU * k / 24.0
			var q := pond + Vector2(cos(a), sin(a)) * 6.0
			if not bool(is_wet.call(q.x, q.y)):
				bank = q
				break
		_one("CROCODILE", bank)

func _one(species: String, at: Vector2) -> void:
	_body(rules.spawn(species, at))

func _group(species: String, at: Vector2, n: int, spread := 6.0) -> void:
	for c in rules.spawn_group(species, at, n, spread):
		_body(c)

func _body(c: Wildlife.Critter) -> void:
	var p: Dictionary = Wildlife.profile(c.species)
	var root := Node3D.new()
	add_child(root)
	if c.species == "FOX" and ResourceLoader.exists(FOX):
		var fox := (load(FOX) as PackedScene).instantiate() as Node3D
		# the sample fox is in centimetres and faces -z: a metre-scale fox nose-forward (+z, as the rules' heading)
		fox.scale = Vector3.ONE * 0.011 * c.size
		fox.rotation.y = PI
		root.add_child(fox)
		var ap := fox.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if ap:
			for n in ap.get_animation_list():
				ap.get_animation(n).loop_mode = Animation.LOOP_LINEAR
			ap.play("Survey")
			root.set_meta("anim", ap)
	else:
		var sz: Vector3 = p.body * c.size
		var col: Color = p.color
		var mat := StandardMaterial3D.new()
		mat.albedo_color = col
		mat.roughness = 0.9
		var legs: bool = int(p.loco) == Wildlife.Loco.GROUND and c.species != "REPTILE"
		var leg_h: float = sz.y * 0.45 if legs else 0.0
		var torso := _box(Vector3(sz.x, sz.y - leg_h, sz.z * 0.7), Vector3(0, leg_h + (sz.y - leg_h) * 0.5, 0), mat, root)
		torso.name = "torso"
		var head := _box(Vector3(sz.x * 0.6, sz.y * 0.35, sz.z * 0.3), Vector3(0, sz.y * 0.85, sz.z * 0.5), mat, root)
		head.name = "head"
		if c.species == "DEER":
			var ant := StandardMaterial3D.new()
			ant.albedo_color = Color(0.3, 0.22, 0.14)
			for sx: float in [-1.0, 1.0]:
				_box(Vector3(0.05, 0.45, 0.05), Vector3(sx * 0.15, sz.y * 1.1, sz.z * 0.5), ant, root)
		if legs:
			for i in 4:
				var lx := (sz.x * 0.35) * (1.0 if i % 2 == 0 else -1.0)
				var lz := (sz.z * 0.28) * (1.0 if i < 2 else -1.0)
				var leg := _box(Vector3(sz.x * 0.2, leg_h, sz.x * 0.2), Vector3(lx, leg_h * 0.5, lz), mat, root)
				leg.name = "leg%d" % i
		if int(p.loco) != Wildlife.Loco.GROUND:
			# wings / fins: a flat span either side
			for sx: float in [-1.0, 1.0]:
				var wing := _box(Vector3(sz.x * 0.5, 0.04, sz.z * 0.5), Vector3(sx * sz.x * 0.4, sz.y * 0.6, 0), mat, root)
				wing.name = "wing%d" % (0 if sx < 0 else 1)
	bodies[c] = root
	if gunplay and int(p.loco) == Wildlife.Loco.GROUND:
		var sz2: Vector3 = p.body * c.size
		var t := Gunplay.Target.new(AABB(Vector3.ZERO, sz2), 12.0 * sz2.y, root)
		t.set_meta("blood", Color(0.3, 0.9, 0.3))   # the owner's board: green for the wild things
		gunplay.targets.append(t)
		_targets[c] = t

func _box(size: Vector3, at: Vector3, mat: Material, parent: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = at
	mi.material_override = mat
	parent.add_child(mi)
	return mi

func _on_hit(t: Gunplay.Target, _damage: float, _head: bool) -> void:
	for c in _targets:
		if _targets[c] == t and not t.alive():
			rules.shoot(c)

func step(dt: float) -> void:
	if not rules:
		return
	var pos := _player.position if _player else Vector3.ZERO
	_speed = (pos - _last_pos).length() / maxf(dt, 1e-4) if _last_pos != Vector3.ZERO else 0.0
	_last_pos = pos
	var threat := { "pos": Vector2(pos.x, pos.z), "speed": _speed, "sprinting": _speed > 6.0 }
	rules.step_all(dt, threat, night, is_wet)
	for c in bodies:
		var root: Node3D = bodies[c]
		var p: Dictionary = Wildlife.profile(c.species)
		var base: float = (water_level + c.alt) if int(p.loco) == Wildlife.Loco.FISH else (float(ground_at.call(c.pos.x, c.pos.y)) + c.alt)
		root.position = Vector3(c.pos.x, base, c.pos.y)
		root.rotation.y = c.heading
		var down: bool = c.down >= 0.0
		root.visible = not (down and c.down > Wildlife.DOWN_TIME)
		root.rotation.z = move_toward(root.rotation.z, PI * 0.5 if down else 0.0, 3.0 * dt)
		# gait: legs swing with the phase, the head dips to graze, wings beat
		for i in 4:
			var leg := root.get_node_or_null("leg%d" % i) as MeshInstance3D
			if leg:
				leg.rotation.x = sin(c.phase + (PI if i % 3 == 0 else 0.0)) * 0.5 * clampf(c.speed / 2.0, 0.0, 1.0)
		var head := root.get_node_or_null("head") as MeshInstance3D
		if head:
			head.rotation.x = c.head_down * 0.9
			head.rotation.y = c.look
		for i in 2:
			var wing := root.get_node_or_null("wing%d" % i) as MeshInstance3D
			if wing:
				wing.rotation.z = sin(c.phase) * 0.6 * (1.0 if i == 1 else -1.0)
		if root.has_meta("anim"):
			var ap: AnimationPlayer = root.get_meta("anim")
			var clip: String = "Run" if c.speed > 3.5 else ("Walk" if c.speed > 0.3 else "Survey")
			if ap.current_animation != clip:
				ap.play(clip, 0.2)
			ap.speed_scale = clampf(c.speed / (4.0 if clip == "Run" else 1.2), 0.6, 1.6) if clip != "Survey" else 1.0
		if _targets.has(c):
			var t: Gunplay.Target = _targets[c]
			var sz: Vector3 = p.body * c.size
			t.box = AABB(root.position + Vector3(-sz.x * 0.5, 0, -sz.z * 0.5), sz)
			if not down and t.hp <= 0.0 and c.down < 0.0:
				pass
			if c.down < 0.0 and t.hp <= 0.0:
				t.hp = t.max_hp   # respawned
