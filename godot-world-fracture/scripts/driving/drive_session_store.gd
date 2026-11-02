extends RefCounted
## Driving metadata kept apart from the garage save (which stays the authority on parts and damage): total distance per
## vehicle and the last vehicle driven, in user://drive_session.json.
const PATH := "user://drive_session.json"

static func load_data(path := PATH) -> Dictionary:
	var out := { "last_vehicle": "", "distance": {} }
	if not FileAccess.file_exists(path):
		return out
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	if d is Dictionary:
		out.last_vehicle = String(d.get("last_vehicle", ""))
		for id in d.get("distance", {}):
			out.distance[String(id)] = maxf(0.0, float(d.distance[id]))
	return out

## add one session's distance for `id`
static func save(id: String, distance_m: float, path := PATH) -> bool:
	var d := load_data(path)
	d.last_vehicle = id
	d.distance[id] = float(d.distance.get(id, 0.0)) + maxf(0.0, distance_m)
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(d))
	f.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(path)) == OK
