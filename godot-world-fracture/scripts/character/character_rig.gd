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
const WorkIdle := preload("res://scripts/character/work_idle.gd")
const ActionLayer := preload("res://scripts/character/action_layer.gd")
const CombatClips := preload("res://scripts/character/combat_clips.gd")

var look: Dictionary = {}
var body_root: Node3D
var skeleton: Skeleton3D
var head_mesh: MeshInstance3D
var hair_mesh: MeshInstance3D
var _body_meshes: Array = []
var anim: AnimationPlayer
## the combat animation layer over the clips (action_layer.gd): swings, dodges, reloads, hits, deaths, the guard
var action: Node
## where the head sits on this body (body skeleton space), for framing a camera
var head_point := Vector3(0, 1.6, 0)

## nobody fills the screen (owner, Nov 11 — an NPC standing where the camera was showed only a face across the whole
## view): a person the camera is inside, or right against, is hidden until it is clear; the clothing store's turntable
## and the creator stand far enough off never to trip it
var _cam_hidden := false
func _process(_dt: float) -> void:
	var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
	if cam == null:
		return
	var d := cam.global_position - global_position
	var flat := Vector2(d.x, d.z).length()
	var inside := flat < 0.45 * maxf(scale.x, 0.01) and d.y > -0.3 and d.y < 2.2 * maxf(scale.y, 0.01)
	if inside != _cam_hidden:
		_cam_hidden = inside
		for c in get_children():
			if c is Node3D:
				(c as Node3D).visible = not inside
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
	var hero := Catalog.hero_model(look)
	var ps: PackedScene = load(hero if hero != "" else Catalog.body_path(look.frame, look.body, bool(look.get("civ", false))))
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
		WorkIdle.install(anim, skeleton)
	if anim and animate and anim.has_animation("idle"):
		anim.get_animation("idle").loop_mode = Animation.LOOP_LINEAR
		anim.play("idle")
	if not skeleton:
		return
	action = ActionLayer.new()
	action.name = "ActionLayer"
	skeleton.add_child(action)
	var hb := _bone(skeleton, "Head")
	_head_bone = hb
	if hb >= 0:
		head_point = skeleton.get_bone_global_rest(hb).origin
	if hero != "":
		return    # a whole Meshy character: its own face, hair and clothes
	_attach_head(hb)
	if bool(look.get("civ", false)) and String(look.get("body", "")) != "robot":
		dress(String(look.get("outfit", "")))

## the operator's class for the combat clips: goliath / nyx / cipher (robots and civilians fight as their frame)
func combat_class() -> String:
	var f := String(look.get("frame", "goliath"))
	return f if CombatClips.CLASS.has(f) else "goliath"

## plays a combat clip by name: the class's own, else the shared one; `seconds` stretches it (a reload to the gun's time)
func act(name: String, seconds := -1.0) -> bool:
	if not action:
		return false
	var cls := combat_class()
	var clip: Dictionary = CombatClips.variant(cls, name)
	if clip.is_empty():
		return false
	action.play(name, clip, CombatClips.speed_of(cls), seconds)
	return true

## the reload for a gun frame, stretched to its reload time
func act_reload(frame: String, seconds: float) -> void:
	if action:
		action.play("reload", CombatClips.reload_for(frame), 1.0, seconds)

## a held pose under the actions: "block", "aim", "aim_sights", "sprint_lean" or "" to let go
func hold(name: String) -> void:
	if not action:
		return
	if name == "":
		action.stance("")
		return
	action.stance(name, CombatClips.variant(combat_class(), name))

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
	var built: Array = []          # [arrays, custom, surface] per surface, added to the mesh once the skull is fitted
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
		if not robot:
			_trim_collar(arr, custom, src_mesh.surface_get_material(s))
		if sculpt:
			arr[Mesh.ARRAY_NORMAL] = _normals(vs, arr[Mesh.ARRAY_INDEX], arr[Mesh.ARRAY_NORMAL])
		built.append([arr, custom, s])
	# a built hairstyle or a bald head: the scan's own hair is pressed down onto the fitted skull and flagged (CUSTOM0.w)
	# for the skin shader to colour as scalp — one smooth surface, where cutting it out texel by texel by colour left
	# specks, a ragged edge and an egg-shaped cap showing through (GTA pass, Nov 22)
	var kind := String(Catalog.find("hair", look.hair).get("kind", "authored"))
	if not robot and kind != "authored":
		var skull := HairBuilder.new()
		skull.fit_skull(head_pts)
		for b in built:
			_press_hair(b[0], b[1], src_mesh.surface_get_material(b[2]), skull, head_rest.origin, unit, cal)
	for b in built:
		var arr: Array = b[0]
		arr[Mesh.ARRAY_CUSTOM0] = b[1]
		var fmt: int = (src_mesh as ArrayMesh).surface_get_format(b[2]) if src_mesh is ArrayMesh else 0
		var flags: int = (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) | (fmt & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, flags)
		mesh.surface_set_material(mesh.get_surface_count() - 1, _head_material(src_mesh.surface_get_material(b[2]), robot))
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
	# the scalp cap under a built style is only needed where the scan's hair was not pressed onto the skull (none now: see
	# _press_hair); it showed through at the nape, so it is off
	if false and not robot and style.get("kind", "authored") != "authored":
		var sc := MeshInstance3D.new()
		sc.mesh = hb.scalp()
		var sm := StandardMaterial3D.new()
		sm.albedo_color = _scalp_tone()
		sm.roughness = 0.5
		sm.specular = 0.45
		sm.backlight_enabled = true                   # lit like the face's skin beside it
		sm.backlight = _scalp_tone() * 0.3
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
## The scanned heads are busts that end in a scrap of the armour collar they were made with: a grey flared ring under the
## jaw. The old body's thick neck hid it; on the MakeHuman bodies it stood out round every neck (GTA pass, Nov 22). Its
## triangles go: below the jaw and behind the chin, where the head's own texture is mid grey — not skin (warm), not hair (black).
static func _trim_collar(arr: Array, head_space: PackedFloat32Array, m: Material) -> void:
	var std := m as StandardMaterial3D
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
	var uvs: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV] if arr[Mesh.ARRAY_TEX_UV] != null else PackedVector2Array()
	if not std or not std.albedo_texture or idx.is_empty() or uvs.is_empty():
		return
	var img := std.albedo_texture.get_image()
	if not img or (img.is_compressed() and img.decompress() != OK):
		return
	var w := img.get_width()
	var h := img.get_height()
	var n := uvs.size()
	var gone := PackedByteArray()
	gone.resize(n)
	for k in n:
		var y := head_space[k * 4 + 1]
		# the head's own neck stub behind the chin: the body has its neck, and the stub poked through the collars
		if y < -0.004 and head_space[k * 4 + 2] < 0.04:
			gone[k] = 1
			continue
		if y < 0.03 and absf(head_space[k * 4]) > 0.075:   # under the jaw and wider than it: the collar's side flaps
			gone[k] = 1
			continue
		if y > 0.05 or head_space[k * 4 + 2] > 0.03:      # below the jaw line, and behind the chin (beards stay)
			continue
		var uv := uvs[k]
		var c := img.get_pixel(clampi(int(uv.x * w), 0, w - 1), clampi(int(uv.y * h), 0, h - 1))
		var mx := maxf(c.r, maxf(c.g, c.b))
		var mn := minf(c.r, minf(c.g, c.b))
		var sat := (mx - mn) / (mx + 1e-4)
		var lum := 0.3 * c.r + 0.59 * c.g + 0.11 * c.b
		# grey cloth / plate: darker than skin, lighter than black hair, without skin's warmth; or a deep dyed red (the
		# women's heads end in a red collar); or anything flaring out past the neck well below the jaw
		var r := Vector2(head_space[k * 4], head_space[k * 4 + 2]).length()
		if (sat < 0.22 and lum > 0.055 and lum < 0.42) or (sat > 0.6 and lum < 0.3) or (y < -0.006 and r > 0.075) or (y < 0.02 and r > 0.082) or (y < 0.07 and r > 0.105):
			gone[k] = 1
	var keep := PackedInt32Array()
	for t in range(0, idx.size(), 3):
		if gone[idx[t]] == 0 and gone[idx[t + 1]] == 0 and gone[idx[t + 2]] == 0:
			keep.append(idx[t])
			keep.append(idx[t + 1])
			keep.append(idx[t + 2])
	arr[Mesh.ARRAY_INDEX] = keep

## The scan's hair, found by its texture (not skin-coloured) in the hair's region of the head (above the brow, over the
## temples, behind the ears), the flag smoothed over neighbouring vertices so its edge is a soft line, then pressed onto
## the skull by that flag. Writes the flag to CUSTOM0.w and the moved positions (head space and mesh space) back.
static func _press_hair(arr: Array, hs: PackedFloat32Array, m: Material, skull: HairBuilder, origin: Vector3, unit: float, cal: Vector3) -> void:
	var std := m as StandardMaterial3D
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
	var uvs: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV] if arr[Mesh.ARRAY_TEX_UV] != null else PackedVector2Array()
	if not std or not std.albedo_texture or idx.is_empty() or uvs.is_empty():
		return
	var img := std.albedo_texture.get_image()
	if not img or (img.is_compressed() and img.decompress() != OK):
		return
	var w := img.get_width()
	var h := img.get_height()
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n := vs.size()
	var flag := PackedFloat32Array()
	flag.resize(n)
	for k in n:
		var p := Vector3(hs[k * 4], hs[k * 4 + 1], hs[k * 4 + 2])
		var region := p.y > 0.106 or (p.z < -0.012 and p.y > -0.004) or (absf(p.x) > 0.058 and p.y > 0.072 and p.z < 0.025)
		if not region:
			continue
		var c := img.get_pixel(clampi(int(uvs[k].x * w), 0, w - 1), clampi(int(uvs[k].y * h), 0, h - 1))
		var mx := maxf(c.r, maxf(c.g, c.b))
		var mn := minf(c.r, minf(c.g, c.b))
		var sat := (mx - mn) / (mx + 1e-4)
		var lum := 0.3 * c.r + 0.59 * c.g + 0.11 * c.b
		var skin := c.r - c.b > 0.06 and sat > 0.15 and sat < 0.8 and lum > 0.12
		# a lock standing well off the skull is hair whatever its texel says (strands kept sticking up)
		var d0 := (p - skull.centre)
		var off := d0.length() > skull.radius_at(d0.normalized()) * 1.07
		flag[k] = 0.0 if skin and not off else 1.0
	# smooth the flag over the mesh: neighbours by triangle, a few passes (vertices split at UV seams share by position)
	var nb: Array = []
	nb.resize(n)
	for k in n:
		nb[k] = PackedInt32Array()
	for t in range(0, idx.size(), 3):
		for a in 3:
			(nb[idx[t + a]] as PackedInt32Array).append(idx[t + (a + 1) % 3])
			(nb[idx[t + a]] as PackedInt32Array).append(idx[t + (a + 2) % 3])
	for _pass in 4:
		var next := flag.duplicate()
		for k in n:
			var ns: PackedInt32Array = nb[k]
			if ns.is_empty():
				continue
			var sum := 0.0
			for j in ns:
				sum += flag[j]
			next[k] = flag[k] * 0.4 + sum / ns.size() * 0.6
		flag = next
	for k in n:
		var f := smoothstep(0.25, 0.75, flag[k])
		hs[k * 4 + 3] = f
		if f <= 0.0:
			continue
		var p := Vector3(hs[k * 4], hs[k * 4 + 1], hs[k * 4 + 2])
		var d := (p - skull.centre).normalized()
		var on := skull.centre + d * skull.radius_at(d) * 0.995
		var q := p.lerp(on, f)
		hs[k * 4] = q.x
		hs[k * 4 + 1] = q.y
		hs[k * 4 + 2] = q.z
		vs[k] = (q - cal) * unit + origin
	arr[Mesh.ARRAY_VERTEX] = vs
	arr[Mesh.ARRAY_NORMAL] = _normals(vs, idx, arr[Mesh.ARRAY_NORMAL])

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
	# the lit skin only: a plain average took in the beard, brows and shadowed creases, and the hands came out far darker
	# than the face (polish, Nov 22) — so the skin-like pixels between the 70th and 97th percentile of brightness
	var found: Array = []
	for y in 96:
		for x in 96:
			var c := img.get_pixel(x, y)
			var mx := maxf(c.r, maxf(c.g, c.b))
			var mn := minf(c.r, minf(c.g, c.b))
			var sat := (mx - mn) / (mx + 1e-4)
			var lum := 0.3 * c.r + 0.59 * c.g + 0.11 * c.b
			if c.r - c.b > 0.06 and sat > 0.15 and sat < 0.8 and lum > 0.12 and c.b <= c.g + 0.04:
				found.append([lum, c])
	if found.size() <= 50:
		return null
	found.sort_custom(func(a, b): return a[0] < b[0])
	var sum := Color(0, 0, 0)
	var lo := int(found.size() * 0.7)
	var hi := int(found.size() * 0.97)
	for i in range(lo, hi):
		sum += found[i][1]
	var n := float(hi - lo)
	var c := Color(sum.r / n, sum.g / n, sum.b / n)
	# the face's texture carries baked highlights the bare arms don't get: a little less red so they sit with it
	var l := 0.3 * c.r + 0.59 * c.g + 0.11 * c.b
	c = c.lerp(Color(l, l, l), 0.35) * 1.1
	return Color(minf(c.r, 1.0), minf(c.g, 1.0), minf(c.b, 1.0))

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
## carried things (asset catalog "Everyday civilian life"): civilians.gd rolls these into a walker's `wear` so the
## crowd carries shopping bags, phones, coffee, parcels, umbrellas and pushes strollers; not in the creator's menu
const CARRY := ["bag", "phone", "coffee", "package", "umbrella", "stroller"]
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
			"helmet":
				# a full-face riding helmet over the head (street_slice puts it on for the bikes): the shell, a dark visor
				var hh := _on_bone("Head", Vector3(0, 0.085, 0.012))
				if hh:
					var shell := SphereMesh.new()
					shell.radius = 0.125
					shell.height = 0.25
					shell.radial_segments = 20
					shell.rings = 10
					var sm := MeshInstance3D.new()
					sm.mesh = shell
					sm.scale = Vector3(1.0, 1.1, 1.14)
					sm.material_override = _mat(Color(0.12, 0.1, 0.16), 0.25, 0.4)
					hh.add_child(sm)
					var visor := MeshInstance3D.new()
					var vm := BoxMesh.new()
					vm.size = Vector3(0.17, 0.065, 0.03)
					visor.mesh = vm
					visor.position = Vector3(0, -0.01, 0.13)
					visor.material_override = _mat(Color(0.05, 0.06, 0.08), 0.08, 0.6)
					hh.add_child(visor)
					var stripe := MeshInstance3D.new()
					var stm := BoxMesh.new()
					stm.size = Vector3(0.02, 0.2, 0.16)
					stripe.mesh = stm
					stripe.position = Vector3(0, 0.07, -0.02)
					stripe.material_override = _mat(Color(0.95, 0.4, 0.1), 0.4, 0.2)
					hh.add_child(stripe)
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
			"bag":
				# a paper shopping bag hanging from the left hand
				var hb := _on_bone("LeftHand", Vector3(0.0, -0.3, 0.02))
				if hb:
					var paper := _mat([Color(0.85, 0.78, 0.65), Color(0.2, 0.2, 0.22), Color(0.6, 0.2, 0.25)][randi() % 3], 0.9, 0.0)
					var bag := MeshInstance3D.new()
					var bb := BoxMesh.new()
					bb.size = Vector3(0.3, 0.34, 0.13)
					bag.mesh = bb
					bag.material_override = paper
					hb.add_child(bag)
					for sx in [-0.08, 0.08]:
						var handle := MeshInstance3D.new()
						var hm := BoxMesh.new()
						hm.size = Vector3(0.012, 0.14, 0.012)
						handle.mesh = hm
						handle.position = Vector3(sx, 0.23, 0.0)
						handle.material_override = cloth
						hb.add_child(handle)
			"phone":
				var hp := _on_bone("RightHand", Vector3(-0.02, -0.06, 0.03))
				if hp:
					var ph := MeshInstance3D.new()
					var pm2 := BoxMesh.new()
					pm2.size = Vector3(0.07, 0.15, 0.008)
					ph.mesh = pm2
					ph.rotation.x = 0.4
					ph.material_override = _mat(Color(0.05, 0.05, 0.06), 0.2, 0.3)
					hp.add_child(ph)
					var scr := MeshInstance3D.new()
					var sm := BoxMesh.new()
					sm.size = Vector3(0.062, 0.135, 0.002)
					scr.mesh = sm
					scr.position = Vector3(0, 0, 0.005)
					scr.rotation.x = 0.4
					var sl := _mat(Color(0.5, 0.75, 1.0), 0.1, 0.0)
					sl.emission_enabled = true
					sl.emission = Color(0.5, 0.75, 1.0)
					sl.emission_energy_multiplier = 1.5
					scr.material_override = sl
					hp.add_child(scr)
			"coffee":
				var hc := _on_bone("RightHand", Vector3(-0.02, -0.08, 0.02))
				if hc:
					var cup := MeshInstance3D.new()
					var cm := CylinderMesh.new()
					cm.top_radius = 0.042
					cm.bottom_radius = 0.034
					cm.height = 0.13
					cm.radial_segments = 10
					cup.mesh = cm
					cup.material_override = _mat(Color(0.92, 0.9, 0.86), 0.7, 0.0)
					hc.add_child(cup)
					var lid := MeshInstance3D.new()
					var lm3 := CylinderMesh.new()
					lm3.top_radius = 0.044
					lm3.bottom_radius = 0.044
					lm3.height = 0.012
					lm3.radial_segments = 10
					lid.mesh = lm3
					lid.position = Vector3(0, 0.07, 0)
					lid.material_override = _mat(Color(0.15, 0.15, 0.16), 0.5, 0.0)
					hc.add_child(lid)
			"package":
				# a parcel carried against the chest
				var hk := _on_bone("Spine2", Vector3(0, -0.02, 0.26))
				if hk:
					var box := MeshInstance3D.new()
					var bx := BoxMesh.new()
					bx.size = Vector3(0.42, 0.28, 0.3)
					box.mesh = bx
					box.material_override = _mat(Color(0.7, 0.55, 0.38), 0.9, 0.0)
					hk.add_child(box)
					var tape := MeshInstance3D.new()
					var tp := BoxMesh.new()
					tp.size = Vector3(0.06, 0.285, 0.305)
					tape.mesh = tp
					tape.material_override = _mat(Color(0.5, 0.42, 0.3), 0.9, 0.0)
					hk.add_child(tape)
			"umbrella":
				# held over the head: a pole from the right hand up to a canopy above the crown
				var hu := _on_bone("Head", Vector3(0.12, 0.42, 0.0))
				if hu:
					var canopy := MeshInstance3D.new()
					var cone := CylinderMesh.new()
					cone.top_radius = 0.0
					cone.bottom_radius = 0.55
					cone.height = 0.2
					cone.radial_segments = 8
					cone.cap_bottom = false
					canopy.mesh = cone
					var um := _mat([Color(0.1, 0.1, 0.12), Color(0.7, 0.15, 0.2), Color(0.2, 0.3, 0.7)][randi() % 3], 0.7, 0.0)
					um.cull_mode = BaseMaterial3D.CULL_DISABLED
					canopy.material_override = um
					hu.add_child(canopy)
					var pole := MeshInstance3D.new()
					var pl := CylinderMesh.new()
					pl.top_radius = 0.008
					pl.bottom_radius = 0.008
					pl.height = 0.95
					pl.radial_segments = 6
					pole.mesh = pl
					pole.position = Vector3(0, -0.5, 0)
					pole.material_override = steel
					hu.add_child(pole)
			"stroller":
				# pushed ahead of the hips: a frame on four wheels with a hood
				var hs := _on_bone("Hips", Vector3(0, -0.45, 0.8))
				if hs:
					var frame := _mat(Color(0.2, 0.2, 0.22), 0.5, 0.6)
					var seat := _mat([Color(0.3, 0.35, 0.5), Color(0.5, 0.25, 0.3), Color(0.25, 0.25, 0.28)][randi() % 3], 0.8, 0.0)
					var body := MeshInstance3D.new()
					var bm2 := BoxMesh.new()
					bm2.size = Vector3(0.4, 0.24, 0.52)
					body.mesh = bm2
					body.position = Vector3(0, 0.3, 0)
					body.material_override = seat
					hs.add_child(body)
					var hood := MeshInstance3D.new()
					var hm2 := BoxMesh.new()
					hm2.size = Vector3(0.42, 0.2, 0.24)
					hood.mesh = hm2
					hood.position = Vector3(0, 0.52, 0.12)
					hood.material_override = seat
					hs.add_child(hood)
					for wx in [-0.2, 0.2]:
						for wz in [-0.25, 0.25]:
							var wheel := MeshInstance3D.new()
							var wm := CylinderMesh.new()
							wm.top_radius = 0.09
							wm.bottom_radius = 0.09
							wm.height = 0.03
							wm.radial_segments = 10
							wheel.mesh = wm
							wheel.rotation.z = PI * 0.5
							wheel.position = Vector3(wx, 0.09, wz)
							wheel.material_override = frame
							hs.add_child(wheel)
					for hx in [-0.2, 0.2]:
						var bar := MeshInstance3D.new()
						var brm := CylinderMesh.new()
						brm.top_radius = 0.012
						brm.bottom_radius = 0.012
						brm.height = 0.7
						brm.radial_segments = 6
						bar.mesh = brm
						bar.position = Vector3(hx, 0.55, -0.45)
						bar.rotation.x = -0.6
						bar.material_override = frame
						hs.add_child(bar)
					var grip := MeshInstance3D.new()
					var gm := CylinderMesh.new()
					gm.top_radius = 0.014
					gm.bottom_radius = 0.014
					gm.height = 0.44
					gm.radial_segments = 6
					grip.mesh = gm
					grip.rotation.z = PI * 0.5
					grip.position = Vector3(0, 0.86, -0.65)
					grip.material_override = frame
					hs.add_child(grip)
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
