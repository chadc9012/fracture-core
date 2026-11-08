extends SceneTree
## weapons.gd: the magazine, bursts, reloads and damage falloff of the three frames, headless.
const Weapons = preload("res://scripts/combat/weapons.gd")

func _init() -> void:
	var ok := true
	# the auto rifle: one bolt a pull, the fire rate between pulls, the mag runs down and a reload refills it from the reserve
	var auto := Weapons.Gun.new("AUTO")
	var shots := 0
	for i in 120:   # 2 s at 60 Hz with the trigger held
		shots += auto.step(1.0 / 60.0, true)
	var r1 := shots >= 17 and shots <= 19 and auto.mag == 32 - shots
	print("auto rate: ", r1, " ", shots)
	ok = ok and r1
	auto.mag = 0
	ok = ok and auto.step(1.0 / 60.0, true) == 0 and auto.reloading > 0.0
	for i in 110:
		auto.step(1.0 / 60.0, false)
	var r2 := auto.mag == 32 and auto.reserve == 160
	print("auto reload: ", r2, " ", auto.ammo_text())
	ok = ok and r2
	# the fusion rifle: five bolts a pull spaced 35 ms, one pull a second
	var fus := Weapons.Gun.new("FUSION")
	var first := fus.step(1.0 / 60.0, true)
	var rest := 0
	for i in 30:
		rest += fus.step(1.0 / 60.0, false)
	var later := 0
	for i in 30:
		later += fus.step(1.0 / 60.0, true)
	var r3 := first == 1 and rest == 4 and fus.mag == 15 and later == 0
	print("fusion volley: ", r3, " ", first, "+", rest, " then ", later)
	ok = ok and r3
	# the sniper: full damage to 150 m, floor at 250 m; a head shot ×2.4
	var r4 := absf(Weapons.damage("SNIPER", 100.0) - 65.0) < 1e-3 and absf(Weapons.damage("SNIPER", 250.0) - 65.0 * 0.9) < 1e-3 and absf(Weapons.damage("SNIPER", 10.0, true) - 65.0 * 2.4) < 1e-3 and Weapons.damage("AUTO", 40.0) < 10.0 and Weapons.damage("AUTO", 40.0) > 7.0
	print("falloff: ", r4)
	ok = ok and r4
	# a reload with a full mag or an empty reserve does nothing
	var sn := Weapons.Gun.new("SNIPER")
	ok = ok and not sn.reload()
	sn.mag = 1; sn.reserve = 0
	ok = ok and not sn.reload()
	# the authored frames (Nov 8): every ORDER entry has a model and bands; the shotgun throws 8 pellets a round for one
	# round of ammo; the SMG out-fires the auto rifle; unknown gear frames fall back to AUTO
	var r5 := true
	for f in Weapons.ORDER:
		var d: Dictionary = Weapons.FRAMES[f]
		r5 = r5 and d.has("model") and d.has("range_full") and d.has("mag") and ResourceLoader.exists("res://models/weapons/" + String(d.model))
	var sg := Weapons.Gun.new("SHOTGUN")
	var bolts := sg.step(0.02, true)
	r5 = r5 and bolts == 1 and Weapons.pellets("SHOTGUN") == 8 and sg.mag == 5 and Weapons.pellets("AUTO") == 1
	r5 = r5 and float(Weapons.FRAMES.SMG.fire_rate) < float(Weapons.FRAMES.AUTO.fire_rate) and Weapons.known("PLASMA") == "AUTO" and Weapons.known("LMG") == "LMG"
	r5 = r5 and absf(Weapons.damage("SHOTGUN", 4.0) - 7.5) < 1e-6 and Weapons.damage("SHOTGUN", 20.0) < Weapons.damage("SHOTGUN", 4.0) * 0.25
	print("authored frames, pellets, fallback: ", r5)
	ok = ok and r5
	print("Weapons test: ", ok)
	quit(0 if ok else 1)
