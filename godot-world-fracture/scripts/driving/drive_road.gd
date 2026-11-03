extends Node3D
## The practice district's streets: a long boulevard (north-south, z) crossed by one avenue (east-west, x) at the origin,
## asphalt with kerbs, white edge lines, dashed lane lines and a zebra crossing on each side of the intersection.
## Sizes match the city dressing: the sidewalks sit at x = +-46 (7 m wide), so the carriageway is 85 m kerb to kerb.
const MeshMerge = preload("res://scripts/mesh_merge.gd")
const HALF_WIDTH := 42.5
const HALF_LENGTH := 122.0
const AVENUE_HALF := 8.0
const LANE_XS := [-28.0, -14.0, 14.0, 28.0]

static func _mat(color: Color, rough := 0.9, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = emit
	return m

func _box(size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.material_override = mat
	add_child(mi)
	return mi

func _ready() -> void:
	var asphalt := _mat(Color("#24282c"), 0.82)
	var paint := _mat(Color("#d8dcdc"), 0.6)
	var yellow := _mat(Color("#e0b030"), 0.6)
	var kerb := _mat(Color("#9a9c9c"), 0.85)
	# carriageways (slightly above the ground plane so they never z-fight it)
	_box(Vector3(HALF_WIDTH * 2.0, 0.04, HALF_LENGTH * 2.0), Vector3(0, 0.02, 0), asphalt)
	_box(Vector3(240.0, 0.04, AVENUE_HALF * 2.0), Vector3(0, 0.021, 0), asphalt)
	# kerbs along both sides of the boulevard
	for side in [-1.0, 1.0]:
		_box(Vector3(0.4, 0.18, HALF_LENGTH * 2.0), Vector3(side * (HALF_WIDTH + 0.2), 0.09, 0), kerb)
		_box(Vector3(0.3, 0.012, HALF_LENGTH * 2.0), Vector3(side * (HALF_WIDTH - 1.0), 0.046, 0), paint)
	# double yellow centre line and dashed lane lines, broken at the intersection
	for x in [-0.25, 0.25]:
		for half in [-1.0, 1.0]:
			var length := HALF_LENGTH - AVENUE_HALF - 6.0
			_box(Vector3(0.18, 0.012, length), Vector3(x, 0.046, half * (AVENUE_HALF + 6.0 + length * 0.5)), yellow)
	for lx in LANE_XS:
		var z := -HALF_LENGTH + 3.0
		while z < HALF_LENGTH - 3.0:
			if absf(z) > AVENUE_HALF + 7.0:
				_box(Vector3(0.18, 0.012, 3.0), Vector3(lx, 0.046, z), paint)
			z += 9.0
	# zebra crossings either side of the avenue
	for half in [-1.0, 1.0]:
		var x := -HALF_WIDTH + 2.0
		while x < HALF_WIDTH - 1.0:
			_box(Vector3(1.4, 0.012, 4.0), Vector3(x, 0.047, half * (AVENUE_HALF + 3.0)), paint)
			x += 2.8
		_box(Vector3(HALF_WIDTH * 2.0 - 2.0, 0.012, 0.5), Vector3(0, 0.047, half * (AVENUE_HALF + 5.6)), paint)
	# a few hundred dashes and stripes become one draw per paint colour
	MeshMerge.merge_children(self, false)
