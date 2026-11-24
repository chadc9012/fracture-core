extends SceneTree
## Look-dev for the match end screen (scripts/killbox/match_summary.gd): a Clash win, a Clash loss or a Royale elimination.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/summary_shot.gd -- out.png [win|loss|royale]
const Summary := preload("res://scripts/killbox/match_summary.gd")
var frames := 0
var out := "user://summary.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var which: String = args[1] if args.size() > 1 else "win"
	var bg := ColorRect.new()
	bg.color = Color(0.12, 0.1, 0.2)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_root().add_child(bg)
	var s := Summary.new()
	if which == "royale":
		s.data = { "result": "ELIMINATED", "won": false, "score": "#7 of 20", "sub": "Fracture Royale · the Verdant Forest", "teams": [],
			"stats": [["PLACED", "#7"], ["ELIMINATIONS", "4"], ["PHASE", "3"], ["SURVIVED", "6:42"]], "nex": 160, "xp": 120, "loot": "", "leave_text": "LEAVE" }
	else:
		var won := which == "win"
		var us := [{ "name": "You", "k": 14, "d": 6, "you": true }, { "name": "Vance", "k": 9, "d": 8 }, { "name": "Iko", "k": 7, "d": 9 }, { "name": "Sable", "k": 5, "d": 10 }, { "name": "Ren", "k": 4, "d": 7 }, { "name": "Tamsin", "k": 3, "d": 9 }]
		var them := [{ "name": "Kilo", "k": 11, "d": 9 }, { "name": "Vex", "k": 10, "d": 8 }, { "name": "Juno", "k": 8, "d": 7 }, { "name": "Rook", "k": 6, "d": 9 }, { "name": "Hex", "k": 4, "d": 8 }, { "name": "Nova", "k": 3, "d": 8 }]
		s.data = { "result": "VICTORY" if won else "DEFEAT", "won": won, "score": "50  –  42" if won else "38  –  50", "sub": "Clash · Kaiju Complex",
			"teams": [{ "name": "Your squad", "rows": us }, { "name": "Rivals", "rows": them }],
			"stats": [["KILLS", "14"], ["DEATHS", "6"], ["K/D", "2.3"], ["SCORE", "1400"]], "nex": 600, "xp": 450, "loot": "Void Sceptre (183 power)" if won else "", "leave_text": "LEAVE THE KILLBOX" }
	get_root().add_child(s)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 60:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
