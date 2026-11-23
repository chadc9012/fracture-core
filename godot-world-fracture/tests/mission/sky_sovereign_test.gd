extends "res://tests/mission/descent_play_test.gd"
## Vyrak as a Unique (sky_sovereign.gd; owner, Nov 23: "Think Shanghai-la frontier"): the secret conditions and the watch,
## the Ashen Mark on a loss (he leaves, the encounter closes, the mark rides the left shoulder), the once-only kill with its
## stamp and title, the world-first banner and announcement, and the journal never naming him before he is met.
##   godot --headless --path godot-world-fracture res://tests/mission/sky_sovereign_test.tscn
const Sovereign := preload("res://scripts/mission/sky_sovereign.gd")
const Encounters := preload("res://scripts/mission/encounters.gd")
const Unique := preload("res://scripts/mission/unique_encounter.gd")
const Journal := preload("res://scripts/mission/encounter_journal.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const ArrivalView := preload("res://scripts/airport/arrival_view.gd")

func _ready() -> void:
	var kept := {}
	for path in ["user://profile.json", "user://unique_U09.json"]:
		var f := FileAccess.open(path, FileAccess.READ)
		kept[path] = f.get_as_text() if f else null
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	_rules()
	await _journal_hidden()
	await _loss()
	await _mark_on_body()
	await _kill()
	await _free_roam()
	for path in kept:
		if kept[path] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
		else:
			var w := FileAccess.open(path, FileAccess.WRITE)
			w.store_string(String(kept[path]))
	print("sky sovereign: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)

func _rules() -> void:
	var c := { "dist": 10.0, "night": true, "level": 20, "on_foot": true, "alone": true }
	ok(Sovereign.conditions_met(c), "all five hold: in the crater, night, level 12+, on foot, alone")
	for k in [["dist", Sovereign.RADIUS + 1.0], ["night", false], ["level", Sovereign.MIN_LEVEL - 1], ["on_foot", false], ["alone", false]]:
		var c2 := c.duplicate()
		c2[k[0]] = k[1]
		ok(not Sovereign.conditions_met(c2), "without %s he stays away" % k[0])
	ok(Sovereign.is_night(22) and Sovereign.is_night(3) and not Sovereign.is_night(12) and not Sovereign.is_night(19), "night is 20:00–05:00 on the device's clock")
	var w := Sovereign.new_watch()
	var fired := 0
	var t := 0.0
	while t < Sovereign.DWELL - 1.0:
		fired += int(Sovereign.step(w, c, 0.5, false))
		t += 0.5
	var broken := c.duplicate()
	broken.night = false
	Sovereign.step(w, broken, 0.5, false)
	ok(fired == 0 and float(w.held) == 0.0, "a break before the dwell starts the count over")
	t = 0.0
	while t < Sovereign.DWELL * 3.0:
		fired += int(Sovereign.step(w, c, 0.5, false))
		t += 0.5
	ok(fired == 1, "he comes down once after the dwell, and not again while you stay (%d)" % fired)
	var gone := c.duplicate()
	gone.dist = Sovereign.RADIUS * 3.0
	Sovereign.step(w, gone, 0.5, false)
	t = 0.0
	while t < Sovereign.DWELL + 1.0:
		fired += int(Sovereign.step(w, c, 0.5, false))
		t += 0.5
	ok(fired == 2, "leaving and coming back re-arms him")
	var w2 := Sovereign.new_watch()
	t = 0.0
	var f2 := 0
	while t < Sovereign.DWELL * 3.0:
		f2 += int(Sovereign.step(w2, c, 0.5, true))
		t += 0.5
	ok(f2 == 0, "never once slain")
	# the world first
	var mine := { "at": 2000.0, "callsign": "ACE" }
	ok(Sovereign.banner({}, mine).begins_with("WORLD FIRST · ACE") and Sovereign.banner({ "at": 1000.0, "callsign": "ZED" }, mine).contains("fell to ZED"), "the banner crowns the earliest kill")
	var p := {}
	ok(Sovereign.announcement(p, { "at": 1000.0, "callsign": "ZED" }).contains("ZED has slain a Unique"), "everyone else hears of it")
	Sovereign.mark_seen(p)
	ok(Sovereign.announcement(p, { "at": 1000.0, "callsign": "ZED" }) == "", "once")
	ok(Sovereign.parse_first('{"first":{"callsign":"ZED","at":123}}').callsign == "ZED" and Sovereign.parse_first('{"first":null}').is_empty() and Sovereign.parse_first("nope").is_empty(), "the route's body parses, null and junk are nothing")
	# data: U09 is a Unique with no clue, and nothing in the encounter rules can ever hand one over
	var e := Encounters.by_id("vyrak")
	ok(bool(e.get("unique", false)) and (e.clues as Array).is_empty() and (Encounters.by_mission("U09") as Dictionary).size() > 0, "U09 is a Unique with no clues")

func _journal_hidden() -> void:
	var j: Control = Journal.new()
	add_child(j)
	await _frames(2)
	ok(not _text_of(j).contains("Sky Sovereign") and not _text_of(j).contains("Vyrak"), "the journal never names him before you have met")
	j.queue_free()
	await _frames(1)

func _text_of(n: Node) -> String:
	var s := ""
	if n is Label:
		s += (n as Label).text + "\n"
	for c in n.get_children():
		s += _text_of(c)
	return s

## going down mid-fight: he leaves, the mark is branded, the encounter closes; the journal shows an unnamed entry
func _loss() -> void:
	Unique.pending = Sovereign.MISSION
	Unique.rematch = true
	d = Unique.new()
	var closed := { "n": 0 }
	d.closed.connect(func(): closed.n += 1)
	add_child(d)
	for i in 40:
		if d.cutscene and d.cutscene.playing:
			d.cutscene._end()
		await _frames(2)
		if d.boss:
			break
	ok(d.boss != null, "he is in the crater (the fight is up)")
	d.enemies.operator_down.emit()
	await _frames(3)
	var p := Gear.profile_load()
	ok(Sovereign.is_marked(p) and not Sovereign.is_slain(p), "a loss brands the Ashen Mark")
	ok(d.boss == null, "he climbed back into the dark")
	await get_tree().create_timer(6.0).timeout
	ok(closed.n == 1, "and the encounter closes (after its last words)")
	d.queue_free()
	d = null
	await _frames(3)
	var j: Control = Journal.new()
	add_child(j)
	await _frames(2)
	var txt := _text_of(j)
	ok(txt.contains("Unknown") and txt.contains("will not wipe off") and not txt.contains("Vyrak"), "the journal shows the mark, unnamed")
	j.queue_free()
	await _frames(1)

func _mark_on_body() -> void:
	var op := Player.new()
	add_child(op)
	op.build()
	await _frames(2)
	var marks := op.find_children("*", "MeshInstance3D", true, false).filter(func(n: Node) -> bool: return n.get_parent() and n.get_parent().get_parent() is BoneAttachment3D and (n.material_override as StandardMaterial3D) and (n.material_override as StandardMaterial3D).emission_enabled and (n.material_override as StandardMaterial3D).emission.r > 0.9 and (n.material_override as StandardMaterial3D).emission.g < 0.5)
	ok(marks.size() == 3, "the Ashen Mark rides the operator's left arm (%d streaks)" % marks.size())
	op.rig.ashen_mark(false)
	await _frames(1)
	op.queue_free()
	await _frames(1)

## the kill: once per profile, the mark lifts, the stamp and the title land, the drop pays
func _kill() -> void:
	Unique.pending = Sovereign.MISSION
	Unique.rematch = true
	d = Unique.new()
	add_child(d)
	for i in 40:
		if d.cutscene and d.cutscene.playing:
			d.cutscene._end()
		await _frames(2)
		if d.boss:
			break
	ok(d.boss != null, "he comes down again for a marked operator")
	if d.boss:
		d.boss.rules.stagger_until = d.boss.rules.clock + 3.0
		d.boss.rules.hit(1e9, "KINETIC", 1.0)
	for i in 30:
		if d.cutscene and d.cutscene.playing:
			d.cutscene._end()
		await _frames(2)
	var p := Gear.profile_load()
	ok(Sovereign.is_slain(p) and not Sovereign.is_marked(p), "the kill lands and the mark lifts")
	ok(not Sovereign.slain_at(p).is_empty() and (p.get("titles", []) as Array).has(Sovereign.TITLE) and Encounters.is_done(p, "vyrak"), "the stamp, the title and the clear")
	ok(int((p.get("relics", {}) as Dictionary).get("dragonite", 0)) == 1, "Dragonite recovered")
	var again := Sovereign.slay(p, "X", 1)
	ok(not again, "never twice")
	d.queue_free()
	d = null
	await _frames(3)

## free roam in Solara: level 12+, night, standing in the Ribcage long enough brings him down (the view asks main.gd for the
## fight); by day, nothing. Uses a fresh profile (he is slain in the one above).
func _free_roam() -> void:
	var p := Gear.profile_load()
	p["enc"] = []
	p["unique_slain"] = {}
	p["level"] = 20
	Gear.profile_save(p)
	var v: Control = ArrivalView.new()
	v.dest = "SOL"
	var called := { "m": "" }
	v.unique_called.connect(func(m: String): called.m = m)
	add_child(v)
	await _frames(5)
	ok(v.map_id == "solara", "walked out into Solara")
	var lair: Vector2 = Encounters.pois("solara")[Sovereign.LAIR]
	var o: Vector2 = v.region.origin()
	var stand := func() -> void:
		v.operator.position = Vector3(lair.x - o.x, v.region.ground(lair.x - o.x, lair.y - o.y), lair.y - o.y)
	Sovereign.hour_override = 13
	for i in 60 * 16:
		stand.call()
		v._sovereign(1.0 / 60.0)
	await get_tree().create_timer(2.0).timeout
	ok(called.m == "", "by day he never comes")
	Sovereign.hour_override = 23
	for i in 60 * 16:
		stand.call()
		v._sovereign(1.0 / 60.0)
	await get_tree().create_timer(2.0).timeout
	ok(called.m == Sovereign.MISSION, "at night, alone, standing in the crater: he comes down (%s)" % called.m)
	Sovereign.hour_override = -1
	v.queue_free()
	await _frames(3)
