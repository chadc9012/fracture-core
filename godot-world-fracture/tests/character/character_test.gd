extends SceneTree
## Character creation: the catalogue, the sculpt, the save, and building every body, head, face, hairstyle and gear.

const Catalog := preload("res://scripts/character/catalog.gd")
const FaceMorphs := preload("res://scripts/character/face_morphs.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Rig := preload("res://scripts/character/character_rig.gd")
const SkinShader := preload("res://scripts/character/skin_shader.gd")
const HairBuilder := preload("res://scripts/character/hair_builder.gd")

var checks := 0
var failed := 0
func ok(c: bool, what: String) -> void:
	checks += 1
	if not c:
		failed += 1
		print("FAIL: ", what)

func _init() -> void:
	ok(Catalog.faces("male").size() >= 21 and Catalog.faces("female").size() >= 20 and not Catalog.face("male", "m-ronin").is_empty(), "the board's 20 male and 20 female faces, plus Ronin from the owner's operator sheet")
	ok(Catalog.list("morphs").size() == 10, "ten sculpt sliders")
	for b: String in ["male", "female"]:
		for f: Dictionary in Catalog.faces(b):
			ok(not Catalog.head(b, f.head).is_empty() and Catalog.head(b, f.head).id == f.head, "%s head %s exists" % [f.id, f.head])
			var fl := Store.apply_face(Store.clean({"body": b}), f.id)
			ok(Catalog.hair_for(b).any(func(h: Dictionary) -> bool: return h.id == Store.clean(fl).hair) or Store.clean(fl).hair == "authored", "%s hair loads valid on %s" % [f.id, b])
			for m: String in f.get("marks", []):
				ok(not Catalog.find("markings", m).is_empty(), "%s mark %s" % [f.id, m])
	ok(FaceMorphs.displacement({}, Vector3(0, 0.04, 0.1)) == Vector3.ZERO, "no sculpt moves nothing")
	ok(FaceMorphs.displacement({"nose": 1.0}, Vector3(0, 0.042, 0.1)).z > 0.005, "a bigger nose comes forward")
	ok(FaceMorphs.displacement({"nose": 1.0}, Vector3(0, 0.1, -0.09)).length() < 1e-6, "the back of the head stays put")
	ok(FaceMorphs.clean({"jaw": 3, "bogus": 1, "chin": 0}) == {"jaw": 1.0}, "sculpt values clamp and unknowns drop")
	var dl := Store.default_look()
	ok(dl.head == "m-veteran" and dl.beard == "stubble", "the default look is the Veteran face")
	var bad := Store.clean({"body": "dragon", "skin": "plaid", "marks": ["freckles", "freckles", "nope", "scar-eye", "scar-lip", "scar-jaw", "scar-neck"]})
	ok(bad.body == "male" and bad.skin == "natural" and bad.marks.size() == 4, "a broken save loads valid")
	var rob := Store.clean({"body": "robot", "frame": "nyx", "hair": "afro", "beard": "full"})
	ok(rob.hair == "authored" and rob.beard == "clean" and rob.skin == "steel" and rob.head == "r-twin", "robots take plating, no hair")
	var cy := Store.apply_face(Store.clean({"body": "female", "frame": "nyx"}), "f-cyber")
	ok(cy.accessory == "eyepiece" and cy.hair == "shaved-sides" and cy.hairColor == "neon", "a named face sets its gear and hair")
	Store.save_look(cy)
	ok(Store.exists() and Store.load_look().face == "f-cyber", "the look saves and loads")
	# shaders compile for every beard and marking
	var all_marks: Array = []
	for m: Dictionary in Catalog.list("markings"):
		all_marks.append(m.id)
	for beard: Dictionary in Catalog.list("beards"):
		var code := SkinShader.code(2, beard.id, all_marks.slice(0, 4), true)
		ok(code.contains("void fragment()"), "shader for beard " + beard.id)
	# every hairstyle builds on the default skull
	var hb := HairBuilder.new()
	for h: Dictionary in Catalog.list("hair"):
		var m := hb.build(h)
		ok((m != null) == (h.kind == "built"), "hair " + h.id)
		if m:
			ok(m.get_surface_count() == 1 and m.surface_get_array_len(0) > 30, "hair %s has geometry" % h.id)
	# build every frame × body, and every head
	var root := Node3D.new()
	get_root().add_child(root)
	for fr: Dictionary in Catalog.frames():
		for b: String in ["male", "female", "robot"]:
			var r := Rig.new()
			root.add_child(r)
			r.build(Store.clean({"frame": fr.id, "body": b, "face": Catalog.faces(b)[0].id if b != "robot" else ""}, true), false)
			ok(r.head_mesh != null and r.head_mesh.mesh.get_surface_count() > 0, "%s %s builds with a head" % [fr.id, b])
			ok(r.head_point.y > 1.2, "%s %s head sits on the shoulders" % [fr.id, b])
			r.free()
	for b: String in ["male", "female", "robot"]:
		for h: Dictionary in Catalog.heads(b):
			var r2 := Rig.new()
			root.add_child(r2)
			r2.build(Store.clean({"frame": "goliath", "body": b, "head": h.id, "hair": "afro" if b != "robot" else "", "accessory": "glasses", "headgear": "cap", "morphs": {"jaw": 0.5}}), false)
			ok(r2.head_mesh != null, "head %s on %s" % [h.id, b])
			r2.free()
	# what the body wears (character_rig.gd WEAR): the store keeps known ids once each, none on a robot; the rig hangs
	# each piece on its bone (an attachment per piece, two for earrings and rings) and clears them on a rebuild
	var w := Store.clean({"frame": "goliath", "body": "male", "wear": ["watch", "chain", "watch", "bogus", "backpack"]})
	ok(w.wear == ["watch", "chain", "backpack"], "wear keeps known ids once each: " + str(w.wear))
	ok(Store.clean({"frame": "goliath", "body": "robot", "wear": ["watch"]}).wear == [], "a robot wears nothing")
	var rw := Rig.new()
	root.add_child(rw)
	rw.build(Store.clean({"frame": "goliath", "body": "female", "wear": ["chain", "earrings", "watch", "backpack", "rings"]}), false)
	ok(rw._wear_nodes.size() == 7, "five pieces hang on seven bone attachments: %d" % rw._wear_nodes.size())
	# outside a running tree the attachments have no global transform: read the design through the bone's rest
	var at_w: BoneAttachment3D = rw._wear_nodes[3]
	var wrist := (rw.skeleton.get_bone_global_rest(at_w.bone_idx) * (at_w.get_child(0) as Node3D).transform).origin
	var at_n: BoneAttachment3D = rw._wear_nodes[0]
	var neck := (rw.skeleton.get_bone_global_rest(at_n.bone_idx) * (at_n.get_child(0) as Node3D).transform).origin
	ok(wrist.x > 0.3 and absf(wrist.y - 0.98) < 0.1, "the watch sits at the left wrist " + str(wrist))
	ok(absf(neck.y - 1.3) < 0.08, "the chain hangs at the collar " + str(neck))
	rw.build(Store.clean({"frame": "goliath", "body": "female", "wear": []}), false)
	ok(rw._wear_nodes.is_empty(), "a rebuild without wear clears it")
	rw.free()
	root.free()
	print("character: %d checks, %d failed" % [checks, failed])
	quit(1 if failed else 0)
