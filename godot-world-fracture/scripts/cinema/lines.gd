extends RefCounted
## The voiced dialogue: data/dialogue/voices.json (written by tools/make_voices.py) indexes every line of the owner's
## campaign dialogue draft (campaign_draft1.json, ids M01_001 …) and Mission 01's opening (m01_opening.json, CINE_* and
## M01X_*) with its speaker, text and the length of its recording in audio/voices/lines/.
##
## PLAYER lines exist three times — <id>_m, <id>_f, <id>_r — and play in the voice of the body the player built (male,
## female, robot). Lines can be looked up by id, or by the [speaker, text] pair the game already shows as a subtitle.

const INDEX := "res://data/dialogue/voices.json"
const DIR := "res://audio/voices/lines/"
const CStore := preload("res://scripts/character/character_store.gd")

static var _data: Dictionary = {}

static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(INDEX, FileAccess.READ)
		if f:
			var v: Variant = JSON.parse_string(f.get_as_text())
			if v is Dictionary:
				_data = v
		if _data.is_empty():
			_data = { "lines": {}, "by_text": {} }
	return _data

static func has(id: String) -> bool:
	return data().lines.has(id)

static func speaker(id: String) -> String:
	return String(data().lines.get(id, {}).get("speaker", ""))

static func text(id: String) -> String:
	return String(data().lines.get(id, {}).get("text", ""))

## the recording's length in seconds (0 when there is none)
static func dur(id: String) -> float:
	return float(data().lines.get(id, {}).get("dur", 0.0))

## the id of a line shown as [speaker, text], or ""
static func find(spk: String, txt: String) -> String:
	return String(data().by_text.get(spk + "|" + txt, ""))

## the body the player built: "male", "female" or "robot"
static func body() -> String:
	if CStore.exists():
		return String(CStore.load_look().get("body", "male"))
	return "male"

## the recording to play for a line, in the player's voice when the player says it
static func path(id: String, for_body := "") -> String:
	var e: Dictionary = data().lines.get(id, {})
	if e.is_empty():
		return ""
	var variants: Array = e.get("variants", [""])
	var v := ""
	if variants.size() > 1 or (variants.size() == 1 and String(variants[0]) != ""):
		var b := for_body if for_body != "" else body()
		v = { "female": "_f", "robot": "_r" }.get(b, "_m")
		if not variants.has(v):
			v = String(variants[0])
	return DIR + id + v + ".ogg"

## [speaker, text] for a line id (the shape the mission's subtitles take)
static func pair(id: String) -> Array:
	return [speaker(id), text(id)]
