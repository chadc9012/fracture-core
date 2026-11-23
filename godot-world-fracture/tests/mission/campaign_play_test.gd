extends "res://tests/mission/descent_play_test.gd"
## Plays the campaign runner (scripts/mission/campaign.gd) without a window: Mission 02 end to end (the opening lines
## as a voiced cutscene, the walk to the stairwell, the twenty-second hold, the walk to the street, the mission going
## to the profile), Mission 05's choice (the choice view, the chosen branch's lines, the next mission's world), and
## every one of the 57 chapters beginning on its world with its objective — so no chapter can be reached and not play.
##   godot --headless --path godot-world-fracture res://tests/mission/campaign_play.tscn
const Campaign := preload("res://scripts/mission/campaign.gd")
const Lines := preload("res://scripts/cinema/lines.gd")

func _clean() -> void:
	for f in ["user://campaign.json", "user://profile.json", "user://quests.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(f))

func _open() -> void:
	d = Campaign.new()
	add_child(d)
	for i in 5:
		await get_tree().process_frame

func _set_current(cid: String) -> void:
	var f := FileAccess.open("user://campaign.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({ "done": [], "current": cid, "kills": 0, "relay": 0, "timer": 0.0, "wave": 0, "stage": 0 }))
	f.close()

## ends the scene that is playing, and the ones its end starts (a chapter's close, the next one's opening)
func _skip_scene() -> void:
	for k in 4:
		if d.cutscene and d.cutscene.playing:
			d.cutscene._end()
		await _frames(2)

func _ready() -> void:
	_clean()
	await _mission_02()
	await _mission_05_choice()
	await _every_chapter()
	print("campaign play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _mission_02() -> void:
	await _open()
	ok(d.chapters.size() == 57, "57 chapters loaded: %d" % d.chapters.size())
	ok(String(d.quest.id) == "02A" and d.world_id == "nexus", "a new campaign opens on 02A in Nexus City")
	ok(d.cutscene.playing and d.cutscene._beats.size() >= 3, "02A opens on its lines as a cutscene: %d beats" % d.cutscene._beats.size())
	var voiced := 0
	for b in d.cutscene._beats:
		if b.has("line") and Lines.has(String(b.line)):
			voiced += 1
	ok(voiced == d.cutscene._beats.size(), "every opening beat is a voiced line: %d" % voiced)
	await _skip_scene()
	ok(d.waypoint != Vector3.ZERO and d.waypoint.distance_to(d.operator.position) < 200.0, "the stairwell waypoint is near: %.0f m" % d.waypoint.distance_to(d.operator.position))
	var walked := await _walk_until(d.waypoint, 7.0, "the stairwell", func() -> bool: return String(d.quest.id) != "02A" or d.cutscene.playing)
	ok(walked, "walked to the stairwell")
	await _skip_scene()
	ok(String(d.quest.id) == "02B", "02B begins (the hold): " + String(d.quest.id))
	await _skip_scene()
	var t := 0.0
	while String(d.quest.id) == "02B" and t < 90.0:
		await _fight(0.0)
		await get_tree().process_frame
		t += minf(get_process_delta_time(), 0.05)
		if d.cutscene.playing:
			await _skip_scene()
	ok(String(d.quest.id) == "02C", "the hold ends after its twenty seconds; 02C begins: " + String(d.quest.id))
	await _skip_scene()
	walked = await _walk_until(d.waypoint, 7.0, "the street", func() -> bool: return String(d.quest.id) != "02C" or d.cutscene.playing)
	ok(walked, "walked the family to the street")
	await _skip_scene()
	await _frames(3)
	ok(String(d.quest.id) == "03A" and d.progress.done.has("02C"), "Mission 02 complete, 03A begins: " + String(d.quest.id))
	var p := Campaign._profile()
	ok((p.get("campaign_done", []) as Array).has("02"), "the profile remembers Mission 02")
	await _close()

func _mission_05_choice() -> void:
	_set_current("05C")
	await _open()
	ok(String(d.quest.id) == "05C", "opens on 05C, the choice")
	await _skip_scene()
	await _frames(2)
	ok(d.choice_view != null and d.choice_view.visible, "the choice view is up")
	d.choice_view.chosen.emit("cooperate")
	await _frames(2)
	ok(d.cutscene.playing and d.cutscene._beats.size() == 2, "the chosen branch's two lines play")
	await _skip_scene()
	await _frames(3)
	ok(String(Campaign._profile().get("m05_choice", "")) == "cooperate", "the choice is in the profile")
	ok(String(d.quest.id) == "06A" and d.world_id == "veridan", "Mission 06 begins in the Verdant Forest: %s %s" % [String(d.quest.id), d.world_id])
	await _close()

func _every_chapter() -> void:
	var bad: Array[String] = []
	for c in Campaign.new().chapters:
		_set_current(String(c.id))
		await _open()
		var good: bool = String(d.quest.id) == String(c.id) and d.world_id == String(c.world) and d.region != null and d.operator != null
		var kind := String(c.kind)
		if kind in ["reach", "talk", "race", "drive", "trace", "hack", "core"]:
			good = good and d.waypoint != Vector3.ZERO
		if kind == "boss":
			good = good and d.boss != null
		if kind == "talk":
			good = good and d._talker != null
		if not good:
			bad.append(String(c.id))
		await _skip_scene()
		await _close()
	ok(bad.is_empty(), "every chapter begins on its world with its objective" + ("" if bad.is_empty() else ": bad " + str(bad)))
