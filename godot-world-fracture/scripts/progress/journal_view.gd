extends Control
## The Journal (owner Nov 18, interfaceingame.com Cyberpunk 2077 "Journal"): every job in one place — a list down the
## left in sections, the picked job's details on the right.
##   MAIN JOBS   the campaign's missions 02–25 (data/dialogue/campaign_full.json; done / current / ahead from
##               user://campaign.json), each with its chapters ticked off
##   SIDE JOBS   Fracture Descent's quests (descent.gd QUESTS, user://quests.json)
##   GIGS        the street racing ladder (street_career.gd): the rung you're on, the next, the races open to you
##   CONTRACTS   the Fracture bosses at the Rift Gate (cleared or not) and Raid 01 · The Hollow Star
##   TODAY       the day's three pursuits (progression.gd)
## Read-only; `closed` on BACK. Opens from the title's JOURNAL row (and the shot hook `journal`).

signal closed

const UiTheme := preload("res://scripts/ui/ui_theme.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")

var _jobs: Array = []        # {section, title, sub, state ("done" | "current" | "open" | "ahead"), body: [lines], steps: [[text, done]]}
var _list: VBoxContainer
var _detail: VBoxContainer
var _pick := -1

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	position = Vector2.ZERO
	size = get_viewport_rect().size
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.045, 0.98)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var bar := HBoxContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 24
	bar.offset_top = 18
	bar.add_theme_constant_override("separation", 18)
	add_child(bar)
	var back := Button.new()
	back.text = "✕  BACK"
	back.custom_minimum_size = Vector2(110, 44)
	back.pressed.connect(func(): closed.emit())
	bar.add_child(back)
	var title := Label.new()
	title.text = "JOURNAL"
	title.theme_type_variation = &"HeaderLarge"
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	var rule := ColorRect.new()
	rule.color = UiTheme.LINE
	rule.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	rule.offset_top = 78
	rule.offset_bottom = 79
	add_child(rule)
	var body := HBoxContainer.new()
	body.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	body.offset_top = 92
	body.offset_left = 24
	body.offset_right = -24
	body.offset_bottom = -16
	body.add_theme_constant_override("separation", 24)
	add_child(body)
	var ls := ScrollContainer.new()
	ls.custom_minimum_size.x = minf(420.0, size.x * 0.42)
	ls.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(ls)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 2)
	ls.add_child(_list)
	var ds := ScrollContainer.new()
	ds.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ds.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(ds)
	_detail = VBoxContainer.new()
	_detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail.add_theme_constant_override("separation", 8)
	ds.add_child(_detail)
	_jobs = jobs()
	_fill_list()
	# open on the job in progress
	for i in _jobs.size():
		if String(_jobs[i].state) == "current":
			show_job(i)
			return
	if not _jobs.is_empty():
		show_job(0)

## every job, read from the saves (static so a test can read it without the screen)
static func jobs() -> Array:
	var out: Array = []
	# MAIN JOBS: the campaign
	var camp := _json("user://campaign.json")
	var done: Array = camp.get("done", [])
	var cur := String(camp.get("current", ""))
	var data := _json_res("res://data/dialogue/campaign_full.json")
	var seen_current := false
	for m in data.get("missions", []):
		var steps: Array = []
		var all := true
		var any_cur := false
		for c in m.get("chapters", []):
			var d := done.has(String(c.id))
			steps.append([String(c.get("title", c.id)), d])
			all = all and d
			any_cur = any_cur or String(c.id) == cur
		var state := "done" if all and not steps.is_empty() else ("current" if any_cur or (not seen_current and cur == "" and out.is_empty()) else "ahead")
		if state == "current":
			seen_current = true
		out.append({ "section": "MAIN JOBS", "title": "%s · %s" % [String(m.id), String(m.title)], "sub": String(m.get("region", "")),
			"state": state, "body": [String(m.get("beat", ""))], "steps": steps })
	# SIDE JOBS: the Descent
	var q := _json("user://quests.json")
	var qdone: Array = q.get("done", [])
	var qcur := String(q.get("current", "fd-02"))
	var Descent = load("res://scripts/mission/descent.gd")
	for r in Descent.QUESTS:
		var st := "done" if qdone.has(String(r.id)) else ("current" if String(r.id) == qcur else "ahead")
		out.append({ "section": "SIDE JOBS", "title": "%s · %s" % [String(r.id).to_upper(), String(r.title)], "sub": "Fracture Descent",
			"state": st, "body": [String(r.get("line", ""))], "steps": [[String(r.get("label", "")), st == "done"]],
			"reward": "+%d Nex  ·  +%d XP" % [int(r.get("nex", 0)), int(r.get("xp", 0))] })
	# GIGS: the street ladder
	var Career = load("res://scripts/racing/street_career.gd")
	var career = Career.load_or_fresh()
	var t: int = career.tier()
	var steps2: Array = []
	for i in Career.TIERS.size():
		steps2.append(["%s · %s" % [String(Career.TIERS[i].name), String(Career.TIERS[i].line)], i <= t])
	out.append({ "section": "GIGS", "title": "The Street Ladder", "sub": career.ladder_line(), "state": "current" if t < Career.TIERS.size() - 1 else "done",
		"body": ["Win races on the avenues to climb from UNKNOWN to LEGEND. Each rung opens bigger meets and garage parts.",
			"%d races · %d wins · %d busts · %d escapes" % [int(career.races), int(career.wins), int(career.busts), int(career.escapes)]], "steps": steps2 })
	# CONTRACTS: bosses and the raid
	var p := Gear.profile_load()
	var clears: Dictionary = p.get("boss_clears", {})
	var Boss = load("res://scripts/combat/boss.gd")
	for id in Boss.BOSSES:
		var b: Dictionary = Boss.BOSSES[id]
		out.append({ "section": "CONTRACTS", "title": String(b.name), "sub": "The Rift Gate", "state": "done" if clears.has(id) else "open",
			"body": [String(b.get("blurb", ""))], "steps": [["Clear it at the Rift Gate", clears.has(id)]],
			"reward": "+%d Nex  ·  +%d XP" % [int(b.reward[0]), int(b.reward[1])] })
	var raid: Dictionary = load("res://scripts/raid/hollow_star.gd").load_save()
	out.append({ "section": "CONTRACTS", "title": "Raid 01 · The Hollow Star", "sub": "Nexus City · Underground Fracture", "state": "done" if int(raid.clears) > 0 else "open",
		"body": ["Beneath Nexus City an ancient machine has woken. Descend, shut it down, and break the intelligence that runs it.", "Clears: %d" % int(raid.clears)],
		"steps": [["Clear the raid", int(raid.clears) > 0]], "reward": "Hollow Star Lens · Starbreaker title" })
	# TODAY: the pursuits
	for g in Progression.daily(p):
		out.append({ "section": "TODAY", "title": String(g.label), "sub": "%d / %d" % [int(g.progress), int(g.target)], "state": "done" if bool(g.done) else "open",
			"body": ["Today's pursuit — it turns over at midnight."], "steps": [[String(g.label), bool(g.done)]], "reward": "+%d Nex  ·  +%d XP" % [int(g.nex), int(g.xp)] })
	return out

func _fill_list() -> void:
	var section := ""
	for i in _jobs.size():
		var j: Dictionary = _jobs[i]
		if String(j.section) != section:
			section = String(j.section)
			var gap := Control.new()
			gap.custom_minimum_size.y = 10 if i > 0 else 0
			_list.add_child(gap)
			var h := Label.new()
			h.text = section
			h.theme_type_variation = &"HeaderSmall"
			_list.add_child(h)
			var r := ColorRect.new()
			r.color = UiTheme.LINE_HI * Color(1, 1, 1, 0.5)
			r.custom_minimum_size.y = 2
			_list.add_child(r)
		var b := Button.new()
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 40)
		b.clip_text = true
		var st := String(j.state)
		var mark: String = { "done": "✓", "current": "◆", "open": "◇", "ahead": "·" }.get(st, "·")
		b.text = "%s   %s" % [mark, String(j.title)]
		b.add_theme_font_override("font", UiTheme.font(600 if st == "current" else 500, 0))
		b.add_theme_font_size_override("font_size", 14)
		b.add_theme_color_override("font_color", UiTheme.GOLD if st == "current" else (UiTheme.INK_FAINT if st in ["done", "ahead"] else UiTheme.INK))
		var flat := UiTheme.box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, Vector4(10, 4, 10, 4))
		var lit := UiTheme.box(Color(1, 1, 1, 0.07), Color(0, 0, 0, 0), 0, Vector4(10, 4, 10, 4))
		lit.border_width_left = 3
		lit.border_color = UiTheme.GOLD
		b.add_theme_stylebox_override("normal", flat)
		b.add_theme_stylebox_override("hover", lit)
		b.add_theme_stylebox_override("focus", lit)
		b.add_theme_stylebox_override("pressed", lit)
		b.set_meta("job", i)
		b.pressed.connect(func(): show_job(i))
		_list.add_child(b)

func show_job(i: int) -> void:
	_pick = i
	for c in _list.get_children():
		if c is Button:
			var on := int(c.get_meta("job")) == i
			(c as Button).add_theme_stylebox_override("normal", (c as Button).get_theme_stylebox("hover") if on else UiTheme.box(Color(0, 0, 0, 0), Color(0, 0, 0, 0), 0, Vector4(10, 4, 10, 4)))
	for c in _detail.get_children():
		c.queue_free()
	var j: Dictionary = _jobs[i]
	var st := String(j.state)
	_detail.add_child(_label(String(j.section) + "   ·   " + { "done": "COMPLETE", "current": "IN PROGRESS", "open": "OPEN", "ahead": "AHEAD" }.get(st, ""), 600, 4, 12, UiTheme.GOLD if st == "current" else UiTheme.INK_DIM))
	var t := _label(String(j.title).to_upper(), 700, 4, 30, UiTheme.INK)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_detail.add_child(t)
	if String(j.get("sub", "")) != "":
		_detail.add_child(_label(String(j.sub).to_upper(), 600, 2, 13, UiTheme.INK_DIM))
	var r := ColorRect.new()
	r.color = UiTheme.GOLD if st == "current" else UiTheme.LINE_HI
	r.custom_minimum_size = Vector2(120, 2)
	r.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_detail.add_child(r)
	for line in j.get("body", []):
		if String(line) == "":
			continue
		var l := _label(String(line), 400, 0, 16, Color(0.93, 0.94, 0.95, 0.88))
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_detail.add_child(l)
	var steps: Array = j.get("steps", [])
	if not steps.is_empty():
		var g := Control.new()
		g.custom_minimum_size.y = 8
		_detail.add_child(g)
		_detail.add_child(_label("OBJECTIVES", 600, 4, 12, UiTheme.INK_DIM))
		for s in steps:
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 12)
			row.add_child(_label("✓" if bool(s[1]) else "◇", 600, 0, 15, UiTheme.GOLD if bool(s[1]) else UiTheme.INK_DIM))
			var sl := _label(String(s[0]), 500, 0, 15, UiTheme.INK_FAINT if bool(s[1]) else UiTheme.INK)
			sl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			sl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(sl)
			_detail.add_child(row)
	if String(j.get("reward", "")) != "":
		var g2 := Control.new()
		g2.custom_minimum_size.y = 8
		_detail.add_child(g2)
		_detail.add_child(_label("REWARD", 600, 4, 12, UiTheme.INK_DIM))
		_detail.add_child(_label(String(j.reward), 700, 1, 15, UiTheme.GOLD))

func _label(t: String, weight: int, spacing: int, px: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_override("font", UiTheme.font(weight, spacing))
	l.add_theme_font_size_override("font_size", px)
	l.add_theme_color_override("font_color", col)
	return l

static func _json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	return d if d is Dictionary else {}

static func _json_res(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if not f:
		return {}
	var d = JSON.parse_string(f.get_as_text())
	return d if d is Dictionary else {}
