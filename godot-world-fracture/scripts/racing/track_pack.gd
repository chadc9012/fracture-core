extends RefCounted
## Track Pack 01 (the owner's eight tracks, Nov 11: docs/reference/racing/track-pack-01/): the centre lines and checkpoints
## come from their tracks.json (copied to data/track_pack_01.json), full scale — 12 to 86 km a lap. What the game adds per
## track is here: where it is, the time of day, laps (the board's range; the lobby picks), the prize, the rivals, and the
## width it's driven at. The owner's meshes are 38–75 m wide (NOTES.md flags that as a modelling default, three to six
## times a real road); `width` is the driven width and `owner_width` keeps theirs — change one number to go back.
## track.gd turns a def into a Track like any venue; pack_venue.gd builds the scenery. Pure, no nodes.

const DATA := "res://data/track_pack_01.json"
## the racing board's three tracks beyond the pack (no route files came with them: tools/make_board_tracks.py lays them
## out at the board's lengths)
const DATA_BOARD := "res://data/track_pack_board.json"

const TRACKS := {
	"neon-midnight-run": { "src": "Neon_Midnight_Run", "region": "Neon City", "style": "Underground street circuit",
		"env": "city", "laps": 3, "lap_range": [3, 5], "width": 16.0, "prize": [6000, 3000, 1500, 500],
		"rivals": ["Ghost", "Vex", "Nightjar"] },
	"neon-ring-express": { "src": "Neon_Ring_Express", "region": "Neon City", "style": "Elevated highway circuit",
		"env": "highway-night", "laps": 3, "lap_range": [3, 7], "width": 20.0, "prize": [9000, 4500, 2200, 700],
		"rivals": ["Nightjar", "Sable", "Vex"] },
	"nexus-grand-prix": { "src": "Nexus_Grand_Prix", "region": "Nexus City", "style": "Professional city circuit",
		"env": "circuit", "laps": 5, "lap_range": [5, 10], "width": 16.0, "prize": [15000, 7500, 3800, 1200],
		"rivals": ["K. Voss", "Mara Lin", "D. Okafor"] },
	"nexus-outlaw-highway": { "src": "Nexus_Outlaw_Highway", "region": "Nexus Region", "style": "Highway run",
		"env": "highway", "laps": 1, "lap_range": [1, 2], "width": 20.0, "prize": [9000, 4500, 2200, 700],
		"rivals": ["Rook", "Sable", "Kilo"] },
	"glass-flats-rally": { "src": "Glass_Flats_Rally", "region": "Solara Desert", "style": "Desert rally",
		"env": "desert", "laps": 1, "lap_range": [1, 1], "width": 22.0, "prize": [20000, 10000, 5000, 1500],
		"rivals": ["Dune", "Marlin", "Rook"], "offroad": true },
	"frostveil-summit": { "src": "Frostveil_Summit", "region": "Frostveil", "style": "Mountain and glacier",
		"env": "snow", "laps": 2, "lap_range": [2, 4], "width": 14.0, "prize": [18000, 9000, 4500, 1400],
		"rivals": ["Ryu", "Sable", "Juno"], "offroad": true },
	"azure-coastal-rush": { "src": "Azure_Coastal_Rush", "region": "Azure Isles", "style": "Coastal road",
		"env": "coast", "laps": 3, "lap_range": [3, 6], "width": 16.0, "prize": [12000, 6000, 3000, 900],
		"rivals": ["Marlin", "Juno", "Reef"] },
	"azure-hover-challenge": { "src": "Azure_Hover_Challenge", "region": "Azure Isles", "style": "Water and hovercraft",
		"env": "water", "laps": 3, "lap_range": [3, 5], "width": 30.0, "prize": [11000, 5500, 2700, 800],
		"rivals": ["Reef", "Marlin", "Juno"], "hover": true },
	"eldergrove-circuit": { "src": "Eldergrove_Circuit", "region": "Eldergrove", "style": "Forest / technical",
		"env": "forest", "laps": 3, "lap_range": [3, 6], "width": 14.0, "prize": [14000, 7000, 3500, 1100],
		"rivals": ["Ryu", "Juno", "Rook"] },
	"obsidian-volcano-run": { "src": "Obsidian_Volcano_Run", "region": "Obsidian Reach", "style": "Volcanic / endurance",
		"env": "volcano", "laps": 2, "lap_range": [2, 4], "width": 16.0, "prize": [22000, 11000, 5500, 1700],
		"rivals": ["Dune", "Sable", "Nightjar"], "offroad": true },
	"shattered-expanse-gp": { "src": "Shattered_Expanse_GP", "region": "Shattered Expanse", "style": "Fracture / high risk",
		"env": "fracture", "laps": 3, "lap_range": [3, 7], "width": 16.0, "prize": [24000, 12000, 6000, 1800],
		"rivals": ["Ghost", "Nightjar", "Vex"] },
}

static var _cache := {}

static func ids() -> Array:
	return TRACKS.keys()

static func has(id: String) -> bool:
	return TRACKS.has(id)

## the owner's data for one track: {name, target_km, environment, road_width_m, centerline_xyz, checkpoints}
static func source(id: String) -> Dictionary:
	if _cache.is_empty():
		for path in [DATA, DATA_BOARD]:
			var f := FileAccess.open(path, FileAccess.READ)
			if f:
				var d: Variant = JSON.parse_string(f.get_as_text())
				if d is Dictionary:
					for t in d.get("tracks", []):
						_cache[String(t.id)] = t
	return _cache.get(String(TRACKS.get(id, {}).get("src", "")), {})

## a track.gd def: the owner's centre line as the control points (closed), the start at their checkpoint 0
static func def(id: String) -> Dictionary:
	var t: Dictionary = TRACKS.get(id, {})
	var src := source(id)
	if t.is_empty() or src.is_empty():
		return {}
	var d := t.duplicate(true)
	d.name = String(src.name)
	d.kind = "pack"
	d.points = src.centerline_xyz
	d.checkpoints = src.get("checkpoints", [])
	d.owner_width = float(src.get("road_width_m", 0.0))
	d.target_km = float(src.get("target_km", 0.0))
	d.start = 0.0
	return d
