extends SceneTree
## Combat balance (owner, Nov 22: "Start balancing test"): time-to-kill for every weapon frame against every enemy type,
## simulated shot by shot with weapons.gd's own Gun (fire rate, bursts, magazine, reloads, the bow's draw, falloff at
## range, pellets) against the enemy's hull and shield from enemies.gd TYPES. Every bullet lands on the body (no
## precision hits, no perks, item power ×1.0, kinetic), at the distance the weapon is built for.
##   godot --headless --path godot-world-fracture --script res://tests/combat/balance_test.gd [-- table]
## Prints the table with `table`, then the band checks and "balance: N failed".

const Weapons := preload("res://scripts/combat/weapons.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Boss := preload("res://scripts/combat/boss.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const DT := 1.0 / 60.0
var failed := 0

## the distance each frame is fought at (its job), metres
const RANGE_OF := { "SHOTGUN": 6.0, "SMG": 10.0, "PISTOL": 12.0, "SIDEARM": 15.0, "FUSION": 12.0, "AUTO": 20.0, "LMG": 22.0,
	"MARKSMAN": 35.0, "BOW": 30.0, "SNIPER": 50.0, "HEAVY": 25.0, "ROCKET": 25.0, "GL": 20.0 }

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

## seconds from the first trigger pull to the kill (INF past 30 s), and the shots it took
static func ttk(frame: String, hull: float, shield: float, dist: float, energy := false, mult := 1.0) -> Vector2:
	var g := Weapons.Gun.new(frame)
	g.mult = mult
	g.reserve = 9999
	var hp := hull
	var sh := shield
	var t := 0.0
	var shots := 0
	var bow: bool = (Weapons.FRAMES[frame] as Dictionary).has("draw")
	var hold_t := 0.0
	while t < 30.0:
		var trig := true
		if bow:
			hold_t += DT
			if hold_t > float(Weapons.FRAMES[frame].draw) + DT:
				trig = false
				hold_t = 0.0
		var n := g.step(DT, trig)
		if g.mag <= 0 and g.reloading <= 0.0 and not bow:
			g.reload()
		for i in n:
			shots += 1
			for p in Weapons.pellets(frame):
				var d: float = Weapons.damage(frame, dist) * (g.last_charge if bow else 1.0) * g.mult
				if sh > 0.0:
					var k := 1.5 if energy else 1.0
					var on := minf(sh, d * k)
					sh -= on
					d -= on / k
				hp -= d
		if hp <= 0.0:
			return Vector2(t, shots)
		t += DT
	return Vector2(INF, shots)


## a boss fight, solo: the operator fires `primary` whenever it can, uptime `uptime` of the time (the rest is spent
## dodging and moving — the attacks are real), and with `heavy` dumps the heavy weapon's ammo into each stagger and weak
## point. The boss's own rules (boss.gd: poise → 4 s stagger ×2.25, phase weak points ×1.6) run frame by frame.
## Seconds to the kill (INF past 10 minutes).
static func boss_time(id: String, primary: String, heavy := "", mult := 1.0, uptime := 0.6) -> float:
	var b := Boss.new(id)
	var g := Weapons.Gun.new(primary)
	g.reserve = 99999
	g.mult = mult
	var h: Weapons.Gun = Weapons.Gun.new(heavy) if heavy != "" else null
	if h:
		h.mult = mult
	var t := 0.0
	var dist := 15.0
	while t < 600.0:
		b.tick(DT, dist)
		b.events.clear()
		var on := fmod(t, 5.0) < 5.0 * uptime
		var use_heavy := h != null and (b.staggered() or b.weak_point()) and (h.mag > 0 or h.reserve > 0)
		var gun: Weapons.Gun = h if use_heavy else g
		var n := gun.step(DT, on)
		if gun.mag <= 0 and gun.reloading <= 0.0:
			gun.reload()
		if gun != g:
			g.step(DT, false)
		elif h:
			h.step(DT, false)
		for i in n:
			for p in Weapons.pellets(gun.frame):
				b.hit(Weapons.damage(gun.frame, dist) * gun.mult)
		if b.dead:
			return t
		t += DT
	return INF

func _init() -> void:
	var types: Array = ["drone", "scout", "marksman", "executor", "elite"]
	var table := {}
	var show := OS.get_cmdline_user_args().has("table")
	var head := "%-9s" % "frame"
	for ty in types:
		head += " %13s" % ty
	if show:
		print(head)
	for f in Weapons.ALL:
		var row := "%-9s" % f
		table[f] = {}
		for ty in types:
			var d: Dictionary = Enemies.TYPES[ty]
			var r := ttk(f, float(d.hull), float(d.get("shield", 0.0)), float(RANGE_OF[f]))
			table[f][ty] = r
			row += " %7.2fs %3d" % [r.x, int(r.y)]
		if show:
			print(row)
	# --- the bands (each is a design rule — Destiny's pacing: trash falls fast, majors are a fight, heavies end it)
	var autos := ["AUTO", "SMG", "LMG", "PISTOL"]
	var prim := ["AUTO", "SMG", "PISTOL", "SIDEARM", "MARKSMAN", "LMG", "FUSION", "SHOTGUN", "BOW", "SNIPER"]
	var bad := []
	# 1. trash: a scout drops to an automatic in 0.35–1.0 s — not paper, not a sponge
	for f in autos:
		var t: float = table[f].scout.x
		if t < 0.35 or t > 1.0:
			bad.append("%s %.2fs" % [f, t])
	ok(bad.is_empty(), "automatics drop a scout in 0.35–1.0 s %s" % str(bad))
	# 2. every primary kills a scout inside 1.4 s at its own range: no gun is useless against trash
	bad = []
	for f in prim:
		if float(table[f].scout.x) > 1.4:
			bad.append("%s %.2fs" % [f, table[f].scout.x])
	ok(bad.is_empty(), "every primary kills a scout in ≤1.4 s %s" % str(bad))
	# 3. majors are a fight: the elite takes an automatic 1.7–3.8 s (mag and reload counted), the Executor 1.2–3.0 s
	bad = []
	for f in autos:
		var te: float = table[f].elite.x
		var tx: float = table[f].executor.x
		if te < 1.7 or te > 3.8:
			bad.append("%s elite %.2fs" % [f, te])
		if tx < 1.2 or tx > 3.0:
			bad.append("%s executor %.2fs" % [f, tx])
	ok(bad.is_empty(), "automatics take 1.7–3.8 s on the elite and 1.2–3.0 s on the Executor %s" % str(bad))
	# 4. nothing one-shots a major from the primary slot (body shots; precision is the skill reward)
	bad = []
	for f in prim:
		if int(table[f].elite.y) <= 1 or int(table[f].executor.y) <= 1:
			bad.append(f)
	ok(bad.is_empty(), "no primary drops a major in one body shot %s" % str(bad))
	# 5. heavies end majors: the rocket one-hits the elite, the heavy cannon and GL drop it inside 2.5 s
	ok(int(table.ROCKET.elite.y) == 1 and float(table.HEAVY.elite.x) <= 2.5 and float(table.GL.elite.x) <= 2.5, "heavies end majors: rocket one hit, cannon %.2f s, GL %.2f s" % [table.HEAVY.elite.x, table.GL.elite.x])
	# 6. precision weapons (sniper, marksman, bow, hand cannon) take fewer shots on the marksman than the SMG
	bad = []
	for f in ["SNIPER", "MARKSMAN", "BOW", "SIDEARM"]:
		if int(table[f].marksman.y) >= int(table.SMG.marksman.y):
			bad.append(f)
	ok(bad.is_empty(), "precision weapons kill the marksman in fewer shots than the SMG %s" % str(bad))
	ok(int(table.SNIPER.scout.y) == 1 and int(table.SNIPER.marksman.y) == 1 and int(table.SNIPER.drone.y) == 1, "the sniper drops a scout, marksman or drone in one body shot")
	# 7. range trades: the shotgun out-kills the sniper and marksman on the Executor up close
	ok(float(table.SHOTGUN.executor.x) <= float(table.SNIPER.executor.x) and float(table.SHOTGUN.executor.x) <= float(table.MARKSMAN.executor.x), "the shotgun kills the Executor fastest up close")
	# 8. the fusion rifle's charge: never an instant kill, even on a drone
	ok(float(table.FUSION.drone.x) >= 0.4, "the fusion rifle has to charge (%.2f s on a drone)" % table.FUSION.drone.x)
	# 9. the pistol stays within 1.5× the rifle on trash
	ok(float(table.PISTOL.scout.x) <= 1.5 * float(table.AUTO.scout.x) + 0.05, "the pistol is within 1.5× the rifle on a scout (%.2f vs %.2f)" % [table.PISTOL.scout.x, table.AUTO.scout.x])
	# 10. an element strips the elite's shield faster than kinetic
	var el: Dictionary = Enemies.TYPES.elite
	if float(el.get("shield", 0.0)) > 0.0:
		ok(ttk("AUTO", float(el.hull), float(el.shield), 20.0, true).x < float(table.AUTO.elite.x), "an elemental rifle beats a kinetic one on the shielded elite")
	# 11. the other side: how long each trooper alone, and a whole squad under the fire tokens, take to drop an operator
	#     standing still in the open (hull + shield, 60% of the bolts landing). Alone a trooper never kills you fast;
	#     a full squad does if you stand there.
	var op := Enemies.HULL_MAX + Enemies.SHIELD_MAX
	var dps := {}
	for ty in ["scout", "elite", "marksman", "drone"]:
		var d: Dictionary = Enemies.TYPES[ty]
		dps[ty] = float(d.damage) * float(d.burst) / float(d.cool) * 0.6
	var alone := []
	for ty in dps:
		var t: float = op / float(dps[ty])
		if show:
			print("  %-9s alone downs the operator in %5.1f s" % [ty, t])
		if t < 6.0:
			alone.append("%s %.1fs" % [ty, t])
	ok(alone.is_empty(), "no lone gunner downs a standing operator inside 6 s %s" % str(alone))
	# the squad: the two strongest gunners hold the tokens
	var by := (dps.values() as Array)
	by.sort()
	var squad_t: float = op / (float(by[-1]) + float(by[-2]))
	ok(squad_t >= 4.0 and squad_t <= 12.0, "a squad on its fire tokens downs a standing operator in 4–12 s (%.1f s): move or die" % squad_t)
	# the level's hull (Progression: +4 a level, uncapped) must not make a squad harmless by mid-game: hostiles meet the
	# operator at its level (enemies.gd level_damage / level_hull, Nov 24), so at level 20 and at the cap a standing
	# operator still falls to a squad in the same 4–12 s window give or take a little, a touch slower than at level 1
	for lv in [20, Enemies.LEVEL_CAP]:
		var hull_lv := op + 4.0 * float(lv - 1)
		var squad_lv: float = hull_lv / ((float(by[-1]) + float(by[-2])) * Enemies.level_damage(lv))
		ok(squad_lv >= squad_t and squad_lv <= 14.0, "at level %d a squad downs a standing operator in %.1f s (level 1: %.1f s)" % [lv, squad_lv, squad_t])
	ok(Enemies.level_hull(20) <= 1.25 and Enemies.level_hull(Enemies.LEVEL_CAP) < Gear.DAMAGE_CAP, "their hull grows slower than the best gear's damage (×%.2f at 20, ×%.2f at the cap, gear ×%.1f)" % [Enemies.level_hull(20), Enemies.level_hull(Enemies.LEVEL_CAP), Gear.DAMAGE_CAP])
	# 12. gear power: the best gear (×%.1f) speeds kills up but never trivialises them — an automatic still needs a
	#     few bullets on trash and a real burst on a major
	var cap: float = Gear.DAMAGE_CAP
	bad = []
	for f in autos:
		var sc := ttk(f, float(Enemies.TYPES.scout.hull), 0.0, float(RANGE_OF[f]), false, cap)
		var d: Dictionary = Enemies.TYPES.elite
		var mj := ttk(f, float(d.hull), float(d.get("shield", 0.0)), float(RANGE_OF[f]), false, cap)
		if show:
			print("  %-8s at power ×%.1f: scout %.2f s (%d), elite %.2f s (%d)" % [f, cap, sc.x, int(sc.y), mj.x, int(mj.y)])
		if int(sc.y) < 2 or mj.x < 1.0:
			bad.append(f)
	ok(bad.is_empty(), "at the gear cap (×%.1f) trash still takes 2+ bullets and the elite a second or more %s" % [cap, str(bad)])
	# 13. bosses, solo, 60% uptime (the rest dodging): a regional boss with a rifle in 0.5–2.5 min, the world boss
	#     (Rust Colossus) 1.5–5 min; a heavy dumped into staggers cuts the time by a fifth or more
	bad = []
	for id in Boss.BOSSES:
		var rifle := boss_time(id, "AUTO")
		var with_heavy := boss_time(id, "AUTO", "ROCKET")
		if show:
			print("  boss %-18s rifle %5.0f s · rifle + rockets %5.0f s · hull %.0f" % [id, rifle, with_heavy, Boss.BASE_HULL * float(Boss.BOSSES[id].hull)])
		var lo := 90.0 if id == "colossus" else 30.0
		var hi := 300.0 if id == "colossus" else 150.0
		if rifle < lo or rifle > hi:
			bad.append("%s %.0fs" % [id, rifle])
		if with_heavy > rifle * 0.9:
			bad.append("%s heavy only ×%.2f" % [id, with_heavy / rifle])
	ok(bad.is_empty(), "boss fights last 0.5–2.5 min (the Colossus 1.5–5) and heavies in the staggers save 10%%+ %s" % str(bad))
	print("balance: %d failed" % failed)
	quit(1 if failed > 0 else 0)
