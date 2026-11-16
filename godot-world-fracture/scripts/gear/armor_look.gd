extends RefCounted
## The armour the operator wears, drawn on the body (owner Nov 15: equipped armour must show, at the quality of the
## reference sheets in docs/reference/armor/). Scene side of gear_store.gd's armour slots — the inventory's swap screen,
## the save, transmog and the hull bonus already live there; this only draws.
##
## The armour is an authored suit (a Meshy multi-view model of the reference turnaround, 4K PBR), fitted offline onto
## every operator body by scripts/build-armor-suit.py: scaled and placed on the body, skin weights copied from it, reduced
## to a phone budget and cut into the gear slots. Each body has its own fitted file,
##   models/operators/armor/<suit>/<frame>-<body>.glb
## holding one skinned mesh per slot (armor_helmet, armor_chest, armor_gauntlets, armor_legs, armor_classItem). Wearing
## a slot puts that mesh on the rig's skeleton, bound by bone name, so it moves through every clip like the body does.
## Under a helmet the face, hair and headgear are hidden (the suit's helmet is closed, visor and all).

const Gear := preload("res://scripts/gear/gear_store.gd")
const META := "armor_nodes"
const DIR := "res://models/operators/armor/%s/%s-%s.glb"
## the fitted suits, by the element of the set a slot shows: the Neon Sentinel (the armored-soldier sheet, plates and
## glowing trim) for the energy sets, the Tactical suit (the tactical-character sheets: hooded jacket, harness, bracers,
## knee armour, boots) for kinetic sets and the starting Field gear. The tactical character on the owner's sheet wears
## no helmet, so a helmet from a tactical set leaves the face showing (the Sentinel's closed helmet, with its shoulder
## fringe, did not suit the jacket).
const DEFAULT_SUIT := "neon-sentinel"
const SUIT_BY_ELEMENT := { "KINETIC": "tactical" }

static var _scenes: Dictionary = {}

## the suit a worn slot shows: the transmog look's set first, then the piece's own set, then the piece's element
static func suit_for(gear: Dictionary, slot: String) -> String:
	var it: Dictionary = Gear.worn(gear, slot)
	var sid := str(gear.get("transmog", {}).get(slot, ""))
	if sid == "":
		sid = str(it.get("set", ""))
	var el := str(Gear.armor_set(sid).get("element", "")) if sid != "" else ""
	if el == "":
		el = str(it.get("element", "KINETIC"))
	var suit: String = SUIT_BY_ELEMENT.get(el, DEFAULT_SUIT)
	return suit if ResourceLoader.exists(path_for(suit, { "frame": "goliath", "body": "male" })) else DEFAULT_SUIT

static func path_for(suit: String, look: Dictionary) -> String:
	return DIR % [suit, String(look.get("frame", "goliath")), String(look.get("body", "male"))]

## draw the worn armour on `rig` (a character_rig.gd); call again whenever the gear changes. Robots wear none.
static func apply(rig: Node3D, gear: Dictionary) -> void:
	if not rig or not rig.skeleton:
		return
	clear(rig)
	# robots wear none, and nor does the operator in regular clothes (at home in Mission 01)
	if String(rig.look.get("body", "")) == "robot" or bool(rig.look.get("civ", false)):
		return
	var nodes: Array = []
	var helmet := false
	for slot in Gear.ARMOR_SLOTS:
		if Gear.worn(gear, slot).is_empty():
			continue
		var mi := _piece(rig, suit_for(gear, slot), slot)
		if mi:
			nodes.append(mi)
			if slot == "helmet":
				helmet = true
	rig.set_meta(META, nodes)
	for n in _head_parts(rig):
		n.visible = not helmet
	# the body under the worn pieces is hidden, so its own plates never poke through the suit
	var worn: Array = []
	for n in nodes:
		worn.append(String(n.name).trim_prefix("Armor_"))
	# the neck goes under a helmet or a chest piece (the cuirass, the jacket's collar)
	if worn.has("helmet") or worn.has("chest"):
		worn.append("neck")
	_mask_body(rig, worn)

static func clear(rig: Node3D) -> void:
	for n in rig.get_meta(META, []):
		if is_instance_valid(n):
			# out of the tree now (a rebuild in the same frame must not find the old piece), freed at the frame's end
			if n.get_parent():
				n.get_parent().remove_child(n)
			n.queue_free()
	rig.set_meta(META, [])
	for n in _head_parts(rig):
		n.visible = true
	_mask_body(rig, [])

static func worn_count(rig: Node3D) -> int:
	return rig.get_meta(META, []).filter(func(n) -> bool: return is_instance_valid(n)).size()

## the face, the hair and anything riding the head bone (headgear, earrings)
static func _head_parts(rig: Node3D) -> Array:
	var out: Array = []
	if rig.head_mesh and is_instance_valid(rig.head_mesh):
		out.append(rig.head_mesh)
	if rig.hair_mesh and is_instance_valid(rig.hair_mesh):
		out.append(rig.hair_mesh)
		var p: Node = rig.hair_mesh.get_parent()
		if p:
			for c in p.get_children():
				if c != rig.hair_mesh and c is Node3D:
					out.append(c)
	return out

static var _mats: Dictionary = {}
## the suit's one material, shared by every body's fit: 4K colour, normal, metal/roughness, and its painted light lines
## (the cyan trim and red accents) lit as emission so they glow at night like the reference sheet's emissive map
static func material(suit: String) -> StandardMaterial3D:
	if _mats.has(suit):
		return _mats[suit]
	var d := "res://models/operators/armor/%s/" % suit
	var m := StandardMaterial3D.new()
	m.albedo_texture = load(d + "albedo.jpg")
	m.normal_enabled = true
	m.normal_texture = load(d + "normal.jpg")
	m.normal_scale = 1.0
	# glTF packs roughness in green and metal in blue
	var mr: Texture2D = load(d + "metal_rough.jpg")
	m.metallic = 1.0
	m.metallic_texture = mr
	m.metallic_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_BLUE
	m.roughness = 1.0
	m.roughness_texture = mr
	m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	if ResourceLoader.exists(d + "emission.jpg"):
		m.emission_enabled = true
		m.emission_texture = load(d + "emission.jpg")
		# multiply: the glow is the map itself (with ADD the white base colour lights the whole suit)
		m.emission_operator = BaseMaterial3D.EMISSION_OP_MULTIPLY
		m.emission = Color(1, 1, 1)
		m.emission_energy_multiplier = 1.6
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mats[suit] = m
	return m

## the slot's mesh from the fitted file, re-bound to this rig's skeleton by bone name
static func _piece(rig: Node3D, suit: String, slot: String) -> MeshInstance3D:
	var path := path_for(suit, rig.look)
	if not ResourceLoader.exists(path):
		# a body with no fit of its own wears the Titan fit of its type, then the Titan male
		path = path_for(suit, { "frame": "goliath", "body": rig.look.get("body", "male") })
		if not ResourceLoader.exists(path):
			path = path_for(suit, { "frame": "goliath", "body": "male" })
			if not ResourceLoader.exists(path):
				return null
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var src_root: Node = (_scenes[path] as PackedScene).instantiate()
	var src: MeshInstance3D = null
	for c in src_root.find_children("*", "MeshInstance3D", true, false):
		if String(c.name).begins_with("armor_" + slot):
			src = c
			break
	if not src:
		src_root.free()
		return null
	var sk: Skeleton3D = rig.skeleton
	var mi := MeshInstance3D.new()
	mi.name = "Armor_" + slot
	mi.mesh = src.mesh
	mi.material_override = material(suit)
	mi.skin = _bind(src.skin, src.get_node_or_null(src.skeleton) as Skeleton3D, sk)
	src_root.free()
	sk.add_child(mi)
	mi.skeleton = mi.get_path_to(sk)
	return mi

## the fitted file's skin, with each bind pointed at this skeleton's bone of the same name. Blender re-orients bones on
## export, so the file's bind poses are relative to ITS bones' rests: each is carried over to this skeleton's rest of the
## same bone (the joints sit in the same places, only the bone axes differ):  new = rest_to⁻¹ · rest_from · bind
static func _bind(skin: Skin, from: Skeleton3D, to: Skeleton3D) -> Skin:
	var s := Skin.new()
	for i in skin.get_bind_count():
		var nm := skin.get_bind_name(i)
		if nm == "" and from and skin.get_bind_bone(i) >= 0:
			nm = from.get_bone_name(skin.get_bind_bone(i))
		var bi := to.find_bone(nm)
		if bi < 0:
			bi = to.find_bone(nm.replace(":", "_"))
		bi = maxi(bi, 0)
		var pose := skin.get_bind_pose(i)
		var fi := from.find_bone(nm) if from else -1
		if fi >= 0:
			pose = to.get_bone_global_rest(bi).affine_inverse() * from.get_bone_global_rest(fi) * pose
		s.add_bind(bi, pose)
		s.set_bind_name(i, to.get_bone_name(bi))
	return s

## the gear slot a body bone belongs to (the same cut scripts/build-armor-suit.py makes in the suit)
static func slot_of(bone: String) -> String:
	var b := bone.substr(bone.rfind("_") + 1) if bone.rfind("_") >= 0 else bone
	b = b.substr(b.rfind(":") + 1)
	if b.begins_with("Neck"):
		return "neck"
	if b.begins_with("Head") or b == "headfront":
		return "helmet"
	if b.contains("ForeArm") or b.contains("Hand"):
		return "gauntlets"
	if b.contains("UpLeg") or b.ends_with("Leg") or b.contains("Foot") or b.contains("Toe"):
		return "legs"
	if b == "Hips":
		return "classItem"
	return "chest"

static var _masked: Dictionary = {}

## swap the body mesh for a copy without the triangles that the worn slots cover (the original comes back with none)
static func _mask_body(rig: Node3D, worn: Array) -> void:
	var body: MeshInstance3D = null
	for c in rig.body_root.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		if mi == rig.head_mesh or mi == rig.hair_mesh or not mi.skin or String(mi.name).begins_with("Armor_"):
			continue
		if not body or (mi.mesh and body.mesh and mi.mesh.get_surface_count() > 0 and mi.mesh.surface_get_array_len(0) > body.mesh.surface_get_array_len(0)):
			body = mi
	if not body:
		return
	if not body.has_meta("armor_full_mesh"):
		body.set_meta("armor_full_mesh", body.mesh)
	var full: Mesh = body.get_meta("armor_full_mesh")
	var overrides: Array = []
	for i in body.get_surface_override_material_count():
		overrides.append(body.get_surface_override_material(i))
	if worn.is_empty():
		body.mesh = full
	else:
		var ws := worn.duplicate()
		ws.sort()
		var key := "%d|%s" % [full.get_instance_id(), ",".join(ws)]
		if not _masked.has(key):
			if _masked.size() > 32:
				_masked.clear()
			_masked[key] = _cut(full, body.skin, rig.skeleton, worn)
		body.mesh = _masked[key]
	for i in mini(overrides.size(), body.get_surface_override_material_count()):
		body.set_surface_override_material(i, overrides[i])

static func _cut(full: Mesh, skin: Skin, sk: Skeleton3D, worn: Array) -> ArrayMesh:
	# the slot of each skin bind
	var bind_slot: Array[String] = []
	for b in skin.get_bind_count():
		var nm := skin.get_bind_name(b)
		if nm == "" and skin.get_bind_bone(b) >= 0:
			nm = sk.get_bone_name(skin.get_bind_bone(b))
		bind_slot.append(slot_of(nm))
	var out := ArrayMesh.new()
	for si in full.get_surface_count():
		var arr := full.surface_get_arrays(si)
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		if idx.is_empty():
			idx.resize(vs.size())
			for i in vs.size():
				idx[i] = i
		var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
		var wts: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
		var k := bones.size() / maxi(vs.size(), 1)
		var hidden := PackedByteArray()
		hidden.resize(vs.size())
		for v in vs.size():
			var best := 0
			var bw := -1.0
			for j in k:
				if wts[v * k + j] > bw:
					bw = wts[v * k + j]
					best = bones[v * k + j]
			hidden[v] = 1 if best < bind_slot.size() and bind_slot[best] in worn else 0
		var keep := PackedInt32Array()
		for t in range(0, idx.size(), 3):
			if hidden[idx[t]] + hidden[idx[t + 1]] + hidden[idx[t + 2]] >= 2:
				continue
			keep.append(idx[t]); keep.append(idx[t + 1]); keep.append(idx[t + 2])
		if keep.is_empty():
			# keep one degenerate triangle so surface indices (and their materials) stay where they were
			keep = PackedInt32Array([0, 0, 0])
		arr[Mesh.ARRAY_INDEX] = keep
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		out.surface_set_material(si, full.surface_get_material(si))
	return out
