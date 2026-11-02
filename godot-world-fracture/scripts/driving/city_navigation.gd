extends RefCounted
const Portal = preload("res://scripts/driving/city_garage_portal.gd")
static func distance_to_garage(position: Vector3) -> float:
	return position.distance_to(Portal.LOCATION)
static func direction_to_garage(position: Vector3) -> Vector3:
	return (Portal.LOCATION - position).normalized()
