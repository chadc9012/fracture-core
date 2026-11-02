extends RefCounted
const Access = preload("res://scripts/driving/city_garage_access.gd")
static func garage_hint(position: Vector3) -> String:
	return "Enter Nexus Customs" if Access.in_range(position) else "Drive toward the cyan garage platform"
