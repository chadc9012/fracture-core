extends RefCounted
static func snapshot(session, vehicle: Node3D) -> Dictionary:
	return {"vehicle_id": session.vehicle_id, "distance_m": session.distance_m,
		"seconds": session.seconds, "speed_mps": session.speed,
		"position": [vehicle.position.x, vehicle.position.y, vehicle.position.z]}
