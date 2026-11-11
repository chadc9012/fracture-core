extends RefCounted
## The sets inside the walk-in buildings (interiors.gd ROOMS), one builder per kind, drawn through interior_view.gd's
## helpers (`v.box`, `v.cyl`, `v.person`, `v.model`, ...), and each building's frontage on the Nexus avenue (`front`).
## Built from detailed pieces after the owner's board (docs/reference/asset-catalog-part2.png §2): no single-box props.

const FLEET := "res://models/fleet/"
const CITY := "res://models/city/"

static func build(v, kind: String) -> void:
	match kind:
		"hospital": _hospital(v)
		"police": _police(v)
		"fire": _fire(v)
		"hotel": _hotel(v)
		"nightclub": _nightclub(v)
		"restaurant": _restaurant(v)
		"school": _school(v)
		"office": _office(v)
		"parking": _parking(v)

# --------------------------------------------------------------------------------------------- shared furniture
## a chair facing +z (yaw turns it): frame, seat, back; `pad` the upholstery
static func chair(v, pos: Vector3, yaw: float, pad: Material, frame: Material, solid := false) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation.y = yaw
	v.static_root.add_child(holder)
	v.box(Vector3(0.46, 0.08, 0.46), Vector3(0, 0.46, 0), pad, false, 0.0, holder)
	v.box(Vector3(0.46, 0.5, 0.07), Vector3(0, 0.76, -0.2), pad, false, 0.0, holder)
	for lx: float in [-0.2, 0.2]:
		for lz: float in [-0.2, 0.2]:
			v.box(Vector3(0.04, 0.44, 0.04), Vector3(lx, 0.22, lz), frame, false, 0.0, holder)
	if solid:
		v.block(Vector3(0.5, 1.0, 0.5), pos + Vector3(0, 0.5, 0))

## a table: top and four legs (round: a pedestal); solid footprint
static func table(v, pos: Vector3, size: Vector3, top: Material, leg: Material, round := false) -> void:
	if round:
		v.cyl(size.x * 0.5, 0.05, pos + Vector3(0, size.y, 0), top, false, -1.0, 24)
		v.cyl(0.06, size.y, pos + Vector3(0, size.y * 0.5, 0), leg)
		v.cyl(0.3, 0.04, pos + Vector3(0, 0.02, 0), leg, false, -1.0, 16)
	else:
		v.box(Vector3(size.x, 0.05, size.z), pos + Vector3(0, size.y, 0), top)
		for lx: float in [-1.0, 1.0]:
			for lz: float in [-1.0, 1.0]:
				v.box(Vector3(0.05, size.y, 0.05), pos + Vector3(lx * (size.x * 0.5 - 0.08), size.y * 0.5, lz * (size.z * 0.5 - 0.08)), leg)
	v.block(Vector3(size.x, size.y + 0.1, size.z), pos + Vector3(0, size.y * 0.5, 0))

## a desk monitor on a stand, its screen lit
static func monitor(v, pos: Vector3, yaw: float, screen: Color) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation.y = yaw
	v.static_root.add_child(holder)
	var dark: Material = v.flat(Color(0.05, 0.05, 0.06), 0.4, 0.3)
	v.box(Vector3(0.62, 0.38, 0.04), Vector3(0, 0.36, 0), dark, false, 0.0, holder)
	v.box(Vector3(0.57, 0.33, 0.01), Vector3(0, 0.36, 0.022), v.emissive(screen, 1.4), false, 0.0, holder)
	v.box(Vector3(0.05, 0.18, 0.05), Vector3(0, 0.1, -0.04), dark, false, 0.0, holder)
	v.box(Vector3(0.24, 0.02, 0.16), Vector3(0, 0.01, -0.02), dark, false, 0.0, holder)

## a potted plant: pot, soil, a cluster of leaf balls
static func plant(v, pos: Vector3, h := 1.4) -> void:
	v.cyl(0.32, 0.55, pos + Vector3(0, 0.275, 0), v.flat(Color(0.2, 0.2, 0.22), 0.5, 0.2), true, 0.26)
	var leaf: Material = v.flat(Color(0.12, 0.32, 0.14), 0.7)
	for i in 6:
		var a := TAU * i / 6.0
		var s := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.28
		sm.height = 0.5
		sm.radial_segments = 10
		sm.rings = 5
		s.mesh = sm
		s.material_override = leaf
		s.position = pos + Vector3(cos(a) * 0.22, 0.6 + h * 0.4 + (i % 3) * 0.18, sin(a) * 0.22)
		v.static_root.add_child(s)
	var top := MeshInstance3D.new()
	var tm := SphereMesh.new()
	tm.radius = 0.32
	tm.height = 0.6
	tm.radial_segments = 10
	tm.rings = 5
	top.mesh = tm
	top.material_override = leaf
	top.position = pos + Vector3(0, 0.6 + h * 0.65, 0)
	v.static_root.add_child(top)

## a wall sign: dark backing plate and lit text
static func wall_sign(v, t: String, pos: Vector3, yaw: float, c: Color, width := 3.0, size := 64) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation.y = yaw
	v.static_root.add_child(holder)
	v.box(Vector3(width, 0.5, 0.06), Vector3.ZERO, v.flat(Color(0.06, 0.06, 0.08), 0.4, 0.4), false, 0.0, holder)
	v.text(t, pos + Basis(Vector3.UP, yaw) * Vector3(0, 0, 0.05), yaw, c * 1.4, size, 0.006)

## a double door set into a wall (closed, for show): frame, two leaves with windows, a sign over it
static func wall_doors(v, pos: Vector3, yaw: float, label: String, c: Color) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation.y = yaw
	v.static_root.add_child(holder)
	var frame: Material = v.flat(Color(0.3, 0.32, 0.34), 0.4, 0.6)
	var leaf: Material = v.flat(Color(0.75, 0.77, 0.78), 0.5, 0.2)
	v.box(Vector3(2.4, 2.5, 0.1), Vector3(0, 1.25, 0), frame, false, 0.0, holder)
	for sx: float in [-0.58, 0.58]:
		v.box(Vector3(1.1, 2.35, 0.06), Vector3(sx, 1.2, 0.07), leaf, false, 0.0, holder)
		v.box(Vector3(0.4, 0.5, 0.02), Vector3(sx, 1.6, 0.11), v.flat(Color(0.5, 0.65, 0.75, 0.6), 0.1), false, 0.0, holder)
		v.box(Vector3(0.04, 0.3, 0.05), Vector3(sx * 0.2, 1.1, 0.12), frame, false, 0.0, holder)
	wall_sign(v, label, pos + Basis(Vector3.UP, yaw) * Vector3(0, 2.85, 0.06), yaw, c, 2.4, 44)

## a horizontal floor guide line (hospital wayfinding, hazard paint)
static func floor_line(v, from: Vector3, to: Vector3, c: Color, w := 0.12) -> void:
	var mid := (from + to) * 0.5
	var l := from.distance_to(to)
	var yaw := atan2(to.x - from.x, to.z - from.z)
	v.box(Vector3(w, 0.01, l), Vector3(mid.x, 0.006, mid.z), v.flat(c, 0.5), false, yaw)

# --------------------------------------------------------------------------------------------- hospital
static func _hospital(v) -> void:
	var white: Material = v.flat(Color(0.94, 0.95, 0.96), 0.4)
	var teal: Material = v.flat(Color(0.1, 0.55, 0.6), 0.5)
	var steel: Material = v.flat(Color(0.7, 0.72, 0.74), 0.3, 0.8)
	var scrubs := Color(0.3, 0.6, 0.66)
	v.ceiling_panels(4, 3, Vector2(2.2, 1.0), Color(0.95, 0.98, 1.0), 1.3)
	# the nurses' station: a long counter with a raised transaction ledge, monitors and staff behind
	v.box(Vector3(9.0, 1.05, 0.9), Vector3(0, 0.525, -9.0), white, true)
	v.box(Vector3(9.2, 0.06, 0.4), Vector3(0, 1.12, -8.65), v.pbr("marble_01", Color(0.9, 0.9, 0.92), 1.0))
	v.box(Vector3(9.02, 0.24, 0.02), Vector3(0, 0.75, -8.54), teal)
	for i in 4:
		monitor(v, Vector3(-3.0 + i * 2.0, 1.05, -9.2), PI, Color(0.3, 0.8, 0.9))
	for i in 3:
		v.person(Vector3(-2.5 + i * 2.5, 0, -10.2), 0.0, 0, scrubs)
	wall_sign(v, "EMERGENCY · ADMISSIONS", Vector3(0, 3.6, -25.8), 0.0, Color(0.9, 0.2, 0.2), 6.0, 72)
	# the red cross over the station
	var red: Material = v.emissive(Color(0.95, 0.12, 0.12), 2.2)
	v.box(Vector3(1.2, 0.36, 0.08), Vector3(0, 4.2, -25.8), red)
	v.box(Vector3(0.36, 1.2, 0.08), Vector3(0, 4.2, -25.8), red)
	# the waiting area: rows of linked teal seats, a few people waiting
	for row in 3:
		for k in 5:
			var p := Vector3(-14.0 + k * 0.62, 0, -5.0 - row * 2.2)
			chair(v, p, PI * 0.5, teal, steel)
		v.block(Vector3(3.2, 1.0, 0.6), Vector3(-12.76, 0.5, -5.0 - row * 2.2))
	for s in [[-13.38, -5.0], [-12.14, -7.2], [-13.38, -9.4], [-11.52, -5.0]]:
		v.person(Vector3(float(s[0]), 0, float(s[1])), PI * 0.5, 3, Color(v.rng.randf(), v.rng.randf() * 0.5, v.rng.randf() * 0.4), false)
	plant(v, Vector3(-15.0, 0, -1.5))
	plant(v, Vector3(-15.0, 0, -12.0))
	# the triage bays down the right wall: curtain rails and curtains, beds with rails, IV poles, monitors
	var curtain: Material = v.flat(Color(0.45, 0.72, 0.74, 0.9), 0.9)
	for b in 4:
		var z := -5.0 - b * 4.8
		var x := 13.0
		# the curtain dividers between bays and the half-drawn front curtain
		v.box(Vector3(2.6, 2.2, 0.03), Vector3(x + 0.7, 1.35, z + 2.2), curtain, true)
		v.box(Vector3(0.03, 2.2, 1.8), Vector3(x - 1.9, 1.35, z + 1.1), curtain)
		v.box(Vector3(0.04, 0.04, 4.6), Vector3(x - 1.9, 2.5, z), steel)
		# the bed
		v.box(Vector3(1.0, 0.12, 2.1), Vector3(x + 0.6, 0.62, z - 0.2), steel, true)
		v.box(Vector3(0.94, 0.16, 2.0), Vector3(x + 0.6, 0.76, z - 0.2), white)
		v.box(Vector3(0.6, 0.12, 0.35), Vector3(x + 0.6, 0.9, z - 1.0), white)
		for sx: float in [-0.52, 0.52]:
			v.box(Vector3(0.03, 0.22, 1.2), Vector3(x + 0.6 + sx, 0.95, z - 0.2), steel)
		for lz: float in [-1.1, 0.7]:
			v.cyl(0.05, 0.08, Vector3(x + 0.6, 0.06, z + lz), v.flat(Color(0.1, 0.1, 0.1), 0.6))
			v.box(Vector3(0.9, 0.04, 0.04), Vector3(x + 0.6, 0.35, z + lz), steel)
		# IV pole with a bag, and the bedside monitor with its trace
		v.cyl(0.015, 1.9, Vector3(x - 0.3, 0.95, z - 1.0), steel)
		v.box(Vector3(0.14, 0.2, 0.05), Vector3(x - 0.3, 1.75, z - 1.0), v.flat(Color(0.85, 0.92, 0.95, 0.7), 0.1))
		v.box(Vector3(0.42, 0.32, 0.08), Vector3(x + 1.6, 1.7, z - 1.1), v.flat(Color(0.08, 0.08, 0.1), 0.4, 0.3))
		v.box(Vector3(0.36, 0.26, 0.01), Vector3(x + 1.555, 1.7, z - 1.1), v.emissive(Color(0.1, 0.9, 0.4), 1.2), false, -PI * 0.5)
		if b % 2 == 0:
			v.person(Vector3(x + 0.6, 0.5, z - 0.3), -PI * 0.5, 3, Color(0.75, 0.82, 0.88), false)
		else:
			v.person(Vector3(x - 1.0, 0, z - 0.4), PI * 0.5, 0, scrubs)
	# doors deeper into the hospital, and the wayfinding lines leading to them
	wall_doors(v, Vector3(-7.0, 0, -25.82), 0.0, "RADIOLOGY", Color(0.3, 0.7, 1.0))
	wall_doors(v, Vector3(6.5, 0, -25.82), 0.0, "TRAUMA", Color(0.95, 0.3, 0.3))
	wall_doors(v, Vector3(-15.82, 0, -19.0), PI * 0.5, "PHARMACY", Color(0.3, 0.9, 0.5))
	floor_line(v, Vector3(-0.6, 0, -2.0), Vector3(-0.6, 0, -6.6), Color(0.2, 0.55, 0.95))
	floor_line(v, Vector3(-0.6, 0, -6.6), Vector3(-7.0, 0, -12.0), Color(0.2, 0.55, 0.95))
	floor_line(v, Vector3(-7.0, 0, -12.0), Vector3(-7.0, 0, -25.0), Color(0.2, 0.55, 0.95))
	floor_line(v, Vector3(0.6, 0, -2.0), Vector3(0.6, 0, -6.6), Color(0.9, 0.2, 0.2))
	floor_line(v, Vector3(0.6, 0, -6.6), Vector3(6.5, 0, -12.0), Color(0.9, 0.2, 0.2))
	floor_line(v, Vector3(6.5, 0, -12.0), Vector3(6.5, 0, -25.0), Color(0.9, 0.2, 0.2))
	# a parked wheelchair and a vending machine by the door
	_wheelchair(v, Vector3(-4.0, 0, -2.2), 0.4)
	_vending(v, Vector3(4.6, 0, -0.9), PI, Color(0.1, 0.5, 0.9))
	v.spot("desk", "NURSES' STATION", Vector3(0, 0, -7.8), "Triage nurse: \"Take a seat, the doctor will see you shortly.\"", 2.4)

static func _wheelchair(v, pos: Vector3, yaw: float) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation.y = yaw
	v.static_root.add_child(holder)
	var frame: Material = v.flat(Color(0.65, 0.67, 0.7), 0.3, 0.8)
	var black: Material = v.flat(Color(0.08, 0.08, 0.09), 0.5)
	for sx: float in [-0.32, 0.32]:
		var wheel := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.26
		tm.outer_radius = 0.3
		tm.rings = 20
		tm.ring_segments = 6
		wheel.mesh = tm
		wheel.material_override = black
		wheel.position = Vector3(sx, 0.3, -0.05)
		wheel.rotation.z = PI * 0.5
		holder.add_child(wheel)
		v.box(Vector3(0.03, 0.55, 0.03), Vector3(sx * 0.85, 0.75, -0.2), frame, false, 0.0, holder)
		v.cyl(0.05, 0.04, Vector3(sx * 0.8, 0.05, 0.35), black, false, -1.0, 10, holder)
	v.box(Vector3(0.5, 0.06, 0.45), Vector3(0, 0.5, 0.0), black, false, 0.0, holder)
	v.box(Vector3(0.5, 0.45, 0.04), Vector3(0, 0.78, -0.22), black, false, 0.0, holder)
	v.block(Vector3(0.8, 1.0, 0.8), pos + Vector3(0, 0.5, 0))

static func _vending(v, pos: Vector3, yaw: float, c: Color) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation.y = yaw
	v.static_root.add_child(holder)
	v.box(Vector3(0.95, 1.9, 0.8), Vector3(0, 0.95, 0), v.flat(c.darkened(0.3), 0.4, 0.3), false, 0.0, holder)
	v.box(Vector3(0.6, 1.3, 0.02), Vector3(-0.1, 1.1, 0.41), v.emissive(Color(0.85, 0.9, 1.0), 0.9), false, 0.0, holder)
	for r in 5:
		v.box(Vector3(0.58, 0.02, 0.05), Vector3(-0.1, 0.55 + r * 0.26, 0.42), v.flat(Color(0.2, 0.2, 0.22), 0.4, 0.6), false, 0.0, holder)
	v.box(Vector3(0.18, 0.4, 0.02), Vector3(0.33, 1.2, 0.41), v.flat(Color(0.1, 0.1, 0.12), 0.3, 0.5), false, 0.0, holder)
	v.block(Vector3(1.0, 1.9, 1.0), pos + Vector3(0, 0.95, 0))

# --------------------------------------------------------------------------------------------- police
static func _police(v) -> void:
	var navy := Color(0.07, 0.11, 0.24)
	var wood: Material = v.pbr("brown_planks_03", Color(0.6, 0.45, 0.32), 1.5)
	var steel: Material = v.flat(Color(0.55, 0.57, 0.6), 0.35, 0.8)
	var dark: Material = v.flat(Color(0.12, 0.13, 0.15), 0.5, 0.2)
	v.ceiling_panels(4, 3, Vector2(2.0, 0.6), Color(0.92, 0.95, 1.0), 1.2)
	# the raised front desk with its glass screen, the precinct badge on the wall behind
	v.box(Vector3(10.0, 1.25, 1.0), Vector3(0, 0.625, -7.0), wood, true)
	v.box(Vector3(10.2, 0.08, 1.2), Vector3(0, 1.29, -7.0), dark)
	v.box(Vector3(10.0, 0.7, 0.02), Vector3(0, 1.68, -6.5), v.flat(Color(0.6, 0.75, 0.85, 0.25), 0.05))
	v.box(Vector3(10.0, 0.4, 0.02), Vector3(0, 0.4, -6.49), v.flat(navy.lightened(0.15), 0.5))
	v.box(Vector3(10.0, 0.4, 3.0), Vector3(0, 0.2, -9.0), dark)    # the riser behind the desk
	for i in 3:
		monitor(v, Vector3(-3.0 + i * 3.0, 1.33, -7.2), PI, Color(0.3, 0.55, 1.0))
		v.person(Vector3(-3.0 + i * 3.0, 0.4, -8.2), 0.0, 0, navy)
	var badge: MeshInstance3D = v.cyl(1.0, 0.08, Vector3(0, 3.0, -23.9), v.emissive(Color(0.85, 0.7, 0.25), 1.0), false, -1.0, 6)
	badge.rotation.x = PI * 0.5
	v.text("NXPD", Vector3(0, 3.0, -23.8), 0.0, Color(0.08, 0.12, 0.3), 120, 0.01)
	v.text("FIRST PRECINCT · TO PROTECT AND SERVE", Vector3(0, 1.75, -23.82), 0.0, Color(0.85, 0.88, 1.0), 48, 0.008)
	for sx: float in [-2.2, 2.2]:
		v.cyl(0.03, 2.6, Vector3(sx, 1.3, -23.4), v.flat(Color(0.8, 0.65, 0.3), 0.3, 0.9))
		v.box(Vector3(0.9, 0.6, 0.02), Vector3(sx + 0.47, 2.25, -23.4), v.flat(Color(0.1, 0.2, 0.55) if sx < 0 else Color(0.85, 0.85, 0.9), 0.8))
	# the bullpen: six desks with monitors, chairs, files; the case board
	for i in 3:
		for j in 2:
			var p := Vector3(5.5 + j * 4.0, 0, -11.5 - i * 3.6)
			table(v, p, Vector3(1.6, 0.74, 0.8), wood, steel)
			monitor(v, p + Vector3(0, 0.76, -0.2), 0.0, Color(0.3, 0.6, 1.0))
			v.box(Vector3(0.45, 0.02, 0.15), p + Vector3(0, 0.76, 0.12), dark)
			chair(v, p + Vector3(0, 0, 0.75), PI, dark, steel)
			if (i + j) % 2 == 0:
				v.person(p + Vector3(0, 0, 0.75), PI, 3, navy, false)
	for k in 4:
		v.box(Vector3(0.5, 1.35, 0.6), Vector3(14.4, 0.675, -9.0 - k * 0.55), steel, true)
		for d in 3:
			v.box(Vector3(0.02, 0.02, 0.18), Vector3(14.14, 0.3 + d * 0.42, -9.0 - k * 0.55), dark)
	v.box(Vector3(0.05, 1.6, 3.4), Vector3(14.82, 1.7, -19.5), v.flat(Color(0.88, 0.86, 0.8), 0.9))
	v.text("CASE BOARD", Vector3(14.78, 2.65, -19.5), -PI * 0.5, Color(0.1, 0.1, 0.12), 40, 0.006)
	for k in 9:
		var pz: float = -18.2 - (k % 3) * 1.0 + v.rng.randf_range(-0.2, 0.2)
		var py := 1.2 + (k / 3) * 0.45
		v.box(Vector3(0.01, 0.28, 0.2), Vector3(14.79, py, pz), v.flat(Color(0.95, 0.92, 0.8), 0.9))
		v.box(Vector3(0.012, 0.04, 0.04), Vector3(14.78, py + 0.12, pz), v.flat(Color(0.85, 0.1, 0.1), 0.5))
	# holding cells at the back left: bars, a bench in each, one occupied
	for c in 3:
		var x0 := -14.8 + c * 3.4
		for b in 12:
			v.cyl(0.02, 3.0, Vector3(x0 + 0.15 + b * 0.27, 1.5, -18.0), steel, false, -1.0, 6)
		v.box(Vector3(3.3, 0.08, 0.08), Vector3(x0 + 1.65, 3.0, -18.0), steel)
		v.box(Vector3(3.3, 0.08, 0.08), Vector3(x0 + 1.65, 1.1, -18.0), steel)
		v.block(Vector3(3.3, 3.0, 0.2), Vector3(x0 + 1.65, 1.5, -18.0))
		v.box(Vector3(0.12, 3.0, 5.6), Vector3(x0 + 3.36, 1.5, -21.0), v.flat(Color(0.5, 0.52, 0.5), 0.8), true)
		v.box(Vector3(2.4, 0.08, 0.6), Vector3(x0 + 1.6, 0.45, -23.4), steel)
		v.box(Vector3(0.6, 0.5, 0.5), Vector3(x0 + 0.5, 0.25, -21.5), steel)
		v.text("HOLDING %d" % (c + 1), Vector3(x0 + 1.65, 3.3, -17.9), 0.0, Color(1.0, 0.85, 0.3), 40, 0.006)
	v.person(Vector3(-11.4 + 1.6, 0.0, -23.0), 0.0, 3, Color(0.45, 0.35, 0.25), false)
	# benches by the door, a water cooler, the wanted wall
	for sx: float in [-9.0, -5.0]:
		v.box(Vector3(2.6, 0.08, 0.5), Vector3(sx, 0.48, -1.2), wood, true)
		v.box(Vector3(2.6, 0.5, 0.06), Vector3(sx, 0.8, -0.95), wood)
	v.cyl(0.18, 1.1, Vector3(-14.2, 0.55, -3.0), v.flat(Color(0.85, 0.87, 0.9), 0.4), true)
	v.cyl(0.15, 0.4, Vector3(-14.2, 1.3, -3.0), v.flat(Color(0.4, 0.6, 0.9, 0.6), 0.1))
	for k in 5:
		v.box(Vector3(0.02, 0.5, 0.38), Vector3(-14.83, 1.7, -6.0 - k * 0.6), v.flat(Color(0.92, 0.88, 0.78), 0.9))
	v.text("WANTED", Vector3(-14.8, 2.15, -7.2), PI * 0.5, Color(0.6, 0.1, 0.1), 40, 0.006)
	plant(v, Vector3(4.5, 0, -1.2))
	v.spot("desk", "FRONT DESK", Vector3(0, 0, -5.8), "Desk sergeant: \"Reporting a crime? Take a number and fill this in.\"", 2.4)

# --------------------------------------------------------------------------------------------- fire station
static func _fire(v) -> void:
	var red: Material = v.flat(Color(0.72, 0.05, 0.04), 0.35, 0.3)
	var chrome: Material = v.flat(Color(0.85, 0.86, 0.88), 0.15, 1.0)
	var black: Material = v.flat(Color(0.06, 0.06, 0.07), 0.6)
	var tan := Color(0.6, 0.5, 0.28)
	# high-bay lamps over the apparatus floor
	for i in 3:
		for j in 2:
			var p := Vector3(-8.0 + i * 8.0, 7.2, -7.0 - j * 11.0)
			v.cyl(0.45, 0.35, p, v.flat(Color(0.2, 0.2, 0.22), 0.4, 0.7), false, 0.15)
			v.cyl(0.4, 0.02, p - Vector3(0, 0.18, 0), v.emissive(Color(1.0, 0.95, 0.85), 3.0))
			v.lamp(p - Vector3(0, 0.8, 0), Color(1.0, 0.95, 0.85), 1.8, 14.0)
	# the engine and the rescue truck in their bays, noses to the street
	_fire_engine(v, Vector3(-5.0, 0, -12.0), red, chrome, black, 9.5)
	_fire_engine(v, Vector3(5.5, 0, -11.0), red, chrome, black, 7.2)
	# bay lines and the apparatus bay doors at the back (the trucks roll out the back onto the yard)
	for x: float in [-9.0, -1.0, 1.5, 9.5]:
		v.box(Vector3(0.12, 0.01, 18.0), Vector3(x, 0.006, -13.0), v.flat(Color(0.95, 0.85, 0.1), 0.6))
	for x: float in [-5.0, 5.5]:
		v.box(Vector3(5.2, 5.6, 0.12), Vector3(x, 2.8, -25.8), v.flat(Color(0.75, 0.77, 0.78), 0.4, 0.5))
		for r in 14:
			v.box(Vector3(5.2, 0.04, 0.05), Vector3(x, 0.3 + r * 0.38, -25.72), v.flat(Color(0.55, 0.57, 0.6), 0.4, 0.6))
		v.box(Vector3(5.6, 0.3, 0.3), Vector3(x, 5.75, -25.7), red)
		for sx: float in [-2.75, 2.75]:
			v.box(Vector3(0.25, 5.6, 0.25), Vector3(x + sx, 2.8, -25.7), red)
	v.text("FIRE STATION 9", Vector3(0, 6.6, -25.6), 0.0, Color(0.95, 0.85, 0.6), 110, 0.012)
	# turnout gear down the right wall: open lockers with coats, helmets and boots
	for k in 8:
		var z := -4.0 - k * 1.1
		var x := 14.5
		v.box(Vector3(0.9, 2.2, 1.0), Vector3(x, 1.1, z), v.flat(Color(0.25, 0.27, 0.3), 0.5, 0.6), true)
		v.box(Vector3(0.5, 0.95, 0.75), Vector3(x - 0.2, 1.35, z), v.flat(tan, 0.85))
		v.box(Vector3(0.52, 0.06, 0.77), Vector3(x - 0.2, 1.1, z), v.emissive(Color(0.95, 0.95, 0.3), 0.6))
		v.cyl(0.18, 0.18, Vector3(x - 0.2, 2.0, z), v.flat(Color(0.12, 0.12, 0.12) if k % 3 else Color(0.85, 0.75, 0.2), 0.4), false, 0.16)
		v.box(Vector3(0.3, 0.35, 0.5), Vector3(x - 0.25, 0.18, z), black)
	# the brass pole from the dorms above
	v.cyl(0.06, 8.0, Vector3(-12.5, 4.0, -4.0), v.flat(Color(0.85, 0.65, 0.3), 0.15, 1.0), true)
	v.cyl(0.9, 0.08, Vector3(-12.5, 7.96, -4.0), black)
	v.cyl(0.8, 0.05, Vector3(-12.5, 0.03, -4.0), v.flat(Color(0.1, 0.1, 0.1), 0.8))
	# hose rack, extinguishers, the chief's glass office in the corner
	for k in 4:
		var hose := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.28
		tm.outer_radius = 0.45
		tm.rings = 18
		tm.ring_segments = 8
		hose.mesh = tm
		hose.material_override = v.flat(Color(0.85, 0.82, 0.7), 0.8)
		hose.position = Vector3(-14.6, 1.0 + k * 0.6, -14.0)
		hose.rotation.z = PI * 0.5
		v.static_root.add_child(hose)
	for k in 3:
		v.cyl(0.09, 0.55, Vector3(-14.7, 0.6, -9.0 - k * 0.4), red)
	v.box(Vector3(5.0, 3.0, 0.08), Vector3(-12.5, 1.5, -18.0), v.flat(Color(0.6, 0.75, 0.85, 0.25), 0.05), true)
	v.box(Vector3(0.08, 3.0, 5.0), Vector3(-10.0, 1.5, -20.5), v.flat(Color(0.6, 0.75, 0.85, 0.25), 0.05), true)
	table(v, Vector3(-12.6, 0, -21.5), Vector3(1.6, 0.74, 0.8), v.pbr("wood_floor", Color(0.7, 0.55, 0.4), 1.0), chrome)
	monitor(v, Vector3(-12.6, 0.76, -21.7), 0.0, Color(1.0, 0.5, 0.2))
	v.text("CHIEF", Vector3(-12.5, 2.7, -17.95), 0.0, Color(0.95, 0.85, 0.6), 40, 0.006)
	v.person(Vector3(-2.0, 0, -5.0), 0.3, 0, tan)
	v.person(Vector3(10.0, 0, -18.0), -2.4, 2, tan)
	v.person(Vector3(9.2, 0, -5.5), 2.8, 0, Color(0.1, 0.12, 0.22))
	v.spot("pole", "THE POLE", Vector3(-12.5, 0, -4.0), "Firefighter: \"Dorms are upstairs. When the bell goes, we slide.\"", 1.6)

## a fire apparatus `length` long, nose at +z: cab, body with compartment doors, ladder, light bar, chrome, wheels
static func _fire_engine(v, pos: Vector3, red: Material, chrome: Material, black: Material, length: float) -> void:
	var holder := Node3D.new()
	holder.position = pos
	v.static_root.add_child(holder)
	var w := 2.5
	var cab_l := 2.6
	var body_l := length - cab_l
	var hz := length * 0.5
	# cab
	v.box(Vector3(w, 2.0, cab_l), Vector3(0, 1.75, hz - cab_l * 0.5), red, false, 0.0, holder)
	v.box(Vector3(w - 0.1, 0.9, 0.04), Vector3(0, 2.25, hz + 0.01), v.flat(Color(0.1, 0.12, 0.15), 0.05, 0.4), false, 0.0, holder)
	for sx: float in [-1.0, 1.0]:
		v.box(Vector3(0.04, 0.7, 1.0), Vector3(sx * (w * 0.5 + 0.01), 2.3, hz - 0.8), v.flat(Color(0.1, 0.12, 0.15), 0.05, 0.4), false, 0.0, holder)
	v.box(Vector3(w, 0.3, 0.3), Vector3(0, 0.75, hz + 0.1), chrome, false, 0.0, holder)
	v.box(Vector3(1.6, 0.6, 0.04), Vector3(0, 1.3, hz + 0.02), chrome, false, 0.0, holder)
	for sx: float in [-0.95, 0.95]:
		v.box(Vector3(0.3, 0.2, 0.04), Vector3(sx, 1.2, hz + 0.03), v.emissive(Color(1.0, 0.95, 0.8), 2.5), false, 0.0, holder)
	# the light bar
	for k in 6:
		var c := Color(1.0, 0.05, 0.05) if k % 2 == 0 else Color(1.0, 0.95, 0.9)
		v.box(Vector3(0.36, 0.14, 0.3), Vector3(-0.9 + k * 0.36, 2.83, hz - 0.4), v.emissive(c, 2.0), false, 0.0, holder)
	# body with compartment doors (chrome-ribbed roll-ups) and a white stripe
	v.box(Vector3(w, 2.1, body_l), Vector3(0, 1.8, hz - cab_l - body_l * 0.5), red, false, 0.0, holder)
	for sx: float in [-1.0, 1.0]:
		v.box(Vector3(0.02, 0.18, length), Vector3(sx * (w * 0.5 + 0.01), 1.05, 0), v.flat(Color(0.95, 0.95, 0.9), 0.5), false, 0.0, holder)
		var n := int(body_l / 1.3)
		for k in n:
			var z := hz - cab_l - 0.75 - k * 1.3
			v.box(Vector3(0.03, 1.4, 1.1), Vector3(sx * (w * 0.5 + 0.02), 1.95, z), chrome, false, 0.0, holder)
			for r in 5:
				v.box(Vector3(0.04, 0.02, 1.1), Vector3(sx * (w * 0.5 + 0.035), 1.4 + r * 0.28, z), v.flat(Color(0.55, 0.56, 0.58), 0.3, 0.9), false, 0.0, holder)
	# the ladder on the roof
	for sx: float in [-0.45, 0.45]:
		v.box(Vector3(0.08, 0.12, body_l + 1.0), Vector3(sx, 3.05, hz - cab_l - body_l * 0.5 + 0.5), chrome, false, 0.0, holder)
	var rungs := int((body_l + 1.0) / 0.35)
	for k in rungs:
		v.box(Vector3(0.9, 0.04, 0.04), Vector3(0, 3.05, hz - cab_l + 1.0 - k * 0.35), chrome, false, 0.0, holder)
	# wheels
	for wz: float in [hz - 1.2, -hz + 1.6, -hz + 0.6]:
		if length < 8.0 and wz < -hz + 1.0:
			continue
		for sx: float in [-1.0, 1.0]:
			var wh: MeshInstance3D = v.cyl(0.52, 0.4, Vector3(sx * 1.08, 0.52, wz), black, false, -1.0, 18, holder)
			wh.rotation.z = PI * 0.5
			var hub: MeshInstance3D = v.cyl(0.24, 0.42, Vector3(sx * 1.08, 0.52, wz), chrome, false, -1.0, 10, holder)
			hub.rotation.z = PI * 0.5
	v.block(Vector3(w + 0.2, 3.2, length), pos + Vector3(0, 1.6, 0))

# --------------------------------------------------------------------------------------------- hotel
static func _hotel(v) -> void:
	var gold: Material = v.flat(Color(0.85, 0.66, 0.32), 0.25, 1.0)
	var walnut: Material = v.pbr("brown_planks_03", Color(0.45, 0.3, 0.2), 2.0)
	var marble: Material = v.pbr("marble_01", Color(0.95, 0.93, 0.9), 2.0, 0.6)
	var suit := Color(0.08, 0.08, 0.1)
	# columns with gold capitals
	for sx: float in [-8.0, 8.0]:
		for z: float in [-8.0, -18.0]:
			v.cyl(0.55, 9.0, Vector3(sx, 4.5, z), marble, true, -1.0, 20)
			v.cyl(0.7, 0.3, Vector3(sx, 8.7, z), gold, false, -1.0, 20)
			v.cyl(0.7, 0.3, Vector3(sx, 0.15, z), gold, false, -1.0, 20)
	# the reception wall: walnut slats, the hotel's name in gold, the desk in front
	v.box(Vector3(14.0, 6.0, 0.3), Vector3(0, 3.0, -27.6), walnut)
	for k in 28:
		v.box(Vector3(0.12, 6.0, 0.1), Vector3(-6.75 + k * 0.5, 3.0, -27.4), v.flat(Color(0.3, 0.2, 0.13), 0.5))
	v.text("THE MERIDIAN", Vector3(0, 4.6, -27.25), 0.0, Color(1.0, 0.82, 0.45) * 1.3, 140, 0.012)
	v.box(Vector3(5.0, 0.04, 0.04), Vector3(0, 3.9, -27.25), v.emissive(Color(1.0, 0.8, 0.45), 2.0))
	if v.model(CITY + "reception.glb", 1.15, Vector3(0, 0, -24.0), 0.0) == null:
		v.box(Vector3(8.0, 1.1, 1.0), Vector3(0, 0.55, -24.0), marble, true)
	for k in 3:
		v.person(Vector3(-2.4 + k * 2.4, 0, -25.6), 0.0, 0, suit)
	v.model(CITY + "concierge.glb", 1.15, Vector3(10.5, 0, -24.0), -0.5)
	v.person(Vector3(11.4, 0, -25.3), -0.5, 0, Color(0.35, 0.05, 0.08))
	# the elevator bank on the left wall
	for k in 3:
		var z := -9.0 - k * 4.0
		v.box(Vector3(0.12, 3.2, 2.4), Vector3(-16.9, 1.6, z), v.flat(Color(0.75, 0.72, 0.68), 0.2, 1.0))
		v.box(Vector3(0.14, 0.02, 2.4), Vector3(-16.88, 1.6, z), v.flat(Color(0.2, 0.2, 0.2), 0.4))
		v.box(Vector3(0.1, 3.5, 2.8), Vector3(-16.95, 1.75, z), gold)
		v.box(Vector3(0.04, 0.3, 0.8), Vector3(-16.82, 3.75, z), v.emissive(Color(1.0, 0.65, 0.3), 1.6))
		v.text(str(7 + k * 5), Vector3(-16.78, 3.75, z), PI * 0.5, Color(0.1, 0.05, 0.0), 40, 0.006)
	v.text("ELEVATORS · FLOORS 1–48", Vector3(-16.8, 4.4, -13.0), PI * 0.5, Color(1.0, 0.85, 0.5), 48, 0.008)
	# the lounge on the right: rug, sofas, coffee tables, lamps
	v.box(Vector3(9.0, 0.02, 9.0), Vector3(11.5, 0.012, -11.0), v.pbr("quatrefoil_jacquard_fabric", Color(0.5, 0.2, 0.18), 1.2))
	for s in [[11.5, -7.5, PI], [11.5, -14.5, 0.0], [15.4, -11.0, -PI * 0.5]]:
		if v.model(CITY + "sofa.glb", 0.85, Vector3(float(s[0]), 0, float(s[1])), float(s[2])) == null:
			v.box(Vector3(2.4, 0.8, 0.9), Vector3(float(s[0]), 0.4, float(s[1])), v.pbr("velour_velvet", Color(0.2, 0.25, 0.4), 1.0), true)
	table(v, Vector3(11.5, 0, -11.0), Vector3(2.0, 0.42, 1.0), marble, gold)
	for s: Vector3 in [Vector3(15.6, 0, -7.0), Vector3(15.6, 0, -15.0)]:
		v.cyl(0.25, 0.6, s + Vector3(0, 0.3, 0), walnut, true)
		v.cyl(0.04, 0.6, s + Vector3(0, 0.9, 0), gold)
		v.cyl(0.25, 0.35, s + Vector3(0, 1.3, 0), v.emissive(Color(1.0, 0.85, 0.6), 1.2), false, 0.18)
	# chandeliers: tiered rings of lit crystals
	for z: float in [-8.0, -18.0]:
		var c := Vector3(0, 7.2, z)
		v.cyl(0.04, 1.8, c + Vector3(0, 0.9, 0), gold)
		for tier in 3:
			var r := 1.6 - tier * 0.45
			var n := 18 - tier * 5
			for k in n:
				var a := TAU * k / n
				v.box(Vector3(0.08, 0.32, 0.08), c + Vector3(cos(a) * r, -tier * 0.38, sin(a) * r), v.emissive(Color(1.0, 0.9, 0.7), 2.4))
			var ring := MeshInstance3D.new()
			var tm := TorusMesh.new()
			tm.inner_radius = r - 0.03
			tm.outer_radius = r + 0.03
			tm.rings = 32
			tm.ring_segments = 4
			ring.mesh = tm
			ring.material_override = gold
			ring.position = c + Vector3(0, -tier * 0.38 + 0.18, 0)
			v.static_root.add_child(ring)
		v.lamp(c - Vector3(0, 1.4, 0), Color(1.0, 0.85, 0.6), 2.2, 16.0)
	# planters, a brass luggage cart, guests
	for p: Vector3 in [Vector3(-4.0, 0, -2.0), Vector3(4.0, 0, -2.0), Vector3(-14.5, 0, -25.0), Vector3(16.0, 0, -25.0)]:
		plant(v, p, 1.8)
	var cart := Vector3(-5.0, 0, -6.0)
	v.box(Vector3(1.0, 0.08, 1.6), cart + Vector3(0, 0.3, 0), v.pbr("velour_velvet", Color(0.5, 0.08, 0.1), 1.0))
	for sx: float in [-0.48, 0.48]:
		v.cyl(0.03, 1.6, cart + Vector3(sx, 1.1, -0.75), gold)
	var arch := MeshInstance3D.new()
	var am := TorusMesh.new()
	am.inner_radius = 0.46
	am.outer_radius = 0.52
	am.rings = 18
	am.ring_segments = 4
	arch.mesh = am
	arch.material_override = gold
	arch.position = cart + Vector3(0, 1.9, -0.75)
	arch.rotation.x = PI * 0.5
	v.static_root.add_child(arch)
	v.box(Vector3(0.55, 0.7, 0.3), cart + Vector3(-0.1, 0.7, 0.2), v.flat(Color(0.12, 0.12, 0.14), 0.5))
	v.box(Vector3(0.45, 0.5, 0.25), cart + Vector3(0.15, 0.6, -0.3), v.flat(Color(0.5, 0.3, 0.15), 0.6))
	v.block(Vector3(1.1, 2.0, 1.7), cart + Vector3(0, 1.0, 0))
	for s in [[3.5, -12.0, 0.4, 0], [5.0, -13.0, -2.4, 0], [-10.0, -20.0, 1.2, 0]]:
		v.person(Vector3(float(s[0]), 0, float(s[1])), float(s[2]), int(s[3]), Color(v.rng.randf() * 0.5, v.rng.randf() * 0.4, v.rng.randf() * 0.5))
	v.spot("desk", "RECEPTION", Vector3(0, 0, -22.4), "Receptionist: \"Welcome to The Meridian. Penthouse suites are on 48.\"", 2.6)

# --------------------------------------------------------------------------------------------- nightclub
const DANCE_FLOOR := """
shader_type spatial;
render_mode unshaded;
uniform float cells = 8.0;
void fragment() {
	vec2 g = floor(UV * cells);
	float beat = floor(TIME * 2.2);
	float h = fract(sin(dot(g + beat, vec2(12.9898, 78.233))) * 43758.5453);
	vec3 a = vec3(0.9, 0.15, 1.0);
	vec3 b = vec3(0.1, 0.85, 1.0);
	vec3 c = vec3(1.0, 0.3, 0.5);
	vec3 col = h < 0.33 ? a : (h < 0.66 ? b : c);
	vec2 f = fract(UV * cells);
	float edge = step(0.06, f.x) * step(0.06, f.y) * step(f.x, 0.94) * step(f.y, 0.94);
	float pulse = 0.55 + 0.45 * sin(TIME * 6.0 + h * 6.28);
	ALBEDO = col * edge * pulse * 2.2;
}
"""

const LED_WALL := """
shader_type spatial;
render_mode unshaded;
void fragment() {
	float bars = 24.0;
	float x = floor(UV.x * bars);
	float h = 0.5 + 0.45 * sin(TIME * 3.0 + x * 0.7) * sin(TIME * 1.7 + x * 0.3);
	float lit = step(1.0 - UV.y, h);
	vec3 col = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.9), UV.y);
	float gap = step(0.12, fract(UV.x * bars));
	ALBEDO = col * lit * gap * 2.0 + vec3(0.02, 0.0, 0.05);
}
"""

static func _nightclub(v) -> void:
	var black: Material = v.flat(Color(0.04, 0.04, 0.05), 0.5, 0.3)
	var leather: Material = v.pbr("leather_red_02", Color(0.35, 0.1, 0.4), 1.0)
	var chrome: Material = v.flat(Color(0.8, 0.8, 0.85), 0.15, 1.0)
	# the dance floor: one shaded plane, every tile pulsing
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(12.0, 10.0)
	floor_mi.mesh = pm
	var fm := ShaderMaterial.new()
	var fs := Shader.new()
	fs.code = DANCE_FLOOR
	fm.shader = fs
	floor_mi.material_override = fm
	floor_mi.position = Vector3(0, 0.02, -13.0)
	v.world.add_child(floor_mi)
	# the DJ riser with the decks and the LED wall behind
	v.box(Vector3(10.0, 1.0, 4.0), Vector3(0, 0.5, -23.5), black, true)
	v.box(Vector3(4.0, 1.05, 1.0), Vector3(0, 1.525, -22.6), v.flat(Color(0.1, 0.1, 0.12), 0.3, 0.6))
	for sx: float in [-1.2, 1.2]:
		v.cyl(0.32, 0.04, Vector3(sx, 2.07, -22.6), v.flat(Color(0.08, 0.08, 0.08), 0.3))
	v.box(Vector3(0.9, 0.04, 0.6), Vector3(0, 2.07, -22.6), v.emissive(Color(0.2, 0.9, 1.0), 1.0))
	v.person(Vector3(0, 1.0, -23.4), 0.0, 2, Color(0.1, 0.1, 0.12), false)
	var led := MeshInstance3D.new()
	var lm := QuadMesh.new()
	lm.size = Vector2(14.0, 5.0)
	led.mesh = lm
	var ls := ShaderMaterial.new()
	var lsh := Shader.new()
	lsh.code = LED_WALL
	ls.shader = lsh
	led.material_override = ls
	led.position = Vector3(0, 3.9, -25.8)
	v.world.add_child(led)
	v.text("PULSE", Vector3(0, 6.6, -25.7), 0.0, Color(1.0, 0.4, 1.0) * 1.8, 160, 0.012)
	# speaker stacks either side of the booth
	for sx: float in [-6.5, 6.5]:
		for k in 3:
			v.box(Vector3(1.4, 1.2, 1.1), Vector3(sx, 0.6 + k * 1.22, -24.0), black, k == 0)
			v.cyl(0.42, 0.04, Vector3(sx, 0.6 + k * 1.22, -23.43), v.flat(Color(0.12, 0.12, 0.13), 0.4, 0.5))
	# the bar down the left wall: counter, a backlit bottle wall, stools
	v.box(Vector3(1.0, 1.1, 14.0), Vector3(-11.5, 0.55, -12.0), black, true)
	v.box(Vector3(1.2, 0.06, 14.2), Vector3(-11.5, 1.13, -12.0), v.flat(Color(0.12, 0.1, 0.14), 0.1, 0.6))
	v.box(Vector3(0.02, 0.06, 14.0), Vector3(-10.98, 1.0, -12.0), v.emissive(Color(0.9, 0.2, 1.0), 3.0))
	v.box(Vector3(0.1, 3.0, 13.0), Vector3(-14.8, 2.2, -12.0), v.emissive(Color(0.95, 0.55, 0.25), 0.8))
	for shelf in 4:
		v.box(Vector3(0.35, 0.03, 13.0), Vector3(-14.6, 1.0 + shelf * 0.7, -12.0), v.flat(Color(0.7, 0.7, 0.75, 0.6), 0.05))
		for b in 26:
			var bc: Color = [Color(0.2, 0.5, 0.2, 0.8), Color(0.55, 0.3, 0.1, 0.8), Color(0.8, 0.8, 0.85, 0.6), Color(0.4, 0.1, 0.4, 0.8)][(b + shelf) % 4]
			v.cyl(0.04, 0.3, Vector3(-14.6, 1.17 + shelf * 0.7, -18.2 + b * 0.48), v.flat(bc, 0.05), false, 0.02, 8)
	for k in 8:
		var p := Vector3(-10.4, 0, -6.5 - k * 1.6)
		v.cyl(0.2, 0.06, p + Vector3(0, 0.78, 0), leather)
		v.cyl(0.03, 0.75, p + Vector3(0, 0.4, 0), chrome)
		v.cyl(0.22, 0.03, p + Vector3(0, 0.02, 0), chrome)
	v.person(Vector3(-12.6, 0, -10.0), PI * 0.5, 0, Color(0.05, 0.05, 0.06))
	# VIP booths on the right, behind a rope
	for k in 3:
		var z := -7.0 - k * 5.0
		v.box(Vector3(0.7, 1.1, 3.6), Vector3(14.3, 0.55, z), leather, true)
		v.box(Vector3(2.6, 1.1, 0.7), Vector3(13.0, 0.55, z - 1.45), leather, true)
		v.box(Vector3(2.6, 1.1, 0.7), Vector3(13.0, 0.55, z + 1.45), leather, true)
		table(v, Vector3(12.6, 0, z), Vector3(1.2, 0.5, 1.6), v.flat(Color(0.1, 0.1, 0.12), 0.1, 0.5), chrome, true)
		v.cyl(0.12, 0.3, Vector3(12.6, 0.68, z), v.emissive(Color(0.3, 0.9, 1.0), 1.5), false, 0.1)
		v.person(Vector3(13.8, 0.0, z + 0.6), -PI * 0.5, 3, Color(0.3, 0.05, 0.25), false)
	for k in 5:
		v.cyl(0.04, 1.0, Vector3(10.0, 0.5, -4.5 - k * 3.6), chrome, true)
		v.cyl(0.08, 0.08, Vector3(10.0, 1.04, -4.5 - k * 3.6), chrome)
		if k < 4:
			v.box(Vector3(0.05, 0.05, 3.6), Vector3(10.0, 0.85, -6.3 - k * 3.6), v.pbr("velour_velvet", Color(0.6, 0.05, 0.1), 0.5))
	v.text("VIP", Vector3(14.8, 3.2, -12.0), -PI * 0.5, Color(1.0, 0.8, 0.3) * 1.6, 120, 0.012)
	# the crowd on the floor
	for k in 18:
		var p: Vector3 = Vector3(v.rng.randf_range(-5.2, 5.2), 0, v.rng.randf_range(-17.5, -8.5))
		v.person(p, v.rng.randf() * TAU, 1 + k % 2, Color.from_hsv(v.rng.randf(), 0.6, 0.35), false)
	# moving light: beams sweeping from the truss, coloured lamps changing with the beat
	var truss: Material = v.flat(Color(0.3, 0.3, 0.32), 0.3, 0.8)
	v.box(Vector3(12.0, 0.3, 0.3), Vector3(0, 6.5, -8.0), truss)
	v.box(Vector3(12.0, 0.3, 0.3), Vector3(0, 6.5, -18.0), truss)
	var beams: Array[Node3D] = []
	var cols := [Color(1.0, 0.2, 1.0), Color(0.2, 0.9, 1.0), Color(1.0, 0.3, 0.4), Color(0.4, 0.3, 1.0)]
	for k in 8:
		var head := Node3D.new()
		head.position = Vector3(-5.0 + (k % 4) * 3.3, 6.3, -8.0 if k < 4 else -18.0)
		v.world.add_child(head)
		var beam := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.04
		cm.bottom_radius = 0.6
		cm.height = 7.0
		cm.radial_segments = 10
		cm.rings = 1
		beam.mesh = cm
		var bm := StandardMaterial3D.new()
		bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		bm.cull_mode = BaseMaterial3D.CULL_DISABLED
		var bc: Color = cols[k % 4]
		bm.albedo_color = Color(bc.r, bc.g, bc.b, 0.16)
		beam.material_override = bm
		beam.position = Vector3(0, -3.5, 0)
		head.add_child(beam)
		v.box(Vector3(0.35, 0.35, 0.35), Vector3.ZERO, black, false, 0.0, head)
		beams.append(head)
	var washes: Array[OmniLight3D] = []
	for k in 4:
		washes.append(v.lamp(Vector3(-4.5 + k * 3.0, 4.5, -13.0), cols[k], 2.4, 10.0))
	v.lamp(Vector3(-12.5, 3.0, -12.0), Color(0.95, 0.55, 0.25), 1.4, 8.0)
	v.lamp(Vector3(12.5, 3.0, -12.0), Color(0.9, 0.2, 1.0), 1.4, 9.0)
	v.animate(func(t: float, _dt: float) -> void:
		for i in beams.size():
			var b := beams[i]
			b.rotation.x = sin(t * 1.3 + i * 0.8) * 0.6
			b.rotation.z = cos(t * 0.9 + i * 1.3) * 0.6
		var beat := int(t * 2.2)
		for i in washes.size():
			washes[i].light_color = cols[(beat + i) % cols.size()]
			washes[i].light_energy = 1.6 + 1.2 * absf(sin(t * 4.4 + i))
	)
	v.spot("bar", "BAR", Vector3(-10.2, 0, -12.0), "Bartender: \"What are you having? First round's on the house tonight.\"", 1.8)

# --------------------------------------------------------------------------------------------- restaurant
static func _restaurant(v) -> void:
	var walnut: Material = v.pbr("brown_planks_03", Color(0.5, 0.33, 0.22), 1.5)
	var cloth: Material = v.flat(Color(0.95, 0.94, 0.9), 0.85)
	var brass: Material = v.flat(Color(0.8, 0.6, 0.3), 0.25, 1.0)
	var steel: Material = v.flat(Color(0.75, 0.77, 0.78), 0.25, 0.9)
	var red_leather: Material = v.pbr("leather_red_02", Color(0.55, 0.1, 0.08), 1.0)
	# brick feature wall on the left, the dining room in the middle under pendant lamps
	v.box(Vector3(0.2, 4.5, 22.0), Vector3(-12.85, 2.25, -11.0), v.pbr("brick_4", Color(0.85, 0.6, 0.5), 2.0))
	for i in 3:
		for j in 3:
			var p := Vector3(-6.5 + i * 4.2, 0, -5.0 - j * 3.6)
			table(v, p, Vector3(1.1, 0.75, 1.1), cloth, walnut, true)
			v.cyl(0.04, 0.08, p + Vector3(0, 0.83, 0), v.emissive(Color(1.0, 0.7, 0.3), 2.5), false, -1.0, 8)
			for a: float in [0.0, PI * 0.5, PI, PI * 1.5]:
				chair(v, p + Vector3(sin(a) * 0.85, 0, cos(a) * 0.85), a + PI, walnut, walnut)
			# a pendant over each table
			v.cyl(0.01, 2.2, p + Vector3(0, 3.4, 0), v.flat(Color(0.1, 0.1, 0.1), 0.5))
			v.cyl(0.08, 0.35, p + Vector3(0, 2.15, 0), brass, false, 0.3, 16)
			v.cyl(0.07, 0.04, p + Vector3(0, 1.97, 0), v.emissive(Color(1.0, 0.8, 0.5), 3.0), false, -1.0, 12)
			if (i + j) % 2 == 0:
				v.lamp(p + Vector3(0, 1.8, 0), Color(1.0, 0.75, 0.45), 1.2, 6.0)
			if (i * 3 + j) % 3 != 1:
				v.person(p + Vector3(0, 0, 0.85), PI, 3, Color.from_hsv(v.rng.randf(), 0.4, 0.4), false)
				v.person(p + Vector3(0, 0, -0.85), 0.0, 3, Color.from_hsv(v.rng.randf(), 0.4, 0.4), false)
	# red leather booths down the right wall
	for k in 4:
		var z := -4.0 - k * 3.4
		v.box(Vector3(0.6, 1.2, 2.6), Vector3(12.6, 0.6, z), red_leather, true)
		v.box(Vector3(1.8, 0.5, 0.6), Vector3(11.6, 0.25, z - 1.0), red_leather, true)
		v.box(Vector3(1.8, 0.5, 0.6), Vector3(11.6, 0.25, z + 1.0), red_leather, true)
		v.box(Vector3(1.8, 0.7, 0.12), Vector3(11.6, 0.85, z - 1.27), red_leather)
		v.box(Vector3(1.8, 0.7, 0.12), Vector3(11.6, 0.85, z + 1.27), red_leather)
		table(v, Vector3(11.5, 0, z), Vector3(1.4, 0.75, 0.9), walnut, brass)
		v.cyl(0.18, 0.3, Vector3(12.85, 2.1, z), v.emissive(Color(1.0, 0.75, 0.45), 1.6), false, 0.12)
	# the bar by the door with stools, bottles and a brass foot rail
	v.box(Vector3(6.0, 1.1, 0.8), Vector3(-8.0, 0.55, -18.0), walnut, true)
	v.box(Vector3(6.2, 0.05, 1.0), Vector3(-8.0, 1.12, -18.0), v.pbr("marble_01", Color(0.2, 0.2, 0.22), 1.0, 0.4))
	v.cyl(0.03, 6.0, Vector3(-8.0, 0.2, -17.45), brass).rotation.z = PI * 0.5
	for k in 5:
		var p := Vector3(-10.4 + k * 1.2, 0, -16.9)
		v.cyl(0.2, 0.06, p + Vector3(0, 0.78, 0), red_leather)
		v.cyl(0.03, 0.75, p + Vector3(0, 0.4, 0), brass)
	v.box(Vector3(6.0, 2.0, 0.3), Vector3(-8.0, 2.0, -21.2), walnut)
	for shelf in 3:
		v.box(Vector3(5.6, 0.03, 0.3), Vector3(-8.0, 1.5 + shelf * 0.5, -21.0), v.flat(Color(0.8, 0.8, 0.85, 0.5), 0.05))
		for b in 14:
			v.cyl(0.04, 0.28, Vector3(-10.6 + b * 0.4, 1.66 + shelf * 0.5, -20.95), v.flat([Color(0.2, 0.45, 0.2, 0.8), Color(0.5, 0.25, 0.08, 0.85), Color(0.75, 0.75, 0.8, 0.6)][(b + shelf) % 3], 0.05), false, 0.02, 8)
	v.person(Vector3(-8.0, 0, -19.6), 0.0, 0, Color(0.06, 0.06, 0.07))
	# the open kitchen at the back: steel pass with heat lamps, ranges, hood, chefs in whites
	v.box(Vector3(10.0, 1.05, 0.7), Vector3(4.0, 0.525, -17.5), steel, true)
	v.box(Vector3(10.2, 0.05, 0.9), Vector3(4.0, 1.08, -17.5), steel)
	for k in 5:
		v.box(Vector3(1.2, 0.08, 0.3), Vector3(0.0 + k * 2.0, 2.0, -17.5), v.emissive(Color(1.0, 0.45, 0.15), 2.2))
		v.cyl(0.015, 0.9, Vector3(0.0 + k * 2.0, 2.5, -17.5), steel)
	for k in 3:
		v.box(Vector3(2.2, 0.95, 0.9), Vector3(0.5 + k * 3.0, 0.475, -21.3), v.flat(Color(0.2, 0.2, 0.22), 0.3, 0.8), true)
		for b in 4:
			v.cyl(0.18, 0.02, Vector3(0.0 + k * 3.0 + (b % 2) * 1.0, 0.96, -21.1 - (b / 2) * 0.45), v.emissive(Color(1.0, 0.35, 0.1), 0.6))
	v.box(Vector3(10.0, 0.8, 1.4), Vector3(4.0, 3.8, -21.2), steel)
	v.lamp(Vector3(4.0, 2.6, -19.5), Color(1.0, 0.85, 0.7), 1.6, 8.0)
	for k in 3:
		v.person(Vector3(1.0 + k * 3.0, 0, -19.6), PI if k != 1 else 0.0, 0, Color(0.95, 0.95, 0.93))
	wall_sign(v, "OSTERIA LUNA · CUCINA", Vector3(4.0, 3.1, -21.95), 0.0, Color(1.0, 0.75, 0.4), 5.0, 56)
	# a chalkboard menu, a host stand and plants at the door
	v.box(Vector3(0.06, 1.6, 1.2), Vector3(-12.7, 1.8, -3.0), v.flat(Color(0.12, 0.14, 0.12), 0.95))
	v.text("TONIGHT\nCacio e pepe 18\nOssobuco 34\nTiramisù 11", Vector3(-12.65, 1.85, -3.0), PI * 0.5, Color(0.95, 0.95, 0.9), 36, 0.005)
	v.box(Vector3(0.7, 1.15, 0.5), Vector3(3.2, 0.575, -2.0), walnut, true)
	v.person(Vector3(3.2, 0, -2.7), 0.0, 0, Color(0.06, 0.06, 0.08))
	plant(v, Vector3(-3.5, 0, -1.3), 1.6)
	plant(v, Vector3(12.2, 0, -1.3), 1.6)
	v.spot("host", "HOST STAND", Vector3(3.2, 0, -1.2), "Host: \"Table for one? Right this way — the ossobuco is excellent tonight.\"", 1.6)

# --------------------------------------------------------------------------------------------- school
static func _school(v) -> void:
	var steel: Material = v.flat(Color(0.55, 0.57, 0.6), 0.35, 0.7)
	var desk_top: Material = v.pbr("wood_floor", Color(0.85, 0.75, 0.6), 1.0)
	var blue := Color(0.15, 0.35, 0.7)
	v.ceiling_panels(4, 3, Vector2(1.2, 1.2), Color(1.0, 0.98, 0.92), 1.0)
	# the hallway on the left: a wall of lockers and a trophy case; the classroom behind a half-glass partition
	for k in 18:
		var z := -2.5 - k * 0.6
		var lc := blue if k % 2 == 0 else blue.lightened(0.12)
		v.box(Vector3(0.5, 1.9, 0.58), Vector3(-13.7, 0.95, z), v.flat(lc, 0.45, 0.5))
		for s in 3:
			v.box(Vector3(0.02, 0.02, 0.3), Vector3(-13.44, 1.55 + s * 0.05, z), v.flat(lc.darkened(0.4), 0.5))
		v.box(Vector3(0.03, 0.12, 0.04), Vector3(-13.44, 1.0, z + 0.2), steel)
	v.block(Vector3(0.6, 1.9, 11.0), Vector3(-13.7, 0.95, -7.6))
	v.box(Vector3(0.6, 2.2, 3.0), Vector3(-13.6, 1.1, -16.0), v.pbr("brown_planks_03", Color(0.55, 0.38, 0.25), 1.0), true)
	v.box(Vector3(0.62, 1.2, 2.8), Vector3(-13.6, 1.4, -16.0), v.flat(Color(0.7, 0.8, 0.9, 0.3), 0.05))
	for k in 4:
		v.cyl(0.08, 0.25, Vector3(-13.6, 1.0 + (k % 2) * 0.55, -16.9 + k * 0.6), v.flat(Color(0.85, 0.66, 0.25), 0.2, 1.0), false, 0.12, 10)
	v.text("NEXUS ACADEMY · STATE CHAMPIONS", Vector3(-13.25, 2.45, -16.0), PI * 0.5, Color(0.2, 0.35, 0.7), 40, 0.006)
	# the partition: half wall with glass above, a door gap at the front
	v.box(Vector3(0.2, 1.1, 18.0), Vector3(-5.0, 0.55, -15.0), v.flat(Color(0.86, 0.84, 0.76), 0.8), true)
	v.box(Vector3(0.06, 2.5, 18.0), Vector3(-5.0, 2.35, -15.0), v.flat(Color(0.7, 0.82, 0.9, 0.22), 0.05))
	v.box(Vector3(0.14, 0.1, 18.0), Vector3(-5.0, 3.62, -15.0), steel)
	# the classroom: rows of desks and chairs, students, the teacher's desk, the whiteboard
	for i in 5:
		for j in 4:
			var p := Vector3(-1.5 + i * 2.6, 0, -8.5 - j * 2.5)
			v.box(Vector3(1.1, 0.04, 0.6), p + Vector3(0, 0.74, 0), desk_top)
			v.box(Vector3(1.0, 0.25, 0.5), p + Vector3(0, 0.58, -0.02), steel)
			for sx: float in [-0.5, 0.5]:
				v.box(Vector3(0.04, 0.72, 0.04), p + Vector3(sx, 0.36, 0.22), steel)
				v.box(Vector3(0.04, 0.72, 0.04), p + Vector3(sx, 0.36, -0.22), steel)
			v.block(Vector3(1.1, 0.8, 0.6), p + Vector3(0, 0.4, 0))
			chair(v, p + Vector3(0, 0, 0.6), PI, v.flat(Color(0.2, 0.45, 0.8), 0.6), steel)
			if (i + j * 2) % 3 != 0:
				v.person(p + Vector3(0, 0, 0.6), PI, 3, Color.from_hsv(v.rng.randf(), 0.5, 0.55), false)
			v.box(Vector3(0.3, 0.02, 0.22), p + Vector3(0.2, 0.77, 0.05), v.flat(Color(0.95, 0.95, 0.92), 0.9))
	table(v, Vector3(4.0, 0, -20.0), Vector3(2.0, 0.76, 0.9), v.pbr("brown_planks_03", Color(0.55, 0.38, 0.25), 1.0), steel)
	monitor(v, Vector3(4.6, 0.78, -20.2), 0.0, Color(0.6, 0.8, 1.0))
	v.person(Vector3(1.6, 0, -21.0), 0.3, 2, Color(0.35, 0.3, 0.25))
	v.box(Vector3(9.0, 2.0, 0.06), Vector3(4.0, 2.0, -23.85), v.flat(Color(0.97, 0.97, 0.97), 0.25))
	v.box(Vector3(9.2, 2.2, 0.04), Vector3(4.0, 2.0, -23.88), steel)
	v.box(Vector3(9.0, 0.06, 0.15), Vector3(4.0, 0.95, -23.78), steel)
	v.text("PHYSICS — FORCES & MOTION\nF = m·a      p = m·v\nHomework: ch. 4, problems 1–12", Vector3(4.0, 2.2, -23.8), 0.0, Color(0.1, 0.2, 0.55), 56, 0.006)
	v.box(Vector3(0.6, 0.6, 0.06), Vector3(10.5, 3.3, -23.85), v.flat(Color(0.95, 0.95, 0.95), 0.4))
	v.text("12:40", Vector3(10.5, 3.3, -23.8), 0.0, Color(0.1, 0.1, 0.1), 40, 0.006)
	# bookshelves and posters on the right wall, a flag in the corner
	for k in 3:
		var z := -9.0 - k * 4.0
		v.box(Vector3(0.4, 2.0, 2.2), Vector3(13.7, 1.0, z), v.pbr("brown_planks_03", Color(0.55, 0.38, 0.25), 1.0), true)
		for s in 4:
			for b in 9:
				v.box(Vector3(0.28, 0.32, 0.12), Vector3(13.6, 0.3 + s * 0.48, z - 0.9 + b * 0.22), v.flat(Color.from_hsv(v.rng.randf(), 0.5, 0.5), 0.8))
	for k in 3:
		v.box(Vector3(0.02, 0.9, 0.7), Vector3(13.88, 2.6, -2.5 - k * 1.4), v.flat(Color.from_hsv(0.55 + k * 0.1, 0.5, 0.8), 0.8))
	v.cyl(0.03, 2.4, Vector3(12.5, 1.2, -22.5), v.flat(Color(0.85, 0.66, 0.25), 0.2, 1.0))
	v.box(Vector3(0.9, 0.6, 0.02), Vector3(12.97, 2.1, -22.5), v.flat(blue, 0.8))
	v.spot("board", "WHITEBOARD", Vector3(4.0, 0, -22.0), "Teacher: \"Late again? Take a seat — we're on chapter four.\"", 1.8)

# --------------------------------------------------------------------------------------------- office
static func _office(v) -> void:
	var white: Material = v.flat(Color(0.93, 0.93, 0.94), 0.4)
	var oak: Material = v.pbr("wood_floor", Color(0.85, 0.75, 0.62), 1.0)
	var steel: Material = v.flat(Color(0.6, 0.62, 0.65), 0.3, 0.8)
	var mesh_chair: Material = v.flat(Color(0.1, 0.1, 0.12), 0.7)
	var glass: Material = v.flat(Color(0.65, 0.8, 0.9, 0.18), 0.05)
	v.ceiling_panels(5, 4, Vector2(1.2, 1.2), Color(0.95, 0.97, 1.0), 1.0)
	# the reception: the company's name lit on a slatted wall, a white desk
	v.box(Vector3(0.2, 3.4, 6.0), Vector3(15.8, 1.7, -4.0), oak)
	v.text("VANTA SYSTEMS", Vector3(15.68, 2.5, -4.0), -PI * 0.5, Color(0.2, 0.9, 1.0) * 1.6, 110, 0.01)
	v.box(Vector3(0.02, 0.04, 4.0), Vector3(15.68, 1.95, -4.0), v.emissive(Color(0.2, 0.9, 1.0), 2.5))
	v.box(Vector3(1.0, 1.1, 3.2), Vector3(12.8, 0.55, -4.0), white, true)
	v.box(Vector3(1.1, 0.04, 3.3), Vector3(12.8, 1.12, -4.0), v.pbr("marble_01", Color(0.95, 0.95, 0.96), 1.0))
	monitor(v, Vector3(13.1, 1.14, -4.0), PI * 0.5, Color(0.5, 0.8, 1.0))
	v.person(Vector3(13.9, 0, -4.0), -PI * 0.5, 0, Color(0.2, 0.22, 0.28))
	# the window wall at the back: the night skyline through floor-to-ceiling glass
	v.box(Vector3(31.0, 3.8, 0.05), Vector3(0, 2.0, -25.6), v.emissive(Color(0.04, 0.05, 0.12), 1.0))
	for k in 70:
		var bx: float = v.rng.randf_range(-15.0, 15.0)
		var bw: float = v.rng.randf_range(0.6, 2.2)
		var bh: float = v.rng.randf_range(0.6, 3.2)
		v.box(Vector3(bw, bh, 0.02), Vector3(bx, 0.3 + bh * 0.5, -25.55), v.flat(Color(0.05, 0.06, 0.09), 0.9))
		for wdw in int(bh * 3.0):
			if v.rng.randf() < 0.55:
				v.box(Vector3(0.08, 0.06, 0.01), Vector3(bx + v.rng.randf_range(-bw * 0.4, bw * 0.4), 0.4 + v.rng.randf() * bh, -25.53), v.emissive(Color(1.0, 0.85, 0.55) if v.rng.randf() < 0.7 else Color(0.5, 0.8, 1.0), 2.0))
	for k in 9:
		v.box(Vector3(0.1, 3.9, 0.12), Vector3(-15.0 + k * 3.75, 2.0, -25.45), steel)
	# open-plan pods: four desks a pod, monitors, task chairs, people at work
	for i in 3:
		for j in 2:
			var c := Vector3(-8.0 + i * 7.0, 0, -9.0 - j * 7.0)
			v.box(Vector3(3.2, 0.04, 2.8), c + Vector3(0, 0.74, 0), white)
			v.box(Vector3(3.2, 0.4, 0.04), c + Vector3(0, 0.96, 0), v.flat(Color(0.3, 0.35, 0.4), 0.9))
			for lx: float in [-1.55, 1.55]:
				for lz: float in [-1.35, 1.35]:
					v.box(Vector3(0.04, 0.72, 0.04), c + Vector3(lx, 0.36, lz), steel)
			v.block(Vector3(3.2, 0.8, 2.8), c + Vector3(0, 0.4, 0))
			for k in 4:
				var sx := -0.8 if k % 2 == 0 else 0.8
				var sz := -0.7 if k < 2 else 0.7
				monitor(v, c + Vector3(sx, 0.76, sz * 0.55), 0.0 if sz > 0 else PI, Color(0.3, 0.6, 1.0) if k % 2 else Color(0.85, 0.9, 1.0))
				var cp := c + Vector3(sx, 0, sz * 1.9)
				chair(v, cp, PI if sz > 0 else 0.0, mesh_chair, steel)
				if (i + j + k) % 3 != 0:
					v.person(cp, PI if sz > 0 else 0.0, 3, Color.from_hsv(v.rng.randf(), 0.25, 0.45), false)
	# the glass meeting room on the left
	v.box(Vector3(0.06, 3.0, 8.0), Vector3(-9.0, 1.5, -18.0), glass, true)
	v.box(Vector3(6.6, 3.0, 0.06), Vector3(-12.3, 1.5, -14.0), glass, true)
	v.box(Vector3(6.6, 0.06, 0.08), Vector3(-12.3, 1.6, -13.97), v.flat(Color(0.95, 0.95, 0.95, 0.6), 0.5))
	table(v, Vector3(-12.5, 0, -18.5), Vector3(3.4, 0.75, 1.4), oak, steel)
	for k in 3:
		for sz: float in [-1.0, 1.0]:
			chair(v, Vector3(-13.6 + k * 1.1, 0, -18.5 + sz * 1.05), 0.0 if sz < 0 else PI, mesh_chair, steel)
	v.box(Vector3(0.06, 1.2, 2.1), Vector3(-15.8, 1.7, -18.5), v.emissive(Color(0.3, 0.55, 0.9), 1.0))
	v.text("Q4 ROADMAP", Vector3(-15.75, 1.9, -18.5), PI * 0.5, Color(1, 1, 1), 48, 0.006)
	v.text("MEETING ROOM 12B", Vector3(-12.3, 2.7, -13.95), 0.0, Color(0.3, 0.3, 0.32), 36, 0.006)
	v.person(Vector3(-13.6, 0, -19.55), 0.0, 3, Color(0.2, 0.2, 0.25), false)
	v.person(Vector3(-11.4, 0, -17.45), PI, 3, Color(0.4, 0.2, 0.2), false)
	# kitchenette and plants
	v.box(Vector3(0.7, 0.95, 4.0), Vector3(15.6, 0.475, -18.0), white, true)
	v.box(Vector3(0.75, 0.04, 4.1), Vector3(15.6, 0.97, -18.0), v.pbr("marble_01", Color(0.2, 0.2, 0.22), 1.0))
	v.box(Vector3(0.45, 0.5, 0.4), Vector3(15.6, 1.24, -17.0), v.flat(Color(0.1, 0.1, 0.1), 0.3, 0.6))
	for p: Vector3 in [Vector3(-15.0, 0, -2.0), Vector3(8.0, 0, -2.0), Vector3(-6.0, 0, -24.5), Vector3(10.0, 0, -24.5)]:
		plant(v, p, 1.5)
	v.spot("reception", "RECEPTION", Vector3(11.6, 0, -4.0), "Receptionist: \"Vanta Systems, floor twelve. Who are you here to see?\"", 1.8)

# --------------------------------------------------------------------------------------------- underground parking
static func _parking(v) -> void:
	var concrete: Material = v.pbr("brushed_concrete", Color(0.7, 0.7, 0.68), 3.0)
	var yellow: Material = v.flat(Color(0.95, 0.75, 0.05), 0.6)
	var black: Material = v.flat(Color(0.06, 0.06, 0.06), 0.6)
	var white: Material = v.flat(Color(0.9, 0.9, 0.88), 0.7)
	var pipe: Material = v.flat(Color(0.5, 0.52, 0.55), 0.4, 0.7)
	# the column grid with hazard bands and bay codes
	for i in 4:
		for j in 3:
			var p := Vector3(-15.0 + i * 10.0, 0, -8.0 - j * 9.0)
			v.box(Vector3(0.8, 3.6, 0.8), p + Vector3(0, 1.8, 0), concrete, true)
			for b in 4:
				v.box(Vector3(0.82, 0.12, 0.82), p + Vector3(0, 0.1 + b * 0.24, 0), yellow if b % 2 == 0 else black)
			v.text("P1-%s%d" % [["A", "B", "C", "D"][i], j + 1], p + Vector3(0, 2.4, 0.42), 0.0, Color(0.95, 0.95, 0.9), 48, 0.008)
	# the drive aisle down the middle, bays either side with wheel stops; parked cars
	v.box(Vector3(0.15, 0.01, 30.0), Vector3(0, 0.006, -17.0), yellow)
	var cars := ["luxury-sedan.glb", "muscle-car.glb", "security-suv.glb", "tuner.glb", "street-racer.glb", "offroad-truck.glb", "hover-car.glb"]
	var car_k := 0
	for side: float in [-1.0, 1.0]:
		for k in 11:
			var z := -4.0 - k * 2.8
			var x := side * 13.0
			v.box(Vector3(5.6, 0.01, 0.1), Vector3(x, 0.006, z - 1.4), white)
			v.box(Vector3(0.6, 0.12, 0.15), Vector3(side * 15.2, 0.06, z), v.flat(Color(0.6, 0.6, 0.58), 0.8))
			if (k * 3 + int(side + 1.0)) % 4 != 1:
				var f: String = cars[car_k % cars.size()]
				car_k += 1
				var car: Node3D = v.model(FLEET + f, 1.45 if f != "offroad-truck.glb" else 1.9, Vector3(x, 0.0, z), -side * PI * 0.5, true)
				if car == null:
					v.box(Vector3(4.4, 1.4, 1.9), Vector3(x, 0.7, z), v.flat(Color.from_hsv(v.rng.randf(), 0.5, 0.4), 0.3, 0.6), true)
	# ceiling services: pipes, cable trays, tube lights
	for k in 3:
		var p: MeshInstance3D = v.cyl(0.12, 40.0, Vector3(-6.0 + k * 0.4, 3.3 - k * 0.05, -17.0), pipe, false, -1.0, 10)
		p.rotation.x = PI * 0.5
	var p2: MeshInstance3D = v.cyl(0.18, 40.0, Vector3(6.0, 3.25, -17.0), v.flat(Color(0.7, 0.1, 0.08), 0.5, 0.3), false, -1.0, 10)
	p2.rotation.x = PI * 0.5
	v.box(Vector3(0.5, 0.06, 34.0), Vector3(9.0, 3.35, -17.0), pipe)
	var tubes := 0
	for i in 3:
		for j in 6:
			var t := Vector3(-10.0 + i * 10.0, 3.45, -3.0 - j * 5.5)
			v.box(Vector3(0.16, 0.08, 1.4), t, v.flat(Color(0.3, 0.3, 0.32), 0.4, 0.6))
			v.box(Vector3(0.1, 0.04, 1.3), t - Vector3(0, 0.05, 0), v.emissive(Color(0.85, 0.95, 1.0), 3.0))
			if (i + j) % 2 == 0 and tubes < 10:
				v.lamp(t - Vector3(0, 0.6, 0), Color(0.85, 0.95, 1.0), 1.3, 9.0)
				tubes += 1
	# the ramp up at the back, the pay station, exit signs, puddles
	var ramp: MeshInstance3D = v.box(Vector3(6.0, 0.4, 8.0), Vector3(0, 1.0, -30.0), concrete)
	ramp.rotation.x = 0.26
	v.block(Vector3(6.0, 2.0, 8.0), Vector3(0, 1.0, -30.0))
	for sx: float in [-3.1, 3.1]:
		v.box(Vector3(0.2, 1.1, 8.0), Vector3(sx, 1.4, -30.0), yellow, true).rotation.x = 0.26
	wall_sign(v, "EXIT ↑  STREET LEVEL", Vector3(0, 3.0, -25.5), 0.0, Color(0.3, 1.0, 0.4), 3.6, 56)
	v.box(Vector3(0.7, 1.6, 0.5), Vector3(-3.0, 0.8, -1.2), v.flat(Color(0.12, 0.25, 0.6), 0.4, 0.5), true)
	v.box(Vector3(0.5, 0.35, 0.02), Vector3(-3.0, 1.25, -0.94), v.emissive(Color(0.4, 0.8, 1.0), 1.2))
	v.text("PAY HERE", Vector3(-3.0, 1.72, -0.93), 0.0, Color(1, 1, 1), 36, 0.006)
	for k in 6:
		var pud: MeshInstance3D = v.box(Vector3(v.rng.randf_range(1.0, 2.5), 0.005, v.rng.randf_range(0.8, 1.8)), Vector3(v.rng.randf_range(-4.0, 4.0), 0.012, v.rng.randf_range(-6.0, -26.0)), v.flat(Color(0.05, 0.05, 0.06, 0.85), 0.02, 0.2))
		pud.rotation.y = v.rng.randf() * PI
	v.text("P1 · LEVEL -1", Vector3(0, 3.0, -0.4), PI, Color(0.3, 0.6, 1.0), 64, 0.01)
	v.person(Vector3(-11.0, 0, -18.0), 0.6, 0, Color(0.2, 0.2, 0.25))
	v.spot("pay", "PAY STATION", Vector3(-3.0, 0, -2.2), "Pay station: \"Ticket validated. Have a good night.\"", 1.4)

# --------------------------------------------------------------------------------------------- the frontages on the avenue
## drawn into a street door holder (local -z is the facade, 2.2 m back; +x along the walk)
static func front(holder: Node3D, id: String, col: Color) -> void:
	var f := _Front.new(holder)
	var dark := f.mat(Color(0.08, 0.08, 0.1), 0.4, 0.4)
	# every front: a lit glass door set in a frame on the facade
	f.box(Vector3(2.8, 3.4, 0.25), Vector3(0, 1.7, -2.1), dark)
	f.box(Vector3(2.3, 2.9, 0.06), Vector3(0, 1.45, -1.97), f.glow(col.lerp(Color(1, 0.95, 0.85), 0.6) * 0.6, 1.0))
	f.box(Vector3(0.04, 2.9, 0.08), Vector3(0, 1.45, -1.93), dark)
	match id:
		"hospital":
			var white := f.mat(Color(0.92, 0.94, 0.95), 0.4)
			f.box(Vector3(7.0, 0.3, 3.0), Vector3(0, 3.7, -0.8), white)
			f.box(Vector3(7.0, 0.08, 0.08), Vector3(0, 3.55, 0.7), f.glow(Color(0.95, 0.2, 0.2), 2.0))
			for sx: float in [-3.2, 3.2]:
				f.cyl(0.1, 3.7, Vector3(sx, 1.85, 0.4), white)
			var red := f.glow(Color(1.0, 0.12, 0.12), 3.0)
			f.box(Vector3(1.0, 0.32, 0.12), Vector3(-2.6, 4.6, 0.8), red)
			f.box(Vector3(0.32, 1.0, 0.12), Vector3(-2.6, 4.6, 0.8), red)
			f.label("EMERGENCY", Vector3(0, 4.25, 0.75), Color(1.0, 0.25, 0.25), 72)
			f.label("NEXUS GENERAL HOSPITAL", Vector3(0, 3.7, 0.78), Color(0.1, 0.35, 0.4), 52)
		"police":
			for sx: float in [-1.8, 1.8]:
				f.cyl(0.05, 2.6, Vector3(sx, 1.3, -1.7), dark)
				f.sphere(0.28, Vector3(sx, 2.75, -1.7), f.glow(Color(0.2, 1.0, 0.45), 2.5))
			f.box(Vector3(4.6, 0.25, 1.4), Vector3(0, 0.12, -1.2), f.mat(Color(0.6, 0.6, 0.6), 0.9))
			f.box(Vector3(4.0, 0.7, 0.1), Vector3(0, 4.0, -1.95), f.mat(Color(0.08, 0.15, 0.4), 0.5))
			f.label("NXPD · FIRST PRECINCT", Vector3(0, 4.0, -1.88), Color(0.95, 0.95, 1.0), 64)
		"fire":
			var red := f.mat(Color(0.75, 0.06, 0.04), 0.4, 0.3)
			f.box(Vector3(6.0, 5.0, 0.15), Vector3(4.2, 2.5, -2.05), f.mat(Color(0.75, 0.77, 0.78), 0.4, 0.5))
			for r in 12:
				f.box(Vector3(6.0, 0.04, 0.05), Vector3(4.2, 0.3 + r * 0.4, -1.96), f.mat(Color(0.5, 0.52, 0.55), 0.4, 0.6))
			f.box(Vector3(6.6, 0.4, 0.3), Vector3(4.2, 5.2, -1.95), red)
			f.label("FIRE STATION 9", Vector3(4.2, 5.2, -1.78), Color(1.0, 0.9, 0.6), 56)
			f.cyl(0.16, 0.7, Vector3(-2.4, 0.35, 0.5), red)
			f.cyl(0.2, 0.12, Vector3(-2.4, 0.74, 0.5), red)
		"hotel":
			var gold := f.mat(Color(0.85, 0.66, 0.32), 0.25, 1.0)
			f.box(Vector3(5.0, 0.25, 5.4), Vector3(0, 3.8, 0.4), f.mat(Color(0.12, 0.1, 0.09), 0.5))
			f.box(Vector3(5.0, 0.06, 0.06), Vector3(0, 3.65, 3.05), f.glow(Color(1.0, 0.8, 0.45), 2.5))
			for sx: float in [-2.3, 2.3]:
				f.cyl(0.08, 3.8, Vector3(sx, 1.9, 2.8), gold)
			f.box(Vector3(1.8, 0.02, 5.0), Vector3(0, 0.2, 0.4), f.mat(Color(0.5, 0.05, 0.08), 0.9))
			f.label("THE MERIDIAN", Vector3(0, 4.3, 3.0), Color(1.0, 0.82, 0.45), 80)
		"nightclub":
			var neon := f.glow(col, 3.5)
			f.box(Vector3(3.2, 0.1, 0.1), Vector3(0, 3.5, -1.9), neon)
			for sx: float in [-1.55, 1.55]:
				f.box(Vector3(0.1, 3.5, 0.1), Vector3(sx, 1.75, -1.9), neon)
			for k in 4:
				f.cyl(0.04, 1.0, Vector3(-2.6 + (k % 2) * 0.9 + (k / 2) * 4.3, 0.5, -0.4), f.mat(Color(0.85, 0.85, 0.9), 0.15, 1.0))
			f.box(Vector3(0.9, 0.05, 0.05), Vector3(-2.15, 0.85, -0.4), f.mat(Color(0.6, 0.05, 0.1), 0.6))
			f.box(Vector3(0.9, 0.05, 0.05), Vector3(2.15, 0.85, -0.4), f.mat(Color(0.6, 0.05, 0.1), 0.6))
			f.label("PULSE", Vector3(0, 5.0, -1.85), col * 1.8, 160)
		"restaurant":
			for k in 8:
				var stripe := f.box(Vector3(0.62, 0.05, 2.0), Vector3(-2.2 + k * 0.62, 3.3, -1.0), f.mat(Color(0.55, 0.1, 0.08) if k % 2 == 0 else Color(0.92, 0.88, 0.8), 0.9))
				stripe.rotation.x = -0.35
			f.label("OSTERIA LUNA", Vector3(0, 4.3, -1.9), col * 1.4, 80)
			for sx: float in [-3.4, 3.4]:
				f.cyl(0.35, 0.05, Vector3(sx, 0.75, -0.6), f.mat(Color(0.12, 0.12, 0.12), 0.4, 0.5))
				f.cyl(0.04, 0.75, Vector3(sx, 0.37, -0.6), f.mat(Color(0.12, 0.12, 0.12), 0.4, 0.5))
		"school":
			var stone := f.mat(Color(0.75, 0.72, 0.65), 0.9)
			for sx: float in [-2.2, 2.2]:
				f.cyl(0.3, 4.6, Vector3(sx, 2.3, -1.6), stone)
			f.box(Vector3(5.6, 0.7, 1.2), Vector3(0, 4.9, -1.6), stone)
			f.label("NEXUS ACADEMY", Vector3(0, 4.9, -0.98), Color(0.15, 0.3, 0.6), 72)
			f.cyl(0.04, 7.0, Vector3(3.6, 3.5, 0.2), f.mat(Color(0.8, 0.8, 0.82), 0.3, 0.9))
			f.box(Vector3(0.02, 0.8, 1.3), Vector3(3.6, 6.4, 0.85), f.mat(Color(0.15, 0.35, 0.7), 0.8))
		"office":
			var steel := f.mat(Color(0.6, 0.62, 0.65), 0.3, 0.8)
			f.box(Vector3(6.0, 0.2, 2.6), Vector3(0, 3.8, -0.9), steel)
			f.cyl(1.2, 2.8, Vector3(0, 1.4, -1.0), f.mat(Color(0.6, 0.75, 0.85, 0.3), 0.05))
			f.label("VANTA SYSTEMS", Vector3(0, 4.3, -1.88), col * 1.6, 80)
		"parking":
			f.box(Vector3(6.0, 3.0, 0.1), Vector3(0, 1.5, -1.98), f.mat(Color(0.02, 0.02, 0.03), 0.9))
			for k in 10:
				f.box(Vector3(0.6, 0.4, 0.12), Vector3(-2.7 + k * 0.6, 3.2, -1.9), f.mat(Color(0.95, 0.75, 0.05) if k % 2 == 0 else Color(0.05, 0.05, 0.05), 0.6))
			f.box(Vector3(1.0, 1.0, 0.12), Vector3(3.8, 3.6, -1.9), f.glow(Color(0.2, 0.45, 1.0), 2.0))
			f.label("P", Vector3(3.8, 3.6, -1.82), Color(1, 1, 1), 140)
			f.label("PARKING ENTRANCE", Vector3(0, 4.0, -1.85), Color(0.95, 0.95, 0.9), 56)
			f.box(Vector3(3.0, 0.08, 0.08), Vector3(-1.3, 1.05, -0.6), f.mat(Color(0.95, 0.95, 0.95), 0.5))
			f.box(Vector3(0.3, 1.1, 0.3), Vector3(-2.9, 0.55, -0.6), f.mat(Color(0.95, 0.75, 0.05), 0.6))

## a small builder for the street frontages (the street's own helpers stay private to it)
class _Front:
	var holder: Node3D
	var _mats := {}
	func _init(h: Node3D) -> void:
		holder = h
	func mat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
		var key := "%s|%s|%s" % [c.to_html(), rough, metal]
		if _mats.has(key):
			return _mats[key]
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.roughness = rough
		m.metallic = metal
		if c.a < 1.0:
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_mats[key] = m
		return m
	func glow(c: Color, energy := 2.0) -> StandardMaterial3D:
		var m := StandardMaterial3D.new()
		m.albedo_color = c
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = energy
		return m
	func box(size: Vector3, pos: Vector3, m: Material) -> MeshInstance3D:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = size
		mi.mesh = bm
		mi.material_override = m
		mi.position = pos
		holder.add_child(mi)
		return mi
	func cyl(r: float, h: float, pos: Vector3, m: Material) -> MeshInstance3D:
		var mi := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = r
		cm.bottom_radius = r
		cm.height = h
		cm.radial_segments = 14
		cm.rings = 1
		mi.mesh = cm
		mi.material_override = m
		mi.position = pos
		holder.add_child(mi)
		return mi
	func sphere(r: float, pos: Vector3, m: Material) -> MeshInstance3D:
		var mi := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = r
		sm.height = r * 2.0
		sm.radial_segments = 14
		sm.rings = 7
		mi.mesh = sm
		mi.material_override = m
		mi.position = pos
		holder.add_child(mi)
		return mi
	func label(t: String, pos: Vector3, c: Color, size := 64) -> Label3D:
		var l := Label3D.new()
		l.text = t
		l.font_size = size
		l.pixel_size = 0.01
		l.modulate = c
		l.shaded = false
		l.position = pos
		holder.add_child(l)
		return l
