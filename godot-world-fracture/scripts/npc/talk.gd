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
	"mechanic": ["I can repair the bodywork. The weird purple scratches are your problem.", "Fracture static fries ignition coils. Brought you anything that sparks?", "Half the cars in this city run on prayers and tape.", "Bring that ride in sometime. I'll tune it like it owes me money."],
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
	"street racer": ["You can tune the engine. You cannot tune out fear.", "Meet's at midnight on the avenue. Bring something fast.", "Cops close the road for the legal races. The other kind, they chase."],
	"casino door": ["Dress code's whatever I say it is.", "No weapons past this rope. Not even the pretty ones.", "Third time tonight someone's tried to card-count. Third time they've left."],
	"nightlife promoter": ["Guest list? You're on it if you're with me.", "The club's lights sync to the rift's hum. Nobody believes me.", "Neon never sleeps, darling. It naps on Tuesdays."],
	"tech-repair stall": ["Cracked screen, fried implant, cursed drone — same price.", "I don't ask where the parts come from. You shouldn't either.", "Fracture static eats circuits. I eat because of it."],
	"noodle-stall owner": ["Broth's been simmering since the Fracture. Never stopped.", "Eat first. Whatever's chasing you can wait ten minutes.", "Racers, cops, hackers — everyone sits on the same stool here."],
	"casino pit boss": ["The house always wins. Lately the house has been nervous.", "Somebody won big on the rift-roulette last night. The table's been warm since.", "We don't cheat. We don't need to."],
	"arcade attendant": ["High score on Rift Runner hasn't moved in a week. Want a go?", "Token machine eats every third coin. It's tradition.", "Kids come in for the games and stay for the air con."],
	"street preacher": ["The sky's a screen, friend. And screens can be switched off.", "Count the stars tonight. Then count them again. Different number.", "We're all running on somebody's machine. Be kind to the other processes."],
	"fixer": ["Every shortcut in this city has an owner.", "In Neon City every camera sees you, and every camera can lie.", "Weapons, vehicles, secrets. Everything has a price."],
	"Operator response captain": ["We need people who can withstand the Fractures.", "Keep the district standing and we'll keep talking.", "Every breach we hold is a street people still live on."],
	"seaplane pilot": ["Thalassia sits offshore from Verdant Forest, deeper than most maps admit.", "The currents are restless today.", "Crosswinds from the eastern seam. Hold tight."],
	"diver": ["Keep the pressure seal locked until the chamber is clear.", "Down at forty metres the light goes violet. Nobody can tell me why.", "The city under the sea hums. You feel it in your teeth."],
	"ferry agent": ["Next boat to the dome leaves on the hour, weather permitting.", "Seasick bags are free. Use them.", "Half my passengers are scientists, the other half are lost."],
	"desert mechanic": ["Your ride will survive the dunes. Your driving? Different question.", "Out here the storm is a rival, not a backdrop.", "Performance parts are not magic. Balance the build."],
	"trader": ["Water first, stories second.", "Everything's for sale. Shade costs extra.", "Caravan's late. Sandstorm or raiders, same delay."],
	"solar engineer": ["Every panel on that roof feeds the city. Every grain of sand fights it.", "We clean the arrays at dawn. Afternoons are for regret.", "The sun out here could power three Nexus Cities."],
	"mountain ranger": ["The storm does not kill you quickly. It convinces you to stop moving.", "Check your heat pack before you check your weapon.", "Stay on the marked route. The unmarked ones mark you."],
	"traveller": ["The lights in the ice are beautiful. That worries me.", "My flight's been delayed three times. The snow has opinions.", "I came for the aurora. I'm staying for the coffee."],
	"glaciologist": ["The ice is singing at a frequency it shouldn't.", "Forty years studying glaciers. These ones are studying back.", "Core samples show layers that don't match any calendar."],
	"marshal": ["You trespass in a land built from the aftermath of war.", "Words are cheap here.", "Peace is a discipline, not a holiday."],
	"soldier": ["The old battlefields still hum at night.", "Stay inside the lights after dark.", "Every crater out there has a name. We don't say them."],
	"miner": ["Twelve hours down the shaft. Obsidian cuts gloves like paper.", "The deep veins glow. Foreman says don't look too long.", "Pay's good. Lungs aren't."],
	"cargo trader": ["No cargo flies free, not even hope.", "Seaplanes for the island hops, big jets for the mainland.", "Coconuts out, electronics in. That's the whole economy."],
	"resort concierge": ["Welcome to the Isles! Shuttles to every resort leave from the kerb.", "Sunset cruise at six. Bring the good camera.", "The lagoon glows at night. We tell the tourists it's plankton."],
	"fisherman": ["Fish are swimming in circles lately. Never seen it.", "Forty years on these waters. They never used to whisper.", "Catch of the day's at the café. Tell them I sent you."],
	"wanderer": ["You cannot force a legend to notice you.", "Some doors open for strength. Others for restraint.", "The road remembers every traveler."],
	"expedition guide": ["Reinforced strip, reinforced boots, reinforced nerves. You'll need all three.", "Nobody goes past the second ridge without a guide. Nobody comes back without one either.", "The crystals move at night. I've stopped measuring."],
	"rift researcher": ["Readings off every scale. I've had to invent new scales.", "Please don't touch the specimen case. Please.", "The rift breathes. Eleven-minute cycle. I'm almost sure."],
	"forest warden": ["Outsiders keep taking samples. Then they wonder why the trees attack.", "Follow the living roots. They do not lie. They simply refuse to explain.", "Leave the seedlings. They are not loot."],
	"scout": ["Do not mark that path. It changes by dawn.", "The forest remembers footsteps.", "Do not call every secret a target. Some deserve to stay hidden."],
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

## Neon City talks about different things
const NEON_RUMOURS := [
	"A racer swears the avenue gets longer at three in the morning.",
	"Sable's paying triple for runners this week. Nobody asks what's in the bags.",
	"The casino's back room has a door that wasn't there yesterday.",
	"Somebody hacked every billboard to show the same face for a second. Nobody knows whose.",
	"The metro's last train runs empty. The driver says it's full.",
	"Dex fixed an implant that wasn't from any company on Earth. Or so he says.",
]

## the story's own people speak their own lines (the dialogue draft); keyed by id, then by band, choice or topic
const CANON := {
	"vale": {
		"cooperate": "You answer to your conscience before you answer to me. Report.",
		"independent": "Still independent. Then prove that independence is not indifference.",
		"wary": "People are calling you a hero. Others are calling you a threat.",
		"close": "They know what your choices did to their streets. Good choices, mostly. Keep it that way.",
	},
	"neri": { "wary": "That is not better news.", "acquaintance": "We are crossing between continents. The air routes are unstable.", "friend": "Engineering. Stubbornness. A little luck. That's how I fly.", "close": "And the sea has new horizons. Fly with me sometime." },
	"rook": { "wary": "I can. The bill might hurt more than the crash.", "acquaintance": "Sand gets into everything, including promises.", "friend": "More than you have, usually. For you, we can negotiate.", "close": "Your ride will survive the dunes. Your driving's improving, too." },
	"kest": { "wary": "Then whoever sent you should be careful.", "acquaintance": "Check your heat pack before you check your weapon.", "friend": "That answer is why I agreed to guide you.", "close": "The storm doesn't scare me. Losing you to it would." },
	"draev": { "wary": "Not all disagreements survive the first shot.", "acquaintance": "Words are cheap here.", "friend": "Now you ask the right question.", "close": "Peace is a discipline, not a holiday. You keep it well." },
	"wanderer": { "wary": "Legends do not wait politely in marked arenas.", "acquaintance": "The road remembers every traveler.", "friend": "The world has begun answering your actions.", "close": "Some doors open for strength. Others for restraint. You know which." },
	"ilya": { "wary": "The forest will not forgive another invasion.", "acquaintance": "Answers have a cost.", "friend": "Then you have an ally here.", "close": "I will hold you to every word. Gladly." },
	"mira": { "wary": "That is how it catches you off guard.", "acquaintance": "The forest remembers footsteps. Yours, now too.", "friend": "The forest is growing around the scars.", "close": "You remembered what I told you about the forest." },
	"sable": {
		"wary": "Every shortcut in this city has an owner. You're standing on mine.",
		"acquaintance": "In Neon City every camera sees you, and every camera can lie.",
		"friend": "Weapons, vehicles, secrets. Everything has a price. For you, slightly less.",
		"close": "Careful. Thinking like you do is expensive. I like expensive.",
	},
}

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
static func greeting(p: Dictionary, s: Dictionary, hour: float, player: String, profile := {}) -> String:
	var b := Memory.band(Memory.affinity(s, String(p.id)))
	# the story's own people: their lines, and Captain Vale remembers the choice you made with her (Mission 05)
	var canon: Dictionary = CANON.get(String(p.id), {})
	if not canon.is_empty():
		var choice := String(profile.get("m05_choice", ""))
		if String(p.id) == "vale" and b != "wary" and b != "close" and canon.has(choice):
			return String(canon[choice])
		if canon.has(b):
			return String(canon[b])
	var line := String(GREET.get(String(p.personality), GREET.warm)[b])
	if line.count("%s") == 2:
		return line % [time_word(hour), player]
	if line.count("%s") == 1:
		return line % player
	return line

static func intro(p: Dictionary, place: String) -> String:
	var first := String(p.name) if String(p.name).begins_with("Officer") or People.tier(p) == 3 else String(p.name).get_slice(" ", 0)
	return INTRO % [first, String(p.job).capitalize() if not String(p.job).begins_with("“") else String(p.job), "%d years old" % int(p.age), String(People.places(People.city_of(String(p.id))).get(place, {}).get("label", "the avenue"))]

## something about their work, a different one each day
static func work_line(p: Dictionary, today: String) -> String:
	var lines: Array = WORK.get(String(p.job), ["Busy day."])
	return String(lines[absi(hash(String(p.id) + today)) % lines.size()])

## each region's own talk (the dialogue draft's ambient lines, then local colour)
const REGION_RUMOURS := {
	"THA": ["Do surface people really see the sky every day? A kid in the dome asked me that.", "The dome's lights flicker when the tide turns.", "Pilot Neri won't fly over the eastern seam after dark."],
	"SOL": ["Water first, stories second.", "Raiders hit a convoy past the mesas. Rook says the storm got them first.", "The solar fields sing at noon. Like wind through wire."],
	"FRV": ["The lights in the ice are beautiful. That worries me.", "A research team went silent on the north glacier. Kest went to look.", "Temperature drops ten degrees every time the aurora flickers."],
	"OBS": ["The old battlefields still hum at night.", "The Marshal hasn't slept since the Accord talks started.", "Somebody found a sword in the slag. It was still warm."],
	"AZI": ["No cargo flies free, not even hope.", "Crosswinds from the eastern seam. Hold tight on the island hops.", "The resorts are full. The fish are leaving."],
	"SHX": ["The road remembers every traveler.", "An expedition came back with one more member than it left with.", "The crystals ring when somebody lies near them. Try it."],
	"VRD": ["Leave the seedlings. They are not loot.", "The paths change by dawn. Mark nothing.", "The old grove is listening. Speak softly."],
}

static func rumour(p: Dictionary, today: String) -> String:
	var where := People.city_of(String(p.id))
	var list: Array = NEON_RUMOURS if where == "neon" else REGION_RUMOURS.get(where, RUMOURS)
	return String(list[absi(hash(today + String(p.id) + "r")) % list.size()])

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
