extends RefCounted
## Real surface materials for the city scenes: CC0 PBR sets from Poly Haven (textures/pbr/, 1K: colour, OpenGL normal, and
## AO/roughness/metal packed as "arm"), mapped triplanar in world space so a box of any size tiles at true scale. One cached
## material per (set, tint, tile, extras) so scenes share them.
##
##   Materials.pbr("wood_floor", Color.WHITE, 2.0)   # 2 m per tile

const DIR := "res://textures/pbr/"
static var _cache := {}

## the set's surface only (normal + AO/roughness) under a plain colour: velvet, leather or fabric in any shade
static func surface(set: String, c: Color, tile := 1.0, rough := 1.0, metal := -1.0) -> BaseMaterial3D:
	return pbr(set, c, tile, rough, metal, Color(0, 0, 0), false)

static func has(set: String) -> bool:
	return ResourceLoader.exists(DIR + set + "_nor.jpg")

## `tile` is metres per texture repeat; `rough` scales roughness (1 = as captured); `metal` forces metallic when >= 0
static func pbr(set: String, tint := Color.WHITE, tile := 2.0, rough := 1.0, metal := -1.0, emit := Color(0, 0, 0), use_colour := true) -> BaseMaterial3D:
	var key := "%s|%s|%s|%s|%s|%s|%s" % [set, tint.to_html(), tile, rough, metal, emit.to_html(), use_colour]
	if _cache.has(key):
		return _cache[key]
	var m := ORMMaterial3D.new()
	m.albedo_color = tint
	if use_colour and ResourceLoader.exists(DIR + set + "_diff.jpg"):
		m.albedo_texture = load(DIR + set + "_diff.jpg")
	if ResourceLoader.exists(DIR + set + "_nor.jpg"):
		m.normal_enabled = true
		m.normal_texture = load(DIR + set + "_nor.jpg")
		m.normal_scale = 1.0
	if ResourceLoader.exists(DIR + set + "_arm.jpg"):
		m.orm_texture = load(DIR + set + "_arm.jpg")
	m.roughness = rough
	m.metallic = 0.0 if metal < 0.0 else metal
	if metal >= 0.0:
		m.metallic_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_BLUE
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_triplanar_sharpness = 4.0
	m.uv1_scale = Vector3.ONE / tile
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	if emit.a > 0.0 and (emit.r + emit.g + emit.b) > 0.0:
		m.emission_enabled = true
		m.emission = emit
	_cache[key] = m
	return m
