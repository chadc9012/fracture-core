extends SceneTree
## Worn armour on the operator (scripts/gear/armor_look.gd): every equipped armour slot puts its piece of the fitted suit
## on the body's skeleton, bound by bone name; the body under it is cut away; a helmet hides the face and hair; taking a
## piece off removes it and gives the body back; robots and the operator in regular clothes wear none. Every frame and
## body type has its own fit.
##   godot --headless --path godot-world-fracture --script res://tests/gear/armor_look_test.gd
const Rig := preload("res://scripts/character/character_rig.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const ArmorLook := preload("res://scripts/gear/armor_look.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func suit(slots: Array) -> Dictionary:
	var g := Gear.fresh()
	g.equipped = {}
	for slot in slots:
		var id: String = "t-" + str(slot)
		g.items.append({ "id": id, "name": slot, "slot": slot, "power": 120, "level": 1, "element": "ARC", "set": "dragonite", "frame": "", "cls": "" })
		g.equipped[slot] = id
	return g

func rig_for(frame: String, body: String) -> Node3D:
	var look: Dictionary = Store.default_look()
	look.frame = frame
	look.body = body
	look = Store.clean(look)
	var r = Rig.new()
	get_root().add_child(r)
	r.build(look, false)
	return r

func body_tris(r: Node3D) -> int:
	var best := 0
	for c in r.body_root.find_children("*", "MeshInstance3D", true, false):
		if c == r.head_mesh or c == r.hair_mesh or String(c.name).begins_with("Armor_") or not c.mesh:
			continue
		var n := 0
		for s in c.mesh.get_surface_count():
			var a: Array = c.mesh.surface_get_arrays(s)
			n += (a[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3 if a[Mesh.ARRAY_INDEX] != null else 0
		best = maxi(best, n)
	return best

func _init() -> void:
	for frame in ["goliath", "nyx", "cipher"]:
		for body in ["male", "female"]:
			ok(ResourceLoader.exists(ArmorLook.path_for(ArmorLook.DEFAULT_SUIT, { "frame": frame, "body": body })), "%s %s has its own fit" % [frame, body])
	var r := rig_for("goliath", "male")
	var full := body_tris(r)
	ArmorLook.apply(r, suit(Gear.ARMOR_SLOTS))
	ok(ArmorLook.worn_count(r) == 5, "the whole suit worn: %d pieces" % ArmorLook.worn_count(r))
	var pieces: Array = r.get_meta(ArmorLook.META, [])
	var bound := pieces.all(func(n) -> bool: return n is MeshInstance3D and n.get_parent() == r.skeleton and n.skin and n.skin.get_bind_count() > 20)
	ok(bound, "every piece rides the body's skeleton with its own skin")
	ok(pieces.all(func(n) -> bool: return n.material_override is StandardMaterial3D and n.material_override.albedo_texture and n.material_override.albedo_texture.get_width() >= 4096), "the pieces wear the suit's 4K material")
	ok(not r.head_mesh.visible, "a helmet hides the face")
	ok(body_tris(r) < full / 4, "the body under the suit is cut away: %d of %d triangles left" % [body_tris(r), full])
	ArmorLook.apply(r, suit(["chest", "legs"]))
	ok(ArmorLook.worn_count(r) == 2, "chest and legs only: 2 pieces")
	ok(r.head_mesh.visible, "no helmet: the face shows")
	var part := body_tris(r)
	ok(part < full / 2 and part > full / 10, "only the covered body is cut (arms, hands, hips stay): %d of %d" % [part, full])
	ArmorLook.apply(r, suit([]))
	ok(ArmorLook.worn_count(r) == 0 and body_tris(r) == full, "nothing worn: no pieces, the whole body back")
	# the starting save wears the Field Helmet only
	var fresh := Gear.fresh()
	var want := Gear.ARMOR_SLOTS.filter(func(sl: String) -> bool: return not Gear.worn(fresh, sl).is_empty()).size()
	ArmorLook.apply(r, fresh)
	ok(ArmorLook.worn_count(r) == want, "a fresh save shows its starting armour: %d pieces" % want)
	r.free()
	var rob := rig_for("goliath", "robot")
	ArmorLook.apply(rob, suit(Gear.ARMOR_SLOTS))
	ok(ArmorLook.worn_count(rob) == 0, "robots wear none")
	rob.free()
	for frame in ["nyx", "cipher"]:
		var f := rig_for(frame, "female")
		ArmorLook.apply(f, suit(Gear.ARMOR_SLOTS))
		ok(ArmorLook.worn_count(f) == 5, "%s female wears the whole suit" % frame)
		f.free()
	print("armor look test: " + str(fails == 0))
	quit(0 if fails == 0 else 1)
