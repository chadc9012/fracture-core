"""Character quests: the people of the main story, one quest each (more to come). Each unlocks after a main mission
(`after`) and, where the story takes the person away, closes when the main story passes `until`."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "story"))
from common import *

CATEGORY = "character"
ODA = "CHIEF ODA"
TRADER = "TRADER"
MOM = "MRS. REYES"
MOTHER = "ANNA VOLK"
DAD = "MAN"
DADMAN = DAD

MISSIONS = [
    {"id": "C01", "title": "The Boy from the Bus", "giver": "DANIEL", "region": "Nexus City", "world": "nexus", "after": "06",
     "beat": "Daniel's father needs medicine the evacuation centre ran out of", "chapters": [
        {"id": "C01A", "title": "A Drawing", "location": "EXT. HAVEN-01 — THE TENTS", "kind": "talk", "who": "DANIEL", "start": "nexus-harbor",
         "label": "Find Daniel in the tents",
         "open": L(N, "A child has been asking every soldier in Haven-01 for the person who lifted the bus.")
         + L(O, "Daniel."),
         "close": L(DANIEL, "You came! I drew you. That's you, and that's the bus, and that's the monster. The monster's smaller than it was because you won.")
         + L(O, "It's a good drawing. How's your dad?")
         + L(DANIEL, "His leg's bad. The medic said he needs pills they don't have. They said the old pharmacy in the Eastern blocks might have some. But it's got things in it now.")
         + L(O, "Then I'll go and get them.")
         + L(DANIEL, "Promise?")
         + L(O, "Promise.")
         + L(N, "You use that word very easily, for someone it is a title for.")},
        {"id": "C01B", "title": "The Old Pharmacy", "location": "INT. EASTERN BLOCKS — THE PHARMACY", "kind": "kills", "amount": 6,
         "label": "Clear the pharmacy",
         "open": L(N, "Fracture growths on the shelves. And things living in them."),
         "close": L(N, "Medicine located. Antibiotics, painkillers. Enough for his leg and three other patients.")},
        {"id": "C01C", "title": "Delivered", "location": "EXT. HAVEN-01 — THE TENTS", "kind": "talk", "who": "DANIEL", "to": "nexus-harbor",
         "label": "Bring the medicine to Daniel",
         "open": [],
         "close": L(DADMAN, "You're the one. From the bus. He hasn't stopped talking about you.")
         + L(O, "He's brave. He stayed where I told him.")
         + L(DADMAN, "He's never done what anyone told him in his life. Thank you.")
         + L(DANIEL, "Here. You can keep the drawing. So you remember you won.")},
    ]},
    {"id": "C02", "title": "Old Funerals", "giver": "VOSS", "region": "Nexus City", "world": "nexus", "after": "13",
     "beat": "Voss goes to the graves of the men he buried twice", "chapters": [
        {"id": "C02A", "title": "Two Names", "location": "INT. FRONTIER DEFENSE HEADQUARTERS", "kind": "talk", "who": "VOSS", "to": "nexus-bastion", "start": "nexus-bastion",
         "label": "Find Voss",
         "open": [],
         "close": L(VOSS, "Hale and Brennan. The two Executors in Lab Three. I carried Hale's coffin. Brennan's wife sent me a card every Christmas.")
         + L(O, "You want to see the graves.")
         + L(VOSS, "I want to see if there's anyone in them.")},
        {"id": "C02B", "title": "Veterans' Hill", "location": "EXT. NEXUS — VETERANS' HILL", "kind": "reach", "label": "Walk Voss to the hill",
         "open": L(N, "The cemetery's records were altered three years ago. By an Observer account."),
         "close": L(VOSS, "Empty. Both of them. They buried sandbags and gave me a flag.")},
        {"id": "C02C", "title": "Mourners", "location": "EXT. VETERANS' HILL", "kind": "kills", "amount": 7, "label": "Fight off the Executors who followed you",
         "open": L(N, "Executors. They monitor the graves of everyone they take.")
         + L(VOSS, "Of course they do."),
         "close": L(VOSS, "Brennan's wife still lives in the Western blocks. I'm going to tell her. The truth. Even if it's worse.")
         + L(O, "Want company?")
         + L(VOSS, "No. This one's mine. But thanks.")},
    ]},
    {"id": "C03", "title": "Fuel Run", "giver": "KAEL", "region": "The Wastelands", "world": "wastelands", "after": "09",
     "beat": "Kael's monthly run to the Underground, and why he never misses one", "chapters": [
        {"id": "C03A", "title": "Every Month", "location": "EXT. THE WASTELANDS — THE TRADER'S POST", "kind": "talk", "who": "KAEL", "start": "waste-trader",
         "label": "Meet Kael at the trader's post",
         "open": [],
         "close": L(KAEL, "Six years, every month, a fuel truck to the Underground. Raiders, storms, the Fracture. Never missed one.")
         + L(O, "Why?")
         + L(KAEL, "Because the first winter after the dust, nobody brought them anything, and they buried forty people. Ride with me.")},
        {"id": "C03B", "title": "The Highway", "location": "EXT. THE OLD HIGHWAY", "kind": "drive", "to": "vault-gate", "label": "Drive the fuel to the vault gate",
         "open": L(KAEL, "Raiders like this stretch. Keep it moving."),
         "close": L(KAEL, "Made it. Again.")
         + L(N, "They're cheering. At the gate.")
         + L(KAEL, "They always do. That's the other reason.")},
    ]},
    {"id": "C04", "title": "Corner of Your Eye", "giver": "NYX", "region": "Verdant Forest — Eldergrove", "world": "eldergrove", "after": "12",
     "beat": "Nyx hunts the Collector who killed her teacher", "chapters": [
        {"id": "C04A", "title": "The Ranger Who Taught Me", "location": "EXT. ELDERGROVE — THE RANGER STATION", "kind": "talk", "who": "NYX", "start": "eg-ranger",
         "label": "Find Nyx at the ranger station",
         "open": [],
         "close": L(NYX, "Old Teo taught me to see where the leaves move wrong. Three days before you came, a Collector cut his throat for asking it a question.")
         + L(O, "And you know which one.")
         + L(NYX, "It walks with a limp. I put an arrow in its knee before it vanished. It's still in the valley. They don't leave until they've finished measuring.")},
        {"id": "C04B", "title": "Tracks", "location": "EXT. ELDERGROVE — THE STONES TRAIL", "kind": "trace", "label": "Follow the limping tracks",
         "open": L(N, "Light-bent footprints. One leg drags."),
         "close": []},
        {"id": "C04C", "title": "The Limping Man", "location": "EXT. ELDERGROVE — THE LAKE", "kind": "kills", "amount": 5, "to": "eg-lake", "label": "Corner the Collector",
         "open": L(NYX, "There. Corner of your eye."),
         "close": L(NYX, "Done. Teo would have said something wise. Something about the forest remembering.")
         + L(O, "What would you say?")
         + L(NYX, "I'd say I missed his stupid jokes.")},
    ]},
    {"id": "C05", "title": "Sitting Down", "giver": "GOLIATH", "region": "Goldenreach", "world": "goldenreach", "after": "14",
     "beat": "Goliath goes home to the farm he hasn't seen since the Fracture", "chapters": [
        {"id": "C05A", "title": "Home", "location": "EXT. GOLDENREACH — THE FARM", "kind": "talk", "who": "MRS. REYES", "start": "gf-village", "to": "gf-farm",
         "label": "Drive Goliath to the farm",
         "open": L(GOL, "My mother's farm. I haven't called. I didn't know what to say. \"Hi, Mum, the world ended, I'm a war machine now.\"")
         + L(N, "That is a very honest opening."),
         "close": L(MOM, "Marcus. You're enormous. You were always enormous. Come here.")
         + L(GOL, "Mum.")
         + L(MOM, "The orchard's full of crystals. They hum at night. And something's been taking the goats.")
         + L(GOL, "...I'll sort it, Mum.")},
        {"id": "C05B", "title": "The Goat Thief", "location": "EXT. GOLDENREACH — THE ORCHARDS", "kind": "kills", "amount": 6, "to": "gf-orchards",
         "label": "Clear the orchard of what's eating the goats",
         "open": L(GOL, "Nobody eats my mother's goats."),
         "close": L(MOM, "Stay for dinner. Both of you. And the little light.")
         + L(N, "I don't eat.")
         + L(MOM, "Then you can sit and be polite. Marcus, sit down. You make the room nervous standing up.")
         + L(GOL, "...Yes, Mum.")},
    ]},
    {"id": "C06", "title": "Severance", "giver": "CIPHER", "region": "Neon City", "world": "neon-city", "after": "40",
     "beat": "Cipher takes Tallis's things home to their mother", "chapters": [
        {"id": "C06A", "title": "A Box", "location": "EXT. NEON CITY — THE OLD BLOCKS", "kind": "drive", "to": "neon-underground", "start": "terminal:neon",
         "label": "Drive Cipher across Neon City",
         "open": L(CIPH, "A watch. A book of terrible poems. His volunteer badge. That's all Crane kept of him.")
         + L(O, "And your mother?")
         + L(CIPH, "She doesn't know. She thinks he's in a research program. She's proud of him."),
         "close": []},
        {"id": "C06B", "title": "The Door", "location": "INT. A NEON CITY APARTMENT", "kind": "talk", "who": "ANNA VOLK", "label": "Knock on the door",
         "open": [],
         "close": L(MOTHER, "Ari. You've come home. Where's your brother?")
         + L(CIPH, "Mum. Sit down. Please.")
         + L(MOTHER, "...No. No, don't say it.")
         + L(CIPH, "He held something no one had ever held. For nine seconds. He was brave. He was so brave.")
         + L(MOTHER, "He wrote such terrible poems.")
         + L(CIPH, "He did. I brought them.")},
    ]},
    {"id": "C07", "title": "River Song", "giver": "ILYRA SEN", "region": "Verdant Forest — Eldergrove", "world": "eldergrove", "after": "12",
     "beat": "Ilyra looks for the river in her oldest song", "chapters": [
        {"id": "C07A", "title": "The Song", "location": "EXT. ELDERGROVE FALLS", "kind": "talk", "who": "ILYRA SEN", "start": "eg-falls",
         "label": "Sit with Ilyra at the falls",
         "open": [],
         "close": L(ILYRA, "There's a song I've sung every morning for twenty years. It's about a river that runs backwards to the sea it came from.")
         + L(O, "That's not a river anywhere.")
         + L(ILYRA, "It was. On the world before. I'd like to find something like it here. Somewhere that remembers going home.")},
        {"id": "C07B", "title": "Upstream", "location": "EXT. ELDERGROVE — THE LAKE", "kind": "reach", "to": "eg-lake", "label": "Follow the water up to the lake",
         "open": L(N, "The lake feeds the falls. And the falls feed the lake. The water is moving in a circle.")
         + L(ILYRA, "Oh."),
         "close": L(ILYRA, "It's not the same river. But it's going home. Every day. Thank you.")
         + L(N, "Would you sing it? The song?")
         + L(ILYRA, "For you, lighthouse? Always.")},
    ]},
    {"id": "C08", "title": "Roads Nobody Built", "giver": "AUREN THALE", "region": "Solmara Desert", "world": "solara", "after": "17",
     "beat": "Auren's map draws a road to a stranded caravan", "chapters": [
        {"id": "C08A", "title": "A New Road", "location": "EXT. DUNEGATE", "kind": "talk", "who": "AUREN THALE", "start": "solara-dunegate",
         "label": "See what Auren's map drew",
         "open": [],
         "close": L(AUREN, "The map drew a road last night. Out past the glass flats. At the end of it, nine people and a broken axle.")
         + L(O, "The trader's caravan.")
         + L(AUREN, "He'll be insufferable when you save him. He'll want a discount.")},
        {"id": "C08B", "title": "The Caravan", "location": "EXT. THE GLASS FLATS", "kind": "drive", "to": "z-quicksand", "label": "Drive the map's road",
         "open": L(AUREN, "Follow the line. Even when it looks like sand. Especially then."),
         "close": []},
        {"id": "C08C", "title": "Stranded", "location": "EXT. THE GLASS FLATS — THE CARAVAN", "kind": "survive", "amount": 45, "label": "Hold the caravan till the axle's fixed",
         "open": L(TRADER, "You! Again! Is this a delivery? I didn't order a rescue."),
         "close": L(TRADER, "Fixed. Tell the old man I still want my map.")
         + L(AUREN, "Tell him he's standing on it.")},
    ]},
    {"id": "C09", "title": "The Word", "giver": "NOVA", "region": "Nexus City", "world": "nexus", "after": "27",
     "beat": "NOVA asks for help finding the word for what she feels", "chapters": [
        {"id": "C09A", "title": "A Request", "location": "EXT. NEXUS — THE HARBOUR AT NIGHT", "kind": "cutscene", "start": "nexus-harbor",
         "open": L(N, "May I ask for something? Not tactically.")
         + L(O, "Anything.")
         + L(N, "When you came back for me in Thalassia, I felt something. I've been looking for the word. I'd like to look in places. With you.")
         + L(O, "Where do we start?")
         + L(N, "Somewhere loud."),
         "close": []},
        {"id": "C09B", "title": "Somewhere Loud", "location": "EXT. NEXUS — THE MALL PLAZA", "kind": "reach", "to": "nexus-mall", "label": "Take NOVA somewhere loud",
         "open": [],
         "close": L(N, "Four hundred people. Music from three shops at once. A child laughing at a dog.")
         + L(O, "Is it here?")
         + L(N, "Part of it. The part that is glad other people exist.")},
        {"id": "C09C", "title": "Somewhere Quiet", "location": "EXT. NEXUS — THE BEACH", "kind": "reach", "to": "nexus-harbor", "label": "Take NOVA somewhere quiet",
         "open": [],
         "close": L(N, "The sea. Nobody here. Just you.")
         + L(N, "I think the word isn't one word. I think it's the loud place and the quiet place and knowing you'd come to both.")
         + L(O, "That's a good word.")
         + L(N, "I'll keep it.")},
    ]},
    {"id": "C10", "title": "Coffee and Ghosts", "giver": "SERAPHINE", "region": "Nexus City", "world": "nexus", "after": "62",
     "beat": "Seraphine tries to have one normal day", "chapters": [
        {"id": "C10A", "title": "A Normal Day", "location": "EXT. NEXUS — A CAFÉ", "kind": "talk", "who": "SERAPHINE", "start": "nexus-mall", "to": "nexus-mall",
         "label": "Meet Seraphine for coffee",
         "open": [],
         "close": L(SERA, "I've been alive for longer than this city and I've never just... had a coffee. Without a plan.")
         + L(O, "How is it?")
         + L(SERA, "Terrible. I love it.")
         + L(N, "Two people at the corner table have been watching you for nine minutes. They are not drinking their coffee.")
         + L(SERA, "Of course they aren't.")},
        {"id": "C10B", "title": "Loyalists", "location": "EXT. NEXUS — THE MALL PLAZA", "kind": "kills", "amount": 7, "label": "Deal with the Continuum loyalists",
         "open": L(SERA, "Continuum loyalists. They think I betrayed him.")
         + L(O, "Did you?")
         + L(SERA, "Yes. Beautifully."),
         "close": L(SERA, "...Let's get another coffee.")
         + L(O, "Another terrible one?")
         + L(SERA, "The most terrible one they have.")},
    ]},
    {"id": "C11", "title": "Continuity Reserve", "giver": "WARD", "region": "Nexus City", "world": "nexus", "after": "21", "until": "43",
     "beat": "Ward asks you to burn the Continuum's money", "chapters": [
        {"id": "C11A", "title": "The Cache", "location": "INT. WARD'S OFFICE", "kind": "talk", "who": "WARD", "start": "nexus-bastion", "to": "nexus-bastion",
         "label": "Answer Ward's summons",
         "open": [],
         "close": L(WARD, "There's a Continuity Reserve cache under the old rail yard. Their money. Their weapons. Waiting for me to need it again.")
         + L(O, "And you want it gone.")
         + L(WARD, "I want to not be tempted. I'm too old to trust myself with temptation.")},
        {"id": "C11B", "title": "The Rail Yard", "location": "EXT. NEXUS — THE OLD RAIL YARD", "kind": "hack", "label": "Rig the cache",
         "open": L(N, "The cache is guarded by Observers. Quietly."),
         "close": L(N, "Rigged.")},
        {"id": "C11C", "title": "Burn", "location": "EXT. THE OLD RAIL YARD", "kind": "survive", "amount": 40, "label": "Hold until the cache burns",
         "open": L(WARD, "Light it."),
         "close": L(WARD, "That's a lot of walls going up in smoke.")
         + L(O, "Regrets?")
         + L(WARD, "Hundreds. Just not this one.")},
    ]},
    {"id": "C12", "title": "Pump It Out", "giver": "CHIEF ODA", "region": "Thalassia", "world": "thalassia", "after": "30",
     "beat": "Oda goes back down to restart Thalassia's pumps", "chapters": [
        {"id": "C12A", "title": "Going Back", "location": "INT. THALASSIA — THE PORT", "kind": "talk", "who": "CHIEF ODA", "start": "th-port",
         "label": "Meet Oda at the port",
         "open": [],
         "close": L(ODA, "Engineers always go back. I told you. The pumps in the eastern ring need hands. Yours are big.")
         + L(O, "What's down there?")
         + L(ODA, "Water. Cult leftovers. Eighty years of my grandmother's work.")},
        {"id": "C12B", "title": "The Eastern Ring", "location": "INT. THALASSIA — THE EASTERN RING", "kind": "trace", "label": "Restart the three pump stations",
         "open": L(ODA, "Station by station. Gentle. They're old."),
         "close": L(ODA, "Listen to that. She's breathing again.")
         + L(N, "The water is falling a centimetre a minute.")
         + L(ODA, "A centimetre a minute. Give me a month and you'll be able to walk to the palace in your socks.")},
    ]},
]
