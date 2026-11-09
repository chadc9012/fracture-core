extends Node3D
## Weather over a region's 3D view (asset catalog: snow, storm lightning): snowfall in a box that follows the camera —
## always on the ice and the high mountains, and wherever winter comes when the header is on WINTER — and lightning on the
## Storm Islands and in the Shrouded Swamps: every few seconds a jagged bolt strikes somewhere in front of the camera, the
## sky and the ground flash, and a second flicker follows. region_3d.gd adds it after the scene and calls `follow` and
## `set_winter`.

const SNOW_ALWAYS := ["frostveil", "frostspire"]
const LIGHTNING := ["storm", "swamps"]
## look-dev: strike at once and keep the bolt lit (the `bolt` shot option)
static var hold := false

var region_id := ""
var cam: Camera3D
var env: Environment
var snow: GPUParticles3D
var _bolt: MeshInstance3D
var _flash: OmniLight3D
var _next := 3.0
var _t := 0.0
var _flicker := 0.0
var _amb := 0.55
var _rng := RandomNumberGenerator.new()
## (x, z) -> the height a bolt strikes: the ground or the water over it
var ground_at: Callable
## () -> the point the camera is looking at (the orbit target, or ahead of the walker); bolts strike round it
var focus_at: Callable

func setup(id: String, environment: Environment, winter: bool) -> void:
	region_id = id
	env = environment
	if env:
		_amb = env.ambient_light_energy
	_rng.seed = hash(id) + 3
	snow = _snow()
	add_child(snow)
	set_winter(winter)
	if id in LIGHTNING:
		_bolt = MeshInstance3D.new()
		var bm := StandardMaterial3D.new()
		bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		bm.albedo_color = Color(0.85, 0.85, 1.0)
		bm.emission_enabled = true
		bm.emission = Color(0.75, 0.7, 1.0)
		bm.emission_energy_multiplier = 6.0
		bm.cull_mode = BaseMaterial3D.CULL_DISABLED
		_bolt.material_override = bm
		_bolt.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_bolt.visible = false
		add_child(_bolt)
		_flash = OmniLight3D.new()
		_flash.light_color = Color(0.75, 0.75, 1.0)
		_flash.omni_range = 600.0
		_flash.light_energy = 0.0
		_flash.shadow_enabled = false
		add_child(_flash)

## snow shows on the ice and the high mountains, or in winter where winter comes
func set_winter(on: bool) -> void:
	if snow:
		snow.emitting = on or region_id in SNOW_ALWAYS
		snow.visible = snow.emitting

func follow(c: Camera3D) -> void:
	cam = c

func _snow() -> GPUParticles3D:
	var gp := GPUParticles3D.new()
	gp.amount = 2200
	gp.lifetime = 6.0
	gp.preprocess = 6.0
	gp.local_coords = false
	gp.visibility_aabb = AABB(Vector3(-70, -60, -70), Vector3(140, 80, 140))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(60, 2, 60)
	pm.direction = Vector3(0.2, -1, 0.1)
	pm.spread = 12.0
	pm.initial_velocity_min = 3.0
	pm.initial_velocity_max = 5.5
	pm.gravity = Vector3(0, -1.2, 0)
	pm.turbulence_enabled = true
	pm.turbulence_noise_strength = 1.4
	pm.turbulence_noise_scale = 6.0
	pm.scale_min = 0.6
	pm.scale_max = 1.4
	gp.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.12, 0.12)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.albedo_color = Color(1, 1, 1, 0.85)
	m.disable_receive_shadows = true
	# a soft round flake, not a square
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(0.5, 0.0)
	gt.width = 32
	gt.height = 32
	m.albedo_texture = gt
	q.material = m
	gp.draw_pass_1 = q
	return gp

## a jagged bolt from the clouds to the ground: a ribbon through a random walk, with one fork
func _bolt_mesh(from: Vector3, to: Vector3) -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := [from]
	var n := 14
	for i in range(1, n):
		var t := float(i) / n
		var p := from.lerp(to, t)
		var jit := from.distance_to(to) * 0.05
		pts.append(p + Vector3(_rng.randf_range(-jit, jit), 0, _rng.randf_range(-jit, jit)))
	pts.append(to)
	var w := 1.6
	if cam:
		w = clampf(cam.global_position.distance_to(to) * 0.004, 1.6, 6.0)
	_ribbon(st, pts, w)
	var k := 4 + _rng.randi() % 5
	var fork := [pts[k]]
	var dir := Vector3(_rng.randf_range(-1, 1), -1.4, _rng.randf_range(-1, 1)).normalized()
	for i in 6:
		fork.append(fork[-1] + dir * from.distance_to(to) * 0.05 + Vector3(_rng.randf_range(-6, 6), 0, _rng.randf_range(-6, 6)))
	_ribbon(st, fork, w * 0.5)
	return st.commit()

func _ribbon(st: SurfaceTool, pts: Array, w: float) -> void:
	var side := Vector3.RIGHT
	if cam:
		side = cam.global_basis.x
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]
		var b: Vector3 = pts[i + 1]
		var wa := w * (1.0 - float(i) / pts.size() * 0.6)
		var wb := w * (1.0 - float(i + 1) / pts.size() * 0.6)
		st.add_vertex(a - side * wa)
		st.add_vertex(a + side * wa)
		st.add_vertex(b + side * wb)
		st.add_vertex(a - side * wa)
		st.add_vertex(b + side * wb)
		st.add_vertex(b - side * wb)

func _process(dt: float) -> void:
	if cam == null or not is_instance_valid(cam):
		return
	if snow and snow.emitting:
		snow.global_position = cam.global_position + Vector3(0, 22, 0) - cam.global_basis.z * 25.0
	if _bolt == null:
		return
	_t += dt
	if hold:
		if _bolt.mesh == null:
			_t = _next
		elif _flicker <= 0.0:
			_bolt.visible = true
			_flash.light_energy = 14.0
			if env:
				env.ambient_light_energy = _amb * 2.6
			return
	if _flicker > 0.0:
		_flicker -= dt
		# a strike is two or three pulses over ~0.4 s
		var on := fmod(_flicker, 0.14) > 0.05
		_bolt.visible = on
		_flash.light_energy = 14.0 if on else 0.0
		if env:
			env.ambient_light_energy = _amb * (2.6 if on else 1.0)
		if _flicker <= 0.0:
			_bolt.visible = false
			_flash.light_energy = 0.0
			if env:
				env.ambient_light_energy = _amb
	elif _t >= _next:
		_t = 0.0
		_next = _rng.randf_range(3.5, 9.0)
		_flicker = _rng.randf_range(0.3, 0.45)
		# strike round what the camera is looking at, so the bolt lands in view
		var focus: Vector3 = focus_at.call() if focus_at.is_valid() else cam.global_position - cam.global_basis.z * 300.0
		var spread := clampf(cam.global_position.distance_to(focus) * 0.45, 60.0, 420.0)
		var at := focus + cam.global_basis.x * _rng.randf_range(-spread, spread) - Vector3(cam.global_basis.z.x, 0, cam.global_basis.z.z).normalized() * _rng.randf_range(0.0, spread * 0.6)
		var gy: float = ground_at.call(at.x, at.z) if ground_at.is_valid() else 0.0
		var to := Vector3(at.x, gy, at.z)
		var from := to + Vector3(_rng.randf_range(-40, 40), 420.0, _rng.randf_range(-40, 40))
		_bolt.mesh = _bolt_mesh(from, to)
		_flash.global_position = to + Vector3(0, 80, 0)
