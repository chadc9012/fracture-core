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
## `keep_clear` is the mission's own ground — waypoints, relays, POIs — no home, den, nest or crag within KEEP_M of it
const KEEP_M := 14.0
var _keep: Array[Vector2] = []
func _clear_of(p: Vector2) -> bool:
	for k in _keep:
		if k.distance_to(p) < KEEP_M:
			return false
	return true

func populate(centre: Vector2, radius := 160.0, keep_clear: Array[Vector2] = []) -> void:
	_keep = keep_clear
	var r := RandomNumberGenerator.new()
	r.seed = 21
	var spot := func(dist_lo: float, dist_hi: float, want_wet: bool) -> Vector2:
		for tries in 40:
			var a := r.randf() * TAU
			var d := r.randf_range(dist_lo, dist_hi)
			var p := centre + Vector2(cos(a), sin(a)) * d
			if bool(is_wet.call(p.x, p.y)) == want_wet and _clear_of(p):
				return p
		return centre + Vector2(dist_lo, 0)
	for i in 2:
		_group("DEER", spot.call(40.0, radius, false), 3 + i)
	_group("BOAR", spot.call(50.0, radius, false), 3)
	_group("HORSE", spot.call(60.0, radius, false), 2, 5.0)   # wild horses (the Meshy horse, models/animals/horse.glb)
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
		_pond = pond
	_dressing()

func _one(species: String, at: Vector2) -> void:
	_body(rules.spawn(species, at))

func _group(species: String, at: Vector2, n: int, spread := 6.0) -> void:
	for c in rules.spawn_group(species, at, n, spread):
		_body(c)

func _body(c: Wildlife.Critter) -> void:
	var p: Dictionary = Wildlife.profile(c.species)
	var root := Node3D.new()
	add_child(root)
	var meshy := "res://models/animals/%s.glb" % c.species.to_lower()
	if c.species != "FOX" and ResourceLoader.exists(meshy):
		# a Meshy animal (docs/reference/MESHY_UPGRADE.md batch 3): dropped in under the species' name, fitted to the
		# rules' body height, nose +z; static unless it carries clips (the walk bob is the root's)
		var body := (load(meshy) as PackedScene).instantiate() as Node3D
		root.add_child(body)
		var aabb := _node_aabb(body)
		# a soaring bird's rules body is its wingspan (x) over a thin height: fit the model's span, not its height
		var soars: bool = int(p.loco) == Wildlife.Loco.SOAR
		var want: float = float((p.body as Vector3).x if soars else (p.body as Vector3).y) * c.size
		var k := want / maxf(aabb.size.x if soars else aabb.size.y, 0.001)
		body.scale = Vector3.ONE * k
		body.position = Vector3(-(aabb.position.x + aabb.size.x * 0.5) * k, -aabb.position.y * k, -(aabb.position.z + aabb.size.z * 0.5) * k)
		var ap2 := body.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if ap2 and ap2.get_animation_list().size() > 0:
			var first := ap2.get_animation_list()[0]
			ap2.get_animation(first).loop_mode = Animation.LOOP_LINEAR
			ap2.play(first)
			root.set_meta("anim", ap2)
	elif c.species == "FOX" and ResourceLoader.exists(FOX):
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
		# roosting: a bird resting by night sits up on its nest, not on the ground
		if c.state == Wildlife.St.REST and int(p.loco) == Wildlife.Loco.BIRD and _nests.has(c.group):
			var nest: Vector3 = _nests[c.group]
			root.position = root.position.lerp(Vector3(nest.x, nest.y + 0.15, nest.z), 0.3)
		_tracks(c, root, p)
		if _targets.has(c):
			var t: Gunplay.Target = _targets[c]
			var sz: Vector3 = p.body * c.size
			t.box = AABB(root.position + Vector3(-sz.x * 0.5, 0, -sz.z * 0.5), sz)
			if not down and t.hp <= 0.0 and c.down < 0.0:
				pass
			if c.down < 0.0 and t.hp <= 0.0:
				t.hp = t.max_hp   # respawned

## the bounds of a model's meshes in its own frame
static func _node_aabb(n: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = (mi as MeshInstance3D).get_aabb()
		var t: Transform3D = n.global_transform.affine_inverse() * (mi as Node3D).global_transform if n.is_inside_tree() else (mi as Node3D).transform
		b = t * b
		out = b if first else out.merge(b)
		first = false
	return out

# --------------------------------------------------------------------------- dens, nests, tracks, swarms (catalog §7)
## Wildlife behaviour row: an earth den at every predator's home, a nest on a snag at the songbirds' and the raptor's,
## footprints laid behind walking animals (a ring of 480 marks), a midge swarm over the pond at dusk and by night,
## birds roosting on their nest by night (above). All procedural, a MultiMesh or a particle node each.
const TRACK_N := 480
var _pond := Vector2.INF
var _nests := {}          # group -> nest position
var _track_mm: MultiMeshInstance3D
var _track_i := 0
var _track_last := {}     # Critter -> last mark position
var _swarms: Array = []

func _dressing() -> void:
	var parent := get_parent()
	if parent == null:
		return
	var earth := StandardMaterial3D.new()
	earth.albedo_color = Color(0.28, 0.22, 0.16)
	earth.roughness = 1.0
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.02, 0.015, 0.01)
	dark.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var twig := StandardMaterial3D.new()
	twig.albedo_color = Color(0.42, 0.33, 0.2)
	twig.roughness = 1.0
	var done := {}
	for c in bodies:
		var key: String = c.group if c.group != "" else c.id
		if done.has(key):
			continue
		done[key] = true
		var p: Dictionary = Wildlife.profile(c.species)
		var h: Vector3 = Vector3(c.home.x, float(ground_at.call(c.home.x, c.home.y)), c.home.y)
		if c.species in ["WOLF", "BEAR", "FOX", "PANTHER"]:
			# the den: an earth mound with a black mouth facing away from home's centre
			var den := Node3D.new()
			den.position = h
			den.rotation.y = c.heading
			parent.add_child(den)
			var mound := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 1.0
			sm.height = 2.0
			sm.radial_segments = 10
			sm.rings = 5
			mound.mesh = sm
			mound.scale = Vector3(2.2, 1.1, 1.8) * (1.4 if c.species == "BEAR" else 1.0)
			mound.material_override = earth
			den.add_child(mound)
			var mouth := _box(Vector3(1.1, 0.8, 0.3), Vector3(0, 0.4, 1.5 * (1.4 if c.species == "BEAR" else 1.0)), dark, den)
			mouth.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		elif c.species in ["SONGBIRD", "RAPTOR"]:
			# the nest: a ring of twigs on a dead snag (the raptor's high on a crag)
			var tall := 7.0 if c.species == "RAPTOR" else 2.6
			if c.species == "RAPTOR":
				# the raptor soars round the centre; its crag stands off to one side, not on the player's spot (and
				# round the other side when that side is a waypoint's)
				var crag := Vector2(c.home.x + 32.0, c.home.y - 18.0)
				for k in 8:
					if _clear_of(crag):
						break
					var a := TAU * (k + 1) / 8.0
					crag = Vector2(c.home.x + cos(a) * 37.0, c.home.y + sin(a) * 37.0)
				h = Vector3(crag.x, float(ground_at.call(crag.x, crag.y)), crag.y)
			var snag := Node3D.new()
			snag.position = h
			parent.add_child(snag)
			var trunk := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.12 if c.species == "SONGBIRD" else 0.5
			cm.bottom_radius = 0.3 if c.species == "SONGBIRD" else 1.4
			cm.height = tall
			cm.radial_segments = 7
			trunk.mesh = cm
			trunk.position = Vector3(0, tall * 0.5, 0)
			trunk.material_override = twig if c.species == "SONGBIRD" else earth
			snag.add_child(trunk)
			var ring := MeshInstance3D.new()
			var tm := TorusMesh.new()
			tm.inner_radius = 0.12 if c.species == "SONGBIRD" else 0.35
			tm.outer_radius = 0.32 if c.species == "SONGBIRD" else 0.9
			tm.rings = 10
			tm.ring_segments = 6
			ring.mesh = tm
			ring.position = Vector3(0, tall + 0.08, 0)
			ring.material_override = twig
			snag.add_child(ring)
			_nests[key] = h + Vector3(0, tall + 0.1, 0)
	# the footprints
	_track_mm = MultiMeshInstance3D.new()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.instance_count = TRACK_N
	mm.visible_instance_count = 0
	var q := QuadMesh.new()
	q.size = Vector2(0.14, 0.2)
	q.orientation = PlaneMesh.FACE_Y
	var tmat := StandardMaterial3D.new()
	tmat.albedo_color = Color(0.1, 0.08, 0.05, 0.6)
	tmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	tmat.roughness = 1.0
	q.material = tmat
	mm.mesh = q
	_track_mm.multimesh = mm
	_track_mm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_track_mm.visibility_range_end = 60.0
	parent.add_child(_track_mm)
	# the midges over the water
	if _pond != Vector2.INF:
		for k in 2:
			var sw := CPUParticles3D.new()
			sw.amount = 40
			sw.lifetime = 3.0
			sw.mesh = QuadMesh.new()
			(sw.mesh as QuadMesh).size = Vector2(0.05, 0.05)
			var sm2 := StandardMaterial3D.new()
			sm2.albedo_color = Color(0.1, 0.1, 0.08)
			sm2.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			sm2.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
			(sw.mesh as QuadMesh).material = sm2
			sw.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
			sw.emission_sphere_radius = 1.2
			sw.direction = Vector3(0, 1, 0)
			sw.spread = 180.0
			sw.initial_velocity_min = 0.3
			sw.initial_velocity_max = 0.9
			sw.gravity = Vector3.ZERO
			sw.damping_min = 0.2
			sw.damping_max = 0.6
			var at := _pond + Vector2(cos(k * 2.4), sin(k * 2.4)) * 5.0
			sw.position = Vector3(at.x, water_level + 1.2, at.y)
			sw.emitting = night
			sw.visibility_range_end = 50.0
			parent.add_child(sw)
			_swarms.append(sw)

## a footprint pair every 0.8 m behind a walking ground animal within 40 m of the player
func _tracks(c: Wildlife.Critter, root: Node3D, p: Dictionary) -> void:
	if _track_mm == null or int(p.loco) != Wildlife.Loco.GROUND or c.speed < 0.3 or c.down >= 0.0:
		return
	if _player and root.position.distance_to(_player.position) > 40.0:
		return
	var last: Vector3 = _track_last.get(c, Vector3.INF)
	if last != Vector3.INF and root.position.distance_to(last) < 0.8:
		return
	_track_last[c] = root.position
	var mm := _track_mm.multimesh
	var side := 1.0 if (_track_i % 2 == 0) else -1.0
	var w: float = float((p.body as Vector3).x) * c.size * 0.35
	var at := root.position + root.basis.x * side * w
	at.y = float(ground_at.call(at.x, at.z)) + 0.02
	mm.set_instance_transform(_track_i, Transform3D(Basis(Vector3.UP, c.heading).scaled(Vector3.ONE * clampf(c.size, 0.5, 2.0)), at))
	_track_i = (_track_i + 1) % TRACK_N
	mm.visible_instance_count = mini(TRACK_N, mm.visible_instance_count + 1)

## dusk and night bring the midges out over the pond
func set_night(on: bool) -> void:
	night = on
	for sw in _swarms:
		(sw as CPUParticles3D).emitting = on
