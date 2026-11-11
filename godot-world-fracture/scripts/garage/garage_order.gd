extends RefCounted
## An order at one shop for one car: the parts, paint and repair the player has picked but not paid for. It quotes the total,
## says why a line can't be sold, and checks out all or nothing: every line is validated and the whole price is checked
## before anything is charged or fitted, so a failure never leaves a car half-modified or the money half-spent.

const Catalog := preload("res://scripts/garage/catalog.gd")

var shop_id := ""
var vehicle_id := ""
## slot -> item id (one per slot: picking another part for a slot replaces it)
var lines := {}
var repair := false

func _init(shop := "", vehicle := "") -> void:
	shop_id = shop
	vehicle_id = vehicle

func mult() -> float:
	return float(Catalog.shop(shop_id).get("mult", 1.0))

func price_of(item_id: String) -> int:
	return int(round(float(Catalog.item(item_id).get("price", 0)) * mult()))

func repair_price(state) -> int:
	return int(round(float(state.car(vehicle_id).get("damage", 0)) * Catalog.REPAIR_PER_POINT * mult()))

func total(state) -> int:
	var t := 0
	for slot in lines:
		t += price_of(lines[slot])
	if repair:
		t += repair_price(state)
	return t

## why this item can't go in this order ("" when it can)
func block_reason(state, item_id: String) -> String:
	var it := Catalog.item(item_id)
	if it.is_empty():
		return "Unknown part"
	var sh := Catalog.shop(shop_id)
	if not (it.slot in sh.get("slots", [])):
		return "%s doesn't fit %s" % [sh.get("name", "This shop"), Catalog.SLOTS[it.slot][1].to_lower()]
	var v := Catalog.vehicle(vehicle_id)
	if not Catalog.fits(it, v.get("cls", "")):
		return "Doesn't fit this %s" % _cls_label(v.get("cls", ""))
	var need := int(it.get("rep", 0))
	if int(state.rep.get(shop_id, 0)) < need:
		return "Needs reputation %d here" % need
	var street := String(it.get("street", ""))
	if street != "":
		var Career = load("res://scripts/racing/street_career.gd")
		if Career.tier_index(int(state.get("street_rep") if state.get("street_rep") != null else 0)) < Career.tier_named(street):
			return "Street rep: needs %s" % street
	if state.installed(vehicle_id).get(it.slot, "") == item_id:
		return "Already fitted"
	return ""

## add (or swap in) an item; false with no change if it can't be sold
func add(state, item_id: String) -> bool:
	if block_reason(state, item_id) != "":
		return false
	lines[Catalog.item(item_id).slot] = item_id
	return true

## a body-kit preset: every piece of it this car and shop can take (the rest is skipped); how many went in
func add_preset(state, preset_id: String) -> int:
	var n := 0
	for p in Catalog.PRESETS:
		if p.id == preset_id:
			for id in p.items:
				if add(state, id):
					n += 1
	return n

func remove_slot(slot: String) -> void:
	lines.erase(slot)

func set_repair(state, on: bool) -> bool:
	if on and (not Catalog.shop(shop_id).get("repairs", false) or int(state.car(vehicle_id).get("damage", 0)) <= 0):
		return false
	repair = on
	return true

func is_empty() -> bool:
	return lines.is_empty() and not repair

## the car as it would be with this order fitted: what the preview draws and the stat bars compare against
func preview_parts(state) -> Dictionary:
	var out: Dictionary = state.installed(vehicle_id)
	for slot in lines:
		out[slot] = lines[slot]
	return out

## pay and fit everything, or nothing. Returns "" on success, else why it failed (the state is untouched).
func checkout(state) -> String:
	if is_empty():
		return "Nothing in the order"
	if not state.cars.has(vehicle_id):
		return "No car in the bay"
	var sh := Catalog.shop(shop_id)
	if int(state.rep.get(shop_id, 0)) < int(sh.get("rep", 0)):
		return "%s won't deal with you yet" % sh.get("name", "This shop")
	for slot in lines:
		var why := block_reason(state, lines[slot])
		if why != "":
			return why
	var cost := total(state)
	if cost > int(state.credits):
		return "Need %s more credits" % _money(cost - int(state.credits))
	# everything checked: now apply
	var c: Dictionary = state.cars[vehicle_id]
	for slot in lines:
		if slot == "paint":
			c.paint = lines[slot]
		elif slot == "finish":
			c.finish = lines[slot]
		else:
			c.parts[slot] = lines[slot]
	if repair:
		c.damage = 0
	state.credits = int(state.credits) - cost
	# a big job (15k or more) earns a point of standing at the shop, up to 3
	state.rep[shop_id] = mini(3, int(state.rep.get(shop_id, 0)) + (1 if cost >= 15000 else 0))
	lines.clear()
	repair = false
	return ""

static func _money(n: int) -> String:
	var s := str(n)
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return s + out

static func _cls_label(cls: String) -> String:
	return { "street": "street car", "super": "supercar", "muscle": "muscle car", "offroad": "off-roader", "armored": "armoured vehicle", "bike": "bike" }.get(cls, "vehicle")
