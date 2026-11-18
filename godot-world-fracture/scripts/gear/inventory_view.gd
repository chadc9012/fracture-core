extends Control
## The Character screen, after Destiny 2's (owner, Nov 18: interfaceingame.com's Destiny 2 page — "use that website to
## help develop the game"). Laid out the way Destiny lays it: the operator standing in the middle, the weapons in a column
## down the left (Kinetic, Energy, Power, Melee), the armour down the right (Helmet, Gauntlets, Chest, Legs, Class Item),
## the power level in gold at the top right, and a tab strip across the top. Each slot is a square tile: the item's art on
## its rarity colour, its power in the corner. Choosing a slot opens Destiny's popout: the item card (rarity header, power
## with its element, the frame's stat bars or the armour set's bonuses) beside a grid of what the bag holds for that slot;
## tap a tile to look at it, EQUIP to wear it. Armour slots also pick their look (transmog).
##
## Same contract as before for the scenes that open it: set `gear` (a gear_store.gd save) and optionally `level` /
## `profile`; it emits `changed` after every edit (save + refit) and `closed`.

signal closed
signal changed

const Gear := preload("res://scripts/gear/gear_store.gd")
const Ui := preload("res://scripts/ui/ui_theme.gd")
const Weapons := preload("res://scripts/combat/weapons.gd")
const Store := preload("res://scripts/character/character_store.gd")
const Rig := preload("res://scripts/character/character_rig.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const ARMOR_LOOK := "res://scripts/gear/armor_look.gd"

const LEFT := ["primary", "secondary", "heavy", "melee"]
const RIGHT := ["helmet", "gauntlets", "chest", "legs", "classItem"]
const TILE := 132.0

var gear: Dictionary
var level := 1
var profile: Dictionary = {}
var slot := ""             # the slot whose popout is open ("" = none)
var _pick := ""            # the item shown in the card (an id from the bag)

var _tiles := {}           # slot -> GearTile
var _texts := {}           # slot -> [name Label, type Label]
var _power: Label
var _sub: Label
var _stats: HBoxContainer
var _pop: Control
var _card: VBoxContainer
var _grid: GridContainer
var _bagtitle: Label
var _equip: Button
var _look: OptionButton
var _rig: Node3D
var _preview: SubViewport
var _spin := 0.0

# ------------------------------------------------------------------------------------------------ build
func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_backdrop()
	_operator_preview()
	_columns()
	_topbar()
	_bottom()
	_popout()
	refresh()

func _backdrop() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.025, 0.035, 0.94)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	# a soft light behind the operator, as Destiny's character screen has
	var glow := TextureRect.new()
	var g := GradientTexture2D.new()
	g.fill = GradientTexture2D.FILL_RADIAL
	g.fill_from = Vector2(0.5, 0.42)
	g.fill_to = Vector2(0.5, 1.05)
	var gr := Gradient.new()
	gr.set_color(0, Color(0.32, 0.42, 0.55, 0.38))
	gr.set_color(1, Color(0, 0, 0, 0))
	g.gradient = gr
	g.width = 512
	g.height = 512
	glow.texture = g
	glow.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	glow.stretch_mode = TextureRect.STRETCH_SCALE
	glow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(glow)

## the operator, rendered live in the middle (drag to turn them)
func _operator_preview() -> void:
	var box := SubViewportContainer.new()
	box.stretch = true
	box.anchor_left = 0.3
	box.anchor_right = 0.7
	box.anchor_top = 0.1
	box.anchor_bottom = 0.86
	box.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(box)
	_preview = SubViewport.new()
	_preview.own_world_3d = true
	_preview.transparent_bg = true
	_preview.msaa_3d = Viewport.MSAA_2X
	box.add_child(_preview)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.42, 0.46, 0.55)
	e.ambient_light_energy = 0.8
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	_preview.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-28, -32, 0)
	key.light_energy = 1.5
	key.light_color = Color(1.0, 0.95, 0.88)
	_preview.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-12, 160, 0)
	rim.light_energy = 1.6
	rim.light_color = Color(0.6, 0.78, 1.0)
	_preview.add_child(rim)
	var cam := Camera3D.new()
	cam.fov = 30.0
	_preview.add_child(cam)
	cam.look_at_from_position(Vector3(0, 1.05, 5.1), Vector3(0, 0.95, 0), Vector3.UP)
	cam.current = true
	_rig = Rig.new()
	_preview.add_child(_rig)
	var look: Dictionary = Store.load_look()
	_rig.build(look, true)
	_rig.rotation.y = deg_to_rad(-12.0)
	_dress()
	box.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventScreenDrag or (ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT)):
			_rig.rotation.y += ev.relative.x * 0.01)

## the worn outfit tint, and the worn armour where the armour look exists in this build
func _dress() -> void:
	if not _rig:
		return
	OutfitLook.apply(_rig, Gear.outfit(str(gear.get("outfit", ""))))
	if ResourceLoader.exists(ARMOR_LOOK):
		var al: Script = load(ARMOR_LOOK)
		al.apply(_rig, gear)

func _columns() -> void:
	for side in [LEFT, RIGHT]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 18)
		var left: bool = side == LEFT
		col.anchor_left = 0.0 if left else 1.0
		col.anchor_right = col.anchor_left
		col.anchor_top = 0.5
		col.anchor_bottom = 0.5
		col.grow_horizontal = Control.GROW_DIRECTION_END if left else Control.GROW_DIRECTION_BEGIN
		col.grow_vertical = Control.GROW_DIRECTION_BOTH
		col.offset_left = 64.0 if left else -64.0
		col.offset_right = col.offset_left
		add_child(col)
		var head := Label.new()
		head.text = "WEAPONS" if left else "ARMOR"
		head.theme_type_variation = "HeaderSmall"
		head.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if left else HORIZONTAL_ALIGNMENT_RIGHT
		col.add_child(head)
		for s in side:
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 18)
			row.alignment = BoxContainer.ALIGNMENT_BEGIN if left else BoxContainer.ALIGNMENT_END
			col.add_child(row)
			var t := GearTile.new()
			t.custom_minimum_size = Vector2(TILE, TILE)
			t.toggle_mode = true
			t.pressed.connect(_open.bind(s))
			_tiles[s] = t
			var words := VBoxContainer.new()
			words.alignment = BoxContainer.ALIGNMENT_CENTER
			words.custom_minimum_size = Vector2(300, 0)
			words.add_theme_constant_override("separation", 2)
			var cap := Label.new()
			cap.theme_type_variation = "HeaderSmall"
			cap.text = String(Gear.SLOT_NAME[s]).to_upper()
			var nm := Label.new()
			nm.add_theme_font_override("font", Ui.font(600))
			nm.add_theme_font_size_override("font_size", 22)
			nm.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			var ty := Label.new()
			ty.theme_type_variation = "Caption"
			ty.add_theme_font_size_override("font_size", 16)
			for l in [cap, nm, ty]:
				l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if left else HORIZONTAL_ALIGNMENT_RIGHT
				words.add_child(l)
			_texts[s] = [nm, ty]
			if left:
				row.add_child(t)
				row.add_child(words)
			else:
				row.add_child(words)
				row.add_child(t)

func _topbar() -> void:
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 48
	bar.offset_right = -48
	bar.offset_top = 28
	bar.offset_bottom = 104
	bar.add_theme_constant_override("separation", 28)
	add_child(bar)
	var close := Button.new()
	close.text = "✕  BACK"
	close.custom_minimum_size = Vector2(150, 64)
	close.pressed.connect(func(): closed.emit())
	bar.add_child(close)
	var who := VBoxContainer.new()
	who.alignment = BoxContainer.ALIGNMENT_CENTER
	who.add_theme_constant_override("separation", 0)
	bar.add_child(who)
	var name_l := Label.new()
	name_l.theme_type_variation = "HeaderLarge"
	var look: Dictionary = Store.load_look()
	name_l.text = String(look.get("name", "OPERATOR")).to_upper() if str(look.get("name", "")) != "" else _frame_name(String(look.get("frame", "goliath")))
	who.add_child(name_l)
	_sub = Label.new()
	_sub.theme_type_variation = "Caption"
	who.add_child(_sub)
	# the tab strip (Destiny's director tabs); Character is this screen
	var tabs := HBoxContainer.new()
	tabs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	tabs.add_theme_constant_override("separation", 6)
	bar.add_child(tabs)
	for tname in ["CHARACTER"]:
		var tb := Button.new()
		tb.theme_type_variation = "Tab"
		tb.text = tname
		tb.toggle_mode = true
		tb.button_pressed = tname == "CHARACTER"
		tb.custom_minimum_size = Vector2(0, 64)
		tabs.add_child(tb)
	# power, gold diamond, top right
	var pw := HBoxContainer.new()
	pw.alignment = BoxContainer.ALIGNMENT_END
	pw.add_theme_constant_override("separation", 10)
	bar.add_child(pw)
	var dia := Diamond.new()
	dia.custom_minimum_size = Vector2(30, 64)
	pw.add_child(dia)
	_power = Label.new()
	_power.add_theme_font_override("font", Ui.font(600))
	_power.add_theme_font_size_override("font_size", 52)
	_power.add_theme_color_override("font_color", Ui.GOLD)
	pw.add_child(_power)

static func _frame_name(f: String) -> String:
	return { "goliath": "TITAN", "nyx": "HUNTER", "cipher": "WARLOCK" }.get(f, "OPERATOR")

func _bottom() -> void:
	_stats = HBoxContainer.new()
	_stats.anchor_left = 0.5
	_stats.anchor_right = 0.5
	_stats.anchor_top = 1.0
	_stats.anchor_bottom = 1.0
	_stats.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_stats.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_stats.offset_bottom = -40
	_stats.add_theme_constant_override("separation", 48)
	add_child(_stats)

## the popout: the item card and the bag grid for the chosen slot (Destiny's flyout beside the slot)
func _popout() -> void:
	_pop = Control.new()
	_pop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pop.visible = false
	add_child(_pop)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(ev: InputEvent):
		if (ev is InputEventMouseButton or ev is InputEventScreenTouch) and ev.pressed:
			_close_pop())
	_pop.add_child(dim)
	var row := HBoxContainer.new()
	row.anchor_left = 0.5
	row.anchor_right = 0.5
	row.anchor_top = 0.5
	row.anchor_bottom = 0.5
	row.grow_horizontal = Control.GROW_DIRECTION_BOTH
	row.grow_vertical = Control.GROW_DIRECTION_BOTH
	row.add_theme_constant_override("separation", 28)
	_pop.add_child(row)
	# the bag
	var bag := PanelContainer.new()
	bag.custom_minimum_size = Vector2(5 * (TILE + 12) + 40, 0)
	row.add_child(bag)
	var bv := VBoxContainer.new()
	bv.add_theme_constant_override("separation", 16)
	bag.add_child(bv)
	_bagtitle = Label.new()
	_bagtitle.theme_type_variation = "HeaderSmall"
	bv.add_child(_bagtitle)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 3 * (TILE + 12))
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	bv.add_child(scroll)
	_grid = GridContainer.new()
	_grid.columns = 5
	_grid.add_theme_constant_override("h_separation", 12)
	_grid.add_theme_constant_override("v_separation", 12)
	scroll.add_child(_grid)
	_look = OptionButton.new()
	_look.custom_minimum_size = Vector2(0, 60)
	_look.item_selected.connect(_pick_transmog)
	bv.add_child(_look)
	# the item card
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(560, 0)
	card.add_theme_stylebox_override("panel", Ui.box(Ui.PANEL_SOLID, Ui.LINE, 1, Vector4(0, 0, 0, 0)))
	row.add_child(card)
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 0)
	card.add_child(cv)
	_card = VBoxContainer.new()
	_card.add_theme_constant_override("separation", 0)
	cv.add_child(_card)
	var foot := MarginContainer.new()
	for k in ["left", "right", "bottom"]:
		foot.add_theme_constant_override("margin_" + k, 24)
	foot.add_theme_constant_override("margin_top", 8)
	cv.add_child(foot)
	_equip = Button.new()
	_equip.custom_minimum_size = Vector2(0, 72)
	_equip.pressed.connect(_equip_pick)
	foot.add_child(_equip)

# ------------------------------------------------------------------------------------------------ refresh
func refresh() -> void:
	_power.text = "%d" % int(Gear.operator_power(gear, level))
	var nex := int(profile.get("nex", 0))
	_sub.text = "Level %d%s" % [level, ("   ·   %s Nex" % _thousands(nex)) if not profile.is_empty() else ""]
	for s in _tiles:
		var it := Gear.worn(gear, s)
		var t: GearTile = _tiles[s]
		t.set_item(it, s)
		t.button_pressed = s == slot
		var nm: Label = _texts[s][0]
		var ty: Label = _texts[s][1]
		nm.text = String(it.name) if not it.is_empty() else "Empty"
		nm.modulate = Color(1, 1, 1) if not it.is_empty() else Ui.INK_FAINT
		ty.text = _type_line(it) if not it.is_empty() else ""
	# stats along the bottom
	for c in _stats.get_children():
		c.queue_free()
	var w := Gear.worn(gear, "primary")
	_stat("DAMAGE", "×%.2f" % Gear.damage_mult(float(w.power)) if not w.is_empty() else "—")
	_stat("ARMOR HULL", "+%d" % int(Gear.hull_bonus(gear)))
	var sets := _set_counts()
	var best := ""
	for sid in sets:
		if best == "" or sets[sid] > sets[best]:
			best = sid
	_stat("SET", ("%s %d/5" % [String(Gear.armor_set(best).get("name", "")), sets[best]]) if best != "" else "None")
	_stat("ITEMS", "%d" % gear.get("items", []).size())
	if _pop.visible:
		_fill_pop()

func _stat(k: String, v: String) -> void:
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", 0)
	var kl := Label.new()
	kl.theme_type_variation = "HeaderSmall"
	kl.text = k
	kl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var vl := Label.new()
	vl.add_theme_font_override("font", Ui.font(600))
	vl.add_theme_font_size_override("font_size", 26)
	vl.text = v
	vl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_child(kl)
	b.add_child(vl)
	_stats.add_child(b)

static func _thousands(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.right(3) + out
		s = s.left(s.length() - 3)
	return ("-" if n < 0 else "") + s + out

## "Auto Rifle · Legendary" / "Warden Hood · Verdant Warden"
static func _type_line(it: Dictionary) -> String:
	var r := rarity_of(it)
	if str(it.get("set", "")) != "":
		return "%s · %s" % [String(Gear.armor_set(it.set).get("name", "")), Ui.RARITY_NAME.get(r, "")]
	if str(it.get("slot", "")) == "melee":
		return "%s · %s" % [String(Gear.data().classLabel.get(str(it.get("cls", "melee")), "Melee")).trim_suffix("s"), Ui.RARITY_NAME.get(r, "")]
	var f: Dictionary = Weapons.FRAMES.get(str(it.get("frame", "")), {})
	var kind: String = String(f.get("name", "Weapon")) if not f.is_empty() else String(Gear.data().classLabel.get(str(it.get("cls", "")), "Armor"))
	if Gear.ARMOR_SLOTS.has(str(it.get("slot", ""))):
		kind = String(Gear.SLOT_NAME[it.slot])
	return "%s · %s" % [kind, Ui.RARITY_NAME.get(r, "")]

## an item's rarity: its own, else its catalogue entry's, else Legendary for set armour and Common otherwise
static func rarity_of(it: Dictionary) -> String:
	if it.is_empty():
		return "common"
	if str(it.get("rarity", "")) != "":
		return str(it.rarity)
	for w in Gear.data().get("weapons", []):
		if w.name == it.get("name", ""):
			return str(w.rarity)
	return "epic" if str(it.get("set", "")) != "" else "rare"

func _set_counts() -> Dictionary:
	var out := {}
	for s in Gear.ARMOR_SLOTS:
		var it := Gear.worn(gear, s)
		var sid := str(it.get("set", ""))
		if sid != "":
			out[sid] = int(out.get(sid, 0)) + 1
	return out

# ------------------------------------------------------------------------------------------------ popout
func _open(s: String) -> void:
	slot = s
	var it := Gear.worn(gear, s)
	_pick = str(it.get("id", ""))
	if _pick == "":
		var bag := Gear.in_slot(gear, s)
		_pick = str(bag[0].id) if not bag.is_empty() else ""
	_pop.visible = true
	refresh()

func _close_pop() -> void:
	_pop.visible = false
	slot = ""
	refresh()

func _fill_pop() -> void:
	var items := Gear.in_slot(gear, slot)
	_bagtitle.text = "%s   ·   %d" % [String(Gear.SLOT_NAME[slot]).to_upper(), items.size()]
	for c in _grid.get_children():
		c.queue_free()
	for it in items:
		var t := GearTile.new()
		t.custom_minimum_size = Vector2(TILE, TILE)
		t.toggle_mode = true
		t.set_item(it, slot)
		t.worn = gear.equipped.get(slot, "") == it.id
		t.button_pressed = str(it.id) == _pick
		t.pressed.connect(func(): _pick = str(it.id); _fill_pop())
		_grid.add_child(t)
	_look.visible = slot in Gear.ARMOR_SLOTS
	if _look.visible:
		_look.clear()
		_look.add_item("LOOK  ·  the piece's own", 0)
		var sets: Array = Gear.data().get("armorSets", [])
		var cur: String = str(gear.get("transmog", {}).get(slot, ""))
		for i in sets.size():
			_look.add_item("LOOK  ·  %s" % sets[i].name, i + 1)
			if sets[i].id == cur:
				_look.select(i + 1)
	_fill_card(Gear.item(gear, _pick) if _pick != "" else {})

func _fill_card(it: Dictionary) -> void:
	for c in _card.get_children():
		c.queue_free()
	if it.is_empty():
		var none := Label.new()
		none.text = "Nothing in the bag for this slot yet."
		none.theme_type_variation = "Caption"
		var m := MarginContainer.new()
		m.add_theme_constant_override("margin_left", 24)
		m.add_theme_constant_override("margin_top", 24)
		m.add_child(none)
		_card.add_child(m)
		_equip.visible = false
		return
	var r := rarity_of(it)
	# the header band in the rarity colour: name, then the type line
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", Ui.box(Ui.rarity_color(r), Color(0, 0, 0, 0), 0, Vector4(24, 18, 24, 16)))
	_card.add_child(head)
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 2)
	head.add_child(hv)
	var nm := Label.new()
	nm.text = String(it.name).to_upper()
	nm.add_theme_font_override("font", Ui.font(700, 2))
	nm.add_theme_font_size_override("font_size", 30)
	nm.add_theme_color_override("font_color", Color(0.08, 0.08, 0.09) if r == "exotic" or r == "common" else Color(1, 1, 1))
	hv.add_child(nm)
	var ty := Label.new()
	ty.text = _type_line(it)
	ty.add_theme_font_size_override("font_size", 17)
	ty.add_theme_color_override("font_color", Color(0.08, 0.08, 0.09, 0.8) if r == "exotic" or r == "common" else Color(1, 1, 1, 0.8))
	hv.add_child(ty)
	var body := MarginContainer.new()
	for k in ["left", "right", "top", "bottom"]:
		body.add_theme_constant_override("margin_" + k, 24)
	_card.add_child(body)
	var bv := VBoxContainer.new()
	bv.add_theme_constant_override("separation", 14)
	body.add_child(bv)
	# power, with the element's mark
	var pr := HBoxContainer.new()
	pr.add_theme_constant_override("separation", 14)
	bv.add_child(pr)
	var el := ElementMark.new()
	el.element = str(it.get("element", "KINETIC"))
	el.custom_minimum_size = Vector2(40, 64)
	pr.add_child(el)
	var pv := Label.new()
	pv.text = str(int(it.power))
	pv.add_theme_font_override("font", Ui.font(600))
	pv.add_theme_font_size_override("font_size", 58)
	pr.add_child(pv)
	var pl := Label.new()
	pl.text = "POWER\n%s" % String(it.get("element", "KINETIC")).capitalize()
	pl.theme_type_variation = "HeaderSmall"
	pl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pl.size_flags_vertical = Control.SIZE_FILL
	pr.add_child(pl)
	bv.add_child(_rule())
	if str(it.get("set", "")) != "":
		_armor_body(bv, it)
	elif Weapons.FRAMES.has(str(it.get("frame", ""))) and str(it.get("slot", "")) != "melee":
		_weapon_body(bv, Weapons.FRAMES[str(it.frame)])
	else:
		var d := Label.new()
		d.text = "Close-quarters weapon." if str(it.get("slot", "")) == "melee" else "Starting gear."
		d.theme_type_variation = "Caption"
		bv.add_child(d)
	if str(it.get("source", "")) != "":
		var src := Label.new()
		src.text = "Source: %s" % it.source
		src.theme_type_variation = "Caption"
		bv.add_child(src)
	var wornit: bool = gear.equipped.get(slot, "") == it.id
	_equip.visible = true
	_equip.text = "UNEQUIP" if wornit else "EQUIP"

func _rule() -> ColorRect:
	var r := ColorRect.new()
	r.color = Ui.LINE
	r.custom_minimum_size = Vector2(0, 1)
	return r

## Destiny's stat bars from the frame's numbers, each scaled across the game's frames
func _weapon_body(bv: VBoxContainer, f: Dictionary) -> void:
	var lo := {}
	var hi := {}
	for k in Weapons.FRAMES:
		var g: Dictionary = Weapons.FRAMES[k]
		var vals := { "impact": float(g.damage) * float(g.get("pellets", 1)), "range": float(g.range_full), "stability": 1.0 / maxf(float(g.recoil), 0.001), "handling": 1.0 / maxf(float(g.spread), 0.001), "reload": 1.0 / maxf(float(g.reload), 0.1) }
		for v in vals:
			lo[v] = minf(float(lo.get(v, 1e9)), vals[v])
			hi[v] = maxf(float(hi.get(v, -1e9)), vals[v])
	var mine := { "impact": float(f.damage) * float(f.get("pellets", 1)), "range": float(f.range_full), "stability": 1.0 / maxf(float(f.recoil), 0.001), "handling": 1.0 / maxf(float(f.spread), 0.001), "reload": 1.0 / maxf(float(f.reload), 0.1) }
	for k in ["impact", "range", "stability", "handling", "reload"]:
		var v: float = (mine[k] - lo[k]) / maxf(hi[k] - lo[k], 1e-6)
		_bar(bv, k.capitalize(), clampf(0.12 + v * 0.88, 0.0, 1.0))
	_num(bv, "Rounds / min", "%d" % int(round(60.0 / maxf(float(f.fire_rate), 0.01) * float(f.burst))))
	_num(bv, "Magazine", "%d" % int(f.mag))
	var lab := Label.new()
	lab.text = String(f.get("label", ""))
	lab.theme_type_variation = "Caption"
	bv.add_child(lab)

func _bar(bv: VBoxContainer, k: String, v: float) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	var kl := Label.new()
	kl.text = k
	kl.custom_minimum_size = Vector2(170, 0)
	kl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	kl.add_theme_color_override("font_color", Ui.INK_DIM)
	row.add_child(kl)
	var b := ProgressBar.new()
	b.show_percentage = false
	b.custom_minimum_size = Vector2(0, 14)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.max_value = 1.0
	b.value = v
	row.add_child(b)
	bv.add_child(row)

func _num(bv: VBoxContainer, k: String, v: String) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	var kl := Label.new()
	kl.text = k
	kl.custom_minimum_size = Vector2(170, 0)
	kl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	kl.add_theme_color_override("font_color", Ui.INK_DIM)
	row.add_child(kl)
	var vl := Label.new()
	vl.text = v
	vl.add_theme_font_override("font", Ui.font(600))
	row.add_child(vl)
	bv.add_child(row)

## the set's name, line, and its 2- and 4-piece bonuses, lit when enough of the set is worn
func _armor_body(bv: VBoxContainer, it: Dictionary) -> void:
	var s := Gear.armor_set(str(it.set))
	var worn := int(_set_counts().get(str(it.set), 0))
	var sn := Label.new()
	sn.text = String(s.get("name", "")).to_upper()
	sn.add_theme_font_override("font", Ui.font(700, 2))
	sn.add_theme_font_size_override("font_size", 20)
	sn.add_theme_color_override("font_color", Color(String(s.get("color", "#ffffff"))).lightened(0.25))
	bv.add_child(sn)
	var tl := Label.new()
	tl.text = String(s.get("tagline", ""))
	tl.theme_type_variation = "Caption"
	tl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bv.add_child(tl)
	for pair in [[2, "two"], [4, "four"]]:
		var b: Dictionary = s.get(pair[1], {})
		if b.is_empty():
			continue
		var on := worn >= int(pair[0])
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 2)
		var h := Label.new()
		h.text = "%d-PIECE  ·  %s%s" % [pair[0], String(b.name).to_upper(), "" if on else "   (%d/%d)" % [worn, pair[0]]]
		h.add_theme_font_override("font", Ui.font(600, 1))
		h.add_theme_font_size_override("font_size", 16)
		h.add_theme_color_override("font_color", Ui.INK if on else Ui.INK_FAINT)
		row.add_child(h)
		var d := Label.new()
		d.text = String(b.description)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.add_theme_font_size_override("font_size", 16)
		d.add_theme_color_override("font_color", Ui.INK_DIM if on else Ui.INK_FAINT)
		row.add_child(d)
		bv.add_child(row)

func _equip_pick() -> void:
	if _pick == "":
		return
	if gear.equipped.get(slot, "") == _pick:
		Gear.unequip(gear, slot)
	else:
		Gear.equip(gear, _pick)
	_dress()
	changed.emit()
	refresh()

func _pick_transmog(index: int) -> void:
	var sets: Array = Gear.data().get("armorSets", [])
	Gear.set_transmog(gear, slot, "" if index == 0 else String(sets[index - 1].id))
	_dress()
	changed.emit()

# ------------------------------------------------------------------------------------------------ drawn parts
## a gear tile: the item's art on its rarity colour (a light gradient, as Destiny's tiles), power in the corner, a white
## corner tick when it is worn; armour and melee get a drawn emblem for their slot
class GearTile extends Button:
	const Ui := preload("res://scripts/ui/ui_theme.gd")
	var item: Dictionary = {}
	var slot := ""
	var worn := false
	var _icon: Texture2D

	func _init() -> void:
		theme_type_variation = "Tile"
		focus_mode = Control.FOCUS_ALL

	func set_item(it: Dictionary, s: String) -> void:
		item = it
		slot = s
		_icon = null
		var f := str(it.get("frame", ""))
		if s != "melee" and f != "" and ResourceLoader.exists("res://ui/icons/weapon-%s.png" % f):
			_icon = load("res://ui/icons/weapon-%s.png" % f)
		queue_redraw()

	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		if item.is_empty():
			draw_rect(r.grow(-1), Color(1, 1, 1, 0.03))
			_emblem(r, Color(1, 1, 1, 0.16))
			return
		var c: Color = Ui.rarity_color(_rarity())
		# rarity gradient, darker at the bottom
		var top := c.lightened(0.08)
		var bot := c.darkened(0.45)
		var pts := PackedVector2Array([r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)])
		draw_polygon(pts, PackedColorArray([top, top, bot, bot]))
		if _icon:
			var pad := size.x * 0.06
			var ar := float(_icon.get_width()) / float(_icon.get_height())
			var w := size.x - pad * 2.0
			var h := w / ar
			draw_texture_rect(_icon, Rect2(Vector2(pad, (size.y - h) * 0.5), Vector2(w, h)), false)
		else:
			_emblem(r, Color(1, 1, 1, 0.82))
		# element pip, top left
		draw_circle(Vector2(14, 14), 6.0, Ui.element_color(str(item.get("element", "KINETIC"))))
		# power, bottom right, on a dark strip
		var pw := str(int(item.get("power", 0)))
		var f: Font = Ui.font(600)
		var fs := 22
		var tw := f.get_string_size(pw, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_rect(Rect2(size.x - tw - 14, size.y - 30, tw + 14, 30), Color(0, 0, 0, 0.55))
		draw_string(f, Vector2(size.x - tw - 7, size.y - 8), pw, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1))
		if worn:
			draw_colored_polygon(PackedVector2Array([Vector2(size.x - 26, 0), Vector2(size.x, 0), Vector2(size.x, 26)]), Color(1, 1, 1, 0.95))

	func _rarity() -> String:
		if str(item.get("rarity", "")) != "":
			return str(item.rarity)
		return "epic" if str(item.get("set", "")) != "" else "rare"

	## simple silhouettes for the armour slots and melee
	func _emblem(r: Rect2, col: Color) -> void:
		var c := r.get_center()
		var u := r.size.x / 100.0
		match slot:
			"helmet":
				draw_circle(c + Vector2(0, -4) * u, 26 * u, col)
				draw_rect(Rect2(c + Vector2(-26, -4) * u, Vector2(52, 30) * u), col)
				draw_rect(Rect2(c + Vector2(-18, -6) * u, Vector2(36, 8) * u), Color(0, 0, 0, 0.55))
			"chest":
				draw_colored_polygon(PackedVector2Array([c + Vector2(-30, -26) * u, c + Vector2(30, -26) * u, c + Vector2(24, 28) * u, c + Vector2(-24, 28) * u]), col)
				draw_rect(Rect2(c + Vector2(-2, -22) * u, Vector2(4, 46) * u), Color(0, 0, 0, 0.35))
			"gauntlets":
				draw_rect(Rect2(c + Vector2(-18, -24) * u, Vector2(36, 30) * u), col)
				draw_rect(Rect2(c + Vector2(-14, 8) * u, Vector2(28, 20) * u), col)
				draw_rect(Rect2(c + Vector2(-18, 4) * u, Vector2(36, 3) * u), Color(0, 0, 0, 0.45))
			"legs":
				draw_rect(Rect2(c + Vector2(-22, -28) * u, Vector2(44, 14) * u), col)
				draw_rect(Rect2(c + Vector2(-22, -14) * u, Vector2(18, 44) * u), col)
				draw_rect(Rect2(c + Vector2(4, -14) * u, Vector2(18, 44) * u), col)
			"classItem":
				draw_colored_polygon(PackedVector2Array([c + Vector2(-20, -30) * u, c + Vector2(20, -30) * u, c + Vector2(20, 22) * u, c + Vector2(0, 32) * u, c + Vector2(-20, 22) * u]), col)
			"melee":
				draw_colored_polygon(PackedVector2Array([c + Vector2(-26, 26) * u, c + Vector2(20, -24) * u, c + Vector2(28, -30) * u, c + Vector2(24, -20) * u, c + Vector2(-22, 30) * u]), col)
				draw_rect(Rect2(c + Vector2(-30, 14) * u, Vector2(16, 5) * u), col)
			_:
				draw_rect(Rect2(c - Vector2(20, 6) * u, Vector2(40, 12) * u), col)

## the gold power diamond
class Diamond extends Control:
	const Ui := preload("res://scripts/ui/ui_theme.gd")
	func _draw() -> void:
		var c := size * 0.5
		var h := minf(size.x, size.y) * 0.42
		draw_colored_polygon(PackedVector2Array([c + Vector2(0, -h), c + Vector2(h * 0.62, 0), c + Vector2(0, h), c + Vector2(-h * 0.62, 0)]), Ui.GOLD)

## the element's mark on the item card: a ring in the element's colour around a dot
class ElementMark extends Control:
	const Ui := preload("res://scripts/ui/ui_theme.gd")
	var element := "KINETIC"
	func _draw() -> void:
		var c := size * 0.5
		var col: Color = Ui.element_color(element)
		draw_arc(c, 16.0, 0.0, TAU, 40, col, 3.0, true)
		draw_circle(c, 7.0, col)
