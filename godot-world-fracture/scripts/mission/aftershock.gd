extends "res://scripts/mission/campaign.gd"
## The main story, from Chapter 1 — The Aftershock (owner, Nov 22: the Chapter 1 screenplays — No Way Back, The Missing Signal, First Contact,
## The Gathering Storm, The First Siege, Beneath the Ashes — "Separate these missions from the original set but make sure
## they roll into each other"): Missions 2–7 as the chapters of data/dialogue/aftershock.json (tools/campaign/aftershock.py,
## every spoken line the owner's, voiced), on the campaign runner (campaign.gd) with a story line of its own — its own
## progress (user://aftershock.json), its own finished missions (profile `aftershock_done`) and choice (`a05_choice`: fdi /
## free / ascendancy), its own co-op rooms (story:aftershock:<chapter>). One mission rolls into the next; when Beneath the
## Ashes is done it goes on through Chapter 9 to Mission 70, and ends there (owner, Nov 24: "we shouldn't be moving
## backwards, no duplicate missions" — it no longer rolls on into the original set, which restarts at Mission 02).
## Mission 1 is Mission 01 (mission_01.gd). The crash-site door opens it (main.gd `_street_door("descent")`).

const AFTERSHOCK_DATA := "res://data/dialogue/aftershock.json"
const AFTERSHOCK_SAVE := "user://aftershock.json"

## (roll_on — declared in descent.gd — hands the story on to the next view: the Fracture Descent after Chapter 1)

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

## the chapters of the main story (Nov 22: the owner's Chapter 1, then Chapters 2 onward from tools/campaign/story/):
## when a mission of a new chapter begins, its title card comes up over the world with the chapter just finished — go on,
## or back to the city
var _card: PanelContainer
var _card_for := ""

func _begin(id: String) -> void:
	var def := _quest_def(id)
	var done: Array = progress.done
	if not def.is_empty() and not done.is_empty() and _card_for != id:
		var prev := _quest_def(String(done.back()))
		var was: Array = _chapter_of(prev)
		var now: Array = _chapter_of(def)
		if not prev.is_empty() and int(was[0]) != int(now[0]):
			_card_for = id
			if int(was[0]) == 1 and not DescentRun.chapter_cleared():
				_descent_card(was)   # Chapter 1 ends on the road out of Nexus: the Fracture Descent, then Eldergrove
			else:
				_chapter_card(was, now, id)
			return
	super(id)

const DescentRun := preload("res://scripts/mission/descent.gd")

## after Mission 10 the story leaves Nexus through the fractured forest (the Fracture Descent, fd-02 to fd-07) before
## Chapter 2 opens in Eldergrove — the card hands over to it
func _descent_card(was: Array) -> void:
	if _card:
		_card.queue_free()
	_card = PanelContainer.new()
	_card.set_anchors_preset(Control.PRESET_CENTER)
	_card.position = Vector2(-200, -110)
	var v := VBoxContainer.new()
	_card.add_child(v)
	var t := Label.new()
	t.text = "CHAPTER %d COMPLETE — %s\n\nNEXT\nTHE FRACTURE DESCENT\nthe road out of Nexus" % [int(was[0]), String(was[1]).to_upper()]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "CONTINUE THE STORY"
	b.custom_minimum_size = Vector2(360, 48)
	b.pressed.connect(func(): _save(); roll_on.emit())
	v.add_child(b)
	var g := Button.new()
	g.text = "BACK TO THE CITY"
	g.custom_minimum_size = Vector2(360, 40)
	g.pressed.connect(func(): _save(); closed.emit())
	v.add_child(g)
	add_child(_card)

func _card_up() -> bool:
	return _card != null

func _chapter_of(def: Dictionary) -> Array:
	for m in _story().get("missions", []):
		if String(m.id) == String(def.get("mission", "")):
			return m.get("chapter", [1, "The Aftershock"])
	return [1, "The Aftershock"]

func _chapter_card(was: Array, now: Array, next_id: String) -> void:
	if _card:
		_card.queue_free()
	_card = PanelContainer.new()
	_card.set_anchors_preset(Control.PRESET_CENTER)
	_card.position = Vector2(-200, -110)
	var v := VBoxContainer.new()
	_card.add_child(v)
	var t := Label.new()
	t.text = "CHAPTER %d COMPLETE — %s\n\nCHAPTER %d\n%s" % [int(was[0]), String(was[1]).to_upper(), int(now[0]), String(now[1]).to_upper()]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "CONTINUE THE STORY"
	b.custom_minimum_size = Vector2(360, 48)
	b.pressed.connect(func():
		_card.queue_free()
		_card = null
		_begin(next_id))
	v.add_child(b)
	var g := Button.new()
	g.text = "BACK TO THE CITY"
	g.custom_minimum_size = Vector2(360, 40)
	g.pressed.connect(func(): _save(); closed.emit())
	v.add_child(g)
	add_child(_card)

## the whole main story done: the last card (the story ends here — no rolling back into the original set, owner Nov 24)
func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	_objective.text = "The main story is complete."
	if _done_panel:
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-190, -80)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var last: Array = _chapter_of(_quest_def(String(chapters[-1].id))) if not chapters.is_empty() else [1, "The Aftershock"]
	var t := Label.new()
	t.text = "CHAPTER %d — %s\nThe main story is complete.\nThe world is still unwritten." % [int(last[0]), String(last[1]).to_upper()]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var g := Button.new()
	g.text = "BACK TO THE CITY"
	g.custom_minimum_size = Vector2(340, 40)
	g.pressed.connect(func(): _save(); closed.emit())
	v.add_child(g)
	add_child(_done_panel)

## has the player finished the main story? (the crash-site door then opens the original story)
static func finished() -> bool:
	var f := FileAccess.open(AFTERSHOCK_SAVE, FileAccess.READ)
	if not f:
		return false
	var d: Variant = JSON.parse_string(f.get_as_text())
	return d is Dictionary and String(d.get("current", "")) == ACT_END

## the next main-story mission to play ("" when the story is done)
static func next_mission() -> String:
	var f := FileAccess.open(AFTERSHOCK_SAVE, FileAccess.READ)
	if not f:
		return "02"
	var d: Variant = JSON.parse_string(f.get_as_text())
	if d is Dictionary:
		var cur := String(d.get("current", ""))
		return "" if cur == ACT_END else cur.substr(1, 2)
	return "02"
