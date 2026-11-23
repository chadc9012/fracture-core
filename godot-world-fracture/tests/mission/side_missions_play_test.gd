extends "res://tests/mission/descent_play_test.gd"
## Plays every side mission (scripts/mission/side_mission.gd, data/dialogue/side_missions.json) without a window: the
## board opens them by the main story's progress (side_mission.gd `is_open`); each mission loads only its own chapters
## on its own save, every line is voiced, every talk person has a look, every boss a hull, every set is built; then each
## mission is played through in order and lands in the profile's `side_done`.
##   godot --headless --path godot-world-fracture res://tests/mission/side_missions_play.tscn
const SideMission := preload("res://scripts/mission/side_mission.gd")
const Campaign := preload("res://scripts/mission/campaign.gd")
const Lines := preload("res://scripts/cinema/lines.gd")
const Stage := preload("res://scripts/mission/stage.gd")
var _kept := {}

func _ready() -> void:
	var saves := ["user://profile.json"]
	for m in SideMission.missions():
		saves.append("user://side_%s.json" % String(m.id))
	for p in saves:
		var f := FileAccess.open(p, FileAccess.READ)
		_kept[p] = f.get_as_text() if f else null
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	_rules()
	_data_checks()
	for m in SideMission.missions():
		await _play(String(m.id))
	var done: Array = Campaign._profile().get("side_done", [])
	ok(done.size() == SideMission.missions().size(), "every side mission played through: %d of %d" % [done.size(), SideMission.missions().size()])
	for p in saves:
		if _kept[p] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		else:
			var w := FileAccess.open(p, FileAccess.WRITE)
			w.store_string(String(_kept[p]))
	print("side missions play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _rules() -> void:
	var c01 := SideMission.mission_of("C01")
	ok(not SideMission.is_open(c01, ["02", "03"], ""), "Daniel's quest is shut before Mission 6")
	ok(SideMission.is_open(c01, ["02", "03", "04", "05", "06"], ""), "and open after it")
	var c11 := SideMission.mission_of("C11")
	var to43: Array = []
	for i in range(2, 44):
		to43.append("%02d" % i)
	ok(not SideMission.is_open(c11, to43, ""), "Ward's quest closes once Haven falls (Mission 43)")
	var f01 := SideMission.mission_of("F01")
	ok(SideMission.is_open(f01, ["02", "03", "04", "05"], "fdi"), "a faction's own missions open after Mission 5 for its side")
	ok(not SideMission.is_open(f01, ["02", "03", "04", "05"], "free"), "and after Mission 8 for everyone else")
	ok(SideMission.is_open(f01, ["02", "03", "04", "05", "06", "07", "08"], "free"), "(after Mission 8)")

func _data_checks() -> void:
	var data: Dictionary = Campaign.data_of(SideMission.SIDE_DATA)
	var unvoiced: Array = []
	var people: Array = []
	var bosses: Array = []
	var sets: Array = []
	var st: Node3D = Stage.new()
	for m in data.missions:
		for c in m.chapters:
			for lid in c.get("open", []) + c.get("close", []):
				if not Lines.has(String(lid)):
					unvoiced.append(lid)
			if String(c.kind) == "talk" and not (String(c.who) in Stage.ROSTER or Stage.EXTRAS.has(String(c.who))):
				people.append(c.who)
			if String(c.kind) == "boss" and not (data.bosses as Dictionary).has(String(c.boss)):
				bosses.append(c.boss)
			if c.has("stage") and not st.has_method("_set_" + String(c.stage)):
				sets.append(c.stage)
	st.free()
	ok(unvoiced.is_empty(), "every side-mission line is voiced" + ("" if unvoiced.is_empty() else ": not " + str(unvoiced.slice(0, 6))))
	ok(people.is_empty(), "every talk chapter's person has a look" + ("" if people.is_empty() else ": missing " + str(people)))
	ok(bosses.is_empty(), "every boss has a hull" + ("" if bosses.is_empty() else ": missing " + str(bosses)))
	ok(sets.is_empty(), "every set is built" + ("" if sets.is_empty() else ": missing " + str(sets)))

func _play(id: String) -> void:
	SideMission.pending = id
	d = SideMission.new()
	add_child(d)
	await _frames(5)
	var m := SideMission.mission_of(id)
	ok(d.chapters.size() == (m.chapters as Array).size() and String(d.quest.get("id", "")) == "S" + String(m.chapters[0].id).trim_prefix("S"),
		"%s %s: only its own %d chapters, from the first" % [id, m.title, (m.chapters as Array).size()])
	var guard := 0
	while String(d.progress.current) != d.ACT_END and guard < 30:
		guard += 1
		for k in 4:
			if d.cutscene and d.cutscene.playing:
				d.cutscene._end()
			await _frames(2)
		if String(d.progress.current) == d.ACT_END:
			break
		var c: Dictionary = d.quest
		var kind := String(c.get("kind_real", c.kind))
		var id0 := String(c.id)
		match kind:
			"choice":
				d.choice_view.chosen.emit(String(c.options[0][0]))
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
	ok(String(d.progress.current) == d.ACT_END and SideMission.is_done(id), "%s played through and marked done" % id)
	d.queue_free()
	d = null
	await _frames(3)
