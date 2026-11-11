extends Node3D
## The practice district's frontage: the authored Nexus / Neon blocks (models/buildings, the same set the street and the
## Killbox skylines use) on each side of the boulevard, with a tower skyline further out, instead of plain boxes.
## Each model is scaled to its plot (14 m frontage, 12 m deep) and stood on the ground. Falls back to boxes if the models
## are missing.
const MeshMerge = preload("res://scripts/mesh_merge.gd")
const Facade := preload("res://scripts/vfx/facade.gd")
const DIR := "res://models/buildings/"
const FRONT := ["nexus-terrace-a", "neon-block-a", "nexus-civic-a", "neon-v-B", "nexus-terrace-b", "neon-block-b", "nexus-civic-b"]

func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 41
	var fallback: Array[StandardMaterial3D] = []
	for c in [Color("#46545c"), Color("#303c4b")]:
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.metallic = 0.22
		fallback.append(m)
	for side in [-1, 1]:
		for i in range(7):
			var h := 9.0 + (i % 4) * 7.0
			var at := Vector3(side * 59.0, 0, -100.0 + i * 31.0)
			var f: String = FRONT[(i + (3 if side > 0 else 0)) % FRONT.size()]
			if not _place(f, at, Vector3(14.0, h + 6.0, 12.0), -side * PI * 0.5):
				var building := MeshInstance3D.new()
				var box := BoxMesh.new()
				box.size = Vector3(14.0, h, 12.0)
				building.mesh = box
				building.position = at + Vector3(0, h * 0.5, 0)
				building.material_override = fallback[i % 2]
				add_child(building)
	# the skyline behind: forty towers with lit windows, one merged mesh (scripts/vfx/facade.gd)
	var tower := Facade.material({"lit": 0.15, "sky": Color(0.85, 0.7, 0.6), "frame": Color(0.07, 0.075, 0.09), "glass": Color(0.04, 0.06, 0.1)})
	Facade.skyline(self, Vector3.ZERO, 300.0, 560.0, 48, tower, 41)
	# a ring of lower blocks between the district and the towers, so the horizon isn't an empty plaza
	Facade.skyline(self, Vector3.ZERO, 150.0, 260.0, 40, tower, 42, TAU, 0.0, 14.0, 40.0)
	MeshMerge.merge_children(self)

## the model scaled to fit `fit` (x frontage, y height, z depth) with its base on the ground at `at`
func _place(name: String, at: Vector3, fit: Vector3, yaw: float) -> bool:
	var path := DIR + name + ".glb"
	if not ResourceLoader.exists(path):
		return false
	var m := (load(path) as PackedScene).instantiate() as Node3D
	var holder := Node3D.new()
	holder.position = at
	holder.rotation.y = yaw
	add_child(holder)
	holder.add_child(m)
	var bb := AABB()
	var first := true
	for c in m.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var xf := Transform3D()
		var n: Node = mi
		while n != m and n is Node3D:
			xf = (n as Node3D).transform * xf
			n = n.get_parent()
		var b: AABB = xf * mi.get_aabb()
		bb = b if first else bb.merge(b)
		first = false
	if first or bb.size.y <= 0.01:
		return true
	# keep proportions: the height sets the scale unless the footprint would overflow the plot
	var s := minf(fit.y / bb.size.y, minf(fit.x / maxf(bb.size.x, 0.01), fit.z / maxf(bb.size.z, 0.01)) * 1.15)
	m.scale = Vector3.ONE * s
	var c := bb.get_center() * s
	m.position = Vector3(-c.x, -bb.position.y * s, -c.z)
	for c2 in m.find_children("*", "GeometryInstance3D", true, false):
		(c2 as GeometryInstance3D).visibility_range_end = 420.0
	return true
