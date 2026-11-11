extends Node3D
## The practice district's light: golden hour after the owner's day frame (low warm sun, long shadows, a hazy horizon, the
## cracked planet over the skyline) instead of a flat grey-blue backdrop.
const CinematicSky := preload("res://scripts/vfx/cinematic_sky.gd")
const Phone := preload("res://scripts/phone.gd")
func _ready() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-16, 150, 0)
	sun.light_color = Color(1.0, 0.8, 0.58)
	sun.light_energy = 2.2
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 200.0
	Phone.fit_sun(sun)
	add_child(sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	var look := CinematicSky.golden_day()
	look["planet_tex"] = Data.texture("veyra.jpgb", true)   # the globe's own painting, as in the regions' sky
	e.sky = CinematicSky.make(look)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.6
	e.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	e.tonemap_exposure = 1.05
	e.glow_enabled = true
	e.glow_intensity = 0.6
	e.glow_bloom = 0.06
	e.glow_hdr_threshold = 1.1
	e.fog_enabled = true
	e.fog_light_color = Color(0.92, 0.74, 0.58)
	e.fog_density = 0.0009
	e.fog_sun_scatter = 0.25
	e.fog_aerial_perspective = 0.3
	e.fog_sky_affect = 0.0
	e.adjustment_enabled = true
	e.adjustment_contrast = 1.06
	e.adjustment_saturation = 1.1
	env.environment = e
	add_child(env)
