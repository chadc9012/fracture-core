extends CharacterBody3D
## A Fracture echo: a person-shaped tear in reality that walks out of the smoke. It flickers between shapes (a glitch shader
## on the casino's figure mesh), closes on the player and strikes. The elite ("anchor") is twice the size, ringed by
## shards, and charges. Group "echo"; the player's shots call take_damage().

signal died(echo: Node3D)

const Figure := preload("res://scripts/city/casino_interior.gd")

var elite := false
var hp := 60.0
var target: Node3D
var _hit_cd := 1.0
var _charge_cd := 4.0
var _charging := 0.0
var _knock := Vector3.ZERO
var _rise := 1.0
var _mat: ShaderMaterial
var _flash := 0.0
var _shards: Node3D
var dead := false

const GLITCH := """
shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;
uniform vec3 core : source_color = vec3(0.55, 0.25, 1.0);
uniform vec3 edge : source_color = vec3(0.2, 0.95, 1.0);
uniform float flash = 0.0;
uniform float rise = 0.0;
float h(float x) { return fract(sin(x * 91.7) * 43758.5453); }
varying float band;
varying vec3 lp;
void vertex() {
	lp = VERTEX;
	band = floor(VERTEX.y * 14.0 + floor(TIME * 9.0));
	// slices of the body jump sideways for a frame now and then
	float j = step(0.93, h(band + floor(TIME * 13.0))) * (h(band * 3.1) - 0.5) * 0.18;
	VERTEX.x += j;
	VERTEX.z += j * 0.5;
}
void fragment() {
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	float scan = 0.5 + 0.5 * sin(lp.y * 120.0 - TIME * 14.0);
	float flick = 0.75 + 0.25 * step(0.2, h(floor(TIME * 20.0)));
	ALBEDO = vec3(0.02, 0.01, 0.04);
	EMISSION = (core * (0.35 + 0.4 * scan) + edge * fres * 2.2) * flick + vec3(1.0) * flash * 3.0;
	ROUGHNESS = 0.3;
	// it forms out of the floor upward
	if (lp.y > rise * 2.0) discard;
}
"""

func setup(is_elite: bool, chase: Node3D) -> void:
	elite = is_elite
	target = chase
	hp = 650.0 if elite else 60.0

func _ready() -> void:
	add_to_group("echo")
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var s := 1.75 if elite else 1.0
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.36 * s
	cap.height = 1.8 * s
	shape.shape = cap
	shape.position.y = 0.9 * s
	add_child(shape)
	var mi := MeshInstance3D.new()
	mi.mesh = Figure.figure(0 if not elite else 1)
	var sh := Shader.new()
	sh.code = GLITCH
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	if elite:
		_mat.set_shader_parameter("core", Color(1.0, 0.2, 0.45))
		_mat.set_shader_parameter("edge", Color(1.0, 0.7, 0.3))
	mi.material_override = _mat
	mi.scale = Vector3.ONE * s
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var glow := OmniLight3D.new()
	glow.light_color = Color(0.6, 0.3, 1.0) if not elite else Color(1.0, 0.3, 0.4)
	glow.light_energy = 1.2 if not elite else 2.5
	glow.omni_range = 4.0 * s
	glow.position.y = 1.2 * s
	add_child(glow)
	if elite:
		_shards = Node3D.new()
		_shards.position.y = 2.2
		add_child(_shards)
		var sm := StandardMaterial3D.new()
		sm.albedo_color = Color(0.1, 0.02, 0.05)
		sm.emission_enabled = true
		sm.emission = Color(1.0, 0.35, 0.5)
		sm.emission_energy_multiplier = 4.0
		for k in 7:
			var shard := MeshInstance3D.new()
			var p := PrismMesh.new()
			p.size = Vector3(0.18, 0.7, 0.18)
			shard.mesh = p
			var a := TAU * k / 7.0
			shard.position = Vector3(cos(a) * 1.6, sin(a * 2.0) * 0.3, sin(a) * 1.6)
			shard.rotation = Vector3(randf(), randf(), randf())
			shard.material_override = sm
			_shards.add_child(shard)
	_rise = 0.0

func _physics_process(delta: float) -> void:
	if dead:
		return
	_rise = minf(1.0, _rise + delta * 0.8)
	_mat.set_shader_parameter("rise", _rise * 1.2)
	_flash = maxf(0.0, _flash - delta * 6.0)
	_mat.set_shader_parameter("flash", _flash)
	if _shards:
		_shards.rotation.y += delta * 1.4
	if _rise < 1.0 or not target:
		return
	var to := target.global_position - global_position
	to.y = 0.0
	var dist := to.length()
	var dir := to / maxf(dist, 0.001)
	var speed := 2.1 if elite else 3.1
	_hit_cd -= delta
	if elite:
		_charge_cd -= delta
		if _charging > 0.0:
			_charging -= delta
			speed = 13.0
		elif _charge_cd <= 0.0 and dist > 5.0 and dist < 18.0:
			_charging = 0.7
			_charge_cd = 5.0
	var reach := 2.2 if elite else 1.4
	var v := Vector3.ZERO
	if dist > reach * 0.85:
		v = dir * speed
	elif _hit_cd <= 0.0:
		_hit_cd = 1.3 if elite else 1.1
		if target.has_method("take_damage"):
			target.call("take_damage", 24.0 if elite else 11.0)
	v += _knock
	_knock = _knock.move_toward(Vector3.ZERO, 30.0 * delta)
	velocity = Vector3(v.x, velocity.y - 22.0 * delta if not is_on_floor() else -0.5, v.z)
	move_and_slide()
	if dist > 0.1:
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), minf(1.0, 8.0 * delta))

func near_player(r := 2.0) -> bool:
	return target != null and global_position.distance_to(target.global_position) < r

func take_damage(d: float) -> void:
	if dead or _rise < 1.0:
		return
	hp -= d
	_flash = 1.0
	if hp <= 0.0:
		dead = true
		remove_from_group("echo")
		died.emit(self)
		var tw := create_tween()
		tw.tween_property(self, "scale", Vector3(1.4, 0.02, 1.4), 0.35)
		tw.tween_callback(queue_free)

func knock(v: Vector3) -> void:
	_knock = v * (0.3 if elite else 1.0)
