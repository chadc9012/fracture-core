extends SceneTree
## Killbox mode rules (scripts/killbox/killbox_match.gd) over the exported modes: Dominion zones capture, hold and tick;
## Freefall's board; Lockdown's attack / defend rounds; Ascendancy's wipe and buzzer zone.
## Run: godot --headless --path . --script res://tests/killbox/modes_test.gd

const Arena := preload("res://scripts/killbox/arena.gd")
const Match := preload("res://scripts/killbox/killbox_match.gd")

func _init() -> void:
	var ok := true
	var arena := Arena.new("fracture-floor")
	# Dominion: one of us alone in A captures it in 5 s, a contested B holds, held zones tick every 2 s, kills still count
	var dom := Match.new(Arena.mode("dominion"), arena.def.zones)
	var r1: bool = dom.kind == "zones" and dom.zones.size() == 3
	for i in 100:
		dom.tick(0.05, { "A": { "us": 1, "them": 0 }, "B": { "us": 1, "them": 1 } })
	r1 = r1 and int(dom.zones[0].owner) == 1 and int(dom.zones[1].owner) == -1 and dom.held(1) == 1
	var before := dom.us
	for i in 80:
		dom.tick(0.05, { "A": { "us": 1, "them": 0 } })
	r1 = r1 and dom.us - before == 2   # two ticks in 4 s
	dom.score(0)
	r1 = r1 and dom.them == 1 and dom.target() == 150
	print("Dominion: capture in 5 s, contested holds, held zone ticks a point per 2 s: ", r1, " us ", dom.us, " them ", dom.them)
	ok = ok and r1
	# two of them take a held zone back twice as fast as one would
	var t0 := 0.0
	while int(dom.zones[0].owner) == 1 and t0 < 20.0:
		dom.tick(0.05, { "A": { "us": 0, "them": 2 } })
		t0 += 0.05
	var r1b: bool = int(dom.zones[0].owner) == 0 and t0 < 5.5
	print("two rivals flip a held zone in under 5.5 s: ", r1b, " ", t0)
	ok = ok and r1b
	# Freefall: a board; us is your tally, them the best other; first to 20
	var ffa := Match.new(Arena.mode("freefall"))
	for i in 7:
		ffa.score(1, true)
	for i in 9:
		ffa.score(0, false, "bot-3")
	ffa.score(0, false, "bot-5")
	var r2: bool = ffa.kind == "ffa" and ffa.us == 7 and ffa.them == 9 and ffa.player_kills == 7 and not ffa.over
	for i in 11:
		ffa.score(0, false, "bot-3")
	r2 = r2 and ffa.over and ffa.winner == "them" and int(ffa.board["bot-3"]) == 20
	print("Freefall board, best rival wins at 20: ", r2)
	ok = ok and r2
	# Lockdown: attackers (us first) hold the objective 10 s unopposed → round; then we defend: their unopposed plant
	# takes 12 s → their round; a wipe ends a round either way; first to 4
	var lock := Match.new(Arena.mode("lockdown"))
	var r3: bool = lock.is_rounds() and lock.attacking and lock.objective_open()
	for i in 230:
		lock.tick(0.05, { "obj": { "us": 1, "them": 0 } }, 4, 4)
	r3 = r3 and lock.us_rounds == 1 and lock.round == 2 and not lock.attacking and lock.round_over > 0.0
	for i in 70:
		lock.tick(0.05, {}, 4, 4)   # the pause between rounds
	for i in 260:
		lock.tick(0.05, { "obj": { "us": 0, "them": 2 } }, 4, 4)
	r3 = r3 and lock.them_rounds == 1 and lock.round == 3 and lock.attacking
	for i in 70:
		lock.tick(0.05, {}, 4, 4)
	for i in 30:
		lock.tick(0.05, {}, 4, 0)   # we wiped them
	r3 = r3 and lock.us_rounds == 2 and lock.reason == "Rivals wiped" and lock.round_reset == false
	print("Lockdown: hold wins the attack, plant wins their attack, a wipe ends a round: ", r3, " ", lock.us_rounds, "-", lock.them_rounds)
	ok = ok and r3
	# Ascendancy: nothing on the clock before the buzzer; at 90 s the zone opens and 10 s of our presence takes it
	var asc := Match.new(Arena.mode("ascendancy"))
	for i in 1780:
		asc.tick(0.05, { "obj": { "us": 2, "them": 0 } }, 3, 3)
	var r4: bool = asc.us_rounds == 0 and not asc.objective_open()
	for i in 240:
		asc.tick(0.05, { "obj": { "us": 2, "them": 0 } }, 3, 3)
	r4 = r4 and asc.us_rounds == 1 and asc.reason == "Zone captured"
	for i in 70:
		asc.tick(0.05, {}, 3, 3)
	for i in 30:
		asc.tick(0.05, {}, 0, 3)
	r4 = r4 and asc.them_rounds == 1 and asc.reason == "Your team went down" and asc.target() == 5
	print("Ascendancy: buzzer opens the zone, a wipe loses the round: ", r4)
	ok = ok and r4
	# Clash is unchanged: the clock decides a lead
	var clash := Match.new(Arena.mode("clash"))
	clash.score(1)
	clash.tick(601.0)
	var r5: bool = clash.over and clash.winner == "us" and clash.kind == "team"
	print("Clash still decides on the clock: ", r5)
	ok = ok and r5
	# Extraction (pvp.ts stepExtract): the core is taken by a team on it unopposed for 1.2 s, rides its carrier, scores on the
	# carrier's own pad, drops where the carrier dies, resets home after 15 s untouched; kills never score; first to 3
	var ex := Match.new(Arena.mode("extraction"), [])
	ex.set_sites(Vector2(0, 0), Vector2(0, 30), Vector2(0, -30))
	var r6: bool = ex.kind == "extract" and ex.target() == 3
	var me := { "id": "player", "team": 1, "x": 0.0, "z": 0.0, "alive": true }
	var foe := { "id": "bot:1", "team": 0, "x": 20.0, "z": 0.0, "alive": true }
	# contested: nobody picks it up
	var both := { "id": "bot:2", "team": 0, "x": 1.0, "z": 0.0, "alive": true }
	for i in 40:
		ex.tick(0.05, {}, 1, 1, [me, both, foe])
	r6 = r6 and int(ex.core.holder) == -1
	both.x = 20.0
	for i in 30:
		ex.tick(0.05, {}, 1, 1, [me, both, foe])
	r6 = r6 and int(ex.core.holder) == 1 and String(ex.core.carrier) == "player" and ex.core_event == "Core taken"
	# it rides with me; a kill scores nothing
	me.z = 10.0
	ex.tick(0.05, {}, 1, 1, [me, both, foe])
	r6 = r6 and is_equal_approx(ex.core_at().y, 10.0)
	ex.score(1, true)
	r6 = r6 and ex.us == 0 and ex.player_kills == 1
	# onto the pad: one extraction, the core goes home
	me.z = 28.0
	ex.tick(0.05, {}, 1, 1, [me, both, foe])
	r6 = r6 and ex.us == 1 and int(ex.core.holder) == -1 and ex.core_at() == Vector2.ZERO and ex.core_event == "Core extracted"
	# they take it, the carrier dies: the core drops where he fell, lies 15 s, then resets home
	me.z = 28.0
	foe.x = 0.5
	foe.z = 0.0
	for i in 30:
		ex.tick(0.05, {}, 1, 1, [me, both, foe])
	r6 = r6 and int(ex.core.holder) == 0 and String(ex.core.carrier) == "bot:1"
	foe.x = 5.0
	foe.z = -12.0
	ex.tick(0.05, {}, 1, 1, [me, both, foe])
	foe.alive = false
	ex.tick(0.05, {}, 1, 1, [me, both, foe])
	r6 = r6 and int(ex.core.holder) == -1 and ex.core_at().is_equal_approx(Vector2(5.0, -12.0)) and ex.core_event == "Core dropped"
	r6 = r6 and ex.core_text() == "core dropped"
	for i in 310:
		ex.tick(0.05, {}, 1, 1, [me, both])
	r6 = r6 and ex.core_at() == Vector2.ZERO and ex.core_event == "Core reset" and ex.core_text() == "core in the middle"
	# three extractions win it
	ex.us = 2
	me.x = 0.0
	me.z = 0.0
	for i in 30:
		ex.tick(0.05, {}, 1, 1, [me, both])
	me.z = 29.0
	ex.tick(0.05, {}, 1, 1, [me, both])
	r6 = r6 and ex.over and ex.winner == "us" and ex.us == 3
	print("Extraction: pick-up unopposed, carry, pad, drop on death, reset, first to 3: ", r6)
	ok = ok and r6
	print("Modes test: ", ok)
	quit(0 if ok else 1)
