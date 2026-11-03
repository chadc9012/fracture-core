extends Control
## The inventory and wardrobe screen (the Dec 4 plan, phase 3), sized for the phone: the worn slots down the left, the bag for
## the picked slot on the right (tap to wear), the operator's power at the top, and for armour slots a transmog row — which
## set's look the slot wears. Works on a gear_store.gd save Dictionary and emits `changed` after every edit so the scene can
## save it and refit the guns.

signal closed
signal changed

const Gear := preload("res://scripts/gear/gear_store.gd")

var gear: Dictionary
var level := 1
var slot := "primary"
var _power: Label
var _slots: VBoxContainer
var _bag: VBoxContainer
var _title: Label
var _transmog: OptionButton

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.05, 0.94)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var head := HBoxContainer.new()
	head.position = Vector2(16, 14)
	head.add_theme_constant_override("separation", 16)
	add_child(head)
	var close := Button.new()
	close.text = "← CLOSE"
	close.custom_minimum_size = Vector2(110, 44)
	close.pressed.connect(func(): closed.emit())
	head.add_child(close)
	_power = Label.new()
	_power.add_theme_font_size_override("font_size", 20)
	head.add_child(_power)
	var row := HBoxContainer.new()
	row.position = Vector2(16, 76)
	row.size = Vector2(size.x - 32, size.y - 90)
	row.set_anchors_preset(Control.PRESET_TOP_LEFT)
	row.add_theme_constant_override("separation", 14)
	add_child(row)
	_slots = VBoxContainer.new()
	_slots.custom_minimum_size = Vector2(190, 0)
	_slots.add_theme_constant_override("separation", 6)
	row.add_child(_slots)
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	row.add_child(right)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 18)
	_title.modulate = Color(0.75, 0.85, 0.95)
	right.add_child(_title)
	_transmog = OptionButton.new()
	_transmog.custom_minimum_size = Vector2(0, 40)
	_transmog.item_selected.connect(_pick_transmog)
	right.add_child(_transmog)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 600)
	right.add_child(scroll)
	_bag = VBoxContainer.new()
	_bag.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_bag.add_theme_constant_override("separation", 6)
	scroll.add_child(_bag)
	resized.connect(func(): row.size = Vector2(size.x - 32, size.y - 90))
	refresh()

func refresh() -> void:
	_power.text = "POWER %d" % int(Gear.operator_power(gear, level))
	for c in _slots.get_children():
		c.queue_free()
	for s in Gear.WEAPON_SLOTS + Gear.ARMOR_SLOTS:
		var it := Gear.worn(gear, s)
		var b := Button.new()
		b.text = "%s\n%s" % [String(Gear.SLOT_NAME[s]).to_upper(), (("%s · %d" % [it.name, int(it.power)]) if not it.is_empty() else "— empty —")]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(190, 52)
		b.add_theme_font_size_override("font_size", 13)
		if s == slot:
			b.modulate = Color(0.6, 1.0, 0.85)
		b.pressed.connect(func(): slot = s; refresh())
		_slots.add_child(b)
	_title.text = "%s · %d in the bag" % [String(Gear.SLOT_NAME[slot]).to_upper(), Gear.in_slot(gear, slot).size()]
	# transmog for armour slots: the sets' looks
	_transmog.visible = slot in Gear.ARMOR_SLOTS
	if _transmog.visible:
		_transmog.clear()
		_transmog.add_item("Look: the piece's own", 0)
		var sets: Array = Gear.data().get("armorSets", [])
		var cur: String = str(gear.transmog.get(slot, ""))
		for i in sets.size():
			_transmog.add_item("Look: %s" % sets[i].name, i + 1)
			if sets[i].id == cur:
				_transmog.select(i + 1)
	for c in _bag.get_children():
		c.queue_free()
	for it in Gear.in_slot(gear, slot):
		var wornit: bool = gear.equipped.get(slot, "") == it.id
		var b := Button.new()
		var extra: String = ""
		if it.get("set", "") != "":
			extra = " · " + String(Gear.armor_set(it.set).name)
		elif it.get("cls", "") != "":
			extra = " · " + String(Gear.data().classLabel.get(it.cls, it.cls))
		b.text = "%s%s\n%d power · %s%s" % [it.name, "  (worn)" if wornit else "", int(it.power), String(it.element).capitalize(), extra]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 56)
		b.add_theme_font_size_override("font_size", 14)
		if wornit:
			b.modulate = Color(0.6, 1.0, 0.85)
		b.pressed.connect(func():
			if wornit:
				Gear.unequip(gear, slot)
			else:
				Gear.equip(gear, it.id)
			changed.emit()
			refresh())
		_bag.add_child(b)

func _pick_transmog(index: int) -> void:
	var sets: Array = Gear.data().get("armorSets", [])
	Gear.set_transmog(gear, slot, "" if index == 0 else String(sets[index - 1].id))
	changed.emit()
