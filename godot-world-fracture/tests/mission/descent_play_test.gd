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
	var cam: Camera3D = d.region.camera()
	var want := (p - cam.global_position).normalized()
	var f := -cam.global_basis.z
	d.operator.cam_yaw += wrapf(_yaw_of(want) - _yaw_of(f), -PI, PI)
	d.operator.cam_pitch = clampf(d.operator.cam_pitch + (asin(clampf(want.y, -1, 1)) - asin(clampf(f.y, -1, 1))), -0.9, 0.45)

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
			if stall > 6.0:
				break
		# anything shooting at us is dealt with on the way
		await _fight(0.0)
	d.controls.move = Vector2.ZERO
	d.controls.sprint = false
	print("     stuck walking to %s: %.0f m short at %s" % [label, best, str(d.operator.position.round())])
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
	# fd-04: out past the treeline
	var out := await _walk_to(d.waypoint, 6.0, "the swamp edge")
	ok(out, "the swamp edge reached on foot")
	if not out:
		d.operator.position = d.waypoint
	for i in 10:
		await get_tree().process_frame
	ok(d.progress.current == "done" and d._done_panel != null, "the chapter is complete")
	ok(int(Gear.profile_load().nex) >= nex0 + 470, "paid all three quests (+%d Nex)" % (int(Gear.profile_load().nex) - nex0))
	await _close()

	# a chapter left at the source (all relays locked, guards not yet down) must still be finishable after a reload
	var f := FileAccess.open("user://quests.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({ "done": ["fd-02"], "current": "fd-03", "kills": 0, "relay": 3 }))
	f.close()
	await _open()
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
