extends Node3D
## Nexus City's named people on the avenue (tier 2 NPCs: people.gd, memory.gd, talk.gd). Whoever's schedule puts them
## out at this hour (the device clock) walks to their place and works, sits, busks, waits for a shuttle, runs a delivery
## route or walks the police beat. Each wears a body built through the same OperatorPlayer looks as everyone (so the
## realistic bodies, faces and outfits from the character work show on them), in their own outfits, with a name tag
## when you're close. Walk up and TALK: they greet you as well as they know you, remember what you did, chat about
## work, pass on rumours and ask for errands to each other. Gunfire on the avenue scares them and builds notoriety; an
## officer on shift comes over once it's high enough (a warning first, then a fine).
## street_slice.gd owns it: setup(), step(dt), near(pos), talk(id), gunfire(pos); `busy` while a conversation is open.

const People := preload("res://scripts/npc/people.gd")
const Memory := preload("res://scripts/npc/memory.gd")
const Talk := preload("res://scripts/npc/talk.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const Catalog := preload("res://scripts/character/catalog.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")

const TALK_R := 2.4
const TAG_R := 12.0
const RESCHEDULE_S := 20.0

class Npc:
	var p: Dictionary
	var mover: Node3D
	var tag: Label3D
	var place := ""
	var activity := ""
	var goal := Vector3.ZERO
	var leg := 0               # route stop / beat end
	var wait := 0.0
	var scare := 0.0
	var leaving := false       # their shift ended: walk off down the avenue, then go

var npcs := {}                 # id -> Npc
var state: Dictionary
var operator: Node3D
var controls: Control
var ui: Control                # where the conversation panel goes (the street's Control)
var busy := false
var hour_override := -1.0      # tests and shots set an hour; -1 is the device clock
var _boxes: Array[AABB]
var _bounds: Rect2
var _ground: Callable
var _walk_x := 11.5
var _span := Vector2(-130, 130)
var _resched := 0.0
var _scare_cool := 0.0
var _panel: Control
var _cop_coming := ""

func setup(op: Node3D, ctl: Control, panel_parent: Control, boxes: Array[AABB], b: Rect2, ground: Callable, walk_x: float, span: Vector2) -> void:
	operator = op
	controls = ctl
	ui = panel_parent
	_boxes = boxes
	_bounds = b
	_ground = ground
	_walk_x = walk_x
	_span = span
	state = Memory.load_state()
	_schedule()

func hour() -> float:
	if hour_override >= 0.0:
		return hour_override
	var t := Time.get_time_dict_from_system()
	return float(t.hour) + float(t.minute) / 60.0

func today() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [d.year, d.month, d.day]

func now() -> int:
	return int(Time.get_unix_time_from_system())

## who should be out: newcomers appear at the avenue's end nearest their place and walk in; those whose shift ended walk off
func _schedule() -> void:
	var want := {}
	for o in People.out_at(hour()):
		want[String(o.person.id)] = o
	for id in npcs.keys():
		var n: Npc = npcs[id]
		if not want.has(id):
			n.leaving = true
			n.goal = Vector3(n.mover.position.x, 0, _span.y - 2.0 if n.mover.position.z > 0.0 else _span.x + 2.0)
		else:
			var o: Dictionary = want[id]
			if String(o.place) != n.place or String(o.activity) != n.activity:
				n.place = String(o.place)
				n.activity = String(o.activity)
				n.leaving = false
				n.goal = People.spot(n.place, id, _walk_x)
	for id in want:
		if not npcs.has(id):
			_spawn(want[id])

func _spawn(o: Dictionary) -> void:
	var p: Dictionary = o.person
	var n := Npc.new()
	n.p = p
	n.place = String(o.place)
	n.activity = String(o.activity)
	n.goal = People.spot(n.place, String(p.id), _walk_x)
	n.mover = Player.new()
	add_child(n.mover)
	n.mover.bounds = _bounds
	n.mover.ground_at = _ground
	n.mover.obstacles = _boxes
	n.mover.cam_yaw = 0.0
	# first time out today they're already at work (the street shouldn't open on an empty avenue); later arrivals walk in
	var start := n.goal + Vector3(0, 0, 3.0)
	n.mover.position = start
	n.mover.build(look_for(p))
	n.tag = Label3D.new()
	n.tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	n.tag.font_size = 32
	n.tag.pixel_size = 0.004
	n.tag.outline_size = 10
	n.tag.position = Vector3(0, 2.15, 0)
	n.tag.no_depth_test = false
	n.tag.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	n.mover.add_child(n.tag)
	npcs[String(p.id)] = n
	_retag(n)

## a person's look, the same every time: their body and build, their outfit, a catalog face picked from their id
func look_for(p: Dictionary) -> Dictionary:
	var body := String(p.body)
	var frame := { "slim": "nyx", "athletic": "cipher", "heavy": "goliath" }.get(String(p.build), "cipher") as String
	var look := CharacterStore.clean({ "frame": frame, "body": body, "name": String(p.name).left(18), "outfit": String(p.get("outfit", "")) })
	var faces: Array = Catalog.faces(body)
	if not faces.is_empty():
		look = CharacterStore.apply_face(look, String(faces[absi(hash(String(p.id))) % faces.size()].id))
	return look

## the name tag: name and job once you've met (a "?" until then), ✉ when they're your errand's recipient, ! when
## they have an errand for you today
func _retag(n: Npc) -> void:
	var id := String(n.p.id)
	var met := bool(Memory.person(state, id).met)
	var e: Dictionary = state.errand
	var mark := ""
	if not e.is_empty() and String(e.to) == id:
		mark = "  ✉"
	elif met and not Memory.errand_offer(state, id, today(), present_ids()).is_empty():
		mark = "  !"
	n.tag.text = (String(n.p.name) + mark + "\n" + String(n.p.job)) if met else ("?" + mark)
	var a := Memory.affinity(state, id)
	n.tag.modulate = Color(1.0, 0.55, 0.5) if a < 0 else (Color(0.6, 1.0, 0.75) if a >= 30 else Color(0.95, 0.95, 1.0))

func present_ids() -> Array:
	var out: Array = []
	for id in npcs:
		if not (npcs[id] as Npc).leaving:
			out.append(id)
	return out

# --------------------------------------------------------------------------------------------- the frame
func step(dt: float) -> void:
	_resched -= dt
	if _resched <= 0.0:
		_resched = RESCHEDULE_S
		_schedule()
	_scare_cool = maxf(0.0, _scare_cool - dt)
	var gone: Array = []
	for id in npcs:
		var n: Npc = npcs[id]
		_step_one(n, dt)
		if n.leaving and Vector2(n.mover.position.x - n.goal.x, n.mover.position.z - n.goal.z).length() < 2.0:
			gone.append(id)
		if operator:
			n.tag.visible = n.mover.position.distance_to(operator.position) < TAG_R
	for id in gone:
		(npcs[id] as Npc).mover.queue_free()
		npcs.erase(id)
	_police(dt)

func _step_one(n: Npc, dt: float) -> void:
	var m: Node3D = n.mover
	n.scare = maxf(0.0, n.scare - dt)
	if busy and _panel and _panel.get_meta("npc", "") == String(n.p.id):
		_face(m, operator.position)
		m.step(dt, Vector2.ZERO, Vector2.ZERO, false, false)
		return
	# where to: a route stop, a beat end, or their place
	if not n.leaving and n.scare <= 0.0:
		match n.activity:
			"patrol":
				var beat: Array = n.p.get("beat", [-80.0, 80.0])
				var side := -1.0 if hash(String(n.p.id)) % 2 == 0 else 1.0
				n.goal = Vector3(side * (_walk_x - 1.0), 0, float(beat[n.leg % 2]))
			"route":
				var stops: Array = n.p.get("route", [n.place])
				n.goal = People.spot(String(stops[n.leg % stops.size()]), String(n.p.id), _walk_x)
	var to := Vector2(n.goal.x - m.position.x, n.goal.z - m.position.z)
	if n.scare > 0.0:
		to = Vector2(m.position.x - operator.position.x, m.position.z - operator.position.z).normalized() * 10.0
	var walking := to.length() > 0.6
	if not walking and not n.leaving:
		if n.activity in ["patrol", "route"]:
			n.wait += dt
			if n.wait > (2.0 if n.activity == "patrol" else 4.0):
				n.wait = 0.0
				n.leg += 1
		else:
			# at work: face the avenue (or whoever's talking to them)
			if operator and operator.position.distance_to(m.position) < 4.0:
				_face(m, operator.position)
			else:
				m.heading = lerp_angle(m.heading, atan2(-signf(m.position.x), 0.0), minf(1.0, 4.0 * dt))
	var mag := 0.0
	if walking:
		mag = (1.0 if n.scare > 0.0 else 0.38) if n.activity != "route" else 0.5
		if to.length() < 2.0:
			mag *= 0.6
	var stick := Vector2(to.x, -to.y).normalized() * mag if walking else Vector2.ZERO
	m.step(dt, stick, Vector2.ZERO, false, false)
	m.visible = m.position.z >= _span.x - 2.0 and m.position.z <= _span.y + 2.0

func _face(m: Node3D, at: Vector3) -> void:
	m.heading = lerp_angle(m.heading, atan2(at.x - m.position.x, at.z - m.position.z), 0.25)

## the nearest named person within talking range of `pos`, or ""
func near(pos: Vector3) -> String:
	var best := ""
	var bd := TALK_R
	for id in npcs:
		var n: Npc = npcs[id]
		if n.leaving or not n.mover.visible:
			continue
		var d := Vector2(n.mover.position.x - pos.x, n.mover.position.z - pos.z).length()
		if d < bd:
			bd = d
			best = id
	return best

func label_for(id: String) -> String:
	var met := bool(Memory.person(state, id).met)
	return "TALK · " + (String(People.by_id(id).name).to_upper() if met else String(People.by_id(id).job).to_upper())

## shots on the avenue: named people within earshot are frightened (and like you less), and notoriety builds
func gunfire(at: Vector3) -> void:
	if _scare_cool > 0.0:
		return
	_scare_cool = 1.5
	var heard: Array = []
	for id in npcs:
		var n: Npc = npcs[id]
		if n.mover.position.distance_to(at) < 18.0:
			heard.append(id)
			if not People.is_police(n.p):
				n.scare = 4.0
	Memory.gunfire(state, heard, now())
	Memory.save_state(state)
	for id in heard:
		_retag(npcs[id])

## an officer on shift who sees high notoriety walks over; within reach they say their piece
func _police(dt: float) -> void:
	if busy or not operator:
		return
	if Memory.notoriety(state, now()) < Memory.NOTORIETY_COP:
		_cop_coming = ""
		return
	if _cop_coming == "" or not npcs.has(_cop_coming):
		_cop_coming = ""
		var best := 40.0
		for id in npcs:
			var n: Npc = npcs[id]
			if People.is_police(n.p) and not n.leaving and n.mover.position.distance_to(operator.position) < best:
				best = n.mover.position.distance_to(operator.position)
				_cop_coming = id
		if _cop_coming != "" and controls:
			controls.toast("%s is heading your way" % String(People.by_id(_cop_coming).name))
	if _cop_coming == "":
		return
	var cop: Npc = npcs[_cop_coming]
	cop.goal = operator.position + (cop.mover.position - operator.position).normalized() * 1.4
	cop.activity = "work"
	if cop.mover.position.distance_to(operator.position) < 2.2:
		var verdict := Memory.police_verdict(state, _cop_coming, now())
		var profile := Gear.profile_load()
		var paid := 0
		if verdict == "fine":
			paid = Memory.pay_fine(profile)
			Gear.profile_save(profile)
		Memory.save_state(state)
		var who := _cop_coming
		_cop_coming = ""
		cop.activity = "patrol"
		_open(who, Talk.police_line(verdict) + ("  (−%d Nex)" % paid if paid > 0 else ""), true)

# --------------------------------------------------------------------------------------------- conversations
## TALK: the greeting (or an introduction), what they remember, and what you can say back
func talk(id: String) -> void:
	if not npcs.has(id):
		return
	var n: Npc = npcs[id]
	var kind := Memory.talk(state, id, today())
	var me := String(CharacterStore.load_look().get("name", "")).strip_edges()
	if me == "":
		me = "Operator"
	var lines: Array[String] = [Talk.greeting(n.p, state, hour(), me)]
	if kind == "met":
		lines.append(Talk.intro(n.p, n.place))
	else:
		var r := Talk.remember(n.p, state)
		if r != "":
			lines.append(r)
	Memory.save_state(state)
	_retag(n)
	_open(id, " ".join(lines), false)

func _open(id: String, text: String, law: bool) -> void:
	_close()
	busy = true
	if controls:
		controls.visible = false
	var p: Dictionary = People.by_id(id)
	_panel = PanelContainer.new()
	_panel.set_meta("npc", id)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.04, 0.07, 0.92)
	sb.border_color = Color(0.4, 0.75, 1.0, 0.6) if not law else Color(0.4, 0.5, 1.0, 0.9)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(16)
	_panel.add_theme_stylebox_override("panel", sb)
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_panel.offset_left = -330
	_panel.offset_right = 330
	_panel.offset_top = -24
	_panel.offset_bottom = -24
	_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN   # as tall as what's said, standing on the bottom edge
	ui.add_child(_panel)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	_panel.add_child(box)
	var head := Label.new()
	var a := Memory.affinity(state, id)
	head.text = "%s · %s   [%s %d]" % [String(p.name), String(p.job), Memory.band(a).to_upper(), a]
	head.add_theme_font_size_override("font_size", 18)
	head.modulate = Color(0.65, 0.85, 1.0)
	box.add_child(head)
	var say := Label.new()
	say.name = "Say"
	say.text = "“%s”" % text
	say.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	say.custom_minimum_size = Vector2(620, 0)
	say.add_theme_font_size_override("font_size", 17)
	box.add_child(say)
	var row := HFlowContainer.new()
	row.add_theme_constant_override("h_separation", 8)
	row.add_theme_constant_override("v_separation", 8)
	box.add_child(row)
	if not law:
		_button(row, "How's work?", func(): _say(Talk.work_line(p, today())))
		_button(row, "Heard anything?", func(): _say(Talk.rumour(p, today())))
		var e: Dictionary = state.errand
		if not e.is_empty() and String(e.to) == id:
			_button(row, "Here — %s, from %s" % [String(e.item), String(People.by_id(String(e.from)).name).get_slice(" ", 0)], func(): _deliver(id))
		elif e.is_empty():
			_button(row, "Need a hand?", func(): _ask_errand(id))
		elif String(e.from) == id:
			_button(row, "About that errand…", func(): _say("%s is waiting on %s. Thanks for doing this." % [String(People.by_id(String(e.to)).name).get_slice(" ", 0), String(e.item)]))
	_button(row, "Bye" if not law else "Understood", _close)

func _button(row: Control, text: String, f: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 44)
	b.pressed.connect(f)
	row.add_child(b)

func _say(text: String) -> void:
	if _panel:
		(_panel.find_child("Say", true, false) as Label).text = "“%s”" % text

func _ask_errand(id: String) -> void:
	var offer := Memory.errand_offer(state, id, today(), present_ids())
	if offer.is_empty():
		_say("I'm fine today, thanks." if Memory.affinity(state, id) >= 0 else "From you? No.")
		return
	Memory.take_errand(state, offer)
	Memory.save_state(state)
	var to: Dictionary = People.by_id(String(offer.to))
	_say("Could you take %s to %s? Should be over by %s. I'll make it worth your while — %d Nex." % [String(offer.item), String(to.name), String(People.PLACES.get(String((npcs[String(offer.to)] as Npc).place) if npcs.has(String(offer.to)) else "plaza", {}).get("label", "the avenue")), int(offer.reward)])
	for n in npcs.values():
		_retag(n)
	_refresh_buttons(id)

func _deliver(id: String) -> void:
	var profile := Gear.profile_load()
	var e := Memory.deliver(state, id, profile)
	if e.is_empty():
		return
	Gear.profile_save(profile)
	Memory.save_state(state)
	_say("Oh, brilliant — %s! Tell %s thanks. (+%d Nex)" % [String(e.item), String(People.by_id(String(e.from)).name).get_slice(" ", 0), int(e.reward)])
	if controls:
		controls.toast("Errand done · +%d Nex" % int(e.reward))
	for n in npcs.values():
		_retag(n)
	_refresh_buttons(id)

## rebuild the reply buttons after an errand changes hands (keep the line on screen)
func _refresh_buttons(id: String) -> void:
	var said := (_panel.find_child("Say", true, false) as Label).text
	_open(id, said.trim_prefix("“").trim_suffix("”"), false)

func _close() -> void:
	if _panel:
		_panel.queue_free()
		_panel = null
	busy = false
	if controls:
		controls.visible = true
