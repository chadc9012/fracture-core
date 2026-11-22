extends "res://scripts/mission/campaign.gd"
## A side mission (owner, Nov 22: "write the … side missions"): one mission of data/dialogue/side_missions.json —
## a character quest, a faction mission or a world event (tools/campaign/side_missions.py) — played on the campaign
## runner with everything the story has: its sets and cast (stage.gd), its voiced lines, its kinds. Each mission keeps
## its own progress (user://side_<id>.json) and, when done, joins the profile's `side_done`. Opened from the SIDE
## MISSIONS board (side_board.gd); set `SideMission.pending` to the mission's id before `new()`.

const SIDE_DATA := "res://data/dialogue/side_missions.json"
static var pending := ""
var mission_id := ""

func _init() -> void:
	mission_id = pending
	super()

## only this mission's chapters
func _story() -> Dictionary:
	var all: Dictionary = data_of(SIDE_DATA)
	var one := { "bosses": all.get("bosses", {}), "missions": [], "lines": [] }
	for m in all.get("missions", []):
		if String(m.id) == mission_id:
			one.missions = [m]
	return one

func _save_path() -> String:
	return "user://side_%s.json" % mission_id

func coop_chain() -> String:
	return "side"

func _done_key() -> String:
	return "side_done"

func _choice_key(mission: String) -> String:
	return "s%s_choice" % mission

func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	var m: Dictionary = mission_of(mission_id)
	_objective.text = "Side mission complete."
	if _done_panel:
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -60)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "%s\n%s" % [String(m.get("title", "")).to_upper(), "Side mission complete"]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "BACK"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): _save(); closed.emit())
	v.add_child(b)
	add_child(_done_panel)

# --------------------------------------------------------------------------------------------- the board's rules
static func missions() -> Array:
	return data_of(SIDE_DATA).get("missions", [])

static func mission_of(id: String) -> Dictionary:
	for m in missions():
		if String(m.id) == id:
			return m
	return {}

## open when the main story has finished its `after` mission (a faction's own missions open three missions earlier,
## after Mission 5, for whoever stood with it), and not yet past its `until`
static func is_open(m: Dictionary, story_done: Array, choice: String) -> bool:
	var after := String(m.get("after", ""))
	if String(m.get("faction", "")) != "" and String(m.faction) == choice and story_done.has("05"):
		after = "05" if after == "05" or after == "08" else after
	elif String(m.get("faction", "")) != "" and after == "05":
		after = "08"
	if after != "" and not story_done.has(after):
		return false
	var until := String(m.get("until", ""))
	return until == "" or not story_done.has(until)

static func is_done(id: String) -> bool:
	return (_profile().get("side_done", []) as Array).has(id)
