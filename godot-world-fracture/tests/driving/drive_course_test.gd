extends SceneTree
## the files that fill in stages 309-333: road limits, lap progress, best-lap records and the driving session store
const Boundaries = preload("res://scripts/driving/drive_boundaries.gd")
const Course = preload("res://scripts/driving/drive_course.gd")
const Progress = preload("res://scripts/driving/drive_progress.gd")
const Records = preload("res://scripts/driving/drive_records.gd")
const Store = preload("res://scripts/driving/drive_session_store.gd")
const Road = preload("res://scripts/driving/drive_road.gd")
const Portal = preload("res://scripts/driving/city_garage_portal.gd")
var fails := 0
func check(v: bool, label: String) -> void:
	if not v:
		fails += 1
		printerr("FAIL ", label)
func _init() -> void:
	check(Boundaries.keep_inside(Vector3(500, 0, -500)) == Vector3(Boundaries.HALF_WIDTH, 0, -Boundaries.LIMIT), "clamped to the boulevard")
	check(Boundaries.keep_inside(Vector3(3, 0, 4)) == Vector3(3, 0, 4), "inside untouched")
	check(Boundaries.HALF_WIDTH < Road.HALF_WIDTH and Boundaries.LIMIT < Road.HALF_LENGTH, "limits sit on the asphalt")
	check(Boundaries.keep_inside(Portal.LOCATION) == Portal.LOCATION, "the garage platform is reachable")
	for c in Course.CHECKPOINTS:
		check(Boundaries.keep_inside(c) == c, "checkpoint %s reachable" % c)
	var p = Progress.new()
	p.reset(10.0)
	check(not p.update(Course.CHECKPOINTS[1], 11.0), "out of order checkpoint ignored")
	check(p.next == 0, "still waiting on the first")
	var done := false
	for i in Course.CHECKPOINTS.size():
		done = p.update(Course.CHECKPOINTS[i], 20.0 + i * 10.0)
	check(done and p.laps == 1, "lap completes on the last checkpoint")
	check(is_equal_approx(p.last_lap, 40.0), "lap time from reset to finish")
	var r = Records.new()
	check(r.record("tuner", 50.0), "first lap is a best")
	check(not r.record("tuner", 60.0), "slower lap isn't")
	check(r.record("tuner", 45.5), "faster lap is")
	check(r.best_label("tuner") == "0:45.50", "label " + r.best_label("tuner"))
	var path := "user://drive_records_test.json"
	check(r.save_records(path), "records save")
	var r2 = Records.new()
	r2.load_records(path)
	check(is_equal_approx(float(r2.best.tuner), 45.5) and int(r2.laps.tuner) == 3, "records round trip")
	var sp := "user://drive_session_test.json"
	if FileAccess.file_exists(sp):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(sp))
	check(Store.save("tuner", 100.0, sp) and Store.save("tuner", 50.0, sp), "session saves")
	var d := Store.load_data(sp)
	check(is_equal_approx(float(d.distance.tuner), 150.0) and d.last_vehicle == "tuner", "distance accumulates")
	print("Drive course tests failed: ", fails)
	quit(1 if fails > 0 else 0)
