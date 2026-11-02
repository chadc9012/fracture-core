extends Node3D
## Where the car may go: the boulevard between the kerbs, end to end. Low crash barriers close off the two ends so the
## edge of the district reads as a barrier, not a cliff. keep_inside() is the hard limit the driving view applies.
const LIMIT := 120.0
const HALF_WIDTH := 41.0

static func keep_inside(position: Vector3) -> Vector3:
	return Vector3(clampf(position.x, -HALF_WIDTH, HALF_WIDTH), position.y, clampf(position.z, -LIMIT, LIMIT))

static func touching(position: Vector3) -> bool:
	return absf(position.x) >= HALF_WIDTH - 0.01 or absf(position.z) >= LIMIT - 0.01

func _ready() -> void:
	var red := StandardMaterial3D.new()
	red.albedo_color = Color("#b8322a")
	var white := StandardMaterial3D.new()
	white.albedo_color = Color("#e8e8e8")
	for end in [-1.0, 1.0]:
		var x := -HALF_WIDTH
		var i := 0
		while x <= HALF_WIDTH:
			var block := MeshInstance3D.new()
			var b := BoxMesh.new()
			b.size = Vector3(2.0, 0.9, 0.8)
			block.mesh = b
			block.position = Vector3(x, 0.45, end * (LIMIT + 2.0))
			block.material_override = red if i % 2 == 0 else white
			add_child(block)
			x += 2.0
			i += 1
