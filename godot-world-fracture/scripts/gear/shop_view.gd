extends Control
## A mall shop on the phone (the Dec 4 plan, phase 5): Nova Threads sells the outfits (gear.json), Haven Home the furnishings
## for Apartment 12-04 (gear_store.gd FURNITURE). Nex comes from the profile; what you buy lands in the gear save. Emits
## `changed` after every purchase or wear so the scene can save both.

signal closed
signal changed

const Gear := preload("res://scripts/gear/gear_store.gd")

var shop := "nova"          # "nova" | "haven"
var gear: Dictionary
var profile: Dictionary
var _nex: Label
var _line: Label
var _list: VBoxContainer

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.05, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var head := HBoxContainer.new()
	head.position = Vector2(16, 14)
	head.add_theme_constant_override("separation", 14)
	add_child(head)
	var close := Button.new()
	close.text = "← MALL"
	close.custom_minimum_size = Vector2(100, 44)
	close.pressed.connect(func(): closed.emit())
	head.add_child(close)
	var title := Label.new()
	title.text = "NOVA THREADS" if shop == "nova" else "HAVEN HOME"
	title.add_theme_font_size_override("font_size", 22)
	title.modulate = Color(0.95, 0.4, 0.75) if shop == "nova" else Color(0.95, 0.75, 0.4)
	head.add_child(title)
	_nex = Label.new()
	_nex.add_theme_font_size_override("font_size", 18)
	head.add_child(_nex)
	_line = Label.new()
	_line.position = Vector2(16, 66)
	_line.modulate = Color(0.6, 1.0, 0.85)
	add_child(_line)
	var scroll := ScrollContainer.new()
	scroll.position = Vector2(16, 96)
	scroll.size = Vector2(size.x - 32, size.y - 110)
	add_child(scroll)
	resized.connect(func(): scroll.size = Vector2(size.x - 32, size.y - 110))
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)
	refresh()

func refresh() -> void:
	_nex.text = "%d Nex" % int(profile.nex)
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
	else:
		for f in Gear.FURNITURE:
			var owned: bool = f.id in gear.furniture
			_list.add_child(_row("%s · %s" % [f.name, String(f.slot).capitalize()], String(f.blurb), "in the apartment" if owned else "%d Nex" % int(f.price), owned, func(): _line.text = Gear.buy_furniture(gear, profile, String(f.id)); changed.emit(); refresh()))

func _row(title: String, blurb: String, tag: String, lit: bool, on: Callable) -> Button:
	var b := Button.new()
	b.text = "%s\n%s%s" % [title, blurb, ("   —   " + tag) if tag != "" else ""]
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(0, 58)
	b.add_theme_font_size_override("font_size", 14)
	if lit:
		b.modulate = Color(0.6, 1.0, 0.85)
	b.pressed.connect(on)
	return b
