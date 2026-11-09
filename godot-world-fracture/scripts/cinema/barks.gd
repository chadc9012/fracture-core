extends Control
## Ambient voices (the owner's campaign dialogue draft, "Open-world ambient dialogue": AMB_<REGION>_00n): every so often a
## passer-by, a trader or NOVA says one of the region's lines, voiced (lines.gd), with a small caption low on the screen.
## Add it over a scene and set `region` (NEXUS_CITY, NEON_CITY, THALASSIA, SOLARA_DESERT, VERDANT_FOREST, FROSTVEIL,
## OBSIDIAN_REACH, AZURE_ISLES, SHATTERED_EXPANSE); `say(id)` speaks any line now (combat and vehicle calls use it).

const Lines := preload("res://scripts/cinema/lines.gd")
const Sound := preload("res://scripts/audio/sound.gd")

## the region 3D maps' ids -> the draft's ambient regions
const MAP_REGION := {
	"nexus": "NEXUS_CITY", "neon-city": "NEON_CITY", "thalassia": "THALASSIA", "solara": "SOLARA_DESERT",
	"veridan": "VERDANT_FOREST", "riverdale": "VERDANT_FOREST", "old-harrow": "VERDANT_FOREST", "goldenreach": "VERDANT_FOREST",
	"frostveil": "FROSTVEIL", "frostspire": "FROSTVEIL", "ember": "OBSIDIAN_REACH", "wastelands": "OBSIDIAN_REACH",
	"azure-isles": "AZURE_ISLES", "storm": "AZURE_ISLES", "shattered-reefs": "SHATTERED_EXPANSE", "crystal-badlands": "SHATTERED_EXPANSE",
	"swamps": "SHATTERED_EXPANSE",
}

var region := ""
var every := Vector2(45.0, 80.0)   # seconds between ambient lines
var _t := 20.0
var _last := ""
var _box: PanelContainer
var _label: Label
var _hide_t := 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_box = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.02, 0.03, 0.06, 0.62)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(8)
	_box.add_theme_stylebox_override("panel", sb)
	_box.anchor_left = 0.5
	_box.anchor_right = 0.5
	_box.anchor_top = 0.8
	_box.anchor_bottom = 0.8
	_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_box.visible = false
	add_child(_box)
	_label = Label.new()
	_label.add_theme_font_size_override("font_size", 16)
	_label.add_theme_color_override("font_color", Color(0.92, 0.92, 0.95))
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_box.add_child(_label)

func _ids() -> Array:
	var out: Array = []
	if region == "":
		return out
	for id: String in Lines.data().lines.keys():
		if id.begins_with("AMB_" + region + "_"):
			out.append(id)
	return out

## speak a line now (voiced, captioned)
func say(id: String) -> void:
	if not Lines.has(id):
		return
	var spk := Lines.speaker(id)
	_label.text = "%s:  %s" % [spk if spk != "PLAYER" else "YOU", Lines.text(id)]
	_box.visible = true
	_box.reset_size()
	var d := Sound.voice_path(Lines.path(id))
	_hide_t = maxf(d, clampf(Lines.text(id).length() * 0.06, 2.5, 6.0)) + 0.4
	_last = id

func _process(delta: float) -> void:
	if _hide_t > 0.0:
		_hide_t -= delta
		if _hide_t <= 0.0:
			_box.visible = false
	if region == "" or not is_visible_in_tree():
		return
	_t -= delta
	if _t <= 0.0:
		_t = randf_range(every.x, every.y)
		var ids := _ids()
		ids.erase(_last)
		if not ids.is_empty():
			say(String(ids[randi() % ids.size()]))
