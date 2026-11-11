extends RefCounted
## The buildings you can walk into off the avenue (owner's pick, Nov 11: "City interiors"; asset catalog part 2 §2,
## "Realistic buildings & interiors": hospitals, police stations, fire stations, shopping malls, hotels, nightclubs,
## restaurants, schools, office interiors, underground parking — the mall is mall_interior.gd). Each builder lays its
## rooms into an interior_view.gd with the view's kit (shell, box, cyl, light, sign, spot, people, model); `use` answers
## ENTER at its spots. All names are original. The street's doors: street_slice.gd DOORS ("interior" doors open here).

const DOORS := {
	"hospital": "MERIDIAN GENERAL HOSPITAL",
	"police": "POLICE · PRECINCT 7",
	"fire": "FIRE STATION 12",
	"hotel": "THE AURELIAN HOTEL",
	"nightclub": "NIGHTCLUB",
	"restaurant": "EMBER & OAK GRILL",
	"school": "NEXUS ACADEMY",
	"office": "HELIX SYSTEMS · FLOOR 31",
	"parking": "UNDERGROUND PARKING",
	"metro": "METRO · CENTRAL LINE",
}
## the club's name by city
const CLUB := { "nexus": "PULSE", "neon": "SYNTHESIS", "coast": "TIDE" }
const CITY := { "nexus": "NEXUS CITY", "neon": "NEON CITY", "coast": "AZURE COAST" }
const MENU := [["Flame-grilled ribeye", 34], ["Smoked brisket plate", 26], ["Charred corn & chili butter", 12], ["Oak-fired flatbread", 18]]
const DRINKS := [["Neon Mule", 15], ["Fracture Fizz", 15], ["Midnight Old Fashioned", 18], ["Sparkling water", 4]]

static func title_of(kind: String, style: String) -> String:
	if kind == "nightclub":
		return "%s NIGHTCLUB" % String(CLUB.get(style, "PULSE"))
	if kind == "police":
		return "%s POLICE · PRECINCT 7" % String(CITY.get(style, "NEXUS CITY"))
	return String(DOORS.get(kind, kind.to_upper()))

static func build(v) -> void:
	v.title = title_of(v.kind, v.style)
	match v.kind:
		"hospital": _hospital(v)
		"police": _police(v)
		"fire": _fire(v)
		"hotel": _hotel(v)
		"nightclub": _nightclub(v)
		"restaurant": _restaurant(v)
		"school": _school(v)
		"office": _office(v)
		"parking": _parking(v)
		"metro": _metro(v)
		_: _hospital(v)

## leaving: anything the room started (the club's music) stops
static func left(v) -> void:
	if v.kind == "nightclub":
		preload("res://scripts/audio/sound.gd").music_stop()

static func use(v, id: String) -> void:
	match id:
		"checkup":
			if v.pay(40, "a check-up"):
				v.controls.toast("Dr. Imani Reyes: \"Pulse steady, lungs clear. Go easy on the street racing.\"")
		"pharmacy":
			v.controls.toast("Pharmacist: \"Prescriptions at the window — field kits come from the gear shops.\"")
		"er":
			v.controls.toast("Nurse Kobayashi: \"Bay three's free if you need it. Hope you don't.\"")
		"desk":
			var c = preload("res://scripts/racing/street_career.gd").load_or_fresh()
			if c.busts == 0 and c.escapes == 0:
				v.controls.toast("Sergeant Hale: \"Clean record. Keep it that way.\"")
			else:
				v.controls.toast("Sergeant Hale: \"%d bust%s and %d escape%s on file. We know the car, racer.\"" % [c.busts, "" if c.busts == 1 else "s", c.escapes, "" if c.escapes == 1 else "s"])
		"wanted":
			v.controls.toast("STREET RACING TASK FORCE — the Ghost, Vex, Nightjar. Reward for information.")
		"cells":
			v.controls.toast("A voice from the cell: \"I was only doing ninety…\"")
		"engine":
			v.controls.toast("Captain Okafor: \"Engine 12 rolls in forty seconds flat. Hands off the siren.\"")
		"pole":
			v.controls.toast("The pole's polished to a mirror. The crew comes down it in under three seconds.")
		"concierge":
			v.controls.toast("Concierge: \"The Sky Suite's taken tonight. The Gilded Bar is open until four.\"")
		"bar", "gilded":
			var i := int(v.data.get("drink", 0)) % DRINKS.size()
			v.data.drink = i + 1
			if v.pay(int(DRINKS[i][1]), String(DRINKS[i][0])):
				v.controls.toast("%s — %d Nex. Cheers." % [String(DRINKS[i][0]), int(DRINKS[i][1])])
		"elevator":
			v.controls.toast("Guests only above the lobby.")
		"dj":
			v.controls.toast("DJ Kairo nods along: \"Next one's for the racers.\"")
		"vip":
			v.controls.toast("Bouncer: \"VIP's on the list. Legends only.\"")
		"order":
			var j := int(v.data.get("meal", 0)) % MENU.size()
			v.data.meal = j + 1
			if v.pay(int(MENU[j][1]), String(MENU[j][0])):
				v.controls.toast("%s — %d Nex. Chef plates it hot off the oak fire." % [String(MENU[j][0]), int(MENU[j][1])])
		"class":
			v.controls.toast("Ms. Adeyemi: \"Today — the Fracture: causes and consequences. Take a seat.\"")
		"hoops":
			v.controls.toast("Swish!" if randf() < 0.55 else "Off the rim.")
		"lockers":
			v.controls.toast("Locker 214. Someone's left a Skyways pass in it.")
		"helix":
			v.controls.toast("Reception: \"Helix Systems — we build the city's traffic brain. Badge in, please.\"")
		"meeting":
			v.controls.toast("On the screen: Q4 — RIFT SENSOR NETWORK · 98.6% UPTIME.")
		"paystation":
			v.controls.toast("Ticket validated. First hour free.")
		"ride":
			if String(v.data.get("train", "")) != "docked":
				v.controls.toast("The next train is %d s away." % int(ceil(float(v.data.get("next_in", 0.0)))))
			elif v.pay(3, "a metro fare"):
				# the Central Line: up at the far end of the avenue from wherever you are (here: the hub)
				var south := int(v.data.get("rides", 0)) % 2 == 0
				v.data.rides = int(v.data.get("rides", 0)) + 1
				v.exit_at = Vector3(12.6, 0.18, 860.0 if south else -860.0)
				v.leave()
		"ticket":
			v.controls.toast("Central Line: NORTH END ⇄ HUB ⇄ SOUTH END · 3 Nex a ride")
		_:
			pass

# --------------------------------------------------------------------------------------------- shared pieces
static func _chair(v, at: Vector3, yaw: float, m: Material) -> void:
	var b := Basis(Vector3.UP, yaw)
	v.box(Vector3(0.48, 0.08, 0.48), at + Vector3(0, 0.45, 0), m, false)
	v.box(Vector3(0.48, 0.5, 0.08), at + b * Vector3(0, 0.72, -0.22), m, false).rotation.y = yaw
	for dx: float in [-0.2, 0.2]:
		for dz: float in [-0.2, 0.2]:
			v.box(Vector3(0.05, 0.42, 0.05), at + Vector3(dx, 0.21, dz), v.mat(Color(0.2, 0.2, 0.22), 0.4, 0.7), false)

static func _table(v, at: Vector3, size: Vector2, top: Material, h := 0.75) -> void:
	v.box(Vector3(size.x, 0.06, size.y), at + Vector3(0, h, 0), top, false)
	v.box(Vector3(0.12, h, 0.12), at + Vector3(0, h * 0.5, 0), v.mat(Color(0.15, 0.15, 0.17), 0.4, 0.6), false)
	# one box the size of the table keeps you from walking through it
	v.obstacles.append(AABB(at + Vector3(-size.x * 0.5, 0, -size.y * 0.5), Vector3(size.x, h, size.y)))

static func _desk_pc(v, at: Vector3, yaw: float, screen: Color) -> void:
	var b := Basis(Vector3.UP, yaw)
	v.box(Vector3(1.6, 0.05, 0.8), at + Vector3(0, 0.74, 0), v.mat(Color(0.85, 0.85, 0.83), 0.5), false)
	v.box(Vector3(1.5, 0.7, 0.05), at + b * Vector3(0, 0.37, -0.36), v.mat(Color(0.3, 0.3, 0.32), 0.6), false).rotation.y = yaw
	var mon = v.box(Vector3(0.62, 0.38, 0.04), at + b * Vector3(0, 1.05, -0.2), v.glow(screen, 1.4), false)
	mon.rotation.y = yaw
	v.obstacles.append(AABB(at + Vector3(-0.8, 0, -0.8), Vector3(1.6, 0.8, 1.6)))
	_chair(v, at + b * Vector3(0, 0, 0.6), yaw + PI, v.mat(Color(0.12, 0.12, 0.14), 0.6))

static func _plant(v, at: Vector3) -> void:
	v.cyl(0.32, 0.55, at, v.mat(Color(0.25, 0.25, 0.27), 0.6))
	var leaves = v.cyl(0.55, 1.2, at + Vector3(0, 0.55, 0), v.mat(Color(0.18, 0.42, 0.2), 0.9), false, 0.1)
	leaves.scale = Vector3(1, 1, 1)

static func _ceiling_lights(v, r: Rect2, y: float, every: float, m: Material) -> void:
	var x := r.position.x + every * 0.5
	while x < r.end.x:
		var z := r.position.y + every * 0.5
		while z < r.end.y:
			v.box(Vector3(1.2, 0.05, 0.4), Vector3(x, y - 0.03, z), m, false)
			z += every
		x += every

# --------------------------------------------------------------------------------------------- the hospital
static func _hospital(v) -> void:
	var r := Rect2(-16, -34, 32, 34)
	v.environment(Color(0.85, 0.92, 0.95), 0.45)
	v.shell(r, 4.6, v.mat(Color(0.7, 0.74, 0.74), 0.25), v.mat(Color(0.66, 0.78, 0.76), 0.85), v.mat(Color(0.95, 0.96, 0.96), 0.9))
	_ceiling_lights(v, r, 4.6, 5.0, v.glow(Color(0.95, 0.98, 1.0), 0.9))
	var teal = v.mat(Color(0.1, 0.55, 0.55), 0.5)
	var white = v.mat(Color(0.95, 0.96, 0.96), 0.4)
	# the cross and name over the reception
	v.box(Vector3(0.6, 1.8, 0.1), Vector3(0, 3.6, -11.6), v.glow(Color(0.2, 0.95, 0.5), 2.5), false)
	v.box(Vector3(1.8, 0.6, 0.1), Vector3(0, 3.6, -11.6), v.glow(Color(0.2, 0.95, 0.5), 2.5), false)
	v.box(Vector3(10, 4.6, 0.2), Vector3(0, 2.3, -11.8), v.mat(Color(0.9, 0.94, 0.93), 0.8))
	v.sign("MERIDIAN GENERAL", Vector3(0, 2.6, -11.6), 0.0, Color(0.1, 0.45, 0.45), 72, false)
	# reception desk
	v.box(Vector3(7.0, 1.1, 1.0), Vector3(0, 0.55, -8.0), teal)
	v.box(Vector3(7.2, 0.08, 1.2), Vector3(0, 1.14, -8.0), white, false)
	v.spot("checkup", "RECEPTION · CHECK-UP (40 Nex)", Vector3(0, 0, -6.6))
	# waiting chairs on the left, magazines on low tables
	for row in 3:
		for k in 5:
			_chair(v, Vector3(-13.0 + k * 1.0, 0, -4.0 - row * 2.6), PI, teal)
	v.sign("WAITING AREA", Vector3(-15.7, 3.0, -7.5), PI * 0.5, Color(0.1, 0.45, 0.45), 56, false)
	# pharmacy on the right
	v.box(Vector3(1.0, 1.1, 7.0), Vector3(12.0, 0.55, -6.5), white)
	for k in 4:
		v.box(Vector3(0.5, 0.05, 6.4), Vector3(15.3, 0.9 + k * 0.55, -6.5), white, false)
		for j in 10:
			var c: Color = [Color(0.9, 0.3, 0.3), Color(0.3, 0.6, 0.95), Color(0.95, 0.85, 0.3), Color(0.4, 0.85, 0.5)][(j + k) % 4]
			v.box(Vector3(0.3, 0.3, 0.4), Vector3(15.3, 1.1 + k * 0.55, -9.2 + j * 0.6), v.mat(c, 0.6), false)
	v.sign("PHARMACY", Vector3(15.7, 3.4, -6.5), -PI * 0.5, Color(0.2, 0.95, 0.5), 64)
	v.spot("pharmacy", "PHARMACY", Vector3(10.6, 0, -6.5))
	# the nurses' station and the emergency bays at the back
	v.box(Vector3(6.0, 1.1, 2.0), Vector3(0, 0.55, -19.0), white)
	for k in 3:
		v.box(Vector3(0.5, 0.32, 0.04), Vector3(-1.6 + k * 1.6, 1.35, -19.6), v.glow(Color(0.3, 1.0, 0.6), 1.5), false)
	v.sign("EMERGENCY", Vector3(0, 3.8, -33.6), 0.0, Color(1.0, 0.3, 0.3), 80)
	var curtain = v.mat(Color(0.55, 0.75, 0.85), 0.9)
	for k in 4:
		var x := -12.0 + k * 8.0
		v.box(Vector3(1.0, 0.55, 2.1), Vector3(x, 0.45, -30.5), white)
		v.box(Vector3(0.9, 0.12, 0.5), Vector3(x, 0.78, -31.3), v.mat(Color(0.9, 0.9, 0.95), 0.9), false)
		v.box(Vector3(0.05, 2.2, 4.0), Vector3(x - 3.2, 1.3, -31.0), curtain)
		v.box(Vector3(0.6, 0.45, 0.06), Vector3(x + 1.0, 1.7, -33.5), v.glow(Color(0.2, 1.0, 0.5), 1.8), false)
		v.cyl(0.03, 1.8, Vector3(x - 0.9, 0, -29.6), v.mat(Color(0.7, 0.72, 0.75), 0.3, 0.8), false)
	v.spot("er", "EMERGENCY BAYS", Vector3(0, 0, -24.0), 3.0)
	_plant(v, Vector3(-14.5, 0, -1.5))
	_plant(v, Vector3(14.5, 0, -1.5))
	v.light(Vector3(0, 3.8, -6), Color(1, 1, 1), 0.6, 16.0)
	v.light(Vector3(0, 3.8, -26), Color(0.95, 1.0, 1.0), 0.6, 16.0)
	v.staff([[Vector3(-1.0, 0, -9.3), 0.0, "uniform-scrubs", "female"], [Vector3(1.6, 0, -9.3), 0.0, "uniform-doctor", "male"],
		[Vector3(13.4, 0, -6.0), -PI * 0.5, "uniform-doctor", "female"], [Vector3(1.0, 0, -20.6), 0.0, "uniform-scrubs", "male"],
		[Vector3(-4.0, 0, -27.0), 0.7, "uniform-doctor", "male"], [Vector3(6.0, 0, -3.5), PI, "uniform-paramedic", "female"]])
	v.people([[Vector3(-11.5, 0, -5.2), PI], [Vector3(-10.0, 0, -10.4), 2.6], [Vector3(5.0, 0, -26.0), -0.4], [Vector3(-6.0, 0, -15.0), 1.2]], 11)

# --------------------------------------------------------------------------------------------- the police station
static func _police(v) -> void:
	var r := Rect2(-15, -32, 30, 32)
	v.environment(Color(0.7, 0.75, 0.85), 0.55)
	v.shell(r, 4.4, v.mat(Color(0.32, 0.35, 0.4), 0.4), v.mat(Color(0.62, 0.65, 0.7), 0.85), v.mat(Color(0.8, 0.82, 0.85), 0.9))
	_ceiling_lights(v, r, 4.4, 5.0, v.glow(Color(0.92, 0.96, 1.0), 1.5))
	var navy = v.mat(Color(0.08, 0.12, 0.25), 0.5)
	var blue = v.glow(Color(0.2, 0.45, 1.0), 2.0)
	for zz: float in [-0.5, -31.5]:
		v.box(Vector3(29.4, 0.12, 0.05), Vector3(0, 1.2, zz + (0.3 if zz < -1.0 else -0.3)), blue, false)
	# the badge and name
	v.box(Vector3(1.2, 1.4, 0.1), Vector3(0, 3.3, -9.4), v.glow(Color(0.95, 0.8, 0.3), 1.6), false)
	v.sign(title_of("police", v.style), Vector3(0, 2.3, -9.35), 0.0, Color(0.9, 0.92, 1.0), 56, false)
	v.box(Vector3(12, 4.4, 0.2), Vector3(0, 2.2, -9.6), navy)
	# the front desk behind glass
	v.box(Vector3(8.0, 1.2, 1.0), Vector3(0, 0.6, -6.5), navy)
	v.box(Vector3(8.0, 1.4, 0.06), Vector3(0, 1.9, -6.5), v.glass(), false)
	v.spot("desk", "FRONT DESK", Vector3(0, 0, -5.2))
	# the wanted board: the street racing task force (street_career.gd's legends)
	v.box(Vector3(0.1, 2.2, 4.4), Vector3(-14.7, 1.9, -5.0), v.mat(Color(0.75, 0.68, 0.5), 0.9), false)
	for k in 3:
		v.box(Vector3(0.05, 0.9, 0.7), Vector3(-14.6, 2.1, -6.4 + k * 1.4), v.mat([Color(0.2, 0.2, 0.25), Color(0.5, 0.3, 0.3), Color(0.3, 0.35, 0.45)][k], 0.8), false)
	v.sign("MOST WANTED\nGHOST · VEX · NIGHTJAR", Vector3(-14.55, 3.2, -5.0), PI * 0.5, Color(0.85, 0.15, 0.15), 40, false)
	v.spot("wanted", "WANTED BOARD", Vector3(-13.0, 0, -5.0), 2.0)
	# the bullpen
	for row in 2:
		for k in 3:
			_desk_pc(v, Vector3(-6.0 + k * 6.0, 0, -13.0 - row * 5.0), 0.0, Color(0.3, 0.55, 1.0))
	# holding cells along the back wall
	var bars = v.mat(Color(0.5, 0.52, 0.55), 0.3, 0.9)
	for c in 3:
		var x0 := -12.0 + c * 8.0
		v.box(Vector3(0.2, 4.4, 5.0), Vector3(x0 - 3.0, 2.2, -29.0), v.mat(Color(0.55, 0.57, 0.6), 0.8))
		for b in 22:
			v.box(Vector3(0.05, 3.0, 0.05), Vector3(x0 - 2.8 + b * 0.27, 1.5, -26.5), bars, false)
		v.obstacles.append(AABB(Vector3(x0 - 3.0, 0, -26.6), Vector3(6.0, 3.0, 0.2)))
		v.box(Vector3(3.0, 0.45, 0.6), Vector3(x0, 0.22, -31.2), v.mat(Color(0.5, 0.5, 0.52), 0.8))
	v.box(Vector3(0.2, 4.4, 5.0), Vector3(13.0, 2.2, -29.0), v.mat(Color(0.55, 0.57, 0.6), 0.8))
	v.spot("cells", "HOLDING CELLS", Vector3(-4.0, 0, -24.8), 2.4)
	# evidence lockers on the right wall
	for k in 8:
		v.box(Vector3(0.6, 2.0, 0.9), Vector3(14.4, 1.0, -4.0 - k * 0.95), v.mat(Color(0.3, 0.35, 0.3), 0.5, 0.6))
	v.light(Vector3(0, 3.8, -8), Color(0.95, 0.97, 1.0), 1.0, 16.0)
	v.light(Vector3(0, 3.8, -24), Color(0.9, 0.95, 1.0), 0.9, 16.0)
	v.staff([[Vector3(0.5, 0, -7.6), 0.0, "uniform-police", "male"], [Vector3(-6.0, 0, -11.6), PI, "uniform-police", "female"],
		[Vector3(6.2, 0, -16.6), 2.8, "uniform-police", "male"], [Vector3(-9.0, 0, -21.5), 0.4, "uniform-police", "female"],
		[Vector3(9.0, 0, -3.0), -1.4, "uniform-security", "male"]])
	v.people([[Vector3(-4.0, 0, -29.5), 0.0]], 13)

# --------------------------------------------------------------------------------------------- the fire station
static func _fire_truck(v, at: Vector3) -> void:
	var red = v.mat(Color(0.75, 0.06, 0.05), 0.35, 0.3)
	var chrome = v.mat(Color(0.8, 0.82, 0.85), 0.2, 0.9)
	v.box(Vector3(2.5, 2.6, 2.4), at + Vector3(0, 1.6, 4.0), red)
	v.box(Vector3(2.3, 0.9, 0.05), at + Vector3(0, 2.4, 5.21), v.glass(Color(0.2, 0.3, 0.35, 0.8)), false)
	v.box(Vector3(2.5, 2.2, 6.0), at + Vector3(0, 1.4, -0.5), red)
	v.box(Vector3(2.52, 0.12, 6.02), at + Vector3(0, 1.0, -0.5), chrome, false)
	v.box(Vector3(0.9, 0.4, 7.0), at + Vector3(0, 2.75, -0.3), chrome, false)
	for k in 9:
		v.box(Vector3(0.9, 0.06, 0.06), at + Vector3(0, 2.98, -3.6 + k * 0.8), chrome, false)
	v.box(Vector3(1.6, 0.18, 0.3), at + Vector3(0, 2.98, 4.6), v.glow(Color(1.0, 0.15, 0.1), 3.0), false)
	for z: float in [3.8, -1.2, -2.6]:
		for x: float in [-1.25, 1.25]:
			var w = v.cyl(0.55, 0.4, at + Vector3(x, 0.55, z), v.mat(Color(0.06, 0.06, 0.07), 0.9), false)
			w.rotation.z = PI * 0.5
			w.position = at + Vector3(x, 0.55, z)
	v.sign("ENGINE 12", at + Vector3(1.27, 1.6, -0.5), PI * 0.5, Color(1.0, 0.85, 0.3), 56, false)

static func _fire(v) -> void:
	var r := Rect2(-17, -32, 34, 32)
	v.environment(Color(0.85, 0.82, 0.78), 0.6)
	v.shell(r, 8.0, v.mat(Color(0.5, 0.5, 0.5), 0.6), v.mat(Color(0.55, 0.3, 0.25), 0.9), v.mat(Color(0.35, 0.35, 0.37), 0.9), 6.0)
	_ceiling_lights(v, r, 8.0, 6.0, v.glow(Color(1.0, 0.97, 0.9), 1.6))
	var yellow = v.mat(Color(0.95, 0.8, 0.1), 0.6)
	for x: float in [-7.0, 7.0]:
		for s: float in [-1.7, 1.7]:
			v.box(Vector3(0.15, 0.02, 14.0), Vector3(x + s, 0.01, -8.0), yellow, false)
		_fire_truck(v, Vector3(x, 0, -9.0))
	v.spot("engine", "ENGINE 12", Vector3(-3.6, 0, -6.0), 2.4)
	# the gear wall: lockers with helmets and coats
	for k in 10:
		var z := -2.0 - k * 1.1
		v.box(Vector3(0.6, 2.2, 1.0), Vector3(-16.4, 1.1, z), v.mat(Color(0.3, 0.32, 0.35), 0.5, 0.6))
		v.box(Vector3(0.35, 0.3, 0.35), Vector3(-16.0, 2.45, z), v.mat(Color(0.95, 0.75, 0.1), 0.4), false)
		v.box(Vector3(0.15, 1.0, 0.6), Vector3(-15.95, 1.4, z), v.mat(Color(0.75, 0.6, 0.3), 0.8), false)
	# the mezzanine with the bunks, the stairs up, the pole down
	v.box(Vector3(34, 0.3, 8), Vector3(0, 4.2, -28.0), v.mat(Color(0.4, 0.4, 0.42), 0.7), false)
	v.box(Vector3(34, 1.0, 0.08), Vector3(0, 4.85, -24.0), v.mat(Color(0.8, 0.12, 0.1), 0.4, 0.4), false)
	for k in 4:
		v.box(Vector3(2.0, 0.5, 0.9), Vector3(-12.0 + k * 4.0, 4.6, -30.5), v.mat(Color(0.25, 0.3, 0.45), 0.9), false)
	v.obstacles.append(AABB(Vector3(-17, 0, -32), Vector3(34, 4.2, 7.8)))
	v.box(Vector3(34, 4.2, 0.2), Vector3(0, 2.1, -24.1), v.mat(Color(0.48, 0.27, 0.22), 0.9), false)
	for k in 12:
		v.box(Vector3(2.0, 0.25, 0.4), Vector3(-14.5, 0.25 + k * 0.35, -12.0 - k * 0.4), v.mat(Color(0.35, 0.35, 0.37), 0.7), false)
	v.obstacles.append(AABB(Vector3(-15.5, 0, -16.8), Vector3(2.0, 4.2, 4.8)))
	v.cyl(0.08, 8.0, Vector3(13.0, 0, -22.5), v.mat(Color(0.85, 0.65, 0.25), 0.15, 1.0))
	v.cyl(0.9, 0.06, Vector3(13.0, 0.0, -22.5), v.mat(Color(0.15, 0.15, 0.15), 0.9), false)
	v.spot("pole", "THE POLE", Vector3(13.0, 0, -21.0), 2.0)
	v.sign("STATION 12 · %s FIRE RESCUE" % String(CITY.get(v.style, "NEXUS CITY")), Vector3(0, 6.6, -31.7), 0.0, Color(1.0, 0.85, 0.3), 80)
	v.light(Vector3(0, 6.5, -10), Color(1.0, 0.95, 0.88), 1.4, 22.0)
	v.light(Vector3(0, 3.5, -27), Color(1.0, 0.9, 0.8), 0.8, 12.0)
	v.staff([[Vector3(-3.2, 0, -2.5), 0.6, "uniform-firefighter", "male"], [Vector3(10.0, 0, -3.0), -0.6, "uniform-firefighter", "female"],
		[Vector3(-14.5, 0, -6.0), 1.6, "uniform-firefighter", "male"], [Vector3(3.0, 0, -20.0), 0.0, "uniform-paramedic", "male"]])

# --------------------------------------------------------------------------------------------- the hotel
static func _hotel(v) -> void:
	var r := Rect2(-18, -34, 36, 34)
	v.environment(Color(1.0, 0.88, 0.72), 0.9)
	var marble = v.mat(Color(0.9, 0.88, 0.84), 0.12, 0.05)
	var wood = v.mat(Color(0.38, 0.24, 0.15), 0.5)
	var gold = v.mat(Color(0.9, 0.7, 0.3), 0.25, 1.0)
	v.shell(r, 9.0, marble, wood, v.mat(Color(0.95, 0.92, 0.85), 0.8))
	# a gold inlay down the middle, rugs in the lounge
	v.box(Vector3(2.0, 0.02, 30.0), Vector3(0, 0.01, -16.0), v.mat(Color(0.2, 0.15, 0.12), 0.2), false)
	v.box(Vector3(0.12, 0.025, 30.0), Vector3(-1.0, 0.012, -16.0), gold, false)
	v.box(Vector3(0.12, 0.025, 30.0), Vector3(1.0, 0.012, -16.0), gold, false)
	# chandeliers
	for z: float in [-9.0, -21.0]:
		v.cyl(0.03, 2.5, Vector3(0, 6.5, z), gold, false)
		v.cyl(1.6, 0.5, Vector3(0, 6.0, z), gold, false, 1.1)
		for k in 10:
			var a := TAU * k / 10.0
			v.box(Vector3(0.18, 0.5, 0.18), Vector3(cos(a) * 1.5, 5.75, z + sin(a) * 1.5), v.glow(Color(1.0, 0.88, 0.6), 3.0), false)
		v.light(Vector3(0, 5.5, z), Color(1.0, 0.85, 0.6), 1.5, 18.0)
	# reception at the back, the name above it
	v.box(Vector3(10.0, 1.15, 1.4), Vector3(0, 0.58, -29.0), v.mat(Color(0.95, 0.94, 0.9), 0.1, 0.05))
	v.box(Vector3(10.1, 0.1, 1.5), Vector3(0, 1.2, -29.0), gold, false)
	v.box(Vector3(14, 6.0, 0.3), Vector3(0, 3.0, -33.7), v.mat(Color(0.12, 0.09, 0.07), 0.4))
	v.sign("THE AURELIAN", Vector3(0, 4.6, -33.5), 0.0, Color(1.0, 0.8, 0.4), 140)
	v.spot("concierge", "CONCIERGE", Vector3(0, 0, -27.4))
	# the lounge on the left: sofas round low tables, a grand piano
	for z: float in [-8.0, -16.0]:
		v.box(Vector3(6.0, 0.02, 5.0), Vector3(-10.5, 0.012, z), v.mat(Color(0.45, 0.1, 0.12), 0.95), false)
		for s: float in [-1.0, 1.0]:
			if v.model("res://models/city/sofa.glb", Vector3(-10.5, 0, z + s * 1.8), PI if s > 0.0 else 0.0, 2.6) == null:
				v.box(Vector3(2.6, 0.8, 0.9), Vector3(-10.5, 0.4, z + s * 1.8), v.mat(Color(0.2, 0.25, 0.35), 0.9))
		v.box(Vector3(1.4, 0.4, 0.8), Vector3(-10.5, 0.2, z), wood)
	v.box(Vector3(1.6, 1.0, 2.4), Vector3(-12.0, 0.5, -24.0), v.mat(Color(0.03, 0.03, 0.03), 0.15))
	v.box(Vector3(1.5, 0.05, 0.5), Vector3(-12.0, 1.0, -22.6), v.mat(Color(0.95, 0.95, 0.95), 0.4), false)
	# the elevators on the right wall
	for k in 3:
		var z := -10.0 - k * 4.0
		v.box(Vector3(0.1, 3.2, 2.0), Vector3(17.55, 1.6, z), gold, false)
		v.box(Vector3(0.05, 0.3, 0.8), Vector3(17.5, 3.5, z), v.glow(Color(1.0, 0.75, 0.3), 2.0), false)
	v.spot("elevator", "ELEVATORS", Vector3(15.6, 0, -14.0), 2.4)
	# the Gilded Bar by the door
	v.box(Vector3(1.0, 1.1, 6.0), Vector3(12.0, 0.55, -4.5), v.mat(Color(0.1, 0.08, 0.06), 0.3))
	v.box(Vector3(1.1, 0.06, 6.1), Vector3(12.0, 1.12, -4.5), gold, false)
	for k in 12:
		v.cyl(0.07, 0.32, Vector3(17.2, 1.5 + (k % 2) * 0.5, -7.0 + k * 0.45), v.glow([Color(0.9, 0.6, 0.2), Color(0.5, 0.8, 0.4), Color(0.8, 0.3, 0.3)][k % 3], 1.2), false)
	v.sign("THE GILDED BAR", Vector3(17.6, 3.2, -4.5), -PI * 0.5, Color(1.0, 0.8, 0.4), 60)
	v.spot("gilded", "THE GILDED BAR · A DRINK", Vector3(10.6, 0, -4.5))
	for p in [Vector3(-16.5, 0, -2.0), Vector3(16.5, 0, -32.0), Vector3(-16.5, 0, -32.0)]:
		_plant(v, p)
	v.staff([[Vector3(-1.5, 0, -30.4), 0.0, "uniform-office", "female"], [Vector3(1.5, 0, -30.4), 0.0, "uniform-office", "male"],
		[Vector3(13.4, 0, -4.0), -PI * 0.5, "uniform-bartender", "male"], [Vector3(-4.0, 0, -2.5), PI, "uniform-security", "male"]])
	v.people([[Vector3(-8.0, 0, -12.0), 0.8], [Vector3(-13.0, 0, -20.0), -0.5], [Vector3(3.0, 0, -14.0), 2.0], [Vector3(14.6, 0, -12.0), PI * 0.5]], 19)

# --------------------------------------------------------------------------------------------- the nightclub
const FLOOR_SHADER := """
shader_type spatial;
render_mode unshaded;
uniform vec3 a : source_color = vec3(1.0, 0.1, 0.6);
uniform vec3 b : source_color = vec3(0.1, 0.8, 1.0);
void fragment() {
	vec2 cell = floor(UV * vec2(14.0, 10.0));
	float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
	float beat = step(0.5, fract(TIME * 2.0 + h));
	float pulse = 0.5 + 0.5 * sin(TIME * 4.0 + h * 6.283);
	vec2 g = abs(fract(UV * vec2(14.0, 10.0)) - 0.5);
	float edge = smoothstep(0.46, 0.5, max(g.x, g.y));
	vec3 c = mix(a, b, beat) * (0.25 + 0.9 * pulse);
	ALBEDO = mix(c, vec3(0.02), edge);
}
"""
const WALL_SHADER := """
shader_type spatial;
render_mode unshaded;
void fragment() {
	float bars = step(0.5, fract(UV.x * 24.0));
	float h = fract(sin(floor(UV.x * 24.0) * 91.7) * 4371.3);
	float level = 0.25 + 0.7 * abs(sin(TIME * (2.0 + h * 3.0) + h * 10.0));
	float lit = step(1.0 - UV.y, level) * bars;
	vec3 c = mix(vec3(1.0, 0.1, 0.55), vec3(0.2, 0.9, 1.0), UV.y);
	ALBEDO = c * lit + vec3(0.02, 0.0, 0.04);
}
"""

static func _nightclub(v) -> void:
	var r := Rect2(-17, -32, 34, 32)
	v.environment(Color(0.35, 0.15, 0.45), 0.5, Color(0.01, 0.0, 0.02), true)
	v.shell(r, 7.0, v.mat(Color(0.05, 0.05, 0.06), 0.3, 0.2), v.mat(Color(0.06, 0.05, 0.08), 0.6), v.mat(Color(0.03, 0.03, 0.04), 0.9))
	var pink := Color(1.0, 0.15, 0.6)
	var cyan := Color(0.15, 0.85, 1.0)
	# neon trim round the room
	for zz: float in [-31.6, -0.6]:
		v.box(Vector3(33.0, 0.08, 0.05), Vector3(0, 6.6, zz), v.glow(pink, 3.0), false)
	for xx: float in [-16.6, 16.6]:
		v.box(Vector3(0.05, 0.08, 31.0), Vector3(xx, 6.6, -16.0), v.glow(cyan, 3.0), false)
	# the LED dance floor
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(14.0, 10.0)
	fl.mesh = pm
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = FLOOR_SHADER
	sm.shader = sh
	fl.material_override = sm
	fl.position = Vector3(0, 0.02, -15.0)
	v.world.add_child(fl)
	# the DJ booth on its riser, the LED wall behind
	v.box(Vector3(12.0, 1.0, 5.0), Vector3(0, 0.5, -28.5), v.mat(Color(0.08, 0.08, 0.1), 0.4, 0.5))
	v.box(Vector3(4.0, 1.1, 1.0), Vector3(0, 1.55, -27.0), v.mat(Color(0.05, 0.05, 0.06), 0.3, 0.6), false)
	for k in 6:
		v.box(Vector3(0.25, 0.04, 0.25), Vector3(-1.3 + k * 0.52, 2.12, -27.0), v.glow([pink, cyan][k % 2], 3.0), false)
	var wall := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(16.0, 5.0)
	wall.mesh = qm
	var wm := ShaderMaterial.new()
	var wsh := Shader.new()
	wsh.code = WALL_SHADER
	wm.shader = wsh
	wall.material_override = wm
	wall.position = Vector3(0, 3.8, -31.7)
	v.world.add_child(wall)
	v.sign(String(CLUB.get(v.style, "PULSE")), Vector3(0, 6.2, -31.6), 0.0, pink, 140)
	v.spot("dj", "THE DJ BOOTH", Vector3(0, 0, -24.0), 2.6)
	# the bar down the right wall, bottles lit from behind
	v.box(Vector3(1.2, 1.15, 14.0), Vector3(12.5, 0.58, -12.0), v.mat(Color(0.04, 0.04, 0.05), 0.2, 0.6))
	v.box(Vector3(1.3, 0.05, 14.1), Vector3(12.5, 1.17, -12.0), v.glow(cyan, 2.0), false)
	v.box(Vector3(0.1, 2.4, 14.0), Vector3(16.7, 2.2, -12.0), v.glow(Color(0.25, 0.1, 0.35), 1.2), false)
	for k in 28:
		v.cyl(0.07, 0.32, Vector3(16.4, 1.4 + (k % 3) * 0.7, -18.5 + (k / 3) * 1.4 + (k % 3) * 0.3), v.glow([Color(1.0, 0.7, 0.2), cyan, pink, Color(0.6, 1.0, 0.4)][k % 4], 1.6), false)
	v.spot("bar", "BAR · ORDER A DRINK", Vector3(10.8, 0, -12.0))
	# the VIP booths on the left behind a rope
	for k in 3:
		var z := -6.0 - k * 6.0
		v.box(Vector3(2.4, 1.0, 4.0), Vector3(-15.3, 0.5, z), v.mat(Color(0.3, 0.05, 0.2), 0.7))
		v.box(Vector3(1.2, 0.5, 1.6), Vector3(-13.0, 0.25, z), v.mat(Color(0.05, 0.05, 0.06), 0.2, 0.7))
		v.box(Vector3(0.05, 0.06, 4.0), Vector3(-14.1, 1.05, z), v.glow(pink, 3.0), false)
	for k in 6:
		v.cyl(0.05, 1.0, Vector3(-11.0, 0, -3.0 - k * 3.6), v.mat(Color(0.9, 0.75, 0.35), 0.2, 1.0), false)
	v.box(Vector3(0.06, 0.06, 18.0), Vector3(-11.0, 0.9, -12.0), v.mat(Color(0.6, 0.05, 0.1), 0.6), false)
	v.spot("vip", "VIP", Vector3(-9.8, 0, -12.0), 2.0)
	# lasers from the booth, swinging over the floor
	var beams: Array = []
	for k in 6:
		var beam := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.03
		cm.bottom_radius = 0.03
		cm.height = 40.0
		cm.radial_segments = 4
		beam.mesh = cm
		var bm := StandardMaterial3D.new()
		bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bm.albedo_color = Color(0.3, 1.0, 0.4, 0.55) if k % 2 == 0 else Color(1.0, 0.2, 0.7, 0.55)
		bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		beam.material_override = bm
		var pivot := Node3D.new()
		pivot.position = Vector3(-3.0 + k * 1.2, 6.2, -29.0)
		v.world.add_child(pivot)
		beam.position = Vector3(0, -20.0, 0)
		pivot.add_child(beam)
		beams.append(pivot)
	var lights: Array = [v.light(Vector3(-5, 5.5, -15), pink, 2.5, 14.0), v.light(Vector3(5, 5.5, -15), cyan, 2.5, 14.0)]
	var t := [0.0]
	v.animate.append(func(dt: float) -> void:
		t[0] += dt
		for i in beams.size():
			var p: Node3D = beams[i]
			p.rotation = Vector3(-1.1 + 0.35 * sin(t[0] * 0.9 + i), 0.0, 0.6 * sin(t[0] * 1.3 + i * 1.7))
		(lights[0] as OmniLight3D).light_energy = 1.5 + 1.5 * absf(sin(t[0] * 4.0))
		(lights[1] as OmniLight3D).light_energy = 1.5 + 1.5 * absf(cos(t[0] * 4.0)))
	var crowd: Array = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	for i in 30:
		crowd.append([Vector3(rng.randf_range(-6.5, 6.5), 0, rng.randf_range(-19.5, -10.5)), rng.randf() * TAU])
	v.staff([[Vector3(0, 1.0, -27.9), 0.0, "uniform-bartender", "male"], [Vector3(14.2, 0, -10.0), -PI * 0.5, "uniform-bartender", "female"],
		[Vector3(-10.0, 0, -4.0), PI * 0.5, "uniform-security", "male"]])
	for k in 5:
		crowd.append([Vector3(9.8, 0, -7.0 - k * 2.4), PI * 0.5])
	v.people(crowd, 23)
	preload("res://scripts/audio/sound.gd").music("res://audio/radio/neon-frequency-after-hours.ogg", -6.0)

# --------------------------------------------------------------------------------------------- the restaurant
static func _restaurant(v) -> void:
	var r := Rect2(-14, -28, 28, 28)
	v.environment(Color(1.0, 0.8, 0.6), 0.75)
	var oak = v.mat(Color(0.42, 0.27, 0.16), 0.55)
	var dark = v.mat(Color(0.18, 0.12, 0.08), 0.5)
	v.shell(r, 4.4, v.mat(Color(0.3, 0.19, 0.11), 0.45), v.mat(Color(0.45, 0.2, 0.15), 0.95), v.mat(Color(0.15, 0.1, 0.08), 0.9))
	# pendant lights over the tables
	var grid: Array = []
	for row in 3:
		for k in 3:
			grid.append(Vector3(-5.0 + k * 5.0, 0, -6.0 - row * 5.0))
	for at: Vector3 in grid:
		_table(v, at, Vector2(1.2, 1.2), oak)
		for s in 4:
			var a := s * PI * 0.5
			_chair(v, at + Vector3(sin(a), 0, cos(a)) * 0.95, a + PI, dark)
		v.cyl(0.01, 1.2, at + Vector3(0, 3.2, 0), dark, false)
		v.cyl(0.25, 0.3, at + Vector3(0, 2.9, 0), v.glow(Color(1.0, 0.75, 0.4), 2.5), false, 0.1)
	# booths down the left wall
	for k in 4:
		var z := -5.0 - k * 5.0
		v.box(Vector3(1.0, 1.2, 0.5), Vector3(-13.0, 0.6, z - 1.3), v.mat(Color(0.5, 0.12, 0.1), 0.8))
		v.box(Vector3(1.0, 1.2, 0.5), Vector3(-13.0, 0.6, z + 1.3), v.mat(Color(0.5, 0.12, 0.1), 0.8))
		_table(v, Vector3(-12.6, 0, z), Vector2(1.6, 1.4), oak)
	# the open kitchen at the back: a pass, the oak-fired grill, the hood
	v.box(Vector3(16.0, 1.1, 1.0), Vector3(2.0, 0.55, -22.0), v.mat(Color(0.7, 0.7, 0.72), 0.25, 0.9))
	v.box(Vector3(16.2, 0.06, 1.2), Vector3(2.0, 1.13, -22.0), v.mat(Color(0.2, 0.2, 0.2), 0.3), false)
	v.box(Vector3(5.0, 1.0, 1.4), Vector3(2.0, 0.5, -26.5), v.mat(Color(0.12, 0.12, 0.13), 0.4, 0.7))
	var fire = v.box(Vector3(4.6, 0.25, 1.1), Vector3(2.0, 1.1, -26.5), v.glow(Color(1.0, 0.45, 0.1), 4.0), false, true)
	v.box(Vector3(5.6, 1.2, 2.0), Vector3(2.0, 3.6, -26.5), v.mat(Color(0.6, 0.6, 0.62), 0.3, 0.9), false)
	var flame = v.light(Vector3(2.0, 1.8, -25.0), Color(1.0, 0.55, 0.2), 1.5, 9.0)
	var t := [0.0]
	v.animate.append(func(dt: float) -> void:
		t[0] += dt
		flame.light_energy = 1.2 + 0.5 * sin(t[0] * 13.0) * sin(t[0] * 7.3)
		fire.scale.y = 1.0 + 0.4 * absf(sin(t[0] * 9.0)))
	v.sign("EMBER & OAK", Vector3(2.0, 3.1, -25.4), 0.0, Color(1.0, 0.6, 0.25), 90)
	v.spot("order", "THE PASS · ORDER", Vector3(2.0, 0, -20.6))
	# the host stand and a bar by the door
	v.box(Vector3(0.9, 1.1, 0.6), Vector3(-3.2, 0.55, -2.4), dark)
	v.box(Vector3(1.0, 1.1, 8.0), Vector3(11.5, 0.55, -8.0), dark)
	v.spot("bar", "BAR · A DRINK", Vector3(10.2, 0, -8.0))
	v.light(Vector3(0, 3.5, -10), Color(1.0, 0.8, 0.6), 1.0, 16.0)
	v.staff([[Vector3(-3.2, 0, -3.2), PI, "uniform-bartender", "female"], [Vector3(0.5, 0, -24.0), 0.0, "uniform-chef", "male"],
		[Vector3(3.5, 0, -24.2), 0.3, "uniform-chef", "female"], [Vector3(12.8, 0, -7.0), -PI * 0.5, "uniform-bartender", "male"]])
	v.people([[Vector3(-5.0, 0, -7.6), PI], [Vector3(5.0, 0, -12.6), 0.4], [Vector3(-12.0, 0, -11.0), PI * 0.5]], 29)

# --------------------------------------------------------------------------------------------- the school
static func _school(v) -> void:
	var r := Rect2(-18, -40, 36, 40)
	v.environment(Color(0.95, 0.95, 0.9), 0.45)
	v.shell(r, 4.2, v.mat(Color(0.6, 0.6, 0.56), 0.3), v.mat(Color(0.75, 0.7, 0.58), 0.9), v.mat(Color(0.95, 0.95, 0.93), 0.9))
	_ceiling_lights(v, r, 4.2, 5.0, v.glow(Color(1.0, 1.0, 0.95), 0.9))
	var blue = v.mat(Color(0.15, 0.3, 0.65), 0.4, 0.6)
	# lockers down the hall
	for s: float in [-1.0, 1.0]:
		for k in 12:
			v.box(Vector3(0.5, 1.9, 0.6), Vector3(s * 4.7, 0.95, -2.0 - k * 0.65), blue)
	v.spot("lockers", "LOCKERS", Vector3(3.6, 0, -6.0), 1.6)
	v.sign("NEXUS ACADEMY", Vector3(0, 3.3, -14.2), 0.0, Color(0.15, 0.3, 0.65), 90, false)
	# the dividing wall: the classroom left, the gym right, a doorway into each
	var wall = v.mat(Color(0.85, 0.82, 0.7), 0.9)
	v.box(Vector3(14.6, 4.2, 0.2), Vector3(-10.7, 2.1, -14.5), wall)
	v.box(Vector3(14.6, 4.2, 0.2), Vector3(10.7, 2.1, -14.5), wall)
	v.box(Vector3(0.2, 4.2, 25.5), Vector3(0, 2.1, -27.25), wall)
	# the classroom: desks in rows facing the whiteboard
	for row in 4:
		for k in 4:
			var at := Vector3(-13.0 + k * 2.6, 0, -21.0 - row * 3.0)
			_table(v, at, Vector2(1.2, 0.6), v.mat(Color(0.75, 0.6, 0.4), 0.6), 0.72)
			_chair(v, at + Vector3(0, 0, 0.7), 0.0, blue)
	v.box(Vector3(7.0, 2.0, 0.08), Vector3(-9.0, 2.0, -39.7), v.mat(Color(0.97, 0.97, 0.97), 0.2), false)
	v.sign("THE FRACTURE: CAUSES & CONSEQUENCES", Vector3(-9.0, 2.4, -39.6), 0.0, Color(0.1, 0.25, 0.6), 44, false)
	_table(v, Vector3(-9.0, 0, -36.5), Vector2(2.0, 0.9), v.mat(Color(0.5, 0.35, 0.22), 0.6))
	v.spot("class", "CLASSROOM", Vector3(-9.0, 0, -18.0), 2.4)
	# the gym: a sprung floor, the court lines, two hoops, bleachers
	v.box(Vector3(17.4, 0.04, 25.0), Vector3(9.0, 0.02, -27.5), v.mat(Color(0.75, 0.55, 0.32), 0.35), false)
	var line = v.mat(Color(0.95, 0.95, 0.95), 0.6)
	v.box(Vector3(15.0, 0.05, 0.1), Vector3(9.0, 0.04, -27.5), line, false)
	v.box(Vector3(0.1, 0.05, 22.0), Vector3(2.0, 0.04, -27.5), line, false)
	v.box(Vector3(0.1, 0.05, 22.0), Vector3(16.5, 0.04, -27.5), line, false)
	for z: float in [-17.0, -38.5]:
		var s := 1.0 if z < -20.0 else -1.0
		v.cyl(0.08, 3.05, Vector3(9.0, 0, z), v.mat(Color(0.3, 0.3, 0.32), 0.4, 0.8))
		v.box(Vector3(1.8, 1.05, 0.05), Vector3(9.0, 3.5, z + s * 0.4), v.mat(Color(0.95, 0.95, 0.95, 1.0), 0.2), false)
		var hoop := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.21
		tm.outer_radius = 0.24
		hoop.mesh = tm
		hoop.material_override = v.mat(Color(1.0, 0.4, 0.1), 0.4, 0.6)
		hoop.position = Vector3(9.0, 3.05, z + s * 0.75)
		v.static_root.add_child(hoop)
	for k in 4:
		v.box(Vector3(0.9, 0.45 * (k + 1), 18.0), Vector3(17.3 - k * 0.9, 0.225 * (k + 1), -27.5), v.mat(Color(0.55, 0.4, 0.25), 0.7), false)
	v.obstacles.append(AABB(Vector3(14.2, 0, -36.5), Vector3(3.8, 2.0, 18.0)))
	v.spot("hoops", "SHOOT A HOOP", Vector3(9.0, 0, -35.0), 2.4)
	v.sign("GO CONDORS", Vector3(17.7, 3.4, -27.5), -PI * 0.5, Color(0.95, 0.75, 0.2), 90, false)
	v.light(Vector3(-9, 3.6, -27), Color(1.0, 1.0, 0.95), 0.6, 14.0)
	v.light(Vector3(9, 3.6, -27), Color(1.0, 1.0, 0.95), 0.6, 14.0)
	v.staff([[Vector3(-9.0, 0, -38.2), 0.0, "uniform-office", "female"], [Vector3(9.0, 0, -22.0), PI, "uniform-office", "male"]])
	v.people([[Vector3(-11.5, 0, -24.0), PI], [Vector3(2.5, 0, -8.0), -1.0], [Vector3(-2.0, 0, -11.0), 1.4],
		[Vector3(7.0, 0, -33.0), 0.3], [Vector3(11.0, 0, -30.0), 2.4], [Vector3(15.6, 0.9, -25.0), -PI * 0.5]], 31)

# --------------------------------------------------------------------------------------------- the office floor
static func _office(v) -> void:
	var r := Rect2(-18, -30, 36, 30)
	v.environment(Color(0.85, 0.9, 1.0), 0.55, Color(0.03, 0.04, 0.08))
	v.shell(r, 4.0, v.mat(Color(0.3, 0.33, 0.38), 0.95), v.mat(Color(0.9, 0.9, 0.92), 0.9), v.mat(Color(0.92, 0.93, 0.95), 0.9))
	_ceiling_lights(v, r, 4.0, 4.5, v.glow(Color(0.95, 0.98, 1.0), 1.4))
	# the window wall: the whole back is glass over the night city
	var back := r.position.y
	v.box(Vector3(35.4, 3.6, 0.05), Vector3(0, 2.0, back + 0.35), v.glass(Color(0.4, 0.5, 0.6, 0.15)), false)
	var facade := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = preload("res://scripts/city/nexus_districts.gd").FACADE_SHADER
	facade.shader = sh
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	for k in 14:
		var w := rng.randf_range(14.0, 30.0)
		var h := rng.randf_range(40.0, 140.0)
		var t := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(w, h, w)
		t.mesh = bm
		t.material_override = facade
		t.position = Vector3(-120.0 + k * 18.0 + rng.randf_range(-4, 4), h * 0.5 - 100.0, back - 60.0 - rng.randf_range(0, 120.0))
		v.world.add_child(t)
	# reception and the logo
	v.box(Vector3(5.0, 1.1, 1.2), Vector3(0, 0.55, -5.5), v.mat(Color(0.95, 0.95, 0.96), 0.2))
	v.box(Vector3(8.0, 2.6, 0.15), Vector3(0, 2.4, -8.6), v.mat(Color(0.12, 0.13, 0.15), 0.4), false)
	v.sign("HELIX", Vector3(0, 2.6, -8.5), 0.0, Color(0.3, 0.85, 1.0), 120)
	v.spot("helix", "RECEPTION", Vector3(0, 0, -4.2))
	# the open plan: pods of four desks
	for pod in 6:
		var cx := -12.0 + (pod % 3) * 8.0
		var cz := -13.0 - (pod / 3) * 7.0
		for k in 4:
			var at := Vector3(cx + (-0.85 if k % 2 == 0 else 0.85), 0, cz + (-0.9 if k < 2 else 0.9))
			_desk_pc(v, at, 0.0 if k < 2 else PI, Color(0.35, 0.75, 1.0))
		_plant(v, Vector3(cx + 2.4, 0, cz))
	# the glass meeting room in the corner
	var gl = v.glass(Color(0.6, 0.8, 0.9, 0.22))
	v.box(Vector3(0.08, 3.0, 8.0), Vector3(10.0, 1.5, -6.0), gl)
	v.box(Vector3(7.6, 3.0, 0.08), Vector3(13.8, 1.5, -10.0), gl)
	v.box(Vector3(7.6, 3.0, 0.08), Vector3(13.8, 1.5, -2.0), gl, false)
	_table(v, Vector3(13.8, 0, -6.0), Vector2(4.0, 1.6), v.mat(Color(0.15, 0.15, 0.17), 0.3))
	v.box(Vector3(0.06, 1.4, 2.4), Vector3(17.6, 1.8, -6.0), v.glow(Color(0.3, 0.7, 1.0), 1.4), false)
	v.spot("meeting", "MEETING ROOM", Vector3(9.2, 0, -6.0), 2.0)
	v.light(Vector3(0, 3.5, -10), Color(0.95, 0.97, 1.0), 1.0, 16.0)
	v.light(Vector3(0, 3.5, -24), Color(0.95, 0.97, 1.0), 0.9, 16.0)
	v.staff([[Vector3(0, 0, -6.8), 0.0, "uniform-office", "female"], [Vector3(-4.0, 0, -18.6), 0.5, "uniform-office", "male"]])
	v.people([[Vector3(-12.0, 0, -11.5), PI], [Vector3(4.5, 0, -14.0), -0.8],
		[Vector3(12.5, 0, -5.0), PI * 0.5], [Vector3(15.0, 0, -7.0), -PI * 0.5], [Vector3(-14.0, 0, -27.0), 0.2]], 37)

# --------------------------------------------------------------------------------------------- the underground parking
static func _parking(v) -> void:
	var r := Rect2(-20, -44, 40, 44)
	v.environment(Color(0.75, 0.8, 0.85), 0.7, Color(0.02, 0.02, 0.03))
	v.shell(r, 3.4, v.mat(Color(0.28, 0.28, 0.3), 0.85), v.mat(Color(0.5, 0.5, 0.5), 0.95), v.mat(Color(0.42, 0.42, 0.44), 0.95))
	var paint = v.mat(Color(0.9, 0.9, 0.85), 0.7)
	var yellow = v.mat(Color(0.95, 0.8, 0.1), 0.6)
	var pillar = v.mat(Color(0.55, 0.55, 0.55), 0.9)
	# fluorescent strips down the drive aisles
	for z in range(-40, -2, 6):
		v.box(Vector3(0.25, 0.06, 2.4), Vector3(0, 3.36, z), v.glow(Color(0.9, 0.97, 1.0), 2.2), false)
	# two rows of bays each side of the aisle, pillars between every three
	var cars := ["luxury-sedan.glb", "muscle-car-lod.glb", "tuner.glb", "security-suv.glb", "city-pod.glb", "street-racer-lod.glb"]
	var rng := RandomNumberGenerator.new()
	rng.seed = 9
	var ci := 0
	for s: float in [-1.0, 1.0]:
		var x := s * 12.0
		for k in 14:
			var z := -4.0 - k * 2.8
			v.box(Vector3(5.4, 0.02, 0.1), Vector3(x, 0.01, z - 1.4), paint, false)
			if k % 3 == 0:
				v.box(Vector3(0.6, 3.4, 0.6), Vector3(s * 6.6, 1.7, z - 1.4), pillar)
				v.box(Vector3(0.62, 0.3, 0.62), Vector3(s * 6.6, 0.9, z - 1.4), yellow, false)
			if rng.randf() < 0.65:
				var f: String = cars[ci % cars.size()]
				ci += 1
				var yaw := PI * 0.5 if s < 0.0 else -PI * 0.5
				if v.model("res://models/fleet/" + f, Vector3(x + s * 0.4, 0, z), yaw + PI * 0.5, 4.4) == null:
					v.box(Vector3(4.2, 1.4, 1.9), Vector3(x, 0.7, z), v.mat(Color(0.3, 0.3, 0.35), 0.4, 0.5))
	# the aisle arrows, the bay numbers on the pillars, the level signs
	for z in range(-38, -4, 10):
		v.box(Vector3(0.5, 0.02, 2.0), Vector3(-2.0, 0.015, z), paint, false)
		v.box(Vector3(0.5, 0.02, 2.0), Vector3(2.0, 0.015, z + 5.0), paint, false)
	v.sign("P2", Vector3(0, 2.5, -43.6), 0.0, Color(1.0, 0.85, 0.2), 200, false)
	v.box(Vector3(2.2, 0.6, 0.06), Vector3(0, 2.9, -0.5), v.glow(Color(0.2, 1.0, 0.4), 2.0), false)
	v.sign("EXIT", Vector3(0, 2.9, -0.55), PI, Color(0.95, 1.0, 0.95), 80)
	# the ramp up at the back right, the pay station by the door
	v.box(Vector3(6.0, 3.4, 10.0), Vector3(16.5, 1.7, -38.5), v.mat(Color(0.4, 0.4, 0.42), 0.9))
	v.box(Vector3(0.8, 1.6, 0.6), Vector3(-4.0, 0.8, -1.5), v.mat(Color(0.15, 0.3, 0.6), 0.4, 0.5))
	v.box(Vector3(0.5, 0.35, 0.05), Vector3(-4.0, 1.3, -1.82), v.glow(Color(0.4, 0.8, 1.0), 1.6), false)
	v.spot("paystation", "PAY STATION", Vector3(-4.0, 0, -2.8), 1.8)
	v.light(Vector3(0, 3.0, -10), Color(0.9, 0.95, 1.0), 0.9, 14.0)
	v.light(Vector3(0, 3.0, -30), Color(0.9, 0.95, 1.0), 0.9, 14.0)
	v.staff([[Vector3(-5.2, 0, -2.4), PI * 0.5, "uniform-security", "male"]])
	v.people([[Vector3(-3.0, 0, -18.0), 0.3], [Vector3(8.0, 0, -26.0), -1.4]], 41)

# --------------------------------------------------------------------------------------------- the metro
## the Central Line platform under the hub: tiled walls, columns, benches and ticket machines, the route map, the yellow
## line at the edge, and a three-car train that runs in out of the tunnel, stands with its doors open, and runs on.
## ENTER at the edge while it stands rides it to the far end of the avenue (3 Nex)
static func _metro(v) -> void:
	var r := Rect2(-9, -60, 18, 60)
	v.environment(Color(0.85, 0.9, 0.95), 0.3, Color(0.01, 0.01, 0.02))
	var tile = v.mat(Color(0.7, 0.74, 0.76), 0.3)
	v.shell(r, 5.0, v.mat(Color(0.5, 0.5, 0.52), 0.6), tile, v.mat(Color(0.3, 0.31, 0.33), 0.9))
	_ceiling_lights(v, Rect2(-8, -59, 10, 58), 5.0, 4.0, v.glow(Color(0.95, 0.98, 1.0), 1.0))
	var blue := Color(0.15, 0.55, 1.0)
	# the track bed on the right, the platform edge with its yellow line; an unseen rail keeps you off the drop
	v.box(Vector3(6.4, 0.1, 59.4), Vector3(5.6, -0.04, -30.0), v.mat(Color(0.08, 0.08, 0.09), 0.9), false)
	for rx: float in [4.6, 6.6]:
		v.box(Vector3(0.12, 0.12, 59.4), Vector3(rx, 0.03, -30.0), v.mat(Color(0.6, 0.6, 0.62), 0.3, 0.9), false)
	v.box(Vector3(0.5, 0.03, 59.4), Vector3(2.15, 0.015, -30.0), v.mat(Color(1.0, 0.85, 0.1), 0.6), false)
	v.obstacles.append(AABB(Vector3(2.5, 0, -60), Vector3(0.2, 2.0, 60)))
	# tunnel mouths in the end walls over the track
	for zz: float in [-59.8, -0.2]:
		v.box(Vector3(5.8, 4.2, 0.1), Vector3(5.8, 2.1, zz), v.mat(Color(0.0, 0.0, 0.0), 1.0), false)
	# the platform: columns, benches, ticket machines, the route map and the line's name
	for z in range(-52, -4, 12):
		v.box(Vector3(0.6, 5.0, 0.6), Vector3(-2.0, 2.5, z), tile)
		v.box(Vector3(0.62, 0.3, 0.62), Vector3(-2.0, 2.6, z), v.glow(blue, 2.0), false)
		v.box(Vector3(0.5, 0.45, 1.8), Vector3(-7.8, 0.23, z - 6.0), v.mat(Color(0.3, 0.32, 0.35), 0.4, 0.7))
	for k in 2:
		v.box(Vector3(0.7, 1.7, 0.6), Vector3(-8.4, 0.85, -6.0 - k * 1.2), v.mat(Color(0.15, 0.3, 0.6), 0.4, 0.4))
		v.box(Vector3(0.05, 0.4, 0.4), Vector3(-8.05, 1.3, -6.0 - k * 1.2), v.glow(Color(0.5, 0.85, 1.0), 1.6), false)
	v.spot("ticket", "TICKET MACHINES", Vector3(-7.0, 0, -6.6), 1.8)
	v.box(Vector3(0.06, 1.6, 6.0), Vector3(-8.8, 2.6, -24.0), v.mat(Color(0.96, 0.96, 0.96), 0.4), false)
	v.box(Vector3(0.07, 0.08, 5.4), Vector3(-8.75, 2.6, -24.0), v.glow(blue, 2.0), false)
	v.sign("NORTH END · HUB · SOUTH END", Vector3(-8.7, 3.0, -24.0), PI * 0.5, blue, 40, false)
	v.sign("CENTRAL LINE", Vector3(-8.7, 4.0, -40.0), PI * 0.5, blue, 110)
	var board = v.sign("", Vector3(0.5, 4.2, -30.0), -PI * 0.5, Color(1.0, 0.75, 0.2), 56)
	v.spot("ride", "RIDE THE TRAIN (3 Nex)", Vector3(1.6, 0, -30.0), 3.0)
	# the train: three cars on one node, run along the track
	var train := Node3D.new()
	v.world.add_child(train)
	var silver = v.mat(Color(0.78, 0.8, 0.83), 0.3, 0.8)
	var win = v.glow(Color(0.85, 0.92, 1.0), 0.9)
	for c in 3:
		var cz := -c * 18.5
		for part in [[Vector3(3.0, 3.4, 18.0), Vector3(0, 1.9, cz), silver], [Vector3(3.02, 0.9, 16.0), Vector3(0, 2.4, cz), win],
				[Vector3(3.04, 0.25, 18.02), Vector3(0, 1.1, cz), v.glow(blue, 2.0)]]:
			var mi := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = part[0]
			mi.mesh = bm
			mi.material_override = part[2]
			mi.position = part[1]
			train.add_child(mi)
	train.position = Vector3(5.6, 0, 200.0)
	var dock_z := -10.0      # the lead car's middle when it stands at the platform
	v.data.train = "away"
	v.data.next_in = 6.0
	var st := { "phase": "away", "t": 6.0, "z": 200.0 }
	v.animate.append(func(dt: float) -> void:
		st.t -= dt
		match String(st.phase):
			"away":
				train.position.z = 200.0
				if st.t <= 0.0:
					st.phase = "in"
					st.z = 60.0
			"in":
				# in from the south tunnel (+z), braking to the stop
				var left: float = float(st.z) - dock_z
				st.z = float(st.z) - maxf(1.5, minf(18.0, left * 1.2)) * dt
				if float(st.z) <= dock_z + 0.05:
					st.z = dock_z
					st.phase = "docked"
					st.t = 9.0
			"docked":
				if st.t <= 0.0:
					st.phase = "out"
					st.t = 0.0
			"out":
				st.t += dt
				st.z = dock_z - 0.5 * minf(st.t, 6.0) * minf(st.t, 6.0) * 2.0 - maxf(0.0, st.t - 6.0) * 24.0
				if float(st.z) < -160.0:
					st.phase = "away"
					st.t = 14.0
		train.position.z = float(st.z) if String(st.phase) != "away" else 200.0
		v.data.train = String(st.phase)
		v.data.next_in = float(st.t) if String(st.phase) == "away" else 0.0
		board.text = "NEXT TRAIN  %s" % ("NOW BOARDING" if String(st.phase) == "docked" else ("ARRIVING" if String(st.phase) == "in" else ("DEPARTED" if String(st.phase) == "out" else "%d s" % int(ceil(float(st.t)))))))
	v.light(Vector3(-3, 4.2, -12), Color(0.95, 0.98, 1.0), 0.8, 16.0)
	v.light(Vector3(-3, 4.2, -42), Color(0.95, 0.98, 1.0), 0.8, 16.0)
	v.staff([[Vector3(-6.0, 0, -9.0), 0.6, "uniform-police", "female"]])
	v.people([[Vector3(-4.0, 0, -14.0), 0.8], [Vector3(-1.0, 0, -28.0), -PI * 0.5], [Vector3(-5.5, 0, -36.0), 1.6], [Vector3(-0.5, 0, -46.0), -1.2]], 43)
