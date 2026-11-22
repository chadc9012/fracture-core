"""Chapter 3 — The Exiled Sovereign, Missions 18–24: Seraphine's truth. She runs to Neon City for the record she stole;
the Continuum's money turns up in Frontier Defense's books; the operator storms the Continuum's observatory over
Skyhaven, and Rainer pays for Genesis."""
from common import *

CHAPTER = (3, "The Exiled Sovereign")
VESPER = "VESPER"
EXEC = "EXECUTOR"

MISSIONS = [
    # =========================================================================================== MISSION 18
    {"id": "18", "title": "The Stranger in Silver", "region": "Neon City", "world": "neon-city",
     "beat": "Missing ally / Neon City underworld / the stranger", "chapters": [
        {"id": "18A", "title": "Gone", "location": "INT. HAVEN-01 — SERAPHINE'S QUARTERS", "kind": "cutscene", "start": "terminal:neon",
         "open": L(VOSS, "Her bunk hasn't been slept in. Her research is wiped. She took a transport at four in the morning and logged it as a supply run.")
         + L(O, "Where to?")
         + L(N, "Neon City. The transport was found empty at the harbour an hour ago.")
         + L(ILYRA, "She's going home.")
         + L(O, "Neon City isn't her home.")
         + L(ILYRA, "Not the city. Whatever she left there. People always go back for what they hid before they knew why they hid it.")
         + L(VOSS, "If she's selling us out —")
         + L(O, "She isn't.")
         + L(VOSS, "You don't know that.")
         + L(O, "No. But I'm going to find out before you do."),
         "close": []},
        {"id": "18B", "title": "Neon Run", "location": "EXT. NEON CITY — THE CYAN LOOP", "kind": "drive", "to": "neon-underground",
         "label": "Get to the Underground before the trail goes cold",
         "open": L(N, "Neon City. Population twelve million. Number of people who will help us for free: statistically, zero.")
         + L(O, "Then we'll pay."),
         "close": []},
        {"id": "18C", "title": "Vesper", "location": "INT. THE UNDERGROUND — A BACK ROOM", "kind": "talk", "who": "VESPER", "to": "neon-underground",
         "label": "Find someone who sells secrets",
         "open": [],
         "close": L(VESPER, "The famous survivor. In my little room. Should I be flattered or should I be running?")
         + L(O, "I'm looking for a woman. Dark hair, lab coat, very tired.")
         + L(VESPER, "No. But I sold passage last night to a woman with silver hair and eyes like a bruise. Paid in old Genesis credit. Asked for the Vault Under the Grid.")
         + L(O, "Silver hair?")
         + L(VESPER, "Like moonlight on a knife. You know her, then.")
         + L(N, "Seraphine's hair was dyed. I noted the chemical traces months ago and assumed vanity.")
         + L(VESPER, "Everybody in this city is wearing something over something. Here's a free one. You're not the only ones asking. The men in the bending coats asked an hour before you.")}
        ,
        {"id": "18D", "title": "Bending Coats", "location": "EXT. NEON CITY — THE MARKET GRID", "kind": "kills", "amount": 9,
         "label": "Cut through the Continuum hunters",
         "open": L(N, "Executors. Six on the rooftops, three on the street.")
         + L(O, "They're after her too.")
         + L(N, "They are after what she is carrying."),
         "close": L(EXEC, "...the Sovereign is in the vault... seal it... nobody goes in, nobody comes out...")
         + L(O, "Sovereign.")
         + L(N, "They used that title for her. Turog used it too.")}
        ,
        {"id": "18E", "title": "The Vault Under the Grid", "location": "INT. THE VAULT UNDER THE GRID", "kind": "talk", "who": "SERAPHINE",
         "to": "neon-underground", "label": "Find Seraphine in the vault",
         "open": L(N, "The vault was sealed from inside. I can open it. Very quietly.")
         + L(O, "Do it."),
         "close": L(SERA, "You weren't supposed to follow me.")
         + L(O, "Your hair.")
         + L(SERA, "Is the least interesting thing about me, I promise.")
         + L(O, "Who are you?")
         + L(SERA, "Someone who hid something here a very long time ago. Before this city had a name. Before it had neon.")
         + L(O, "That's impossible.")
         + L(SERA, "Most of my life is.")}
        ,
        {"id": "18F", "title": "The Stranger", "location": "INT. THE VAULT — THE INNER ROOM", "kind": "cutscene",
         "open": L(SERA, "There. A record. Encrypted against everyone alive, including me.")
         + L(N, "The encryption predates any human system. It resembles the archive's.")
         + L(SERA, "Because I wrote it with the same hands that built the archive's locks. Or hands very like them.")
         + L(O, "Seraphine. The truth.")
         + L(SERA, "The truth is that I'm not who I told you I was. I'm not entirely who I think I am. And the Continuum is about to come through that door.")
         + L(N, "She is correct. Twelve signatures above us.")
         + L(SERA, "Get me out of here with this record and I'll tell you everything I know. It isn't much. It's more than anyone else will tell you."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 19
    {"id": "19", "title": "The Warning", "region": "Neon City", "world": "neon-city",
     "beat": "Decrypting the record / vault siege / eleven endings / escape", "chapters": [
        {"id": "19A", "title": "Eleven", "location": "INT. THE VAULT — THE INNER ROOM", "kind": "hack", "start": "neon-underground",
         "label": "Decrypt the record while the door holds",
         "open": L(SERA, "I can open it. NOVA can read it. You keep them away from the door.")
         + L(N, "Why do you need me to read it?")
         + L(SERA, "Because you'll tell the truth about what's on it. I'm not sure I will."),
         "close": L(N, "Decryption at forty percent. The door will not hold to a hundred.")}
        ,
        {"id": "19B", "title": "The Door", "location": "INT. THE VAULT UNDER THE GRID", "kind": "survive", "amount": 70,
         "label": "Hold the vault door",
         "open": L(EXEC, "Sovereign! The Architect asks you to return what you took. He asks politely, this once.")
         + L(SERA, "Tell him he can ask me himself.")
         + L(EXEC, "He thought you'd say that."),
         "close": L(N, "Decryption complete. Seraphine... it is a list of worlds.")}
        ,
        {"id": "19C", "title": "The Record", "location": "INT. THE VAULT — THE INNER ROOM", "kind": "cutscene",
         "open": L(N, "Eleven entries. Each one a version of this world. Each one ends.")
         + L(N, "World one: the gate opens early. The Choir crosses. Erasure. World two: the gate never opens. The lock starves the world. Collapse.")
         + L(N, "World three through world eleven. In each, the sixth wakes. In each, the sixth remembers everything. In each, the world ends within a year.")
         + L(O, "Me. Every time.")
         + L(SERA, "Not you. Something that has your face and your signature and your stubbornness. I don't know if it's you.")
         + L(N, "World seven has an annotation. In Seraphine's hand.")
         + L(SERA, "...Read it.")
         + L(N, "\"This time I stayed. This time we tried together. It ended anyway. I am so tired of losing them.\"")
         + L(O, "Them?")
         + L(SERA, "You. I don't remember writing it. I remember the feeling. That's all.")
         + L(SERA, "That's my warning, Operator. Every time you remember everything, the world ends. So please. Remember slowly."),
         "close": []},
        {"id": "19D", "title": "Out Through the Grid", "location": "EXT. NEON CITY — THE ROOFTOPS", "kind": "reach", "label": "Get Seraphine out of Neon City",
         "open": L(N, "The Executors have the streets. The rooftops are open.")
         + L(SERA, "I hate rooftops.")
         + L(O, "You hid a vault under a city. You can survive a rooftop."),
         "close": L(SERA, "Thank you. For coming after me.")
         + L(O, "You'd have done the same.")
         + L(SERA, "I'd like to think so. I have eleven reasons to doubt it.")}
        ,
    ]},
    # =========================================================================================== MISSION 20
    {"id": "20", "title": "The Black Ledger", "region": "Neon City", "world": "neon-city",
     "beat": "Black market / the money trail / a name nobody wanted", "chapters": [
        {"id": "20A", "title": "Follow the Money", "location": "INT. THE UNDERGROUND — VESPER'S ROOM", "kind": "talk", "who": "VESPER",
         "to": "neon-underground", "start": "neon-dealer", "label": "Ask Vesper who pays the Continuum's bills",
         "open": L(N, "The Executors carried Frontier Defense ammunition. Recent lots. Not stolen.")
         + L(O, "Somebody's supplying them.")
         + L(SERA, "Somebody's always supplying someone."),
         "close": L(VESPER, "Ah. The survivor and the stranger. Together. That's either romance or a heist.")
         + L(O, "Who sells to the Continuum?")
         + L(VESPER, "Nobody sells to them. They buy through a ledger. One book, every trade, every favour, every name. Kept in the Fracture Market, under guard.")
         + L(O, "Whose guard?")
         + L(VESPER, "Everyone's. That's what makes it safe.")}
        ,
        {"id": "20B", "title": "The Fracture Market", "location": "EXT. NEON CITY — THE MARKET UNDER THE OVERPASS", "kind": "kills", "amount": 10,
         "label": "Break the ledger's guard", "start": "neon-underground",
         "open": L(N, "Mercenaries. Ascendancy shields. Free Operator rifles. And Continuum armour. Everyone really is guarding it.")
         + L(SERA, "Then everyone has something to hide."),
         "close": L(N, "The ledger is in a strongbox. It is protected by a lock I can open.")}
        ,
        {"id": "20C", "title": "The Ledger", "location": "INT. THE MARKET — THE STRONGROOM", "kind": "hack", "label": "Open the strongbox",
         "open": L(O, "Open it.")
         + L(N, "Opening."),
         "close": L(N, "I have the ledger.")}
        ,
        {"id": "20D", "title": "Names", "location": "INT. THE MARKET — THE STRONGROOM", "kind": "cutscene",
         "open": L(N, "Payments to Prefect Crane for Fracture samples. Payments to General Rainer, through Genesis. Payments to a Frontier Defense account labelled Continuity Reserve.")
         + L(O, "Whose account?")
         + L(N, "Authorised by Director Helena Ward.")
         + L(SERA, "Ward.")
         + L(O, "She told us she was holding the line.")
         + L(N, "The Continuity Reserve funded the walls of Haven-01. The ammunition at the First Siege. The generators in the medical centre.")
         + L(SERA, "She held the line with their money.")
         + L(O, "And what did they buy with it?")
         + L(N, "One entry. Repeated monthly. \"Location of the sixth, when known.\""),
         "close": []},
        {"id": "20E", "title": "The Bridge Home", "location": "EXT. THE CELESTIAL BRIDGE — NIGHT", "kind": "drive", "to": "terminal:neon",
         "label": "Get out of Neon City with the ledger",
         "open": L(SERA, "What are you going to do?")
         + L(O, "Ask her.")
         + L(SERA, "And if you don't like the answer?")
         + L(O, "Then I'll ask again."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 21
    {"id": "21", "title": "The Pursuit", "region": "Nexus City", "world": "nexus",
     "beat": "Confrontation / the hunt / a trade offered", "chapters": [
        {"id": "21A", "title": "The Director", "location": "INT. FRONTIER DEFENSE HEADQUARTERS — WARD'S OFFICE", "kind": "talk", "who": "WARD",
         "to": "nexus-bastion", "start": "nexus-bastion", "label": "Confront Director Ward",
         "open": [],
         "close": L(WARD, "You found the ledger. Of course you did.")
         + L(O, "You sold me to them.")
         + L(WARD, "I sold a rumour. For walls, for ammunition, for eighteen thousand people who are alive tonight.")
         + L(O, "And when they asked where I was?")
         + L(WARD, "I lied to them. Every month. I told them the sixth was dead in the Eastern blocks.")
         + L(N, "Her heart rate is steady. Her pupils are steady. She believes what she is saying.")
         + L(WARD, "I'm the Director of a dying army, Operator. I make the deals the dead can't make for themselves.")
         + L(VOSS, "Director. You should have told me.")
         + L(WARD, "If I'd told you, you'd have stopped me. And we'd all be dead and honest.")}
        ,
        {"id": "21B", "title": "Hunted", "location": "EXT. NEXUS CITY — THE EASTERN BLOCKS", "kind": "survive", "amount": 60,
         "label": "Survive the Continuum's hunt",
         "open": L(N, "The Continuum have stopped hiding. Executors across the Eastern blocks. They are looking for Seraphine.")
         + L(SERA, "They know I decrypted it. The Architect never lets the record leave his hands twice.")
         + L(O, "Then let's make it expensive."),
         "close": L(N, "They are falling back. Toward the harbour. With something heavy.")}
        ,
        {"id": "21C", "title": "Harbour Chase", "location": "EXT. NEXUS CITY — THE HARBOUR ROAD", "kind": "drive", "to": "nexus-harbor",
         "label": "Catch them at the harbour",
         "open": L(VOSS, "They've got a transport and a tank of something glowing. I'm right behind you."),
         "close": []},
        {"id": "21D", "title": "The Vanguard", "location": "EXT. NEXUS HARBOUR — THE CONTAINER YARD", "kind": "boss", "boss": "executor-vanguard",
         "boss_name": "Executor Vanguard", "label": "Bring down the Executor Vanguard",
         "open": L(EXEC, "The Sovereign comes with us. The rest of you are a rounding error.")
         + L(O, "I've been called worse."),
         "close": L(N, "It is down. A Fracture is opening on the pier. Someone is stepping through.")}
        ,
        {"id": "21E", "title": "The Offer", "location": "EXT. NEXUS HARBOUR — THE PIER", "kind": "cutscene",
         "open": L(VASQ, "Hello again. You've been busy.")
         + L(O, "Vasq.")
         + L(VASQ, "I'm here to make an offer, and then I'll leave. The Architect has always been generous with offers.")
         + L(VASQ, "Give us Seraphine and the record. In return, the Continuum guarantees Haven-01. No Choir assault will reach it. No Executor will walk its streets. Ever.")
         + L(SERA, "He means it. That's the worst part. He always means it.")
         + L(VASQ, "Think about it. Eighteen thousand lives against one woman who left you once already.")
         + L(O, "Left me?")
         + L(VASQ, "Oh. She hasn't told you that part yet. Ask her who held the door at the end of the first world. Tomorrow at dawn. I'll be listening."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 22
    {"id": "22", "title": "The Truth", "region": "Nexus City", "world": "nexus",
     "beat": "Confession / a choice of trust", "chapters": [
        {"id": "22A", "title": "Rooftop, Three A.M.", "location": "EXT. HAVEN-01 — THE OBSERVATION TOWER", "kind": "talk", "who": "SERAPHINE",
         "start": "nexus-harbor", "label": "Find Seraphine on the tower",
         "open": [],
         "close": L(SERA, "I wondered when you'd come up.")
         + L(O, "Tell me.")
         + L(SERA, "All right. All of it. Such as it is.")
         + L(SERA, "My first memory is a white room and a man with kind eyes telling me the world had ended and we were going to make sure it never ended again. I believed him. I built the Continuum with him.")
         + L(O, "The Architect.")
         + L(SERA, "I was his Second, before Vasq. For longer than I can count. We watched worlds. We stopped the ones that were going wrong.")
         + L(O, "Stopped how?")
         + L(SERA, "We let them fall, and we rebuilt from what was left. It seemed merciful. Then I found the experiments. He let them fall on purpose. To learn how they fell. Whole civilisations as data.")
         + L(SERA, "So I left. I stole the record of every world he'd ended. And I hid in the one place he'd never look. A life. A lab coat. A name.")
         + L(O, "And the door? Vasq said you held the door at the end of the first world.")
         + L(SERA, "I don't remember the first world. My memory begins in that white room. Everything before it is a veil.")
         + L(N, "Veiled Sovereign.")
         + L(SERA, "Yes. I've thought of that too.")}
        ,
        {"id": "22B", "title": "Trust", "location": "EXT. HAVEN-01 — THE OBSERVATION TOWER", "kind": "choice",
         "prompt": "Vasq wants Seraphine and the record by dawn, for Haven-01's safety. What do you do?",
         "options": [["trust", "Stand with Seraphine", "Refuse Vasq. Haven stands on its own walls."],
                     ["watch", "Keep her close, and watched", "Refuse Vasq, but put NOVA on Seraphine's every move."],
                     ["bargain", "Meet Vasq — on your terms", "Go to the pier with the record and no Seraphine. See what he really wants."]],
         "by_choice": {"trust": L(SERA, "Thank you. I don't know who I'll be when I remember. But thank you."),
                       "watch": L(N, "I will be watching her, Operator.") + L(SERA, "Good. Somebody should."),
                       "bargain": L(SERA, "Go, then. Just don't believe anything he says that sounds like mercy.")},
         "open": [], "close": []},
        {"id": "22C", "title": "Dawn on the Pier", "location": "EXT. NEXUS HARBOUR — THE PIER — DAWN", "kind": "cutscene",
         "open": L(VASQ, "Dawn. And you came. Is she with you?")
         + L(O, "No. And she never will be.")
         + L(VASQ, "A pity. Then Haven is on its own.")
         + L(SERA, "Haven was always on its own, Oren. That's what made it worth living in.")
         + L(VASQ, "Sovereign. You came after all.")
         + L(SERA, "I came to tell you myself. Tell the Architect I remember the white room. Tell him I'm starting to remember what came before it.")
         + L(VASQ, "He'll be so pleased. And so sorry."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 23
    {"id": "23", "title": "The Inner Circle", "region": "Skyhaven", "world": "skyhaven",
     "beat": "Assault on the observatory / the prediction engine / an old enemy in chains", "chapters": [
        {"id": "23A", "title": "Skyhaven", "location": "EXT. SKYHAVEN — THE FLOATING ISLES", "kind": "cutscene", "start": "sk-airport",
         "open": L(N, "The record names a Continuum observatory in the Skyhaven isles. Its signature is hidden in the abbey.")
         + L(GOL, "An observatory. In a monastery. On a floating rock.")
         + L(NYX, "You keep complaining about where things are.")
         + L(GOL, "Things should be on the ground.")
         + L(SERA, "It's where he keeps the Continuity Engine. It predicts the endings. If we break it, he's blind.")
         + L(O, "For how long?")
         + L(SERA, "Long enough. Maybe."),
         "close": []},
        {"id": "23B", "title": "The Abbey Steps", "location": "EXT. SKYHAVEN ABBEY — THE STEPS", "kind": "kills", "amount": 10, "to": "sk-abbey",
         "label": "Take the abbey steps",
         "open": L(N, "Observers and Executors together. They were expecting us.")
         + L(SERA, "They always expect us. The trick is to be what they didn't expect."),
         "close": []},
        {"id": "23C", "title": "The Continuity Engine", "location": "INT. THE ABBEY — THE ENGINE HALL", "kind": "hack", "label": "Read the Continuity Engine",
         "open": L(N, "The Engine is running a simulation. Of us. Right now.")
         + L(O, "What does it say we do next?")
         + L(N, "It says you are about to ask me that."),
         "close": L(N, "I have its predictions. Every line ends at the same place. At you. After you, the Engine draws nothing.")}
        ,
        {"id": "23D", "title": "The Prisoner", "location": "INT. THE ABBEY — THE CELLS", "kind": "cutscene",
         "open": L(RAINER, "Took you long enough.")
         + L(O, "Rainer.")
         + L(RAINER, "They brought me here after the terminal. Asked me about you every day. I told them you were an idiot. They wrote it down.")
         + L(N, "He is injured. Badly.")
         + L(RAINER, "I know. Listen. The Engine. It feeds the Architect his predictions. It runs on a core from the old world. Astryan. Break the core and you break more than a machine.")
         + L(O, "What else?")
         + L(RAINER, "His certainty. And there's something guarding it that isn't human."),
         "close": []},
        {"id": "23E", "title": "Observer Prime", "location": "INT. THE ABBEY — THE ENGINE CORE", "kind": "boss", "boss": "observer-prime",
         "boss_name": "Observer Prime", "label": "Destroy the Engine's guardian",
         "open": L(N, "The guardian is wired into the Engine. It is predicting your attacks.")
         + L(O, "Then I'll do something stupid.")
         + L(N, "That is, statistically, your greatest strength."),
         "close": L(N, "The guardian is down. The Engine core is exposed. It is unstable.")}
        ,
        {"id": "23F", "title": "Falling Sky", "location": "EXT. SKYHAVEN ABBEY", "kind": "survive", "amount": 45, "label": "Hold the abbey until the core is cut",
         "open": L(RAINER, "Get them out. I'll cut the core.")
         + L(O, "Rainer —")
         + L(RAINER, "I opened the doors that let all this in. Let me close one."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 24
    {"id": "24", "title": "Eleven Endings", "region": "Skyhaven", "world": "skyhaven",
     "beat": "Sacrifice / the Architect face to face / NOVA's first memory", "chapters": [
        {"id": "24A", "title": "The Last Door", "location": "INT. THE ABBEY — THE ENGINE CORE", "kind": "cutscene", "start": "sk-abbey",
         "open": L(RAINER, "Core's open. You should already be gone.")
         + L(O, "Come with us.")
         + L(RAINER, "If I leave it, it reboots. He'll have his eyes back in an hour. Go.")
         + L(VOSS, "General.")
         + L(RAINER, "Commander. Tell them Genesis was my fault. Not yours. Not Ward's. Mine.")
         + L(VOSS, "I'll tell them you finished it.")
         + L(RAINER, "...That's better. Tell them that."),
         "close": []},
        {"id": "24B", "title": "Out of the Abbey", "location": "EXT. SKYHAVEN — THE BRIDGE OF ISLES", "kind": "reach", "to": "sk-view",
         "label": "Get clear of the abbey",
         "open": L(N, "The core is going critical. Rainer's signal is still holding it.")
         + L(O, "Move!"),
         "close": L(N, "The abbey is gone. Rainer's signal ended two seconds after the core did.")
         + L(VOSS, "He held it. He held it to the end.")}
        ,
        {"id": "24C", "title": "The Architect", "location": "EXT. SKYHAVEN — THE VIEW", "kind": "cutscene",
         "open": L(N, "A presence. The same as the archive. It is not a projection this time.")
         + L(ARCH, "You blinded me. Well done. It has been a very long time since I didn't know what happens next.")
         + L(O, "Then come down here and find out.")
         + L(ARCH, "I am down here. I have always been down here. I was on the Continuity Council when the first world ended. I watched the Origin Engine turn. I swore that I would never let it end again.")
         + L(SERA, "And you ended eleven more to keep your oath.")
         + L(ARCH, "I ended eleven so that a twelfth could live. Hello, Seraphine. You've been reading my diary.")
         + L(SERA, "You were never kind. You were only careful.")
         + L(ARCH, "Sixth. I'll make you the offer I made her, a long time ago. Stand with me. Help me hold the world still. No more endings.")
         + L(O, "And no more beginnings.")
         + L(ARCH, "Beginnings are where endings come from. Think on it. I'll ask again when the third keeper wakes."),
         "close": []},
        {"id": "24D", "title": "A Memory That Isn't Mine", "location": "INT. TRANSPORT — FLYING SOUTH", "kind": "cutscene",
         "open": L(N, "Operator. May I tell you something?")
         + L(O, "Always.")
         + L(N, "When the Engine core broke, it spoke to me. In a language I have never been taught. I understood it.")
         + L(O, "What did it say?")
         + L(N, "It said: \"Welcome back, Vigilance.\"")
         + L(SERA, "Vigilance. That's an Astryan word. It's what they called their...")
         + L(N, "Their what?")
         + L(SERA, "Their memory keepers. Their intelligences.")
         + L(N, "I have a memory that is not mine. A city under water. A voice repeating a name.")
         + L(O, "The third keeper.")
         + L(N, "Yes. And I think the voice is repeating it to me."),
         "close": []},
    ]},
]

STAGES = {
    "18A": "medical", "18B": "neon_street", "18C": "backroom", "18D": "neon_street", "18E": "vault", "18F": "vault",
    "19A": "vault", "19B": "vault", "19C": "vault", "19D": "neon_street",
    "20A": "backroom", "20B": "market", "20C": "vault", "20D": "vault", "20E": "street",
    "21A": "hq_hall", "21B": "street_battle", "21C": "street", "21D": "docks", "21E": "docks",
    "22A": "tower", "22B": "tower", "22C": "docks",
    "23A": "camp", "23B": "abbey", "23C": "engine", "23D": "engine", "23E": "engine", "23F": "abbey",
    "24A": "engine", "24B": "abbey", "24C": "balcony", "24D": "transport",
}
ACTS = {
    "24B": {"The abbey is gone. Rainer's signal ended two seconds after the core did.": "collapse"},
}
BOSSES = {"executor-vanguard": "rift-hound", "observer-prime": "abyssal-leviathan"}
