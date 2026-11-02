extends RefCounted
## Best lap per vehicle, kept across sessions in user://drive_records.json (temp file, then renamed over the old one).
const PATH := "user://drive_records.json"
var best := {}   # vehicle id -> seconds
var laps := {}   # vehicle id -> total laps driven

func load_records(path := PATH) -> void:
	best = {}
	laps = {}
	if not FileAccess.file_exists(path):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (d is Dictionary):
		return
	for id in d.get("best", {}):
		var s := float(d.best[id])
		if s > 0.0:
			best[String(id)] = s
	for id in d.get("laps", {}):
		laps[String(id)] = maxi(0, int(d.laps[id]))

func save_records(path := PATH) -> bool:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify({ "best": best, "laps": laps }))
	f.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(path)) == OK

## one completed lap of `seconds`; returns true when it is a new best for this vehicle
func record(id: String, lap_seconds: float) -> bool:
	laps[id] = int(laps.get(id, 0)) + 1
	if lap_seconds <= 0.0:
		return false
	if not best.has(id) or lap_seconds < float(best[id]):
		best[id] = lap_seconds
		return true
	return false

func best_label(id: String) -> String:
	if not best.has(id):
		return "--"
	var s := float(best[id])
	return "%d:%05.2f" % [int(s) / 60, fmod(s, 60.0)]
