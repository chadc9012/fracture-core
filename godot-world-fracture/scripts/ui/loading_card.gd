extends Control
## Destiny's loading screen (owner Nov 18, interfaceingame.com Destiny 2 "Loading"): the place's art full-bleed, its name
## in wide caps at the bottom left over the district line and a line of lore, and a small turning mark at the bottom
## right while the place builds. main.gd puts one up, waits for it to be drawn, builds the view under it, then `finish()`
## fades it away.
##   var c := LoadingCard.new(); c.place = "nexus"; overlays.add_child(c) … c.finish()
const UiTheme := preload("res://scripts/ui/ui_theme.gd")

## where you are going: art (ui/art, crops of the owner's boards in docs/reference), name, the line under it, lore
const PLACES := {
	"nexus": { "art": "load-nexus", "name": "NEXUS CITY", "line": "CENTRAL DISTRICT  ·  THE HUB",
		"lore": "Every door on the avenue leads somewhere. Most of them lead back here." },
	"neon": { "art": "load-neon", "name": "NEON CITY", "line": "THE STRIP  ·  NIGHT",
		"lore": "The underground runs after dark. The police run after the underground." },
	"modes": { "art": "load-fracture", "name": "GAME MODES", "line": "PVP  ·  RAIDS  ·  RACES",
		"lore": "Operators test themselves against each other where the city can't see." },
	"descent": { "art": "load-fracture", "name": "THE FRACTURE", "line": "THE STORY  ·  VERDANT FOREST",
		"lore": "Something came down through the sky over the forest. It is still calling." },
	"rift": { "art": "load-fracture", "name": "THE RIFT GATE", "line": "BOSS ENCOUNTERS",
		"lore": "Six things came through the Fracture. Each one is waiting on the other side." },
	"skyways": { "art": "load-coast", "name": "SKYWAYS", "line": "AIR  ·  SEA",
		"lore": "Over the bay the city looks almost peaceful." },
	"airport": { "art": "load-airport", "name": "NEXUS CITY INTERNATIONAL", "line": "TERMINAL  ·  WEAPONS STOWED",
		"lore": "Twelve airports, four lines, one planet coming apart at the seams." },
	"apartment": { "art": "load-apartment", "name": "APARTMENT 12-04", "line": "WHERE IT STARTS",
		"lore": "You wake up to the sound of the city breaking." },
	"casino": { "art": "load-casino", "name": "NEON CITY GRAND CASINO", "line": "TOWER  ·  RESORT",
		"lore": "The house always wins. The house has never met an operator." },
	"interior": { "art": "load-nexus", "name": "NEXUS CITY", "line": "INDOORS",
		"lore": "Off the avenue, the city keeps its own hours." },
}

var place := "nexus"
var title_override := ""   # a building's own name over the place's
var _spin: Control
var _t := 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP   # nothing under it takes a tap while it builds
	var p: Dictionary = PLACES.get(place, PLACES.nexus)
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.015, 0.03)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var path := "res://ui/art/%s.jpg" % String(p.art)
	if ResourceLoader.exists(path):
		var art := TextureRect.new()
		art.texture = load(path)
		art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		art.modulate = Color(0.82, 0.82, 0.88)
		add_child(art)
	var g := Gradient.new()
	g.set_color(0, Color(0.01, 0.015, 0.03, 0.0))
	g.set_color(1, Color(0.01, 0.015, 0.03, 0.92))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0.5, 0.4)
	gt.fill_to = Vector2(0.5, 1.0)
	var shade := TextureRect.new()
	shade.texture = gt
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	add_child(shade)
	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	col.grow_vertical = Control.GROW_DIRECTION_BEGIN
	col.offset_left = 48
	col.offset_bottom = -48
	col.add_theme_constant_override("separation", 6)
	add_child(col)
	var line := Label.new()
	line.text = String(p.line)
	line.add_theme_font_override("font", UiTheme.font(600, 4))
	line.add_theme_font_size_override("font_size", 15)
	line.add_theme_color_override("font_color", UiTheme.GOLD)
	col.add_child(line)
	var name_l := Label.new()
	name_l.text = title_override.to_upper() if title_override != "" else String(p.name)
	name_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	name_l.custom_minimum_size = Vector2(440, 0)
	name_l.add_theme_font_override("font", UiTheme.font(700, 8))
	name_l.add_theme_font_size_override("font_size", 58)
	name_l.add_theme_color_override("font_color", UiTheme.INK)
	col.add_child(name_l)
	var rule := ColorRect.new()
	rule.color = Color(1, 1, 1, 0.45)
	rule.custom_minimum_size = Vector2(90, 2)
	rule.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	col.add_child(rule)
	var lore := Label.new()
	lore.text = String(p.lore)
	lore.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lore.custom_minimum_size = Vector2(440, 0)
	lore.add_theme_font_override("font", UiTheme.font(400, 0))
	lore.add_theme_font_size_override("font_size", 19)
	lore.add_theme_color_override("font_color", UiTheme.INK_DIM)
	col.add_child(lore)
	# the turning mark: three arcs round a dot, bottom right (Destiny's is its ghost shell; ours is the fracture triangle)
	_spin = Control.new()
	_spin.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_spin.offset_left = -96
	_spin.offset_top = -96
	_spin.offset_right = -48
	_spin.offset_bottom = -48
	_spin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_spin.draw.connect(func():
		var c := Vector2(24, 24)
		for i in 3:
			var a0 := _t * 2.4 + i * TAU / 3.0
			_spin.draw_arc(c, 20.0, a0, a0 + 1.2, 16, Color(1, 1, 1, 0.85), 2.0, true)
		var tri := PackedVector2Array([c + Vector2(-7, -5), c + Vector2(7, -5), c + Vector2(0, 7), c + Vector2(-7, -5)])
		_spin.draw_polyline(tri, UiTheme.INK, 1.5, true))
	add_child(_spin)
	# the text column stays clear of the turning mark on a narrow (upright) screen
	var fit := func():
		var w := minf(560.0, size.x - 180.0)
		name_l.custom_minimum_size.x = w
		lore.custom_minimum_size.x = w
	resized.connect(fit)
	fit.call_deferred()

func _process(dt: float) -> void:
	_t += dt
	if _spin:
		_spin.queue_redraw()

## the place is built: fade out and go
func finish() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tw := create_tween()
	tw.tween_interval(0.25)
	tw.tween_property(self, "modulate:a", 0.0, 0.45)
	tw.tween_callback(queue_free)
