extends RefCounted
## A PlayStation (or any standard) controller in World Fracture (owner, Nov 11: "connect my PlayStation controller to the
## APK"). Pure rules, node-free so tests/player/gamepad_test.gd runs headless: `read(state, mode)` turns one frame of raw
## pad state into the same intents the touch screen and the keyboard give touch_controls.gd.
##
## Layout (Godot's standard SDL mapping; on a DualSense / DualShock A = ✕, B = ○, X = □, Y = △):
##   left stick   move (on foot, flying) · steer (driving)
##   right stick  look / aim
##   R2           fire (on foot) · accelerate (driving)
##   L2           brake / reverse (driving)
##   ✕            jump · handbrake (driving) · climb (flying, held)
##   ○            descend (flying, held)
##   □            reload
##   △            enter / exit (doors, cars)
##   L3           sprint (on until you stop)
##   R1           next weapon        L1  throw grenade        D-pad →  next grenade
## In the casino and the entertainment district: R1 / D-pad → next view, L1 / D-pad ← previous, ○ back to the street.

const DEAD := 0.18          # stick dead zone
const TRIGGER := 0.35       # a trigger counts as pulled past this
const LOOK_SPEED := 820.0   # px / s at full right-stick deflection (the same px the touch look-drag gives)

## raw state: { "lx", "ly", "rx", "ry", "l2", "r2": float, "buttons": { JOY_BUTTON_*: bool } } (stick y down = +1)
## returns { move: Vector2 (x right, y forward), look: Vector2 (px/s), fire, brake, ascend, descend: bool,
##           held: { name: bool } for the edge-triggered buttons (jump, reload, enter, next, grenade, cycle, sprint) }
static func read(state: Dictionary, mode := "foot") -> Dictionary:
	var b: Dictionary = state.get("buttons", {})
	var stick := _dead(Vector2(float(state.get("lx", 0.0)), float(state.get("ly", 0.0))))
	var look := _dead(Vector2(float(state.get("rx", 0.0)), float(state.get("ry", 0.0))))
	# a gentle curve: fine aim near the centre, full speed at the edge
	look = look * look.length() * LOOK_SPEED
	var r2 := float(state.get("r2", 0.0)) > TRIGGER
	var l2 := float(state.get("l2", 0.0)) > TRIGGER
	var move := Vector2(stick.x, -stick.y)
	if mode == "drive":
		# triggers drive: R2 on, L2 back; the stick still works for players who drive with it
		var t := float(state.get("r2", 0.0)) - float(state.get("l2", 0.0))
		if absf(t) > 0.05:
			move.y = clampf(t, -1.0, 1.0)
	return {
		# driving: steer and throttle are separate axes (full lock and full throttle at once); walking: one direction
		"move": move.clamp(Vector2(-1, -1), Vector2(1, 1)) if mode == "drive" else move.limit_length(1.0),
		"look": look,
		"fire": r2 and mode == "foot",
		"brake": mode == "drive" and bool(b.get(JOY_BUTTON_A, false)),
		"ascend": mode == "fly" and bool(b.get(JOY_BUTTON_A, false)),
		"descend": mode == "fly" and bool(b.get(JOY_BUTTON_B, false)),
		"held": {
			"jump": bool(b.get(JOY_BUTTON_A, false)) and mode == "foot",
			"reload": bool(b.get(JOY_BUTTON_X, false)),
			"enter": bool(b.get(JOY_BUTTON_Y, false)),
			"next": bool(b.get(JOY_BUTTON_RIGHT_SHOULDER, false)),
			"grenade": bool(b.get(JOY_BUTTON_LEFT_SHOULDER, false)),
			"cycle": bool(b.get(JOY_BUTTON_DPAD_RIGHT, false)),
			"sprint": bool(b.get(JOY_BUTTON_LEFT_STICK, false)),
		},
		"active": stick != Vector2.ZERO or look != Vector2.ZERO or r2 or l2 or b.values().has(true),
	}

static func _dead(v: Vector2) -> Vector2:
	var l := v.length()
	if l < DEAD:
		return Vector2.ZERO
	# rescale so movement starts from zero just past the dead zone
	return v / l * clampf((l - DEAD) / (1.0 - DEAD), 0.0, 1.0)

## the live pad's state (the first connected controller), in read()'s shape; {} when none is connected
static func poll() -> Dictionary:
	var pads := Input.get_connected_joypads()
	if pads.is_empty():
		return {}
	var d: int = pads[0]
	var buttons := {}
	for btn in [JOY_BUTTON_A, JOY_BUTTON_B, JOY_BUTTON_X, JOY_BUTTON_Y, JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_RIGHT_SHOULDER,
			JOY_BUTTON_LEFT_STICK, JOY_BUTTON_RIGHT_STICK, JOY_BUTTON_DPAD_UP, JOY_BUTTON_DPAD_DOWN, JOY_BUTTON_DPAD_LEFT,
			JOY_BUTTON_DPAD_RIGHT, JOY_BUTTON_START, JOY_BUTTON_BACK]:
		buttons[btn] = Input.is_joy_button_pressed(d, btn)
	return {
		"lx": Input.get_joy_axis(d, JOY_AXIS_LEFT_X), "ly": Input.get_joy_axis(d, JOY_AXIS_LEFT_Y),
		"rx": Input.get_joy_axis(d, JOY_AXIS_RIGHT_X), "ry": Input.get_joy_axis(d, JOY_AXIS_RIGHT_Y),
		"l2": Input.get_joy_axis(d, JOY_AXIS_TRIGGER_LEFT), "r2": Input.get_joy_axis(d, JOY_AXIS_TRIGGER_RIGHT),
		"buttons": buttons, "name": Input.get_joy_name(d),
	}
