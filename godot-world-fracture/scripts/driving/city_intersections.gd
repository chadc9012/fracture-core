extends RefCounted
static func is_intersection(position: Vector3) -> bool:
	return absf(position.z) < 8.0 and absf(position.x) < 45.0
