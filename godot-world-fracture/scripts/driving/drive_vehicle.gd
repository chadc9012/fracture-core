extends Node3D
const Physics = preload("res://scripts/driving/drive_physics.gd")
var profile: Dictionary = {}
var speed := 0.0
var throttle := 0.0
var steer := 0.0
var brake := 0.0
func _physics_process(delta: float) -> void:
	speed = Physics.advance(speed, throttle, brake, profile, delta)
	rotation.y += Physics.yaw_delta(speed, steer, profile, delta)
	position += -global_transform.basis.z * speed * delta
