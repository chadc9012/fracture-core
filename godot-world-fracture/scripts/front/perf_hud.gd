extends CanvasLayer
## The frame-time readout (schedule step 9: phone performance). One line over every screen — FPS, the frame's cost in
## milliseconds, draw calls, triangles drawn and video memory — averaged over the last second so a hitch reads as a hitch.
## Green at 30 fps and above, amber under it, red under 20: the gate is 30 fps in a Nexus firefight on the owner's phone.
## Off by default (owner, Nov 11: "remove clutter from screen"); settings "perf_readout" turns it on.

const Settings := preload("res://scripts/front/settings_store.gd")

var _label: Label
var _acc := 0.0
var _frames := 0
var _worst := 0.0

func _init() -> void:
	layer = 100
	_label = Label.new()
	_label.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_label.position = Vector2(-350, -22)
	_label.custom_minimum_size = Vector2(340, 18)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_label.add_theme_font_size_override("font_size", 11)
	_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_label.add_theme_constant_override("shadow_offset_x", 1)
	_label.add_theme_constant_override("shadow_offset_y", 1)
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_label)
	process_mode = Node.PROCESS_MODE_ALWAYS

func _process(dt: float) -> void:
	var on := bool(Settings.get_value("perf_readout"))
	_label.visible = on
	if not on:
		return
	_acc += dt
	_frames += 1
	_worst = maxf(_worst, dt)
	if _acc < 0.5:
		return
	var avg_ms := _acc / maxf(_frames, 1) * 1000.0
	var fps := 1000.0 / maxf(avg_ms, 0.01)
	_label.text = "%d fps · %.1f ms (max %.0f) · %d draws · %s tris · %d MB" % [
		int(round(fps)), avg_ms, _worst * 1000.0,
		int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)),
		_short(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)),
		int(Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0)]
	_label.modulate = Color(0.5, 1.0, 0.6) if fps >= 30.0 else (Color(1.0, 0.8, 0.3) if fps >= 20.0 else Color(1.0, 0.4, 0.35))
	_acc = 0.0
	_frames = 0
	_worst = 0.0

static func _short(n: float) -> String:
	if n >= 1e6:
		return "%.2f M" % (n / 1e6)
	if n >= 1e3:
		return "%d k" % int(n / 1e3)
	return str(int(n))
