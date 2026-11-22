extends Node
## Story co-op (descent.gd `online`, online_story.gd, online_coop.gd) against the local stand-in (realtime_mock.py, 4501):
## Alice and Bob on the same chapter of the Fracture Descent. The first in leads; Bob sees Alice's patrols, his kill
## counts for the chapter, and when Alice's chapter is done so is his (his own rewards) and both move on to the next
## room together; Bob standing at a relay locks it for Alice; Vyrak's echo on Bob's screen takes its hull from Alice's
## and Bob's rounds hurt Alice's; when Alice goes, Bob leads the chapter. The player's saves are put back afterwards.
##   python3 tests/net/realtime_mock.py 4501 &   godot --headless --path godot-world-fracture res://tests/net/online_story.tscn
const Online := preload("res://scripts/net/online.gd")
const Descent := preload("res://scripts/mission/descent.gd")
const SAVES := ["user://quests.json", "user://profile.json", "user://inventory.json", "user://online.json"]
var fails := 0
var _kept := {}

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _net(id: String, nm: String) -> Node:
	var n: Node = Online.new()
	n.name = "Online-%s-%d" % [id, randi()]
	add_child(n)
	n.id = id
	n.display = nm
	n.rt.me = id
	return n

func _wait(cond: Callable, secs := 10.0) -> bool:
	var t0 := Time.get_ticks_msec()
	while not cond.call() and Time.get_ticks_msec() - t0 < secs * 1000.0:
		for v in get_children():
			if v is Control and v.get("cutscene") and v.cutscene.playing:
				v.cutscene._end()
		await get_tree().process_frame
	return cond.call()

func _view(id: String, nm: String, chapter: String, extra := {}) -> Control:
	var q := { "done": [], "current": chapter, "kills": 0, "relay": 0, "timer": 0.0, "wave": 0, "stage": 0 }
	q.merge(extra, true)
	var f := FileAccess.open("user://quests.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(q))
	f.close()
	var v: Control = Descent.new()
	v.net = _net(id, nm)
	add_child(v)
	await get_tree().process_frame
	return v

func _ready() -> void:
	for p in SAVES:
		var f := FileAccess.open(p, FileAccess.READ)
		_kept[p] = f.get_as_text() if f else null
	Online.url_override = "ws://127.0.0.1:4501"
	await _run()
	for p in SAVES:
		if _kept[p] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		else:
			var w := FileAccess.open(p, FileAccess.WRITE)
			w.store_string(String(_kept[p]))
	print("online story: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)

func _run() -> void:
	# ---------------------------------------------------------------- fd-02: the forest patrols, together
	var a := await _view("alice", "Alice", "fd-02")
	ok(a.coop != null, "Alice's chapter opens its co-op room (%s)" % (a.coop.room_name() if a.coop else "none"))
	ok(await _wait(func(): return a.coop.decided), "Alice has settled in the room")
	ok(a.coop.leader and a.authority(), "alone, Alice leads and runs the chapter")
	var b := await _view("bob", "Bob", "fd-02")
	ok(await _wait(func(): return b.coop and b.coop.decided), "Bob has settled in the room")
	ok(not b.coop.leader and not b.authority() and b.coop.leader_id == "alice", "Bob follows Alice's chapter")
	ok(await _wait(func(): return a._alive() > 0), "Alice's forest sends a patrol")
	ok(await _wait(func(): return b._alive() == a._alive() and b._alive() > 0), "Bob sees Alice's patrol (%d / %d)" % [b._alive(), a._alive()])
	ok(b.enemies.enemies.all(func(e): return e.has_meta("puppet")), "Bob runs no troopers of his own")
	ok(await _wait(func(): return a.coop.players.has("bob") and a.coop.players.bob.enemy != null), "Bob stands on Alice's field")
	# Bob's rounds put a trooper down: the chapter's count goes up on both screens
	var k0: int = int(a.progress.kills)
	var pup: RefCounted = b.coop.by_nid.values().filter(func(e): return e.team == 0 and e.target.alive())[0]
	var real: RefCounted = a.coop.by_nid.get(int(pup.get_meta("nid")))
	ok(real != null, "Bob's trooper is one of Alice's (#%d)" % int(pup.get_meta("nid")))
	for i in 12:
		if real == null or not real.target.alive():
			break
		b.gunplay.hit.emit(pup.target, 60.0, true)
		await get_tree().process_frame
	ok(await _wait(func(): return int(a.progress.kills) == k0 + 1), "Bob's kill counts for the chapter (%d → %d)" % [k0, int(a.progress.kills)])
	ok(await _wait(func(): return int(b.progress.kills) == int(a.progress.kills)), "and Bob's HUD shows it (%d)" % int(b.progress.kills))
	# the chapter done on Alice's screen is done on Bob's, and both go on to fd-03's room
	var paid0: int = (load("res://scripts/gear/gear_store.gd").profile_load().get("ledger", []) as Array).size()
	a.progress.kills = int(a.quest.amount) - 1
	a._on_kill(null)
	ok(await _wait(func(): return String(a.quest.get("id", "")) == "fd-03"), "Alice's fd-02 is done; she is on fd-03")
	ok(await _wait(func(): return String(b.quest.get("id", "")) == "fd-03"), "Bob's fd-02 is done with hers; he is on fd-03")
	ok("fd-02" in b.progress.done, "fd-02 is in Bob's own record")
	var paid: int = (load("res://scripts/gear/gear_store.gd").profile_load().get("ledger", []) as Array).size() - paid0
	ok(paid >= 2, "the chapter paid both of them (%d payments; the test's two players share one profile)" % paid)
	ok(await _wait(func(): return a.coop and a.coop.decided and b.coop and b.coop.decided), "both are in fd-03's room")
	ok(a.coop.room_name().ends_with("fd-03") and b.coop.leader_id == "alice", "Alice still leads (she got there first)")
	# fd-03: Bob standing at the relay locks it on Alice's chapter
	var relay: Vector3 = a.waypoint
	ok(await _wait(func(): return b.waypoint.distance_to(relay) < 1.0), "Bob's waypoint is Alice's relay")
	b.operator.position = relay + Vector3(1, 0, 1)
	ok(await _wait(func(): return int(a.progress.relay) == 1), "Bob at the relay locks it for the fireteam (%d)" % int(a.progress.relay))
	ok(await _wait(func(): return b.waypoint.distance_to(a.waypoint) < 1.0 and b.waypoint.distance_to(relay) > 5.0), "and both move on to the next relay")
	# Alice goes: Bob leads, and with the relays all locked the source's guards come out on his field
	a.progress.relay = 3
	await _wait(func(): return int(b.progress.relay) == 3)
	a.coop.room.leave()
	a.queue_free()
	ok(await _wait(func(): return b.authority(), 14.0), "Alice gone, Bob leads the chapter")
	ok(await _wait(func(): return b._guards.size() == 3), "and the source's guards stand on his field (%d)" % b._guards.size())
	b.queue_free()
	await _wait(func(): return false, 0.5)
	# ---------------------------------------------------------------- fd-07: Vyrak, together
	var a2 := await _view("alice", "Alice", "fd-07", { "wave": 3 })
	ok(await _wait(func(): return a2.coop and a2.coop.decided and a2.boss != null), "Alice leads fd-07 with Vyrak up")
	var b2 := await _view("bob", "Bob", "fd-07", { "wave": 3 })
	ok(await _wait(func(): return b2.coop and b2.coop.decided and not b2.coop.leader), "Bob follows her into the core")
	ok(await _wait(func(): return b2.boss != null and b2.boss.echo), "Vyrak stands on Bob's screen as an echo of Alice's")
	var h0: float = a2.boss.rules.hull
	b2.gunplay.hit.emit(b2.boss.target, 300.0, false)
	ok(await _wait(func(): return a2.boss.rules.hull < h0 - 100.0), "Bob's rounds come off Alice's Vyrak (%.0f → %.0f)" % [h0, a2.boss.rules.hull])
	ok(await _wait(func(): return absf(b2.boss.rules.hull - a2.boss.rules.hull) < 1.0), "and his echo shows the same hull")
	ok(await _wait(func(): return b2.boss.position.distance_to(a2.boss.position) < 3.0), "where Alice's stands")
	a2.boss.rules.hit(1e9)
	ok(await _wait(func(): return b2.boss.rules.dead), "Alice's Vyrak down: Bob's echo falls too")
	ok(await _wait(func(): return "fd-07" in b2.progress.done, 30.0), "and Bob's fd-07 is done")
	a2.queue_free()
	b2.queue_free()
	await _wait(func(): return false, 0.5)
