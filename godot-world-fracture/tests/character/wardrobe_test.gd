extends SceneTree
## wardrobe.gd and the clothing stores headless (owner, Nov 11: "make clothing stores so user can buy stuff"): every item
## sold somewhere and known to the rig; free starters owned; buying spends Nex and puts it on, short of Nex it does not;
## hats and eyewear toggle, jewellery adds up; the civ look carries the bought hat and eyewear; colourways inherit their
## base's pieces; every civ body carries the modelled garment pieces the outfits name; the dressing room builds and buys.
const Wardrobe = preload("res://scripts/character/wardrobe.gd")
const Outfits = preload("res://scripts/character/outfits.gd")
const Store = preload("res://scripts/character/character_store.gd")
const Rig = preload("res://scripts/character/character_rig.gd")
const Catalog = preload("res://scripts/character/catalog.gd")
const ClothingStore = preload("res://scripts/city/clothing_store.gd")

var ok := true

func check(label: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + label)
	ok = ok and cond

func _init() -> void:
	# ---- the catalogue ----
	var sold := true
	var known := true
	for it: Dictionary in Wardrobe.ITEMS:
		sold = sold and not it.stores.is_empty() and (it.stores as Array).all(func(s: String) -> bool: return Wardrobe.STORES.has(s))
		match String(it.kind):
			"outfit":
				known = known and not Outfits.find(String(it.id)).is_empty()
			"wear":
				known = known and String(it.id) in Rig.wear_ids()
	check("every item is sold in a real store", sold)
	check("every outfit and wearable is one the rig knows", known)
	var listed := true
	for id: String in Outfits.ids():
		listed = listed and not Wardrobe.item(id).is_empty()
	check("every outfit is on sale (or free)", listed)
	for s: String in Wardrobe.STORES:
		check("%s stocks outfits" % s, not Wardrobe.stock(s, "outfit").is_empty())
	var cw := Outfits.find("crimson-tracksuit")
	check("a colourway keeps its base's pieces and takes its own colours", cw.pieces == Outfits.find("tracksuit").pieces and String(cw.c.top) == "a3201f" and String(cw.name) == "Crimson Tracksuit")
	check("the base outfit is untouched by its colourway", String(Outfits.find("tracksuit").c.top) == "1f3fa3")
	# ---- owning, buying, wearing ----
	var look := Store.clean(Store.default_look())
	look.outfit = "street-hoodie"
	check("starters are owned from the start", Wardrobe.owns(look, "street-hoodie") and Wardrobe.owns(look, "tee-shorts"))
	check("paid items are not", not Wardrobe.owns(look, "varsity") and not Wardrobe.owns(look, "chain"))
	var prof := { "nex": 500 }
	var line := Wardrobe.buy(look, prof, "varsity")
	check("short of Nex: no sale, Nex kept (%s)" % line, prof.nex == 500 and not Wardrobe.owns(look, "varsity") and look.outfit == "street-hoodie")
	prof.nex = 2000
	Wardrobe.buy(look, prof, "varsity")
	check("buying spends the price and puts it on", prof.nex == 900 and Wardrobe.owns(look, "varsity") and look.outfit == "varsity")
	prof.nex = 5000
	Wardrobe.buy(look, prof, "cap")
	Wardrobe.buy(look, prof, "shades")
	Wardrobe.buy(look, prof, "earrings")
	check("hat, eyewear and earrings bought and on", look.hat == "cap" and look.eyes == "shades" and "earrings" in look.wear and prof.nex == 5000 - 200 - 500 - 450)
	Wardrobe.put_on(look, "cap")
	check("a hat already on comes off", look.hat == "none" and Wardrobe.owns(look, "cap"))
	Wardrobe.put_on(look, "cap")
	var civ := Wardrobe.civ(look)
	check("the civ look wears the bought hat and eyewear", civ.civ == true and civ.headgear == "cap" and civ.accessory == "shades")
	var saved := Store.clean(look)
	check("clean keeps what was bought and worn", "varsity" in saved.owned and saved.hat == "cap" and saved.eyes == "shades" and saved.outfit == "varsity")
	var junk := look.duplicate(true)
	junk.owned = ["varsity", "nope", "varsity"]
	junk.hat = "crown"
	junk.eyes = "monocle"
	junk = Store.clean(junk)
	check("clean drops unknown items", junk.owned == ["varsity"] and junk.hat == "none" and junk.eyes == "none")
	# ---- the modelled pieces on every civ body ----
	var wanted := {}
	for id: String in Outfits.ids():
		for pc: String in Outfits.pieces_of(id):
			wanted[pc] = true
	for f: String in ["nyx", "cipher", "goliath"]:
		for b: String in ["male", "female"]:
			var inst: Node = (load(Catalog.body_path(f, b, true)) as PackedScene).instantiate()
			var names := inst.find_children("Piece_*", "MeshInstance3D", true, false).map(func(n: Node) -> String: return String(n.name).substr(6))
			var all := true
			for pc: String in wanted:
				all = all and pc in names
			check("civ-%s-%s carries every garment piece (%d)" % [f, b, names.size()], all)
			inst.free()
	# a dressed rig shows exactly its outfit's pieces
	var r: Node3D = Rig.new()
	root.add_child(r)
	var l2 := Store.clean(Store.default_look())
	l2.outfit = "tee-shorts"
	r.build(Wardrobe.civ(l2), false)
	var shown := r.find_children("Piece_*", "MeshInstance3D", true, false).filter(func(n: Node) -> bool: return (n as MeshInstance3D).visible).map(func(n: Node) -> String: return String(n.name).substr(6))
	shown.sort()
	check("a tee shows its sleeve and shorts hems only (%s)" % [shown], shown == ["shorts_hems", "sleeve_hems"])
	r.free()
	# ---- the dressing room (in the running tree, next frame) ----
	Store.save_look(Store.clean(Store.default_look()))    # a fresh operator who owns only the starters
	cs = ClothingStore.new()
	cs.store = "lumen"
	cs.profile = { "nex": 5000 }
	root.add_child(cs)

var cs: Control
var _frames := 0

func _process(_d: float) -> bool:
	_frames += 1
	if _frames < 3:
		return false
	check("the dressing room opens on outfits with the store's stock", cs._grid.get_child_count() == Wardrobe.stock("lumen", "outfit").size())
	cs._sel = "bomber"
	cs._update_action()
	check("an unowned item offers BUY", cs._act.text.begins_with("BUY"))
	var bought := [false]
	cs.changed.connect(func(): bought[0] = true)
	cs._act_pressed()
	check("BUY spends Nex, saves, and says so", bought[0] and int(cs.profile.nex) == 4100 and Store.load_look().outfit == "bomber")
	cs.queue_free()
	print("wardrobe: %s" % ("all ok" if ok else "FAILED"))
	quit(0 if ok else 1)
	return true
