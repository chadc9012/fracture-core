extends SceneTree
## gear_store.gd headless: the starter loadout, equip / unequip, power, the gun list, drops and transmog.
const Gear = preload("res://scripts/gear/gear_store.gd")

func _init() -> void:
	var ok := true
	var d := Gear.fresh()
	var r1: bool = d.items.size() == 5 and Gear.worn(d, "primary").name == "Vanguard MK-IV" and Gear.worn(d, "helmet").slot == "helmet"
	print("starter loadout worn: ", r1)
	ok = ok and r1
	var lo := Gear.loadout(d)
	var r2: bool = lo.size() == 2 and lo[0].frame == "AUTO" and absf(float(lo[0].mult) - 1.07) < 1e-3 and lo[0].name == "Vanguard MK-IV"
	print("gun list from the worn weapons: ", r2, " ", lo)
	ok = ok and r2
	var p0 := Gear.operator_power(d, 1)
	var r3: bool = absf(p0 - 92.0) < 1e-3 and absf(Gear.operator_power(d, 5) - 100.0) < 1e-3
	print("operator power: ", r3, " ", p0)
	ok = ok and r3
	# a sniper drop, worn, changes the primary's frame; unequipping empties the slot
	var it := Gear.roll_drop(d, "boss", 0.0, 150.0, 3)
	var tries := 0
	while (it.is_empty() or it.slot != "primary" or it.frame != "SNIPER") and tries < 200:
		it = Gear.roll_drop(d, "boss", 0.0, 150.0, 100 + tries)
		tries += 1
	var r4: bool = not it.is_empty() and it.frame == "SNIPER" and Gear.equip(d, it.id) and Gear.loadout(d)[0].frame == "SNIPER" and int(it.power) >= 120
	print("a sniper drop worn fires as a sniper: ", r4, " ", it.get("name", "?"), " after ", tries, " rolls")
	ok = ok and r4
	Gear.unequip(d, "primary")
	var r5: bool = Gear.worn(d, "primary").is_empty() and Gear.loadout(d)[0].slot == "secondary"
	print("unequip: ", r5)
	ok = ok and r5
	# no drop above the chance, armour pieces carry their set, transmog sticks to real sets only
	var none := Gear.roll_drop(d, "enemy", 0.5, 150.0, 1)
	var armour := {}
	for i in 60:
		var x := Gear.roll_drop(d, "elite", 0.0, 150.0, 500 + i)
		if x.get("set", "") != "":
			armour = x
			break
	var r6: bool = none.is_empty() and not armour.is_empty() and not Gear.armor_set(armour.set).is_empty() and armour.slot in Gear.ARMOR_SLOTS
	print("drop chance and armour pieces: ", r6, " ", armour.get("name", "?"))
	ok = ok and r6
	Gear.set_transmog(d, "chest", "verdant-warden")
	Gear.set_transmog(d, "legs", "no-such-set")
	var r7: bool = d.transmog.get("chest", "") == "verdant-warden" and not d.transmog.has("legs")
	var cleaned := Gear.clean(JSON.parse_string(JSON.stringify(d)))
	r7 = r7 and cleaned.transmog.get("chest", "") == "verdant-warden" and cleaned.items.size() == d.items.size()
	print("transmog and a clean round trip: ", r7)
	ok = ok and r7
	print("Gear store test: ", ok)
	quit(0 if ok else 1)
