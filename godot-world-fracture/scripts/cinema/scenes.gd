extends RefCounted
## The owner's directed scenes (cinematic dialogue packages, Phase 2 + 3, Nov 11): data/dialogue/scenes.json groups the
## campaign draft's voiced lines (lines.gd) into scenes with a location, a camera note and a sound bed, per mission. This
## turns a mission's scenes into shots for the game's two cutscene players — the cinema player (scripts/cinema/cutscene.gd,
## Mission 01's) and the mission beats (scripts/mission/cutscene.gd, the descent's) — rather than adding a third player.
## The camera notes are directions, not paths: a note is read for its framing (wide / tight / over-the-shoulder / tracking)
## and whether it is handheld. Branch scenes ("branch:<choice>", Mission 05's cooperate / independent) are alternatives:
## a chain carries only the chosen one, and stops before them while no choice is made.

const DATA := "res://data/dialogue/scenes.json"
const MCut := preload("res://scripts/mission/cutscene.gd")
const Lines := preload("res://scripts/cinema/lines.gd")

static var _data: Dictionary = {}

static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(DATA, FileAccess.READ)
		if f:
			var d: Variant = JSON.parse_string(f.get_as_text())
			if d is Dictionary:
				_data = d
	return _data

static func scene(id: String) -> Dictionary:
	for s in data().get("scenes", []):
		if String(s.id) == id:
			return s
	return {}

## the choices a mission offers (the "branch:<name>" scenes), in order
static func choices(mission: String) -> Array[String]:
	var out: Array[String] = []
	for s in data().get("scenes", []):
		var t := String(s.get("transition", ""))
		if String(s.mission) == mission and t.begins_with("branch:"):
			out.append(t.substr(7))
	return out

## the mission's scenes in order: every scene that is not a branch, then the chosen branch's scenes; with no choice
## made the chain ends where the branches start (the caller asks, then plays chain(mission, choice) from there)
static func chain(mission: String, choice := "", from_branch := false) -> Array[String]:
	var out: Array[String] = []
	for s in data().get("scenes", []):
		if String(s.mission) != mission:
			continue
		var t := String(s.get("transition", ""))
		if t.begins_with("branch:"):
			if choice != "" and t.substr(7) == choice:
				out.append(String(s.id))
		elif not from_branch:
			out.append(String(s.id))
	return out

## a camera note read for its framing: "wide", "close", "ots" (over the shoulder) or "track"
static func framing(note: String) -> String:
	var n := note.to_lower()
	if n.contains("over-shoulder") or n.contains("over shoulder") or n.contains("over-the-shoulder"):
		return "ots"
	if n.contains("tight") or n.contains("close"):
		return "close"
	if n.contains("wide") or n.contains("establish") or n.contains("aerial"):
		return "wide"
	return "track"

static func handheld(note: String) -> bool:
	return note.to_lower().contains("handheld")

static func voiced_seconds(ids: Array) -> float:
	var t := 0.0
	for id in ids:
		t += (Lines.dur(String(id)) if Lines.has(String(id)) else 2.5) + 0.35
	return t


## shots for the cinema player (scripts/cinema/cutscene.gd): one shot per scene, framed between the player at `p` and the
## person they talk to at `other` (the same point for a voice with no body); the first scene of the chain opens on a
## title card — the mission and the place — and every scene's location rides along as its caption
static func cinema_shots(ids: Array, p: Vector3, other: Vector3, title := "") -> Array:
	var shots: Array = []
	var mid := (p + other) * 0.5 + Vector3(0, 1.5, 0)
	var across := (other - p)
	across.y = 0.0
	if across.length() < 0.5:
		across = Vector3(0, 0, -1)
	across = across.normalized()
	var side := Vector3(-across.z, 0, across.x)
	for k in ids.size():
		var s := scene(String(ids[k]))
		if s.is_empty():
			continue
		var note := String(s.get("camera", ""))
		var f := framing(note)
		var lines: Array = s.get("line_ids", [])
		var pos: Array
		var look: Variant = mid
		var fov: Variant = 48.0
		match f:
			"wide":
				pos = [mid + side * 7.0 + Vector3(0, 2.6, 0) - across * 3.0, mid + side * 9.0 + Vector3(0, 3.4, 0) - across * 4.0]
				fov = [52.0, 48.0]
			"close":
				pos = [mid + side * 2.4 + Vector3(0, 0.2, 0), mid + side * 1.9 + Vector3(0, 0.15, 0)]
				fov = [40.0, 36.0]
			"ots":
				# behind the player's shoulder, onto the one they face
				pos = [p - across * 1.6 + side * 0.55 + Vector3(0, 1.75, 0), p - across * 1.3 + side * 0.5 + Vector3(0, 1.7, 0)]
				look = other + Vector3(0, 1.55, 0)
				fov = [44.0, 40.0]
			_:
				pos = [mid + side * 4.0 - across * 2.0 + Vector3(0, 0.6, 0), mid + side * 3.2 + across * 1.0 + Vector3(0, 0.5, 0)]
				fov = [46.0, 44.0]
		var shot := { "dur": maxf(3.0, voiced_seconds(lines) + 0.8), "pos": pos, "look": look, "fov": fov, "lines": lines, "line_at": 0.5 }
		if handheld(note):
			shot.shake = 0.12
		if k == 0:
			shot.fade_in = 0.6
			if title != "":
				shot.title = [title, String(s.get("location", ""))]
				shot.title_at = 0.3
				shot.title_for = 3.0
				shot.line_at = 2.6
				shot.dur = float(shot.dur) + 2.2
		if k == ids.size() - 1:
			shot.fade_out = 0.6
		shots.append(shot)
	return shots

## beats for the mission cutscene (scripts/mission/cutscene.gd): every line of the scenes, the camera orbiting `look`,
## closer for close / over-the-shoulder notes and wider for wide ones, each line a step further round
static func descent_beats(ids: Array, look: Vector3, deg0 := 0.0) -> Array:
	var beats: Array = []
	var deg := deg0
	for id in ids:
		var s := scene(String(id))
		var f := framing(String(s.get("camera", "")))
		var radius := { "wide": 11.0, "close": 5.5, "ots": 6.0 }.get(f, 8.0) as float
		for lid in s.get("line_ids", []):
			beats.append(MCut.line(String(lid), look, { "orbit": { "radius": radius, "height": 2.4 if radius < 7.0 else 3.2, "deg0": deg, "deg1": deg + 40.0 } }))
			deg += 40.0
	return beats
