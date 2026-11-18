extends SceneTree
## realtime.gd against the local stand-in (tests/net/realtime_mock.py on port 4501, started by the caller): two clients
## join one room, see each other through presence, pass broadcasts both ways (never their own), and one leaving shows.
##   python3 tests/net/realtime_mock.py 4501 &  godot --headless --path . --script res://tests/net/realtime_test.gd
## Prints "realtime: N failed".

const Realtime := preload("res://scripts/net/realtime.gd")
var failed := 0

func ok(c: bool, what: String) -> void:
	print(("ok   " if c else "FAIL ") + what)
	if not c:
		failed += 1

func _initialize() -> void:
	_run.call_deferred()

func _wait(cond: Callable, secs := 5.0) -> bool:
	var t0 := Time.get_ticks_msec()
	while not cond.call() and Time.get_ticks_msec() - t0 < secs * 1000.0:
		await process_frame
	return cond.call()

func _run() -> void:
	var a := Realtime.new()
	var b := Realtime.new()
	for c in [a, b]:
		c.url = "ws://127.0.0.1:4501"
		root.add_child(c)
	a.me = "alice"
	b.me = "bob"
	var ra = a.room("world:neon")
	ra.track({ "name": "Alice", "frame": "goliath" })
	ok(await _wait(func(): return ra.is_joined), "a joins the room")
	var rb = b.room("world:neon")
	rb.track({ "name": "Bob" })
	ok(await _wait(func(): return ra.members.has("bob") and rb.members.has("alice")), "presence: each sees the other")
	ok(String(rb.members.get("alice", {}).get("name", "")) == "Alice", "with the name tracked")
	var got := []
	rb.message.connect(func(ev, data, from): got.append([ev, data, from]))
	var mine := []
	ra.message.connect(func(ev, data, from): mine.append(ev))
	ra.send("pos", { "p": [1, 2, 3] })
	ok(await _wait(func(): return got.size() == 1), "a broadcast arrives")
	ok(not got.is_empty() and got[0][0] == "pos" and got[0][2] == "alice" and int(got[0][1].p[1]) == 2, "event, data and sender")
	await _wait(func(): return false, 0.3)
	ok(mine.is_empty(), "never your own")
	var gone := []
	ra.left.connect(func(k): gone.append(k))
	rb.leave()
	ok(await _wait(func(): return gone.has("bob")), "a leaving player leaves the others' rooms")
	print("realtime: %d failed" % failed)
	quit(1 if failed > 0 else 0)
