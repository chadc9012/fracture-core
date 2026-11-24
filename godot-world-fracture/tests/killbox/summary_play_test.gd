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
	# the frame locked in on the hero select (scripts/killbox/hero_select.gd) is the one the operator fights in
	var saved := String(load("res://scripts/character/character_store.gd").load_look().get("frame", "goliath"))
	v.hero = "cipher" if saved != "cipher" else "nyx"
	add_child(v)
	await _frames(4)
	ok(String(v.operator.rig.look.frame) == v.hero, "the operator wears the locked-in frame (%s)" % v.hero)
	ok(v.gunplay.grenades.frame == v.hero and v.gunplay.super_ability.frame == v.hero, "and carries its grenades and super")
	ok(String(load("res://scripts/character/character_store.gd").load_look().get("frame", "goliath")) == saved, "the saved character keeps its frame")
	var hs = load("res://scripts/killbox/hero_select.gd").new()
	add_child(hs)
	var got := [""]
	hs.locked.connect(func(f): got[0] = f)
	hs._pick("nyx")
	hs._lock()
	ok(got[0] == "nyx", "the hero select locks in the picked frame")
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
	# Titanfall's "You died" / The Finals' death camera: the bot that drops you is named on the card, the view turns to it
	var en = v.enemies
	en.down = 0.0
	en.hull = en.hull_max
	en.shield = 0.0
	if rival.has_meta("foe"):
		rival.remove_meta("foe")
	en._damage_foe(rival, 99999.0)
	ok(en.killer == rival, "the roster knows who put you down")
	var card: Control = v.controls._death
	var said: Array = card.find_children("*", "Label", true, false).map(func(l): return (l as Label).text) if card else []
	ok(card != null and said.has(String(rival.get_meta("callsign")).to_upper()), "the death card names them by callsign (%s)" % [", ".join(PackedStringArray(said))])
	var yaw0: float = v.operator.cam_yaw
	en.step(0.5)
	ok(absf(angle_difference(yaw0, v.operator.cam_yaw)) > 0.0001 or absf(angle_difference(v.operator.cam_yaw, atan2(-(rival.mover.position - v.operator.position).x, -(rival.mover.position - v.operator.position).z))) < 0.05, "the camera turns to them")
	en.step(en.down + 0.1)
	v.controls.show_hull(1.0, 0.0, en.down)
	ok(v.controls._death == null, "the card clears when you stand")
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
