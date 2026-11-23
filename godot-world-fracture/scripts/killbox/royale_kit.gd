extends RefCounted
## The drop kit (owner, Nov 22: "make it so you have to buy them"): what you jump with in Fracture Royale. Everyone has
## the standard-issue round canopy — it opens itself low, drifts and barely turns — because without any canopy there is
## no landing. The sport canopy (ram-air: flies forward, steers, flares, opens when you say, cuts away) and the wingsuit
## are bought with Nex, once, and kept. Saved in user://royale_kit.json.

const PATH := "user://royale_kit.json"
const ITEMS := {
	"canopy-standard": { "name": "Standard Canopy", "price": 0, "blurb": "Round, standard issue. Opens itself at 55 m, drifts down, barely turns." },
	"canopy-sport": { "name": "Sport Canopy", "price": 1500, "blurb": "Ram-air wing. Flies forward, steers and flares, opens when you press JUMP, cuts away." },
	"wingsuit": { "name": "Wingsuit", "price": 4000, "blurb": "Hold RUN in the fall to fly where you look: fast, flat, far from the dropship's line." },
}
const ORDER := ["canopy-standard", "canopy-sport", "wingsuit"]

static func load_kit() -> Dictionary:
	var d := { "owned": ["canopy-standard"] }
	if FileAccess.file_exists(PATH):
		var f := FileAccess.open(PATH, FileAccess.READ)
		var j: Variant = JSON.parse_string(f.get_as_text()) if f else null
		if j is Dictionary:
			for id in (j as Dictionary).get("owned", []):
				if id is String and ITEMS.has(id) and id not in d.owned:
					d.owned.append(id)
	return d

static func save_kit(d: Dictionary) -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

static func owns(d: Dictionary, id: String) -> bool:
	return id in d.get("owned", [])

## buys `id` with the profile's Nex; returns the line to show. The caller saves the kit and the profile.
static func buy(d: Dictionary, profile: Dictionary, id: String) -> String:
	if not ITEMS.has(id):
		return "No such kit"
	var it: Dictionary = ITEMS[id]
	if owns(d, id):
		return "%s is already yours" % String(it.name)
	var price := int(it.price)
	if int(profile.get("nex", 0)) < price:
		return "Needs %d Nex (you have %d)" % [price, int(profile.get("nex", 0))]
	profile.nex = int(profile.get("nex", 0)) - price
	d.owned.append(id)
	return "Bought %s · -%d Nex" % [String(it.name), price]
