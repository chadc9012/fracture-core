extends Node3D
## The map's waypoint where you walk (waypoint.gd): a tall beam of light on the spot (seen over the trees and roofs, as
## GTA's and Destiny's markers are), and at the top of the screen its name, how far, and an arrow turning with the camera.
## Reaching it (8 m) clears it. It also keeps `here` (where you are) for the map's YOU. Owned by the region views that put
## you on foot (arrival_view.gd, descent.gd): setup(region, hud_parent, map_id), step(dt, you).

const Waypoint := preload("res://scripts/nav/waypoint.gd")
const COL := Color(0.95, 0.3, 0.85)

var region: Control
var map_id := ""
var wp := {}
var beam: MeshInstance3D
var label: Label
var arrow: Label
var _here_t := 0.0
var _check_t := 0.0

func setup(r: Control, hud_parent: Control, id: String) -> void:
	region = r
	map_id = id
	beam = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.9
	cm.bottom_radius = 1.4
	cm.height = 160.0
	cm.radial_segments = 12
	cm.rings = 1
	beam.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(COL.r, COL.g, COL.b, 0.35)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = m
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam.visible = false
	add_child(beam)
	label = Label.new()
	label.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	label.offset_left = -200
	label.offset_right = 200
	label.offset_top = 44
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 16)
	label.add_theme_color_override("font_color", COL.lightened(0.35))
	label.add_theme_constant_override("outline_size", 5)
	label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.visible = false
	hud_parent.add_child(label)
	arrow = Label.new()
	arrow.text = "▲"
	arrow.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	arrow.offset_left = -12
	arrow.offset_right = 12
	arrow.offset_top = 66
	arrow.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	arrow.add_theme_font_size_override("font_size", 22)
	arrow.add_theme_color_override("font_color", COL)
	arrow.pivot_offset = Vector2(12, 14)
	arrow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arrow.visible = false
	hud_parent.add_child(arrow)
	_refresh()

func _refresh() -> void:
	var w := Waypoint.get_waypoint()
	wp = w if String(w.get("map", "")) == map_id else {}

func _exit_tree() -> void:
	for n in [label, arrow]:
		if n and is_instance_valid(n):
			n.queue_free()

func step(dt: float, you: Node3D) -> void:
	_check_t -= dt
	if _check_t <= 0.0:
		_check_t = 1.0
		_refresh()
	var o: Vector2 = region.origin()
	_here_t -= dt
	if _here_t <= 0.0:
		_here_t = 2.0
		Waypoint.set_here(map_id, you.position.x + o.x, you.position.z + o.y, float(you.get("heading")) if you.get("heading") != null else 0.0)
	var on := not wp.is_empty()
	beam.visible = on
	label.visible = on
	arrow.visible = on
	if not on:
		return
	var lx := float(wp.x) - o.x
	var lz := float(wp.z) - o.y
	beam.position = Vector3(lx, region.ground(lx, lz) + 80.0, lz)
	var d := Vector2(lx - you.position.x, lz - you.position.z)
	var dist := d.length()
	if dist < 8.0:
		Waypoint.clear_waypoint()
		wp = {}
		return
	label.text = "◆ %s · %s" % [String(wp.get("name", "")) if String(wp.get("name", "")) != "" else "WAYPOINT", ("%.1f km" % (dist / 1000.0)) if dist >= 1000.0 else ("%d m" % int(dist))]
	# the arrow points the way on screen: the bearing against the camera's facing
	var cam: Camera3D = region.camera()
	var fwd := -cam.global_transform.basis.z
	var cam_yaw := atan2(fwd.x, fwd.z)
	var to_yaw := atan2(d.x, d.y)
	arrow.rotation = -(to_yaw - cam_yaw)
