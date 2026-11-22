"""Chapter 1 — The Aftershock, Missions 8–10 (the chapter tracker's "The Broken Alliance", "The Five", "The First War"),
written to follow the owner's Missions 2–7 (tools/campaign/aftershock.py) out of Beneath the Ashes."""
from common import *

CHAPTER = (1, "The Aftershock")

MISSIONS = [
    # =========================================================================================== MISSION 8
    {"id": "08", "title": "The Broken Alliance", "region": "Nexus City", "world": "nexus",
     "beat": "Faction politics / vault defence / pursuit / tower assault", "chapters": [
        {"id": "08A", "title": "Fault Lines", "location": "INT. FRONTIER DEFENSE HEADQUARTERS — 6:10 AM", "kind": "cutscene",
         "open": L(WARD, "Eleven settlements went dark overnight. Three of them asked for help. Eight of them didn't have time to.")
         + L(VOSS, "And the broadcast told every frightened warlord on the planet that the world is up for grabs.")
         + L(O, "Where's Rainer?")
         + L(WARD, "In a holding cell. Genesis was his operation. Whatever came through those doors, he signed the invitation.")
         + L(SERA, "He didn't know what he was signing.")
         + L(WARD, "You're defending him?")
         + L(SERA, "I'm defending the truth. Those aren't always the same thing.")
         + L(N, "Director, three convoys are approaching headquarters. None of them carry Frontier Defense identification.")
         + L(VOSS, "Who's knocking?")
         + L(N, "Kael's Free Operators from the west. And an armored column flying the Ascendancy's colours from the Spire District.")
         + L(WARD, "Of course. Everyone wants to see what came out of the hole.")
         + L(O, "The data core.")
         + L(WARD, "The data core. Get dressed for company."),
         "close": []},
        {"id": "08B", "title": "The Council of Ash", "location": "INT. HEADQUARTERS — THE OLD COUNCIL ROOM", "kind": "talk",
         "who": "CRANE", "to": "nexus-bastion", "label": "Join the council",
         "open": [],
         "close": L(CRANE, "So this is the survivor everyone keeps whispering about. You look smaller on the recordings.")
         + L(O, "And you are?")
         + L(CRANE, "Lysander Crane. Prefect of the Ascendancy. We study the Fractures while the rest of you shoot at them.")
         + L(KAEL, "They study people too. Ask the families in the Eastern blocks who never got their relatives back.")
         + L(CRANE, "Volunteers, every one. Humanity doesn't survive this by hiding behind walls, Kael.")
         + L(WARD, "Enough. The core stays under Frontier Defense guard until we know what's on it.")
         + L(CRANE, "You don't have the people to read it, Director. We do.")
         + L(SERA, "Nobody reads it until I've stabilised the archive. Open it wrong and it erases itself.")
         + L(CRANE, "Dr. Vale. I wondered where you'd landed.")
         + L(SERA, "Somewhere you weren't.")
         + L(O, "We found it. We decide what happens to it.")
         + L(CRANE, "Brave. Let's see how long brave lasts when the next wave comes and you need our shields.")
         + L(N, "Operator, the vault sublevel just lost power.")
         + L(VOSS, "That's not a coincidence.")},
        {"id": "08C", "title": "Night Raid", "location": "INT. HEADQUARTERS VAULT SUBLEVEL", "kind": "survive", "amount": 60,
         "label": "Hold the vault",
         "open": L(N, "Hostiles inside the perimeter. Their signatures are human, but their equipment is Fracture-grade.")
         + L(O, "Ascendancy?")
         + L(N, "Insufficient evidence. The shields they carry match the samples Prefect Crane described.")
         + L(VOSS, "All units to the vault! Nobody touches that core!")
         + L(O, "Hold the door. I'll hold everything else."),
         "close": L(N, "The vault door was opened from inside.")
         + L(O, "Someone let them in.")
         + L(VOSS, "The core is gone. Tracking shows a vehicle heading for the Spire District.")
         + L(KAEL, "Told you. You let the wolf into the meeting and act surprised when the sheep go missing.")
         + L(O, "Then let's go get our sheep back.")},
        {"id": "08D", "title": "Run Them Down", "location": "EXT. NEXUS CITY — THE SPIRE ROAD", "kind": "drive",
         "to": "nexus-university", "label": "Chase the stolen core to the Spire",
         "open": L(N, "The convoy is eight hundred metres ahead and accelerating.")
         + L(O, "Then so are we.")
         + L(N, "I would like to remind you that most of these roads are cracked.")
         + L(O, "Noted."),
         "close": L(N, "They have entered the Ascendancy tower. Its shield grid is active.")
         + L(SERA, "Crane built that grid with stolen Genesis designs. I'd know them anywhere.")
         + L(O, "Can you get me through it?")
         + L(SERA, "I can get you through it once. Make it count.")},
        {"id": "08E", "title": "The Ascendancy Tower", "location": "INT. ASCENDANCY TOWER — RESEARCH FLOORS", "kind": "kills",
         "amount": 8, "label": "Fight through the research floors",
         "open": L(N, "Containment cells on every floor. Most are empty.")
         + L(O, "Most?")
         + L(N, "Some contain people. They are alive. Their neural activity resembles yours.")
         + L(O, "Crane's been making copies of me.")
         + L(N, "Not copies. Attempts."),
         "close": L(O, "We're getting these people out when this is done.")
         + L(N, "I have flagged every cell. Crane is on the top floor with the core.")},
        {"id": "08F", "title": "The Ascendant", "location": "INT. ASCENDANCY TOWER — THE CROWN FLOOR", "kind": "boss",
         "boss": "ascendant-construct", "boss_name": "The Ascendant Construct", "label": "Bring down Crane's construct",
         "open": L(CRANE, "You came alone. That's either courage or arrogance.")
         + L(O, "Give me the core.")
         + L(CRANE, "Do you know what's on it? Five names. Five keys. And a sixth that the archive tried very hard to forget.")
         + L(O, "Then you know it isn't yours.")
         + L(CRANE, "Nothing is anyone's anymore. Meet my answer to the end of the world."),
         "close": L(CRANE, "Enough! Enough. It's yours.")
         + L(O, "Who opened the vault for you?")
         + L(CRANE, "Nobody opened it for me. I came for the core, yes. But someone was already inside when we arrived.")
         + L(N, "The vault logs were erased at 3:12 AM. Your team breached at 3:20.")
         + L(CRANE, "You see? I'm a thief, Operator. Not the only one.")},
        {"id": "08G", "title": "The Broken Alliance", "location": "EXT. ASCENDANCY TOWER ROOF — DAWN", "kind": "cutscene",
         "open": L(VOSS, "Rainer's cell is empty. The guard on duty doesn't remember his own shift.")
         + L(O, "Doesn't remember?")
         + L(SERA, "Memory erasure. Clean. Professional. Whoever took Rainer also opened the vault.")
         + L(WARD, "The Free Operators are pulling out of the joint command. The Ascendancy is denying everything. Three days into the end of the world and the alliance is already ash.")
         + L(KAEL, "There never was an alliance, Director. There was a broadcast and a lot of scared people standing in the same room.")
         + L(N, "I have restored part of the core. It contains a list. Five names, recorded in a script older than any human language.")
         + L(O, "The five keepers.")
         + L(N, "And coordinates. The first points to Eldergrove, in the Verdant Forest.")
         + L(SERA, "Then that's where we go. Before whoever erased that guard gets there first.")
         + L(CRANE, "Take my advice, Operator. When you find the first keeper, don't ask them what they remember. Ask them what they were made to forget."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 9
    {"id": "09", "title": "The Five", "region": "Nexus City", "world": "nexus",
     "beat": "Investigation / signal triangulation / ambush / revelation", "chapters": [
        {"id": "09A", "title": "Five Names", "location": "INT. RESEARCH DIVISION — THE CLEAN ROOM", "kind": "cutscene",
         "open": L(N, "Translation complete for the first five entries.")
         + L(SERA, "Read them.")
         + L(N, "Ilyra Sen, the Voice. Auren Thale, the Cartographer. The Echo Before Names. Vael Turog, the Severant.")
         + L(O, "That's four.")
         + L(N, "The fifth entry is a title, not a name. The Veiled Sovereign.")
         + L(SERA, "...")
         + L(O, "Seraphine?")
         + L(SERA, "It's nothing. The word. I've seen it carved somewhere before. I can't remember where.")
         + L(N, "Each name is paired with a seal and a place. Each keeper held one fifth of the lock.")
         + L(O, "And the sixth?")
         + L(N, "The sixth entry has no name. Only a description. The Promise.")
         + L(SERA, "\"You were the promise. You became the breach.\" That's what the voice said to you in the archive.")
         + L(O, "I know what it said."),
         "close": []},
        {"id": "09B", "title": "Signal Sweep", "location": "EXT. NEXUS CITY — THE RELAY TOWERS", "kind": "trace",
         "label": "Tune the three relay towers",
         "open": L(N, "The coordinates are approximate. If I tune three city relays to the archive frequency I can triangulate the living signatures.")
         + L(O, "Living? The keepers are alive?")
         + L(N, "Something at each coordinate is producing a heartbeat. Whether it is a person is a separate question.")
         + L(O, "Of course it is."),
         "close": L(N, "Triangulation complete. Five signatures. Four are stable. One is moving.")
         + L(O, "Which one?")
         + L(N, "Vael Turog's. It is not on this world in any way I can measure. It is moving toward us anyway.")}
        ,
        {"id": "09C", "title": "Rainer's Message", "location": "OLD NEXUS CITY TRANSIT TERMINAL — NIGHT", "kind": "talk",
         "who": "RAINER", "to": "terminal:nexus", "label": "Meet the caller at the old terminal",
         "open": L(N, "An encrypted message on a military channel. It uses the authentication code from Project Genesis.")
         + L(O, "Rainer.")
         + L(N, "It says: \"Old terminal. Come alone. Bring the machine.\"")
         + L(O, "I think he means you.")
         + L(N, "I gathered."),
         "close": L(RAINER, "You came. Good. I don't have long.")
         + L(O, "Who broke you out?")
         + L(RAINER, "Nobody broke me out. They walked me out. Through the front gate. Nobody stopped them because nobody could see them.")
         + L(O, "Who?")
         + L(RAINER, "They call themselves observers. They were inside Genesis from the start. The transmission we received, the one that told us how to build the doors. It came from them.")
         + L(O, "Why let you go?")
         + L(RAINER, "They didn't. I ran when they started asking me about you. They don't care about the five. Not really. They care about the sixth.")
         + L(RAINER, "Take this. Genesis access key. Every lab we built has a door they don't know I kept.")
         + L(N, "Operator, multiple cloaked signatures. Closing.")
         + L(RAINER, "They followed me. Of course they did. Go!")},
        {"id": "09D", "title": "The Observers", "location": "INT. TRANSIT TERMINAL — THE PLATFORMS", "kind": "kills", "amount": 7,
         "label": "Fight off the cloaked agents",
         "open": L(N, "Their armour bends light. I can only see them when they fire.")
         + L(O, "Then I'll make them fire."),
         "close": L(N, "One of them dropped this. A badge. A circle broken by a single line.")
         + L(O, "Rainer?")
         + L(N, "Gone. His signal ends at the platform edge. There is no body.")
         + L(O, "They took him again.")
         + L(N, "Or he left with them. I cannot tell which.")},
        {"id": "09E", "title": "The Severant", "location": "EXT. TERMINAL ROOF — A FRACTURE OPENING", "kind": "cutscene",
         "open": L(N, "Fracture forming directly overhead. It is not hostile. It is... transmitting.")
         + L(TUROG, "So the promise walks again.")
         + L(O, "You're the one the Harbinger serves.")
         + L(TUROG, "I am Vael Turog. I held the fourth seal when your world was young. I am what your choice made of me.")
         + L(O, "I don't remember any choice.")
         + L(TUROG, "No. You made sure of that. Ask your companion why her name is on my list.")
         + L(SERA, "What is he talking about?")
         + L(TUROG, "The Veiled Sovereign looks well, for someone who has died so many times.")
         + L(O, "Leave her out of this.")
         + L(TUROG, "Everything you love is a possibility that should never have survived. The Choir will correct that. Gently. As I once tried to.")
         + L(N, "The signal is closing.")
         + L(TUROG, "Find the others, keeper-breaker. Wake them. It will make the ending simpler."),
         "close": []},
        {"id": "09F", "title": "The Count", "location": "INT. HAVEN-01 — THE MAP TABLE", "kind": "cutscene",
         "open": L(VOSS, "So. A man who isn't on this world wants us to wake up four people who aren't really people, so he can kill them all at once.")
         + L(O, "That's the short version.")
         + L(VOSS, "I hate the short version.")
         + L(SERA, "If the keepers are waking anyway, we need to reach them before Turog or these observers do.")
         + L(KAEL, "My people know the Eldergrove trails. Rangers still run the village up there.")
         + L(WARD, "Frontier Defense will hold Nexus. If this city falls while you're chasing ghosts, there'll be nothing to come back to.")
         + L(O, "Seraphine. What did he mean? Your name on his list.")
         + L(SERA, "I don't know. And that frightens me more than anything he said.")
         + L(N, "Before we go. There is something in the archive I have not shown anyone. A memory, sealed to the sixth signature. I believe it will only open for you.")
         + L(O, "Then let's open it."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 10
    {"id": "10", "title": "The First War", "region": "Nexus City", "world": "nexus",
     "beat": "Playable memory / the Covenant's last stand / revelation", "chapters": [
        {"id": "10A", "title": "The Memory Gate", "location": "INT. THE ASHEN ARCHIVE — THE DAIS", "kind": "reach",
         "label": "Stand on the seal",
         "open": L(SERA, "The dais is warm. It wasn't last time.")
         + L(N, "The seal is waiting for a biometric match. Yours.")
         + L(O, "And if this goes wrong?")
         + L(N, "Then I will pull you out. I am fairly confident I can pull you out.")
         + L(O, "Fairly.")
         + L(N, "Seventy-one percent."),
         "close": L("ARCHIVE WARDEN", "The sixth asks to remember. The archive permits one memory. Choose nothing. See everything.")}
        ,
        {"id": "10B", "title": "Aetherion, Before", "location": "MEMORY — THE FIRST SANCTUARY, AETHERION", "kind": "cutscene",
         "open": L(ILYRA, "They are coming through every gate at once. The Choir has stopped negotiating.")
         + L(AUREN, "I have mapped eleven breaches. By nightfall there will be forty.")
         + L(TUROG, "Then we do what the Choir asks. We close the possibilities that are failing. We save what can be saved.")
         + L(ILYRA, "You mean we erase them.")
         + L(TUROG, "I mean we stop them from suffering.")
         + L(VEIL, "The lock was built to protect this world, Vael. Not to choose which of its futures deserve to exist.")
         + L(ECHO, "...the world called Earth is listening... it does not know it is the lock...")
         + L(O, "Then we don't tell it. We hold the gate.")
         + L(TUROG, "You always say that. And every time, you are the one who decides when the gate opens.")
         + L(VEIL, "Because the sixth is the promise. That was the agreement.")
         + L(TUROG, "Agreements end.")
         + L(N, "Operator, this is a reconstruction. I cannot tell which parts are memory and which are the archive guessing.")
         + L(O, "It feels real.")
         + L(N, "That is what worries me."),
         "close": []},
        {"id": "10C", "title": "The Choir Descends", "location": "MEMORY — THE SANCTUARY WALLS", "kind": "survive", "amount": 60,
         "label": "Hold the sanctuary with the keepers",
         "open": L(ILYRA, "Keepers! To the walls!")
         + L(AUREN, "Every map I made says this is where we lose.")
         + L(O, "Then draw a new one."),
         "close": L(ILYRA, "They're breaking. Hold!")
         + L(TUROG, "No. They're making room. For me.")}
        ,
        {"id": "10D", "title": "The Severant", "location": "MEMORY — THE GATE OF THE FIRST SANCTUARY", "kind": "boss",
         "boss": "vael-turog-memory", "boss_name": "Vael Turog, the Severant", "label": "Stand against Vael Turog",
         "open": L(TUROG, "I am sorry. I truly am. Every world you save will end anyway, only slower and in more pain.")
         + L(O, "That's not your choice to make.")
         + L(TUROG, "It was never yours either. Raise your weapon, promise. Let us see if you remember how this ends."),
         "close": L(TUROG, "Yes. This is how it ended. You beat me. And then you did the thing none of us could forgive.")}
        ,
        {"id": "10E", "title": "The Breach", "location": "MEMORY — THE GATE", "kind": "cutscene",
         "open": L(VEIL, "Don't. If you open it now, the Covenant breaks. All of it.")
         + L(O, "If I don't, the Choir walks through and there's nothing left to protect.")
         + L(ILYRA, "There must be another way.")
         + L(O, "There isn't time for another way.")
         + L(AUREN, "The map is changing. I can't see past this moment. I can't see anything past you.")
         + L(VEIL, "Then I won't stand here and watch you break it.")
         + L(ILYRA, "Sovereign! Where are you going?")
         + L(VEIL, "To someone who can stop this from ever happening again.")
         + L(ECHO, "...the lock turns... the sanctuary sleeps... the promise forgets...")
         + L(N, "Operator! The memory is collapsing! I am pulling you out!")
         + L(O, "Wait! Who did she go to? Who?"),
         "close": []},
        {"id": "10F", "title": "Waking", "location": "INT. THE ASHEN ARCHIVE — THE DAIS", "kind": "cutscene",
         "open": L(SERA, "You stopped breathing for nine seconds.")
         + L(O, "I opened it. The gate. I broke the Covenant.")
         + L(N, "You opened a gate. The archive does not record why the Covenant broke. It records two departures in the same moment.")
         + L(O, "The Sovereign left. She said she was going to someone who could stop it happening again.")
         + L(SERA, "Did you see her face?")
         + L(O, "No. She wore a veil.")
         + L(SERA, "Of course she did.")
         + L(N, "Operator. Something else is in the archive with us.")
         + L(ARCH, "You saw too much, too soon. That was never in the plan.")
         + L(O, "Who are you?")
         + L(ARCH, "Someone who has watched this world end more times than you have lived. Go to Eldergrove. Wake the Voice. And when you are ready to understand what you did, I will be waiting.")
         + L(SERA, "...")
         + L(N, "The presence is gone. Seraphine, your heart rate is extremely elevated.")
         + L(SERA, "I know that voice. I don't know how. But I know it."),
         "close": []},
    ]},
]

STAGES = {
    "08A": "hq_hall", "08B": "hq_hall", "08C": "lab_red", "08D": "street_battle", "08E": "lab", "08F": "chamber", "08G": "balcony",
    "09A": "lab", "09B": "street", "09C": "terminal", "09D": "terminal", "09E": "surface", "09F": "command_post",
    "10A": "archive", "10B": "sanctuary", "10C": "sanctuary", "10D": "sanctuary", "10E": "sanctuary", "10F": "memory",
}
ACTS = {
    "10E": {"...the lock turns... the sanctuary sleeps... the promise forgets...": "seal"},
}
BOSSES = {"ascendant-construct": "crystal-stalker", "vael-turog-memory": "astravore"}
