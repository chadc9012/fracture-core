extends Control
## World Fracture (Godot): the Planetary Director. The globe is home; tapping a continent twice (or OPEN MAP) opens its region
## map, and Back returns to the globe. Android's back gesture goes back too.

const PlanetView := preload("res://scripts/planet_view.gd")
const RegionMap := preload("res://scripts/region_map.gd")

var planet_view: Control
var region_map: Control

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Data.BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	planet_view = PlanetView.new()
	planet_view.set_anchors_preset(Control.PRESET_FULL_RECT)
	planet_view.open_map.connect(_open_map)
	add_child(planet_view)
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
	add_child(region_map)
	region_map.show_map(map_id)
	planet_view.visible = false
	planet_view.set_process(false)

func _close_map() -> void:
	if region_map:
		region_map.queue_free()
		region_map = null
	planet_view.visible = true
	planet_view.set_process(true)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if region_map:
			_close_map()
		elif what == NOTIFICATION_WM_CLOSE_REQUEST:
			get_tree().quit()

func _shoot(path: String, opts: Array) -> void:
	for o in opts:
		if String(o).begins_with("select:"):
			planet_view.select(String(o).substr(7))
		if String(o).begins_with("map:"):
			_open_map(String(o).substr(4))
		if String(o) == "sat" and region_map:
			region_map.set_satellite(true)
		if String(o).begins_with("zoom:") and region_map:
			region_map.zoom_by(float(String(o).substr(5)))
	for f in 150:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(path)
	get_tree().quit()
