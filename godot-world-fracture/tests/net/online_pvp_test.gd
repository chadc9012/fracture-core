extends SceneTree
## An online Killbox match (arena_view.gd `online`, online_pvp.gd) against the local stand-in (realtime_mock.py, 4501):
## two players, no bots; they take opposite sides; each sees the other; a hit from one comes off the other's hull; a
## takedown scores for the killer's side on both screens.
## Prints "online pvp: N failed".

const Online := preload("res://scripts/net/online.gd")
var failed := 0

func ok(c: bool, what: String) -> void:
	print(("ok   " if c else "FAIL ") + what)
	if not c:
		failed += 1

func _initialize() -> void:
	_run.call_deferred()

func _net(id: String, nm: String) -> Node:
	var n: Node = Online.new()
	n.name = "Online-" + id
	root.add_child(n)
	n.id = id
	n.display = nm
	n.rt.me = id
	return n

func _wait(cond: Callable, secs := 8.0) -> bool:
	var t0 := Time.get_ticks_msec()
	while not cond.call() and Time.get_ticks_msec() - t0 < secs * 1000.0:
		await process_frame
	return cond.call()

func _run() -> void:
	Online.url_override = "ws://127.0.0.1:4501"
	var AV = load("res://scripts/killbox/arena_view.gd")
	var Arena = load("res://scripts/killbox/arena.gd")
	var id := String(Arena.arena_ids()[0])
	var a = AV.new()
	a.arena_id = id
	a.online = true
	a.net = _net("alice", "Alice")
	root.add_child(a)
	ok(await _wait(func(): return a.net_pvp.room.is_joined), "Alice is in the arena's room")
	var b = AV.new()
	b.arena_id = id
	b.online = true
	b.net = _net("bob", "Bob")
	root.add_child(b)
	await process_frame
	ok(a.enemies.enemies.is_empty() and b.enemies.enemies.is_empty(), "no bots on either side")
	await _wait(func(): return a.net_pvp.sided and b.net_pvp.sided)
	ok(a.net_pvp.side != b.net_pvp.side, "they take opposite sides (%s / %s)" % [a.net_pvp.side, b.net_pvp.side])
	a.controls.scripted = true
	b.controls.scripted = true
	ok(await _wait(func(): return a.net_pvp.fighters.has("bob") and b.net_pvp.fighters.has("alice")), "each sees the other")
	await _wait(func(): return false, 0.6)
	var fb: Dictionary = a.net_pvp.fighters.bob
	ok((fb.body as Node3D).position.distance_to(b.operator.position) < 2.0, "Bob stands where he is (%.1f m)" % (fb.body as Node3D).position.distance_to(b.operator.position))
	# Alice's round lands on Bob's body here
	var hull0: float = b.enemies.hull + b.enemies.shield
	a.gunplay.hit.emit(fb.target, 30.0, false)
	ok(await _wait(func(): return b.enemies.hull + b.enemies.shield < hull0 - 25.0), "the hit comes off Bob's shield and hull on his screen (%.0f → %.0f)" % [hull0, b.enemies.hull + b.enemies.shield])
	ok(float(fb.target.hp) == a.net_pvp.HP, "and Bob's body here stays whole (his hull lives with him)")
	# Bob goes down to Alice
	b.enemies.shield = 0.0
	b.net_pvp.last_hit_by = "alice"
	b.enemies._hit_operator(9999.0)
	ok(await _wait(func(): return a.match_state.us == 1), "Alice's side scores the takedown (%d – %d)" % [a.match_state.us, a.match_state.them])
	ok(b.match_state.them == 1 and a.match_state.player_kills == 1, "Bob's screen gives it to the other side; it's Alice's kill")
	print("online pvp: %d failed" % failed)
	quit(1 if failed > 0 else 0)
