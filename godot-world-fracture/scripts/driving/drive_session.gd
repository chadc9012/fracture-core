extends RefCounted
const Config = preload("res://scripts/driving/drive_config.gd")
var vehicle_id := "tuner"
var distance_m := 0.0
var seconds := 0.0
var speed := 0.0
func select(id: String) -> bool:
	if not Config.valid_vehicle(id):
		return false
	vehicle_id = id
	speed = 0.0
	return true
func tick(delta: float, current_speed: float) -> void:
	seconds += maxf(0.0, delta)
	distance_m += absf(current_speed) * maxf(0.0, delta)
	speed = current_speed
