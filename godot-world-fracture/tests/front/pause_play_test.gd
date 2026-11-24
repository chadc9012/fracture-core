extends Node
## The pause menu (scripts/front/pause_menu.gd) over a story run: Esc pauses the game and opens it, Esc resumes, the
## panels it opens come back to it, and QUIT (asked twice) saves and leaves the story for the globe.
##   godot --headless --path godot-world-fracture res://tests/front/pause_play.tscn
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

func _esc() -> void:
	var e := InputEventKey.new()
	e.keycode = KEY_ESCAPE
	e.pressed = true
	Input.parse_input_event(e)
	var up := e.duplicate()
	up.pressed = false
	Input.parse_input_event(up)
	await _frames(2)

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	await _run()
	get_tree().paused = false
	print("pause play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _run() -> void:
	CharacterStore.save_look(CharacterStore.default_look())
	m = Main.new()
	add_child(m)
	await _frames(3)
	await _esc()
	ok(m.pause_menu == null and not get_tree().paused, "Esc on the title doesn't pause")
	m._close_title()
	m._open_descent()
	await _frames(6)
	await _esc()
	ok(m.pause_menu != null and get_tree().paused, "Esc in the story pauses and opens the menu")
	var said: Array = m.pause_menu.find_children("*", "Label", true, false).map(func(l): return (l as Label).text)
	ok(said.any(func(t): return String(t).begins_with("STORY")) and said.has("PAUSED"), "it says what you're in (%s)" % str(said.slice(0, 3)))
	await _esc()
	ok(m.pause_menu == null and not get_tree().paused, "Esc again resumes")
	await _esc()
	m.pause_menu._do(1)   # JOURNAL
	await _frames(2)
	ok(m.journal_view != null and not m.pause_menu.visible and get_tree().paused, "a panel opens over it, still paused")
	m.journal_view.closed.emit()
	await _frames(3)
	ok(m.pause_menu != null and m.pause_menu.visible, "closing the panel brings the menu back")
	m.pause_menu._do(5)
	ok(m.descent != null and m.pause_menu != null, "QUIT asks first")
	m.pause_menu._do(5)
	await _frames(3)
	ok(m.descent == null and m.pause_menu == null and not get_tree().paused, "then leaves the story, unpaused")
