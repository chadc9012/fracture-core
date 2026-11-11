extends RefCounted
## Nexus City's districts (owner, Nov 9: "finish building Nexus" — walkable districts). The avenue keeps its streamed
## blocks (district.gd tiles, 260 m each, tile 0 the Central Transit Plaza hub); each other block opens a pedestrian side
## street on one or both sides into a district court of its own, built with the block (so it streams with it):
##
##   tile -3  Perimeter Wall & Operations      | Vanguard Command Citadel        (the North Gate closes the avenue)
##   tile -2  Spire District                   | Spire District
##   tile -1  Tech Faction Central Tower (420 m, the tallest building in the game) | Apex Gear
##   tile  0  Central Transit Plaza (the hub: garage, mall, sports, the doors)
##   tile  1  Rusty Trigger                    | Cylinder & Co Heavy Motorworks
##   tile  2  The Warrens                      | Scrapyard Bazaar
##   tile  3  Southern Docks & Dockside Storage | Marina & Aqua-Tech Shipyard   (the quay and the sea close the avenue)
##
## Left is -x (the far side), right is +x. A court is tile-local: its side street runs from the facade line (15 m from the
## avenue's centre) to MOUTH_OUT through a MOUTH_HALF-wide gap, and the court is the open ground from MOUTH_OUT to
## COURT_OUT, |z| < COURT_HALF, walled by the district's own blocks. Every block a player can reach is an obstacle box (a
## node with `size` meta, base at its origin — street_slice.gd `_tile_boxes` collects them). Building only, no rules:
## the avenue skips its own facades where a court opens (`has_court`).

const StaticBatch := preload("res://scripts/static_batch.gd")
const ROAD_HALF := 8.0
const FACADE := 15.0           # ROAD_W / 2 + WALK_W
const MOUTH_HALF := 9.0        # half the side street's width
const MOUTH_OUT := 40.0        # the side street ends and the court begins
const COURT_OUT := 130.0       # the court's back
const COURT_HALF := 62.0       # the court's half length along the avenue
const TILE := 260.0
## the Central Tower stands in the tile -1 west court; built once into the world (it is seen from everywhere)
const TOWER_POS := Vector3(-92.0, 0.0, -260.0)
const TOWER_H := 420.0

const COURTS := {
	-3: ["perimeter", "citadel"],
	-2: ["spire", "spire"],
	-1: ["tower", "apex"],
	1: ["rusty", "cylinder"],
	2: ["warrens", "bazaar"],
	3: ["docks", "marina"],
}
const NAMES := {
	"perimeter": "PERIMETER WALL & OPERATIONS",
	"citadel": "VANGUARD COMMAND CITADEL",
	"spire": "THE SPIRE DISTRICT",
	"tower": "TECH FACTION CENTRAL TOWER",
	"apex": "APEX GEAR",
	"rusty": "RUSTY TRIGGER",
	"cylinder": "CYLINDER & CO HEAVY MOTORWORKS",
	"warrens": "THE WARRENS",
	"bazaar": "SCRAPYARD BAZAAR",
	"docks": "SOUTHERN DOCKS · DOCKSIDE STORAGE",
	"marina": "MARINA · AQUA-TECH SHIPYARD",
}
const ACCENT := {
	"perimeter": Color(1.0, 0.55, 0.12),
	"citadel": Color(0.2, 0.85, 1.0),
	"spire": Color(0.85, 0.95, 1.0),
	"tower": Color(0.3, 0.9, 1.0),
	"apex": Color(0.3, 1.0, 0.6),
	"rusty": Color(1.0, 0.18, 0.12),
	"cylinder": Color(1.0, 0.7, 0.15),
	"warrens": Color(1.0, 0.75, 0.4),
	"bazaar": Color(1.0, 0.4, 0.75),
	"docks": Color(0.35, 0.75, 1.0),
	"marina": Color(0.2, 1.0, 0.85),
}
## the walk-in shops in the courts: where the door stands (tile, side, distance out from the avenue's centre, tile-local z)
const DOORS := [
	{ "id": "apex", "label": "APEX GEAR", "k": -1, "side": 1.0, "d": 93.0, "z": 0.0, "color": Color(0.3, 1.0, 0.6) },
	{ "id": "rusty", "label": "RUSTY TRIGGER", "k": 1, "side": -1.0, "d": 126.0, "z": 0.0, "color": Color(1.0, 0.25, 0.15) },
	{ "id": "cylinder", "label": "CYLINDER & CO", "k": 1, "side": 1.0, "d": 92.0, "z": 0.0, "color": Color(1.0, 0.7, 0.15) },
]

## the district court on this side of tile k ("" for none)
static func court(k: int, side: float) -> String:
	if not COURTS.has(k):
		return ""
	return String(COURTS[k][0 if side < 0.0 else 1])

static func has_court(k: int, side: float) -> bool:
	return court(k, side) != ""

## true where the avenue's own facade (buildings, shop signs, kerbside trees) must leave room for a court's frontage
static func in_frontage(k: int, side: float, z_local: float, pad := 0.0) -> bool:
	return has_court(k, side) and absf(z_local) < COURT_HALF + pad

## the named area at a world position: a court's name inside it, the hub's name on tile 0's walks, else ""
static func area_at(p: Vector3) -> String:
	var k := int(floor((p.z + TILE * 0.5) / TILE))
	var lz := p.z - k * TILE
	var side := -1.0 if p.x < 0.0 else 1.0
	if absf(p.x) > FACADE + 1.0 and absf(lz) < COURT_HALF and has_court(k, side):
		return String(NAMES[court(k, side)])
	if k == 0:
		return "CENTRAL TRANSIT PLAZA"
	if absf(p.x) <= FACADE + 1.0:
		return "NEXUS AVENUE"
	return ""

## the court doors in world space: [{id, label, pos}]
static func door_spots() -> Array:
	var out: Array = []
	for d in DOORS:
		out.append({ "id": String(d.id), "label": String(d.label), "pos": Vector3(float(d.side) * float(d.d), 0.18, int(d.k) * TILE + float(d.z)) })
	return out

# --------------------------------------------------------------------------------------------- materials
const FACADE_SHADER := """
shader_type spatial;
uniform vec3 glass : source_color = vec3(0.32, 0.42, 0.52);
uniform vec3 frame : source_color = vec3(0.16, 0.17, 0.19);
uniform vec3 light_col : source_color = vec3(1.0, 0.82, 0.6);
uniform float floor_h = 3.3;
uniform float bay_w = 1.5;
uniform float lit = 0.25;
uniform float glow = 0.35;
uniform float metal = 0.85;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 9137.7); }
void fragment() {
	if (abs(wnrm.y) > 0.5) {
		ALBEDO = frame * 0.8; ROUGHNESS = 0.7; METALLIC = 0.2;
	} else {
		vec2 uv = vec2(abs(wnrm.x) > 0.5 ? wpos.z : wpos.x, wpos.y);
		vec2 cell = uv / vec2(bay_w, floor_h);
		vec2 f = fract(cell);
		float mullion = clamp(step(0.93, f.x) + step(0.88, f.y), 0.0, 1.0);
		float on = step(1.0 - lit, h21(floor(cell))) * (1.0 - mullion);
		vec3 g = glass * (0.8 + 0.4 * h21(floor(cell) * 0.37));
		ALBEDO = mix(g, frame, mullion);
		METALLIC = mix(metal, 0.3, mullion);
		ROUGHNESS = mix(0.08, 0.6, mullion);
		EMISSION = light_col * on * glow;
	}
}
"""
static var _shader: Shader
static var _mats := {}

## a lit-window facade (shared per look, so the batcher merges every block wearing it)
static func facade(glass: Color, lit: float, glow: float, frame := Color(0.16, 0.17, 0.19), floor_h := 3.3, bay := 1.5, light := Color(1.0, 0.82, 0.6), metal := 0.85) -> ShaderMaterial:
	var key := "%s|%.2f|%.2f|%s|%.1f|%.1f|%s|%.2f" % [glass.to_html(), lit, glow, frame.to_html(), floor_h, bay, light.to_html(), metal]
	if _mats.has(key):
		return _mats[key]
	if _shader == null:
		_shader = Shader.new()
		_shader.code = FACADE_SHADER
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("glass", glass)
	m.set_shader_parameter("frame", frame)
	m.set_shader_parameter("light_col", light)
	m.set_shader_parameter("floor_h", floor_h)
	m.set_shader_parameter("bay_w", bay)
	m.set_shader_parameter("lit", lit)
	m.set_shader_parameter("glow", glow)
	m.set_shader_parameter("metal", metal)
	_mats[key] = m
	return m

# --------------------------------------------------------------------------------------------- the builder
var s          # the street slice (street_slice.gd) building this tile
var k := 0
var side := 1.0
var id := ""
var accent := Color.WHITE

func _init(slice, tile: int, sd: float) -> void:
	s = slice
	k = tile
	side = sd
	id = court(tile, sd)
	accent = ACCENT.get(id, Color.WHITE)

## the court's point `d` metres out from the avenue's centre, at tile-local z
func at(d: float, z: float, y := 0.0) -> Vector3:
	return Vector3(side * d, y, z)

## a solid block standing on the ground: the mesh and its obstacle marker
func block(size: Vector3, d: float, z: float, mat: Material, y0 := 0.0, solid := true) -> MeshInstance3D:
	var mi: MeshInstance3D = s._box(size, at(d, z, y0 + size.y * 0.5), mat)
	if solid:
		marker(size, d, z, y0)
	return mi

## an obstacle without a mesh (the box the operator slides around)
func marker(size: Vector3, d: float, z: float, y0 := 0.0) -> void:
	var m := Node3D.new()
	m.position = at(d, z, y0)
	m.set_meta("size", size)
	m.set_meta("file", "district")
	s._root().add_child(m)

func lamp(d: float, z: float, y: float, c: Color, energy := 2.4, rng := 18.0) -> void:
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = energy
	l.omni_range = rng
	l.position = at(d, z, y)
	s._root().add_child(l)

func text(t: String, d: float, z: float, y: float, c: Color, size := 96, px := 0.012, face_avenue := true) -> Label3D:
	var l := Label3D.new()
	l.text = t
	l.font_size = size
	l.pixel_size = px
	l.outline_size = 0
	l.modulate = c * (2.4 if s.night else 1.5)
	l.shaded = false
	l.position = at(d, z, y)
	# a label faces its local +z: toward the avenue is -x on the right side, +x on the left
	l.rotation_degrees.y = (-90.0 if side > 0.0 else 90.0) if face_avenue else (90.0 if side > 0.0 else -90.0)
	s._root().add_child(l)
	return l

func neon(c: Color, strength := 4.0) -> StandardMaterial3D:
	return s._neon_mat(c, strength)

func flat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	return s.flat(c, rough, metal, emit)

func prop(file: String, h: float, d: float, z: float, yaw := 0.0) -> Node3D:
	return s.prop(file, h, at(d, z, 0.18), yaw)

## a fleet hull parked in the court, `length` metres long
func vehicle(file: String, length: float, d: float, z: float, yaw := 0.0, y := 0.18) -> void:
	var path := "res://models/fleet/" + file
	if not ResourceLoader.exists(path):
		return
	var hull := (load(path) as PackedScene).instantiate() as Node3D
	s._fit_length(hull, length)
	hull.position = at(d, z, y)
	hull.rotation_degrees.y = yaw
	StaticBatch.compact(hull)
	var a: AABB = s._aabb(hull)
	var m := Node3D.new()
	m.position = hull.position
	m.rotation_degrees.y = yaw
	m.set_meta("size", Vector3(a.size.x, a.size.y, a.size.z))
	m.set_meta("file", "district-vehicle")
	s._root().add_child(m)
	s._root().add_child(hull)

func build() -> void:
	if id == "":
		return
	_ground()
	_gateway()
	match id:
		"perimeter": _perimeter()
		"citadel": _citadel()
		"spire": _spire()
		"tower": _tower_plaza()
		"apex": _apex()
		"rusty": _rusty()
		"cylinder": _cylinder()
		"warrens": _warrens()
		"bazaar": _bazaar()
		"docks": _docks()
		"marina": _marina()

## the paving from the facade line to the court's back, and the side street's frame of corner blocks
func _ground() -> void:
	var pave: ShaderMaterial = s.paving()
	s._pavings.append(pave)
	if s.night:
		s._wet_paving(pave)
	elif s.style == "nexus":
		s._day_sheen(pave)
	s._box(Vector3(COURT_OUT + 20.0 - FACADE, 0.18, COURT_HALF * 2.0 + 20.0), at((FACADE + COURT_OUT + 20.0) * 0.5, 0.0, 0.09), pave)
	# a kerb line marking the side street's mouth on the avenue walk
	s._box(Vector3(0.3, 0.02, MOUTH_HALF * 2.0), at(FACADE + 0.15, 0.0, 0.19), neon(accent, 1.5))

## the gateway over the side street's mouth: two posts, a lit beam and the district's name, facing the avenue
func _gateway() -> void:
	var post := flat(Color(0.1, 0.1, 0.12), 0.4, 0.7)
	for zz: float in [-MOUTH_HALF + 0.6, MOUTH_HALF - 0.6]:
		block(Vector3(0.7, 8.0, 0.7), FACADE + 2.0, zz, post)
	s._box(Vector3(1.0, 1.4, MOUTH_HALF * 2.0), at(FACADE + 2.0, 0.0, 8.4), post)
	s._box(Vector3(1.06, 0.12, MOUTH_HALF * 2.0), at(FACADE + 2.0, 0.0, 7.7), neon(accent, 4.0))
	var n := String(NAMES[id])
	text(n, FACADE + 1.45, 0.0, 8.45, accent, 96 if n.length() < 22 else 72, 0.011)
	var back := text(n, FACADE + 2.55, 0.0, 8.45, accent, 96 if n.length() < 22 else 72, 0.011, false)
	back.position.y = 8.45
	lamp(FACADE + 4.0, 0.0, 6.0, accent, 1.6, 14.0)

## the corner blocks either side of the side street, and the court's two side walls
func _frame(corner_mat: Material, corner_h: float, wall_mat: Material, wall_h: float) -> void:
	for sz: float in [1.0, -1.0]:
		var zc := sz * (MOUTH_HALF + (COURT_HALF - MOUTH_HALF) * 0.5)
		block(Vector3(MOUTH_OUT - FACADE, corner_h, COURT_HALF - MOUTH_HALF), (FACADE + MOUTH_OUT) * 0.5, zc, corner_mat)
		block(Vector3(COURT_OUT - MOUTH_OUT + 15.0, wall_h, 10.0), (MOUTH_OUT + COURT_OUT + 15.0) * 0.5, sz * (COURT_HALF + 5.0), wall_mat)
		# shopfront glow along the side street, one band per corner block
		s._box(Vector3(MOUTH_OUT - FACADE - 4.0, 0.25, 0.1), at((FACADE + MOUTH_OUT) * 0.5, sz * (MOUTH_HALF - 0.06), 4.2), neon(accent, 2.0))

func _back(mat: Material, h: float, d0 := COURT_OUT, depth := 15.0) -> void:
	block(Vector3(depth, h, COURT_HALF * 2.0 + 20.0), d0 + depth * 0.5, 0.0, mat)

# --------------------------------------------------------------------------------------------- the districts
func _concrete() -> StandardMaterial3D:
	return flat(Color(0.3, 0.31, 0.32), 0.85, 0.05)

func _perimeter() -> void:
	var conc := _concrete()
	_frame(facade(Color(0.2, 0.21, 0.22), 0.1, 0.5, Color(0.28, 0.29, 0.3), 3.6, 4.0, Color(1.0, 0.7, 0.4), 0.2), 9.0, conc, 12.0)
	# the Perimeter Wall: 22 m of concrete at the court's back, a lit parapet walk and a hazard band
	_back(conc, 22.0, COURT_OUT, 8.0)
	s._box(Vector3(8.4, 0.5, COURT_HALF * 2.0 + 20.0), at(COURT_OUT + 4.0, 0.0, 22.25), flat(Color(0.18, 0.18, 0.19), 0.6, 0.4))
	s._box(Vector3(0.12, 0.2, COURT_HALF * 2.0 + 20.0), at(COURT_OUT - 0.08, 0.0, 21.5), neon(accent, 3.0))
	for i in 12:
		s._box(Vector3(0.1, 1.2, 4.0), at(COURT_OUT - 0.06, -COURT_HALF + 6.0 + i * 10.6, 2.2), flat(Color(0.95, 0.75, 0.1) if i % 2 == 0 else Color(0.08, 0.08, 0.08), 0.6))
	# two watchtowers inside the wall with searchlights
	for zz: float in [-42.0, 42.0]:
		var steel := flat(Color(0.22, 0.23, 0.25), 0.5, 0.7)
		for dx: float in [-2.0, 2.0]:
			for dz: float in [-2.0, 2.0]:
				block(Vector3(0.5, 14.0, 0.5), COURT_OUT - 8.0 + dx, zz + dz, steel)
		s._box(Vector3(6.0, 3.2, 6.0), at(COURT_OUT - 8.0, zz, 15.6), facade(Color(0.15, 0.2, 0.25), 0.6, 1.2, Color(0.2, 0.2, 0.22), 3.2, 1.2, Color(1.0, 0.8, 0.5), 0.5))
		s._box(Vector3(6.6, 0.4, 6.6), at(COURT_OUT - 8.0, zz, 17.4), steel)
		var beam := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.4
		cyl.bottom_radius = 6.0
		cyl.height = 40.0
		cyl.radial_segments = 10
		beam.mesh = cyl
		var bm := StandardMaterial3D.new()
		bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		bm.albedo_color = Color(1.0, 0.9, 0.7, 0.07 if s.night else 0.0)
		bm.cull_mode = BaseMaterial3D.CULL_DISABLED
		beam.material_override = bm
		beam.position = at(COURT_OUT - 8.0 - 14.0, zz * 0.6, 26.0)
		beam.rotation_degrees = Vector3(0, 0, 55.0 * side)
		beam.visible = s.night
		s._root().add_child(beam)
	lamp(COURT_OUT - 10.0, 0.0, 12.0, Color(1.0, 0.85, 0.6), 2.4, 40.0)
	# the operations bunker, the barriers and the armour waiting in the yard
	block(Vector3(24.0, 6.0, 18.0), 62.0, -38.0, conc)
	s._box(Vector3(0.1, 1.2, 16.0), at(50.0 - 0.06, -38.0, 4.6), flat(Color(0.05, 0.05, 0.05), 0.5))
	text("PERIMETER OPERATIONS", 49.9, -38.0, 4.65, accent, 72, 0.01)
	s._box(Vector3(0.1, 2.2, 3.0), at(50.0 - 0.07, -32.0, 1.3), neon(Color(1.0, 0.8, 0.5), 1.0))
	var jersey := flat(Color(0.4, 0.4, 0.39), 0.85)
	for i in 6:
		block(Vector3(0.7, 1.0, 3.2), 72.0 + (i % 2) * 6.0, -6.0 + i * 3.8, jersey)
	for i in 5:
		block(Vector3(1.6, 1.1, 2.4), 100.0, -20.0 + i * 2.6, flat(Color(0.42, 0.38, 0.28), 0.95))
	vehicle("goliath-tank.glb", 8.5, 88.0, 26.0, 90.0 * side)
	vehicle("war-rig.glb", 12.0, 112.0, -36.0, 0.0)
	vehicle("security-suv.glb", 5.2, 60.0, 30.0, 180.0)

func _citadel() -> void:
	var steel := flat(Color(0.12, 0.13, 0.15), 0.45, 0.75)
	var glass := facade(Color(0.12, 0.2, 0.28), 0.14, 0.6, Color(0.1, 0.11, 0.13), 3.6, 1.6, Color(0.6, 0.9, 1.0), 0.7)
	_frame(glass, 22.0, steel, 18.0)
	_back(steel, 30.0)
	# the Citadel's keep: three stepped tiers against the back, cyan trim at every step
	block(Vector3(40.0, 14.0, 70.0), 110.0, 0.0, glass)
	s._box(Vector3(30.0, 14.0, 52.0), at(115.0, 0.0, 21.0), glass)
	s._box(Vector3(20.0, 18.0, 32.0), at(120.0, 0.0, 37.0), glass)
	s._box(Vector3(1.2, 26.0, 1.2), at(120.0, 0.0, 59.0), steel)
	for tier in [[90.0, 14.0, 70.0], [100.0, 28.0, 52.0], [110.0, 46.0, 32.0]]:
		s._box(Vector3(0.2, 0.25, float(tier[2]) + 0.4), at(float(tier[0]) - 0.1, 0.0, float(tier[1])), neon(accent, 4.0))
	text("VANGUARD COMMAND CITADEL", 89.8, 0.0, 12.4, accent, 120, 0.02)
	# the gate: two bastions and a lit doorway
	for zz: float in [-9.0, 9.0]:
		block(Vector3(6.0, 10.0, 5.0), 88.0, zz, steel)
	s._box(Vector3(0.2, 6.0, 12.0), at(89.9, 0.0, 3.2), neon(accent * 0.5, 1.2))
	# the parade ground: painted lines and four flag masts with the Vanguard colours
	var paint := flat(Color(0.8, 0.82, 0.85), 0.5)
	for i in 4:
		s._box(Vector3(40.0, 0.02, 0.25), at(65.0, -36.0 + i * 24.0, 0.19), paint)
	for zz: float in [-48.0, -24.0, 24.0, 48.0]:
		block(Vector3(0.35, 16.0, 0.35), 62.0, zz, flat(Color(0.7, 0.72, 0.75), 0.3, 0.8))
		var flag: MeshInstance3D = s._box(Vector3(0.08, 2.4, 3.6), at(62.0, zz + 1.9 * signf(zz), 14.4), flat(Color(0.08, 0.2, 0.42), 0.8))
		s._box(Vector3(0.1, 0.25, 3.6), at(62.0, zz + 1.9 * signf(zz), 13.3), neon(accent, 3.0))
		flag.rotation_degrees.y = 0.0
	# guard turrets at the court corners and the Vanguard's vehicles
	for zz: float in [-52.0, 52.0]:
		block(Vector3(3.0, 3.0, 3.0), 48.0, zz, steel)
		s._box(Vector3(3.6, 0.8, 1.0), at(48.0, zz, 3.4), steel)
	vehicle("security-suv.glb", 5.2, 72.0, 44.0, 0.0)
	vehicle("security-suv.glb", 5.2, 78.0, 44.0, 0.0)
	vehicle("armored-muscle.glb", 5.0, 72.0, -46.0, 180.0)
	lamp(86.0, 0.0, 8.0, accent, 2.6, 30.0)
	lamp(60.0, 0.0, 10.0, Color(0.85, 0.9, 1.0), 1.6, 34.0)

func _spire() -> void:
	var lux := facade(Color(0.42, 0.55, 0.68), 0.22 if s.night else 0.06, 1.1, Color(0.7, 0.72, 0.75), 3.6, 1.8, Color(1.0, 0.9, 0.75), 0.9)
	var gold := facade(Color(0.55, 0.48, 0.36), 0.2 if s.night else 0.05, 1.0, Color(0.32, 0.27, 0.2), 3.4, 1.4, Color(1.0, 0.85, 0.6), 0.9)
	_frame(lux, 70.0 if k % 2 == 0 else 92.0, gold, 48.0)
	# the twin residences at the back and a sky bridge between them
	var a := 150.0 if side < 0.0 else 128.0
	block(Vector3(28.0, a, 40.0), COURT_OUT + 14.0, -38.0, lux)
	block(Vector3(28.0, a * 0.86, 40.0), COURT_OUT + 14.0, 38.0, gold)
	block(Vector3(16.0, 26.0, 36.0), COURT_OUT + 8.0, 0.0, lux)
	s._box(Vector3(10.0, 6.0, 40.0), at(COURT_OUT + 14.0, 0.0, a * 0.62), lux)
	s._box(Vector3(10.2, 0.2, 40.0), at(COURT_OUT + 14.0, 0.0, a * 0.62 - 3.0), neon(Color(0.85, 0.95, 1.0), 3.0))
	for zz: float in [-38.0, 38.0]:
		s._box(Vector3(28.4, 0.4, 40.4), at(COURT_OUT + 14.0, zz, (a if zz < 0.0 else a * 0.86) + 0.2), neon(Color(0.85, 0.95, 1.0), 2.0))
	text("THE SPIRE DISTRICT", COURT_OUT - 0.3, 0.0, 20.0, accent, 160, 0.032)
	# the sky garden: a fountain, blossom trees, benches and the drop-off
	var stone := flat(Color(0.4, 0.4, 0.42), 0.5)
	var fountain := MeshInstance3D.new()
	var basin := CylinderMesh.new()
	basin.top_radius = 9.0
	basin.bottom_radius = 9.4
	basin.height = 0.8
	basin.radial_segments = 32
	fountain.mesh = basin
	fountain.material_override = stone
	fountain.position = at(82.0, 0.0, 0.58)
	s._root().add_child(fountain)
	marker(Vector3(17.0, 0.9, 17.0), 82.0, 0.0, 0.18)
	var water := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = 8.4
	disc.bottom_radius = 8.4
	disc.height = 0.05
	disc.radial_segments = 32
	water.mesh = disc
	water.material_override = flat(Color(0.2, 0.6, 0.8), 0.05, 0.3, 0.8 if s.night else 0.2)
	water.position = at(82.0, 0.0, 0.95)
	s._root().add_child(water)
	var jet := MeshInstance3D.new()
	var col := CylinderMesh.new()
	col.top_radius = 0.15
	col.bottom_radius = 0.7
	col.height = 6.0
	col.radial_segments = 12
	jet.mesh = col
	jet.material_override = neon(Color(0.6, 0.9, 1.0), 1.6)
	jet.position = at(82.0, 0.0, 4.0)
	s._root().add_child(jet)
	var bark := flat(Color(0.16, 0.12, 0.1), 0.9)
	var bloom := flat(Color(0.98, 0.55, 0.75), 0.9, 0.0, 0.25)
	for i in 6:
		var dz: float = [-46.0, 26.0, 46.0][i % 3]     # off the walk in from the side street
		var dd := 58.0 if i < 3 else 108.0
		block(Vector3(0.45, 3.4, 0.45), dd, dz, bark, 0.18)
		for b in 3:
			var mi := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 1.6 + b * 0.25
			sm.height = sm.radius * 1.7
			sm.radial_segments = 10
			sm.rings = 5
			mi.mesh = sm
			mi.material_override = bloom
			mi.position = at(dd + (b - 1) * 0.9, dz + (b % 2) * 0.8, 3.9 + b * 0.5)
			s._root().add_child(mi)
	for zz: float in [-20.0, 20.0]:
		prop("street/bench-neon.glb", 1.0, 82.0, zz, 0.0)
		prop("planter.glb", 2.2, 70.0, zz * 1.6, 0.0)
		prop("planter.glb", 2.2, 96.0, zz * 1.6, 0.0)
	vehicle("concept-gt.glb", 4.6, 52.0, 30.0, 0.0)
	vehicle("hover-car.glb", 5.0, 52.0, -30.0, 180.0)
	lamp(82.0, 0.0, 8.0, Color(0.7, 0.9, 1.0), 2.4, 30.0)

## the plaza round the Central Tower (the tower itself is `central_tower`, built with the world)
func _tower_plaza() -> void:
	var glass := facade(Color(0.3, 0.42, 0.56), 0.24 if s.night else 0.06, 1.2, Color(0.14, 0.15, 0.17), 3.4, 1.5, Color(0.7, 0.92, 1.0), 0.9)
	_frame(glass, 46.0, glass, 30.0)
	# a low glass balustrade at the back so the tower stands clear
	block(Vector3(1.0, 1.2, COURT_HALF * 2.0), COURT_OUT + 4.0, 0.0, flat(Color(0.3, 0.45, 0.55), 0.1, 0.6))
	var stone := flat(Color(0.42, 0.43, 0.46), 0.5, 0.1)
	# the lit ring of bollards round the base and the forecourt steps
	for i in 20:
		var a := TAU * i / 20.0
		var p := Vector2(cos(a), sin(a)) * 34.0
		var dd := absf(TOWER_POS.x) + p.x
		if dd < MOUTH_OUT + 2.0:
			continue
		block(Vector3(0.35, 1.1, 0.35), dd, p.y, flat(Color(0.1, 0.1, 0.12), 0.4, 0.6), 0.18)
		s._box(Vector3(0.38, 0.14, 0.38), at(dd, p.y, 1.05), neon(accent, 3.0))
	for i in 3:
		s._box(Vector3(4.0 - i, 0.25, 30.0 - i * 4.0), at(absf(TOWER_POS.x) - 24.0 - 2.0 + i * 1.0, 0.0, 0.3 + i * 0.25), stone)
	# security kiosks either side of the forecourt and the holo sign
	for zz: float in [-16.0, 16.0]:
		block(Vector3(2.4, 2.8, 2.4), 58.0, zz, flat(Color(0.1, 0.12, 0.15), 0.4, 0.6), 0.18)
		s._box(Vector3(2.5, 0.2, 2.5), at(58.0, zz, 3.1), neon(accent, 3.0))
	text("TECH FACTION", 52.0, 0.0, 9.0, accent, 160, 0.014)
	text("CENTRAL TOWER  ·  420 M", 52.0, 0.0, 6.6, Color(0.85, 0.95, 1.0), 80, 0.012)
	lamp(60.0, 0.0, 10.0, accent, 2.0, 34.0)

## the tallest building in the game (owner, Nov 9: 420 m in Nexus City; the Neon City Grand Casino is second at 380 m)
static func central_tower(slice, parent: Node3D) -> Node3D:
	var root := Node3D.new()
	root.position = TOWER_POS
	root.name = "central_tower"
	parent.add_child(root)
	var night: bool = slice.night
	var glass := facade(Color(0.22, 0.32, 0.44), 0.14 if night else 0.04, 0.55 if night else 0.2, Color(0.1, 0.11, 0.13), 3.6, 1.2, Color(1.0, 0.86, 0.62), 0.9)
	var trim: StandardMaterial3D = slice._neon_mat(Color(0.3, 0.9, 1.0), 3.0)
	# podium, shaft, two setbacks, the crown and the mast: 60 + 240 + 60 + 25 + 15 + 20 = 420 m
	var stages := [[46.0, 0.0, 60.0], [38.0, 60.0, 240.0], [32.0, 300.0, 60.0], [24.0, 360.0, 25.0], [16.0, 385.0, 15.0]]
	for st in stages:
		var w := float(st[0])
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(w, float(st[2]), w)
		mi.mesh = bm
		mi.material_override = glass
		mi.position = Vector3(0, float(st[1]) + float(st[2]) * 0.5, 0)
		root.add_child(mi)
		var band := MeshInstance3D.new()
		var bb := BoxMesh.new()
		bb.size = Vector3(w + 0.4, 0.5, w + 0.4)
		band.mesh = bb
		band.material_override = trim
		band.position = Vector3(0, float(st[1]) + float(st[2]) - 0.25, 0)
		root.add_child(band)
	# the mast: the last 20 m, a red beacon at the tip
	var mast := MeshInstance3D.new()
	var mm := CylinderMesh.new()
	mm.top_radius = 0.4
	mm.bottom_radius = 1.6
	mm.height = 20.0
	mm.radial_segments = 8
	mast.mesh = mm
	mast.material_override = slice.flat(Color(0.75, 0.78, 0.82), 0.3, 0.8)
	mast.position = Vector3(0, 400.0 + 10.0, 0)
	root.add_child(mast)
	var beacon := MeshInstance3D.new()
	var sp := SphereMesh.new()
	sp.radius = 1.0
	sp.height = 2.0
	sp.radial_segments = 8
	sp.rings = 4
	beacon.mesh = sp
	beacon.material_override = slice._neon_mat(Color(1.0, 0.15, 0.1), 8.0)
	beacon.position = Vector3(0, TOWER_H, 0)
	root.add_child(beacon)
	# lit vertical fins up the shaft's four corners
	for cx: float in [-1.0, 1.0]:
		for cz: float in [-1.0, 1.0]:
			var fin := MeshInstance3D.new()
			var fb := BoxMesh.new()
			fb.size = Vector3(0.4, 300.0, 0.4)
			fin.mesh = fb
			fin.material_override = trim
			fin.position = Vector3(cx * 19.1, 60.0 + 150.0, cz * 19.1)
			root.add_child(fin)
	# the tower's name high on the shaft, both faces down the avenue
	for f: float in [1.0, -1.0]:
		var l := Label3D.new()
		l.text = "TECH FACTION"
		l.font_size = 256
		l.pixel_size = 0.06
		l.outline_size = 0
		l.modulate = Color(0.5, 0.95, 1.0) * (2.4 if night else 1.2)
		l.shaded = false
		l.position = Vector3(0, 330.0, f * 16.3)
		l.rotation.y = 0.0 if f > 0.0 else PI
		root.add_child(l)
	var m := Node3D.new()
	m.set_meta("size", Vector3(46.0, 60.0, 46.0))
	m.set_meta("file", "central-tower")
	m.position = TOWER_POS
	return m

func _apex() -> void:
	var glass := facade(Color(0.2, 0.32, 0.3), 0.2 if s.night else 0.05, 1.0, Color(0.12, 0.13, 0.14), 3.4, 1.6, Color(0.7, 1.0, 0.85), 0.85)
	var dark := flat(Color(0.08, 0.09, 0.1), 0.4, 0.6)
	_frame(glass, 30.0, glass, 22.0)
	_back(glass, 40.0)
	# the store: a 35 m hall against the back, all glass at the front, the APEX GEAR sign on its roofline
	block(Vector3(35.0, 12.0, 80.0), 95.0 + 17.5, 0.0, dark)
	var front: MeshInstance3D = s._box(Vector3(0.2, 9.0, 70.0), at(95.0 - 0.1, 0.0, 4.68), flat(Color(0.25, 0.9, 0.55) * 0.3, 0.05, 0.4, 0.6 if s.night else 0.2))
	front.transparency = 0.0
	s._box(Vector3(0.3, 0.3, 80.0), at(95.0 - 0.15, 0.0, 9.4), neon(accent, 5.0))
	text("APEX GEAR", 94.7, 0.0, 10.8, accent, 200, 0.016)
	text("WEAPONS · ARMOUR · KIT", 94.7, 0.0, 8.0, Color(0.85, 1.0, 0.9), 64, 0.011)
	# the door, lit
	s._box(Vector3(0.25, 3.6, 4.0), at(94.9, 0.0, 1.98), neon(accent * 0.7, 1.6))
	# display plinths out front with the authored weapons on them
	var guns := ["rifle.glb", "rifle-sniper.glb", "shotgun.glb", "heavy.glb", "launcher.glb", "rifle-smg.glb"]
	for i in guns.size():
		var zz := -30.0 + i * 12.0
		if absf(zz) < 4.0:
			zz += 6.0
		block(Vector3(2.0, 1.1, 2.0), 86.0, zz, flat(Color(0.12, 0.13, 0.15), 0.3, 0.7), 0.18)
		s._box(Vector3(2.1, 0.08, 2.1), at(86.0, zz, 1.3), neon(accent, 2.0))
		s.prop("../weapons/" + guns[i], 0.32, at(86.0, zz, 1.34), 90.0)
	# armoured mannequins (the robot operator look stands in) and the queue rail
	for zz: float in [-40.0, 40.0]:
		block(Vector3(1.2, 2.0, 1.2), 70.0, zz, flat(Color(0.2, 0.22, 0.25), 0.4, 0.6), 0.18)
	for i in 8:
		s._box(Vector3(0.08, 1.0, 0.08), at(82.0, -6.0 + i * 1.6, 0.68), flat(Color(0.7, 0.72, 0.75), 0.3, 0.8))
	vehicle("armored-muscle.glb", 5.0, 56.0, -40.0, 0.0)
	lamp(88.0, 0.0, 6.0, accent, 2.6, 26.0)
	lamp(60.0, 30.0, 7.0, Color(0.85, 1.0, 0.92), 1.2, 22.0)

func _rusty() -> void:
	var brick := facade(Color(0.32, 0.18, 0.14), 0.16 if s.night else 0.04, 0.7, Color(0.22, 0.12, 0.1), 3.0, 2.2, Color(1.0, 0.6, 0.35), 0.1)
	var grime := flat(Color(0.18, 0.16, 0.15), 0.95, 0.1)
	_frame(brick, 18.0, brick, 16.0)
	_back(brick, 20.0)
	# the shop: a steel door under a red neon trigger in the back wall
	s._box(Vector3(0.3, 3.4, 3.0), at(COURT_OUT - 0.15, 0.0, 1.88), flat(Color(0.2, 0.2, 0.22), 0.5, 0.8))
	s._box(Vector3(0.2, 0.15, 3.4), at(COURT_OUT - 0.3, 0.0, 3.75), neon(accent, 5.0))
	text("RUSTY TRIGGER", COURT_OUT - 0.4, 0.0, 7.4, accent, 160, 0.03)
	text("NO QUESTIONS", COURT_OUT - 0.4, 0.0, 4.9, Color(1.0, 0.75, 0.3), 64, 0.016)
	# the alley: chain-link fence, dumpsters, drums, pallets, a wreck and graffiti
	var fence := flat(Color(0.3, 0.32, 0.34), 0.6, 0.7)
	fence.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fence.albedo_color.a = 0.28     # chain-link: you see the alley through it
	for zz: float in [-30.0, 30.0]:
		block(Vector3(40.0, 3.2, 0.1), 70.0, zz, fence)
		for i in 6:
			s._box(Vector3(0.12, 3.4, 0.12), at(50.0 + i * 8.0, zz, 1.88), flat(Color(0.3, 0.32, 0.34), 0.6, 0.7))
	for i in 4:
		block(Vector3(3.6, 1.6, 1.9), 100.0 + (i % 2) * 14.0, -50.0 + i * 30.0, flat(Color(0.12, 0.28, 0.16), 0.8, 0.4), 0.18)
	var drum := flat(Color(0.45, 0.2, 0.1), 0.85, 0.5)
	for i in 9:
		var mi := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.42
		cyl.bottom_radius = 0.42
		cyl.height = 1.0
		cyl.radial_segments = 10
		mi.mesh = cyl
		mi.material_override = drum
		var dd := 112.0 + (i % 3) * 1.0
		var zz := 18.0 + int(i / 3) * 1.0
		mi.position = at(dd, zz, 0.68)
		s._root().add_child(mi)
	marker(Vector3(3.4, 1.0, 3.4), 113.0, 19.0, 0.18)
	for i in 5:
		block(Vector3(1.2, 0.14 * (1 + i % 3), 1.0), 60.0 + i * 3.0, -46.0, flat(Color(0.45, 0.35, 0.22), 0.95), 0.18, false)
	prop("wreck.glb", 1.5, 76.0, 46.0, 30.0)
	for i in 5:
		var c: Color = [Color(1.0, 0.2, 0.6), Color(0.2, 1.0, 0.6), Color(1.0, 0.8, 0.1), Color(0.3, 0.6, 1.0), Color(1.0, 0.3, 0.1)][i]
		s._box(Vector3(6.0, 2.4, 0.08), at(56.0 + i * 15.0, (COURT_HALF - 0.08) * (1.0 if i % 2 == 0 else -1.0), 2.6), flat(c * 0.4, 0.8, 0.0, 0.6 if s.night else 0.1))
	vehicle("raider-buggy.glb", 4.5, 88.0, 48.0, 140.0)
	lamp(COURT_OUT - 6.0, 0.0, 5.0, accent, 2.6, 20.0)
	lamp(70.0, 0.0, 6.0, Color(1.0, 0.6, 0.3), 1.2, 24.0)

func _cylinder() -> void:
	var shed := flat(Color(0.32, 0.3, 0.27), 0.7, 0.4)
	var steel := flat(Color(0.18, 0.18, 0.19), 0.5, 0.7)
	_frame(facade(Color(0.25, 0.24, 0.22), 0.12 if s.night else 0.03, 0.7, Color(0.2, 0.19, 0.17), 4.0, 3.0, Color(1.0, 0.75, 0.4), 0.3), 16.0, shed, 14.0)
	_back(shed, 18.0)
	# the motorworks hall: 38 m deep, three roll-up bays open onto the yard, the sign across the top
	block(Vector3(36.0, 14.0, 96.0), 94.0 + 18.0, 0.0, shed)
	for zz: float in [-28.0, 0.0, 28.0]:
		s._box(Vector3(0.25, 7.0, 10.0), at(94.0 - 0.1, zz, 3.68), flat(Color(0.95, 0.85, 0.65) * 0.45, 0.4, 0.0, 1.4 if s.night else 0.5))
		s._box(Vector3(0.4, 0.3, 11.0), at(94.0 - 0.2, zz, 7.4), neon(accent, 4.0))
	s._box(Vector3(0.6, 3.0, 96.0), at(94.0 - 0.3, 0.0, 12.0), steel)
	text("CYLINDER & CO", 93.25, 0.0, 12.0, accent, 200, 0.03)
	text("HEAVY MOTORWORKS · OFF-ROAD · ARMOUR", 93.25, 0.0, 9.4, Color(1.0, 0.9, 0.7), 64, 0.016)
	# the yard: trucks waiting on the apron, tyre stacks, drums, a lift
	vehicle("offroad-truck.glb", 5.6, 72.0, -28.0, 90.0)
	vehicle("war-rig.glb", 12.0, 68.0, 34.0, 0.0)
	vehicle("raider-buggy.glb", 4.5, 80.0, 12.0, -40.0)
	var rubber := flat(Color(0.06, 0.06, 0.06), 0.9)
	for st in [[56.0, -50.0], [58.0, -46.0], [110.0, 54.0]]:
		for h in 4:
			var t := MeshInstance3D.new()
			var tor := TorusMesh.new()
			tor.inner_radius = 0.38
			tor.outer_radius = 0.65
			tor.rings = 12
			tor.ring_segments = 6
			t.mesh = tor
			t.material_override = rubber
			t.position = at(float(st[0]), float(st[1]), 0.36 + h * 0.3)
			s._root().add_child(t)
		marker(Vector3(1.4, 1.3, 1.4), float(st[0]), float(st[1]), 0.18)
	block(Vector3(6.0, 0.3, 2.6), 64.0, -14.0, flat(Color(0.75, 0.2, 0.15), 0.5, 0.6), 1.4, false)
	for zz: float in [-15.0, -13.0]:
		block(Vector3(0.35, 1.5, 0.35), 64.0, zz, steel, 0.18)
	lamp(90.0, 0.0, 10.0, Color(1.0, 0.85, 0.6), 2.4, 32.0)
	lamp(60.0, 0.0, 7.0, accent, 1.2, 22.0)

func _warrens() -> void:
	var hab := facade(Color(0.36, 0.3, 0.26), 0.34 if s.night else 0.05, 0.9, Color(0.26, 0.22, 0.2), 2.9, 2.0, Color(1.0, 0.72, 0.42), 0.1)
	var hab2 := facade(Color(0.3, 0.33, 0.36), 0.3 if s.night else 0.05, 0.9, Color(0.22, 0.24, 0.26), 2.9, 2.2, Color(1.0, 0.8, 0.55), 0.1)
	_frame(hab, 34.0, hab2, 40.0)
	_back(hab, 46.0)
	# hab blocks inside the court too: two stacks with a gap to walk through
	block(Vector3(22.0, 30.0, 34.0), 104.0, -34.0, hab2)
	block(Vector3(22.0, 26.0, 34.0), 104.0, 34.0, hab)
	# fire stairs zig-zagging up the blocks, AC units, laundry strung between them
	var rail := flat(Color(0.15, 0.15, 0.16), 0.5, 0.8)
	for zz: float in [-34.0, 34.0]:
		for f in 8:
			s._box(Vector3(1.6, 0.12, 6.0), at(92.2, zz, 3.0 + f * 3.0), rail)
			s._box(Vector3(0.08, 0.9, 6.0), at(91.4, zz, 3.5 + f * 3.0), rail)
	var ac := flat(Color(0.55, 0.56, 0.55), 0.6, 0.4)
	for i in 14:
		s._box(Vector3(0.9, 0.7, 1.1), at(MOUTH_OUT + 0.5, (MOUTH_HALF + 4.0 + (i % 7) * 7.0) * (1.0 if i < 7 else -1.0), 6.0 + (i % 4) * 5.5), ac)
	var cloth: Array = [Color(0.85, 0.2, 0.25), Color(0.2, 0.5, 0.9), Color(0.95, 0.85, 0.3), Color(0.9, 0.9, 0.9)]
	for i in 6:
		var y := 8.0 + i * 3.0
		var zz := -20.0 + i * 8.0
		s._box(Vector3(46.0, 0.03, 0.03), at(MOUTH_OUT + 23.0 + 23.0, zz, y), rail)
		for j in 7:
			s._box(Vector3(0.9, 1.1, 0.04), at(MOUTH_OUT + 6.0 + j * 6.0 + 6.0, zz, y - 0.6), flat(cloth[(i + j) % cloth.size()], 0.9))
	# the street-food stall under a warm awning, tables out front
	block(Vector3(4.0, 2.4, 6.0), 56.0, -44.0, flat(Color(0.5, 0.2, 0.12), 0.6), 0.18)
	s._box(Vector3(6.0, 0.15, 8.0), at(57.0, -44.0, 3.0), flat(Color(0.95, 0.6, 0.2), 0.7, 0.0, 0.6 if s.night else 0.0))
	text("MAMA KAI'S NOODLES", 53.9, -44.0, 3.7, Color(1.0, 0.75, 0.4), 56, 0.01)
	for i in 3:
		prop("cafe-set.glb", 0.95, 62.0 + i * 3.4, -36.0, i * 25.0)
	# the basketball court: lines and two hoops
	var line := flat(Color(0.95, 0.95, 0.9), 0.5, 0.0, 0.3 if s.night else 0.0)
	var cx := 70.0
	for d in [[28.0, 0.12, 0.0, 15.0], [28.0, 0.12, 0.0, -15.0], [0.12, 30.0, -14.0, 0.0], [0.12, 30.0, 14.0, 0.0], [0.12, 30.0, 0.0, 0.0]]:
		s._box(Vector3(float(d[0]), 0.02, float(d[1])), at(cx + float(d[2]), float(d[3]), 0.19), line)
	for e: float in [-1.0, 1.0]:
		block(Vector3(0.25, 3.6, 0.25), cx + e * 15.0, 0.0, flat(Color(0.3, 0.3, 0.32), 0.4, 0.7), 0.18)
		s._box(Vector3(0.1, 1.1, 1.8), at(cx + e * 14.7, 0.0, 3.6), flat(Color(0.95, 0.95, 0.95), 0.4))
		var ring := MeshInstance3D.new()
		var tr := TorusMesh.new()
		tr.inner_radius = 0.22
		tr.outer_radius = 0.26
		tr.rings = 12
		tr.ring_segments = 4
		ring.mesh = tr
		ring.material_override = flat(Color(1.0, 0.4, 0.1), 0.4, 0.6)
		ring.position = at(cx + e * 14.3, 0.0, 3.2)
		s._root().add_child(ring)
	lamp(cx, 0.0, 9.0, Color(1.0, 0.9, 0.7), 2.4, 30.0)
	lamp(57.0, -44.0, 3.5, Color(1.0, 0.65, 0.3), 1.6, 12.0)

func _bazaar() -> void:
	var scrap := facade(Color(0.28, 0.24, 0.2), 0.14 if s.night else 0.03, 0.8, Color(0.24, 0.2, 0.16), 3.2, 2.6, Color(1.0, 0.7, 0.4), 0.4)
	var rust := flat(Color(0.38, 0.22, 0.12), 0.9, 0.5)
	_frame(scrap, 16.0, rust, 12.0)
	_back(rust, 16.0)
	text("SCRAPYARD BAZAAR", COURT_OUT - 0.2, 0.0, 12.5, accent, 170, 0.015)
	# market stalls in rows: posts, a coloured canopy, a counter of goods, a lantern
	var post := flat(Color(0.2, 0.18, 0.16), 0.7, 0.5)
	var canopy: Array = [Color(0.85, 0.25, 0.3), Color(0.2, 0.55, 0.8), Color(0.9, 0.7, 0.2), Color(0.3, 0.7, 0.4), Color(0.75, 0.35, 0.8)]
	var n := 0
	for row in 3:
		for col in 4:
			var dd := 56.0 + row * 20.0
			var zz := -42.0 + col * 28.0
			if absf(zz) < 10.0:
				zz += 10.0 * signf(zz + 0.01)
			for cz: float in [-1.6, 1.6]:
				for cd: float in [-1.6, 1.6]:
					s._box(Vector3(0.12, 2.6, 0.12), at(dd + cd, zz + cz, 1.48), post)
			s._box(Vector3(4.0, 0.12, 4.0), at(dd, zz, 2.85), flat(canopy[n % canopy.size()], 0.8))
			block(Vector3(3.4, 1.0, 1.0), dd, zz - 1.2, flat(Color(0.35, 0.28, 0.2), 0.9), 0.18)
			s._box(Vector3(3.0, 0.3, 0.8), at(dd, zz - 1.2, 1.33), flat(canopy[(n + 2) % canopy.size()] * 0.6, 0.6, 0.4))
			s._box(Vector3(0.3, 0.4, 0.3), at(dd, zz, 2.55), neon(Color(1.0, 0.75, 0.4), 2.5))
			n += 1
	# scrap piles and the crane's rusted boom over them
	for i in 6:
		var mi: MeshInstance3D = s._box(Vector3(3.0 + i % 3, 1.0 + (i % 2) * 0.8, 2.4), at(118.0 - (i % 2) * 4.0, -40.0 + i * 15.0, 0.6), rust)
		mi.rotation_degrees = Vector3(0, i * 23.0, 8.0 * ((i % 3) - 1))
		marker(Vector3(4.6, 1.6, 4.0), 118.0 - (i % 2) * 4.0, -40.0 + i * 15.0, 0.18)
	prop("wreck.glb", 1.5, 108.0, 52.0, -20.0)
	block(Vector3(2.0, 20.0, 2.0), 122.0, -56.0, rust)
	s._box(Vector3(30.0, 1.4, 1.4), at(108.0, -56.0, 19.0), rust)
	lamp(80.0, 0.0, 8.0, Color(1.0, 0.7, 0.45), 2.2, 34.0)
	lamp(110.0, 30.0, 6.0, accent, 1.0, 18.0)

func _docks() -> void:
	var shed := facade(Color(0.24, 0.28, 0.32), 0.1 if s.night else 0.02, 0.7, Color(0.2, 0.22, 0.25), 5.0, 4.0, Color(0.8, 0.9, 1.0), 0.4)
	var steel := flat(Color(0.25, 0.27, 0.3), 0.5, 0.7)
	_frame(shed, 14.0, shed, 16.0)
	# no back block: the quay edge and the sea beyond it
	var quay := flat(Color(0.32, 0.32, 0.33), 0.8)
	block(Vector3(1.0, 1.1, COURT_HALF * 2.0 + 20.0), COURT_OUT - 0.5, 0.0, flat(Color(0.95, 0.75, 0.1), 0.5, 0.4), 0.18)
	s._box(Vector3(4.0, 3.0, COURT_HALF * 2.0 + 20.0), at(COURT_OUT + 2.0, 0.0, -1.3), quay)
	_sea(COURT_OUT + 4.0, 260.0)
	# the Dockside Storage warehouse along the yard's west side and the container stacks
	block(Vector3(30.0, 14.0, 40.0), 64.0, -38.0, shed)
	text("DOCKSIDE STORAGE", 48.8, -38.0, 11.0, accent, 110, 0.012)
	var box_cols: Array = [Color(0.75, 0.2, 0.15), Color(0.15, 0.35, 0.65), Color(0.85, 0.55, 0.1), Color(0.2, 0.5, 0.3), Color(0.6, 0.6, 0.62)]
	var i := 0
	for row in 4:
		for col in 3:
			var dd := 88.0 + col * 11.0
			var zz := -48.0 + row * 14.0
			var stack := 1 + (row + col) % 3
			for t in stack:
				s._box(Vector3(2.6, 2.6, 12.0), at(dd, zz + 4.0, 0.18 + 1.3 + t * 2.6), flat(box_cols[i % box_cols.size()], 0.75, 0.3))
				i += 1
			marker(Vector3(2.6, 2.6 * stack, 12.0), dd, zz + 4.0, 0.18)
	# the gantry crane over the stacks
	for zz: float in [-56.0, 30.0]:
		for dd: float in [82.0, 124.0]:
			block(Vector3(1.6, 30.0, 1.6), dd, zz, steel, 0.18)
	s._box(Vector3(44.0, 2.2, 2.4), at(103.0, -56.0, 30.0), steel)
	s._box(Vector3(44.0, 2.2, 2.4), at(103.0, 30.0, 30.0), steel)
	s._box(Vector3(3.0, 2.0, 88.0), at(103.0, -13.0, 31.0), flat(Color(0.95, 0.65, 0.1), 0.5, 0.5))
	# bollards along the quay and the patrol boat moored off it
	for j in 9:
		block(Vector3(0.6, 0.8, 0.6), COURT_OUT - 2.0, -56.0 + j * 14.0, flat(Color(0.12, 0.12, 0.12), 0.6, 0.6), 0.18)
	_moor("scrap-patrol-boat.glb", 16.0, COURT_OUT + 18.0, 10.0, 0.0)
	lamp(103.0, -13.0, 26.0, Color(0.85, 0.92, 1.0), 2.6, 60.0)
	lamp(60.0, -10.0, 6.0, accent, 1.2, 22.0)

func _marina() -> void:
	var white := facade(Color(0.55, 0.62, 0.7), 0.18 if s.night else 0.04, 0.9, Color(0.82, 0.84, 0.86), 3.4, 1.8, Color(0.85, 1.0, 0.95), 0.6)
	var shed := flat(Color(0.2, 0.3, 0.34), 0.5, 0.6)
	_frame(white, 20.0, white, 18.0)
	# the basin fills the court's +z half: a quay rail round it, the water down at -1 m, pontoons and the boats
	var rail := flat(Color(0.32, 0.34, 0.37), 0.4, 0.8)
	block(Vector3(COURT_OUT - MOUTH_OUT - 10.0, 1.1, 0.15), (MOUTH_OUT + COURT_OUT + 10.0) * 0.5, 4.0, rail, 0.18)
	marker(Vector3(COURT_OUT - MOUTH_OUT - 10.0, 1.1, COURT_HALF - 4.0), (MOUTH_OUT + COURT_OUT + 10.0) * 0.5, 4.0 + (COURT_HALF - 4.0) * 0.5, 0.18)
	var water := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(COURT_OUT - MOUTH_OUT - 10.0 + 150.0, COURT_HALF - 4.0)
	water.mesh = plane
	water.material_override = _water_mat()
	water.position = at((MOUTH_OUT + 10.0 + COURT_OUT + 150.0) * 0.5, 4.0 + (COURT_HALF - 4.0) * 0.5, -0.4)
	s._root().add_child(water)
	# the paving over the basin is cut away: a dark wall face drops to the water along the rail
	s._box(Vector3(COURT_OUT - MOUTH_OUT - 10.0, 0.2, COURT_HALF - 4.0), at((MOUTH_OUT + COURT_OUT + 10.0) * 0.5, 4.0 + (COURT_HALF - 4.0) * 0.5, 0.19), _water_mat())
	var deck := flat(Color(0.5, 0.4, 0.3), 0.85)
	for j in 3:
		s._box(Vector3(2.0, 0.3, 40.0), at(64.0 + j * 22.0, 28.0, 0.25), deck)
	_moor("hydro-sub-skiff.glb", 9.0, 75.0, 22.0, 0.0)
	_moor("void-skimmer.glb", 8.0, 97.0, 40.0, 180.0)
	_moor("scrap-patrol-boat.glb", 14.0, 116.0, 26.0, 0.0)
	text("MARINA", 50.0, 30.0, 7.0, accent, 150, 0.014)
	# the Aqua-Tech Shipyard on the -z half: an open hall with a hull on the slipway
	block(Vector3(56.0, 22.0, 4.0), 98.0, -COURT_HALF + 2.0, shed)
	block(Vector3(4.0, 22.0, 46.0), COURT_OUT - 2.0, -36.0, shed)
	s._box(Vector3(60.0, 1.5, 50.0), at(98.0, -37.0, 22.0), shed)
	s._box(Vector3(60.0, 0.3, 0.3), at(98.0, -12.0, 21.0), neon(accent, 4.0))
	text("AQUA-TECH SHIPYARD", 67.8, -36.0, 18.0, accent, 120, 0.013)
	var hull := flat(Color(0.75, 0.78, 0.8), 0.35, 0.6)
	block(Vector3(30.0, 7.0, 9.0), 100.0, -36.0, hull, 1.2)
	s._box(Vector3(20.0, 4.0, 6.0), at(104.0, -36.0, 10.2), hull)
	for j in 6:
		s._box(Vector3(0.6, 1.2, 10.0), at(88.0 + j * 5.0, -36.0, 0.78), flat(Color(0.2, 0.2, 0.22), 0.6, 0.6))
	# the yard's back between the shipyard and the basin rail
	block(Vector3(1.0, 1.1, 17.0), COURT_OUT - 0.5, -4.5, rail, 0.18)
	# welding glow inside the hall
	lamp(100.0, -30.0, 8.0, Color(0.5, 0.8, 1.0), 2.4, 30.0)
	lamp(80.0, 30.0, 7.0, accent, 1.6, 30.0)

func _water_mat() -> StandardMaterial3D:
	var m := flat(Color(0.03, 0.08, 0.12), 0.04, 0.2)
	m.metallic_specular = 0.9
	return m

## the sea past the quay: one plane, the batcher leaves it alone (no repeats)
func _sea(d0: float, width: float) -> void:
	var sea := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(width, COURT_HALF * 2.0 + 160.0)
	sea.mesh = plane
	sea.material_override = _water_mat()
	sea.position = at(d0 + width * 0.5, 0.0, -1.0)
	s._root().add_child(sea)

## a boat on the water (the hull floats with its keel just under the surface)
func _moor(file: String, length: float, d: float, z: float, yaw: float) -> void:
	var path := "res://models/fleet/" + file
	if not ResourceLoader.exists(path):
		return
	var hull := (load(path) as PackedScene).instantiate() as Node3D
	s._fit_length(hull, length)
	hull.position = at(d, z, -1.0)
	hull.rotation_degrees.y = yaw
	StaticBatch.compact(hull)
	s._root().add_child(hull)

# --------------------------------------------------------------------------------------------- the avenue's two ends
## the North Gate across the avenue at the head of tile -3 (visual: the district's bounds stop the operator before it)
static func north_gate(slice, z_local: float) -> void:
	var conc: StandardMaterial3D = slice.flat(Color(0.3, 0.31, 0.32), 0.85, 0.05)
	var amber := Color(1.0, 0.55, 0.12)
	slice._box(Vector3(60.0, 22.0, 6.0), Vector3(0, 11.0, z_local - 3.0), conc)
	slice._box(Vector3(18.0, 9.0, 0.6), Vector3(0, 4.5, z_local + 0.2), slice.flat(Color(0.16, 0.17, 0.18), 0.5, 0.7))
	slice._box(Vector3(18.4, 0.25, 0.7), Vector3(0, 9.2, z_local + 0.3), slice._neon_mat(amber, 4.0))
	for x: float in [-1.0, 1.0]:
		slice._box(Vector3(6.0, 30.0, 8.0), Vector3(x * 12.0, 15.0, z_local - 2.0), conc)
		slice._box(Vector3(6.2, 0.3, 8.2), Vector3(x * 12.0, 29.0, z_local - 2.0), slice._neon_mat(amber, 3.0))
	var l := Label3D.new()
	l.text = "NORTH GATE · PERIMETER"
	l.font_size = 128
	l.pixel_size = 0.014
	l.outline_size = 0
	l.modulate = amber * (2.4 if slice.night else 1.4)
	l.shaded = false
	l.position = Vector3(0, 13.0, z_local + 0.2)
	slice._root().add_child(l)
	var lt := OmniLight3D.new()
	lt.light_color = amber
	lt.light_energy = 2.0
	lt.omni_range = 26.0
	lt.position = Vector3(0, 10.0, z_local + 6.0)
	slice._root().add_child(lt)

## the quay at the foot of tile 3: a rail across the avenue's end and the sea beyond it
static func south_quay(slice, z_local: float) -> void:
	slice._box(Vector3(60.0, 1.1, 0.2), Vector3(0, 0.73, z_local), slice.flat(Color(0.85, 0.87, 0.9), 0.3, 0.8))
	slice._box(Vector3(60.0, 3.0, 4.0), Vector3(0, -1.3, z_local + 2.0), slice.flat(Color(0.32, 0.32, 0.33), 0.8))
	var sea := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(900.0, 700.0)
	sea.mesh = plane
	var m: StandardMaterial3D = slice.flat(Color(0.03, 0.08, 0.12), 0.04, 0.2)
	m.metallic_specular = 0.9
	sea.material_override = m
	sea.position = Vector3(0, -1.0, z_local + 350.0)
	slice._root().add_child(sea)
	var l := Label3D.new()
	l.text = "SOUTHERN DOCKS"
	l.font_size = 128
	l.pixel_size = 0.014
	l.outline_size = 0
	l.modulate = Color(0.35, 0.75, 1.0) * (2.4 if slice.night else 1.4)
	l.shaded = false
	l.rotation.y = PI
	l.position = Vector3(0, 5.0, z_local + 0.3)
	slice._root().add_child(l)

## distant towers behind a tile's courts: the skyline down the whole avenue, not only round the hub
static func tile_skyline(slice, rng: RandomNumberGenerator) -> void:
	for i in 6:
		var sd := -1.0 if i % 2 == 0 else 1.0
		var h := rng.randf_range(70.0, 200.0)
		var w := rng.randf_range(20.0, 34.0)
		var glass := Color(0.24 + 0.1 * rng.randf(), 0.34 + 0.08 * rng.randf(), 0.46 + 0.08 * rng.randf())
		var m := facade(Color(snappedf(glass.r, 0.05), snappedf(glass.g, 0.05), snappedf(glass.b, 0.05)), 0.22 if slice.night else 0.05, 0.9 if slice.night else 0.35)
		slice._box(Vector3(w, h, w), Vector3(sd * rng.randf_range(175.0, 260.0), h * 0.5, rng.randf_range(-110.0, 110.0)), m)
