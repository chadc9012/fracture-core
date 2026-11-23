extends SceneTree
## An online raid fireteam (raid_view.gd `online`, online_raid.gd) against the local stand-in (realtime_mock.py, 4501):
## Alice and Bob in The Broken Gate, then in The Hollow Star. The first in leads and runs the raid; a bot is benched for
## the other player; the follower draws the leader's bots and void troopers, its hits land on the leader's troopers and
## the star, its down spends a shared life, the void's rounds on its body here come off its own hull; the star's beams
## reach both screens; when the leader goes the follower takes the lead with the bots.
## Prints "online raid: N failed".

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

func _view(start: String, id: String, nm: String) -> Control:
	var RV = load("res://scripts/raid/raid_view.gd")
	var v = RV.new()
	v.start_at = start
	v.online = true
	v.net = _net(id + "-" + start, nm)
	v.net.id = id
	v.net.rt.me = id
	root.add_child(v)
	v.controls.scripted = true
	return v

func _run() -> void:
	Online.url_override = "ws://127.0.0.1:4501"
	# ---------------------------------------------------------------- the gate
	var a = _view("broken-gate", "alice", "Alice")
	ok(await _wait(func(): return a.net_raid.decided), "Alice is in the gate's room and has settled")
	ok(a.net_raid.leader and a.allies.size() == 5, "alone, Alice leads with five bots")
	var b = _view("broken-gate", "bob", "Bob")
	ok(await _wait(func(): return b.net_raid.decided), "Bob is in and has settled")
	ok(not b.net_raid.leader and b.net_raid.leader_id == "alice", "Bob follows; Alice leads (she was in first)")
	ok(b.allies.is_empty(), "Bob runs no bots of his own")
	ok(await _wait(func(): return a.allies.filter(func(e): return e.has_meta("benched")).size() == 1), "a bot is benched for Bob (six in the fireteam)")
	ok(await _wait(func(): return b.net_raid.by_nid.values().filter(func(e): return e.team == 1 and e.target.alive()).size() == 4), "Bob sees Alice's four bots")
	ok(await _wait(func(): return a.net_raid.players.has("bob") and a.net_raid.players.bob.enemy != null), "Bob stands on Alice's field as one of the fireteam")
	ok(await _wait(func(): return b.net_raid.players.has("alice") and b.net_raid.players.alice.body != null), "Alice stands on Bob's screen")
	await _wait(func(): return false, 0.5)
	var stand: RefCounted = a.net_raid.players.bob.enemy
	ok(stand.mover.position.distance_to(b.operator.position) < 2.0, "Bob's body is where he is (%.1f m)" % stand.mover.position.distance_to(b.operator.position))
	# the first wave out of the rift, on both screens
	a._wave_t = 0.0
	ok(await _wait(func(): return a._hostiles_alive() > 0), "Alice's rift sends a wave")
	ok(await _wait(func(): return b._hostiles_alive() == a._hostiles_alive()), "Bob sees the same troopers (%d / %d)" % [b._hostiles_alive(), a._hostiles_alive()])
	# Bob's round on a trooper lands on Alice's trooper
	var pup: RefCounted = b.net_raid.by_nid.values().filter(func(e): return e.team == 0 and e.target.alive())[0]
	var real: RefCounted = a.net_raid.by_nid[int(pup.get_meta("nid"))]
	var hp0: float = real.target.hp + real.target.shield
	b.gunplay.hit.emit(pup.target, 25.0, false)
	ok(await _wait(func(): return real.target.hp + real.target.shield < hp0 - 20.0), "Bob's hit comes off Alice's trooper (%.0f → %.0f)" % [hp0, real.target.hp + real.target.shield])
	# the void's round on Bob's body there comes off Bob's hull
	var h0: float = b.enemies.hull + b.enemies.shield
	a.enemies.remote_hit.emit(stand, 18.0)
	ok(await _wait(func(): return b.enemies.hull + b.enemies.shield < h0 - 15.0), "a void round on Bob's body comes off Bob's hull (%.0f → %.0f)" % [h0, b.enemies.hull + b.enemies.shield])
	# Bob going down spends one of the fireteam's lives, on both screens
	var lives0: int = a.raid.lives
	b.enemies.shield = 0.0
	b.enemies._hit_operator(9999.0)
	ok(await _wait(func(): return a.raid.lives == lives0 - 1), "Bob's down costs the fireteam a life (%d → %d)" % [lives0, a.raid.lives])
	ok(await _wait(func(): return b.raid.lives == a.raid.lives), "and Bob's HUD shows the same lives")
	# a pylon held by Bob alone charges on Alice's raid
	b.enemies.down = 0.0
	b.enemies.hull = b.enemies.hull_max
	for e in a.enemies.enemies:
		if e.team == 0:
			e.target.hp = 0.0
			e.set_meta("gone", true)
			a.gunplay.targets.erase(e.target)
		elif not e.has_meta("remote"):
			e.mover.position = Vector3(0, 0, 30)
	for al in a.allies:
		al.set_meta("posted", false)
	a.operator.position = Vector3(0, 0, 30)
	var pp: Vector3 = a.pylon_pos[0]
	b.operator.position = pp + Vector3(0.5, 0, 0.5)
	var p0: float = a.raid.pylons[0]
	await _wait(func(): return false, 1.5)
	ok(a.raid.pylons[0] > p0 or a.allies.any(func(al): return not al.has_meta("benched") and al.mover.position.distance_to(pp) < 4.0), "Bob standing in a pylon's ring holds it on Alice's raid (%.2f → %.2f)" % [p0, a.raid.pylons[0]])
	ok(await _wait(func(): return absf(b.raid.pylons[0] - a.raid.pylons[0]) < 0.05), "and Bob's HUD shows its charge")
	a.queue_free()
	b.queue_free()
	await _wait(func(): return false, 0.5)
	# ---------------------------------------------------------------- the star
	var a2 = _view("hollow-star-boss", "alice", "Alice")
	ok(await _wait(func(): return a2.net_raid.decided and a2.net_raid.leader), "Alice leads in the final chamber")
	var b2 = _view("hollow-star-boss", "bob", "Bob")
	ok(await _wait(func(): return b2.net_raid.decided and not b2.net_raid.leader), "Bob follows her down")
	await _wait(func(): return a2.net_raid.players.has("bob"))
	var hp_0: float = a2.raid.boss_hp
	b2._on_hit(b2.boss_target, 140.0, false)
	ok(await _wait(func(): return a2.raid.boss_hp < hp_0 - 0.5), "Bob's rounds on the star come off Alice's star (%.1f → %.1f)" % [hp_0, a2.raid.boss_hp])
	ok(await _wait(func(): return absf(b2.raid.boss_hp - a2.raid.boss_hp) < 0.6), "and Bob's bar shows it")
	a2._beam_t = 0.0
	ok(await _wait(func(): return not b2._beams.is_empty()), "the star's beam reaches Bob's screen")
	# Alice goes: Bob takes the lead and the bots
	a2.net_raid.room.leave()
	a2.queue_free()
	ok(await _wait(func(): return b2.net_raid.leader, 12.0), "Alice gone, Bob leads")
	ok(b2.allies.size() == 5, "with five bots of his own")
	print("online raid: %d failed" % failed)
	quit(1 if failed > 0 else 0)
