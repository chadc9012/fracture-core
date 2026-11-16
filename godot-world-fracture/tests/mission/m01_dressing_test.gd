extends SceneTree
## Mission 01's dressing after the owner's playthrough video (Nov 16): the morning street has no evacuation (barricades,
## cruisers, burnt wrecks) until the Fracture; the windows look onto the Meshy towers; the armchairs and the lounge's
## seats are the Poly Haven chair; the plants are the Meshy fan palm; the apartment has its radio on in the morning and
## the rooms their city hum, and the radio cuts when a cinematic starts.
##   godot --headless --path . --script res://tests/mission/m01_dressing_test.gd

var fails := 0

func check(ok: bool, what: String) -> void:
	if not ok:
		fails += 1
	print(("ok   " if ok else "FAIL ") + what)

func _initialize() -> void:
	_run.call_deferred()

func _count_file(root_node: Node, file: String) -> int:
	var n := 0
	for c in root_node.find_children("*", "Node3D", true, false):
		if String(c.get_meta("file", "")) == file:
			n += 1
	return n

func _run() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://mission01.json"))
	var M = load("res://scripts/mission/mission_01.gd")
	M.skip_cinema = true
	var m: Control = M.new()
	root.add_child(m)
	for i in 5:
		await process_frame
	# the evacuation waits for the Fracture
	check(not m._evac_nodes.is_empty(), "street: the evacuation dressing is tracked (%d nodes)" % m._evac_nodes.size())
	check(m._evac_nodes.all(func(n: Node) -> bool: return not (n as Node3D).visible), "street: no barricades, cruisers or wrecks on the morning street")
	var wrecks: Array = m._evac_nodes.filter(func(n: Node) -> bool: return String(n.get_meta("file", "")) == "wreck.glb")
	check(wrecks.size() == 3, "street: the three wrecks are part of it (%d)" % wrecks.size())
	m._set_fracture(true)
	check(m._evac_nodes.all(func(n: Node) -> bool: return (n as Node3D).visible), "street: the evacuation shows after the Fracture")
	# the city through the glass, the chairs, the plants
	var towers := 0
	for f: String in m.SKYLINE:
		towers += _count_file(m.int_root, f)
	check(towers >= 12, "windows: the skyline is the Meshy towers (%d)" % towers)
	check(_count_file(m.int_root, "../props-ph/armchair.glb") >= 13, "rooms: the armchairs and the lounge's ten seats are the Poly Haven chair (%d)" % _count_file(m.int_root, "../props-ph/armchair.glb"))
	check(_count_file(m.int_root, "../foliage/palm-b.glb") >= 6, "rooms: the plants are the Meshy fan palm (%d)" % _count_file(m.int_root, "../foliage/palm-b.glb"))
	# the people: built, in their own clothes (woman.glb was torn, man.glb untextured)
	for id: String in ["mara", "res1", "res2"]:
		var n: Node = m._npcs.get(id)
		check(n != null and n.get("look") != null and bool(n.look.get("civ", false)), "people: %s is a built person in their own clothes" % id)
	# sound between the cinematics
	m.room = "apt"
	m.story.phase = "MORNING"
	m._room_audio()
	check(m._radio_on, "audio: the radio is on in 12-04 in the morning")
	M.skip_cinema = false
	m._play_cine([{ "dur": 0.1, "pos": [Vector3(0, 2, 5), Vector3(0, 2, 5)], "look": Vector3.ZERO }])
	check(not m._radio_on, "audio: a cinematic cuts the radio")
	m.room = "lobby"
	m._room_audio()
	check(not m._radio_on, "audio: no radio outside the apartment")
	print("\n%s" % ("PASS" if fails == 0 else "%d FAILED" % fails))
	quit(0 if fails == 0 else 1)
