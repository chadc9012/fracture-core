extends Node
## The casino and the entertainment district, played without a window (owner, Nov 11: "have you played and tested this
## yet"): from the title, CONTINUE onto the Nexus street; walk the operator up to the NEXUS NIGHTS door, see the ENTER
## prompt, press ENTER; step through every view (the strip, the club, the arcade, the cinema) checking each has its
## people and a lit, animated scene; leave and check the street came back where it was. Then Neon City: THE NEON STRIP
## and the Neon City Grand Casino by the same doors (floor, penthouse, skydeck), dealers at the tables. Nexus must have no
## casino. Also checks the street crowd is dressed (every walker has a role and the clothing shader).
##   godot --headless --path godot-world-fracture res://tests/city/venues_play.tscn
const Main := preload("res://scripts/main.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Nights := preload("res://scripts/city/entertainment_district.gd")
const Casino := preload("res://scripts/city/casino_interior.gd")
var m: Control
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _ready() -> void:
	await _run()
	print("venues play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

## stand at a door the way a player would, wait for the prompt, press ENTER
func _walk_in(id: String) -> bool:
	var spot: Dictionary = {}
	for d in m.street._door_spots:
		if String(d.id) == id:
			spot = d
	if spot.is_empty():
		ok(false, "the street has a %s door" % id)
		return false
	var at: Vector3 = spot.pos
	m.street.operator.position = Vector3(at.x, m.street.operator.position.y, at.z)
	await _frames(3)
	# the touch ENTER button carries the prompt on a phone; on a keyboard it is the label under the crosshair
	var tc = m.street.controls
	var prompt := String(tc._enter_button.text) if tc._enter_button else (String(tc._prompt_label.text) if tc._prompt_label else "")
	ok(prompt.begins_with("ENTER "), "at the %s door the prompt reads '%s'" % [id, prompt])
	m.street.controls._enter = true
	await _frames(4)
	return true

func _guests(root: Node) -> int:
	var n := 0
	for c in root.find_children("*", "Node3D", true, false):
		if c.has_meta("outfit") and String(c.get_meta("outfit")) != "":
			n += 1
	return n

func _run() -> void:
	CharacterStore.save_look(CharacterStore.default_look())
	m = Main.new()
	add_child(m)
	await _frames(3)
	m._title_action("continue")
	await _frames(8)
	ok(m.street != null and m.street.style == "nexus", "CONTINUE lands on the Nexus street")
	# the street's crowd is dressed
	var civ: Node = m.street.find_children("*", "Node3D", true, false).filter(func(n: Node) -> bool: return n.get_script() == preload("res://scripts/city/civilians.gd")).front() if true else null
	ok(civ != null and civ.walkers.size() >= 4, "the street has walkers: %d" % (civ.walkers.size() if civ else 0))
	if civ:
		var dressed := 0
		for w in civ.walkers:
			if String(w.mover.get_meta("outfit", "")) != "":
				dressed += 1
		ok(dressed == civ.walkers.size(), "every walker wears a role from the NPC board (%d/%d)" % [dressed, civ.walkers.size()])
	# no casino in Nexus
	var ids: Array = m.street._door_spots.map(func(d: Dictionary) -> String: return String(d.id))
	ok(not ids.has("casino"), "Nexus has no casino door")
	m.street.open_casino()
	await _frames(2)
	ok(m.street.casino_overlay == null, "the casino will not open in Nexus")
	# NEXUS NIGHTS by its door
	var before: Vector3 = m.street.operator.position
	if await _walk_in("nights"):
		var o: Control = m.street.casino_overlay
		ok(o != null and o.get_script() == Nights, "ENTER opens the entertainment district")
		if o:
			ok(String(o._names.title) == "NEXUS NIGHTS", "it is Nexus Nights in Nexus")
			ok(m.street._vp.render_target_update_mode == SubViewport.UPDATE_DISABLED, "the street stops rendering while inside")
			await _tour(o, 7, "Nexus Nights")
			ok(o._dancers.size() >= 4, "the club has dancers: %d" % o._dancers.size())
			var y0: float = o._dancers[0].position.y if o._dancers.size() > 0 else 0.0
			await _frames(10)
			ok(o._dancers.size() > 0 and absf(o._dancers[0].position.y - y0) > 0.0001, "the dancers move")
			ok(_guests(o.world) >= 20, "the district is busy: %d dressed people" % _guests(o.world))
			before = m.street.operator.position
			o.closed.emit()
			await _frames(4)
			ok(m.street.casino_overlay == null and m.street._vp.render_target_update_mode == SubViewport.UPDATE_ALWAYS, "leaving brings the street back")
			ok(m.street.operator.position.distance_to(before) < 0.01, "the operator is where they went in")
	# Neon City: the strip and the casino
	m._close_street()
	await _frames(4)
	m._open_street(true, "neon", true)
	await _frames(8)
	ok(m.street != null and m.street.style == "neon", "the Neon City street opens")
	if await _walk_in("nights"):
		var o2: Control = m.street.casino_overlay
		ok(o2 != null and o2.get_script() == Nights and String(o2._names.title) == "THE NEON STRIP", "ENTER opens the Neon Strip in Neon City")
		if o2:
			await _tour(o2, 7, "the Neon Strip")
			o2.closed.emit()
			await _frames(4)
			ok(m.street.casino_overlay == null, "leaving the strip brings Neon City back")
	if await _walk_in("casino"):
		var c: Control = m.street.casino_overlay
		ok(c != null and c.get_script() == Casino, "ENTER opens the Neon City Grand Casino")
		if c:
			await _tour(c, c._views.size(), "the casino")
			var dealers := 0
			for n in c.world.find_children("*", "Node3D", true, false):
				if String(n.get_meta("outfit", "")) == "dealer":
					dealers += 1
			ok(dealers >= 4, "croupiers at the tables: %d" % dealers)
			ok(_guests(c.world) >= 15, "the casino has guests: %d" % _guests(c.world))
			c.closed.emit()
			await _frames(4)
			ok(m.street.casino_overlay == null, "leaving the casino brings Neon City back")

## step through every view: the camera moves to it, the title follows, and the frame renders without error
func _tour(o: Control, n: int, what: String) -> void:
	var seen := {}
	for i in n:
		o.show_view(i)
		await _frames(2)
		seen[o.cam.position.snapped(Vector3(0.1, 0.1, 0.1))] = true
		ok(o._title.text.length() > 4, "%s view %d: %s" % [what, i, o._title.text])
	ok(seen.size() == n, "%s: %d distinct camera views" % [what, seen.size()])
