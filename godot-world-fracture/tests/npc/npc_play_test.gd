extends Node
## Nexus City's named people played without a window, through main.gd: at 10:00 the day shift is out on the avenue
## (Marcus at the garage, Rosa at the café, Officer Kim on the beat); walking up shows TALK; talking introduces them and
## the tag then shows their name; an errand from one is carried to the other and pays; gunfire scares them and an
## officer comes over and warns you; at 23:00 the night people are out instead. Saves are restored afterwards.
##   godot --headless --path godot-world-fracture res://tests/npc/npc_play.tscn
const Main := preload("res://scripts/main.gd")
const Memory := preload("res://scripts/npc/memory.gd")
const People := preload("res://scripts/npc/people.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
var m: Control
var fails := 0
var _saved := {}

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _keep(path: String) -> void:
	var f := FileAccess.open(path, FileAccess.READ)
	_saved[path] = f.get_as_text() if f else null

func _ready() -> void:
	for p in [Gear.PROFILE, Memory.PATH]:
		_keep(p)
	await _run()
	for p in _saved:
		if _saved[p] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		else:
			var w := FileAccess.open(p, FileAccess.WRITE)
			w.store_string(_saved[p])
	print("npc play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _run() -> void:
	CharacterStore.save_look(CharacterStore.default_look())
	Gear.profile_save({ "xp": 0, "nex": 500, "level": 3 })
	Memory.save_state(Memory.blank())
	m = Main.new()
	add_child(m)
	await _frames(3)
	m._title_action("continue")
	await _frames(6)
	var st: Control = m.street
	ok(st != null and st.npcs != null, "the Nexus street has its named people")
	if st == null or st.npcs == null:
		return
	var n: Node3D = st.npcs
	n.hour_override = 10.0
	for id in n.npcs.keys():
		n.npcs[id].mover.queue_free()
	n.npcs.clear()
	n._schedule()
	await _frames(2)
	ok(n.npcs.has("marcus") and n.npcs.has("rosa") and n.npcs.has("dana"), "10:00 — Marcus, Rosa and Officer Kim are out")
	ok(not n.npcs.has("ravi") and not n.npcs.has("tony"), "…and the night people are home")
	var rosa: Node3D = n.npcs["rosa"].mover
	ok(rosa.rig != null, "Rosa wears a built body")
	# walk up to Rosa
	st.operator.position = rosa.position + Vector3(1.2, 0, 0)
	await _frames(3)
	ok(n.near(st.operator.position) == "rosa", "Rosa is in talking range")
	ok(String(n.npcs["rosa"].tag.text).begins_with("?"), "her tag is a ? before you've met")
	n.talk("rosa")
	await _frames(2)
	ok(n.busy and n._panel != null and String((n._panel.find_child("Say", true, false) as Label).text).contains("Rosa"), "talking opens the conversation; she introduces herself")
	ok(Memory.person(n.state, "rosa").met and Memory.affinity(n.state, "rosa") > 0, "she remembers meeting you")
	var pos0: Vector3 = st.operator.position
	st.controls.move = Vector2(0, 1)
	await _frames(6)
	ok(st.operator.position.distance_to(pos0) < 0.05, "the operator stands still while you talk")
	st.controls.move = Vector2.ZERO
	n._close()
	await _frames(2)
	ok(not n.busy and st.controls.visible, "Bye closes it and gives the controls back")
	ok(String(n.npcs["rosa"].tag.text).begins_with("Rosa Delgado"), "her tag now shows her name")
	ok(FileAccess.file_exists(Memory.PATH) and Memory.person(Memory.load_state(), "rosa").met, "and it's saved")
	# an errand: find a day where Rosa has one
	var present: Array = n.present_ids()
	var offer := {}
	for k in 20:
		offer = Memory.errand_offer(n.state, "rosa", "2026-12-%02d" % (k + 1), present)
		if not offer.is_empty():
			break
	ok(not offer.is_empty(), "Rosa has errands to give")
	Memory.take_errand(n.state, offer)
	var to := String(offer.to)
	n._retag(n.npcs[to])
	ok(String(n.npcs[to].tag.text).contains("✉"), "the recipient's tag shows ✉")
	var nex0 := int(Gear.profile_load().nex)
	n._open(to, "hi", false)
	n._deliver(to)
	await _frames(2)
	ok(int(Gear.profile_load().nex) == nex0 + int(offer.reward) and (n.state.errand as Dictionary).is_empty(), "delivering it pays %d Nex" % int(offer.reward))
	n._close()
	# gunfire and the law
	var marcus: Node3D = n.npcs["marcus"].mover
	st.operator.position = marcus.position + Vector3(-3, 0, 0)
	var before := Memory.affinity(n.state, "marcus")
	for k in 9:
		n._scare_cool = 0.0
		n.gunfire(st.operator.position)
	ok(Memory.affinity(n.state, "marcus") < before and n.npcs["marcus"].scare > 0.0, "gunfire scares Marcus and he likes you less")
	ok(Memory.notoriety(n.state, n.now()) >= Memory.NOTORIETY_COP, "notoriety builds")
	var dana: Node3D = n.npcs["dana"].mover
	dana.position = st.operator.position + Vector3(0, 0, 6)
	for k in 100:   # up to ten seconds of walking
		await get_tree().create_timer(0.1).timeout
		if n.busy:
			break
	ok(n.busy and String((n._panel.find_child("Say", true, false) as Label).text).contains("warning"), "Officer Kim walks over and warns you")
	ok(Memory.notoriety(n.state, n.now()) == 0.0, "and the slate is wiped")
	n._close()
	# night
	n.hour_override = 23.0
	n._schedule()
	await _frames(2)
	ok(n.npcs.has("ravi") and n.npcs.has("tony") and n.npcs.has("luis"), "23:00 — Ghost, Big Tony and Officer Moreno come out")
	ok(n.npcs["rosa"].leaving and n.npcs["dana"].leaving, "…and the day shift heads home")
	n._close()
	# Captain Vale joins the avenue once Mission 05's choice is made
	ok(not n.npcs.has("vale"), "no Captain Vale before the story brings her")
	var prof := Gear.profile_load()
	prof["m05_choice"] = "cooperate"
	Gear.profile_save(prof)
	n.profile = prof
	n.hour_override = 15.0
	n._schedule()
	await _frames(2)
	ok(n.npcs.has("vale"), "after Mission 05, Captain Vale is on the plaza")
	n.talk("vale")
	await _frames(2)
	ok(String((n._panel.find_child("Say", true, false) as Label).text).contains("Captain Vale"), "she introduces herself as Captain Vale")
	n._close()
	n.talk("vale")
	await _frames(1)
	n._close()
	Memory.person(n.state, "vale").talked = ""
	n.talk("vale")
	await _frames(2)
	ok(String((n._panel.find_child("Say", true, false) as Label).text).contains("conscience"), "and remembers you chose to cooperate")
	n._close()
	# Neon City has its own people
	m._close_street()
	m._open_street(true, "neon", true)
	await _frames(8)
	var neon: Node3D = m.street.npcs
	ok(neon != null and neon.city == "neon", "Neon City's street has its people")
	neon.hour_override = 23.0
	for id in neon.npcs.keys():
		neon.npcs[id].mover.queue_free()
	neon.npcs.clear()
	neon._schedule()
	await _frames(2)
	ok(neon.npcs.has("kai") and neon.npcs.has("lin") and neon.npcs.has("sable") and neon.npcs.has("rhea"), "23:00 — Redline, Lin's noodles, Fixer Sable and Officer Banks")
	ok(not neon.npcs.has("rosa"), "…and no Nexus people")
	neon.talk("sable")
	await _frames(2)
	ok(String((neon._panel.find_child("Say", true, false) as Label).text).contains("Fixer Sable"), "Fixer Sable introduces herself")
	neon._close()
	# the regions: the airports' people, and the Verdant Forest's on foot
	m._street_door("airport")
	await _frames(6)
	m._flown("THA", m._from_street)
	await _frames(6)
	var tha: Control = m._from_street
	tha._landing.t = 9.0
	await _frames(3)
	ok(tha.npcs != null and tha.npcs.city == "THA", "Thalassia Coast's terminal has its people")
	tha.npcs.hour_override = 12.0
	tha.npcs._schedule()
	await _frames(2)
	ok(tha.npcs.npcs.has("neri") and tha.npcs.npcs.has("coral") and tha.npcs.npcs.has("mae"), "Pilot Neri, a diver and the ferry agent are there at noon")
	var neri: Node3D = tha.npcs.npcs["neri"].mover
	tha.operator.position = neri.position + Vector3(1.0, 0, 0)
	await _frames(3)
	ok(tha._near == "npc:neri", "walking up to Neri shows TALK")
	tha.npcs.talk("neri")
	await _frames(2)
	ok(String((tha.npcs._panel.find_child("Say", true, false) as Label).text).contains("Pilot Neri"), "Pilot Neri introduces herself")
	tha.npcs._close()
	m._flown("VRD", tha)
	await _frames(10)
	var vrd: Control = m._from_street
	ok(vrd != null and vrd.get("dest") == "VRD" and vrd.npcs != null, "landing in the Verdant Forest on foot")
	if vrd and vrd.npcs:
		ok(vrd.npcs.npcs.has("ilya") and vrd.npcs.npcs.has("mira") or not People.out_at(vrd.npcs.hour(), "VRD").any(func(o): return o.person.id == "mira"), "Warden Ilya and Scout Mira meet you there")
		var ilya: Node3D = vrd.npcs.npcs["ilya"].mover
		ok(ilya.position.distance_to(vrd.operator.position) < 25.0, "close to where you land")
		vrd.closed.emit()
		await _frames(6)
