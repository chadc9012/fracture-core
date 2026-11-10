extends RefCounted
## The character-creation catalogue (data/character.json, exported from the web game by scripts/export-godot-character.ts):
## bodies, cut heads, the 40 named faces, sculpt sliders, skin tones, plating and optics, hairstyles, hair colours, beards,
## markings with their head-space shapes, accessories and headgear. Static lookups only.

const PATH := "res://data/character.json"
static var _data: Dictionary = {}

static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(PATH, FileAccess.READ)
		if f:
			var v: Variant = JSON.parse_string(f.get_as_text())
			if v is Dictionary:
				_data = v
	return _data

static func list(key: String) -> Array:
	return data().get(key, [])

static func find(key: String, id: String) -> Dictionary:
	for e: Dictionary in list(key):
		if e.get("id", "") == id:
			return e
	return {}

static func frames() -> Array: return list("frames")
static func heads(body: String) -> Array: return data().get("heads", {}).get(body, [])
static func faces(body: String) -> Array: return data().get("faces", {}).get(body, [])
static func face(body: String, id: String) -> Dictionary:
	for e: Dictionary in faces(body):
		if e.get("id", "") == id:
			return e
	return {}
static func head(body: String, id: String) -> Dictionary:
	for e: Dictionary in heads(body):
		if e.get("id", "") == id:
			return e
	var hs := heads(body)
	return hs[0] if hs.size() else {}

## hairstyles a body can wear (robots none)
static func hair_for(body: String) -> Array:
	var out: Array = []
	if body == "robot":
		return out
	for h: Dictionary in list("hair"):
		if body in h.get("bodies", []):
			out.append(h)
	return out

static func default_head(frame: String, body: String) -> String:
	var cls := "TITAN"
	for fr: Dictionary in frames():
		if fr.id == frame:
			cls = fr["class"]
	return data().get("defaultFace", {}).get(cls, {}).get(body, heads(body)[0].id if heads(body).size() else "")

## a swatch's colour, or null for "as modelled" (empty hex)
static func swatch(key: String, id: String) -> Variant:
	var s := find(key, id)
	var hex: String = s.get("hex", "")
	return Color(hex) if hex != "" else null

static func body_path(frame: String, body: String, civ := false) -> String:
	# in regular clothes (the creator, home in Mission 01): the same build dressed in a sweater, jeans and trainers
	# (scripts/build-operator-civilian.py); a robot has no other clothes
	if civ and body != "robot":
		return "res://models/operators/bodies/civ-%s-%s.glb" % [frame, body]
	return "res://models/operators/bodies/%s-%s.glb" % [frame, body]

## the creator calls the three builds by the body they make, not by the armour that is fitted to them later
const BUILDS := { "nyx": ["SLIM", "Lean and light"], "cipher": ["ATHLETIC", "Average height, fit"], "goliath": ["HEAVY", "Broad, big frame"] }

static func head_path(id: String) -> String:
	return "res://models/operators/heads/%s.glb" % id
