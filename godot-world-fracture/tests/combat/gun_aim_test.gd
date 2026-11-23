extends SceneTree
## enemies.gd: a bot's rifle points down its heading on patrol and at its foe in a fight, never behind its back (owner,
## Nov 23: "NPCs and other characters gun still flipped backwards"). The barrel is the held node's +Z (gunplay's mount).
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")

var p: Node3D
var en: Node
var bots: Array = []
var frame := 0
var worst_patrol := 1.0
var worst_fight := 1.0
var armed := 0

func _initialize() -> void:
	p = Player.new()
	root.add_child(p)
	p.bounds = Rect2(-60, -120, 120, 240)
	p.ground_at = func(_x: float, _z: float) -> float: return 0.0
	var boxes: Array[AABB] = [AABB(Vector3(-200, 0, 200), Vector3(1, 1, 1))]
	p.obstacles = boxes
	var g := Gunplay.new()
	root.add_child(g)
	g.setup(p, p.obstacles)
	en = Enemies.new()
	root.add_child(en)
	en.setup(p, g)
	for t in ["scout", "marksman", "elite"]:
		bots.append(en.spawn(t, Vector3(randf_range(-20, 20), 0, -45.0 - bots.size() * 6.0), [Vector3(-15, 0, -80), Vector3(15, 0, -80)]))

func _process(dt: float) -> bool:
	frame += 1
	en.step(1.0 / 60.0)
	if frame > 30:
		for e in bots:
			if not e.held or not e.held.is_inside_tree() or e.state == Enemies.State.DOWN:
				continue
			var fwd: Vector3 = e.held.global_transform.basis.z.normalized()
			if e.state == Enemies.State.PATROL:
				var h: float = e.mover.heading
				worst_patrol = minf(worst_patrol, fwd.dot(Vector3(sin(h), 0, cos(h))))
			elif e.state == Enemies.State.ENGAGE:
				var to: Vector3 = (p.global_position + Vector3(0, 1.1, 0) - e.held.global_position).normalized()
				worst_fight = minf(worst_fight, fwd.dot(to))
			armed += 1
	if frame == 60 * 3:
		p.position = Vector3(0, 0, -30)     # walk into their sight
	if frame >= 60 * 8:
		var ok := armed > 0 and worst_patrol > 0.8 and worst_fight > 0.7
		print("bot guns: samples ", armed, " worst patrol dot ", snappedf(worst_patrol, 0.01), " worst fight dot ", snappedf(worst_fight, 0.01))
		print("Gun aim test: ", ok)
		quit(0 if ok else 1)
		return true
	return false
