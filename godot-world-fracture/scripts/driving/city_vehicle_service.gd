extends RefCounted
const Profile = preload("res://scripts/driving/drive_profile.gd")
static func refreshed_profile(state, vehicle_id: String) -> Dictionary:
	return Profile.performance(state, vehicle_id)
