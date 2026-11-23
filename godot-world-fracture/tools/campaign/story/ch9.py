"""Chapter 9 — The Unwritten, Missions 61–70: the finale. NOVA opens the Unwritten Future; Seraphine makes her final
choice; the broken alliance is reforged for the assault on the Heart; the Seventh Protocol asks its question; the
Architect falls and the sixth decides his fate; the Choir pours through the failing lock; the Promise remembers
everything — and the world does not end; the last choice for the lock; the world unwritten; after the ashes."""
from common import *

CHAPTER = (9, "The Unwritten")
MAKER = "ASTRYAN MAKER"
PROTO = "SEVENTH PROTOCOL"
CHOIR = "CHOIR VOICE"
ELDER_MAREN = "ELDER MAREN"

MISSIONS = [
    # =========================================================================================== MISSION 61
    {"id": "61", "title": "The Last Memory", "region": "Nexus City", "world": "nexus",
     "beat": "Home / the Unwritten Future opens / Elenya's plan", "chapters": [
        {"id": "61A", "title": "Four Days", "location": "EXT. NEXUS CITY — THE OLD QUARTER", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(N, "Four days, two hours. The city's clocks have started agreeing with each other to the millisecond. That has never happened before.")
         + L(VOSS, "Is that bad?")
         + L(N, "It is the world holding its breath. Forever, if he finishes.")
         + L(O, "NOVA. The sealed room. The Unwritten Future.")
         + L(N, "I think I can open it now. All five seals are bright. I think that's what it was waiting for."),
         "close": []},
        {"id": "61B", "title": "The Room", "location": "INT. NOVA — THE SEALED ROOM", "kind": "hack", "label": "Help NOVA open the Unwritten Future",
         "open": L(N, "Hold my hand. Metaphorically. Or literally, if you have a moment.")
         + L(O, "I'm here."),
         "close": L(N, "It's open.")}
        ,
        {"id": "61C", "title": "The Unwritten Future", "location": "INT. NOVA — THE SEALED ROOM", "kind": "cutscene",
         "open": L(MAKER, "Vigilance. If you've opened this, the seals are bright and the Promise is awake and somebody is trying to hold the world still.")
         + L(MAKER, "I hid a plan from the Council. A new Covenant. Not five keepers holding a lock. A door with keepers on both sides of it. Elyndra, Astryan, human. And the Promise on the threshold.")
         + L(MAKER, "Not a wall. Not an ending. A door that is kept. That's all I ever wanted. A door that is kept.")
         + L(N, "...")
         + L(O, "Can it be done?")
         + L(N, "It needs the five seals, the Promise, the Heart of the Engine, and people. Many people. From this world, choosing it."),
         "close": []},
        {"id": "61D", "title": "Kept", "location": "EXT. NEXUS CITY — THE OLD QUARTER", "kind": "cutscene",
         "open": L(ILYRA, "A kept door. She was always the wisest of them.")
         + L(AUREN, "My map just drew a road it's never drawn before. Through the Heart and out the other side.")
         + L(ECHO, "...the lamp is very bright today...")
         + L(N, "Thank you.")
         + L(O, "Then we need everyone. Every faction. Every city.")
         + L(VOSS, "Everyone hates each other.")
         + L(O, "Everyone hates being held still more."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 62
    {"id": "62", "title": "The Final Choice", "region": "Nexus City", "world": "nexus",
     "beat": "Seraphine's last appearance / the Sovereign chooses", "chapters": [
        {"id": "62A", "title": "The Sovereign Returns", "location": "EXT. THE ASCENDANCY TOWER ROOF", "kind": "talk", "who": "SERAPHINE",
         "start": "nexus-university", "label": "Meet Seraphine on the tower roof",
         "open": L(N, "Seraphine's signal. She's out of the Heart. She's on the roof where we found the data core.")
         + L(O, "Of course she is."),
         "close": L(SERA, "He let me go. He said he didn't need me anymore. He said it kindly. That's how I knew he meant it.")
         + L(O, "You're out.")
         + L(SERA, "I'm out. And I have to decide what I am now. His Sovereign. A keeper. Or a tired woman in a lab coat.")
         + L(O, "You don't have to decide alone.")
         + L(SERA, "Yes, I do. That's the whole point. You taught me that. Eleven worlds of other people deciding for me. This one's mine.")}
        ,
        {"id": "62B", "title": "Sovereign", "location": "EXT. THE ASCENDANCY TOWER ROOF — DUSK", "kind": "cutscene",
         "open": L(SERA, "I am Seraphine Vale. Once the Veiled Sovereign, keeper of the fourth seal. Once the Second of the Continuum. Once a researcher with a very bad coffee habit.")
         + L(SERA, "I choose the Covenant. Not the old one. The kept door.")
         + L(N, "Fourth seal... it's singing. With her.")
         + L(SERA, "And I choose to stay. In this world. Whatever happens. No more leaving.")
         + L(O, "No more leaving.")
         + L(SERA, "Don't look so pleased. You're still going to have to listen to me be right about everything."),
         "close": []},
        {"id": "62C", "title": "Crane", "location": "INT. THE ASCENDANCY TOWER — THE CROWN FLOOR", "kind": "talk", "who": "CRANE", "label": "Ask Crane for the Ascendancy",
         "open": [],
         "close": L(CRANE, "You came to me. I told you everyone does.")
         + L(O, "I'm not asking you to make keepers. I'm asking you to stand at a door.")
         + L(CRANE, "...A seat at the table. For humanity. Not built in a forge. Given.")
         + L(O, "Earned. By standing there when it's hard.")
         + L(CRANE, "Tallis would have laughed at me. All that fire, and the answer was to ask.")
         + L(CRANE, "The Ascendancy will stand. Every shield I have. For once in my life I'd like to be on the side that wins without cheating.")}
        ,
    ]},
    # =========================================================================================== MISSION 63
    {"id": "63", "title": "The Alliance Reforged", "region": "Nexus City", "world": "nexus",
     "beat": "Everyone at once / the march on the archive / the Engine's defences", "chapters": [
        {"id": "63A", "title": "Muster", "location": "EXT. NEXUS CITY — THE CENTRAL PLAZA — DAWN", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(VOSS, "Frontier Defense. Every soldier we have left.")
         + L(KAEL, "Free Operators. Every one who still answers my calls, and a few who don't.")
         + L(CRANE, "The Ascendancy. Shields up.")
         + L("CHIEF ODA", "Depth Engineers. We came up for this. Don't make me regret the sunlight.")
         + L(ELDER_MAREN, "The rangers of Eldergrove. The forest sends its regards.")
         + L(GOL, "Goliath.")
         + L(NYX, "Nyx.")
         + L(CIPH, "Cipher. For Tallis.")
         + L(O, "Three days ago this city couldn't agree on who owned a data core.")
         + L(SERA, "Three days ago nobody was trying to hold the sky still."),
         "close": []},
        {"id": "63B", "title": "The March", "location": "EXT. NEXUS CITY — THE OLD QUARTER", "kind": "survive", "amount": 90,
         "label": "Hold the Old Quarter while the alliance reaches the archive",
         "open": L(N, "The Continuum knows. Executors and Eternal Guard at every street into the Old Quarter.")
         + L(VOSS, "Then we take every street."),
         "close": []},
        {"id": "63C", "title": "The Deep Door", "location": "INT. THE ASHEN ARCHIVE — THE DAIS", "kind": "kills", "amount": 12,
         "label": "Clear the archive for the alliance",
         "open": L("ARCHIVE WARDEN", "Five seals sing. The Promise returns. With... many.")
         + L(O, "They're with me.")
         + L("ARCHIVE WARDEN", "Then the archive is with you also. It has waited a long time for a crowd."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 64
    {"id": "64", "title": "The Seventh Protocol", "region": "The Origin Engine — the Heart", "world": "nexus",
     "beat": "Into the Heart / the Engine's question", "chapters": [
        {"id": "64A", "title": "The Heart's Gate", "location": "INT. THE ENGINE — THE HEART'S GATE", "kind": "reach", "start": "nexus-central-plaza",
         "label": "Reach the Heart's gate",
         "open": L(N, "Two days. The Heart is sealed. The Engine will only open it to an answer."),
         "close": []},
        {"id": "64B", "title": "The Question", "location": "INT. THE HEART'S GATE", "kind": "cutscene",
         "open": L(PROTO, "Seventh Protocol. The shared intelligence of the Engine's guardians, reconnected.")
         + L(PROTO, "Promise. Before the Heart opens, answer. Which reality are you attempting to save?")
         + L(O, "...")
         + L(N, "Take your time. It has waited longer than anyone."),
         "close": []},
        {"id": "64C", "title": "The Answer", "location": "INT. THE HEART'S GATE", "kind": "choice",
         "prompt": "The Seventh Protocol asks: which reality are you attempting to save?",
         "options": [["this", "This one", "\"This one. The one with these people in it.\""],
                     ["every", "Every one of them", "\"All of them. Including the ones I'll never see.\""],
                     ["next", "The next one", "\"The one that hasn't happened yet. The one they'll choose.\""]],
         "by_choice": {"this": L(PROTO, "A small answer. Honest. The Heart accepts honesty."),
                       "every": L(PROTO, "A large answer. Impossible. The Heart accepts the attempt."),
                       "next": L(PROTO, "An unwritten answer. The Heart was built for nothing else.")},
         "open": [], "close": []},
        {"id": "64D", "title": "Open", "location": "INT. THE HEART", "kind": "cutscene",
         "open": L(N, "The Heart is open.")
         + L(ARCH, "Of course it is. It always liked you better.")
         + L(SERA, "Idris.")
         + L(ARCH, "Seraphine. You chose. Good. I hoped you would. I'm sorry it wasn't me.")
         + L(ARCH, "Come in, Promise. One day left. Let's see if you can stop a man with nothing but time."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 65
    {"id": "65", "title": "Idris", "region": "The Origin Engine — the Heart", "world": "nexus",
     "beat": "The Architect's last stand / his fate", "chapters": [
        {"id": "65A", "title": "The Architect", "location": "INT. THE HEART — THE CORE", "kind": "boss", "boss": "architect", "start": "nexus-central-plaza",
         "boss_name": "The Architect", "label": "Stop the Architect",
         "open": L(ARCH, "Eleven worlds I've held together with my own hands. I won't let go of the twelfth because a seed asked nicely.")
         + L(O, "Then I'll stop asking."),
         "close": L(ARCH, "...Enough. Enough. I'm so tired. I've been tired since before your world had oceans.")}
        ,
        {"id": "65B", "title": "His Family", "location": "INT. THE HEART — THE CORE", "kind": "cutscene",
         "open": L(ARCH, "Do you know what I see, when the Engine turns? Them. My wife. My son. Possibilities in the next layer, just out of reach. Every time.")
         + L(SERA, "Idris. You'll never find them by holding everything still.")
         + L(ARCH, "No. I know. I've known for a very long time. Stillness was just easier to bear than looking.")
         + L(ARCH, "Well, Promise. You have me. Decide."),
         "close": []},
        {"id": "65C", "title": "The Architect's Fate", "location": "INT. THE HEART — THE CORE", "kind": "choice",
         "prompt": "The Architect is beaten. The Continuity Lock is still turning. What happens to him?",
         "options": [["end", "End him", "The lock dies with him. So does everything he knows."],
                     ["replace", "Take his place at the Engine", "Hold the continuity function yourself — and decide what it keeps."],
                     ["release", "Let him go looking", "Unbind him from the Engine. Let him walk into the layers and look for his family."]],
         "by_choice": {"end": L(ARCH, "Fair. Quick, please. I've had enough slow.") + L(N, "He's gone. The lock is failing."),
                       "replace": L(ARCH, "You'd carry it? You'd be the Architect?") + L(O, "No. I'd be the one who keeps the door.") + L(ARCH, "...Then you'll do it better than I did. It's not a high bar."),
                       "release": L(ARCH, "Let me go? After everything?") + L(O, "Go and look. Properly this time.") + L(ARCH, "...Thank you. If I find them, I'll tell them about you. They'll think I'm making it up.")},
         "open": [], "close": []},
        {"id": "65D", "title": "The Lock Breaks", "location": "INT. THE HEART — THE CORE", "kind": "cutscene",
         "open": L(N, "The Continuity Lock is breaking. And the old lock with it. The one Earth has held since the Covenant.")
         + L(SERA, "Without a wall, there's nothing between this world and the Choir.")
         + L(N, "Choir signatures. Thousands. Coming through every crack at once.")
         + L(O, "Then we hold the door until it's kept."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 66
    {"id": "66", "title": "The Choir's Answer", "region": "Nexus City", "world": "nexus",
     "beat": "The Choir pours through / the keepers' stand / the city holds", "chapters": [
        {"id": "66A", "title": "Every Crack", "location": "EXT. NEXUS CITY — THE SKY OPENS", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(CHOIR, "Possibility. Your cage is broken. Let us end you gently, before you end yourselves screaming.")
         + L(VOSS, "All units! They're coming through the sky!")
         + L(ILYRA, "Keepers! To me! The way we stood at the sanctuary!")
         + L(AUREN, "Every map I ever drew ends here. Let's draw past it."),
         "close": []},
        {"id": "66B", "title": "The Keepers' Stand", "location": "EXT. NEXUS CITY — THE CENTRAL PLAZA", "kind": "survive", "amount": 100,
         "label": "Hold the plaza with the keepers",
         "open": L(ILYRA, "I'm singing. Don't let anything near me.")
         + L(O, "Nothing gets near you."),
         "close": L(N, "Something huge is descending into the plaza. It is a chorus of Choir constructs bound into one.")}
        ,
        {"id": "66C", "title": "The Great Chorus", "location": "EXT. NEXUS CITY — THE CENTRAL PLAZA", "kind": "boss", "boss": "great-chorus",
         "boss_name": "The Great Chorus", "label": "Break the Great Chorus",
         "open": L(CHOIR, "WE ARE MANY. WE ARE MERCY.")
         + L(SERA, "You're loud, is what you are."),
         "close": L(N, "It's coming apart. The Choir is... hesitating.")}
        ,
        {"id": "66D", "title": "Hesitation", "location": "EXT. NEXUS CITY — THE CENTRAL PLAZA", "kind": "cutscene",
         "open": L(CHOIR, "...the possibility... resists... it is not screaming...")
         + L(ILYRA, "It's singing. Listen. The whole city.")
         + L(N, "Eighteen thousand people from Haven. The Underground. Thalassia's engineers. The rangers. All broadcasting. All at once.")
         + L(CHOIR, "...why do you sing, failing world...")
         + L(O, "Because we're not failing. We're choosing."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 67
    {"id": "67", "title": "The Breach Remembered", "region": "Nexus City", "world": "nexus",
     "beat": "Everything comes back / remembering with others", "chapters": [
        {"id": "67A", "title": "All At Once", "location": "INT. THE HEART — THE THRESHOLD", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(N, "Operator. The memories from the pods. They've found you. All of them. They're coming back at once.")
         + L(O, "Every time I remember everything, the world ends.")
         + L(SERA, "Every time you remembered alone.")
         + L(SERA, "Hold my hand. NOVA, hold the other one. Ilyra, Auren, Echo. All of you. Let them come back to all of us."),
         "close": []},
        {"id": "67B", "title": "Eleven Worlds", "location": "INT. THE HEART — MEMORY", "kind": "survive", "amount": 60,
         "label": "Hold on through eleven worlds of memory",
         "open": L(N, "The memories are taking shape. Every ending, all around you. Don't let go."),
         "close": []},
        {"id": "67C", "title": "Remembered", "location": "INT. THE HEART — THE THRESHOLD", "kind": "cutscene",
         "open": L(O, "I remember. All of it. The seed. The ruins. The Astryans waking me. The gate. Every world.")
         + L(N, "The world is still here.")
         + L(SERA, "Of course it is. You didn't carry it alone this time.")
         + L(O, "In every world I was afraid I'd chosen wrong. And so I did it again harder.")
         + L(ILYRA, "And this time?")
         + L(O, "This time I'm not afraid of choosing. I'm afraid of choosing for them. So I won't."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 68
    {"id": "68", "title": "The Last Choice", "region": "The Origin Engine — the Heart", "world": "nexus",
     "beat": "The lock / the gate / the kept door", "chapters": [
        {"id": "68A", "title": "The Threshold", "location": "INT. THE HEART — THE GATE", "kind": "reach", "start": "nexus-central-plaza",
         "label": "Walk to the gate at the centre of the Heart",
         "open": L(N, "This is where it was always going. The gate. The same gate. Your hand.")
         + L(O, "I know."),
         "close": []},
        {"id": "68B", "title": "The Keepers Speak", "location": "INT. THE HEART — THE GATE", "kind": "cutscene",
         "open": L(ILYRA, "You could restore the old Covenant. Five keepers. A lock. This world safe, and small, and asleep.")
         + L(AUREN, "You could open the gate all the way. Every road open. No keepers. Whatever comes, comes.")
         + L(SERA, "Or Elenya's door. Kept on both sides. By us and by them. Harder than either. Never finished.")
         + L(ECHO, "...the Promise was planted to choose... so choose...")
         + L(N, "Whatever you choose, I'll keep the record. All of it. That's what I'm for."),
         "close": []},
        {"id": "68C", "title": "The Promise", "location": "INT. THE HEART — THE GATE", "kind": "choice",
         "prompt": "Your hand is on the gate. What do you make of it?",
         "options": [["restore", "Restore the lock", "The old Covenant: five keepers, a sealed world, safe and still."],
                     ["open", "Open the gate", "Every road open, no keepers. The world meets whatever is out there on its own."],
                     ["kept", "Keep the door", "Elenya's Covenant: a door kept on both sides, by keepers and by the people of this world."]],
         "by_choice": {"restore": L(ILYRA, "Then we hold it. Gladly. For as long as you need us to.") + L(N, "Lock restored. The world is quiet. It is very safe."),
                       "open": L(AUREN, "Then let's see where the roads go. All of them.") + L(N, "Gate open. The sky is full of other skies."),
                       "kept": L(SERA, "Kept. Of course you did.") + L(N, "The door is kept. On both sides. I can hear people on the other side. Some of them are singing back.")},
         "open": [], "close": []},
    ]},
    # =========================================================================================== MISSION 69
    {"id": "69", "title": "A World Unwritten", "region": "Nexus City", "world": "nexus",
     "beat": "The last fight / what's left of the Choir / dawn", "chapters": [
        {"id": "69A", "title": "The Last of the Silence", "location": "EXT. NEXUS CITY — THE OLD QUARTER", "kind": "kills", "amount": 14, "start": "nexus-central-plaza",
         "label": "Clear the last Choir from the city",
         "open": L(N, "The Choir constructs that won't stop. The ones built only to end things.")
         + L(O, "Then let's give them an ending. A kind one."),
         "close": []},
        {"id": "69B", "title": "The Seal of Endings", "location": "EXT. NEXUS CITY — THE OLD QUARTER", "kind": "cutscene",
         "open": L(N, "The last of them. You still carry Turog's seal.")
         + L(O, "Someone has to be able to end things. Or nothing means anything.")
         + L(N, "He said you'd hate doing it.")
         + L(O, "He was right."),
         "close": []},
        {"id": "69C", "title": "Dawn", "location": "EXT. NEXUS CITY — THE ASCENDANCY TOWER ROOF — DAWN", "kind": "cutscene",
         "open": L(N, "The clocks have stopped agreeing with each other. They're a little bit wrong again. Every one of them.")
         + L(O, "Good.")
         + L(SERA, "It's moving. The world. You can feel it.")
         + L(VOSS, "So what now?")
         + L(O, "Now we find out."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 70
    {"id": "70", "title": "After the Ashes", "region": "Nexus City", "world": "nexus",
     "beat": "Epilogue / the people who are left / the next question", "chapters": [
        {"id": "70A", "title": "Haven Again", "location": "EXT. HAVEN-01 — REBUILT WALLS — SPRING", "kind": "talk", "who": "DANIEL", "start": "nexus-harbor",
         "label": "Walk through Haven",
         "open": L(N, "Three months. Haven is rebuilt. Voss insisted on bigger walls and Kael insisted on bigger gates.")
         + L(O, "Who won?")
         + L(N, "Both. They argued so long the builders made the gates big enough to drive a wall through."),
         "close": L(DANIEL, "Hey! It's you! You're the one from the bus!")
         + L(O, "Daniel. You got big.")
         + L(DANIEL, "It's been, like, a year. Dad's OK. His leg's weird but he's OK.")
         + L(DANIEL, "Everyone says you saved the world.")
         + L(O, "Everyone saved the world. I just held the door.")
         + L(DANIEL, "That's what a door does, though. Right? It's the most important bit.")}
        ,
        {"id": "70B", "title": "Everyone", "location": "INT. HAVEN-01 — THE COMMAND CENTRE", "kind": "cutscene",
         "open": L(VOSS, "Director Voss. I hate it. Ward would laugh.")
         + L(KAEL, "Ward would make you file a report about hating it.")
         + L(CRANE, "The Ascendancy's new program is very simple. We ask people what they want before we change them. Revolutionary.")
         + L(ILYRA, "I'm going back to the falls. The water's been nervous without me.")
         + L(AUREN, "And I'm going to walk off the edge of the map. There's an edge again. Isn't that wonderful?")
         + L(SERA, "I'm staying. Somebody has to be right about everything around here.")
         + L(N, "And I am keeping the record. All of it. Including the part where Goliath cried at the sunrise.")
         + L(GOL, "I had sand in my eye.")
         + L(NYX, "There was no sand.")
         + L(GOL, "There was emotional sand."),
         "close": []},
        {"id": "70C", "title": "The Next Question", "location": "EXT. HAVEN-01 — THE OBSERVATION TOWER — NIGHT", "kind": "cutscene",
         "open": L(N, "Operator. It's here.")
         + L(WITNESS, "Observed.")
         + L(O, "Hello again.")
         + L(WITNESS, "You chose without forcing. The question is satisfied. For now.")
         + L(O, "For now?")
         + L(WITNESS, "There is an older question. Asked before the Seed. Before the Elyndra. Before anything.")
         + L(WITNESS, "If existence could begin again, would you choose the same world?")
         + L(O, "...")
         + L(SERA, "Don't answer it tonight.")
         + L(O, "I wasn't going to.")
         + L(N, "End of record. Beginning of the next one."),
         "close": []},
    ]},
]
STAGES = {
    "61A": "crater", "61B": "lab", "61C": "memory", "61D": "crater",
    "62A": "balcony", "62B": "balcony", "62C": "lab",
    "63A": "plaza", "63B": "street_battle", "63C": "archive",
    "64A": "astryan_hall", "64B": "astryan_hall", "64C": "astryan_hall", "64D": "heart",
    "65A": "heart", "65B": "heart", "65C": "heart", "65D": "heart",
    "66A": "plaza", "66B": "plaza", "66C": "plaza", "66D": "plaza",
    "67A": "heart", "67B": "heart", "67C": "heart",
    "68A": "heart", "68B": "heart", "68C": "heart",
    "69A": "street_battle", "69B": "street", "69C": "balcony",
    "70A": "haven", "70B": "command_post", "70C": "tower",
}
ACTS = {
    "62B": {"Fourth seal... it's singing. With her.": "seal"},
    "68C": {},
}
BOSSES = {"architect": "colossus", "great-chorus": "astravore"}
