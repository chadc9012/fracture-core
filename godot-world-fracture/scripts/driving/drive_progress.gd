extends RefCounted
## Lap progress: checkpoints must be taken in order; taking the last one completes a lap. Lap time is measured from the
## clock value passed in (the drive session's seconds), so it keeps running while the car sits still.
const Course = preload("res://scripts/driving/drive_course.gd")
var next := 0
var laps := 0
var lap_started := 0.0
var last_lap := 0.0
var best_lap := 0.0

func reset(now := 0.0) -> void:
	next = 0
	laps = 0
	lap_started = now
	last_lap = 0.0
	best_lap = 0.0

## true on the frame a lap completes
func update(position: Vector3, now: float) -> bool:
	if not Course.reached(next, position):
		return false
	next += 1
	if next < Course.CHECKPOINTS.size():
		return false
	next = 0
	laps += 1
	last_lap = now - lap_started
	lap_started = now
	if best_lap <= 0.0 or last_lap < best_lap:
		best_lap = last_lap
	return true
