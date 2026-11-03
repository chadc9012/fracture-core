extends Control
signal closed
const Session = preload("res://scripts/driving/drive_session.gd")
const Profile = preload("res://scripts/driving/drive_profile.gd")
const InputMapDrive = preload("res://scripts/driving/drive_input.gd")
const Vehicle = preload("res://scripts/driving/drive_vehicle.gd")
const Models = preload("res://scripts/driving/drive_models.gd")
const Ground = preload("res://scripts/driving/drive_ground.gd")
const Lighting = preload("res://scripts/driving/drive_lighting.gd")
const Camera = preload("res://scripts/driving/drive_camera.gd")
const Hud = preload("res://scripts/driving/drive_hud.gd")
const Controls = preload("res://scripts/driving/drive_controls.gd")
const Selector = preload("res://scripts/driving/drive_selector.gd")
const Saves = preload("res://scripts/driving/drive_saves.gd")
const Stats = preload("res://scripts/driving/drive_stats.gd")
const Road = preload("res://scripts/driving/drive_road.gd")
const Boundaries = preload("res://scripts/driving/drive_boundaries.gd")
const Course = preload("res://scripts/driving/drive_course.gd")
const Progress = preload("res://scripts/driving/drive_progress.gd")
const Records = preload("res://scripts/driving/drive_records.gd")
const City = preload("res://scripts/driving/city_block.gd")
const Signs = preload("res://scripts/driving/city_signs.gd")
const GaragePortal = preload("res://scripts/driving/city_garage_portal.gd")
const GarageView = preload("res://scripts/garage/garage_view.gd")
const SessionStore = preload("res://scripts/driving/drive_session_store.gd")
var state
var session
var world: Node3D
var vehicle: Node3D
var visual: Node3D
var hud: Control
var touch: HBoxContainer
var selector: OptionButton
var touch_throttle := 0.0
var touch_steer := 0.0
var touch_brake := 0.0
var course
var progress
var record_label: Label
var record_store
var stats_label: Label
var garage_overlay: Control
var garage_button: Button
func _ready() -> void:
	state = Saves.load_state()
	session = Session.new()
	var background := ColorRect.new()
	background.color = Color("#111820")
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(background)
	var viewport_container := SubViewportContainer.new()
	viewport_container.set_anchors_preset(Control.PRESET_FULL_RECT)
	viewport_container.stretch = true
	add_child(viewport_container)
	var viewport := SubViewport.new()
	viewport.size = Vector2i(1024, 720)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.own_world_3d = true
	if Data.phone():
		viewport.scaling_3d_scale = 0.8 # the phone's 3D resolution, as Data.tune_viewport (no MSAA here to begin with)
	viewport_container.add_child(viewport)
	world = Node3D.new()
	viewport.add_child(world)
	world.add_child(Ground.new())
	world.add_child(Road.new())
	world.add_child(City.new())
	world.add_child(Signs.new())
	world.add_child(GaragePortal.new())
	world.add_child(Boundaries.new())
	course = Course.new()
	world.add_child(course)
	progress = Progress.new()
	record_store = Records.new()
	record_store.load_records()
	world.add_child(Lighting.new())
	var cam := Camera.new()
	world.add_child(cam)
	cam.current = true
	vehicle = Vehicle.new()
	world.add_child(vehicle)
	cam.target = vehicle
	hud = Hud.new()
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(hud)
	var top := HBoxContainer.new()
	add_child(top)
	# pinned to the top-right corner and growing leftwards, so the stats text never runs off screen
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE, 16)
	top.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	selector = Selector.new()
	selector.custom_minimum_size.x = 180
	top.add_child(selector)
	selector.item_selected.connect(_select_index)
	stats_label = Label.new()
	stats_label.name = "Stats"
	top.add_child(stats_label)
	record_label = Label.new()
	record_label.position = Vector2(20, 86)
	add_child(record_label)
	garage_button = Button.new()
	garage_button.text = "NEXUS CUSTOMS"
	garage_button.pressed.connect(_open_city_garage)
	top.add_child(garage_button)
	var reset := Button.new()
	reset.text = "RESET CAR"
	reset.pressed.connect(_reset_car)
	top.add_child(reset)
	var exit := Button.new()
	exit.text = "EXIT DRIVE"
	exit.pressed.connect(_exit_drive)
	top.add_child(exit)
	touch = Controls.new()
	touch.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	touch.position = Vector2(16, -74)
	touch.direction_changed.connect(_touch_changed)
	add_child(touch)
	_select_index(0)
func _select_index(index: int) -> void:
	var id := String(selector.get_item_metadata(index))
	if selector.selected != index:
		selector.select(index)
	if not session.select(id):
		return
	if is_instance_valid(visual):
		visual.queue_free()
	visual = Models.spawn(vehicle, id, state)
	vehicle.profile = Profile.performance(state, id)
	vehicle.speed = 0.0
	vehicle.position = Vector3.ZERO
	vehicle.rotation = Vector3.ZERO
	stats_label.text = Stats.description(state, id)
	progress.reset(session.seconds)
	course.highlight(0)
	_update_records()
func _touch_changed(throttle: float, steer: float, brake: float) -> void:
	touch_throttle = throttle
	touch_steer = steer
	touch_brake = brake
func _process(delta: float) -> void:
	if not is_instance_valid(vehicle):
		return
	vehicle.throttle = clampf(InputMapDrive.throttle() + touch_throttle, -1.0, 1.0)
	vehicle.steer = clampf(InputMapDrive.steering() + touch_steer, -1.0, 1.0)
	vehicle.brake = maxf(InputMapDrive.brake(), touch_brake)
	session.tick(delta, vehicle.speed)
	garage_button.disabled = vehicle.position.distance_to(GaragePortal.LOCATION) > 19.0
	garage_button.tooltip_text = "Drive to Nexus Customs to enter" if garage_button.disabled else "Enter Nexus Customs"
	var kept := Boundaries.keep_inside(vehicle.position)
	if kept != vehicle.position:
		# hitting the kerb or the end barriers scrubs the speed instead of pinning the car there at full throttle
		vehicle.position = kept
		vehicle.speed = move_toward(vehicle.speed, 0.0, absf(vehicle.speed) * minf(1.0, delta * 6.0) + 2.0 * delta)
	var before: int = progress.next
	if progress.update(vehicle.position, session.seconds):
		record_store.record(session.vehicle_id, progress.last_lap)
		_update_records()
	if progress.next != before:
		course.highlight(progress.next)
	hud.refresh(session.vehicle_id, vehicle.speed, session.distance_m)
func _unhandled_key_input(event: InputEvent) -> void:
	if garage_overlay == null and event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		_exit_drive()

func _reset_car() -> void:
	vehicle.position = Vector3.ZERO
	vehicle.rotation = Vector3.ZERO
	vehicle.speed = 0.0
	progress.reset(session.seconds)
	course.highlight(0)
	_update_records()
func _update_records() -> void:
	var last := "" if progress.last_lap <= 0.0 else " | Last: %.2fs" % progress.last_lap
	record_label.text = "Laps: %d%s | Best: %s" % [progress.laps, last, record_store.best_label(session.vehicle_id)]
func _exit_drive() -> void:
	record_store.save_records()
	_save_drive_session()
	closed.emit()
func _exit_tree() -> void:
	if record_store != null:
		record_store.save_records()

func _open_city_garage() -> void:
	if garage_overlay != null or vehicle.position.distance_to(GaragePortal.LOCATION) > 19.0:
		return
	vehicle.speed = 0.0
	vehicle.set_physics_process(false)
	garage_overlay = GarageView.new()
	garage_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(garage_overlay)
	garage_overlay.closed.connect(_close_city_garage)

func _close_city_garage() -> void:
	if garage_overlay == null:
		return
	garage_overlay.queue_free()
	garage_overlay = null
	state = Saves.load_state()
	vehicle.profile = Profile.performance(state, session.vehicle_id)
	if is_instance_valid(visual):
		visual.queue_free()
	visual = Models.spawn(vehicle, session.vehicle_id, state)
	stats_label.text = Stats.description(state, session.vehicle_id)
	vehicle.set_physics_process(true)

func _save_drive_session() -> void:
	SessionStore.save(session.vehicle_id, session.distance_m)
