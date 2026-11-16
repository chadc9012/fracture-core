extends SceneTree
## Plays the game from the beginning for a screen recording, the way a player would: the title screen, NEW GAME, the
## operator creator, Mission 01 (the opening cinematic, the morning in Apartment 12-04, the news, the Fracture, the
## stairwell, Mara, the lobby, the street, the Breach fight) and out into Nexus City on foot and in a car.
##
## The operator walks to each thing (camera turned toward it, W held) instead of being placed there, and the lines,
## cinematics and voices play at their own pace. Run under Godot's movie maker:
##   godot --path . --write-movie out.avi --fixed-fps 24 --script res://tests/tools/record_play.gd [-- --from N --to M --ckpt DIR]
## (fixed fps: game time is the video's time, however slowly the frames render)

var main: Node
var m: Control      # Mission 01
var log_t := 0.0

## In parts (the sandbox recycles about hourly, and a full run renders for ~4 h): `-- --from N --to M --ckpt DIR`
## plays steps N..M of STEPS and quits. After each step a checkpoint (DIR/<next>.json: the story, the room, where the
## operator stands and faces) is written; a part that starts past 0 puts the game back there first, prints
## "SEG_START frame=<n>" when its own footage starts (the frames before it are trimmed) and "SEG_END" when done.
const STEPS := ["intro", "dress", "breakfast", "phone", "mail", "news", "to_hall", "stairs", "mara", "stairs_back", "front_fight", "city"]
var from_i := 0
var to_i := STEPS.size() - 1
var ckpt := ""

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	for k in args.size() - 1:
		match args[k]:
			"--from": from_i = int(args[k + 1])
			"--to": to_i = int(args[k + 1])
			"--ckpt": ckpt = args[k + 1]
	if from_i == 0:
		# a fresh start: no saved mission, character or profile
		for f in ["user://mission01.json", "user://character.json", "user://profile.json"]:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(f))
	_run.call_deferred()

func say(t: String) -> void:
	print("REC %.1f s  %s" % [Time.get_ticks_msec() / 1000.0, t])

func frames(n: int) -> void:
	for i in n:
		await process_frame

func wait(s: float) -> void:
	await create_timer(s).timeout

func _run() -> void:
	if from_i > 0 and not await _resume():
		say("resume failed")
		quit(1)
		return
	for i in range(from_i, to_i + 1):
		await call("_step_" + STEPS[i])
		if ckpt != "" and i < STEPS.size() - 1 and STEPS[i + 1] != "city":
			_checkpoint(i + 1)
	say("SEG_END")
	await wait(0.5)
	quit(0)

func _checkpoint(next: int) -> void:
	DirAccess.make_dir_recursive_absolute(ckpt)
	var d := { "story": m.story.save(), "phase": m.story.phase, "room": m.room,
		"pos": [m.op.global_position.x, m.op.global_position.y, m.op.global_position.z], "yaw": m.op.yaw_pivot.rotation.y }
	var f := FileAccess.open("%s/%d.json" % [ckpt, next], FileAccess.WRITE)
	f.store_string(JSON.stringify(d))
	for u in ["character.json", "profile.json"]:
		DirAccess.copy_absolute(ProjectSettings.globalize_path("user://" + u), "%s/%s" % [ckpt, u])
	say("checkpoint %d" % next)

## back to where checkpoint `from_i` left off
func _resume() -> bool:
	for u in ["character.json", "profile.json"]:
		if FileAccess.file_exists("%s/%s" % [ckpt, u]):
			DirAccess.copy_absolute("%s/%s" % [ckpt, u], ProjectSettings.globalize_path("user://" + u))
	var scene: PackedScene = load("res://scenes/main.tscn")
	main = scene.instantiate()
	root.add_child(main)
	await wait(1.0)
	main._close_title()
	if main.creator:
		main._close_creator()
	if STEPS[from_i] == "city":
		var mf := FileAccess.open("user://mission01.json", FileAccess.WRITE)
		mf.store_string(JSON.stringify({ "phase": "DONE", "done": [], "rescued": true }))
		mf = null
		main._open_street(true, "nexus", true)
		await wait(2.0)
		say("SEG_START frame=%d" % Engine.get_frames_drawn())
		return true
	var f := FileAccess.open("%s/%d.json" % [ckpt, from_i], FileAccess.READ)
	if f == null:
		return false
	var d: Dictionary = JSON.parse_string(f.get_as_text())
	var sf := FileAccess.open("user://mission01.json", FileAccess.WRITE)
	sf.store_string(JSON.stringify(d.story))
	sf = null
	var M = load("res://scripts/mission/mission_01.gd")
	M.skip_cinema = true             # no opening again
	main._open_mission()
	await frames(8)
	M.skip_cinema = false
	m = main.mission
	if m == null:
		return false
	m.story.phase = String(d.phase)
	var p: Array = d.pos
	await m._go_room(String(d.room), Vector3(p[0], p[1], p[2]), float(d.yaw), false)
	m.op.set_powers(m.story.powers())
	m._update_hud()
	m._lines.clear()
	m._line_t = 0.0
	await wait(1.0)
	say("SEG_START frame=%d" % Engine.get_frames_drawn())
	return true

# --------------------------------------------------------------------------------------------- the steps
func _step_intro() -> void:
	var scene: PackedScene = load("res://scenes/main.tscn")
	main = scene.instantiate()
	root.add_child(main)
	await wait(1.0)
	# the title screen
	say("title")
	if main.creator:
		main._close_creator()
	await wait(4.0)
	main._title_action("new")
	await wait(1.0)
	# the operator creator: a look round the bodies, then confirm
	say("creator")
	var c = main.creator
	if c:
		var CS = load("res://scripts/character/character_store.gd")
		for body in ["male", "female", "robot", "male"]:
			c.look = CS.clean({"frame": "goliath" if body != "female" else "nyx", "body": body}, true)
			if c.has_method("_rebuild"):
				c._rebuild()
			await wait(2.2)
		c.confirmed.emit(c.look)
	await wait(1.0)
	m = main.mission
	say("mission 01: the opening")
	# the opening cinematic plays by itself
	await _settle(0.5, 120.0)
	await _lines_out()

func _morning(t: String) -> void:
	await walk_use(t)
	await _lines_out(12.0)

func _step_dress() -> void: await _morning("dress")
func _step_breakfast() -> void: await _morning("breakfast")
func _step_phone() -> void: await _morning("phone")
func _step_mail() -> void: await _morning("mail")

func _step_news() -> void:
	await walk_use("news")
	say("the Fracture")
	await _settle(0.5, 150.0)      # the Fracture cinematic
	await _lines_out()

func _step_to_hall() -> void:
	await walk_use("to_hall", true)

func _step_stairs() -> void:
	await walk_use("stairs", true)
	await _settle(0.5, 120.0)
	await _lines_out(12.0)

func _step_mara() -> void:
	await walk_use("mara", true)
	await _lines_out(15.0)

func _step_stairs_back() -> void:
	await walk_use("stairs", true)

func _step_front_fight() -> void:
	await _play_front_fight()

func _step_city() -> void:
	say("the city")
	if m != null and is_instance_valid(m):
		m.closed.emit()
		await wait(2.0)
	await _play_street()

# --------------------------------------------------------------------------------------------- Mission 01
## wait until no cinematic, line or fade is holding the player
func _settle(extra := 0.4, limit := 60.0) -> void:
	var t := 0.0
	while t < limit and (m._busy or m._cine_t >= 0.0 or m.op.frozen or m._fade.color.a > 0.02 or (m._cs != null and m._cs.playing)):
		await process_frame
		t += root.get_process_delta_time()
	await wait(extra)

## let the subtitles on screen finish (the story's lines are part of the show)
func _lines_out(limit := 25.0) -> void:
	var t := 0.0
	while t < limit and (m._line_t > 0.0 or not m._lines.is_empty()):
		await process_frame
		t += root.get_process_delta_time()

func _find(tag: String) -> Dictionary:
	for it: Dictionary in m._interacts:
		if it.tag == tag and it.room == m.room:
			return it
	return {}

## walk to an interaction and use it
func walk_use(tag: String, run := false) -> void:
	await _settle()
	var it := _find(tag)
	if it.is_empty():
		say("no '%s' in %s" % [tag, m.room])
		return
	say("walk to %s in %s" % [tag, m.room])
	var at: Vector3 = it.at
	var r: float = float(it.r) * 0.6
	var t := 0.0
	var stuck := 0.0
	var tries := 0
	var last: Vector3 = m.op.global_position
	while t < 14.0:
		var p: Vector3 = m.op.global_position
		var to := Vector3(at.x - p.x, 0, at.z - p.z)
		if to.length() < r:
			break
		# face the thing and walk (the camera turns smoothly, as a thumb on the look stick would)
		var want := atan2(-to.x, -to.z)
		m.op.yaw_pivot.rotation.y = lerp_angle(m.op.yaw_pivot.rotation.y, want, 0.18)
		m._keys[KEY_W] = absf(wrapf(want - m.op.yaw_pivot.rotation.y, -PI, PI)) < 0.9
		m._keys[KEY_SHIFT] = run
		await process_frame
		var dt: float = root.get_process_delta_time()
		t += dt
		if m.op.global_position.distance_to(last) < 0.02:
			stuck += dt
		else:
			stuck = 0.0
		last = m.op.global_position
		if stuck > 0.8:
			# round the furniture: back off a step, then sidestep (alternating sides), then on
			tries += 1
			var side := KEY_D if tries % 2 == 1 else KEY_A
			m._keys[KEY_W] = false
			m._keys[KEY_S] = true
			await wait(0.3)
			m._keys[KEY_S] = false
			m._keys[side] = true
			await wait(0.35 + 0.15 * tries)
			m._keys[side] = false
			stuck = 0.0
	m._keys[KEY_W] = false
	m._keys[KEY_SHIFT] = false
	if Vector2(m.op.global_position.x - at.x, m.op.global_position.z - at.z).length() > float(it.r):
		m.op.global_position = at + Vector3(0, 0.05, 0)      # (the furniture won: the last step by hand)
	await frames(3)
	m._find_focus()
	await wait(0.35)
	m._use()
	await frames(2)
	await _settle(0.6)

func _play_front_fight() -> void:
	await walk_use("front", true)
	say("the street: the cinematic")
	var t0: float = m._now
	while m._cine_t >= 0.0 and m._now - t0 < 40.0:
		await process_frame
	await _lines_out(10.0)
	# dazed: the first echo comes; its strike is the surge
	var t1: float = m._now
	while m.story.phase == "DAZED" and m._now - t1 < 40.0:
		await process_frame
	await _settle(0.5, 60.0)
	say("the Breach fight")
	# the fight: turn on each echo and fire (the blast when one closes in)
	var guard := 0.0
	while m.story.phase in ["SURGE", "ANCHOR"] and guard < 150.0:
		var live: Array = m._echoes.filter(func(e: Node) -> bool: return is_instance_valid(e) and not e.dead)
		if live.is_empty() or m.op.frozen:
			m.op.fire_held = false
			await process_frame
			guard += root.get_process_delta_time()
			continue
		live.sort_custom(func(a: Node3D, b: Node3D) -> bool: return a.global_position.distance_to(m.op.global_position) < b.global_position.distance_to(m.op.global_position))
		var e: Node3D = live[0]
		if e._rise < 1.0:
			await process_frame
			guard += root.get_process_delta_time()
			continue
		var cam_p: Vector3 = m.op.cam.global_position
		var aim: Vector3 = (e.global_position + Vector3(0, 1.1, 0) - cam_p).normalized()
		m.op.yaw_pivot.rotation.y = lerp_angle(m.op.yaw_pivot.rotation.y, atan2(-aim.x, -aim.z), 0.35)
		m.op.pitch = lerpf(m.op.pitch, asin(clampf(aim.y, -1, 1)), 0.35)
		m.op.fire_held = absf(wrapf(atan2(-aim.x, -aim.z) - m.op.yaw_pivot.rotation.y, -PI, PI)) < 0.15
		if m.op.powers >= 2 and m.op.blast_cd <= 0.0 and e.global_position.distance_to(m.op.global_position) < 8.0:
			m.op.blast()
		await physics_frame
		guard += root.get_physics_process_delta_time()
	m.op.fire_held = false
	say("cleared: %s" % m.story.phase)
	var t2: float = m._now
	while m.story.phase != "DONE" and m._now - t2 < 40.0:
		await process_frame
	await _lines_out(10.0)
	await wait(4.0)        # the mission complete card

# --------------------------------------------------------------------------------------------- Nexus City
func _play_street() -> void:
	var st = main.street
	if st == null:
		main._open_street(true, "nexus", true)
		await wait(1.5)
		st = main.street
	if st == null:
		say("no street")
		return
	st.controls.scripted = true
	# a walk up the avenue, looking round
	say("walk the avenue")
	for k in 3:
		st.controls.move = Vector2(0, 1)
		await wait(3.0)
		st.controls.move = Vector2(0.4, 0.9)
		await wait(1.2)
	st.controls.move = Vector2.ZERO
	await wait(1.0)
	# into the nearest parked road car (not the tank or the hover-car) and away
	var best: Node3D = null
	var bd := 1e9
	for c in st.parked:
		if c is Node3D and is_instance_valid(c) and not String(c.get_meta("vehicle", "")) in ["goliath-tank", "hover-car"]:
			var d: float = (c as Node3D).global_position.distance_to(st.operator.global_position)
			if d < bd:
				bd = d
				best = c
	if best:
		say("into a car")
		st.enter_car(best)
		await wait(1.0)
		# drive up the avenue; a car that stops moving (traffic, a kerb) backs off and steers round
		var t := 0.0
		var last: Vector3 = best.global_position
		var still := 0.0
		var steer := 0.0
		while t < 22.0:
			st.controls.move = Vector2(steer, 1.0)
			await wait(0.25)
			t += 0.25
			var p: Vector3 = best.global_position
			still = still + 0.25 if p.distance_to(last) < 0.4 else 0.0
			last = p
			steer = move_toward(steer, 0.0, 0.1)
			if still > 1.0:
				st.controls.move = Vector2(0.9, -1.0)
				await wait(1.4)
				steer = -0.45
				still = 0.0
		st.controls.move = Vector2.ZERO
		await wait(2.0)
