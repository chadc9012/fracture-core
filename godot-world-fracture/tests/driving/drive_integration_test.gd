extends SceneTree
const Catalog = preload("res://scripts/garage/catalog.gd")
const State = preload("res://scripts/garage/garage_state.gd")
const Profile = preload("res://scripts/driving/drive_profile.gd")
const Ownership = preload("res://scripts/driving/drive_ownership.gd")
var failures := 0
func _init() -> void:
	var state = State.fresh()
	for v in Catalog.VEHICLES:
		if not Ownership.owns(state, String(v.id)):
			failures += 1
		if Profile.performance(state, String(v.id)).is_empty():
			failures += 1
	state.cars["tuner"].parts["brakes"] = "brakes-sport"
	var snapshot: Dictionary = state.to_dict()
	var back = State.fresh()
	back.from_dict(snapshot)
	if back.car("tuner").parts.get("brakes", "") != "brakes-sport":
		failures += 1
	print("Drive integration failures: ", failures)
	quit(1 if failures else 0)
