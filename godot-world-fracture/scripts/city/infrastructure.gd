extends RefCounted
## City infrastructure on the avenue (owner's pick, Nov 11; asset catalog part 2 §1 "City infrastructure": traffic
## lights, intersections, parking garages, subway stations, bus terminals, gas stations, construction sites):
##   crossings — a signalised crossing on every block: zebra stripes, stop lines, signal heads on mast arms over each
##     lane and walk / don't-walk heads at the corners, on a shared cycle (green, amber, red; offset block to block).
##     The traffic stops at the line on amber and red (traffic.gd `red_lines`)
##   lots — four sites cut into the street wall two blocks out from the hub (the buildings skip them, the facade line
##     opens): the VoltCharge fuel and charge station, the Central Bus Terminal with its buses in the bays, the Helix
##     Tower construction site behind its hoarding with a tower crane slewing over it, and the city parking garage (its
##     door goes down to the underground parking, interiors.gd)
## The subway is a door (street_slice.gd DOORS "metro") down to its platform (interiors.gd "metro").
## Built into each district tile by street_slice.gd `_build_tile`; `step` runs the lights and the crane.

const ROAD_HALF := 8.0
const FACADE := 15.0              # ROAD_W / 2 + WALK_W
const LOT_D := 30.0               # how deep a lot runs back from the facade line
const CROSS_LZ := -20.0           # the crossing on every block, 20 m before the block's middle
const CYCLE := 27.0               # green 14 s, amber 3, red 10 (the walkers cross)

## [id, block k, side, z from, z to (along the block)]
const LOTS := [
	["gas", 2, -1.0, 66.0, 124.0],
	["bus", 2, 1.0, -124.0, -66.0],
	["construction", -2, 1.0, 66.0, 124.0],
	["parkade", -2, -1.0, -124.0, -66.0],
]
const TILE := 260.0

## the lot standing on this side of block k at z along it ("" for none)
static func lot_at(k: int, side: float, lz: float, pad := 0.0) -> String:
	for l in LOTS:
		if int(l[1]) == k and float(l[2]) == side and lz > float(l[3]) - pad and lz < float(l[4]) + pad:
			return String(l[0])
	return ""

## the z ranges (along block k) where the facade line on `side` stands open for a lot
static func gaps(k: int, side: float) -> Array:
	var out: Array = []
	for l in LOTS:
		if int(l[1]) == k and float(l[2]) == side:
			out.append(Vector2(float(l[3]), float(l[4])))
	return out

## where a lot's middle is in the world (for its door)
static func lot_center(id: String) -> Vector3:
	for l in LOTS:
		if String(l[0]) == id:
			return Vector3(float(l[2]) * (FACADE + LOT_D * 0.5), 0, int(l[1]) * TILE + (float(l[3]) + float(l[4])) * 0.5)
	return Vector3.ZERO

## the avenue's light at a crossing on block k, t seconds in: "green", "amber", "red"
static func light(k: int, t: float) -> String:
	var p := fposmod(t + k * 7.0, CYCLE)
	return "green" if p < 14.0 else ("amber" if p < 17.0 else "red")

# --------------------------------------------------------------------------------------------- building a block
var s                 # the street slice
var root: Node3D      # the block's root (its position is the block's middle)
var k := 0

static func build(slice, block_k: int, block_root: Node3D) -> void:
	var b = load("res://scripts/city/infrastructure.gd").new()
	b.s = slice
	b.k = block_k
	b.root = block_root
	b._crossing()
	for l in LOTS:
		if int(l[1]) == block_k:
			b.call("_" + String(l[0]), float(l[2]), float(l[3]), float(l[4]))

static var _mats := {}

## one material per look, shared across the blocks (the static batch merges by look)
func m(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f|%.2f" % [c.to_html(), rough, metal, emit]
	if not _mats.has(key):
		var mt := StandardMaterial3D.new()
		mt.albedo_color = c
		mt.roughness = rough
		mt.metallic = metal
		if emit > 0.0:
			mt.emission_enabled = true
			mt.emission = c
			mt.emission_energy_multiplier = emit
		_mats[key] = mt
	return _mats[key]

func box(size: Vector3, at: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	(parent if parent else root).add_child(mi)
	return mi

## a solid footprint the block's obstacle pass picks up (`size` meta, standing on its position)
func solid(size: Vector3, at_floor: Vector3) -> void:
	var n := Node3D.new()
	n.position = at_floor
	n.set_meta("size", size)
	n.set_meta("file", "infrastructure")
	root.add_child(n)

func label(text: String, at: Vector3, yaw: float, c: Color, size := 96, parent: Node3D = null) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.012
	l.position = at
	l.rotation.y = yaw
	l.modulate = c * 1.6
	l.shaded = false
	l.double_sided = true
	(parent if parent else root).add_child(l)
	return l

## a point in a lot: `xo` metres back from the facade line on `side`, `lz` along the block
func lp(side: float, xo: float, y: float, lz: float) -> Vector3:
	return Vector3(side * (FACADE + xo), y, lz)

# --------------------------------------------------------------------------------------------- the crossing
func _crossing() -> void:
	var c := CROSS_LZ
	var white := m(Color(0.92, 0.92, 0.9), 0.7)
	# the zebra across the avenue, the stop lines before it
	var x := -ROAD_HALF + 0.6
	while x < ROAD_HALF - 0.3:
		box(Vector3(0.6, 0.02, 4.0), Vector3(x, 0.012, c), white)
		x += 1.2
	box(Vector3(ROAD_HALF, 0.02, 0.4), Vector3(ROAD_HALF * 0.5, 0.012, c + 5.0), white)
	box(Vector3(ROAD_HALF, 0.02, 0.4), Vector3(-ROAD_HALF * 0.5, 0.012, c - 5.0), white)
	var pole := m(Color(0.16, 0.17, 0.19), 0.5, 0.7)
	var heads: Array = []
	# the mast arms: one on each kerb, reaching over the lane that stops at it
	for side: float in [1.0, -1.0]:
		var at := Vector3(side * (ROAD_HALF + 0.6), 0.18, c + side * 6.0)
		box(Vector3(0.22, 6.2, 0.22), at + Vector3(0, 3.1, 0), pole)
		box(Vector3(5.4, 0.16, 0.16), at + Vector3(-side * 2.7, 6.0, 0), pole)
		solid(Vector3(0.4, 6.0, 0.4), at)
		heads.append(_head(at + Vector3(-side * 4.8, 5.3, 0), side, 0.0))
		heads.append(_head(at + Vector3(0, 3.0, 0), side, side * 0.25))
		# the walk / don't-walk heads at the corners
		for dz: float in [-3.0, 3.0]:
			var pc := Vector3(side * (ROAD_HALF + 0.6), 0.18, c + dz)
			if absf(dz - side * 6.0) > 1.0:
				box(Vector3(0.12, 2.8, 0.12), pc + Vector3(0, 1.4, 0), pole)
			heads.append(_walk_head(pc + Vector3(0, 2.6, 0), -signf(pc.x)))
	s.signals.append({ "k": k, "z": k * TILE + c, "heads": heads, "state": "" })

## a three-lamp head facing the oncoming lane (`side` +1: the +x lane, coming down -z, looks toward +z)
func _head(at: Vector3, side: float, x_off: float) -> Dictionary:
	var n := Node3D.new()
	n.set_meta("dynamic", true)
	n.position = at + Vector3(x_off, 0, 0)
	n.rotation.y = 0.0 if side > 0.0 else PI
	root.add_child(n)
	box(Vector3(0.45, 1.25, 0.32), Vector3.ZERO, m(Color(0.08, 0.08, 0.09), 0.5, 0.4), n)
	box(Vector3(0.55, 1.35, 0.04), Vector3(0, 0, -0.18), m(Color(0.05, 0.05, 0.05), 0.6), n)
	var lamps := {}
	var cols := { "red": Color(1.0, 0.1, 0.05), "amber": Color(1.0, 0.65, 0.05), "green": Color(0.1, 1.0, 0.35) }
	var y := 0.38
	for name in ["red", "amber", "green"]:
		var l := box(Vector3(0.26, 0.26, 0.06), Vector3(0, y, 0.17), m(Color(0.1, 0.1, 0.1)), n)
		lamps[name] = { "node": l, "on": m(cols[name], 0.4, 0.0, 5.0), "off": m((cols[name] as Color) * 0.15, 0.6) }
		y -= 0.38
	return { "kind": "car", "lamps": lamps }

func _walk_head(at: Vector3, face: float) -> Dictionary:
	var n := Node3D.new()
	n.set_meta("dynamic", true)
	n.position = at
	n.rotation.y = PI * 0.5 * face
	root.add_child(n)
	box(Vector3(0.36, 0.5, 0.2), Vector3.ZERO, m(Color(0.08, 0.08, 0.09), 0.5, 0.4), n)
	var lamps := {
		"walk": { "node": box(Vector3(0.24, 0.18, 0.04), Vector3(0, 0.1, 0.11), m(Color(0.1, 0.1, 0.1)), n), "on": m(Color(0.95, 0.95, 1.0), 0.4, 0.0, 4.0), "off": m(Color(0.15, 0.15, 0.16), 0.6) },
		"stop": { "node": box(Vector3(0.24, 0.18, 0.04), Vector3(0, -0.12, 0.11), m(Color(0.1, 0.1, 0.1)), n), "on": m(Color(1.0, 0.45, 0.1), 0.4, 0.0, 4.0), "off": m(Color(0.16, 0.1, 0.06), 0.6) },
	}
	return { "kind": "walk", "lamps": lamps }

## the lights change (all the crossings on loaded blocks) and the traffic hears which crossings are stopping it
static func step(slice, t: float) -> void:
	var red: Array = []
	var keep: Array = []
	for sg in slice.signals:
		var heads: Array = sg.heads
		if heads.is_empty() or not is_instance_valid(heads[0].lamps.red.node):
			continue
		keep.append(sg)
		var st := light(int(sg.k), t)
		if st != "green":
			red.append(float(sg.z))
		if st == String(sg.state):
			continue
		sg.state = st
		for h in heads:
			var on: Array = [st] if h.kind == "car" else (["walk"] if st == "red" else ["stop"])
			for name in h.lamps:
				var l: Dictionary = h.lamps[name]
				(l.node as MeshInstance3D).material_override = l.on if name in on else l.off
	slice.signals = keep
	if slice.traffic:
		slice.traffic.red_lines = red
	for cr in slice.cranes:
		if is_instance_valid(cr):
			(cr as Node3D).rotation.y = 0.9 + 0.7 * sin(t * 0.06 + (cr as Node3D).position.z * 0.01)

# --------------------------------------------------------------------------------------------- the lots
## the lot's ground, its side fences and its back wall
func _lot_frame(side: float, z0: float, z1: float, ground: Color, wall_h := 6.0) -> void:
	var lz := (z0 + z1) * 0.5
	var len := z1 - z0
	box(Vector3(LOT_D, 0.04, len), lp(side, LOT_D * 0.5, 0.17, lz), m(ground, 0.85))
	var wall := m(Color(0.35, 0.33, 0.32), 0.9)
	for zz: float in [z0, z1]:
		box(Vector3(LOT_D, wall_h, 0.4), lp(side, LOT_D * 0.5, wall_h * 0.5, zz), wall)
		solid(Vector3(LOT_D, wall_h, 0.4), lp(side, LOT_D * 0.5, 0.0, zz))
	box(Vector3(0.6, wall_h + 4.0, len), lp(side, LOT_D, (wall_h + 4.0) * 0.5, lz), wall)
	solid(Vector3(0.6, wall_h + 4.0, len), lp(side, LOT_D, 0.0, lz))

## VoltCharge: a canopy over two pump islands, EV chargers, the mart at the back, the price pylon by the walk
func _gas(side: float, z0: float, z1: float) -> void:
	_lot_frame(side, z0, z1, Color(0.42, 0.42, 0.44))
	var lz := (z0 + z1) * 0.5
	var green := Color(0.2, 1.0, 0.55)
	var white := m(Color(0.92, 0.93, 0.95), 0.4, 0.2)
	box(Vector3(14.0, 0.7, 26.0), lp(side, 10.0, 5.6, lz), white)
	box(Vector3(14.2, 0.18, 26.2), lp(side, 10.0, 5.95, lz), m(green, 0.4, 0.0, 3.0))
	for sx: float in [4.5, 15.5]:
		for sz: float in [-9.0, 9.0]:
			box(Vector3(0.5, 5.3, 0.5), lp(side, sx, 2.8, lz + sz), white)
			solid(Vector3(0.5, 5.3, 0.5), lp(side, sx, 0.0, lz + sz))
	for ix: float in [7.0, 13.0]:
		box(Vector3(1.3, 0.25, 10.0), lp(side, ix, 0.3, lz), m(Color(0.6, 0.6, 0.6), 0.8))
		solid(Vector3(1.3, 1.6, 10.0), lp(side, ix, 0.0, lz))
		for pz: float in [-3.0, 3.0]:
			box(Vector3(0.8, 1.9, 0.6), lp(side, ix, 1.4, lz + pz), m(Color(0.1, 0.12, 0.14), 0.4, 0.5))
			box(Vector3(0.82, 0.45, 0.4), lp(side, ix, 1.85, lz + pz), m(green, 0.4, 0.0, 2.0))
	# EV chargers along the near fence
	for k2 in 4:
		box(Vector3(0.5, 1.6, 0.4), lp(side, 4.0 + k2 * 3.0, 0.98, z0 + 1.2), m(Color(0.2, 0.75, 1.0), 0.4, 0.2, 1.6))
		solid(Vector3(0.5, 1.6, 0.4), lp(side, 4.0 + k2 * 3.0, 0.18, z0 + 1.2))
	# the mart
	box(Vector3(8.0, 4.8, 22.0), lp(side, 25.0, 2.58, lz), m(Color(0.25, 0.27, 0.3), 0.6))
	solid(Vector3(8.0, 4.8, 22.0), lp(side, 25.0, 0.18, lz))
	box(Vector3(0.06, 2.4, 18.0), lp(side, 20.97, 1.6, lz), m(Color(1.0, 0.92, 0.75), 0.3, 0.0, 1.4))
	label("VOLTCHARGE MART", lp(side, 20.9, 4.2, lz), -PI * 0.5 * side, green, 110)
	# the price pylon
	box(Vector3(0.5, 7.0, 0.5), lp(side, 1.5, 3.5, z1 - 3.0), m(Color(0.15, 0.15, 0.17), 0.5, 0.6))
	box(Vector3(0.4, 3.0, 3.2), lp(side, 1.5, 6.4, z1 - 3.0), m(Color(0.08, 0.1, 0.1), 0.5))
	solid(Vector3(0.6, 7.0, 0.6), lp(side, 1.5, 0.18, z1 - 3.0))
	label("VOLTCHARGE\nFUEL 2.49\nCHARGE 0.32", lp(side, 1.25, 6.4, z1 - 3.0), -PI * 0.5 * side, green, 64)

## the Central Bus Terminal: a long canopy over three bays with their buses, the platform, the departure board
func _bus(side: float, z0: float, z1: float) -> void:
	_lot_frame(side, z0, z1, Color(0.36, 0.36, 0.38))
	var lz := (z0 + z1) * 0.5
	var cyan := Color(0.25, 0.85, 1.0)
	var steel := m(Color(0.5, 0.52, 0.55), 0.4, 0.8)
	box(Vector3(18.0, 0.4, 54.0), lp(side, 10.0, 5.2, lz), m(Color(0.85, 0.87, 0.9), 0.4, 0.3))
	box(Vector3(0.2, 0.12, 54.0), lp(side, 10.0, 4.95, lz), m(cyan, 0.4, 0.0, 3.0))
	for sz in range(-24, 25, 12):
		box(Vector3(0.35, 5.0, 0.35), lp(side, 13.0, 2.6, lz + sz), steel)
		solid(Vector3(0.35, 5.0, 0.35), lp(side, 13.0, 0.18, lz + sz))
	# the platform island with benches and the board
	box(Vector3(3.0, 0.2, 46.0), lp(side, 13.0, 0.28, lz), m(Color(0.6, 0.6, 0.6), 0.8))
	box(Vector3(0.3, 2.2, 4.0), lp(side, 13.0, 2.6, lz - 4.0), m(Color(0.05, 0.06, 0.08), 0.4))
	label("DEPARTURES\n12  CENTRAL  NOW\n7  HARBOR  4 MIN\n21  AIRPORT  9 MIN", lp(side, 12.8, 2.7, lz - 4.0), -PI * 0.5 * side, Color(1.0, 0.8, 0.3), 40)
	for bz: float in [-14.0, 6.0, 16.0]:
		box(Vector3(0.6, 0.45, 2.0), lp(side, 13.0, 0.6, lz + bz), m(Color(0.3, 0.2, 0.12), 0.7))
	# three buses in the bays, nose to the street
	var liveries := [Color(0.1, 0.45, 0.9), Color(0.95, 0.75, 0.1), Color(0.1, 0.45, 0.9)]
	var routes := ["12 CENTRAL", "7 HARBOR", "21 AIRPORT"]
	for i in 3:
		var bx := 6.0 + i * 0.0
		var bz := lz - 16.0 + i * 15.0
		var body := m(Color(0.92, 0.93, 0.95), 0.4, 0.2)
		box(Vector3(2.6, 3.0, 12.0), lp(side, bx, 1.75, bz), body)
		box(Vector3(2.62, 0.9, 10.6), lp(side, bx, 2.35, bz - 0.4), m(Color(0.08, 0.12, 0.16), 0.15, 0.4))
		box(Vector3(2.64, 0.45, 12.02), lp(side, bx, 0.95, bz), m(liveries[i], 0.5))
		box(Vector3(2.0, 0.4, 0.06), lp(side, bx, 3.0, bz + 6.02), m(Color(1.0, 0.65, 0.1), 0.4, 0.0, 3.0))
		label(routes[i], lp(side, bx, 3.0, bz + 6.1), 0.0, Color(1.0, 0.7, 0.2), 40)
		solid(Vector3(2.8, 3.2, 12.2), lp(side, bx, 0.18, bz))
	# the terminal hall at the back
	box(Vector3(9.0, 7.0, 40.0), lp(side, 25.0, 3.68, lz), m(Color(0.22, 0.25, 0.3), 0.5, 0.3))
	solid(Vector3(9.0, 7.0, 40.0), lp(side, 25.0, 0.18, lz))
	box(Vector3(0.06, 3.0, 34.0), lp(side, 20.47, 2.0, lz), m(Color(0.75, 0.88, 1.0), 0.2, 0.0, 1.2))
	label("CENTRAL BUS TERMINAL", lp(side, 20.4, 5.6, lz), -PI * 0.5 * side, cyan, 120)

## the Helix Tower site: hoarding along the walk, the core going up in scaffolding, a tower crane, cabins, a digger
func _construction(side: float, z0: float, z1: float) -> void:
	_lot_frame(side, z0, z1, Color(0.42, 0.33, 0.24), 3.0)
	var lz := (z0 + z1) * 0.5
	var len := z1 - z0
	# the hoarding on the facade line: printed with the tower to come
	box(Vector3(0.25, 3.0, len), lp(side, 0.2, 1.68, lz), m(Color(0.1, 0.12, 0.16), 0.6))
	solid(Vector3(0.3, 3.0, len), lp(side, 0.2, 0.18, lz))
	box(Vector3(0.06, 1.0, len - 6.0), lp(side, 0.05, 2.4, lz), m(Color(0.25, 0.85, 1.0), 0.5, 0.0, 1.6))
	label("HELIX TOWER · COMING 2027", lp(side, 0.0, 1.4, lz), -PI * 0.5 * side, Color(0.9, 0.95, 1.0), 110)
	for zz in range(int(z0) + 3, int(z1), 6):
		box(Vector3(0.6, 0.5, 0.6), lp(side, -0.6, 0.43, zz), m(Color(1.0, 0.45, 0.05), 0.6))
	# the core going up, the scaffold round it
	var concrete := m(Color(0.62, 0.61, 0.58), 0.95)
	box(Vector3(10.0, 22.0, 12.0), lp(side, 16.0, 11.18, lz), concrete)
	solid(Vector3(10.0, 22.0, 12.0), lp(side, 16.0, 0.18, lz))
	for fl in 5:
		box(Vector3(14.0, 0.3, 16.0), lp(side, 16.0, 4.5 + fl * 4.2, lz), concrete)
	var scaff := m(Color(0.85, 0.65, 0.1), 0.6, 0.5)
	for sx: float in [8.5, 23.5]:
		for sz in range(-8, 9, 4):
			box(Vector3(0.1, 22.0, 0.1), lp(side, sx, 11.2, lz + sz), scaff)
		for h in range(2, 22, 4):
			box(Vector3(0.1, 0.1, 16.0), lp(side, sx, h, lz), scaff)
	# the tower crane: a lattice mast, the jib and counter-jib slewing on top
	var mast_at := lp(side, 26.0, 0.18, z1 - 6.0)
	var steel := m(Color(0.95, 0.75, 0.1), 0.5, 0.4)
	for cx: float in [-0.9, 0.9]:
		for cz: float in [-0.9, 0.9]:
			box(Vector3(0.18, 46.0, 0.18), mast_at + Vector3(cx, 23.0, cz), steel)
	for h in range(2, 46, 3):
		box(Vector3(2.0, 0.12, 0.12), mast_at + Vector3(0, h, 0.9), steel)
		box(Vector3(0.12, 0.12, 2.0), mast_at + Vector3(0.9, h + 1.5, 0), steel)
	solid(Vector3(2.4, 46.0, 2.4), mast_at)
	var top := Node3D.new()
	top.set_meta("dynamic", true)
	top.position = mast_at + Vector3(0, 46.0, 0)
	root.add_child(top)
	box(Vector3(1.6, 1.4, 40.0), Vector3(0, 0.8, 14.0), steel, top)
	box(Vector3(1.6, 1.0, 12.0), Vector3(0, 0.6, -8.0), steel, top)
	box(Vector3(2.4, 2.4, 3.0), Vector3(0, -0.4, -12.5), m(Color(0.5, 0.5, 0.52), 0.9), top)
	box(Vector3(2.0, 2.0, 2.2), Vector3(1.8, -0.6, 0.0), m(Color(0.9, 0.9, 0.92), 0.4), top)
	box(Vector3(0.05, 18.0, 0.05), Vector3(0, -9.0, 22.0), m(Color(0.2, 0.2, 0.2)), top)
	box(Vector3(1.2, 0.6, 1.2), Vector3(0, -18.0, 22.0), m(Color(0.9, 0.2, 0.1), 0.5), top)
	box(Vector3(0.3, 0.3, 0.3), Vector3(0, 1.8, 33.5), m(Color(1.0, 0.1, 0.05), 0.4, 0.0, 6.0), top)
	s.cranes.append(top)
	# site cabins stacked by the near fence, a digger by the hole
	box(Vector3(2.5, 2.6, 6.0), lp(side, 4.0, 1.48, z0 + 4.0), m(Color(0.2, 0.4, 0.7), 0.6))
	box(Vector3(2.5, 2.6, 6.0), lp(side, 4.0, 4.08, z0 + 4.0), m(Color(0.85, 0.85, 0.85), 0.6))
	solid(Vector3(2.5, 5.2, 6.0), lp(side, 4.0, 0.18, z0 + 4.0))
	var yellow := m(Color(0.95, 0.7, 0.05), 0.5, 0.3)
	box(Vector3(2.8, 1.4, 3.6), lp(side, 7.0, 1.3, z1 - 8.0), yellow)
	box(Vector3(2.0, 1.6, 1.8), lp(side, 7.0, 2.7, z1 - 8.6), yellow)
	box(Vector3(0.4, 0.4, 4.0), lp(side, 7.0, 3.2, z1 - 5.2), yellow).rotation.x = 0.5
	box(Vector3(3.0, 0.7, 4.2), lp(side, 7.0, 0.53, z1 - 8.0), m(Color(0.1, 0.1, 0.1), 0.9))
	solid(Vector3(3.0, 3.2, 4.4), lp(side, 7.0, 0.18, z1 - 8.0))

## the city parking garage: four open decks on columns over the entrance ramp, the barrier, the big P
func _parkade(side: float, z0: float, z1: float) -> void:
	var lz := (z0 + z1) * 0.5
	var len := z1 - z0
	box(Vector3(LOT_D, 0.04, len), lp(side, LOT_D * 0.5, 0.17, lz), m(Color(0.3, 0.3, 0.32), 0.9))
	var concrete := m(Color(0.58, 0.58, 0.56), 0.95)
	var glowc := Color(1.0, 0.85, 0.2)
	for lvl in range(1, 5):
		var y := 0.18 + lvl * 3.3
		box(Vector3(LOT_D - 1.0, 0.35, len), lp(side, LOT_D * 0.5 + 0.5, y, lz), concrete)
		box(Vector3(0.3, 1.1, len), lp(side, 1.2, y + 0.7, lz), concrete)
		box(Vector3(0.05, 0.1, len), lp(side, 1.0, y + 1.2, lz), m(glowc, 0.4, 0.0, 2.5))
		# cars on the deck
		for k2 in 7:
			var cz := z0 + 5.0 + k2 * 7.5
			if (lvl * 3 + k2) % 3 != 0:
				box(Vector3(4.2, 1.3, 1.9), lp(side, 8.0 + (k2 % 2) * 12.0, y + 0.85, cz), m([Color(0.6, 0.1, 0.1), Color(0.15, 0.2, 0.3), Color(0.8, 0.8, 0.82), Color(0.1, 0.1, 0.12)][(lvl + k2) % 4], 0.3, 0.5))
	for cx: float in [2.0, 15.0, 28.0]:
		for cz in range(int(z0) + 2, int(z1), 9):
			box(Vector3(0.7, 13.4, 0.7), lp(side, cx, 6.88, cz), concrete)
			solid(Vector3(0.7, 3.3, 0.7), lp(side, cx, 0.18, cz))
	for zz: float in [z0, z1]:
		box(Vector3(LOT_D, 3.3, 0.4), lp(side, LOT_D * 0.5, 1.83, zz), concrete)
		solid(Vector3(LOT_D, 3.3, 0.4), lp(side, LOT_D * 0.5, 0.18, zz))
	box(Vector3(0.6, 14.0, len), lp(side, LOT_D, 7.18, lz), concrete)
	solid(Vector3(0.6, 14.0, len), lp(side, LOT_D, 0.18, lz))
	# the ramp down to the underground parking, its barrier and the pay booth
	box(Vector3(10.0, 0.3, 7.0), lp(side, 12.0, 0.1, lz), m(Color(0.18, 0.18, 0.2), 0.9))
	box(Vector3(0.15, 0.15, 5.0), lp(side, 6.0, 1.1, lz), m(Color(0.95, 0.2, 0.1), 0.5, 0.0, 1.0))
	box(Vector3(1.2, 2.2, 1.6), lp(side, 6.0, 1.28, lz - 4.0), m(Color(0.2, 0.3, 0.5), 0.5, 0.4))
	solid(Vector3(1.2, 2.2, 1.6), lp(side, 6.0, 0.18, lz - 4.0))
	box(Vector3(0.4, 3.0, 3.0), lp(side, 0.6, 6.0, lz + 8.0), m(Color(0.1, 0.25, 0.7), 0.5, 0.0, 1.2))
	label("P", lp(side, 0.35, 6.0, lz + 8.0), -PI * 0.5 * side, Color(1, 1, 1), 300)
	label("CITY PARKING · UNDERGROUND", lp(side, 0.4, 3.6, lz), -PI * 0.5 * side, glowc, 80)
