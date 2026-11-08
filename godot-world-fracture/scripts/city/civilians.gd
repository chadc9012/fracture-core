extends Node3D
## Civilians on the street slices (asset catalog: Characters & NPCs → Civilian; Everyday civilian life). A pooled budget
## of walkers on both sidewalks, each an operator_player.gd mover wearing a random authored face from the character
## catalog (male / female frames, never robot) and a casual tint, walking the block at a stroll, turning back at the
## district's active span or when they bump a box, and stepping round the operator. They are not obstacles (the operator
## walks past them, the budget stays cheap) and they are not targets: shooting a civilian does nothing but scatter them.
## Pure enough to test headless: give it the ground, the bounds and the shared boxes.

const Player := preload("res://scripts/player/operator_player.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Catalog := preload("res://scripts/character/catalog.gd")
const STROLL := 1.35
const HURRY := 3.4
const CASUAL := [Color(0.35, 0.4, 0.5), Color(0.6, 0.25, 0.25), Color(0.25, 0.45, 0.3), Color(0.5, 0.5, 0.55), Color(0.7, 0.6, 0.35), Color(0.2, 0.2, 0.25), Color(0.75, 0.75, 0.78)]

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
	w.mover.cam_yaw = 0.0
	w.mover.build(random_look())
	_tint(w.mover, CASUAL[_rng.randi() % CASUAL.size()])
	walkers.append(w)
	return w

func _tint(m: Node3D, c: Color) -> void:
	var rig: Node3D = m.rig
	if not rig or not rig.body_root:
		return
	for n in rig.body_root.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi == rig.head_mesh or mi == rig.hair_mesh or not mi.mesh:
			continue
		for i in mi.mesh.get_surface_count():
			var base: Material = mi.mesh.surface_get_material(i)
			if base is StandardMaterial3D:
				var mat := (base as StandardMaterial3D).duplicate() as StandardMaterial3D
				mat.albedo_color = Color(1, 1, 1).lerp(c * 1.5, 0.7)
				mi.set_surface_override_material(i, mat)

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
