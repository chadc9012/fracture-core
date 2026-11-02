extends Node3D
## A lap of the practice district: up the right of the boulevard, round the far end, back down the left, round the near
## end. Each checkpoint is a pair of glowing posts; the next one to reach is lit cyan, the rest dim.
const CHECKPOINTS := [Vector3(20, 0, -60), Vector3(0, 0, -108), Vector3(-20, 0, 60), Vector3(0, 0, 108)]
const RADIUS := 16.0
var _gates: Array[Node3D] = []
var _lit := StandardMaterial3D.new()
var _dim := StandardMaterial3D.new()

func _ready() -> void:
	_lit.albedo_color = Color("#4fe3ff")
	_lit.emission_enabled = true
	_lit.emission = Color("#4fe3ff")
	_lit.emission_energy_multiplier = 2.2
	_dim.albedo_color = Color("#37424a")
	for c in CHECKPOINTS:
		var gate := Node3D.new()
		gate.position = c
		add_child(gate)
		# posts either side of the racing line, across the direction of travel
		var across := Vector3(1, 0, 0) if absf(c.z) < 100.0 else Vector3(0, 0, 1)
		for side in [-1.0, 1.0]:
			var post := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.height = 4.0
			cyl.top_radius = 0.25
			cyl.bottom_radius = 0.25
			post.mesh = cyl
			post.position = across * side * 9.0 + Vector3.UP * 2.0
			gate.add_child(post)
		_gates.append(gate)
	highlight(0)

func highlight(index: int) -> void:
	for i in _gates.size():
		for post in _gates[i].get_children():
			(post as MeshInstance3D).material_override = _lit if i == index else _dim

static func reached(index: int, position: Vector3) -> bool:
	var c: Vector3 = CHECKPOINTS[index % CHECKPOINTS.size()]
	return Vector2(position.x - c.x, position.z - c.z).length() <= RADIUS
