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

## how far a forest draws the full Meshy tree (~10k triangles) before its leaf cards take over (region_flora.gd
## tree_lods): a dense forest stands a tree every ~3 m, so the ring's area is the near triangle budget
static func tree_detail_range() -> float:
	match tier():
		"low":
			return 9.0
		"medium":
			return 14.0
	return 22.0

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
			# FSR 1 instead of bilinear (owner, Nov 15: "the city looks pixelated"): the same 0.6 render scale, but the
			# upscale is edge-aware and sharpened, so neon edges and text stop blocking up
			vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR
			vp.fsr_sharpness = 0.15
			vp.scaling_3d_scale = 0.65
			vp.positional_shadow_atlas_size = 1024
			vp.mesh_lod_threshold = 8.0
		"medium":
			vp.msaa_3d = Viewport.MSAA_2X
			vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
			vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR
			vp.fsr_sharpness = 0.2
			vp.scaling_3d_scale = 0.85
			vp.positional_shadow_atlas_size = 2048
			# 4 px simplified meshes until they shattered (owner's phone test, Nov 9): the Meshy city models and the bodies
			# import without LODs now (their faces split into shards when simplified) and the rest keep a gentler threshold
			vp.mesh_lod_threshold = 2.0
		"ultra":
			vp.msaa_3d = Viewport.MSAA_4X
			vp.use_taa = true
			vp.positional_shadow_atlas_size = 8192
			vp.mesh_lod_threshold = 0.5
			# the views build their Environment in their own _ready: upgrade it once it is there
			_pc_env.bind(vp).call_deferred()
		_:
			vp.msaa_3d = Viewport.MSAA_4X

## PC (owner, Nov 22: "phone build with PC visuals, then Steam with better quality"): on the Forward+ renderer the
## ultra tier turns on what the phone can't afford, on top of each view's own look — SDFGI bounce light, SSIL, SSAO,
## screen-space reflections (the wet streets, the marble floors), soft glow and volumetric fog wherever the view already
## has fog. Each view's colours, exposure and fog colour stay as authored; this only adds light transport.
static func _pc_env(vp: Viewport) -> void:
	if not is_instance_valid(vp) or RenderingServer.get_current_rendering_method() != "forward_plus":
		return
	var envs: Array[Environment] = []
	if vp.world_3d and vp.world_3d.environment:
		envs.append(vp.world_3d.environment)
	for n in vp.find_children("*", "WorldEnvironment", true, false):
		if (n as WorldEnvironment).environment:
			envs.append((n as WorldEnvironment).environment)
	for n in vp.find_children("*", "Camera3D", true, false):
		if (n as Camera3D).environment:
			envs.append((n as Camera3D).environment)
	for env in envs:
		pc_environment(env)
	if envs.is_empty() and vp.is_inside_tree():
		# not built yet: look again next frame (a view that sets up its world after an await)
		vp.get_tree().create_timer(0.2).timeout.connect(_pc_env.bind(vp), CONNECT_ONE_SHOT)

static func pc_environment(env: Environment) -> void:
	if env.has_meta("pc"):
		return
	env.set_meta("pc", true)
	env.ssao_enabled = true
	env.ssao_radius = 1.2
	env.ssao_intensity = 1.6
	env.ssao_detail = 0.6
	env.ssil_enabled = true
	env.ssil_radius = 4.0
	env.ssil_intensity = 0.7
	env.ssr_enabled = true
	env.ssr_max_steps = 96
	env.ssr_fade_in = 0.2
	env.ssr_fade_out = 2.0
	env.ssr_depth_tolerance = 0.3
	env.sdfgi_enabled = true
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 4
	env.sdfgi_min_cell_size = 0.25
	env.sdfgi_energy = 0.8
	env.sdfgi_bounce_feedback = 0.4
	env.glow_enabled = true
	if env.fog_enabled:
		env.volumetric_fog_enabled = true
		env.volumetric_fog_density = clampf(env.fog_density * 0.6, 0.002, 0.02)
		env.volumetric_fog_albedo = env.fog_light_color
		env.volumetric_fog_length = 96.0
		env.volumetric_fog_detail_spread = 2.0

static func fit_sun(sun: DirectionalLight3D, phone_distance := 120.0) -> void:
	var t := tier()
	if t == "ultra":
		sun.shadow_enabled = true
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
		sun.directional_shadow_max_distance = maxf(sun.directional_shadow_max_distance, 260.0)
		sun.shadow_blur = 1.4
		sun.light_angular_distance = maxf(sun.light_angular_distance, 0.6)   # soft contact-hardening shadows
		return
	if t == "low":
		sun.shadow_enabled = false
		return
	if t != "medium":
		return
	# one orthogonal cascade to 70 m: every caster is drawn once for the shadow, not twice, and nothing past 70 m is
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = minf(sun.directional_shadow_max_distance, minf(phone_distance, 70.0))
	sun.shadow_blur = 0.8
