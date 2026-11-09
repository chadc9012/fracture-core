extends Node
## World data exported from the web game (scripts/export-godot-data.ts -> res://generated): the planet, the street maps and the
## styles they are drawn with, plus the shared look (the navy / cyan of the owner's map packs) and the globe's projection.

const GEN := "res://generated/"

# the owner's map-pack palette (Map System V200 / Planetary Director): deep navy, cyan rules, warm gold highlight
const BG := Color("#030c18")
const PANEL := Color("#0b2233")
const PANEL_2 := Color("#102638")
const RULE := Color("#39789a")
const CYAN := Color("#8ce9ff")
const TEXT := Color("#e5f5ff")
const MUTED := Color("#9dbed2")
const GOLD := Color("#f3c16c")
const YOU := Color("#ffe066")

var planet: Dictionary = {}
var styles: Dictionary = {}
var map_index: Array = []
var _maps := {}
var _images := {}

func _ready() -> void:
	planet = _json(GEN + "planet.json")
	styles = _json(GEN + "styles.json")
	var idx = _json(GEN + "maps/index.json")
	map_index = idx if idx is Array else []

# ---------------------------------------------------------------- render quality (phone vs PC)

## true on the Forward+ renderer (PC); the phone runs Mobile, which has no SSR, SSAO, SSIL, SDFGI or volumetric fog
static func forward_plus() -> bool:
	return RenderingServer.get_current_rendering_method() == "forward_plus"

## a phone (or any non-Forward+ renderer): cheaper anti-aliasing and a slightly lower 3D resolution
static func phone() -> bool:
	return OS.has_feature("mobile") or not forward_plus()

## Every 3D SubViewport goes through here. A phone (S22 Ultra: 3088 x 1440) gets 2x MSAA, no FXAA on top, and draws the 3D at
## 80 % of the screen; 4x MSAA plus FXAA at full resolution was most of a frame's fill cost there. PC keeps 4x.
static func tune_viewport(vp: SubViewport) -> void:
	if phone():
		vp.msaa_3d = Viewport.MSAA_2X
		vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
		vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
		vp.scaling_3d_scale = 0.8
	else:
		vp.msaa_3d = Viewport.MSAA_4X

## Screen-space and volumetric effects only where the renderer has them (on Mobile they are skipped with a warning each)
static func pc_effects(env: Environment, ssr := true, ssao := true, ssil := true, fog := true) -> void:
	var on := forward_plus()
	env.ssr_enabled = on and ssr
	env.ssao_enabled = on and ssao
	env.ssil_enabled = on and ssil
	env.volumetric_fog_enabled = on and fog

func _json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		push_warning("missing %s: run bun scripts/export-godot-data.ts" % path)
		return {}
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func continents() -> Array:
	return planet.get("continents", [])

func continent(id: String) -> Dictionary:
	for c in continents():
		if c.id == id:
			return c
	return {}

func map(id: String) -> Dictionary:
	if not _maps.has(id):
		var d = _json(GEN + "maps/%s.json" % id)
		_maps[id] = d if d is Dictionary else {}
	return _maps[id]

func map_name(id: String) -> String:
	for m in map_index:
		if m.id == id:
			return m.name
	return id

## a baked image loaded from its raw bytes (never imported, so never compressed: the satellite data must stay exact)
func image(path: String) -> Image:
	if _images.has(path):
		return _images[path]
	var img := Image.new()
	var bytes := FileAccess.get_file_as_bytes(GEN + path)
	if bytes.is_empty():
		return null
	var err := img.load_png_from_buffer(bytes) if path.ends_with(".pngb") else img.load_jpg_from_buffer(bytes)
	if err != OK:
		return null
	_images[path] = img
	return img

func texture(path: String, mipmaps := false) -> Texture2D:
	var img := image(path)
	if img == null:
		return null
	if mipmaps:
		img = img.duplicate()
		img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

## latitude / longitude (degrees) -> a point on Godot's SphereMesh, so an equirectangular texture lines up with it:
## longitude 0 faces -Z, east is -X, north +Y (SphereMesh UV u = 0.5 + lon / 360, v = 0 at the north pole)
static func lat_lon_to_vec(lat: float, lon: float) -> Vector3:
	var la := deg_to_rad(lat)
	var lo := deg_to_rad(lon)
	return Vector3(-cos(la) * sin(lo), sin(la), -cos(la) * cos(lo))

static func vec_to_lat_lon(v: Vector3) -> Vector2:
	var n := v.normalized()
	return Vector2(rad_to_deg(asin(clampf(n.y, -1.0, 1.0))), rad_to_deg(atan2(-n.x, -n.z)))

static func angle_between(a: Vector2, b: Vector2) -> float:
	return rad_to_deg(lat_lon_to_vec(a.x, a.y).angle_to(lat_lon_to_vec(b.x, b.y)))

## the continent a tap lands on: the nearest icon within reach (degrees), else ""
func continent_at(p: Vector2, reach := 16.0) -> String:
	var best := ""
	var bd := reach
	for c in continents():
		var d := angle_between(p, Vector2(c.lat, c.lon))
		if d < bd:
			bd = d
			best = c.id
	return best

## a styled panel box (the packs' bordered navy cards)
static func box(fill: Color, border: Color, radius := 8, border_w := 1) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(border_w)
	s.set_corner_radius_all(radius)
	s.content_margin_left = 12
	s.content_margin_right = 12
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s

static func button(text: String, primary := false) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_ALL
	b.add_theme_stylebox_override("normal", box(Color("#12344b") if primary else Color("#0b2335"), Color("#5dacc8") if primary else RULE, 7))
	b.add_theme_stylebox_override("hover", box(Color("#1a4763"), GOLD, 7))
	b.add_theme_stylebox_override("pressed", box(Color("#23607b"), Color("#d6e8ff"), 7))
	b.add_theme_stylebox_override("focus", box(Color(0, 0, 0, 0), GOLD, 7, 2))
	b.add_theme_stylebox_override("disabled", box(Color("#0a1a26"), Color("#24485c"), 7))
	b.add_theme_color_override("font_color", TEXT)
	b.add_theme_color_override("font_disabled_color", Color("#5d7686"))
	b.add_theme_font_size_override("font_size", 15)
	b.custom_minimum_size = Vector2(44, 44)
	return b

static func label(text: String, size := 14, color := TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l
