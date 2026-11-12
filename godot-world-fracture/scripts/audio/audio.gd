extends Node
## The `Audio` autoload (schedule step 8: sound). One place every system asks for sound, on the four buses the settings
## screen controls (default_bus_layout.tres: Master, Music, SFX, Voices):
##  - `sfx(name)` / `sfx_at(name, at, from)`: a cue from audio/sfx (scripts/build-sfx.py builds the set; an authored WAV of
##    the same name replaces one), from a pool, with a little pitch jitter so repeats never machine-gun; `sfx_at` fades
##    with distance from the listener the caller names (the SubViewports have their own worlds, so distance is done here
##    rather than with AudioStreamPlayer3D)
##  - `loop(key, name)` / `loop_set` / `loop_stop`: engines, rotors, wind — one looping player per key, pitched live
##  - `ambience(bed)`: the regional bed from audio/ambience (the web's AMBIENCE_FILES map, `bed_for(region)`), crossfaded
##  - `music(path)` / `music_stop()`: the title's music; `radio_on(station)` / `radio_next()` / `radio_off()` stream the
##    broadcast (scripts/audio/radio.gd) on the Music bus
##  - `voice(id)`: a recorded line from audio/voices on the Voices bus, ducking the music while it speaks
## Every path is checked with ResourceLoader.exists so a missing file is silence, never an error, and everything runs
## headless (the Dummy driver) so the tests can play through.

const Radio := preload("res://scripts/audio/radio.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Settings := preload("res://scripts/front/settings_store.gd")
const SFX_DIR := "res://audio/sfx/"
const AMBIENCE_DIR := "res://audio/ambience/"
const VOICE_DIR := "res://audio/voices/"
const POOL := 24             # a tank salvo, a burst and the hit ticks at once (Nov 11)
const HEAR_FULL := 4.0        # m: no attenuation inside
const HEAR_FAR := 90.0        # m: silent beyond
const DUCK_DB := -9.0

## the web's regional beds (audio.ts AMBIENCE_FILES), plus the street styles
const BEDS := { "veridan": "forest-wilds", "swamps": "swamp-marsh", "thalassia": "underwater-city", "nexus": "nexus-hum", "frostspire": "frost-spire", "solara": "solara-dunes", "wastelands": "wasteland-wind", "ember": "ember-peaks",
	"neon": "nexus-hum", "neon-city": "nexus-hum", "riverdale": "nexus-hum", "miami": "underwater-city", "coast": "underwater-city", "sky": "wasteland-wind",
	"storm": "wasteland-wind", "crystal-badlands": "solara-dunes", "shattered-reefs": "underwater-city", "goldenreach": "forest-wilds", "old-harrow": "forest-wilds", "floating-islands": "wasteland-wind" }

var radio := Radio.new()
var _pool: Array[AudioStreamPlayer] = []
var _pool_i := 0
var _loops: Dictionary = {}          # key → AudioStreamPlayer
var _amb_a: AudioStreamPlayer
var _amb_b: AudioStreamPlayer
var _amb_bed := ""
var _amb_fade := 0.0                 # 0 → a is live, 1 → b is live
var _amb_to_b := false
var _music: AudioStreamPlayer
var _music_base_db := 0.0
var _voice: AudioStreamPlayer
var _streams: Dictionary = {}
## what the last call played, for the tests and the HUD: ["sfx", name] / ["voice", id] / ["radio", path]
var last: Array = []
var played: Array[String] = []

func _init() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Sound.inst = self
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_pool.append(p)
	_amb_a = _player("SFX")
	_amb_b = _player("SFX")
	_music = _player("Music")
	_music.finished.connect(_on_music_finished)
	_voice = _player("Voices")
	_voice.finished.connect(func(): _duck(false))
	apply_settings()

func _player(bus: String) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	add_child(p)
	return p

## bus volumes from the settings (the settings screen calls this live)
func apply_settings() -> void:
	for pair in [["master", "Master"], ["music", "Music"], ["sfx", "SFX"], ["voices", "Voices"]]:
		var i := AudioServer.get_bus_index(pair[1])
		if i >= 0:
			AudioServer.set_bus_volume_db(i, linear_to_db(maxf(float(Settings.get_value(pair[0])), 0.001)))

func _stream(path: String) -> AudioStream:
	if _streams.has(path):
		return _streams[path]
	var s: AudioStream = null
	if ResourceLoader.exists(path):
		s = load(path) as AudioStream
	_streams[path] = s
	return s

static func _looping(s: AudioStream, on: bool) -> void:
	if s is AudioStreamWAV:
		(s as AudioStreamWAV).loop_mode = AudioStreamWAV.LOOP_FORWARD if on else AudioStreamWAV.LOOP_DISABLED
		if on:
			(s as AudioStreamWAV).loop_end = (s as AudioStreamWAV).data.size() / 2
	elif s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = on
	elif s is AudioStreamMP3:
		(s as AudioStreamMP3).loop = on

# ---------------------------------------------------------------------------------------------------- cues
## takes per cue: `rifle`, `rifle_2`, `rifle_3` (tools/make_sfx.py VARIANTS) — one is picked at random each time
var _takes := {}
func _take(name: String) -> String:
	if not _takes.has(name):
		var n := 1
		while ResourceLoader.exists(SFX_DIR + "%s_%d.wav" % [name, n + 1]):
			n += 1
		_takes[name] = n
	var k: int = _takes[name]
	if k <= 1:
		return name
	var i := randi() % k
	return name if i == 0 else "%s_%d" % [name, i + 1]

func sfx(name: String, volume_db := 0.0, jitter := 0.08) -> void:
	var s := _stream(SFX_DIR + _take(name) + ".wav")
	last = ["sfx", name]
	played.append(name)
	if played.size() > 64:
		played.pop_front()
	if s == null:
		return
	# a free player if there is one, else the one that started longest ago
	var p := _pool[_pool_i % POOL]
	for i in POOL:
		var q := _pool[(_pool_i + i) % POOL]
		if not q.playing:
			p = q
			_pool_i += i
			break
	_pool_i += 1
	p.stream = s
	p.volume_db = volume_db
	p.pitch_scale = 1.0 + randf_range(-jitter, jitter)
	p.play()

## a cue in the world: quieter with distance from the listener (the operator or the camera)
func sfx_at(name: String, at: Vector3, from: Vector3, volume_db := 0.0) -> void:
	var d := at.distance_to(from)
	if d >= HEAR_FAR:
		return
	var att := 0.0 if d <= HEAR_FULL else -6.0 * log(d / HEAR_FULL) / log(2.0)
	sfx(name, volume_db + att)

# ---------------------------------------------------------------------------------------------------- loops
func loop(key: String, name: String, volume_db := -6.0, pitch := 1.0) -> void:
	var p: AudioStreamPlayer = _loops.get(key)
	if p == null:
		p = _player("SFX")
		_loops[key] = p
	var s := _stream(SFX_DIR + name + ".wav")
	if s == null:
		return
	_looping(s, true)
	if p.stream != s or not p.playing:
		p.stream = s
		p.play()
	p.volume_db = volume_db
	p.pitch_scale = pitch

func loop_set(key: String, pitch: float, volume_db: float) -> void:
	var p: AudioStreamPlayer = _loops.get(key)
	if p:
		p.pitch_scale = clampf(pitch, 0.3, 3.0)
		p.volume_db = volume_db

func loop_stop(key: String) -> void:
	var p: AudioStreamPlayer = _loops.get(key)
	if p:
		p.stop()

func loops_stop() -> void:
	for k in _loops:
		(_loops[k] as AudioStreamPlayer).stop()

# ---------------------------------------------------------------------------------------------------- ambience
static func bed_for(region_or_style: String) -> String:
	return String(BEDS.get(region_or_style, "nexus-hum"))

func ambience_bed() -> String:
	return _amb_bed

func music_playing() -> bool:
	return _music.playing

## crossfade to a bed ("" = fade out)
func ambience(bed: String, volume_db := -10.0) -> void:
	if bed == _amb_bed:
		return
	_amb_bed = bed
	var target := _amb_b if not _amb_to_b else _amb_a
	_amb_to_b = not _amb_to_b
	target.volume_db = -60.0
	if bed == "":
		target.stop()
	else:
		var s := _stream(AMBIENCE_DIR + bed + ".mp3")
		if s == null:
			target.stop()
		else:
			_looping(s, true)
			target.stream = s
			target.play()
	target.set_meta("base_db", volume_db)

func _process(dt: float) -> void:
	# the ambience crossfade
	var want := 1.0 if _amb_to_b else 0.0
	_amb_fade = move_toward(_amb_fade, want, dt / 1.8)
	var live := _amb_b if _amb_to_b else _amb_a
	var dying := _amb_a if _amb_to_b else _amb_b
	var k := _amb_fade if _amb_to_b else 1.0 - _amb_fade
	live.volume_db = lerpf(-60.0, float(live.get_meta("base_db", -10.0)), k)
	dying.volume_db = lerpf(float(dying.get_meta("base_db", -10.0)), -60.0, k)
	if k >= 1.0 and dying.playing:
		dying.stop()

# ---------------------------------------------------------------------------------------------------- music and radio
func music(path: String, volume_db := -6.0) -> void:
	radio.station = ""
	var s := _stream(path)
	if s == null:
		return
	_looping(s, true)
	_music_base_db = volume_db
	_music.stream = s
	_music.volume_db = volume_db
	_music.play()

func music_stop() -> void:
	_music.stop()
	radio.station = ""

func radio_on(station: String) -> void:
	radio.tune(station)
	_music_base_db = -4.0
	_play_on_air()

func radio_next() -> void:
	var nxt := Radio.next_station(radio.station)
	if nxt == "":
		radio_off()
	else:
		radio_on(nxt)

func radio_off() -> void:
	radio.station = ""
	_music.stop()

func radio_line() -> String:
	return radio.line()

func _play_on_air() -> void:
	var now := radio.on_air()
	if now.is_empty():
		_music.stop()
		return
	var s := _stream(String(now.path))
	last = ["radio", String(now.path)]
	if s == null:
		# a missing recording: skip it
		radio.advance()
		if radio.station != "":
			call_deferred("_play_on_air")
		return
	_looping(s, false)
	_music.stream = s
	_music.volume_db = _music_base_db
	_music.play()

func _on_music_finished() -> void:
	if radio.station != "":
		radio.advance()
		_play_on_air()

# ---------------------------------------------------------------------------------------------------- voices
func voice(id: String) -> void:
	var s := _stream(VOICE_DIR + id + ".wav")
	last = ["voice", id]
	if s == null:
		return
	_voice.stream = s
	_voice.play()
	_duck(true)

## a voiced line from anywhere (the cutscenes and the mission's subtitles: audio/voices/lines); returns its length
func voice_path(path: String) -> float:
	var s := _stream(path)
	last = ["voice", path]
	if s == null:
		return 0.0
	_voice.stream = s
	_voice.play()
	_duck(true)
	return s.get_length()

func voice_stop() -> void:
	_voice.stop()

func _duck(on: bool) -> void:
	_music.volume_db = _music_base_db + (DUCK_DB if on else 0.0)

func stop_all() -> void:
	loops_stop()
	ambience("")
	music_stop()
	_voice.stop()
