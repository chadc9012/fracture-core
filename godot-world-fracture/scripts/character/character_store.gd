extends RefCounted
## The player's character (user://character.json): body frame and type, the cut head, the sculpt, skin, hair, beard, markings,
## accessory and headgear, and the operator's name. Everything read back is checked against the catalogue, so an old or broken
## save still loads as a valid look.

const Rig := preload("res://scripts/character/character_rig.gd")
const Catalog := preload("res://scripts/character/catalog.gd")
const FaceMorphs := preload("res://scripts/character/face_morphs.gd")
const PATH := "user://character.json"
const WILD_HEADS := ["m-nomad"]

static func default_look() -> Dictionary:
	return clean({"frame": "goliath", "body": "male", "face": "m-veteran"}, true)

## applies a named face (face-catalog) to a look: head, sculpt, skin, marks, beard, hair, hair colour, accessory
static func apply_face(look: Dictionary, id: String) -> Dictionary:
	var f := Catalog.face(look.body, id)
	if f.is_empty():
		return look
	var out := look.duplicate(true)
	out.face = id
	out.head = f.head
	out.morphs = FaceMorphs.clean(f.get("morphs", {}))
	out.skin = f.skin
	out.marks = f.get("marks", []).duplicate()
	out.beard = f.get("beard", "clean")
	out.hair = f.get("hair", "authored")
	out.hairColor = f.get("hairColor", "natural")
	out.accessory = f.get("accessory", "none")
	return out

static func _in(key: String, v: Variant, fallback: String) -> String:
	return v if v is String and not Catalog.find(key, v).is_empty() else fallback

## a valid look from anything; `preset` applies the named face first when the look names one
static func clean(raw: Variant, preset := false) -> Dictionary:
	var r: Dictionary = raw if raw is Dictionary else {}
	var frame: String = r.get("frame", "goliath")
	if not Catalog.frames().any(func(f: Dictionary) -> bool: return f.id == frame):
		frame = "goliath"
	var body: String = r.get("body", "male")
	if body not in ["male", "female", "robot"]:
		body = "male"
	var look := {"frame": frame, "body": body, "name": str(r.get("name", "")).strip_edges().left(18)}
	# a look with no "face" (switching body, an old save) reads "" here; r.face would crash on the missing key
	var face_id: String = r.get("face", "") if r.get("face", "") is String else ""
	if preset and face_id != "" and not Catalog.face(body, face_id).is_empty():
		look = apply_face(look, face_id)
		for k: String in r:
			if k not in ["frame", "body", "face"]:
				look[k] = r[k]
	else:
		for k: String in r:
			look[k] = r[k]
		look.frame = frame
		look.body = body
	var head: String = look.get("head", "")
	if Catalog.heads(body).filter(func(h: Dictionary) -> bool: return h.id == head).is_empty():
		look.head = Catalog.default_head(frame, body)
	look.morphs = FaceMorphs.clean(look.get("morphs", {}))
	if body == "robot":
		look.skin = _in("plating", look.get("skin"), "steel")
		look.eyes = _in("optics", look.get("eyes"), "cyan")
		look.hair = "authored"
		look.beard = "clean"
		look.marks = []
	else:
		look.skin = _in("skin", look.get("skin"), "natural")
		var hair: String = look.get("hair", "authored")
		if Catalog.hair_for(body).filter(func(h: Dictionary) -> bool: return h.id == hair).is_empty():
			hair = "authored"
		# the Nomad head's own hair is too wild to cut away: it keeps it
		look.hair = "authored" if look.head in WILD_HEADS else hair
		look.beard = _in("beards", look.get("beard"), "clean")
		var marks: Array = []
		for m: Variant in look.get("marks", []):
			if m is String and not Catalog.find("markings", m).is_empty() and m not in marks and marks.size() < int(Catalog.data().get("maxMarkings", 4)):
				marks.append(m)
		look.marks = marks
	look.hairColor = _in("hairColors", look.get("hairColor"), "natural")
	look.accessory = _in("accessories", look.get("accessory"), "none")
	look.headgear = _in("headgear", look.get("headgear"), "none")
	# what the body wears (character_rig.gd WEAR): known ids only, none on a robot
	var wear_in: Variant = look.get("wear", [])
	var wear: Array = []
	if wear_in is Array and body != "robot":
		for w in wear_in:
			if String(w) in Rig.wear_ids() and not String(w) in wear:
				wear.append(String(w))
	look.wear = wear
	if not (look.get("face", "") is String) or Catalog.face(body, look.get("face", "")).is_empty():
		look.face = ""
	return look

static func exists() -> bool:
	return FileAccess.file_exists(PATH)

static func load_look() -> Dictionary:
	var f := FileAccess.open(PATH, FileAccess.READ)
	if not f:
		return default_look()
	return clean(JSON.parse_string(f.get_as_text()))

static func save_look(look: Dictionary) -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(clean(look)))
