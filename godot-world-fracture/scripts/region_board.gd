extends RefCounted
## The owner's region boards (Nov 22, docs/reference/regions: Regions Overview, Region Design Overview / Series,
## Continents of Aetherion and the region profiles — Solmara, Eldergrove / Verdant Forest, Frostveil / Frostspire,
## Obsidian Reach / Ember Peaks): the landmarks each board's key art is built round, placed into the region's 3D view.
## region_3d.gd calls `build(r)` once the land, the trees and the ruins stand; the light and sky for the same boards are
## the region's style in region_3d.gd `_style_for`.
##   veridan     (and Eldergrove) giant elder trees over the canopy, mossy cliffs with tall falls and mist, ruined
##               temple arches with the red banners, the violet Fracture tree with its crystals
##   frostspire  (and Frostveil) the Fracture ice spire glowing over the peaks, the research station's radar dish, the
##               aurora (style key), frozen falls
##   ember       the fortress hold on its ridge with the red banners and warm windows, lava falls off the cliffs, lava
##               rivers, the violet Fracture crystal spire
##   crystal-badlands  (the Shattered Expanse) the giant violet Fracture spire with its swirl, rock islands hanging in
##               the sky with ruined towers on them, a rift ring standing open
##   azure-isles overwater bungalows on a pier over the lagoon, a great sea arch off the coast, palms along the beaches
##   solara      red sandstone mesas round the desert, the giant broken Fracture ring with its violet tear, an oasis pool
##               ringed with palms under a rock ledge and its fall, a ruined aqueduct with the Ashen red banners
## Everything is built here in code (no new models): sizes are the board's read at the region's scale (a ~600 m map),
## and nothing is put within reach of a place (the clearing round every POI stays free for Street View and the paths).

const Flora := preload("res://scripts/region_flora.gd")
const Fx := preload("res://scripts/vfx/fx.gd")

## each landmark's spot (local x, its size, local z) for the look-dev camera: main.gd --shot eye:board:<name>
static func spot(r: Node, name: String, at: Vector2, size: float) -> void:
	var d: Dictionary = r.get_meta("board_spots", {})
	d[name] = Vector3(at.x, size, at.y)
	r.set_meta("board_spots", d)

static func build(r: Node) -> void:
	r.set_meta("board_spots", {})
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(String(r.map_id) + ":board")
	match String(r.map_id):
		"solara":
			_solara(r, rng)
		"veridan", "eldergrove":
			_verdant(r, rng)
		"frostspire", "frostveil":
			_frost(r, rng)
		"ember":
			_ember(r, rng)
		"crystal-badlands":
			_shattered(r, rng)
		"azure-isles":
			_azure(r, rng)

# ------------------------------------------------------------------------------------------------ Solara / Solmara

static func _solara(r: Node, rng: RandomNumberGenerator) -> void:
	var half: float = r.span() * 0.5
	var rock := Flora.rock_material(Color(0.78, 0.4, 0.24))
	# the mesas: a broken ring of red tablelands round the desert's edge, a few lone buttes nearer in
	var mesas := Node3D.new()
	mesas.name = "BoardMesas"
	for i in 16:
		var a := TAU * i / 16.0 + rng.randf_range(-0.12, 0.12)
		var d := half * rng.randf_range(0.72, 0.95)
		var at := Vector2(cos(a), sin(a)) * d
		if not _clear_of_places(r, at, 70.0):
			continue
		var rad := rng.randf_range(26.0, 52.0)
		var h := rng.randf_range(24.0, 46.0)
		_mesa(r, mesas, at, rad, h, rock, rng)
	for i in 7:
		var at := Vector2(rng.randf_range(-0.55, 0.55), rng.randf_range(-0.55, 0.55)) * half
		if not _clear_of_places(r, at, 55.0):
			continue
		_mesa(r, mesas, at, rng.randf_range(7.0, 13.0), rng.randf_range(16.0, 30.0), rock, rng)
	r._world.add_child(mesas)
	# the broken Fracture ring over the dunes (Solmara key art), its tear burning violet in the gap
	var ring_at := _open_spot(r, r._loc(40.0, 640.0), 90.0, 60.0)
	_fracture_ring(r, ring_at, 50.0, rng)
	spot(r, "ring", ring_at, 50.0)
	# the oasis by the town: a pool under a rock ledge with its fall, palms all round
	var pool_at := _flat_spot(r, r._loc(305.0, 600.0), 70.0, 24.0)
	_oasis(r, pool_at, 20.0, rock, rng)
	spot(r, "oasis", pool_at, 20.0)
	# the aqueduct: a line of weathered arches marching across the sand, the Ashen banners on the last piers
	var aq_a: Vector2 = r._loc(330.0, 440.0)
	var aq_b: Vector2 = r._loc(450.0, 640.0)
	_aqueduct(r, aq_a, aq_b, rock, rng)
	spot(r, "aqueduct", (aq_a + aq_b) * 0.5, 30.0)

## a sandstone mesa: an uneven footprint, sheer sides stepping in at the beds, a flat cap; sunk into the ground so it
## stands on every side
## returns the height of its cap (world y)
static func _mesa(r: Node, parent: Node3D, at: Vector2, rad: float, h: float, mat: Material, rng: RandomNumberGenerator) -> float:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	const N := 22
	var radii: Array[float] = []
	var ph := rng.randf() * TAU
	for k in N:
		var t := TAU * k / N
		radii.append(rad * (0.78 + 0.16 * sin(t * 2.0 + ph) + 0.1 * sin(t * 5.0 + ph * 2.0) + rng.randf_range(-0.06, 0.06)))
	# rings up the side: the base flares, the beds step in, the cap's lip
	var levels := [[-8.0, 1.12], [0.0, 1.08], [h * 0.3, 1.0], [h * 0.34, 0.94], [h * 0.62, 0.92], [h * 0.66, 0.85], [h * 0.97, 0.83], [h, 0.8]]
	var low := INF
	for k in N:
		var t := TAU * k / N
		low = minf(low, r._h(at.x + cos(t) * radii[k], at.y + sin(t) * radii[k]))
	low = minf(low, r._h(at.x, at.y))
	for li in levels.size():
		for k in N:
			var t := TAU * k / N
			var rr: float = radii[k] * float(levels[li][1]) * (1.0 + rng.randf_range(-0.025, 0.025))
			st.set_uv(Vector2(float(k) / N, float(levels[li][0]) / h))
			st.add_vertex(Vector3(cos(t) * rr, float(levels[li][0]), sin(t) * rr))
	for li in levels.size() - 1:
		for k in N:
			var a0 := li * N + k
			var a1 := li * N + (k + 1) % N
			var b0 := (li + 1) * N + k
			var b1 := (li + 1) * N + (k + 1) % N
			st.add_index(a0)
			st.add_index(b0)
			st.add_index(a1)
			st.add_index(a1)
			st.add_index(b0)
			st.add_index(b1)
	# the cap
	var top := levels.size() * N
	st.set_uv(Vector2(0.5, 1.0))
	st.add_vertex(Vector3(0, h + 0.6, 0))
	var ring0 := (levels.size() - 1) * N
	for k in N:
		st.add_index(top)
		st.add_index(ring0 + (k + 1) % N)
		st.add_index(ring0 + k)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.position = Vector3(at.x, low - 1.5, at.y)
	mi.rotation.y = rng.randf() * TAU
	parent.add_child(mi)
	return low - 1.5 + h

## the giant broken ring: a heavy segmented band of old metal and stone, a third of it gone, half sunk into the sand and
## leaning; ribs and plates along it; a violet tear of Fracture light hanging in the middle, lit
static func _fracture_ring(r: Node, at: Vector2, rad: float, rng: RandomNumberGenerator) -> void:
	var root := Node3D.new()
	root.name = "BoardFractureRing"
	var gy: float = r._h(at.x, at.y)
	root.position = Vector3(at.x, gy - rad * 0.08, at.y)
	root.rotation = Vector3(0.0, rng.randf() * TAU, deg_to_rad(9.0))
	var band := _arc_band(rad, rad * 0.13, rad * 0.17, deg_to_rad(-25.0), deg_to_rad(212.0), 72)
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(0.62, 0.55, 0.46)
	metal.metallic = 0.55
	metal.roughness = 0.62
	var mi := MeshInstance3D.new()
	mi.mesh = band
	mi.material_override = metal
	root.add_child(mi)
	# an inner lip, darker, and the ribs every ~12°
	var lip := MeshInstance3D.new()
	lip.mesh = _arc_band(rad - rad * 0.09, rad * 0.04, rad * 0.11, deg_to_rad(-20.0), deg_to_rad(205.0), 56)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.2, 0.18, 0.17)
	dark.metallic = 0.6
	dark.roughness = 0.5
	lip.material_override = dark
	root.add_child(lip)
	var rib := BoxMesh.new()
	rib.size = Vector3(rad * 0.05, rad * 0.22, rad * 0.24)
	for k in 19:
		var a := deg_to_rad(-26.0 + k * 12.0)
		var b := MeshInstance3D.new()
		b.mesh = rib
		b.material_override = dark
		b.position = Vector3(cos(a) * (rad + 0.6), sin(a) * (rad + 0.6), 0)
		b.rotation.z = a
		root.add_child(b)
	# the broken ends: torn plates hanging off, a fallen section in the sand below the gap
	for e in [deg_to_rad(-30.0), deg_to_rad(215.0)]:
		for j in 3:
			var p := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(rng.randf_range(2.0, 4.0), rng.randf_range(3.0, 6.0), rng.randf_range(0.5, 1.0))
			p.mesh = bm
			p.material_override = metal
			p.position = Vector3(cos(e) * (rad + rng.randf_range(-2, 2)), sin(e) * (rad + rng.randf_range(-2, 2)), rng.randf_range(-3, 3))
			p.rotation = Vector3(rng.randf_range(-0.6, 0.6), rng.randf_range(-0.6, 0.6), e + rng.randf_range(-0.8, 0.8))
			root.add_child(p)
	var fallen := MeshInstance3D.new()
	fallen.mesh = _arc_band(rad, rad * 0.13, rad * 0.17, deg_to_rad(0.0), deg_to_rad(34.0), 10)
	fallen.material_override = metal
	fallen.position = Vector3(rad * 0.9, -rad * 0.62, 8.0)
	fallen.rotation = Vector3(1.2, 0.3, 2.2)
	root.add_child(fallen)
	# the tear: a violet star of cracks with a white core, and its light
	var tear := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(rad * 1.6, rad * 1.6)
	tear.mesh = q
	tear.material_override = _tear_material(Color(0.72, 0.35, 1.0))
	tear.position = Vector3(rad * 0.25, rad * 0.1, 0)
	tear.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(tear)
	var back := tear.duplicate()
	back.rotation.y = PI
	root.add_child(back)
	var light := OmniLight3D.new()
	light.light_color = Color(0.7, 0.4, 1.0)
	light.light_energy = 9.0
	light.omni_range = rad * 2.6
	light.position = tear.position
	root.add_child(light)
	r._world.add_child(root)

## a band swept along an arc in the XY plane: `w` across the ring (radial), `d` through it (z)
static func _arc_band(rad: float, w: float, d: float, a0: float, a1: float, n: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sec := [Vector2(-w, -d), Vector2(w, -d), Vector2(w, d), Vector2(-w, d)]
	for k in n + 1:
		var a := lerpf(a0, a1, float(k) / n)
		var out := Vector3(cos(a), sin(a), 0)
		for c in 4:
			var s: Vector2 = sec[c] * 0.5
			# a slight chunking: every few steps the band's plates stand proud
			var proud := 1.0 + (0.08 if (k / 3) % 2 == 0 else 0.0)
			st.set_uv(Vector2(float(k) / n, float(c) / 4.0))
			st.add_vertex(out * (rad + s.x * proud) + Vector3(0, 0, s.y * proud))
	for k in n:
		for c in 4:
			var i0 := k * 4 + c
			var i1 := k * 4 + (c + 1) % 4
			var j0 := (k + 1) * 4 + c
			var j1 := (k + 1) * 4 + (c + 1) % 4
			st.add_index(i0)
			st.add_index(j0)
			st.add_index(i1)
			st.add_index(i1)
			st.add_index(j0)
			st.add_index(j1)
	# end caps
	for e in [0, n]:
		var b: int = e * 4
		if e == 0:
			st.add_index(b)
			st.add_index(b + 1)
			st.add_index(b + 2)
			st.add_index(b)
			st.add_index(b + 2)
			st.add_index(b + 3)
		else:
			st.add_index(b)
			st.add_index(b + 2)
			st.add_index(b + 1)
			st.add_index(b)
			st.add_index(b + 3)
			st.add_index(b + 2)
	st.generate_normals()
	return st.commit()

static func _tear_material(col: Color) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, fog_disabled;
uniform vec3 col : source_color;
float h(float x) { return fract(sin(x * 91.7) * 43758.5); }
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float r = length(p);
	float a = atan(p.y, p.x);
	// jagged cracks out from the centre: a dozen rays, each kinked along its length
	float ray = 0.0;
	for (int i = 0; i < 12; i++) {
		float fi = float(i);
		float ang = fi * 0.5236 + h(fi) * 0.4 + sin(r * 9.0 + fi) * 0.08;
		float dd = abs(sin(a - ang));
		float len = 0.45 + h(fi + 7.0) * 0.5;
		ray = max(ray, smoothstep(0.035, 0.0, dd * r) * smoothstep(len, len * 0.4, r));
	}
	float core = exp(-r * r * 30.0) * 2.5 + exp(-r * r * 6.0) * 0.6;
	float pulse = 0.85 + 0.15 * sin(TIME * 2.0);
	vec3 c = col * (ray * 3.2 + core * 1.1) * pulse + vec3(1.0) * exp(-r * r * 160.0) * 1.2;
	ALBEDO = c;
	ALPHA = clamp(ray + core, 0.0, 1.0);
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	return m

## the oasis: a turquoise pool under a rock ledge, a thin fall down the ledge into it, palms round the water and a few
## market awnings on the sand
static func _oasis(r: Node, at: Vector2, rad: float, rock: Material, rng: RandomNumberGenerator) -> void:
	var root := Node3D.new()
	root.name = "BoardOasis"
	var hi := -INF
	var lo := INF
	for k in 16:
		var t := TAU * k / 16.0
		var y: float = r._h(at.x + cos(t) * rad, at.y + sin(t) * rad)
		hi = maxf(hi, y)
		lo = minf(lo, y)
	# the water stands on low sandy banks above the dunes round it (the terrain is not carved), green at the water's edge
	var wy := hi + 0.25
	# the water: a disc with a shallow sandy shelf round it
	var water := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = rad
	cm.bottom_radius = rad * 0.75
	cm.height = 1.0
	cm.radial_segments = 48
	water.mesh = cm
	water.material_override = _pool_material()
	water.position = Vector3(at.x, wy - cm.height * 0.5, at.y)
	root.add_child(water)
	var bank_h := (hi - lo) + 1.5
	var shelf := MeshInstance3D.new()
	var sm := CylinderMesh.new()
	sm.top_radius = rad + 7.0
	sm.bottom_radius = rad + 7.0 + bank_h * 3.0
	sm.height = bank_h
	sm.radial_segments = 48
	shelf.mesh = sm
	var sand := StandardMaterial3D.new()
	sand.albedo_color = Color(0.86, 0.5, 0.27)
	sand.roughness = 1.0
	shelf.material_override = sand
	shelf.position = Vector3(at.x, wy - 0.2 - bank_h * 0.5, at.y)
	root.add_child(shelf)
	var grass := MeshInstance3D.new()
	var gm := CylinderMesh.new()
	gm.top_radius = rad + 6.5
	gm.bottom_radius = rad + 7.0
	gm.height = 0.3
	gm.radial_segments = 48
	grass.mesh = gm
	var gmat := StandardMaterial3D.new()
	gmat.albedo_color = Color(0.32, 0.5, 0.16)
	gmat.roughness = 0.95
	grass.material_override = gmat
	grass.position = Vector3(at.x, wy - 0.15, at.y)
	root.add_child(grass)
	# the ledge on the far side, and its fall
	var lead := Vector2(1, 0).rotated(rng.randf() * TAU)
	var ledge_at := at + lead * (rad + 9.0)
	_mesa(r, root, ledge_at, 11.0, wy - float(r._h(ledge_at.x, ledge_at.y)) + 15.0, rock, rng)
	var fall := MeshInstance3D.new()
	var fq := QuadMesh.new()
	fq.size = Vector2(3.5, 12.5)
	fall.mesh = fq
	fall.material_override = _fall_material()
	var fp := at + lead * (rad + 1.0)
	fall.position = Vector3(fp.x, wy + 6.0, fp.y)
	fall.rotation.y = atan2(-lead.x, -lead.y)
	root.add_child(fall)
	var foam := MeshInstance3D.new()
	var fm := SphereMesh.new()
	fm.radius = 2.4
	fm.height = 1.2
	foam.mesh = fm
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = Color(0.92, 0.97, 1.0, 0.7)
	fmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fmat.roughness = 0.3
	foam.material_override = fmat
	foam.position = Vector3(fp.x, wy, fp.y)
	root.add_child(foam)
	r._world.add_child(root)
	# palms: a ring round the water, leaning out over it, and a few on the dunes beyond
	var pts: Array[Vector2] = []
	for k in 18:
		var t := TAU * k / 18.0 + rng.randf_range(-0.1, 0.1)
		pts.append(at + Vector2(cos(t), sin(t)) * (rad + rng.randf_range(2.0, 6.0)))
	for k in 14:
		var t := rng.randf() * TAU
		pts.append(at + Vector2(cos(t), sin(t)) * rng.randf_range(rad + 14.0, rad + 60.0))
	_palms(r, pts, rng, wy, at, rad + 8.0)

static func _pool_material() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode cull_back;
void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	float rip = sin(UV.x * 120.0 + TIME * 1.4) * sin(UV.y * 90.0 - TIME * 1.1) * 0.5 + 0.5;
	ALBEDO = mix(vec3(0.05, 0.42, 0.45), vec3(0.32, 0.78, 0.78), f * 0.7 + rip * 0.08);
	ROUGHNESS = 0.06;
	METALLIC = 0.2;
	SPECULAR = 0.8;
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

static func _fall_material() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
void fragment() {
	float streak = sin(UV.x * 40.0 + sin(UV.x * 11.0) * 3.0) * 0.5 + 0.5;
	float flow = fract(UV.y * 3.0 - TIME * 1.6 + streak * 0.3);
	float edge = smoothstep(0.0, 0.18, UV.x) * smoothstep(1.0, 0.82, UV.x);
	ALBEDO = vec3(0.86, 0.94, 1.0);
	ALPHA = edge * (0.45 + 0.4 * streak * flow);
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

## palms at the points (the city palm model, 9-13 m), standing on the ground
static func _palms(r: Node, pts: Array[Vector2], rng: RandomNumberGenerator, bank := -INF, bank_at := Vector2.ZERO, bank_r := 0.0) -> void:
	var mesh := Flora.glb_mesh("res://models/foliage/palm-a.glb", 1.0)
	if mesh == null:
		mesh = Flora.glb_mesh("res://models/city/palm.glb", 1.0)
	if mesh == null:
		return
	var xf: Array[Transform3D] = []
	for p in pts:
		var s := rng.randf_range(9.0, 13.0)
		var b := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3(1, 0, 0), rng.randf_range(-0.08, 0.08))
		var y: float = r._h(p.x, p.y) - 0.3
		if p.distance_to(bank_at) < bank_r:
			y = maxf(y, bank - 0.3)   # on the oasis banks
		xf.append(Transform3D(b.scaled(Vector3.ONE * s), Vector3(p.x, y, p.y)))
	r._multimesh(mesh, xf, null, 900.0)

## a ruined aqueduct from a to b: weathered arches (the region's arch) end to end, some fallen, the last piers carrying
## the Ashen red banners
static func _aqueduct(r: Node, a: Vector2, b: Vector2, rock: Material, rng: RandomNumberGenerator) -> void:
	var root := Node3D.new()
	root.name = "BoardAqueduct"
	var arch := Flora.arch_mesh()
	var dir := (b - a).normalized()
	var n := int(a.distance_to(b) / 15.5)
	var yaw := atan2(dir.x, dir.y) + PI * 0.5
	var stone := Flora.rock_material(Color(0.72, 0.55, 0.38))
	for i in n:
		if rng.randf() < 0.22:
			continue   # a fallen span
		var p := a + dir * (i * 15.5)
		if not _clear_of_places(r, p, 28.0):
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = arch
		mi.material_override = stone
		var k := rng.randf_range(0.95, 1.05)
		mi.scale = Vector3(k, k * rng.randf_range(0.85, 1.05), 0.45)
		mi.position = Vector3(p.x, r._h(p.x, p.y) + 0.5, p.y)
		mi.rotation.y = yaw
		root.add_child(mi)
		if i % 4 == 1:
			var ban := _banner(Color(0.62, 0.08, 0.06), 2.4, 6.5)
			ban.position = mi.position + Vector3(0, 4.5, 0) + Vector3(dir.y, 0, -dir.x) * 1.4
			ban.rotation.y = yaw + PI * 0.5
			root.add_child(ban)
	r._world.add_child(root)

## a hanging cloth banner (the Ashen Covenant's red, the faction's diamond sigil in pale gold), cut swallow-tailed
static func _banner(col: Color, w: float, h: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(w, h)
	mi.mesh = q
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode cull_disabled;
uniform vec3 col : source_color;
void vertex() { VERTEX.z += sin(UV.y * 4.0 + TIME * 1.3) * 0.08 * UV.y; }
void fragment() {
	vec2 p = UV - vec2(0.5, 0.36);
	float diamond = abs(p.x) * 1.6 + abs(p.y);
	float sig = smoothstep(0.16, 0.15, diamond) - smoothstep(0.11, 0.1, diamond) + smoothstep(0.05, 0.04, diamond);
	float tail = step(UV.y, 0.88 + abs(UV.x - 0.5) * 0.3);
	float edge = smoothstep(0.0, 0.05, UV.x) * smoothstep(1.0, 0.95, UV.x);
	if (tail < 0.5) { discard; }
	ALBEDO = mix(col * (0.75 + 0.25 * edge), vec3(0.95, 0.82, 0.5), clamp(sig, 0.0, 1.0));
	ROUGHNESS = 0.9;
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	mi.material_override = m
	return mi

# ------------------------------------------------------------------------------------------------ placement helpers

## true when no place (POI) of the region is within `clear` m of the local point
static func _clear_of_places(r: Node, at: Vector2, clear: float) -> bool:
	for p in r.m.pois:
		var q: Vector2 = r._loc(p.x, p.z)
		if q.distance_to(at) < clear:
			return false
	return absf(at.x) < r.span() * 0.5 - 10.0 and absf(at.y) < r.span() * 0.5 - 10.0

## the point nearest `want` (within `search` m) that is `clear` m from every place
static func _open_spot(r: Node, want: Vector2, search: float, clear: float) -> Vector2:
	if _clear_of_places(r, want, clear):
		return want
	var best := want
	var bd := INF
	for i in 64:
		var c := want + Vector2(cos(i * 2.4), sin(i * 2.4)) * search * sqrt(float(i) / 64.0)
		if _clear_of_places(r, c, clear) and c.distance_to(want) < bd:
			bd = c.distance_to(want)
			best = c
	return best

## the flattest open spot near `want` for something `rad` m across
static func _flat_spot(r: Node, want: Vector2, search: float, rad: float) -> Vector2:
	var best := want
	var score := INF
	for i in 48:
		var c := want + Vector2(cos(i * 2.4), sin(i * 2.4)) * search * sqrt(float(i) / 48.0)
		if not _clear_of_places(r, c, rad + 14.0):
			continue
		var hi := -INF
		var lo := INF
		for k in 8:
			var t := TAU * k / 8.0
			var y: float = r._h(c.x + cos(t) * rad, c.y + sin(t) * rad)
			hi = maxf(hi, y)
			lo = minf(lo, y)
		var s := (hi - lo) + c.distance_to(want) * 0.02
		if s < score:
			score = s
			best = c
	return best

# ------------------------------------------------------------------------------------------------ Verdant / Eldergrove

static func _verdant(r: Node, rng: RandomNumberGenerator) -> void:
	var half: float = r.span() * 0.5
	var mossy := Flora.rock_material(Color(0.56, 0.56, 0.48))
	# the elder trees: the forest's broadleaf grown to 38-52 m, standing over the canopy (the key art's giant trunks)
	var lods := Flora.tree_lods("broadleaf", 1.0)
	if not lods.is_empty():
		var xf: Array[Transform3D] = []
		var tries := 0
		while xf.size() < 5 and tries < 80:
			tries += 1
			var at := Vector2(rng.randf_range(-0.8, 0.8), rng.randf_range(-0.8, 0.8)) * half
			if not _clear_of_places(r, at, 60.0) or r.over_water(at.x, at.y):
				continue
			var hgt := rng.randf_range(38.0, 52.0)
			xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * hgt), Vector3(at.x, r._h(at.x, at.y) - 0.8, at.y)))
			if xf.size() == 1:
				spot(r, "elder", at, 24.0)
		# no shadows: crowns this wide roofed the forest floor over in black (Street View, Nov 22)
		r._multimesh(lods[0][0], xf, null, 1400.0, false)
	# the cliffs with their falls: three mossy bluffs, each with a long fall into a pool of mist
	for i in 3:
		var want := Vector2(cos(i * 2.1 + 0.4), sin(i * 2.1 + 0.4)) * half * 0.62
		var at := _open_spot(r, want, 90.0, 40.0)
		var root := Node3D.new()
		var mrad := rng.randf_range(18.0, 26.0)
		# tall enough to clear the canopy on its high side as well (the land slopes up to 20 m across a footprint)
		var h := _rise(r, at, mrad) + rng.randf_range(24.0, 34.0)
		var top := _mesa(r, root, at, mrad, h, mossy, rng)
		var face := (-at).normalized()
		# on the cliff's face (the footprint swings 0.62-1.12 of the radius; the cap's lip is ~0.8)
		var fp := at + face * (mrad * 0.86)
		var gy: float = r._h(fp.x, fp.y)
		var drop := maxf(top - gy, 4.0)
		for j in 2:
			var fall := MeshInstance3D.new()
			var fq := QuadMesh.new()
			fq.size = Vector2(rng.randf_range(4.0, 7.0), drop)
			fall.mesh = fq
			fall.material_override = _fall_material()
			var off := Vector2(face.y, -face.x) * (j * 6.0 - 3.0)
			fall.position = Vector3(fp.x + off.x, gy + drop * 0.5, fp.y + off.y)
			fall.rotation.y = atan2(face.x, face.y)
			root.add_child(fall)
		var mist := _mist(Color(0.9, 0.95, 1.0), 9.0)
		mist.position = Vector3(fp.x + face.x * 4.0, gy + 1.0, fp.y + face.y * 4.0)
		root.add_child(mist)
		r._world.add_child(root)
		spot(r, "falls%d" % i, at, h)
	# the temple gate: ruined arches in a row up a slope with the red banners, near the old ruins
	var ruins: Vector2 = _poi(r, "vf-ruins", "eg-shrine")
	var gate := _open_spot(r, ruins + Vector2(36, 18), 60.0, 26.0)
	var stone := Flora.rock_material(Color(0.5, 0.5, 0.44))
	var arch := Flora.arch_mesh()
	var groot := Node3D.new()
	var gdir := (gate - ruins).normalized().rotated(PI * 0.5)
	for k in 3:
		var p := gate + gdir * (k * 9.0 - 9.0)
		var mi := MeshInstance3D.new()
		mi.mesh = arch
		mi.material_override = stone
		var sc := 0.9 - absf(k - 1) * 0.15
		mi.scale = Vector3(sc, sc, 0.38)
		mi.position = Vector3(p.x, r._h(p.x, p.y) - 0.3, p.y)
		mi.rotation.y = atan2(gdir.x, gdir.y)
		groot.add_child(mi)
		if k != 1:
			var ban := _banner(Color(0.6, 0.07, 0.06), 2.0, 5.5)
			ban.position = mi.position + Vector3(0, 3.6, 0)
			ban.rotation.y = mi.rotation.y
			groot.add_child(ban)
	r._world.add_child(groot)
	spot(r, "gate", gate, 12.0)
	# the Fracture tree: a giant dark trunk split by violet light, crystals at its roots
	var tear: Vector2 = _poi(r, "z-tear", "eg-heart")
	var ft := _open_spot(r, tear + Vector2(-30, 22), 60.0, 22.0)
	_fracture_tree(r, ft, rng)
	spot(r, "fracture-tree", ft, 18.0)
	# blue glowing mushrooms in clusters under the elder trees and by the falls
	_glow_shrooms(r, rng, 26)

static func _poi(r: Node, id: String, alt := "") -> Vector2:
	for p in r.m.pois:
		if p.id == id or (alt != "" and p.id == alt):
			return r._loc(p.x, p.z)
	return Vector2.ZERO

static func _mist(col: Color, rad: float) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = rad
	sm.height = rad * 0.9
	mi.mesh = sm
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, cull_back, depth_draw_never;
uniform vec3 col : source_color;
void fragment() {
	float f = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	ALBEDO = col;
	ALPHA = f * f * 0.45;
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

static func _fracture_tree(r: Node, at: Vector2, rng: RandomNumberGenerator) -> void:
	var root := Node3D.new()
	root.name = "BoardFractureTree"
	var gy: float = r._h(at.x, at.y)
	root.position = Vector3(at.x, gy - 0.5, at.y)
	var trunk := MeshInstance3D.new()
	trunk.mesh = Flora.baobab()
	var bb: AABB = trunk.mesh.get_aabb()
	var k := 30.0 / maxf(bb.size.y, 0.01)
	trunk.scale = Vector3.ONE * k
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.16, 0.12, 0.2)
	bark.roughness = 0.8
	bark.emission_enabled = true
	bark.emission = Color(0.45, 0.15, 0.8)
	bark.emission_energy_multiplier = 0.35
	trunk.material_override = bark
	root.add_child(trunk)
	# the split: a violet seam of light up the trunk
	var seam := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(5.0, 26.0)
	seam.mesh = q
	seam.material_override = _tear_material(Color(0.75, 0.35, 1.0))
	seam.position = Vector3(0, 13.0, 3.2)
	root.add_child(seam)
	var light := OmniLight3D.new()
	light.light_color = Color(0.7, 0.35, 1.0)
	light.light_energy = 4.0
	light.omni_range = 40.0
	light.position = Vector3(0, 12, 4)
	root.add_child(light)
	r._world.add_child(root)
	var Set := preload("res://scripts/vfx/fracture_set.gd")
	Set.crystals(r._world, Vector3(at.x, gy, at.y), 12.0, 14, Color(0.72, 0.35, 1.0), rng, func(x: float, z: float) -> float: return r._h(x, z))

static func _glow_shrooms(r: Node, rng: RandomNumberGenerator, n: int) -> void:
	var cap := SphereMesh.new()
	cap.radius = 0.55
	cap.height = 0.5
	cap.is_hemisphere = true
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.75, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.25, 0.7, 1.0)
	mat.emission_energy_multiplier = 1.6
	cap.material = mat
	var xf: Array[Transform3D] = []
	var half: float = r.span() * 0.5
	for i in n:
		var c := Vector2(rng.randf_range(-0.85, 0.85), rng.randf_range(-0.85, 0.85)) * half
		if not _clear_of_places(r, c, 12.0) or r.over_water(c.x, c.y):
			continue
		for j in 7:
			var p := c + Vector2(rng.randf_range(-3, 3), rng.randf_range(-3, 3))
			var s := rng.randf_range(0.5, 1.6)
			xf.append(Transform3D(Basis.IDENTITY.scaled(Vector3(s, s * rng.randf_range(0.8, 1.4), s)), Vector3(p.x, r._h(p.x, p.y) + 0.15 * s, p.y)))
	r._multimesh(cap, xf, null, 260.0, false)

# ------------------------------------------------------------------------------------------------ Frostspire / Frostveil

static func _frost(r: Node, rng: RandomNumberGenerator) -> void:
	var Set := preload("res://scripts/vfx/fracture_set.gd")
	# the Fracture ice spire: a cluster of tall ice crystals glowing cyan with violet at the heart, a halo ring round it
	var want: Vector2 = _poi(r, "fp-summit", "fv-spine")
	var at := _open_spot(r, want + Vector2(40, -30), 90.0, 30.0)
	var gy: float = r._h(at.x, at.y)
	var root := Node3D.new()
	root.name = "BoardIceSpire"
	root.position = Vector3(at.x, gy - 1.0, at.y)
	var ice := StandardMaterial3D.new()
	ice.albedo_color = Color(0.5, 0.8, 1.0)
	ice.metallic = 0.2
	ice.roughness = 0.08
	ice.emission_enabled = true
	ice.emission = Color(0.3, 0.75, 1.0)
	ice.emission_energy_multiplier = 1.4
	ice.rim_enabled = true
	ice.rim = 0.6
	for i in 9:
		var mi := MeshInstance3D.new()
		var big := i == 0
		mi.mesh = Set.prism_mesh(4.5 if big else rng.randf_range(1.2, 2.6), 62.0 if big else rng.randf_range(12.0, 34.0))
		mi.material_override = ice
		var a := rng.randf() * TAU
		var d := 0.0 if big else rng.randf_range(4.0, 11.0)
		mi.position = Vector3(cos(a) * d, 0, sin(a) * d)
		mi.rotation = Vector3(0 if big else rng.randf_range(-0.35, 0.35), rng.randf() * TAU, 0 if big else rng.randf_range(-0.35, 0.35))
		root.add_child(mi)
	var heart := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(16, 40)
	heart.mesh = q
	heart.material_override = _tear_material(Color(0.68, 0.4, 1.0))
	heart.position = Vector3(0, 22, 0)
	root.add_child(heart)
	var halo := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 21.0
	tm.outer_radius = 22.2
	tm.rings = 64
	halo.mesh = tm
	var hm := StandardMaterial3D.new()
	hm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hm.albedo_color = Color(0.45, 0.8, 1.0, 0.55)
	hm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	halo.material_override = hm
	halo.position = Vector3(0, 34, 0)
	halo.rotation.x = 0.12
	root.add_child(halo)
	var light := OmniLight3D.new()
	light.light_color = Color(0.45, 0.75, 1.0)
	light.light_energy = 5.0
	light.omni_range = 70.0
	light.position = Vector3(0, 20, 0)
	root.add_child(light)
	r._world.add_child(root)
	spot(r, "spire", at, 30.0)
	# the research station's radar dish (Frostveil / Frostspire key art), on its own pylon beside the station
	var st: Vector2 = _poi(r, "fp-research", "fv-station")
	var dish_at := _open_spot(r, st + Vector2(-22, 16), 40.0, 14.0)
	_radar_dish(r, dish_at, 9.0)
	spot(r, "dish", dish_at, 14.0)

static func _radar_dish(r: Node, at: Vector2, rad: float) -> void:
	var root := Node3D.new()
	root.name = "BoardRadarDish"
	root.position = Vector3(at.x, r._h(at.x, at.y), at.y)
	var steel := StandardMaterial3D.new()
	steel.albedo_color = Color(0.82, 0.84, 0.86)
	steel.metallic = 0.5
	steel.roughness = 0.4
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.22, 0.24, 0.28)
	dark.metallic = 0.6
	dark.roughness = 0.5
	var base := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 2.2
	bm.bottom_radius = 3.4
	bm.height = 7.0
	base.mesh = bm
	base.material_override = dark
	base.position.y = 3.5
	root.add_child(base)
	var head := Node3D.new()
	head.position = Vector3(0, 8.0, 0)
	head.rotation = Vector3(deg_to_rad(-38.0), 0.6, 0)
	root.add_child(head)
	# the bowl: a hemisphere squashed to a shallow dish, open side out
	var bowl := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = rad
	sm.height = rad * 0.7
	sm.is_hemisphere = true
	bowl.mesh = sm
	bowl.material_override = steel
	bowl.rotation.x = PI
	bowl.position.y = rad * 0.32
	head.add_child(bowl)
	var feed := MeshInstance3D.new()
	var fm := CylinderMesh.new()
	fm.top_radius = 0.15
	fm.bottom_radius = 0.3
	fm.height = rad * 0.9
	feed.mesh = fm
	feed.material_override = dark
	feed.position.y = rad * 0.3
	head.add_child(feed)
	var lamp := OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.3, 0.2)
	lamp.light_energy = 2.0
	lamp.omni_range = 8.0
	lamp.position = Vector3(0, rad * 0.8, 0)
	head.add_child(lamp)
	r._world.add_child(root)

# ------------------------------------------------------------------------------------------------ Ember Peaks / Obsidian Reach

static func _ember(r: Node, rng: RandomNumberGenerator) -> void:
	var Set := preload("res://scripts/vfx/fracture_set.gd")
	var basalt := Flora.rock_material(Color(0.2, 0.18, 0.18))
	# the hold: a dark fortress on its ridge — curtain walls, square towers, a keep, red banners, warm windows
	var want: Vector2 = _poi(r, "sp-ash-outpost")
	var at := _high_spot(r, want, 110.0, 52.0)
	_fortress(r, at, rng)
	spot(r, "fortress", at, 26.0)
	# the volcanoes behind (the board's erupting cone): two big cones out on the region's edge, lava channels down them
	var half: float = r.span() * 0.5
	for i in 2:
		var ang := atan2(at.y, at.x) + PI + (i * 0.9 - 0.45)
		var vat := Vector2(cos(ang), sin(ang)) * half * (1.75 + i * 0.4)
		_volcano(r, vat, 150.0 - i * 30.0, 105.0 - i * 20.0, rng)
		spot(r, "volcano%d" % i, vat, 120.0)
	# lava falls: molten sheets down three basalt bluffs, pooling at the foot
	for i in 3:
		var w: Vector2 = Vector2(cos(i * 2.2 + 1.0), sin(i * 2.2 + 1.0)) * r.span() * 0.3
		var c := _open_spot(r, w, 80.0, 34.0)
		var root := Node3D.new()
		var mrad := rng.randf_range(14.0, 20.0)
		var h := _rise(r, c, mrad) + rng.randf_range(18.0, 28.0)
		var top := _mesa(r, root, c, mrad, h, basalt, rng)
		var face := (-c).normalized()
		var fp := c + face * (mrad * 0.86)
		var gy: float = r._h(fp.x, fp.y)
		var drop := maxf(top - gy, 4.0)
		var fall := MeshInstance3D.new()
		var fq := QuadMesh.new()
		fq.size = Vector2(5.5, drop)
		fall.mesh = fq
		fall.material_override = _lava_fall_material()
		fall.position = Vector3(fp.x, gy + drop * 0.5, fp.y)
		fall.rotation.y = atan2(face.x, face.y)
		fall.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(fall)
		var pool := MeshInstance3D.new()
		var pm := CylinderMesh.new()
		pm.top_radius = 7.0
		pm.bottom_radius = 6.0
		pm.height = 1.0
		pool.mesh = pm
		pool.material_override = _lava_fall_material()
		pool.position = Vector3(fp.x + face.x * 5.0, gy - 0.2, fp.y + face.y * 5.0)
		root.add_child(pool)
		var glow := OmniLight3D.new()
		glow.light_color = Color(1.0, 0.45, 0.15)
		glow.light_energy = 4.0
		glow.omni_range = 34.0
		glow.position = Vector3(fp.x + face.x * 3.0, gy + 6.0, fp.y + face.y * 3.0)
		root.add_child(glow)
		r._world.add_child(root)
		spot(r, "lavafall%d" % i, c, h)
	# the violet Fracture crystals breaking out of the basalt (the board's Fracture Caldera / Rift)
	var trench: Vector2 = _poi(r, "z-trench")
	var cz := _open_spot(r, trench + Vector2(30, -20), 60.0, 20.0)
	var gyc: float = r._h(cz.x, cz.y)
	Set.crystals(r._world, Vector3(cz.x, gyc, cz.y), 16.0, 22, Color(0.72, 0.3, 1.0), rng, func(x: float, z: float) -> float: return r._h(x, z))
	var big := MeshInstance3D.new()
	big.mesh = Set.prism_mesh(3.2, 34.0)
	var vm := StandardMaterial3D.new()
	vm.albedo_color = Color(0.4, 0.12, 0.6)
	vm.emission_enabled = true
	vm.emission = Color(0.7, 0.3, 1.0)
	vm.emission_energy_multiplier = 2.2
	vm.roughness = 0.2
	big.material_override = vm
	big.position = Vector3(cz.x, gyc - 1.0, cz.y)
	r._world.add_child(big)
	var vl := OmniLight3D.new()
	vl.light_color = Color(0.7, 0.35, 1.0)
	vl.light_energy = 5.0
	vl.omni_range = 50.0
	vl.position = Vector3(cz.x, gyc + 14.0, cz.y)
	r._world.add_child(vl)
	spot(r, "crystal", cz, 18.0)

static func _lava_fall_material() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, cull_disabled;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void fragment() {
	float x = UV.x * 9.0 + sin(UV.y * 7.0) * 0.6;
	float flow = fract(UV.y * 2.5 - TIME * 0.35 + sin(x) * 0.2);
	float crust = smoothstep(0.55, 0.85, h(floor(vec2(x * 1.5, UV.y * 18.0 - TIME * 1.2))));
	vec3 hot = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.85, 0.45), flow * 0.5);
	ALBEDO = mix(hot * 2.4, vec3(0.12, 0.05, 0.03), crust * 0.75);
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

## the hold: a ring of curtain wall with square towers on the corners, a tall keep, crenellations, red banners on the
## towers and lit window slits (the Ember Reach / Emberhold key art)
static func _fortress(r: Node, at: Vector2, rng: RandomNumberGenerator) -> void:
	var root := Node3D.new()
	root.name = "BoardFortress"
	var low := INF
	for k in 12:
		var t := TAU * k / 12.0
		low = minf(low, r._h(at.x + cos(t) * 22.0, at.y + sin(t) * 22.0))
	root.position = Vector3(at.x, low - 2.0, at.y)
	root.rotation.y = rng.randf() * TAU
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.3, 0.28, 0.29)
	stone.roughness = 0.88
	var win := StandardMaterial3D.new()
	win.albedo_color = Color(1.0, 0.62, 0.25)
	win.emission_enabled = true
	win.emission = Color(1.0, 0.55, 0.2)
	win.emission_energy_multiplier = 3.0
	var top_y := 0.0
	var blocks := [
		# walls: [x, z, w, d, h]
		[0, -20, 40, 3, 14], [0, 20, 40, 3, 14], [-20, 0, 3, 40, 14], [20, 0, 3, 40, 14],
		# corner towers
		[-20, -20, 8, 8, 24], [20, -20, 8, 8, 24], [-20, 20, 8, 8, 24], [20, 20, 8, 8, 24],
		# the keep and its tower
		[0, 2, 16, 14, 30], [4, -2, 7, 7, 44],
	]
	for b in blocks:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(b[2], b[4] + 2.0, b[3])
		mi.mesh = bm
		mi.material_override = stone
		mi.position = Vector3(b[0], (b[4] + 2.0) * 0.5, b[1])
		root.add_child(mi)
		top_y = maxf(top_y, b[4])
		# crenellations along the top edge
		var along: float = maxf(b[2], b[3])
		var n := int(along / 2.4)
		var horiz: bool = b[2] >= b[3]
		for k in n:
			if k % 2 == 1:
				continue
			var c := MeshInstance3D.new()
			var cm := BoxMesh.new()
			cm.size = Vector3(1.2, 1.4, 1.2)
			c.mesh = cm
			c.material_override = stone
			var o := -along * 0.5 + 1.2 + k * 2.4
			for side in [-1, 1]:
				var cc := c.duplicate()
				cc.position = Vector3(b[0] + (o if horiz else side * (b[2] * 0.5 - 0.6)), b[4] + 2.7, b[1] + (side * (b[3] * 0.5 - 0.6) if horiz else o))
				root.add_child(cc)
		# window slits on the towers and keep
		if b[4] >= 24:
			for k in int(b[4] / 7):
				for f in 4:
					var w := MeshInstance3D.new()
					var wm := BoxMesh.new()
					wm.size = Vector3(0.7, 1.8, 0.2) if f < 2 else Vector3(0.2, 1.8, 0.7)
					w.mesh = wm
					w.material_override = win
					var ox: float = 0.0 if f < 2 else (b[2] * 0.5 + 0.05) * (1 if f == 2 else -1)
					var oz: float = (b[3] * 0.5 + 0.05) * (1 if f == 0 else -1) if f < 2 else 0.0
					w.position = Vector3(b[0] + ox + rng.randf_range(-1.0, 1.0) * (1 if f < 2 else 0), 6.0 + k * 6.5, b[1] + oz + rng.randf_range(-1.0, 1.0) * (0 if f < 2 else 1))
					root.add_child(w)
			# a banner down the face
			var ban := _banner(Color(0.65, 0.06, 0.05), 3.0, minf(10.0, b[4] * 0.4))
			ban.position = Vector3(b[0], b[4] - 5.0, b[1] + b[3] * 0.5 + 0.12)
			root.add_child(ban)
	var hearth := OmniLight3D.new()
	hearth.light_color = Color(1.0, 0.55, 0.25)
	hearth.light_energy = 3.0
	hearth.omni_range = 40.0
	hearth.position = Vector3(0, 10, 0)
	root.add_child(hearth)
	r._world.add_child(root)

## the highest open spot near `want` (a hold on its ridge)
static func _high_spot(r: Node, want: Vector2, search: float, clear: float) -> Vector2:
	var best := _open_spot(r, want, search, clear)
	var top: float = r._h(best.x, best.y)
	for i in 64:
		var c := want + Vector2(cos(i * 2.4), sin(i * 2.4)) * search * sqrt(float(i) / 64.0)
		if not _clear_of_places(r, c, clear) or r.over_water(c.x, c.y):
			continue
		var y: float = r._h(c.x, c.y)
		if y > top:
			top = y
			best = c
	return best

## a volcano: a broad noisy cone of black basalt with glowing lava channels running from the crater, the crater's glow
## lighting it from above
static func _volcano(r: Node, at: Vector2, h: float, rad: float, rng: RandomNumberGenerator) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	const SEG := 48
	const RINGS := 14
	var ph := rng.randf() * 10.0
	for ri in RINGS + 1:
		var t := float(ri) / RINGS            # 0 at the foot, 1 at the crater lip
		var y := h * pow(t, 0.8)
		for k in SEG:
			var a := TAU * k / SEG
			var rr := rad * (1.0 - t * 0.85) * (1.0 + 0.12 * sin(a * 5.0 + ph) + 0.07 * sin(a * 13.0 + t * 9.0) + rng.randf_range(-0.05, 0.05))
			st.set_uv(Vector2(float(k) / SEG, t))
			st.add_vertex(Vector3(cos(a) * rr, y - h * 0.08, sin(a) * rr))
	for ri in RINGS:
		for k in SEG:
			var a0 := ri * SEG + k
			var a1 := ri * SEG + (k + 1) % SEG
			var b0 := (ri + 1) * SEG + k
			var b1 := (ri + 1) * SEG + (k + 1) % SEG
			st.add_index(a0)
			st.add_index(b0)
			st.add_index(a1)
			st.add_index(a1)
			st.add_index(b0)
			st.add_index(b1)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
uniform float seed = 0.0;
void fragment() {
	// a few channels winding down from the lip, glowing hot near the crater and cooling to dull red at the foot
	float x = UV.x * 48.0 + sin(UV.y * 9.0 + seed) * 1.6 + sin(UV.y * 23.0) * 0.4;
	float ch = 0.0;
	for (int i = 0; i < 8; i++) {
		float c = float(i) * 6.0 + seed * 3.0;
		ch = max(ch, smoothstep(0.55, 0.0, abs(mod(x - c + 24.0, 48.0) - 24.0)) * step(0.15 + 0.12 * float(i % 3), UV.y));
	}
	float heat = ch * mix(0.35, 1.0, UV.y);
	float rock = 0.13 + 0.05 * sin(UV.x * 300.0 + UV.y * 40.0) + 0.04 * sin(UV.y * 90.0 + UV.x * 60.0);
	ALBEDO = vec3(rock * 1.1, rock, rock * 0.95);
	ROUGHNESS = 0.9;
	EMISSION = vec3(1.0, 0.38, 0.08) * heat * 4.0 + vec3(1.0, 0.45, 0.1) * smoothstep(0.9, 1.0, UV.y) * 3.0;
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("seed", rng.randf() * 10.0)
	mi.material_override = m
	mi.position = Vector3(at.x, float(r.water_level()) - 2.0, at.y)
	mi.set_meta("not_land", true)
	r._world.add_child(mi)
	var glow := OmniLight3D.new()
	glow.light_color = Color(1.0, 0.45, 0.15)
	glow.light_energy = 8.0
	glow.omni_range = h * 1.2
	glow.position = mi.position + Vector3(0, h * 1.02, 0)
	glow.set_meta("not_land", true)
	r._world.add_child(glow)

# ------------------------------------------------------------------------------------------------ the Shattered Expanse

static func _shattered(r: Node, rng: RandomNumberGenerator) -> void:
	var Set := preload("res://scripts/vfx/fracture_set.gd")
	var half: float = r.span() * 0.5
	# the Fracture spire: a black crystal needle 110 m tall split by violet light, a swirl of light round its crown
	var at := _open_spot(r, _poi(r, "cb-spire") + Vector2(40, 30), 90.0, 36.0)
	var gy: float = r._h(at.x, at.y)
	var root := Node3D.new()
	root.name = "BoardFractureSpire"
	root.position = Vector3(at.x, gy - 2.0, at.y)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.1, 0.06, 0.16)
	dark.metallic = 0.4
	dark.roughness = 0.25
	dark.emission_enabled = true
	dark.emission = Color(0.55, 0.2, 1.0)
	dark.emission_energy_multiplier = 0.5
	for i in 7:
		var mi := MeshInstance3D.new()
		var big := i == 0
		mi.mesh = Set.prism_mesh(7.0 if big else rng.randf_range(2.0, 4.0), 110.0 if big else rng.randf_range(24.0, 55.0))
		mi.material_override = dark
		var a := rng.randf() * TAU
		var d := 0.0 if big else rng.randf_range(7.0, 16.0)
		mi.position = Vector3(cos(a) * d, 0, sin(a) * d)
		mi.rotation = Vector3(0 if big else rng.randf_range(-0.3, 0.3), rng.randf() * TAU, 0 if big else rng.randf_range(-0.3, 0.3))
		root.add_child(mi)
	var seam := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(22, 90)
	seam.mesh = q
	seam.material_override = _tear_material(Color(0.78, 0.35, 1.0))
	seam.position = Vector3(0, 50, 0)
	root.add_child(seam)
	for k in 3:
		var sw := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 26.0 + k * 9.0
		tm.outer_radius = 27.0 + k * 9.0
		tm.rings = 64
		sw.mesh = tm
		var sm := StandardMaterial3D.new()
		sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		sm.albedo_color = Color(0.8, 0.45, 1.0, 0.6 - k * 0.15)
		sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		sw.material_override = sm
		sw.position = Vector3(0, 92 + k * 4.0, 0)
		sw.rotation = Vector3(0.15 * (k - 1), 0, 0.1 * k)
		root.add_child(sw)
	var light := OmniLight3D.new()
	light.light_color = Color(0.7, 0.35, 1.0)
	light.light_energy = 8.0
	light.omni_range = 120.0
	light.position = Vector3(0, 60, 0)
	root.add_child(light)
	r._world.add_child(root)
	spot(r, "spire", at, 60.0)
	# rock islands hanging in the sky round the spire, ruined towers on some, crystals hanging under them
	var rock := Flora.rock_material(Color(0.3, 0.26, 0.32))
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color(0.34, 0.32, 0.36)
	stone.roughness = 0.9
	for i in 10:
		var a := TAU * i / 10.0 + rng.randf_range(-0.2, 0.2)
		var d := rng.randf_range(70.0, half * 0.85)
		var c := at + Vector2(cos(a), sin(a)) * d
		var isl := _sky_island(rng.randf_range(9.0, 22.0), rng)
		isl.material_override = rock
		isl.position = Vector3(c.x, float(r._h(c.x, c.y)) + rng.randf_range(45.0, 110.0), c.y)
		isl.rotation.y = rng.randf() * TAU
		r._world.add_child(isl)
		if i % 3 == 0:
			var tw := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 2.2
			cm.bottom_radius = 3.0
			cm.height = rng.randf_range(12.0, 22.0)
			tw.mesh = cm
			tw.material_override = stone
			tw.position = isl.position + Vector3(0, cm.height * 0.5 + 1.0, 0)
			r._world.add_child(tw)
		Set.crystals(r._world, isl.position + Vector3(0, -6.0, 0), 4.0, 3, Color(0.75, 0.35, 1.0), rng)
	spot(r, "islands", at + Vector2(80, 0), 40.0)
	# the rift ring: the Fx portal at giant scale, open on the plain
	var ring_at := _open_spot(r, at + Vector2(-110, 60), 80.0, 30.0)
	var po := Fx.portal(16.0, Color(0.78, 0.35, 1.0))
	po.position = Vector3(ring_at.x, float(r._h(ring_at.x, ring_at.y)) - 0.5, ring_at.y)
	po.rotation.y = atan2(at.x - ring_at.x, at.y - ring_at.y)
	r._world.add_child(po)
	spot(r, "rift", ring_at, 20.0)

## a rock island: a flat top over a long jagged underside tapering to a point
static func _sky_island(rad: float, rng: RandomNumberGenerator) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	const SEG := 18
	var levels := [[0.0, 1.0], [-rad * 0.35, 0.85], [-rad * 0.8, 0.55], [-rad * 1.3, 0.28], [-rad * 1.8, 0.06]]
	var ph := rng.randf() * TAU
	for li in levels.size():
		for k in SEG:
			var t := TAU * k / SEG
			var rr: float = rad * float(levels[li][1]) * (0.85 + 0.15 * sin(t * 3.0 + ph) + rng.randf_range(-0.08, 0.08))
			st.set_uv(Vector2(float(k) / SEG, float(li) / levels.size()))
			st.add_vertex(Vector3(cos(t) * rr, float(levels[li][0]) + rng.randf_range(-0.6, 0.6) * li, sin(t) * rr))
	for li in levels.size() - 1:
		for k in SEG:
			var a0 := li * SEG + k
			var a1 := li * SEG + (k + 1) % SEG
			var b0 := (li + 1) * SEG + k
			var b1 := (li + 1) * SEG + (k + 1) % SEG
			st.add_index(a0)
			st.add_index(a1)
			st.add_index(b0)
			st.add_index(a1)
			st.add_index(b1)
			st.add_index(b0)
	var top := levels.size() * SEG
	st.set_uv(Vector2(0.5, 0.0))
	st.add_vertex(Vector3(0, 0.4, 0))
	for k in SEG:
		st.add_index(top)
		st.add_index((k + 1) % SEG)
		st.add_index(k)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	return mi

# ------------------------------------------------------------------------------------------------ Azure Isles

static func _azure(r: Node, rng: RandomNumberGenerator) -> void:
	var w: float = r.water_level()
	# overwater bungalows: a pier out over the water from the bay, thatched huts on stilts either side
	var bay := _poi(r, "az-bay")
	var lagoon := _poi(r, "az-lagoon")
	var start := _shore_from(r, bay, (lagoon - bay).normalized() if lagoon != bay else Vector2(1, 0))
	var out := _sea_dir(r, start)
	var root := Node3D.new()
	root.name = "BoardBungalows"
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.48, 0.34, 0.22)
	wood.roughness = 0.85
	var thatch := StandardMaterial3D.new()
	thatch.albedo_color = Color(0.72, 0.58, 0.36)
	thatch.roughness = 1.0
	var plen := 70.0
	var deck := MeshInstance3D.new()
	var dm := BoxMesh.new()
	dm.size = Vector3(3.0, 0.4, plen)
	deck.mesh = dm
	deck.material_override = wood
	var mid := start + out * plen * 0.5
	deck.position = Vector3(mid.x, w + 2.2, mid.y)
	deck.rotation.y = atan2(out.x, out.y)
	root.add_child(deck)
	var side := Vector2(out.y, -out.x)
	for i in 6:
		for sgn in [-1.0, 1.0]:
			var p: Vector2 = start + out * (14.0 + i * 11.0) + side * sgn * 8.0
			var hut := Node3D.new()
			hut.position = Vector3(p.x, w, p.y)
			hut.rotation.y = atan2(out.x, out.y)
			var floor_m := MeshInstance3D.new()
			var fm := BoxMesh.new()
			fm.size = Vector3(7.0, 0.4, 7.0)
			floor_m.mesh = fm
			floor_m.material_override = wood
			floor_m.position.y = 2.2
			hut.add_child(floor_m)
			for cx in [-3.0, 3.0]:
				for cz in [-3.0, 3.0]:
					var stilt := MeshInstance3D.new()
					var sm := CylinderMesh.new()
					sm.top_radius = 0.15
					sm.bottom_radius = 0.15
					sm.height = 5.0
					stilt.mesh = sm
					stilt.material_override = wood
					stilt.position = Vector3(cx, -0.3, cz)
					hut.add_child(stilt)
			var walls := MeshInstance3D.new()
			var wm := BoxMesh.new()
			wm.size = Vector3(5.0, 2.6, 5.0)
			walls.mesh = wm
			var wall := StandardMaterial3D.new()
			wall.albedo_color = Color(0.86, 0.78, 0.64)
			walls.material_override = wall
			walls.position.y = 3.7
			hut.add_child(walls)
			var roof := MeshInstance3D.new()
			var rm := CylinderMesh.new()
			rm.top_radius = 0.1
			rm.bottom_radius = 5.2
			rm.height = 3.2
			rm.radial_segments = 4
			roof.mesh = rm
			roof.material_override = thatch
			roof.position.y = 6.6
			roof.rotation.y = PI * 0.25
			hut.add_child(roof)
			# the walk from the pier
			var walk := MeshInstance3D.new()
			var km := BoxMesh.new()
			km.size = Vector3(4.5, 0.3, 1.4)
			walk.mesh = km
			walk.material_override = wood
			walk.position = Vector3(-sgn * 4.6, 2.2, 0)
			hut.add_child(walk)
			root.add_child(hut)
	r._world.add_child(root)
	spot(r, "bungalows", start + out * 35.0, 30.0)
	# the sea arch: the region's arch at giant scale standing out of the water off the coast
	var fort := _poi(r, "az-fort")
	var arch_at := _shore_from(r, fort, _sea_dir(r, fort))
	arch_at += _sea_dir(r, arch_at) * 40.0
	var arch := MeshInstance3D.new()
	arch.mesh = Flora.arch_mesh()
	arch.material_override = Flora.rock_material(Color(0.62, 0.58, 0.5))
	arch.scale = Vector3(4.2, 4.6, 1.8)
	arch.position = Vector3(arch_at.x, w - 4.0, arch_at.y)
	arch.rotation.y = rng.randf() * TAU
	r._world.add_child(arch)
	spot(r, "arch", arch_at, 40.0)
	# palms along the beaches: points on the shoreline all round the island
	var pts: Array[Vector2] = []
	var half: float = r.span() * 0.5
	for i in 260:
		var p := Vector2(rng.randf_range(-0.95, 0.95), rng.randf_range(-0.95, 0.95)) * half
		var y: float = r._h(p.x, p.y)
		if y > w + 0.6 and y < w + 5.0 and _clear_of_places(r, p, 14.0):
			pts.append(p)
		if pts.size() >= 60:
			break
	_palms(r, pts, rng)

## the first point over water walking from `p` along `dir` (the shore), or `p` if none within 300 m
static func _shore_from(r: Node, p: Vector2, dir: Vector2) -> Vector2:
	for k in 150:
		var q := p + dir * (k * 2.0)
		if r.over_water(q.x, q.y):
			return q
	return p

## the direction from `p` with the most water within 120 m
static func _sea_dir(r: Node, p: Vector2) -> Vector2:
	var best := Vector2(1, 0)
	var most := -1
	for k in 16:
		var d := Vector2(cos(TAU * k / 16.0), sin(TAU * k / 16.0))
		var n := 0
		for j in 12:
			var q := p + d * (10.0 + j * 10.0)
			if r.over_water(q.x, q.y):
				n += 1
		if n > most:
			most = n
			best = d
	return best

## how much the ground climbs across a footprint (highest minus lowest, round its rim and at its middle)
static func _rise(r: Node, at: Vector2, rad: float) -> float:
	var hi := -INF
	var lo := INF
	for k in 12:
		var t := TAU * k / 12.0
		var y: float = r._h(at.x + cos(t) * rad, at.y + sin(t) * rad)
		hi = maxf(hi, y)
		lo = minf(lo, y)
	var mid: float = r._h(at.x, at.y)
	return maxf(hi, mid) - minf(lo, mid)
