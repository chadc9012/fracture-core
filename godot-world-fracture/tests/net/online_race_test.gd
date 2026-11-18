extends SceneTree
## Races between players (race_view.gd `online`) against the local stand-in (tests/net/realtime_mock.py on 4501): two
## players wait on the Speedway's line with no AI rivals; one presses START and both grids fill in roster order; each
## draws the other's car where it drives; one finishing tells the other. Alone, the track's pace sets the place.
## Prints "online race: N failed".

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
	var RaceView = load("res://scripts/racing/race_view.gd")
	var a = RaceView.new()
	a.track_id = "nexus-speedway"
	a.laps = 1
	a.online = true
	a.net = _net("alice", "Alice")
	root.add_child(a)
	var b = RaceView.new()
	b.track_id = "nexus-speedway"
	b.laps = 1
	b.online = true
	b.net = _net("bob", "Bob")
	root.add_child(b)
	await process_frame
	ok(a.rivals.is_empty() and a.race.entries.size() == 1 and a.countdown == INF and a.lobby != null, "online: no AI rivals, waiting on the line")
	ok(await _wait(func(): return a.room.members.has("bob") and b.room.members.has("alice")), "both are in the track's room")
	await _wait(func(): return false, 0.5)
	ok(a._who.text.contains("Bob"), "the lobby lists who's on the line (%s)" % a._who.text.replace("\n", " / "))
	a.start_online()
	ok(await _wait(func(): return b.countdown != INF and b.lobby == null), "START from one starts the other")
	ok(a.player.node.position.distance_to(a.track.grid(0).origin) < 0.5 and b.player.node.position.distance_to(b.track.grid(1).origin) < 0.5, "grids in roster order (Alice 1st, Bob 2nd)")
	ok(await _wait(func(): return b.remotes.has("alice") and a.remotes.has("bob")), "each draws the other's car")
	ok(a.race.entries.size() == 2 and String(b.remotes.alice.entry.name) == "Alice", "two players in the race, by name")
	a.countdown = 0.01
	b.countdown = 0.01
	a.autopilot = true
	a.controls.scripted = true
	b.controls.scripted = true
	await _wait(func(): return a.race.started and a.race.time > 3.0, 30.0)
	await _wait(func(): return false, 0.5)
	var bp: Vector3 = b.remotes.alice.node.position
	ok(bp.distance_to(a.player.node.position) < 12.0, "Alice's car moves on Bob's screen (%.1f m off)" % bp.distance_to(a.player.node.position))
	# Alice crosses the line
	var me: Dictionary = a.race.player()
	me.finished_at = a.race.time
	me.laps = 1
	a.room.send("fin", { "t": a.race.time })
	ok(await _wait(func(): return float(b.remotes.alice.entry.finished_at) >= 0.0), "her finish reaches Bob")
	ok(b.race.position_of(b.race.player()) == 2, "Bob is second")
	a.queue_free()
	b.queue_free()
	await process_frame
	# alone: the pace
	var c = RaceView.new()
	c.track_id = "nexus-speedway"
	c.laps = 1
	c.online = true
	c.net = _net("cara", "Cara")
	root.add_child(c)
	await process_frame
	c.start_online()
	c.race.player().finished_at = c.pace_time() * 0.99
	ok(c._pace_place() == 1, "alone, inside the pace is a win")
	c.race.player().finished_at = c.pace_time() * 1.1
	ok(c._pace_place() == 3, "and 10% outside it third")
	print("online race: %d failed" % failed)
	quit(1 if failed > 0 else 0)
