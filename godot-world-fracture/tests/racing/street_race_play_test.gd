extends Node
## Races the Neon Night Circuit without a window: the street track closes, the blocks stay off the road, the barriers are
## obstacles, and the three street racers and the player's car (on autopilot) all finish two laps without sticking on a
## barrier; the prize is paid. The profile and the lap records are put back.
const RaceView := preload("res://scripts/racing/race_view.gd")
const Track := preload("res://scripts/racing/track.gd")
const DT := 1.0 / 30.0
var fails := 0
var _keep := {}

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _ready() -> void:
	for p in ["user://profile.json", "user://drive_records.json"]:
		var f := FileAccess.open(p, FileAccess.READ)
		_keep[p] = f.get_as_text() if f else null
	var t := Track.new("neon-circuit")
	ok(t.street() and not Track.new("nexus-speedway").street(), "the circuit is a street track, the Speedway a venue")
	ok(t.length > 700.0 and t.at(0.0).distance_to(t.at(t.length)) < 0.5, "a closed lap of %.0f m" % t.length)
	var v := RaceView.new()
	v.track_id = "neon-circuit"
	v.autopilot = true
	add_child(v)
	await get_tree().process_frame
	v.set_process(false)
	v.controls.scripted = true
	v.countdown = 0.05
	ok(v.obstacles.size() == 4, "the barriers are the track edge, the cars the only boxes (%d)" % v.obstacles.size())
	var time := 0.0
	var stuck := 0
	while time < 600.0 and not v.race.finished:
		v._process(DT)
		time += DT
		for r in v.rivals:
			if v.race.started and r.entry.finished_at < 0.0 and absf(r.sc.speed) < 1.0:
				stuck += 1
	var all_done := true
	for e in v.race.entries:
		if e.finished_at < 0.0:
			all_done = false
	ok(v.race.finished and all_done, "all four cars finish the laps (%.0f s)" % time)
	ok(stuck < 300, "the rivals don't stick on the barriers (%d slow frames)" % stuck)
	ok(v.race.player().best_lap > 30.0, "a lap time for the player (%.1f s)" % v.race.player().best_lap)
	ok(v._prize_paid and v.race.prize() > 0, "the prize is paid (%d Nex)" % v.race.prize())
	v.queue_free()
	for p in _keep:
		if _keep[p] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		else:
			FileAccess.open(p, FileAccess.WRITE).store_string(String(_keep[p]))
	print("street race play: %d failed" % fails)
	get_tree().quit(1 if fails > 0 else 0)
