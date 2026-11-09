extends Control
## Cutscene playback (schedule step 11). A list of beats over the live 3D scene: letterbox bars slide in, the camera orbits
## or holds on a point, a caption names the speaker and the line, a recorded voice plays when the beat has one
## (audio/voices), and the next beat follows after its seconds — or on a tap. SKIP ends it. Pure presentation: whoever
## plays it stops stepping the operator while `playing` and takes the camera back on `finished`.
##   beat: { "speaker": "NOVA", "text": "…", "seconds": 4.0, "voice": "serik-vale-warning" (optional),
##           "look": Vector3 (what the camera looks at), "from": Vector3 / "orbit": { "radius", "height", "deg0", "deg1" } }

signal finished

const Sound := preload("res://scripts/audio/sound.gd")

var playing := false
var _beats: Array = []
var _i := -1
var _t := 0.0
var _cam: Camera3D
var _top: ColorRect
var _bottom: ColorRect
var _speaker: Label
var _caption: Label
var _skip: Button
var _bar := 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_top = ColorRect.new()
	_top.color = Color.BLACK
	_top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	add_child(_top)
	_bottom = ColorRect.new()
	_bottom.color = Color.BLACK
	_bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	add_child(_bottom)
	_speaker = Label.new()
	_speaker.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_speaker.position = Vector2(0, -200)
	_speaker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_speaker.add_theme_font_size_override("font_size", 14)
	_speaker.modulate = Color(0.5, 0.9, 1.0)
	add_child(_speaker)
	_caption = Label.new()
	_caption.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_caption.position = Vector2(24, -176)
	_caption.custom_minimum_size = Vector2(492, 0)
	_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_caption.add_theme_font_size_override("font_size", 19)
	_caption.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_caption.add_theme_constant_override("shadow_offset_y", 2)
	add_child(_caption)
	_skip = Button.new()
	_skip.text = "SKIP ▸"
	_skip.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_skip.position = Vector2(-120, 110)
	_skip.custom_minimum_size = Vector2(104, 40)
	_skip.pressed.connect(_end)
	add_child(_skip)
	visible = false
	_layout(0.0)

func _layout(k: float) -> void:
	var h := get_viewport_rect().size.y
	var bar := h * 0.11 * k
	_top.size = Vector2(get_viewport_rect().size.x, bar)
	_top.position = Vector2.ZERO
	_bottom.size = Vector2(get_viewport_rect().size.x, bar)
	_bottom.position = Vector2(0, h - bar)
	_caption.size.x = get_viewport_rect().size.x - 48
	_speaker.size.x = get_viewport_rect().size.x

func play(beats: Array, cam: Camera3D) -> void:
	_beats = beats
	_cam = cam
	_i = -1
	playing = true
	visible = true
	_bar = 0.0
	_next()

func _next() -> void:
	_i += 1
	if _i >= _beats.size():
		_end()
		return
	var b: Dictionary = _beats[_i]
	_t = 0.0
	_speaker.text = String(b.get("speaker", "")).to_upper()
	_caption.text = String(b.get("text", ""))
	var v := String(b.get("voice", ""))
	if v != "":
		Sound.voice(v)
	_place(b, 0.0)

func _place(b: Dictionary, k: float) -> void:
	if _cam == null or not b.has("look"):
		return
	var look: Vector3 = b.look
	var from: Vector3
	if b.has("orbit"):
		var o: Dictionary = b.orbit
		var a := deg_to_rad(lerpf(float(o.get("deg0", 0.0)), float(o.get("deg1", 60.0)), k))
		from = look + Vector3(cos(a), 0, sin(a)) * float(o.get("radius", 10.0)) + Vector3(0, float(o.get("height", 3.0)), 0)
	else:
		from = b.get("from", look + Vector3(6, 3, 6))
	_cam.global_position = from
	_cam.look_at(look + Vector3(0, float(b.get("look_up", 1.2)), 0), Vector3.UP)

func _process(dt: float) -> void:
	if not playing:
		return
	dt = minf(dt, 0.1)   # a hitch (a region building behind the scene) must not swallow a beat
	_bar = move_toward(_bar, 1.0, dt * 2.5)
	_layout(_bar)
	if _i < 0 or _i >= _beats.size():
		return
	var b: Dictionary = _beats[_i]
	var secs := maxf(float(b.get("seconds", 4.0)), 0.5)
	_t += dt
	_place(b, clampf(_t / secs, 0.0, 1.0))
	_caption.modulate.a = clampf(_t * 3.0, 0.0, 1.0) * clampf((secs - _t) * 3.0 + 0.2, 0.0, 1.0)
	if _t >= secs:
		_next()

func _gui_input(event: InputEvent) -> void:
	if playing and (event is InputEventMouseButton and event.pressed or event is InputEventScreenTouch and event.pressed):
		_next()

func _end() -> void:
	if not playing:
		return
	playing = false
	visible = false
	finished.emit()

## a NOVA / speaker beat helper
static func beat(speaker: String, text: String, seconds := 4.0, look: Variant = null, extra := {}) -> Dictionary:
	var b := { "speaker": speaker, "text": text, "seconds": seconds }
	if look != null:
		b.look = look
	b.merge(extra)
	return b
