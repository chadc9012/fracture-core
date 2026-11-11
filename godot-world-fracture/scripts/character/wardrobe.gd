extends RefCounted
## What the operator owns and wears out of uniform (owner, Nov 11: "make clothing stores so user can buy stuff"). Three
## clothing stores sell it for Nex: Nova Threads (everyday streetwear) and Lumen Luxe (premium) in the Galleria, and Block
## Supply on the Nexus avenue; the dressing room (scripts/city/clothing_store.gd) tries things on before you buy.
## Everything lives on the look (character_store.gd): `owned` (item ids bought), `outfit`, `hat`, `eyes` and `wear`.

const Outfits := preload("res://scripts/character/outfits.gd")

const STORES := {
	"nova": { "name": "NOVA THREADS", "color": Color(0.95, 0.4, 0.75), "line": "Everyday streetwear. Hoodies, tracksuits, tees, caps." },
	"lumen": { "name": "LUMEN LUXE", "color": Color(1.0, 0.85, 0.4), "line": "Premium jackets, gold and glass." },
	"block": { "name": "BLOCK SUPPLY", "color": Color(0.35, 1.0, 0.75), "line": "The avenue's own: streetwear, headwear and chains." },
}

const KINDS := ["outfit", "hat", "eyes", "wear"]
const KIND_NAME := { "outfit": "OUTFITS", "hat": "HEADWEAR", "eyes": "EYEWEAR", "wear": "JEWELLERY & BAGS" }

## every item: what it is, what it costs, where it is sold. Price 0: everyone owns it from the start.
const ITEMS := [
	{ "id": "street-hoodie", "kind": "outfit", "price": 0, "stores": ["nova", "block"] },
	{ "id": "sand-hoodie", "kind": "outfit", "price": 0, "stores": ["nova", "block"] },
	{ "id": "tee-shorts", "kind": "outfit", "price": 0, "stores": ["nova", "block"] },
	{ "id": "heather-hoodie", "kind": "outfit", "price": 350, "stores": ["nova", "block"] },
	{ "id": "sunset-tee", "kind": "outfit", "price": 300, "stores": ["nova"] },
	{ "id": "pastel-set", "kind": "outfit", "price": 450, "stores": ["nova"] },
	{ "id": "tracksuit", "kind": "outfit", "price": 600, "stores": ["nova", "block"] },
	{ "id": "crimson-tracksuit", "kind": "outfit", "price": 600, "stores": ["nova", "block"] },
	{ "id": "workwear", "kind": "outfit", "price": 750, "stores": ["lumen", "block"] },
	{ "id": "denim", "kind": "outfit", "price": 800, "stores": ["lumen"] },
	{ "id": "black-denim", "kind": "outfit", "price": 850, "stores": ["lumen"] },
	{ "id": "bomber", "kind": "outfit", "price": 900, "stores": ["lumen", "block"] },
	{ "id": "varsity", "kind": "outfit", "price": 1100, "stores": ["lumen"] },
	{ "id": "midnight-varsity", "kind": "outfit", "price": 1200, "stores": ["lumen"] },
	{ "id": "olive-utility", "kind": "outfit", "price": 1300, "stores": ["lumen", "block"] },
	{ "id": "techwear", "kind": "outfit", "price": 1400, "stores": ["lumen"] },
	{ "id": "headband", "kind": "hat", "name": "Sweatband", "price": 90, "stores": ["nova"] },
	{ "id": "bandana", "kind": "hat", "name": "Bandana", "price": 120, "stores": ["nova", "block"] },
	{ "id": "beanie", "kind": "hat", "name": "Charcoal Beanie", "price": 150, "stores": ["nova", "block"] },
	{ "id": "beanie-red", "kind": "hat", "name": "Red Beanie", "price": 150, "stores": ["nova", "block"] },
	{ "id": "cap", "kind": "hat", "name": "Olive Cap", "price": 200, "stores": ["nova", "block"] },
	{ "id": "glasses", "kind": "eyes", "name": "Clear Frames", "price": 350, "stores": ["lumen"] },
	{ "id": "shades", "kind": "eyes", "name": "Shades", "price": 500, "stores": ["lumen", "block"] },
	{ "id": "backpack", "kind": "wear", "name": "Backpack", "price": 400, "stores": ["nova", "block"] },
	{ "id": "rings", "kind": "wear", "name": "Two Rings", "price": 400, "stores": ["lumen"] },
	{ "id": "earrings", "kind": "wear", "name": "Hoop Earrings", "price": 450, "stores": ["lumen", "block"] },
	{ "id": "watch", "kind": "wear", "name": "Steel Watch", "price": 900, "stores": ["lumen"] },
	{ "id": "chain", "kind": "wear", "name": "Gold Chain", "price": 1200, "stores": ["lumen", "block"] },
]

static func item(id: String) -> Dictionary:
	for it: Dictionary in ITEMS:
		if it.id == id:
			return it
	return {}

static func item_name(it: Dictionary) -> String:
	if it.kind == "outfit":
		return String(Outfits.find(String(it.id)).get("name", it.id))
	return String(it.get("name", it.id))

static func stock(store: String, kind: String) -> Array:
	return ITEMS.filter(func(it: Dictionary) -> bool: return it.kind == kind and store in it.stores)

static func ids(kind: String) -> Array:
	return ITEMS.filter(func(it: Dictionary) -> bool: return it.kind == kind).map(func(it: Dictionary) -> String: return it.id)

## owned: bought, free, or what the look already wears (a look from before the stores keeps its outfit)
static func owns(look: Dictionary, id: String) -> bool:
	var it := item(id)
	if it.is_empty():
		return false
	if int(it.price) == 0 or id in look.get("owned", []):
		return true
	match String(it.kind):
		"outfit":
			return String(look.get("outfit", "")) == id
		"hat":
			return String(look.get("hat", "none")) == id
		"eyes":
			return String(look.get("eyes", "none")) == id
		_:
			return id in look.get("wear", [])

static func wearing(look: Dictionary, id: String) -> bool:
	var it := item(id)
	match String(it.get("kind", "")):
		"outfit":
			return String(look.get("outfit", "")) == id
		"hat":
			return String(look.get("hat", "none")) == id
		"eyes":
			return String(look.get("eyes", "none")) == id
		"wear":
			return id in look.get("wear", [])
	return false

## puts an item on (an outfit, a hat, eyewear) or toggles it (a hat or glasses already on come off; jewellery and bags add up)
static func put_on(look: Dictionary, id: String, toggle := true) -> void:
	var it := item(id)
	match String(it.get("kind", "")):
		"outfit":
			look.outfit = id
		"hat":
			look.hat = "none" if (toggle and look.get("hat", "none") == id) else id
		"eyes":
			look.eyes = "none" if (toggle and look.get("eyes", "none") == id) else id
		"wear":
			var w: Array = look.get("wear", []).duplicate()
			if id in w:
				if toggle:
					w.erase(id)
			else:
				w.append(id)
			look.wear = w

## buys an item with the profile's Nex and puts it on; a line for the store's ticker
static func buy(look: Dictionary, profile: Dictionary, id: String) -> String:
	var it := item(id)
	if it.is_empty():
		return ""
	if owns(look, id):
		put_on(look, id, false)
		return "%s — on." % item_name(it)
	var nex := int(profile.get("nex", 0))
	if nex < int(it.price):
		return "Not enough Nex — %s is %d, you have %d." % [item_name(it), int(it.price), nex]
	profile.nex = nex - int(it.price)
	var owned: Array = look.get("owned", []).duplicate()
	owned.append(id)
	look.owned = owned
	put_on(look, id, false)
	return "Bought %s for %d Nex — wearing it." % [item_name(it), int(it.price)]

## the look as worn out of uniform: the civ body in the outfit, the bought hat and eyewear (nothing from the old armour gear)
static func civ(look: Dictionary) -> Dictionary:
	var l := look.duplicate(true)
	l.civ = true
	l.headgear = String(look.get("hat", "none"))
	l.accessory = String(look.get("eyes", "none"))
	return l

## keeps only known items on a look (character_store.clean)
static func clean(look: Dictionary) -> void:
	var owned: Array = []
	for id: Variant in look.get("owned", []):
		if not item(String(id)).is_empty() and String(id) not in owned:
			owned.append(String(id))
	look.owned = owned
	if String(look.get("hat", "none")) not in ids("hat"):
		look.hat = "none"
	if String(look.get("eyes", "none")) not in ids("eyes"):
		look.eyes = "none"
