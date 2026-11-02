extends Control
## World Fracture (Godot): the Planetary Director. The globe is home; tapping a continent twice (or OPEN MAP) opens its region
## map, and Back returns to the globe. Android's back gesture goes back too.

const PlanetView := preload("res://scripts/planet_view.gd")
const RegionMap := preload("res://scripts/region_map.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const GarageView := preload("res://scripts/garage/garage_view.gd")
const DriveView := preload("res://scripts/driving/drive_view.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")

var planet_view: Control
var region_map: Control
var region_3d: Control
var garage: Control
var driving: Control

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Data.BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	planet_view = PlanetView.new()
	planet_view.set_anchors_preset(Control.PRESET_FULL_RECT)
	planet_view.open_map.connect(_open_map)
	add_child(planet_view)
	# the garage (scripts/garage): a button over the globe
	var gb := Data.button("GARAGE", true)
	gb.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	gb.position = Vector2(-150, -70)
	gb.custom_minimum_size = Vector2(130, 52)
	gb.pressed.connect(_open_garage)
	add_child(gb)
	var drive_button := Data.button("DRIVE", true)
	drive_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	drive_button.position = Vector2(-290, -70)
	drive_button.custom_minimum_size = Vector2(130, 52)
	drive_button.pressed.connect(_open_drive)
	add_child(drive_button)
	var street_button := Data.button("NEXUS STREET", true)
	street_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	street_button.position = Vector2(-450, -70)
	street_button.custom_minimum_size = Vector2(150, 52)
	street_button.pressed.connect(_open_street)
	add_child(street_button)
	get_tree().set_auto_accept_quit(false)
	get_tree().set_quit_on_go_back(false)
	# a capture hook for checking the look off-device: --shot <png> [map:<id>] [sat]
	var args := OS.get_cmdline_user_args()
	var i := args.find("--shot")
	if i >= 0 and i + 1 < args.size():
		_shoot.call_deferred(args[i + 1], args.slice(i + 2))

func _open_map(map_id: String) -> void:
	if region_map:
		region_map.queue_free()
	region_map = RegionMap.new()
	region_map.set_anchors_preset(Control.PRESET_FULL_RECT)
	region_map.closed.connect(_close_map)
	region_map.open_3d.connect(_open_3d)
	add_child(region_map)
	region_map.show_map(map_id)
	planet_view.visible = false
	planet_view.set_process(false)

func _open_3d(map_id: String, at: Variant, street: bool) -> void:
	_close_3d()
	region_3d = Region3D.new()
	region_3d.set_anchors_preset(Control.PRESET_FULL_RECT)
	region_3d.closed.connect(_close_3d)
	add_child(region_3d)
	region_3d.show_region(map_id, at, Region3D.Mode.STREET if street else Region3D.Mode.CITY)
	if region_map:
		region_map.visible = false

func _close_3d() -> void:
	if region_3d:
		region_3d.queue_free()
		region_3d = null
	if region_map:
		region_map.visible = true

func _open_drive() -> void:
	if driving or garage:
		return
	driving = DriveView.new()
	driving.set_anchors_preset(Control.PRESET_FULL_RECT)
	driving.closed.connect(_close_drive)
	add_child(driving)
	planet_view.set_process(false)

var street: Control
func _open_street(night := false, style := "nexus") -> void:
	if street or driving or garage:
		return
	street = StreetSlice.new()
	street.night = night
	street.style = style
	street.toggle_style.connect(func():
		var n: bool = street.night
		var st: String = street.style
		_close_street()
		_open_street(n, StreetSlice.STYLES[(StreetSlice.STYLES.find(st) + 1) % StreetSlice.STYLES.size()]))
	street.toggle_night.connect(func():
		var was: bool = street.night
		var st2: String = street.style
		_close_street()
		_open_street(not was, st2))
	street.closed.connect(_close_street)
	add_child(street)
	planet_view.set_process(false)

func _close_street() -> void:
	if street:
		street.queue_free()
		street = null
	planet_view.set_process(true)

func _close_drive() -> void:
	if driving:
		driving.queue_free()
		driving = null
	planet_view.set_process(true)

func _open_garage() -> void:
	if garage:
		return
	garage = GarageView.new()
	garage.set_anchors_preset(Control.PRESET_FULL_RECT)
	garage.closed.connect(_close_garage)
	add_child(garage)
	planet_view.set_process(false)

func _close_garage() -> void:
	if garage:
		garage.queue_free()
		garage = null
	planet_view.set_process(true)

func _close_map() -> void:
	if region_map:
		region_map.queue_free()
		region_map = null
	planet_view.visible = true
	planet_view.set_process(true)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if street and street.garage_overlay:
			street.close_garage()
		elif street:
			_close_street()
		elif driving and driving.garage_overlay != null:
			driving._close_city_garage()
		elif driving:
			_close_drive()
		elif garage:
			_close_garage()
		elif region_3d:
			_close_3d()
		elif region_map:
			_close_map()
		elif what == NOTIFICATION_WM_CLOSE_REQUEST:
			get_tree().quit()

func _shoot(path: String, opts: Array) -> void:
	for o in opts:
		if String(o).begins_with("select:"):
			planet_view.select(String(o).substr(7))
		if String(o).begins_with("map:"):
			_open_map(String(o).substr(4))
		# garage[:shop[:car[:item,item...]]]  e.g. garage:neon-performance:street-racer:paint-red,spoiler-gt,glow-cyan
		if String(o).begins_with("garage"):
			var g := String(o).split(":")
			_open_garage()
			if g.size() > 1 and g[1] != "":
				garage._enter_shop(g[1])
			if g.size() > 2 and g[2] != "":
				garage.show_car(g[2])
			if g.size() > 3:
				garage.state.rep = { "nexus-customs": 3, "neon-performance": 3, "ironworks": 3, "fracture-dynamics": 3 }
				garage.pick(Array(g[3].split(",")))
		# drive[:vehicle index[:throttle]]  e.g. drive:0:1 drives the first car flat out
		if String(o).begins_with("drive"):
			var d := String(o).split(":")
			_open_drive()
			await get_tree().process_frame
			if d.size() > 1:
				driving._select_index(int(d[1]))
			if d.size() > 2:
				driving._touch_changed(float(d[2]), float(d[3]) if d.size() > 3 else 0.0, 0.0)
			# drive:i:0:0:garage parks at Nexus Customs and opens it over the street
			if d.size() > 4 and d[4] == "garage":
				driving.vehicle.position = Vector3(-32, 0, -66)
				driving.vehicle.rotation.y = 0.0
				for k in 20:
					await get_tree().process_frame
				driving._open_city_garage()
		# slice[:x,y,z:tx,ty,tz]  the Nexus street slice, optionally from another camera
		if String(o).begins_with("slice"):
			_open_street(String(o).contains("night"), "coast" if String(o).contains("coast") else ("neon" if String(o).contains("neon") else "nexus"))
			if String(o).contains("garage"):
				street.open_garage()
			var sl := street
			var q := String(o).split(":")
			if q.size() > 2:
				var f := q[1].split(","); var t := q[2].split(",")
				sl.look_from(Vector3(float(f[0]), float(f[1]), float(f[2])), Vector3(float(t[0]), float(t[1]), float(t[2])))
		if String(o) == "sat" and region_map:
			region_map.set_satellite(true)
		if String(o).begins_with("zoom:") and region_map:
			region_map.zoom_by(float(String(o).substr(5)))
		if String(o) == "3d" and region_map:
			_open_3d(region_map.map_id, null, false)
		if String(o).begins_with("street:") and region_map:
			var p: Dictionary = {}
			for q in Data.map(region_map.map_id).pois:
				if q.id == String(o).substr(7):
					p = q
			_open_3d(region_map.map_id, Vector2(p.x, p.z) if not p.is_empty() else null, true)
	var frames := 150
	for o in opts:
		if String(o).begins_with("frames:"):
			frames = int(String(o).substr(7))
	for f in frames:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(path)
	get_tree().quit()
