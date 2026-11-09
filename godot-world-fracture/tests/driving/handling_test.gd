extends SceneTree
## Vehicle handling (scripts/driving/vehicle_handling.gd, the web's vehicle-handling.ts): a helicopter lifts from a
## standstill and hovers, a jet needs takeoff speed and sinks when slow, a boat rides the water and beaches, a sub dives
## between the floor and the surface, a tank pivots. Run: godot --headless --path . --script res://tests/driving/handling_test.gd

const H := preload("res://scripts/driving/vehicle_handling.gd")

func _init() -> void:
	var ok := true
	var dt := 1.0 / 60.0
	# helicopter: UP from the pad lifts straight away, holding UP climbs at ~9 m/s, letting go hovers, DOWN lands
	var heli := H.profile("HELI")
	var st := H.State.new()
	var env := { "floor": 10.0, "water": -100.0, "over_water": false, "grip": 1.0 }
	H.step(heli, st, { "ascend": 1.0 }, env, H.BASE_SPEED * 1.12, dt)
	var r1 := st.airborne and st.y >= 11.9 and st.vy > 0.0
	for i in 180:
		H.step(heli, st, { "ascend": 1.0 }, env, H.BASE_SPEED * 1.12, dt)
	var climbed := st.y
	r1 = r1 and climbed > 10.0 + H.RIDE + 20.0 and climbed < 10.0 + H.RIDE + 30.0
	for i in 120:
		H.step(heli, st, {}, env, H.BASE_SPEED * 1.12, dt)
	r1 = r1 and absf(st.y - climbed) < 4.0   # hovers (the climb bleeds off over ~0.4 s)
	for i in 600:
		H.step(heli, st, { "descend": 0.5 }, env, H.BASE_SPEED * 1.12, dt)
		if st.landed:
			break
	r1 = r1 and not st.airborne and st.landed == true and not st.hard_landing
	print("helicopter lifts, climbs ~9 m/s, hovers, sets down softly: ", r1, " top ", climbed)
	ok = ok and r1
	# jet: UP at standstill does nothing; at takeoff speed it lifts; slowing below 70 % of takeoff sinks
	var jet := H.profile("JET")
	var js := H.State.new()
	for i in 30:
		H.step(jet, js, { "ascend": 1.0 }, env, H.BASE_SPEED * 1.8, dt)
	var r2 := not js.airborne
	for i in 600:
		H.step(jet, js, { "throttle": 1.0, "ascend": 1.0 }, env, H.BASE_SPEED * 1.8, dt)
		if js.airborne:
			break
	r2 = r2 and js.airborne and js.speed >= 32.0
	for i in 120:
		H.step(jet, js, { "throttle": 1.0, "ascend": 1.0 }, env, H.BASE_SPEED * 1.8, dt)
	var high := js.y
	for i in 400:
		H.step(jet, js, { "brake": 1.0 }, env, H.BASE_SPEED * 1.8, dt)
	r2 = r2 and js.y < high and js.vy < 0.0 or js.landed
	print("jet needs takeoff speed, climbs, sinks when it slows: ", r2, " speed ", js.speed, " y ", js.y)
	ok = ok and r2
	# ground steering at full lock turns a car; a tank pivots at zero speed, a car does not
	var tank := H.profile("TANK")
	var ts := H.State.new()
	H.step(tank, ts, { "steer": 1.0 }, env, H.BASE_SPEED * 0.6, 0.5)
	var car := H.profile("OFFROAD")
	var cs := H.State.new()
	H.step(car, cs, { "steer": 1.0 }, env, H.BASE_SPEED, 0.5)
	var r3 := ts.yaw > 0.4 and cs.yaw < 0.15 and ts.y == 10.0 + H.RIDE
	print("tank pivots standing still, a car barely turns: ", r3, " ", ts.yaw, " ", cs.yaw)
	ok = ok and r3
	# boat: rides 0.6 above the water, beaches when the ground under it is land
	var boat := H.profile("BOAT")
	var bs := H.State.new()
	var sea := { "floor": -8.0, "water": 0.0, "over_water": true, "grip": 1.0 }
	for i in 120:
		H.step(boat, bs, { "throttle": 1.0 }, sea, H.BASE_SPEED * 0.85, dt)
	var r4 := absf(bs.y - 0.6) < 1e-6 and bs.speed > 20.0 and not bs.blocked
	var fast := bs.speed
	for i in 60:
		H.step(boat, bs, { "throttle": 1.0 }, { "floor": 1.0, "water": 0.0, "over_water": false, "grip": 1.0 }, H.BASE_SPEED * 0.85, dt)
	r4 = r4 and bs.blocked and bs.speed < fast * 0.3
	print("boat rides the surface and beaches on land: ", r4)
	ok = ok and r4
	# sub: dives at 4 m/s, never below the floor + 1.2, never above the surface + 0.6
	var sub := H.profile("SUB")
	var ss := H.State.new()
	ss.y = 0.6
	for i in 600:
		H.step(sub, ss, { "descend": 1.0 }, { "floor": -30.0, "water": 0.0, "over_water": true, "grip": 1.0 }, H.BASE_SPEED * 0.7, dt)
	var r5 := absf(ss.y - (-30.0 + 1.2)) < 1e-6
	for i in 900:
		H.step(sub, ss, { "ascend": 1.0 }, { "floor": -30.0, "water": 0.0, "over_water": true, "grip": 1.0 }, H.BASE_SPEED * 0.7, dt)
	r5 = r5 and absf(ss.y - 0.6) < 1e-6
	print("sub dives to the floor and surfaces: ", r5)
	ok = ok and r5
	# exits and cameras
	var r6: bool = not bool(H.can_exit(jet, js, false).ok) if js.airborne else true
	var hs2 := H.State.new()
	hs2.airborne = true
	r6 = r6 and String(H.can_exit(heli, hs2, false).reason) == "Set down first" and H.camera(heli) == Vector2(22.0, 7.0) and H.camera(boat) == Vector2(13.0, 3.5)
	r6 = r6 and H.kind_of("rift-helicopter") == "HELI" and H.kind_of("vanguard-jet") == "JET" and H.kind_of("tuner") == "OFFROAD"
	print("exit rules, cameras, kinds by hull: ", r6)
	ok = ok and r6
	print("Handling test: ", ok)
	quit(0 if ok else 1)
