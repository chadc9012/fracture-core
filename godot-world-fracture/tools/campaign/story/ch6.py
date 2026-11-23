"""Chapter 6 — The Broken Covenant, Missions 39–45: the Ascendancy's answer in the Obsidian Reach, Vael Turog in person,
Seraphine's real plan, the fall of Haven-01 and Ward's last stand, the road to the Underground, and the fifth seal found."""
from common import *

CHAPTER = (6, "The Broken Covenant")
TALLIS = "TALLIS"
RAIDER = "RAIDER"

MISSIONS = [
    # =========================================================================================== MISSION 39
    {"id": "39", "title": "Fire on the Reach", "region": "Obsidian Reach — Ember Peaks", "world": "ember",
     "beat": "The Ascendancy's forge / Cipher's past / Crane's protocol", "chapters": [
        {"id": "39A", "title": "Ash", "location": "EXT. OBSIDIAN REACH — THE ASH OUTPOST", "kind": "cutscene", "start": "sp-ash-outpost",
         "open": L(CIPH, "The Ascendancy's forge is in the old Astryan foundry. Crane's been running it day and night since the broadcast.")
         + L(O, "Making what?")
         + L(CIPH, "People. Better ones, he says. The Ascension Protocol was never about weapons. It was about replacing the keepers.")
         + L(GOL, "Replacing them with what?")
         + L(CIPH, "With us. Volunteers who can hold a seal. Made, not born.")
         + L(N, "Cipher's neural resonance is rising the closer we get. Whatever they did to him, it's calling."),
         "close": []},
        {"id": "39B", "title": "The Lava Road", "location": "EXT. OBSIDIAN REACH — THE LAVA ROAD", "kind": "drive", "to": "sp-ancient-forge",
         "label": "Drive the lava road to the foundry",
         "open": L(GOL, "If this road had a personality it would be me before coffee."),
         "close": []},
        {"id": "39C", "title": "The Foundry Gate", "location": "EXT. THE ANCIENT FORGE — THE GATE", "kind": "kills", "amount": 10, "to": "sp-ancient-forge",
         "label": "Break the foundry's guard",
         "open": L(N, "Ascendancy guards. And something with them that moves like Cipher."),
         "close": []},
        {"id": "39D", "title": "The Prefect's Forge", "location": "INT. THE ANCIENT FORGE", "kind": "talk", "who": "CRANE", "to": "sp-ancient-forge",
         "label": "Find Crane in the forge",
         "open": [],
         "close": L(CRANE, "Cipher. You came home. And you brought the sixth. Did you bring my equipment back too?")
         + L(CIPH, "You turned the volunteers into keys.")
         + L(CRANE, "I turned them into hope. The keepers are ancient, half-mad and outnumbered. When Turog kills them, who holds the lock? Your Architect? The Choir?")
         + L(O, "So you build new keepers.")
         + L(CRANE, "I build humanity a seat at the table. For once in its short, frightened life.")
         + L(N, "Operator. A forge chamber just opened. Something walked out of it.")
         + L(CRANE, "Ah. Tallis. My first. My best. He's not finished.")}
        ,
        {"id": "39E", "title": "Tallis", "location": "INT. THE ANCIENT FORGE — THE CHAMBER", "kind": "cutscene",
         "open": L(TALLIS, "Cipher. Brother. You left me in the fire.")
         + L(CIPH, "Tallis. I thought you were dead.")
         + L(TALLIS, "I was. Then I was a door. Now I'm something with a door inside it, and it won't close.")
         + L(CRANE, "Stabilise him! Now!")
         + L(N, "His signature is collapsing into a keeper's pattern. He is trying to hold a seal that doesn't exist.")
         + L(TALLIS, "It hurts, brother. Make it stop."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 40
    {"id": "40", "title": "The Ascension Protocol", "region": "Obsidian Reach — Ember Peaks", "world": "ember",
     "beat": "The forge core / a brother / what Crane learns", "chapters": [
        {"id": "40A", "title": "The Forge Core", "location": "INT. THE ANCIENT FORGE — THE CORE", "kind": "hack", "start": "sp-ancient-forge",
         "label": "Shut the forge core down",
         "open": L(CIPH, "Cut the core and Tallis stops burning. Maybe. I don't know.")
         + L(O, "Maybe's enough."),
         "close": L(N, "The core is down. Tallis's signal is not.")}
        ,
        {"id": "40B", "title": "The Forge Wakes", "location": "INT. THE ANCIENT FORGE", "kind": "survive", "amount": 60, "label": "Hold the forge",
         "open": L(N, "The forge's old guardians are waking. Astryan machines. They think we're Crane's."),
         "close": []},
        {"id": "40C", "title": "The Ascended", "location": "INT. THE ANCIENT FORGE — THE CHAMBER", "kind": "boss", "boss": "ascended",
         "boss_name": "Tallis, the Ascended", "label": "Free Tallis",
         "open": L(TALLIS, "I can't stop. I'm holding everything. Brother, I'm holding everything.")
         + L(CIPH, "Then let go! Tallis, let go!"),
         "close": L(TALLIS, "...it's quiet. Is it quiet?")
         + L(CIPH, "It's quiet.")}
        ,
        {"id": "40D", "title": "What Crane Learned", "location": "INT. THE ANCIENT FORGE", "kind": "cutscene",
         "open": L(CIPH, "He's gone.")
         + L(CRANE, "...")
         + L(O, "Was it worth it?")
         + L(CRANE, "He held a seal-pattern for nine seconds. Nine. No human has ever done that. I've proven it can be done.")
         + L(CIPH, "You proved it kills them.")
         + L(CRANE, "Today. Not forever. That's what science is, Cipher.")
         + L(O, "We're shutting this place down.")
         + L(CRANE, "Go ahead. I've copied everything. And when your keepers die, Operator, and they will, you'll come to me. Everyone comes to me in the end."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 41
    {"id": "41", "title": "The Severant", "region": "Obsidian Reach — Ember Peaks", "world": "ember",
     "beat": "Vael Turog crosses / a fight you cannot win / the fifth keeper's doctrine", "chapters": [
        {"id": "41A", "title": "The Fifth Star Lands", "location": "EXT. OBSIDIAN RIDGE", "kind": "cutscene", "start": "obsidian-ridge",
         "open": L(N, "Operator. The fifth star has reached the centre. A Fracture is opening on the ridge. It is not a tear. It is a door.")
         + L(GOL, "Everybody behind the big rocks.")
         + L(TUROG, "No need to hide. I came to talk. And to take whatever you won't give me."),
         "close": []},
        {"id": "41B", "title": "The Choir's Honour Guard", "location": "EXT. OBSIDIAN RIDGE", "kind": "survive", "amount": 60, "label": "Survive the Choir's guard",
         "open": L(TUROG, "My guard will test you first. It's a courtesy."),
         "close": L(TUROG, "Good. Now me.")}
        ,
        {"id": "41C", "title": "Vael Turog", "location": "EXT. OBSIDIAN RIDGE — THE DOOR", "kind": "boss", "boss": "vael-turog",
         "boss_name": "Vael Turog, the Severant", "label": "Stand against the Severant",
         "open": L(TUROG, "Show me what eleven worlds taught you.")
         + L(O, "That you talk too much."),
         "close": L(TUROG, "Enough. You fight well for someone fighting the wrong war.")
         + L(N, "He isn't hurt. He's stopping because he wants to.")}
        ,
        {"id": "41D", "title": "The Seal of Endings", "location": "EXT. OBSIDIAN RIDGE — THE DOOR", "kind": "cutscene",
         "open": L(TUROG, "Do you know what seal I held, sixth? Ilyra had the song. Auren the roads. The Echo, the listening. The Sovereign, the memory.")
         + L(TUROG, "I held the ending. The right to close a possibility that was only going to suffer. That was my burden. And I carried it kindly.")
         + L(O, "And then I opened the gate.")
         + L(TUROG, "And then you said no possibility should ever be closed. Not by us. Not by anyone. You made my seal a crime.")
         + L(TUROG, "So I went to the ones who still believed in mercy. The Choir. They gave me a voice that could reach every world at once.")
         + L(O, "To erase them.")
         + L(TUROG, "To end them gently. Before they end themselves screaming. I'll take my seal back, sixth. And then I'll close the one possibility I should have closed first. You."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 42
    {"id": "42", "title": "The Broken Covenant", "region": "Old Harrow", "world": "old-harrow",
     "beat": "A secret meeting / Seraphine's plan / the two ways to break the world", "chapters": [
        {"id": "42A", "title": "Neutral Ground", "location": "EXT. OLD HARROW — THE MARKET", "kind": "cutscene", "start": "oh-market",
         "open": L(N, "A message. On my oldest channel again. \"Old Harrow. The cathedral. Come alone. Bring the lamp.\"")
         + L(O, "Seraphine.")
         + L(N, "She called me a lamp. Only the Echo calls me a lamp.")
         + L(O, "Then she wants us to know it's really her."),
         "close": []},
        {"id": "42B", "title": "The Cathedral", "location": "INT. OLD HARROW CATHEDRAL", "kind": "talk", "who": "SERAPHINE", "to": "oh-cathedral",
         "label": "Meet Seraphine in the cathedral",
         "open": [],
         "close": L(SERA, "Hello. You came alone. You never come alone.")
         + L(O, "You never ask.")
         + L(SERA, "I'm asking now. Listen, I have very little time. The Architect isn't keeping the fourth seal asleep. He's gathering all four. He'll take them to the Origin Engine and turn the lock into a wall. Permanent. No gate. No sixth. No Choir.")
         + L(O, "No beginnings.")
         + L(SERA, "Nothing new, ever again. He calls it the Continuity Lock. And Turog wants the opposite: all five seals, the gate thrown open, and the Choir's silence pouring through.")
         + L(O, "Two ways to break the Covenant.")
         + L(SERA, "And you're the third. You always are.")
         + L(O, "Come back with me.")
         + L(SERA, "Not yet. If I leave him now, he'll take the seals from the keepers by force. While he trusts me, he waits.")}
        ,
        {"id": "42C", "title": "Followed", "location": "EXT. OLD HARROW — THE CASTLE ROAD", "kind": "kills", "amount": 9, "to": "oh-castle",
         "label": "Cover Seraphine's way out",
         "open": L(N, "Executors. They followed her.")
         + L(SERA, "Or he sent them to see what I'd do. Make it look real."),
         "close": []},
        {"id": "42D", "title": "What You Did", "location": "EXT. OLD HARROW — THE BRIDGE", "kind": "cutscene",
         "open": L(SERA, "One more thing. You asked me in the vault what I said to you at the gate.")
         + L(SERA, "The rest of it. You opened the gate because Earth was going to be erased by the Choir or starved by the lock. You opened it so the people on this world could choose for themselves what was on the other side.")
         + L(O, "And the Choir came through.")
         + L(SERA, "Some did. And some of the people here met them, and fought them, and some of them talked to them. You gave them a door. That's all. What they did with it was always going to be theirs.")
         + L(SERA, "I couldn't bear it. So I ran to the Architect. And we spent eleven worlds trying to close what you opened.")
         + L(O, "And now?")
         + L(SERA, "Now I think you were right. I'm just very late saying so."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 43
    {"id": "43", "title": "Haven Falls", "region": "Nexus City", "world": "nexus",
     "beat": "Two armies at the walls / Ward's last command / evacuation", "chapters": [
        {"id": "43A", "title": "Both At Once", "location": "INT. HAVEN-01 COMMAND CENTRE", "kind": "cutscene", "start": "nexus-harbor",
         "open": L(WARD, "Choir from the north. Continuum from the south. They're not working together. They're racing.")
         + L(VOSS, "Racing for what?")
         + L(N, "For Ilyra, Auren and the Echo's room inside me. The three keepers in Haven. And for me.")
         + L(WARD, "Then they don't get any of you. Voss, the evacuation. Operator, the walls. I've got the command centre.")
         + L(VOSS, "Director —")
         + L(WARD, "That's an order, Commander. For once in my life let me give one that isn't for sale."),
         "close": []},
        {"id": "43B", "title": "The Walls Again", "location": "HAVEN-01 — THE PERIMETER", "kind": "survive", "amount": 80, "label": "Hold the walls",
         "open": L(GOL, "Same walls. Same mud. Worse odds.")
         + L(NYX, "You love it."),
         "close": L(N, "The northern wall is breaking. Something huge is coming through.")}
        ,
        {"id": "43C", "title": "The Breaker", "location": "HAVEN-01 — THE NORTHERN WALL", "kind": "boss", "boss": "choir-breaker",
         "boss_name": "Choir Breaker", "label": "Stop the Breaker",
         "open": L(N, "A siege construct. Built to break walls and the people behind them."),
         "close": L(N, "It's down. The command centre has stopped answering.")}
        ,
        {"id": "43D", "title": "Last Command", "location": "INT. HAVEN-01 COMMAND CENTRE", "kind": "cutscene",
         "open": L(WARD, "...there you are. Late. As usual.")
         + L(O, "Ward. Hold on.")
         + L(WARD, "I've been holding on. It's very overrated. Did they get out?")
         + L(VOSS, "Every transport's away. Every civilian.")
         + L(WARD, "Good. Good. Voss. You're the Director now. Don't take anyone's money.")
         + L(VOSS, "I won't.")
         + L(WARD, "Liar. Take it when it saves people. Just tell them you took it. That's the only difference between us and them.")
         + L(N, "Her heart has stopped. I'm sorry."),
         "close": []},
        {"id": "43E", "title": "Out of Haven", "location": "EXT. HAVEN-01 — THE HARBOUR GATE", "kind": "reach", "label": "Get out of Haven",
         "open": L(VOSS, "Haven's lost. We go. Now."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 44
    {"id": "44", "title": "Kael's Run", "region": "The Wastelands", "world": "wastelands",
     "beat": "Refugee convoy / raiders turned / the Underground opens its gate", "chapters": [
        {"id": "44A", "title": "Where Now", "location": "EXT. THE WASTELANDS — THE OLD HIGHWAY", "kind": "cutscene", "start": "wl-old-highway",
         "open": L(KAEL, "Eighteen thousand people and nowhere to put them. Except one place.")
         + L(VOSS, "The Underground City. They don't take outsiders.")
         + L(KAEL, "They take me. I've been running fuel to them for six years. They owe me.")
         + L(O, "Enough to take eighteen thousand?")
         + L(KAEL, "We're about to find out."),
         "close": []},
        {"id": "44B", "title": "The Convoy", "location": "EXT. THE OLD HIGHWAY", "kind": "drive", "to": "vault-gate",
         "label": "Lead the convoy to the Underground's gate",
         "open": L(N, "Raider camps along the highway. They are flying Choir colours.")
         + L(KAEL, "The Choir's been recruiting out here. Promising an end to the dust."),
         "close": []},
        {"id": "44C", "title": "Raiders", "location": "EXT. THE VAULT GATE ROAD", "kind": "kills", "amount": 10, "label": "Clear the raiders off the gate road",
         "open": L(RAIDER, "Turn back! The quiet's coming for all of you anyway!")
         + L(KAEL, "Not today it isn't."),
         "close": []},
        {"id": "44D", "title": "The Gate", "location": "EXT. THE VAULT GATE", "kind": "survive", "amount": 60, "label": "Hold the gate while the Underground decides",
         "open": L(KAEL, "They're talking about it in there. Arguing. Hold them off till they're done arguing."),
         "close": L(N, "The gate is opening.")}
        ,
        {"id": "44E", "title": "Underground", "location": "INT. THE UNDERGROUND CITY", "kind": "cutscene",
         "open": L(KAEL, "They'll take them. All of them. Fuel debt's paid in full, they said.")
         + L(VOSS, "Kael. Thank you.")
         + L(KAEL, "Don't thank me. Thank the six years of fuel runs. And the operator who kept walking into things.")
         + L(O, "We need somewhere the keepers can hide.")
         + L(KAEL, "This is somewhere. It's the most somewhere left."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 45
    {"id": "45", "title": "The Fifth Signature", "region": "The Wastelands", "world": "wastelands",
     "beat": "The keepers' council / where the fifth seal is / the Witness shows an ending", "chapters": [
        {"id": "45A", "title": "Council Underground", "location": "INT. THE UNDERGROUND — THE OLD VAULT", "kind": "cutscene", "start": "vault-gate",
         "open": L(ILYRA, "Three of us in one room. It hasn't happened since the sanctuary.")
         + L(AUREN, "And one of us in a lamp.")
         + L(ECHO, "...a warm lamp...")
         + L(N, "Thank you.")
         + L(O, "Four seals restored. The fifth is Turog's.")
         + L(AUREN, "My map says he keeps it in the Shattered Expanse. Where the world is most broken. He likes it there. It agrees with him.")
         + L(ILYRA, "And the Architect has the Sovereign, and through her, the fourth.")
         + L(O, "Seraphine's with us. She's inside his walls.")
         + L(ILYRA, "I believe you. I'm not sure she does."),
         "close": []},
        {"id": "45B", "title": "Triangulate", "location": "EXT. THE WASTELANDS — THE CRATER", "kind": "trace", "to": "wl-crater",
         "label": "Help Auren triangulate the fifth seal",
         "open": L(AUREN, "Three readings. Far apart. The crater, the scrapyard, the dust rose. The map will do the rest."),
         "close": L(AUREN, "There. The Shattered Expanse. A place that's never finished falling.")}
        ,
        {"id": "45C", "title": "The Memory", "location": "EXT. THE WASTELANDS — NIGHT", "kind": "cutscene",
         "open": L(N, "Operator. The Witness. It's here. It's... showing us something.")
         + L(WITNESS, "Observe.")
         + L("MEMORY", "This is world nine. The sixth has remembered everything. The sixth opens the gate fully, alone, in anger.")
         + L("MEMORY", "The Architect locks the world. The Choir pours through the cracks in the lock. Nothing is left that can make a sound.")
         + L(O, "Why show me this?")
         + L(WITNESS, "Because you asked. In world nine. You asked me to show you, if there was a world twelve.")
         + L(O, "Is there?")
         + L(WITNESS, "You are standing in it. Unwritten. Continue."),
         "close": []},
        {"id": "45D", "title": "The Last Night Before", "location": "INT. THE UNDERGROUND — THE OLD VAULT", "kind": "cutscene",
         "open": L(VOSS, "So. The Shattered Expanse. A demigod with a seal of endings. An Architect with a wall.")
         + L(GOL, "And us.")
         + L(NYX, "We've had worse odds.")
         + L(GOL, "We have not had worse odds.")
         + L(CIPH, "Tallis would have liked this. All of us in one room, arguing.")
         + L(O, "Get some sleep. We go at dawn.")
         + L(N, "Operator. Before the Expanse... the Architect will go to the Origin Engine. If he locks the world before we reach Turog, it won't matter who has the fifth seal.")
         + L(O, "Then we go to the Engine first."),
         "close": []},
    ]},
]

STAGES = {
    "39A": "lava_camp", "39B": "lava_camp", "39C": "forge", "39D": "forge", "39E": "forge",
    "40A": "forge", "40B": "forge", "40C": "forge", "40D": "forge",
    "41A": "ridge", "41B": "ridge", "41C": "ridge", "41D": "ridge",
    "42A": "harrow", "42B": "cathedral", "42C": "harrow", "42D": "harrow",
    "43A": "command_post", "43B": "haven", "43C": "haven", "43D": "command_post", "43E": "haven",
    "44A": "wasteland", "44B": "wasteland", "44C": "wasteland", "44D": "vault_gate", "44E": "underground",
    "45A": "underground", "45B": "wasteland", "45C": "wasteland", "45D": "underground",
}
ACTS = {}
BOSSES = {"ascended": "crystal-stalker", "vael-turog": "astravore", "choir-breaker": "colossus"}
