extends Node3D
const Settings := preload("res://scripts/front/settings_store.gd")
const Sound := preload("res://scripts/audio/sound.gd")
## Shooting on foot (the Dec 4 plan, phase 2): the operator's gun in the right hand (the web game's authored rifle GLBs —
## rifle, rifle-sniper, rifle-fusion — on the RightHand bone, barrel along the bone's +Z as OperatorModel.tsx mounts them),
## hitscan bolts from the muzzle toward where the chase camera's crosshair points, stopped by the scene's obstacle boxes,
## landing on `targets` (practice dummies now, enemies next), tracers, a muzzle flash and impact sparks, and the combat clip
## while the trigger is warm. weapons.gd holds the frames and the magazine; this node is the scene side.

## the shot cue per frame (audio/sfx, scripts/build-sfx.py)
const SHOT_CUES := { "AUTO": "rifle", "SNIPER": "sniper", "FUSION": "fusion", "SMG": "smg", "SHOTGUN": "shotgun", "SIDEARM": "sidearm", "LMG": "lmg", "HEAVY": "heavy",
	"PISTOL": "sidearm", "MARKSMAN": "sniper", "ROCKET": "", "GL": "", "BOW": "swing" }
const Weapons := preload("res://scripts/combat/weapons.gd")
const Grenades := preload("res://scripts/combat/grenades.gd")
const CloseCombat := preload("res://scripts/combat/close_combat.gd")
const HeavyWeapons := preload("res://scripts/combat/heavy_weapons.gd")
## Tracer's mark: a marked Target takes this much more from every bolt and grenade
const MARK_MULT := 1.33
const MODELS := "res://models/weapons/"

## something a bolt can hit: a world box, hull points, and the node that shows it (optional)
class Target:
	var box: AABB
	var hp: float
	var max_hp: float
	var node: Node3D
	var down := 0.0          # seconds until it stands again
	## an energy shield over the hull (asset catalog §5): it takes damage first, recharges SHIELD_RATE a second once
	## SHIELD_DELAY seconds pass without a hit; energy frames (FUSION) strip it x1.5
	var shield := 0.0
	var shield_max := 0.0
	var since := 99.0        # seconds since the last hit
	## Operator grenades (grenades.gd): seconds stunned (a bot holds still and holds fire) and marked (takes +33% damage)
	var stun := 0.0
	var mark := 0.0
	## hit reactions (close_combat.gd, Nov 22): the shove and the poise damage of the last hits, consumed by whoever moves
	## the body (enemies.gd staggers, knocks down or flinches by them); `heavy` marks a guard-breaking blow
	var knock := Vector3.ZERO
	var impact := 0.0
	var heavy := false
	## elemental states (weapons.gd ELEMENTS, applied by gunplay._element): THERMAL burns, VOID weakens (takes more),
	## CRYO slows and, five hits in, freezes (a stun); enemies.gd reads `slow`
	var burn := 0.0
	var burn_dps := 0.0
	var weaken := 0.0
	var slow := 0.0
	var cryo_hits := 0
	func _init(b: AABB, h: float, n: Node3D = null) -> void:
		box = b; hp = h; max_hp = h; node = n
	func alive() -> bool:
		return hp > 0.0
	## lands `d` damage: the shield first, the rest on the hull. Returns {shield, hull, broke}
	func take(d: float, energy := false, shield_k := 1.5) -> Dictionary:
		since = 0.0
		var on_shield := 0.0
		var broke := false
		if shield > 0.0:
			var k := shield_k if energy else 1.0
			on_shield = minf(shield, d * k)
			shield -= on_shield
			d = maxf(0.0, d - on_shield / k)
			broke = shield <= 0.0
		hp -= d
		return { "shield": on_shield, "hull": d, "broke": broke }

const SHIELD_DELAY := 3.0
const SHIELD_RATE := 18.0
## a destroyed cover box is parked here (index-stable: the obstacle list is shared and indexed)
const GONE_BOX := AABB(Vector3(0, -1000, 0), Vector3(0.01, 0.01, 0.01))

signal hit(target: Target, damage: float, head: bool)
## what landed the hit being emitted, when it was not the gun in hand: "MELEE" (melee_hit), "GRENADE" (grenade_hit), else ""
## (the unique encounters' adaptive and attuned bosses tell damage apart by it: boss.gd `gimmick_mult`)
var hit_kind := ""
signal killed(target: Target)
## a piece of destructible cover went (not a kill: no drop, no scavenge)
signal cover_broken(target: Target)

var player: Node3D            # operator_player.gd
## the Operator's grenades (grenades.gd), stepped here so every combat view has them; `roster` is enemies.gd (set by its
## setup) for the operator's hull, which the Rift Well heals
var grenades: Node3D
## melee, dodge, block and parry (close_combat.gd), stepped here so every combat view has them with no wiring
var close: Node3D
var roster: Node = null
## off while unarmed (holstered) or in a view that wants no grenades
var grenades_on := true
## the on-foot input (touch_controls.gd); unset, the scene's one is found by its group
var controls: Node = null
var obstacles: Array[AABB] = []
var targets: Array[Target] = []
var guns: Array = []
var current := 0
var warm := 0.0               # seconds since the last shot, for the combat clip
var kills := 0
## no weapon in hand: before Mission 01's Fracture arms the operator the street is walked unarmed (owner, Nov 9)
var holstered := false
## aim help: shots go to a live foe within this many degrees of the crosshair (on by default on a touch screen)
var assist_deg := 7.0 if (DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")) else 0.0
var shots_fired := 0
var hits_landed := 0
## aiming down the sights (the ADS button / right mouse / left trigger): eased 0..1 by the gun's handling, it narrows the
## spread, halves the kick, zooms by the frame's `zoom` and slows the walk
var aiming := false
var ads := 0.0
var _base_fov := 0.0
var _still_ads := 0.0
## rockets, grenade-launcher shells and the perks' bursts fly through this (heavy_weapons.gd, the tank's ordnance)
var ordnance: Node3D

var _hand: BoneAttachment3D
var _held: Node3D
var _models := {}
var _tracers: Array = []
var _flash: OmniLight3D
var _flash_t := 0.0
var _rng := RandomNumberGenerator.new()
var _rack: Node3D             # holds the worn (not held) guns in world space
var _slung := {}              # frame -> "back" | "thigh"
var _spine_bone := -1
var _thigh_bone := -1
var _mags := 0

## a kill resupplies: every carried gun gets half a magazine back into its reserve (to the frame's full reserve), so a
## long fight — a Fracture boss, a lockdown — is paced by kills rather than ended by an empty bag
## a kill's ammo back to every carried gun: what that foe took to drop (its hull and shield over the gun's body-shot
## damage), doubled for misses, never less than half a magazine nor more than two (the Nov 22 balance pass
## made troopers tougher; a flat half-mag ran the rifle dry by the second lockdown wave)
func scavenge(t: Target = null) -> void:
	for g in guns:
		var f: Dictionary = Weapons.FRAMES.get(g.frame, {})
		var mag := int(f.get("mag", 10))
		var back := maxi(1, mag / 2)
		if t != null and t.max_hp > 0.0:
			var per := Weapons.BASE_DAMAGE * float(f.get("damage", 1.0)) * Weapons.pellets(g.frame) * maxf(g.mult, 0.1)
			var needed := (t.max_hp + t.shield_max) / maxf(per, 0.1)
			back = clampi(int(ceil(needed * 2.0)), maxi(1, mag / 2), mag * 2)
		g.reserve = mini(int(g.reserve) + back, int(f.get("reserve", 0)))

## a full restock (a chapter's start, standing back up after going down — Destiny refills there too): every carried
## gun's reserve to its frame's full load and a fresh magazine
func resupply() -> void:
	for g in guns:
		var f: Dictionary = Weapons.FRAMES.get(g.frame, {})
		g.reserve = int(f.get("reserve", g.reserve))
		if not f.has("draw"):
			g.mag = int(f.get("mag", g.mag))
		g.cancel_reload()

func gun() -> Weapons.Gun:
	return guns[current]

func setup(p: Node3D, boxes: Array[AABB]) -> void:
	player = p
	obstacles = boxes
	for f in Weapons.ORDER:
		guns.append(Weapons.Gun.new(f))
	_rng.seed = 7
	_mount()
	grenades = Grenades.new()
	add_child(grenades)
	grenades.setup(self)
	close = CloseCombat.new()
	add_child(close)
	close.setup(self)
	ordnance = HeavyWeapons.new()
	add_child(ordnance)
	ordnance.gunplay = self
	ordnance.obstacles = obstacles
	ordnance.ground_at = p.ground_at
	ordnance.listener = func() -> Vector3: return player.position if player else Vector3.ZERO
	ordnance.shake = func(a: float) -> void:
		if player and player.has_method("add_shake"):
			player.add_shake(a)
	hit.connect(_hit_feedback)
	killed.connect(func(t: Target) -> void:
		if not (t.has_meta("cover_box") or t.has_meta("prop")):
			_marker("kill")
			Sound.sfx("kill_confirm", -3.0, 0.02))

## the operator's rig was rebuilt (new clothes): the guns go back on the new skeleton
func remount() -> void:
	if _rack:
		_rack.queue_free()
		_rack = null
	_models.clear()
	_spine_bone = -1
	_thigh_bone = -1
	_mount()

## the gun models ride the body's RightHand bone; only the current frame's is visible
func _mount() -> void:
	if _hand:
		_hand.queue_free()
		_hand = null
	var rig: Node3D = player.rig
	if not rig or not rig.skeleton:
		return
	var sk: Skeleton3D = rig.skeleton
	var hb := -1
	for i in sk.get_bone_count():
		if sk.get_bone_name(i).ends_with("RightHand"):
			hb = i
			break
	if hb < 0:
		return
	_hand = BoneAttachment3D.new()
	_hand.bone_idx = hb
	sk.add_child(_hand)
	# the bone's world scale is undone so the gun stays metric (OperatorModel.tsx attachWeapons)
	var ws := _hand.global_transform.basis.get_scale().y
	_held = Node3D.new()
	_held.scale = Vector3.ONE / maxf(ws, 1e-4)
	_held.rotation.y = PI
	_hand.add_child(_held)
	_rack = Node3D.new()
	_rack.top_level = true
	add_child(_rack)
	for bone in sk.get_bone_count():
		var bn := sk.get_bone_name(bone)
		if bn.ends_with("Spine2") or (_spine_bone < 0 and bn.ends_with("Spine1")):
			_spine_bone = bone
		elif bn.ends_with("RightUpLeg"):
			_thigh_bone = bone
	for f in Weapons.ORDER:
		_ensure_model(f)
	_show_current()

## a frame's model in the hand node (loaded once, when a view's kit or the worn gear first carries it)
func _ensure_model(f: String) -> void:
	if _models.has(f) or not _held:
		return
	var m: Node3D
	if f == "BOW":
		m = _make_bow()
	else:
		var path: String = MODELS + String(Weapons.FRAMES[f].model)
		if not ResourceLoader.exists(path):
			return
		m = (load(path) as PackedScene).instantiate() as Node3D
	_held.add_child(m)
	_models[f] = m
	m.set_meta("mid", _model_box(m).get_center())   # before the attachments: a laser beam's mesh would swell the box
	_attach(m, f)

## the combat bow (no authored model yet): a dark recurve — riser, two limbs swept back at the tips, a glowing string —
## held upright with the arrow along +Z like a barrel; the nocked arrow shows while the string is drawn
func _make_bow() -> Node3D:
	var root := Node3D.new()
	root.name = "Bow"
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(0.13, 0.14, 0.16)
	metal.metallic = 0.7
	metal.roughness = 0.35
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color(0.4, 0.9, 1.0)
	glow.emission_enabled = true
	glow.emission = Color(0.4, 0.9, 1.0)
	glow.emission_energy_multiplier = 2.5
	glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var riser := MeshInstance3D.new()
	var rb := BoxMesh.new()
	rb.size = Vector3(0.035, 0.26, 0.05)
	riser.mesh = rb
	riser.material_override = metal
	root.add_child(riser)
	var tips: Array[Vector3] = []
	for sgn in [1.0, -1.0]:
		# each limb in two pieces: out from the riser, then the recurved tip bent forward
		var a := Vector3(0, 0.13 * sgn, 0.0)
		var b := Vector3(0, 0.44 * sgn, -0.1)
		var c := Vector3(0, 0.56 * sgn, -0.04)
		for seg in [[a, b, 0.018], [b, c, 0.012]]:
			var p0: Vector3 = seg[0]
			var p1: Vector3 = seg[1]
			var limb := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = float(seg[2]) * 0.8
			cm.bottom_radius = float(seg[2])
			cm.height = p0.distance_to(p1)
			cm.radial_segments = 8
			cm.rings = 1
			limb.mesh = cm
			limb.material_override = metal
			limb.position = (p0 + p1) * 0.5
			limb.basis = Basis(Quaternion(Vector3.UP, (p1 - p0).normalized()))
			root.add_child(limb)
		tips.append(c)
		var trim := MeshInstance3D.new()
		var tb := BoxMesh.new()
		tb.size = Vector3(0.012, 0.2, 0.006)
		trim.mesh = tb
		trim.material_override = glow
		trim.position = Vector3(0.0, 0.3 * sgn, -0.05 + 0.025)
		trim.rotation.x = 0.33 * sgn
		root.add_child(trim)
	var string := MeshInstance3D.new()
	var sm := BoxMesh.new()
	sm.size = Vector3(0.004, tips[0].y - tips[1].y, 0.004)
	string.mesh = sm
	string.material_override = glow
	string.position = Vector3(0, 0, -0.06)
	string.name = "String"
	root.add_child(string)
	var arrow := MeshInstance3D.new()
	var am := CylinderMesh.new()
	am.top_radius = 0.006
	am.bottom_radius = 0.006
	am.height = 0.75
	arrow.mesh = am
	arrow.material_override = glow
	arrow.rotation.x = PI * 0.5
	arrow.position = Vector3(0, 0, 0.2)
	arrow.name = "Arrow"
	arrow.visible = false
	root.add_child(arrow)
	return root

## aim help on a touch screen while the trigger is held: the camera eases toward the nearest live foe within 14° of the
## crosshair, faster the closer it already is (a thumb cannot track a strafing trooper the way a mouse can)
func _pull_aim(dt: float, cam: Camera3D) -> void:
	if not cam or not is_instance_valid(cam) or not player:
		return
	var from := cam.global_position
	var dir := -cam.global_transform.basis.z
	var best: Target = null
	var best_a := deg_to_rad(14.0)
	for t in targets:
		if not t.alive():
			continue
		if t.has_meta("cover") or t.has_meta("prop") or t.has_meta("cover_box") or (t.has_meta("roster") and t.get_meta("enemy").team == t.get_meta("roster").operator_team):
			continue
		var c: Vector3 = t.box.get_center() + Vector3(0, t.box.size.y * 0.15, 0)
		var to_c := c - from
		if to_c.length() > 80.0 or to_c.length() < 1.0:
			continue
		var a := dir.angle_to(to_c)
		if a < best_a:
			best_a = a
			best = t
	if best == null:
		return
	var c2: Vector3 = best.box.get_center() + Vector3(0, best.box.size.y * 0.15, 0)
	var d2 := (c2 - from).normalized()
	var want_yaw := atan2(-d2.x, -d2.z)
	var want_pitch := asin(clampf(d2.y, -1.0, 1.0))
	var k := minf(1.0, dt * lerpf(9.0, 3.0, best_a / deg_to_rad(14.0)))
	player.cam_yaw = lerp_angle(player.cam_yaw, want_yaw, k)
	player.cam_pitch = clampf(lerpf(player.cam_pitch, want_pitch, k * 0.6), -0.9, 0.45)

## the gun rides the right hand but points where the crosshair does. Hung off the hand bone at a fixed angle it followed
## the unarmed walk and run clips' arm swing, so it pointed at the sky, behind the back or hung upside down (owner's phone
## test, Nov 9: "my gun was upside down"); now the barrel aims at the crosshair's point from wherever the hand is
func _point_gun(cam: Camera3D) -> void:
	if not _held or not _hand or holstered or not cam or not is_instance_valid(cam):
		return
	# a swing, a dodge or a fall: the gun in hand goes out of sight (Destiny's melee does the same), back when it ends
	var stow: bool = (close != null and close.phase != "") or (player != null and player.has_method("dodging") and player.dodging()) or (roster != null and float(roster.down) > 0.0)
	var lm0: Node3D = _models.get(gun().frame)
	if lm0:
		lm0.visible = not stow
	if stow:
		return
	var at := _hand.global_position
	var dir := aim_point(cam) - at
	if dir.length() < 0.5:
		dir = -cam.global_transform.basis.z
	dir = dir.normalized()
	if absf(dir.y) > 0.98:
		return
	var b := Basis.looking_at(-dir, Vector3.UP)
	var g: Weapons.Gun = gun()
	if g.reloading > 0.0:
		# the reload tilt: the gun rolls onto its side and dips (the LMG lifts) while the hands work, out and back in
		var u := maxf(g.reload_progress(), 0.0)
		var w := smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.85, 1.0, u))
		var pitch := (-0.35 if g.frame == "LMG" else (0.2 if g.frame == "SIDEARM" else 0.45)) * w
		var roll := (0.15 if g.frame in ["HEAVY", "LMG"] else 0.7) * w
		b = b * Basis(Vector3(0, 0, 1), roll) * Basis(Vector3(1, 0, 0), pitch)
	_held.global_transform = Transform3D(b, at)
	if g.frame == "BOW" and lm0:
		var pull: float = g.draw_frac()
		var st: Node3D = lm0.get_node_or_null("String")
		var ar: Node3D = lm0.get_node_or_null("Arrow")
		if st:
			st.position.z = -0.06 - 0.32 * pull
		if ar:
			ar.visible = pull > 0.05
			ar.position.z = 0.2 - 0.32 * pull
	# the laser on the gun in hand reaches to where it points, while the gun is in the fight
	var lm: Node3D = _models.get(gun().frame)
	if lm and lm.has_meta("laser"):
		var beam: Node3D = lm.get_meta("laser")
		beam.visible = warm < 2.0
		if beam.visible:
			var reach := clampf(beam.global_position.distance_to(aim_point(cam)), 0.3, 60.0)
			beam.scale = Vector3(1.0, 1.0, reach)

## the gun in hand and the rest worn (asset catalog §5 holsters): the first other long gun slung across the back, a
## sidearm or SMG in the right thigh holster; guns not carried are hidden. Unarmed, nothing shows.
func _show_current() -> void:
	_slung.clear()
	var carried := {}
	for g in guns:
		carried[g.frame] = true
		_ensure_model(g.frame)
	var back_taken := false
	var thigh_taken := false
	for f in _models:
		var m: Node3D = _models[f]
		var place := ""
		if not holstered and carried.has(f):
			if f == gun().frame:
				place = "hand"
			elif f in ["SIDEARM", "SMG", "PISTOL"] and not thigh_taken and _thigh_bone >= 0:
				place = "thigh"
				thigh_taken = true
			elif not (f in ["SIDEARM", "SMG", "PISTOL"]) and not back_taken and _spine_bone >= 0:
				place = "back"
				back_taken = true
		var parent: Node3D = _held if place == "hand" or place == "" else _rack
		if m.get_parent() != parent:
			m.get_parent().remove_child(m)
			parent.add_child(m)
			m.transform = Transform3D.IDENTITY
		m.visible = place != ""
		if place == "back" or place == "thigh":
			_slung[f] = place
		if m.has_meta("laser"):
			(m.get_meta("laser") as Node3D).visible = false
	_place_holsters()

func set_holstered(on: bool) -> void:
	holstered = on
	_show_current()

## the worn weapons from the gear (gear_store.gd loadout): one gun per worn slot, its item's name and power multiplier
func set_loadout(list: Array) -> void:
	if list.is_empty():
		return
	var was := gun().frame if not guns.is_empty() else ""
	guns.clear()
	for w in list:
		var f := Weapons.frame_for(w)
		var g := Weapons.Gun.new(f)
		g.label = String(w.name)
		g.mult = float(w.mult)
		g.element = String(w.get("element", "KINETIC")).to_upper()
		g.rarity = String(w.get("rarity", ""))
		g.perks = Weapons.item_perks(String(w.get("id", w.name)), f, g.rarity)
		guns.append(g)
	current = 0
	for i in guns.size():
		if guns[i].frame == was:
			current = i
			break
	_show_current()

func next_weapon() -> void:
	if player and player.rig and player.rig.action and player.rig.action.current() == "reload":
		player.rig.action.stop()
	gun().cancel_reload()
	current = (current + 1) % guns.size()
	gun().draw()
	_show_current()
	_card()

## the muzzle, world space (the viewmodel's muzzle sits 0.8 m down the barrel, further for the sniper)
func muzzle() -> Vector3:
	if _held:
		var dz := 0.8 + float(gun().def().muzzle_dz)
		return _held.global_transform * Vector3(0, 0.07, dz)
	return player.eye() + Vector3(0, -0.2, 0)

## where the crosshair points: the camera's forward ray, stopped by the first obstacle or target, else far away
func aim_point(cam: Camera3D) -> Vector3:
	var from := cam.global_position
	var dir := -cam.global_transform.basis.z
	# only what lies past the operator counts: a box between the camera and the operator's shoulder (a wall the camera
	# backed against, a parked car behind) pulled the aim point to the camera and every shot went sideways
	var near := from.distance_to(player.eye()) + 0.4 if player else 1.5
	var best := 400.0
	for b in obstacles:
		var p: Variant = b.intersects_ray(from, dir)
		if p != null:
			var dd := from.distance_to(p)
			if dd > near:
				best = minf(best, dd)
			elif b.has_point(from + dir * (near + 0.1)):
				best = minf(best, near + 0.1)     # the box reaches past the operator: it is the first thing hit
	for t in targets:
		if t.alive():
			var p2: Variant = t.box.intersects_ray(from, dir)
			if p2 != null and from.distance_to(p2) > near:
				best = minf(best, from.distance_to(p2))
	# aim help on a touch screen: a live target within `assist_deg` of the crosshair, nearer than what the ray hits, is
	# where the shot goes (thumbs cannot hold a crosshair on a strafing trooper the way a mouse can)
	if assist_deg > 0.0:
		var pick: Target = null
		var pick_a := deg_to_rad(assist_deg)
		for t in targets:
			if not t.alive():
				continue
			if t.has_meta("cover") or t.has_meta("prop") or t.has_meta("cover_box") or (t.has_meta("roster") and t.get_meta("enemy").team == t.get_meta("roster").operator_team):
				continue     # an ally bot, or a crate
			var c: Vector3 = t.box.get_center()
			var to_c := c - from
			var dc := to_c.length()
			if dc <= near or dc > minf(best + 1.0, 120.0):
				continue
			var a := dir.angle_to(to_c)
			if a < pick_a:
				pick_a = a
				pick = t
		if pick:
			return pick.box.get_center() + Vector3(0, pick.box.size.y * 0.15, 0)
	return from + dir * maxf(best, near + 0.1)

## the weapon card on a swap: name, category, element, perks
func _card() -> void:
	var c := _controls()
	if not c or not c.has_method("toast") or guns.is_empty() or holstered:
		return
	var g: Weapons.Gun = gun()
	var st := Weapons.stats(g.frame, g.mult, g.element, g.perks)
	var line := "%s · %s" % [g.display_name().to_upper(), st.category]
	if g.element != "KINETIC":
		line += " · " + g.element
	if not (st.perks as Array).is_empty():
		line += " · " + ", ".join(st.perks)
	c.toast(line)

## aiming: the eased blend, the camera's zoom and the body's slower walk (the stance itself is operator_player.sights)
func _step_ads(dt: float, cam: Camera3D) -> void:
	var c := _controls()
	var want := c != null and c.has_method("ads") and bool(c.ads())
	var g: Weapons.Gun = gun()
	aiming = want and not holstered and g.drawing <= 0.0 and g.reloading <= 0.0 and not (close and close.busy())
	ads = move_toward(ads, 1.0 if aiming else 0.0, dt / maxf(g.ads_time(), 0.05))
	_still_ads = _still_ads + dt if ads >= 1.0 else 0.0
	if player:
		player.ads_blend = ads
		if "sights" in player:
			player.sights = ads > 0.5
	if cam and is_instance_valid(cam):
		if _base_fov <= 0.0:
			_base_fov = cam.fov
		cam.fov = lerpf(_base_fov, _base_fov * float(g.def().get("zoom", 0.8)), ads)

func step(dt: float, cam: Camera3D, trigger: bool, reload: bool, moving_speed: float) -> void:
	warm += dt
	_step_ads(dt, cam)
	if player and "armed_pose" in player:
		player.armed_pose = not holstered
	if trigger and assist_deg > 0.0 and not holstered:
		_pull_aim(dt, cam)
	_point_gun(cam)
	if holstered:
		trigger = false
		reload = false
	if reload and gun().reload():
		Sound.sfx("reload", -4.0)
	for t in targets:
		t.since += dt
		t.stun = maxf(0.0, t.stun - dt)
		t.mark = maxf(0.0, t.mark - dt)
		t.weaken = maxf(0.0, t.weaken - dt)
		t.slow = maxf(0.0, t.slow - dt)
		if t.slow <= 0.0:
			t.cryo_hits = 0
		if t.burn > 0.0:
			t.burn -= dt
			if t.alive():
				t.take(t.burn_dps * dt, true)
				if t.hp <= 0.0:
					_down_target(t, t.box.get_center(), false)
		if t.shield_max > 0.0 and t.alive() and t.since > SHIELD_DELAY and t.shield < t.shield_max:
			t.shield = minf(t.shield_max, t.shield + SHIELD_RATE * dt)
	var was_reloading := gun().reloading > 0.0
	var empty_before := gun().mag <= 0
	if close and close.busy():
		trigger = false     # a swing, a dodge or the guard holds the trigger
	var n := gun().step(dt, trigger)
	if trigger and empty_before and not was_reloading and gun().reloading > 0.0:
		Sound.sfx("dry", -6.0)
		Sound.sfx("reload", -4.0)
	if not was_reloading and gun().reloading > 0.0:
		_drop_mag()
		var cc := _controls()
		if cc and cc.has_method("drop_ads"):
			cc.drop_ads()
		# the gun's own reload on the body (combat_clips.gd RELOADS), stretched to its reload time
		if player and player.rig and player.rig.has_method("act_reload") and not (player.rig.action and player.rig.action.busy() and player.rig.action.current() != "reload"):
			player.rig.act_reload(gun().frame, gun().reload_full)
	_place_holsters()
	if ordnance:
		ordnance.step(dt)
	_step_grenades(dt, cam)
	_step_grapple(cam)
	if close:
		close.step(dt, cam)
	for i in n:
		var cue: String = SHOT_CUES.get(gun().frame, "rifle")
		if cue != "":
			Sound.sfx(cue, -2.0 if gun().frame != "BOW" else -8.0, 0.05)
		if gun().frame != "BOW":
			_muzzle_flash(cam)
		if gun().def().has("projectile"):
			_launch(cam)
			continue
		for k in Weapons.pellets(gun().frame):
			_fire_one(cam, moving_speed)
		if not gun().def().has("draw"):
			_eject(cam)
	# tracers and the flash fade
	var keep: Array = []
	for tr in _tracers:
		tr.t -= dt
		if tr.t <= 0.0:
			if tr.has("casing"):
				_casings -= 1
			if tr.has("mag"):
				_mags -= 1
			if tr.has("debris"):
				_debris_n -= 1
			tr.node.queue_free()
		else:
			if tr.has("vel"):
				# a droplet falls; a casing tumbles, lands and lies there; a splash just fades over its life
				var v: Vector3 = tr.vel
				var nd := tr.node as Node3D
				if v != Vector3.ZERO:
					v.y -= 9.8 * dt
					nd.global_position += v * dt
					if tr.has("spin"):
						nd.rotation += Vector3(tr.spin) * dt
						if nd.global_position.y <= float(tr.floor) + 0.02 and v.y < 0.0:
							nd.global_position.y = float(tr.floor) + 0.02
							v = Vector3(v.x * 0.4, -v.y * 0.25, v.z * 0.4) if absf(v.y) > 0.6 else Vector3.ZERO
							if v == Vector3.ZERO:
								nd.rotation = Vector3(PI * 0.5, nd.rotation.y, 0)
					tr.vel = v
				(tr.node as MeshInstance3D).transparency = 1.0 - clampf(tr.t / float(tr.life), 0.0, 1.0) if not tr.has("spin") else (0.0 if tr.t > 0.4 else 1.0 - tr.t / 0.4)
			else:
				(tr.node as MeshInstance3D).transparency = 1.0 - clampf(tr.t / 0.09, 0.0, 1.0)
			keep.append(tr)
	_tracers = keep
	if _flash:
		_flash_t -= dt
		_flash.visible = _flash_t > 0.0
	for t in targets:
		if not t.alive() and not (t.has_meta("cover_box") or t.has_meta("prop")):
			t.down -= dt
			if t.down <= 0.0:
				t.hp = t.max_hp
				t.shield = t.shield_max
				if t.node:
					t.node.visible = true
func _fire_one(cam: Camera3D, moving_speed: float) -> void:
	shots_fired += 1
	warm = 0.0
	player.combat_hold = 1.5
	var d: Dictionary = gun().def()
	var from := muzzle()
	var to := aim_point(cam)
	var dir := (to - from).normalized()
	# standing still steadies the gun toward its aimed spread; running opens it to the hip spread
	var steady := clampf(moving_speed / 5.4, 0.0, 1.0)
	var spread := float(d.spread) * lerpf(float(d.ads_spread), 1.0, steady)
	# down the sights the gun holds its aimed spread (a little looser on the move); the string's bloom opens it a touch
	spread = lerpf(spread, float(d.spread) * float(d.ads_spread) * (1.0 + 0.4 * steady), ads)
	spread *= 1.0 + minf(gun().shot_i, 8) * 0.03 * (1.0 - float(d.get("stability", 50)) / 100.0)
	var side := dir.cross(Vector3.UP).normalized()
	var up := side.cross(dir)
	dir = (dir + side * _rng.randfn(0.0, spread) + up * _rng.randfn(0.0, spread)).normalized()
	_kick()
	# the body squares up to where it shoots
	player.heading = lerp_angle(player.heading, atan2(dir.x, dir.z), 0.6)
	# the first thing along the bolt: an obstacle or a target
	var dist := 400.0
	var hit_t: Target = null
	for b in obstacles:
		var p: Variant = b.intersects_ray(from, dir)
		if p != null:
			dist = minf(dist, from.distance_to(p))
	for t in targets:
		if not t.alive():
			continue
		var p2: Variant = t.box.intersects_ray(from, dir)
		# a tie goes to the target: destructible cover sits in the obstacle list too (the bots' sight lines), with the
		# very same box
		if p2 != null and from.distance_to(p2) <= dist + (0.02 if t.has_meta("cover_box") else 0.001):
			dist = from.distance_to(p2)
			hit_t = t
	var end := from + dir * dist
	tracer(from, end)
	# destructible cover: the street's (`cover_box`, gunplay.add_cover) and Killbox's props (`prop`, arena_view.gd)
	var cover := hit_t != null and (hit_t.has_meta("cover_box") or hit_t.has_meta("prop"))
	if cover:
		spark(end, false)
		_debris(end, 2, hit_t.get_meta("cover_color", Color(0.5, 0.5, 0.5)), 0.05)
	elif hit_t == null or hit_t.shield <= 0.0:
		spark(end, hit_t != null, Color(hit_t.get_meta("blood", Color(0.85, 0.1, 0.08))) if hit_t != null else Color.WHITE)
	if hit_t == null and gun().frame == "HEAVY":
		_debris(end, 6, Color(0.42, 0.4, 0.38), 0.12)     # a cannon round throws up chunks of whatever it hit
	if hit_t:
		# cover has no head, counts no kill and scavenges nothing; it stays down once broken
		var head := not cover and end.y > hit_t.box.position.y + hit_t.box.size.y * 0.82
		var g: Weapons.Gun = gun()
		var el := Weapons.element_of(g.element)
		var dmg: float = Weapons.damage(g.frame, dist, head) * g.damage_mult() * (MARK_MULT if hit_t.mark > 0.0 else 1.0)
		if g.def().has("draw"):
			dmg *= g.last_charge
		if not cover:
			if hit_t.shield <= 0.0:
				dmg *= float(el.unshielded)
			if hit_t.weaken > 0.0:
				dmg *= 1.2
			if head and g.has_perk("box_breathing") and _still_ads >= 1.0:
				dmg *= 1.3
				_still_ads = 0.0
			dmg *= g.on_hit(head)
		var energy: bool = g.frame == "FUSION" or g.element != "KINETIC"
		var res: Dictionary = hit_t.take(dmg, energy, float(el.shield) if g.element != "KINETIC" else 1.5)
		if not cover:
			_element(hit_t, g, end)
		if float(res.shield) > 0.0:
			_shield_flash(hit_t, bool(res.broke))
		if cover:
			if not hit_t.alive():
				if hit_t.has_meta("cover_box"):
					_break_cover(hit_t)
				else:
					# a Killbox prop: arena_view.gd takes it out of arena.boxes() on `killed`
					hit_t.hp = 0.0
					hit_t.down = INF
					if hit_t.node:
						hit_t.node.visible = false
					debris(hit_t.box.get_center(), hit_t.box.size, Color(hit_t.get_meta("blood", Color(0.7, 0.65, 0.55))))
					Sound.sfx_at("debris", end, from, -4.0)
					killed.emit(hit_t)
			return
		hits_landed += 1
		hit.emit(hit_t, dmg, head)
		Sound.sfx_at("headshot" if head else "hit", end, from, -3.0)
		if hit_t.hp <= 0.0:
			_down_target(hit_t, end, head)

## a foe down to a gun: the count, the sound, the resupply, the perks that feed on kills (and burst on precision ones)
func _down_target(t: Target, at: Vector3, head: bool) -> void:
	t.hp = 0.0
	t.down = 5.0
	t.burn = 0.0
	if t.node:
		t.node.visible = false
	kills += 1
	Sound.sfx_at("down", at, player.position if player else at, -4.0)
	scavenge(t)
	if not guns.is_empty():
		var g: Weapons.Gun = gun()
		g.on_kill(head)
		if head and ordnance and (g.has_perk("firefly") or g.has_perk("dragonfly")):
			ordnance.pop(t.box.get_center(), 3.0 if g.has_perk("firefly") else 4.0, 40.0)
		if g.has_perk("devour") and roster and float(roster.down) <= 0.0:
			roster.hull = minf(float(roster.hull_max), float(roster.hull) + 25.0)
			roster.shield = float(roster.shield_max)
	killed.emit(t)

## the gun's kick (weapons.gd recoil_kick): up into the camera's pitch, which settles back, and a sideways drift into
## its yaw, which stays (the pattern to learn and pull against)
func _kick() -> void:
	var g: Weapons.Gun = gun()
	var k := Weapons.recoil_kick(g.frame, g.shot_i, ads > 0.5, g.stability_bonus())
	player.recoil = minf(player.recoil + k.y, 0.25)
	player.cam_yaw += k.x * 0.6

## a rocket or a grenade-launcher shell: launched along the crosshair from the muzzle, flown by the ordnance node
func _launch(cam: Camera3D) -> void:
	shots_fired += 1
	warm = 0.0
	player.combat_hold = 1.5
	var g: Weapons.Gun = gun()
	var from := muzzle()
	var dir := (aim_point(cam) - from).normalized()
	var proj: Dictionary = g.def().projectile
	if String(proj.kind) == "gl":
		dir = (dir + Vector3(0, 0.12, 0)).normalized()     # a lob over the crosshair, the shell drops onto it
	_kick()
	player.heading = lerp_angle(player.heading, atan2(dir.x, dir.z), 0.6)
	var dmg: float = Weapons.BASE_DAMAGE * float(g.def().damage) * g.damage_mult()
	ordnance.fire_launch(from, dir, proj, dmg, { "cluster": g.has_perk("cluster_bomb") })

## the element's mark on a hit (weapons.gd ELEMENTS): burn, a jolt arcing on, weaken, chill → freeze; Tempest arcs too
func _element(t: Target, g: Weapons.Gun, at: Vector3) -> void:
	var el := Weapons.element_of(g.element)
	if el.has("burn"):
		t.burn = float(el.burn_s)
		t.burn_dps = float(el.burn)
	if el.has("weaken"):
		t.weaken = float(el.weaken_s)
	if el.has("slow"):
		t.slow = float(el.slow_s)
		t.cryo_hits += 1
		if t.cryo_hits >= int(el.freeze_at):
			t.cryo_hits = 0
			t.stun = maxf(t.stun, float(el.freeze_s))
			_dot(at, Color(0.7, 0.95, 1.0), 0.45, 0.6)
	var jumps := int(el.get("chain_n", 0)) if el.has("chain") and randf() < 0.35 else 0
	if g.has_perk("tempest"):
		jumps = maxi(jumps, 2)
	if jumps > 0:
		_chain(t, Weapons.BASE_DAMAGE * float(g.def().damage) * g.damage_mult() * 0.35, jumps, float(el.get("chain_r", 5.0)))

## an arc leaps from `from` to the nearest live foes in reach, one after another
func _chain(from: Target, dmg: float, jumps: int, reach: float) -> void:
	var at := from.box.get_center()
	var done := [from]
	for j in jumps:
		var best: Target = null
		var bd := reach
		for t in targets:
			if done.has(t) or not t.alive() or t.has_meta("cover_box") or t.has_meta("prop"):
				continue
			if t.has_meta("roster") and t.get_meta("enemy").team == t.get_meta("roster").operator_team:
				continue
			var d := t.box.get_center().distance_to(at)
			if d < bd:
				bd = d
				best = t
		if best == null:
			return
		var to := best.box.get_center()
		tracer(at, to, Color(0.5, 0.9, 1.0))
		best.take(dmg, true)
		best.stun = maxf(best.stun, 0.4)
		hit.emit(best, dmg, false)
		if best.hp <= 0.0:
			_down_target(best, to, false)
		done.append(best)
		at = to

## the grenades: J / K on the desk, GRENADE / ⟳ on the phone (touch_controls.gd, found by its group), and the HUD line
func _step_grenades(dt: float, cam: Camera3D) -> void:
	if not grenades:
		return
	var c: Node = controls
	if c == null and is_inside_tree():
		c = get_tree().get_first_node_in_group("touch_controls")
	var throw := false
	var cyc := false
	if c:
		throw = c.take_grenade() and grenades_on and not holstered
		cyc = c.take_cycle_grenade()
	grenades.step(dt, cam, throw, cyc)
	if c:
		c.show_grenade(grenades.hud() if grenades_on and not holstered else {})

## the grapple (operator_player.gd grapple_to): the GRAPPLE button / G anchors it on the first box within
## GRAPPLE_RANGE along the crosshair (never on a trooper) and reels the operator there; the cable is drawn from the
## hand while it pulls
const GRAPPLE_RANGE := 34.0
var _cable: MeshInstance3D

func _step_grapple(cam: Camera3D) -> void:
	var c: Node = controls
	if c == null and is_inside_tree():
		c = get_tree().get_first_node_in_group("touch_controls")
	if c and c.has_method("take_grapple") and c.take_grapple() and player and player.has_method("grapple_to"):
		var anchor := _grapple_anchor(cam)
		if anchor == Vector3.INF or not player.grapple_to(anchor):
			if c.has_method("toast"):
				c.toast("No anchor in reach" if anchor == Vector3.INF else "")
	if player and player.has_method("grappling") and player.grappling():
		if _cable == null:
			_cable = MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(0.03, 0.03, 1.0)
			_cable.mesh = bm
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.9, 0.95, 1.0)
			m.emission_enabled = true
			m.emission = Color(0.5, 0.8, 1.0)
			m.emission_energy_multiplier = 2.0
			m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			_cable.material_override = m
			_cable.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(_cable)
		var from: Vector3 = player.global_position + Vector3(0, 1.3, 0)
		var to: Vector3 = player.grapple_anchor
		var len := from.distance_to(to)
		_cable.visible = len > 0.1
		if len > 0.1:
			_cable.global_position = (from + to) * 0.5
			_cable.look_at(to, Vector3.UP if absf((to - from).normalized().y) < 0.99 else Vector3.RIGHT)
			_cable.scale = Vector3(1, 1, len)
	elif _cable:
		_cable.visible = false

## the first box face the crosshair ray meets within range, past the operator; INF when nothing is in reach
func _grapple_anchor(cam: Camera3D) -> Vector3:
	var from := cam.global_position
	var dir := -cam.global_transform.basis.z
	var near := from.distance_to(player.eye()) + 0.4 if player else 1.5
	var best := GRAPPLE_RANGE + near
	var hit := Vector3.INF
	for b in obstacles:
		var p: Variant = b.intersects_ray(from, dir)
		if p != null:
			var dd := from.distance_to(p)
			if dd > near and dd < best:
				best = dd
				hit = p
	return hit

## grenade damage on a Target (grenades.gd): the same hit / killed path as a bolt, so tallies, kills and drops follow
func grenade_hit(t: Target, dmg: float, at: Vector3) -> void:
	if not t.alive():
		return
	dmg *= MARK_MULT if t.mark > 0.0 else 1.0
	var res: Dictionary = t.take(dmg, false)
	if float(res.shield) > 0.0:
		_shield_flash(t, bool(res.broke))
	hit_kind = "GRENADE"
	hit.emit(t, dmg, false)
	hit_kind = ""
	if t.hp <= 0.0:
		t.hp = 0.0
		t.down = 5.0
		if t.node:
			t.node.visible = false
		kills += 1
		Sound.sfx_at("down", at, player.position if player else at, -4.0)
		scavenge(t)
		killed.emit(t)

## a melee blow (close_combat.gd): the same hit / killed path as a bolt, plus the shove and the poise it carries
func melee_hit(t: Target, dmg: float, at: Vector3, knock_v: Vector3, poise: float, heavy_blow := false, energy := false) -> void:
	if not t.alive():
		return
	dmg *= MARK_MULT if t.mark > 0.0 else 1.0
	var res: Dictionary = t.take(dmg, energy)
	if float(res.shield) > 0.0:
		_shield_flash(t, bool(res.broke))
	t.knock += knock_v
	t.impact += poise
	t.heavy = t.heavy or heavy_blow
	hits_landed += 1
	hit_kind = "MELEE"
	hit.emit(t, dmg, false)
	hit_kind = ""
	spark(at, true, Color(t.get_meta("blood", Color(0.85, 0.1, 0.08))))
	Sound.sfx_at("hit", at, player.position if player else at, -2.0)
	if t.hp <= 0.0:
		t.hp = 0.0
		t.down = 5.0
		if t.node:
			t.node.visible = false
		kills += 1
		Sound.sfx_at("down", at, player.position if player else at, -4.0)
		scavenge(t)
		if not guns.is_empty():
			gun().on_kill(false, true)
		killed.emit(t)

func tracer(from: Vector3, to: Vector3, col := Color(1.0, 0.85, 0.55)) -> void:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	var len := from.distance_to(to)
	box.size = Vector3(0.02, 0.02, maxf(len - 0.3, 0.05))
	mi.mesh = box
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = 3.0
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = m
	add_child(mi)
	mi.global_position = (from + to) * 0.5
	if len > 0.05:
		mi.look_at(to, Vector3.UP if absf((to - from).normalized().dot(Vector3.UP)) < 0.99 else Vector3.RIGHT)
	_tracers.append({ "node": mi, "t": 0.09 })
	# the round itself, a bright streak running down the line at bullet speed (what reads as a shot in CoD / Fortnite)
	if len > 2.0:
		var st := MeshInstance3D.new()
		var sb := BoxMesh.new()
		sb.size = Vector3(0.045, 0.045, minf(3.2, len * 0.4))
		st.mesh = sb
		st.material_override = _streak_mat(col)
		st.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(st)
		st.global_position = from
		st.look_at(to, Vector3.UP if absf((to - from).normalized().dot(Vector3.UP)) < 0.99 else Vector3.RIGHT)
		_streaks.append({ "node": st, "from": from, "to": to, "d": 0.0, "len": len })
	if not _flash:
		_flash = OmniLight3D.new()
		_flash.light_color = Color(1.0, 0.8, 0.5)
		_flash.light_energy = 3.0
		_flash.omni_range = 4.0
		add_child(_flash)
	if col.r > 0.9:
		_flash.global_position = from
		_flash_t = 0.05

## a hit's spark. On a body the colour is the target's `blood` meta (troopers red, machines cyan coolant, Fracture
## creatures violet, wildlife green) and the amount follows the gore setting: off — a grey puff; reduced — one spark;
## full — a spray of droplets that fall and a splash that lingers a few seconds
func spark(at: Vector3, flesh: bool, blood := Color(0.85, 0.1, 0.08)) -> void:
	var gore := String(Settings.get_value("gore"))
	if flesh and gore == "off":
		_dot(at, Color(0.6, 0.6, 0.6, 0.6), 0.08, 0.15)
		return
	_dot(at, blood if flesh else Color(1.0, 0.9, 0.6), 0.06, 0.12)
	if not flesh:
		# the bullet's mark on the surface (asset catalog §5 bullet impacts): a scorched disc that fades over a few seconds
		_dot(at, Color(0.08, 0.07, 0.06, 0.9), 0.07, 5.0, Vector3.ZERO, true)
	if flesh and gore == "full":
		for i in 6:
			var v := Vector3(randf() - 0.5, randf() * 0.8, randf() - 0.5) * 3.0
			_dot(at, blood, 0.03 + randf() * 0.03, 0.45 + randf() * 0.3, v)
		_dot(at - Vector3(0, 0.02, 0), Color(blood.r, blood.g, blood.b, 0.85), 0.16, 4.0, Vector3.ZERO, true)

## a shell casing out of the ejection port (asset catalog §5): a brass sliver thrown to the right and up, falling and
## tumbling for a moment; the fusion frame throws none. Capped so a long burst on the phone stays a few draws.
const CASINGS_MAX := 14
var _casings := 0
func _eject(cam: Camera3D) -> void:
	if gun().frame == "FUSION" or _casings >= CASINGS_MAX:
		return
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.012
	cm.bottom_radius = 0.012
	cm.height = 0.05
	cm.radial_segments = 6
	cm.rings = 1
	mi.mesh = cm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.85, 0.65, 0.25)
	m.metallic = 0.9
	m.roughness = 0.35
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var right := cam.global_transform.basis.x
	mi.global_position = muzzle() - (-cam.global_transform.basis.z) * 0.5 + right * 0.12
	mi.rotation = Vector3(randf() * TAU, randf() * TAU, 0)
	var vel := right * (1.6 + randf() * 0.8) + Vector3.UP * (2.2 + randf()) + (-cam.global_transform.basis.z) * (randf() - 0.5) * 0.6
	_casings += 1
	_tracers.append({ "node": mi, "t": 1.6, "vel": vel, "life": 1.6, "spin": Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 20.0, "floor": player.position.y, "casing": true })

func _dot(at: Vector3, col: Color, r: float, life: float, vel := Vector3.ZERO, flat := false) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * (0.25 if flat else 2.0)
	s.radial_segments = 8
	s.rings = 4
	mi.mesh = s
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = m
	add_child(mi)
	mi.global_position = at
	_tracers.append({ "node": mi, "t": life, "vel": vel, "life": life })

## a prop coming apart (destructible cover, asset catalog §5): a dozen chips of its own colour thrown out of its centre,
## tumbling, landing at its base and fading over a few seconds; a dust puff above
func debris(at: Vector3, size: Vector3, col: Color, n := 12) -> void:
	var floor_y := at.y - size.y * 0.5
	for i in n:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		var k := 0.08 + randf() * 0.16
		bm.size = Vector3(k * (0.6 + randf()), k * 0.5, k * (0.6 + randf()))
		mi.mesh = bm
		var m := StandardMaterial3D.new()
		m.albedo_color = col.darkened(randf() * 0.35)
		m.roughness = 0.9
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mi.material_override = m
		add_child(mi)
		mi.global_position = at + Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * size * 0.6
		var vel := Vector3(randf() - 0.5, 0.4 + randf() * 0.5, randf() - 0.5).normalized() * (2.5 + randf() * 3.0)
		_tracers.append({ "node": mi, "t": 3.0 + randf() * 2.0, "vel": vel, "life": 3.0, "spin": Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 16.0, "floor": floor_y })
	for i in 4:
		_dot(at + Vector3(randf() - 0.5, randf() * 0.5, randf() - 0.5) * size * 0.5, Color(col.r, col.g, col.b, 0.5), 0.25 + randf() * 0.25, 0.7, Vector3(0, 0.6, 0))

## a practice dummy: a post with a plate, standing on the ground at `at`
func add_dummy(at: Vector3, hp := 30.0) -> Target:
	var n := Node3D.new()
	n.position = at
	add_child(n)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.2, 0.21, 0.23)
	var plate := StandardMaterial3D.new()
	plate.albedo_color = Color(0.85, 0.45, 0.12)
	for spec in [[Vector3(0.12, 0.9, 0.12), Vector3(0, 0.45, 0), dark], [Vector3(0.6, 0.9, 0.08), Vector3(0, 1.3, 0), plate], [Vector3(0.3, 0.3, 0.1), Vector3(0, 1.9, 0), plate]]:
		var mi := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = spec[0]
		mi.mesh = b
		mi.position = spec[1]
		mi.material_override = spec[2]
		n.add_child(mi)
	var t := Target.new(AABB(at + Vector3(-0.3, 0, -0.1), Vector3(0.6, 2.05, 0.2)), hp, n)
	targets.append(t)
	return t

## turns the chase camera so the crosshair sits on the target's plate (tests and shots; the player does this by looking)
func aim_at(t: Target, cam: Camera3D) -> void:
	for i in 3:
		var centre := t.box.get_center() + Vector3(0, t.box.size.y * 0.15, 0)
		var dir := (centre - cam.global_position).normalized()
		player.cam_yaw = atan2(-dir.x, -dir.z)
		player.cam_pitch = asin(clampf(dir.y, -1.0, 1.0))
		player._place_camera(1.0)

# --------------------------------------------------------------------------------------------- combat details (§5)
## worn guns follow the body: the back's gun diagonal across the shoulder blades, barrel up; the thigh's barrel down
func _place_holsters() -> void:
	if _slung.is_empty() or not player or not player.rig or not player.rig.skeleton:
		return
	var sk: Skeleton3D = player.rig.skeleton
	var fwd: Vector3 = player.rig.global_transform.basis.z
	fwd.y = 0.0
	if fwd.length() < 0.1:
		return
	fwd = fwd.normalized()
	var right := fwd.cross(Vector3.UP)
	for f in _slung:
		var m: Node3D = _models[f]
		if _slung[f] == "back":
			# centred on the upper back, clear of the armour (owner, Nov 22: the slung rifle cut through the body in a fight):
			# the model's own middle sits 0.3 m behind the spine, steep across the shoulder blades, so a long sniper's stock
			# stops at the hip instead of the knee and a swing's bend no longer pushes it through the chest
			var spine: Transform3D = sk.global_transform * sk.get_bone_global_pose(_spine_bone)
			var back := -fwd
			var up := (spine.basis.y).normalized() if spine.basis.y.length() > 0.1 else Vector3.UP
			var at: Vector3 = spine.origin - up * 0.06 + back * 0.28
			var dir := (up * 0.78 - right * 0.62).normalized()
			var bs := Basis.looking_at(-dir, -fwd)
			var mid: Vector3 = m.get_meta("mid", Vector3.ZERO)
			m.global_transform = Transform3D(bs, at - bs * mid)
		else:
			var at2: Vector3 = sk.global_transform * sk.get_bone_global_pose(_thigh_bone).origin + right * 0.17 - Vector3.UP * 0.14
			var dir2 := (-Vector3.UP + fwd * 0.12).normalized()
			m.global_transform = Transform3D(Basis.looking_at(-dir2, fwd), at2)

## the model's own box (its meshes, in the model's space)
static func _model_box(m: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in m.find_children("*", "MeshInstance3D", true, false):
		var inst := mi as MeshInstance3D
		if not inst.mesh:
			continue
		var xf := Transform3D.IDENTITY
		var n: Node = inst
		while n and n != m:
			xf = (n as Node3D).transform * xf
			n = n.get_parent()
		var b: AABB = xf * inst.mesh.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box

## weapon attachments by frame (asset catalog §5): a red-dot optic on the rifles, SMG and LMG, a laser module under the
## barrel of the rifle, SMG and sidearm (its beam shows while the gun is in the fight), a suppressor on the sidearm
const OPTIC := ["AUTO", "LMG", "SMG", "MARKSMAN"]
const LASER := ["AUTO", "SMG", "SIDEARM", "PISTOL"]
func _attach(m: Node3D, f: String) -> void:
	var b := _model_box(m)
	if b.size.z < 0.1:
		return
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.07, 0.07, 0.08)
	dark.metallic = 0.6
	dark.roughness = 0.45
	if f in OPTIC:
		var zo := b.get_center().z - b.size.z * 0.12
		_part(m, Vector3(0.04, 0.045, 0.09), Vector3(0, b.end.y + 0.022, zo), dark)
		var lens := StandardMaterial3D.new()
		lens.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		lens.albedo_color = Color(1.0, 0.15, 0.1)
		_part(m, Vector3(0.012, 0.012, 0.004), Vector3(0, b.end.y + 0.03, zo - 0.046), lens)
	if f in LASER:
		var z_front := b.end.z - b.size.z * 0.22
		var y_low := b.position.y + b.size.y * 0.32
		_part(m, Vector3(0.028, 0.028, 0.07), Vector3(0, y_low, z_front), dark)
		var beam := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.006, 0.006, 1.0)
		beam.mesh = bm
		var lmat := StandardMaterial3D.new()
		lmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		lmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		lmat.albedo_color = Color(1.0, 0.1, 0.1, 0.45)
		beam.material_override = lmat
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		# a pivot at the module's front: scaling its z stretches the beam forward along the barrel
		var pivot := Node3D.new()
		pivot.position = Vector3(0, y_low, z_front + 0.035)
		m.add_child(pivot)
		beam.position = Vector3(0, 0, 0.5)
		pivot.add_child(beam)
		pivot.visible = false
		m.set_meta("laser", pivot)
	if f == "SIDEARM":
		var sup := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.019
		cm.bottom_radius = 0.019
		cm.height = 0.13
		cm.radial_segments = 10
		sup.mesh = cm
		sup.material_override = dark
		sup.rotation.x = PI * 0.5
		sup.position = Vector3(0, b.end.y - b.size.y * 0.22, b.end.z + 0.06)
		m.add_child(sup)

func _part(m: Node3D, size: Vector3, at: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var bx := BoxMesh.new()
	bx.size = size
	mi.mesh = bx
	mi.material_override = mat
	mi.position = at
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.add_child(mi)

## the spent magazine out of the gun as a reload starts (asset catalog §5): it drops, bounces once and lies a few
## seconds; the fusion rifle's is a glowing cell, the shotgun has none. At most MAGS_MAX on the ground.
const MAGS_MAX := 4
func _drop_mag() -> void:
	if holstered or not _hand or _mags >= MAGS_MAX:
		return
	var f := gun().frame
	if f == "SHOTGUN":
		return
	var mi := MeshInstance3D.new()
	var bx := BoxMesh.new()
	bx.size = Vector3(0.035, 0.11 if f in ["LMG", "HEAVY"] else 0.16, 0.14 if f == "LMG" else 0.08)
	mi.mesh = bx
	var mat := StandardMaterial3D.new()
	if f == "FUSION":
		mat.albedo_color = Color(0.2, 0.8, 1.0)
		mat.emission_enabled = true
		mat.emission = Color(0.2, 0.8, 1.0)
		mat.emission_energy_multiplier = 2.0
	else:
		mat.albedo_color = Color(0.1, 0.1, 0.11)
		mat.metallic = 0.6
		mat.roughness = 0.5
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = _hand.global_position - Vector3(0, 0.12, 0)
	_mags += 1
	_tracers.append({ "node": mi, "t": 6.0, "vel": Vector3(randf() - 0.5, -0.5, randf() - 0.5) * 0.8, "life": 6.0, "spin": Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 6.0, "floor": player.position.y, "mag": true })

## chunks thrown off a hit (asset catalog §5 combat debris): small blocks that fly, tumble, land and lie a few seconds
const DEBRIS_MAX := 40
var _debris_n := 0
func _debris(at: Vector3, n: int, col: Color, size := 0.08) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.roughness = 0.9
	var floor_y: float = player.position.y
	if player.ground_at.is_valid():
		floor_y = float(player.ground_at.call(at.x, at.z))
	for i in n:
		if _debris_n >= DEBRIS_MAX:
			break
		var mi := MeshInstance3D.new()
		var bx := BoxMesh.new()
		var k := size * (0.6 + randf() * 0.8)
		bx.size = Vector3(k, k * (0.5 + randf()), k * (0.6 + randf() * 0.6))
		mi.mesh = bx
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		mi.global_position = at
		var v := Vector3(randf() - 0.5, 0.4 + randf() * 0.8, randf() - 0.5) * (3.0 + size * 20.0)
		_debris_n += 1
		_tracers.append({ "node": mi, "t": 4.0, "vel": v, "life": 4.0, "spin": Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 14.0, "floor": floor_y, "debris": true })
	# a puff of dust where it struck
	_dot(at, Color(col.r, col.g, col.b, 0.35), size * 4.0, 0.5)

## a bolt on an energy shield: the shell lights up round the body (cyan); a collapsing shield bursts in sparks
# ------------------------------------------------------------------------------------------------ shot feel
## (owner, Nov 11: "should feel like call of duty fort nite") the hit marker on the crosshair, the floating damage number,
## the muzzle flash star and the travelling round. Stepped in _process so they run while driving too (a tank kill
## counts through grenade_hit and shows its number).
const STREAK_SPEED := 420.0
var _streaks: Array = []
var _numbers: Array = []
var _streak_mats := {}
var _flash_mat: StandardMaterial3D
var _flash_mesh: QuadMesh

func _streak_mat(col: Color) -> StandardMaterial3D:
	var key := col.to_html()
	if not _streak_mats.has(key):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(1.0, 0.97, 0.85).lerp(col, 0.4)
		m.emission_enabled = true
		m.emission = col
		m.emission_energy_multiplier = 8.0
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_streak_mats[key] = m
	return _streak_mats[key]

func _controls() -> Node:
	if controls:
		return controls
	return get_tree().get_first_node_in_group("touch_controls") if is_inside_tree() else null

func _marker(kind: String) -> void:
	var c := _controls()
	if c and c.has_method("hit_marker"):
		c.hit_marker(kind)

func _hit_feedback(t: Target, dmg: float, head: bool) -> void:
	var shielded := t.shield > 0.0
	_marker("head" if head else ("shield" if shielded else "hit"))
	Sound.sfx("hitmarker_head" if head else "hitmarker", -6.0 if head else -9.0, 0.04)
	if not is_inside_tree() or dmg < 0.5:
		return
	# the number pops off the target: white, yellow on a head, blue into a shield; bigger for big hits
	var l := Label3D.new()
	l.text = str(int(round(dmg)))
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0011
	l.font_size = 46 if dmg < 60.0 else 60
	l.outline_size = 12
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.modulate = Color(1.0, 0.86, 0.2) if head else (Color(0.45, 0.85, 1.0) if shielded else Color.WHITE)
	l.render_priority = 10
	add_child(l)
	var top := t.box.get_center() + Vector3(0, t.box.size.y * 0.55, 0)
	l.global_position = top + Vector3(_rng.randf_range(-0.35, 0.35), _rng.randf_range(0.0, 0.3), _rng.randf_range(-0.35, 0.35))
	_numbers.append({ "node": l, "t": 0.0, "drift": Vector3(_rng.randf_range(-0.4, 0.4), 1.4, _rng.randf_range(-0.4, 0.4)) })

## a four-point star and a lick of fire at the muzzle for one frame or two
func _muzzle_flash(cam: Camera3D) -> void:
	if not _flash_mat:
		_flash_mat = StandardMaterial3D.new()
		_flash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_flash_mat.albedo_color = Color(1.0, 0.8, 0.45)
		_flash_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_flash_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_flash_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		_flash_mat.albedo_texture = _star_texture()
		_flash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_flash_mesh = QuadMesh.new()
		_flash_mesh.size = Vector2(0.55, 0.55)
	var mi := MeshInstance3D.new()
	mi.mesh = _flash_mesh
	mi.material_override = _flash_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var big := 1.8 if gun().frame in ["SHOTGUN", "HEAVY", "SNIPER", "LMG"] else 1.0
	mi.global_position = muzzle() + (-cam.global_transform.basis.z) * 0.12
	mi.scale = Vector3.ONE * _rng.randf_range(0.7, 1.15) * big
	mi.rotation.z = _rng.randf() * TAU
	_streaks.append({ "node": mi, "flash": 0.045 })

var _star_tex: ImageTexture
func _star_texture() -> ImageTexture:
	if _star_tex:
		return _star_tex
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var u := (x + 0.5) / n * 2.0 - 1.0
			var v := (y + 0.5) / n * 2.0 - 1.0
			var r := sqrt(u * u + v * v)
			var spikes := maxf(exp(-absf(u) * 14.0) * (1.0 - absf(v)), exp(-absf(v) * 14.0) * (1.0 - absf(u)))
			var a := clampf(maxf(exp(-r * r * 9.0), spikes * 1.2), 0.0, 1.0)
			img.set_pixel(x, y, Color(1.0, lerpf(0.75, 1.0, a), lerpf(0.4, 0.95, a * a), a))
	_star_tex = ImageTexture.create_from_image(img)
	return _star_tex

func _process(dt: float) -> void:
	if _streaks.is_empty() and _numbers.is_empty():
		return
	dt = minf(dt, 0.05)
	var keep: Array = []
	for s in _streaks:
		var nd: Node3D = s.node
		if s.has("flash"):
			s.flash = float(s.flash) - dt
			if float(s.flash) <= 0.0:
				nd.queue_free()
				continue
			keep.append(s)
			continue
		s.d = float(s.d) + STREAK_SPEED * dt
		if float(s.d) >= float(s.len):
			nd.queue_free()
			continue
		nd.global_position = (s.from as Vector3).lerp(s.to, float(s.d) / float(s.len))
		keep.append(s)
	_streaks = keep
	var nk: Array = []
	for d in _numbers:
		d.t = float(d.t) + dt
		var l: Label3D = d.node
		if float(d.t) >= 0.9:
			l.queue_free()
			continue
		# a pop (big, then settles), a rise that slows, a fade at the end
		var k := float(d.t) / 0.9
		l.global_position += (d.drift as Vector3) * dt * (1.0 - k)
		var pop := 1.0 + 0.6 * exp(-float(d.t) * 18.0)
		l.scale = Vector3.ONE * pop
		l.modulate.a = 1.0 - smoothstep(0.6, 1.0, k)
		l.outline_modulate.a = 0.85 * l.modulate.a
		nk.append(d)
	_numbers = nk

func _shield_flash(t: Target, broke: bool) -> void:
	var c := t.box.get_center()
	_dot(c, Color(0.35, 0.8, 1.0, 0.28), maxf(t.box.size.y, t.box.size.x) * 0.55, 0.16)
	Sound.sfx_at("shield_break" if broke else "shield", c, player.position, -4.0)
	if broke:
		for i in 10:
			_dot(c, Color(0.4, 0.9, 1.0), 0.04, 0.4, Vector3(randf() - 0.5, randf() * 0.7, randf() - 0.5) * 6.0)

## a piece of destructible cover (asset catalog §5): a solid box in the shared obstacle list (at `box_index`) that bolts
## chip and finally break — what shows it hides, the box is parked out of the world, and it falls into debris
func add_cover(box: AABB, node: Node3D, hp: float, box_index: int, col := Color(0.45, 0.45, 0.45)) -> Target:
	var t := Target.new(box, hp, node)
	t.set_meta("cover_box", box_index)
	t.set_meta("cover_color", col)
	targets.append(t)
	return t

func _break_cover(t: Target) -> void:
	t.hp = 0.0
	t.down = INF
	var idx := int(t.get_meta("cover_box"))
	if idx >= 0 and idx < obstacles.size():
		obstacles[idx] = GONE_BOX
	if t.node:
		t.node.visible = false
	var c := t.box.get_center()
	_debris(c, 12, t.get_meta("cover_color", Color(0.45, 0.45, 0.45)), clampf(t.box.size.length() * 0.06, 0.08, 0.22))
	Sound.sfx_at("debris", c, player.position, -2.0)
	cover_broken.emit(t)
