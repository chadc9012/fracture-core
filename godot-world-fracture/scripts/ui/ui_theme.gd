extends RefCounted
## The game's UI look, after Destiny 2's menus (owner, Nov 18: interfaceingame.com's Destiny 2 page — "use that website to
## help develop the game"). Destiny's screens are flat and quiet: dark translucent panels with a hairline border, square
## corners, a clean grotesk set in white with wide-tracked uppercase labels, and selection shown by a white frame (hover)
## or a white fill (pressed / chosen) rather than colour. Colour is kept for meaning: rarity (common → exotic), element,
## and the power diamond's gold.
##
## `build()` makes the Theme; tools/make_ui_theme.gd saves it to res://ui/theme.tres, which project.godot sets as
## gui/theme/custom, so every Control in the game takes it without code. Screens use the tokens below (INK, PANEL, ...)
## and the type variations ("HeaderLarge", "HeaderSmall", "Caption", "Tile", "Tab") for anything special.

const FONT_400 := "res://fonts/inter-400.woff2"
const FONT_500 := "res://fonts/inter-500.woff2"
const FONT_600 := "res://fonts/inter-600.woff2"
const FONT_700 := "res://fonts/inter-700.woff2"

# --- tokens
const INK := Color(0.93, 0.94, 0.95)            # body text
const INK_DIM := Color(0.93, 0.94, 0.95, 0.62)  # secondary text
const INK_FAINT := Color(0.93, 0.94, 0.95, 0.38)
const PANEL := Color(0.055, 0.07, 0.09, 0.86)   # menu panels
const PANEL_SOLID := Color(0.055, 0.07, 0.09)
const VEIL := Color(0.02, 0.025, 0.035, 0.72)   # the dimmer behind a full-screen menu
const LINE := Color(1, 1, 1, 0.14)              # hairlines
const LINE_HI := Color(1, 1, 1, 0.75)           # hover frame
const GOLD := Color(0.96, 0.82, 0.36)           # power / light level
## Destiny's rarity colours: Common, Uncommon, Rare, Legendary (the game's "epic"), Exotic
const RARITY := {
	"common": Color(0.76, 0.74, 0.70), "uncommon": Color(0.21, 0.44, 0.26), "rare": Color(0.31, 0.46, 0.64),
	"epic": Color(0.33, 0.19, 0.40), "legendary": Color(0.33, 0.19, 0.40), "exotic": Color(0.81, 0.68, 0.20),
}
const RARITY_NAME := { "common": "Common", "uncommon": "Uncommon", "rare": "Rare", "epic": "Legendary", "legendary": "Legendary", "exotic": "Exotic" }
## element accents (Destiny's damage types, and the game's own)
const ELEMENT := {
	"KINETIC": Color(0.92, 0.92, 0.92), "ARC": Color(0.47, 0.80, 0.96), "THERMAL": Color(0.98, 0.52, 0.22),
	"SOLAR": Color(0.98, 0.52, 0.22), "CRYO": Color(0.55, 0.85, 0.98), "BIO": Color(0.45, 0.88, 0.45),
	"VOID": Color(0.70, 0.48, 0.98), "STASIS": Color(0.40, 0.55, 0.98),
}

static func rarity_color(r: String) -> Color:
	return RARITY.get(r, RARITY.common)

static func element_color(e: String) -> Color:
	return ELEMENT.get(e.to_upper(), INK)

static func font(weight := 500, spacing := 0) -> Font:
	var path: String = { 400: FONT_400, 500: FONT_500, 600: FONT_600, 700: FONT_700 }.get(weight, FONT_500)
	var f: Font = load(path)
	if spacing == 0 or f == null:
		return f
	var v := FontVariation.new()
	v.base_font = f
	v.spacing_glyph = spacing
	return v

static func box(bg: Color, border := Color(0, 0, 0, 0), width := 0, pad := Vector4(14, 10, 14, 10)) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(width)
	s.set_corner_radius_all(0)
	s.content_margin_left = pad.x
	s.content_margin_top = pad.y
	s.content_margin_right = pad.z
	s.content_margin_bottom = pad.w
	s.anti_aliasing = false
	return s

static func build() -> Theme:
	var t := Theme.new()
	t.default_font = font(500)
	t.default_font_size = 16
	# --- panels
	t.set_stylebox("panel", "Panel", box(PANEL, LINE, 1))
	t.set_stylebox("panel", "PanelContainer", box(PANEL, LINE, 1))
	t.set_stylebox("panel", "PopupPanel", box(PANEL_SOLID, LINE, 1))
	t.set_stylebox("panel", "PopupMenu", box(PANEL_SOLID, LINE, 1, Vector4(6, 6, 6, 6)))
	t.set_stylebox("panel", "TooltipPanel", box(PANEL_SOLID, LINE, 1, Vector4(10, 6, 10, 6)))
	t.set_stylebox("panel", "TabContainer", box(Color(0, 0, 0, 0)))
	# --- labels
	t.set_color("font_color", "Label", INK)
	t.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.35))
	t.set_constant("shadow_offset_x", "Label", 0)
	t.set_constant("shadow_offset_y", "Label", 1)
	t.set_color("default_color", "RichTextLabel", INK)
	t.set_font("normal_font", "RichTextLabel", font(400))
	t.set_font("bold_font", "RichTextLabel", font(700))
	# type variations: big uppercase headers, small tracked captions
	t.set_type_variation("HeaderLarge", "Label")
	t.set_font("font", "HeaderLarge", font(700, 2))
	t.set_font_size("font_size", "HeaderLarge", 30)
	t.set_type_variation("HeaderSmall", "Label")
	t.set_font("font", "HeaderSmall", font(600, 3))
	t.set_font_size("font_size", "HeaderSmall", 13)
	t.set_color("font_color", "HeaderSmall", INK_DIM)
	t.set_type_variation("Caption", "Label")
	t.set_font("font", "Caption", font(400))
	t.set_font_size("font_size", "Caption", 13)
	t.set_color("font_color", "Caption", INK_DIM)
	# --- buttons: hairline frame; hover brightens the frame; pressed / toggled fills white with dark text
	var normal := box(Color(1, 1, 1, 0.04), LINE, 1)
	var hover := box(Color(1, 1, 1, 0.10), LINE_HI, 1)
	var pressed := box(Color(0.94, 0.94, 0.94, 0.95), Color(1, 1, 1, 1), 1)
	var disabled := box(Color(1, 1, 1, 0.02), Color(1, 1, 1, 0.06), 1)
	var focus := box(Color(0, 0, 0, 0), Color(1, 1, 1, 0.9), 2)
	for type in ["Button", "OptionButton", "MenuButton", "CheckButton", "CheckBox"]:
		t.set_stylebox("normal", type, normal)
		t.set_stylebox("hover", type, hover)
		t.set_stylebox("pressed", type, pressed)
		t.set_stylebox("hover_pressed", type, pressed)
		t.set_stylebox("disabled", type, disabled)
		t.set_stylebox("focus", type, focus)
		t.set_color("font_color", type, INK)
		t.set_color("font_hover_color", type, Color(1, 1, 1))
		t.set_color("font_pressed_color", type, Color(0.06, 0.07, 0.09))
		t.set_color("font_hover_pressed_color", type, Color(0.06, 0.07, 0.09))
		t.set_color("font_focus_color", type, Color(1, 1, 1))
		t.set_color("font_disabled_color", type, INK_FAINT)
		t.set_font("font", type, font(600, 1))
		t.set_font_size("font_size", type, 15)
	# a tab strip: plain words, the chosen one white with a bar under it (Destiny's top menu)
	t.set_type_variation("Tab", "Button")
	var tab_off := box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, Vector4(14, 8, 14, 10))
	var tab_on := StyleBoxFlat.new()
	tab_on.bg_color = Color(0, 0, 0, 0)
	tab_on.border_color = INK
	tab_on.border_width_bottom = 3
	tab_on.content_margin_left = 14
	tab_on.content_margin_right = 14
	tab_on.content_margin_top = 8
	tab_on.content_margin_bottom = 7
	for st in ["normal", "disabled", "focus"]:
		t.set_stylebox(st, "Tab", tab_off)
	t.set_stylebox("hover", "Tab", box(Color(1, 1, 1, 0.06), Color(0, 0, 0, 0), 0, Vector4(14, 8, 14, 10)))
	t.set_stylebox("pressed", "Tab", tab_on)
	t.set_stylebox("hover_pressed", "Tab", tab_on)
	t.set_color("font_color", "Tab", INK_DIM)
	t.set_color("font_pressed_color", "Tab", INK)
	t.set_color("font_hover_pressed_color", "Tab", INK)
	t.set_font("font", "Tab", font(700, 3))
	t.set_font_size("font_size", "Tab", 15)
	# a gear tile: square, the item's colour comes from the screen, the frame lights on hover / choice
	t.set_type_variation("Tile", "Button")
	t.set_stylebox("normal", "Tile", box(Color(1, 1, 1, 0.03), LINE, 1, Vector4(0, 0, 0, 0)))
	t.set_stylebox("hover", "Tile", box(Color(1, 1, 1, 0.06), LINE_HI, 2, Vector4(0, 0, 0, 0)))
	t.set_stylebox("pressed", "Tile", box(Color(1, 1, 1, 0.06), Color(1, 1, 1), 3, Vector4(0, 0, 0, 0)))
	t.set_stylebox("hover_pressed", "Tile", box(Color(1, 1, 1, 0.06), Color(1, 1, 1), 3, Vector4(0, 0, 0, 0)))
	t.set_stylebox("focus", "Tile", box(Color(0, 0, 0, 0), Color(1, 1, 1, 0.9), 2, Vector4(0, 0, 0, 0)))
	# --- inputs
	t.set_stylebox("normal", "LineEdit", box(Color(1, 1, 1, 0.05), LINE, 1))
	t.set_stylebox("focus", "LineEdit", box(Color(1, 1, 1, 0.08), LINE_HI, 1))
	t.set_color("font_color", "LineEdit", INK)
	t.set_color("font_placeholder_color", "LineEdit", INK_FAINT)
	t.set_color("caret_color", "LineEdit", INK)
	# --- sliders and bars: thin white tracks
	var track := box(Color(1, 1, 1, 0.14), Color(0, 0, 0, 0), 0, Vector4(0, 2, 0, 2))
	var fill := box(INK, Color(0, 0, 0, 0), 0, Vector4(0, 2, 0, 2))
	t.set_stylebox("slider", "HSlider", track)
	t.set_stylebox("grabber_area", "HSlider", fill)
	t.set_stylebox("grabber_area_highlight", "HSlider", fill)
	t.set_stylebox("background", "ProgressBar", box(Color(1, 1, 1, 0.12), Color(0, 0, 0, 0), 0, Vector4(0, 0, 0, 0)))
	t.set_stylebox("fill", "ProgressBar", box(INK, Color(0, 0, 0, 0), 0, Vector4(0, 0, 0, 0)))
	t.set_color("font_color", "ProgressBar", INK)
	# --- scroll bars: a hairline that thickens under the finger
	var sb := box(Color(1, 1, 1, 0.05), Color(0, 0, 0, 0), 0, Vector4(3, 3, 3, 3))
	var grab := box(Color(1, 1, 1, 0.32), Color(0, 0, 0, 0), 0, Vector4(3, 3, 3, 3))
	var grab_hi := box(Color(1, 1, 1, 0.6), Color(0, 0, 0, 0), 0, Vector4(3, 3, 3, 3))
	for type in ["VScrollBar", "HScrollBar"]:
		t.set_stylebox("scroll", type, sb)
		t.set_stylebox("grabber", type, grab)
		t.set_stylebox("grabber_highlight", type, grab_hi)
		t.set_stylebox("grabber_pressed", type, grab_hi)
	# --- popup menus (OptionButton lists)
	t.set_stylebox("hover", "PopupMenu", box(Color(1, 1, 1, 0.12), Color(0, 0, 0, 0), 0))
	t.set_color("font_color", "PopupMenu", INK)
	t.set_color("font_hover_color", "PopupMenu", Color(1, 1, 1))
	t.set_font("font", "PopupMenu", font(500))
	t.set_color("font_color", "TooltipLabel", INK)
	t.set_font("font", "TooltipLabel", font(400))
	return t
