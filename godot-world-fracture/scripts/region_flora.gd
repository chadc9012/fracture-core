extends RefCounted
## The asset catalog's vegetation and rock gaps for the region 3D view (docs/asset-catalog.md, owner's boards Nov 8):
## broadleaf oak, cherry blossom, baobab, bamboo and alien flora beside the conifer, vines hanging off the Storm Islands,
## sandstone arches, cave mouths in the mountains and ice spires on the ice. All procedural low-poly meshes drawn as tiled
## MultiMeshes through region_3d's `_multimesh`, each claiming its footprint in the same spacing hash as the trees, so
## nothing grows through anything else. The weather (snowfall, lightning) is region_weather.gd.
##
## Each region gets a species mix: the forest places region_3d found are dealt out between the species by a hash of their
## position, so a region looks the same every visit.

## species shares per region; "pine" is region_3d's conifer (whatever is left over)
static func mix_for(id: String) -> Dictionary:
	match id:
		"veridan":
			return {"oak": 0.32, "cherry": 0.1}
		"riverdale":
			return {"oak": 0.3, "cherry": 0.08}
		"old-harrow":
			return {"oak": 0.5, "cherry": 0.1}
		"goldenreach":
			return {"oak": 0.65, "cherry": 0.1}
		"swamps":
			return {"oak": 0.55}
		"solara":
			return {"baobab": 1.0}
		"wastelands":
			return {"baobab": 0.45}
		"azure-isles", "shattered-reefs":
			return {"bamboo": 0.4}
		"crystal-badlands":
			return {"alien": 1.0}
		"storm":
			return {"alien": 0.35}
	return {}

## deals the forest places out between the species; returns the ones left for the conifer
static func plant(r: Node, trees: Array[Transform3D]) -> Array[Transform3D]:
	var mix := mix_for(r.map_id)
	if mix.is_empty():
		return trees
	var by := {}
	for k in mix:
		by[k] = [] as Array[Transform3D]
	var pines: Array[Transform3D] = []
	for t in trees:
		var h := fposmod(sin(t.origin.x * 12.9898 + t.origin.z * 78.233) * 43758.5453, 1.0)
		var acc := 0.0
		var got := ""
		for k in mix:
			acc += float(mix[k])
			if h < acc:
				got = k
				break
		if got == "":
			pines.append(t)
		else:
			by[got].append(t)
	for k in by:
		var list: Array[Transform3D] = by[k]
		if list.is_empty():
			continue
		match k:
			"oak":
				r._multimesh(broadleaf(), list, r._tree_material(false))
			"cherry":
				r._multimesh(broadleaf(), list, cherry_material(r))
			"baobab":
				r._multimesh(baobab(), _rescale(list, 1.1), baobab_material())
			"bamboo":
				r._multimesh(bamboo(), list, bamboo_material(), 600.0)
			"alien":
				var parts := alien()
				r._multimesh(parts[0], list, alien_material(false), 700.0)
				r._multimesh(parts[1], list, alien_material(true), 700.0, false)
	return pines

static func _rescale(list: Array[Transform3D], k: float) -> Array[Transform3D]:
	var out: Array[Transform3D] = []
	for t in list:
		out.append(Transform3D(t.basis.scaled(Vector3.ONE * k), t.origin))
	return out

# ---------------------------------------------------------------- meshes

static func _cyl(st: SurfaceTool, top: float, bottom: float, h: float, seg: int, xf: Transform3D) -> void:
	var c := CylinderMesh.new()
	c.top_radius = top
	c.bottom_radius = bottom
	c.height = h
	c.radial_segments = seg
	c.rings = 0
	c.cap_bottom = false
	st.append_from(c, 0, xf)

static func _blob(st: SurfaceTool, r: float, xf: Transform3D, seg := 7) -> void:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = seg
	s.rings = 4
	st.append_from(s, 0, xf)

## an oak (also the cherry): a stout trunk and a lumpy crown of five blobs. The trunk stays under 2.6 m, where
## region_3d's tree shader switches from bark to leaf, so the oaks follow the seasons with the conifers.
static func broadleaf() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_cyl(st, 0.22, 0.38, 3.4, 6, Transform3D(Basis(), Vector3(0, 1.7, 0)))
	_cyl(st, 0.08, 0.16, 2.2, 5, Transform3D(Basis(Vector3.BACK, 0.7), Vector3(-0.7, 3.4, 0)))
	_cyl(st, 0.08, 0.16, 2.2, 5, Transform3D(Basis(Vector3.RIGHT, -0.7), Vector3(0, 3.5, -0.7)))
	for b in [[0.0, 5.2, 0.0, 2.3], [1.5, 4.6, 0.6, 1.7], [-1.4, 4.7, -0.5, 1.8], [0.4, 4.5, -1.5, 1.6], [-0.5, 6.4, 0.6, 1.5]]:
		_blob(st, b[3], Transform3D(Basis().scaled(Vector3(1.0, 0.82, 1.0)), Vector3(b[0], b[1], b[2])))
	st.generate_normals()
	return st.commit()

## a baobab: a fat bottle trunk, short stubby limbs splayed at the top and a flat, thin crown on them
static func baobab() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_cyl(st, 0.75, 1.35, 3.5, 9, Transform3D(Basis(), Vector3(0, 1.75, 0)))
	_cyl(st, 0.55, 0.75, 2.8, 9, Transform3D(Basis(), Vector3(0, 4.9, 0)))
	for k in 6:
		var a := k * TAU / 6.0 + 0.3
		var b := Basis(Vector3.UP, a) * Basis(Vector3.RIGHT, 0.9)
		_cyl(st, 0.1, 0.28, 2.6, 5, Transform3D(b, Vector3(sin(a) * 0.9, 7.0, cos(a) * 0.9)))
		_blob(st, 1.3, Transform3D(Basis().scaled(Vector3(1.0, 0.4, 1.0)), Vector3(sin(a) * 2.2, 7.9, cos(a) * 2.2)), 6)
	_blob(st, 1.6, Transform3D(Basis().scaled(Vector3(1.0, 0.35, 1.0)), Vector3(0, 8.1, 0)), 6)
	st.generate_normals()
	return st.commit()

## a bamboo clump: nine leaning culms 7-11 m with leaf tufts along the upper half (UV2.x carries "leaf")
static func bamboo() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	for k in 9:
		var a := rng.randf() * TAU
		var d := rng.randf() * 0.9
		var h := 7.0 + rng.randf() * 4.0
		var lean := Basis(Vector3(cos(a), 0, -sin(a)), 0.05 + rng.randf() * 0.12)
		var base := Vector3(sin(a) * d, 0, cos(a) * d)
		_cyl(st, 0.05, 0.08, h, 5, Transform3D(lean, base + lean * Vector3(0, h * 0.5, 0)))
		for t in 4:
			var y := h * (0.55 + t * 0.14)
			var p := base + lean * Vector3(0, y, 0)
			_blob(st, 0.75 - t * 0.08, Transform3D(Basis(Vector3.UP, a + t).scaled(Vector3(1.4, 0.3, 0.7)), p + Vector3(0.3, 0, 0)), 5)
	st.generate_normals()
	return st.commit()

## alien flora: a cluster of three curving stalks, each topped with a glowing bulb and a ring of drooping fronds.
## Two meshes, [stalks, bulbs], so the bulbs take the glowing material.
static func alien() -> Array[Mesh]:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var bt := SurfaceTool.new()
	bt.begin(Mesh.PRIMITIVE_TRIANGLES)
	for s in [[0.0, 0.0, 6.5, 1.1, 0.0], [1.4, 0.6, 4.2, 0.75, 2.1], [-1.1, 0.9, 3.4, 0.6, 4.0]]:
		var base := Vector3(s[0], 0, s[1])
		var h: float = s[2]
		var tilt := Basis(Vector3(cos(s[4]), 0, sin(s[4])), 0.12)
		_cyl(st, 0.1, 0.28, h, 6, Transform3D(tilt, base + tilt * Vector3(0, h * 0.5, 0)))
		var top: Vector3 = base + tilt * Vector3(0, h, 0)
		_blob(bt, s[3], Transform3D(Basis().scaled(Vector3(1.0, 1.25, 1.0)), top + Vector3(0, s[3] * 0.6, 0)), 8)
		for f in 5:
			var a := f * TAU / 5.0 + float(s[4])
			var fb := Basis(Vector3.UP, a) * Basis(Vector3.RIGHT, 2.2)
			_cyl(bt, 0.02, 0.12, s[3] * 2.4, 4, Transform3D(fb, top + Vector3(sin(a), -0.3, cos(a)) * s[3] * 0.9))
	st.generate_normals()
	bt.generate_normals()
	return [st.commit(), bt.commit()]

# ---------------------------------------------------------------- materials

static func cherry_material(r: Node) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
uniform int season = 1;
varying float hy;
void vertex() { hy = VERTEX.y; }
void fragment() {
	float n = fract(sin(dot(floor(NODE_POSITION_WORLD.xz), vec2(12.9898, 78.233))) * 43758.5453);
	float spot = fract(sin(dot(floor(VERTEX.xz * 3.0 + VERTEX.y * 2.0), vec2(4.1, 7.7))) * 912.3);
	vec3 pink = mix(vec3(0.93, 0.56, 0.7), vec3(0.99, 0.82, 0.89), n) * (0.85 + 0.2 * spot);
	vec3 leaf = pink;
	if (season == 1) leaf = mix(pink, vec3(0.32, 0.45, 0.2), 0.35 + 0.3 * spot);
	if (season == 2) leaf = mix(vec3(0.7, 0.2, 0.12), vec3(0.88, 0.45, 0.18), spot);
	if (season == 3) leaf = vec3(0.3, 0.24, 0.22);
	vec3 c = hy < 2.6 ? vec3(0.26, 0.16, 0.14) : leaf;
	ALBEDO = c;
	ROUGHNESS = 0.9;
	BACKLIGHT = hy < 2.6 ? vec3(0.0) : leaf * 0.25;
}"""
	mat.shader = sh
	mat.set_shader_parameter("season", r.current_season())
	r._tree_mats.append(mat)
	return mat

static func baobab_material() -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
varying float hy;
void vertex() { hy = VERTEX.y; }
void fragment() {
	float n = fract(sin(dot(floor(NODE_POSITION_WORLD.xz), vec2(12.9898, 78.233))) * 43758.5453);
	float ridge = 0.85 + 0.15 * sin(atan(VERTEX.x, VERTEX.z) * 14.0);
	vec3 bark = mix(vec3(0.46, 0.38, 0.31), vec3(0.56, 0.47, 0.38), n) * ridge;
	vec3 leaf = mix(vec3(0.28, 0.36, 0.14), vec3(0.4, 0.44, 0.18), n);
	ALBEDO = hy < 7.4 ? bark : leaf;
	ROUGHNESS = 0.95;
}"""
	mat.shader = sh
	return mat

static func bamboo_material() -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode cull_disabled;
varying float hy;
varying float tuft;
void vertex() {
	hy = VERTEX.y;
	tuft = length(VERTEX.xz) > 0.25 ? 1.0 : 0.0;
	// the clump sways from the ground up
	float sway = sin(TIME * 1.3 + NODE_POSITION_WORLD.x * 0.2) * 0.012 * hy * hy * 0.1;
	VERTEX.x += sway;
}
void fragment() {
	float node = smoothstep(0.04, 0.0, abs(fract(hy * 0.9) - 0.5) - 0.46);
	vec3 culm = mix(vec3(0.55, 0.62, 0.24), vec3(0.42, 0.48, 0.18), node);
	vec3 leaf = vec3(0.26, 0.48, 0.16);
	ALBEDO = tuft > 0.5 ? leaf : culm;
	ROUGHNESS = 0.7;
}"""
	mat.shader = sh
	return mat

static func alien_material(glow: bool) -> Material:
	if not glow:
		var stalk := StandardMaterial3D.new()
		stalk.albedo_color = Color(0.12, 0.07, 0.18)
		stalk.roughness = 0.35
		return stalk
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
void fragment() {
	float n = fract(sin(dot(floor(NODE_POSITION_WORLD.xz), vec2(12.9898, 78.233))) * 43758.5453);
	vec3 glow = n > 0.5 ? vec3(0.2, 1.0, 0.85) : vec3(1.0, 0.3, 0.85);
	float pulse = 0.7 + 0.3 * sin(TIME * 1.7 + n * 20.0);
	ALBEDO = glow * 0.45;
	EMISSION = glow * pulse * 2.2;
	ROUGHNESS = 0.3;
}"""
	mat.shader = sh
	return mat

# ---------------------------------------------------------------- rocks: arches, cave mouths, ice spires

## a natural arch: one swept band bent through a half circle and planted on two splayed legs. The cross-section is a
## rounded rectangle whose width and depth wander along the span (thick at the feet, thin at the crown), so it reads as
## eroded stone, not a pipe or a stack of blocks.
static func arch_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 9
	const N := 24      # steps along the band
	const C := 10      # points round the cross-section
	var rings: Array = []
	for k in N + 1:
		var t := float(k) / N
		# the centreline: legs come straight up from the ground into the half circle
		var a := PI * (1.0 - t)
		var p := Vector3(cos(a) * 7.0, -2.0 + sin(a) * 9.0, 0)
		var tang := Vector3(-sin(a) * 7.0, cos(a) * 9.0, 0).normalized() * -1.0
		var feet := pow(absf(cos(a)), 3.0)
		var thick := 2.0 + feet * 2.2 + rng.randf() * 0.5    # in the arch's plane
		var deep := 2.6 + feet * 2.0 + rng.randf() * 0.6     # across it
		var side := tang.cross(Vector3.BACK).normalized()
		var ring: Array = []
		for c in C:
			var u := TAU * c / C
			# a squared-off ellipse: stone eroded round, not cut square
			var cx := signf(cos(u)) * pow(absf(cos(u)), 0.6)
			var cz := signf(sin(u)) * pow(absf(sin(u)), 0.6)
			var wob := 0.9 + 0.2 * rng.randf()
			ring.append(p + side * cx * thick * wob + Vector3.BACK * cz * deep * wob)
		rings.append(ring)
	for k in N:
		for c in C:
			var a0: Vector3 = rings[k][c]
			var a1: Vector3 = rings[k][(c + 1) % C]
			var b0: Vector3 = rings[k + 1][c]
			var b1: Vector3 = rings[k + 1][(c + 1) % C]
			st.add_vertex(a0)
			st.add_vertex(a1)
			st.add_vertex(b0)
			st.add_vertex(a1)
			st.add_vertex(b1)
			st.add_vertex(b0)
	st.generate_normals()
	return st.commit()

static func rock_material(col: Color) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
uniform vec3 col = vec3(0.6, 0.4, 0.3);
varying vec3 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	float strata = 0.88 + 0.12 * sin(lp.y * 3.1 + sin(lp.x * 0.7) * 1.5);
	float g = fract(sin(dot(floor(lp * 2.0), vec3(12.9, 78.2, 37.7))) * 4375.5);
	ALBEDO = col * strata * (0.92 + 0.12 * g);
	ROUGHNESS = 0.95;
}"""
	mat.shader = sh
	mat.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	return mat

## the cave mouth: the same arch half buried in a slope, a black hollow behind it
static func cave_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 21
	for k in 10:
		var a := PI * float(k) / 9.0
		var bm := BoxMesh.new()
		bm.size = Vector3(3.0 + rng.randf(), 2.4, 6.0)
		st.append_from(bm, 0, Transform3D(Basis(Vector3.BACK, a + PI / 2.0), Vector3(cos(a) * 5.0, sin(a) * 5.0, 0)))
	var hood := SphereMesh.new()
	hood.radius = 7.5
	hood.height = 15.0
	hood.radial_segments = 8
	hood.rings = 4
	hood.is_hemisphere = true
	st.append_from(hood, 0, Transform3D(Basis().scaled(Vector3(1.1, 0.9, 1.2)), Vector3(0, -0.5, -4.5)))
	st.generate_normals()
	return st.commit()

static func hollow_mesh() -> Mesh:
	var d := SphereMesh.new()
	d.radius = 4.6
	d.height = 9.2
	d.radial_segments = 10
	d.rings = 5
	d.is_hemisphere = true
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.append_from(d, 0, Transform3D(Basis(Vector3.RIGHT, PI / 2.0).scaled(Vector3(1.0, 1.0, 0.4)), Vector3(0, 0, 0.6)))
	return st.commit()

## places arches (desert and coast), cave mouths (mountain slopes) and ice spires (the ice) on open ground
static func rocks(r: Node, clear: PackedByteArray) -> void:
	var id: String = r.map_id
	var arch_col := {"solara": Color(0.72, 0.46, 0.3), "wastelands": Color(0.62, 0.5, 0.38), "crystal-badlands": Color(0.6, 0.38, 0.36),
		"shattered-reefs": Color(0.6, 0.58, 0.52), "azure-isles": Color(0.55, 0.5, 0.42), "goldenreach": Color(0.6, 0.56, 0.48)}
	var cave_col := {"frostspire": Color(0.42, 0.44, 0.48), "ember": Color(0.2, 0.17, 0.16), "veridan": Color(0.4, 0.4, 0.37),
		"swamps": Color(0.32, 0.34, 0.3), "wastelands": Color(0.45, 0.4, 0.34)}
	var span: float = r._span
	var water: float = r._water
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(id)
	if arch_col.has(id):
		var xf: Array[Transform3D] = []
		var want := 10 if id in ["solara", "wastelands", "crystal-badlands"] else 5
		for i in 900:
			if xf.size() >= want:
				break
			var x := (rng.randf() - 0.5) * span * 0.9
			var z := (rng.randf() - 0.5) * span * 0.9
			var y: float = r._h(x, z)
			# the reef and isle arches stand in the shallows at the waterline, the desert ones on dry ground
			var coast := id in ["shattered-reefs", "azure-isles"]
			if coast and absf(y - water) > 1.5:
				continue
			if not coast and y < water + 1.0:
				continue
			if clear[r._cell(x, z)] == 1:
				continue
			var s := 1.6 + rng.randf() * 1.6
			if absf(r._h(x - 7.0 * s, z) - r._h(x + 7.0 * s, z)) > 3.0 * s:
				continue
			if not r._space_claim(x, z, 9.0 * s):
				continue
			xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * s), Vector3(x, minf(r._h(x - 6.0 * s, z), r._h(x + 6.0 * s, z)) + 0.5 * s, z)))
		if not xf.is_empty():
			r._multimesh(arch_mesh(), xf, rock_material(arch_col[id]), 1400.0)
	if cave_col.has(id):
		var xf2: Array[Transform3D] = []
		for i in 2000:
			if xf2.size() >= 8:
				break
			var x := (rng.randf() - 0.5) * span * 0.9
			var z := (rng.randf() - 0.5) * span * 0.9
			var y: float = r._h(x, z)
			if y < water + 2.0 or clear[r._cell(x, z)] == 1:
				continue
			# a slope: the cave faces downhill, its hood sunk into the rise behind it
			var gx: float = r._h(x + 4.0, z) - r._h(x - 4.0, z)
			var gz: float = r._h(x, z + 4.0) - r._h(x, z - 4.0)
			var g := Vector2(gx, gz) / 8.0
			if g.length() < 0.35 or g.length() > 1.4:
				continue
			if not r._space_claim(x, z, 9.0):
				continue
			var yaw := atan2(g.x, g.y)   # +z of the mesh points uphill (the hood is at -z, so flip)
			xf2.append(Transform3D(Basis(Vector3.UP, yaw + PI), Vector3(x, y - 0.6, z)))
		if not xf2.is_empty():
			r._multimesh(cave_mesh(), xf2, rock_material(cave_col[id]), 1400.0)
			var dark := StandardMaterial3D.new()
			dark.albedo_color = Color(0.015, 0.012, 0.012)
			dark.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			dark.cull_mode = BaseMaterial3D.CULL_DISABLED
			r._multimesh(hollow_mesh(), xf2, dark, 1400.0, false)
	if id in ["frostveil", "frostspire"]:
		var spires: Array[Transform3D] = []
		for i in 4000:
			if spires.size() >= 160:
				break
			var x := (rng.randf() - 0.5) * span * 0.92
			var z := (rng.randf() - 0.5) * span * 0.92
			var y: float = r._h(x, z)
			if y < water + 0.5 or clear[r._cell(x, z)] == 1:
				continue
			var s := 1.0 + rng.randf() * 3.5
			if not r._space_claim(x, z, 1.2 * s):
				continue
			# spires come in groups: a tall one leaning and two or three shorter ones round its foot
			spires.append(Transform3D(Basis.from_euler(Vector3((rng.randf() - 0.5) * 0.4, rng.randf() * TAU, (rng.randf() - 0.5) * 0.4)).scaled(Vector3(s, s * (2.4 + rng.randf() * 1.8), s)), Vector3(x, y - 0.4, z)))
			for k in 2 + rng.randi() % 2:
				var a := rng.randf() * TAU
				var s2 := s * (0.35 + rng.randf() * 0.35)
				var px := x + sin(a) * s * 1.1
				var pz := z + cos(a) * s * 1.1
				spires.append(Transform3D(Basis.from_euler(Vector3((rng.randf() - 0.5) * 0.9, rng.randf() * TAU, (rng.randf() - 0.5) * 0.9)).scaled(Vector3(s2, s2 * 2.2, s2)), Vector3(px, r._h(px, pz) - 0.3, pz)))
		if not spires.is_empty():
			var cm := CylinderMesh.new()
			cm.top_radius = 0.0
			cm.bottom_radius = 0.9
			cm.height = 2.0
			cm.radial_segments = 5
			cm.rings = 1
			var st := SurfaceTool.new()
			st.begin(Mesh.PRIMITIVE_TRIANGLES)
			st.append_from(cm, 0, Transform3D(Basis(), Vector3(0, 1.0, 0)))
			var ice := StandardMaterial3D.new()
			ice.albedo_color = Color(0.72, 0.88, 1.0, 0.82)
			ice.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			ice.roughness = 0.08
			ice.metallic_specular = 0.9
			ice.rim_enabled = true
			ice.rim = 0.6
			ice.emission_enabled = true
			ice.emission = Color(0.25, 0.55, 0.8)
			ice.emission_energy_multiplier = 0.25
			r._multimesh(st.commit(), spires, ice, 1200.0)

# ---------------------------------------------------------------- vines off the floating islands

## green strands hanging from under each island's rim, swaying in the vertex shader
static func vines(r: Node, sources: Array) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 515
	var xf: Array[Transform3D] = []
	for s in sources:
		var p: Vector2 = s[0]
		var rad: float = s[1]
		var top: float = s[2]
		for k in int(rad * 1.6):
			var a := rng.randf() * TAU
			var d := rad * (0.55 + rng.randf() * 0.35)
			var ln := 6.0 + rng.randf() * 16.0
			xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(1.0, ln, 1.0)), Vector3(p.x + sin(a) * d, top - 2.0 - rng.randf() * 3.0, p.y + cos(a) * d)))
	if xf.is_empty():
		return
	var q := QuadMesh.new()
	q.size = Vector2(0.9, 1.0)
	q.center_offset = Vector3(0, -0.5, 0)
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode cull_disabled;
varying float t;
void vertex() {
	t = -VERTEX.y;   // 0 at the root, 1 at the tip
	VERTEX.x += sin(TIME * 0.9 + NODE_POSITION_WORLD.x * 0.3 + t * 3.0) * 0.6 * t * t;
	VERTEX.x *= 1.0 - t * 0.6;
}
void fragment() {
	float leaf = step(0.35, fract(sin(floor(t * 40.0) * 91.7) * 437.5));
	ALBEDO = mix(vec3(0.12, 0.26, 0.1), vec3(0.24, 0.42, 0.16), leaf) * (1.0 - t * 0.35);
	ROUGHNESS = 0.9;
}"""
	mat.shader = sh
	r._multimesh(q, xf, mat, 900.0, false)

# ---------------------------------------------------------------- rift tears

## where the ground is torn (the rift cover), the world splits upward too: a tall jagged slit of violet light, turned to
## face the camera about its upright, flickering at its edges, with shards of dark ground floating round it
static func rift_tears(r: Node, at: Array[Vector3]) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 1313
	var xf: Array[Transform3D] = []
	var bits: Array[Transform3D] = []
	for p in at:
		var s := 0.7 + rng.randf() * 0.9
		xf.append(Transform3D(Basis().scaled(Vector3(s, s * (1.0 + rng.randf() * 0.6), s)), p + Vector3(0, -0.5, 0)))
		for k in 5:
			var a := rng.randf() * TAU
			bits.append(Transform3D(Basis.from_euler(Vector3(rng.randf() * 3.0, rng.randf() * 3.0, 0)).scaled(Vector3.ONE * (0.3 + rng.randf() * 0.7)),
				p + Vector3(sin(a) * (2.5 + rng.randf() * 3.0), 2.0 + rng.randf() * 9.0, cos(a) * (2.5 + rng.randf() * 3.0))))
	var q := QuadMesh.new()
	q.size = Vector2(5.0, 16.0)
	q.center_offset = Vector3(0, 8.0, 0)
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
float h(float x) { return fract(sin(x * 127.1) * 43758.5); }
float n1(float x) { float i = floor(x); float f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void vertex() {
	// face the camera about the upright (a cylindrical billboard), so the tear reads as a slit from every side
	vec3 to_cam = CAMERA_POSITION_WORLD - NODE_POSITION_WORLD;
	float yaw = atan(to_cam.x, to_cam.z);
	float sc = length(MODEL_MATRIX[0].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(vec4(cos(yaw) * sc, 0, -sin(yaw) * sc, 0), vec4(MODEL_MATRIX[1].xyz, 0), vec4(sin(yaw) * sc, 0, cos(yaw) * sc, 0), MODEL_MATRIX[3]);
}
void fragment() {
	float seed = NODE_POSITION_WORLD.x * 0.13 + NODE_POSITION_WORLD.z * 0.07;
	float y = UV.y;
	// the slit's centreline wanders and its width swells in the middle and pinches at the ends
	float cx = 0.5 + (n1(y * 7.0 + seed) - 0.5) * 0.35 + (n1(y * 23.0 + seed * 3.0) - 0.5) * 0.08;
	float wdt = 0.03 + 0.11 * sin(y * 3.14159) * (0.7 + 0.3 * n1(y * 11.0 + TIME * 2.0 + seed));
	float d = abs(UV.x - cx) / wdt;
	float core = smoothstep(1.0, 0.2, d);
	float halo = smoothstep(3.5, 0.6, d) * 0.35;
	float flick = 0.75 + 0.25 * n1(TIME * 9.0 + seed * 10.0);
	vec3 col = mix(vec3(0.45, 0.15, 1.0), vec3(0.95, 0.8, 1.0), core);
	ALBEDO = col * (core * 2.2 + halo) * flick;
}"""
	mat.shader = sh
	r._multimesh(q, xf, mat, 1600.0, false)
	var bm := BoxMesh.new()
	bm.size = Vector3(1.0, 0.7, 1.2)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.09, 0.07, 0.1)
	dark.emission_enabled = true
	dark.emission = Color(0.35, 0.12, 0.7)
	dark.emission_energy_multiplier = 0.3
	r._multimesh(bm, bits, dark, 900.0, false)

# ---------------------------------------------------------------- landmark VFX: portals, energy fields, holograms

const Fx := preload("res://scripts/vfx/fx.gd")
const PORTAL_POIS := ["z-tear", "cb-rifts", "vault-gate"]
const FIELD_POIS := ["sr-vault", "base-03", "base-02"]
const HOLO_CITIES := ["nexus", "neon-city", "thalassia"]
const HOLO_CATS := ["store", "mall", "university", "park", "entertainment", "casino", "nightclub", "arena", "landmark", "civic", "research"]

## the tears and gates get a standing portal, research stations and vaults an energy dome sized to the buildings under
## it, and the cities' landmarks a hologram on their tallest roof (globes over the plazas, figures over the shops)
static func landmark_fx(r: Node) -> void:
	var id: String = r.map_id
	var holos := 0
	var cols := [Color(0.3, 0.9, 1.0), Color(1.0, 0.35, 0.85), Color(1.0, 0.78, 0.3), Color(0.5, 1.0, 0.6)]
	for p in r.m.pois:
		var pid := String(p.id)
		var cat := String(p.get("cat", ""))
		var at: Vector2 = r._loc(p.x, p.z)
		var gy: float = r._h(at.x, at.y)
		if pid in PORTAL_POIS:
			# stood 12 m off the place, inside the clearing kept round every place (Street View starts on the place
			# itself), facing back at it
			var dir := Vector2(-at.x, -at.y).normalized() if at.length() > 1.0 else Vector2(1, 0)
			var pp := at + dir.rotated(0.6) * 12.0
			var po := Fx.portal(5.5, Color(0.75, 0.35, 1.0) if pid != "vault-gate" else Color(0.35, 0.85, 1.0))
			po.position = Vector3(pp.x, minf(r._h(pp.x, pp.y), r._h(pp.x + 5.0, pp.y)) - 0.3, pp.y)
			po.rotation.y = atan2(at.x - pp.x, at.y - pp.y)
			r._world.add_child(po)
		elif cat == "research" or pid in FIELD_POIS:
			# the dome covers the station's buildings: the farthest one within 70 m, plus a margin
			var reach := 22.0
			for bd in r.m.buildings:
				var b: Vector2 = r._loc(bd[0], bd[1])
				var d := b.distance_to(at)
				if d < 70.0:
					reach = maxf(reach, d + maxf(float(bd[2]), float(bd[3])) + 6.0)
			var f := Fx.energy_field(minf(reach, 80.0), Color(0.35, 0.75, 1.0) if cat == "research" else Color(1.0, 0.6, 0.25))
			f.position = Vector3(at.x, gy - 1.0, at.y)
			r._world.add_child(f)
		elif id in HOLO_CITIES and cat in HOLO_CATS and holos < 16:
			# on the tallest roof within 25 m, or standing in the open
			var top := gy
			for bd in r.m.buildings:
				var b2: Vector2 = r._loc(bd[0], bd[1])
				if b2.distance_to(at) < 25.0:
					top = maxf(top, r._h(b2.x, b2.y) + r._bh(bd))
			var kind := "globe" if cat in ["park", "landmark", "university", "civic", "research"] else ("figure" if cat in ["store", "mall"] else "emblem")
			var hg := Fx.hologram(kind, cols[holos % cols.size()], 20.0)
			hg.position = Vector3(at.x, top + 0.2, at.y)
			r._world.add_child(hg)
			holos += 1
