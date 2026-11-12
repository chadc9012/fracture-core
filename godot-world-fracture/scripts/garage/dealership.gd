extends RefCounted
## Buying cars (owner, Nov 12: "Add the vehicles to car shopping list … high end vehicles have to be purchase"). The
## showroom's cars (catalog.gd SHOWROOM) are bought with the profile's Nex, like the airport's aircraft, and the list of
## what you own rides in the profile ("cars_owned") so it goes with the cloud save. The garage's original cars
## (catalog.gd VEHICLES) are yours from the start. Pure: the views load and save the profile.

const Catalog := preload("res://scripts/garage/catalog.gd")

static func owned(profile: Dictionary) -> Array[String]:
	var out: Array[String] = []
	for v in Catalog.VEHICLES:
		out.append(String(v.id))
	for id in profile.get("cars_owned", []):
		if not Catalog.vehicle(String(id)).is_empty() and not out.has(String(id)):
			out.append(String(id))
	return out

static func owns(profile: Dictionary, id: String) -> bool:
	return owned(profile).has(id)

static func price(id: String) -> int:
	return int(Catalog.vehicle(id).get("price", 0))

## buys `id` with the profile's Nex; returns the line for the showroom ("" never: always says what happened)
static func buy(profile: Dictionary, id: String) -> String:
	var v := Catalog.vehicle(id)
	if v.is_empty() or not v.has("price"):
		return "That car isn't for sale"
	if owns(profile, id):
		return "%s is already in your garage" % String(v.name)
	var p := int(v.price)
	var nex := int(profile.get("nex", 0))
	if nex < p:
		return "%s needs %s Nex — you have %s" % [String(v.name), money(p), money(nex)]
	profile.nex = nex - p
	var list: Array = profile.get("cars_owned", [])
	list.append(id)
	profile["cars_owned"] = list
	return "Bought the %s — it's in your garage" % String(v.name)

static func money(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out
