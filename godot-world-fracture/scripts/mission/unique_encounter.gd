extends "res://scripts/mission/campaign.gd"
## A hidden unique encounter's lead-in mission and its fight (owner, Nov 23): one mission of
## data/dialogue/unique_encounters.json (tools/campaign/unique/encounters.py) on the campaign runner — its sets, cast,
## voiced lines and kinds — opened from the ENCOUNTER JOURNAL once the encounter is discovered (encounters.gd). The last
## chapter before the fight plays the encounter's trigger; the fight takes the encounter's gimmick (boss.gd
## `set_gimmick`) and pays the encounter's own reward through `Encounters.clear` (first clear in full + its drop, then a
## third), marking it done for this operator. Set `UniqueEncounter.pending` to the mission id (U01…U18) before `new()`;
## `rematch` starts straight at the fight (an encounter already cleared).

const DATA_PATH := "res://data/dialogue/unique_encounters.json"
static var pending := ""
static var rematch := false
var mission_id := ""
var encounter: Dictionary = {}
var _rematch := false

func _init() -> void:
	mission_id = pending
	_rematch = rematch
	rematch = false
	encounter = Encounters.by_mission(mission_id)
	if _rematch:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(_save_path()))
	super()
	if _rematch:
		# straight to the fight (descent._load keeps a current that is one of the chapters)
		for c in chapters:
			if String(c.kind) == "boss":
				progress.current = String(c.id)
				break

## only this mission's chapters
func _story() -> Dictionary:
	var all: Dictionary = data_of(DATA_PATH)
	var one := { "bosses": all.get("bosses", {}), "missions": [], "lines": [] }
	for m in all.get("missions", []):
		if String(m.id) == mission_id:
			one.missions = [m]
	return one

func _save_path() -> String:
	return "user://unique_%s.json" % mission_id

func coop_chain() -> String:
	return "unique"

func _done_key() -> String:
	return "unique_missions_done"

func _choice_key(mission: String) -> String:
	return "u%s_choice" % mission

## the fight takes the encounter's gimmick; the attuned boss turns between the kinds of damage this operator carries
func _summon_boss(id: String) -> void:
	var had := boss
	super(id)
	if boss == null or boss == had:
		return
	var kinds: Array = []
	for g in gunplay.guns:
		var el := String(g.element)
		if not kinds.has(el):
			kinds.append(el)
	if kinds.is_empty():
		kinds.append("KINETIC")
	kinds.append("MELEE")
	boss.rules.set_gimmick(String(encounter.get("gimmick", "")), kinds)
	if String(encounter.get("taunt", "")) != "":
		controls.toast(String(encounter.taunt))
	controls.toast(String(encounter.get("briefing", "")))

func _on_boss_down(_bid: String, _reward: Dictionary) -> void:
	var eid := String(encounter.get("id", ""))
	for l in Encounters.with_profile(func(p: Dictionary) -> Array: return Encounters.clear(p, eid)):
		controls.toast(String(l))
	_complete()

func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	_objective.text = "Encounter complete."
	if _done_panel:
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -60)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "%s\n%s" % [String(encounter.get("name", "")).to_upper(), "Encounter complete · %s" % String(encounter.get("drop_name", ""))]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "BACK"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): _save(); closed.emit())
	v.add_child(b)
	add_child(_done_panel)
