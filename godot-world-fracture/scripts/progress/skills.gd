extends RefCounted
## The skill tree (owner Nov 18, interfaceingame.com Watch Dogs: Legion "Skill Tree"): a point for every level past the
## first, spent down three branches; each perk needs the one above it. Pure rules over the profile (`profile.skills`, a
## list of bought ids); skills_view.gd draws it.
##
## A perk carries `key` and `factor`: `value(p, key)` multiplies the factors of every bought perk with that key (1.0
## when none), and the systems that own the number read it once when they start —
##   dmg            gunplay.set_loadout (each gun's multiplier)         head        gunplay (headshot damage)
##   kill_charge    super_ability (charge per kill)                      super_time  super_ability (charge over time)
##   shield         enemies.setup (the operator's shield)               shield_delay enemies (seconds before it recharges)
##   nex            Progression.grant (every payment)                    rep / escape street_life → street_career
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")

const BRANCHES := [
	{ "id": "combat", "name": "COMBAT", "color": Color(1.0, 0.42, 0.38) },
	{ "id": "tech", "name": "TECH", "color": Color(0.4, 0.85, 1.0) },
	{ "id": "street", "name": "STREET", "color": Color(1.0, 0.82, 0.35) },
]
const PERKS := [
	{ "id": "steady-hands", "branch": "combat", "tier": 1, "name": "Steady Hands", "desc": "+8% damage with every weapon.", "key": "dmg", "factor": 1.08 },
	{ "id": "marksman", "branch": "combat", "tier": 2, "name": "Marksman", "desc": "+20% headshot damage.", "key": "head", "factor": 1.2 },
	{ "id": "close-quarters", "branch": "combat", "tier": 3, "name": "Close Quarters", "desc": "Another +8% damage with every weapon.", "key": "dmg", "factor": 1.08 },
	{ "id": "executioner", "branch": "combat", "tier": 4, "name": "Executioner", "desc": "Kills charge your super 50% more.", "key": "kill_charge", "factor": 1.5 },
	{ "id": "capacitor", "branch": "tech", "tier": 1, "name": "Capacitor", "desc": "+20% energy shield.", "key": "shield", "factor": 1.2 },
	{ "id": "fast-recharge", "branch": "tech", "tier": 2, "name": "Fast Recharge", "desc": "Your shield starts recharging 35% sooner.", "key": "shield_delay", "factor": 0.65 },
	{ "id": "overclock", "branch": "tech", "tier": 3, "name": "Overclock", "desc": "Your super charges 30% faster on its own.", "key": "super_time", "factor": 1.3 },
	{ "id": "hardlight", "branch": "tech", "tier": 4, "name": "Hardlight Shell", "desc": "Another +20% energy shield.", "key": "shield", "factor": 1.2 },
	{ "id": "hustler", "branch": "street", "tier": 1, "name": "Hustler", "desc": "+10% Nex from every payment.", "key": "nex", "factor": 1.1 },
	{ "id": "known-face", "branch": "street", "tier": 2, "name": "Known Face", "desc": "+20% street reputation from races.", "key": "rep", "factor": 1.2 },
	{ "id": "ghost", "branch": "street", "tier": 3, "name": "Ghost", "desc": "Shaking the police pays double reputation.", "key": "escape", "factor": 2.0 },
	{ "id": "kingpin", "branch": "street", "tier": 4, "name": "Kingpin", "desc": "Another +15% Nex from every payment.", "key": "nex", "factor": 1.15 },
]

static func perk(id: String) -> Dictionary:
	for p in PERKS:
		if p.id == id:
			return p
	return {}

static func owned(p: Dictionary) -> Array:
	return p.get("skills", [])

## one point a level past the first, less what's spent
static func points(p: Dictionary) -> int:
	return maxi(0, Progression.level_for(int(p.get("xp", 0))) - 1 - owned(p).size())

## a perk can be bought with a point free and the one above it in its branch already owned
static func can_buy(p: Dictionary, id: String) -> bool:
	var k := perk(id)
	if k.is_empty() or owned(p).has(id) or points(p) <= 0:
		return false
	if int(k.tier) == 1:
		return true
	for q in PERKS:
		if q.branch == k.branch and int(q.tier) == int(k.tier) - 1:
			return owned(p).has(q.id)
	return false

static func buy(p: Dictionary, id: String) -> bool:
	if not can_buy(p, id):
		return false
	var o: Array = owned(p).duplicate()
	o.append(id)
	p.skills = o
	return true

## the product of the bought perks' factors for `key` (1.0 when none)
static func value(p: Dictionary, key: String) -> float:
	var v := 1.0
	for id in owned(p):
		var k := perk(String(id))
		if not k.is_empty() and k.key == key:
			v *= float(k.factor)
	return v

## the same, read from the saved profile (what the systems call when they start)
static func saved(key: String) -> float:
	return value(Gear.profile_load(), key)
