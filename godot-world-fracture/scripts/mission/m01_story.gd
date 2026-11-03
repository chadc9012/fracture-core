extends RefCounted
## Mission 01 — "The Fracture": the story's opening, as data and a stepper (a port of the web game's story-start.ts,
## residence-life.ts and breach.ts). A new character wakes in Apartment 1204 of the Nexus City Residences as an ordinary
## civilian. The first morning (get dressed, breakfast, messages, the news, say hi to Mara in the lobby, pick up the mail);
## then the Fracture hits: the elevators die, the stairs are the only way down, Mara is trapped in the Sky Lounge on 11,
## and out of the lobby doors the street is already breaking. The Breach: the Operator's powers wake under pressure —
## DAZED (unarmed) -> SURGE (armour and weapon) -> ANCHOR (the primary ability and dash, against an elite) -> CLEAR.
## No scene code here, so it is testable; mission_01.gd drives it.

const MORNING := [
	{ "id": "dress", "label": "Get dressed", "hint": "Wardrobe · bedroom" },
	{ "id": "breakfast", "label": "Make breakfast", "hint": "Kitchen island" },
	{ "id": "phone", "label": "Check your messages", "hint": "Phone · by the sofa" },
	{ "id": "news", "label": "Watch the morning news", "hint": "The TV wall" },
	{ "id": "neighbour", "label": "Say hi to Mara", "hint": "Lobby lounge" },
	{ "id": "mail", "label": "Pick up your mail", "hint": "Lobby · mail room" },
]
const MORNING_LINES := {
	"dress": [["", "Black jacket. It's going to be a long day."]],
	"breakfast": [["", "Coffee. Toast. The building hums like it always does."]],
	"phone": [["MOM", "Call me when you're up. Love you."], ["NEXUS ALERT", "Grid maintenance near the stability towers today. Expect flickers."]],
	"news": [["NEXUS NEWS", "Residents report flickering lights near the stability towers. The Capitol says there's nothing to worry about."]],
	"neighbour": [["MARA", "Morning, neighbour. Building's been quiet. Too quiet, if you ask me."], ["MARA", "If the lifts ever stop, take the stairs. Don't wait for anyone."]],
	"mail": [["ELLIS", "Something came for 12-04. No sender. Just your name."], ["", "Inside: a black card. One word on it — RESONANCE."]],
}
const ALARM_LINES := [
	["", "The windows shake. Every light in the building goes out at once."],
	["BUILDING", "EMERGENCY. Structural event. Elevators offline. Use the emergency stairs."],
	["MARA", "(radio) I'm stuck in the Sky Lounge on 11 — the doors jammed. Please."],
]
const RESCUE_LINES := [["MARA", "You came back for me. Go, go — I'm right behind you."]]
const BREACH_ENTER := {
	"DAZED": [["MARA", "Something's coming out of the smoke. Move!"]],
	"SURGE": [["NOVA", "Your body just answered the Fracture. Armor forming. Weapon system online."], ["NOVA", "Point it at them and squeeze. Your hands know how."]],
	"ANCHOR": [["NOVA", "Something big is anchoring itself to the tear. Your resonance is spiking."], ["NOVA", "Don't hold it back. Let it out."]],
	"CLEAR": [["NOVA", "Readings settling. You did that."], ["MARA", "What did they do to you? What are you?"], ["NOVA", "I don't know yet either. Stay with me. We'll learn the rest as we go."]],
}
const BREACH_NUDGE := {
	"SURGE": ["NOVA", "Breathe. Find one in your sights. Squeeze."],
	"ANCHOR": ["NOVA", "Reach for it. The surge in your chest: release it at the anchor."],
}
const OBJECTIVE := {
	"ALARM": "Get down the emergency stairs",
	"DAZED": "Get clear of the building",
	"SURGE": "Survive the breach",
	"ANCHOR": "Stop the anchor",
	"CLEAR": "Catch your breath",
	"DONE": "Head to the Metro Tower",
}
const DAZED_S := 9.0
const NUDGE_S := 14.0
const CLEAR_S := 9.0
const HP_FLOOR := 40.0
const REWARD := { "xp": 650, "nex": 350, "rescue_xp": 200 }

## phase: MORNING -> ALARM -> CINE -> DAZED -> SURGE -> ANCHOR -> CLEAR -> DONE
var phase := "MORNING"
var done := {}
var rescued := false
var since := 0.0
var nudged := false

func morning_left() -> Array:
	return MORNING.filter(func(s: Dictionary) -> bool: return not done.has(s.id))

## the steps still showing on the tracker (done ones are kept, ticked)
func tracker() -> Array:
	if phase == "MORNING":
		return MORNING.map(func(s: Dictionary) -> Dictionary: return { "label": s.label, "hint": s.hint, "done": done.has(s.id) })
	var t: Array = [{ "label": OBJECTIVE.get(phase, ""), "hint": "", "done": false }]
	if phase == "ALARM":
		t.append({ "label": "Optional: free Mara · Sky Lounge, 11", "hint": "", "done": rescued })
	return t

## tick a morning step; returns the lines to say, and moves to ALARM once all six are done
func mark(step: String, now: float) -> Array:
	if phase != "MORNING" or done.has(step) or not MORNING_LINES.has(step):
		return []
	done[step] = true
	var lines: Array = MORNING_LINES[step].duplicate()
	if morning_left().is_empty():
		phase = "ALARM"
		since = now
		lines.append_array(ALARM_LINES)
	return lines

func rescue() -> Array:
	if phase != "ALARM" or rescued:
		return []
	rescued = true
	return RESCUE_LINES

## out of the lobby doors during the alarm: the opening cinematic
func exit_building(now: float) -> bool:
	if phase != "ALARM":
		return false
	phase = "CINE"
	since = now
	return true

func _enter(p: String, now: float) -> Array:
	phase = p
	since = now
	nudged = false
	return BREACH_ENTER.get(p, [])

## events: "cine_done", "threat", "wave_clear", "anchor_down", "tick". Returns lines to say.
func event(e: String, now: float) -> Array:
	match phase:
		"CINE":
			if e == "cine_done":
				return _enter("DAZED", now)
		"DAZED":
			if e == "threat" or (e == "tick" and now - since >= DAZED_S):
				return _enter("SURGE", now)
		"SURGE":
			if e == "wave_clear":
				return _enter("ANCHOR", now)
		"ANCHOR":
			if e == "anchor_down":
				return _enter("CLEAR", now)
		"CLEAR":
			if e == "tick" and now - since >= CLEAR_S:
				phase = "DONE"
				since = now
				return []
	if e == "tick" and not nudged and BREACH_NUDGE.has(phase) and now - since >= NUDGE_S:
		nudged = true
		return [BREACH_NUDGE[phase]]
	return []

## which powers are awake: 0 civilian, 1 fire + melee, 2 + resonance blast + dash, 3 everything
func powers() -> int:
	match phase:
		"SURGE": return 1
		"ANCHOR": return 2
		"CLEAR", "DONE": return 3
	return 0

## the enemies on the street for the phase: [echoes, elites]
func wave() -> Array:
	match phase:
		"DAZED": return [1, 0]
		"SURGE": return [3, 0]
		"ANCHOR": return [2, 1]
	return [0, 0]

func reward() -> Dictionary:
	return { "xp": REWARD.xp + (REWARD.rescue_xp if rescued else 0), "nex": REWARD.nex }

func save() -> Dictionary:
	return { "phase": phase, "done": done.keys(), "rescued": rescued }

## a save resumes at a safe point: the morning keeps its ticks; anything past the alarm restarts the escape
func restore(d: Dictionary) -> void:
	for k: String in d.get("done", []):
		done[k] = true
	rescued = d.get("rescued", false)
	var p: String = d.get("phase", "MORNING")
	phase = "DONE" if p == "DONE" else ("ALARM" if p != "MORNING" else "MORNING")
	if phase == "MORNING" and morning_left().is_empty():
		phase = "ALARM"
