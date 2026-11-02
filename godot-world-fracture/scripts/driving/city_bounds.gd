extends RefCounted
const Bounds = preload("res://scripts/driving/drive_boundaries.gd")
static func inside(position: Vector3) -> bool:
	return absf(position.x) <= Bounds.LIMIT and absf(position.z) <= Bounds.LIMIT
