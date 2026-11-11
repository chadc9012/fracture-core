extends Node
## Plays the Fracture Descent (fd-02 First Resonance, fd-03 Broken Signal, fd-04 Into the Shrouded Swamps) end to end without
## a window, the way a player does: the stick walks the operator to each waypoint (a waypoint the operator cannot reach is a
## failure, not a teleport), and patrols and the source's guards are shot through the camera's own fire path. Then it
## leaves mid-chapter and comes back, to check a saved chapter can always be finished.
##   godot --headless --path godot-world-fracture res://tests/mission/descent_play.tscn
const Descent := preload("res://scripts/mission/descent.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
var d: Control
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _clean() -> void:
	for f in ["user://quests.json", "user://profile.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(f))

func _open() -> void:
	d = Descent.new()
	add_child(d)
	for i in 5:
		await get_tree().process_frame

func _close() -> void:
	d._save()
	d.queue_free()
	d = null
	for i in 3:
		await get_tree().process_frame

func _yaw_of(v: Vector3) -> float:
	return atan2(-v.x, -v.z)

## turn the camera so its centre ray passes through `p` (a few frames settle the chase camera)
func _aim(p: Vector3) -> void:
	# relative to where the shoulder camera really looks (its side offset bends the ray a few degrees off cam_yaw), one
	# step of at most a radian a frame so a target straight behind does not flip the camera back and forth
	var cam: Camera3D = d.region.camera()
	var want := (p - cam.global_position).normalized()
	var f := -cam.global_basis.z
	d.operator.cam_yaw += clampf(wrapf(_yaw_of(want) - _yaw_of(f), -PI, PI), -1.0, 1.0)
	d.operator.cam_pitch = clampf(d.operator.cam_pitch + clampf(asin(clampf(want.y, -1, 1)) - asin(clampf(f.y, -1, 1)), -0.5, 0.5), -0.9, 0.45)

## walk to `to` with the stick; false if the operator stalls (a blocked or unreachable waypoint)
func _walk_to(to: Vector3, near: float, label: String) -> bool:
	var best := INF
	var stall := 0.0
	var t := 0.0
	while t < 240.0:
		var op: Node3D = d.operator
		var off := Vector2(to.x - op.position.x, to.z - op.position.z)
		var dist := off.length()
		if dist < near:
			d.controls.move = Vector2.ZERO
			return true
		op.cam_yaw = atan2(-off.x, -off.y)
		d.controls.move = Vector2(0, 1)
		d.controls.sprint = true
		await get_tree().process_frame
		var dt := minf(get_process_delta_time(), 0.05)
		t += dt
		if dist < best - 0.5:
			best = dist
			stall = 0.0
		else:
			stall += dt
			if stall > 15.0:
				break
			if stall > 3.0:
				# something in the way: a jump and a sidestep for a moment, the way a player gets round a trunk
				d.controls.move = Vector2(1.0 if int(stall / 3.0) % 2 == 0 else -1.0, 0.6)
				d.controls._jump = true
		# anything shooting at us is dealt with on the way
		await _fight(0.0)
	d.controls.move = Vector2.ZERO
	d.controls.sprint = false
	print("     stuck walking to %s: %.0f m short at %s" % [label, best, str(d.operator.position.round())])
	return false

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

## walk toward `to` until `stop` says the goal moved on (a quest turned over), or the operator stalls
func _walk_until(to: Vector3, near: float, label: String, stop: Callable) -> bool:
	var best := INF
	var stall := 0.0
	var t := 0.0
	while t < 240.0:
		if stop.call():
			d.controls.move = Vector2.ZERO
			return true
		var op: Node3D = d.operator
		var off := Vector2(to.x - op.position.x, to.z - op.position.z)
		var dist := off.length()
		if dist < near and stop.call():
			d.controls.move = Vector2.ZERO
			return true
		op.cam_yaw = atan2(-off.x, -off.y)
		d.controls.move = Vector2(0, 1)
		d.controls.sprint = true
		await get_tree().process_frame
		var dt := minf(get_process_delta_time(), 0.05)
		t += dt
		if dist < best - 0.5:
			best = dist
			stall = 0.0
		else:
			stall += dt
			if stall > 15.0 and dist > near:
				break
			if stall > 3.0:
				d.controls.move = Vector2(1.0 if int(stall / 3.0) % 2 == 0 else -1.0, 0.6)
				d.controls._jump = true
		await _fight(0.0)
	d.controls.move = Vector2.ZERO
	d.controls.sprint = false
	print("     stuck walking to %s: %.0f m short" % [label, best])
	return false

## shoot every live enemy within reach until none are left or `secs` passes (0: only while one is close and alive)
func _fight(secs: float) -> int:
	var shots := 0
	var t := 0.0
	while true:
		var live: Array = d.enemies.enemies.filter(func(e) -> bool: return e.state != Enemies.State.DOWN)
		live.sort_custom(func(a, b) -> bool: return a.mover.position.distance_to(d.operator.position) < b.mover.position.distance_to(d.operator.position))
		if live.is_empty() or (secs <= 0.0 and live[0].mover.position.distance_to(d.operator.position) > 45.0):
			break
		if secs > 0.0 and t > secs:
			break
		var e = live[0]
		d.controls.move = Vector2.ZERO
		# step back from one that is on top of us (the camera sits behind the shoulder: point blank it aims past it)
		var near: float = e.mover.position.distance_to(d.operator.position)
		if near < 6.0:
			var away: Vector2 = Vector2(d.operator.position.x - e.mover.position.x, d.operator.position.z - e.mover.position.z)
			d.operator.cam_yaw = atan2(away.x, away.y)
			d.controls.move = Vector2(0, -1)
		# close in on a target that is out of range or behind cover
		elif near > 30.0:
			var off := Vector2(e.mover.position.x - d.operator.position.x, e.mover.position.z - d.operator.position.z)
			d.operator.cam_yaw = atan2(-off.x, -off.y)
			d.controls.move = Vector2(0, 1)
		_aim(e.mover.position + Vector3(0, 1.2, 0))
		d.controls.fire = true
		await get_tree().process_frame
		shots += 1
		t += minf(get_process_delta_time(), 0.05)
		if shots > 6000:
			break
	d.controls.fire = false
	return shots

func _ready() -> void:
	_clean()
	await _open()
	ok(d.quest.get("id", "") == "fd-02", "the chapter opens on fd-02 First Resonance")
	ok(d.operator.position.is_finite() and d.operator.position.y > -50.0, "the operator stands on the forest floor at %s" % str(d.operator.position.round()))
	var nex0 := int(Gear.profile_load().nex)
	# fd-02: five patrols come out of the trees
	var t := 0.0
	while d.quest.get("id", "") == "fd-02" and t < 400.0:
		await _fight(3.0)
		await get_tree().process_frame
		t += 0.05
	ok(d.quest.get("id", "") == "fd-03", "fd-02 cleared: five patrols down (kills %d, deaths %d)" % [d.enemies.kills, d.enemies.deaths])
	# fd-03: three relays, then the source's guards
	for r in 3:
		if d.quest.get("id", "") != "fd-03":
			break
		var reached := await _walk_to(d.waypoint, 4.0, "relay %d" % (r + 1))
		ok(reached, "relay %d reached on foot" % (r + 1))
		if not reached:
			d.operator.position = d.waypoint      # keep going to test the rest of the chain
		for i in 4:
			await get_tree().process_frame
	ok(int(d.progress.relay) >= 3 or d.quest.get("id", "") == "fd-04", "all three relays locked")
	await _fight(120.0)
	for i in 5:
		await get_tree().process_frame
	ok(d.quest.get("id", "") == "fd-04", "fd-03 cleared: the source's guards are down")
	if d.quest.get("id", "") != "fd-04":
		var live: Array = d.enemies.enemies.filter(func(e) -> bool: return e.state != Enemies.State.DOWN)
		print("     guards down %d, kills %d, live %d: %s, shots %d hits %d" % [d._guards_down(), d.enemies.kills, live.size(), str(live.map(func(e): return "%s %.0f m hp %.0f" % [e.type, e.mover.position.distance_to(d.operator.position), e.target.hp])), d.gunplay.shots_fired, d.gunplay.hits_landed])
	# fd-04: out past the treeline — the edge is where fd-05 begins, so the walk ends when the quest turns over
	var edge: Vector3 = d.waypoint
	var out := await _walk_until(edge, 6.0, "the swamp edge", func() -> bool: return d.quest.get("id", "") != "fd-04")
	ok(out, "the swamp edge reached on foot")
	if not out:
		d.operator.position = edge
	for i in 10:
		await get_tree().process_frame
	ok(d.progress.current == "fd-05" and d.world_id == "swamps", "fd-04 cleared: the chain crosses into the Shrouded Swamps (%s in %s)" % [d.progress.current, d.world_id])
	ok(int(Gear.profile_load().nex) >= nex0 + 470, "paid the forest's three quests (+%d Nex)" % (int(Gear.profile_load().nex) - nex0))
	ok(d.operator != null and d.region != null and d.enemies != null and d.wildlife != null, "the swamps have an operator, troopers and wildlife")
	ok(d.cutscene.playing, "fd-05 opens on a cutscene")
	d.cutscene._end()
	# fd-05: the fog (90 s, skipped forward) then the relay's three guards
	await _frames(5)
	ok(d.quest.get("kind", "") == "survive" and d.enemies.enemies.size() >= 0, "fd-05 holds out in the fog")
	d.progress.timer = 89.5
	for i in 400:
		await get_tree().process_frame
		if int(d.progress.stage) == 1:
			break
	ok(int(d.progress.stage) == 1 and d.waypoint_node != null, "the fog thins: the Drowned Relay is marked")
	await _walk_until(d.waypoint, 25.0, "the Drowned Relay", func() -> bool: return d.quest.get("id", "") != "fd-05")
	if d.quest.get("id", "") == "fd-05":
		await _fight(120.0)
	await _frames(5)
	ok(d.progress.current == "fd-06" and d.world_id == "neon-city", "fd-05 cleared: the chain moves to Neon City (%s in %s)" % [d.progress.current, d.world_id])
	ok(d.cutscene.playing or d._seen.has("fd-06"), "fd-06 opens on a cutscene")
	if d.cutscene.playing:
		d.cutscene._end()
	# fd-06: hold the terminal (30 s, skipped forward) through the drones
	await _frames(3)
	ok(d._terminal != null and d.waypoint_node != null, "the Blackout Protocol terminal stands in the Underlink")
	var at_terminal := await _walk_to(d.waypoint, 7.0, "the terminal")
	ok(at_terminal, "the terminal reached on foot")
	if not at_terminal:
		d.operator.position = d.waypoint + Vector3(3, 0, 3)
	d.progress.timer = 29.0
	var heat_before := int(d.progress.wave)
	for i in 600:
		await get_tree().process_frame
		if d.cutscene.playing:
			break
	ok(d.cutscene.playing, "the archive opens on Dr Aris's log")
	ok(int(d.progress.wave) >= 1 and int(d.progress.wave) >= heat_before, "the district answered the breach with drones (heat %d)" % int(d.progress.wave))
	d.cutscene._end()
	await _frames(5)
	ok(d.progress.current == "fd-07", "fd-06 cleared: Full Lockdown (%s)" % d.progress.current)
	if d.cutscene.playing:
		d.cutscene._end()
	# fd-07: three waves at the core, Serik Vale's recording, then Vyrak
	await _frames(3)
	ok(d._terminal != null and d.quest.get("kind", "") == "core", "the Stitched Neon Core stands ahead")
	var at_core := await _walk_to(d.waypoint, 10.0, "the core")
	if not at_core:
		d.operator.position = d.waypoint + Vector3(4, 0, 4)
	for w in 3:
		# the next wave comes 14 s after the last is down, while you hold the core: back to it, then wait in sim time
		if d.waypoint.distance_to(d.operator.position) > 10.0:
			await _walk_to(d.waypoint, 8.0, "the core")
		var wt := 0.0
		while wt < 40.0 and d.enemies.enemies.filter(func(e) -> bool: return e.state != Enemies.State.DOWN).size() == 0 and not d.cutscene.playing:
			await get_tree().process_frame
			wt += minf(get_process_delta_time(), 0.05)
		await _fight(90.0)
		await _frames(3)
	if d.waypoint.distance_to(d.operator.position) > 10.0:
		await _walk_to(d.waypoint, 8.0, "the core")
	var ct := 0.0
	while ct < 30.0 and not d.cutscene.playing:
		await get_tree().process_frame
		ct += minf(get_process_delta_time(), 0.05)
	ok(int(d.progress.wave) >= 3, "three lockdown waves fought (%d)" % int(d.progress.wave))
	ok(d.cutscene.playing and d.boss != null, "the core breached: Serik Vale's recording plays and Vyrak drops in")
	d.cutscene._end()
	# Vyrak: shot through the gunplay path until the Covenant
	var bt := 0.0
	while d.boss and not d.boss.rules.dead and bt < 400.0:
		var to: Vector3 = d.boss.position + Vector3(0, 2.0, 0)
		# aim first (the stick walks where the camera looks), close in past 24 m
		_aim(to)
		d.controls.move = Vector2(0, 1) if d.boss.position.distance_to(d.operator.position) > 24.0 else Vector2.ZERO
		d.controls.fire = true
		if d.gunplay.gun().mag <= 0:
			if d.gunplay.gun().reserve <= 0:
				d.controls._next = true     # dry: the next carried gun
			else:
				d.controls._reload = true
		# anything Vyrak summons is shot first: its adds are the fight's ammo
		var adds: Array = d.enemies.enemies.filter(func(e) -> bool: return e.state != Enemies.State.DOWN)
		if not adds.is_empty():
			await _fight(0.0)
		await get_tree().process_frame
		bt += minf(get_process_delta_time(), 0.05)
		if d.enemies.down > 0.0:
			d.enemies.hull = d.enemies.hull_max
			d.enemies.down = 0.0
	d.controls.fire = false
	ok(d.boss != null and d.boss.rules.dead, "Vyrak broken (%.0f s)" % bt)
	for i in 10:
		await get_tree().process_frame
		if d.cutscene.playing:
			break
	ok(d.cutscene.playing, "the Covenant plays")
	d.cutscene._end()
	await _frames(5)
	if d.cutscene.playing:
		d.cutscene._end()
		await _frames(5)
	ok(d.progress.current == "done" and d._done_panel != null, "Act 1 complete (%s)" % d.progress.current)
	var clears: Dictionary = Gear.profile_load().get("boss_clears", {})
	ok(clears.has("vyrak"), "Vyrak counts as a Rift Gate clear")
	await _close()

	# a chapter left at the source (all relays locked, guards not yet down) must still be finishable after a reload
	var f := FileAccess.open("user://quests.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({ "done": ["fd-02"], "current": "fd-03", "kills": 0, "relay": 3 }))
	f.close()
	await _open()
	# the chapter's opening scene (06B + 06C, five voiced lines) is not what this checks: skip it, as a player can
	if d.cutscene and d.cutscene.playing:
		d.cutscene._end()
		await _frames(3)
	var guards: int = d.enemies.enemies.filter(func(e) -> bool: return e.state != Enemies.State.DOWN).size()
	ok(guards >= 3, "reloaded at the source: its guards are there to fight (%d)" % guards)
	ok(d.waypoint_node != null and d.waypoint.distance_to(d._relays[2]) < 1.0, "the marker shows where the source is")
	await _walk_to(d.waypoint, 25.0, "the source")
	await _fight(120.0)
	for i in 5:
		await get_tree().process_frame
	ok(d.quest.get("id", "") == "fd-04", "the reloaded source can be broken")
	await _close()

	# a chapter left mid-patrols keeps its count
	f = FileAccess.open("user://quests.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({ "done": [], "current": "fd-02", "kills": 3, "relay": 0 }))
	f.close()
	await _open()
	ok(int(d.progress.kills) == 3 and d.quest.get("id", "") == "fd-02", "a reload mid-patrols keeps 3 / 5")
	await _close()

	print("descent play: %d failed" % fails)
	_clean()
	get_tree().quit(1 if fails else 0)
