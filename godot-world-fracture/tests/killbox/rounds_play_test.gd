extends Node
## Valorant's round banners in a real round-based match (scripts/killbox/round_banner.gd over arena_view._new_round):
## the round you win says ROUND WON with the score and the accolade you earned; a lost one says ROUND LOST; none shows
## once the match is decided.
##   godot --headless --path godot-world-fracture res://tests/killbox/rounds_play.tscn
const ArenaView := preload("res://scripts/killbox/arena_view.gd")
const RoundBanner := preload("res://scripts/killbox/round_banner.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _said(c: Control) -> Array:
	return c.find_children("*", "Label", true, false).map(func(l): return (l as Label).text) if c else []

func _ready() -> void:
	ok(RoundBanner.accolade(true, 5, 5, 2, false) == "ACE", "taking all of theirs is an ACE")
	ok(RoundBanner.accolade(true, 1, 5, 3, true) == "CLUTCH", "winning as the last of yours is a CLUTCH")
	ok(RoundBanner.accolade(true, 1, 5, 0, false) == "FLAWLESS", "winning without losing anyone is FLAWLESS")
	ok(RoundBanner.accolade(false, 5, 5, 0, true) == "", "a lost round has none")
	var v := ArenaView.new()
	v.arena_id = "killbox-prime"
	v.mode_id = "lockdown"
	v.hero = "goliath"
	add_child(v)
	await _frames(4)
	ok(v.match_state.is_rounds(), "Lockdown plays in rounds")
	# you take every one of theirs, then the round goes to us
	var theirs: Array = v.enemies.enemies.filter(func(o): return o.team == 0)
	for o in theirs:
		v._on_bot_down(o, 1, true)
	v.match_state._end_round(true, "Team wiped")
	v._new_round()   # what the arena does on the frame the match tick reports the round over
	await _frames(1)
	var said := _said(v.round_banner)
	ok(said.has("ROUND WON") and said.has("ROUND 1"), "ROUND WON, round 1 (%s)" % ", ".join(PackedStringArray(said)))
	ok(said.has("1") and said.has("0") and said.has("TEAM WIPED"), "with the score and why")
	ok(said.has("ACE"), "and the ACE you earned")
	ok(v._round_kills == 0 and not v._round_clutch, "the next round's count starts over")
	v.match_state._end_round(false, "Objective lost")
	v._new_round()
	await _frames(1)
	said = _said(v.round_banner)
	ok(said.has("ROUND LOST") and not said.has("ACE"), "a lost round says ROUND LOST, no accolade")
	var last = v.round_banner
	for i in v.match_state.target():
		v.match_state._end_round(true, "Team wiped")
	v._new_round()
	ok(v.match_state.over, "the match is decided")
	ok(v.round_banner == last, "no round banner once it's over (the match summary has it)")
	print("rounds play test: %d failed" % fails)
	get_tree().quit(1 if fails else 0)
