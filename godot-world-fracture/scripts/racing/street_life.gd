extends Node
## Street racing life on the open street (owner, Nov 11: "racing like GTA and Need for Speed had a baby"). Lives on a
## street slice (street_slice.gd) and runs:
##   meets — a neon ring and a light beam on the avenue for each of the city's races (street_career.gd EVENTS); drive into
##     one and ENTER starts it, if your reputation is high enough (locked meets say what they need)
##   challenges — cruising, now and then a street racer pulls a challenge: ENTER within a few seconds and it's a sprint
##   the race — the line (street_route.gd) from where you are, the rivals on the grid ahead of you, a countdown, neon gates
##     every 300 m, positions, the finish; drift battles score your slides against the crew's marks instead. Legal races
##     close the road (the traffic pulls off); the ends of a loop are cleared of parked cars for the turnaround
##   the police — an illegal race starts the heat (street_career.gd Heat): units come up behind with lights and siren,
##     more as the heat climbs, roadblocks from heat 3 (a gap at one side, the sidewalk if you dare); out of their sight
##     long enough — faster in a Nexus court or an alley — and you've escaped; held stopped with a unit alongside and
##     you're busted: a fine and lost reputation, and the race is gone. Legal races never draw them.
## Reputation and wins save to street_career.json, prize Nex to the profile.

const Career := preload("res://scripts/racing/street_career.gd")
const Route := preload("res://scripts/racing/street_route.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const StaticBatch := preload("res://scripts/static_batch.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Nexus := preload("res://scripts/city/nexus_districts.gd")
const FLEET := "res://models/fleet/"
const RIVAL_FILES := ["concept-gt.glb", "street-racer-lod.glb", "muscle-car-lod.glb"]
const POLICE_FILE := "security-suv.glb"
const PARKED := AABB(Vector3(0, -1000, 0), Vector3(0.1, 0.1, 0.1))
const MEET_R := 7.0
const GATE_EVERY := 300.0
const SEEN_M := 120.0
const BUST_M := 7.0
const CHALLENGE_EVERY := 45.0
const CHALLENGERS := ["Vex", "Kilo", "Sable", "Juno", "Rook"]
const ORDINAL := ["1ST", "2ND", "3RD", "4TH", "5TH"]
## the rivals' cars: quick, but a tuned build of yours beats them; skill scales the pace
const RIVAL_PERF := { "max_speed": 36.0, "acceleration": 11.0, "steering": 1.15, "braking": 16.0 }

var slice: Control
var career: RefCounted
var heat := Career.Heat.new()
var markers: Array = []          # [{id, root, pos, mat, label}]
## what ENTER does here: an event id, "challenge", or ""
var offer := ""
var _challenge := {}
var _challenge_t := 0.0
var _offer_left := 0.0
var _rng := RandomNumberGenerator.new()

# the race
var ev := {}
var ev_id := ""
var route: RefCounted
var state := ""                  # "", "countdown", "racing", "done"
var countdown := 0.0
var time := 0.0
var along := 0.0
var rivals: Array = []           # [{sc, name, along, skill, finished_at, stuck, offset, box}]
var finishers: Array = []
var finished_at := -1.0
var place := 0
var gates: Array = []
var gate_i := 0
var _gate_nodes: Array = []
var _grid_t := Transform3D()
var drift_score := 0.0
var _chain := 0.0
var _chain_pts := 0.0
var _drift_idle := 0.0
var _hits_seen := 0
var _done_t := 0.0
var _cleared: Array = []         # [[box index, its box]] parked-car boxes moved off a turnaround
var _hidden: Array = []          # parked car nodes hidden off it
var _zones: Array = []           # [Vector2(z, half length)] kept clear of parked cars
var _clear_t := 0.0

# the police
var units: Array = []            # [{sc, box, bars, stuck}]
var _block := {}                 # {nodes, box, z}
var _block_t := 0.0
var _flash := 0.0
var _free: Array[int] = []

## shots: your car drives the line itself
var autopilot := false

# the read-outs
var hud: Label
var heat_row: HBoxContainer
var _heat_cells: Array = []
var _heat_label: Label
var result: Label
var _result_t := 0.0

func setup(s: Control) -> void:
	slice = s
	_rng.seed = 23
	career = Career.load_or_fresh()
	_markers()
	_ui()

func _exit_tree() -> void:
	Sound.loop_stop("siren")

func busy() -> bool:
	return state == "countdown" or state == "racing"

# --------------------------------------------------------------------------------------------- the meets
static func route_for(e: Dictionary) -> RefCounted:
	if String(e.kind) == "sprint":
		return Route.sprint(float(e.z0), float(e.z1))
	return Route.loop(float(e.z_hi), float(e.z_lo), int(e.get("laps", 1)), float(e.at))

func _glow(c: Color, alpha := 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

func _markers() -> void:
	for id in Career.events_for(String(slice.style)):
		var e := Career.event(id)
		var root := Node3D.new()
		root.position = Vector3(0, 0.04, float(e.at))
		slice.world.add_child(root)
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = MEET_R - 0.4
		tm.outer_radius = MEET_R
		tm.rings = 48
		tm.ring_segments = 4
		ring.mesh = tm
		ring.scale = Vector3(1, 0.1, 1)
		var mat := _glow(Color.WHITE)
		ring.material_override = mat
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(ring)
		var beam := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.5
		cm.bottom_radius = 0.9
		cm.height = 28.0
		cm.radial_segments = 10
		cm.rings = 1
		beam.mesh = cm
		beam.position.y = 14.0
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(beam)
		var label := Label3D.new()
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.position.y = 4.2
		label.font_size = 56
		label.outline_size = 12
		label.pixel_size = 0.012
		label.no_depth_test = false
		root.add_child(label)
		markers.append({ "id": id, "root": root, "pos": root.position, "mat": mat, "beam": beam, "label": label, "length": route_for(e).race_length() })
	refresh_markers()

## the meets' colours and words follow the ladder: pink underground, cyan sanctioned, grey until you've the reputation
func refresh_markers() -> void:
	for mk in markers:
		var e := Career.event(String(mk.id))
		var open: bool = career.unlocked(String(mk.id))
		var c := (Color(1.0, 0.2, 0.62) if not bool(e.legal) else Color(0.2, 0.85, 1.0)) if open else Color(0.45, 0.47, 0.5)
		(mk.mat as StandardMaterial3D).albedo_color = c
		(mk.beam as MeshInstance3D).material_override = _glow(c, 0.22)
		var what := ""
		match String(e.kind):
			"sprint": what = "%.1f km sprint" % (float(mk.length) / 1000.0)
			"drift": what = "drift battle · %d laps" % int(e.laps)
			_: what = "%d lap%s · %.1f km" % [int(e.laps), "" if int(e.laps) == 1 else "s", float(mk.length) / 1000.0]
		var lbl: Label3D = mk.label
		lbl.text = "%s\n%s · %s%s" % [String(e.name).to_upper(), "UNDERGROUND" if not bool(e.legal) else "SANCTIONED", what,
			"" if open else "\nNEEDS " + String(Career.TIERS[int(e.tier)].name)]
		lbl.modulate = c.lightened(0.35)
		(mk.root as Node3D).visible = state == ""

func _offer_text() -> String:
	if offer == "":
		return ""
	if offer == "challenge":
		return "%s WANTS TO RACE · ENTER" % String(_challenge.rivals[0]).to_upper()
	var e := Career.event(offer)
	if career.unlocked(offer):
		return "RACE %s · ENTER" % String(e.name).to_upper()
	return "%s NEEDS %s · you're %s" % [String(e.name).to_upper(), String(Career.TIERS[int(e.tier)].name), career.ladder_line()]

func _step_offers(dt: float, car: RefCounted) -> void:
	var want := ""
	if car and not heat.active():
		var p: Vector3 = car.node.position
		for mk in markers:
			if Vector2(p.x - (mk.pos as Vector3).x, p.z - (mk.pos as Vector3).z).length() < MEET_R:
				want = String(mk.id)
		if want == "":
			if _offer_left > 0.0:
				_offer_left -= dt
				want = "challenge" if _offer_left > 0.0 else ""
			elif absf(car.speed) > 10.0:
				_challenge_t += dt
				if _challenge_t >= CHALLENGE_EVERY:
					_challenge_t = 0.0
					make_challenge(car)
					if not _challenge.is_empty():
						_offer_left = 8.0
						want = "challenge"
						Sound.sfx("click", -4.0)
	if want != offer:
		offer = want
		slice.controls.prompt(_offer_text())

## a racer cruising alongside calls you out: a sprint from here, the way you're going, ~700 m
func make_challenge(car: RefCounted) -> void:
	var span: Vector2 = slice.district.span() if slice.district else Vector2(-900, 900)
	var z0: float = car.node.position.z
	var dz := signf(car.forward().z)
	if dz == 0.0:
		dz = -1.0
	var z1 := clampf(z0 + dz * 700.0, span.x + 40.0, span.y - 40.0)
	if absf(z1 - z0) < 300.0:
		z1 = clampf(z0 - dz * 700.0, span.x + 40.0, span.y - 40.0)
	if absf(z1 - z0) < 300.0:
		_challenge = {}
		return
	var who: String = CHALLENGERS[_rng.randi() % CHALLENGERS.size()]
	_challenge = { "name": "%s's Challenge" % who, "city": String(slice.style), "at": z0, "tier": 0, "legal": false, "heat": 1,
		"kind": "sprint", "z0": z0, "z1": z1, "rivals": [who], "skill": 0.82 + 0.03 * career.tier(),
		"prize": [500 + 150 * career.tier(), 120], "rep": [90, 30] }

## a road car: no tanks, no hover-cars on the street circuits
func ok_car(car: RefCounted) -> bool:
	return car != null and not bool(car.profile.get("pivot", false)) and not bool(car.profile.get("hover", false))

## ENTER at a meet (or on a challenge): starts it, or says what it needs. True when the press was used.
func take_offer() -> bool:
	if offer == "" or busy():
		return false
	if offer == "challenge":
		if not ok_car(slice.driving_car):
			return false
		var c := _challenge
		_challenge = {}
		_offer_left = 0.0
		begin("", c)
		return true
	if not ok_car(slice.driving_car):
		slice.controls.toast("Street races are for road cars — bring one from the kerb or the garage")
		Sound.sfx("buzzer", -8.0)
		return true
	if not career.unlocked(offer):
		slice.controls.toast(_offer_text())
		Sound.sfx("buzzer", -8.0)
		return true
	begin(offer)
	return true

# --------------------------------------------------------------------------------------------- the race
func begin(id: String, custom := {}) -> void:
	var car: RefCounted = slice.driving_car
	if car == null:
		return
	ev_id = id
	ev = custom if not custom.is_empty() else Career.event(id)
	route = route_for(ev)
	state = "countdown"
	countdown = 3.5
	time = 0.0
	finishers = []
	finished_at = -1.0
	place = 0
	drift_score = 0.0
	_chain = 0.0
	_chain_pts = 0.0
	_hits_seen = car.hits
	offer = ""
	slice.controls.prompt("")
	var names: Array = [] if String(ev.kind) == "drift" else ev.rivals
	for i in names.size():
		rivals.append(_spawn_rival(i, String(names[i])))
	_grid_t = route.grid(names.size())
	_place(car, _grid_t)
	along = Route.START - 8.0
	gates = []
	var d := Route.START + GATE_EVERY
	while d < route.length - 60.0:
		gates.append(d)
		d += GATE_EVERY
	gates.append(route.length - 1.0)
	gate_i = 0
	_build_gates()
	_zones = []
	for z in route.ends:
		_zones.append(Vector2(float(z), 26.0))
	_clear_t = 0.0
	if bool(ev.legal) and slice.traffic:
		slice.traffic.closed = true
	elif slice.traffic:
		slice.traffic.clear_zone(_grid_t.origin.z, 70.0)
	refresh_markers()
	Sound.sfx("confirm", -4.0)
	slice.controls.toast("%s · %s" % [String(ev.name).to_upper(), "sanctioned, the road is closed" if bool(ev.legal) else "underground — watch for the police"])

func _place(sc: RefCounted, t: Transform3D) -> void:
	var f := -t.basis.z
	sc.node.position = t.origin
	sc.node.rotation.y = atan2(-f.x, -f.z)
	sc.speed = 0.0
	sc.travel = NAN

func _slot(b: AABB) -> int:
	var obs: Array[AABB] = slice.operator.obstacles
	if not _free.is_empty():
		var i: int = _free.pop_back()
		obs[i] = b
		return i
	obs.append(b)
	return obs.size() - 1

func _release(i: int) -> void:
	if i >= 0:
		slice.operator.obstacles[i] = PARKED
		_free.append(i)

func _car_node(file: String) -> Node3D:
	var node: Node3D
	if ResourceLoader.exists(FLEET + file):
		node = (load(FLEET + file) as PackedScene).instantiate() as Node3D
	else:
		node = Node3D.new()
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(1.9, 1.3, 4.2)
		mi.mesh = bm
		mi.position.y = 0.65
		node.add_child(mi)
	StreetCar.face_forward(node)
	StaticBatch.compact(node)
	slice.world.add_child(node)
	return node

func _new_car(node: Node3D, perf: Dictionary) -> RefCounted:
	var sc := StreetCar.new(node, "", perf)
	sc.bounds = slice.operator.bounds
	sc.ground_at = slice.operator.ground_at
	sc.obstacles = slice.operator.obstacles
	sc.skip = _slot(sc.box())
	return sc

func _spawn_rival(i: int, name: String) -> Dictionary:
	var boss := name == String(ev.get("boss", ""))
	var node := _car_node(RIVAL_FILES[i % RIVAL_FILES.size()])
	var tag := Label3D.new()
	tag.text = name.to_upper()
	tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	tag.position.y = 2.6
	tag.font_size = 40
	tag.outline_size = 10
	tag.pixel_size = 0.01
	tag.modulate = Color(1.0, 0.85, 0.3) if boss else Color(1, 1, 1)
	node.add_child(tag)
	var sc := _new_car(node, RIVAL_PERF.duplicate())
	_place(sc, route.grid(i))
	var skill := float(ev.get("skill", 0.85)) * (1.04 if boss else 1.0) - 0.015 * i
	return { "sc": sc, "name": name, "along": Route.START - 8.0, "skill": skill, "finished_at": -1.0, "stuck": 0.0, "offset": 0.0 }

func _build_gates() -> void:
	for g in _gate_nodes:
		(g as Node3D).queue_free()
	_gate_nodes = []
	# the next gate, and the one after it dimmer; the finish is chequered gold
	for k in 2:
		var gi := gate_i + k
		if gi >= gates.size():
			break
		var d: float = gates[gi]
		var last := gi == gates.size() - 1
		var c := Color(1.0, 0.8, 0.25) if last else (Color(1.0, 0.25, 0.65) if not bool(ev.legal) else Color(0.25, 0.85, 1.0))
		var g := Node3D.new()
		var at: Vector3 = route.at(d)
		var f: Vector3 = route.dir_at(d)
		g.position = Vector3(at.x, 0, at.z)
		g.rotation.y = atan2(-f.x, -f.z)
		var mat := _glow(c, 1.0 if k == 0 else 0.35)
		for sx: float in [-1.0, 1.0]:
			var post := MeshInstance3D.new()
			var pm := BoxMesh.new()
			pm.size = Vector3(0.35, 5.0, 0.35)
			post.mesh = pm
			post.material_override = mat
			post.position = Vector3(sx * 5.5, 2.5, 0)
			post.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			g.add_child(post)
		var bar := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(11.4, 0.45, 0.3)
		bar.mesh = bm
		bar.material_override = mat
		bar.position.y = 5.0
		bar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(bar)
		if last and k == 0:
			var t := Label3D.new()
			t.text = "FINISH"
			t.font_size = 72
			t.outline_size = 14
			t.pixel_size = 0.012
			t.position = Vector3(0, 6.0, 0)
			t.modulate = c
			g.add_child(t)
		slice.world.add_child(g)
		_gate_nodes.append(g)

func _step_race(dt: float, car: RefCounted) -> void:
	if state == "done":
		_done_t -= dt
		_drive_rivals(dt)
		if _done_t <= 0.0:
			_end_race()
		return
	if car == null:
		abandon("You left the car — race forfeited")
		return
	if state == "countdown":
		countdown -= dt
		_place(car, _grid_t)
		if countdown <= 0.0:
			state = "racing"
			Sound.sfx("confirm", -2.0)
			if not bool(ev.legal):
				heat.start(int(ev.get("heat", 1)))
				_block_t = 25.0
		return
	time += dt
	var n: Array = route.nearest_from(car.node.position, along)
	if float(n[1]) < 14.0:
		along = maxf(along, float(n[0]))
	var moved := false
	while gate_i < gates.size() and along >= float(gates[gate_i]):
		gate_i += 1
		moved = true
	if moved:
		Sound.sfx("click", -6.0)
		_build_gates()
	if String(ev.kind) == "drift":
		_drift(dt, car)
	_drive_rivals(dt)
	if finished_at < 0.0 and gate_i >= gates.size():
		finished_at = time
		finishers.append("You")
		_finish()

## where you are in the running order now
func position_now() -> int:
	var p := 1
	for r in rivals:
		if float(r.finished_at) >= 0.0 or (finished_at < 0.0 and float(r.along) > along):
			p += 1
	return p if finished_at < 0.0 else place

## the rivals drive through each other (a pile-up of the crew on the grid ended races): each steps with the others'
## boxes out of the list; you, the traffic and the police still collide with them
func _drive_rivals(dt: float) -> void:
	var obs: Array[AABB] = slice.operator.obstacles
	for r in rivals:
		obs[int(r.sc.skip)] = PARKED
	for r in rivals:
		_drive_rival(r, dt)
		obs[int(r.sc.skip)] = PARKED
	for r in rivals:
		obs[int(r.sc.skip)] = r.sc.box()

func _drive_rival(r: Dictionary, dt: float) -> void:
	var sc: RefCounted = r.sc
	var p: Vector3 = sc.node.position
	var n: Array = route.nearest_from(p, float(r.along))
	if float(n[1]) < 14.0:
		r.along = maxf(float(r.along), float(n[0]))
	if float(r.finished_at) < 0.0 and float(r.along) >= route.length - 1.0 and state == "racing":
		r.finished_at = time
		finishers.append(String(r.name))
	if state == "countdown":
		return
	var thr := 0.0
	var steer := 0.0
	var brake := 0.0
	if float(r.finished_at) >= 0.0 or state == "done":
		brake = 0.6
	else:
		# rubber band: a rival far ahead eases, one far behind pushes
		var band := clampf(1.0 - (float(r.along) - along) / 1500.0, 0.9, 1.08)
		r.offset = move_toward(float(r.offset), _lane_offset(r), 6.0 * dt)
		var look := 10.0 + absf(sc.speed) * 0.45
		var aim: Vector3 = route.at(float(r.along) + look) + route.side_at(float(r.along) + look) * float(r.offset)
		var to := aim - p
		var err := wrapf(atan2(-to.x, -to.z) - sc.node.rotation.y, -PI, PI)
		steer = clampf(err * 2.5, -1.0, 1.0)
		var curve := maxf(route.curvature(float(r.along) + 4.0, float(r.along) + 24.0), route.curvature(float(r.along) + 18.0, float(r.along) + 44.0))
		var top: float = float(sc.profile.max_speed) * float(r.skill) * band * (1.0 - 0.75 * curve)
		thr = clampf((top - sc.speed) / 4.0, -1.0, 1.0)
		brake = 1.0 if sc.speed > top + 3.0 else 0.0
	sc.step(dt, thr, steer, brake)
	if float(r.finished_at) < 0.0 and state == "racing":
		r.stuck = (float(r.stuck) + dt) if absf(sc.speed) < 1.0 else 0.0
		if float(r.stuck) > 2.5:
			# a rival wedged on a kerb or a car is put back on the line a little further on
			var d := float(r.along) + 14.0
			var f: Vector3 = route.dir_at(d)
			_place(sc, Transform3D(Basis.looking_at(f, Vector3.UP), route.at(d)))
			r.stuck = 0.0

## a traffic car in a rival's way: it goes round on the side towards the middle of the road (the kerbs have parked cars)
func _lane_offset(r: Dictionary) -> float:
	var sc: RefCounted = r.sc
	var f: Vector3 = route.dir_at(float(r.along))
	var s := Vector3(-f.z, 0, f.x)
	var line: Vector3 = route.at(float(r.along))
	var others: Array = []
	if slice.traffic and not slice.traffic.closed:
		for c in slice.traffic.cars:
			others.append(c.sc.node.position)
	for u in units:
		others.append(u.sc.node.position)
	for o: Vector3 in others:
		var q: Vector3 = o - sc.node.position
		var fwd := q.dot(f)
		if fwd > 2.0 and fwd < 28.0 and absf(q.dot(s) - float(r.offset)) < 1.9:
			var dir := -signf(line.x) * signf(s.x) if absf(line.x) > 0.5 and absf(s.x) > 0.3 else -signf(q.dot(s))
			return 2.0 * (dir if dir != 0.0 else 1.0)
	return 0.0

## the turnarounds (and a roadblock's gap) are kept clear of parked cars while a race runs: their boxes leave the
## obstacle list and the cars hide; the streamed blocks re-make their boxes, so it's checked twice a second
func _keep_clear(dt: float) -> void:
	_clear_t -= dt
	if _clear_t > 0.0 or _zones.is_empty():
		return
	_clear_t = 0.5
	var mine := {}
	for r in rivals:
		mine[int(r.sc.skip)] = true
	for u in units:
		mine[int(u.sc.skip)] = true
	if slice.traffic:
		for c in slice.traffic.cars:
			mine[int(c.box_index)] = true
	var obs: Array[AABB] = slice.operator.obstacles
	for i in obs.size():
		if mine.has(i):
			continue
		var b: AABB = obs[i]
		var cx := b.get_center().x
		var cz := b.get_center().z
		if b.size.y > 3.0 or b.size.x > 6.0 or b.size.z > 6.0 or absf(cx) < 4.0 or absf(cx) > 8.8:
			continue
		for zn: Vector2 in _zones:
			if absf(cz - zn.x) < zn.y:
				_cleared.append([i, b])
				obs[i] = PARKED
				break
	for c in slice.parked:
		if is_instance_valid(c) and c.visible:
			for zn: Vector2 in _zones:
				if absf(c.global_position.z - zn.x) < zn.y and absf(c.global_position.x) < 9.0:
					c.visible = false
					_hidden.append(c)
					break

func _restore_clear() -> void:
	var obs: Array[AABB] = slice.operator.obstacles
	for pair in _cleared:
		if int(pair[0]) < obs.size() and obs[int(pair[0])] == PARKED:
			obs[int(pair[0])] = pair[1]
	_cleared = []
	for c in _hidden:
		if is_instance_valid(c):
			c.visible = true
	_hidden = []
	_zones = []

## drift battles: points for every slide (angle × speed), a growing multiplier while the chain holds, banked a second
## after it ends; a hit loses the chain
func _drift(dt: float, car: RefCounted) -> void:
	if car.hits > _hits_seen:
		_hits_seen = car.hits
		if _chain_pts > 0.0:
			slice.controls.toast("CHAIN LOST")
		_chain_pts = 0.0
		_chain = 0.0
	var slip: float = car.slip_angle()
	var v := absf(float(car.speed))
	if slip > 0.2 and v > 7.0:
		_chain += dt
		_drift_idle = 0.0
		_chain_pts += rad_to_deg(slip) * v * dt * 0.6 * multiplier()
	else:
		_drift_idle += dt
		if _drift_idle > 1.0 and _chain_pts > 0.0:
			drift_score += _chain_pts
			_chain_pts = 0.0
			_chain = 0.0

func multiplier() -> float:
	return 1.0 + minf(_chain / 2.0, 4.0)

func _finish() -> void:
	if String(ev.kind) == "drift":
		drift_score += _chain_pts
		_chain_pts = 0.0
		place = 1
		for t in ev.targets:
			if float(t) > drift_score:
				place += 1
	else:
		place = finishers.find("You") + 1
	var got: Dictionary = career.finish(ev_id, place, ev if ev_id == "" else {})
	career.save()
	var pr := Gear.profile_load()
	Progression.grant(pr, "street_race", int(got.nex), 120, String(ev.name))
	Gear.profile_save(pr)
	if slice.get("wallet") is Dictionary and not (slice.wallet as Dictionary).is_empty():
		slice.wallet = pr
	var line := "%s · %s" % [ORDINAL[mini(place - 1, ORDINAL.size() - 1)], String(ev.name).to_upper()]
	if String(ev.kind) == "drift":
		line += "\n%d drift points" % int(drift_score)
	line += "\n+%d Nex · +%d REP" % [int(got.nex), int(got.rep)]
	if String(got.tier_up) != "":
		line += "\nYOU'RE NOW %s — %s" % [String(got.tier_up), String(Career.TIERS[career.tier()].line).to_lower()]
	show_result(line, Color(1.0, 0.85, 0.3) if place == 1 else Color(1, 1, 1))
	Sound.sfx("capture" if place == 1 else "confirm", -2.0)
	state = "done"
	_done_t = 4.0
	refresh_markers()

## the race is off (left the car, busted): no prize
func abandon(why: String) -> void:
	if state == "":
		return
	if why != "":
		show_result(why, Color(1.0, 0.55, 0.4))
	_end_race()

func _end_race() -> void:
	for r in rivals:
		_release(int(r.sc.skip))
		(r.sc.node as Node3D).queue_free()
	rivals = []
	for g in _gate_nodes:
		(g as Node3D).queue_free()
	_gate_nodes = []
	_restore_clear()
	if slice.traffic:
		slice.traffic.closed = false
	state = ""
	ev = {}
	ev_id = ""
	refresh_markers()

## the slice calls this when the operator gets out
func on_exit() -> void:
	if busy():
		abandon("You left the car — race forfeited")

# --------------------------------------------------------------------------------------------- the police
func _hiding(p: Vector3) -> bool:
	if String(slice.style) == "nexus":
		var a := Nexus.area_at(p)
		return a != "" and a != "NEXUS AVENUE" and a != "CENTRAL TRANSIT PLAZA"
	return absf(p.x) > 16.0

func _span() -> Vector2:
	return slice.district.span() if slice.district else Vector2(-900, 900)

func spawn_unit(target: Vector3, dir_z: float, ahead := false) -> Dictionary:
	var span := _span()
	var dz := (dir_z if ahead else -dir_z)
	if dz == 0.0:
		dz = 1.0 if _rng.randf() < 0.5 else -1.0
	var z := target.z + dz * (150.0 if ahead else 90.0)
	if z < span.x + 20.0 or z > span.y - 20.0:
		dz = -dz
		z = clampf(target.z + dz * 90.0, span.x + 20.0, span.y - 20.0)
	var node := _car_node(POLICE_FILE)
	var bars: Array = []
	for k in 2:
		var bar := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.55, 0.16, 0.3)
		bar.mesh = bm
		bar.position = Vector3(-0.32 + 0.64 * k, 2.05, 0.2)
		bar.material_override = _glow(Color(1.0, 0.1, 0.1) if k == 0 else Color(0.15, 0.35, 1.0))
		bar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		node.add_child(bar)
		bars.append(bar)
	var lvl := maxi(1, heat.level)
	var sc := _new_car(node, { "max_speed": 27.0 + 2.5 * lvl, "acceleration": 9.0 + lvl, "steering": 1.25, "braking": 18.0 })
	var at := Vector3(3.0 * (-1.0 if _rng.randf() < 0.5 else 1.0), 0, z)
	var f := Vector3(0, 0, signf(target.z - z))
	_place(sc, Transform3D(Basis.looking_at(f, Vector3.UP), at))
	var u := { "sc": sc, "bars": bars, "stuck": 0.0 }
	units.append(u)
	return u

func _step_police(dt: float, car: RefCounted) -> void:
	if not heat.active():
		if not units.is_empty() or not _block.is_empty():
			_clear_units()
		return
	var target: Vector3 = car.node.position if car else slice.operator.position
	var tvel: Vector3 = car.forward() * float(car.speed) if car else Vector3.ZERO
	var dir_z := signf(tvel.z) if absf(tvel.z) > 1.0 else 0.0
	if dir_z == 0.0 and busy() and route:
		dir_z = signf(route.dir_at(along + 20.0).z)     # off the line: they come up from behind it
	if units.size() < clampi(heat.level, 1, 4):
		spawn_unit(target, dir_z, units.size() >= 2)
		if units.size() == 1:
			Sound.sfx("buzzer", -6.0)
	var seen := false
	var pinned := false
	var nearest := 1e9
	_flash += dt
	var on := int(_flash / 0.22) % 2 == 0
	for u in units:
		var sc: RefCounted = u.sc
		var p: Vector3 = sc.node.position
		var d := Vector2(p.x - target.x, p.z - target.z).length()
		nearest = minf(nearest, d)
		if d < SEEN_M:
			seen = true
		if d < BUST_M and (car == null or absf(float(car.speed)) < 2.5):
			pinned = true
		# aim where the car is going to be, ease off alongside a stopped car, three-point round when facing away
		var lead := target + tvel * clampf(d / 25.0, 0.0, 1.5)
		var to := lead - p
		var err := wrapf(atan2(-to.x, -to.z) - sc.node.rotation.y, -PI, PI)
		var thr := 1.0
		var steer := clampf(err * 2.2, -1.0, 1.0)
		if absf(err) > 1.9 and absf(sc.speed) < 7.0:
			thr = -0.7
			steer = -steer
		elif absf(err) > 1.0:
			thr = 0.45
		if d < 6.0 and (car == null or absf(float(car.speed)) < 3.0):
			thr = 0.0
		sc.step(dt, thr, steer, 1.0 if (d < 6.0 and absf(sc.speed) > 2.0) else 0.0)
		slice.operator.obstacles[sc.skip] = sc.box()
		u.stuck = (float(u.stuck) + dt) if (absf(sc.speed) < 1.0 and d > 20.0) else 0.0
		if float(u.stuck) > 3.0:
			u.stuck = 0.0
			var f := Vector3(0, 0, signf(target.z - p.z) if target.z != p.z else 1.0)
			_place(sc, Transform3D(Basis.looking_at(f, Vector3.UP), Vector3(clampf(p.x, -4.0, 4.0), 0, p.z)))
		for k in 2:
			(u.bars[k] as MeshInstance3D).visible = on == (k == 0)
	# the siren: louder the nearer the nearest unit
	if nearest < 220.0:
		Sound.loop("siren", "siren", -6.0 - nearest / 22.0, 1.0)
	else:
		Sound.loop_stop("siren")
	var what := heat.step(dt, seen, pinned, _hiding(target))
	match what:
		"up":
			slice.controls.toast("HEAT %d — more units joining" % heat.level)
		"escaped":
			var got: int = career.escaped(heat.last_level)
			career.save()
			show_result("ESCAPED\n+%d REP" % got, Color(0.4, 1.0, 0.6))
			Sound.sfx("confirm", -3.0)
			_clear_units()
			refresh_markers()
		"busted":
			_busted()
	if not heat.active():
		return
	# roadblocks from heat 3: across the avenue ahead, a gap at one side
	if heat.level >= 3 and car:
		_block_t -= dt
		if _block.is_empty() and _block_t <= 0.0 and dir_z != 0.0:
			roadblock(target.z + dir_z * 170.0)
			_block_t = 40.0
	if not _block.is_empty() and car and (target.z - float(_block.z)) * dir_z > 60.0:
		_clear_block()

func roadblock(z: float) -> void:
	var span := _span()
	if z < span.x + 30.0 or z > span.y - 30.0:
		return
	var left := _rng.randf() < 0.5
	var x0 := -3.0 if left else -8.6
	var x1 := 8.6 if left else 3.0
	var root := Node3D.new()
	root.position = Vector3(0, 0, z)
	slice.world.add_child(root)
	for cx: float in [x0 + 2.3, x1 - 2.3]:
		var suv: Node3D = (load(FLEET + POLICE_FILE) as PackedScene).instantiate() if ResourceLoader.exists(FLEET + POLICE_FILE) else Node3D.new()
		StaticBatch.compact(suv)
		suv.position = Vector3(cx, 0, 0)
		suv.rotation.y = PI * 0.5
		root.add_child(suv)
	var stripe := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(absf(x1 - x0) - 9.0, 1.0, 0.5)
	stripe.mesh = bm
	stripe.position = Vector3((x0 + x1) * 0.5, 0.5, 0)
	stripe.material_override = _glow(Color(1.0, 0.75, 0.1))
	root.add_child(stripe)
	_block = { "root": root, "z": z, "box": _slot(AABB(Vector3(x0, 0, z - 1.4), Vector3(x1 - x0, 1.6, 2.8))) }
	_zones.append(Vector2(z, 14.0))
	slice.controls.toast("ROADBLOCK AHEAD — find the gap")

func _clear_block() -> void:
	if _block.is_empty():
		return
	_release(int(_block.box))
	(_block.root as Node3D).queue_free()
	var keep: Array = []
	for zn: Vector2 in _zones:
		if zn.x != float(_block.z):
			keep.append(zn)
	_zones = keep
	_block = {}
	if _zones.is_empty():
		_restore_clear()

func _clear_units() -> void:
	for u in units:
		_release(int(u.sc.skip))
		(u.sc.node as Node3D).queue_free()
	units = []
	_clear_block()
	Sound.loop_stop("siren")

func _busted() -> void:
	var pr := Gear.profile_load()
	var b: Dictionary = career.busted(heat.last_level, int(pr.get("nex", 0)))
	pr.nex = int(pr.get("nex", 0)) - int(b.fine)
	Gear.profile_save(pr)
	career.save()
	_clear_units()
	if busy():
		_end_race()
	show_result("BUSTED\n−%d Nex fine · −%d REP" % [int(b.fine), int(b.rep)], Color(1.0, 0.35, 0.3))
	Sound.sfx("buzzer", -2.0)
	refresh_markers()

# --------------------------------------------------------------------------------------------- the read-outs
func _ui() -> void:
	hud = Label.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	hud.offset_left = -260
	hud.offset_right = 260
	hud.offset_top = 112
	hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud.add_theme_font_size_override("font_size", 20)
	hud.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.85))
	hud.add_theme_constant_override("shadow_offset_x", 1)
	hud.add_theme_constant_override("shadow_offset_y", 1)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	slice.add_child(hud)
	heat_row = HBoxContainer.new()
	heat_row.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	heat_row.offset_left = -110
	heat_row.offset_right = 110
	heat_row.offset_top = 92
	heat_row.alignment = BoxContainer.ALIGNMENT_CENTER
	heat_row.add_theme_constant_override("separation", 4)
	heat_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_heat_label = Label.new()
	_heat_label.add_theme_font_size_override("font_size", 15)
	_heat_label.add_theme_color_override("font_color", Color(1.0, 0.45, 0.4))
	heat_row.add_child(_heat_label)
	for i in 5:
		var cell := ColorRect.new()
		cell.custom_minimum_size = Vector2(16, 10)
		heat_row.add_child(cell)
		_heat_cells.append(cell)
	heat_row.visible = false
	slice.add_child(heat_row)
	result = Label.new()
	result.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	result.offset_left = -300
	result.offset_right = 300
	result.offset_top = -120
	result.offset_bottom = 0
	result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	result.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	result.add_theme_font_size_override("font_size", 28)
	result.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	result.add_theme_constant_override("shadow_offset_x", 2)
	result.add_theme_constant_override("shadow_offset_y", 2)
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	result.visible = false
	slice.add_child(result)

func show_result(text: String, c: Color) -> void:
	result.text = text
	result.modulate = c
	result.visible = true
	_result_t = 5.0

static func fmt(t: float) -> String:
	return "%d:%04.1f" % [int(t / 60.0), fmod(t, 60.0)]

func _update_hud(dt: float) -> void:
	if _result_t > 0.0:
		_result_t -= dt
		result.visible = _result_t > 0.0
	var lines: Array = []
	if state == "countdown":
		lines.append(String(ev.name).to_upper())
		lines.append(str(int(ceil(countdown - 0.5))) if countdown > 0.5 else "GO")
	elif state == "racing":
		if String(ev.kind) == "drift":
			lines.append("DRIFT %d   %s" % [int(drift_score), ("+%d ×%.1f" % [int(_chain_pts), multiplier()]) if _chain_pts > 0.0 else ""])
			lines.append("to beat: %d · %d · %d   GATE %d/%d" % [int(ev.targets[0]), int(ev.targets[1]), int(ev.targets[2]), gate_i, gates.size()])
		else:
			lines.append("P%d / %d   GATE %d / %d   %s" % [position_now(), rivals.size() + 1, gate_i, gates.size(), fmt(time)])
			lines.append("%.1f km to go" % (maxf(0.0, route.length - along) / 1000.0))
	hud.text = "\n".join(lines)
	heat_row.visible = heat.active()
	if heat.active():
		var evading := heat.unseen > 0.0
		_heat_label.text = ("EVADING %d%%" % int(heat.unseen / heat.cool_needed() * 100.0)) if evading else "HEAT"
		for i in 5:
			(_heat_cells[i] as ColorRect).color = (Color(1.0, 0.2, 0.2) if not evading else Color(1.0, 0.7, 0.2)) if i < heat.level else Color(1, 1, 1, 0.18)

func step(dt: float) -> void:
	var car: RefCounted = slice.driving_car
	if autopilot and car and route and state == "racing":
		var aim: Vector3 = route.at(along + 12.0 + absf(car.speed) * 0.45) - car.node.position
		var err := wrapf(atan2(-aim.x, -aim.z) - car.node.rotation.y, -PI, PI)
		var curve: float = route.curvature(along + 4.0, along + 30.0)
		slice.controls.move = Vector2(-clampf(err * 2.5, -1.0, 1.0), 1.0 if car.speed < float(car.profile.max_speed) * (1.0 - 0.75 * curve) else -0.3)
	_keep_clear(dt)
	if slice.traffic:
		var wb: Array = []
		for r in rivals:
			wb.append(r.sc.box())
		for u in units:
			wb.append(u.sc.box())
		slice.traffic.watch_boxes = wb
	if state != "":
		_step_race(dt, car)
	else:
		_step_offers(dt, car)
	_step_police(dt, car)
	_update_hud(dt)
