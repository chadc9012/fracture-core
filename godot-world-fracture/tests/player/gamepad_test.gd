extends SceneTree
## The controller (gamepad.gd + touch_controls.gd): the layout's rules on raw pad states, and the controls fed a fake pad
## frame by frame — stick to move, right stick looks, ✕ jumps once per press, △ enters, □ reloads, R1 swaps, L1 throws,
## R2 fires and lets go, L3 sprints until you stop, triggers drive, ✕ brakes, ✕ / ○ climb and descend when flying.
##   godot --headless --path godot-world-fracture --script res://tests/player/gamepad_test.gd
const Gamepad := preload("res://scripts/player/gamepad.gd")
const Touch := preload("res://scripts/player/touch_controls.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func pad(o := {}) -> Dictionary:
	var s := { "lx": 0.0, "ly": 0.0, "rx": 0.0, "ry": 0.0, "l2": 0.0, "r2": 0.0, "buttons": {} }
	for k in o:
		s[k] = o[k]
	return s

func _init() -> void:
	# --- pure rules
	var r := Gamepad.read(pad({ "lx": 0.1, "ly": -0.1 }))
	ok(r.move == Vector2.ZERO and not r.active, "a resting stick (inside the dead zone) does nothing")
	r = Gamepad.read(pad({ "ly": -1.0 }))
	ok(r.move.y > 0.99 and absf(r.move.x) < 0.01, "stick up walks forward: %s" % r.move)
	r = Gamepad.read(pad({ "rx": 1.0 }))
	ok(r.look.x > 700.0, "right stick full right looks right fast: %s" % r.look)
	var half: float = Gamepad.read(pad({ "rx": 0.5 })).look.x
	ok(half > 0.0 and half < r.look.x * 0.4, "half a stick aims slowly (fine aim near the centre): %.0f" % half)
	ok(Gamepad.read(pad({ "r2": 1.0 })).fire, "R2 fires on foot")
	ok(not Gamepad.read(pad({ "r2": 1.0 }), "drive").fire, "R2 does not fire while driving")
	var d := Gamepad.read(pad({ "r2": 1.0 }), "drive")
	ok(d.move.y > 0.99, "R2 accelerates when driving")
	d = Gamepad.read(pad({ "l2": 1.0 }), "drive")
	ok(d.move.y < -0.99, "L2 brakes / reverses when driving")
	ok(Gamepad.read(pad({ "buttons": { JOY_BUTTON_A: true } }), "drive").brake, "✕ is the handbrake when driving")
	ok(Gamepad.read(pad({ "buttons": { JOY_BUTTON_A: true } }), "fly").ascend, "✕ climbs when flying")
	ok(Gamepad.read(pad({ "buttons": { JOY_BUTTON_B: true } }), "fly").descend, "○ descends when flying")
	ok(not Gamepad.read(pad({ "buttons": { JOY_BUTTON_A: true } }), "drive").held.jump, "✕ does not jump out of a car")

	# --- the controls fed a fake pad
	var tc: Control = Touch.new()
	tc.touch_ui = false
	get_root().add_child(tc)
	tc._pad_step(0.016, pad({ "ly": -1.0 }))
	ok(tc.move.y > 0.99 and tc.pad_active, "the controls walk forward on the stick, pad active")
	tc._pad_step(0.016, pad({ "ly": 0.0, "buttons": { JOY_BUTTON_B: false } }))
	ok(tc.move == Vector2.ZERO, "letting go of the stick stops")
	tc.take_look()
	tc._pad_step(0.1, pad({ "rx": 1.0 }))
	ok(tc.take_look().x > 50.0, "the right stick turns the camera")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_A: true } }))
	ok(tc.take_jump(), "✕ jumps")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_A: true } }))
	ok(not tc.take_jump(), "holding ✕ jumps once")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_Y: true } }))
	ok(tc.take_enter(), "△ enters (doors, cars)")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_X: true } }))
	ok(tc.take_reload(), "□ reloads")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_RIGHT_SHOULDER: true } }))
	ok(tc.take_next(), "R1 swaps weapon")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_LEFT_SHOULDER: true } }))
	ok(tc.take_grenade(), "L1 throws a grenade")
	tc._pad_step(0.016, pad({ "r2": 1.0 }))
	ok(tc.fire, "R2 held fires")
	tc._pad_step(0.016, pad({ "r2": 0.0 }))
	ok(not tc.fire, "letting go of R2 stops firing")
	tc._pad_step(0.016, pad({ "ly": -1.0, "buttons": { JOY_BUTTON_LEFT_STICK: true } }))
	ok(tc.sprint, "L3 sprints")
	tc._pad_step(0.016, pad({ "ly": -1.0 }))
	ok(tc.sprint, "the sprint stays on while moving")
	for i in 40:
		tc.sprint = false
		tc._pad_step(0.016, pad({ "ly": 0.0 }))
	tc._pad_step(0.016, pad({ "ly": -1.0 }))
	ok(not tc.sprint, "stopping ends the sprint")
	tc.set_mode("drive")
	tc._pad_step(0.016, pad({ "r2": 1.0, "lx": -1.0, "buttons": { JOY_BUTTON_A: true } }))
	ok(tc.move.y > 0.99 and tc.move.x < -0.1 and tc.brake() > 0.5, "driving: R2 throttle, stick steers, ✕ brakes")
	tc.set_mode("fly")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_A: true } }))
	ok(tc.ascend() > 0.5, "flying: ✕ climbs")
	tc._pad_step(0.016, pad({ "buttons": { JOY_BUTTON_B: true } }))
	ok(tc.descend() > 0.5, "flying: ○ descends")
	tc.set_mode("foot")
	tc.prompt("ENTER GARAGE")
	ok(String(tc._prompt_label.text).begins_with("△ ENTER GARAGE"), "the prompt shows △ with a controller: '%s'" % tc._prompt_label.text)
	print("gamepad test: " + str(fails == 0))
	quit(0 if fails == 0 else 1)
