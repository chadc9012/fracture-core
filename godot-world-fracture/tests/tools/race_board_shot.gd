extends SceneTree
## Look-dev for the race leaderboard (scripts/ui/race_board.gd).
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/race_board_shot.gd -- out.png [drift]
const RaceBoard := preload("res://scripts/ui/race_board.gd")
const Career := preload("res://scripts/racing/street_career.gd")
var frames := 0
var out := "user://race_board.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var drift := args.size() > 1 and args[1] == "drift"
	var id := "neon-drift" if drift else "neon-ring"
	var ev: Dictionary = Career.EVENTS[id]
	var mine := 7420.0 if drift else 124.318
	var bg := ColorRect.new()
	bg.color = Color(0.12, 0.08, 0.16)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_root().add_child(bg)
	var b := RaceBoard.new()
	b.data = { "event": ev.name, "kind": ev.kind, "place": 2, "rows": RaceBoard.rows(id, ev, mine, 120.0), "value": mine,
		"pb": true, "prev": 6900.0 if drift else 126.902, "nex": 2500, "rep": 380, "xp": 120 }
	get_root().add_child(b)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 30:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
