extends SceneTree
const Config = preload("res://scripts/driving/drive_config.gd")
const Physics = preload("res://scripts/driving/drive_physics.gd")
const Profile = preload("res://scripts/driving/drive_profile.gd")
const Session = preload("res://scripts/driving/drive_session.gd")
const State = preload("res://scripts/garage/garage_state.gd")
var fails := 0
func check(value: bool, label: String) -> void:
	if not value:
		fails += 1
		printerr("FAIL ", label)
func _init() -> void:
	var state = State.fresh()
	check(Config.vehicle_ids().size() == 6, "six original vehicles")
	var base := Profile.performance(state, "tuner")
	check(base.max_speed > 0.0, "driveable tuning")
	var original_speed: float = base.max_speed
	state.cars["tuner"].parts["engine"] = "engine-2"
	var tuned := Profile.performance(state, "tuner")
	check(tuned.max_speed > original_speed, "engine upgrade changes actual drive speed")
	state.cars["tuner"].damage = 80
	check(Profile.performance(state, "tuner").max_speed < tuned.max_speed, "damage slows vehicle")
	check(Physics.advance(0.0, 1.0, 0.0, base, 0.1) > 0.0, "throttle accelerates")
	check(Physics.advance(10.0, 0.0, 1.0, base, 0.1) < 10.0, "brake decelerates")
	var session = Session.new()
	check(session.select("offroad-truck"), "select truck")
	check(not session.select("unknown"), "reject unknown")
	session.tick(2.0, 10.0)
	check(is_equal_approx(session.distance_m, 20.0), "odometer")
	print("Driving tests failed: ", fails)
	quit(1 if fails else 0)
