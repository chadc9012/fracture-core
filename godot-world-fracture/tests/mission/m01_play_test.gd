extends Node
## Plays Mission 01 end to end without a window: the morning by its interactions, the alarm, the stairs, Mara, the doors,
## the cinematic, and the Breach (shooting the echoes through the player's own fire path).
const Mission := preload("res://scripts/mission/mission_01.gd")
var m: Control
var fails := 0
func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func use_tag(tag: String) -> void:
	for it: Dictionary in m._interacts:
		if it.tag == tag and it.room == m.room:
			m.player.global_position = it.at + Vector3(0, 0.05, 0)
			await get_tree().process_frame
			await get_tree().physics_frame
			m._find_focus()
			ok(not m._focus.is_empty() and m._focus.tag == tag, "can use '%s' in %s" % [tag, m.room])
			m._use()
			await get_tree().process_frame
			var t := Time.get_ticks_msec()
			while (m._busy or m._fade.color.a > 0.01) and Time.get_ticks_msec() - t < 5000:
				await get_tree().process_frame
			return
	ok(false, "no '%s' in %s" % [tag, m.room])

func _ready() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://mission01.json"))
	m = Mission.new()
	add_child(m)
	await get_tree().process_frame
	await get_tree().process_frame
	ok(m.room == "apt" and m.story.phase == "MORNING", "wakes in 12-04")
	for t: String in ["dress", "breakfast", "phone", "news"]:
		await use_tag(t)
	await use_tag("to_hall")
	ok(m.room == "hall", "out in the corridor")
	await use_tag("elev_down")
	ok(m.room == "lobby", "down to the lobby by elevator")
	await use_tag("front")
	ok(m.story.phase == "MORNING" and m.room == "lobby", "the doors wait for the morning to be done")
	await use_tag("neighbour")
	await use_tag("mail")
	ok(m.story.phase == "ALARM", "the Fracture hits after the mail")
	await use_tag("front")
	ok(m.story.phase == "CINE" or m.room == "street", "...but the doors are open in the alarm")
	# start over at the alarm from the corridor to check the stairs and Mara
	await get_tree().create_timer(1.0).timeout
	m._cine_t = -1.0
	m.player.frozen = false
	m.story.phase = "ALARM"
	m._go_room("hall", m.HALL, 0.0, false)
	await get_tree().process_frame
	await use_tag("elev_down")
	ok(m.room == "hall", "elevators are dead in the alarm")
	await use_tag("stairs")
	ok(m.room == "lounge", "the stairs lead through the Sky Lounge")
	await use_tag("mara")
	ok(m.story.rescued, "Mara freed")
	await use_tag("stairs")
	ok(m.room == "lobby", "on down to the lobby")
	await use_tag("front")
	ok(m.room == "street" and m.story.phase == "CINE", "out of the doors: the cinematic")
	var t0: float = m._now
	while m._cine_t >= 0.0 and m._now - t0 < 30.0:
		await get_tree().process_frame
	ok(m.story.phase == "DAZED" and m._echoes.size() == 1, "dazed, one echo coming")
	# let it reach and strike
	var t1: float = m._now
	while m.story.phase == "DAZED" and m._now - t1 < 30.0:
		await get_tree().process_frame
	ok(m.story.phase == "SURGE" and m.player.powers == 1, "the surge: armed")
	for k in 10:
		await get_tree().process_frame
	ok(m._echoes.size() >= 3, "the wave is on the street")
	# shoot each echo through the player's fire path until the wave is down
	var shots := [0]
	m.player.fired.connect(func(f: Vector3, t: Vector3, h: Object) -> void:
		shots[0] += 1
		if shots[0] < 3:
			print("shot from ", f, " to ", t, " hit ", h, " ", (h as Node).name if h is Node else "", " player ", m.player.global_position, " echo0 ", (m._echoes[0] as Node3D).global_position if m._echoes.size() else Vector3.ZERO))
	var guard := 0
	while m.story.phase in ["SURGE", "ANCHOR"] and guard < 4000:
		guard += 1
		var live: Array = m._echoes.filter(func(e: Node) -> bool: return is_instance_valid(e) and not e.dead)
		if live.is_empty():
			await get_tree().process_frame
			continue
		var e: Node3D = live[0]
		if e._rise < 1.0:
			await get_tree().process_frame
			continue
		var pp: Vector3 = m.player.global_position
		var cam_p: Vector3 = m.player.cam.global_position
		var aim: Vector3 = (e.global_position + Vector3(0, 1.1, 0) - cam_p).normalized()
		m.player.yaw_pivot.rotation.y = atan2(-aim.x, -aim.z)
		m.player.pitch = asin(clampf(aim.y, -1, 1))
		m.player.fire_held = true
		if m.player.powers >= 2 and m.player.blast_cd <= 0.0 and e.global_position.distance_to(pp) < 8.0:
			m.player.blast()
		await get_tree().physics_frame
	m.player.fire_held = false
	ok(m.story.phase == "CLEAR", "the anchor is down (%d frames)" % guard)
	var t2: float = m._now
	while m.story.phase != "DONE" and m._now - t2 < 30.0:
		await get_tree().process_frame
	ok(m.story.phase == "DONE" and m._complete.visible, "mission complete")
	ok(int(m.profile.xp) >= 850, "paid, with the rescue bonus")
	print("mission 01 play: %d failed" % fails)
	# leave no save behind
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://mission01.json"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://profile.json"))
	get_tree().quit(1 if fails else 0)
