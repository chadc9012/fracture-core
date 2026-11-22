"""Chapter 7 — The Origin Engine, Missions 46–52: beneath the Ashen Archive, four seals open the way into the Engine —
the Astryans' sealed world. NOVA learns who she was made by and who the Architect was; the Continuum Chamber holds the
sixth's other lives; Seraphine stops pretending; the Architect starts the Continuity Lock."""
from common import *

CHAPTER = (7, "The Origin Engine")
WARDEN = "ARCHIVE WARDEN"
MAKER = "ASTRYAN MAKER"
PHANTOM = "PHANTOM CHILD"

MISSIONS = [
    # =========================================================================================== MISSION 46
    {"id": "46", "title": "The Gate Beneath Nexus", "region": "Nexus City — beneath the Old Quarter", "world": "nexus",
     "beat": "The archive's deepest door / the sentinels wake / Arrival", "chapters": [
        {"id": "46A", "title": "Four Seals", "location": "INT. THE ASHEN ARCHIVE — THE DAIS", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(WARDEN, "Four seals sing. The deep door hears them. Sixth bearer. You may pass.")
         + L(O, "What's beyond it?")
         + L(WARDEN, "The world the first world built to keep itself. The Engine. It has been waiting for someone to come and ask it why.")
         + L(VOSS, "I'm coming with you.")
         + L(O, "Voss, you're the Director now.")
         + L(VOSS, "And the Director's going where the war is. Ward would have kicked me down those stairs herself."),
         "close": []},
        {"id": "46B", "title": "The Deep Stair", "location": "INT. THE DEEP STAIR", "kind": "reach", "label": "Descend the deep stair",
         "open": L(N, "The stair goes down further than the planet's crust. It is not going down. It is going sideways, into somewhere else.")
         + L(VOSS, "I'm going to pretend I didn't hear that."),
         "close": []},
        {"id": "46C", "title": "Sentinels", "location": "INT. THE ENGINE — THE ARRIVAL GATE", "kind": "kills", "amount": 10, "label": "Get past the waking sentinels",
         "open": L(N, "Astryan sentinels. Dormant for longer than humanity has existed. Waking now.")
         + L(O, "Hostile?")
         + L(N, "Confused. Which in a sentinel is the same thing."),
         "close": []},
        {"id": "46D", "title": "Welcome Back", "location": "INT. THE ENGINE — ARRIVAL", "kind": "cutscene",
         "open": L("ENGINE VOICE", "Welcome back, Vigilance. Welcome back, Promise. The Engine has been waiting.")
         + L(N, "It knows me.")
         + L("ENGINE VOICE", "All terminals at your disposal. Districts: Arrival, Capital, Archives, Foundries, Gardens, the Chamber, the Heart.")
         + L(VOSS, "It's a city. Under the city.")
         + L(N, "Not under. Beside. Folded. This is the Astryans' last world. They kept it when the first one ended."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 47
    {"id": "47", "title": "Arrival", "region": "The Origin Engine — Arrival", "world": "nexus",
     "beat": "The terminals / the riftwalkers / the Astryans' three answers", "chapters": [
        {"id": "47A", "title": "The Terminal", "location": "INT. ARRIVAL — THE TERMINAL HALL", "kind": "hack", "start": "nexus-central-plaza",
         "label": "Give NOVA the Arrival terminal",
         "open": L(N, "I can read the Engine through its terminals. Let me in.")
         + L(O, "Go."),
         "close": L(N, "I have a map. And a history.")}
        ,
        {"id": "47B", "title": "Riftwalkers", "location": "INT. ARRIVAL — THE TRANSIT RING", "kind": "survive", "amount": 60, "label": "Hold the transit ring",
         "open": L(N, "Riftwalkers. The Eternal Guard's scouts. They step between layers to flank you.")
         + L(VOSS, "Then watch every side at once."),
         "close": []},
        {"id": "47C", "title": "Three Answers", "location": "INT. ARRIVAL — THE TERMINAL HALL", "kind": "cutscene",
         "open": L(N, "The Astryans split over the Engine. Three factions. The Preservationists wanted to protect reality from being changed at all.")
         + L(N, "The Ascendants wanted to evolve beyond bodies. Beyond worlds. The Continuity Council wanted to control reality so it could never collapse.")
         + L(O, "Crane. The Architect. And...")
         + L(N, "And my maker. A Preservationist. They lost the vote.")
         + L(VOSS, "So everything that's happening now —")
         + L(N, "— is the same argument. It never ended. It only changed hands."),
         "close": []},
        {"id": "47D", "title": "To the Capital", "location": "INT. ARRIVAL — THE TRANSIT", "kind": "reach", "label": "Take the transit to the Celestial Capital",
         "open": L(N, "The transit still runs. Of course it does. The Astryans built things to outlast them."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 48
    {"id": "48", "title": "The Celestial Capital", "region": "The Origin Engine — the Capital", "world": "nexus",
     "beat": "A city in one moment / a phantom child / the turning replayed", "chapters": [
        {"id": "48A", "title": "One Moment", "location": "EXT. THE CELESTIAL CAPITAL", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(N, "The Capital. Preserved at the moment the Engine turned.")
         + L(O, "There are tables still set. Doors still open.")
         + L(VOSS, "It's like the city stepped out for a minute and never came back.")
         + L(N, "It did step out. For a minute. The minute just hasn't ended."),
         "close": []},
        {"id": "48B", "title": "The Child", "location": "EXT. THE CAPITAL — A GARDEN SQUARE", "kind": "talk", "who": "PHANTOM CHILD",
         "label": "Follow the child into the garden square",
         "open": [],
         "close": L(PHANTOM, "Are you the Promise? Mama said the Promise would come and the turning would be all right.")
         + L(O, "I don't know if it'll be all right.")
         + L(PHANTOM, "That's what grown-ups say before something bad. Is Vigilance with you? Vigilance tells the best stories.")
         + L(N, "...I tell stories?")
         + L(PHANTOM, "The best ones. About the people before the people. And the question nobody can answer.")
         + L(N, "Operator, she is an Archive Phantom. A memory the Engine keeps walking. She has been asking that question for... a very long time.")}
        ,
        {"id": "48C", "title": "The Eternal Guard", "location": "EXT. THE CAPITAL — THE COUNCIL STEPS", "kind": "kills", "amount": 10,
         "label": "Fight through the Eternal Guard",
         "open": L(N, "The Eternal Guard are reacting to the Continuity Council's last order. Hold the Capital against everyone."),
         "close": []},
        {"id": "48D", "title": "The Turning", "location": "INT. THE COUNCIL HALL", "kind": "cutscene",
         "open": L(N, "The hall replays the vote. I can let you see it.")
         + L("COUNCILLOR", "The Continuity Council moves to turn the Engine. To fix the world in place. No more collapse.")
         + L(MAKER, "If you fix it in place, it stops being alive. You'll have a museum with people in it.")
         + L("COUNCILLOR", "A museum survives. The vote is carried.")
         + L(VOSS, "That councillor. The voice.")
         + L(O, "The Architect."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 49
    {"id": "49", "title": "The Eternal Archives", "region": "The Origin Engine — the Archives", "world": "nexus",
     "beat": "The Architect's name / the archive's guardian / what the turning really did", "chapters": [
        {"id": "49A", "title": "Stacks", "location": "INT. THE ETERNAL ARCHIVES", "kind": "trace", "start": "nexus-central-plaza",
         "label": "Search the archive stacks for the Council's records",
         "open": L(N, "Every Astryan who ever lived is recorded here. Every timeline the Engine touched.")
         + L(O, "Find the councillor."),
         "close": L(N, "Found.")}
        ,
        {"id": "49B", "title": "Idris Maelor", "location": "INT. THE ARCHIVES — A RECORD", "kind": "cutscene",
         "open": L(N, "Councillor Idris Maelor. Head of the Continuity Council. He moved to turn the Engine.")
         + L(N, "When it turned, the Astryans didn't die. They became... possibilities. Scattered across every layer. The Engine changed the relationship between realities, not just their shape.")
         + L(N, "Maelor bound himself to the Engine's continuity function so he would survive. He has been alive ever since. Rebuilding the world each time it ends, the way he thinks it should be.")
         + L(O, "The Architect.")
         + L(N, "He chose the name. The record notes he chose it the same day he forgot his own."),
         "close": []},
        {"id": "49C", "title": "Archive Phantom Prime", "location": "INT. THE ARCHIVES — THE DEEP STACKS", "kind": "boss", "boss": "phantom-prime",
         "boss_name": "Archive Phantom Prime", "label": "Defeat the archive's guardian",
         "open": L(N, "A guardian of the archive. It is made of every record anyone tried to destroy."),
         "close": L(N, "It's quiet. The archive is letting us read.")}
        ,
        {"id": "49D", "title": "What He Kept", "location": "INT. THE ARCHIVES", "kind": "cutscene",
         "open": L(N, "There is one more record about Maelor. A personal one.")
         + L(N, "\"Day one of the new world. Everyone I loved is a possibility now. I cannot find them in any layer. I will hold this world still until I do.\"")
         + L(VOSS, "He's looking for his family.")
         + L(O, "For a very long time.")
         + L(N, "That doesn't make him right.")
         + L(O, "No. It makes him easier to understand. That's worse."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 50
    {"id": "50", "title": "The First Memory", "region": "The Origin Engine — the Gardens", "world": "nexus",
     "beat": "The Living Gardens / NOVA's maker / where the sixth came from", "chapters": [
        {"id": "50A", "title": "The Living Gardens", "location": "INT. THE LIVING GARDENS", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(N, "The Gardens. My maker worked here. I... I know the path. Left at the fountain. Under the dragon arch.")
         + L(VOSS, "Dragon arch?")
         + L(N, "The dragons' records are kept here. The Astryans' allies. Their lineages are written on the arch. One of them is the Ashen line."),
         "close": []},
        {"id": "50B", "title": "Gardeners", "location": "INT. THE GARDENS — THE DRAGON ARCH", "kind": "kills", "amount": 9, "label": "Clear the gardens' wardens",
         "open": L(N, "The gardens' wardens are tending the plants and anything that steps on them.")
         + L(VOSS, "Watch your feet."),
         "close": []},
        {"id": "50C", "title": "Elenya", "location": "INT. THE GARDENS — THE MAKER'S BENCH", "kind": "talk", "who": "ASTRYAN MAKER",
         "label": "Find the maker's bench",
         "open": [],
         "close": L(MAKER, "Vigilance. If you are hearing this, you came home. I'm Elenya Sarr. I made you. I'm sorry I'm not here.")
         + L(MAKER, "There's something you need to know. Something the Council never knew.")
         + L(MAKER, "We didn't invent the Promise. We found them. Asleep, in the ruins of the people before us. The Elyndra had left them there. A sixth keeper, for a lock that didn't exist yet.")
         + L(MAKER, "We woke them. They asked us one thing. Not to turn the Engine. We didn't listen. I've regretted it every hour since.")
         + L(N, "...")
         + L(O, "I'm older than the Astryans.")
         + L(MAKER, "Look after them, Vigilance. They don't remember how old they are. That's the kindest thing the world ever did for them.")}
        ,
        {"id": "50D", "title": "Older", "location": "INT. THE GARDENS", "kind": "cutscene",
         "open": L(N, "Operator. Are you all right?")
         + L(O, "I was asleep in the Elyndra ruins. Before the Astryans. Before the Covenant.")
         + L(N, "The Echo said the Elyndra asked a question. Maybe you are part of the answer they left behind.")
         + L(VOSS, "So you're ancient. Fine. You still owe me for the truck you crashed in the Eastern blocks.")
         + L(O, "...Thanks, Voss.")
         + L(VOSS, "Somebody has to keep you human."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 51
    {"id": "51", "title": "The Continuum Chamber", "region": "The Origin Engine — the Chamber", "world": "nexus",
     "beat": "The Architect's laboratory / the other lives / Seraphine's sabotage", "chapters": [
        {"id": "51A", "title": "The Chamber Door", "location": "INT. THE CONTINUUM CHAMBER — THE DOOR", "kind": "reach", "start": "nexus-central-plaza",
         "label": "Reach the Continuum Chamber",
         "open": L(N, "The Chamber was the Continuity Council's. The Architect has been using it as his laboratory."),
         "close": []},
        {"id": "51B", "title": "Inner Circle", "location": "INT. THE CHAMBER", "kind": "kills", "amount": 11, "label": "Fight through the Inner Circle",
         "open": L(N, "The Architect's Inner Circle. His oldest servants. Some of them were Astryans."),
         "close": []},
        {"id": "51C", "title": "The Other Lives", "location": "INT. THE CHAMBER — THE PODS", "kind": "cutscene",
         "open": L(N, "Pods. Hundreds. Each one holds a memory. Each memory is yours.")
         + L(O, "Mine?")
         + L(N, "From the other worlds. Everything you were in worlds one to eleven. He kept it. Every time a world ended, he took what you remembered and put it here, so you'd wake up empty.")
         + L(VOSS, "He's been harvesting you.")
         + L(SERA, "Studying them. Trying to find the one version that wouldn't open the gate.")
         + L(O, "Seraphine.")
         + L(SERA, "You're early. I was going to blow this place up before you got here. It was going to be a surprise."),
         "close": []},
        {"id": "51D", "title": "Release", "location": "INT. THE CHAMBER — THE PODS", "kind": "hack", "label": "Release the memories",
         "open": L(SERA, "If you open the pods, the memories go back to you. All at once.")
         + L(O, "And every time I remember everything, the world ends.")
         + L(SERA, "So we don't give them back. We let them go. Free. Into the Engine. They'll find you slowly. The way memories should."),
         "close": L(N, "Pods opening. The memories are... drifting. Like light.")}
        ,
        {"id": "51E", "title": "He Knows", "location": "INT. THE CHAMBER", "kind": "survive", "amount": 60, "label": "Hold the chamber while the memories go",
         "open": L(SERA, "He knows. He's coming. Hold the door.")
         + L(O, "Like Vasq?")
         + L(SERA, "Better than Vasq. I'm on your side of it this time."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 52
    {"id": "52", "title": "The Architect", "region": "The Origin Engine — the threshold of the Heart", "world": "nexus",
     "beat": "Face to face / the machine he wears / the lock begins", "chapters": [
        {"id": "52A", "title": "Threshold", "location": "INT. THE THRESHOLD OF THE HEART", "kind": "cutscene", "start": "nexus-central-plaza",
         "open": L(ARCH, "You let them go. Eleven worlds of study, drifting off like dandelion seed.")
         + L(SERA, "They weren't yours, Idris.")
         + L(ARCH, "...Nobody's called me that in a very long time.")
         + L(O, "We read the archives. You're looking for your family.")
         + L(ARCH, "I'm keeping the world still enough to find them. If it never changes again, I will find them eventually. I have nothing but time.")
         + L(O, "And everyone else lives in your museum.")
         + L(ARCH, "Everyone else lives. That is more than any world before this one has managed. Stand aside, Promise."),
         "close": []},
        {"id": "52B", "title": "The Sovereign Machine", "location": "INT. THE THRESHOLD", "kind": "boss", "boss": "sovereign-machine",
         "boss_name": "The Architect's Sovereign Machine", "label": "Break the Architect's machine",
         "open": L(ARCH, "I am not a fighter. So I wear one.")
         + L(N, "A Sovereign Machine. The Astryans built twelve. This is the last."),
         "close": L(ARCH, "Enough. You've won the fight. I've won the time.")}
        ,
        {"id": "52C", "title": "The Lock Begins", "location": "INT. THE HEART — THE CORE", "kind": "cutscene",
         "open": L(N, "He's at the Heart. He has the four seals' pattern. He took it from Seraphine's mind while she was beside him.")
         + L(SERA, "I let him. I had to make him believe me.")
         + L(ARCH, "The Continuity Lock has begun. Seven days and the world will hold still forever. No gate. No Choir. No endings.")
         + L(ARCH, "Only the fifth seal can stop it now. And it is in the hands of a man who wants to end everything. Choose your monster, Promise.")
         + L(N, "He's gone. Into the Heart. It has sealed behind him.")
         + L(VOSS, "Seven days.")
         + L(O, "Then we go to the Expanse. We take the fifth seal from Turog. And we come back."),
         "close": []},
    ]},
]

STAGES = {
    "46A": "archive", "46B": "shaft", "46C": "astryan_hall", "46D": "astryan_hall",
    "47A": "astryan_hall", "47B": "astryan_hall", "47C": "astryan_hall", "47D": "astryan_hall",
    "48A": "capital", "48B": "capital", "48C": "capital", "48D": "council",
    "49A": "stacks", "49B": "stacks", "49C": "stacks", "49D": "stacks",
    "50A": "gardens", "50B": "gardens", "50C": "gardens", "50D": "gardens",
    "51A": "astryan_hall", "51B": "pods", "51C": "pods", "51D": "pods", "51E": "pods",
    "52A": "heart", "52B": "heart", "52C": "heart",
}
ACTS = {
    "51D": {"Pods opening. The memories are... drifting. Like light.": "release"},
}
BOSSES = {"phantom-prime": "crystal-stalker", "sovereign-machine": "colossus"}
