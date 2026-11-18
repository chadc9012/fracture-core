extends Control
## A mall shop on the phone (the Dec 4 plan, phase 5): Nova Threads sells the outfits (gear.json), Haven Home the furnishings
## for Apartment 12-04 (gear_store.gd FURNITURE). Nex comes from the profile; what you buy lands in the gear save. Emits
## `changed` after every purchase or wear so the scene can save both.

signal closed
signal changed

const Gear := preload("res://scripts/gear/gear_store.gd")
const UiTheme := preload("res://scripts/ui/ui_theme.gd")
## Laid out as a Destiny vendor (owner Nov 18, interfaceingame.com Destiny 2): the shop's name in wide caps over a coloured
## rule, your Nex top right, the stock as a grid of tiles — name, what it is, the price or OWNED / WORN in the corner.
const ACCENT := { "nova": Color(0.95, 0.4, 0.75), "haven": Color(0.95, 0.75, 0.4), "apex": Color(0.3, 1.0, 0.6), "rusty": Color(1.0, 0.3, 0.2) }

var shop := "nova"          # "nova" | "haven" (the mall), "apex" | "rusty" (the Nexus avenue's court shops)
var op_power := 100.0       # what a bought weapon or armour piece rolls around (gear_store.buy_offer)
var back_label := "← MALL"
var gear: Dictionary
var profile: Dictionary
var _nex: Label
var _line: Label
var _list: GridContainer

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.05, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var accent: Color = ACCENT.get(shop, UiTheme.INK)
	var head := HBoxContainer.new()
	head.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	head.offset_left = 24
	head.offset_right = -24
	head.offset_top = 18
	head.add_theme_constant_override("separation", 18)
	add_child(head)
	var close := Button.new()
	close.text = back_label
	close.custom_minimum_size = Vector2(110, 44)
	close.pressed.connect(func(): closed.emit())
	head.add_child(close)
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tv.add_theme_constant_override("separation", 0)
	head.add_child(tv)
	var kicker := Label.new()
	kicker.text = { "nova": "OUTFITS", "haven": "FURNISHINGS", "apex": "WEAPONS · ARMOR", "rusty": "BOSS-GRADE GEAR" }.get(shop, "VENDOR")
	kicker.add_theme_font_override("font", UiTheme.font(600, 4))
	kicker.add_theme_font_size_override("font_size", 11)
	kicker.add_theme_color_override("font_color", accent)
	tv.add_child(kicker)
	var title := Label.new()
	title.text = { "nova": "NOVA THREADS", "haven": "HAVEN HOME", "apex": "APEX GEAR", "rusty": "RUSTY TRIGGER" }.get(shop, shop.to_upper())
	title.theme_type_variation = &"HeaderLarge"
	tv.add_child(title)
	_nex = Label.new()
	_nex.add_theme_font_override("font", UiTheme.font(700, 1))
	_nex.add_theme_font_size_override("font_size", 18)
	_nex.add_theme_color_override("font_color", UiTheme.GOLD)
	_nex.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(_nex)
	var rule := ColorRect.new()
	rule.color = Color(accent.r, accent.g, accent.b, 0.7)
	rule.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	rule.offset_top = 82
	rule.offset_bottom = 84
	add_child(rule)
	_line = Label.new()
	_line.position = Vector2(24, 92)
	_line.theme_type_variation = &"Caption"
	add_child(_line)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(24, 124)
	scroll.size = Vector2(size.x - 48, size.y - 140)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	_list = GridContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("h_separation", 8)
	_list.add_theme_constant_override("v_separation", 8)
	scroll.add_child(_list)
	var fit := func():
		scroll.size = Vector2(size.x - 48, size.y - 140)
		_list.columns = clampi(int((size.x - 48.0) / 300.0), 1, 4)
	resized.connect(fit)
	fit.call()
	refresh()

func refresh() -> void:
	var n := str(int(profile.nex))
	var grouped := ""
	while n.length() > 3:
		grouped = "," + n.substr(n.length() - 3) + grouped
		n = n.substr(0, n.length() - 3)
	_nex.text = "◆ %s NEX" % (n + grouped)
	for c in _list.get_children():
		c.queue_free()
	if shop == "nova":
		var none := _row("Nothing over the plate", "the operator's own look", "", gear.outfit == "", func(): Gear.wear_outfit(gear, ""); changed.emit(); refresh())
		_list.add_child(none)
		for o in Gear.data().get("outfits", []):
			var owned: bool = o.id in gear.outfits
			var worn: bool = gear.outfit == o.id
			var tag: String = "worn" if worn else ("owned · tap to wear" if owned else ("%d Nex" % int(o.price) if o.price != null else String(o.source)))
			_list.add_child(_row("%s · %s" % [o.name, o.style], String(o.blurb) + (("  (" + String(o.source) + ")") if not owned else ""), tag, worn, func(): _line.text = Gear.buy_outfit(gear, profile, String(o.id)); changed.emit(); refresh()))
	elif shop == "apex" or shop == "rusty":
		_line.text = _line.text if _line.text != "" else ("Today's stock · new each day" if shop == "apex" else "Boss-grade, no questions · stock turns over daily")
		for o in Gear.shop_stock(shop, Gear.today()):
			var kind := ("%s · %s" % [Gear.SLOT_NAME.get(String(o.slot), String(o.slot)), String(o.rarity).capitalize()])
			_list.add_child(_row("%s · %s" % [o.name, kind], "%s · rolls ~%d power" % [String(o.element).capitalize(), int(op_power) + int(Gear.SHOPS[shop].bonus)], "%d Nex" % int(o.price), false, func(): _line.text = Gear.buy_offer(gear, profile, shop, o, op_power); changed.emit(); refresh()))
	else:
		for f in Gear.FURNITURE:
			var owned: bool = f.id in gear.furniture
			_list.add_child(_row("%s · %s" % [f.name, String(f.slot).capitalize()], String(f.blurb), "in the apartment" if owned else "%d Nex" % int(f.price), owned, func(): _line.text = Gear.buy_furniture(gear, profile, String(f.id)); changed.emit(); refresh()))

## one item as a vendor tile: its name, what it is, and the price (or OWNED / WORN) in the bottom corner; the worn or
## placed one carries the shop's colour down its edge
func _row(title: String, blurb: String, tag: String, lit: bool, on: Callable) -> Button:
	var accent: Color = ACCENT.get(shop, UiTheme.INK)
	var b := Button.new()
	b.custom_minimum_size = Vector2(280, 112)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var normal := UiTheme.box(Color(1, 1, 1, 0.045), UiTheme.LINE, 1, Vector4(14, 10, 14, 10))
	var hover := UiTheme.box(Color(1, 1, 1, 0.09), UiTheme.LINE_HI, 1, Vector4(14, 10, 14, 10))
	if lit:
		normal.border_width_left = 4
		normal.border_color = accent
		hover.border_width_left = 4
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("focus", hover)
	b.add_theme_stylebox_override("pressed", hover)
	var parts := title.split(" · ", true, 1)
	var v := VBoxContainer.new()
	v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 14 + (4 if lit else 0)
	v.offset_right = -14
	v.offset_top = 10
	v.offset_bottom = -10
	v.add_theme_constant_override("separation", 2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(v)
	var name_l := _text(parts[0].to_upper(), 700, 1, 15, UiTheme.INK)
	name_l.clip_text = true
	v.add_child(name_l)
	if parts.size() > 1:
		# a gear line ("Melee · Rare") takes its rarity's colour, as Destiny's item tiles do
		var kind_col := accent
		var last := parts[1].get_slice(" · ", parts[1].count(" · ")).to_lower()
		if last in ["common", "uncommon", "rare", "epic", "legendary", "exotic"]:
			kind_col = UiTheme.rarity_color("epic" if last == "legendary" else last)
		v.add_child(_text(parts[1].to_upper(), 600, 2, 11, kind_col))
	var blurb_l := _text(blurb, 400, 0, 12, UiTheme.INK_DIM)
	blurb_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	blurb_l.max_lines_visible = 2
	blurb_l.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(blurb_l)
	if tag != "":
		var price := tag.ends_with("Nex")
		var t := _text(("◆ " + tag.to_upper()) if price else tag.to_upper(), 700 if price else 600, 1, 13, UiTheme.GOLD if price else (accent if lit else UiTheme.INK_DIM))
		t.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		v.add_child(t)
	b.pressed.connect(on)
	return b

func _text(t: String, weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
