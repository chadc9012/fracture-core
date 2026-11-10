extends RefCounted
## Static front for the Audio autoload (scripts/audio/audio.gd), for every script that makes sound: `Sound.sfx("rifle")`.
## The autoload registers itself in `inst`; without one (the headless `--script` tests, where autoload names do not
## resolve at compile time) every call is a silent no-op, so the pure rules stay testable and never depend on the mixer.

static var inst: Node = null

static func sfx(name: String, volume_db := 0.0, jitter := 0.08) -> void:
	if inst:
		inst.sfx(name, volume_db, jitter)

static func sfx_at(name: String, at: Vector3, from: Vector3, volume_db := 0.0) -> void:
	if inst:
		inst.sfx_at(name, at, from, volume_db)

static func loop(key: String, name: String, volume_db := -6.0, pitch := 1.0) -> void:
	if inst:
		inst.loop(key, name, volume_db, pitch)

static func loop_set(key: String, pitch: float, volume_db: float) -> void:
	if inst:
		inst.loop_set(key, pitch, volume_db)

static func loop_stop(key: String) -> void:
	if inst:
		inst.loop_stop(key)

static func loops_stop() -> void:
	if inst:
		inst.loops_stop()

static func ambience(bed: String, volume_db := -10.0) -> void:
	if inst:
		inst.ambience(bed, volume_db)

static func bed_for(region_or_style: String) -> String:
	return inst.bed_for(region_or_style) if inst else "nexus-hum"

static func music(path: String, volume_db := -6.0) -> void:
	if inst:
		inst.music(path, volume_db)

static func music_stop() -> void:
	if inst:
		inst.music_stop()

static func radio_on(station: String) -> void:
	if inst:
		inst.radio_on(station)

static func radio_next() -> void:
	if inst:
		inst.radio_next()

static func radio_off() -> void:
	if inst:
		inst.radio_off()

static func radio_station() -> String:
	return String(inst.radio.station) if inst else ""

static func radio_line() -> String:
	return inst.radio_line() if inst else "RADIO OFF"

static func voice(id: String) -> void:
	if inst:
		inst.voice(id)

## play a voiced line by its file (scripts/cinema/lines.gd path()); returns its length in seconds, 0 if none
static func voice_path(path: String) -> float:
	return inst.voice_path(path) if inst else 0.0

static func voice_stop() -> void:
	if inst:
		inst.voice_stop()
