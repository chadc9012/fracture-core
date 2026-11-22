extends "res://scripts/mission/descent.gd"
## The campaign after Mission 01 (owner, Nov 13: "the rest of missions"): missions 02–25 as the chapters of
## data/dialogue/campaign_full.json (tools/campaign/build.py), played on the descent's machinery — the region in PLAY
## mode, the operator, guns, troopers, the terminal, the waves, the boss — with every chapter's opening lines as a
## cutscene (the owner's draft lines verbatim, voiced), its objective in the descent's kinds (reach / kills / survive /
## trace / hack / core) or the campaign's own (talk: the named person stands at the POI; choice: scripts/cinema/choice.gd,
## the key kept in user://profile.json; boss: scripts/combat/boss_view.gd; race / drive: reach the POI; cutscene: lines
## only), and its closing lines before the next. Finished missions go to the profile's `campaign_done` (the people's
## news, scripts/npc/talk.gd `stage`). Progress: user://campaign.json. Open from main.gd's door "campaign".

const Choice := preload("res://scripts/cinema/choice.gd")
const NpcStreet := preload("res://scripts/npc/npc_street.gd")
const People := preload("res://scripts/npc/people.gd")
const Lines := preload("res://scripts/cinema/lines.gd")
const Stage := preload("res://scripts/mission/stage.gd")
const DATA := "res://data/dialogue/campaign_full.json"
const CAMPAIGN_SAVE := "user://campaign.json"
const PROFILE := "user://profile.json"
## the campaign's own kinds mapped onto the descent's loop
const AS_REACH := ["talk", "race", "drive"]
## the bosses the campaign's beats name, on the bosses the build has (scripts/combat/boss.gd BOSSES)
const BOSS_FOR := { "vyrak": "vyrak", "crownkeeper": "colossus", "fracture-heart": "astravore", "convergence": "abyssal-leviathan",
	# Chapter 1 — The Aftershock's (aftershock.gd), each under its own name (`boss_name`) until it has a hull of its own
	"fracture-commander": "rift-hound", "subject-zero": "crystal-stalker", "fracture-executioner": "astravore",
	"siege-beast": "colossus", "harbinger": "astravore", "archive-warden": "colossus" }

static var _data: Dictionary = {}
## story lines that run on this runner with data of their own (aftershock.gd): path -> parsed data
static var _datas: Dictionary = {}
var chapters: Array = []          # every chapter of every mission, in order, with "mission" and "mission_title"
var choice_view: Control
var _closing := ""                # the chapter whose closing lines are playing
var _talker: Node3D               # the named person of a talk chapter
var stage: Node3D                 # the chapter's set and cast (stage.gd), when the chapter names a `stage`
var _in_begin := false            # the descent's _begin plays the opening early: the campaign plays it once the boss is up

static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(DATA, FileAccess.READ)
		if f:
			var d: Variant = JSON.parse_string(f.get_as_text())
			if d is Dictionary:
				_data = d
	return _data

## the story this runner plays (a story line of its own overrides it: aftershock.gd)
func _story() -> Dictionary:
	return data()

static func data_of(path: String) -> Dictionary:
	if not _datas.has(path):
		var f := FileAccess.open(path, FileAccess.READ)
		var d: Variant = JSON.parse_string(f.get_as_text()) if f else null
		_datas[path] = d if d is Dictionary else {}
	return _datas[path]

func _init() -> void:
	for m in _story().get("missions", []):
		for c in m.chapters:
			var q: Dictionary = c.duplicate()
			q["mission"] = String(m.id)
			q["mission_title"] = String(m.title)
			q["world"] = String(c.get("world", m.world))
			q["start"] = String(c.get("start", _start_of(m, c)))
			q["title"] = "%s · %s" % [String(m.title), String(c.title)]
			q["xp"] = 150 + 10 * int(m.id)
			q["nex"] = 120 + 10 * int(m.id)
			if not q.has("amount"):
				q["amount"] = 1
			if not q.has("label"):
				q["label"] = String(c.title)
			chapters.append(q)
	progress.current = _first_id()

## a chapter without its own start POI stands where the mission's last chapter stood (or its first)
static func _start_of(m: Dictionary, c: Dictionary) -> String:
	var last := ""
	for cc in m.chapters:
		if cc.has("start"):
			last = String(cc.start)
		if cc == c:
			break
	return last if last != "" else String(m.chapters[0].get("start", ""))

func _ready() -> void:
	super()
	_objective.position = Vector2(16, 128)   # under the weapon and ammo lines, not over them

func _quests() -> Array:
	return chapters

func _save_path() -> String:
	return CAMPAIGN_SAVE

func _first_id() -> String:
	return String(chapters[0].id) if not chapters.is_empty() else ACT_END

# --------------------------------------------------------------------------------------------- the chapters
func _begin(id: String) -> void:
	var def := _quest_def(id)
	if def.is_empty():
		super(id)
		return
	var kind := String(def.kind)
	_talker = null
	_in_begin = true
	if kind in AS_REACH:
		# the campaign's own walking kinds (talk, race, drive) ride the descent's reach loop; choice, cutscene and boss
		# are kinds the descent's loop leaves alone and play out here
		var q: Dictionary = def.duplicate()
		q.kind = "reach"
		var i := chapters.find(def)
		chapters[i] = q
		super(id)
		chapters[i] = def
		quest = q
		quest.kind_real = kind
	else:
		super(id)
	_in_begin = false
	# the chapter's own place: its POI on the ground, or 80 m out along the chapter's line — not the descent's far edge
	if def.has("to") and kind != "kills":
		_set_waypoint(_poi(String(def.to)), true)
	elif kind in AS_REACH or kind == "reach":
		# 80 m on from where the operator stands (not from the world's start: a mission's chapters follow each other)
		_set_waypoint(_on_ground(operator.position + _dir * 80.0), true)
	# the boss and the talker are up before the opening plays, so the set can frame them
	if kind == "boss":
		_summon_boss(String(def.get("boss", "vyrak")))
	elif kind == "talk":
		_place_talker(String(def.get("who", "")), waypoint)
	_opening(id)
	match kind:
		"choice":
			if not cutscene.playing:
				_ask_choice(def)
			else:
				cutscene.finished.connect(func(): _ask_choice(def), CONNECT_ONE_SHOT)
		"cutscene":
			if not cutscene.playing:
				_complete()
			else:
				cutscene.finished.connect(_complete, CONNECT_ONE_SHOT)
	_refresh()

## a POI's spot on the ground; the operator's own spot when the map has no such POI
func _poi(id: String) -> Vector3:
	for poi in Data.map(world_id).get("pois", []):
		if poi.id == id:
			return _on_ground(Vector3(float(poi.x), 0.0, float(poi.z)))
	return _on_ground(_spawn_origin + _dir * 60.0)

## every chapter opens on its lines, the camera orbiting the operator (the owner's draft, voiced)
func _opening(id: String) -> void:
	if _in_begin or _seen.has(id) or cutscene == null:
		return
	_seen[id] = true
	var def := _quest_def(id)
	var beats := _scene(def, def.get("open", []), 20.0)
	if not beats.is_empty():
		cutscene.play(beats, region.camera())

## the beats of a scene: on the chapter's set (`stage`), each line framed on whoever says it, or orbiting the operator
## when the chapter names no set
func _scene(def: Dictionary, ids: Array, deg0: float) -> Array:
	if not def.has("stage") or ids.is_empty() or region == null:
		return _beats(ids, operator.position, deg0)
	if stage == null or not is_instance_valid(stage) or stage.region != region:
		stage = Stage.new()
		region.world().add_child(stage)
		stage.setup(region, operator, operator.obstacles)
	stage.boss = boss
	var speakers: Array = []
	for lid in ids:
		var sp := Lines.speaker(String(lid))
		if sp != "" and not speakers.has(sp):
			speakers.append(sp)
	var toward := _dir
	if waypoint_node != null and waypoint_node.visible and waypoint.distance_to(operator.position) > 3.0:
		toward = waypoint - operator.position
	stage.play(String(def.stage), operator.position, toward, speakers, _talker)
	var acts: Dictionary = def.get("acts", {})
	var out: Array = []
	var i := 0
	for lid in ids:
		if not Lines.has(String(lid)):
			continue
		var b := Cutscene.line(String(lid), null, stage.shot(String(lid), i))
		if acts.has(String(lid)):
			b.act = stage.act.bind(String(acts[String(lid)]))
		out.append(b)
		i += 1
	return out

## beats for a run of line ids, orbiting `look` from `deg0`, each a little further round
func _beats(ids: Array, look: Vector3, deg0: float) -> Array:
	var out: Array = []
	var a := deg0
	for lid in ids:
		if not Lines.has(String(lid)):
			continue
		out.append(Cutscene.line(String(lid), look, { "orbit": { "radius": 8.0, "height": 3.0, "deg0": a, "deg1": a + 28.0 } }))
		a += 28.0
	return out

## the chapter's closing lines play before the chain moves on (the mid lines of a boss chapter at its stagger would
## need the boss view's hooks; they play before the close)
## the story's races (Nov 18, the owner: "the main story missions … feel too short"): a race chapter's start is where
## the grid is; reaching it puts you on a long track (race_view.gd) against the chapter's field, and only a win clears
## it — lose and the start waits for another go. The chapter's `track` picks the course; `race_km` caps a long one-lap
## course to the story's distance (race.gd `finish_frac`).
const STORY_RACES := {
	"neon": { "track": "neon-ring-express", "laps": 1, "race_km": 24.0 },
	"solara": { "track": "glass-flats-rally", "laps": 1, "race_km": 30.0 },
	"nexus": { "track": "nexus-grand-prix", "laps": 2, "race_km": 0.0 },
}
var race_view: Control
var _raced := ""

func _start_story_race() -> void:
	var sr: Dictionary = STORY_RACES.get(String(_quest_def(String(quest.id)).get("track", "neon")), STORY_RACES.neon)
	race_view = load("res://scripts/racing/race_view.gd").new()
	race_view.track_id = String(sr.track)
	race_view.laps = int(sr.laps)
	race_view.race_km = float(sr.race_km)
	race_view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	race_view.closed.connect(_story_race_done)
	add_child(race_view)

func _story_race_done() -> void:
	var won: bool = race_view.race != null and not race_view.race.player().is_empty() and race_view.race.player().finished_at >= 0.0 and race_view.race.position_of(race_view.race.player()) == 1
	race_view.queue_free()
	race_view = null
	if won:
		_raced = String(quest.id)
		_complete()
	else:
		controls_toast("Not a win — the grid is waiting when you're ready")
		_set_waypoint(_on_ground(operator.position + _dir * 25.0), true)

func controls_toast(t: String) -> void:
	if controls:
		controls.toast(t)

func _complete() -> void:
	var id := String(quest.id)
	if String(quest.get("kind_real", "")) == "race" and _raced != id:
		if race_view == null:
			_start_story_race()
		return
	if _closing != id and cutscene:
		var def := _quest_def(id)
		var ids: Array = []
		ids.append_array(def.get("mid", []))
		ids.append_array(def.get("close", []))
		var beats := _scene(def, ids, 200.0)
		if not beats.is_empty():
			_closing = id
			_set_waypoint(Vector3.ZERO, false)
			cutscene.play(beats, region.camera())
			cutscene.finished.connect(_complete, CONNECT_ONE_SHOT)
			return
	_closing = ""
	var def2 := _quest_def(id)
	var last := chapters.find(def2) + 1 >= chapters.size() or String(chapters[chapters.find(def2) + 1].mission) != String(def2.mission)
	super()
	if last:
		_mission_done(String(def2.mission), String(def2.mission_title))

## a mission finished: the profile remembers (the people's news changes), and the next mission's card
func _mission_done(mission: String, title: String) -> void:
	var p := _profile()
	var done: Array = p.get(_done_key(), [])
	if not done.has(mission):
		done.append(mission)
	p[_done_key()] = done
	_profile_save(p)
	controls.toast("MISSION %s COMPLETE · %s" % [mission, title])

func _chapter_done() -> void:
	_set_waypoint(Vector3.ZERO, false)
	_objective.text = "Campaign complete."
	if _done_panel:
		return
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -70)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "A WORLD WORTH KEEPING\nMissions 02 to 25 complete\nThe world is still running. So are you."
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 20)
	v.add_child(t)
	var b := Button.new()
	b.text = "BACK TO THE GLOBE"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): _save(); closed.emit())
	v.add_child(b)
	add_child(_done_panel)

func _refresh() -> void:
	if quest.is_empty():
		return
	var kind := String(quest.get("kind_real", quest.kind))
	var d := Vector2(waypoint.x - operator.position.x, waypoint.z - operator.position.z).length()
	match kind:
		"talk":
			_objective.text = "%s\n%s · %d m" % [quest.title, quest.label, int(d)]
		"race", "drive":
			_objective.text = "%s\n%s · %d m" % [quest.title, quest.label, int(d)]
		"boss":
			_objective.text = "%s\n%s" % [quest.title, (String(boss.rules.def.name).to_upper() if boss else quest.label)]
		"choice", "cutscene":
			_objective.text = String(quest.title)
		_:
			super()

## the descent's survive goes on to a guarded relay (`stage2`); a campaign hold is done when the time is
func _process(dt: float) -> void:
	super(dt)
	if not quest.is_empty() and String(quest.kind) == "survive" and int(progress.stage) == 1 and not quest.has("stage2") and _closing == "":
		_complete()

# --------------------------------------------------------------------------------------------- talk, choice, boss
## the named person of a talk chapter stands at the waypoint: a body in their look (people.gd) facing the way you come
func _place_talker(who: String, at: Vector3) -> void:
	var body := Player.new()
	region.world().add_child(body)
	body.position = at
	body.ground_at = operator.ground_at
	# their people.gd look, or the story's look for them (stage.gd): never the player's own look
	body.civilian = not Stage.is_operator(who.to_upper())
	body.build(Stage.look_of(who.to_upper()))
	body.scale = Vector3.ONE * Stage.scale_of(who.to_upper())
	# the body faces its local +z: turn it to the operator (look_at would turn its back)
	body.heading = atan2(operator.position.x - at.x, operator.position.z - at.z)
	body.rig.rotation.y = body.heading
	body.set_meta("who", who.to_upper())
	_talker = body

func _ask_choice(def: Dictionary) -> void:
	if choice_view == null:
		choice_view = Choice.new()
		add_child(choice_view)
	controls.visible = false
	choice_view.visible = true
	choice_view.ask(String(def.get("prompt", "Choose.")), def.get("options", []))
	choice_view.chosen.connect(func(key: String):
		choice_view.visible = false
		controls.visible = true
		var p := _profile()
		p[_choice_key(String(def.mission))] = key
		_profile_save(p)
		var by: Dictionary = def.get("by_choice", {})
		var beats := _scene(def, by.get(key, []), 120.0)
		if beats.is_empty():
			_complete()
		else:
			cutscene.play(beats, region.camera())
			cutscene.finished.connect(_complete, CONNECT_ONE_SHOT)
	, CONNECT_ONE_SHOT)

func _summon_boss(id: String) -> void:
	if boss and boss.rules and boss.rules.dead:
		# the last chapter's boss went down: it gives way to this one (a mission can have more than one)
		boss.queue_free()
		boss = null
	if boss:
		return
	boss = BossView.new()
	region.world().add_child(boss)
	var at := _on_ground(operator.position + Vector3(0, 0, -24.0))
	# the hull: BOSS_FOR, or the story data's own `bosses` table (the main story's chapter files), else the colossus
	var hull := String(BOSS_FOR.get(id, _story().get("bosses", {}).get(id, "colossus")))
	boss.setup(hull, at, operator, gunplay, enemies, operator.ground_at)
	if quest.has("boss_name"):
		# the story's name on the build's hull (the rules' def is the shared table row: a copy carries the name)
		boss.rules.def = boss.rules.def.duplicate()
		boss.rules.def.name = String(quest.boss_name)
	boss.obstacles = operator.obstacles
	boss.heading = PI
	boss.toast = func(t: String) -> void: controls.toast(t)
	boss.killed.connect(_on_boss_down)
	Sound.sfx("roar", -2.0)

func _on_boss_down(bid: String, reward: Dictionary) -> void:
	var p := Gear.profile_load()
	var clears: Dictionary = p.get("boss_clears", {})
	var first: bool = not clears.has(bid)
	var res := Progression.grant(p, "boss", int(reward.nex) / (1 if first else 3), int(reward.xp) / (1 if first else 3), String(boss.rules.def.name))
	clears[bid] = int(clears.get(bid, 0)) + 1
	p.boss_clears = clears
	Gear.profile_save(p)
	for l in res.lines:
		controls.toast(String(l))
	_complete()

## the descent's core: its waves, then the chapter's boss (a core chapter with none is done when the waves are)
func _core_breached() -> void:
	if _seen.has(String(quest.id) + "-core"):
		return
	_seen[String(quest.id) + "-core"] = true
	if quest.has("boss"):
		_summon_boss(String(quest.boss))
	else:
		_complete()

func _summon_vyrak() -> void:
	_summon_boss(String(quest.get("boss", "vyrak")))

func _hack_done() -> void:
	if _seen.has(String(quest.id) + "-hack"):
		return
	_seen[String(quest.id) + "-hack"] = true
	_complete()

# --------------------------------------------------------------------------------------------- the profile
static func _profile() -> Dictionary:
	var f := FileAccess.open(PROFILE, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			return d
	return {}

static func _profile_save(p: Dictionary) -> void:
	var f := FileAccess.open(PROFILE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(p))

## where the profile keeps the finished missions and a mission's choice (a story line of its own keeps its own)
func _done_key() -> String:
	return "campaign_done"

func _choice_key(mission: String) -> String:
	return "m%s_choice" % mission

## story co-op: the campaign's chapters share rooms of their own; a choice or a story race is busy like a cutscene
func coop_chain() -> String:
	return "campaign"

func _busy() -> bool:
	return super() or (choice_view != null and choice_view.visible) or race_view != null

## the campaign's state for the title and the globe: the next mission to play, "" when done
static func next_mission() -> String:
	var f := FileAccess.open(CAMPAIGN_SAVE, FileAccess.READ)
	if not f:
		return "02"
	var d: Variant = JSON.parse_string(f.get_as_text())
	if d is Dictionary:
		var cur := String(d.get("current", ""))
		return "" if cur == ACT_END else cur.substr(0, 2)
	return "02"
