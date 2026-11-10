extends RefCounted
## The phone budget in one place (owner, Nov 8: "upgrade game … to fit android"). Every 3D view calls `fit_viewport` on
## its SubViewport and `fit_sun` on its key light instead of setting MSAA and shadows itself, so the S22 Ultra gets one
## consistent trade: 2× MSAA + FXAA, the 3D scene rendered at 80 % of the screen and upscaled, 2048 px shadow maps with
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
			vp.scaling_3d_scale = 0.8
			vp.positional_shadow_atlas_size = 2048
			# 4 px simplified meshes until they shattered (owner's phone test, Nov 9): the Meshy city models and the bodies
			# import without LODs now (their faces split into shards when simplified) and the rest keep a gentler threshold
			vp.mesh_lod_threshold = 2.0
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
