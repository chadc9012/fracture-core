extends "res://scripts/mission/campaign.gd"
## Chapter 1 — The Aftershock (owner, Nov 22: the Chapter 1 screenplays — No Way Back, The Missing Signal, First Contact,
## The Gathering Storm, The First Siege, Beneath the Ashes — "Separate these missions from the original set but make sure
## they roll into each other"): Missions 2–7 as the chapters of data/dialogue/aftershock.json (tools/campaign/aftershock.py,
## every spoken line the owner's, voiced), on the campaign runner (campaign.gd) with a story line of its own — its own
## progress (user://aftershock.json), its own finished missions (profile `aftershock_done`) and choice (`a05_choice`: fdi /
## free / ascendancy), its own co-op rooms (story:aftershock:<chapter>). One mission rolls into the next; when Beneath the
## Ashes is done the story rolls on (`roll_on`) into the original set — Act 1 (descent.gd), then missions 02–25.
## Mission 1 is Mission 01 (mission_01.gd). The crash-site door opens it (main.gd `_street_door("descent")`).

const AFTERSHOCK_DATA := "res://data/dialogue/aftershock.json"
const AFTERSHOCK_SAVE := "user://aftershock.json"

## the chapter is done and the player rolls on into the original story
signal roll_on

func _story() -> Dictionary:
	return data_of(AFTERSHOCK_DATA)

func _save_path() -> String:
	return AFTERSHOCK_SAVE

func coop_chain() -> String:
	return "aftershock"

func _done_key() -> String:
	return "aftershock_done"

func _choice_key(mission: String) -> String:
	return "a%s_choice" % mission

## Chapter 1 done: Beneath the Ashes rolls on into the original story
func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	_objective.text = "Chapter 1 complete."
	if _done_panel:
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-190, -80)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "CHAPTER 1 — THE AFTERSHOCK\nMissions 2 to 7 complete\nFive coordinates. Five keepers. Find the first."
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "CONTINUE THE STORY"
	b.custom_minimum_size = Vector2(340, 48)
	b.pressed.connect(func(): _save(); roll_on.emit())
	v.add_child(b)
	var g := Button.new()
	g.text = "BACK TO THE CITY"
	g.custom_minimum_size = Vector2(340, 40)
	g.pressed.connect(func(): _save(); closed.emit())
	v.add_child(g)
	add_child(_done_panel)

## has the player finished Chapter 1? (the crash-site door then opens the original story)
static func finished() -> bool:
	var f := FileAccess.open(AFTERSHOCK_SAVE, FileAccess.READ)
	if not f:
		return false
	var d: Variant = JSON.parse_string(f.get_as_text())
	return d is Dictionary and String(d.get("current", "")) == ACT_END

## the next Chapter 1 mission to play ("" when the chapter is done)
static func next_mission() -> String:
	var f := FileAccess.open(AFTERSHOCK_SAVE, FileAccess.READ)
	if not f:
		return "02"
	var d: Variant = JSON.parse_string(f.get_as_text())
	if d is Dictionary:
		var cur := String(d.get("current", ""))
		return "" if cur == ACT_END else cur.substr(1, 2)
	return "02"
