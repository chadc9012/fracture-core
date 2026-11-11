extends SceneTree
## The owner's directed scenes (Phase 2 + 3, Nov 11): every scene's lines are voiced and verbatim, chains skip the branch
## not taken, and the shot / beat builders cover every line.

const Scenes := preload("res://scripts/cinema/scenes.gd")
const Lines := preload("res://scripts/cinema/lines.gd")

var checks := 0
var failed := 0
func ok(c: bool, what: String) -> void:
	checks += 1
	if not c:
		failed += 1
		print("FAIL: ", what)

func _init() -> void:
	var d := Scenes.data()
	ok(d.get("scenes", []).size() == 22, "22 scenes, Missions 01–06")
	ok(d.get("cues", []).size() == 63, "63 cues")
	for c: Dictionary in d.get("cues", []):
		ok(Lines.has(String(c.id)), "%s is voiced" % c.id)
		ok(Lines.text(String(c.id)).strip_edges() == String(c.text).strip_edges(), "%s is the draft's line, verbatim" % c.id)
	for s: Dictionary in d.get("scenes", []):
		for lid in s.line_ids:
			ok(Lines.has(String(lid)), "%s line %s is voiced" % [s.id, lid])
	# Mission 05: the branches are alternatives
	ok(Scenes.choices("05") == ["cooperate", "independent"], "Mission 05 offers cooperate / independent")
	ok(Scenes.chain("04") == ["04A", "04B", "04C"], "Mission 04 in order")
	ok(Scenes.chain("05") == ["05A", "05B"], "with no choice the chain stops before the branches")
	ok(Scenes.chain("05", "cooperate", true) == ["05C_COOPERATE"], "cooperate plays only its branch")
	ok(Scenes.chain("05", "independent", true) == ["05C_INDEPENDENT"], "independent plays only its branch")
	ok(Scenes.chain("05", "independent") == ["05A", "05B", "05C_INDEPENDENT"], "the whole chain carries one branch")
	ok(Scenes.chain("06") == ["06A", "06B", "06C"], "Mission 06 in order")
	# framing from the camera notes
	ok(Scenes.framing("Tight over-shoulder to player") == "ots", "over-shoulder")
	ok(Scenes.framing("Wide shot through gate") == "wide", "wide")
	ok(Scenes.handheld("Handheld street-level track"), "handheld")
	# builders
	var shots := Scenes.cinema_shots(Scenes.chain("04"), Vector3.ZERO, Vector3(0, 0, -3), "MISSION 04")
	ok(shots.size() == 3, "one shot per scene")
	var spoken: Array = []
	for sh: Dictionary in shots:
		spoken.append_array(sh.lines)
		ok(float(sh.dur) >= Scenes.voiced_seconds(sh.lines), "a shot lasts as long as its lines")
	ok(spoken == ["M04_001", "M04_002", "M04_003", "M04_004", "M04_005", "M04_006", "M04_007", "M04_008", "M04_009"], "every Mission 04 line, in order")
	ok(shots[0].has("title") and shots[0].has("fade_in") and shots[2].has("fade_out"), "title card and fades")
	ok(shots[0].has("shake"), "the handheld checkpoint shot shakes")
	var beats := Scenes.descent_beats(["06B", "06C"], Vector3.ZERO)
	ok(beats.size() == 5 and String(beats[0].line) == "M06_004" and String(beats[4].line) == "M06_008", "06B + 06C beats")
	print("Scenes: %d checks, %d failed" % [checks, failed])
	quit(1 if failed else 0)
