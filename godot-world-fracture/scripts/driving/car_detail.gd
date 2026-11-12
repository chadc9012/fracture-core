extends RefCounted
## Parked-car detail and locks (owner, Nov 11: "Work on vehicles detail and I shouldn't be able to get into every
## vehicle some should locked from owner").
##
## Detail: every fleet file came with one paint, so a block of the same model was a row of identical cars. Each parked
## car now takes a real-world paint from PALETTE (seeded by where it stands, so a block looks the same every visit) with a
## clear coat over it, tinted glass and lamps that can light. Dressed materials are shared per (material, paint), so the
## batching that instances copies of one model still can.
##
## Locks: most parked cars belong to someone. `locked_at(pos)` decides (about three in five, again from where it stands);
## the prompt reads LOCKED, and trying the door sets the alarm off — the warble, hazards flashing (red and blue on a
## security unit) — instead of letting you in. Your own cars (the garage's DRIVE) and the hub's tank and hover-car, put
## out for you, are never locked.

const Sound := preload("res://scripts/audio/sound.gd")
const LOCKED_SHARE := 0.6
const ALARM_SECONDS := 2.4

## [name, colour, metallic] — the common colours on a real street, white / black / silver / grey first, a few bright ones
const PALETTE := [
	["pearl white", Color(0.86, 0.87, 0.88), 0.25],
	["gloss black", Color(0.02, 0.02, 0.025), 0.35],
	["silver", Color(0.62, 0.64, 0.66), 0.85],
	["gunmetal", Color(0.22, 0.23, 0.25), 0.75],
	["midnight blue", Color(0.03, 0.06, 0.18), 0.7],
	["deep red", Color(0.42, 0.02, 0.03), 0.55],
	["racing green", Color(0.03, 0.15, 0.08), 0.6],
	["sand", Color(0.55, 0.47, 0.36), 0.5],
	["burnt orange", Color(0.75, 0.24, 0.04), 0.5],
	["electric blue", Color(0.04, 0.22, 0.7), 0.65],
	["matte grey", Color(0.3, 0.31, 0.32), 0.1],
	["yellow", Color(0.85, 0.62, 0.03), 0.4],
]
## how often each PALETTE entry turns up (the neutrals far more than the bright ones)
const WEIGHTS := [18, 18, 14, 10, 7, 7, 4, 4, 3, 4, 6, 2]

static var _dressed := {}    # "<material id>|<paint>" → the dressed material

static func _hash(p: Vector3, salt: int) -> float:
	return fposmod(sin(floorf(p.x * 2.0) * 12.9898 + floorf(p.z * 2.0) * 78.233 + float(salt) * 37.719) * 43758.5453, 1.0)

static func locked_at(p: Vector3) -> bool:
	return _hash(p, 1) < LOCKED_SHARE

static func paint_at(p: Vector3) -> int:
	var total := 0
	for w in WEIGHTS:
		total += int(w)
	var r := _hash(p, 2) * float(total)
	for i in WEIGHTS.size():
		r -= float(WEIGHTS[i])
		if r < 0.0:
			return i
	return 0

static func kind(mat: Material) -> String:
	if not (mat is StandardMaterial3D):
		return ""
	var n := mat.resource_name.to_lower()
	if n == "paint":
		return "paint"
	if n.contains("glass") or n.contains("glaass"):
		return "lens" if n.contains("light") else "glass"
	if n.begins_with("headlight") or n == "light":
		return "head"
	if n.begins_with("taillight"):
		return "tail"
	if n == "lightred":
		return "red"
	if n == "lightblue":
		return "blue"
	return ""

static func _dress_mat(mat: StandardMaterial3D, k: String, paint: int) -> StandardMaterial3D:
	var key := "%d|%d" % [mat.get_instance_id(), paint if k == "paint" else -1]
	if _dressed.has(key):
		return _dressed[key]
	var m := mat.duplicate() as StandardMaterial3D
	match k:
		"paint":
			var p: Array = PALETTE[paint]
			m.albedo_color = p[1]
			m.metallic = float(p[2])
			m.roughness = 0.42 if String(p[0]).begins_with("matte") else 0.24
			# the clear coat: a sharp second highlight over the base, what makes a car read as freshly polished
			m.clearcoat_enabled = not String(p[0]).begins_with("matte")
			m.clearcoat = 1.0
			m.clearcoat_roughness = 0.04
		"glass":
			# privacy-tinted, glossy: the street reflects in it instead of a see-through grey sheet
			var a := maxf(m.albedo_color.a, 0.55)
			m.albedo_color = Color(m.albedo_color.r * 0.3, m.albedo_color.g * 0.35, m.albedo_color.b * 0.4 + 0.02, a)
			m.roughness = 0.02
			m.metallic_specular = 0.9
		"head", "tail", "red", "blue":
			# lamps carry an emission that is off while parked; the alarm (and a night drive) lights them
			m.emission_enabled = true
			m.emission = { "head": Color(1.0, 0.94, 0.82), "tail": Color(1.0, 0.08, 0.04), "red": Color(1.0, 0.06, 0.1), "blue": Color(0.1, 0.3, 1.0) }[k]
			m.emission_energy_multiplier = 0.0
			if m.albedo_texture:
				m.emission_texture = m.albedo_texture
	_dressed[key] = m
	return m

## repaint and detail a parked car (after StaticBatch.compact, which folds it to one mesh per material)
static func dress(car: Node3D, paint := -1) -> void:
	if paint < 0:
		paint = paint_at(car.global_position if car.is_inside_tree() else car.position)
	car.set_meta("paint", String(PALETTE[paint][0]))
	for n in car.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi.mesh == null:
			continue
		if mi.material_override:
			var k := kind(mi.material_override)
			if k != "" and k != "lens":
				mi.material_override = _dress_mat(mi.material_override, k, paint)
			continue
		for s in mi.mesh.get_surface_count():
			var mat := mi.get_active_material(s)
			var k := kind(mat)
			if k != "" and k != "lens":
				mi.set_surface_override_material(s, _dress_mat(mat, k, paint))

## the car's lamps as materials of its own (copied once, so flashing one car never lights the rest of its paint batch)
static func own_lamps(car: Node3D) -> Array[StandardMaterial3D]:
	if car.has_meta("lamps"):
		var have: Array[StandardMaterial3D] = []
		for m in car.get_meta("lamps"):
			have.append(m)
		return have
	var out: Array[StandardMaterial3D] = []
	var copies := {}
	for n in car.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi.mesh == null:
			continue
		if mi.material_override and kind(mi.material_override) in ["head", "tail", "red", "blue"]:
			if not copies.has(mi.material_override):
				copies[mi.material_override] = mi.material_override.duplicate()
				out.append(copies[mi.material_override])
			mi.material_override = copies[mi.material_override]
			continue
		if mi.material_override:
			continue
		for s in mi.mesh.get_surface_count():
			var mat := mi.get_active_material(s)
			if kind(mat) in ["head", "tail", "red", "blue"]:
				if not copies.has(mat):
					copies[mat] = mat.duplicate()
					out.append(copies[mat])
				mi.set_surface_override_material(s, copies[mat])
	car.set_meta("lamps", out)
	return out

## lamps on or off (energy 0 = off): a driven car's lights, the alarm's flashes
static func set_lamps(car: Node3D, energy: float, flash_red := 0.0, flash_blue := 0.0) -> void:
	for m in own_lamps(car):
		if m.emission == Color(1.0, 0.06, 0.1):
			m.emission_energy_multiplier = flash_red
		elif m.emission == Color(0.1, 0.3, 1.0):
			m.emission_energy_multiplier = flash_blue
		else:
			m.emission_energy_multiplier = energy

## the alarm on a locked car: the warble and the hazards for ALARM_SECONDS (a node on the car runs it and goes)
static func alarm(car: Node3D, listener: Vector3) -> void:
	if car.has_node("Alarm"):
		return
	var a := Alarm.new()
	a.name = "Alarm"
	a.lamps = own_lamps(car)
	car.add_child(a)
	Sound.sfx_at("car_alarm", car.global_position, listener, -2.0)

class Alarm extends Node:
	var lamps: Array[StandardMaterial3D] = []
	var t := 0.0
	func _process(dt: float) -> void:
		t += dt
		var on := fmod(t, 0.4) < 0.2
		var done := t >= 2.4
		for m in lamps:
			var police_red := m.emission.r > 0.9 and m.emission.b > 0.09 and m.emission.g < 0.1
			var police_blue := m.emission.b > 0.9 and m.emission.r < 0.2
			if done:
				m.emission_energy_multiplier = 0.0
			elif police_red:
				m.emission_energy_multiplier = 4.0 if on else 0.0
			elif police_blue:
				m.emission_energy_multiplier = 0.0 if on else 4.0
			else:
				m.emission_energy_multiplier = 3.0 if on else 0.0
		if done:
			queue_free()
