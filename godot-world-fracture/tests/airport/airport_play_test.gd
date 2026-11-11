extends Node
## The airports played without a window, through main.gd as a player reaches them: the AIRPORT EXPRESS door on the Nexus
## street opens Nexus City International; weapons are stowed landside and in the terminal; security holds you without a
## pass and lets you through with one; weapons come out on the apron, stay stowed in someone else's hangar and come out in
## your own once leased; a bought jet sits in your hangar; boarding a flight to Neon City lands you in Neon City
## International's arrivals hall, and leaving it puts you on Neon City's street; a flight to Riverdale (no airport) lands you walking
## in Riverdale. The profile is restored afterwards.
##   godot --headless --path godot-world-fracture res://tests/airport/airport_play.tscn
const Main := preload("res://scripts/main.gd")
const Air := preload("res://scripts/airport/airport.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")
var m: Control
var fails := 0
var _saved := ""

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _ready() -> void:
	var f := FileAccess.open(Gear.PROFILE, FileAccess.READ)
	_saved = f.get_as_text() if f else ""
	await _run()
	# put the player's own profile back
	var w := FileAccess.open(Gear.PROFILE, FileAccess.WRITE)
	if w:
		w.store_string(_saved if _saved != "" else JSON.stringify({ "xp": 0, "nex": 0, "level": 1 }))
	print("airport play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

## put the operator somewhere and let a few frames run
func _go(v: Control, at: Vector3) -> void:
	v.operator.position = at
	v.operator.velocity = Vector3.ZERO
	await _frames(3)

func _run() -> void:
	StreetSlice.force_armed = true
	CharacterStore.save_look(CharacterStore.default_look())
	Gear.profile_save({ "xp": 0, "nex": 40000, "level": 5 })
	m = Main.new()
	add_child(m)
	await _frames(3)
	m._title_action("continue")
	await _frames(6)
	ok(m.street != null and m.street._door_spots.any(func(d): return d.id == "airport"), "the street has the AIRPORT EXPRESS door")
	m.street._enter_door("airport")
	await _frames(6)
	var v: Control = m._from_street
	ok(v != null and v.code == "NXC" and not m.street.visible, "Nexus street → Nexus City International, street paused behind it")
	if v == null:
		return
	ok(v.zone == "landside" and v.gunplay.holstered and not v.controls.weapons_out, "forecourt: weapons stowed")
	await _go(v, Vector3(0, 0, 10))
	ok(v.zone == "terminal" and v.gunplay.holstered, "check-in hall: weapons stowed")
	await _go(v, Vector3(36, 0, 8))
	ok(v.zone == "shops" and v.gunplay.holstered, "shops: weapons stowed")
	# security without a pass
	await _go(v, Vector3(0, 0, -5.0))
	ok(v.operator.position.z > -4.0, "security holds you without a boarding pass (z %.1f)" % v.operator.position.z)
	# buy a ticket at the counter (as its button does) and go through
	var line := Air.buy_ticket(v.profile, "NXC", "NEC")
	v._save()
	v._apply_lanes()
	ok(line.begins_with("Ticket") and int(Gear.profile_load().nex) == 40000 - Air.fare("NEC"), "ticket bought and saved: " + line)
	await _go(v, Vector3(0, 0, -5.0))
	ok(v.operator.position.z < -4.4 and v.zone == "lounge" and v.gunplay.holstered, "through security with a pass; gate lounge: weapons stowed")
	# the airstrip
	await _go(v, Vector3(70, 0, -40))
	ok(v.zone == "apron" and not v.gunplay.holstered and v.controls.weapons_out, "apron: weapons out")
	await _go(v, Vector3(0, 0, -135))
	ok(v.zone == "runway" and not v.gunplay.holstered, "runway: weapons out")
	# hangars: someone else's, then yours
	v._apply_shutters()
	await _go(v, Vector3(86, 0, 2))
	ok(v.zone == "hangar:H1" and v.gunplay.holstered, "a hangar you don't lease: weapons stowed")
	ok(Air.buy_hangar(v.profile, "NXC", "H1").begins_with("Hangar H1"), "lease hangar H1")
	ok(Air.buy_aircraft(v.profile, "NXC", "vanguard-jet").contains("delivered"), "buy the jet into it")
	v._save()
	v._apply_shutters()
	await _go(v, Vector3(86, 0, 3))
	ok(v.zone == "hangar:H1" and not v.gunplay.holstered, "your own hangar: weapons out")
	ok(v._hangar_craft.size() == 1, "the jet stands in your hangar")
	var shut_open: bool = v.obstacles[int(v._shutters["H1"].idx)].position.y < -100.0
	var shut_closed: bool = v.obstacles[int(v._shutters["H2"].idx)].position.y >= 0.0
	ok(shut_open and shut_closed, "your door is open, the others are shut")
	# walk back in through the apron door: stowed again
	await _go(v, Vector3(40, 0, -18))
	ok(v.zone == "lounge" and v.gunplay.holstered, "back inside from the apron: weapons stowed")
	# every desk opens and closes (the panels build from the live profile)
	for f in [v._tickets_panel, func(): v._gate_panel("A2"), func(): v._hangar_panel("H2"), v._aircraft_panel, v._cafe_panel]:
		f.call()
		await _frames(2)
		var opened: bool = v._panel != null and v._panel.find_children("*", "Button", true, false).size() >= 1
		ok(opened, "a desk panel opens with its buttons")
		v._panel_close()
		await _frames(1)
	v._open_shop("apex")
	await _frames(3)
	ok(v._overlay != null and v._overlay.visible, "Aero Gear opens over the terminal")
	v._overlay.closed.emit()
	await _frames(3)
	ok(v._overlay == null and v.controls.visible, "and closes back to it")
	# board to Neon City
	v._board("NEC")
	ok(Air.tickets_from(v.profile, "NXC").is_empty() and not v._flight.is_empty(), "boarding uses the pass and starts the take-off")
	v._flight.t = 18.0
	await _frames(6)
	var w: Control = m._from_street
	ok(w != null and w != v and w.code == "NEC" and w.arriving, "landed at Neon City International (arrivals)")
	if w == null:
		return
	ok(not w._landing.is_empty() and not w.controls.visible, "the landing plays first (controls hidden)")
	w._landing.t = 9.0
	await _frames(3)
	ok(w._landing.is_empty() and w.controls.visible, "then you're in the arrivals hall with the controls back")
	ok(w.zone == "terminal" and w.gunplay.holstered, "arrivals hall: weapons stowed")
	ok(not Air.can_go_airside(w.profile, "NEC"), "no pass or hangar at NEC: airside closed")
	w.closed.emit()
	await _frames(8)
	ok(m._from_street == null and m.street != null and m.street.style == "neon" and m.street.visible, "leaving NEC puts you on Neon City's street")
	# Neon City's door opens its own airport; a flight to Riverdale lands you there on foot
	m.street._enter_door("airport")
	await _frames(6)
	var x: Control = m._from_street
	ok(x != null and x.code == "NEC", "Neon City street → Neon City International")
	if x == null:
		return
	Air.buy_ticket(x.profile, "NEC", "RVD")
	x._board("RVD")
	x._flight.t = 18.0
	await _frames(10)
	var y: Control = m._from_street
	ok(y != null and y.get("dest") == "RVD" and y.operator != null, "landed in Riverdale, on foot")
	if y:
		y.closed.emit()
		await _frames(6)
	ok(m._from_street == null and m.street != null and m.street.visible, "and back to the street")
	# a region's airport: fly to Frostveil International, walk out into Frostveil, walk back in
	m.street._enter_door("airport")
	await _frames(6)
	var a: Control = m._from_street
	Air.buy_ticket(a.profile, a.code, "FRV")
	a._board("FRV")
	a._flight.t = 18.0
	await _frames(10)
	var fr: Control = m._from_street
	ok(fr != null and fr.get("code") == "FRV" and fr.in_region and fr.arriving and fr._snow != null, "landed at Frostveil International (snow falling)")
	if fr == null:
		return
	fr._use("exit")
	await _frames(10)
	var out: Control = m._from_street
	ok(out != null and out.get("dest") == "FRV" and out.operator != null, "walked out into Frostveil on foot")
	if out == null:
		return
	out.flew.emit("FRV")
	await _frames(10)
	var back_in: Control = m._from_street
	ok(back_in != null and back_in.get("code") == "FRV", "and back into the terminal")
	if back_in:
		back_in.closed.emit()
		await _frames(6)
	ok(m._from_street == null and m.street != null and m.street.visible, "leaving a region's airport by the menu goes back to the street")
