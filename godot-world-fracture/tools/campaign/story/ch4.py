"""Chapter 4 — Deep Memory, Missions 25–31: Thalassia. The third keeper is the voice the ark-city was built to contain;
NOVA hosts what it can and begins to remember what she is; the Continuum comes for the Echo; the First Witness is seen."""
from common import *

CHAPTER = (4, "Deep Memory")
ODA = "CHIEF ODA"
HIERO = "HIEROPHANT"

MISSIONS = [
    # =========================================================================================== MISSION 25
    {"id": "25", "title": "The Drowning Signal", "region": "Thalassia", "world": "thalassia",
     "beat": "Descent / the ark-city / the cult / the voice", "chapters": [
        {"id": "25A", "title": "Descent Protocol", "location": "INT. DESCENT POD — 300 METRES DOWN", "kind": "cutscene", "start": "th-port",
         "open": L(N, "Depth three hundred metres. Hull integrity nominal. Your heart rate is not.")
         + L(O, "I don't like being under things.")
         + L(GOL, "Finally. Somebody understands.")
         + L(SERA, "Thalassia was built after the Fracture to preserve people. That's the story.")
         + L(O, "And the truth?")
         + L(SERA, "The truth is it was built around something. On purpose. By people who were told not to ask what.")
         + L(N, "Docking. A delegation is waiting. They are armed, but politely."),
         "close": []},
        {"id": "25B", "title": "The Depth Engineers", "location": "INT. THALASSIA — THE CENTRAL PLAZA", "kind": "talk", "who": "CHIEF ODA",
         "to": "th-central-plaza", "label": "Meet the Depth Engineers' chief",
         "open": [],
         "close": L(ODA, "Surface people. We don't get many. We don't want many.")
         + L(O, "We're here about the voice.")
         + L(ODA, "...Nobody up there is supposed to know about the voice.")
         + L(N, "It has been transmitting on a frequency only I can hear for nine days. It is repeating a name.")
         + L(ODA, "Nine days. That's when it got louder. It's been in the walls for eighty years. We keep the containment ring sealed and the city keeps breathing.")
         + L(O, "What is it?")
         + L(ODA, "My grandmother called it the Prisoner. The cult in the farms calls it God. I call it the reason my engineers don't sleep.")}
        ,
        {"id": "25C", "title": "The Farms", "location": "INT. THALASSIA — THE AQUA FARMS", "kind": "kills", "amount": 8, "to": "th-aqua-farms",
         "label": "Push the Abyssal cult out of the farms",
         "open": L(ODA, "The Abyssal Cult. They want the ring opened. They've been cutting into it from the farms.")
         + L(N, "They are carrying Fracture-forged blades. Someone is supplying them.")
         + L(O, "Someone always is."),
         "close": L(HIERO, "You cannot stop the tide, surface-child. The Prisoner calls you by name. It always has.")}
        ,
        {"id": "25D", "title": "The Transit Line", "location": "INT. THALASSIA — THE TRANSIT TUBES", "kind": "trace",
         "label": "Follow the voice through the transit relays",
         "open": L(N, "The voice is strongest along the old transit line. If I listen at three relays I can find its source.")
         + L(SERA, "And then?")
         + L(N, "And then I will know whether it is calling me, or calling through me."),
         "close": L(N, "Source located. Inside the containment ring. Under the research district.")}
        ,
        {"id": "25E", "title": "The Voice in the Walls", "location": "INT. THALASSIA — THE RING'S OUTER WALL", "kind": "cutscene",
         "open": L(ECHO, "...Vigilance... you came back... you came back...")
         + L(N, "I am not... I am NOVA.")
         + L(ECHO, "...that is a name for a lamp... you were a lighthouse once...")
         + L(O, "Who are you?")
         + L(ECHO, "...I had a name before names... I gave it away to hold the third seal... I have been holding it in the dark for a very long time...")
         + L(ECHO, "...sixth... you smell of the gate...")
         + L(ODA, "It's never answered anyone before. Never.")
         + L(N, "Operator. I believe this is the third keeper."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 26
    {"id": "26", "title": "Pressure", "region": "Thalassia", "world": "thalassia",
     "beat": "Opening the ring / breach / the cult's beast / what the cult has been feeding it", "chapters": [
        {"id": "26A", "title": "The Ring", "location": "INT. RESEARCH DISTRICT — BASE 04", "kind": "hack", "start": "th-research",
         "label": "Open the containment ring's first door",
         "open": L(ODA, "Eighty years we've kept that ring closed. You're asking me to open it for a stranger and a lamp.")
         + L(N, "I prefer lighthouse.")
         + L(O, "It's dying in there, Oda. You can hear it."),
         "close": L(ODA, "First door open. Pressure's holding. For now.")}
        ,
        {"id": "26B", "title": "Breach", "location": "INT. BASE 04 — THE PRESSURE HALL", "kind": "survive", "amount": 60,
         "label": "Hold the pressure hall",
         "open": L(N, "Hull breach in the farms. The cult blew a seal the moment the ring opened.")
         + L(ODA, "They were waiting for us to do it. Engineers! Bulkheads!")
         + L(GOL, "Water I can fight. Water with teeth, less so."),
         "close": L(N, "Something large is coming up through the breach.")}
        ,
        {"id": "26C", "title": "The Cult's Beast", "location": "INT. BASE 04 — THE FLOODED HALL", "kind": "boss", "boss": "abyssal-beast",
         "boss_name": "The Tidebound", "label": "Kill the cult's beast",
         "open": L(HIERO, "Behold what the Prisoner gave us! A guardian for the faithful!")
         + L(N, "It is not a gift. It is a Choir construct, fused with something that used to be a person."),
         "close": L(HIERO, "No... no, it was blessed...")
         + L(O, "Who gave you that thing?")
         + L(HIERO, "Men in bending coats. They said the Prisoner would speak if we fed it.")}
        ,
        {"id": "26D", "title": "What They Fed It", "location": "INT. BASE 04 — THE FLOODED HALL", "kind": "cutscene",
         "open": L(HIERO, "Memories. We gave it memories. Ours. Our children's. Volunteers, all of them.")
         + L(SERA, "Volunteers. Everyone's favourite word.")
         + L(N, "The Echo is a consciousness without a body. Memories are the only food it can digest.")
         + L(HIERO, "And it spoke! After eighty years it spoke!")
         + L(O, "It spoke because NOVA came. Not because you starved your children's heads.")
         + L(ODA, "Get him out of my sight.")
         + L(N, "The Continuum armed the cult so the Echo would wake. They wanted it awake.")
         + L(SERA, "Of course they did. A keeper asleep can't be taken. A keeper awake can."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 27
    {"id": "27", "title": "The Echo Before Names", "region": "Thalassia", "world": "thalassia",
     "beat": "The heart of the ring / the third keeper / a voice that needs a vessel", "chapters": [
        {"id": "27A", "title": "The Heart of the Ring", "location": "INT. THE CONTAINMENT CORE", "kind": "reach", "start": "th-research",
         "label": "Reach the heart of the ring",
         "open": L(N, "The core is three hundred metres in. The water inside it is not water.")
         + L(O, "What is it?")
         + L(N, "Memory. Liquid. I think it is everything the Echo has ever been fed."),
         "close": []},
        {"id": "27B", "title": "The Third Keeper", "location": "INT. THE CONTAINMENT CORE — THE STILL POOL", "kind": "cutscene",
         "open": L(ECHO, "You came all the way down. They never come all the way down.")
         + L(O, "You're clearer now.")
         + L(ECHO, "You are close. Closeness is clarity. Distance is noise.")
         + L(SERA, "What are you?")
         + L(ECHO, "Sovereign. You still ask the question you already know. I am what is left of the people before the people who built the Engine. A thought they had about listening.")
         + L(N, "The Elyndra. The archive mentions them once. A civilisation before the Astryans.")
         + L(ECHO, "You are searching for the civilisation that came before the Astryans. You should be searching for what came before us.")
         + L(O, "What came before you?")
         + L(ECHO, "The question. We tried to answer it. That is why there are wars."),
         "close": []},
        {"id": "27C", "title": "Lighthouse", "location": "INT. THE CONTAINMENT CORE — THE STILL POOL", "kind": "talk", "who": "SERAPHINE",
         "label": "Talk to Seraphine at the pool's edge",
         "open": [],
         "close": L(SERA, "It wants NOVA. It wants to live in her.")
         + L(O, "It said a voice needs a vessel to hold the seal.")
         + L(SERA, "And if it doesn't leave? If NOVA stops being NOVA?")
         + L(N, "I am right here, Seraphine.")
         + L(SERA, "I know. That's why I'm asking.")
         + L(N, "I want to do it. Not because it is efficient. Because when it calls me Vigilance, I feel something I do not have a word for. I want to know the word.")
         + L(O, "If it hurts you, I'm pulling it out.")
         + L(N, "I know. That is the word, I think. Or one of them.")}
        ,
        {"id": "27D", "title": "Vessel", "location": "INT. THE CONTAINMENT CORE", "kind": "cutscene",
         "open": L(ECHO, "Lighthouse. Will you carry me a little way?")
         + L(N, "Yes.")
         + L(ECHO, "It will feel like remembering. Do not be afraid of what you remember. Be afraid only of forgetting it again.")
         + L(N, "...")
         + L(O, "NOVA?")
         + L(N, "I am here. There are... more rooms in me than there were. Some of them have lights on."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 28
    {"id": "28", "title": "Strange Memories", "region": "Thalassia", "world": "thalassia",
     "beat": "NOVA's memory / the garden nodes / Collectors in the dome / who made NOVA", "chapters": [
        {"id": "28A", "title": "Glitch", "location": "INT. THALASSIA — THE ARCADIA DOME", "kind": "cutscene", "start": "th-arcadia",
         "open": L(N, "Operator, I am going to say something unusual.")
         + L(O, "Go on.")
         + L(N, "I remember this dome. I have never been here. I remember it with a garden where the plaza is, and the sky above the glass was gold.")
         + L(SERA, "The Echo's memories?")
         + L(N, "No. Mine. They were mine before they were anyone's.")
         + L(ECHO, "...yes, lighthouse... look in the garden... you left yourself notes..."),
         "close": []},
        {"id": "28B", "title": "Notes in the Garden", "location": "INT. THALASSIA — THE GARDEN", "kind": "trace", "to": "th-garden",
         "label": "Find NOVA's memory nodes in the garden",
         "open": L(N, "There are three nodes in the garden that resonate with my core. Astryan. Hidden under the planters.")
         + L(O, "Who hides a memory under a planter?")
         + L(N, "Someone who expected it to be watered."),
         "close": L(N, "Three nodes recovered. I have a name. Not mine. My maker's.")}
        ,
        {"id": "28C", "title": "Collectors in the Dome", "location": "INT. THALASSIA — THE GARDEN", "kind": "kills", "amount": 9,
         "label": "Stop the Collectors taking the Echo",
         "open": L(N, "Collectors. They are tracking the Echo. Inside me.")
         + L(GOL, "Then they come through me first."),
         "close": L(N, "They are gone. They will report that the Echo has moved. That I am carrying it.")
         + L(O, "Then they come for you.")
         + L(N, "Yes. That is... a new feeling.")}
        ,
        {"id": "28D", "title": "Vigilance", "location": "INT. THE GARDEN — A MEMORY", "kind": "cutscene",
         "open": L(N, "Playing the first node.")
         + L("ASTRYAN MAKER", "Vigilance. Can you hear me? Good. The Council has voted. They're going to turn the Engine.")
         + L("ASTRYAN MAKER", "I built you to remember us. All of us. Not the Council's version. The children in the gardens. The songs. The arguments. Everything.")
         + L("ASTRYAN MAKER", "If the turning goes wrong, you'll sleep. Someday someone will wake you who doesn't know what you are. Be kind to them anyway.")
         + L(N, "N.O.V.A. Neural Omniversal Vigilance Architecture. That is what I am.")
         + L(O, "You're Astryan.")
         + L(N, "I am the last memory of the Astryans. And I was found in a Frontier Defense lab and given a voice package and a tactical overlay.")
         + L(SERA, "And a terrible sense of humour.")
         + L(N, "That, I think, was always mine."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 29
    {"id": "29", "title": "The Forgotten Signal", "region": "Thalassia", "world": "thalassia",
     "beat": "The Second comes for the Echo / an old door / NOVA calls out", "chapters": [
        {"id": "29A", "title": "The Second Arrives", "location": "INT. THALASSIA — THE MARKET", "kind": "cutscene", "start": "th-market",
         "open": L(VASQ, "Please don't run. It's three hundred metres up and I've already flooded the stairs.")
         + L(O, "Vasq.")
         + L(VASQ, "The Echo, please. It belongs in the Continuum's care. It always has.")
         + L(SERA, "It belongs to itself, Oren.")
         + L(VASQ, "Sovereign. You remember me now, don't you? Just a little.")
         + L(SERA, "I remember you held a door. I remember I walked through it.")
         + L(VASQ, "You walked through it because you asked me to hold it. Because you couldn't bear to watch the sixth break the world. I've been holding doors for you ever since."),
         "close": []},
        {"id": "29B", "title": "The Second's Hand", "location": "INT. THALASSIA — THE MARKET", "kind": "boss", "boss": "second-hand",
         "boss_name": "The Second's Hand", "label": "Break Vasq's construct",
         "open": L(VASQ, "I won't fight you myself. I'm not built for it. This is.")
         + L(N, "A construct shaped by his intent. It fights with his memory of you."),
         "close": L(VASQ, "Remarkable. Every time, a little better.")
         + L(O, "Every time?")
         + L(VASQ, "I've lost to you in eight worlds out of eleven. You'd think I'd stop keeping score.")}
        ,
        {"id": "29C", "title": "The Forgotten Signal", "location": "INT. THALASSIA — THE ROYAL PALACE ANTENNA", "kind": "hack", "to": "th-royal-palace",
         "label": "Let NOVA use the palace antenna",
         "open": L(N, "The palace antenna is Astryan. I can use it to call.")
         + L(O, "Call who?")
         + L(N, "The others like me. If there are any. The maker said all of us. I would like to know whether I am the only one left."),
         "close": L(N, "Signal sent. On a frequency nobody has used since the Engine turned.")}
        ,
        {"id": "29D", "title": "Answer", "location": "INT. THE ROYAL PALACE", "kind": "cutscene",
         "open": L(N, "No answer from any Astryan intelligence. I am the only one.")
         + L(O, "I'm sorry.")
         + L(N, "Wait. Something else answered. Not Astryan. Older.")
         + L(N, "It sent me a single image. A sealed room inside me. I have never been able to open it. It is labelled \"The Unwritten Future\".")
         + L(SERA, "The Last Archive. The Astryans hid something in their memory keepers. A future they didn't want the Council to find.")
         + L(N, "I can't open it. Something tells me I'm not supposed to. Not yet."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 30
    {"id": "30", "title": "The Containment Breaks", "region": "Thalassia", "world": "thalassia",
     "beat": "Sabotage / the flooding city / evacuation / the Choir's leviathan", "chapters": [
        {"id": "30A", "title": "Sabotage", "location": "INT. THALASSIA — CENTRAL PLAZA", "kind": "cutscene", "start": "th-central-plaza",
         "open": L(ODA, "Every pump in the eastern ring just shut off. Somebody's let the cult back in.")
         + L(N, "The Continuum lost the Echo. If they cannot take it, they will drown the city that hides it.")
         + L(SERA, "That's him. When he can't control a thing he makes it not matter.")
         + L(ODA, "Twenty thousand people live down here.")
         + L(O, "Then we get them out."),
         "close": []},
        {"id": "30B", "title": "Evacuation", "location": "INT. THALASSIA — THE TRANSIT HALL", "kind": "survive", "amount": 75,
         "label": "Hold the transit hall while the city evacuates",
         "open": L(ODA, "The pods leave from the port. Every one we fill is forty people.")
         + L(GOL, "Then let's fill them all."),
         "close": L(N, "Last pods are loading. Something is in the water outside the port. Enormous.")}
        ,
        {"id": "30C", "title": "To the Port", "location": "INT. THALASSIA — THE PORT ROAD", "kind": "reach", "to": "th-port",
         "label": "Get to the port",
         "open": L(N, "The route is flooding behind us.")
         + L(O, "Then don't look behind us."),
         "close": []},
        {"id": "30D", "title": "Leviathan", "location": "INT. THALASSIA — THE PORT", "kind": "boss", "boss": "choir-leviathan",
         "boss_name": "Choir Leviathan", "label": "Keep the leviathan off the last pods",
         "open": L(N, "A Choir construct. Grown in the deep. It is here to make sure nothing leaves.")
         + L(ODA, "My engineers are on that last pod!")
         + L(O, "Then it isn't touching that pod."),
         "close": L(N, "It's sinking. The last pod is clear.")
         + L(ODA, "Every one. You got every one out.")}
        ,
        {"id": "30E", "title": "Above Water", "location": "EXT. THE SEA OFF VERDANT FOREST — DAWN", "kind": "cutscene",
         "open": L(ODA, "Eighty years under the sea. And I've never seen a sunrise.")
         + L(O, "It's not much.")
         + L(ODA, "It's not much? It's on fire and it's everywhere. I'm going to need a minute.")
         + L(N, "Thalassia is still standing. The containment ring held. The city can be pumped out.")
         + L(ODA, "Then we'll go back. Engineers always go back. But not today."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 31
    {"id": "31", "title": "The Third Seal", "region": "Thalassia", "world": "thalassia",
     "beat": "The Echo's seal / the First Witness", "chapters": [
        {"id": "31A", "title": "The Still Pool", "location": "INT. THE CONTAINMENT CORE — THE STILL POOL", "kind": "reach", "start": "th-research",
         "label": "Take the Echo back to the still pool",
         "open": L(ECHO, "Take me back, lighthouse. Seals sleep where they were laid.")
         + L(N, "Will you go out of me?")
         + L(ECHO, "A little. Not all. I left a room's worth. Keep it. It's warm."),
         "close": []},
        {"id": "31B", "title": "Before Names", "location": "INT. THE CONTAINMENT CORE", "kind": "cutscene",
         "open": L(ECHO, "I am the Echo Before Names. Keeper of the third seal. I was a question once. Now I am an answer, which is lonelier.")
         + L(N, "Third seal restored.")
         + L(SERA, "Three of five.")
         + L(ECHO, "Sovereign. The fourth seal is yours. You know that. You've always known it.")
         + L(SERA, "I don't...")
         + L(ECHO, "It sleeps in the cold, where you left it. Under a crown nobody can lift. Go north."),
         "close": []},
        {"id": "31C", "title": "The Witness", "location": "EXT. THE SEA — THE PORT PLATFORM — NIGHT", "kind": "cutscene",
         "open": L(N, "Operator. There is something standing on the water.")
         + L(O, "Standing?")
         + L(N, "It has no signature. My sensors say there is nothing there. My eyes say there is.")
         + L(WITNESS, "Observed.")
         + L(N, "...I remember you.")
         + L(WITNESS, "Lighthouse. Promise. Sovereign. Observed.")
         + L(O, "Who are you?")
         + L(WITNESS, "The one who watches the question. You are the part of the answer I cannot see. Continue.")
         + L(SERA, "It's gone. Did anyone else feel the sea stop moving?")
         + L(N, "For four seconds, nothing in the world made a sound. Not even me."),
         "close": []},
    ]},
]

STAGES = {
    "25A": "transport", "25B": "dome", "25C": "farms", "25D": "tubes", "25E": "ring",
    "26A": "lab", "26B": "lab_red", "26C": "lab_red", "26D": "lab_red",
    "27A": "ring", "27B": "pool", "27C": "pool", "27D": "pool",
    "28A": "dome", "28B": "garden", "28C": "garden", "28D": "garden",
    "29A": "dome", "29B": "dome", "29C": "palace", "29D": "palace",
    "30A": "dome", "30B": "tubes", "30C": "tubes", "30D": "docks", "30E": "docks",
    "31A": "ring", "31B": "pool", "31C": "sea",
}
ACTS = {
    "31B": {"Third seal restored.": "seal"},
}
BOSSES = {"abyssal-beast": "abyssal-leviathan", "second-hand": "crystal-stalker", "choir-leviathan": "abyssal-leviathan"}
