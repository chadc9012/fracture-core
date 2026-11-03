extends SceneTree
## gear_store.gd shops: buying an outfit takes Nex and wears it, a second tap just wears, no Nex no sale; furniture is
## bought once; a clean round trip keeps both and drops a worn outfit you don't own.
const Gear = preload("res://scripts/gear/gear_store.gd")

func _init() -> void:
	var ok := true
	var d := Gear.fresh()
	var p := { "xp": 0, "nex": 1500, "level": 1 }
	var m1 := Gear.buy_outfit(d, p, "streetwear")
	var r1: bool = m1.begins_with("Bought") and int(p.nex) == 300 and d.outfit == "streetwear" and "streetwear" in d.outfits
	print("buy and wear an outfit: ", r1, " ", m1)
	ok = ok and r1
	var m2 := Gear.buy_outfit(d, p, "cyberpunk")
	var r2: bool = m2.begins_with("Needs") and int(p.nex) == 300 and d.outfit == "streetwear"
	print("no Nex, no sale: ", r2, " ", m2)
	ok = ok and r2
	Gear.wear_outfit(d, "")
	var m3 := Gear.buy_outfit(d, p, "streetwear")
	var r3: bool = m3.begins_with("Wearing") and int(p.nex) == 300 and d.outfit == "streetwear"
	print("owned outfits are free to wear again: ", r3)
	ok = ok and r3
	var r4: bool = Gear.buy_outfit(d, p, "anniversary-gold").contains("isn't for sale")
	print("event-only outfits are not sold: ", r4)
	ok = ok and r4
	p.nex = 1000
	var m5 := Gear.buy_furniture(d, p, "lamp-arc")
	var m6 := Gear.buy_furniture(d, p, "lamp-arc")
	var r5: bool = m5.begins_with("Bought") and int(p.nex) == 760 and "lamp-arc" in d.furniture and m6.contains("already")
	print("furniture once: ", r5)
	ok = ok and r5
	d.outfit = "formal"   # not owned: dropped by clean
	var c := Gear.clean(JSON.parse_string(JSON.stringify(d)))
	var r6: bool = c.outfits == ["streetwear"] and c.furniture == ["lamp-arc"] and c.outfit == ""
	print("clean keeps purchases, drops an unowned worn outfit: ", r6)
	ok = ok and r6
	print("Shop test: ", ok)
	quit(0 if ok else 1)
