extends RefCounted
## The phone budget in one place (owner, Nov 8: "upgrade game … to fit android"). Every 3D view calls `fit_viewport` on
## its SubViewport and `fit_sun` on its key light instead of setting MSAA and shadows itself, so the S22 Ultra gets one
## consistent trade: 2× MSAA + FXAA, the 3D scene rendered at 80 % of the screen and upscaled, 2048 px shadow maps with
## hard filtering and a shorter shadow distance; a desktop keeps 4× MSAA, full scale and soft shadows.

static func on_phone() -> bool:
	return OS.has_feature("mobile") or OS.get_name() in ["Android", "iOS"]

static func fit_viewport(vp: SubViewport) -> void:
	if on_phone():
		vp.msaa_3d = Viewport.MSAA_2X
		vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
		vp.scaling_3d_scale = 0.8
		vp.positional_shadow_atlas_size = 2048
	else:
		vp.msaa_3d = Viewport.MSAA_4X

static func fit_sun(sun: DirectionalLight3D, phone_distance := 120.0) -> void:
	if not on_phone():
		return
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = minf(sun.directional_shadow_max_distance, phone_distance)
	sun.shadow_blur = 0.6
