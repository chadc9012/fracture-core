extends RefCounted
## Story difficulty (owner Nov 18, interfaceingame.com Halo Infinite "Difficulty Select"): four levels, each with what it
## does to the hostiles' health and the damage they deal, and what it adds to the story's XP. Kept in settings
## (`difficulty`, settings_store.gd); the story views apply it to their enemies (enemies.gd hp_mult / dmg_mult) and to the
## XP a finished job pays. Killbox bots are PvP stand-ins and never take it.
const Store := preload("res://scripts/front/settings_store.gd")

const LEVELS := [
	{ "id": "easy", "name": "EASY", "hp": 0.75, "dmg": 0.6, "xp": 0.75, "line": "For the story. Hostiles fold fast and hit soft." },
	{ "id": "normal", "name": "NORMAL", "hp": 1.0, "dmg": 1.0, "xp": 1.0, "line": "The Fracture as it was meant to be fought." },
	{ "id": "heroic", "name": "HEROIC", "hp": 1.3, "dmg": 1.5, "xp": 1.25, "line": "Hostiles take more and hit harder. Cover matters." },
	{ "id": "legendary", "name": "LEGENDARY", "hp": 1.6, "dmg": 2.0, "xp": 1.6, "line": "Every fight can end you. Surviving it pays." },
]

static func level(id := "") -> Dictionary:
	var want := id if id != "" else String(Store.load_all().get("difficulty", "normal"))
	for l in LEVELS:
		if l.id == want:
			return l
	return LEVELS[1]

static func set_level(id: String) -> void:
	Store.set_value("difficulty", id)

## the hostiles of a story view take the level's health and damage
static func apply(enemies: Node) -> void:
	var l := level()
	enemies.hp_mult = float(l.hp)
	enemies.dmg_mult = float(l.dmg)
