extends RefCounted
static func recover(vehicle: Node3D) -> void:
	vehicle.position = Vector3.ZERO
	vehicle.rotation = Vector3.ZERO
	vehicle.set("speed", 0.0)
