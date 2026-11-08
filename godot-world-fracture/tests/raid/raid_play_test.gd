extends Node
## Plays Raid 01 without a window: the Broken Gate (the fireteam takes its posts, the pylons charge, six waves, the gate
## holds, the checkpoint saves) and the Hollow Star (damage through the operator's hit path, the phase gates, the conduits
## by standing in them, the exposed core, the clear and its first-clear rewards). The profile and the bag are put back.
const RaidView := preload("res://scripts/raid/raid_view.gd")
const HollowStar := preload("res://scripts/raid/hollow_star.gd")
const DT := 1.0 / 30.0
var fails := 0
var _keep := {}

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _backup(path: String) -> void:
	var f := FileAccess.open(path, FileAccess.READ)
	_keep[path] = f.get_as_text() if f else null

func _restore() -> void:
	for path in _keep:
		if _keep[path] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
		else:
			var w := FileAccess.open(path, FileAccess.WRITE)
			w.store_string(String(_keep[path]))

func _view(at: String) -> Control:
	var v := RaidView.new()
	v.start_at = at
	v.autopilot = true
	add_child(v)
	await get_tree().process_frame
	v.set_process(false)
	v.controls.scripted = true
	return v

func _ready() -> void:
	for p in ["user://raids.json", "user://profile.json", "user://inventory.json"]:
		_backup(p)
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://raids.json"))
	# ---------------------------------------------------------------- the gate
	var v: Control = await _view("broken-gate")
	ok(v.allies.size() == 5 and v.pylon_pos.size() == 3, "a fireteam of five and three pylons")
	var t := 0.0
	var kill_t := 0.0
	var posted := false
	while t < 400.0 and not v._ended:
		v._process(DT)
		t += DT
		kill_t += DT
		if t > 12.0 and not posted:
			var n := 0
			for i in 3:
				if v.allies[i].mover.position.distance_to(v.pylon_pos[i]) < 4.0:
					n += 1
			posted = true
			ok(n == 3, "three of the fireteam hold the pylons (%d)" % n)
		# the fight itself is the bots' and the player's; here the hostiles fall every 3 s so the flow runs quickly
		if kill_t > 3.0:
			kill_t = 0.0
			for e in v.enemies.enemies:
				if e.team == 0 and e.target.alive():
					e.target.hp = 0.0
					break
	ok(v.raid.wave == HollowStar.GATE_WAVES.size(), "all six waves came through the rift (%d)" % v.raid.wave)
	ok(v.raid.pylons_online() == 3, "all three pylons online %s" % [v.raid.pylons])
	ok(v._ended and v.raid.cleared, "the gate holds (%.0f s)" % t)
	ok(String(HollowStar.load_save().checkpoint) == "hollow-star-boss", "the checkpoint is saved at the boss")
	v.queue_free()
	await get_tree().process_frame
	# ---------------------------------------------------------------- the boss
	var profile_before := 0
	var pf := FileAccess.open("user://profile.json", FileAccess.READ)
	if pf:
		var d: Variant = JSON.parse_string(pf.get_as_text())
		if d is Dictionary:
			profile_before = int(d.get("nex", 0))
	var b: Control = await _view("hollow-star-boss")
	ok(b.boss_body != null and b.pylon_pos.size() == 3, "Astravore and three conduits are built")
	var hits := 0
	t = 0.0
	var at_conduit := 0
	var conduit_t := 0.0
	while t < 600.0 and not b._ended:
		b._process(DT)
		t += DT
		b.enemies.hull = b.enemies.hull_max
		if b.raid.phase == 1 and b.raid.shielded:
			# Phase II: stand in each conduit in turn
			b.operator.position = b.pylon_pos[at_conduit] + Vector3(0.5, 0, 0.5)
			conduit_t += DT
			if conduit_t > 5.6:
				conduit_t = 0.0
				at_conduit = mini(2, at_conduit + 1)
		elif fmod(t, 0.5) < DT:
			# a sniper's worth through the operator's hit path
			b._on_hit(b.boss_target, 450.0, true)
			hits += 1
	ok(b.raid.cleared and b._ended, "Astravore falls (%.0f s, %d hits, %d wipes)" % [t, hits, b.raid.wipes])
	var save := HollowStar.load_save()
	ok(int(save.clears) == 1 and String(save.checkpoint) == "", "one clear, the checkpoint spent")
	var after := 0
	var pf2 := FileAccess.open("user://profile.json", FileAccess.READ)
	var titles: Array = []
	if pf2:
		var d2: Variant = JSON.parse_string(pf2.get_as_text())
		if d2 is Dictionary:
			after = int(d2.get("nex", 0))
			titles = d2.get("titles", [])
	ok(after - profile_before == 2500 and titles.has("Starbreaker"), "first clear pays 2500 Nex and the Starbreaker title")
	var gf := FileAccess.open("user://inventory.json", FileAccess.READ)
	var lens := false
	if gf:
		lens = gf.get_as_text().contains("Hollow Star Lens")
	ok(lens, "the Hollow Star Lens is in the bag")
	b.queue_free()
	_restore()
	print("raid play: %d failed" % fails)
	get_tree().quit(1 if fails > 0 else 0)
