extends Control
## World Fracture (Godot): the Planetary Director. The globe is home; tapping a continent twice (or OPEN MAP) opens its region
## map, and Back returns to the globe. Android's back gesture goes back too.

const PlanetView := preload("res://scripts/planet_view.gd")
const RegionMap := preload("res://scripts/region_map.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const GarageView := preload("res://scripts/garage/garage_view.gd")
const DriveView := preload("res://scripts/driving/drive_view.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")
const CharacterCreator := preload("res://scripts/character/character_creator.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")

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
	var op_button := Data.button("OPERATOR", true)
	op_button.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	op_button.position = Vector2(-590, -70)
	op_button.custom_minimum_size = Vector2(130, 52)
	op_button.pressed.connect(_open_creator)
	add_child(op_button)
	get_tree().set_auto_accept_quit(false)
	get_tree().set_quit_on_go_back(false)
	# onboarding: the first launch starts in the operator creator
	if not CharacterStore.exists() and OS.get_cmdline_user_args().find("--shot") < 0:
		_open_creator.call_deferred(true)
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

var creator: Control
func _open_creator(first := false) -> void:
	if creator:
		return
	creator = CharacterCreator.new()
	creator.onboarding = first
	creator.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	creator.closed.connect(_close_creator)
	creator.confirmed.connect(func(_l: Dictionary) -> void: _close_creator())
	add_child(creator)
	planet_view.set_process(false)

func _close_creator() -> void:
	if creator:
		creator.queue_free()
		creator = null
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
		if creator and not creator.onboarding:
			_close_creator()
		elif street and street.sports_overlay:
			street.close_sports()
		elif street and street.casino_overlay:
			street.close_casino()
		elif street and street.mall_overlay:
			street.close_mall()
		elif street and street.garage_overlay:
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
		# casino[:view]  the Skyline Casino: 0-3 the floor, 4-6 the penthouse, 7-8 the skydeck concert
		if String(o).begins_with("casino"):
			_open_street()
			street.open_casino()
			var cv := String(o).split(":")
			if cv.size() > 1:
				street.casino_overlay.show_view(int(cv[1]))
		# sports[:view]  the sports district: 0-2 Pulse Arena, 3-4 Sunset Courts, 5-7 Iron Pulse gym
		if String(o).begins_with("sports"):
			_open_street()
			street.open_sports()
			var sv := String(o).split(":")
			if sv.size() > 1:
				street.sports_overlay.show_view(int(sv[1]))
		# mall[:view]  the Galleria mall interior
		if String(o).begins_with("mall"):
			_open_street()
			street.open_mall()
			var mv := String(o).split(":")
			if mv.size() > 1:
				street.mall_overlay.show_view(int(mv[1]))
			var sl := street
			var q := String(o).split(":")
			if q.size() > 2:
				var f := q[1].split(","); var t := q[2].split(",")
				sl.look_from(Vector3(float(f[0]), float(f[1]), float(f[2])), Vector3(float(t[0]), float(t[1]), float(t[2])))
		# char[:body[:face[:tab[:key=value,...]]]]  the operator creator, e.g. char:female:f-cyber:HAIR or char:male:m-rebel:FACE:hair=afro,beard=full
		if String(o).begins_with("char"):
			var c := String(o).split(":")
			var lk := CharacterStore.default_look()
			if c.size() > 1 and c[1] != "":
				lk = CharacterStore.clean({"frame": "goliath" if c[1] != "female" else "nyx", "body": c[1], "face": c[2] if c.size() > 2 else ""}, true)
			if c.size() > 4:
				for kv in c[4].split(","):
					var pair := kv.split("=")
					if pair.size() == 2:
						lk[pair[0]] = Array(pair[1].split("+")) if pair[0] == "marks" else pair[1]
				lk = CharacterStore.clean(lk)
			creator = CharacterCreator.new()
			creator.look = lk
			if c.size() > 3 and c[3] != "":
				creator.tab = c[3].replace("_", " ")
			creator.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
			add_child(creator)
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
	var perf := ""
	for o in opts:
		if String(o).begins_with("perf:"):
			perf = String(o).substr(5)
	var times: Array[float] = []
	for f in frames:
		var t0 := Time.get_ticks_usec()
		await get_tree().process_frame
		times.append((Time.get_ticks_usec() - t0) / 1000.0)
	get_viewport().get_texture().get_image().save_png(path)
	if perf != "":
		_write_perf(perf, opts, times)
	get_tree().quit()

## --shot ... perf:<file.json>: what the last frame cost (draw calls, objects, primitives are what limit a phone; frame
## times on a software renderer only compare scenes with each other)
func _write_perf(file: String, opts: Array, times: Array[float]) -> void:
	var tail := times.slice(maxi(0, times.size() - 30))
	tail.sort()
	var out := {
		"scene": " ".join(opts.filter(func(o): return not String(o).begins_with("perf:") and not String(o).begins_with("frames:"))),
		"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"nodes": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
		"static_mb": Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0,
		"video_mb": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0,
		"frame_ms_median": tail[tail.size() / 2] if not tail.is_empty() else 0.0,
	}
	out["heaviest"] = _heaviest_geometry()
	var f := FileAccess.open(file, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(out))

## the scene's biggest triangle counts (whole node, before culling), named by the node and its parent's script
func _heaviest_geometry() -> Array:
	var rows: Array = []
	var stack: Array[Node] = [get_tree().root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		var tris := 0
		var count := 1
		if n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh and (n as MultiMeshInstance3D).multimesh.mesh:
			var mm := (n as MultiMeshInstance3D).multimesh
			tris = _mesh_tris(mm.mesh)
			count = mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count
		elif n is MeshInstance3D and (n as MeshInstance3D).mesh:
			tris = _mesh_tris((n as MeshInstance3D).mesh)
		if tris * count < 20000:
			continue
		var gi := n as GeometryInstance3D
		var owner_script: Script = n.get_parent().get_script() if n.get_parent() else null
		rows.append({"node": "%s/%s" % [owner_script.resource_path.get_file() if owner_script else n.get_parent().name, n.name],
			"tris": tris * count, "per": tris, "count": count, "shadow": gi.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF,
			"range": gi.visibility_range_end})
	rows.sort_custom(func(a, b): return a.tris > b.tris)
	return rows.slice(0, 12)

func _mesh_tris(mesh: Mesh) -> int:
	var t := 0
	for s in mesh.get_surface_count():
		var arr := mesh.surface_get_arrays(s)
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
		t += (idx.size() if idx.size() > 0 else (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()) / 3
	return t
