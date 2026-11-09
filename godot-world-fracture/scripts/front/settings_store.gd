extends RefCounted
## Player settings (user://settings.json), pure: graphics tier, look sensitivity and inversion, volumes. `tier()` resolves
## "auto" to the device (phone → medium); scripts/phone.gd and the views read it. Keep every option here, not in a view.

const PATH := "user://settings.json"
const DEFAULTS := { "graphics": "auto", "sensitivity": 1.0, "invert_look": false, "master": 0.8, "music": 0.7, "sfx": 0.9, "voices": 1.0, "simple_hud": true }
const TIERS := ["low", "medium", "high"]

static var _cache: Dictionary = {}

static func load_all() -> Dictionary:
	if not _cache.is_empty():
		return _cache
	var s := DEFAULTS.duplicate()
	if FileAccess.file_exists(PATH):
		var f := FileAccess.open(PATH, FileAccess.READ)
		var parsed: Variant = JSON.parse_string(f.get_as_text())
		if parsed is Dictionary:
			for k in parsed:
				s[k] = parsed[k]
	_cache = s
	return s

static func save(s: Dictionary) -> void:
	_cache = s
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	f.store_string(JSON.stringify(s))

static func get_value(key: String) -> Variant:
	return load_all().get(key, DEFAULTS.get(key))

static func set_value(key: String, v: Variant) -> void:
	var s := load_all()
	s[key] = v
	save(s)

## the graphics tier in force: the saved one, or by device when "auto"
static func tier() -> String:
	var g := String(get_value("graphics"))
	if g in TIERS:
		return g
	return "medium" if (OS.has_feature("mobile") or OS.get_name() in ["Android", "iOS"]) else "high"

static func sensitivity() -> float:
	return clampf(float(get_value("sensitivity")), 0.3, 3.0)

static func invert() -> bool:
	return bool(get_value("invert_look"))
