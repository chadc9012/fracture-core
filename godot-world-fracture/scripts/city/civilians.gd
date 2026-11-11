extends Node3D
## Civilians on the street slices (asset catalog: Characters & NPCs → Civilian; Everyday civilian life). A pooled budget
## of walkers on both sidewalks, each an operator_player.gd mover wearing a random authored face from the character
## catalog (male / female frames, never robot) and a casual tint, walking the block at a stroll, turning back at the
## district's active span or when they bump a box, and stepping round the operator. They are not obstacles (the operator
## walks past them, the budget stays cheap) and they are not targets: shooting a civilian does nothing but scatter them.
## Pure enough to test headless: give it the ground, the bounds and the shared boxes.

const Player := preload("res://scripts/player/operator_player.gd")
const Grounding := preload("res://scripts/city/grounding.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Catalog := preload("res://scripts/character/catalog.gd")
const STROLL := 1.35
const HURRY := 3.4

class Walker:
	var mover: Node3D
	var dir := 1.0               # +1 walks +z
	var side := 1.0              # which sidewalk
	var speed := STROLL
	var pause := 0.0
	var scare := 0.0
	var going := 0.0             # seconds since the last turn (a stalled walker turns back)

var walkers: Array[Walker] = []
var span_lo := -100.0
var span_hi := 100.0
var walk_x := 11.5               # sidewalk centre line from the road's middle
var player: Node3D
var _rng := RandomNumberGenerator.new()
var _bounds: Rect2
var _ground: Callable
var _boxes: Array[AABB]

func setup(operator: Node3D, boxes: Array[AABB], b: Rect2, ground: Callable, lo: float, hi: float, budget := 10, seed := 9) -> void:
	player = operator
	_boxes = boxes
	_bounds = b
	_ground = ground
	span_lo = lo
	span_hi = hi
	_rng.seed = seed
	for i in budget:
		var side := -1.0 if i % 2 == 0 else 1.0
		var z := lerpf(lo + 10.0, hi - 10.0, (i + 0.5) / budget)
		_spawn(side, z, 1.0 if i % 3 == 0 else -1.0)

## a random civilian look: a male or female frame, one of the catalog faces for that body
func random_look() -> Dictionary:
	var body := "female" if _rng.randf() < 0.5 else "male"
	var frames: Array = Catalog.frames().filter(func(f: Dictionary) -> bool: return String(f.id) != "robot")
	var frame: String = String(frames[_rng.randi() % frames.size()].id) if not frames.is_empty() else "goliath"
	# most passers-by are slim or average builds; the heavy frame is the odd one out
	var r := _rng.randf()
	var ids: Array = frames.map(func(f: Dictionary) -> String: return String(f.id))
	if ids.has("nyx") and ids.has("cipher"):
		frame = "nyx" if r < 0.42 else ("cipher" if r < 0.86 else frame)
	var look := CharacterStore.clean({ "frame": frame, "body": body })
	var faces: Array = Catalog.faces(body)
	if not faces.is_empty():
		look = CharacterStore.apply_face(look, String(faces[_rng.randi() % faces.size()].id))
	return look

func _spawn(side: float, z: float, dir: float) -> Walker:
	var w := Walker.new()
	w.side = side
	w.dir = dir
	w.speed = STROLL * _rng.randf_range(0.8, 1.25)
	w.mover = Player.new()
	add_child(w.mover)
	w.mover.bounds = _bounds
	w.mover.ground_at = _ground
	w.mover.obstacles = _boxes
	w.mover.position = Vector3(side * walk_x + _rng.randf_range(-1.5, 1.5), 0.18, z)
	Grounding.blob(w.mover, Vector2(0.55, 0.45), 0.45)
	w.mover.cam_yaw = 0.0
	w.mover.build(random_look())
	_dress(w.mover)
	walkers.append(w)
	return w

## a walker's outfit (GTA pass, Nov 11): the civilian body dressed by shaders/clothing.gdshader — a cut (hoodie,
## t-shirt, jacket and trousers, summer, dress, long coat), real-world colours for top, trim, legs and shoes, the cloth
## (denim, suiting, chinos, joggers), and the walker's own skin tone on hands, forearms and legs. One shared material;
## the colours are instance uniforms.
const TOPS := ["#1d2433", "#e8e6e1", "#8d8f93", "#141416", "#4b5338", "#5e1f26", "#c49a3a", "#9fb7cf", "#c8b79a", "#2f4f6f", "#a33a2c", "#d9c9b4"]
const TRIMS := ["#f2f0ea", "#1a1a1c", "#6c6f75", "#c9c2b4"]
const DENIM := ["#2c3a55", "#3c4f72", "#1c2230", "#5a6f90", "#202024"]
const CHINOS := ["#b9a47e", "#7a6b52", "#3f4a3a", "#5a5752", "#2b2f3a"]
const SUITS := ["#22252d", "#3a3d44", "#2a2f3e", "#4a4338", "#151517"]
const JOGGERS := ["#2a2a2e", "#6e6f73", "#1f2b3d", "#3d4033"]
const DRESSES := ["#7a1f2b", "#1d2433", "#2f5d50", "#c7a46a", "#d8d2c8", "#5b3a6b", "#141416"]
const SNEAKERS := ["#f0efe9", "#1b1b1d", "#d8d4cc", "#8a8d92", "#b23a2a"]
const LEATHER := ["#2a1d15", "#4a2f1d", "#121212", "#6b4a2e"]
const ACCENTS := ["#c8302a", "#f0efe9", "#1b1b1d", "#e0b33a", "#3d7bd6", "#2f8f5b"]
static var _cloth: Shader

func _pick(a: Array) -> Color:
	return Color(String(a[_rng.randi() % a.size()]))

func _dress(m: Node3D) -> void:
	var rig: Node3D = m.rig
	if not rig or not rig.body_root:
		return
	if not _cloth:
		_cloth = load("res://shaders/clothing.gdshader")
	var female := String(rig.look.get("body", "male")) == "female"
	var r := _rng.randf()
	var style := 0
	# a city crowd: mostly t-shirts, jeans and jackets, some hoodies, summer clothes, dresses and coats
	if female:
		style = 1 if r < 0.3 else (2 if r < 0.48 else (4 if r < 0.7 else (0 if r < 0.82 else (5 if r < 0.92 else 3))))
	else:
		style = 1 if r < 0.34 else (2 if r < 0.56 else (0 if r < 0.76 else (5 if r < 0.86 else 3)))
	var legs_kind := 1
	var legs := _pick(DENIM)
	var lr := _rng.randf()
	if style == 2:
		legs_kind = 2
	elif style == 0:
		legs_kind = 0 if lr < 0.6 else 1
	elif lr < 0.3:
		legs_kind = 3
	match legs_kind:
		0: legs = _pick(JOGGERS)
		2: legs = _pick(SUITS)
		3: legs = _pick(CHINOS)
	var top := _pick(TOPS)
	if style == 2:
		top = legs if _rng.randf() < 0.7 else _pick(SUITS)
	elif style == 4:
		top = _pick(DRESSES)
	var shoe_kind := 1 if style == 2 or (style == 5 and _rng.randf() < 0.6) or (style == 4 and _rng.randf() < 0.5) else 0
	# the hands and bare arms and legs match the face: the head texture's own skin when it has one
	var skin: Color = rig._tex_skin if rig._tex_skin != null else rig._scalp_tone()
	for n in rig.body_root.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi == rig.head_mesh or mi == rig.hair_mesh or not mi.mesh:
			continue
		if mi.mesh.get_surface_count() != 1:
			continue
		var mat := ShaderMaterial.new()
		mat.shader = _cloth
		mi.material_override = mat
		mi.set_instance_shader_parameter("style", style)
		mi.set_instance_shader_parameter("legs_kind", legs_kind)
		mi.set_instance_shader_parameter("shoe_kind", shoe_kind)
		mi.set_instance_shader_parameter("top_col", top)
		mi.set_instance_shader_parameter("trim_col", _pick(TRIMS) if style != 2 else Color("#e9e7e2"))
		mi.set_instance_shader_parameter("leg_col", legs)
		mi.set_instance_shader_parameter("shoe_col", _pick(LEATHER) if shoe_kind == 1 else _pick(SNEAKERS))
		mi.set_instance_shader_parameter("acc_col", _pick(ACCENTS) if style != 2 else Color("#7a1f2b").lerp(_pick(TOPS), 0.4))
		mi.set_instance_shader_parameter("skin_col", skin)

## the district moved: walkers keep to lo..hi and are drawn only inside it
func set_span(lo: float, hi: float) -> void:
	span_lo = lo
	span_hi = hi

## gunfire near a walker sends them running the other way for a while
func scatter(at: Vector3, radius := 12.0) -> void:
	for w in walkers:
		if w.mover.position.distance_to(at) < radius:
			w.scare = 4.0
			w.dir = 1.0 if w.mover.position.z > at.z else -1.0

func step(dt: float) -> void:
	for w in walkers:
		var m: Node3D = w.mover
		w.scare = maxf(0.0, w.scare - dt)
		if w.pause > 0.0:
			w.pause -= dt
			m.step(dt, Vector2.ZERO, Vector2.ZERO, false, false)
			continue
		# turn back at the span's ends; a box in the way is walked round toward the kerb
		if (w.dir > 0 and m.position.z > span_hi - 6.0) or (w.dir < 0 and m.position.z < span_lo + 6.0):
			w.dir = -w.dir
			w.going = 0.0
			w.pause = _rng.randf_range(0.3, 1.2)
		var speed := HURRY if w.scare > 0.0 else w.speed
		var toward_line := (w.side * walk_x - m.position.x) * 0.4
		# give the operator room
		if player:
			var d := m.position - player.position
			d.y = 0.0
			if d.length() < 1.6:
				toward_line += signf(d.x if absf(d.x) > 0.05 else w.side) * 1.0
		var want := Vector2(clampf(toward_line, -0.6, 0.6), -w.dir)   # cam_yaw 0: stick y walks -z
		# the mover's stick bands: under 0.6 it walks at WALK × stick, above it runs at RUN × stick
		var mag := speed / Player.WALK if speed <= Player.WALK * 0.6 else speed / Player.RUN
		m.step(dt, want.normalized() * mag, Vector2.ZERO, false, false)
		w.going += dt
		if w.going > 0.6 and Vector2(m.velocity.x, m.velocity.z).length() < 0.15:
			# blocked by a box or another walker: turn round after a moment
			w.pause = 0.4
			w.dir = -w.dir
			w.going = 0.0
		m.visible = m.position.z >= span_lo and m.position.z <= span_hi
