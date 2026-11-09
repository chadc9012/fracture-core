extends RefCounted
## The radio (schedule step 8; a port of src/game/radio-stations.ts over data/radio.json, exported by
## scripts/export-godot-radio.ts): the owner's stations that have recordings, each a linear broadcast — tuning in plays the
## station's short ID, then the rotation in order, and after every `ad_every` programs one original commercial (never
## mid-song). Pure: `on_air()` says what plays now, `advance()` moves past the item that just finished, `tune()` picks a
## station. The Audio autoload streams it; the saved station id lives in the player's settings ("radio").

const PATH := "res://data/radio.json"

static var _data: Dictionary = {}

var station := ""          # "" = off
var intro := true           # the station ID still to play
var program := 0
var since_ad := 0
var ad := 0
var ad_break := false

static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(PATH, FileAccess.READ)
		var parsed: Variant = JSON.parse_string(f.get_as_text()) if f else null
		_data = parsed if parsed is Dictionary else { "stations": [], "ads": [], "adEvery": 2 }
	return _data

static func stations() -> Array:
	return data().stations

static func station_def(id: String) -> Dictionary:
	for s in stations():
		if String(s.id) == id:
			return s
	return {}

static func station_ids() -> Array[String]:
	var out: Array[String] = []
	for s in stations():
		out.append(String(s.id))
	return out

## the station after `id` on the dial ("" → the first; the last → off)
static func next_station(id: String) -> String:
	var ids := station_ids()
	if ids.is_empty():
		return ""
	if id == "":
		return ids[0]
	var i := ids.find(id)
	return "" if i < 0 or i == ids.size() - 1 else ids[i + 1]

func tune(id: String) -> void:
	station = id
	intro = true
	program = 0
	since_ad = 0
	ad = 0
	ad_break = false

## what plays now: {title, artist, path, advertisement, ident}, or {} when off
func on_air() -> Dictionary:
	var def := station_def(station)
	if def.is_empty():
		return {}
	var ident: Variant = def.get("ident")
	if intro and ident is Dictionary:
		return { "title": String(ident.title), "artist": String(ident.artist), "path": String(ident.path), "advertisement": false, "ident": true }
	if ad_break:
		var ads: Array = data().ads
		if not ads.is_empty():
			var a: Dictionary = ads[ad % ads.size()]
			return { "title": String(a.title), "artist": String(a.artist), "path": String(a.path), "advertisement": true, "ident": false }
	var tracks: Array = def.tracks
	if tracks.is_empty():
		return {}
	var t: Dictionary = tracks[maxi(0, program) % tracks.size()]
	return { "title": String(t.title), "artist": String(t.artist), "path": String(t.path), "advertisement": false, "ident": false }

## the item that was on air finished: the ID leads into the first program (it never counts toward an ad break), a finished
## program counts toward the next break, a finished ad returns to the music
func advance() -> void:
	if intro:
		intro = false
		ad_break = false
		return
	if ad_break:
		ad += 1
		since_ad = 0
		ad_break = false
		return
	program += 1
	since_ad += 1
	ad_break = since_ad >= int(data().get("adEvery", 2))

## the HUD line: "BLOCK SIGNAL · Kinggg Dream — Bodega Gate"
func line() -> String:
	var now := on_air()
	if now.is_empty():
		return "RADIO OFF"
	var def := station_def(station)
	if bool(now.ident):
		return "%s · tuning in" % String(def.name).to_upper()
	if bool(now.advertisement):
		return "%s · a word from %s" % [String(def.name).to_upper(), String(now.title)]
	return "%s · %s — %s" % [String(def.name).to_upper(), String(now.artist), String(now.title)]
