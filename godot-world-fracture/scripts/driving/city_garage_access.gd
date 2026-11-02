extends RefCounted
const Portal = preload("res://scripts/driving/city_garage_portal.gd")
static func in_range(position: Vector3) -> bool:
	return position.distance_to(Portal.LOCATION) <= 19.0
