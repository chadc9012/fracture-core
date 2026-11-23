extends Node
## Look-dev for Fracture Royale: the view alone, a frame saved at a beat of the match.
## Usage: godot --path . res://tests/tools/royale_shot.tscn -- out_prefix   (a scene, not --script: the region needs the autoloads)
##   WF_ROYALE=kit      the drop kit screen
##   WF_ROYALE=ground   on the ground among loot of every rarity, a chest, a supply drop, a vehicle
##   WF_ROYALE=wing     the wingsuit, then the sport canopy (both granted for the shot, not saved)
##   (unset)            the dropship, then the free fall
const RoyaleView := preload("res://scripts/killbox/royale_view.gd")
const WARM := 240          # frames for the forest to stream in before anything is judged
var _n := 0
var _v: Control
var _out := ""
var _what := ""

func _snap(tag: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s-%s.png" % [_out, tag])

func _process(_d: float) -> void:
	_n += 1
	if _n == 1:
		_out = OS.get_cmdline_user_args()[0]
		_what = OS.get_environment("WF_ROYALE")
		_v = RoyaleView.new()
		_v.show_kit = _what == "kit"
		_v.drop_in = _what != "ground"
		add_child(_v)
	if _n == 3:
		_v.controls.scripted = true
		_v.set_process(false)
	if _n == WARM:
		_v.set_process(true)
		if _what == "wing":
			_v.kit.owned = ["canopy-standard", "canopy-sport", "wingsuit"]
		if _what == "ground":
			var at: Vector3 = _v.operator.position
			var f := Vector3(-sin(_v.operator.cam_yaw), 0, -cos(_v.operator.cam_yaw))
			var r := Vector3(cos(_v.operator.cam_yaw), 0, -sin(_v.operator.cam_yaw))
			for k in 5:
				var p: Vector3 = at + f * (5.0 + k * 0.4) + r * (k * 2.2 - 4.4)
				p.y = _v.region.ground(p.x, p.z)
				_v.loot.add("gun", p, ["AUTO", "SMG", "SHOTGUN", "SNIPER", "LMG"][k], ["common", "uncommon", "rare", "epic", "legendary"][k])
			for k in 3:
				var p2: Vector3 = at + f * 3.2 + r * (k * 1.6 - 1.6)
				p2.y = _v.region.ground(p2.x, p2.z)
				_v.loot.add(["ammo", "plate", "med"][k], p2)
			var pc: Vector3 = at + f * 10.0 + r * 3.0
			pc.y = _v.region.ground(pc.x, pc.z)
			_v.loot.add("chest", pc)
			var sp: Vector3 = at + f * 18.0 - r * 6.0
			_v.loot.add("supply", Vector3(sp.x, _v.region.ground(sp.x, sp.z), sp.z))
			var pv: Vector3 = at + f * 9.0 - r * 7.0
			_v.rides.add(_v.region.world(), 0, Vector3(pv.x, _v.region.ground(pv.x, pv.z), pv.z), _v.operator.cam_yaw + 0.9)
	if _n == WARM + 30:
		if _what == "kit":
			_snap("kit")
			get_tree().quit()
		elif _what == "ground":
			_snap("ground")
			get_tree().quit()
		elif _what == "wing":
			_v._jump()
			_v.controls.sprint = true
		else:
			_snap("ship")
			_v._jump()
	if _n == WARM + 55:
		if _what == "wing":
			_snap("wingsuit")
			_v.controls.sprint = false
			_v._open_canopy()
		else:
			_snap("fall")
			get_tree().quit()
	if _n == WARM + 75 and _what == "wing":
		_snap("sport-canopy")
		get_tree().quit()
