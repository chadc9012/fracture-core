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

func _process(_d: float) -> void:
	_n += 1
	if _n == 1:
		_out = OS.get_cmdline_user_args()[0]
		_v = FortView.new()
		add_child(_v)
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
