extends Node
## Destructible cover in the Killbox (asset catalog §5), played without a window: the breakable cover rows are Gunplay
## targets with the arena's hull for their kind, a bolt chips one, the last bolt breaks it — the mesh goes, chips fly,
## the box leaves the operator's obstacle list and the bots' (one shared array), and the arena remembers the gap through
## the fracture event's obstacle rebuild.
##   godot --headless --path godot-world-fracture res://tests/killbox/cover_play.tscn
const ArenaView := preload("res://scripts/killbox/arena_view.gd")
const Arena := preload("res://scripts/killbox/arena.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _ready() -> void:
	await _run()
	print("cover play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _run() -> void:
	var v := ArenaView.new()
	v.arena_id = "killbox-prime"
	v.mode_id = "clash"
	add_child(v)
	await _frames(4)
	var breakable := 0
	for c in v.arena.def.cover:
		if Arena.breakable(String(c.kind)):
			breakable += 1
	ok(breakable > 0 and v._cover_targets.size() == breakable, "every breakable cover row is a target: %d of %d rows" % [v._cover_targets.size(), v.arena.def.cover.size()])
	var registered := 0
	for t in v.gunplay.targets:
		if t.has_meta("prop"):
			registered += 1
	ok(registered == breakable, "the cover targets are registered with gunplay: %d" % registered)
	var n0: int = v.operator.obstacles.size()
	var id: String = v._cover_targets.keys()[0]
	var t: Gunplay.Target = v._cover_targets[id]
	ok(t.max_hp == float(Arena.BREAKABLE[String(t.get_meta("prop"))]) and t.node.visible, "%s (%s) stands with %d hull" % [id, String(t.get_meta("prop")), int(t.max_hp)])
	# the bots share the operator's obstacle array
	var shared: bool = not v.enemies.enemies.is_empty() and v.enemies.enemies[0].mover.obstacles == v.operator.obstacles
	ok(shared, "the bots read the operator's obstacle list")
	# a bolt from in front of the box, aimed at its centre: the hull drops; the rest of them break it
	var centre: Vector3 = t.box.get_center()
	v.operator.position = centre + Vector3(0, 0, 6.0)
	v.operator.position.y = t.box.position.y
	var cam := Camera3D.new()
	add_child(cam)
	v.gunplay.assist_deg = 0.0
	var before_hp: float = t.hp
	var shots := 0
	while t.alive() and shots < 400:
		cam.global_position = v.operator.position + Vector3(0, 1.5, 0)
		cam.look_at(centre, Vector3.UP)
		v.gunplay.step(0.5, cam, true, false, 0.0)
		shots += 1
	ok(shots > 1 and t.hp < before_hp, "bolts chip the cover: %d shots to break it" % shots)
	await _frames(2)
	ok(not t.alive() and not t.node.visible and v.arena.broken.has(id), "the last bolt breaks it: mesh gone, arena remembers " + id)
	ok(v.operator.obstacles.size() == n0 - 1, "the box leaves the obstacle list: %d → %d" % [n0, v.operator.obstacles.size()])
	ok(v.enemies.enemies[0].mover.obstacles.size() == n0 - 1, "…and the bots' at once")
	var chips := 0
	for tr in v.gunplay._tracers:
		if tr.has("floor") and not tr.has("casing"):
			chips += 1
	ok(chips >= 8, "chips fly: %d" % chips)
	ok(v.gunplay.kills == 0, "a broken prop is no kill")
	# the fracture event rebuilds the obstacles; the gap stays
	v._set_event(true)
	await _frames(1)
	ok(not v.operator.obstacles.has(t.box) and v.arena.broken.has(id), "the gap survives the fracture event's rebuild")
	v._set_event(false)
	# the prop never stands again
	v.gunplay.step(10.0, cam, false, false, 0.0)
	ok(not t.alive() and not t.node.visible, "it stays broken")
	v.queue_free()
	await _frames(2)
