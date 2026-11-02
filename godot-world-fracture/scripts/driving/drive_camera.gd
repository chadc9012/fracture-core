extends Camera3D
var target: Node3D
func _process(delta: float) -> void:
	if not is_instance_valid(target):
		return
	var desired := target.global_position + target.global_transform.basis.z * 10.0 + Vector3.UP * 5.0
	global_position = global_position.lerp(desired, clampf(delta * 5.0, 0.0, 1.0))
	look_at(target.global_position + Vector3.UP * 1.1)
