extends RefCounted
## The phone budget in one place (owner, Nov 8: "upgrade game … to fit android"). Every 3D view calls `fit_viewport` on
## its SubViewport and `fit_sun` on its key light instead of setting MSAA and shadows itself, so the S22 Ultra gets one
## consistent trade: 2× MSAA + FXAA, the 3D scene at full resolution (80 % under load, see SCALE_MAX), 2048 px shadow maps with
## hard filtering and a shorter shadow distance; a desktop keeps 4× MSAA, full scale and soft shadows.

static func on_phone() -> bool:
	return OS.has_feature("mobile") or OS.get_name() in ["Android", "iOS"]

const Settings := preload("res://scripts/front/settings_store.gd")

## the graphics tier in force: the player's setting, or by device (settings_store.gd)
static func tier() -> String:
	return Settings.tier()

## the crowd / traffic budget as a share of the desktop count (civilians, traffic cars, wildlife)
static func crowd() -> float:
	match tier():
		"low":
			return 0.45
		"medium":
			return 0.7
	return 1.0

## how far small dressing (lamps, planters, bollards, banners) stays drawn
static func dressing_range() -> float:
	match tier():
		"low":
			return 60.0
		"medium":
			return 95.0
	return 140.0

## how far a parked car stays drawn (0 = always; a car is ~20 draws, a phone block parks twenty of them)
static func car_range() -> float:
	match tier():
		"low":
			return 55.0
		"medium":
			return 90.0
	return 0.0

## props under this size cast no shadow (a second draw per cascade for a few pixels)
static func shadowless_below() -> float:
	match tier():
		"low":
			return 1e9
		"medium":
			return 4.0
	return 1.5

## Render scale on the phone's default (medium) tier (owner, Nov 9: "it looks pixelated" → "try it"): the 3D at FULL
## resolution, and a frame-rate guard (Guard, added once by main.gd) steps it down 10 % at a time, to no lower than the old
## 80 %, only while the game runs under 45 fps for 3 s, and back up after 8 s at 58+. Low keeps its fixed 60 %.
const SCALE_MAX := 1.0
const SCALE_MIN := 0.8
static var scale := SCALE_MAX
static var _views: Array[SubViewport] = []

## the render scale alone, for views tuned elsewhere (Data.tune_viewport)
static func fit_viewport_scale(vp: SubViewport) -> void:
	if tier() == "low":
		return
	vp.scaling_3d_scale = scale
	_views.append(vp)

## move every live 3D view on the guarded tier to a new render scale
static func set_scale(v: float) -> void:
	scale = clampf(v, SCALE_MIN, SCALE_MAX)
	var keep: Array[SubViewport] = []
	for vp in _views:
		if is_instance_valid(vp):
			vp.scaling_3d_scale = scale
			keep.append(vp)
	_views = keep

## the frame-rate guard behind the full-resolution render (see SCALE_MAX)
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

static func fit_viewport(vp: SubViewport) -> void:
	match tier():
		"low":
			vp.msaa_3d = Viewport.MSAA_DISABLED
			vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
			vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
			vp.scaling_3d_scale = 0.6
			vp.positional_shadow_atlas_size = 1024
			vp.mesh_lod_threshold = 8.0
		"medium":
			vp.msaa_3d = Viewport.MSAA_2X
			vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
			vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
			# full resolution, stepped down to 80 % only while the frame rate sags (Guard below)
			vp.scaling_3d_scale = scale
			_views.append(vp)
			vp.positional_shadow_atlas_size = 2048
			vp.mesh_lod_threshold = 4.0
		_:
			vp.msaa_3d = Viewport.MSAA_4X

static func fit_sun(sun: DirectionalLight3D, phone_distance := 120.0) -> void:
	var t := tier()
	if t == "low":
		sun.shadow_enabled = false
		return
	if t != "medium":
		return
	# one orthogonal cascade to 70 m: every caster is drawn once for the shadow, not twice, and nothing past 70 m is
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = minf(sun.directional_shadow_max_distance, minf(phone_distance, 70.0))
	sun.shadow_blur = 0.8
