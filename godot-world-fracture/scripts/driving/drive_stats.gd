extends RefCounted
const Profile = preload("res://scripts/driving/drive_profile.gd")
static func description(state, id: String) -> String:
	var p := Profile.performance(state, id)
	if p.is_empty():
		return "Unavailable"
	return "Max %.0f km/h | Accel %.1f | Brakes %.1f" % [float(p.max_speed) * 3.6, float(p.acceleration), float(p.braking)]
