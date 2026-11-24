extends "res://tests/mission/descent_play_test.gd"
## Plays the main story — Chapter 1, The Aftershock, onward (scripts/mission/aftershock.gd, data/dialogue/aftershock.json)
## without a window: every chapter of Missions 2 onward loads on its own story line (not the original campaign's save or profile keys),
## every line of every chapter is voiced, every story person stands where the talk chapters need them and every boss
## has a hull; then the whole chapter is played through in order — each chapter begins on its world with its objective,
## the boss chapters' bosses go down, the talk chapters' people are met, Mission 5's choice lands as `a05_choice`, each
## mission goes to `aftershock_done` — and Beneath the Ashes rolls on into the original story (Act 1).
##   godot --headless --path godot-world-fracture res://tests/mission/aftershock_play.tscn
const Aftershock := preload("res://scripts/mission/aftershock.gd")
const Campaign := preload("res://scripts/mission/campaign.gd")
const Lines := preload("res://scripts/cinema/lines.gd")
const People := preload("res://scripts/npc/people.gd")
const Stage := preload("res://scripts/mission/stage.gd")
const SAVES := ["user://aftershock.json", "user://campaign.json", "user://profile.json", "user://quests.json"]
var _kept := {}
var rolled := false

func _open() -> void:
	d = Aftershock.new()
	d.roll_on.connect(func(): rolled = true)
	add_child(d)
	for i in 5:
		await get_tree().process_frame

func _skip_scene() -> void:
	for k in 4:
		if d.cutscene and d.cutscene.playing:
			d.cutscene._end()
		await _frames(2)

func _ready() -> void:
	for p in SAVES:
		var f := FileAccess.open(p, FileAccess.READ)
		_kept[p] = f.get_as_text() if f else null
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	await _data_checks()
	await _play_through()
	for p in SAVES:
		if _kept[p] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		else:
			var w := FileAccess.open(p, FileAccess.WRITE)
			w.store_string(String(_kept[p]))
	print("aftershock play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _data_checks() -> void:
	var a: Control = Aftershock.new()
	var story: Dictionary = Campaign.data_of(Aftershock.AFTERSHOCK_DATA)
	var want := 0
	for m in story.missions:
		want += (m.chapters as Array).size()
	ok(a.chapters.size() == want and want >= 45, "the main story has its %d chapters: %d" % [want, a.chapters.size()])
	ok(String(a.chapters[0].id) == "A02A" and String(a.chapters[44].id) == "A07G", "Chapter 1 runs from No Way Back to Beneath the Ashes")
	var sets: Array = []
	var st: Node3D = Stage.new()
	for c in a.chapters:
		if c.has("stage") and not st.has_method("_set_" + String(c.stage)):
			sets.append(c.stage)
	st.free()
	ok(sets.is_empty(), "every chapter's set is built by stage.gd" + ("" if sets.is_empty() else ": missing " + str(sets)))
	ok(Campaign.new().chapters.size() == 57, "the original campaign still has its 57 chapters (61 less Vyrak's Missions 09–10, cut Nov 23) (a story line of its own)")
	var lines := 0
	var unvoiced: Array = []
	var people: Array = []
	var bosses: Array = []
	for c in a.chapters:
		var ids: Array = c.get("open", []) + c.get("close", [])
		for branch in (c.get("by_choice", {}) as Dictionary).values():
			ids += branch
		for lid in ids:
			lines += 1
			if not Lines.has(String(lid)):
				unvoiced.append(lid)
		if String(c.kind) == "talk" and not (String(c.who) in Stage.ROSTER or Stage.EXTRAS.has(String(c.who))):
			people.append(c.who)
		if String(c.kind) == "boss" and not Campaign.BOSS_FOR.has(String(c.boss)) and not (story.get("bosses", {}) as Dictionary).has(String(c.boss)):
			bosses.append(c.boss)
	ok(lines == (story.lines as Array).size() and unvoiced.is_empty(), "every one of the %d lines is voiced%s" % [lines, "" if unvoiced.is_empty() else ": not " + str(unvoiced.slice(0, 6))])
	ok(people.is_empty(), "every talk chapter's person has a look (the roster or the story's)" + ("" if people.is_empty() else ": missing " + str(people)))
	ok(bosses.is_empty(), "every boss has a hull" + ("" if bosses.is_empty() else ": missing " + str(bosses)))
	a.free()

## the chapter played through in order: each objective done the way the game would see it done
func _play_through() -> void:
	await _open()
	ok(String(d.quest.id) == "A02A" and d.world_id == "nexus", "a new Chapter 1 opens on No Way Back in Nexus City")
	ok(d.cutscene.playing, "on NOVA's first lines")
	var bad: Array = []
	var seen := 0
	var guard := 0
	while String(d.progress.current) != d.ACT_END and guard < 400:
		guard += 1
		await _skip_scene()
		if d._card:
			# a new chapter's title card: go on with the story
			for b in d._card.find_children("*", "Button", true, false):
				if (b as Button).text == "CONTINUE THE STORY":
					(b as Button).pressed.emit()
					break
			await _skip_scene()
		if String(d.progress.current) == d.ACT_END:
			break
		var c: Dictionary = d.quest
		var kind := String(c.get("kind_real", c.kind))
		var good: bool = d.region != null and d.world_id == String(c.world)
		match kind:
			"talk":
				good = good and d._talker != null and d.waypoint != Vector3.ZERO
			"boss":
				good = good and d.boss != null
				if d.boss:
					ok(String(d.boss.rules.def.name) == String(c.get("boss_name", "")), "%s: %s stands" % [c.id, c.get("boss_name", "")])
			"reach", "trace", "hack":
				good = good and d.waypoint != Vector3.ZERO
		if not good:
			bad.append(String(c.id))
		seen += 1
		var id0 := String(c.id)
		# done as the game would see it done
		match kind:
			"choice":
				d.choice_view.chosen.emit("free")
			"boss":
				if d.boss:
					d.boss.rules.hit(1e9)
			"cutscene":
				pass
			_:
				d._complete()
		var t := 0
		while String(d.progress.current) == id0 and t < 200:
			if d.cutscene.playing:
				d.cutscene._end()
			await get_tree().process_frame
			t += 1
	ok(bad.is_empty(), "every chapter began on its world with its objective (%d played)%s" % [seen, "" if bad.is_empty() else ": bad " + str(bad)])
	ok(String(d.progress.current) == d.ACT_END and (d.progress.done as Array).size() == d.chapters.size(), "the whole story played through, every chapter done in order: %d" % (d.progress.done as Array).size())
	var order: Array = d.chapters.map(func(c): return String(c.id))
	ok(d.progress.done == order, "in the script's order")
	var p := Campaign._profile()
	ok(String(p.get("a05_choice", "")) == "free" and String(p.get("m05_choice", "")) == "", "Mission 5's choice lands as a05_choice (the original's m05_choice untouched)")
	var story: Dictionary = Campaign.data_of(Aftershock.AFTERSHOCK_DATA)
	var mids: Array = story.missions.map(func(m): return String(m.id))
	ok((p.get("aftershock_done", []) as Array) == mids, "every mission in aftershock_done: %s" % str(p.get("aftershock_done", [])))
	ok(not p.has("campaign_done") or not (p.campaign_done as Array).has("02"), "the original campaign's record untouched")
	ok(Aftershock.finished(), "the main story is finished")
	await _frames(3)
	ok(d._done_panel != null, "the chapter's end card is up")
	var labels: Array = d._done_panel.find_children("*", "Button", true, false).map(func(b): return (b as Button).text)
	ok(labels == ["BACK TO THE CITY"], "and it ends there: back to the city, no rolling back into the original set (%s)" % str(labels))
	await _close()
