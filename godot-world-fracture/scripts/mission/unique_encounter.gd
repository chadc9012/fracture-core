extends "res://scripts/mission/campaign.gd"
## A hidden unique encounter's lead-in mission and its fight (owner, Nov 23): one mission of
## data/dialogue/unique_encounters.json (tools/campaign/unique/encounters.py) on the campaign runner — its sets, cast,
## voiced lines and kinds — opened from the ENCOUNTER JOURNAL once the encounter is discovered (encounters.gd). The last
## chapter before the fight plays the encounter's trigger; the fight takes the encounter's gimmick (boss.gd
## `set_gimmick`) and pays the encounter's own reward through `Encounters.clear` (first clear in full + its drop, then a
## third), marking it done for this operator. Set `UniqueEncounter.pending` to the mission id (U01…U18) before `new()`;
## `rematch` starts straight at the fight (an encounter already cleared).

const DATA_PATH := "res://data/dialogue/unique_encounters.json"
const Sovereign := preload("res://scripts/mission/sky_sovereign.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
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
	# Vyrak (sky_sovereign.gd): going down does not reset him — he leaves and brands the Ashen Mark
	if String(encounter.get("id", "")) == Sovereign.ID and enemies and not enemies.operator_down.is_connected(_sovereign_down):
		enemies.operator_down.connect(_sovereign_down)

func _on_boss_down(_bid: String, _reward: Dictionary) -> void:
	var eid := String(encounter.get("id", ""))
	if eid == Sovereign.ID:
		_sovereign_slain()
		return
	for l in Encounters.with_profile(func(p: Dictionary) -> Array: return Encounters.clear(p, eid)):
		controls.toast(String(l))
	_complete()

## the Sky Sovereign falls: once per profile — the stamp and title (sky_sovereign.gd), the pay (Encounters.clear), then the
## world-first check against every save (the web's /api/world-firsts once the stamp has synced; offline it just says SLAIN)
func _sovereign_slain() -> void:
	var sign := String(CharacterStore.load_look().get("name", ""))
	var now := int(Time.get_unix_time_from_system() * 1000.0)
	var first_time := { "yes": false }   # a lambda captures locals by value: the flag rides in a dictionary
	for l in Encounters.with_profile(func(p: Dictionary) -> Array:
		if not Sovereign.slay(p, sign, now):
			return []
		first_time.yes = true
		var lines := Encounters.clear(p, Sovereign.ID)
		lines.append("Title earned: " + Sovereign.TITLE)
		return lines):
		controls.toast(String(l))
	_complete()
	if first_time.yes:
		var mine := Sovereign.slain_at(Gear.profile_load())
		var first: Dictionary = await Sovereign.fetch_first(self)
		if is_inside_tree():
			controls.toast(Sovereign.banner(first, mine))
			Encounters.with_profile(func(p: Dictionary) -> Array: Sovereign.mark_seen(p); return [])

## the operator went down: he climbs back into the dark, brands the mark, and the encounter is over
var _sovereign_left := false
func _sovereign_down() -> void:
	if _sovereign_left:
		return
	_sovereign_left = true
	Encounters.with_profile(func(p: Dictionary) -> Array: Sovereign.brand(p); return [])
	for l in Sovereign.BRAND_LINES:
		controls.toast(String(l))
	if boss:
		boss.queue_free()
		boss = null
	_objective.text = "He is gone. The ash is not."
	get_tree().create_timer(5.0).timeout.connect(func():
		if is_inside_tree():
			_save()
			closed.emit())

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
