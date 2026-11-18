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
# ---------------------------------------------------------------------------------------------- the Meshy trees
## a Meshy tree GLB as one mesh standing `height` m on y = 0, centred, its own materials kept (models/foliage, the
## Nov 15 upgrade); `materials_from` lends its surface materials to a texture-less LOD file
static var _glb_cache: Dictionary = {}

static func glb_mesh(path: String, height: float, materials_from: Mesh = null) -> Mesh:
	var key := path + ":" + str(height)
	if _glb_cache.has(key):
		return _glb_cache[key]
	if not ResourceLoader.exists(path):
		return null
	var scene := (load(path) as PackedScene).instantiate()
	var mi: MeshInstance3D = null
	for ch in scene.find_children("*", "MeshInstance3D", true, false):
		mi = ch
		break
	if mi == null:
		scene.free()
		return null
	var src: Mesh = mi.mesh
	var aabb := src.get_aabb()
	var xf := mi.transform
	var par := mi.get_parent()
	while par and par != scene:
		xf = (par as Node3D).transform * xf
		par = par.get_parent()
	aabb = xf * aabb
	var k := height / maxf(aabb.size.y, 0.001)
	var fit := Transform3D(Basis().scaled(Vector3.ONE * k), Vector3(-(aabb.position.x + aabb.size.x * 0.5) * k, -aabb.position.y * k, -(aabb.position.z + aabb.size.z * 0.5) * k)) * xf
	var out := ArrayMesh.new()
	for i in src.get_surface_count():
		var st := SurfaceTool.new()
		st.append_from(src, i, fit)
		var m: Material = src.surface_get_material(i)
		if materials_from and i < materials_from.get_surface_count():
			m = materials_from.surface_get_material(i)   # a LOD file carries no textures of its own
		if mi.get_surface_override_material(i):
			m = mi.get_surface_override_material(i)
		st.set_material(m)
		st.commit(out)
	scene.free()
	_glb_cache[key] = out
	return out

## a forest tree at two levels for region_3d `_multimesh_lod` (owner, Nov 16 "forestation"): the full Meshy tree
## (models/foliage/<kind>.glb, ~10k triangles) within Phone.tree_detail_range(), then its leaf-card impostor
## (<kind>-cards.glb from tools/tree_cards.py: three crossed quads and a crown top, 8 triangles, the tree's own
## rendered silhouette) out to the draw distance. Empty when either file is missing (the procedural tree then).
## The pine's 1k / 340-triangle remeshes were tried first and read as grey shards; cards keep the tree's look.
static func tree_lods(kind: String, height: float) -> Array:
	var full := glb_mesh("res://models/foliage/%s.glb" % kind, height)
	var cards := glb_mesh("res://models/foliage/%s-cards.glb" % kind, height)
	if full == null or cards == null:
		return []
	_matte_cards(cards)
	return [[full, Phone.tree_detail_range()], [cards, 900.0]]

const Phone := preload("res://scripts/phone.gd")

## the leaf cards seen from above read as grey-white frost over the Verdant Forest (their crown quad faces the sun and
## took a full specular sheen): matte, no specular, and a touch deeper green so the far forest matches the near trees
## (Verdant pass, Nov 18). Done once per cached mesh.
static func _matte_cards(mesh: Mesh) -> void:
	if mesh.has_meta("matte"):
		return
	mesh.set_meta("matte", true)
	for i in mesh.get_surface_count():
		var m := mesh.surface_get_material(i) as BaseMaterial3D
		if m == null:
			continue
		var d := m.duplicate() as BaseMaterial3D
		d.roughness = 1.0
		d.metallic = 0.0
		d.metallic_specular = 0.0
		d.albedo_color = d.albedo_color * Color(0.8, 0.9, 0.74)
		mesh.surface_set_material(i, d)

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
				var lods := tree_lods("broadleaf", 10.0)
				if lods.is_empty():
					r._multimesh(broadleaf(), list, r._tree_material(false))
				else:
					r._multimesh_lod(lods, list, null)
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

## corrupted vegetation (asset catalog, fantasy & dimensional): in the Shattered Expanse every fourth tree, and
## anywhere a tree stands within 45 m of a rift tear, the forest has turned — a blackened, twisted trunk, bare
## branches, violet crystal growths breaking out of the bark and a glow in the splits. Returns the trees left green.
const CORRUPT_M := 45.0
static func corrupted(r: Node, trees: Array[Transform3D], tears: Array[Vector3]) -> Array[Transform3D]:
	var id: String = r.map_id
	var expanse := id in ["crystal-badlands", "shattered-reefs"]
	if not expanse and tears.is_empty():
		return trees
	var green: Array[Transform3D] = []
	var turned: Array[Transform3D] = []
	var k := 0
	for t in trees:
		k += 1
		var near := false
		if not expanse or k % 4 != 0:
			for p in tears:
				if Vector2(p.x - t.origin.x, p.z - t.origin.z).length() < CORRUPT_M:
					near = true
					break
		if (expanse and k % 4 == 0) or near:
			turned.append(t)
		else:
			green.append(t)
	if expanse:
		# the badlands grow no forest: the fracture itself raises these — a ring round every rift tear, and a
		# scattering over the crystal fields
		var rng := RandomNumberGenerator.new()
		rng.seed = hash(id + ":corrupt")
		var drop := func(x: float, z: float) -> void:
			var y: float = r._h(x, z)
			if y < r._water + 0.5 or not r._space_claim(x, z, 1.3):
				return
			var sc := 0.7 + rng.randf() * 0.6
			turned.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * (0.8 + rng.randf() * 0.5), sc)), Vector3(x, y - 0.2, z)))
		for p in tears:
			for n in 5:
				var a := rng.randf() * TAU
				var d := 7.0 + rng.randf() * 14.0
				drop.call(p.x + cos(a) * d, p.z + sin(a) * d)
		var img: Image = Data.image("maps/%s.data.pngb" % id)
		if img != null:
			img = img.duplicate()
			img.convert(Image.FORMAT_RGB8)
			var w := img.get_width()
			var bytes := img.get_data()
			var crystal: int = Data.styles.get("covers", []).find("crystal")
			var span: float = r._span
			var mpp := span / w
			var stride := maxi(2, int(w / 200.0))
			var clear: PackedByteArray = r._clearings()
			for j in range(0, w, stride):
				for i in range(0, w, stride):
					if turned.size() >= 420:
						break
					if bytes[(j * w + i) * 3] != crystal or rng.randf() > 0.028:
						continue
					var x := -span / 2.0 + (i + rng.randf() * stride) * mpp
					var z := -span / 2.0 + (j + rng.randf() * stride) * mpp
					if clear[r._cell(x, z)] == 1:
						continue
					drop.call(x, z)
	r.corrupt_spots.clear()
	for t in turned:
		r.corrupt_spots.append(t.origin)
	if turned.is_empty():
		return green
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.09, 0.07, 0.1)
	bark.roughness = 0.95
	var vein := StandardMaterial3D.new()
	vein.albedo_color = Color(0.5, 0.2, 0.9)
	vein.emission_enabled = true
	vein.emission = Color(0.55, 0.25, 1.0)
	vein.emission_energy_multiplier = 1.6
	var parts := corrupted_meshes()
	r._multimesh(parts[0], turned, bark, 700.0)
	r._multimesh(parts[1], turned, vein, 700.0, false)
	return green

## [the dead trunk and branches, the crystal growths] at the conifer's scale (13 m tall at scale 1)
static func corrupted_meshes() -> Array:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# the trunk: three leaning lengths, each twisted on from the last
	var top := Vector3(0, 0, 0)
	var lean := Basis()
	for i in 3:
		var h := 3.6 - i * 0.5
		lean = lean * Basis(Vector3(1, 0, 0.6).normalized(), 0.16 + 0.05 * i) * Basis(Vector3.UP, 0.9)
		var mid := top + lean * Vector3(0, h * 0.5, 0)
		_cyl(st, 0.26 - i * 0.07, 0.42 - i * 0.08, h, 6, Transform3D(lean, mid))
		top = top + lean * Vector3(0, h, 0)
	# bare branches reaching out and up, snapped short
	for b in [[2.4, 0.0, 1.0, 2.2], [4.2, 2.1, -0.8, 2.6], [5.8, 4.4, 0.9, 1.9], [7.4, 1.0, 0.6, 2.4], [8.6, 3.3, -0.3, 1.7]]:
		var a: float = b[1]
		var dir := Vector3(cos(a), float(b[2]), sin(a)).normalized()
		var basis := Basis.looking_at(dir, Vector3.UP) * Basis(Vector3.RIGHT, PI * 0.5)
		_cyl(st, 0.03, 0.11, float(b[3]), 4, Transform3D(basis, Vector3(0, float(b[0]), 0) + dir * float(b[3]) * 0.5))
	st.generate_normals()
	var trunk := st.commit()
	var cs := SurfaceTool.new()
	cs.begin(Mesh.PRIMITIVE_TRIANGLES)
	# crystal growths: slim cones bursting out of the bark at three heights
	for c in [[1.6, 0.4, 1.1], [3.9, 2.6, 1.5], [6.1, 4.9, 0.9], [2.8, 3.9, 0.7]]:
		var a: float = c[1]
		var dir := Vector3(cos(a), 0.55, sin(a)).normalized()
		var basis := Basis.looking_at(dir, Vector3.UP) * Basis(Vector3.RIGHT, PI * 0.5)
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.16 * float(c[2])
		cone.height = 1.2 * float(c[2])
		cone.radial_segments = 5
		cone.rings = 0
		cs.append_from(cone, 0, Transform3D(basis, Vector3(0, float(c[0]), 0) + dir * (0.3 + 0.5 * float(c[2]))))
	cs.generate_normals()
	return [trunk, cs.commit()]

## root flares at the forest's trunks (asset catalog "tree roots"): every third tree above the water gets a collar
## of five buttress roots running out over the ground from its base, drawn to ROOT_M (the trunks past that are cards)
const ROOT_M := 60.0
const ROOT_CAP := 2400
static func roots(r: Node, trees: Array[Transform3D]) -> void:
	var water: float = r._water
	var xf: Array[Transform3D] = []
	for i in range(0, trees.size(), 3):
		if xf.size() >= ROOT_CAP:
			break
		var t := trees[i]
		if t.origin.y < water + 0.3:
			continue
		var s := t.basis.x.length()
		# the trunk sits 0.2 m under the ground (region_3d plants it so); the flare rides at the surface
		xf.append(Transform3D(Basis(Vector3.UP, atan2(t.basis.x.z, t.basis.x.x)).scaled(Vector3.ONE * s), t.origin + Vector3(0, 0.2, 0)))
	if xf.is_empty():
		return
	r.root_spots.clear()
	for t in xf:
		r.root_spots.append(t.origin)   # where the roots are (the look-dev hook eye:root, tests)
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.3, 0.23, 0.16)
	bark.roughness = 1.0
	r._multimesh(root_mesh(), xf, bark, ROOT_M, false)

static func root_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_cyl(st, 0.42, 0.62, 0.5, 7, Transform3D(Basis(), Vector3(0, 0.2, 0)))   # the collar round the trunk's foot
	for k in 5:
		var a := TAU * float(k) / 5.0 + 0.4
		var len := 1.5 + 0.5 * float(k % 2)
		# a tapered root lying out from the collar, nosing down into the ground at its tip
		var dir := Vector3(cos(a), -0.22, sin(a)).normalized()
		var mid := Vector3(cos(a), 0, sin(a)) * (0.45 + len * 0.5) + Vector3(0, 0.22 - len * 0.1, 0)
		var basis := Basis.looking_at(dir, Vector3.UP) * Basis(Vector3.RIGHT, PI * 0.5)   # the cylinder's y along dir
		_cyl(st, 0.07, 0.2, len, 5, Transform3D(basis, mid))
	st.generate_normals()
	return st.commit()

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
	if id in ["azure-isles", "shattered-reefs", "thalassia", "goldenreach"]:
		# underwater caves (asset catalog): cave mouths in the drop-offs below the shallows, facing up the slope
		# toward the shore, their hoods sunk into the deep side; reef-coloured, drawn through the water
		var sea: Array[Transform3D] = []
		for i in 3000:
			if sea.size() >= 6:
				break
			var x := (rng.randf() - 0.5) * span * 0.9
			var z := (rng.randf() - 0.5) * span * 0.9
			var y: float = r._h(x, z)
			if y > water - 2.5 or y < water - 30.0:
				continue
			var gx: float = r._h(x + 4.0, z) - r._h(x - 4.0, z)
			var gz: float = r._h(x, z + 4.0) - r._h(x, z - 4.0)
			var g := Vector2(gx, gz) / 8.0
			if g.length() < 0.18 or g.length() > 2.0:
				continue
			if not r._space_claim(x, z, 9.0):
				continue
			var yaw := atan2(g.x, g.y)
			sea.append(Transform3D(Basis(Vector3.UP, yaw + PI), Vector3(x, y - 0.6, z)))
		for t in sea:
			r.sea_caves.append(t.origin)
		if not sea.is_empty():
			r._multimesh(cave_mesh(), sea, rock_material(Color(0.36, 0.42, 0.4)), 900.0)
			var deep := StandardMaterial3D.new()
			deep.albedo_color = Color(0.01, 0.02, 0.03)
			deep.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			deep.cull_mode = BaseMaterial3D.CULL_DISABLED
			r._multimesh(hollow_mesh(), sea, deep, 900.0, false)
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
		elif (cat == "research" or pid in FIELD_POIS) and not id in HOLO_CITIES:
			# (never in a city: Neon City's base-02 is a garage, and an 80 m dome over its middle hid the downtown)
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
		elif id in HOLO_CITIES and id != "thalassia" and cat in HOLO_CATS and holos < 16:
			# (not under Thalassia's dome: its districts carry their own lights, and the globes on their beams read as
			# white orbs over the pale deck — Nov 18 region pass)
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

## The fantasy & dimensional set (asset catalog part 2 §9, scripts/vfx/fracture_set.gd) placed in the Shattered
## Expanse regions (TASKBOARD §8, "still to place in the Shattered Expanse regions"): each place gets the pieces its
## board blurb describes — crystal fields round the Prism, the Spire and Refraction Valley, the Shattered Fields'
## burst of shards with ruins drifting over them, the Void Rifts' hanging slabs, Echo Ruins' ring of broken columns
## with its conduits, the Ancient Vault's relic case, the Fracture trench's drift of slabs and the Sunken Spire's
## crystals at the waterline. Budget: one MultiMesh per crystal field, a handful of drifting nodes; nothing on the
## other regions.
const FractureSet := preload("res://scripts/vfx/fracture_set.gd")
const VIOLET := Color(0.72, 0.4, 1.0)
const CYAN := Color(0.35, 0.9, 1.0)
const AMBER := Color(1.0, 0.75, 0.35)

static func fracture_set(r: Node) -> void:
	var id: String = r.map_id
	if id not in ["crystal-badlands", "shattered-reefs"]:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(id + ":fracture-set")
	var world: Node3D = r._world
	var ground := func(x: float, z: float) -> float: return maxf(r._h(x, z), r._water)
	var n := Phone.crowd()
	for p in r.m.pois:
		var pid := String(p.id)
		var at: Vector2 = r._loc(p.x, p.z)
		var c := Vector3(at.x, ground.call(at.x, at.y), at.y)
		match pid:
			"cb-prism":
				# the colossal crystal itself, then the field that catches its light
				var big := MeshInstance3D.new()
				big.mesh = FractureSet.prism_mesh(3.2, 26.0)
				big.position = c + Vector3(0, -1.0, 0)
				big.rotation = Vector3(0.06, rng.randf() * TAU, -0.04)
				# dark glass with a low glow: at full emission a 26 m prism read as a flat pink block
				var m := FractureSet._mat(VIOLET.darkened(0.72), 0.08, 0.3)
				m.emission_enabled = true
				m.emission = VIOLET
				m.emission_energy_multiplier = 0.28
				big.material_override = m
				world.add_child(big)
				FractureSet.crystals(world, c, 30.0, int(26 * n) + 8, VIOLET, rng, ground)
			"cb-spire":
				FractureSet.crystals(world, c, 36.0, int(22 * n) + 6, CYAN, rng, ground)
			"cb-valley":
				FractureSet.crystals(world, c, 60.0, int(40 * n) + 10, CYAN, rng, ground)
				FractureSet.crystals(world, c + Vector3(70.0, 0, -40.0), 40.0, int(20 * n) + 6, VIOLET, rng, ground)
			"cb-fields":
				FractureSet.crystals(world, c, 55.0, int(44 * n) + 12, VIOLET, rng, ground)
				FractureSet.floating_ruins(world, c + Vector3(0, 14.0, 0), 40.0, int(8 * n) + 3, rng)
			"cb-rifts":
				FractureSet.floating_ruins(world, c + Vector3(0, 10.0, 0), 30.0, int(9 * n) + 4, rng, Color(0.16, 0.13, 0.2))
				FractureSet.crystals(world, c, 24.0, int(10 * n) + 4, Color(0.5, 0.25, 0.9), rng, ground)
			"cb-mines":
				FractureSet.crystals(world, c, 20.0, int(10 * n) + 4, AMBER, rng, ground)
			"sr-ruins":
				# the ring of broken columns from before the Fracture, its conduits still humming
				FractureSet.arena_ring(world, c, 18.0, CYAN, rng, ground, 10)
			"sr-vault":
				var rc := FractureSet.relic_container(world, c + Vector3(10.0, 0, 6.0), AMBER)
				rc.position.y = ground.call(rc.position.x, rc.position.z)
				FractureSet.crystals(world, c, 22.0, int(8 * n) + 3, AMBER, rng, ground)
			"sr-fracture":
				FractureSet.floating_ruins(world, c + Vector3(0, 8.0, 0), 34.0, int(9 * n) + 4, rng, Color(0.14, 0.18, 0.22))
				FractureSet.conduit(world, c + Vector3(-22.0, 4.0, -8.0), c + Vector3(20.0, 7.0, 10.0), CYAN, 0.25)
			"sr-spire":
				FractureSet.crystals(world, c, 26.0, int(14 * n) + 5, CYAN, rng, ground)
			"sr-deep":
				FractureSet.crystals(world, c, 30.0, int(8 * n) + 3, Color(0.3, 0.5, 1.0), rng, ground)

# ---------------------------------------------------------------- the natural floor (asset catalog "Natural environments")
## Ground dressing under the trees and along the water, scattered where the land cover says, like the trees: fallen
## logs, mushroom clusters and moss patches in the forests, wildflowers in the meadows and grass, reeds on the
## marsh and the water's edge, coral in the coast maps' shallows, glacier blocks on the ice. One MultiMesh a kind,
## drawn within FLOOR_M (the glaciers to the horizon), capped by FLOOR_CAP a kind. Procedural meshes, a few hundred
## triangles each; the wildflowers and reeds are crossed cards.
const FLOOR_M := 260.0
const FLOOR_CAP := 700

static func log_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var lie := Basis(Vector3.BACK, PI * 0.5)   # along x
	_cyl(st, 0.3, 0.42, 5.5, 8, Transform3D(lie, Vector3(0, 0.34, 0)))
	_cyl(st, 0.1, 0.2, 1.8, 5, Transform3D(Basis(Vector3.BACK, 0.4) * Basis(Vector3.RIGHT, 0.5), Vector3(1.6, 0.9, 0.3)))
	_blob(st, 0.5, Transform3D(Basis().scaled(Vector3(0.6, 0.5, 1.0)), Vector3(-2.75, 0.3, 0)), 5)
	st.generate_normals()
	return st.commit()

static func mushroom_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for m in [[0.0, 0.0, 0.34, 0.22], [0.28, 0.1, 0.22, 0.15], [-0.22, 0.18, 0.18, 0.12], [0.1, -0.26, 0.26, 0.17]]:
		var p := Vector3(m[0], 0, m[1])
		var h: float = m[2]
		var cap: float = m[3]
		_cyl(st, 0.05, 0.07, h, 5, Transform3D(Basis(), p + Vector3(0, h * 0.5, 0)))
		_blob(st, cap, Transform3D(Basis().scaled(Vector3(1.0, 0.45, 1.0)), p + Vector3(0, h, 0)), 6)
	st.generate_normals()
	return st.commit()

static func moss_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for b in [[0.0, 0.0, 1.6], [1.1, 0.5, 1.0], [-0.9, -0.6, 1.2]]:
		_blob(st, b[2], Transform3D(Basis().scaled(Vector3(1.0, 0.08, 0.8)), Vector3(b[0], 0.02, b[1])), 7)
	st.generate_normals()
	return st.commit()

static func glacier_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for b in [[0.0, 0.0, 9.0, 1.0, 5.0], [6.0, 2.0, 6.0, 0.7, 4.0], [-5.0, -3.0, 7.0, 0.85, 3.5]]:
		_blob(st, b[2], Transform3D(Basis(Vector3.UP, b[4] * 0.3).scaled(Vector3(1.0, b[3] * 0.55, 0.75)), Vector3(b[0], b[2] * 0.2, b[1])), 5)
	st.generate_normals()
	return st.commit()

static func coral_mesh() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 31
	for k in 7:
		var a := k * TAU / 7.0
		var d := 0.3 + rng.randf() * 0.5
		var h := 0.6 + rng.randf() * 0.9
		var lean := Basis(Vector3(cos(a), 0, -sin(a)), 0.25 + rng.randf() * 0.3)
		var base := Vector3(sin(a) * d, 0, cos(a) * d)
		_cyl(st, 0.05, 0.12, h, 5, Transform3D(lean, base + lean * Vector3(0, h * 0.5, 0)))
		_blob(st, 0.16 + rng.randf() * 0.1, Transform3D(Basis(), base + lean * Vector3(0, h, 0)), 5)
	_blob(st, 0.7, Transform3D(Basis().scaled(Vector3(1.0, 0.35, 1.0)), Vector3(0, 0.1, 0)), 6)
	st.generate_normals()
	return st.commit()

## crossed cards for the flowers and the reeds (UV over the card; the materials colour them)
static func cards_mesh(w: float, h: float, n: int) -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in n:
		var b := Basis(Vector3.UP, k * PI / n)
		var r := b * Vector3(w * 0.5, 0, 0)
		var pts := [Vector3(-r.x, 0, -r.z), Vector3(r.x, 0, r.z), Vector3(r.x, h, r.z), Vector3(-r.x, h, -r.z)]
		for tri in [[0, 1, 2], [0, 2, 3]]:
			for i in tri:
				st.set_normal(Vector3.UP)
				st.set_uv(Vector2(1.0 if i in [1, 2] else 0.0, 0.0 if i in [2, 3] else 1.0))
				st.add_vertex(pts[i])
	return st.commit()

static func floor(r: Node, clear: PackedByteArray) -> void:
	var id: String = r.map_id
	var img: Image = Data.image("maps/%s.data.pngb" % id)
	if img == null:
		return
	img = img.duplicate()
	img.convert(Image.FORMAT_RGB8)
	var w := img.get_width()
	var bytes := img.get_data()
	var covers: Array = Data.styles.get("covers", [])
	var ci := func(name: String) -> int: return covers.find(name)
	var forest := [ci.call("forest"), ci.call("denseForest")]
	var meadow := [ci.call("meadow"), ci.call("grass")]
	var marsh := [ci.call("marsh")]
	var ice := [ci.call("ice"), ci.call("snow")]
	var coast := id in ["azure-isles", "shattered-reefs", "thalassia", "goldenreach"]
	var wild := forest + meadow + marsh + [ci.call("scrub"), ci.call("beach"), ci.call("dirt")]   # reeds never on a city's paving
	var span: float = r._span
	var water: float = r._water
	var mpp := span / w
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(id + ":floor")
	var logs: Array[Transform3D] = []
	var shrooms: Array[Transform3D] = []
	var moss: Array[Transform3D] = []
	var flowers: Array[Transform3D] = []
	var reeds: Array[Transform3D] = []
	var corals: Array[Transform3D] = []
	var glaciers: Array[Transform3D] = []
	var stride := maxi(2, int(w / 220.0))
	for j in range(0, w, stride):
		for i in range(0, w, stride):
			var cv := bytes[(j * w + i) * 3]
			var roll := rng.randf()
			var x := -span / 2.0 + (i + rng.randf() * stride) * mpp
			var z := -span / 2.0 + (j + rng.randf() * stride) * mpp
			if clear[r._cell(x, z)] == 1:
				continue
			var y: float = r._h(x, z)
			var yaw := Basis(Vector3.UP, rng.randf() * TAU)
			if cv in forest and y > water + 0.5:
				if roll < 0.035 and logs.size() < FLOOR_CAP:
					logs.append(Transform3D(yaw.scaled(Vector3.ONE * (0.7 + rng.randf() * 0.6)), Vector3(x, y, z)))
				elif roll < 0.09 and shrooms.size() < FLOOR_CAP:
					shrooms.append(Transform3D(yaw.scaled(Vector3.ONE * (0.35 + rng.randf() * 0.45)), Vector3(x, y, z)))
				elif roll < 0.16 and moss.size() < FLOOR_CAP:
					moss.append(Transform3D(yaw.scaled(Vector3.ONE * (0.8 + rng.randf() * 0.8)), Vector3(x, y, z)))
			elif cv in meadow and y > water + 0.5:
				if roll < 0.12 and flowers.size() < FLOOR_CAP:
					flowers.append(Transform3D(yaw.scaled(Vector3.ONE * (0.7 + rng.randf() * 0.6)), Vector3(x, y, z)))
			elif cv in wild and (cv in marsh or absf(y - water) < 0.9) and y > water - 0.4 and not coast:
				if roll < 0.3 and reeds.size() < FLOOR_CAP:
					reeds.append(Transform3D(yaw.scaled(Vector3.ONE * (0.8 + rng.randf() * 0.6)), Vector3(x, maxf(y, water - 0.2), z)))
			elif coast and y < water - 0.4 and y > water - 3.5:
				if roll < 0.25 and corals.size() < FLOOR_CAP:
					corals.append(Transform3D(yaw.scaled(Vector3.ONE * (0.8 + rng.randf() * 1.2)), Vector3(x, y, z)))
			if cv in ice and y > water + 0.5 and roll < 0.004 and glaciers.size() < 60 and r._space_claim(x, z, 12.0):
				glaciers.append(Transform3D(yaw.scaled(Vector3.ONE * (0.8 + rng.randf() * 1.0)), Vector3(x, y - 1.0, z)))
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.3, 0.22, 0.15)
	bark.roughness = 1.0
	var cap := StandardMaterial3D.new()
	cap.albedo_color = Color(0.55, 0.4, 0.28)
	cap.roughness = 0.8
	var green := StandardMaterial3D.new()
	green.albedo_color = Color(0.22, 0.34, 0.15)
	green.roughness = 1.0
	var bloom := StandardMaterial3D.new()
	bloom.albedo_color = Color(0.95, 0.6, 0.75)
	bloom.cull_mode = BaseMaterial3D.CULL_DISABLED
	bloom.vertex_color_use_as_albedo = false
	bloom.albedo_texture = _petal_tex()
	bloom.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	bloom.alpha_scissor_threshold = 0.5
	var reed := StandardMaterial3D.new()
	reed.albedo_color = Color(0.45, 0.5, 0.25)
	reed.cull_mode = BaseMaterial3D.CULL_DISABLED
	reed.albedo_texture = _reed_tex()
	reed.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	reed.alpha_scissor_threshold = 0.5
	var coral := StandardMaterial3D.new()
	coral.albedo_color = Color(0.95, 0.45, 0.4)
	coral.roughness = 0.7
	var icemat := StandardMaterial3D.new()
	icemat.albedo_color = Color(0.8, 0.9, 1.0)
	icemat.roughness = 0.25
	icemat.metallic_specular = 0.9
	if not logs.is_empty():
		r._multimesh(log_mesh(), logs, bark, FLOOR_M)
	if not shrooms.is_empty():
		r._multimesh(mushroom_mesh(), shrooms, cap, FLOOR_M * 0.5, false)
	if not moss.is_empty():
		r._multimesh(moss_mesh(), moss, green, FLOOR_M * 0.6, false)
	if not flowers.is_empty():
		r._multimesh(cards_mesh(0.9, 0.5, 3), flowers, bloom, FLOOR_M * 0.5, false)
	if not reeds.is_empty():
		r._multimesh(cards_mesh(1.3, 1.9, 3), reeds, reed, FLOOR_M, false)
	if not corals.is_empty():
		r._multimesh(coral_mesh(), corals, coral, FLOOR_M * 0.7, false)
	if not glaciers.is_empty():
		r._multimesh(glacier_mesh(), glaciers, icemat, 2400.0)

static var _petal: ImageTexture
static var _reeds: ImageTexture
## a card of scattered petals over stems (alpha cut), drawn once
static func _petal_tex() -> Texture2D:
	if _petal:
		return _petal
	var im := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	im.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	for k in 14:
		var cx := rng.randi_range(6, 57)
		var cy := rng.randi_range(4, 30)
		var col: Color = [Color(1.0, 0.85, 0.3), Color(0.95, 0.5, 0.7), Color(0.9, 0.95, 1.0), Color(0.6, 0.5, 1.0)][k % 4]
		for dy in range(-3, 4):
			for dx in range(-3, 4):
				if dx * dx + dy * dy <= 9:
					im.set_pixel(clampi(cx + dx, 0, 63), clampi(cy + dy, 0, 63), col)
		for yy in range(cy + 3, 64):
			im.set_pixel(cx, yy, Color(0.3, 0.5, 0.2))
	_petal = ImageTexture.create_from_image(im)
	return _petal

## tall thin stems with a seed head, alpha cut
static func _reed_tex() -> Texture2D:
	if _reeds:
		return _reeds
	var im := Image.create(64, 128, false, Image.FORMAT_RGBA8)
	im.fill(Color(0, 0, 0, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = 6
	for k in 9:
		var x := rng.randi_range(4, 59)
		var top := rng.randi_range(4, 40)
		var lean := rng.randf_range(-0.12, 0.12)
		for yy in range(top, 128):
			var xx := clampi(int(x + (yy - 128) * lean), 0, 63)
			im.set_pixel(xx, yy, Color(0.5, 0.55, 0.3).darkened(float(yy) / 400.0))
			if yy < top + 14:
				im.set_pixel(clampi(xx + 1, 0, 63), yy, Color(0.55, 0.4, 0.25))
	_reeds = ImageTexture.create_from_image(im)
	return _reeds
