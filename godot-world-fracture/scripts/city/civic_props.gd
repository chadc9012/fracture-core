extends RefCounted
## Everyday civilian life on the sidewalks (asset catalog part 2 §3): vending machines, ATMs, street food stalls with
## stools and an awning, café seating under umbrellas, stacks of delivery parcels. Procedural, from primitives with a
## visibility range so static_batch.gd merges them into the tile's cells (a whole block of these is a handful of draws).
## `place(parent, side, z, kind, style, rng)` builds one against the building face and marks its footprint as a `size`
## meta on the root — the street's obstacle passes (street_slice `_obstacles` / `_tile_boxes`) read that like any prop.

const FACE_X := 13.8          # the building face (ROAD_W / 2 + WALK_W − a little)
const RANGE := 120.0

static func _mat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

static func _box(parent: Node3D, size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.material_override = mat
	mi.visibility_range_end = RANGE
	mi.visibility_range_end_margin = 16.0
	mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	parent.add_child(mi)
	return mi

static func _cyl(parent: Node3D, r: float, h: float, pos: Vector3, mat: Material, segs := 8) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	c.radial_segments = segs
	c.rings = 1
	mi.mesh = c
	mi.position = pos
	mi.material_override = mat
	mi.visibility_range_end = RANGE
	mi.visibility_range_end_margin = 16.0
	mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	parent.add_child(mi)
	return mi

## one prop at the building face on `side` (−1 / +1) at `z`; kinds: vending, atm, stall, cafe, parcels
static func place(parent: Node3D, side: float, z: float, kind: String, style: String, rng: RandomNumberGenerator) -> Node3D:
	var root := Node3D.new()
	root.position = Vector3(side * FACE_X, 0.18, z)
	root.rotation.y = PI * 0.5 if side < 0 else -PI * 0.5   # the front faces the road
	parent.add_child(root)
	var neon := style in ["nexus", "neon"]
	var accent := Color(0.2, 0.9, 1.0) if style == "nexus" else (Color(1.0, 0.3, 0.7) if style == "neon" else Color(1.0, 0.75, 0.35))
	match kind:
		"vending":
			# a lit front, a dark cabinet, the coin slot's glow; two side by side now and then
			var n := 1 if rng.randf() < 0.6 else 2
			for i in n:
				var dx := (i - (n - 1) * 0.5) * 1.1
				_box(root, Vector3(1.0, 1.9, 0.8), Vector3(dx, 0.95, 0.0), _mat(Color(0.12, 0.12, 0.15), 0.5, 0.4))
				_box(root, Vector3(0.8, 1.3, 0.04), Vector3(dx, 1.15, 0.41), _mat(accent.lerp(Color.WHITE, 0.3), 0.3, 0.0, 1.4 if neon else 0.8))
				_box(root, Vector3(0.8, 0.3, 0.04), Vector3(dx, 0.3, 0.41), _mat(Color(0.05, 0.05, 0.06), 0.4, 0.6))
			_foot(root, Vector3(1.1 * n + 0.2, 1.9, 1.0))
		"atm":
			_box(root, Vector3(0.9, 1.7, 0.6), Vector3(0, 0.85, 0), _mat(Color(0.75, 0.76, 0.8), 0.4, 0.7))
			_box(root, Vector3(0.5, 0.35, 0.03), Vector3(0, 1.25, 0.31), _mat(Color(0.3, 0.9, 1.0), 0.2, 0.0, 1.6))
			_box(root, Vector3(0.6, 0.08, 0.3), Vector3(0, 0.95, 0.35), _mat(Color(0.2, 0.2, 0.24), 0.5, 0.5))
			_box(root, Vector3(0.9, 0.25, 0.62), Vector3(0, 1.85, 0.0), _mat(accent, 0.3, 0.0, 1.2))
			_foot(root, Vector3(1.0, 1.9, 0.8))
		"stall":
			# a food cart: counter, awning on two poles, a hot lamp, three stools out front
			var wood := _mat(Color(0.35, 0.22, 0.12), 0.9)
			var cloth := _mat(Color(0.8, 0.2, 0.15) if rng.randf() < 0.5 else Color(0.95, 0.75, 0.2), 0.8)
			_box(root, Vector3(2.6, 1.0, 0.9), Vector3(0, 0.5, 0), wood)
			_box(root, Vector3(2.7, 0.06, 1.0), Vector3(0, 1.03, 0), _mat(Color(0.8, 0.8, 0.82), 0.3, 0.8))
			for sx in [-1.2, 1.2]:
				_cyl(root, 0.03, 1.3, Vector3(sx, 1.65, 0.35), _mat(Color(0.2, 0.2, 0.22), 0.4, 0.8), 6)
			_box(root, Vector3(2.9, 0.06, 1.6), Vector3(0, 2.3, 0.5), cloth)
			_box(root, Vector3(2.9, 0.25, 0.04), Vector3(0, 2.15, 1.3), cloth)
			_box(root, Vector3(0.5, 0.12, 0.3), Vector3(0.4, 1.95, 0.4), _mat(Color(1.0, 0.6, 0.25), 0.3, 0.0, 2.0))
			for sx in [-0.9, 0.0, 0.9]:
				_cyl(root, 0.17, 0.05, Vector3(sx, 0.62, 1.05), _mat(Color(0.15, 0.15, 0.17), 0.6, 0.4), 8)
				_cyl(root, 0.03, 0.6, Vector3(sx, 0.3, 1.05), _mat(Color(0.3, 0.3, 0.33), 0.4, 0.8), 6)
			_foot(root, Vector3(2.9, 2.4, 1.2), Vector3(0, 0, 0.1))
		"cafe":
			# outdoor seating: an umbrella over a round table and three chairs
			var metal := _mat(Color(0.25, 0.25, 0.28), 0.4, 0.8)
			var canvas := _mat(Color(0.9, 0.9, 0.85) if rng.randf() < 0.5 else accent.lerp(Color.WHITE, 0.5), 0.8)
			_cyl(root, 0.45, 0.04, Vector3(0, 0.75, 0.6), _mat(Color(0.9, 0.9, 0.88), 0.5, 0.2), 10)
			_cyl(root, 0.03, 0.75, Vector3(0, 0.37, 0.6), metal, 6)
			_cyl(root, 0.02, 1.6, Vector3(0, 1.6, 0.6), metal, 6)
			_cyl(root, 1.3, 0.05, Vector3(0, 2.4, 0.6), canvas, 10)
			for a in [0.6, 2.7, 4.6]:
				var p := Vector3(cos(a) * 0.8, 0.0, 0.6 + sin(a) * 0.8)
				_box(root, Vector3(0.4, 0.04, 0.4), p + Vector3(0, 0.45, 0), metal)
				_box(root, Vector3(0.4, 0.45, 0.04), p + Vector3(-sin(a) * 0.2, 0.68, cos(a) * 0.2), metal)
				_cyl(root, 0.015, 0.45, p + Vector3(0, 0.22, 0), metal, 4)
			_foot(root, Vector3(2.2, 1.0, 2.2), Vector3(0, 0, 0.6))
		_:
			# parcels: a stack of delivery boxes against the wall, a hand truck beside them
			var card := _mat(Color(0.6, 0.45, 0.28), 0.95)
			var tape := _mat(Color(0.75, 0.65, 0.5), 0.9)
			var stack := 2 + rng.randi() % 3
			var y := 0.0
			for i in stack:
				var sz := Vector3(0.6 + rng.randf() * 0.3, 0.35 + rng.randf() * 0.2, 0.5 + rng.randf() * 0.2)
				_box(root, sz, Vector3(rng.randf_range(-0.08, 0.08), y + sz.y * 0.5, 0), card)
				_box(root, Vector3(0.08, sz.y + 0.01, sz.z + 0.01), Vector3(0, y + sz.y * 0.5, 0), tape)
				y += sz.y
			_box(root, Vector3(0.5, 0.05, 0.3), Vector3(0.9, 0.1, 0.1), _mat(Color(0.2, 0.2, 0.22), 0.5, 0.7))
			_box(root, Vector3(0.05, 1.1, 0.05), Vector3(0.9, 0.6, -0.1), _mat(Color(0.2, 0.2, 0.22), 0.5, 0.7))
			_foot(root, Vector3(1.4, 1.2, 0.8), Vector3(0.3, 0, 0))
	return root

## the footprint: a `size` meta in the root's own frame (the obstacle passes turn it with the root); an offset pushes
## the whole root so the box sits where the prop stands
static func _foot(root: Node3D, size: Vector3, off := Vector3.ZERO) -> void:
	if off != Vector3.ZERO:
		root.position += root.basis * off
		for c in root.get_children():
			(c as Node3D).position -= off
	root.set_meta("size", size)

## the pass over a street: a prop every ~22 m per side, kinds mixed, skipping the doors and the lamp posts
static func dress(parent: Node3D, length: float, style: String, rng: RandomNumberGenerator, avoid: Array = []) -> int:
	var kinds: Array[String] = ["vending", "cafe", "stall", "atm", "parcels", "vending", "cafe"]
	var n := 0
	var z := -length * 0.5 + 11.0
	var k := 0
	while z < length * 0.5 - 8.0:
		for side: float in [-1.0, 1.0]:
			var zz := z + (rng.randf() - 0.5) * 6.0 + (6.0 if side > 0 else 0.0)
			var ok := true
			for a in avoid:
				var ap: Vector3 = a
				if absf(ap.z - zz) < 7.0 and signf(ap.x) == side:
					ok = false
			if ok and rng.randf() < 0.8:
				place(parent, side, zz, kinds[k % kinds.size()], style, rng)
				k += 1
				n += 1
		z += 22.0
	return n
