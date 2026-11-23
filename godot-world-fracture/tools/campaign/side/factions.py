"""Faction missions: four for each side of Mission 5's choice — the Frontier Defense Initiative, the Free Operators and
the Ascendancy. A faction's missions open after Mission 5 for whoever stood with it (`a05_choice`), and after Mission 8
for everyone (the alliance is broken; everyone works for everyone)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "story"))
from common import *

CATEGORY = "faction"
SGT = "SERGEANT IMANI"
RADIO = "MILITARY RADIO"
MEDIC = "MEDIC"
RESEARCHER = "RESEARCHER LUNE"
FREE = "FREE OPERATOR"
DJ = "RADIO FREE NEXUS"
VESPER = "VESPER"

MISSIONS = [
    # ------------------------------------------------------------------------------------- Frontier Defense Initiative
    {"id": "F01", "title": "Perimeter", "faction": "fdi", "giver": "VOSS", "region": "Nexus City", "world": "nexus", "after": "05",
     "beat": "Hold a failing outpost on the city's edge", "chapters": [
        {"id": "F01A", "title": "Outpost Nine", "location": "EXT. NEXUS — OUTPOST NINE", "kind": "talk", "who": "SERGEANT IMANI", "start": "nexus-bastion",
         "label": "Report to Outpost Nine",
         "open": L(VOSS, "Outpost Nine's been calling for relief for two days. I've got nobody to send but you."),
         "close": L(SGT, "You're the relief? One of you?")
         + L(O, "One of me.")
         + L(SGT, "...I've heard about you. Fine. Wall's that way. They come at sundown.")},
        {"id": "F01B", "title": "Sundown", "location": "EXT. OUTPOST NINE — THE WALL", "kind": "survive", "amount": 60, "label": "Hold the outpost through sundown",
         "open": L(SGT, "Here they come. Same time every night. They're punctual, I'll give them that."),
         "close": L(SGT, "Still standing. All of us. First time in a week.")
         + L(SGT, "Tell Voss Outpost Nine says thank you. And that we want more coffee.")},
    ]},
    {"id": "F02", "title": "Recall", "faction": "fdi", "giver": "VOSS", "region": "Verdant Forest", "world": "veridan", "after": "05",
     "beat": "A lost FDI squad in the forest", "chapters": [
        {"id": "F02A", "title": "Last Signal", "location": "EXT. VERDANT FOREST — THE VANGUARD OUTPOST", "kind": "cutscene", "start": "vanguard-outpost",
         "open": L(RADIO, "...this is Kestrel Squad... we're pinned in the grotto... something in the walls... please...")
         + L(N, "That transmission is eleven hours old.")
         + L(O, "Then we're eleven hours late."),
         "close": []},
        {"id": "F02B", "title": "The Grotto", "location": "INT. THE GROTTO", "kind": "kills", "amount": 8, "to": "vf-grotto", "label": "Reach Kestrel Squad",
         "open": L(N, "Survivor signatures. Four. Weak."),
         "close": L(SGT, "...you came. We'd stopped expecting anyone.")
         + L(O, "Frontier Defense doesn't leave people.")
         + L(SGT, "Since when?")
         + L(O, "Since today.")},
    ]},
    {"id": "F03", "title": "Supply Lines", "faction": "fdi", "giver": "VOSS", "region": "Nexus City", "world": "nexus", "after": "08",
     "beat": "Escort a medical convoy across the city", "chapters": [
        {"id": "F03A", "title": "The Convoy", "location": "EXT. NEXUS — THE DRIVE HUB", "kind": "drive", "to": "nexus-harbor", "start": "nexus-drive-hub",
         "label": "Lead the medical convoy to Haven",
         "open": L(VOSS, "Six trucks. Medicine, blood, surgical kits. Haven's out of all of it. Get them there."),
         "close": L(MEDIC, "Every truck? You got every truck through?")
         + L(O, "Every truck.")
         + L(MEDIC, "I could kiss you. I won't. I've been awake for forty hours.")},
    ]},
    {"id": "F04", "title": "The Iron Line", "faction": "fdi", "giver": "VOSS", "region": "Nexus City", "world": "nexus", "after": "13",
     "beat": "A Fracture brute is tearing through the eastern defences", "chapters": [
        {"id": "F04A", "title": "Breakthrough", "location": "EXT. NEXUS — THE EASTERN LINE", "kind": "cutscene", "start": "nexus-university",
         "open": L(RADIO, "Eastern line is breaking! Something big! Rounds aren't stopping it!")
         + L(VOSS, "Operator. The Iron Line. If it falls, the university district falls with it."),
         "close": []},
        {"id": "F04B", "title": "The Brute", "location": "EXT. THE EASTERN LINE", "kind": "boss", "boss": "iron-brute", "boss_name": "Iron-Breaker Brute",
         "label": "Stop the brute",
         "open": L(N, "Armoured. Fast for its size. Its joints are its weakness."),
         "close": L(SGT, "The line holds! The line holds!")
         + L(VOSS, "Good work. The Initiative won't forget it.")
         + L(N, "He said that very sincerely.")},
    ]},
    # ------------------------------------------------------------------------------------- Free Operators
    {"id": "F05", "title": "No Masters", "faction": "free", "giver": "KAEL", "region": "Nexus City", "world": "nexus", "after": "05",
     "beat": "Civilians trapped behind a Choir line", "chapters": [
        {"id": "F05A", "title": "The Western Blocks", "location": "EXT. NEXUS — THE WESTERN BLOCKS", "kind": "talk", "who": "FREE OPERATOR", "start": "nexus-mall",
         "label": "Meet Kael's spotter",
         "open": L(KAEL, "Forty civilians in a parking garage. The military wrote them off. We don't write people off."),
         "close": L(FREE, "Choir constructs on every exit. They're just... waiting. Like they want the people to come out.")
         + L(O, "Then we make them come to us.")},
        {"id": "F05B", "title": "The Garage", "location": "INT. A PARKING GARAGE", "kind": "kills", "amount": 9, "label": "Clear the exits",
         "open": L(FREE, "Loud and fast. That's how we do it."),
         "close": L(KAEL, "Forty in, forty out. That's a good day.")
         + L(O, "Do you get many good days?")
         + L(KAEL, "Enough to keep going. That's all you need.")},
    ]},
    {"id": "F06", "title": "Black Market Medicine", "faction": "free", "giver": "KAEL", "region": "Neon City", "world": "neon-city", "after": "05",
     "beat": "Buy back stolen medicine from a Neon fence", "chapters": [
        {"id": "F06A", "title": "Vesper's Price", "location": "INT. THE UNDERGROUND", "kind": "talk", "who": "VESPER", "start": "neon-underground", "to": "neon-underground",
         "label": "Ask Vesper about the stolen medicine",
         "open": L(KAEL, "Someone stole a whole Free Operator clinic. It's for sale in Neon. I want it back."),
         "close": L(VESPER, "The clinic? Yes. It's in a container under the cyan loop. The sellers are... enthusiastic.")
         + L(O, "How enthusiastic?")
         + L(VESPER, "Armed. Very.")},
        {"id": "F06B", "title": "The Container", "location": "EXT. NEON — UNDER THE CYAN LOOP", "kind": "kills", "amount": 8, "label": "Take back the clinic",
         "open": L(N, "Twelve sellers. One container. I'll keep the price low."),
         "close": L(KAEL, "Back where it belongs. Tell Vesper she gets a crate of antibiotics for the tip. She'll sell it. She always sells it.")},
    ]},
    {"id": "F07", "title": "Radio Free Nexus", "faction": "free", "giver": "KAEL", "region": "Nexus City", "world": "nexus", "after": "08",
     "beat": "Put a free radio relay up on the old towers", "chapters": [
        {"id": "F07A", "title": "Three Towers", "location": "EXT. NEXUS — THE RELAY TOWERS", "kind": "trace", "start": "nexus-central-plaza",
         "label": "Raise the relay on three towers",
         "open": L(KAEL, "The broadcast only tells people what governments want them to hear. Let's give them something else."),
         "close": L(DJ, "This is Radio Free Nexus. If you can hear this, you're not alone. Water at the harbour. Shelter at Haven. Nobody's coming to save you, so we came instead.")
         + L(KAEL, "Good, isn't it?")
         + L(O, "It's good.")},
    ]},
    {"id": "F08", "title": "Hunter's Moon", "faction": "free", "giver": "NYX", "region": "Swamps", "world": "swamps", "after": "12",
     "beat": "A Fracture predator is taking airboat crews", "chapters": [
        {"id": "F08A", "title": "The Ferry", "location": "EXT. THE SWAMPS — THE AIRBOAT HUB", "kind": "talk", "who": "FREE OPERATOR", "start": "airboat-hub",
         "label": "Talk to the airboat crews",
         "open": L(NYX, "Three crews gone in a week. Something in the mangroves. Kael asked me. I'm asking you."),
         "close": L(FREE, "It hunts under the full moon. Takes the last boat in line. Every time.")
         + L(NYX, "Then we'll be the last boat.")},
        {"id": "F08B", "title": "The Last Boat", "location": "EXT. THE MANGROVE MAZE", "kind": "boss", "boss": "mangrove-stalker", "boss_name": "The Mangrove Stalker",
         "to": "ss-mangrove-maze", "label": "Hunt the hunter",
         "open": L(NYX, "Corner of your eye. Always."),
         "close": L(NYX, "Moon's still up. Nobody else gets taken tonight.")},
    ]},
    # ------------------------------------------------------------------------------------- the Ascendancy
    {"id": "F09", "title": "Samples", "faction": "ascendancy", "giver": "CRANE", "region": "Crystal Badlands", "world": "crystal-badlands", "after": "05",
     "beat": "Collect Fracture crystal for the Ascendancy's research", "chapters": [
        {"id": "F09A", "title": "The Prism Fields", "location": "EXT. CRYSTAL BADLANDS — THE PRISM FIELDS", "kind": "talk", "who": "RESEARCHER LUNE", "start": "cb-rest",
         "to": "cb-prism", "label": "Meet the Ascendancy researcher",
         "open": L(CRANE, "We need living crystal. Not shards. Growing samples. Dr. Lune will show you."),
         "close": L(RESEARCHER, "The crystal grows toward people. It's attracted to thought. Your thought will be very attractive.")
         + L(O, "Is that a compliment?")
         + L(RESEARCHER, "It's a warning.")},
        {"id": "F09B", "title": "Harvest", "location": "EXT. THE PRISM FIELDS", "kind": "trace", "label": "Harvest three growing samples",
         "open": L(RESEARCHER, "Gently. It bites."),
         "close": L(RESEARCHER, "Three living samples. The Prefect will be thrilled. He's never thrilled. He'll be thrilled.")},
    ]},
    {"id": "F10", "title": "Containment", "faction": "ascendancy", "giver": "CRANE", "region": "Nexus City", "world": "nexus", "after": "05",
     "beat": "A breach in the Ascendancy's tower labs", "chapters": [
        {"id": "F10A", "title": "Breach", "location": "INT. ASCENDANCY TOWER — LAB FLOOR 12", "kind": "survive", "amount": 50, "start": "nexus-university",
         "label": "Contain the lab breach",
         "open": L(CRANE, "Floor twelve. A sample got out. It's... learning. Contain it before it learns the stairs."),
         "close": L(RESEARCHER, "Contained. Mostly. It learned to open doors.")
         + L(O, "Mostly?")
         + L(RESEARCHER, "It's in a jar. A very big jar.")},
    ]},
    {"id": "F11", "title": "Volunteers", "faction": "ascendancy", "giver": "RESEARCHER LUNE", "region": "Nexus City", "world": "nexus", "after": "08",
     "beat": "A volunteer wants out of the program", "chapters": [
        {"id": "F11A", "title": "A Note", "location": "INT. ASCENDANCY TOWER", "kind": "talk", "who": "RESEARCHER LUNE", "start": "nexus-university", "to": "nexus-university",
         "label": "Answer Lune's note",
         "open": [],
         "close": L(RESEARCHER, "Subject forty-one wants to leave the program. Crane says he signed a contract. He was dying when he signed it.")
         + L(O, "What do you want me to do?")
         + L(RESEARCHER, "Get him out. I'll lose my job. I don't care anymore.")},
        {"id": "F11B", "title": "Walk Out", "location": "INT. ASCENDANCY TOWER — THE CELLS", "kind": "reach", "label": "Walk Subject Forty-One out of the tower",
         "open": L(N, "Guards on every floor. They haven't been told. Walk calmly.")
         + L(O, "I'm always calm."),
         "close": L(RESEARCHER, "He's out. His name is Tomas, by the way. Not forty-one. Tomas.")
         + L(N, "I have updated my records.")},
    ]},
    {"id": "F12", "title": "The Spire's Shield", "faction": "ascendancy", "giver": "CRANE", "region": "Nexus City", "world": "nexus", "after": "13",
     "beat": "Turn on the Ascendancy's shield over the eastern districts", "chapters": [
        {"id": "F12A", "title": "Three Pylons", "location": "EXT. NEXUS — THE EASTERN DISTRICTS", "kind": "trace", "start": "nexus-university",
         "label": "Power the three shield pylons",
         "open": L(CRANE, "A shield. Over twelve blocks. Not just the Spire. Don't look so surprised. I can be generous when it's good publicity."),
         "close": L(N, "Shield up. Twelve blocks under it. Thirty thousand people.")
         + L(CRANE, "There. Now they'll think I'm nice.")
         + L(O, "Are you?")
         + L(CRANE, "I'm effective. Some days that looks the same.")},
    ]},
]
