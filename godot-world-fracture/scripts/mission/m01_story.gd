extends RefCounted
## Mission 01 — "The Fracture": the story's opening, as data and a stepper (a port of the web game's story-start.ts,
## residence-life.ts and breach.ts, re-cut Nov 9 to the owner's cinematic script "The Day the World Fractured"). A new
## character wakes in Apartment 12-04 of the Nexus City Residences as an ordinary civilian. The morning at home (get
## dressed, breakfast, the messages — Mom, Mara from 11, a grid alert — and an envelope under the door); then the morning
## news, and the Fracture hits mid-broadcast (the cinematic: the sky splits, NOVA wakes in the player's head). The
## elevators are dead, the stairwell is blocked until the first power answers, Mara is trapped in the Sky Lounge on 11,
## and out of the lobby doors the street is already breaking. The Breach: the Operator's powers wake under pressure —
## DAZED (unarmed) -> SURGE (armour and weapon) -> ANCHOR (the primary ability and dash, against an elite) -> CLEAR.
## No scene code here, so it is testable; mission_01.gd drives it.

const MORNING := [
	{ "id": "dress", "label": "Get dressed", "hint": "Wardrobe · bedroom" },
	{ "id": "breakfast", "label": "Make breakfast", "hint": "Kitchen island" },
	{ "id": "phone", "label": "Check your messages", "hint": "Phone · by the sofa" },
	{ "id": "mail", "label": "Pick up the envelope", "hint": "Under the front door" },
	{ "id": "news", "label": "Watch the morning news", "hint": "The TV wall" },
]
## the news is the last thing: it is what the Fracture interrupts
const LAST := "news"
const MORNING_LINES := {
	"dress": [["", "Black jacket. It's going to be a long day."]],
	"breakfast": [["", "Coffee. Toast. The building hums like it always does."]],
	"phone": [["MOM", "Call me when you're up. Love you."], ["MARA", "Morning, neighbor! Coffee in the Sky Lounge later? Eleventh floor. Don't be late."], ["NEXUS ALERT", "Grid maintenance near the stability towers today. Expect flickers."]],
	"mail": [["", "An envelope under the door. No stamp, no sender. Just your name."], ["", "Inside: a black card. One word on it — RESONANCE."]],
	"news": [],
}
const NEWS_LATER := ["", "Coffee first. The news can wait."]
## after the cinematic (the TV, the sky, NOVA): the building's alarm, Mara on the radio, NOVA on the way out
const ALARM_LINES := [
	["BUILDING", "Emergency. Structural event. Elevators offline. Use the emergency stairs."],
	["MARA", "Is anyone there? I'm stuck in the Sky Lounge on eleven. The doors jammed. Please!"],
]
## the corridor on 12 (the owner's campaign draft, Mission 01)
const HALL_LINES := [
	["PLAYER", "What happened to the sky?"],
	["NOVA", "A Fracture. Reality is intersecting with something it was never meant to touch."],
	["PLAYER", "There are people trapped in the hall."],
	["NOVA", "Then we help them. Move. I will guide you."],
]
const RESCUE_LINES := [["MARA", "You came back for me. Go, go. I'm right behind you."]]
const BREACH_ENTER := {
	"DAZED": [["MARA", "Something's coming out of the smoke. Move!"]],
	"SURGE": [["PLAYER", "What's happening to me?"], ["NOVA", "Your body just answered the Fracture. Armor forming. Weapon system online."], ["NOVA", "Point it at them and squeeze. Your hands know how."]],
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

## the news waits until the rest of the morning is done
func news_ready() -> bool:
	return phase == "MORNING" and morning_left().size() == 1 and not done.has(LAST)

## tick a morning step; returns the lines to say. The news, last, is the Fracture: the phase moves to ALARM (the mission
## plays the cinematic first, then says ALARM_LINES)
func mark(step: String, now: float) -> Array:
	if phase != "MORNING" or done.has(step) or not MORNING_LINES.has(step):
		return []
	if step == LAST and not news_ready():
		return [NEWS_LATER]
	done[step] = true
	var lines: Array = MORNING_LINES[step].duplicate()
	if morning_left().is_empty():
		phase = "ALARM"
		since = now
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
	# an old save's lobby steps (Mara, the mail room) no longer exist; a morning with only those left is done
	for k in done.keys():
		if not MORNING.any(func(st: Dictionary) -> bool: return st.id == k):
			done.erase(k)
	if phase == "MORNING" and morning_left().is_empty():
		phase = "ALARM"
