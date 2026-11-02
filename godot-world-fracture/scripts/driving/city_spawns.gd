extends RefCounted
const START := Vector3(0, 0, 0)
const GARAGE_EXIT := Vector3(-32, 0, -55)
static func valid_spawn(pos: Vector3) -> bool:
	return absf(pos.x) < 125.0 and absf(pos.z) < 125.0
