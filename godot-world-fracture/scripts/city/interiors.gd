extends RefCounted
## The city's walk-in buildings (owner's asset board part 2, §2 "Realistic buildings & interiors", Nov 8): a hospital,
## police station, fire station, hotel, nightclub, restaurant, school, office floor and underground car park, each a
## room you walk into from the Nexus avenue. The shopping mall is the Galleria (mall_interior.gd).
##
## Pure data, node-free: interior_view.gd builds a room from its ROOMS row (shell, light, sound) and its kind's set from
## interior_sets.gd; street_slice.gd draws each building's frontage from `door_rows()` and main.gd `_street_door` opens the
## view. Add a building as a ROOMS row + a set builder named after its kind, never a new view.
##
## Room space: x across (-w/2..w/2), z from the street door (0) inwards to -d, floor at y 0. The operator walks in at
## (0, 0, -3.5) facing -z; the way out is the door at z 0.

const ROOMS := {
	"hospital": {
		"label": "NEXUS GENERAL HOSPITAL", "kind": "hospital", "w": 32.0, "d": 26.0, "h": 5.0,
		"floor": ["marble_01", Color(0.9, 0.93, 0.94), 3.0], "wall": Color(0.88, 0.91, 0.92), "trim": Color(0.1, 0.62, 0.66),
		"light": Color(0.95, 0.98, 1.0), "ambient": 0.9, "bed": "nexus-hum",
		"street": { "x": 1.0, "z": 122.0, "color": Color(0.95, 0.2, 0.22) },
	},
	"police": {
		"label": "NXPD FIRST PRECINCT", "kind": "police", "w": 30.0, "d": 24.0, "h": 4.6,
		"floor": ["concrete_floor", Color(0.72, 0.74, 0.78), 3.0], "wall": Color(0.62, 0.66, 0.7), "trim": Color(0.08, 0.2, 0.5),
		"light": Color(0.92, 0.95, 1.0), "ambient": 0.7, "bed": "nexus-hum",
		"street": { "x": 1.0, "z": 100.0, "color": Color(0.25, 0.5, 1.0) },
	},
	"fire": {
		"label": "FIRE STATION 9", "kind": "fire", "w": 30.0, "d": 26.0, "h": 8.0,
		"floor": ["concrete_floor", Color(0.66, 0.67, 0.68), 3.0], "wall": Color(0.72, 0.36, 0.28), "trim": Color(0.8, 0.08, 0.06),
		"light": Color(1.0, 0.95, 0.85), "ambient": 0.65, "bed": "nexus-hum",
		"street": { "x": 1.0, "z": -96.0, "color": Color(1.0, 0.25, 0.1) },
	},
	"hotel": {
		"label": "THE MERIDIAN HOTEL", "kind": "hotel", "w": 34.0, "d": 28.0, "h": 9.0,
		"floor": ["marble_01", Color(0.96, 0.92, 0.86), 4.0], "wall": Color(0.55, 0.45, 0.36), "trim": Color(0.85, 0.66, 0.32),
		"light": Color(1.0, 0.85, 0.62), "ambient": 0.55, "bed": "nexus-hum",
		"street": { "x": -1.0, "z": -20.0, "color": Color(1.0, 0.8, 0.45) },
	},
	"nightclub": {
		"label": "PULSE NIGHTCLUB", "kind": "nightclub", "w": 30.0, "d": 26.0, "h": 7.0,
		"floor": ["concrete_floor", Color(0.18, 0.17, 0.2), 3.0], "wall": Color(0.07, 0.06, 0.09), "trim": Color(0.9, 0.2, 1.0),
		"light": Color(0.7, 0.3, 1.0), "ambient": 0.3, "bed": "neon-hum",
		"street": { "x": -1.0, "z": 70.0, "color": Color(0.95, 0.25, 1.0) },
	},
	"restaurant": {
		"label": "OSTERIA LUNA", "kind": "restaurant", "w": 26.0, "d": 22.0, "h": 4.5,
		"floor": ["wood_floor", Color(0.85, 0.75, 0.65), 2.0], "wall": Color(0.45, 0.28, 0.2), "trim": Color(0.95, 0.72, 0.4),
		"light": Color(1.0, 0.78, 0.5), "ambient": 0.5, "bed": "nexus-hum",
		"street": { "x": 1.0, "z": 56.0, "color": Color(1.0, 0.7, 0.35) },
	},
	"school": {
		"label": "NEXUS ACADEMY", "kind": "school", "w": 28.0, "d": 24.0, "h": 4.2,
		"floor": ["floor_tiles_06", Color(0.78, 0.82, 0.76), 1.5], "wall": Color(0.86, 0.84, 0.76), "trim": Color(0.15, 0.4, 0.75),
		"light": Color(1.0, 0.98, 0.92), "ambient": 0.85, "bed": "nexus-hum",
		"street": { "x": -1.0, "z": 92.0, "color": Color(0.4, 0.75, 1.0) },
	},
	"office": {
		"label": "VANTA SYSTEMS", "kind": "office", "w": 32.0, "d": 26.0, "h": 4.2,
		"floor": ["fabric_pattern_07", Color(0.42, 0.44, 0.48), 1.0], "wall": Color(0.82, 0.83, 0.85), "trim": Color(0.2, 0.85, 0.95),
		"light": Color(0.95, 0.97, 1.0), "ambient": 0.8, "bed": "nexus-hum",
		"street": { "x": 1.0, "z": -56.0, "color": Color(0.2, 0.85, 0.95) },
	},
	"parking": {
		"label": "UNDERGROUND PARKING", "kind": "parking", "w": 40.0, "d": 34.0, "h": 3.6,
		"floor": ["asphalt_02", Color(0.55, 0.55, 0.56), 4.0], "wall": Color(0.55, 0.55, 0.53), "trim": Color(0.95, 0.78, 0.1),
		"light": Color(0.85, 0.95, 1.0), "ambient": 0.45, "bed": "nexus-hum",
		"street": { "x": -1.0, "z": -62.0, "color": Color(0.25, 0.55, 1.0) },
	},
}

static func has(id: String) -> bool:
	return ROOMS.has(id)

static func room(id: String) -> Dictionary:
	return ROOMS.get(id, {})

## the street_slice.gd DOORS rows for every building (kind "front": interior_sets.gd draws the frontage)
static func door_rows() -> Array:
	var out := []
	for id in ROOMS:
		var r: Dictionary = ROOMS[id]
		out.append({ "id": id, "label": r.label, "x": r.street.x, "z": r.street.z, "color": r.street.color, "kind": "front" })
	return out

## where the operator stands on walking in, and the door's use spot
static func spawn(r: Dictionary) -> Vector3:
	return Vector3(0, 0, -3.5)

static func exit_spot(r: Dictionary) -> Vector3:
	return Vector3(0, 0, -0.9)

## the walkable floor (operator bounds), inset from the walls
static func bounds(r: Dictionary) -> Rect2:
	var w: float = r.w
	var d: float = r.d
	return Rect2(-w * 0.5 + 0.5, -d + 0.5, w - 1.0, d - 0.6)
