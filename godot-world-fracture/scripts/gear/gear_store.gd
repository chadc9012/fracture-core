extends RefCounted
## The operator's gear (the Dec 4 plan, phase 3): the bag and the worn slots, saved to user://inventory.json, over the web game's
## catalogues exported to data/gear.json (bun scripts/export-godot-gear.ts). Rules are the web game's (src/game/inventory.ts,
## weapon-meta.ts): an item is {id, name, slot, power, level, element, frame, cls, set?}; weapon slots primary / secondary /
## heavy / melee, armour slots helmet / chest / gauntlets / legs / classItem; a weapon's damage multiplier is
## 1 + (power − 100) / 500 capped at 1.7; operator power is the worn average plus the level. Transmog remembers which armour
## set's look a slot wears (the numbers never change). Drops come from the catalogue's loot and boss pools. Pure: the save is
## a Dictionary passed in and out, so tests/gear/gear_store_test.gd runs headless.

const PATH := "user://inventory.json"
const DATA := "res://data/gear.json"
const WEAPON_SLOTS := ["primary", "secondary", "heavy", "melee"]
const ARMOR_SLOTS := ["helmet", "chest", "gauntlets", "legs", "classItem"]
const SLOT_NAME := { "primary": "Kinetic", "secondary": "Energy", "heavy": "Power", "melee": "Melee", "helmet": "Helmet", "chest": "Chest", "gauntlets": "Gauntlets", "legs": "Legs", "classItem": "Class Item" }
const DAMAGE_CAP := 1.7
const LEVEL_POWER := 2.0

static var _data: Dictionary = {}
static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(DATA, FileAccess.READ)
		if f:
			var d: Variant = JSON.parse_string(f.get_as_text())
			if d is Dictionary:
				_data = d
	return _data

## a fresh save: the starting loadout worn
static func fresh() -> Dictionary:
	var items: Array = []
	var equipped := {}
	for g in data().get("starter", []):
		var it: Dictionary = (g as Dictionary).duplicate()
		items.append(it)
		equipped[it.slot] = it.id
	return { "items": items, "equipped": equipped, "transmog": {}, "outfit": "", "next_id": 1, "outfits": [], "furniture": [] }

static func load_save() -> Dictionary:
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary and d.has("items"):
			return clean(d)
	return fresh()

static func save(d: Dictionary) -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

## drops unknown slots and dangling equips
static func clean(d: Dictionary) -> Dictionary:
	var out := { "items": [], "equipped": {}, "transmog": {}, "outfit": str(d.get("outfit", "")), "next_id": int(d.get("next_id", 1)), "outfits": [], "furniture": [] }
	for o in d.get("outfits", []):
		if o is String and not outfit(o).is_empty() and o not in out.outfits:
			out.outfits.append(o)
	for fid in d.get("furniture", []):
		if fid is String and not furniture(fid).is_empty() and fid not in out.furniture:
			out.furniture.append(fid)
	if out.outfit != "" and out.outfit not in out.outfits:
		out.outfit = ""
	for it in d.get("items", []):
		if it is Dictionary and it.has("id") and (it.get("slot", "") in WEAPON_SLOTS or it.get("slot", "") in ARMOR_SLOTS):
			out.items.append(it)
	for slot in d.get("equipped", {}):
		var id: String = str(d.equipped[slot])
		var it := item(out, id)
		if not it.is_empty() and it.slot == slot:
			out.equipped[slot] = id
	for slot in d.get("transmog", {}):
		if slot in ARMOR_SLOTS and not armor_set(str(d.transmog[slot])).is_empty():
			out.transmog[slot] = str(d.transmog[slot])
	return out

static func item(d: Dictionary, id: String) -> Dictionary:
	for it in d.items:
		if it.id == id:
			return it
	return {}

static func worn(d: Dictionary, slot: String) -> Dictionary:
	return item(d, str(d.equipped.get(slot, ""))) if d.equipped.has(slot) else {}

static func in_slot(d: Dictionary, slot: String) -> Array:
	var out: Array = []
	for it in d.items:
		if it.slot == slot:
			out.append(it)
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.power) > int(b.power))
	return out

static func equip(d: Dictionary, id: String) -> bool:
	var it := item(d, id)
	if it.is_empty():
		return false
	d.equipped[it.slot] = id
	return true

static func unequip(d: Dictionary, slot: String) -> void:
	d.equipped.erase(slot)

## the look an armour slot wears: a set id, or "" for the piece's own
static func set_transmog(d: Dictionary, slot: String, set_id: String) -> void:
	if set_id == "" or armor_set(set_id).is_empty():
		d.transmog.erase(slot)
	else:
		d.transmog[slot] = set_id

static func armor_set(id: String) -> Dictionary:
	for s in data().get("armorSets", []):
		if s.id == id:
			return s
	return {}

## a weapon's damage multiplier from its power (inventory.ts weaponDamageMultiplier)
static func damage_mult(power: float) -> float:
	return minf(DAMAGE_CAP, 1.0 + maxf(0.0, power - 100.0) / 500.0)

## operator power: the worn average (90 with nothing on) plus 2 a level (weapon-meta.ts operatorPower)
static func operator_power(d: Dictionary, level := 1) -> float:
	var ps: Array = []
	for slot in d.equipped:
		var it := worn(d, slot)
		if not it.is_empty():
			ps.append(float(it.power))
	var avg := 90.0
	if not ps.is_empty():
		avg = 0.0
		for p in ps:
			avg += p
		avg /= ps.size()
	return avg + LEVEL_POWER * (maxi(1, level) - 1)

## hull bonus from the worn armour: +1 hull for every 5 power the average piece has over 75
static func hull_bonus(d: Dictionary) -> float:
	var ps: Array = []
	for slot in ARMOR_SLOTS:
		var it := worn(d, slot)
		if not it.is_empty():
			ps.append(float(it.power))
	if ps.is_empty():
		return 0.0
	var avg := 0.0
	for p in ps:
		avg += p
	avg /= ps.size()
	return maxf(0.0, (avg - 75.0) / 5.0)

## the worn weapons the gun list carries: [{slot, name, frame, power, mult, cls}] in slot order
static func loadout(d: Dictionary) -> Array:
	var out: Array = []
	for slot in ["primary", "secondary", "heavy"]:
		var it := worn(d, slot)
		if not it.is_empty():
			out.append({ "slot": slot, "id": it.id, "name": it.name, "frame": str(it.get("frame", "AUTO")), "power": float(it.power), "mult": damage_mult(float(it.power)), "cls": str(it.get("cls", "")) })
	return out

## a drop from the catalogue: enemies roll the loot pool, elites and bosses the boss pool too; `roll` is one uniform 0..1.
## Chance 18% / 40% / 100%; the power band sits around the operator's own. Returns the item added, or {} for no drop.
static func roll_drop(d: Dictionary, source: String, roll: float, op_power: float, rng_seed: int) -> Dictionary:
	var chance := 1.0 if source == "boss" else (0.4 if source == "elite" else 0.18)
	if roll >= chance:
		return {}
	var pool: Array = []
	for w in data().get("weapons", []):
		if w.via == "loot" or (source != "enemy" and w.via == "boss"):
			pool.append(w)
	# a third of drops are armour pieces from the sets
	var sets: Array = data().get("armorSets", [])
	var r := RandomNumberGenerator.new()
	r.seed = rng_seed
	var it: Dictionary
	if r.randf() < 0.33 and not sets.is_empty():
		var s: Dictionary = sets[r.randi() % sets.size()]
		var slot: String = ARMOR_SLOTS[r.randi() % ARMOR_SLOTS.size()]
		it = { "name": s.pieces[slot], "slot": slot, "element": s.element, "set": s.id, "frame": "", "cls": "" }
	elif not pool.is_empty():
		var w: Dictionary = pool[r.randi() % pool.size()]
		it = { "name": w.name, "slot": w.slot, "element": w.element, "frame": w.frame, "cls": w.cls, "rarity": w.rarity }
	else:
		return {}
	it.id = "drop-%d" % int(d.next_id)
	d.next_id = int(d.next_id) + 1
	it.power = int(clampf(op_power + r.randf_range(-15.0, 25.0) + (20.0 if source == "boss" else 0.0), 80.0, 500.0))
	it.level = 1
	it.source = "Drop"
	d.items.append(it)
	return it

# --------------------------------------------------------------------------------------------- shops (the mall)
const PROFILE := "user://profile.json"
## Haven Home's catalogue: furnishings for Apartment 12-04, by the room slot each fills
const FURNITURE := [
	{ "id": "sofa-loft", "name": "Loft Sofa", "slot": "sofa", "price": 650, "blurb": "Low grey three-seater." },
	{ "id": "sofa-velvet", "name": "Velvet Chesterfield", "slot": "sofa", "price": 1400, "blurb": "Deep green, brass studs." },
	{ "id": "table-glass", "name": "Glass Coffee Table", "slot": "table", "price": 380, "blurb": "Smoked glass on steel." },
	{ "id": "table-oak", "name": "Oak Slab Table", "slot": "table", "price": 720, "blurb": "Live edge, waxed." },
	{ "id": "lamp-arc", "name": "Arc Floor Lamp", "slot": "lamp", "price": 240, "blurb": "Brushed steel, warm white." },
	{ "id": "lamp-neon", "name": "Neon Tube Lamp", "slot": "lamp", "price": 310, "blurb": "Nexus pink, dimmable." },
	{ "id": "rug-wool", "name": "Wool Rug", "slot": "rug", "price": 290, "blurb": "Oatmeal, hand-loomed." },
	{ "id": "rug-circuit", "name": "Circuit Rug", "slot": "rug", "price": 420, "blurb": "Black with cyan traces." },
	{ "id": "art-skyline", "name": "Nexus Skyline Print", "slot": "art", "price": 180, "blurb": "The towers at night." },
	{ "id": "art-fracture", "name": "First Light", "slot": "art", "price": 560, "blurb": "The Fracture in oils." },
	{ "id": "plant-fern", "name": "Tree Fern", "slot": "plant", "price": 140, "blurb": "Veridan Forest stock." },
	{ "id": "bed-platform", "name": "Platform Bed", "slot": "bed", "price": 980, "blurb": "Walnut, linen." },
]

static func outfit(id: String) -> Dictionary:
	for o in data().get("outfits", []):
		if o.id == id:
			return o
	return {}

static func furniture(id: String) -> Dictionary:
	for f in FURNITURE:
		if f.id == id:
			return f
	return {}

static func profile_load() -> Dictionary:
	var p := { "xp": 0, "nex": 0, "level": 1 }
	var f := FileAccess.open(PROFILE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			p.merge(d, true)
	return p

static func profile_save(p: Dictionary) -> void:
	var f := FileAccess.open(PROFILE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(p))

## buys an outfit with the profile's Nex and wears it; returns a line for the shop. Already owned: just wears it.
static func buy_outfit(d: Dictionary, profile: Dictionary, id: String) -> String:
	var o := outfit(id)
	if o.is_empty():
		return "No such outfit"
	if id in d.outfits:
		d.outfit = id
		return "Wearing " + String(o.name)
	if o.price == null:
		return "%s isn't for sale: %s" % [o.name, o.source]
	var price := int(o.price)
	if int(profile.nex) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.nex)]
	profile.nex = int(profile.nex) - price
	d.outfits.append(id)
	d.outfit = id
	return "Bought %s · -%d Nex" % [o.name, price]

static func wear_outfit(d: Dictionary, id: String) -> bool:
	if id == "":
		d.outfit = ""
		return true
	if id not in d.outfits:
		return false
	d.outfit = id
	return true

static func buy_furniture(d: Dictionary, profile: Dictionary, id: String) -> String:
	var f := furniture(id)
	if f.is_empty():
		return "No such piece"
	if id in d.furniture:
		return "%s is already in the apartment" % f.name
	var price := int(f.price)
	if int(profile.nex) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.nex)]
	profile.nex = int(profile.nex) - price
	d.furniture.append(id)
	return "Bought %s · -%d Nex · delivered to Apartment 12-04" % [f.name, price]
