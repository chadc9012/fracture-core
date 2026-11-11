extends Node3D
## An operator built from a look (character_store.gd): the frame's body for the chosen type, the cut head skinned onto the body's
## skeleton (sculpted, retinted, marked and bearded by its generated skin shader), the hairstyle and gear riding the Head bone,
## and the body's idle playing. Rebuild by calling build() again.

const Catalog := preload("res://scripts/character/catalog.gd")
const FaceMorphs := preload("res://scripts/character/face_morphs.gd")
const SkinShader := preload("res://scripts/character/skin_shader.gd")
const Outfits := preload("res://scripts/character/outfits.gd")
const HairBuilder := preload("res://scripts/character/hair_builder.gd")
const StandIdle := preload("res://scripts/character/stand_idle.gd")

var look: Dictionary = {}
var body_root: Node3D
var skeleton: Skeleton3D
var head_mesh: MeshInstance3D
var hair_mesh: MeshInstance3D
var _body_meshes: Array = []
var anim: AnimationPlayer
## where the head sits on this body (body skeleton space), for framing a camera
var head_point := Vector3(0, 1.6, 0)
var _head_bone := -1

## the head bone's world position as it animates (for a camera that follows the face)
func head_world() -> Vector3:
	if skeleton and _head_bone >= 0:
		return skeleton.global_transform * skeleton.get_bone_global_pose(_head_bone).origin
	return global_transform * head_point

static func _find(n: Node, cls: String) -> Node:
	if n.is_class(cls):
		return n
	for c in n.get_children():
		var f := _find(c, cls)
		if f:
			return f
	return null

static func _bone(sk: Skeleton3D, suffix: String) -> int:
	for i in sk.get_bone_count():
		var nm := sk.get_bone_name(i)
		if nm.ends_with(suffix) and not (suffix == "Head" and nm.contains("HeadTop")):
			return i
	return -1

func build(new_look: Dictionary, animate := true) -> void:
	look = new_look
	for c in get_children():
		c.free()
	var ps: PackedScene = load(Catalog.body_path(look.frame, look.body, bool(look.get("civ", false))))
	body_root = ps.instantiate()
	add_child(body_root)
	skeleton = _find(body_root, "Skeleton3D")
	anim = _find(body_root, "AnimationPlayer")
	_body_meshes = body_root.find_children("*", "MeshInstance3D", true, false)   # the body itself, before the head and hair join
	if not bool(look.get("civ", false)):
		for mi: MeshInstance3D in _body_meshes:
			for si in mi.mesh.get_surface_count():
				mi.set_surface_override_material(si, _two_sided(mi.get_active_material(si)))
	if anim and skeleton and anim.has_animation("idle"):
		StandIdle.install(anim, skeleton)
	if anim and animate and anim.has_animation("idle"):
		anim.get_animation("idle").loop_mode = Animation.LOOP_LINEAR
		anim.play("idle")
	if not skeleton:
		return
	var hb := _bone(skeleton, "Head")
	_head_bone = hb
	if hb >= 0:
		head_point = skeleton.get_bone_global_rest(hb).origin
	_attach_head(hb)
	if bool(look.get("civ", false)) and String(look.get("body", "")) != "robot":
		dress(String(look.get("outfit", "")))

## puts the civ body in an outfit (scripts/character/outfits.gd); the bare hands take the skin tone
func dress(outfit_id: String) -> void:
	if outfit_id == "":
		outfit_id = Outfits.default_for(String(look.get("body", "male")))
	var mat: ShaderMaterial = Outfits.material(outfit_id, _scalp_tone().srgb_to_linear())
	var lm: Dictionary = Outfits.landmarks("civ-%s-%s" % [look.frame, look.body])
	for k: String in lm:
		mat.set_shader_parameter("floor_h" if k == "floor" else k, float(lm[k]))
	var wears: Array = Outfits.pieces_of(outfit_id)
	for mi in _body_meshes:
		if not is_instance_valid(mi):
			continue
		var n := String((mi as Node).name)
		if n.begins_with("Piece_"):
			var kind := n.substr(6)
			(mi as MeshInstance3D).visible = kind in wears
			if kind in wears:
				(mi as MeshInstance3D).material_override = Outfits.piece_material(mat, kind)
		else:
			(mi as MeshInstance3D).material_override = mat

## a head cut from one frame can carry binds to bones another frame's skeleton lacks (the Warlock frame's coat bones,
## Bone_0xx): those verts would stay frozen at rest while the body moves, and the engine logs an error per bind. Each
## missing bind is re-pointed at the head bone, with the head bone's bind pose, so the verts ride the head.
static func _fit_skin(skin: Skin, sk: Skeleton3D) -> Skin:
	if skin == null or sk == null:
		return skin
	var head_i := -1
	var missing: Array[int] = []
	for i in skin.get_bind_count():
		var nm := String(skin.get_bind_name(i))
		if nm == "":
			continue
		if sk.find_bone(nm) < 0:
			missing.append(i)
		elif nm.ends_with("Head") and not nm.contains("Top"):
			head_i = i
	if missing.is_empty() or head_i < 0:
		return skin
	var out: Skin = skin.duplicate()
	for i in missing:
		out.set_bind_name(i, skin.get_bind_name(head_i))
		out.set_bind_pose(i, skin.get_bind_pose(head_i))
	return out

func _attach_head(body_head: int) -> void:
	var hs: PackedScene = load(Catalog.head_path(look.head))
	if not hs:
		return
	var hroot: Node3D = hs.instantiate()
	var hsk: Skeleton3D = _find(hroot, "Skeleton3D")
	var src: MeshInstance3D = _find(hroot, "MeshInstance3D")
	if not hsk or not src:
		hroot.free()
		return
	var hi := _bone(hsk, "Head")
	var ti := _bone(hsk, "HeadTop_End")
	var head_rest := hsk.get_bone_global_rest(hi)
	var unit := 1.0
	if ti >= 0:
		var d := hsk.get_bone_global_rest(ti).origin.distance_to(head_rest.origin)
		unit = d / 0.18 if d > 1e-4 else 1.0
	var robot: bool = look.body == "robot"
	_tex_skin = null if robot else _sample_skin(src.mesh.surface_get_material(0))
	# a head cut off-centre (its face higher and further back than the landmarks expect) is moved into line, so the sculpt,
	# the markings, the hair and the gear all land on its face: measured at the nose tip
	var cal := Vector3.ZERO
	if not robot:
		var tip := Vector3(0, 0, -1)
		for s0 in src.mesh.get_surface_count():
			for v: Vector3 in src.mesh.surface_get_arrays(s0)[Mesh.ARRAY_VERTEX]:
				var q := (v - head_rest.origin) / unit
				if absf(q.x) < 0.008 and q.y > 0.0 and q.y < 0.09 and q.z > tip.z:
					tip = q
		if tip.z > 0.0 and absf(0.05 - tip.y) > 0.015:
			cal = Vector3(0, 0.05 - tip.y, 0.105 - tip.z)
	# rebuild the head: sculpted positions, head space in CUSTOM0 for the skin shader
	var mesh := ArrayMesh.new()
	var head_pts := PackedVector3Array()
	var src_mesh: Mesh = src.mesh
	for s in src_mesh.get_surface_count():
		var arr := src_mesh.surface_get_arrays(s)
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var custom := PackedFloat32Array()
		custom.resize(vs.size() * 4)
		var sculpt := not robot and not FaceMorphs.is_neutral(look.morphs)
		for k in vs.size():
			var p := (vs[k] - head_rest.origin) / unit + cal
			if sculpt:
				var dp := FaceMorphs.displacement(look.morphs, p)
				p += dp
				vs[k] = vs[k] + dp * unit
			custom[k * 4] = p.x
			custom[k * 4 + 1] = p.y
			custom[k * 4 + 2] = p.z
			head_pts.append(p)
		arr[Mesh.ARRAY_VERTEX] = vs
		if sculpt:
			arr[Mesh.ARRAY_NORMAL] = _normals(vs, arr[Mesh.ARRAY_INDEX], arr[Mesh.ARRAY_NORMAL])
		arr[Mesh.ARRAY_CUSTOM0] = custom
		var fmt: int = (src_mesh as ArrayMesh).surface_get_format(s) if src_mesh is ArrayMesh else 0
		var flags: int = (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) | (fmt & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, flags)
		mesh.surface_set_material(mesh.get_surface_count() - 1, _head_material(src_mesh.surface_get_material(s), robot))
	head_mesh = MeshInstance3D.new()
	head_mesh.name = "Head"
	head_mesh.mesh = mesh
	head_mesh.skin = _fit_skin(src.skin, skeleton)
	skeleton.add_child(head_mesh)
	head_mesh.skeleton = head_mesh.get_path_to(skeleton)
	hroot.free()
	if body_head < 0:
		return
	# hair and gear on the body's Head bone, built in head space and placed where the head's own Head bone rests
	var att := BoneAttachment3D.new()
	att.bone_idx = body_head
	skeleton.add_child(att)
	var holder := Node3D.new()
	holder.transform = head_rest.affine_inverse() * Transform3D(Basis.from_scale(Vector3.ONE * unit), head_rest.origin - cal * unit)
	att.add_child(holder)
	var hb := HairBuilder.new()
	hb.fit_skull(head_pts)

	var style := Catalog.find("hair", look.hair)
	var hair_hex: Variant = Catalog.swatch("hairColors", look.hairColor)
	var hair_col: Color = hair_hex if hair_hex != null else Color("#120f0e")
	if not robot and style.get("kind", "authored") != "authored":
		var sc := MeshInstance3D.new()
		sc.mesh = hb.scalp()
		var sm := StandardMaterial3D.new()
		sm.albedo_color = _scalp_tone()
		sm.roughness = 0.6
		sc.material_override = sm
		holder.add_child(sc)
	var hm := hb.build(style) if not robot else null
	if hm:
		hair_mesh = MeshInstance3D.new()
		hair_mesh.mesh = hm
		var curly := false
		for part: Dictionary in style.get("parts", []):
			if part.kind == "afro" or part.get("curl", false):
				curly = true
		hair_mesh.material_override = hair_material(hair_col, curly)
		holder.add_child(hair_mesh)
	var gear := _gear(hb, hair_col)
	if gear:
		holder.add_child(gear)
	_wear()
	# headgear over built hair: tuck the hair under it (a beanie's shell sits 24 mm out, a cap's 16, a bandana's 14)
	if hair_mesh and look.headgear in ["beanie", "beanie-red", "cap", "bandana"]:
		var lift: float = { "beanie": 0.024, "beanie-red": 0.024, "cap": 0.016, "bandana": 0.014 }[look.headgear]
		var mean_r := (hb.radii.x + hb.radii.y + (hb.az_front + hb.az_back) * 0.5) / 3.0
		var hm2 := hair_mesh.material_override as ShaderMaterial
		hm2.set_shader_parameter("tuck", 1.0)
		hm2.set_shader_parameter("skull_c", hb.centre)
		hm2.set_shader_parameter("skull_r", Vector3(hb.radii.x, hb.radii.y, (hb.az_front + hb.az_back) * 0.5))
		hm2.set_shader_parameter("tuck_k", 1.0 + (lift - 0.004) / mean_r)

## vertex normals rebuilt after the sculpt, welded by position so the head's UV seams don't show
static func _normals(vs: PackedVector3Array, idx: PackedInt32Array, old: PackedVector3Array) -> PackedVector3Array:
	var key := {}
	var acc: Array[Vector3] = []
	var slot := PackedInt32Array()
	slot.resize(vs.size())
	for k in vs.size():
		var q := Vector3i(roundi(vs[k].x * 20000.0), roundi(vs[k].y * 20000.0), roundi(vs[k].z * 20000.0))
		if not key.has(q):
			key[q] = acc.size()
			acc.append(Vector3.ZERO)
		slot[k] = key[q]
	for t in range(0, idx.size(), 3):
		var a := idx[t]; var b := idx[t + 1]; var c := idx[t + 2]
		var n := (vs[c] - vs[a]).cross(vs[b] - vs[a])
		acc[slot[a]] += n; acc[slot[b]] += n; acc[slot[c]] += n
	var out := PackedVector3Array()
	out.resize(vs.size())
	for k in vs.size():
		var n := acc[slot[k]]
		out[k] = n.normalized() if n.length_squared() > 0.0 else old[k]
		if out[k].dot(old[k]) < 0.0:
			out[k] = -out[k]
	return out

## the generated (Meshy) bodies and heads carry triangles wound the wrong way round: with back faces culled they showed as
## holes and shards ("torn" models, owner Nov 9 and 11). Drawn from both sides they are whole; Godot turns the normal of a
## back face toward the viewer, so they light right.
static func _two_sided(m: Material) -> Material:
	if m is BaseMaterial3D:
		var d := (m as BaseMaterial3D).duplicate() as BaseMaterial3D
		d.cull_mode = BaseMaterial3D.CULL_DISABLED
		return d
	return m

var _skin_lum := 0.2
func _head_material(m: Material, robot: bool) -> Material:
	if robot:
		var d: Material = m.duplicate() if m else StandardMaterial3D.new()
		if d is StandardMaterial3D:
			var sm := d as StandardMaterial3D
			if m.resource_name.contains("RobotPlate"):
				var c: Variant = Catalog.swatch("plating", look.skin)
				if c != null:
					sm.albedo_color = c
			elif m.resource_name.contains("RobotOptic"):
				var c2: Variant = Catalog.swatch("optics", look.eyes)
				if c2 != null:
					sm.albedo_color = c2
					sm.emission_enabled = true
					sm.emission = c2
					sm.emission_energy_multiplier = 2.4
		return _two_sided(d)
	var std := m as StandardMaterial3D
	var head_def := Catalog.head(look.body, look.head)
	_skin_lum = float(head_def.get("skinLum", 0.2))
	if _skin_lum <= 0.0:
		_skin_lum = 0.2
	var style := Catalog.find("hair", look.hair)
	var kind: String = style.get("kind", "authored")
	var hair_mode := 0 if kind == "authored" else (1 if kind == "none" else 2)
	var tone: Variant = Catalog.swatch("skin", look.skin)
	var civ := bool(look.get("civ", false))
	if not std or (not civ and tone == null and hair_mode == 0 and look.marks.is_empty() and look.beard == "clean"):
		return _two_sided(m)
	var sh := Shader.new()
	sh.code = SkinShader.code(hair_mode, look.beard, look.marks, std.normal_enabled and std.normal_texture != null)
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("albedo_tex", std.albedo_texture)
	if std.normal_texture:
		mat.set_shader_parameter("normal_tex", std.normal_texture)
	mat.set_shader_parameter("roughness_v", std.roughness)
	mat.set_shader_parameter("skin_lum", _skin_lum)
	if tone != null:
		var t: Color = tone
		mat.set_shader_parameter("skin", Vector3(t.srgb_to_linear().r, t.srgb_to_linear().g, t.srgb_to_linear().b))
	var hc: Variant = Catalog.swatch("hairColors", look.hairColor)
	var h: Color = (hc if hc != null else Color("#120f0e")).srgb_to_linear()
	mat.set_shader_parameter("hair", Vector3(h.r, h.g, h.b))
	var bt: Color = (hc if hc != null else Color("#1a1411")).srgb_to_linear()
	mat.set_shader_parameter("beard_tone", Vector3(bt.r, bt.g, bt.b))
	var b := _scalp_tone().srgb_to_linear()
	mat.set_shader_parameter("bald", Vector3(b.r, b.g, b.b))
	return mat

var _tex_skin: Variant = null
## the head texture's own skin colour (its mean over skin-like texels), or null when the image can't be read
static func _sample_skin(m: Material) -> Variant:
	var std := m as StandardMaterial3D
	if not std or not std.albedo_texture:
		return null
	var img := std.albedo_texture.get_image()
	if not img:
		return null
	if img.is_compressed() and img.decompress() != OK:
		return null
	img = img.duplicate()
	img.resize(96, 96, Image.INTERPOLATE_BILINEAR)
	var sum := Color(0, 0, 0)
	var n := 0
	for y in 96:
		for x in 96:
			var c := img.get_pixel(x, y)
			var mx := maxf(c.r, maxf(c.g, c.b))
			var mn := minf(c.r, minf(c.g, c.b))
			var sat := (mx - mn) / (mx + 1e-4)
			var lum := 0.3 * c.r + 0.59 * c.g + 0.11 * c.b
			if c.r - c.b > 0.06 and sat > 0.15 and sat < 0.8 and lum > 0.12 and c.b <= c.g + 0.04:
				sum += c
				n += 1
	return Color(sum.r / n, sum.g / n, sum.b / n) if n > 50 else null

## a bare scalp's colour: the chosen skin tone, the head's own skin, or a warm tone at its skin brightness
func _scalp_tone() -> Color:
	var tone: Variant = Catalog.swatch("skin", look.skin)
	if tone != null:
		return tone
	if _tex_skin != null:
		return _tex_skin
	return Color(_skin_lum * 1.9, _skin_lum * 1.35, _skin_lum * 1.05).linear_to_srgb()

const HAIR_SHADER := """
shader_type spatial;
render_mode cull_disabled;
// built hair: fine streaks along the strands (or tight curls), a shifted highlight, and a bumped surface so caps read as hair
uniform vec3 tint : source_color = vec3(0.07);
uniform float curly = 0.0;
uniform float knit = 0.0;
// under a beanie, cap or bandana: the hair above the band is pressed inside the headgear's shell instead of poking
// through it (skull_c / skull_r are the fitted skull in head space; tuck_k how far out the shell sits, in skull radii)
uniform float tuck = 0.0;
uniform vec3 skull_c = vec3(0.0, 0.09, -0.005);
uniform vec3 skull_r = vec3(0.085, 0.11, 0.1);
uniform float tuck_k = 1.12;
void vertex() {
	if (tuck > 0.5) {
		vec3 v = VERTEX - skull_c;
		float k = length(v / skull_r);
		if (k > tuck_k) {
			float up = smoothstep(-0.015, 0.02, v.y);
			VERTEX = mix(VERTEX, skull_c + v / k * tuck_k, up);
		}
	}
}
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n1(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
float streak(vec2 uv) {
	float a = n1(vec2(uv.x * 160.0, uv.y * 3.0)) * 0.6 + n1(vec2(uv.x * 420.0, uv.y * 6.0)) * 0.4;
	float c = n1(uv * vec2(90.0, 90.0)) * 0.5 + n1(uv * vec2(230.0, 230.0)) * 0.5;
	float k = abs(sin(uv.x * 260.0)) * 0.7 + 0.3 * n1(uv * vec2(40.0, 400.0));
	return knit > 0.5 ? k : mix(a, c, curly);
}
void fragment() {
	float s = streak(UV);
	float e = 0.002;
	float sx = streak(UV + vec2(e, 0.0)) - s;
	float sy = streak(UV + vec2(0.0, e)) - s;
	NORMAL = normalize(NORMAL + (TANGENT * sx + BINORMAL * sy) * (knit > 0.5 ? 2.5 : 4.0));
	ALBEDO = tint * COLOR.rgb * (0.38 + 0.62 * s);
	ROUGHNESS = knit > 0.5 ? 0.95 : mix(0.42, 0.62, s);
	SPECULAR = knit > 0.5 ? 0.15 : 0.5;
	// a soft sheen along the strand direction
	float sheen = pow(1.0 - abs(dot(normalize(BINORMAL), VIEW)), 6.0);
	EMISSION = tint * sheen * 0.12 * (1.0 - knit);
}
"""
static var _hair_shader: Shader

static func hair_material(col: Color, curly := false, knit := false) -> ShaderMaterial:
	if not _hair_shader:
		_hair_shader = Shader.new()
		_hair_shader.code = HAIR_SHADER
	var m := ShaderMaterial.new()
	m.shader = _hair_shader
	m.set_shader_parameter("tint", col)
	m.set_shader_parameter("curly", 1.0 if curly else 0.0)
	m.set_shader_parameter("knit", 1.0 if knit else 0.0)
	return m

## what the operator wears on the body (asset catalog part 2 §4: jewelry, watches, backpacks): `look.wear` is a list of
## ids from WEAR, each a small mesh on a body bone — built upright in model space at the bone's rest and parented to a
## BoneAttachment3D, so it rides the bone through every clip. Robots wear none.
const WEAR := [
	{ "id": "chain", "label": "Chain", "blurb": "A gold chain with a ▽ pendant." },
	{ "id": "earrings", "label": "Earrings", "blurb": "Small hoops, both ears." },
	{ "id": "watch", "label": "Watch", "blurb": "A steel watch, left wrist." },
	{ "id": "backpack", "label": "Backpack", "blurb": "A slim tactical pack between the shoulders." },
	{ "id": "rings", "label": "Rings", "blurb": "Two rings on the right hand." },
]
var _wear_nodes: Array[Node] = []

static func wear_ids() -> Array[String]:
	var out: Array[String] = []
	for w in WEAR:
		out.append(String(w.id))
	return out

func _wear() -> void:
	for n in _wear_nodes:
		if is_instance_valid(n):
			n.queue_free()
	_wear_nodes.clear()
	if look.body == "robot" or not skeleton:
		return
	var wear: Array = look.get("wear", [])
	var gold := _mat(Color(0.95, 0.75, 0.3), 0.25, 1.0)
	var steel := _mat(Color(0.75, 0.77, 0.8), 0.3, 0.9)
	var cloth := _mat(Color(0.12, 0.12, 0.14), 0.85, 0.0)
	for id in wear:
		match String(id):
			"chain":
				var h := _on_bone("Neck", Vector3(0, -0.09, 0.07))
				if h:
					var band := TorusMesh.new()
					band.inner_radius = 0.085
					band.outer_radius = 0.093
					band.rings = 10
					band.ring_segments = 6
					var bm := MeshInstance3D.new()
					bm.mesh = band
					bm.rotation.x = 0.35
					bm.material_override = gold
					h.add_child(bm)
					var pend := MeshInstance3D.new()
					var pm := PrismMesh.new()
					pm.size = Vector3(0.036, 0.04, 0.008)
					pend.mesh = pm
					pend.rotation.x = PI
					pend.position = Vector3(0, -0.075, 0.1)
					pend.material_override = gold
					h.add_child(pend)
			"earrings":
				for sx in [-1.0, 1.0]:
					var h2 := _on_bone("Head", Vector3(sx * 0.08, -0.025, -0.01))
					if h2:
						var ring := TorusMesh.new()
						ring.inner_radius = 0.012
						ring.outer_radius = 0.0155
						ring.rings = 8
						ring.ring_segments = 6
						var rm := MeshInstance3D.new()
						rm.mesh = ring
						rm.rotation.z = PI * 0.5
						rm.material_override = gold
						h2.add_child(rm)
			"watch":
				var h3 := _on_bone("LeftHand", Vector3(-0.035, 0.0, 0.0))
				if h3:
					var strap := TorusMesh.new()
					strap.inner_radius = 0.03
					strap.outer_radius = 0.038
					strap.rings = 10
					strap.ring_segments = 6
					var sm := MeshInstance3D.new()
					sm.mesh = strap
					sm.rotation.z = PI * 0.5     # the band round the forearm (bone along X in the T-pose)
					sm.material_override = cloth
					h3.add_child(sm)
					var face := MeshInstance3D.new()
					var fm := CylinderMesh.new()
					fm.top_radius = 0.018
					fm.bottom_radius = 0.018
					fm.height = 0.008
					fm.radial_segments = 12
					face.mesh = fm
					face.position = Vector3(0, 0.0, -0.036)
					face.rotation.x = PI * 0.5
					face.material_override = steel
					h3.add_child(face)
					var glass := MeshInstance3D.new()
					var gm := CylinderMesh.new()
					gm.top_radius = 0.014
					gm.bottom_radius = 0.014
					gm.height = 0.002
					gm.radial_segments = 12
					glass.mesh = gm
					glass.position = Vector3(0, 0.0, -0.041)
					glass.rotation.x = PI * 0.5
					var lm := _mat(Color(0.3, 0.9, 1.0), 0.1, 0.0)
					lm.emission_enabled = true
					lm.emission = Color(0.3, 0.9, 1.0)
					lm.emission_energy_multiplier = 1.2
					glass.material_override = lm
					h3.add_child(glass)
			"backpack":
				var h4 := _on_bone("Spine2", Vector3(0, -0.04, -0.17))
				if h4:
					var pack := MeshInstance3D.new()
					var pk := BoxMesh.new()
					pk.size = Vector3(0.3, 0.4, 0.16)
					pack.mesh = pk
					pack.material_override = cloth
					h4.add_child(pack)
					var lid := MeshInstance3D.new()
					var lm2 := BoxMesh.new()
					lm2.size = Vector3(0.26, 0.12, 0.17)
					lid.mesh = lm2
					lid.position = Vector3(0, 0.15, -0.005)
					lid.material_override = _mat(Color(0.18, 0.18, 0.2), 0.8, 0.0)
					h4.add_child(lid)
					for sx in [-0.09, 0.09]:
						var strap2 := MeshInstance3D.new()
						var st := BoxMesh.new()
						st.size = Vector3(0.05, 0.3, 0.03)
						strap2.mesh = st
						strap2.position = Vector3(sx, 0.08, 0.13)
						strap2.rotation.x = -0.5
						strap2.material_override = cloth
						h4.add_child(strap2)
			"rings":
				for off in [Vector3(-0.09, -0.005, 0.0), Vector3(-0.09, -0.005, 0.02)]:
					var h5 := _on_bone("RightHand", off)
					if h5:
						var ring2 := TorusMesh.new()
						ring2.inner_radius = 0.0085
						ring2.outer_radius = 0.011
						ring2.rings = 8
						ring2.ring_segments = 6
						var r2 := MeshInstance3D.new()
						r2.mesh = ring2
						r2.rotation.z = PI * 0.5
						r2.material_override = gold
						h5.add_child(r2)

## a holder upright in model space at the bone's rest plus `off`, riding the bone
func _on_bone(suffix: String, off: Vector3) -> Node3D:
	var idx := _bone(skeleton, suffix)
	if idx < 0:
		return null
	var att := BoneAttachment3D.new()
	att.bone_idx = idx
	skeleton.add_child(att)
	_wear_nodes.append(att)
	var rest := skeleton.get_bone_global_rest(idx)
	var holder := Node3D.new()
	holder.transform = rest.affine_inverse() * Transform3D(Basis.IDENTITY, rest.origin + off)
	att.add_child(holder)
	return holder

static func _mat(col: Color, rough := 0.5, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = rough
	m.metallic = metal
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

## accessory and headgear as simple pieces in head space (landmarks as in skin_shader.gd)
func _gear(hb: HairBuilder, hair_col: Color) -> Node3D:
	var root := Node3D.new()
	var put := func(mesh: Mesh, mat: Material) -> void:
		if mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = mat
			root.add_child(mi)
	var tor := func(r: float, tube: float) -> TorusMesh:
		var t := TorusMesh.new()
		t.inner_radius = r - tube
		t.outer_radius = r + tube
		t.rings = 20
		t.ring_segments = 6
		return t
	var face_on := Basis(Vector3.RIGHT, PI / 2)  # torus axis Y -> Z (facing forward)
	match look.accessory:
		"glasses", "shades":
			hb.begin()
			for sx: float in [-1.0, 1.0]:
				hb.add_primitive(tor.call(0.0165, 0.0018), Transform3D(face_on, Vector3(sx * 0.031, 0.068, 0.098)))
				var path: Array[Vector3] = [Vector3(sx * 0.048, 0.07, 0.092), Vector3(sx * 0.068, 0.072, 0.06), Vector3(sx * 0.074, 0.07, 0.0)]
				hb.strand(path, 0.0016, 1)
			var br: Array[Vector3] = [Vector3(-0.015, 0.072, 0.104), Vector3(0, 0.075, 0.107), Vector3(0.015, 0.072, 0.104)]
			hb.strand(br, 0.0015, 2)
			put.call(hb.take(), _mat(Color("#15171b"), 0.3, 0.6))
			hb.begin()
			for sx2: float in [-1.0, 1.0]:
				var lens := CylinderMesh.new()
				lens.top_radius = 0.0158
				lens.bottom_radius = 0.0158
				lens.height = 0.0015
				lens.radial_segments = 20
				hb.add_primitive(lens, Transform3D(face_on, Vector3(sx2 * 0.031, 0.068, 0.098)))
			var lm := _mat(Color(0.05, 0.06, 0.07, 0.92) if look.accessory == "shades" else Color(0.8, 0.9, 1.0, 0.15), 0.05, 0.2)
			lm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			put.call(hb.take(), lm)
		"eyepiece":
			hb.begin()
			hb.add_primitive(tor.call(0.019, 0.003), Transform3D(face_on, Vector3(-0.031, 0.068, 0.1)))
			var arm := BoxMesh.new()
			arm.size = Vector3(0.05, 0.008, 0.006)
			hb.add_primitive(arm, Transform3D(Basis(Vector3.UP, -0.9), Vector3(-0.06, 0.075, 0.075)))
			put.call(hb.take(), _mat(Color("#2b2f36"), 0.35, 0.8))
			hb.begin()
			var glass := CylinderMesh.new()
			glass.top_radius = 0.016
			glass.bottom_radius = 0.016
			glass.height = 0.002
			hb.add_primitive(glass, Transform3D(face_on, Vector3(-0.031, 0.068, 0.101)))
			var gm := _mat(Color("#ff3344"), 0.1)
			gm.emission_enabled = true
			gm.emission = Color("#ff3344")
			gm.emission_energy_multiplier = 2.5
			put.call(hb.take(), gm)
		"earpiece":
			hb.begin()
			var bead := SphereMesh.new()
			bead.radius = 0.006
			bead.height = 0.012
			hb.add_primitive(bead, Transform3D(Basis(), Vector3(0.074, 0.062, -0.004)))
			var em := _mat(Color("#41e6ff"), 0.2)
			em.emission_enabled = true
			em.emission = Color("#41e6ff")
			put.call(hb.take(), em)
	match look.headgear:
		"beanie", "beanie-red":
			hb.begin()
			hb.shell(0.024, func(th: float) -> float: return minf(0.5 * PI, HairBuilder.hairline(th) - 0.04), 1.0, 18, 40)
			var ring: Array[Vector3] = []
			for j in 41:
				ring.append(hb.on_skull(minf(0.5 * PI, HairBuilder.hairline(j / 40.0 * TAU) - 0.04), j / 40.0 * TAU, 0.026))
			hb.strand(ring, 0.011, 5, -1.0, 60, 8)
			put.call(hb.take(), hair_material(Color("#8e1f24") if look.headgear == "beanie-red" else Color("#2a2d33"), false, true))
		"cap":
			hb.begin()
			hb.shell(0.016, func(th: float) -> float: return minf(0.46 * PI, HairBuilder.hairline(th) - 0.06), 1.0, 18, 40)
			var brim := CylinderMesh.new()
			brim.top_radius = 0.06
			brim.bottom_radius = 0.06
			brim.height = 0.004
			var front := hb.on_skull(0.42 * PI, 0.0, 0.016)
			hb.add_primitive(brim, Transform3D(Basis(Vector3.RIGHT, 0.18).scaled(Vector3(1.25, 1, 1)), front + Vector3(0, -0.004, 0.035)))
			put.call(hb.take(), _mat(Color("#2c3328"), 0.85))
		"bandana":
			hb.begin()
			hb.shell(0.014, func(th: float) -> float: return HairBuilder.hairline(th) - 0.02, 1.0, 18, 40)
			var knot := SphereMesh.new()
			knot.radius = 0.016
			knot.height = 0.03
			hb.add_primitive(knot, Transform3D(Basis(), hb.on_skull(0.56 * PI, PI, 0.02)))
			put.call(hb.take(), _mat(Color("#6d1a1f"), 0.9))
		"headband":
			hb.begin()
			var band: Array[Vector3] = []
			for j in 41:
				var th := j / 40.0 * TAU
				band.append(hb.on_skull(HairBuilder.hairline(th) - 0.06, th, 0.012))
			hb.strand(band, 0.008, 6, -1.0, 60, 8)
			put.call(hb.take(), _mat(Color("#cfd4da"), 0.8))
	if root.get_child_count() == 0:
		root.free()
		return null
	return root
