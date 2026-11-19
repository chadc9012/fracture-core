extends Node
## The Killbox end screen in a real match view (scripts/killbox/match_summary.gd): bots fall and the operator falls, the
## tally keeps who downed whom, and when the match is decided the summary shows the scoreboard, the MVP and LEAVE.
##   godot --headless --path godot-world-fracture res://tests/killbox/summary_play.tscn
const ArenaView := preload("res://scripts/killbox/arena_view.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _ready() -> void:
	var v := ArenaView.new()
	v.arena_id = "killbox-prime"
	v.mode_id = "clash"
	add_child(v)
	await _frames(4)
	var rival: RefCounted = null
	for e in v.enemies.enemies:
		if e.team == 0:
			rival = e
			break
	v._on_bot_down(rival, 1, true)
	v._on_bot_down(rival, 1, true)
	v._on_operator_down()
	ok(int(v._tally.player.k) == 2 and int(v._tally.player.d) == 1, "the tally keeps your kills and deaths (%d / %d)" % [int(v._tally.player.k), int(v._tally.player.d)])
	ok(int(v._tally[String(v._bot_ids[rival])].d) == 2, "and the bot's deaths")
	ok(v.controls._feed != null and v.controls._feed.get_child_count() >= 3, "each kill goes up on the kill feed")
	v.match_state.over = true
	v.match_state.winner = "us"
	v._finish()
	await _frames(3)
	var s: Control = v._done_panel
	ok(s != null and s.get_script() == load("res://scripts/killbox/match_summary.gd"), "the match ends on the summary")
	var texts: Array = s.find_children("*", "Label", true, false).map(func(l): return (l as Label).text)
	ok("VICTORY" in texts, "it says VICTORY")
	ok("MATCH MVP" in texts, "it names an MVP")
	ok("YOUR SQUAD" in texts and "RIVALS" in texts, "both sides' scoreboards")
	var leave: Button = s.find_children("*", "Button", true, false)[0]
	var left := [false]
	v.closed.connect(func(): left[0] = true)
	leave.pressed.emit()
	ok(left[0], "LEAVE closes the match")
	print("summary play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)
