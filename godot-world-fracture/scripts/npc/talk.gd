extends RefCounted
## What Nexus City's people say (people.gd, memory.gd): lines put together from their personality, how well they know
## you, the time of day, their job and what they remember. Node-free and deterministic for a given day, so the same
## person doesn't repeat themselves within a visit but does change from day to day.

const People := preload("res://scripts/npc/people.gd")
const Memory := preload("res://scripts/npc/memory.gd")

const GREET := {
	"warm": { "wary": "Oh. It's you. …Hello.", "acquaintance": "Hey there, %s! Good to see you.", "friend": "%s! Come here, you.", "close": "There's my favourite person in this city. Hi, %s." },
	"gruff": { "wary": "What do you want.", "acquaintance": "Yeah. %s.", "friend": "%s. Good.", "close": "Ha. %s. Pull up a crate." },
	"nervous": { "wary": "P-please, I don't want any trouble.", "acquaintance": "Oh — hi. Hi, %s.", "friend": "%s! Okay. Good. Hi.", "close": "%s, honestly, you're the only one I trust round here." },
	"cheerful": { "wary": "Um. Hi?", "acquaintance": "Hiya, %s!", "friend": "%s!! Best day!", "close": "%s! I was literally just thinking about you!" },
	"cynical": { "wary": "Keep walking.", "acquaintance": "%s. Still alive, then.", "friend": "%s. You're all right, you know that?", "close": "Of all the people in this broken world, %s. Good." },
	"proud": { "wary": "I'd rather you didn't.", "acquaintance": "Good %s, %s.", "friend": "Ah, %s. Always a pleasure.", "close": "%s, my friend. You honour the place." },
	"shy": { "wary": "…", "acquaintance": "Oh — um, hi, %s.", "friend": "Hi, %s. It's nice you came by.", "close": "%s! I saved you something. Well. A smile." },
	"chatty": { "wary": "Not now, not after last time.", "acquaintance": "%s! Sit, sit, have you heard—", "friend": "%s, you won't believe the morning I've had—", "close": "%s! Finally, someone worth talking to!" },
}

const INTRO := "I'm %s. %s — %s, here at %s most days."

const WORK := {
	"barista": ["Oat milk's run out again. Third time this week.", "The rift crews tip better than the bankers.", "Morning rush starts at seven. Don't be in the queue."],
	"mechanic": ["Fracture static fries ignition coils. Brought you anything that sparks?", "Half the cars in this city run on prayers and tape.", "Bring that ride in sometime. I'll tune it like it owes me money."],
	"police officer": ["Keep your weapon holstered on the avenue and we'll get along.", "Quiet shift so far. Let's keep it that way.", "Rift Gate's had odd readings all week. Stay clear after dark."],
	"courier": ["Twelve drops before lunch and the Skyways lift is down.", "Fastest legs in Nexus, ask anyone.", "I know every shortcut between here and the Galleria."],
	"food-stall owner": ["Skewers are two Nex. Recipe's older than the Fracture.", "Thirty years at this corner. Seen everything twice.", "The secret's the glaze. No, I'm not telling."],
	"clothing clerk": ["New hoodie drop came in — the violet one goes fast.", "Try the dressing room; the lighting is *very* forgiving.", "Everyone wants streetwear that'll survive a rift."],
	"retired teacher": ["Forty years of teaching. Now I teach pigeons patience.", "Before the Fracture, this was a park. Hard to believe.", "Read something today. Anything. It helps."],
	"Galleria concierge": ["The Galleria opens at ten. Lumen Luxe is upstairs.", "We do not discuss the incident at the fountain.", "May I recommend Nova Threads for something practical?"],
	"Operator recruiter": ["Killbox contracts pay. Dying doesn't.", "Every Operator I've signed thought they were special. A few were.", "Bring me results, not stories."],
	"nurse": ["Twelve-hour shift. I'm running on coffee and spite.", "Rift burns are the worst. Wear the gloves.", "If you get hurt out there, come in early, not heroic."],
	"freelance hacker": ["Don't look at the camera on that lamppost. Just — don't.", "The city grid talks if you know how to listen.", "I fix things. Sometimes they're even mine."],
	"“import consultant”": ["You didn't see me. I didn't see you.", "Business is business. Even after the sky cracked.", "Respect the corner and the corner respects you."],
	"Sports District attendant": ["Arena's booked solid this weekend.", "Wristbands on, no glass past the turnstiles!", "The skate park's lights stay on till midnight."],
	"street musician": ["This one's an original. Probably.", "Coins in the case keep me in strings.", "The acoustics under the monorail are unreal."],
	"construction foreman": ["Crash-site cleanup's a twelve-week job. We're on week thirty.", "Hard hats past the tape, no exceptions.", "Every time we pour concrete, the ground hums."],
}

const RUMOURS := [
	"They say the Rift Gate hums louder every night.",
	"Somebody saw lights in the old apartment tower. Nobody lives on the top floors.",
	"The airport's adding flights to the Shattered Expanse. Who'd want to go?",
	"Garage on the avenue's doing nitrous now. Heard it from Marcus.",
	"There's a new boss in the Killbox circuit. Nobody's beaten it twice.",
	"Prices at the Galleria went up again. Blame the Fracture, like everything.",
	"A courier swore the skyline flickered at three in the morning. Like a bad screen.",
	"The night cops don't patrol past the Rift Gate. Make of that what you will.",
]

const MEMORY := {
	"scared": "Were you the one shooting out here? Don't do that.",
	"delivered": "Thanks for bringing that over from %s.",
	"errand": "%s told me you came through. Appreciate it.",
	"warning": "That's your warning used. Next time it's a fine.",
	"fine": "Fine's paid. Let's not do this again.",
}

const POLICE := {
	"warning": "Hold it. We've had reports of gunfire on the avenue, and they match you. This is a warning — weapons away in the city.",
	"fine": "Again? That's a %d Nex fine for discharging a weapon in a public street. Holster it.",
}

static func time_word(hour: float) -> String:
	if hour < 5.0 or hour >= 22.0:
		return "night"
	if hour < 12.0:
		return "morning"
	if hour < 18.0:
		return "afternoon"
	return "evening"

## the greeting: by personality and how well they know you (`player` is how they address you)
static func greeting(p: Dictionary, s: Dictionary, hour: float, player: String) -> String:
	var b := Memory.band(Memory.affinity(s, String(p.id)))
	var line := String(GREET.get(String(p.personality), GREET.warm)[b])
	if line.count("%s") == 2:
		return line % [time_word(hour), player]
	if line.count("%s") == 1:
		return line % player
	return line

static func intro(p: Dictionary, place: String) -> String:
	var first := String(p.name).get_slice(" ", 0) if not String(p.name).begins_with("Officer") else String(p.name)
	return INTRO % [first, String(p.job).capitalize() if not String(p.job).begins_with("“") else String(p.job), "%d years old" % int(p.age), String(People.PLACES.get(place, {}).get("label", "the avenue"))]

## something about their work, a different one each day
static func work_line(p: Dictionary, today: String) -> String:
	var lines: Array = WORK.get(String(p.job), ["Busy day."])
	return String(lines[absi(hash(String(p.id) + today)) % lines.size()])

static func rumour(p: Dictionary, today: String) -> String:
	return String(RUMOURS[absi(hash(today + String(p.id) + "r")) % RUMOURS.size()])

## a callback to the last thing they remember about you, if any
static func remember(p: Dictionary, s: Dictionary) -> String:
	var log: Array = Memory.person(s, String(p.id)).log
	for i in range(log.size() - 1, -1, -1):
		var ev := String(log[i])
		var key := ev.get_slice(":", 0)
		if not MEMORY.has(key):
			continue
		var who := ev.get_slice(":", 1) if ev.contains(":") else ""
		var name := String(People.by_id(who).get("name", "them")).get_slice(" ", 0) if who != "" else ""
		return String(MEMORY[key]) % name if String(MEMORY[key]).contains("%s") else String(MEMORY[key])
	return ""

static func police_line(verdict: String) -> String:
	return String(POLICE.get(verdict, "")) % Memory.FINE if verdict == "fine" else String(POLICE.get(verdict, ""))
