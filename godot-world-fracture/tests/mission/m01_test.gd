extends SceneTree
const Story := preload("res://scripts/mission/m01_story.gd")
var fails := 0
func ok(c: bool, w: String) -> void:
	if not c:
		fails += 1
		print("FAIL: ", w)
func _init() -> void:
	var s := Story.new()
	ok(s.phase == "MORNING" and s.tracker().size() == 6, "starts on the six-step morning")
	ok(s.powers() == 0, "a civilian")
	for st: String in ["dress", "breakfast", "phone", "news", "neighbour"]:
		s.mark(st, 1.0)
	ok(s.phase == "MORNING", "five steps is not the morning")
	ok(s.mark("dress", 1.0).is_empty(), "a step counts once")
	var l := s.mark("mail", 2.0)
	ok(s.phase == "ALARM" and l.size() >= 4, "the sixth step brings the alarm")
	ok(not s.exit_building(3.0) or s.phase == "CINE", "out of the doors starts the cinematic")
	var s2 := Story.new()
	for st: String in ["dress", "breakfast", "phone", "news", "neighbour", "mail"]:
		s2.mark(st, 0.0)
	ok(s2.rescue().size() == 1 and s2.rescued, "Mara can be freed during the alarm")
	ok(s2.rescue().is_empty(), "only once")
	s2.exit_building(5.0)
	s2.event("cine_done", 6.0)
	ok(s2.phase == "DAZED" and s2.wave() == [1, 0] and s2.powers() == 0, "dazed and unarmed against one echo")
	s2.event("tick", 6.0 + Story.DAZED_S)
	ok(s2.phase == "SURGE" and s2.powers() == 1, "the echo's strike lands anyway: the surge")
	var n := s2.event("tick", s2.since + Story.NUDGE_S)
	ok(n.size() == 1 and s2.nudged, "one nudge when stalled")
	ok(s2.event("tick", s2.since + Story.NUDGE_S * 3).is_empty(), "only one nudge")
	s2.event("wave_clear", 40.0)
	ok(s2.phase == "ANCHOR" and s2.wave() == [2, 1] and s2.powers() == 2, "the anchor and its echoes")
	s2.event("anchor_down", 50.0)
	ok(s2.phase == "CLEAR" and s2.powers() == 3, "clear: every power awake")
	s2.event("tick", 50.0 + Story.CLEAR_S)
	ok(s2.phase == "DONE", "done")
	ok(s2.reward().xp == 850, "the rescue pays extra")
	var s3 := Story.new()
	s3.restore({ "phase": "SURGE", "done": ["dress", "breakfast", "phone", "news", "neighbour", "mail"], "rescued": false })
	ok(s3.phase == "ALARM", "a reload mid-fight restarts the escape")
	print("mission 01: %d failed" % fails)
	quit(1 if fails else 0)
