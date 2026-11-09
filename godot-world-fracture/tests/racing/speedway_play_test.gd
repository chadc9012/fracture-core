extends Node
## Races Nexus Speedway, the racing venue, without a window: the three rivals and the player's car (on autopilot) all
## finish the laps without sticking on a wall or the pit lane, nobody drives through the stands, and the prize is paid.
## The profile and the lap records are put back.
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
	var t := Track.new("nexus-speedway")
	ok(not t.street(), "the Speedway is a venue")
	ok(t.length > 400.0 and t.at(0.0).distance_to(t.at(t.length)) < 0.5, "a closed lap of %.0f m" % t.length)
	var v := RaceView.new()
	v.track_id = "nexus-speedway"
	v.autopilot = true
	add_child(v)
	await get_tree().process_frame
	v.set_process(false)
	v.controls.scripted = true
	v.countdown = 0.05
	var draws := 0
	for n in v.world.find_children("*", "GeometryInstance3D", true, false):
		if n is MeshInstance3D and (n as MeshInstance3D).mesh:
			draws += (n as MeshInstance3D).mesh.get_surface_count()
		elif n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh.mesh:
			draws += (n as MultiMeshInstance3D).multimesh.mesh.get_surface_count()
	ok(draws < 500, "the venue is folded for a phone (%d mesh draws, was ~2,500)" % draws)
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
	var lights_ok := true
	for l in v.lights:
		lights_ok = lights_ok and is_instance_valid(l) and (l as MeshInstance3D).is_inside_tree()
	ok(lights_ok and v.lights.size() > 0, "the start lights are still their own meshes (they change colour)")
	ok(stuck < 300, "the rivals don't stick on the barriers (%d slow frames)" % stuck)
	ok(v.race.player().best_lap > 15.0, "a lap time for the player (%.1f s)" % v.race.player().best_lap)
	ok(v._prize_paid and v.race.prize() > 0, "the prize is paid (%d Nex)" % v.race.prize())
	v.queue_free()
	for p in _keep:
		if _keep[p] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
		else:
			FileAccess.open(p, FileAccess.WRITE).store_string(String(_keep[p]))
	print("speedway play: %d failed" % fails)
	get_tree().quit(1 if fails > 0 else 0)
