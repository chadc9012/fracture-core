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
	# Ascendancy overtime (pvp.ts OVERTIME_S): nobody takes the zone for 60 s past the buzzer — more fighters standing wins,
	# a tie replays the round with no point to anyone
	var ot := Match.new(Arena.mode("ascendancy"))
	for i in int((ot.round_time() + Match.OVERTIME_S) / 0.05) + 2:
		ot.tick(0.05, {}, 2, 2)
	var r4b: bool = ot.us_rounds == 0 and ot.them_rounds == 0 and ot.round == 2 and ot.reason.begins_with("Overtime draw") and ot.round_clock == 0.0
	for i in 70:
		ot.tick(0.05, {}, 2, 2)
	for i in int((ot.round_time() + Match.OVERTIME_S) / 0.05) + 2:
		ot.tick(0.05, {}, 3, 1)
	r4b = r4b and ot.us_rounds == 1 and ot.reason == "Overtime: more of you standing" and ot.round == 3
	for i in 70:
		ot.tick(0.05, {}, 3, 1)
	for i in int((ot.round_time() + Match.OVERTIME_S) / 0.05) + 2:
		ot.tick(0.05, {}, 1, 2)
	r4b = r4b and ot.them_rounds == 1 and ot.reason == "Overtime: more of them standing"
	print("Ascendancy overtime: a draw replays, more standing wins: ", r4b, " ", ot.us_rounds, "-", ot.them_rounds, " round ", ot.round)
	ok = ok and r4b
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
	# Fracture Royale: the circle holds 50 s then closes over 35 s a phase, the fracture burns outside it by phase, your
	# eliminations and the clock empty a lobby of 60; the player's death places them; alive <= 3 is the win
	var ry := Match.new(Arena.mode("royale"), [])
	var r7: bool = ry.kind == "royale" and ry.alive == 60 and ry.squads() == 20 and is_equal_approx(ry.radius, Match.START_RADIUS)
	var z0: Dictionary = Match.radius_at(49.0)
	var z1: Dictionary = Match.radius_at(50.0 + 17.5)
	var z5: Dictionary = Match.radius_at(600.0)
	r7 = r7 and not bool(z0.closing) and int(z0.phase) == 0 and bool(z1.closing) and float(z1.radius) < Match.START_RADIUS and float(z1.radius) > Match.START_RADIUS - 0.2 * (Match.START_RADIUS - Match.FINAL_RADIUS)
	r7 = r7 and is_equal_approx(float(z5.radius), Match.FINAL_RADIUS) and int(z5.phase) == 5
	r7 = r7 and ry.storm_damage(ry.radius - 1.0) == 0.0 and ry.storm_damage(ry.radius + 1.0) == 2.0
	var waves := 0
	for i in 1800:   # 90 s
		ry.tick(0.05)
		if ry.wave_due:
			waves += 1
	r7 = r7 and waves == 2 and ry.alive < 60 and ry.alive > 3 and ry.phase == 1 and ry.them == ry.alive
	ry.score(1, true)
	var a1 := ry.alive
	ry.score(1, true)
	r7 = r7 and ry.player_kills == 2 and ry.alive == a1 - 1 and ry.us == 2
	ry.score(0)   # an ally down changes nothing in the lobby count here
	r7 = r7 and ry.alive == a1 - 1
	for i in 9000:   # the lobby empties by the final circle
		ry.tick(0.05)
		if ry.over:
			break
	r7 = r7 and ry.over and ry.winner == "us" and ry.reason == "Last squad standing" and ry.alive == 3
	var ry2 := Match.new(Arena.mode("royale"), [])
	ry2.tick(0.05)
	ry2.player_died()
	r7 = r7 and ry2.over and ry2.winner == "them" and ry2.reason.begins_with("Eliminated · placed 20 of 20")
	print("Fracture Royale: circle phases, storm damage, waves every 40 s, the lobby empties, placement on death: ", r7, " alive ", ry.alive)
	ok = ok and r7
	print("Modes test: ", ok)
	quit(0 if ok else 1)
