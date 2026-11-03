extends RefCounted
## Thalassia, the underwater city, built inside its dome from the exported places (maps/thalassia.json pois): each district
## is dressed after its own blurb from the web game (Royal Palace "golden spires under the sea", Central Plaza "fountains of
## light", Market "stalls under glass domes", Garden "kelp and flower terraces", Entertainment "Siren nightclub, Poseidon's
## Play casino and the Pearl", Research "labs at the edge of the Abyssal Gate", Aqua Farms "kelp rows and fish pens", Arcadia
## Mall "shops under a jellyfish chandelier", Nexus Port "submarines and transit to the surface"), plus the Residential
## District from the map's area names and a seabed of rock and kelp outside the glass.
##
## Everything is placed from data positions (local metres from the region centre through `loc`) on the seabed (`h`), so it
## stays where the web map and the GPS put each place. Lit for the deep: most surfaces carry a little emission.

var _root: Node3D
var _loc: Callable
var _h: Callable
var _rng := RandomNumberGenerator.new()
var _mats := {}
## the city stands on one level deck inside the dome (the seabed under it is bumpy); outside it, things sit on the seabed
var _deck_c := Vector2.ZERO
var _deck_r := 0.0
var _deck_y := -INF

func build(root: Node3D, m: Dictionary, loc: Callable, h: Callable) -> void:
	_root = root
	_loc = loc
	_h = h
	_rng.seed = 9137
	var dome := Vector2.ZERO
	var dome_r := 0.0
	for r in m.get("rings", []):
		if r[3] == "dome" and float(r[2]) > dome_r:
			dome = _loc.call(r[0], r[1])
			dome_r = float(r[2])
	_deck_c = dome
	_deck_r = dome_r
	for k in 400:
		var a := k * 0.618 * TAU
		var d := sqrt(float(k) / 400.0) * dome_r
		_deck_y = maxf(_deck_y, _h.call(dome.x + cos(a) * d, dome.y + sin(a) * d))
	# region_3d.gd has already levelled the ground under the dome to this height (_flatten_city_dome)
	_floor(dome, dome_r)
	for p in m.get("pois", []):
		var at: Vector2 = _loc.call(p.x, p.z)
		match String(p.id):
			"th-royal-palace": _palace(at)
			"th-central-plaza": _plaza(at)
			"th-market": _market(at)
			"th-garden": _garden(at)
			"th-entertainment": _entertainment(at)
			"th-research": _research(at)
			"th-aqua-farms": _farms(at)
			"th-arcadia": _mall(at)
			"th-port": _port(at, dome, dome_r)
	for a in m.get("areas", []):
		if String(a.name) == "Residential District":
			_residential(_loc.call(a.x, a.z))
	_seabed(dome, dome_r)
	_flush()

# ---------------------------------------------------------------- helpers

func _mat(key: String, col: Color, glow := 0.0, metal := 0.0, rough := 0.6, alpha := 1.0) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(col.r, col.g, col.b, alpha)
	mt.metallic = metal
	mt.roughness = rough
	if glow > 0.0:
		mt.emission_enabled = true
		mt.emission = col
		mt.emission_energy_multiplier = glow
	if alpha < 1.0:
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mt.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mats[key] = mt
	return mt

func _y(p: Vector2) -> float:
	if _deck_r > 0.0 and p.distance_to(_deck_c) <= _deck_r:
		return _deck_y
	return _h.call(p.x, p.y)

## every piece is queued by material and merged into one mesh per material at the end (_flush): drawn one by one, the
## city's ~400 pieces were ~400 draw calls, ten times a whole wilderness region
var _batches := {}
func _put(mesh: Mesh, pos: Vector3, mat: Material, rot := Vector3.ZERO, scl := Vector3.ONE) -> void:
	if not _batches.has(mat):
		_batches[mat] = []
	_batches[mat].append([mesh, Transform3D(Basis.from_euler(rot) * Basis.from_scale(scl), pos)]) # as a Node3D: rotate, then local scale

func _flush() -> void:
	for mat in _batches:
		var st := SurfaceTool.new()
		for piece in _batches[mat]:
			st.append_from(piece[0], 0, piece[1])
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = mat
		if (mat as BaseMaterial3D) and (mat as BaseMaterial3D).transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF # glass and light do not cast
		_root.add_child(mi)
	_batches.clear()

func _cyl(top: float, bottom: float, hgt: float, seg := 16) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = top
	c.bottom_radius = bottom
	c.height = hgt
	c.radial_segments = seg
	c.rings = 1
	return c

func _box(x: float, y: float, z: float) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = Vector3(x, y, z)
	return b

func _sphere(r: float, hemi := false, seg := 24) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r if hemi else r * 2.0
	s.is_hemisphere = hemi
	s.radial_segments = seg
	s.rings = 12
	return s

func _light(pos: Vector3, col: Color, energy: float, rng: float) -> void:
	var l := OmniLight3D.new()
	l.position = pos
	l.light_color = col
	l.light_energy = energy
	l.omni_range = rng
	l.shadow_enabled = false
	_root.add_child(l)

func _multi(mesh: Mesh, xf: Array[Transform3D], mat: Material) -> void:
	if xf.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xf.size()
	for i in xf.size():
		mm.set_instance_transform(i, xf[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_root.add_child(mi)

## a tower with lit window bands: a body plus thin glowing rings every floor
func _tower(at: Vector2, radius: float, hgt: float, body: Material, band: Material, floor_h := 3.4, seg := 16) -> void:
	var y := _y(at)
	_put(_cyl(radius * 0.92, radius, hgt, seg), Vector3(at.x, y + hgt / 2.0, at.y), body)
	var floors := int(hgt / floor_h)
	for f in floors:
		_put(_cyl(radius * 1.01, radius * 1.01, 0.35, seg), Vector3(at.x, y + (f + 0.6) * floor_h, at.y), band)
	_put(_sphere(radius * 0.92, true, seg), Vector3(at.x, y + hgt, at.y), body)

# ---------------------------------------------------------------- the dome floor and its paving

func _floor(c: Vector2, r: float) -> void:
	if r <= 0.0:
		return
	var y := _y(c)
	# a stone deck under the whole dome, 10 cm proud of the levelled ground so the two never flicker, with lit ring roads
	_put(_cyl(r, r, 8.0, 64), Vector3(c.x, y - 3.9, c.y), _mat("deck", Color("#8d8a80"), 0.0, 0.0, 0.85))
	for rr in [21.0, 33.0, 60.0]:
		var t := TorusMesh.new()
		t.inner_radius = rr - 2.2
		t.outer_radius = rr + 2.2
		t.rings = 64
		_put(t, Vector3(c.x, y + 0.05, c.y), _mat("road", Color("#3b4a55"), 0.0, 0.2, 0.5), Vector3.ZERO, Vector3(1, 0.05, 1))
		var g := TorusMesh.new()
		g.inner_radius = rr + 2.3
		g.outer_radius = rr + 2.6
		g.rings = 64
		_put(g, Vector3(c.x, y + 0.1, c.y), _mat("road_glow", Color("#5fe4ff"), 2.2), Vector3.ZERO, Vector3(1, 0.08, 1))
	# the dome's frame: glowing rings of latitude and a base ring, so the glass reads as a structure
	for k in range(1, 5):
		var lat := k * (PI / 2.0) / 5.0
		var ring := TorusMesh.new()
		ring.inner_radius = r * cos(lat) - 0.35
		ring.outer_radius = r * cos(lat) + 0.35
		ring.rings = 64
		ring.ring_segments = 6
		_put(ring, Vector3(c.x, y + r * sin(lat), c.y), _mat("rib", Color("#9fe8ff"), 0.9, 0.6, 0.3))
	var base := TorusMesh.new()
	base.inner_radius = r - 1.0
	base.outer_radius = r + 1.0
	base.rings = 64
	_put(base, Vector3(c.x, y + 0.5, c.y), _mat("rib", Color("#9fe8ff"), 0.9, 0.6, 0.3))

# ---------------------------------------------------------------- districts

func _palace(at: Vector2) -> void:
	var y := _y(at)
	var gold := _mat("gold", Color("#e8b94a"), 0.7, 0.9, 0.25)
	var ivory := _mat("ivory", Color("#cfc6b2"), 0.0, 0.0, 0.5)
	_put(_cyl(10.0, 11.0, 4.0, 32), Vector3(at.x, y + 2.0, at.y), ivory)
	_put(_cyl(7.0, 7.5, 9.0, 32), Vector3(at.x, y + 8.5, at.y), ivory)
	_put(_sphere(7.0, true, 32), Vector3(at.x, y + 13.0, at.y), gold)
	_put(_cyl(0.0, 1.2, 12.0, 12), Vector3(at.x, y + 22.0, at.y), gold)
	for k in 6:
		var a := k * TAU / 6.0
		var p := at + Vector2(cos(a), sin(a)) * 9.5
		var hgt := 14.0 + (k % 2) * 6.0
		_put(_cyl(1.3, 1.5, hgt, 12), Vector3(p.x, y + hgt / 2.0, p.y), ivory)
		_put(_cyl(0.0, 1.6, 7.0, 12), Vector3(p.x, y + hgt + 3.5, p.y), gold)
	_light(Vector3(at.x, y + 18.0, at.y), Color("#ffd27a"), 3.0, 40.0)

func _plaza(at: Vector2) -> void:
	var y := _y(at)
	_put(_cyl(9.0, 9.0, 0.8, 40), Vector3(at.x, y + 0.9, at.y), _mat("basin", Color("#a8a294")))
	_put(_cyl(8.2, 8.2, 0.3, 40), Vector3(at.x, y + 1.25, at.y), _mat("pool", Color("#35d6ff"), 1.4, 0.2, 0.05, 0.75))
	# the fountain of light: a column and rising rings
	_put(_cyl(0.5, 0.8, 14.0, 12), Vector3(at.x, y + 8.0, at.y), _mat("lightcol", Color("#bff6ff"), 4.0))
	for k in 5:
		var t := TorusMesh.new()
		t.inner_radius = 1.2 + k * 0.9
		t.outer_radius = 1.5 + k * 0.9
		t.rings = 32
		_put(t, Vector3(at.x, y + 3.0 + k * 2.4, at.y), _mat("lightring", Color("#7ff0ff"), 3.0, 0.0, 0.2, 0.7))
	_light(Vector3(at.x, y + 10.0, at.y), Color("#9ff3ff"), 4.0, 35.0)

func _market(at: Vector2) -> void:
	var glass := _mat("stallglass", Color("#9fe6ff"), 0.4, 0.3, 0.05, 0.35)
	var colors := [Color("#ff7a59"), Color("#ffd166"), Color("#06d6a0"), Color("#ef476f"), Color("#7aa7ff")]
	for k in 9:
		var p := at + Vector2(_rng.randf_range(-11, 11), _rng.randf_range(-9, 9))
		var y := _y(p)
		var r := _rng.randf_range(2.6, 4.2)
		var c: Color = colors[k % colors.size()]
		_put(_box(r * 1.1, 1.6, r * 0.8), Vector3(p.x, y + 1.3, p.y), _mat("stall%d" % (k % 5), c, 0.9, 0.0, 0.6))
		_put(_sphere(r, true, 20), Vector3(p.x, y + 0.5, p.y), glass)
	_light(Vector3(at.x, y_of(at) + 6.0, at.y), Color("#ffd8a8"), 2.0, 28.0)

func y_of(p: Vector2) -> float:
	return _y(p)

func _garden(at: Vector2) -> void:
	var y := _y(at)
	var stone := _mat("terrace", Color("#9a947f"))
	var flower := [Color("#ff6fb5"), Color("#ffd166"), Color("#b388ff"), Color("#ff8a5c")]
	for k in 4:
		var r := 11.0 - k * 2.4
		_put(_cyl(r, r, 1.4, 32), Vector3(at.x, y + 0.7 + k * 1.4, at.y), stone)
		for f in 14:
			var a := f * TAU / 14.0 + k
			var q := at + Vector2(cos(a), sin(a)) * (r - 0.8)
			_put(_sphere(0.45, false, 8), Vector3(q.x, y + 1.6 + k * 1.4, q.y), _mat("flower%d" % ((f + k) % 4), flower[(f + k) % 4], 1.2))
	var kelp: Array[Transform3D] = []
	for i in 60:
		var a2 := _rng.randf() * TAU
		var d := _rng.randf_range(12.0, 17.0)
		var q2 := at + Vector2(cos(a2), sin(a2)) * d
		var hh := _rng.randf_range(5.0, 11.0)
		kelp.append(Transform3D(Basis.from_euler(Vector3(_rng.randf_range(-0.15, 0.15), _rng.randf() * TAU, _rng.randf_range(-0.15, 0.15))).scaled(Vector3(1, hh, 1)), Vector3(q2.x, _y(q2) + hh / 2.0, q2.y)))
	_multi(_cyl(0.12, 0.25, 1.0, 5), kelp, _mat("kelp", Color("#3f8f4a"), 0.35, 0.0, 0.8))

func _entertainment(at: Vector2) -> void:
	var body := _mat("ent_body", Color("#1c1f33"), 0.05, 0.5, 0.3)
	var pink := _mat("neon_pink", Color("#ff3fb4"), 3.5)
	var cyan := _mat("neon_cyan", Color("#38e8ff"), 3.5)
	var gold := _mat("neon_gold", Color("#ffcf5a"), 3.0)
	# Siren nightclub, Poseidon's Play casino, the Pearl
	_tower(at + Vector2(-6, -3), 4.0, 22.0, body, pink)
	_tower(at + Vector2(5, -6), 5.0, 16.0, body, cyan)
	var pearl := at + Vector2(3, 7)
	_put(_sphere(5.0, false, 32), Vector3(pearl.x, y_of(pearl) + 6.0, pearl.y), _mat("pearl", Color("#f4ecff"), 1.6, 0.6, 0.15))
	_put(_cyl(4.5, 5.5, 1.2, 32), Vector3(pearl.x, y_of(pearl) + 0.6, pearl.y), gold)
	_light(Vector3(at.x, y_of(at) + 12.0, at.y), Color("#ff6ad5"), 3.0, 30.0)

func _research(at: Vector2) -> void:
	var white := _mat("lab", Color("#bcc4ca"), 0.0, 0.2, 0.4)
	var strip := _mat("labstrip", Color("#4fc3ff"), 3.0)
	for k in 3:
		var p := at + Vector2(-8 + k * 8, 6)
		var y := _y(p)
		_put(_box(6.0, 4.0, 5.0), Vector3(p.x, y + 2.0, p.y), white)
		_put(_box(6.1, 0.25, 5.1), Vector3(p.x, y + 3.2, p.y), strip)
	# the Abyssal Gate at the district's edge: a ring of dark metal with a violet glow
	var gate := at + Vector2(10, -6)
	var ring := TorusMesh.new()
	ring.inner_radius = 4.0
	ring.outer_radius = 5.2
	ring.rings = 40
	_put(ring, Vector3(gate.x, y_of(gate) + 5.4, gate.y), _mat("gate", Color("#2a2140"), 0.3, 0.8, 0.3), Vector3(PI / 2.0, 0.6, 0))
	_put(_cyl(4.0, 4.0, 0.2, 40), Vector3(gate.x, y_of(gate) + 5.4, gate.y), _mat("gatefield", Color("#9b5cff"), 2.5, 0.0, 0.1, 0.55), Vector3(PI / 2.0, 0.6, 0))
	_light(Vector3(gate.x, y_of(gate) + 5.0, gate.y), Color("#9b5cff"), 3.0, 22.0)

func _farms(at: Vector2) -> void:
	var kelp: Array[Transform3D] = []
	for row in 6:
		for i in 16:
			var q := at + Vector2(-12 + i * 1.6, -7 + row * 2.6)
			var hh := _rng.randf_range(4.0, 7.0)
			kelp.append(Transform3D(Basis.from_euler(Vector3(_rng.randf_range(-0.08, 0.08), 0, _rng.randf_range(-0.08, 0.08))).scaled(Vector3(1, hh, 1)), Vector3(q.x, _y(q) + hh / 2.0, q.y)))
	_multi(_cyl(0.1, 0.22, 1.0, 5), kelp, _mat("farmkelp", Color("#58b35a"), 0.45, 0.0, 0.8))
	var net := _mat("net", Color("#c8f1ff"), 0.4, 0.2, 0.3, 0.28)
	for k in 3:
		var p := at + Vector2(-8 + k * 8, 12)
		_put(_cyl(3.0, 3.0, 5.0, 20), Vector3(p.x, y_of(p) + 2.5, p.y), net)
		var rim := TorusMesh.new()
		rim.inner_radius = 2.9
		rim.outer_radius = 3.2
		_put(rim, Vector3(p.x, y_of(p) + 5.0, p.y), _mat("pen_rim", Color("#ffb347"), 1.5))

func _mall(at: Vector2) -> void:
	var y := _y(at)
	_put(_cyl(13.0, 14.0, 7.0, 40), Vector3(at.x, y + 3.5, at.y), _mat("mall", Color("#a9b6be"), 0.0, 0.2, 0.4))
	_put(_cyl(14.1, 14.1, 0.5, 40), Vector3(at.x, y + 2.4, at.y), _mat("mallstrip", Color("#ffcf5a"), 2.5))
	_put(_sphere(12.0, true, 40), Vector3(at.x, y + 7.0, at.y), _mat("mallglass", Color("#a8f0ff"), 0.5, 0.3, 0.05, 0.3))
	# the jellyfish chandelier: a glowing bell with trailing strands
	var bell := Vector3(at.x, y + 15.0, at.y)
	_put(_sphere(3.4, true, 32), bell, _mat("jelly", Color("#ff9be9"), 2.6, 0.0, 0.2, 0.75))
	for k in 14:
		var a := k * TAU / 14.0
		var ln := _rng.randf_range(4.0, 7.0)
		_put(_cyl(0.06, 0.06, ln, 4), bell + Vector3(cos(a) * 2.4, -ln / 2.0, sin(a) * 2.4), _mat("strand", Color("#ffc4f2"), 2.0, 0.0, 0.3, 0.8))
	_light(bell, Color("#ff8ae6"), 3.0, 30.0)

func _port(at: Vector2, dome: Vector2, dome_r: float) -> void:
	var y := _y(at)
	_put(_box(16.0, 1.0, 6.0), Vector3(at.x, y + 0.5, at.y), _mat("pier", Color("#6c7a86"), 0.05, 0.5, 0.4))
	var hull := _mat("sub", Color("#f2b134"), 0.2, 0.6, 0.35)
	for k in 2:
		var p := at + Vector2(-4 + k * 8, 5)
		var cap := CapsuleMesh.new()
		cap.radius = 1.6
		cap.height = 9.0
		_put(cap, Vector3(p.x, y + 2.2, p.y), hull, Vector3(0, 0, PI / 2.0))
		_put(_box(1.8, 1.4, 1.2), Vector3(p.x, y + 4.0, p.y), hull)
	# the transit tube to the surface: from the port out through the dome and up
	var tube := _mat("tube", Color("#bff1ff"), 0.5, 0.3, 0.05, 0.3)
	var out := at + (at - dome).normalized() * (dome_r - (at - dome).length() + 30.0)
	var mid := (at + out) / 2.0
	var run := (out - at).length()
	var ang := atan2(out.x - at.x, out.y - at.y)
	_put(_cyl(2.0, 2.0, run, 20), Vector3(mid.x, y + 3.0, mid.y), tube, Vector3(PI / 2.0, ang, 0))
	_put(_cyl(2.0, 2.0, 60.0, 20), Vector3(out.x, y + 33.0, out.y), tube)
	_light(Vector3(at.x, y + 6.0, at.y), Color("#ffd27a"), 2.0, 22.0)

func _residential(at: Vector2) -> void:
	var body := _mat("res", Color("#b9b2a6"), 0.0, 0.0, 0.5)
	var windows := _mat("reswin", Color("#ffd9a0"), 2.2)
	for k in 5:
		var p := at + Vector2(_rng.randf_range(-9, 9), _rng.randf_range(-7, 7)) + Vector2(cos(k * 1.3), sin(k * 1.3)) * 4.0
		_tower(p, _rng.randf_range(2.4, 3.4), _rng.randf_range(12.0, 24.0), body, windows, 3.2, 14)

# ---------------------------------------------------------------- outside the glass

func _seabed(c: Vector2, r: float) -> void:
	var rocks: Array[Transform3D] = []
	var kelp: Array[Transform3D] = []
	var coral: Array[Transform3D] = []
	for i in 420:
		var a := _rng.randf() * TAU
		var d := r + 4.0 + pow(_rng.randf(), 0.7) * 70.0
		var q := c + Vector2(cos(a), sin(a)) * d
		var y := _y(q)
		var roll := _rng.randf()
		if roll < 0.3:
			var s := _rng.randf_range(1.0, 4.5)
			rocks.append(Transform3D(Basis.from_euler(Vector3(_rng.randf(), _rng.randf() * TAU, _rng.randf())).scaled(Vector3(s, s * 0.6, s)), Vector3(q.x, y + s * 0.2, q.y)))
		elif roll < 0.8:
			var hh := _rng.randf_range(6.0, 16.0)
			kelp.append(Transform3D(Basis.from_euler(Vector3(_rng.randf_range(-0.2, 0.2), _rng.randf() * TAU, _rng.randf_range(-0.2, 0.2))).scaled(Vector3(1, hh, 1)), Vector3(q.x, y + hh / 2.0, q.y)))
		else:
			var cs := _rng.randf_range(0.6, 1.6)
			coral.append(Transform3D(Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3(cs, cs * 1.4, cs)), Vector3(q.x, y + cs * 0.5, q.y)))
	var rm := SphereMesh.new()
	rm.radius = 1.0
	rm.height = 2.0
	rm.radial_segments = 7
	rm.rings = 4
	_multi(rm, rocks, _mat("seabed_rock", Color("#3e4a52"), 0.05, 0.0, 0.95))
	_multi(_cyl(0.15, 0.35, 1.0, 5), kelp, _mat("wild_kelp", Color("#2f7a45"), 0.3, 0.0, 0.85))
	_multi(_cyl(0.0, 0.7, 1.0, 6), coral, _mat("coral", Color("#ff6f61"), 0.9, 0.0, 0.6))
