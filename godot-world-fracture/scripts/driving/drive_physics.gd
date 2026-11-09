extends RefCounted
static func advance(speed: float, throttle: float, brake: float, profile: Dictionary, delta: float) -> float:
	var max_speed := float(profile.get("max_speed", 30.0))
	var accel := float(profile.get("acceleration", 8.0))
	var drag := 1.4 + absf(speed) * 0.022
	var force := clampf(throttle, -1.0, 1.0) * accel
	if absf(brake) > 0.01 and absf(speed) > 0.01:
		force -= signf(speed) * float(profile.get("braking", 12.0)) * clampf(brake, 0.0, 1.0)
	speed = move_toward(speed, 0.0, drag * delta) + force * delta
	return clampf(speed, -max_speed * 0.35, max_speed)
static func yaw_delta(speed: float, steer: float, profile: Dictionary, delta: float) -> float:
	# a tracked vehicle (`pivot`) turns on the spot; wheels need speed to steer
	if bool(profile.get("pivot", false)):
		return clampf(steer, -1.0, 1.0) * float(profile.get("steering", 1.0)) * (signf(speed) if absf(speed) > 0.5 else 1.0) * delta
	return clampf(steer, -1.0, 1.0) * float(profile.get("steering", 1.0)) * clampf(absf(speed) / 8.0, 0.0, 1.0) * signf(speed) * delta
