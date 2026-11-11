extends Control
const Sound := preload("res://scripts/audio/sound.gd")
const Phone := preload("res://scripts/phone.gd")
const Grade := preload("res://scripts/grade.gd")
const Flora := preload("res://scripts/region_flora.gd")
const Weather := preload("res://scripts/region_weather.gd")
const Barks := preload("res://scripts/cinema/barks.gd")
## A region in 3D (owner's map packs: "3D City" and "Street View"), built from the same data as its map: the ground from the
## exported height grid, coloured by land cover; the sea; every building extruded to its height with floors and windows; the
## roads, bridges, rails and paved ground; domes, arenas and hazard rings; forests and crystal fields; the Storm Islands in the
## sky; place names. Each region gets its own sky and light after the owner's target frames: gritty daylight in the wilds with
## the giant cracked planet overhead, Nexus and Neon City at night with wet streets and lit windows, Ember Peaks under ash,
## Thalassia under the sea.
##
##  - 3D CITY: an orbit camera. Drag to turn, pinch / wheel / buttons to zoom, the arrows to move, double-tap the ground to go there.
##  - STREET VIEW: stand at a place at eye height. Drag to look round, hold ▲ / ▼ to walk, JUMP TO another place.

signal closed

enum Mode { CITY, STREET, PLAY }

const EYE := 1.7
const TREE_CAP := 9000
# Adjustable city-detail switches for testing on slower hardware.
const CITY_ROOF_ACCESSORIES := true
const CITY_ROAD_MARKINGS := true
const CITY_FACADE_FINS := true
const CITY_MAX_FACADE_FIN_BUILDINGS := 120
const CITY_MAX_ROOF_DETAIL_BUILDINGS := 300
const CITY_MAX_ROAD_PAINT_SEGMENTS := 18000
const WALL := {
	"apartment": "#a49c90", "house": "#9a7462", "store": "#b9bfc4", "mall": "#c9d0d6", "school": "#b09a78", "entertainment": "#8a6d86",
	"office": "#7d8a96", "civic": "#bdb4a2", "industrial": "#857d72", "transport": "#97a0a8", "garage": "#74777c", "dome": "#a8d6e2",
}
const ROAD := {
	"highway": "#34373b", "main": "#3b3e42", "street": "#3e4146", "track": "#7a5f40", "runway": "#2c2e31", "taxiway": "#3a3c40",
	"bridge": "#5a5e63", "boardwalk": "#8a6a45", "rail": "#4a4d52", "trail": "#6e5536", "skybridge": "#5d5873",
}

var map_id := ""
## the named supertall landmarks drawn by _build_landmarks instead of the plain extrusion (map data: carto-features.ts)
const Nexus := preload("res://scripts/region_nexus.gd")
const LANDMARKS := ["Nexus Core Spire", "Neon City Grand Casino", "The Fracture Spire", "Lighthouse Point", "Nexus Beach Wheel"]
var _landmark_bds: Array = []
var _spin: Array[Node3D] = []
var m: Dictionary = {}
## the season the regions are shown in (owner's Planetary World Overview board: spring, summer, autumn, winter across all
## regions); -1 follows the real calendar. Kept across regions; the header's button steps it.
static var season := -1
const SEASONS := ["SPRING", "SUMMER", "AUTUMN", "WINTER"]
## the lands that stay as they are all year: the tropics, the deserts, the fire, the ice, the deep
const NO_WINTER := ["azure-isles", "shattered-reefs", "solara", "wastelands", "ember", "crystal-badlands", "thalassia", "frostveil", "frostspire", "neon-city", "nexus", "nexus-region"]
const EVERGREEN := ["nexus-region", "nexus", "azure-isles", "shattered-reefs", "solara", "wastelands", "ember", "crystal-badlands", "thalassia", "frostveil", "frostspire"]
var _season_btn: Button
var _ground_mat: ShaderMaterial
var _height_tex: ImageTexture  # the ground heights as a float texture (terrain slopes, water depth)
var _base_pal := PackedVector3Array()
var _tree_mats: Array[ShaderMaterial] = []
var _weather: Node3D
var _barks: Control   # the region's ambient voices, in Street View (the owner's campaign draft, AMB_*)
var mode: Mode = Mode.CITY
var _ox := 0.0
var _oz := 0.0
var _span := 1000.0
var _water := -2.5
var _hn := 2
var _heights := PackedFloat32Array()
var _vp: SubViewport
var _world: Node3D
var _cam: Camera3D
var _env: Environment
var _title: Label
var _head: Control
var _zoom_buttons: Control
var _mode_btn: Button
var _jump: OptionButton
var _pad_city: Control
var _pad_street: Control
var _style: Dictionary = {}
# orbit
var _target := Vector3.ZERO
var _yaw := 0.6
var _pitch := 38.0
var _dist := 220.0
# street
var _eye := Vector3.ZERO
var _look_yaw := 0.0
var _look_pitch := 0.0
var _walk := 0.0
var _move := Vector2.ZERO
var _touches := {}
var _pinch_d := 0.0
var _moved := 0.0
var _last_tap := 0

func _ready() -> void:
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.add_theme_constant_override("separation", 0)
	add_child(col)
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", Data.box(Data.BG, Data.RULE, 0))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 10)
	head.add_child(hb)
	_head = head
	var back := Data.button("← MAP")
	back.pressed.connect(func(): closed.emit())
	hb.add_child(back)
	_title = Data.label("", 18)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(_title)
	_season_btn = Data.button(SEASONS[current_season()])
	_season_btn.pressed.connect(func():
		season = (current_season() + 1) % 4
		_apply_season())
	hb.add_child(_season_btn)
	_mode_btn = Data.button("STREET VIEW", true)
	_mode_btn.pressed.connect(func(): set_mode(Mode.STREET if mode == Mode.CITY else Mode.CITY))
	hb.add_child(_mode_btn)
	col.add_child(head)
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	svc.mouse_filter = Control.MOUSE_FILTER_STOP
	svc.gui_input.connect(_input_3d)
	col.add_child(svc)
	_vp = SubViewport.new()
	Phone.fit_viewport(_vp)
	_vp.own_world_3d = true
	svc.add_child(_vp)
	# the controls over the view
	_pad_city = _pad([["◀", Vector2(-1, 0)], ["▲", Vector2(0, -1)], ["▼", Vector2(0, 1)], ["▶", Vector2(1, 0)]], true)
	svc.add_child(_pad_city)
	_pad_street = _pad([["▲", Vector2(0, -1)], ["▼", Vector2(0, 1)]], false)
	svc.add_child(_pad_street)
	var zb := VBoxContainer.new()
	zb.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	zb.position = Vector2(-62, 12)
	for z in [["+", 0.7], ["−", 1.4]]:
		var b := Data.button(z[0])
		b.custom_minimum_size = Vector2(48, 48)
		b.pressed.connect(func(): _zoom(z[1]))
		zb.add_child(b)
	svc.add_child(zb)
	_zoom_buttons = zb
	_jump = OptionButton.new()
	_jump.position = Vector2(10, 10)
	_jump.add_theme_font_size_override("font_size", 14)
	_jump.item_selected.connect(_on_jump)
	svc.add_child(_jump)

## a hold-to-move pad: four arrows to slide the 3D City, two to walk in Street View
func _pad(keys: Array, four: bool) -> Control:
	var g := GridContainer.new()
	g.columns = 3 if four else 1
	g.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	g.position = Vector2(14, -170 if four else -120)
	var cells: Array = [null, keys[1], null, keys[0], null, keys[3], null, keys[2], null] if four else keys
	for k in cells:
		if k == null:
			var sp := Control.new()
			sp.custom_minimum_size = Vector2(52, 52)
			g.add_child(sp)
			continue
		var b := Data.button(k[0])
		b.custom_minimum_size = Vector2(52, 52)
		var dir: Vector2 = k[1]
		b.button_down.connect(func(): _move = dir)
		b.button_up.connect(func(): _move = Vector2.ZERO)
		g.add_child(b)
	return g

# ---------------- civic roofs and mountain rock ----------------

## Low civic buildings (Riverdale's Town Hall, clock towers) were flat-topped boxes under the office window grid and read as
## office blocks. Give them a stone cornice and a pitched slate roof along their long side; a clock tower gets a spire and
## a clock face on each side.
func _build_civic_roofs() -> void:
	var roofs := SurfaceTool.new()
	roofs.begin(Mesh.PRIMITIVE_TRIANGLES)
	var any := false
	var slate := Color("#4a4f57")
	var stone := Color("#d8cfbb")
	var clocks: Array[Transform3D] = []
	for bd in m.buildings:
		if _is_landmark(bd):
			continue
		if String(bd[5]) != "civic" or _bh(bd) > 25.0:
			continue
		var p := _loc(bd[0], bd[1])
		var hx: float = bd[2]
		var hz: float = bd[3]
		var yaw: float = bd[4]
		var top := _h(p.x, p.y) + _bh(bd)
		var c := cos(yaw)
		var sn := sin(yaw)
		var w := func(lx: float, lz: float, y: float) -> Vector3:
			return Vector3(p.x + lx * c + lz * sn, y, p.y - lx * sn + lz * c)
		var name := String(bd[7]) if bd.size() > 7 else ""
		var tower := name.containsn("clock") or (hx < 3.5 and hz < 3.5 and _bh(bd) > 9.0)
		var o := 0.35 # the cornice's overhang
		var add := func(a: Vector3, b: Vector3, cc: Vector3, col: Color) -> void:
			var n := (b - a).cross(cc - a).normalized()
			if n.y < -0.01:
				n = -n
			for v in [a, b, cc]:
				roofs.set_normal(n)
				roofs.set_color(col)
				roofs.add_vertex(v)
		# cornice slab
		var k0 = [w.call(-hx - o, -hz - o, top), w.call(hx + o, -hz - o, top), w.call(hx + o, hz + o, top), w.call(-hx - o, hz + o, top)]
		var k1 = [w.call(-hx - o, -hz - o, top + 0.5), w.call(hx + o, -hz - o, top + 0.5), w.call(hx + o, hz + o, top + 0.5), w.call(-hx - o, hz + o, top + 0.5)]
		for f in 4:
			add.call(k0[f], k0[(f + 1) % 4], k1[(f + 1) % 4], stone)
			add.call(k0[f], k1[(f + 1) % 4], k1[f], stone)
		var base := top + 0.5
		if tower:
			var apex: Vector3 = w.call(0, 0, base + maxf(hx, hz) * 2.6)
			for f in 4:
				add.call(k1[f], k1[(f + 1) % 4], apex, slate)
			for f in 4:
				var ang := yaw + f * PI / 2.0
				var out := Vector3(sin(ang), 0, cos(ang))
				clocks.append(Transform3D(Basis.looking_at(out, Vector3.UP).scaled(Vector3(hx * 0.7, hx * 0.7, 0.08)),
					Vector3(p.x, top - 1.6, p.y) + out * (maxf(hx, hz) + 0.06)))
		else:
			# a gable roof along the long side
			var along_x := hx >= hz
			var rise := minf(hx, hz) * 0.55
			var r0: Vector3
			var r1: Vector3
			if along_x:
				r0 = w.call(-hx - o, 0, base + rise)
				r1 = w.call(hx + o, 0, base + rise)
				add.call(k1[0], k1[1], r1, slate)
				add.call(k1[0], r1, r0, slate)
				add.call(k1[2], k1[3], r0, slate)
				add.call(k1[2], r0, r1, slate)
				add.call(k1[1], k1[2], r1, stone) # gable ends
				add.call(k1[3], k1[0], r0, stone)
			else:
				r0 = w.call(0, -hz - o, base + rise)
				r1 = w.call(0, hz + o, base + rise)
				add.call(k1[1], k1[2], r1, slate)
				add.call(k1[1], r1, r0, slate)
				add.call(k1[3], k1[0], r0, slate)
				add.call(k1[3], r0, r1, slate)
				add.call(k1[0], k1[1], r0, stone)
				add.call(k1[2], k1[3], r1, stone)
		any = true
	if not any:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = roofs.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.8
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = mat
	_world.add_child(mi)
	if not clocks.is_empty():
		var face := CylinderMesh.new()
		face.top_radius = 1.0
		face.bottom_radius = 1.0
		face.height = 1.0
		face.radial_segments = 20
		var fm := StandardMaterial3D.new()
		fm.albedo_color = Color("#f2ead0")
		fm.emission_enabled = true
		fm.emission = Color("#fff3c4")
		fm.emission_energy_multiplier = 0.4 + _style.night
		# cylinders stand on Y; lay each face flat against its wall
		var lay := Basis(Vector3.RIGHT, PI / 2.0)
		var xf: Array[Transform3D] = []
		for t in clocks:
			xf.append(Transform3D(t.basis * lay, t.origin))
		_multimesh(face, xf, fm, 600.0, false)

## Snow and lava mountains read as one smooth cone: scatter rock outcrops where the ground is steep and high
func _build_slope_rock() -> void:
	if map_id not in ["frostspire", "ember", "crystal-badlands", "wastelands", "frostveil"]:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(map_id) + 7
	var rocks: Array[Transform3D] = []
	var step := _span / 160.0
	var lo := INF
	var hi := -INF
	for v in _heights:
		lo = minf(lo, v)
		hi = maxf(hi, v)
	for j in 160:
		for i in 160:
			var lx := -_span / 2.0 + (i + rng.randf()) * step
			var lz := -_span / 2.0 + (j + rng.randf()) * step
			var y := _h(lx, lz)
			if y < _water + 1.0:
				continue
			var gx := _h(lx + 2.0, lz) - _h(lx - 2.0, lz)
			var gz := _h(lx, lz + 2.0) - _h(lx, lz - 2.0)
			var slope := sqrt(gx * gx + gz * gz) / 4.0 # rise over run
			var high := (y - lo) / maxf(1.0, hi - lo)
			# outcrops, not a coat: the snow (or ash, or sand) stays the slope's colour and the rock breaks it up
			if slope < 0.8 or rng.randf() > 0.06 + high * 0.1:
				continue
			var s := rng.randf_range(1.2, 3.0) * (1.0 + slope * 0.3)
			# rocks may cluster into an outcrop, but never through a tree
			if not _space_free(lx, lz, s * 0.9):
				continue
			rocks.append(Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.4, 0.4), rng.randf() * TAU, rng.randf_range(-0.4, 0.4))).scaled(Vector3(s * 1.4, s * 0.8, s)), Vector3(lx, y - s * 0.25, lz)))
	if rocks.is_empty():
		return
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 6
	mesh.rings = 3
	var mat := StandardMaterial3D.new()
	mat.albedo_color = {"frostspire": Color("#6d737d"), "frostveil": Color("#3a3e46"), "ember": Color("#2a2420"), "crystal-badlands": Color("#6b4e5e"), "wastelands": Color("#7a5a3e")}.get(map_id, Color("#555555"))
	mat.roughness = 0.95
	_multimesh(mesh, rocks, mat, 700.0, false)

# ---------------- building the region ----------------

const RUIN_RADIUS := 45.0
var _ruins: Array = []

## Buildings at a ruins site (Verdant's Ancient Ruins, the Swamps' Drowned Ruins, ...) come through the export as ordinary
## offices and houses; drawn as such they read as a business park in the woods. Take them out of the city passes (windows,
## rooftops, fins, entrances) and keep them for _build_ruins.
func _split_ruins() -> void:
	_ruins = []
	var sites: Array[Vector2] = []
	for p in m.get("pois", []):
		if String(p.get("cat", "")) == "ruins":
			sites.append(Vector2(p.x, p.z))
	if sites.is_empty():
		return
	var keep: Array = []
	for bd in m.get("buildings", []):
		var at := Vector2(bd[0], bd[1])
		var ruin := false
		for c in sites:
			if at.distance_to(c) <= RUIN_RADIUS:
				ruin = true
				break
		if ruin:
			_ruins.append(bd)
		else:
			keep.append(bd)
	if _ruins.is_empty():
		return
	m = m.duplicate()
	m.buildings = keep

## each ruin: its footprint's walls broken into jagged stretches of moss-stained stone, no roof, toppled columns and rubble
func _build_ruins() -> void:
	if _ruins.is_empty():
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(map_id)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var stone := Color("#9a9483")
	var moss := Color("#5d7a42")
	var rubble: Array[Transform3D] = []
	var columns: Array[Transform3D] = []
	var quad := func(a: Vector3, b: Vector3, c: Vector3, d: Vector3, ca: Color, cb: Color) -> void:
		var n := (b - a).cross(d - a).normalized()
		for tri in [[a, b, c, ca, ca, cb], [a, c, d, ca, cb, cb]]:
			st.set_normal(n)
			st.set_color(tri[3])
			st.add_vertex(tri[0])
			st.set_color(tri[4])
			st.add_vertex(tri[1])
			st.set_color(tri[5])
			st.add_vertex(tri[2])
	for bd in _ruins:
		var p := _loc(bd[0], bd[1])
		var hx: float = minf(float(bd[2]), 9.0)
		var hz: float = minf(float(bd[3]), 9.0)
		var yaw: float = bd[4]
		var full := clampf(_bh(bd) * 0.3, 3.0, 8.0) # what's left standing: a storey or two at most
		var c := cos(yaw)
		var sn := sin(yaw)
		var corners: Array[Vector2] = []
		for uv in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			corners.append(Vector2(p.x + uv.x * hx * c + uv.y * hz * sn, p.y - uv.x * hx * sn + uv.y * hz * c))
		const THICK := 0.7
		for f in 4:
			var a: Vector2 = corners[f]
			var b: Vector2 = corners[(f + 1) % 4]
			var along := a.distance_to(b)
			var dir := (b - a) / along
			var inward := Vector2(-dir.y, dir.x)
			var pieces := maxi(2, int(along / 2.2))
			for i in pieces:
				if rng.randf() < 0.22:
					continue # a gap where the wall has fallen
				var u0 := a + dir * (along * i / pieces)
				var u1 := a + dir * (along * (i + 1) / pieces)
				var g0 := _h(u0.x, u0.y) - 0.4
				var g1 := _h(u1.x, u1.y) - 0.4
				# each stretch keeps a flat top at its own height: stepped like masonry that lost its upper courses
				var left := full * rng.randf_range(0.2, 1.0)
				var h0 := maxf(g0, g1) + left
				var h1 := h0
				var i0 := u0 + inward * THICK
				var i1 := u1 + inward * THICK
				var top_col := stone.lerp(moss, rng.randf_range(0.15, 0.4))
				quad.call(Vector3(u0.x, g0, u0.y), Vector3(u1.x, g1, u1.y), Vector3(u1.x, h1, u1.y), Vector3(u0.x, h0, u0.y), stone.darkened(0.15), top_col)
				quad.call(Vector3(i1.x, g1, i1.y), Vector3(i0.x, g0, i0.y), Vector3(i0.x, h0, i0.y), Vector3(i1.x, h1, i1.y), stone.darkened(0.25), top_col)
				quad.call(Vector3(u0.x, h0, u0.y), Vector3(u1.x, h1, u1.y), Vector3(i1.x, h1, i1.y), Vector3(i0.x, h0, i0.y), moss, moss)
		# fallen stone round the walls, and a column or two lying in the grass
		for r in 10:
			var q := p + Vector2(rng.randf_range(-1.4, 1.4) * hx, rng.randf_range(-1.4, 1.4) * hz)
			var sz := rng.randf_range(0.4, 1.3)
			rubble.append(Transform3D(Basis.from_euler(Vector3(rng.randf(), rng.randf() * TAU, rng.randf())).scaled(Vector3(sz * 1.3, sz * 0.8, sz)), Vector3(q.x, _h(q.x, q.y) + sz * 0.2, q.y)))
		for col in 2:
			var q2 := p + Vector2(rng.randf_range(-1.6, 1.6) * hx, rng.randf_range(-1.6, 1.6) * hz)
			var standing := rng.randf() < 0.4
			var ch := rng.randf_range(3.0, 6.0)
			var basis := Basis(Vector3.UP, rng.randf() * TAU) if standing else Basis.from_euler(Vector3(PI / 2.0, rng.randf() * TAU, 0))
			var y := _h(q2.x, q2.y) + (ch / 2.0 if standing else 0.45)
			columns.append(Transform3D(basis.scaled(Vector3(1, ch, 1)), Vector3(q2.x, y, q2.y)))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.97
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = mat
	_world.add_child(mi)
	var stone_mat := StandardMaterial3D.new()
	stone_mat.albedo_color = stone.darkened(0.25) # loose stone sits in the wall's shadow and the grass
	stone_mat.roughness = 0.95
	var rm := SphereMesh.new()
	rm.radius = 1.0
	rm.height = 2.0
	rm.radial_segments = 6
	rm.rings = 3
	_multimesh(rm, rubble, stone_mat)
	var cm := CylinderMesh.new()
	cm.top_radius = 0.42
	cm.bottom_radius = 0.48
	cm.height = 1.0
	cm.radial_segments = 10
	_multimesh(cm, columns, stone_mat)

## open a region in 3D, looking at `at` (world metres; the map's centre when null)
func show_region(id: String, at: Variant = null, start_mode: Mode = Mode.CITY) -> void:
	map_id = id
	m = Data.map(id)
	Sound.ambience(Sound.bed_for(id))
	if _barks == null:
		_barks = Barks.new()
		add_child(_barks)
	_barks.region = String(Barks.MAP_REGION.get(id, ""))
	_barks.visible = start_mode == Mode.STREET
	if m.is_empty():
		return
	_split_ruins()
	_title.text = "%s · 3D" % m.name
	var b: Dictionary = m.bounds
	_span = b.span
	_ox = b.x0 + _span / 2.0
	_oz = b.z0 + _span / 2.0
	_water = float(m.get("water", -2.5))
	_load_heights()
	if id == "thalassia":
		_flatten_city_dome()
	_style = _style_for(id)
	if _style.under:
		# under the sea (Thalassia): no surface over the city, so "water level" sits below the seabed and everything that
		# clamps to it (street view, docks, labels) stands on the floor instead of 30-odd metres up at the surface
		_water = float(m.get("heights", {}).get("lo", _water)) - 6.0
	for c in _vp.get_children():
		c.queue_free()
	_world = Node3D.new()
	_vp.add_child(_world)
	_build_env()
	_build_ground()
	_build_water()
	_build_buildings()
	_build_landmarks()
	_build_tower_rooftops_pass_17()
	_build_civic_roofs()
	_build_entrances_pass_18()
	if CITY_ROOF_ACCESSORIES:
		_build_architecture_batch_19_43()
	if CITY_FACADE_FINS:
		_build_facade_fins_batch_19_43()
	_build_roads()
	if CITY_ROAD_MARKINGS:
		_build_road_markings_batch_19_43()
	_build_rings()
	if id == "nexus-region":
		Nexus.dress(self)   # the board's waterfalls and yachts (region_nexus.gd)
	_space = {}
	space_rejected = 0
	_build_trees()
	_build_slope_rock()
	Flora.rocks(self, _clearings())
	_build_floating()
	_build_ruins()
	if id == "thalassia":
		preload("res://scripts/thalassia_city.gd").new().build(_world, m, _loc, _h)
	_build_lamps()
	Flora.landmark_fx(self)
	_build_labels()
	_apply_season()
	_cam = Camera3D.new()
	_cam.far = 14000.0
	_cam.near = 0.2
	_cam.fov = 62.0
	_world.add_child(_cam)
	_weather = Weather.new()
	_weather.ground_at = func(x: float, z: float) -> float: return maxf(_h(x, z), _water)
	_weather.focus_at = func() -> Vector3: return _target if mode != Mode.STREET else _eye + Vector3(-sin(_look_yaw), 0, -cos(_look_yaw)) * 220.0
	_world.add_child(_weather)
	_weather.setup(id, _env, current_season() == 3 and id not in NO_WINTER)
	_weather.follow(_cam)
	var p := Vector2(_ox, _oz) if at == null else Vector2(at.x, at.y)
	_target = Vector3(p.x - _ox, 0, p.y - _oz)
	_target.y = _h(_target.x, _target.z)
	var city := id == "nexus" or id == "neon-city"
	_dist = clampf(_span * (0.2 if at != null else (0.8 if city else 0.42)), 60.0, 900.0)
	_pitch = 46.0 if city else 38.0
	# islands in the sky (Storm Islands): look across at their height, not down at the sea under them
	var floats: Array = m.get("floating", [])
	if at == null and not floats.is_empty():
		var tops := 0.0
		for f in floats:
			tops += float(f.top)
		_target.y = tops / floats.size() - 30.0
		_dist = clampf(_span * 0.85, 60.0, 900.0)
		_pitch = 14.0
	_eye = Vector3(_target.x, _h(_target.x, _target.z) + EYE, _target.z)
	_fill_jump()
	set_mode(start_mode)

func _load_heights() -> void:
	var hd: Dictionary = m.get("heights", {})
	_hn = int(hd.get("n", 2))
	var lo := float(hd.get("lo", 0.0))
	var hi := float(hd.get("hi", 1.0))
	_heights.resize(_hn * _hn)
	var img := Data.image("maps/%s.height.pngb" % map_id)
	if img == null:
		_heights.fill(0.0)
		return
	img.convert(Image.FORMAT_RGB8)
	var bytes := img.get_data()
	for k in _hn * _hn:
		var q := (bytes[k * 3] << 8) | bytes[k * 3 + 1]
		_heights[k] = lo + (hi - lo) * q / 65535.0

## Thalassia's city stands on one level deck: lift the bumpy seabed under its big dome to the dome's highest point, so the
## ground, buildings, labels and Street View all stand on the deck the city is built on (thalassia_city.gd)
func _flatten_city_dome() -> void:
	for r in m.get("rings", []):
		if r[3] != "dome" or float(r[2]) < 40.0:
			continue
		var c := _loc(r[0], r[1])
		var rad := float(r[2]) + 2.0
		var top := -INF
		var cells: Array[int] = []
		for j in _hn:
			for i in _hn:
				var lx := (float(i) / (_hn - 1) - 0.5) * _span
				var lz := (float(j) / (_hn - 1) - 0.5) * _span
				if Vector2(lx, lz).distance_to(c) <= rad:
					cells.append(j * _hn + i)
					top = maxf(top, _heights[j * _hn + i])
		for k in cells:
			_heights[k] = top + 0.6

## ground height at a local point (metres from the region's centre), bilinear on the grid
func _h(lx: float, lz: float) -> float:
	var fx := clampf((lx / _span + 0.5) * (_hn - 1), 0.0, _hn - 1.001)
	var fz := clampf((lz / _span + 0.5) * (_hn - 1), 0.0, _hn - 1.001)
	var i := int(fx)
	var j := int(fz)
	var tx := fx - i
	var tz := fz - j
	var a := _heights[j * _hn + i]
	var b := _heights[j * _hn + i + 1]
	var c := _heights[(j + 1) * _hn + i]
	var d := _heights[(j + 1) * _hn + i + 1]
	return lerpf(lerpf(a, b, tx), lerpf(c, d, tx), tz)

func _loc(x: float, z: float) -> Vector2:
	return Vector2(x - _ox, z - _oz)

func _style_for(id: String) -> Dictionary:
	# the owner's target frames: gritty daylight in the wilds (cracked planet overhead), the cities at night with wet streets
	var s := {"top": "#4a77a6", "hor": "#c2ccd2", "fog": "#aab4ba", "fog_d": 0.0011, "sun": 1.25, "sun_col": "#fff1dc", "sun_el": 38.0,
		"amb": 0.55, "night": 0.0, "neon": 0.0, "ordered": 0.0, "wet": 0.0, "sat": 0.86, "planet": true, "under": false}
	match id:
		"neon-city":
			s.merge({"top": "#07061a", "hor": "#3b1356", "fog": "#2a1240", "fog_d": 0.0026, "sun": 0.12, "sun_col": "#8fa6ff", "sun_el": 30.0, "amb": 0.35, "night": 1.0, "neon": 1.0, "wet": 1.0, "sat": 1.15}, true)
		"nexus-region":
			# the Nexus Region board: the same evening as the capital, but the sun still up over the land so the forests read
			# green, the bay turquoise and the snow white (the city close up keeps the deeper dusk)
			s.merge({"top": "#34479a", "hor": "#f3a77a", "fog": "#8a8cc0", "fog_d": 0.00045, "sun": 1.15, "sun_col": "#ffd9b0", "sun_el": 24.0, "amb": 0.62, "night": 0.3, "neon": 0.3, "ordered": 1.0, "wet": 0.0, "sat": 1.15, "exp": 0.92}, true)
		"nexus":
			# the owner's Nexus City board (Nov 9): the capital at dusk — an indigo sky going orange and pink at the horizon, a
			# low warm sun on cream and white towers lit gold with blue and violet accents, palms along the shore, the Core
			# Spire in holographic rings with its beam into the sky. Its own look, not a second Neon (`ordered` = Nexus look)
			# (Nov 10: brought up to the region's golden hour so the capital reads like the board, not a night scene)
			s.merge({"top": "#2c3a88", "hor": "#f09a72", "fog": "#6c6aa6", "fog_d": 0.0009, "sun": 0.95, "sun_col": "#ffd0a8", "sun_el": 16.0, "amb": 0.62, "night": 0.42, "neon": 0.3, "ordered": 1.0, "wet": 0.2, "sat": 1.15, "exp": 0.92}, true)
		"ember":
			s.merge({"top": "#2c140e", "hor": "#c05628", "fog": "#6a2e1e", "fog_d": 0.0022, "sun": 0.85, "sun_col": "#ffb27a", "sun_el": 18.0, "amb": 0.5}, true)
		"frostspire":
			s.merge({"top": "#7c97b4", "hor": "#e8eef4", "fog": "#d4dee6", "fog_d": 0.0024, "sun": 1.0, "sun_col": "#eef4ff", "sun_el": 22.0, "amb": 0.7}, true)
		"swamps":
			s.merge({"top": "#4c5b55", "hor": "#93a08a", "fog": "#6f7c66", "fog_d": 0.0042, "sun": 0.7, "sun_col": "#e8f0d0", "sun_el": 26.0, "amb": 0.6}, true)
		"veridan", "riverdale":
			s.merge({"top": "#6a879e", "hor": "#c6cdc8", "fog": "#a3ada7", "fog_d": 0.0019, "sun": 0.95, "sun_col": "#fff0d8", "sun_el": 34.0, "amb": 0.6}, true)
		"wastelands":
			s.merge({"top": "#5f97c8", "hor": "#e6d0a6", "fog": "#d4c09c", "fog_d": 0.0012, "sun": 1.5, "sun_col": "#fff0d0", "sun_el": 52.0, "amb": 0.6, "exp": 0.72}, true)
		"solara":
			# its pale dune sand blew out to white under the Wastelands' noon sun: a lower, warmer sun and less exposure
			# keep the dunes' shading and the sand's colour
			s.merge({"top": "#4f8cc4", "hor": "#e9c99a", "fog": "#d8b98e", "fog_d": 0.0012, "sun": 1.05, "sun_col": "#ffe2b8", "sun_el": 30.0, "amb": 0.45, "exp": 0.68, "sat": 0.95}, true)
		"storm":
			# the board's floating islands: a violet storm dusk, warm low sun through the clouds, the crystals glowing
			s.merge({"top": "#252a58", "hor": "#a585c0", "fog": "#6a6390", "fog_d": 0.0026, "sun": 1.0, "sun_col": "#ffc79a", "sun_el": 14.0, "amb": 0.65, "sat": 1.1}, true)
		"crystal-badlands":
			s.merge({"top": "#241c4a", "hor": "#d39a7c", "fog": "#6a5676", "fog_d": 0.0014, "sun": 1.0, "sun_col": "#ffc6a0", "sun_el": 22.0, "amb": 0.85, "night": 0.3}, true)
		"old-harrow":
			# the board's town picture: dusk over the roofs, the last sun on the spire, windows coming on
			s.merge({"top": "#2f3f6a", "hor": "#f0a468", "fog": "#a88468", "fog_d": 0.0016, "sun": 0.95, "sun_col": "#ffb27a", "sun_el": 9.0, "amb": 0.55, "night": 0.4, "sat": 1.05}, true)
		"goldenreach":
			# late-afternoon gold over the fields
			s.merge({"top": "#5e8fc4", "hor": "#f0d6a8", "fog": "#d8c49e", "fog_d": 0.0010, "sun": 1.35, "sun_col": "#ffd9a0", "sun_el": 24.0, "amb": 0.55, "sat": 1.05}, true)
		"azure-isles":
			# high tropical sun, a deep blue sky, turquoise water
			s.merge({"top": "#1f6fd0", "hor": "#bfe6f4", "fog": "#a8d8ea", "fog_d": 0.0006, "sun": 1.45, "sun_col": "#fff8e6", "sun_el": 60.0, "amb": 0.7, "sat": 1.1, "exp": 0.85}, true)
		"frostveil":
			# a low polar sun across the ice, blue shadows, a little ground haze
			s.merge({"top": "#5d7fa8", "hor": "#e6eef6", "fog": "#d6e2ee", "fog_d": 0.0020, "sun": 1.05, "sun_col": "#ffe8d2", "sun_el": 12.0, "amb": 0.75, "exp": 0.66}, true)
		"shattered-reefs":
			s.merge({"top": "#2b78c8", "hor": "#cfe6f0", "fog": "#b6d6e4", "fog_d": 0.0007, "sun": 1.4, "sun_col": "#fff6e4", "sun_el": 55.0, "amb": 0.65, "sat": 0.95}, true)
		"thalassia":
			# the city inside the dome carries its own lights: a dimmer, bluer deep so they read (it was blown out to white)
			s.merge({"fog": "#06465e", "fog_d": 0.009, "sun": 0.45, "sun_col": "#a8e6ff", "sun_el": 70.0, "amb": 0.35, "planet": false, "under": true, "night": 0.6, "exp": 0.8}, true)
	# cloud cover and tint in the sky shader (graphics pass, Nov 11); 0.4 white unless listed
	var clouds := {"neon-city": [0.55, "#b277ff"], "solara": [0.12, "#ffffff"], "wastelands": [0.2, "#fff4e0"],
		"frostveil": [0.5, "#f2f6ff"], "frostspire": [0.6, "#f2f6ff"], "storm": [0.75, "#d8c4ff"], "azure-isles": [0.3, "#ffffff"],
		"swamps": [0.8, "#dfe6d6"], "ember": [0.6, "#ff9a70"], "crystal-badlands": [0.45, "#ffd6e8"], "nexus": [0.35, "#ffd8c8"],
		"nexus-region": [0.35, "#ffe0cc"], "old-harrow": [0.45, "#ffd0b0"], "shattered-reefs": [0.3, "#ffffff"]}
	if clouds.has(id):
		s["cloud"] = clouds[id][0]
		s["cloud_tint"] = clouds[id][1]
	return s

func _build_env() -> void:
	var we := WorldEnvironment.new()
	_env = Environment.new()
	if _style.under:
		_env.background_mode = Environment.BG_COLOR
		_env.background_color = Color(_style.fog)
	else:
		_env.background_mode = Environment.BG_SKY
		var sky := Sky.new()
		# the sky shader (shaders/sky3d.gdshader): sun halo, lit clouds, stars at night
		var sm := ShaderMaterial.new()
		sm.shader = load("res://shaders/sky3d.gdshader")
		sm.set_shader_parameter("top_col", Color(_style.top))
		sm.set_shader_parameter("hor_col", Color(_style.hor))
		sm.set_shader_parameter("ground_col", Color(_style.fog).darkened(0.5))
		sm.set_shader_parameter("sun_col", Color(_style.sun_col))
		sm.set_shader_parameter("night", clampf(float(_style.night), 0.0, 1.0))
		sm.set_shader_parameter("cloud_cover", float(_style.get("cloud", 0.4)))
		sm.set_shader_parameter("cloud_tint", Color(_style.get("cloud_tint", "#ffffff")))
		sm.set_shader_parameter("seed", float(hash(map_id) % 997))
		sky.sky_material = sm
		sky.radiance_size = Sky.RADIANCE_SIZE_64 if Phone.tier() == "low" else Sky.RADIANCE_SIZE_128
		_env.sky = sky
	_env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY if not _style.under else Environment.AMBIENT_SOURCE_COLOR
	_env.ambient_light_color = Color(_style.fog)
	# a little less fill in daylight so slopes and shadows keep their shape (graphics pass, Nov 11)
	_env.ambient_light_energy = _style.amb * lerpf(0.82, 1.0, clampf(_style.night, 0.0, 1.0)) + _style.night * 0.5
	if _style.night > 0.5:
		_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		_env.ambient_light_color = Color(_style.hor).lightened(0.25)
	_env.tonemap_mode = Environment.TONE_MAPPER_ACES
	_env.tonemap_exposure = float(_style.get("exp", 0.85 if _style.night < 0.5 else 1.15))
	_env.fog_enabled = true
	_env.fog_light_color = Color(_style.fog)
	_env.fog_density = _style.fog_d * 0.4
	_env.fog_sky_affect = 0.15
	_env.fog_aerial_perspective = 0.4
	_env.glow_enabled = true
	_env.glow_intensity = 0.45 + _style.neon * 0.25
	_env.glow_bloom = 0.05 + _style.night * 0.1
	_env.adjustment_enabled = true
	_env.adjustment_saturation = _style.sat
	_env.adjustment_contrast = 1.12
	# the film grade (scripts/grade.gd, GTA pass Nov 11): split-tone and a gentle S-curve
	_env.adjustment_color_correction = Grade.lut("night" if _style.night > 0.5 else "region")
	we.environment = _env
	_world.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(_style.sun_col)
	sun.light_energy = _style.sun
	sun.rotation_degrees = Vector3(-float(_style.sun_el), -35.0, 0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 320.0
	Phone.fit_sun(sun, 160.0)
	_world.add_child(sun)
	if _style.planet:
		_build_planet_in_sky()

## the giant cracked planet in the sky (the owner's wilds frame): the globe's painting on a far sphere, cracks glowing
func _build_planet_in_sky() -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 1500.0
	s.height = 3000.0
	s.radial_segments = 48
	s.rings = 24
	mi.mesh = s
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, fog_disabled, cull_back;
uniform sampler2D albedo : source_color, filter_linear_mipmap;
uniform float night = 0.0;
float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p), s = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash2(i), hash2(i + vec2(1, 0)), s.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), s.x), s.y); }
void fragment() {
	vec3 c = texture(albedo, UV).rgb * mix(0.85, 0.6, night);
	float n = abs(vnoise(UV * vec2(18.0, 9.0)) * 2.0 - 1.0) + abs(vnoise(UV * vec2(44.0, 22.0)) * 2.0 - 1.0) * 0.5;
	float crack = 1.0 - smoothstep(0.0, 0.06, n);
	c = mix(c, vec3(1.0, 0.55, 0.25) * 2.0, crack * 0.9);
	ALBEDO = c;
	ALPHA = 1.0;
}"""
	mat.shader = sh
	mat.set_shader_parameter("albedo", Data.texture("veyra.jpgb", true))
	mat.set_shader_parameter("night", _style.night)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = Vector3(-5200.0, 3800.0, -7600.0)
	mi.rotation_degrees = Vector3(18, 40, -12)
	_world.add_child(mi)

func _build_ground() -> void:
	var n := _hn
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var uvs := PackedVector2Array()
	var idx := PackedInt32Array()
	verts.resize(n * n)
	norms.resize(n * n)
	uvs.resize(n * n)
	var step := _span / (n - 1)
	for j in n:
		for i in n:
			var k := j * n + i
			verts[k] = Vector3(-_span / 2.0 + i * step, _heights[k], -_span / 2.0 + j * step)
			uvs[k] = Vector2(float(i) / (n - 1), float(j) / (n - 1))
	for j in n:
		for i in n:
			var hl := _heights[j * n + maxi(i - 1, 0)]
			var hr := _heights[j * n + mini(i + 1, n - 1)]
			var hu := _heights[maxi(j - 1, 0) * n + i]
			var hd := _heights[mini(j + 1, n - 1) * n + i]
			norms[j * n + i] = Vector3(hl - hr, 2.0 * step, hu - hd).normalized()
	for j in n - 1:
		for i in n - 1:
			var a := j * n + i
			idx.append_array([a, a + 1, a + n, a + 1, a + n + 1, a + n])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/terrain3d.gdshader")
	var covers: Array = Data.styles.get("covers", [])
	var pal := PackedVector3Array()
	for cv in covers:
		var rgb: Array = Data.styles.satColor[cv]
		pal.append(Vector3(rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0))
	while pal.size() < 32:
		pal.append(Vector3(0.3, 0.3, 0.3))
	mat.set_shader_parameter("pal", pal)
	_ground_mat = mat
	_base_pal = pal.duplicate()
	var b: Dictionary = m.bounds
	mat.set_shader_parameter("bounds", Vector4(b.x0, b.z0, b.span, 0))
	mat.set_shader_parameter("data_tex", Data.texture("maps/%s.data.pngb" % map_id))
	mat.set_shader_parameter("wet", _style.wet)
	# the heights as a float texture: the shader takes per-pixel slopes, rock and hollows from it
	var himg := Image.create_from_data(n, n, false, Image.FORMAT_RF, _heights.to_byte_array())
	_height_tex = ImageTexture.create_from_image(himg)
	mat.set_shader_parameter("height_tex", _height_tex)
	mat.set_shader_parameter("hn", float(n))
	mat.set_shader_parameter("water_y", _water)
	mat.set_shader_parameter("detail", 0.0 if Phone.tier() == "low" else 1.0)
	for pair in [["i_forest", "forest"], ["i_dense", "denseForest"], ["i_marsh", "marsh"], ["i_meadow", "meadow"], ["i_grass", "grass"], ["i_scrub", "scrub"],
			["i_desert", "desert"], ["i_dunes", "dunes"], ["i_sandstone", "sandstone"], ["i_wash", "wash"], ["i_lava", "lava"], ["i_magma", "magma"],
			["i_urban", "urban"], ["i_paved", "paved"], ["i_town", "town"], ["i_snow", "snow"], ["i_ice", "ice"], ["i_crystal", "crystal"], ["i_rift", "rift"]]:
		mat.set_shader_parameter(pair[0], covers.find(pair[1]))
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	# the ground is lit by its own slope; drawing its 131k triangles into every shadow cascade too cost more than the rest
	# of the region together. It still receives the shadows of trees and buildings.
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world.add_child(mi)
	# a skirt of land / sea floor beyond the map so the horizon never shows an edge
	var skirt := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	# open sea (the Storm Islands are seen from low down) runs much further so its edge sinks into the haze
	var sea := 40.0 if not m.get("floating", []).is_empty() else 8.0
	pm.size = Vector2(_span * sea, _span * sea)
	skirt.mesh = pm
	skirt.position = Vector3(0, _water - 18.0, 0)
	var sk := StandardMaterial3D.new()
	sk.albedo_color = Color(_style.fog).darkened(0.55)
	skirt.material_override = sk
	_world.add_child(skirt)

func _build_water() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	# open sea (the Storm Islands are seen from low down) runs much further so its edge sinks into the haze
	var sea := 40.0 if not m.get("floating", []).is_empty() else 8.0
	pm.size = Vector2(_span * sea, _span * sea)
	pm.subdivide_width = 4
	pm.subdivide_depth = 4
	mi.mesh = pm
	mi.position = Vector3(0, _water, 0)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/water3d.gdshader")
	# depth from the ground heights: turquoise shallows, the deep colour offshore, surf at the shore
	if _height_tex:
		mat.set_shader_parameter("height_tex", _height_tex)
		mat.set_shader_parameter("has_h", 1.0)
		mat.set_shader_parameter("span", _span)
		mat.set_shader_parameter("hn", float(_hn))
		mat.set_shader_parameter("water_y", _water)
	mat.set_shader_parameter("detail", 0.0 if Phone.tier() == "low" else 1.0)
	if map_id == "shattered-reefs":
		mat.set_shader_parameter("shallow_col", Color(0.1, 0.52, 0.56))
		mat.set_shader_parameter("clarity", 0.55)
	elif map_id == "azure-isles":
		mat.set_shader_parameter("shallow_col", Color(0.12, 0.7, 0.72))
		mat.set_shader_parameter("clarity", 0.7)
	elif map_id == "frostveil":
		mat.set_shader_parameter("deep_col", Color(0.02, 0.08, 0.14))
		mat.set_shader_parameter("shallow_col", Color(0.12, 0.3, 0.38))
	elif _style.night > 0.5:
		mat.set_shader_parameter("deep_col", Color(0.02, 0.03, 0.08))
		mat.set_shader_parameter("shallow_col", Color(0.05, 0.08, 0.16))
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world.add_child(mi)

func _build_buildings() -> void:
	if m.buildings.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var k := 0
	_landmark_bds.clear()
	for bd in m.buildings:
		if bd.size() > 7 and String(bd[7]) in LANDMARKS:
			_landmark_bds.append(bd)
			continue
		var p := _loc(bd[0], bd[1])
		var hx: float = bd[2]
		var hz: float = bd[3]
		var yaw: float = bd[4]
		var use: String = bd[5]
		var hgt := _bh(bd)
		var c := cos(yaw)
		var s := sin(yaw)
		var corners: Array[Vector2] = []
		for uv in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = uv.x * hx
			var lz: float = uv.y * hz
			corners.append(Vector2(p.x + lx * c + lz * s, p.y - lx * s + lz * c))
		var base := INF
		for q in corners:
			base = minf(base, _h(q.x, q.y))
		base -= 0.6
		var top := maxf(base + 3.0, _h(p.x, p.y) + hgt)
		var wall := Color(WALL.get(use, "#8a8f96"))
		if _style.night > 0.5:
			wall = wall.darkened(0.35)
		var seed := fposmod(float(k) * 0.6180339, 1.0)
		k += 1
		# Pass 16: preserve footprint and height but introduce upper-floor setbacks.
		# Short buildings retain their original one-piece shape.
		var tiers: int = 1
		if hgt >= 75.0 and minf(hx, hz) >= 4.0:
			tiers = 3 if hgt >= 115.0 else 2
		var levels: Array[float] = [base]
		for tier_i in range(1, tiers + 1):
			levels.append(lerpf(base, top, float(tier_i) / float(tiers)))
		var last_corners: Array[Vector2] = corners
		for tier_i in range(tiers):
			var scale_factor := 1.0 - float(tier_i) * 0.115
			var tier_corners: Array[Vector2] = []
			for corner in corners:
				tier_corners.append(p + (corner - p) * scale_factor)
			for f in 4:
				var a: Vector2 = tier_corners[f]
				var b2: Vector2 = tier_corners[(f + 1) % 4]
				var L := a.distance_to(b2)
				var lo := levels[tier_i]
				var hi := levels[tier_i + 1]
				var quad := [Vector3(a.x, lo, a.y), Vector3(b2.x, lo, b2.y), Vector3(b2.x, hi, b2.y), Vector3(a.x, hi, a.y)]
				var uvq := [Vector2(0, lo - base), Vector2(L, lo - base), Vector2(L, hi - base), Vector2(0, hi - base)]
				var mid := (a + b2) / 2.0 - p
				var out := Vector3(mid.x, 0, mid.y).normalized()
				for t in [[0, 1, 2], [0, 2, 3]]:
					_tri(st, [quad[t[0]], quad[t[1]], quad[t[2]]], [uvq[t[0]], uvq[t[1]], uvq[t[2]]], out, Color(wall, 0.0), seed)
			# Close the visible ledge between successive tiers.
			if tier_i > 0:
				for f in 4:
					var prev_a: Vector2 = last_corners[f]
					var prev_b: Vector2 = last_corners[(f + 1) % 4]
					var curr_a: Vector2 = tier_corners[f]
					var curr_b: Vector2 = tier_corners[(f + 1) % 4]
					var ledge_y := levels[tier_i]
					var ledge := [Vector3(prev_a.x, ledge_y, prev_a.y), Vector3(prev_b.x, ledge_y, prev_b.y), Vector3(curr_b.x, ledge_y, curr_b.y), Vector3(curr_a.x, ledge_y, curr_a.y)]
					for t in [[0, 1, 2], [0, 2, 3]]:
						_tri(st, [ledge[t[0]], ledge[t[1]], ledge[t[2]]], [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO], Vector3.UP, Color(wall.darkened(0.16), 1.0), seed)
			last_corners = tier_corners
		if _pitched(use, hgt, hx, hz):
			_gable(st, last_corners, top, hx, hz, wall, seed)
		else:
			var roof := [Vector3(last_corners[0].x, top, last_corners[0].y), Vector3(last_corners[1].x, top, last_corners[1].y), Vector3(last_corners[2].x, top, last_corners[2].y), Vector3(last_corners[3].x, top, last_corners[3].y)]
			for t in [[0, 1, 2], [0, 2, 3]]:
				_tri(st, [roof[t[0]], roof[t[1]], roof[t[2]]], [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO], Vector3.UP, Color(wall.darkened(0.1), 1.0), seed)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/building3d.gdshader")
	mat.set_shader_parameter("night", _style.night)
	mat.set_shader_parameter("neon", _style.neon)
	mat.set_shader_parameter("ordered", _style.ordered)
	mi.material_override = mat
	_world.add_child(mi)
	if _style.ordered > 0.5:
		_nexus_lines()
	# Neon City's signs: strips of colour along the rooflines of the taller towers
	if _style.neon > 0.5:
		var sst := SurfaceTool.new()
		sst.begin(Mesh.PRIMITIVE_TRIANGLES)
		var cols := [Color(0.2, 0.9, 1.0), Color(1.0, 0.18, 0.66), Color(0.7, 0.4, 1.0), Color(1.0, 0.8, 0.3)]
		var i := 0
		for bd in m.buildings:
			if _is_landmark(bd):
				continue
			if _bh(bd) < 40.0:
				continue
			var p := _loc(bd[0], bd[1])
			var top := _h(p.x, p.y) + _bh(bd)
			var y := top - 6.0 - (i % 3) * 9.0
			var col: Color = cols[i % cols.size()]
			i += 1
			var hx: float = float(bd[2]) + 0.05
			var hz: float = float(bd[3]) + 0.05
			for f in 4:
				var a := Vector2(-hx, -hz) if f == 0 else (Vector2(hx, -hz) if f == 1 else (Vector2(hx, hz) if f == 2 else Vector2(-hx, hz)))
				var b2 := Vector2(hx, -hz) if f == 0 else (Vector2(hx, hz) if f == 1 else (Vector2(-hx, hz) if f == 2 else Vector2(-hx, -hz)))
				var q := [Vector3(p.x + a.x, y, p.y + a.y), Vector3(p.x + b2.x, y, p.y + b2.y), Vector3(p.x + b2.x, y + 1.2, p.y + b2.y), Vector3(p.x + a.x, y + 1.2, p.y + a.y)]
				for t in [[0, 2, 1], [0, 3, 2], [0, 1, 2], [0, 2, 3]]:
					for vi in t:
						sst.set_color(col)
						sst.add_vertex(q[vi])
		var smat := StandardMaterial3D.new()
		smat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		smat.vertex_color_use_as_albedo = true
		smat.emission_enabled = true
		smat.emission_energy_multiplier = 3.0
		var smi := MeshInstance3D.new()
		smi.mesh = sst.commit()
		smi.material_override = smat
		smi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_world.add_child(smi)

## Nexus: thin blue light lines up the four corners of every tall tower and a violet crown line at the roof, as on the
## board's skyline (Neon City gets coloured sign strips instead)
func _nexus_lines() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cyan := Color(0.36, 0.66, 1.0)
	var white := Color(0.72, 0.48, 1.0)
	for bd in m.buildings:
		if _is_landmark(bd) or _bh(bd) < 30.0:
			continue
		var p := _loc(bd[0], bd[1])
		var base := _h(p.x, p.y)
		var top := base + _bh(bd)
		var hx: float = float(bd[2]) + 0.06
		var hz: float = float(bd[3]) + 0.06
		var yaw: float = bd[4]
		var c := cos(yaw)
		var sn := sin(yaw)
		var corners: Array[Vector2] = []
		for d in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = d.x * hx
			var lz: float = d.y * hz
			corners.append(Vector2(p.x + lx * c + lz * sn, p.y - lx * sn + lz * c))
		for k in 4:
			var a: Vector2 = corners[k]
			var b: Vector2 = corners[(k + 1) % 4]
			var dir := (b - a).normalized() * 0.35
			# a corner line: a narrow quad on each face meeting at the corner
			for q in [[a, a + dir, base + 6.0, top], [b - dir, b, base + 6.0, top], [a, b, top - 0.9, top - 0.3]]:
				var u: Vector2 = q[0]
				var v: Vector2 = q[1]
				var y0: float = q[2]
				var y1: float = q[3]
				var col := white if y1 - y0 < 2.0 else cyan
				var quad := [Vector3(u.x, y0, u.y), Vector3(v.x, y0, v.y), Vector3(v.x, y1, v.y), Vector3(u.x, y1, u.y)]
				for t in [[0, 2, 1], [0, 3, 2], [0, 1, 2], [0, 2, 3]]:
					for vi in t:
						st.set_color(col)
						st.add_vertex(quad[vi])
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.emission_enabled = true
	mat.emission_energy_multiplier = 2.2
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world.add_child(mi)

## one triangle facing `n` (Godot's front faces wind clockwise as seen from the front), with its normal, colour and uvs
func _tri(st: SurfaceTool, v: Array, uv: Array, n: Vector3, col: Color, seed: float) -> void:
	var order := [0, 1, 2] if (v[1] - v[0]).cross(v[2] - v[0]).dot(n) < 0.0 else [0, 2, 1]
	for i in order:
		st.set_normal(n)
		st.set_color(col)
		st.set_uv(uv[i])
		st.set_uv2(Vector2(seed, 0))
		st.add_vertex(v[i])

## a building's height in metres: its real one when the data has it, else from its 0..1 tallness (the city towers)
func _bh(bd: Array) -> float:
	if bd.size() > 8 and float(bd[8]) > 0.0:
		return float(bd[8])
	return 3.5 + 120.0 * pow(float(bd[6]), 1.6)

func _build_roads() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var any := false
	for r in m.roads:
		var cls: String = r.cls
		if not ROAD.has(cls):
			continue
		var pts: Array = r.pts
		if pts.size() < 2:
			continue
		var w := maxf(1.2, float(r.w))
		var col := Color(ROAD[cls])
		if r.color != "":
			col = Color(r.color).darkened(0.2)
		# resample to <= 6 m steps so the ribbon follows the ground
		var line: Array[Vector2] = []
		for i in pts.size() - 1:
			var a := _loc(pts[i][0], pts[i][1])
			var b := _loc(pts[i + 1][0], pts[i + 1][1])
			var steps := maxi(1, int(a.distance_to(b) / 6.0))
			for s in steps:
				line.append(a.lerp(b, float(s) / steps))
		line.append(_loc(pts[-1][0], pts[-1][1]))
		var lift := 0.18
		var deck_a := 0.0
		var deck_b := 0.0
		if cls == "bridge":
			deck_a = maxf(_h(line[0].x, line[0].y), _water + 2.5)
			deck_b = maxf(_h(line[-1].x, line[-1].y), _water + 2.5)
		for i in line.size() - 1:
			var a := line[i]
			var b := line[i + 1]
			var d := (b - a).normalized()
			var nrm := Vector2(-d.y, d.x) * w / 2.0
			var ya := _h(a.x, a.y) + lift
			var yb := _h(b.x, b.y) + lift
			if cls == "bridge":
				ya = maxf(ya, lerpf(deck_a, deck_b, float(i) / (line.size() - 1)) + 0.3)
				yb = maxf(yb, lerpf(deck_a, deck_b, float(i + 1) / (line.size() - 1)) + 0.3)
			elif cls == "skybridge":
				ya = _h(a.x, a.y) + 15.0
				yb = _h(b.x, b.y) + 15.0
			elif cls == "boardwalk":
				ya = maxf(ya, _water + 0.6)
				yb = maxf(yb, _water + 0.6)
			var q := [Vector3(a.x - nrm.x, ya, a.y - nrm.y), Vector3(a.x + nrm.x, ya, a.y + nrm.y), Vector3(b.x + nrm.x, yb, b.y + nrm.y), Vector3(b.x - nrm.x, yb, b.y - nrm.y)]
			for t in [[0, 1, 2], [0, 2, 3]]:
				for vi in t:
					st.set_color(col)
					st.add_vertex(q[vi])
			any = true
	for p in m.pavements:
		var c := _loc(p[0], p[1])
		var y := _h(c.x, c.y) + 0.12
		var hx: float = p[2]
		var hz: float = p[3]
		var yaw: float = p[4]
		var col := Color("#6e6a64") if p[5] == "plaza" else Color("#36393d")
		var cs := cos(yaw)
		var sn := sin(yaw)
		var q := []
		for uv in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = uv.x * hx
			var lz: float = uv.y * hz
			var wx := c.x + lx * cs + lz * sn
			var wz := c.y - lx * sn + lz * cs
			q.append(Vector3(wx, maxf(y, _h(wx, wz) + 0.12), wz))
		for t in [[0, 2, 1], [0, 3, 2]]:
			for vi in t:
				st.set_color(col)
				st.add_vertex(q[vi])
		any = true
	if not any:
		return
	st.generate_normals()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = lerpf(0.9, 0.2, _style.wet)
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	_world.add_child(mi)

func _build_rings() -> void:
	for r in m.rings:
		# the Nexus Region draws its docks as quays, cranes, piers and yachts (region_nexus.gd), not a grey disc on the water
		if map_id == "nexus-region" and r[3] == "dock":
			continue
		var p := _loc(r[0], r[1])
		var rad: float = r[2]
		var y := _h(p.x, p.y)
		var mi := MeshInstance3D.new()
		var mat := StandardMaterial3D.new()
		match r[3]:
			"dome":
				var s := SphereMesh.new()
				s.radius = rad
				s.height = rad
				s.is_hemisphere = true
				mi.mesh = s
				# Thalassia's dome has a city inside it now: keep the glass faint so the city shows through
				var city_inside := map_id == "thalassia" and rad > 40.0
				mat.albedo_color = Color(0.55, 0.85, 0.95, 0.1 if city_inside else 0.3)
				mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				mat.metallic = 0.4
				mat.roughness = 0.05
				mat.emission_enabled = true
				mat.emission = Color(0.3, 0.7, 1.0)
				mat.emission_energy_multiplier = 0.12 if city_inside else 0.3 + _style.night
			"hazard":
				var c := CylinderMesh.new()
				c.top_radius = rad
				c.bottom_radius = rad
				c.height = 4.0
				mi.mesh = c
				y += 2.0
				mat.albedo_color = Color(0.85, 0.1, 0.1, 0.18)
				mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
				mat.cull_mode = BaseMaterial3D.CULL_DISABLED
			"arena", "fence", "ring":
				var t := TorusMesh.new()
				t.inner_radius = rad - (1.2 if r[3] == "arena" else 0.35)
				t.outer_radius = rad
				mi.mesh = t
				y += 0.5
				mat.albedo_color = Color("#8a6a45") if r[3] != "ring" else Color("#d8dde2")
			_:
				var c := CylinderMesh.new()
				c.top_radius = maxf(2.0, rad)
				c.bottom_radius = maxf(2.0, rad)
				c.height = 0.4
				mi.mesh = c
				y = maxf(y, _water + 0.2) + 0.2
				mat.albedo_color = Color("#9aa0a6")
		mi.material_override = mat
		mi.position = Vector3(p.x, y, p.y)
		_world.add_child(mi)

## Houses, shops and small halls outside the big cities get a pitched roof (the board's town, farm and resort pictures):
## a gable along the long side in terracotta, slate or weathered timber
const PITCH_USES := ["house", "store", "civic", "industrial", "school", "entertainment"]
func _pitched(use: String, hgt: float, hx: float, hz: float) -> bool:
	if map_id in ["nexus", "neon-city", "thalassia", "crystal-badlands", "frostveil"]:
		return false
	return use in PITCH_USES and hgt < 18.0 and maxf(hx, hz) < 16.0

func _gable(st: SurfaceTool, c: Array[Vector2], top: float, hx: float, hz: float, wall: Color, seed: float) -> void:
	const ROOFS := [Color("#8e4a33"), Color("#6b3a2c"), Color("#4b5058"), Color("#5e4a3a"), Color("#9a5a3c")]
	var roof_col: Color = ROOFS[int(seed * 997.0) % ROOFS.size()]
	# the ridge runs along the longer pair of edges; c[0]-c[1] is the local x edge
	var along_x := hx >= hz
	var a0: Vector2 = c[0]
	var a1: Vector2 = c[1]
	var a2: Vector2 = c[2]
	var a3: Vector2 = c[3]
	var rise := minf(hx, hz) * 0.75 + 0.3
	var r0: Vector2
	var r1: Vector2
	var slopes: Array
	var ends: Array
	if along_x:
		r0 = (a0 + a3) * 0.5
		r1 = (a1 + a2) * 0.5
		slopes = [[a0, a1, r1, r0], [a3, r0, r1, a2]]
		ends = [[a0, r0, a3], [a1, a2, r1]]
	else:
		r0 = (a0 + a1) * 0.5
		r1 = (a3 + a2) * 0.5
		slopes = [[a1, a2, r1, r0], [a0, r0, r1, a3]]
		ends = [[a0, a1, r0], [a3, r1, a2]]
	var y := func(v: Vector2, ridge: bool) -> Vector3: return Vector3(v.x, top + (rise if ridge else 0.0), v.y)
	for q in slopes:
		var p0: Vector3 = y.call(q[0], false)
		var p1: Vector3 = y.call(q[1], false)
		var p2: Vector3 = y.call(q[2], true)
		var p3: Vector3 = y.call(q[3], true)
		var n := (p1 - p0).cross(p3 - p0).normalized()
		if n.y < 0.0:
			n = -n
		for t in [[p0, p1, p2], [p0, p2, p3]]:
			_tri(st, t, [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO], n, Color(roof_col, 1.0), seed)
	for e in ends:
		var q0: Vector3 = y.call(e[0], false)
		var q1: Vector3 = y.call(e[1], e[1] == r0 or e[1] == r1)
		var q2: Vector3 = y.call(e[2], e[2] == r0 or e[2] == r1)
		var n2 := (q1 - q0).cross(q2 - q0).normalized()
		_tri(st, [q0, q1, q2], [Vector2.ZERO, Vector2.ZERO, Vector2.ZERO], n2, Color(wall.darkened(0.05), 1.0), seed)

## forests (and pines on the cold maps) and the crystal fields, scattered where the land cover says, from the map's data
func _build_trees() -> void:
	var img := Data.image("maps/%s.data.pngb" % map_id)
	if img == null:
		return
	img = img.duplicate()
	img.convert(Image.FORMAT_RGB8)
	var w := img.get_width()
	var bytes := img.get_data()
	var covers: Array = Data.styles.get("covers", [])
	var chance := {}
	for pair in [["forest", 0.32], ["denseForest", 0.5], ["marsh", 0.12], ["meadow", 0.012], ["grass", 0.025], ["scrub", 0.03]]:
		var ci := covers.find(pair[0])
		if ci >= 0:
			chance[ci] = pair[1]
	var crystal := covers.find("crystal")
	var rift := covers.find("rift")
	var tears: Array[Vector3] = []
	var stride := maxi(2, int(w / 300.0))
	var clear := _clearings()
	var trees: Array[Transform3D] = []
	var shards: Array[Transform3D] = []
	var mpp := _span / w
	var hs := 1
	for j in range(0, w, stride):
		for i in range(0, w, stride):
			var cv := bytes[(j * w + i) * 3]
			hs = (hs * 1103515245 + 12345) & 0x7fffffff
			var roll := float(hs % 10000) / 10000.0
			var lx := -_span / 2.0 + (i + roll * stride) * mpp
			var lz := -_span / 2.0 + (j + fposmod(roll * 7.3, 1.0) * stride) * mpp
			if clear[_cell(lx, lz)] == 1:
				continue
			if chance.has(cv) and roll < chance[cv] and trees.size() < TREE_CAP:
				var y := _h(lx, lz)
				if y < _water + 0.5:
					continue
				var s := 0.75 + fposmod(roll * 13.7, 1.0) * 0.7
				# the trunk and the crown's core (the crown's skirt may brush a neighbour's, as in a real forest)
				if not _space_claim(lx, lz, 1.1 * s):
					continue
				trees.append(Transform3D(Basis(Vector3.UP, roll * TAU).scaled(Vector3(s, s * (0.9 + roll * 0.4), s)), Vector3(lx, y - 0.2, lz)))
			elif cv == rift and rift >= 0 and roll < 0.02 and tears.size() < 60:
				if _space_claim(lx, lz, 6.0):
					tears.append(Vector3(lx, _h(lx, lz), lz))
			elif cv == crystal and roll < 0.12 and shards.size() < 4000:
				var s2 := 0.6 + roll * 8.0
				if not _space_claim(lx, lz, 0.35 * s2):
					continue
				shards.append(Transform3D(Basis.from_euler(Vector3((roll - 0.06) * 3.0, roll * 40.0, (0.06 - roll) * 2.0)).scaled(Vector3(s2 * 0.5, s2 * 1.6, s2 * 0.5)), Vector3(lx, _h(lx, lz), lz)))
	if not trees.is_empty():
		var cold := map_id in ["frostspire", "frostveil"]
		if map_id in ["azure-isles", "nexus", "nexus-region"] and _palms(trees):
			# the two thirds the palms leave: bamboo clumps among them (and no conifers on the isles); on the Nexus boards
			# oaks, blossom and the forest's conifers
			var rest: Array[Transform3D] = []
			for i in trees.size():
				if i % 3 != 0:
					rest.append(trees[i])
			var left := Flora.plant(self, rest)
			if map_id != "azure-isles" and not left.is_empty():
				_multimesh(_tree_mesh(false), left, _tree_material(false))
		else:
			# the region's species mix (oak, cherry, baobab, bamboo, alien flora); the conifers take what is left
			var pines := Flora.plant(self, trees)
			if not pines.is_empty():
				_multimesh(_tree_mesh(cold), pines, _tree_material(cold))
	if not tears.is_empty():
		Flora.rift_tears(self, tears)
	if not shards.is_empty():
		var cm := CylinderMesh.new()
		cm.top_radius = 0.0
		cm.bottom_radius = 0.6
		cm.height = 2.0
		cm.radial_segments = 6
		cm.rings = 1
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.72, 0.58, 1.0, 0.85)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.emission_enabled = true
		mat.emission = Color(0.6, 0.35, 1.0)
		mat.emission_energy_multiplier = 1.6
		mat.roughness = 0.1
		mat.metallic = 0.3
		_multimesh(cm, shards, mat)

## the tropical isles grow palms, not oaks: the city's palm model, scaled to 7-11 m, one in three of the forest's places
func _palms(trees: Array[Transform3D]) -> bool:
	const PALM := "res://models/city/palm.glb"
	if not ResourceLoader.exists(PALM):
		return false
	var sc := (load(PALM) as PackedScene).instantiate()
	var mis := sc.find_children("*", "MeshInstance3D", true, false)
	if mis.is_empty():
		sc.free()
		return false
	var mesh: Mesh = (mis[0] as MeshInstance3D).mesh
	sc.free()
	var bb := mesh.get_aabb()
	var k := 9.0 / maxf(bb.size.y, 0.01)
	var lift := Vector3(-(bb.position.x + bb.size.x * 0.5), -bb.position.y, -(bb.position.z + bb.size.z * 0.5)) * k
	var xf: Array[Transform3D] = []
	for i in trees.size():
		if i % 3 != 0:
			continue
		var t := trees[i]
		var s := t.basis.get_scale().y
		xf.append(Transform3D(Basis(Vector3.UP, float(i) * 2.4).scaled(Vector3.ONE * k * s), t.origin + lift * s))
	_multimesh(mesh, xf, null, 700.0)
	return true

# ---------------- spacing: trees, rocks and shards never stand inside each other ----------------
## Scattered things are placed on a jittered grid, and two neighbours could land on top of each other (a pine growing out
## of another pine's trunk, a boulder through a trunk, a crystal through a tree). Each placed thing claims a footprint
## circle in a 6 m hash; a new one that would overlap a claimed footprint is dropped.
const SPACE_CELL := 6.0
var _space := {}
var space_rejected := 0

func _space_free(x: float, z: float, r: float) -> bool:
	var c := Vector2i(floori(x / SPACE_CELL), floori(z / SPACE_CELL))
	var reach := int(ceil((r + 4.0) / SPACE_CELL))
	for dj in range(-reach, reach + 1):
		for di in range(-reach, reach + 1):
			for q: Vector3 in _space.get(c + Vector2i(di, dj), []):
				if Vector2(q.x - x, q.y - z).length() < q.z + r:
					space_rejected += 1
					return false
	return true

func _space_take(x: float, z: float, r: float) -> void:
	var c := Vector2i(floori(x / SPACE_CELL), floori(z / SPACE_CELL))
	if not _space.has(c):
		_space[c] = []
	_space[c].append(Vector3(x, z, r))

func _space_claim(x: float, z: float, r: float) -> bool:
	if not _space_free(x, z, r):
		return false
	_space_take(x, z, r)
	return true

const CLEAR_N := 256
func _cell(lx: float, lz: float) -> int:
	var i := clampi(int((lx / _span + 0.5) * CLEAR_N), 0, CLEAR_N - 1)
	var j := clampi(int((lz / _span + 0.5) * CLEAR_N), 0, CLEAR_N - 1)
	return j * CLEAR_N + i

## open ground kept free of trees: roads and their verges, paved ground, buildings and a clearing round every place
func _clearings() -> PackedByteArray:
	var g := PackedByteArray()
	g.resize(CLEAR_N * CLEAR_N)
	var cs := _span / CLEAR_N
	var mark := func(c: Vector2, r: float):
		var n := int(ceil(r / cs))
		var ci := int((c.x / _span + 0.5) * CLEAR_N)
		var cj := int((c.y / _span + 0.5) * CLEAR_N)
		for dj in range(-n, n + 1):
			for di in range(-n, n + 1):
				var i := ci + di
				var j := cj + dj
				if i >= 0 and j >= 0 and i < CLEAR_N and j < CLEAR_N and Vector2(di, dj).length() * cs <= r + cs * 0.5:
					g[j * CLEAR_N + i] = 1
	for r in m.roads:
		var pts: Array = r.pts
		var rad := float(r.w) / 2.0 + 3.0
		for i in pts.size() - 1:
			var a := _loc(pts[i][0], pts[i][1])
			var b := _loc(pts[i + 1][0], pts[i + 1][1])
			var steps := maxi(1, int(a.distance_to(b) / (cs * 0.8)))
			for k in steps + 1:
				mark.call(a.lerp(b, float(k) / steps), rad)
	for p in m.pavements:
		mark.call(_loc(p[0], p[1]), maxf(float(p[2]), float(p[3])) + 2.0)
	for bd in m.buildings:
		mark.call(_loc(bd[0], bd[1]), maxf(float(bd[2]), float(bd[3])) + 2.5)
	for p in m.pois:
		mark.call(_loc(p.x, p.z), 16.0)
	return g

## Instanced props, split into ground tiles so each tile is culled on its own (off screen, out of the shadow cascades, past
## its draw distance). One multimesh over a whole region was drawn whole every pass: 9000 trees in every shadow cascade.
const TILE_M := 110.0
func _multimesh(mesh: Mesh, xf: Array[Transform3D], mat: Material, draw_m := 900.0, shadow := true) -> void:
	var tiles := {}
	for t in xf:
		var key := Vector2i(floori(t.origin.x / TILE_M), floori(t.origin.z / TILE_M))
		if not tiles.has(key):
			tiles[key] = [] as Array[Transform3D]
		tiles[key].append(t)
	for key in tiles:
		var list: Array[Transform3D] = tiles[key]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = list.size()
		for i in list.size():
			mm.set_instance_transform(i, list[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = mat
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mmi.visibility_range_end = draw_m
		mmi.visibility_range_end_margin = draw_m * 0.1
		mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		_world.add_child(mmi)

## a conifer: a trunk and three stacked crowns (the Road to Vostok forest look: dark, dense, uneven)
func _tree_mesh(cold: bool) -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.18
	trunk.bottom_radius = 0.3
	trunk.height = 3.0
	trunk.radial_segments = 6
	trunk.rings = 0
	trunk.cap_top = false # inside the crown
	trunk.cap_bottom = false # in the ground
	st.append_from(trunk, 0, Transform3D(Basis(), Vector3(0, 1.5, 0)))
	for k in 3:
		var c := CylinderMesh.new()
		c.top_radius = 0.0
		c.bottom_radius = 2.4 - k * 0.55
		c.height = 4.2 - k * 0.6
		c.radial_segments = 7
		c.rings = 0
		c.cap_top = false
		c.cap_bottom = false # the crown's underside: seen only from below the branches
		st.append_from(c, 0, Transform3D(Basis(), Vector3(0, 3.2 + k * 2.3, 0)))
	return st.commit()

func _tree_material(cold: bool) -> Material:
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
uniform float cold = 0.0;
uniform int season = 1;        // 0 spring, 1 summer, 2 autumn, 3 winter
uniform float evergreen = 0.0; // the tropics and the deserts don't turn
varying float hy;
void vertex() { hy = VERTEX.y; }
void fragment() {
	float n = fract(sin(dot(floor(NODE_POSITION_WORLD.xz), vec2(12.9898, 78.233))) * 43758.5453);
	vec3 leaf = mix(vec3(0.1, 0.2, 0.09), vec3(0.22, 0.32, 0.13), n);
	if (evergreen < 0.5 && cold < 0.5) {
		if (season == 0) leaf = n > 0.72 ? mix(vec3(0.85, 0.5, 0.65), vec3(0.95, 0.75, 0.85), fract(n * 7.0)) : leaf * vec3(1.15, 1.35, 1.05);
		if (season == 2 && n > 0.42) leaf = mix(vec3(0.62, 0.22, 0.06), vec3(0.85, 0.55, 0.12), fract(n * 5.3)) * (n > 0.9 ? 0.6 : 1.0);
		if (season == 3 && n > 0.42) leaf = mix(vec3(0.24, 0.2, 0.17), vec3(0.32, 0.27, 0.22), n);
	}
	vec3 c = hy < 2.6 ? vec3(0.22, 0.15, 0.1) : leaf * (0.75 + 0.35 * smoothstep(2.6, 10.0, hy));
	if ((cold > 0.5 || (season == 3 && evergreen < 0.5)) && hy > 2.6) c = mix(c, vec3(0.88, 0.92, 0.96), smoothstep(5.0, 9.5, hy) * 0.8);
	ALBEDO = c;
	ROUGHNESS = 0.95;
}"""
	mat.shader = sh
	mat.set_shader_parameter("cold", 1.0 if cold else 0.0)
	mat.set_shader_parameter("evergreen", 1.0 if map_id in EVERGREEN else 0.0)
	mat.set_shader_parameter("season", current_season())
	_tree_mats.append(mat)
	return mat

static func current_season() -> int:
	if season >= 0:
		return season
	var month := int(Time.get_date_dict_from_system().month)
	return [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][month - 1]

## recolour for the season: the ground's growing covers (green in spring, gold and rust in autumn, under snow in winter
## where winter comes) and every tree material; nothing is rebuilt
func _apply_season() -> void:
	var sn := current_season()
	if _season_btn:
		_season_btn.text = SEASONS[sn]
	for tm in _tree_mats:
		# the capital's boards are a tropical coast: its trees stay in summer leaf whatever the season
		tm.set_shader_parameter("season", 1 if map_id in ["nexus", "nexus-region"] else sn)
	if _weather:
		_weather.set_winter(sn == 3 and map_id not in NO_WINTER)
	if not _ground_mat or _base_pal.is_empty():
		return
	var covers: Array = Data.styles.get("covers", [])
	var pal := _base_pal.duplicate()
	var green := ["meadow", "grass", "forest", "denseForest", "scrub", "marsh", "crop"]
	var bare := ["dirt", "rock", "cliff", "town", "wash"]
	var turns := map_id not in EVERGREEN
	for i in covers.size():
		var cv: String = covers[i]
		var c: Vector3 = pal[i]
		if turns and cv in green:
			match sn:
				0: c = c * Vector3(0.95, 1.12, 0.9) + Vector3(0.0, 0.03, 0.0)
				2: c = c.lerp(Vector3(0.55, 0.38, 0.14) if cv != "crop" else Vector3(0.7, 0.55, 0.22), 0.55)
				3: c = c.lerp(Vector3(0.9, 0.93, 0.97), 0.0 if map_id in NO_WINTER else 0.8)
		if sn == 3 and map_id not in NO_WINTER and cv in bare:
			c = c.lerp(Vector3(0.88, 0.9, 0.94), 0.55)
		pal[i] = c
	_ground_mat.set_shader_parameter("pal", pal)

## the Storm Islands: torn-off chunks of land in the sky. Each has a jagged rock underside that tapers to a broken point,
## a slightly domed grass top with pines and boulders, and hangs over a sea that runs out to the haze.
func _build_floating() -> void:
	var floats: Array = m.get("floating", [])
	if floats.is_empty():
		return
	var rock := StandardMaterial3D.new()
	rock.albedo_color = Color("#5a5560")
	rock.roughness = 0.97
	var grass := StandardMaterial3D.new()
	grass.albedo_color = Color("#5d7a43")
	grass.roughness = 0.9
	# both sides drawn: the hand-built rings and dome are seen from below and above
	rock.cull_mode = BaseMaterial3D.CULL_DISABLED
	grass.cull_mode = BaseMaterial3D.CULL_DISABLED
	var trees: Array[Transform3D] = []
	var boulders: Array[Transform3D] = []
	for fi in floats.size():
		var f: Dictionary = floats[fi]
		var p := _loc(f.x, f.z)
		var r: float = f.r
		var top: float = f.top
		var rng := RandomNumberGenerator.new()
		rng.seed = fi * 7919 + 17
		# the underside: rings from the rim down to a tip, every vertex pushed in or out so the rock reads as broken
		const SEG := 22
		const RINGS := 9
		var depth := r * (1.5 + rng.randf() * 0.5)
		var tip := Vector2((rng.randf() - 0.5) * r * 0.4, (rng.randf() - 0.5) * r * 0.4)
		var ring_pts: Array = []
		for k in RINGS + 1:
			var t := float(k) / RINGS
			var row: Array[Vector3] = []
			var rad := r * pow(1.0 - t, 0.75)
			for sgi in SEG:
				var ang := sgi * TAU / SEG
				var jag := 1.0 + (rng.randf() - 0.5) * (0.12 if k == 0 else 0.38)
				var c := tip * t
				row.append(Vector3(p.x + c.x + cos(ang) * rad * jag, top - 1.0 - depth * t + (rng.randf() - 0.5) * r * 0.08 * t, p.y + c.y + sin(ang) * rad * jag))
			ring_pts.append(row)
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for k in RINGS:
			for sgi in SEG:
				var a0: Vector3 = ring_pts[k][sgi]
				var a1: Vector3 = ring_pts[k][(sgi + 1) % SEG]
				var b0: Vector3 = ring_pts[k + 1][sgi]
				var b1: Vector3 = ring_pts[k + 1][(sgi + 1) % SEG]
				for v in [a0, b0, a1, a1, b0, b1]:
					st.add_vertex(v)
		st.generate_normals()
		var under := MeshInstance3D.new()
		under.mesh = st.commit()
		under.material_override = rock
		_world.add_child(under)
		# the top: a low dome over the rim ring, grassed
		var ct := SurfaceTool.new()
		ct.begin(Mesh.PRIMITIVE_TRIANGLES)
		var centre := Vector3(p.x, top + r * 0.06, p.y)
		var rim: Array[Vector3] = ring_pts[0]
		for sgi in SEG:
			var v0: Vector3 = rim[sgi] + Vector3(0, 1.0, 0)
			var v1: Vector3 = rim[(sgi + 1) % SEG] + Vector3(0, 1.0, 0)
			for v in [centre, v1, v0]:
				ct.add_vertex(v)
		ct.generate_normals()
		var cap := MeshInstance3D.new()
		cap.mesh = ct.commit()
		cap.material_override = grass
		_world.add_child(cap)
		# pines and boulders on top (fewer near the rim)
		var n_trees := int(r * 0.45)
		for ti in n_trees:
			var ang := rng.randf() * TAU
			var d := sqrt(rng.randf()) * r * 0.75
			var lx := p.x + cos(ang) * d
			var lz := p.y + sin(ang) * d
			var ly := top + r * 0.06 * (1.0 - d / r) - 0.3
			var sc := 0.8 + rng.randf() * 0.7
			if not _space_claim(lx, lz, 1.1 * sc):
				continue
			trees.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * (0.9 + rng.randf() * 0.4), sc)), Vector3(lx, ly, lz)))
		for bi in 3 + int(r / 12.0):
			var ang2 := rng.randf() * TAU
			var d2 := (0.4 + rng.randf() * 0.5) * r
			var bs := 1.2 + rng.randf() * 2.4
			if not _space_claim(p.x + cos(ang2) * d2, p.y + sin(ang2) * d2, bs):
				continue
			boulders.append(Transform3D(Basis.from_euler(Vector3(rng.randf(), rng.randf() * TAU, rng.randf())).scaled(Vector3(bs, bs * 0.7, bs)),
				Vector3(p.x + cos(ang2) * d2, top + r * 0.06 * (1.0 - d2 / r) + bs * 0.2, p.y + sin(ang2) * d2)))
	if not trees.is_empty():
		_multimesh(_tree_mesh(false), trees, _tree_material(false))
	if not boulders.is_empty():
		var sm := SphereMesh.new()
		sm.radius = 1.0
		sm.height = 2.0
		sm.radial_segments = 7
		sm.rings = 4
		_multimesh(sm, boulders, rock)
	_floating_extras(floats, rock, grass)

## The board's Floating Islands region ("levitating landmasses, anti-gravity zones, and otherworldly resources"): round the
## six named islands a swarm of smaller torn-off islets at every height; waterfalls pouring off the rims into nothing and
## fading to mist; violet and cyan crystal clusters on the tops and hanging from the undersides (the otherworldly resource);
## and rubble that hangs and bobs in the air round each island (the anti-gravity zones), moving in the vertex shader.
func _floating_extras(floats: Array, rock: Material, grass: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	var falls := SurfaceTool.new()
	falls.begin(Mesh.PRIMITIVE_TRIANGLES)
	var crystals: Array[Transform3D] = []
	var debris: Array[Transform3D] = []
	var islets := SurfaceTool.new()
	islets.begin(Mesh.PRIMITIVE_TRIANGLES)
	var caps := SurfaceTool.new()
	caps.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sources: Array = []
	for f in floats:
		var p := _loc(f.x, f.z)
		sources.append([p, float(f.r), float(f.top)])
		# islets: 5-7 per island, 3-12 m across, scattered round it and up to 60 m above or below
		for k in 5 + rng.randi() % 3:
			var a := rng.randf() * TAU
			var d := float(f.r) * (1.6 + rng.randf() * 2.2)
			var ir := 3.0 + rng.randf() * 9.0
			var ip := p + Vector2(cos(a), sin(a)) * d
			var itop := float(f.top) + rng.randf_range(-60.0, 50.0)
			_islet(islets, caps, ip, ir, itop, rng)
			sources.append([ip, ir, itop])
	for src in sources:
		var p: Vector2 = src[0]
		var r: float = src[1]
		var top: float = src[2]
		# waterfalls off the bigger rims
		if r >= 9.0:
			for w in (2 if r >= 20.0 else 1):
				var a := rng.randf() * TAU
				var width := clampf(r * 0.12, 1.6, 4.5)
				var drop := r * 2.2 + rng.randf() * 60.0
				var c := p + Vector2(cos(a), sin(a)) * r * 0.96
				var side := Vector2(-sin(a), cos(a)) * width * 0.5
				var out := Vector2(cos(a), sin(a))
				# a curtain that leaves the lip, arcs out a little and falls; v runs down it for the shader
				var steps := 6
				for i in steps:
					var t0 := float(i) / steps
					var t1 := float(i + 1) / steps
					var o0 := out * (sqrt(t0) * 4.0)
					var o1 := out * (sqrt(t1) * 4.0)
					var y0 := top + 0.6 - drop * t0
					var y1 := top + 0.6 - drop * t1
					var q := [Vector3(c.x - side.x + o0.x, y0, c.y - side.y + o0.y), Vector3(c.x + side.x + o0.x, y0, c.y + side.y + o0.y),
						Vector3(c.x + side.x * (1.0 + t1) + o1.x, y1, c.y + side.y * (1.0 + t1) + o1.y), Vector3(c.x - side.x * (1.0 + t1) + o1.x, y1, c.y - side.y * (1.0 + t1) + o1.y)]
					var uvs := [Vector2(0, t0), Vector2(1, t0), Vector2(1, t1), Vector2(0, t1)]
					for tri in [[0, 1, 2], [0, 2, 3]]:
						for vi in tri:
							falls.set_uv(uvs[vi])
							falls.add_vertex(q[vi])
		# crystals: a cluster on top, a few hanging under the tip
		var nc := 2 + int(r / 10.0)
		for i in nc:
			var a2 := rng.randf() * TAU
			var d2 := rng.randf() * r * 0.6
			var s2 := 0.6 + rng.randf() * (1.2 + r * 0.04)
			crystals.append(Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.35, 0.35), rng.randf() * TAU, rng.randf_range(-0.35, 0.35))).scaled(Vector3(s2 * 0.6, s2 * 2.2, s2 * 0.6)),
				Vector3(p.x + cos(a2) * d2, top + 0.4, p.y + sin(a2) * d2)))
		for i in 1 + int(r / 14.0):
			var s3 := 0.8 + rng.randf() * 2.0
			crystals.append(Transform3D(Basis(Vector3.RIGHT, PI).scaled(Vector3(s3 * 0.6, s3 * 2.6, s3 * 0.6)),
				Vector3(p.x + rng.randf_range(-r, r) * 0.3, top - r * 1.2 - rng.randf() * r * 0.4, p.y + rng.randf_range(-r, r) * 0.3)))
		# hovering rubble
		for i in 6 + int(r / 3.0):
			var a4 := rng.randf() * TAU
			var d4 := r * (1.05 + rng.randf() * 0.9)
			var s4 := 0.3 + rng.randf() * 1.4
			debris.append(Transform3D(Basis.from_euler(Vector3(rng.randf() * TAU, rng.randf() * TAU, rng.randf() * TAU)).scaled(Vector3(s4, s4 * 0.7, s4)),
				Vector3(p.x + cos(a4) * d4, top - rng.randf() * r * 1.4 + 2.0, p.y + sin(a4) * d4)))
	var im := MeshInstance3D.new()
	islets.generate_normals()
	im.mesh = islets.commit()
	im.material_override = rock
	_world.add_child(im)
	var cm2 := MeshInstance3D.new()
	caps.generate_normals()
	cm2.mesh = caps.commit()
	cm2.material_override = grass
	_world.add_child(cm2)
	# the falls: white water scrolling down, thinning into mist at the foot
	var fsh := Shader.new()
	fsh.code = """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	float streak = n(vec2(UV.x * 9.0, UV.y * 6.0 - TIME * 1.6)) * 0.7 + n(vec2(UV.x * 23.0, UV.y * 14.0 - TIME * 2.6)) * 0.4;
	float edge = smoothstep(0.0, 0.2, UV.x) * smoothstep(1.0, 0.8, UV.x);
	float fade = 1.0 - smoothstep(0.55, 1.0, UV.y);
	ALBEDO = vec3(0.75, 0.86, 0.95) * streak * edge * fade * 0.9;
}"""
	var fm := ShaderMaterial.new()
	fm.shader = fsh
	var fmi := MeshInstance3D.new()
	fmi.mesh = falls.commit()
	fmi.material_override = fm
	fmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_world.add_child(fmi)
	# crystals
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.0
	cyl.bottom_radius = 0.6
	cyl.height = 2.0
	cyl.radial_segments = 6
	cyl.rings = 1
	var cmat := StandardMaterial3D.new()
	cmat.albedo_color = Color(0.6, 0.45, 1.0, 0.85)
	cmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cmat.emission_enabled = true
	cmat.emission = Color(0.55, 0.3, 1.0)
	cmat.emission_energy_multiplier = 2.4
	cmat.roughness = 0.1
	_multimesh(cyl, crystals, cmat, 900.0, false)
	# hovering rubble: bobs and turns slowly in the vertex shader, each piece on its own phase
	var dsh := Shader.new()
	dsh.code = """shader_type spatial;
void vertex() {
	vec3 o = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float ph = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
	float a = TIME * 0.3 + ph;
	VERTEX.xz = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * VERTEX.xz;
	VERTEX.y += sin(TIME * 0.6 + ph) * 0.8 / max(length(MODEL_MATRIX[1].xyz), 0.01);
}
void fragment() { ALBEDO = vec3(0.36, 0.34, 0.4); ROUGHNESS = 0.95; }"""
	var dm := ShaderMaterial.new()
	dm.shader = dsh
	var rk := SphereMesh.new()
	rk.radius = 1.0
	rk.height = 1.6
	rk.radial_segments = 5
	rk.rings = 3
	_multimesh(rk, debris, dm, 800.0, false)
	Flora.vines(self, sources)
	# a cold glow from the crystals under each named island
	for f in floats:
		var p := _loc(f.x, f.z)
		var l := OmniLight3D.new()
		l.light_color = Color(0.6, 0.4, 1.0)
		l.light_energy = 2.0
		l.omni_range = float(f.r) * 2.5
		l.position = Vector3(p.x, float(f.top) - float(f.r) * 1.2, p.y)
		_world.add_child(l)

## a small torn-off islet: a jagged cone under a grassed cap
func _islet(under: SurfaceTool, cap: SurfaceTool, p: Vector2, r: float, top: float, rng: RandomNumberGenerator) -> void:
	const SEG := 9
	var depth := r * (1.3 + rng.randf() * 0.8)
	var rim: Array[Vector3] = []
	for i in SEG:
		var a := i * TAU / SEG
		var j := 1.0 + (rng.randf() - 0.5) * 0.35
		rim.append(Vector3(p.x + cos(a) * r * j, top, p.y + sin(a) * r * j))
	var mid: Array[Vector3] = []
	for i in SEG:
		var a := i * TAU / SEG
		mid.append(Vector3(p.x + cos(a) * r * 0.55 * (0.8 + rng.randf() * 0.4), top - depth * 0.45, p.y + sin(a) * r * 0.55 * (0.8 + rng.randf() * 0.4)))
	var tip := Vector3(p.x + rng.randf_range(-r, r) * 0.25, top - depth, p.y + rng.randf_range(-r, r) * 0.25)
	for i in SEG:
		var i2 := (i + 1) % SEG
		for v in [rim[i], mid[i], rim[i2], rim[i2], mid[i], mid[i2], mid[i], tip, mid[i2]]:
			under.add_vertex(v)
		for v in [Vector3(p.x, top + r * 0.08, p.y), rim[i2] + Vector3(0, 0.3, 0), rim[i] + Vector3(0, 0.3, 0)]:
			cap.add_vertex(v)

## street lights along the roads at night (the wet-neon city frames): a glowing head every 24 m on both kerbs
func _build_lamps() -> void:
	if _style.night < 0.5:
		return
	var xf: Array[Transform3D] = []
	for r in m.roads:
		if not (r.cls in ["street", "main", "highway", "bridge"]) or xf.size() > 3000:
			continue
		var pts: Array = r.pts
		var off := float(r.w) / 2.0 + 0.8
		var carry := 0.0
		for i in pts.size() - 1:
			var a := _loc(pts[i][0], pts[i][1])
			var b := _loc(pts[i + 1][0], pts[i + 1][1])
			var L := a.distance_to(b)
			if L < 0.01:
				continue
			var d := (b - a) / L
			var n := Vector2(-d.y, d.x)
			var t := carry
			while t < L:
				for sd in [-1.0, 1.0]:
					var q: Vector2 = a + d * t + n * off * sd
					xf.append(Transform3D(Basis(), Vector3(q.x, _h(q.x, q.y) + 6.0, q.y)))
				t += 24.0
			carry = t - L
	for p in m.pavements:
		if p[5] != "street" or xf.size() > 4000:
			continue
		var c := _loc(p[0], p[1])
		var long := maxf(float(p[2]), float(p[3]))
		var along_x := float(p[2]) >= float(p[3])
		var t := -long
		while t < long:
			for sd in [-1.0, 1.0]:
				var q: Vector2 = c + (Vector2(t, sd * (float(p[3]) + 0.6)) if along_x else Vector2(sd * (float(p[2]) + 0.6), t))
				xf.append(Transform3D(Basis(), Vector3(q.x, _h(q.x, q.y) + 6.0, q.y)))
			t += 24.0
	if xf.is_empty():
		return
	var sm := SphereMesh.new()
	sm.radius = 0.35
	sm.height = 0.7
	sm.radial_segments = 8
	sm.rings = 4
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.82, 0.55) if _style.neon < 0.5 and _style.ordered < 0.5 else Color(0.75, 0.9, 1.0)
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 4.0
	_multimesh(sm, xf, mat)

var _labels: Array = []
var _declutter_t := 0.0

## place names that never pile up: every few frames the nearer, more important names win their spot on screen
func _declutter() -> void:
	if _cam == null:
		return
	var placed: Array[Rect2] = []
	var vs := _vp.get_visible_rect().size
	# names are sized against the view's height: on an upright phone that made them as wide as the screen, so they
	# shrink with a narrow view
	var shrink := clampf(vs.x / maxf(vs.y, 1.0) * 1.4, 0.55, 1.0)
	var order := _labels.duplicate()
	order.sort_custom(func(a, b): return a.rank < b.rank or (a.rank == b.rank and a.node.global_position.distance_to(_cam.global_position) < b.node.global_position.distance_to(_cam.global_position)))
	for e in order:
		var l: Label3D = e.node
		if bool(l.get_meta("hidden", false)):
			l.visible = false
			continue
		var wp := l.global_position
		if _cam.is_position_behind(wp) or wp.distance_to(_cam.global_position) > l.visibility_range_end:
			l.visible = false
			continue
		l.pixel_size = float(l.get_meta("px", l.pixel_size)) * shrink
		var sp := _cam.unproject_position(wp)
		# the name's real size on screen: a fixed-size Label3D is pixel_size × font_size tall at one metre, so a fraction
		# of the view's height. The old guess (11 px a letter) was a third of the real width on a phone, so names that
		# looked apart to the guess sat on top of each other (owner's phone test, Nov 9)
		var gh := l.pixel_size * float(l.font_size) / (2.0 * tan(deg_to_rad(_cam.fov) * 0.5)) * vs.y
		var w := float(l.text.length()) * gh * 0.56 + gh * 0.8
		var r := Rect2(sp - Vector2(w / 2.0, gh * 0.65), Vector2(w, gh * 1.3))
		var ok := Rect2(Vector2.ZERO, vs).intersects(r)
		for q in placed:
			if q.intersects(r):
				ok = false
				break
		l.visible = ok
		if ok:
			placed.append(r)

func _build_labels() -> void:
	_labels.clear()
	for p in m.pois:
		if int(p.rank) > 2:
			continue
		var at := _loc(p.x, p.z)
		var y := _h(at.x, at.y)
		var fl := _floating_top(p.x, p.z)
		if fl > -INF:
			y = fl
		var l := Label3D.new()
		l.text = p.name
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.fixed_size = true
		l.pixel_size = 0.0016
		l.set_meta("px", 0.0016)
		l.font_size = 30
		l.outline_size = 10
		l.modulate = Color(Data.styles.poi.get(p.cat, {"color": "#ffffff"}).color).lightened(0.45)
		l.outline_modulate = Color(0.02, 0.05, 0.09, 0.9)
		l.no_depth_test = true    # over the towers: a name half behind a building could not be read (the declutter keeps them apart)
		l.position = Vector3(at.x, maxf(y, _water) + 9.0, at.y)
		l.visibility_range_end = 1200.0 if int(p.rank) == 0 else (420.0 if int(p.rank) == 1 else 180.0)
		l.set_meta("cat", String(p.get("cat", "")))
		_world.add_child(l)
		_labels.append({"node": l, "rank": int(p.rank)})
	_fit_labels()

## the POI labels are sized for the city overview; on foot (STREET / PLAY) they shrink to a street sign, show only
## nearby, and the transit stations stay out of the way altogether
func _fit_labels() -> void:
	var foot := mode == Mode.STREET or mode == Mode.PLAY
	for e in _labels:
		var l := e.node as Label3D
		var rank := int(e.rank)
		var cat := String(l.get_meta("cat", ""))
		if foot:
			l.pixel_size = 0.0007
			l.set_meta("px", 0.0007)
			l.font_size = 22
			l.outline_size = 6
			l.visibility_range_end = 220.0 if rank == 0 else (110.0 if rank == 1 else 60.0)
			l.set_meta("hidden", cat in ["station", "transit"])
			l.visible = not bool(l.get_meta("hidden"))
		else:
			l.pixel_size = 0.0016
			l.set_meta("px", 0.0016)
			l.font_size = 30
			l.outline_size = 10
			l.visibility_range_end = 1200.0 if rank == 0 else (420.0 if rank == 1 else 180.0)
			l.set_meta("hidden", false)
			l.visible = true

func _floating_top(x: float, z: float) -> float:
	for f in m.get("floating", []):
		if Vector2(x - f.x, z - f.z).length() < f.r:
			return f.top
	return -INF

# ---------------- cameras ----------------

func set_mode(md: Mode) -> void:
	mode = md
	_mode_btn.text = "3D CITY" if mode == Mode.STREET else "STREET VIEW"
	_mode_btn.visible = mode != Mode.PLAY
	# a mission draws its own HUD over the view
	if _head:
		_head.visible = mode != Mode.PLAY
	if _zoom_buttons:
		_zoom_buttons.visible = mode != Mode.PLAY
	if _jump:
		_jump.visible = mode != Mode.PLAY
	_pad_city.visible = mode == Mode.CITY
	_pad_street.visible = mode == Mode.STREET
	_fit_labels()
	if _barks:
		_barks.visible = mode == Mode.STREET
	if mode == Mode.STREET or mode == Mode.PLAY:
		_stand_near(Vector2(_target.x, _target.z))
	if mode == Mode.PLAY:
		return   # a mission (scripts/mission/descent.gd) owns the camera and the input
	_apply_cam()

# ---------------- play (the Fracture Descent missions walk the regions with the on-foot operator) ----------------
func world() -> Node3D:
	return _world
func camera() -> Camera3D:
	return _cam
func span() -> float:
	return _span
## where Street View would stand: open ground near the place the region opened at
func stand_point() -> Vector3:
	return Vector3(_eye.x, _ground(_eye.x, _eye.z), _eye.z)
## walkable height at a local point (operator_player.gd ground_at)
func ground(lx: float, lz: float) -> float:
	return _ground(lx, lz)
## the terrain height alone (below the water where the sea is) and the sea level, for boats and subs
func terrain(lx: float, lz: float) -> float:
	return _h(lx, lz)
func water_level() -> float:
	return _water
func over_water(lx: float, lz: float) -> bool:
	return _h(lx, lz) < _water - 0.3
## the buildings as world boxes (local space, metres from the region centre), for the on-foot movers to slide around
func building_boxes() -> Array[AABB]:
	var out: Array[AABB] = []
	for bd in m.buildings:
		var p := _loc(bd[0], bd[1])
		var hx := float(bd[2])
		var hz := float(bd[3])
		var yaw := float(bd[4])
		var c := cos(yaw)
		var sn := sin(yaw)
		var ex := absf(hx * c) + absf(hz * sn)
		var ez := absf(hx * sn) + absf(hz * c)
		var y := _h(p.x, p.y)
		out.append(AABB(Vector3(p.x - ex, y - 2.0, p.y - ez), Vector3(ex * 2.0, _bh(bd) + 4.0, ez * 2.0)))
	return out
## a local point from a map (world) one
func local_point(x: float, z: float) -> Vector2:
	return _loc(x, z)

## stand a few metres off a place (it is often a building) on open ground, facing it
func _stand_near(at: Vector2) -> void:
	var best := Vector2(at.x + 12.0, at.y + 12.0)
	for k in 16:
		var a := k * TAU / 16.0
		var q := at + Vector2(cos(a), sin(a)) * 14.0
		if not _in_building(q):
			best = q
			break
	_eye = Vector3(best.x, _ground(best.x, best.y) + EYE, best.y)
	_look_yaw = atan2(_eye.x - at.x, _eye.z - at.y)
	_look_pitch = 4.0

func _in_building(q: Vector2) -> bool:
	for bd in m.buildings:
		var p := _loc(bd[0], bd[1])
		var c := cos(-float(bd[4]))
		var sn := sin(-float(bd[4]))
		var dx := q.x - p.x
		var dz := q.y - p.y
		if absf(dx * c + dz * sn) < float(bd[2]) + 1.5 and absf(-dx * sn + dz * c) < float(bd[3]) + 1.5:
			return true
	return false

## where you stand in Street View: the ground, an island top in the sky, or the deck over water
func _ground(lx: float, lz: float) -> float:
	var fl := _floating_top(lx + _ox, lz + _oz)
	if fl > -INF:
		return fl
	return maxf(_h(lx, lz), _water + 0.4)

func _apply_cam() -> void:
	if _cam == null:
		return
	if mode == Mode.CITY:
		var pr := deg_to_rad(_pitch)
		var off := Vector3(sin(_yaw) * cos(pr), sin(pr), cos(_yaw) * cos(pr)) * _dist
		_cam.position = _target + off
		_cam.look_at(_target, Vector3.UP)
		_cam.fov = 55.0
	else:
		_cam.position = _eye
		_cam.rotation = Vector3(deg_to_rad(_look_pitch), _look_yaw, 0)
		_cam.fov = 70.0

func _process(dt: float) -> void:
	var tsec := Time.get_ticks_msec() * 0.001
	for n in _spin:
		if is_instance_valid(n):
			n.rotate_y(dt * float(n.get_meta("spin", 0.3)))
			if n.has_meta("flicker"):
				# a lightning bolt: on for a short flash every so often, at its own rate
				var f := float(n.get_meta("flicker"))
				n.visible = fmod(tsec * f + float(n.get_instance_id() % 97) * 0.13, 1.0) < 0.12
	if _cam == null or mode == Mode.PLAY:
		return
	_declutter_t -= dt
	if _declutter_t <= 0.0:
		_declutter_t = 0.2
		_declutter()
	if _move != Vector2.ZERO:
		if mode == Mode.CITY:
			var fwd := Vector3(-sin(_yaw), 0, -cos(_yaw))
			var right := Vector3(cos(_yaw), 0, -sin(_yaw))
			_target += (right * _move.x + fwd * -_move.y) * _dist * 0.9 * dt
			_target.x = clampf(_target.x, -_span / 2.0, _span / 2.0)
			_target.z = clampf(_target.z, -_span / 2.0, _span / 2.0)
			_target.y = _h(_target.x, _target.z)
		else:
			var dir := Vector3(-sin(_look_yaw), 0, -cos(_look_yaw)) * -_move.y
			var nx := clampf(_eye.x + dir.x * 6.0 * dt, -_span / 2.0, _span / 2.0)
			var nz := clampf(_eye.z + dir.z * 6.0 * dt, -_span / 2.0, _span / 2.0)
			_eye = Vector3(nx, lerpf(_eye.y, _ground(nx, nz) + EYE, minf(1.0, dt * 10.0)), nz)
		_apply_cam()

func _zoom(f: float) -> void:
	if mode == Mode.CITY:
		_dist = clampf(_dist * f, 15.0, _span * 1.1)
	else:
		_cam.fov = clampf(_cam.fov * f, 30.0, 85.0)
		return
	_apply_cam()

func _turn(rel: Vector2) -> void:
	_moved += rel.length()
	if mode == Mode.CITY:
		_yaw -= rel.x * 0.006
		_pitch = clampf(_pitch + rel.y * 0.25, 8.0, 85.0)
	else:
		_look_yaw -= rel.x * 0.005
		_look_pitch = clampf(_look_pitch - rel.y * 0.2, -60.0, 60.0)
	_apply_cam()

func _input_3d(ev: InputEvent) -> void:
	if mode == Mode.PLAY:
		return
	if ev is InputEventMouseButton and ev.device != InputEvent.DEVICE_ID_EMULATION:
		if ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom(0.88)
		elif ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom(1.14)
		elif ev.button_index == MOUSE_BUTTON_LEFT:
			_press(ev.pressed, ev.position)
	elif ev is InputEventMouseMotion and ev.device != InputEvent.DEVICE_ID_EMULATION and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		_turn(ev.relative)
	elif ev is InputEventScreenTouch:
		if ev.pressed:
			_touches[ev.index] = ev.position
		else:
			_touches.erase(ev.index)
		_pinch_d = 0.0
		if _touches.size() <= 1:
			_press(ev.pressed, ev.position)
	elif ev is InputEventScreenDrag:
		_touches[ev.index] = ev.position
		if _touches.size() >= 2:
			var ks := _touches.keys()
			var d: float = (_touches[ks[0]] as Vector2).distance_to(_touches[ks[1]])
			if _pinch_d > 0.0:
				_zoom(_pinch_d / d)
			_pinch_d = d
			_moved += 100.0
		else:
			_turn(ev.relative)
	elif ev is InputEventMagnifyGesture:
		_zoom(1.0 / ev.factor)

func _press(down: bool, pos: Vector2) -> void:
	if down:
		_moved = 0.0
		return
	if _moved > 12.0 or mode != Mode.CITY:
		return
	var now := Time.get_ticks_msec()
	if now - _last_tap < 300:
		var hit: Variant = _ground_hit(pos)
		if hit != null:
			_target = hit
			_dist = maxf(40.0, _dist * 0.6)
			_apply_cam()
		_last_tap = 0
		return
	_last_tap = now

## the ground under a screen point: march the camera ray until it goes below the surface
func _ground_hit(pos: Vector2) -> Variant:
	var o := _cam.project_ray_origin(pos)
	var d := _cam.project_ray_normal(pos)
	var t := 0.0
	while t < 3000.0:
		var p := o + d * t
		if p.y < maxf(_h(p.x, p.z), _water):
			return Vector3(p.x, _h(p.x, p.z), p.z)
		t += 2.0
	return null

func _fill_jump() -> void:
	_jump.clear()
	_jump.add_item("JUMP TO A PLACE")
	for p in m.pois:
		if int(p.rank) <= 2:
			_jump.add_item(p.name)
			_jump.set_item_metadata(_jump.item_count - 1, p)

func _on_jump(i: int) -> void:
	if i <= 0:
		return
	var p: Dictionary = _jump.get_item_metadata(i)
	var at := _loc(p.x, p.z)
	_target = Vector3(at.x, _h(at.x, at.y), at.y)
	if mode == Mode.STREET:
		_stand_near(at)
	else:
		_dist = clampf(_span * 0.12, 50.0, 300.0)
	_apply_cam()
	_jump.select(0)


# Pass 17: batched rooftop mechanical penthouses and perimeter parapets.
# Original building data, placement, footprint and gameplay remain unchanged.
# Uses one additional mesh for the entire region, rather than one node per roof.
func _build_tower_rooftops_pass_17() -> void:
	if m.buildings.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	for bd in m.buildings:
		if _is_landmark(bd):
			continue
		var hgt := _bh(bd)
		if hgt < 75.0:
			continue
		var hx: float = bd[2]
		var hz: float = bd[3]
		if minf(hx, hz) < 4.0:
			continue
		var p := _loc(bd[0], bd[1])
		var yaw: float = bd[4]
		var c := cos(yaw)
		var si := sin(yaw)
		var corners: Array[Vector2] = []
		for v in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = v.x * hx
			var lz: float = v.y * hz
			corners.append(Vector2(p.x + lx * c + lz * si, p.y - lx * si + lz * c))
		var base := INF
		for q in corners:
			base = minf(base, _h(q.x, q.y))
		base -= 0.6
		var top := maxf(base + 3.0, _h(p.x, p.y) + hgt)
		var tiers := 3 if hgt >= 115.0 else 2
		var shrink := 1.0 - float(tiers - 1) * 0.115
		var roof_hx := hx * shrink
		var roof_hz := hz * shrink
		var seed := fposmod(float(count) * 0.6180339, 1.0)
		var tone := Color(0.24, 0.27, 0.29)
		# The raised central equipment house has four walls and a roof.
		var pent_hx := roof_hx * 0.30
		var pent_hz := roof_hz * 0.35
		var pent_h := clampf(hgt * 0.045, 2.0, 6.0)
		_roof_box_pass_17(st, p, c, si, Vector2.ZERO,
			pent_hx, pent_hz, top, top + pent_h, tone, seed)
		# Two small mechanical blocks; no extra nodes or draw calls.
		for j in range(2):
			var off := Vector2(roof_hx * (0.62 if j == 0 else -0.62), 0.0)
			_roof_box_pass_17(st, p, c, si, off,
				roof_hx * 0.13, roof_hz * 0.18, top, top + 1.6,
				tone.darkened(0.15), seed)
		# Perimeter parapets: short thin boxes along the roof edge.
		var parapet := minf(0.3, minf(roof_hx, roof_hz) * 0.08)
		for side in [-1.0, 1.0]:
			_roof_box_pass_17(st, p, c, si, Vector2(side * (roof_hx - parapet), 0),
				parapet, roof_hz, top, top + 0.9, tone.lightened(0.12), seed)
			_roof_box_pass_17(st, p, c, si, Vector2(0, side * (roof_hz - parapet)),
				roof_hx, parapet, top, top + 0.9, tone.lightened(0.12), seed)
		count += 1
	if count == 0:
		return
	var mi := MeshInstance3D.new()
	mi.name = "Pass17_BatchedTowerRooftops"
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.82
	mat.metallic = 0.15
	mi.material_override = mat
	_world.add_child(mi)

func _roof_box_pass_17(st: SurfaceTool, origin: Vector2, c: float, si: float,
		offset: Vector2, hx: float, hz: float, lo: float, hi: float,
		tint: Color, seed: float) -> void:
	var corners: Array[Vector2] = []
	for v in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		var lx: float = offset.x + v.x * hx
		var lz: float = offset.y + v.y * hz
		corners.append(Vector2(origin.x + lx * c + lz * si,
			origin.y - lx * si + lz * c))
	for f in range(4):
		var a := corners[f]
		var b := corners[(f + 1) % 4]
		var quad := [Vector3(a.x, lo, a.y), Vector3(b.x, lo, b.y),
			Vector3(b.x, hi, b.y), Vector3(a.x, hi, a.y)]
		var mid := (a + b) * 0.5 - origin
		var normal := Vector3(mid.x, 0, mid.y).normalized()
		for t in [[0, 1, 2], [0, 2, 3]]:
			_tri(st, [quad[t[0]], quad[t[1]], quad[t[2]]],
				[Vector2.ZERO, Vector2.ZERO, Vector2.ZERO], normal,
				Color(tint, 1.0), seed)
	var roof := [Vector3(corners[0].x, hi, corners[0].y),
		Vector3(corners[1].x, hi, corners[1].y),
		Vector3(corners[2].x, hi, corners[2].y),
		Vector3(corners[3].x, hi, corners[3].y)]
	for t in [[0, 1, 2], [0, 2, 3]]:
		_tri(st, [roof[t[0]], roof[t[1]], roof[t[2]]],
			[Vector2.ZERO, Vector2.ZERO, Vector2.ZERO], Vector3.UP,
			Color(tint, 1.0), seed)

# Pass 18: batched ground-floor entrances for urban buildings.
# Non-interactive facade accents only; original building collision and data are unchanged.
func _build_entrances_pass_18() -> void:
	if m.buildings.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	for bd in m.buildings:
		if _is_landmark(bd):
			continue
		var hgt := _bh(bd)
		if hgt < 16.0:
			continue
		var hx: float = bd[2]
		var hz: float = bd[3]
		if minf(hx, hz) < 3.5:
			continue
		var p := _loc(bd[0], bd[1])
		var yaw: float = bd[4]
		var c := cos(yaw)
		var si := sin(yaw)
		var corners: Array[Vector2] = []
		for v in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = v.x * hx
			var lz: float = v.y * hz
			corners.append(Vector2(p.x + lx * c + lz * si, p.y - lx * si + lz * c))
		var base := INF
		for q in corners:
			base = minf(base, _h(q.x, q.y))
		base -= 0.6
		# Negative local Z frontage; details sit close to the existing wall.
		var front := -hz - 0.12
		var entrance_width := minf(2.0, hx * 0.32)
		var accent := Color(0.11, 0.16, 0.20)
		var trim := Color(0.33, 0.35, 0.37)
		var glass := Color(0.08, 0.15, 0.20)
		var seed := fposmod(float(count) * 0.75487766, 1.0)
		# Door, double side jambs, lintel and overhanging entry canopy.
		_roof_box_pass_17(st, p, c, si, Vector2(0, front), entrance_width, 0.07,
			base + 0.15, base + 3.25, glass, seed)
		for side in [-1.0, 1.0]:
			_roof_box_pass_17(st, p, c, si,
				Vector2(side * (entrance_width + 0.14), front - 0.03), 0.12, 0.13,
				base + 0.1, base + 3.65, trim, seed)
		_roof_box_pass_17(st, p, c, si, Vector2(0, front - 0.02),
			entrance_width + 0.25, 0.14, base + 3.3, base + 3.65, trim, seed)
		_roof_box_pass_17(st, p, c, si, Vector2(0, front - 0.68),
			entrance_width + 0.75, 0.73, base + 3.65, base + 3.86, accent, seed)
		# Repeated pilasters at storefront frontage, restrained for performance.
		for side in [-1.0, 1.0]:
			var offset_x: float = side * minf(hx * 0.75, entrance_width + 2.4)
			_roof_box_pass_17(st, p, c, si, Vector2(offset_x, front + 0.04),
				0.16, 0.16, base + 0.1, base + 4.1, trim, seed)
		count += 1
	if count == 0:
		return
	var mesh := st.commit()
	if mesh == null:
		return
	var node := MeshInstance3D.new()
	node.name = "Pass18_BatchedGroundFloorEntrances"
	node.mesh = mesh
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.58
	material.metallic = 0.18
	node.material_override = material
	_world.add_child(node)

# Batch 19–43: first integrated production slice.
# Roof accessories are batched into a single draw surface, keeping original
# footprint data and procedural buildings intact.
func _build_architecture_batch_19_43() -> void:
	if m.buildings.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	for bd in m.buildings:
		if _is_landmark(bd):
			continue
		var hgt := _bh(bd)
		var hx: float = bd[2]
		var hz: float = bd[3]
		if hgt < 75.0 or minf(hx, hz) < 6.0:
			continue
		var p := _loc(bd[0], bd[1])
		var yaw: float = bd[4]
		var c := cos(yaw)
		var si := sin(yaw)
		var corners: Array[Vector2] = []
		for v in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = v.x * hx
			var lz: float = v.y * hz
			corners.append(Vector2(p.x + lx * c + lz * si, p.y - lx * si + lz * c))
		var base := INF
		for q in corners:
			base = minf(base, _h(q.x, q.y))
		base -= 0.6
		var roof_y := maxf(base + 3.0, _h(p.x, p.y) + hgt)
		var tiers := 3 if hgt >= 115.0 else 2
		var shrink := 1.0 - float(tiers - 1) * 0.115
		var roof_hx := hx * shrink
		var roof_hz := hz * shrink
		# Two banks of dark solar panels, elevated on shallow steel bases.
		var solar := Color(0.045, 0.075, 0.115)
		var steel := Color(0.23, 0.26, 0.29)
		for side in [-1.0, 1.0]:
			var off := Vector2(0, side * roof_hz * 0.66)
			_roof_box_pass_17(st, p, c, si, off,
				roof_hx * 0.36, roof_hz * 0.12,
				roof_y + 0.10, roof_y + 0.18, steel, 0.0)
			_roof_box_pass_17(st, p, c, si, off,
				roof_hx * 0.34, roof_hz * 0.11,
				roof_y + 0.19, roof_y + 0.27, solar, 0.0)
		# Rooftop vent caps with small stepped necks.
		for side in [-1.0, 1.0]:
			var off := Vector2(side * roof_hx * 0.67, roof_hz * 0.34)
			_roof_box_pass_17(st, p, c, si, off,
				roof_hx * 0.09, roof_hz * 0.10,
				roof_y, roof_y + 1.0, steel, 0.0)
			_roof_box_pass_17(st, p, c, si, off,
				roof_hx * 0.13, roof_hz * 0.14,
				roof_y + 1.0, roof_y + 1.17, steel.lightened(0.15), 0.0)
		count += 1
		if count >= CITY_MAX_ROOF_DETAIL_BUILDINGS:
			break
	if count == 0:
		return
	var mi := MeshInstance3D.new()
	mi.name = "Batch19_43_RooftopAccessories"
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.65
	mat.metallic = 0.42
	mi.material_override = mat
	_world.add_child(mi)

# Batch 19–43, update 2: lane marking geometry follows the existing road data.
# Main streets and highways only. Excludes elevated structures and footpaths.
func _build_road_markings_batch_19_43() -> void:
	if m.roads.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var dash_count := 0
	var edge_count := 0
	for r in m.roads:
		var cls: String = r.cls
		if cls != "main" and cls != "highway":
			continue
		var pts: Array = r.pts
		if pts.size() < 2:
			continue
		var width := maxf(1.2, float(r.w))
		if width < 5.0:
			continue
		var line: Array[Vector2] = []
		for i in pts.size() - 1:
			var a := _loc(pts[i][0], pts[i][1])
			var b := _loc(pts[i + 1][0], pts[i + 1][1])
			var steps := maxi(1, int(ceilf(a.distance_to(b) / 3.0)))
			for k in steps:
				line.append(a.lerp(b, float(k) / steps))
		line.append(_loc(pts[-1][0], pts[-1][1]))
		if dash_count + edge_count >= CITY_MAX_ROAD_PAINT_SEGMENTS:
			break
		var travelled := 0.0
		for i in line.size() - 1:
			var a := line[i]
			var b := line[i + 1]
			var length := a.distance_to(b)
			if length < 0.01:
				continue
			var tangent := (b - a) / length
			var normal := Vector2(-tangent.y, tangent.x)
			# Dash every 9 m: 4 m paint and 5 m clear. Geometry is split
			# at segment boundaries, so it follows curved roads naturally.
			var cursor := 0.0
			while cursor < length:
				var phase := fposmod(travelled + cursor, 9.0)
				var remaining := 4.0 - phase if phase < 4.0 else 9.0 - phase
				var take := minf(length - cursor, remaining)
				if phase < 4.0 and take > 0.04:
					var p0 := a + tangent * cursor
					var p1 := a + tangent * (cursor + take)
					_road_paint_quad_pass_19_43(st, p0, p1, normal, 0.10, 0.22,
						Color(0.85, 0.75, 0.49))
					dash_count += 1
				cursor += maxf(take, 0.01)
			# Subtle outer edge lines avoid full-bright arcade-like streets.
			for side in [-1.0, 1.0]:
				var lateral: Vector2 = normal * (side * (width * 0.5 - 0.42))
				_road_paint_quad_pass_19_43(st, a + lateral, b + lateral,
					normal, 0.055, 0.22, Color(0.65, 0.67, 0.66))
				edge_count += 1
			travelled += length
			if dash_count + edge_count >= CITY_MAX_ROAD_PAINT_SEGMENTS:
				break
	if dash_count == 0 and edge_count == 0:
		return
	var mi := MeshInstance3D.new()
	mi.name = "Batch19_43_RoadMarkings"
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.roughness = 0.95
	mi.material_override = mat
	_world.add_child(mi)

func _road_paint_quad_pass_19_43(st: SurfaceTool, a: Vector2, b: Vector2,
		normal: Vector2, half_width: float, lift: float, paint: Color) -> void:
	var n := normal * half_width
	var p := [a - n, a + n, b + n, b - n]
	var v: Array[Vector3] = []
	for point in p:
		v.append(Vector3(point.x, _h(point.x, point.y) + lift, point.y))
	for tri in [[0, 1, 2], [0, 2, 3]]:
		for idx in tri:
			st.set_color(paint)
			st.add_vertex(v[idx])

# Batch 19–43, Update 5: physically modeled facade fins for high-rise towers.
# Geometry is batched and uses the same existing building transforms and tier profile.
func _build_facade_fins_batch_19_43() -> void:
	if m.buildings.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count := 0
	for bd in m.buildings:
		if _is_landmark(bd):
			continue
		var hgt := _bh(bd)
		var hx: float = bd[2]
		var hz: float = bd[3]
		if hgt < 75.0 or minf(hx, hz) < 6.0:
			continue
		var p := _loc(bd[0], bd[1])
		var yaw: float = bd[4]
		var c := cos(yaw)
		var si := sin(yaw)
		var corners: Array[Vector2] = []
		for v in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			var lx: float = v.x * hx
			var lz: float = v.y * hz
			corners.append(Vector2(p.x + lx * c + lz * si, p.y - lx * si + lz * c))
		var base := INF
		for q in corners:
			base = minf(base, _h(q.x, q.y))
		base -= 0.6
		var top := maxf(base + 3.0, _h(p.x, p.y) + hgt)
		var tiers := 3 if hgt >= 115.0 else 2
		var color := Color(0.21, 0.25, 0.29) if count % 3 != 0 else Color(0.49, 0.51, 0.52)
		# Recessed curtain wall effect: a few full-height exterior metal fins,
		# aligned to the stepped tiers, not per-window mesh objects.
		for tier in range(tiers):
			var scale := 1.0 - float(tier) * 0.11
			var lo := lerpf(base, top, float(tier) / float(tiers)) + 0.45
			var hi := lerpf(base, top, float(tier + 1) / float(tiers)) - 0.45
			if hi <= lo:
				continue
			var tx := hx * scale
			var tz := hz * scale
			for side in [-1.0, 1.0]:
				for j in range(5):
					var along := (float(j) / 4.0 * 2.0 - 1.0) * tx * 0.85
					_roof_box_pass_17(st, p, c, si,
						Vector2(along, side * (tz + 0.09)),
						0.085, 0.13, lo, hi, color, 0.0)
				for j in range(5):
					var along := (float(j) / 4.0 * 2.0 - 1.0) * tz * 0.85
					_roof_box_pass_17(st, p, c, si,
						Vector2(side * (tx + 0.09), along),
						0.13, 0.085, lo, hi, color, 0.0)
		count += 1
		if count >= CITY_MAX_FACADE_FIN_BUILDINGS:
			break
	if count == 0:
		return
	var mi := MeshInstance3D.new()
	mi.name = "Batch19_43_ArchitecturalFacadeFins"
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.metallic = 0.62
	mat.roughness = 0.38
	mi.material_override = mat
	_world.add_child(mi)


# ---------------------------------------------------------------------------------------------------------------------
# Landmark supertalls (owner, Nov 9 2026): the Nexus Core Spire at 420 m is the tallest building in the game and the Neon
# City Grand Casino at 380 m the second (their heights come from the map data, carto-features.ts CORE_SPIRE_M /
# CASINO_TOWER_M). Built from primitives with shared emissive materials so they stay cheap on the phone.

func _lm_mat(col: Color, emit := 0.0, metal := 0.0, rough := 0.5) -> StandardMaterial3D:
	var mt := StandardMaterial3D.new()
	mt.albedo_color = col
	mt.metallic = metal
	mt.roughness = rough
	if emit > 0.0:
		mt.emission_enabled = true
		mt.emission = col
		mt.emission_energy_multiplier = emit
	return mt

## lit floors behind dark glass: a window grid (4 m floors, 3 m bays) mapped in world space so every curve and tier lines up
const LM_GLASS := preload("res://shaders/landmark_glass.gdshader")

func _lm_windows(lit: Color, glass: Color, energy: float) -> ShaderMaterial:
	# curtain-wall glass drawn in the shader (shaders/landmark_glass.gdshader): bays wrap round the shafts, edges are
	# anti-aliased, distant floors fade to an even glow. Replaced a triplanar window texture that smeared into brown
	# checkers on the round shafts (owner, Nov 10: "Fix glass windows")
	var mt := ShaderMaterial.new()
	mt.shader = LM_GLASS
	mt.set_shader_parameter("lit_col", lit)
	mt.set_shader_parameter("glass_col", glass)
	mt.set_shader_parameter("energy", energy * 2.2)
	return mt

func _lm_part(parent: Node3D, mesh: Mesh, mat: Material, at: Vector3, scl := Vector3.ONE, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = at
	mi.scale = scl
	mi.rotation = rot
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

func _lm_cyl(r_top: float, r_bot: float, h: float, seg := 32) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = r_top
	c.bottom_radius = r_bot
	c.height = h
	c.radial_segments = seg
	c.rings = 1
	return c

func _is_landmark(bd: Array) -> bool:
	return bd.size() > 7 and String(bd[7]) in LANDMARKS

func _build_landmarks() -> void:
	for bd in _landmark_bds:
		var p := _loc(bd[0], bd[1])
		var base := INF
		for d in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
			base = minf(base, _h(p.x + d.x * float(bd[2]), p.y + d.y * float(bd[3])))
		var root := Node3D.new()
		root.position = Vector3(p.x, base - 0.6, p.y)
		root.rotation.y = float(bd[4])
		_world.add_child(root)
		var hgt := _bh(bd) + (_h(p.x, p.y) - base) + 0.6
		if String(bd[7]) == "Neon City Grand Casino":
			_grand_casino(root, float(bd[2]), float(bd[3]), hgt)
		elif String(bd[7]) in Nexus.LANDMARKS:
			Nexus.landmark(self, root, String(bd[7]), float(bd[2]), float(bd[3]), hgt)
		else:
			_core_spire(root, float(bd[2]), float(bd[3]), hgt)

## The Neon City Grand Casino after the owner's board: an oval tower of dark glass in gold and violet neon bands, a gold
## crown on the face, and on the roof the live venue — a cantilevered deck with a glass rail, the ringed truss stage under a
## crown, lasers sweeping the sky, the dance floor, cabana palms and the helipad.
func _grand_casino(root: Node3D, hx: float, hz: float, top: float) -> void:
	var glass := _lm_mat(Color("#141026"), 0.0, 0.6, 0.12)
	var lit := _lm_windows(Color("#ffb47a"), Color("#120e22"), 0.45)
	var gold := _lm_mat(Color("#e8b24a"), 1.4, 0.9, 0.3)
	var violet := _lm_mat(Color("#b04bff"), 3.2)
	var cyan := _lm_mat(Color("#3fd8ff"), 2.6)
	var pink := _lm_mat(Color("#ff3fb4"), 2.8)
	var deck_y := top - 14.0
	var unit := _lm_cyl(1.0, 1.0, 1.0, 40)
	# (Nov 10, "fix tower": a lone 47 m column 380 m tall read as a chimney) the resort now spreads at the foot — a broad
	# two-tier podium and two flanking wing towers — and the head flares out into the cantilevered roof venue
	var base_top := 60.0
	_lm_part(root, unit, lit, Vector3(0, 18.0, 0), Vector3(hx * 1.7, 36.0, hz * 1.7))
	_lm_part(root, unit, gold, Vector3(0, 36.2, 0), Vector3(hx * 1.74, 0.8, hz * 1.74))
	_lm_part(root, unit, violet, Vector3(0, 5.0, 0), Vector3(hx * 1.72, 0.6, hz * 1.72))
	_lm_part(root, unit, lit, Vector3(0, 48.0, 0), Vector3(hx * 1.3, 24.0, hz * 1.3))
	_lm_part(root, unit, gold, Vector3(0, base_top + 0.2, 0), Vector3(hx * 1.34, 0.8, hz * 1.34))
	for sx: float in [-1.0, 1.0]:
		var wy := top * 0.42
		var wing := Vector3(sx * hx * 1.02, 0, -hz * 0.15)
		_lm_part(root, unit, lit, wing + Vector3(0, wy * 0.5, 0), Vector3(hx * 0.42, wy, hz * 0.5))
		_lm_part(root, unit, gold, wing + Vector3(0, wy, 0), Vector3(hx * 0.45, 0.8, hz * 0.53))
		var b := wy * 0.2
		while b < wy - 4.0:
			_lm_part(root, unit, violet, wing + Vector3(0, b, 0), Vector3(hx * 0.43, 0.3, hz * 0.51))
			b += 14.0
		_lm_part(root, _lm_cyl(0.3, hx * 0.3, 14.0, 12), violet, wing + Vector3(0, wy + 7.0, 0))
	# the shaft in three gently narrowing sections, banded in neon every 12 m, then a flared crown under the deck
	var flare := deck_y - 26.0
	var secs := [[base_top, flare * 0.55, 1.0], [flare * 0.55, flare * 0.82, 0.92], [flare * 0.82, flare, 0.86]]
	for sc in secs:
		var y0: float = sc[0]
		var y1: float = sc[1]
		var f: float = sc[2]
		_lm_part(root, unit, lit, Vector3(0, (y0 + y1) * 0.5, 0), Vector3(hx * f, y1 - y0, hz * f))
		_lm_part(root, unit, gold, Vector3(0, y1, 0), Vector3(hx * (f + 0.03), 0.8, hz * (f + 0.03)))
		var y := y0 + 12.0
		var i := 0
		while y < y1 - 4.0:
			_lm_part(root, unit, violet if i % 3 != 2 else cyan, Vector3(0, y, 0), Vector3(hx * (f + 0.012), 0.35, hz * (f + 0.012)))
			y += 12.0
			i += 1
	_lm_part(root, _lm_cyl(1.18, 0.86, 1.0, 40), lit, Vector3(0, (flare + deck_y) * 0.5, 0), Vector3(hx, deck_y - flare, hz))
	_lm_part(root, unit, pink, Vector3(0, flare + 0.4, 0), Vector3(hx * 0.88, 0.5, hz * 0.88))
	# four gold fins up the long sides and the crown on the face
	var box := BoxMesh.new()
	for sx: float in [-1.0, 1.0]:
		for sz: float in [-0.35, 0.35]:
			_lm_part(root, box, gold, Vector3(sx * hx * 0.96, (base_top + flare) * 0.5, sz * hz), Vector3(0.6, flare - base_top, 0.6))
	var crown_y := deck_y - 40.0
	var face := hz * 0.8 + 0.4
	for k in 5:
		var x := (float(k) - 2.0) * 2.6
		var spike := 8.0 if k % 2 == 0 else 5.0
		_lm_part(root, box, violet, Vector3(x, crown_y + spike * 0.5, face), Vector3(0.7, spike, 0.3), Vector3(0, 0, (float(k) - 2.0) * -0.12))
	_lm_part(root, box, violet, Vector3(0, crown_y - 0.6, face), Vector3(12.0, 1.0, 0.3))
	# the roof venue: a cantilevered deck with a lit edge and a glass rail
	var dx := hx * 1.18
	var dz := hz * 1.18
	_lm_part(root, unit, glass, Vector3(0, deck_y + 0.5, 0), Vector3(dx, 1.0, dz))
	_lm_part(root, unit, violet, Vector3(0, deck_y + 0.1, 0), Vector3(dx + 0.15, 0.4, dz + 0.15))
	var rail := _lm_mat(Color(0.7, 0.85, 1.0, 0.25), 0.4)
	rail.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var rail_mesh := _lm_cyl(1.0, 1.0, 1.0, 40)
	rail_mesh.cap_top = false
	rail_mesh.cap_bottom = false
	_lm_part(root, rail_mesh, rail, Vector3(0, deck_y + 1.6, 0), Vector3(dx, 1.2, dz))
	# dance floor: a glowing disc of pink and cyan
	_lm_part(root, unit, pink, Vector3(0, deck_y + 1.05, dz * 0.1), Vector3(dx * 0.32, 0.1, dz * 0.32))
	_lm_part(root, unit, cyan, Vector3(0, deck_y + 1.1, dz * 0.1), Vector3(dx * 0.2, 0.1, dz * 0.2))
	# the stage at the back under a ringed truss and a gold crown that tops out at the tower's height
	var sy := deck_y + 1.0
	_lm_part(root, box, glass, Vector3(0, sy + 1.0, -dz * 0.55), Vector3(dx * 0.7, 2.0, dz * 0.3))
	_lm_part(root, box, cyan, Vector3(0, sy + 6.0, -dz * 0.68), Vector3(dx * 0.5, 7.0, 0.3))
	var ring := TorusMesh.new()
	ring.inner_radius = 0.9
	ring.outer_radius = 1.0
	ring.rings = 48
	ring.ring_segments = 6
	for r in [[sy + 11.0, 0.62], [sy + 9.5, 0.5]]:
		_lm_part(root, ring, violet, Vector3(0, float(r[0]), -dz * 0.4), Vector3(dx * float(r[1]), 1.0, dz * float(r[1]) * 0.9))
	var crown := Node3D.new()
	crown.position = Vector3(0, top - 2.6, -dz * 0.4)
	root.add_child(crown)
	_lm_part(crown, _lm_cyl(2.2, 2.2, 0.8, 24), gold, Vector3.ZERO)
	for k in 5:
		var a := float(k) / 5.0 * TAU
		_lm_part(crown, box, gold, Vector3(cos(a) * 2.0, 1.4, sin(a) * 2.0), Vector3(0.5, 2.4, 0.5))
	# lasers from the stage, sweeping (spun in _process)
	var beam := _lm_mat(Color("#7a5cff"), 6.0)
	beam.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beam.albedo_color.a = 0.35
	beam.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var beam_c := beam.duplicate() as StandardMaterial3D
	beam_c.albedo_color = Color("#3fe0ff", 0.35)
	beam_c.emission = Color("#3fe0ff")
	var fan := Node3D.new()
	fan.position = Vector3(0, sy + 3.0, -dz * 0.5)
	fan.set_meta("spin", 0.35)
	root.add_child(fan)
	_spin.append(fan)
	for k in 8:
		var a := float(k) / 8.0 * TAU
		var tilt := 0.38 + 0.12 * float(k % 3)
		var L := 160.0
		var arm := Node3D.new()
		arm.rotation = Vector3(0, a, tilt)
		fan.add_child(arm)
		_lm_part(arm, box, beam if k % 2 == 0 else beam_c, Vector3(0, L * 0.5, 0), Vector3(0.35, L, 0.35))
	# cabana palms round the deck rim and the helipad cantilevered off the side
	var trunk := _lm_mat(Color("#5a4632"))
	var frond := _lm_mat(Color("#2f7a3f"), 0.3)
	for k in 8:
		var a := float(k) / 8.0 * TAU + 0.2
		var q := Vector3(cos(a) * dx * 0.85, sy, sin(a) * dz * 0.85)
		if q.z < -dz * 0.3:
			continue  # not in front of the stage
		_lm_part(root, _lm_cyl(0.15, 0.22, 4.5, 6), trunk, q + Vector3(0, 2.25, 0))
		_lm_part(root, _lm_cyl(0.0, 1.8, 1.4, 7), frond, q + Vector3(0, 4.8, 0))
	var pad := Vector3(dx + 6.0, deck_y + 0.6, dz * 0.3)
	_lm_part(root, _lm_cyl(7.0, 7.0, 0.8, 32), glass, pad)
	_lm_part(root, ring, cyan, pad + Vector3(0, 0.45, 0), Vector3(6.2, 1.0, 6.2))
	_lm_part(root, box, gold, pad + Vector3(0, 0.45, 0), Vector3(0.6, 0.1, 4.0))
	# one light on the roof, one at the door (phone budget)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color("#b04bff")
	lamp.light_energy = 3.0
	lamp.omni_range = 70.0
	lamp.position = Vector3(0, sy + 8.0, 0)
	root.add_child(lamp)
	var door := OmniLight3D.new()
	door.light_color = Color("#ffcf7a")
	door.light_energy = 2.0
	door.omni_range = 40.0
	door.position = Vector3(0, 6.0, hz * 1.3)
	root.add_child(door)

## The Nexus Core Spire: the AI spine of Nexus City, the tallest building in the game — a white-and-steel tower stepping in
## three times, ringed in cyan data bands, the core glowing through slots in the top tier, and a needle to the full height
## with a beacon.
func _core_spire(root: Node3D, hx: float, hz: float, top: float) -> void:
	# after the owner's Nexus City board (Nov 10: "fix tower"): not a lone needle but a cathedral of spires — a stepped
	# podium, the main spire rising in faceted stages to the needle, a ring of lesser spires and four raking buttresses
	# round it, cyan light up every edge and the diamond emblem glowing on its face
	var steel := _lm_mat(Color("#8fa3d8"), 0.25, 0.7, 0.25)
	var dark := _lm_windows(Color("#9fd4ff"), Color("#141a3a"), 0.3)
	var cyan := _lm_mat(Color("#4fe3ff"), 3.0)
	var white := _lm_mat(Color("#eaf6ff"), 4.0)
	var violet := _lm_mat(Color("#8a63ff"), 2.4)
	var box := BoxMesh.new()
	var w := maxf(hx, hz)
	var facet := func(r_top: float, r_bot: float, h: float) -> CylinderMesh:
		var c := _lm_cyl(r_top, r_bot, h, 4)
		return c
	# the podium: two broad steps with light at their lips
	var pod := top * 0.035
	_lm_part(root, box, dark, Vector3(0, pod * 0.5, 0), Vector3(w * 2.0, pod, w * 2.0))
	_lm_part(root, box, cyan, Vector3(0, pod, 0), Vector3(w * 2.04, 0.5, w * 2.04))
	_lm_part(root, box, dark, Vector3(0, pod * 1.5, 0), Vector3(w * 1.5, pod, w * 1.5))
	_lm_part(root, box, cyan, Vector3(0, pod * 2.0, 0), Vector3(w * 1.54, 0.5, w * 1.54))
	# the main spire: four faceted stages, each narrower, a cyan collar at each step, then the needle
	var base := pod * 2.0
	var stages := [[0.42, 0.62, 0.30], [0.30, 0.42, 0.25], [0.2, 0.30, 0.2], [0.1, 0.2, 0.13]]
	var y := base
	for st in stages:
		var h: float = top * float(st[2])
		var rt: float = w * float(st[0])
		var rb: float = w * float(st[1])
		_lm_part(root, facet.call(rt, rb, h), dark, Vector3(0, y + h * 0.5, 0), Vector3.ONE, Vector3(0, PI * 0.25, 0))
		# light up the four arrises of the stage
		for k in 4:
			var a := float(k) * PI * 0.5
			var lean := atan2(rb - rt, h)
			var mid := (rb + rt) * 0.5 + 0.15
			var edge := Node3D.new()
			edge.position = Vector3(cos(a) * mid, y + h * 0.5, sin(a) * mid)
			edge.rotation = Vector3(0, -a, 0)
			root.add_child(edge)
			_lm_part(edge, box, cyan, Vector3.ZERO, Vector3(0.35, h * 1.01, 0.35), Vector3(0, 0, lean))
		y += h
		_lm_part(root, _lm_cyl(rt + 0.4, rt + 0.4, 0.8, 4), cyan, Vector3(0, y, 0), Vector3.ONE, Vector3(0, PI * 0.25, 0))
	var needle_h := top - y
	_lm_part(root, _lm_cyl(0.2, w * 0.1, needle_h, 8), steel, Vector3(0, y + needle_h * 0.5, 0))
	for k in 4:
		var yy := y + needle_h * (0.2 + 0.2 * float(k))
		var rr := w * 0.1 * (1.0 - (yy - y) / needle_h) + 0.35
		_lm_part(root, _lm_cyl(rr, rr, 0.5, 12), cyan, Vector3(0, yy, 0))
	_lm_part(root, SphereMesh.new(), white, Vector3(0, top, 0), Vector3.ONE * 1.6)
	# the core light behind slots in the second stage
	var s2 := base + top * 0.3
	var core_glow := _lm_mat(Color("#bfe8ff"), 1.6)
	_lm_part(root, box, core_glow, Vector3(0, s2 + top * 0.12, 0), Vector3(w * 0.06, top * 0.2, w * 0.86))
	_lm_part(root, box, core_glow, Vector3(0, s2 + top * 0.12, 0), Vector3(w * 0.86, top * 0.2, w * 0.06))
	# the ring of lesser spires: eight, alternately tall and short, leaning very slightly in
	for k in 8:
		var a := float(k) / 8.0 * TAU + PI / 8.0
		var tall := k % 2 == 0
		var h := top * (0.4 if tall else 0.24)
		var r0 := w * (0.17 if tall else 0.13)
		var at := Vector3(cos(a) * w * 0.68, base, sin(a) * w * 0.68)
		var sp := Node3D.new()
		sp.position = at
		sp.rotation = Vector3(sin(a) * 0.04, 0, -cos(a) * 0.04)
		root.add_child(sp)
		_lm_part(sp, facet.call(r0 * 0.15, r0, h), dark, Vector3(0, h * 0.5, 0), Vector3.ONE, Vector3(0, PI * 0.25 + a, 0))
		_lm_part(sp, _lm_cyl(0.2, 0.5, h * 0.25, 6), cyan if tall else violet, Vector3(0, h + h * 0.12, 0))
		_lm_part(sp, _lm_cyl(r0 * 0.75, r0 * 0.75, 0.5, 4), cyan, Vector3(0, h * 0.35, 0), Vector3.ONE, Vector3(0, PI * 0.25 + a, 0))
	# four buttresses raking from the podium corners up to the first stage
	for k in 4:
		var a := float(k) * PI * 0.5 + PI * 0.25
		var reach := w * 0.95
		var rise := top * 0.22
		var fin := Node3D.new()
		fin.position = Vector3(cos(a) * reach * 0.55, base + rise * 0.5, sin(a) * reach * 0.55)
		fin.rotation = Vector3(0, -a, 0)
		root.add_child(fin)
		var tilt := atan2(reach * 0.75, rise)
		_lm_part(fin, box, steel, Vector3.ZERO, Vector3(w * 0.06, sqrt(rise * rise + reach * reach * 0.56), w * 0.16), Vector3(0, 0, tilt))
		_lm_part(fin, box, cyan, Vector3(0, 0, 0), Vector3(w * 0.065, sqrt(rise * rise + reach * reach * 0.56) * 0.98, 0.3), Vector3(0, 0, tilt))
	# the Nexus emblem: a glowing diamond frame on the south face of the first stage
	var em := TorusMesh.new()
	em.inner_radius = 0.82
	em.outer_radius = 1.0
	em.rings = 4
	em.ring_segments = 4
	var face := w * 0.56
	_lm_part(root, em, white, Vector3(0, base + top * 0.17, face), Vector3(w * 0.22, w * 0.22, w * 0.22), Vector3(PI * 0.5, 0, 0))
	_lm_part(root, box, cyan, Vector3(0, base + top * 0.17, face + 0.2), Vector3(w * 0.05, w * 0.3, 0.2))
	# the board's holographic halos round the upper tower (turning slowly) and the beam into the sky
	var holo := _lm_mat(Color("#5fd4ff"), 3.5)
	holo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	holo.albedo_color.a = 0.8
	holo.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var ring := TorusMesh.new()
	ring.inner_radius = 0.94
	ring.outer_radius = 1.0
	ring.rings = 64
	ring.ring_segments = 4
	for k in 3:
		var halo := Node3D.new()
		halo.position = Vector3(0, top * (0.56 + 0.12 * float(k)), 0)
		halo.rotation = Vector3(0.05 * float(k - 1), 0, 0.04 * float(1 - k))
		halo.set_meta("spin", 0.12 + 0.05 * float(k) * (1.0 if k % 2 == 0 else -1.0))
		root.add_child(halo)
		_spin.append(halo)
		var r := maxf(w * 1.2, top * (0.15 - 0.03 * float(k)))
		_lm_part(halo, ring, holo, Vector3.ZERO, Vector3(r, 1.0, r))
	var beam := _lm_mat(Color("#7fe0ff"), 4.0)
	beam.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	beam.albedo_color.a = 0.28
	beam.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_lm_part(root, _lm_cyl(1.2, 2.6, 700.0, 12), beam, Vector3(0, top + 350.0, 0))
	# the hologram crystal over the hub plaza in front (the Central District's core on the board), slowly turning
	var crystal := Node3D.new()
	crystal.position = Vector3(0, 22.0, maxf(48.0, w + 42.0))
	crystal.set_meta("spin", 0.5)
	root.add_child(crystal)
	_spin.append(crystal)
	var gem := _lm_cyl(0.0, 1.0, 1.0, 4)
	_lm_part(crystal, gem, holo, Vector3(0, 4.0, 0), Vector3(5.0, 8.0, 5.0))
	_lm_part(crystal, gem, holo, Vector3(0, -4.0, 0), Vector3(5.0, 8.0, 5.0), Vector3(PI, 0, 0))
	_lm_part(crystal, ring, holo, Vector3(0, -14.0, 0), Vector3(14.0, 1.0, 14.0))
	var beacon := OmniLight3D.new()
	beacon.light_color = Color("#9fefff")
	beacon.light_energy = 4.0
	beacon.omni_range = 60.0
	beacon.position = Vector3(0, top - 2.0, 0)
	root.add_child(beacon)
