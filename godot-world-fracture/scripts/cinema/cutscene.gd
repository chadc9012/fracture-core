extends Control
## In-engine cinematics (owner, Nov 9: "a cinematic cutscene and dialogue system … the cinematic atmosphere of Destiny,
## the character interactions of GTA V"). A cutscene is a list of shots played on one camera in the game's own world,
## under an overlay: letterbox bars, a filmic grade (vignette, a teal-and-amber split, grain, chromatic fringe that kicks
## with the camera shake), wide-tracked title cards, and voiced subtitles (scripts/cinema/lines.gd). Tap or click to
## move to the next line; hold SKIP (or press Esc) to skip to the end.
##
## A shot is a Dictionary:
##   dur      seconds (the shot runs at least this long, and until its lines are spoken)
##   pos      [from, to] camera positions (Vector3) or one Vector3; a Callable returning Vector3 follows something
##   look     [from, to] look-at targets, or one; a Callable follows
##   fov      [from, to] or one float (default 50)
##   ease     "inout" (default), "in", "out", "lin"
##   lines    line ids (lines.gd), spoken one after another from `line_at` (default 0.4 s)
##   say      [[speaker, text], …] unvoiced lines (subtitles only)
##   on       [[t, Callable], …] calls at t seconds into the shot
##   sfx      [[t, name, db], …] audio/cinema/<name>.ogg
##   music    a cue name (audio/cinema/<name>.ogg), started with the shot; "" stops the music
##   title    [big, small] a title card; title_at / title_for (s) place it
##   fade_in  seconds from black at the start; fade_out seconds to black at the end; flash  white flash at the start
##   shake    camera shake amount (decays over the shot); shake_at  start time
##   panel    a texture path: a comic-style cutaway (the art panned across, framed) instead of the 3D camera
##   caption  text in a comic box over a panel
## play(shots) runs them in order and emits `finished`; `skipped` tells whether the player skipped.

signal finished

const Lines := preload("res://scripts/cinema/lines.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const CINEMA := "res://audio/cinema/"
const GRADE := """
shader_type canvas_item;
uniform sampler2D screen : hint_screen_texture, filter_linear_mipmap;
uniform float fringe = 0.0;
uniform float vignette = 0.55;
uniform float lift = 0.0;
void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 d = uv - 0.5;
	float r = length(d);
	vec3 c;
	c.r = textureLod(screen, uv + d * fringe * 0.012, 0.0).r;
	c.g = textureLod(screen, uv, 0.0).g;
	c.b = textureLod(screen, uv - d * fringe * 0.012, 0.0).b;
	// a teal-and-amber split: shadows cool, highlights warm, a touch of contrast
	float l = dot(c, vec3(0.299, 0.587, 0.114));
	c = mix(c * vec3(0.92, 1.0, 1.06), c * vec3(1.06, 1.0, 0.9), smoothstep(0.25, 0.75, l));
	c = (c - 0.5) * 1.08 + 0.5 + lift;
	c *= 1.0 - vignette * smoothstep(0.35, 0.85, r);
	float g = fract(sin(dot(uv * 1000.0 + TIME, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
	c += g * 0.035;
	COLOR = vec4(max(c, 0.0), 1.0);
}
"""

var cam: Camera3D
var skipped := false
var playing := false
var _gen := 0   # a newer play() takes over: the older one's loop sees the change and stops quietly

var _top: ColorRect
var _bot: ColorRect
var _grade: ColorRect
var _grade_mat: ShaderMaterial
var _fade: ColorRect
var _title: VBoxContainer
var _title_big: Label
var _title_small: Label
var _sub: VBoxContainer
var _sub_name: Label
var _sub_text: Label
var _skip: Button
var _skip_ring: ProgressBar
var _panel: TextureRect
var _caption: PanelContainer
var _caption_l: Label
var _music: AudioStreamPlayer
var _sfx: Array[AudioStreamPlayer] = []
var _hold := 0.0
var _holding := false
var _advance := false
var _shake := 0.0
var _streams := {}

const SPEAKER_COLOR := {
	"NOVA": Color(0.55, 0.85, 1.0), "PLAYER": Color(0.95, 0.85, 0.6), "NEWS": Color(0.9, 0.9, 0.95),
	"MARA": Color(1.0, 0.7, 0.45), "BUILDING": Color(1.0, 0.4, 0.35), "RADIO": Color(0.8, 0.85, 0.95),
	"CIVILIAN": Color(0.85, 0.85, 0.85), "RESIDENT": Color(0.85, 0.85, 0.85), "VYRAK": Color(1.0, 0.45, 0.3),
}

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_grade = ColorRect.new()
	_grade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_grade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = GRADE
	_grade_mat = ShaderMaterial.new()
	_grade_mat.shader = sh
	_grade.material = _grade_mat
	add_child(_grade)
	_panel = TextureRect.new()
	_panel.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_panel.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_panel.visible = false
	add_child(_panel)
	_top = _bar(true)
	_bot = _bar(false)
	# the title card: a thin rule, the big line wide-tracked, the small line under it
	_title = VBoxContainer.new()
	_title.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_title.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_title.grow_vertical = Control.GROW_DIRECTION_BOTH
	_title.alignment = BoxContainer.ALIGNMENT_CENTER
	_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_title.modulate.a = 0.0
	add_child(_title)
	_title_small = _label(18, Color(0.85, 0.82, 0.75), 6)
	_title_big = _label(54, Color(1.0, 0.97, 0.9), 14)
	var rule := ColorRect.new()
	rule.color = Color(1.0, 0.85, 0.55, 0.8)
	rule.custom_minimum_size = Vector2(420, 1)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var glyph := _label(20, Color(1.0, 0.85, 0.55), 0)
	glyph.text = "◇"
	_title.add_child(glyph)
	_title.add_child(_title_big)
	_title.add_child(rule)
	_title.add_child(_title_small)
	# subtitles sit in the lower bar
	_sub = VBoxContainer.new()
	_sub.anchor_left = 0.12
	_sub.anchor_right = 0.88
	_sub.anchor_top = 0.86
	_sub.anchor_bottom = 0.99
	_sub.alignment = BoxContainer.ALIGNMENT_BEGIN
	_sub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_sub)
	_sub_name = _label(15, Color(0.55, 0.85, 1.0), 4)
	_sub_text = _label(22, Color(0.96, 0.96, 0.98), 0)
	_sub_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_sub.add_child(_sub_name)
	_sub.add_child(_sub_text)
	_caption = PanelContainer.new()
	var cs := StyleBoxFlat.new()
	cs.bg_color = Color(0.98, 0.95, 0.85)
	cs.border_color = Color(0.05, 0.05, 0.08)
	cs.set_border_width_all(3)
	cs.set_content_margin_all(12)
	_caption.add_theme_stylebox_override("panel", cs)
	_caption.anchor_left = 0.06
	_caption.anchor_top = 0.16
	_caption.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_caption.visible = false
	_caption_l = Label.new()
	_caption_l.add_theme_font_size_override("font_size", 22)
	_caption_l.add_theme_color_override("font_color", Color(0.08, 0.06, 0.1))
	_caption_l.uppercase = true
	_caption.add_child(_caption_l)
	add_child(_caption)
	_fade = ColorRect.new()
	_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_fade.color = Color(0, 0, 0, 0)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_fade)
	# hold to skip
	_skip = Button.new()
	_skip.text = "HOLD TO SKIP"
	_skip.flat = true
	_skip.add_theme_font_size_override("font_size", 13)
	_skip.add_theme_color_override("font_color", Color(0.85, 0.85, 0.9, 0.7))
	_skip.anchor_left = 1.0
	_skip.anchor_right = 1.0
	_skip.offset_left = -170
	_skip.offset_right = -18
	_skip.offset_top = 14
	_skip.offset_bottom = 44
	_skip.button_down.connect(func() -> void: _holding = true)
	_skip.button_up.connect(func() -> void: _holding = false)
	add_child(_skip)
	_skip_ring = ProgressBar.new()
	_skip_ring.show_percentage = false
	_skip_ring.max_value = 1.0
	_skip_ring.anchor_left = 1.0
	_skip_ring.anchor_right = 1.0
	_skip_ring.offset_left = -160
	_skip_ring.offset_right = -28
	_skip_ring.offset_top = 44
	_skip_ring.offset_bottom = 47
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(1.0, 0.85, 0.55)
	_skip_ring.add_theme_stylebox_override("fill", fill)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(1, 1, 1, 0.12)
	_skip_ring.add_theme_stylebox_override("background", bg)
	add_child(_skip_ring)
	_music = AudioStreamPlayer.new()
	_music.bus = "Music"
	add_child(_music)
	for i in 4:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_sfx.append(p)
	visible = false

func _bar(top: bool) -> ColorRect:
	var b := ColorRect.new()
	b.color = Color(0, 0, 0)
	b.anchor_right = 1.0
	b.anchor_top = 0.0 if top else 1.0
	b.anchor_bottom = 0.0 if top else 1.0
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(b)
	return b

func _label(size: int, c: Color, track: int) -> Label:
	var l := Label.new()
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", c)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_y", 2)
	if track > 0:
		var fv := FontVariation.new()
		fv.base_font = ThemeDB.fallback_font
		fv.spacing_glyph = track
		l.add_theme_font_override("font", fv)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _gui_input(e: InputEvent) -> void:
	if not playing:
		return
	if (e is InputEventMouseButton and (e as InputEventMouseButton).pressed) or (e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed):
		_advance = true
		accept_event()

func _unhandled_key_input(e: InputEvent) -> void:
	if not playing or not (e is InputEventKey) or not (e as InputEventKey).pressed:
		return
	match (e as InputEventKey).keycode:
		KEY_ESCAPE:
			skipped = true
		KEY_SPACE, KEY_ENTER, KEY_E:
			_advance = true
	get_viewport().set_input_as_handled()

func _stream(path: String) -> AudioStream:
	if not _streams.has(path):
		_streams[path] = load(path) if ResourceLoader.exists(path) else null
	return _streams[path]

func music(cue: String, db := -6.0) -> void:
	if cue == "":
		var tw := create_tween()
		tw.tween_property(_music, "volume_db", -40.0, 1.5)
		tw.tween_callback(_music.stop)
		return
	var s := _stream(CINEMA + cue + ".ogg")
	if s == null:
		return
	_music.stream = s
	_music.volume_db = db
	_music.play()

func sfx(name: String, db := 0.0) -> void:
	var s := _stream(CINEMA + name + ".ogg")
	if s == null:
		return
	for p in _sfx:
		if not p.playing:
			p.stream = s
			p.volume_db = db
			p.play()
			return
	_sfx[0].stream = s
	_sfx[0].volume_db = db
	_sfx[0].play()

## any stream by path on a free effects player (the mission's distant shouts use it)
func sfx_path(path: String, db := 0.0) -> void:
	var s := _stream(path)
	if s == null:
		return
	for p in _sfx:
		if not p.playing:
			p.stream = s
			p.volume_db = db
			p.play()
			return

func _bars(on: bool, t := 0.6) -> void:
	var h := get_viewport_rect().size.y * 0.11 if on else 0.0
	var tw := create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE)
	tw.tween_property(_top, "offset_bottom", h, t)
	tw.tween_property(_bot, "offset_top", -h, t)

func _show_line(spk: String, txt: String) -> void:
	_sub_name.text = spk if spk != "PLAYER" else "YOU"
	_sub_name.add_theme_color_override("font_color", SPEAKER_COLOR.get(spk, Color(0.85, 0.85, 0.9)))
	_sub_name.visible = spk != ""
	_sub_text.text = txt
	_sub.modulate.a = 1.0

static func _ease(k: float, kind: String) -> float:
	match kind:
		"lin": return k
		"in": return k * k
		"out": return 1.0 - (1.0 - k) * (1.0 - k)
	return k * k * (3.0 - 2.0 * k)

static func _pick(v: Variant, k: float) -> Variant:
	if v is Callable:
		return (v as Callable).call()
	if v is Array and (v as Array).size() == 2:
		var a: Variant = v[0]
		var b: Variant = v[1]
		if a is Callable:
			a = (a as Callable).call()
		if b is Callable:
			b = (b as Callable).call()
		if a is Vector3:
			return (a as Vector3).lerp(b, k)
		return lerpf(float(a), float(b), k)
	return v

## end whatever is playing at once (a capture jumping to a moment): the overlay clears and `finished` fires
func stop() -> void:
	if not playing:
		return
	_gen += 1
	Sound.voice_stop()
	_sub.modulate.a = 0.0
	_title.modulate.a = 0.0
	_panel.visible = false
	_caption.visible = false
	_fade.color = Color(0, 0, 0, 0)
	_top.offset_bottom = 0.0
	_bot.offset_top = 0.0
	visible = false
	playing = false
	finished.emit()

## play the shots; await `finished`
func play(shots: Array) -> void:
	_gen += 1
	var gen := _gen
	playing = true
	skipped = false
	visible = true
	_holding = false
	_hold = 0.0
	_title.modulate.a = 0.0
	_sub.modulate.a = 0.0
	_bars(true)
	if cam:
		cam.current = true
	for s: Dictionary in shots:
		if skipped or gen != _gen:
			break
		await _shot(s, gen)
	if gen != _gen:
		return
	# out: the bars open, the subtitle and the grade go, the music is left to the caller (music("") fades it)
	Sound.voice_stop()
	_sub.modulate.a = 0.0
	_title.modulate.a = 0.0
	_panel.visible = false
	_caption.visible = false
	_bars(false, 0.5)
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", 0.0, 0.4)
	await get_tree().create_timer(0.5).timeout
	visible = false
	playing = false
	finished.emit()

func _shot(s: Dictionary, gen: int) -> void:
	var dur := float(s.get("dur", 4.0))
	var ease_kind := String(s.get("ease", "inout"))
	var lines: Array = s.get("lines", [])
	var say: Array = s.get("say", [])
	var line_at := float(s.get("line_at", 0.4))
	var on: Array = (s.get("on", []) as Array).duplicate()
	var fx: Array = (s.get("sfx", []) as Array).duplicate()
	if s.has("music"):
		music(String(s.music), float(s.get("music_db", -6.0)))
	if s.has("panel"):
		_panel.texture = load(String(s.panel)) if ResourceLoader.exists(String(s.panel)) else null
		_panel.visible = _panel.texture != null
		_panel.pivot_offset = get_viewport_rect().size * 0.5
	else:
		_panel.visible = false
	_caption.visible = s.has("caption")
	_caption_l.text = String(s.get("caption", ""))
	var fin := float(s.get("fade_in", 0.0))
	if fin > 0.0:
		_fade.color = Color(0, 0, 0, 1)
	if s.get("flash", false):
		_fade.color = Color(1, 1, 1, 0.95)
		var tw := create_tween()
		tw.tween_property(_fade, "color", Color(1, 1, 1, 0), 1.1)
	elif fin > 0.0:
		var tw := create_tween()
		tw.tween_property(_fade, "color:a", 0.0, fin)
	var fout := float(s.get("fade_out", 0.0))
	_shake = float(s.get("shake", 0.0))
	var shake_at := float(s.get("shake_at", 0.0))
	var title: Array = s.get("title", [])
	var title_at := float(s.get("title_at", 0.6))
	var title_for := float(s.get("title_for", dur - title_at - 0.4))
	if not title.is_empty():
		_title_big.text = String(title[0])
		_title_small.text = String(title[1]) if title.size() > 1 else ""
	# the queue of things to say: voiced ids, then unvoiced pairs
	var queue: Array = []
	for id in lines:
		queue.append(String(id))
	for p in say:
		queue.append(p)
	var t := 0.0
	var line_end := -1.0
	var talking := false
	var body := Lines.body()
	var end := dur
	while true:
		var dt := get_process_delta_time()
		await get_tree().process_frame
		t += dt
		if _holding:
			_hold += dt
			if _hold >= 0.9:
				skipped = true
		else:
			_hold = maxf(_hold - dt * 2.0, 0.0)
		_skip_ring.value = _hold / 0.9
		if skipped or gen != _gen:
			return
		# the camera
		var k := _ease(clampf(t / maxf(dur, 0.01), 0.0, 1.0), ease_kind)
		if cam and not s.has("panel"):
			if s.has("pos"):
				cam.global_position = _pick(s.pos, k)
			if s.has("fov"):
				cam.fov = float(_pick(s.fov, k))
			if s.has("look"):
				var target: Vector3 = _pick(s.look, k)
				if target.distance_to(cam.global_position) > 0.01:
					cam.look_at(target)
			if t >= shake_at and _shake > 0.0:
				var amp := _shake * exp(-(t - shake_at) * 1.4)
				cam.global_position += Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * amp * 0.08
				cam.rotation.z = randf_range(-1, 1) * amp * 0.01
				_grade_mat.set_shader_parameter("fringe", amp)
			else:
				cam.rotation.z = 0.0
				_grade_mat.set_shader_parameter("fringe", 0.0)
		elif s.has("panel"):
			# the cutaway: the art drifts and pushes in slowly
			var z := lerpf(1.04, 1.14, k)
			_panel.scale = Vector2(z, z)
			_panel.position = Vector2(lerpf(-12.0, 12.0, k), lerpf(6.0, -6.0, k))
		# calls and sounds on their marks
		while not on.is_empty() and t >= float(on[0][0]):
			(on.pop_front()[1] as Callable).call()
		while not fx.is_empty() and t >= float(fx[0][0]):
			var f: Array = fx.pop_front()
			sfx(String(f[1]), float(f[2]) if f.size() > 2 else 0.0)
		# the title
		if not title.is_empty():
			_title.modulate.a = smoothstep(title_at, title_at + 0.9, t) * (1.0 - smoothstep(title_at + title_for - 0.8, title_at + title_for, t))
		# lines
		if t >= line_at and (line_end < 0.0 or t >= line_end or _advance):
			if talking and _advance:
				Sound.voice_stop()
			_advance = false
			talking = false
			if queue.is_empty():
				if line_end >= 0.0 and t >= line_end:
					_sub.modulate.a = maxf(_sub.modulate.a - dt * 4.0, 0.0)
			else:
				var q: Variant = queue.pop_front()
				var d := 0.0
				if q is String:
					var id := String(q)
					_show_line(Lines.speaker(id), Lines.text(id))
					d = Sound.voice_path(Lines.path(id, body))
					if d <= 0.0:
						d = clampf(Lines.text(id).length() * 0.06, 2.0, 6.0)
				else:
					_show_line(String(q[0]), String(q[1]))
					d = clampf(String(q[1]).length() * 0.06, 2.4, 6.0)
				talking = true
				line_end = t + d + 0.25
				end = maxf(end, line_end + 0.3)
		elif _advance and queue.is_empty() and line_end >= 0.0:
			_advance = false
			end = minf(end, t + 0.2)
		if fout > 0.0:
			_fade.color = Color(0, 0, 0, smoothstep(end - fout, end, t))
		if t >= end and on.is_empty() and queue.is_empty() and (line_end < 0.0 or t >= line_end):
			break
	_sub.modulate.a = 0.0 if s.get("clear_sub", true) else _sub.modulate.a
	if not title.is_empty():
		_title.modulate.a = 0.0
