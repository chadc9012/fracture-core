extends RefCounted
## The phone budget in one place (owner, Nov 8: "upgrade game … to fit android"). Every 3D view calls `fit_viewport` on
## its SubViewport and `fit_sun` on its key light instead of setting MSAA and shadows itself, so the S22 Ultra gets one
## consistent trade: 2× MSAA + FXAA, the 3D scene at full resolution (80 % under load, see SCALE_MAX), 2048 px shadow maps with
## hard filtering and a shorter shadow distance; a desktop keeps 4× MSAA, full scale and soft shadows.

static func on_phone() -> bool:
	return OS.has_feature("mobile") or OS.get_name() in ["Android", "iOS"]

## Render scale (owner, Nov 9: "it looks pixelated" → "try it"): the phone now draws the 3D at FULL resolution, and a
## frame-rate guard (Guard, added once by main.gd) steps it down 10 % at a time, to no lower than the old 80 %, only while
## the game runs under 45 fps for 3 s, and back up after 8 s at 58+. So a light scene is sharp and a heavy one stays smooth.
const SCALE_MAX := 1.0
const SCALE_MIN := 0.8
static var scale := SCALE_MAX
static var _views: Array[SubViewport] = []

static func fit_viewport(vp: SubViewport) -> void:
	if on_phone():
		vp.msaa_3d = Viewport.MSAA_2X
		vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
		vp.scaling_3d_scale = scale
		vp.positional_shadow_atlas_size = 2048
		_views.append(vp)
	else:
		vp.msaa_3d = Viewport.MSAA_4X

## the render scale alone, for views tuned elsewhere (Data.tune_viewport)
static func fit_viewport_scale(vp: SubViewport) -> void:
	vp.scaling_3d_scale = scale
	_views.append(vp)

## move every live 3D view to a new render scale
static func set_scale(v: float) -> void:
	scale = clampf(v, SCALE_MIN, SCALE_MAX)
	var keep: Array[SubViewport] = []
	for vp in _views:
		if is_instance_valid(vp):
			vp.scaling_3d_scale = scale
			keep.append(vp)
	_views = keep

## the frame-rate guard behind the full-resolution phone render (see SCALE_MAX)
class Guard extends Node:
	var _low := 0.0
	var _high := 0.0
	var _p: GDScript = load("res://scripts/phone.gd")
	func _process(dt: float) -> void:
		var fps := Engine.get_frames_per_second()
		_low = _low + dt if fps < 45.0 else 0.0
		_high = _high + dt if fps >= 58.0 else 0.0
		var sc: float = _p.scale
		if _low > 3.0 and sc > SCALE_MIN + 0.01:
			_p.set_scale(sc - 0.1)
			_low = 0.0
		elif _high > 8.0 and sc < SCALE_MAX - 0.01:
			_p.set_scale(sc + 0.1)
			_high = 0.0

static func fit_sun(sun: DirectionalLight3D, phone_distance := 120.0) -> void:
	if not on_phone():
		return
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = minf(sun.directional_shadow_max_distance, phone_distance)
	sun.shadow_blur = 0.6
