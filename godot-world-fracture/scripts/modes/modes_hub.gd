extends Control
## Game Modes: PvP, Raids and Races as three separate modes (the owner, Nov 8: "PvP, Raids & races are all separate game
## modes … create separate modes for each"). The hub is three big tiles in the look of the owner's boards
## (docs/reference/pvp-maps.png: navy panels with glowing cyan edges, angled title plates, a picture per map, a strip of
## modes and features along the bottom); each tile opens that mode's lobby, and the lobby launches the mode's own view:
##
##   PvP     the Killbox arenas (scripts/killbox/arena_view.gd), Clash against bot teams
##   Raids   Raid 01 · The Hollow Star (scripts/raid/raid_view.gd) with a bot fireteam, from the gate or the checkpoint
##   Races   Nexus Speedway and the Neon Night Circuit (scripts/racing/race_view.gd) against bot racers
##
## Everything runs against bots for now; online play comes later (the owner's call, Nov 8). The views are hosted here, so
## LEAVE in a mode comes back to its lobby.

signal closed

const ArenaView := preload("res://scripts/killbox/arena_view.gd")
const Arena := preload("res://scripts/killbox/arena.gd")
const RaceView := preload("res://scripts/racing/race_view.gd")
const Track := preload("res://scripts/racing/track.gd")
const RaidView := preload("res://scripts/raid/raid_view.gd")
const HollowStar := preload("res://scripts/raid/hollow_star.gd")
const PICS := "res://textures/ui/modes/"

const EDGE := Color(0.25, 0.7, 1.0)
const MODES := [
	{ "id": "pvp", "name": "PVP", "plate": "KILLBOX", "accent": Color(1.0, 0.3, 0.7), "sub": "Competitive arenas · team battles",
	  "blurb": "Six a side on the rooftops of Neon City. Every elimination scores; first to 75.", "tags": ["Team Deathmatch", "Multi-level", "Dynamic events"] },
	{ "id": "raids", "name": "RAIDS", "plate": "RAID 01", "accent": Color(0.7, 0.45, 1.0), "sub": "Six-player fireteams · 3.8 km down",
	  "blurb": "The Hollow Star: hold the Broken Gate, then break Astravore before the machine overloads.", "tags": ["Fireteam of 6", "Checkpoints", "Exotic drops"] },
	{ "id": "races", "name": "RACES", "plate": "CIRCUITS", "accent": Color(0.3, 0.9, 1.0), "sub": "Venues · street circuits",
	  "blurb": "Your garage build against three rivals: the Speedway by day, Neon City's streets by night.", "tags": ["Your garage car", "Live positions", "Prize Nex"] },
]

var page: Control
var view: Control
var _mode := ""

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.material = _backdrop()
	add_child(bg)
	_was_upright = _upright()
	show_hub()
	get_viewport().size_changed.connect(_turned)

# --------------------------------------------------------------------------------------------- the look
## the board's backdrop: deep navy, a faint grid, a fracture glow low on the horizon
func _backdrop() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;
void fragment() {
	vec2 uv = UV;
	vec3 top = vec3(0.012, 0.03, 0.07);
	vec3 low = vec3(0.03, 0.06, 0.13);
	vec3 col = mix(top, low, uv.y);
	vec2 g = abs(fract(uv * vec2(48.0, 27.0)) - 0.5);
	float grid = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
	col += vec3(0.05, 0.12, 0.2) * grid * 0.35;
	float glow = exp(-pow((uv.y - 0.98) * 6.0, 2.0)) * (0.6 + 0.4 * sin(uv.x * 9.0 + TIME * 0.4));
	col += vec3(0.25, 0.1, 0.45) * glow * 0.5;
	COLOR = vec4(col, 1.0);
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

## the boards' panel: navy glass, a bright cyan edge, cut corners
static func panel(edge: Color = EDGE, fill := Color(0.02, 0.06, 0.12, 0.9), w := 2) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = edge
	s.set_border_width_all(w)
	s.corner_radius_top_left = 2
	s.corner_radius_bottom_right = 2
	s.corner_radius_top_right = 14
	s.corner_radius_bottom_left = 14
	s.shadow_color = Color(edge.r, edge.g, edge.b, 0.35)
	s.shadow_size = 8
	s.content_margin_left = 0
	s.content_margin_right = 0
	s.content_margin_top = 0
	s.content_margin_bottom = 0
	return s

static func text(t: String, size: int, col := Color(0.92, 0.97, 1.0), italic := true) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	if italic:
		var fv := FontVariation.new()
		fv.base_font = ThemeDB.fallback_font
		fv.variation_transform = Transform2D(Vector2(1, 0), Vector2(0.2, 1), Vector2.ZERO)
		fv.variation_embolden = 0.9 if size >= 20 else 0.4
		l.add_theme_font_override("font", fv)
	return l

## the angled title plate across a picture's top-left corner
func _plate(title: String, sub: String, accent: Color, size := 30) -> Control:
	var p := PanelContainer.new()
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.01, 0.03, 0.07, 0.82)
	s.border_color = accent
	s.border_width_left = 4
	s.corner_radius_bottom_right = 18
	s.content_margin_left = 14
	s.content_margin_right = 22
	s.content_margin_top = 6
	s.content_margin_bottom = 8
	p.add_theme_stylebox_override("panel", s)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	p.add_child(v)
	v.add_child(text(title, size))
	if sub != "":
		v.add_child(text(sub, 14, Color(0.75, 0.85, 0.95), false))
	return p

## a picture for a tile: the mode's screenshot when it is shipped, otherwise a painted gradient in its colours
func _picture(id: String, accent: Color) -> Control:
	var path := PICS + id + ".jpg"
	if ResourceLoader.exists(path):
		var tr := TextureRect.new()
		tr.texture = load(path)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		tr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		return tr
	var cr := ColorRect.new()
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;
uniform vec3 accent : source_color;
void fragment() {
	vec3 col = mix(vec3(0.02, 0.03, 0.08), accent * 0.5, pow(1.0 - UV.y, 2.0));
	col += accent * 0.25 * smoothstep(0.02, 0.0, abs(fract(UV.x * 8.0 + UV.y * 2.0 + TIME * 0.1) - 0.5) - 0.47);
	COLOR = vec4(col, 1.0);
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("accent", accent)
	cr.material = m
	cr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return cr

## a picture tile: the picture filling a glowing panel, the title plate on it, a dark band of text under it
func _tile(pic_id: String, title: String, sub: String, body: String, accent: Color, act: Callable, enabled := true, title_size := 30) -> Control:
	var b := Button.new()
	b.flat = true
	b.clip_contents = true
	b.focus_mode = Control.FOCUS_ALL
	for st in ["normal", "pressed", "focus", "disabled"]:
		b.add_theme_stylebox_override(st, panel(accent if enabled else Color(0.25, 0.32, 0.4), Color(0.02, 0.05, 0.1, 0.95)))
	b.add_theme_stylebox_override("hover", panel(Color(1.0, 0.85, 0.45), Color(0.03, 0.07, 0.13, 0.95), 3))
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_EXPAND_FILL
	b.disabled = not enabled
	b.pressed.connect(act)
	var pic := _picture(pic_id, accent)
	pic.offset_left = 3
	pic.offset_top = 3
	pic.offset_right = -3
	pic.offset_bottom = -66 if body != "" else -3
	if not enabled:
		pic.modulate = Color(0.45, 0.5, 0.6)
	b.add_child(pic)
	var plate := _plate(title, sub, accent, title_size)
	plate.position = Vector2(3, 10)
	plate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(plate)
	if body != "":
		var l := text(body, 14, Color(0.82, 0.9, 1.0), false)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.anchor_left = 0.0
		l.anchor_right = 1.0
		l.anchor_top = 1.0
		l.anchor_bottom = 1.0
		l.offset_left = 14
		l.offset_right = -14
		l.offset_top = -62
		l.offset_bottom = -6
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(l)
	return b

## the board's header: WORLD FRACTURE on the left, the page title and its strap line on an angled bar
func _header(title: String, strap: String, back: Callable) -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 18)
	var bb := Data.button("← BACK")
	bb.custom_minimum_size = Vector2(96, 46)
	bb.pressed.connect(back)
	h.add_child(bb)
	var wf := text("WORLD\nFRACTURE", 15, Color(0.75, 0.9, 1.0))
	wf.add_theme_constant_override("line_spacing", -4)
	h.add_child(wf)
	var bar := PanelContainer.new()
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.02, 0.07, 0.15, 0.85)
	s.border_color = EDGE
	s.border_width_bottom = 2
	s.border_width_left = 2
	s.corner_radius_top_left = 16
	s.content_margin_left = 18
	s.content_margin_right = 18
	s.content_margin_top = 2
	s.content_margin_bottom = 4
	bar.add_theme_stylebox_override("panel", s)
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", -4)
	bar.add_child(v)
	v.add_child(text(title, 32))
	var st := text(strap, 13, Color(0.6, 0.85, 1.0), false)
	st.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS   # an upright phone has no room for the whole strap
	st.clip_text = true
	v.add_child(st)
	h.add_child(bar)
	return h

## the strip along the bottom: a label plate and a row of ticks
func _strip(label: String, items: Array, accent := EDGE) -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", panel(accent, Color(0.02, 0.05, 0.11, 0.9), 1))
	# the ticks wrap onto a second line on an upright phone instead of pushing the page off the screen's edge
	var h := HFlowContainer.new()
	h.add_theme_constant_override("h_separation", 22)
	h.add_theme_constant_override("v_separation", 2)
	p.add_child(h)
	var l := text("  " + label, 16, accent)
	h.add_child(l)
	for it in items:
		h.add_child(text(String(it), 13, Color(0.82, 0.9, 1.0), false))
	return p

## an upright phone stacks the tiles one above the other (each keeps its wide picture); sideways they stand in a row.
## Upright, three tall slivers each showed a tenth of its picture blown up until it was all pixels (owner's phone test)
func _upright() -> bool:
	var vs := get_viewport_rect().size
	return vs.y > vs.x

func _row() -> BoxContainer:
	var row := BoxContainer.new()
	row.vertical = _upright()
	row.add_theme_constant_override("separation", 12 if row.vertical else 16)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	return row

var _was_upright := true
## the phone turned: lay the page out again for the new shape (not while a mode is running over it)
func _turned() -> void:
	if _upright() == _was_upright:
		return
	_was_upright = _upright()
	if view or not page:
		return
	if _mode == "":
		show_hub()
	else:
		open_mode(_mode)

func _page() -> VBoxContainer:
	if page:
		page.queue_free()
	var m := MarginContainer.new()
	m.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right"]:
		m.add_theme_constant_override("margin_" + side, 22)
	m.add_theme_constant_override("margin_top", 14)
	m.add_theme_constant_override("margin_bottom", 14)
	add_child(m)
	page = m
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	m.add_child(v)
	return v

# --------------------------------------------------------------------------------------------- the hub
func show_hub() -> void:
	_mode = ""
	var v := _page()
	v.add_child(_header("GAME MODES", "PVP   /   RAIDS   /   RACES   ·   VS BOTS NOW, ONLINE PLAY LATER", func(): closed.emit()))
	var row := _row()
	v.add_child(row)
	for md in MODES:
		var id: String = md.id
		var t := _tile(id, String(md.name), String(md.sub), String(md.blurb), md.accent, func(): open_mode(id), true, 40)
		row.add_child(t)
	v.add_child(_strip("EVERY MODE", ["✓ Your operator, guns and gear", "✓ Nex and XP into your profile", "✓ Bots fill every slot"]))

func open_mode(id: String) -> void:
	_mode = id
	match id:
		"pvp":
			_pvp()
		"raids":
			_raids()
		"races":
			_races()

# --------------------------------------------------------------------------------------------- PvP
const PVP_SOON := [["neon-yard", "NEON YARD", "Industrial container yard"], ["glass-spire", "GLASS SPIRE", "Vertical combat tower"], ["riverfront", "RIVERFRONT", "Urban waterfront arena"], ["void-rift", "VOID RIFT", "Fracture anomaly zone"]]

func _pvp() -> void:
	var v := _page()
	v.add_child(_header("PVP · KILLBOX", "COMPETITIVE ARENAS   /   TEAM BATTLES   /   CLASH VS BOT SQUADS", show_hub))
	var grid := GridContainer.new()
	grid.columns = 2 if _upright() else 4
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# twelve arenas in two columns run past an upright phone's bottom edge: the grid scrolls
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.add_child(grid)
	v.add_child(sc)
	for id in Arena.arena_ids():
		var a := Arena.new(String(id))
		var aid := String(id)
		var t := _tile("pvp-" + aid, String(a.def.name).to_upper(), String(a.def.get("tag", "Clash · 6 v 6")), "", Color(1.0, 0.3, 0.7), func(): _launch_arena(aid), true, 22)
		t.custom_minimum_size = Vector2(0, 150)
		grid.add_child(t)
	for s in PVP_SOON:
		var t2 := _tile("pvp-" + String(s[0]), String(s[1]), String(s[2]) + " · coming", "", Color(0.4, 0.5, 0.6), func(): pass, false, 22)
		t2.custom_minimum_size = Vector2(0, 150)
		grid.add_child(t2)
	v.add_child(_strip("PVP MODES", ["✓ Team Deathmatch (Clash)", "Domination · soon", "Control · soon", "Kill Confirmed · soon", "Free for All · soon", "Ranked · with online"], Color(1.0, 0.3, 0.7)))

func _launch_arena(id: String) -> void:
	var av := ArenaView.new()
	av.arena_id = id
	_host(av)

# --------------------------------------------------------------------------------------------- Raids
func _raids() -> void:
	var v := _page()
	v.add_child(_header("RAIDS", "SIX-PLAYER FIRETEAMS   /   CHECKPOINTS   /   YOU + FIVE BOTS", show_hub))
	var row := _row()
	v.add_child(row)
	var save := HollowStar.load_save()
	var hero := _tile("raid-hollow-star", "RAID 01 · THE HOLLOW STAR", "Nexus City · Underground Fracture · 3.8 km", "Beneath Nexus City an ancient machine has woken. Descend, shut it down, and break the intelligence that runs it.", Color(0.7, 0.45, 1.0), func(): _launch_raid("broken-gate"), true, 26)
	hero.size_flags_stretch_ratio = 1.6
	row.add_child(hero)
	var side := PanelContainer.new()
	side.add_theme_stylebox_override("panel", panel(Color(0.7, 0.45, 1.0)))
	side.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(side)
	var sv := VBoxContainer.new()
	sv.add_theme_constant_override("separation", 6)
	var mg := MarginContainer.new()
	for k in ["left", "right", "top", "bottom"]:
		mg.add_theme_constant_override("margin_" + k, 14)
	side.add_child(mg)
	mg.add_child(sv)
	sv.add_child(text("ENCOUNTERS", 18, Color(0.8, 0.65, 1.0)))
	var n := 1
	for e in HollowStar.ENCOUNTERS:
		var on: bool = e.playable
		var mark := "✓" if on else "·"
		var l := text("%s  %d  %s%s" % [mark, n, String(e.name).to_upper(), "" if on else "  (coming)"], 14, Color(0.9, 0.92, 1.0) if on else Color(0.5, 0.55, 0.65), false)
		sv.add_child(l)
		n += 1
	sv.add_child(text("Fireteam: you + Vance, Iko, Sable, Ren, Tamsin\nLives: %d shared · Clears: %d%s" % [HollowStar.LIVES, int(save.clears), ("\nBest: %d:%02d" % [int(float(save.best) / 60.0), int(fmod(float(save.best), 60.0))]) if float(save.best) > 0.0 else ""], 13, Color(0.75, 0.82, 0.92), false))
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sv.add_child(spacer)
	var go := Data.button("▶ LAUNCH · THE BROKEN GATE", true)
	go.custom_minimum_size = Vector2(0, 50)
	go.pressed.connect(func(): _launch_raid("broken-gate"))
	sv.add_child(go)
	if String(save.checkpoint) == "hollow-star-boss":
		var cp := Data.button("▶ CHECKPOINT · THE HOLLOW STAR", true)
		cp.custom_minimum_size = Vector2(0, 50)
		cp.add_theme_color_override("font_color", Color(1.0, 0.8, 0.5))
		cp.pressed.connect(func(): _launch_raid("hollow-star-boss"))
		sv.add_child(cp)
	v.add_child(_strip("RAID RULES", ["✓ First clear: Hollow Star Lens + Starbreaker title", "✓ Wipe = encounter restarts", "✓ No map: follow the light down"], Color(0.7, 0.45, 1.0)))

func _launch_raid(at: String) -> void:
	var rv := RaidView.new()
	rv.start_at = at
	rv.next.connect(func(enc: String): _launch_raid(enc))
	_host(rv)

# --------------------------------------------------------------------------------------------- Races
func _races() -> void:
	var v := _page()
	v.add_child(_header("RACES", "VENUES   /   STREET CIRCUITS   /   YOUR GARAGE CAR VS THREE RIVALS", show_hub))
	var row := _row()
	v.add_child(row)
	for id in Track.ids():
		var tr := Track.new(String(id))
		var tid := String(id)
		var street := tr.street()
		var sub := "%s · %d laps · %.1f km" % ["Street circuit, night" if street else "Racing venue, day", int(tr.def.laps), tr.length / 1000.0]
		var body := "Neon City's blocks at night: barriers, right-angle corners, the market jog. Win: %d Nex." % int(tr.def.prize[0]) if street else "Stands, pit lane and start lights; an oval with a back-straight chicane. Win: %d Nex." % int(tr.def.prize[0])
		row.add_child(_tile("race-" + tid, String(tr.def.name).to_upper(), sub, body, Color(0.3, 0.9, 1.0), func(): _launch_race(tid), true, 28))
	row.add_child(_tile("race-open-world", "OPEN WORLD", "Race other players across the cities", "Point-to-point races through Nexus and Neon City traffic. Comes with online play.", Color(0.4, 0.5, 0.6), func(): pass, false, 28))
	v.add_child(_strip("RACE CLASSES", ["✓ Street", "✓ Supercar", "Motorcycle · soon", "Off-road / mud · soon", "Air races · soon"], Color(0.3, 0.9, 1.0)))

func _launch_race(id: String) -> void:
	var rv := RaceView.new()
	rv.track_id = id
	_host(rv)

# --------------------------------------------------------------------------------------------- hosting a mode
func _host(v: Control) -> void:
	if view:
		view.queue_free()
	view = v
	page.visible = false
	v.closed.connect(_view_closed)
	add_child(v)

func _view_closed() -> void:
	if view:
		view.queue_free()
		view = null
	open_mode(_mode)
