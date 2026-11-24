extends Node
## Look-dev for Fort Kessler: the view alone, frames from set camera spots.
## Usage: godot --path . res://tests/tools/fort_shot.tscn -- out_prefix
const FortView := preload("res://scripts/military/fort_view.gd")
const SHOTS := [
	["gate", Vector3(-200, 2.2, 330), Vector3(-200, 1.8, 290)],
	["soldiers", Vector3(-202, 1.7, 296), Vector3(-200, 1.3, 286)],
	["runway", Vector3(150, 6, 300), Vector3(150, 2, 100)],
	["apron", Vector3(20, 3.5, 40), Vector3(-40, 5, -150)],
	["tower", Vector3(30, 3.0, 170), Vector3(-30, 14, 110)],
	["jets", Vector3(95, 2.5, -150), Vector3(55, 2, -230)],
	["motorpool", Vector3(-150, 2.5, 95), Vector3(-200, 2, 60)],
	["aerial", Vector3(320, 160, 420), Vector3(0, 0, -120)],
]
var _n := 0
var _v: Control
var _out := ""
var _cam: Camera3D
const GATE_X_SHOT := -200.0

func _process(_d: float) -> void:
	_n += 1
	if _n == 1:
		_out = OS.get_cmdline_user_args()[0]
		_v = FortView.new()
		add_child(_v)
	if _n == 5 and OS.get_environment("WF_FORT") == "fly":
		# a stolen jet in the air, from its own chase camera: the apron jet, throttle, UP and a bank for 10 s of game time
		_v.set_process(false)
		_v.controls.scripted = true
		_v.operator.position = _v.air.parked[0].position + Vector3(0, 0, 4)
		_v.controls._enter = true
		_v._process(0.05)
		_v.controls.move = Vector2(0, 1)
		for k in 200:
			_v.controls._brake_held = k > 110 and k < 175
			_v.controls.move = Vector2(-0.5 if k > 160 else 0.0, 1)
			_v._process(0.05)
	if _n == 5 and OS.get_environment("WF_FORT") == "mg":
		# the Humvee minigun at the gate, firing on the garrison
		_v.set_process(false)
		_v.controls.scripted = true
		var hv: Node3D = null
		for c in _v.rides.parked:
			if c.get_meta("minigun", false):
				hv = c
				break
		_v.operator.position = hv.position + Vector3(2, 0, 0)
		_v.controls._enter = true
		_v._process(0.05)
		_v._raise(2, "shot")
		_v.controls._cannon_held = true
	if _n > 5 and _n < 60 and OS.get_environment("WF_FORT") == "mg":
		# the camera behind the gun, toward the soldiers at the gate
		_v.controls.look_delta = Vector2.ZERO
		var tgt := Vector3(GATE_X_SHOT, 0, 300)
		var hv2: Node3D = _v.rides.car.node
		_v.operator.cam_yaw = atan2(hv2.position.x - tgt.x, hv2.position.z - tgt.z)
		_v._process(0.016)
	if _n == 60 and OS.get_environment("WF_FORT") == "mg":
		get_viewport().get_texture().get_image().save_png("%s-mg.png" % _out)
		get_tree().quit()
	if _n >= 5 and OS.get_environment("WF_FORT") == "mg":
		return
	if _n > 5 and _n < 60 and OS.get_environment("WF_FORT") == "fly":
		_v._process(0.016)
	if _n == 60 and OS.get_environment("WF_FORT") == "fly":
		get_viewport().get_texture().get_image().save_png("%s-fly.png" % _out)
		get_tree().quit()
	if _n >= 5 and OS.get_environment("WF_FORT") == "fly":
		return
	if _n == 5:
		_v.set_process(false)
		_cam = Camera3D.new()
		_cam.fov = 62.0
		_cam.far = 6000.0
		_v.world.add_child(_cam)
		_cam.current = true
	var i := (_n - 30) / 20
	if _n >= 30 and (_n - 30) % 20 == 0 and i < SHOTS.size():
		var s: Array = SHOTS[i]
		_cam.position = s[1]
		_cam.look_at(s[2])
	if _n >= 30 and (_n - 30) % 20 == 19 and i < SHOTS.size():
		get_viewport().get_texture().get_image().save_png("%s-%s.png" % [_out, SHOTS[i][0]])
		if i == SHOTS.size() - 1:
			get_tree().quit()
