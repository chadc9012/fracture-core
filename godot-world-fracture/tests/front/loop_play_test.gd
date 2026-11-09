extends Node
## The front door and the loop (schedule step 7), played without a window: the title shows CONTINUE once an operator is
## saved, CONTINUE lands on the Nexus street hub, each in-world door opens its system over the street (the street is hidden
## and paused, not torn down), closing it brings the street back exactly where it was, and the Killbox terminal, the
## Skyways shuttle, the crash-site transport, the Rift Gate and Apartment 12-04 all round-trip. The settings screen opens
## from the title and closes back to it.
##   godot --headless --path godot-world-fracture res://tests/front/loop_play.tscn
const Main := preload("res://scripts/main.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
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
	print("front loop play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _run() -> void:
	# an operator exists: the title offers CONTINUE
	CharacterStore.save_look(CharacterStore.default_look())
	m = Main.new()
	add_child(m)
	await _frames(3)
	ok(m.title != null, "title opens at startup")
	var labels: Array[String] = []
	for b in m.title.find_children("*", "Button", true, false):
		labels.append((b as Button).text)
	ok(labels.has("CONTINUE") and labels.has("SETTINGS") and labels.has("NEW OPERATOR"), "title has CONTINUE / SETTINGS / NEW OPERATOR: " + str(labels))
	# settings opens over the title and closes back to it
	m._title_action("settings")
	await _frames(2)
	ok(m.settings_view != null, "settings opens from the title")
	m.settings_view.closed.emit()
	await _frames(2)
	ok(m.settings_view == null and m.title != null, "settings closes back to the title")
	# CONTINUE: the Nexus street hub
	m._title_action("continue")
	await _frames(6)
	ok(m.title == null and m.street != null and m.street.style == "nexus", "CONTINUE lands on the Nexus street hub")
	ok(m.street._door_spots.size() >= 9, "the hub has its doors: %d" % m.street._door_spots.size())
	# every door round-trips: hidden + paused street while the system is open, restored after
	for id in ["modes", "skyways", "descent", "rift", "apartment"]:
		var before: Vector3 = m.street.operator.position
		m.street.door.emit(id)
		await _frames(4)
		var opened := m._from_street != null
		ok(opened, "door %s opens its system" % id)
		ok(opened and not m.street.visible and not m.street.is_processing(), "street hidden and paused behind %s" % id)
		if opened:
			m._from_street.closed.emit()
			await _frames(4)
		ok(m._from_street == null and m.street != null and m.street.visible and m.street.is_processing(), "closing %s brings the street back" % id)
		ok(m.street != null and m.street.operator.position.distance_to(before) < 0.01, "operator kept their spot through %s" % id)
	# a door the street handles itself (overlay) emits nothing to main
	m.street._enter_door("mall")
	await _frames(2)
	ok(m._from_street == null, "the mall is the street's own overlay")
	m.queue_free()
	await _frames(2)
