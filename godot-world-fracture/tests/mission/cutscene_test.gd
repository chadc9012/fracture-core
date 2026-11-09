extends SceneTree
## Act 1's cutscene beats (scripts/mission/cutscene.gd) over the voiced campaign lines (scripts/cinema/lines.gd): every
## line id the descent plays exists with a recording, `Cutscene.line` builds the beat from the index, and a written beat
## whose [speaker, text] is in the index picks up its voice.
## Run: godot --headless --path . --script res://tests/mission/cutscene_test.gd

const Cutscene := preload("res://scripts/mission/cutscene.gd")
const Lines := preload("res://scripts/cinema/lines.gd")

func _init() -> void:
	var ok := true
	for id in ["M06_001", "M06_003", "M06_006", "M06_007", "M11_001", "M11_002", "M09_001", "M09_003", "M09_004", "M09_007", "M09_011", "M10_003", "M10_002"]:
		var p := Lines.path(id)
		var here := Lines.has(id) and p != "" and ResourceLoader.exists(p)
		if not here:
			print("missing voiced line ", id, " ", p)
		ok = ok and here
	var b := Cutscene.line("M09_001", Vector3(1, 0, 2), { "look_up": 2.5 })
	ok = ok and String(b.speaker) == "Vyrak" and String(b.text).begins_with("WHO DISTURBS") and String(b.line) == "M09_001" and b.look == Vector3(1, 0, 2) and is_equal_approx(float(b.look_up), 2.5)
	var n := Cutscene.line("M09_004")
	ok = ok and String(n.speaker) == "NOVA"
	# a PLAYER line speaks in the player's voice: the path carries a body suffix
	var pp := Lines.path("M11_002")
	ok = ok and (pp.ends_with("_m.ogg") or pp.ends_with("_f.ogg") or pp.ends_with("_r.ogg"))
	# the written beats still work without a voice
	var w := Cutscene.beat("NOVA", "Hold out until the fog thins.", 4.0, Vector3.ZERO)
	ok = ok and not w.has("line") and float(w.seconds) == 4.0
	print("cutscene test: " + str(ok))
	quit(0 if ok else 1)
