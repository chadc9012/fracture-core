extends SceneTree
## arena.gd + killbox_match.gd headless: Kaiju Complex loads, roofs and crossings are walkable and the street is not, the
## parapets stand where a roof edge drops, spawns sit on roofs, and Clash scores to 75.
const Arena = preload("res://scripts/killbox/arena.gd")
const Match = preload("res://scripts/killbox/killbox_match.gd")

func _init() -> void:
	var ok := true
	var a := Arena.new("kaiju-complex")
	var r1: bool = a.ok() and Arena.arena_ids().has("kaiju-complex") and Arena.arena_ids().size() >= 3 and a.def.roofs.size() == 6
	print("the arena loads: ", r1, " ", Arena.arena_ids())
	ok = ok and r1
	var roof: float = a.surface_at(-30.0, 20.0)      # the Rooftop Bar, top 23
	var bridge: float = a.surface_at(0.0, 0.0)       # the billboard bridge, 20
	var walk: float = a.surface_at(-34.0, 0.0)       # the west catwalk, climbing 21.5 -> 23
	var street: float = a.surface_at(-34.0, 50.0)
	var r2: bool = absf(roof - 23.0) < 1e-3 and absf(bridge - 20.0) < 1e-3 and walk > 21.5 and walk < 23.0 and street == -INF
	print("roofs, the bridge, a climbing catwalk, the street drop: ", r2, " ", [roof, bridge, walk, street])
	ok = ok and r2
	var boxes := a.boxes()
	var parapet := false
	var gap := true
	for b in boxes:
		# a parapet along the Rooftop Bar's north edge (z = 34), none across the catwalk's mouth on its south edge
		if b.position.z > 33.0 and b.end.z < 35.0 and b.position.x < -20.0 and b.end.y > 23.5:
			parapet = true
		if b.position.z < 8.5 and b.end.z > 7.5 and b.position.x < -33.0 and b.end.x > -35.0 and b.end.y > 23.5 and b.size.x < 2.0 and b.size.z < 1.0:
			gap = false
	var r3: bool = parapet and gap and boxes.size() > 30
	print("parapets on the open edges, none at the catwalk mouth: ", r3, " ", boxes.size(), " boxes")
	ok = ok and r3
	var s_us := a.spawn("us")
	var s_them := a.spawn("them", [s_us])
	var r4: bool = s_us.y > 19.0 and s_them.y > 19.0 and s_us.distance_to(s_them) > 40.0
	print("spawns on the roofs, apart: ", r4)
	ok = ok and r4
	var m := Match.new(Arena.mode("clash"))
	for i in 74:
		m.score(1, i % 3 == 0)
	m.score(0)
	var r5: bool = not m.over and m.us == 74 and m.them == 1
	m.score(1, true)
	r5 = r5 and m.over and m.winner == "us" and m.player_kills == 26 and m.target() == 75
	print("Clash to 75: ", r5, " ", m.us, "-", m.them, " ", m.winner)
	ok = ok and r5
	var m2 := Match.new(Arena.mode("clash"))
	m2.score(0)
	m2.tick(601.0)
	var r6: bool = m2.over and m2.winner == "them"
	print("the clock decides: ", r6)
	ok = ok and r6
	print("Arena test: ", ok)
	quit(0 if ok else 1)
