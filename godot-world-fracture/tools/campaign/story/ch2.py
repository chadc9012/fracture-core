"""Chapter 2 — The Voice and the Map, Missions 11–17: the first two keepers. Ilyra Sen wakes in Eldergrove; the
Continuum steps out of the dark; Auren Thale's map finds the operator in Solmara; the Harbinger falls at Dunegate."""
from common import *

CHAPTER = (2, "The Voice and the Map")
ELDER = "ELDER MAREN"
COLLECTOR = "COLLECTOR"
TRADER = "TRADER"

MISSIONS = [
    # =========================================================================================== MISSION 11
    {"id": "11", "title": "Into Eldergrove", "region": "Verdant Forest — Eldergrove", "world": "eldergrove",
     "beat": "Arrival / new ally / forest hunt / first keeper", "chapters": [
        {"id": "11A", "title": "Green Silence", "location": "EXT. ELDERGROVE AIRFIELD — MORNING", "kind": "cutscene", "start": "eg-airport",
         "open": L(N, "Eldergrove. Population before the Fracture: four thousand. Current estimate: unknown.")
         + L(O, "It's quiet.")
         + L(N, "Too quiet. There are no birds.")
         + L(NYX, "There are birds. They're just smarter than you. They stopped singing when the strangers came.")
         + L(O, "And you are?")
         + L(NYX, "Nyx. Kael said you'd be coming and that you'd need someone who can see in a forest. He also said you talk to your machine.")
         + L(N, "I am not a machine. I am a tactical intelligence.")
         + L(NYX, "It talks back. Great.")
         + L(O, "What strangers?")
         + L(NYX, "People you only see out of the corner of your eye. They've been in the canopy for three days, asking the trees questions."),
         "close": []},
        {"id": "11B", "title": "The Ranger Village", "location": "EXT. ELDERGROVE VILLAGE", "kind": "talk", "who": "ELDER MAREN",
         "to": "eg-village", "label": "Find the village elder",
         "open": L(NYX, "The rangers don't like outsiders. Don't touch anything carved.")
         + L(O, "What happens if I touch something carved?")
         + L(NYX, "Nobody knows. That's why you don't."),
         "close": L(ELDER, "Kael's girl brings a soldier and a ghost in a box. What does the city want with us now?")
         + L(O, "We're looking for someone. A woman who doesn't remember where she came from.")
         + L(ELDER, "Half this valley doesn't remember where it came from. The Fracture took more than roofs.")
         + L(N, "She would have appeared without records. Possibly years ago.")
         + L(ELDER, "...The singer. At the falls. She came out of the mist twenty winters back and she hasn't aged a day of them.")
         + L(ELDER, "When she sings, the cracks in the sky close. Small ones. The ones that would have killed us.")
         + L(O, "Can you take us to her?")
         + L(ELDER, "I can point. The strangers in the trees have been pointing too.")}
        ,
        {"id": "11C", "title": "Collectors in the Canopy", "location": "EXT. ELDERGROVE — THE HIGH CANOPY", "kind": "kills", "amount": 7,
         "label": "Drive the cloaked hunters out of the trees",
         "open": L(N, "Light-bending armour. The same as at the terminal.")
         + L(NYX, "Told you. Corner of your eye.")
         + L(O, "Can you see them?")
         + L(NYX, "I can see where the leaves move wrong. Follow my shots."),
         "close": L(COLLECTOR, "...retrieval team two, the asset is moving to the falls... the sixth is with them...")
         + L(O, "They know where she is.")
         + L(NYX, "Then we'd better get there before they do.")}
        ,
        {"id": "11D", "title": "The Falls", "location": "EXT. ELDERGROVE FALLS", "kind": "reach", "to": "eg-falls", "label": "Reach the falls",
         "open": L(N, "There is a resonance coming from the falls. It matches the archive's first seal.")
         + L(O, "The first keeper.")
         + L(N, "Or something wearing her signature."),
         "close": []},
        {"id": "11E", "title": "The Singing Woman", "location": "EXT. BEHIND THE FALLS", "kind": "talk", "who": "ILYRA SEN", "to": "eg-falls",
         "label": "Find the singer behind the falls",
         "open": [],
         "close": L(ILYRA, "You walk loudly for someone being hunted.")
         + L(O, "You knew we were coming?")
         + L(ILYRA, "The water told me. It's been nervous all morning.")
         + L(O, "We think you're in danger.")
         + L(ILYRA, "Everyone is in danger. You're the first who came here because of it instead of in spite of it.")
         + L(N, "Her biometric signature matches the archive's first keeper. Ilyra Sen. The Voice.")
         + L(ILYRA, "Ilyra. That's... I haven't heard that name in a very long time. How does your little light know it?")
         + L(O, "It's a long story.")
         + L(ILYRA, "I know you. I don't know from where. But I know I was very angry with you once.")
         + L(N, "Operator, the forest has gone silent again.")}
        ,
        {"id": "11F", "title": "Something Hears Her", "location": "EXT. ELDERGROVE FALLS", "kind": "survive", "amount": 60,
         "label": "Protect Ilyra while she sings",
         "open": L(ILYRA, "They're not the hunters. They're older. They follow the song.")
         + L(O, "Then stop singing!")
         + L(ILYRA, "If I stop, the crack above us opens all the way. Keep them off me.")
         + L(NYX, "I've got the left bank. Don't let anything cross the water."),
         "close": L(ILYRA, "It's closed. For now.")
         + L(N, "Those were Null Choir constructs. Small ones. They were not here to kill her.")
         + L(O, "Then what?")
         + L(N, "They were listening. To see if she remembers.")}
        ,
        {"id": "11G", "title": "Twenty Winters", "location": "INT. RANGER LODGE — NIGHT", "kind": "cutscene",
         "open": L(ILYRA, "I woke in the mist with a song in my mouth and no name. For twenty years that was enough.")
         + L(O, "We can't make you come with us.")
         + L(ILYRA, "No. But you'll come back. Your kind always comes back.")
         + L(NYX, "\"Your kind.\" What does that mean?")
         + L(ILYRA, "I don't know. I only know it's true.")
         + L(N, "There are standing stones above the shrine. They carry the same glyphs as the archive. If the first seal sleeps anywhere, it sleeps there.")
         + L(ILYRA, "The stones hum when I pass them. I always thought it was the wind.")
         + L(O, "Show us in the morning."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 12
    {"id": "12", "title": "Voice of the Concord", "region": "Verdant Forest — Eldergrove", "world": "eldergrove",
     "beat": "Standing stones / the Continuum's Second / the first seal", "chapters": [
        {"id": "12A", "title": "The Shrine", "location": "EXT. ELDERGROVE SHRINE — DAWN", "kind": "talk", "who": "ILYRA SEN", "start": "eg-village",
         "to": "eg-shrine", "label": "Walk Ilyra to the shrine",
         "open": L(NYX, "Collector tracks everywhere. They came back in the night.")
         + L(O, "Did they take anything?")
         + L(NYX, "They didn't take. They measured."),
         "close": L(ILYRA, "I used to leave flowers here. I never knew why.")
         + L(N, "Three of the stones are dormant. If they can be woken in sequence, the shrine may complete a circuit.")
         + L(ILYRA, "And then?")
         + L(N, "And then you may remember. Or the shrine may explode. The glyphs are ambiguous.")
         + L(ILYRA, "I like your machine. It's honest.")}
        ,
        {"id": "12B", "title": "Wake the Stones", "location": "EXT. THE STANDING STONES", "kind": "trace", "label": "Wake the three standing stones",
         "open": L(N, "Touch each stone in turn. I will tune them to Ilyra's voice.")
         + L(ILYRA, "What do I sing?")
         + L(N, "Whatever you sang the morning you woke."),
         "close": L(ILYRA, "I remember a city of white stone. A gate. Five of us. And you, standing a little apart from everyone.")
         + L(O, "The sixth.")
         + L(ILYRA, "The promise. Everyone loved you for it, and everyone was afraid of the day you'd have to keep it.")}
        ,
        {"id": "12C", "title": "The Collector", "location": "EXT. THE STANDING STONES", "kind": "boss", "boss": "collector-prime",
         "boss_name": "Collector Prime", "label": "Stop the Collector",
         "open": L(COLLECTOR, "Asset confirmed awake. Retrieve the Voice. The sixth is expendable if necessary.")
         + L(NYX, "Expendable. They said you're expendable.")
         + L(O, "I heard.")
         + L(N, "Its harness is drawing power from the stones. Break the harness and it falls."),
         "close": L(COLLECTOR, "...retrieval failed... the Second is already here...")
         + L(N, "Another signature. It walked out of a Fracture fifty metres behind us.")}
        ,
        {"id": "12D", "title": "The Second", "location": "EXT. THE STANDING STONES", "kind": "cutscene",
         "open": L(VASQ, "Please. Lower your weapons. If I wanted anyone dead, the stones would be the only thing left standing.")
         + L(O, "Who are you?")
         + L(VASQ, "Oren Vasq. I serve the Continuum. I speak for the one you met in the archive.")
         + L(ILYRA, "You were there. In the sanctuary. You held the door for her when she walked away.")
         + L(VASQ, "You remember quickly, Voice. Faster than predicted.")
         + L(O, "Her? You mean the Sovereign.")
         + L(VASQ, "I mean that the Continuum has kept this world alive through eleven endings, and the sixth has caused nine of them.")
         + L(O, "Nine?")
         + L(VASQ, "You don't remember those either. That is the mercy we give you every time. Come with us, Ilyra Sen. We can protect you from what's coming.")
         + L(ILYRA, "You protected the last world by watching it burn. I remember that too.")
         + L(VASQ, "Then we will speak again. When there are fewer of you."),
         "close": []},
        {"id": "12E", "title": "The Voice", "location": "EXT. THE SHRINE — THE FIRST SEAL", "kind": "cutscene",
         "open": L(ILYRA, "I'm ready. Stand with me.")
         + L(N, "The stones are synchronising. The first seal is responding.")
         + L(ILYRA, "I am Ilyra Sen. Voice of the Concord. Keeper of the first seal. I was asked to sing the world asleep. I'm going to sing it awake instead.")
         + L(N, "First seal restored. I am reading the lock on the far side of the planet shifting by a fraction of a degree.")
         + L(ILYRA, "Listen to me. The sixth was our promise. You were meant to open the lock when this world was ready to meet what lies beyond it.")
         + L(O, "And I opened it early.")
         + L(ILYRA, "You opened it to save us. I've been angry with you for longer than this world has had a name. I don't think I am anymore."),
         "close": []},
        {"id": "12F", "title": "Leaving the Grove", "location": "EXT. ELDERGROVE AIRFIELD", "kind": "reach", "to": "eg-airport",
         "label": "Get Ilyra to the airfield",
         "open": L(NYX, "I'm coming with you. Kael would never forgive me if I let you get her killed on the way out.")
         + L(O, "Glad to have you.")
         + L(NYX, "Don't be glad yet."),
         "close": L(ILYRA, "I've never flown.")
         + L(N, "Statistically, it is very safe.")
         + L(ILYRA, "Statistically, so was the world.")}
        ,
    ]},
    # =========================================================================================== MISSION 13
    {"id": "13", "title": "The Continuum", "region": "Nexus City", "world": "nexus",
     "beat": "Hidden lab / Rainer's key / the Continuum's records / the Architect speaks", "chapters": [
        {"id": "13A", "title": "Sovereign", "location": "INT. HAVEN-01 — THE INFIRMARY", "kind": "cutscene", "start": "nexus-harbor",
         "open": L(ILYRA, "You.")
         + L(SERA, "Dr. Seraphine Vale. I don't believe we've met.")
         + L(ILYRA, "We have. You wore a veil then. And you sounded exactly as tired as you do now.")
         + L(SERA, "You're mistaken.")
         + L(ILYRA, "Perhaps. I've been mistaken about a great many things. Never about a voice.")
         + L(O, "Seraphine. Talk to me.")
         + L(SERA, "There's nothing to talk about. I have a doctorate, a dead research division, and the same nightmares as everyone else.")
         + L(N, "Seraphine's genetic profile does not match any civilian database. I assumed it was classified.")
         + L(SERA, "It was. By me. Can we please find the people who are actually trying to kill us?"),
         "close": []},
        {"id": "13B", "title": "Rainer's Door", "location": "EXT. NEXUS HARBOR — GENESIS LAB 3", "kind": "hack",
         "label": "Open the Genesis door with Rainer's key",
         "open": L(N, "Rainer's key opens a door that does not appear on any Frontier Defense map. Lab Three. Under the harbor.")
         + L(VOSS, "I ran security on Genesis for a year. There was no Lab Three.")
         + L(O, "There is now."),
         "close": L(N, "Door open. Lights are on. Somebody has been working here this week.")}
        ,
        {"id": "13C", "title": "Executors", "location": "INT. GENESIS LAB 3", "kind": "kills", "amount": 8, "label": "Clear the lab's guards",
         "open": L(N, "Armed personnel. Continuum markings. They are not cloaked.")
         + L(VOSS, "Then they're not here to hide. They're here to kill."),
         "close": L(VOSS, "They fight like special forces.")
         + L(N, "Because they were. Their records list them as dead in Frontier Defense operations over the last decade.")
         + L(VOSS, "...I knew two of these men. I went to their funerals.")}
        ,
        {"id": "13D", "title": "The Records", "location": "INT. GENESIS LAB 3 — THE ARCHIVE ROOM", "kind": "cutscene",
         "open": L(N, "Their database is open. They did not expect anyone to reach it.")
         + L(N, "Observers monitor Fracture activity. Executors eliminate threats. Collectors retrieve artifacts. Researchers experiment. And above them all, the Inner Circle.")
         + L(O, "Who leads it?")
         + L(N, "The records call him only the Architect.")
         + L("DR. CROSS", "Log entry. Day 412. The vessel performed beyond projection. The Architect is pleased, though he would never say so.")
         + L(VOSS, "Day 412? Cross died on Day 184. I read the report.")
         + L(N, "The report was written by Continuum Observers.")
         + L(SERA, "They let the lab fall on purpose. To see what would come through.")
         + L(O, "To see what I would do.")
         + L("DR. CROSS", "The sixth is not a weapon. The sixth is a variable. We cannot predict it. That is precisely why the Architect wants it near."),
         "close": []},
        {"id": "13E", "title": "Executor Prime", "location": "INT. GENESIS LAB 3 — THE TEST CHAMBER", "kind": "boss", "boss": "executor-prime",
         "boss_name": "Executor Prime", "label": "Defeat the Executor Prime",
         "open": L(N, "Something has been released from the test chamber.")
         + L(O, "Continuum?")
         + L(N, "Continuum armour. Fracture-grown body. It was built here, from someone."),
         "close": L(N, "It is down. Its last transmission went to an address I can't trace.")
         + L(VOSS, "So they know we were here.")
         + L(O, "Good. I want them to know.")}
        ,
        {"id": "13F", "title": "The Signal", "location": "INT. GENESIS LAB 3 — EVERY SCREEN", "kind": "cutscene",
         "open": L(ARCH, "Every screen. Forgive the theatre. It's the only way your machine lets me speak.")
         + L(O, "The Architect.")
         + L(ARCH, "A title I chose because nobody alive remembers the name I was born with. Not even me, most days.")
         + L(O, "You let Research Complex 09 fall.")
         + L(ARCH, "I let a great many things fall. Cities. Continents. Whole worlds, once or twice. I am trying to keep the one thing that matters from falling with them.")
         + L(O, "And what's that?")
         + L(ARCH, "Continuity. A world that goes on. Yours has broken eleven times. I have rebuilt it eleven times.")
         + L(SERA, "...")
         + L(ARCH, "Hello, Seraphine. You look well.")
         + L(SERA, "Turn it off.")
         + L(ARCH, "My predictions end before your story does, sixth. Nothing else in creation does that. You should find that frightening. I certainly do."),
         "close": L(O, "Seraphine.")
         + L(SERA, "Not now. Please. Not now.")},
    ]},
    # =========================================================================================== MISSION 14
    {"id": "14", "title": "Solmara Sands", "region": "Solmara Desert", "world": "solara",
     "beat": "New ally / desert crossing / market rumours / buried archive", "chapters": [
        {"id": "14A", "title": "Heat", "location": "EXT. SOLMARA DESERT — SOLAR ARRAY ALPHA", "kind": "cutscene", "start": "solar-array",
         "open": L(N, "Second coordinate. Solmara Desert. Surface temperature forty-seven degrees.")
         + L(GOL, "And climbing. Commander Voss sends his regards. And me.")
         + L(O, "You're Goliath.")
         + L(GOL, "I'm what Frontier Defense sends when it doesn't trust the desert. Or you. Mostly the desert.")
         + L(NYX, "He's bigger than Kael described.")
         + L(GOL, "Kael always describes me sitting down.")
         + L(N, "The Ascendancy has three salvage teams digging near the old colonnade. They arrived yesterday.")
         + L(GOL, "Crane's people. Always first to the shovel."),
         "close": []},
        {"id": "14B", "title": "Dunegate Road", "location": "EXT. THE DUNEGATE ROAD", "kind": "drive", "to": "solara-dunegate",
         "label": "Drive to Dunegate before the storm",
         "open": L(N, "Sandstorm forming to the south. We have about twelve minutes.")
         + L(GOL, "Then don't stop for anything. Including me."),
         "close": L(GOL, "Dunegate. Last town before the deep desert. They've survived three Fracture storms on salt and stubbornness.")
         + L(NYX, "My kind of people.")}
        ,
        {"id": "14C", "title": "The Map Seller", "location": "EXT. DUNEGATE MARKET", "kind": "talk", "who": "TRADER", "to": "solara-dunegate",
         "label": "Find the trader with the strange map",
         "open": L(N, "There is a story repeating in the market. A map that redraws itself.")
         + L(O, "Where do I buy one?")
         + L(N, "Nobody can. Everyone who tries says the map was sold the day before."),
         "close": L(TRADER, "The glass map? Sold yesterday. It's always sold yesterday.")
         + L(O, "To who?")
         + L(TRADER, "To an old man who walks out of the dunes every spring with sand on his eyelids. He pays in drawings.")
         + L(TRADER, "Last spring he drew me a road that didn't exist. A week later the Fracture made it. Saved my caravan.")
         + L(O, "Where does he go?")
         + L(TRADER, "Down. Under the colonnade. Where the Ascendancy are digging now. If you find him, tell him he owes me a map.")}
        ,
        {"id": "14D", "title": "Shovels and Shields", "location": "EXT. THE OLD COLONNADE", "kind": "kills", "amount": 8,
         "label": "Stop the Ascendancy's dig", "start": "colonnade",
         "open": L(GOL, "Shielded diggers. Crane spared no expense.")
         + L(O, "We're not here to kill them.")
         + L(GOL, "Tell them that."),
         "close": L(CRANE, "Operator. Again. Do you follow me, or do I follow you? It's getting hard to tell.")
         + L(O, "Call off your teams, Crane.")
         + L(CRANE, "Gladly. We found nothing. The entrance only opens for someone it recognises. I suspect that's you.")}
        ,
        {"id": "14E", "title": "The Sunken Arcology", "location": "INT. SUNKEN ARCOLOGY — THE DESCENT", "kind": "reach", "to": "sunken-arcology",
         "label": "Descend into the sunken arcology",
         "open": L(N, "The door is reacting to your signature. And to Seraphine's map coordinates. Both.")
         + L(GOL, "I don't like underground.")
         + L(NYX, "You don't like anything.")
         + L(GOL, "I like outside."),
         "close": []},
        {"id": "14F", "title": "The Glass Map", "location": "INT. SUNKEN ARCOLOGY — THE MAP ROOM", "kind": "cutscene",
         "open": L(N, "A sheet of glass. Four metres across. It is drawing.")
         + L(O, "What is it drawing?")
         + L(N, "Us. Our positions. It drew your next step before you took it.")
         + L(NYX, "That's not creepy at all.")
         + L(N, "There are other marks. Five. One in Eldergrove, glowing. One here, flickering. One beneath the sea near Verdant Forest. One in the far north. And one... outside the edge of the glass.")
         + L(GOL, "How can a map have something outside its edge?")
         + L(N, "I don't know. The glass is still drawing it."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 15
    {"id": "15", "title": "The Map That Should Not Exist", "region": "Solmara Desert", "world": "solara",
     "beat": "New ally / reading the map / storm / the second keeper", "chapters": [
        {"id": "15A", "title": "The Defector", "location": "INT. SUNKEN ARCOLOGY — THE MAP ROOM", "kind": "cutscene",
         "open": L(CIPH, "Don't touch it with your hands. It remembers fingerprints. And it judges them.")
         + L(GOL, "Who's this?")
         + L(CIPH, "Cipher. Until last week, chief cartographic researcher for the Ascendancy. Until last week, Crane's favourite.")
         + L(O, "What happened last week?")
         + L(CIPH, "I read what Crane does with the people in his cells. I left. With his best equipment.")
         + L(NYX, "So you're a thief.")
         + L(CIPH, "I'm an ex-employee with severance. The map has been drawing my face for three days. I assumed it wanted to meet me.")
         + L(N, "I detect the same neural resonance in Cipher that I found in the tower's cells. Weaker.")
         + L(CIPH, "Yes. I was one of the volunteers. Don't look at me like that. It's how I can read this thing."),
         "close": []},
        {"id": "15B", "title": "Reading Glass", "location": "EXT. SOLAR ARRAY ALPHA", "kind": "hack", "start": "solar-array",
         "label": "Power the map from the solar array",
         "open": L(CIPH, "The map needs power to show more than us. The array can give it a sunrise's worth in a minute.")
         + L(O, "And if it overloads?")
         + L(CIPH, "Then we'll have a very bright minute."),
         "close": L(CIPH, "There. Do you see? Every line it draws bends toward one point. Not a place. A person.")
         + L(O, "Me.")
         + L(CIPH, "No. Him.")
         + L(N, "A figure is walking out of the dunes. The map drew him an hour ago.")}
        ,
        {"id": "15C", "title": "Glass Storm", "location": "EXT. SOLAR ARRAY ALPHA", "kind": "survive", "amount": 60,
         "label": "Hold the array through the Fracture storm",
         "open": L(N, "A Fracture storm. It's following the walking figure.")
         + L(GOL, "Everybody behind me. I'm the widest thing here."),
         "close": L(N, "The storm has passed through him. He is unharmed.")
         + L(NYX, "Of course he is.")}
        ,
        {"id": "15D", "title": "The Old Man of the Dunes", "location": "EXT. THE RIBCAGE", "kind": "talk", "who": "AUREN THALE", "to": "ribcage",
         "label": "Follow the walker to the Ribcage",
         "open": L(N, "He has stopped beneath the bones of something very large.")
         + L(O, "Ribcage. Of what?")
         + L(CIPH, "Nobody knows. It was here before the desert."),
         "close": L(AUREN, "You're late. The map said noon.")
         + L(O, "We got held up by a storm.")
         + L(AUREN, "The map said that too. I drew you this morning. You looked taller.")
         + L(N, "Biometric match. Auren Thale. The Cartographer. Second keeper.")
         + L(AUREN, "Thale. Hm. That's what the first map was signed with. I always thought it was the name of a road.")
         + L(O, "Do you know who you are?")
         + L(AUREN, "I know where I am. That's usually more useful.")
         + L(AUREN, "I mapped every road out of the end of the world, young one. Every one of them goes through you.")}
        ,
        {"id": "15E", "title": "Roads Through You", "location": "EXT. THE RIBCAGE — NIGHT", "kind": "cutscene",
         "open": L(AUREN, "Forty years I've walked this desert. Drawing roads that don't exist yet. They always arrive.")
         + L(CIPH, "You're not predicting the future. You're surveying it.")
         + L(AUREN, "Clever. The Ascendancy taught you well, before you robbed them.")
         + L(O, "The Continuum says I ended this world nine times.")
         + L(AUREN, "Then they've been reading the wrong map. I've seen your roads. Nine of them end. Two don't. The two that don't, nobody can see past.")
         + L(N, "The Architect said the same thing. His predictions end before the operator's story does.")
         + L(AUREN, "Of course they do. He maps with walls. I map with roads. You can't wall in a road you haven't walked yet."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 16
    {"id": "16", "title": "The Ashen Road", "region": "Solmara Desert", "world": "solara",
     "beat": "Pilgrimage / dragon murals / Choir ambush / the Cartographer's memory", "chapters": [
        {"id": "16A", "title": "The Murals", "location": "INT. CANYON SHRINE — THE DRAGON WALL", "kind": "cutscene", "start": "colonnade",
         "open": L(AUREN, "Before we go further, you should see these. The road to the seal passes the old roost.")
         + L(N, "Murals. Astryan-era pigment. Dragons... standing beside people.")
         + L(CIPH, "Allies. Not mounts. Look at the eyes. They're drawn as equals.")
         + L(AUREN, "The dragons kept a covenant of their own. Older than ours, in some ways. The Ashen line still remembers it.")
         + L(O, "Should we be worried?")
         + L(AUREN, "We should be polite. The roost is not our business today. Its keeper settles its own debts, with whoever it chooses.")
         + L(N, "One figure is painted apart from the others. Watching. The pigment around it has been scraped away and repainted many times.")
         + L(AUREN, "The Witness. Even the dragons couldn't decide whether to remember it."),
         "close": []},
        {"id": "16B", "title": "The Pass", "location": "EXT. THE QUICKSAND FLATS", "kind": "reach", "label": "Cross the flats to the pass",
         "open": L(AUREN, "Step where I step. The ground here is in two minds about being ground.")
         + L(GOL, "I hate this desert."),
         "close": []},
        {"id": "16C", "title": "The Silent Ones", "location": "EXT. THE PASS", "kind": "kills", "amount": 9, "label": "Break the Choir ambush",
         "open": L(N, "Null Choir constructs. They suppress sound. I can barely hear you.")
         + L(NYX, "Then stop talking and shoot."),
         "close": L(AUREN, "Choir. They come when a keeper starts remembering. Like moths to a lamp.")
         + L(O, "Or wolves to a fire.")
         + L(AUREN, "Wolves are honest about it.")}
        ,
        {"id": "16D", "title": "The Cartographer's Camp", "location": "EXT. AUREN'S CAMP — DUSK", "kind": "talk", "who": "AUREN THALE",
         "label": "Make camp with Auren",
         "open": [],
         "close": L(AUREN, "Sit. I want to tell you something before the seal wakes up and I start being somebody important.")
         + L(O, "Go on.")
         + L(AUREN, "A long time ago, you asked me to map a world where you didn't have to choose. Where the gate could stay closed and nobody had to suffer behind it.")
         + L(O, "Did you?")
         + L(AUREN, "I tried. For a hundred years. I never finished it. Every map I drew, there was one road where you had to open the gate. Every map.")
         + L(O, "So I was always going to do it.")
         + L(AUREN, "No. You were always going to have to decide. That's not the same, and the difference is the only thing I've ever been sure of.")}
        ,
        {"id": "16E", "title": "Stars Over the Ribcage", "location": "EXT. AUREN'S CAMP — NIGHT", "kind": "cutscene",
         "open": L(CIPH, "The map is moving again. Something big is heading toward Dunegate.")
         + L(N, "I recognise the signature. The Harbinger.")
         + L(GOL, "The thing from Haven-01? The one you didn't finish?")
         + L(O, "It left before I could.")
         + L(AUREN, "It's coming for me. The Severant can't stand a keeper who knows where they're going.")
         + L(NYX, "Then we get to Dunegate first."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 17
    {"id": "17", "title": "Siege of the Sandglass", "region": "Solmara Desert", "world": "solara",
     "beat": "Town defence / the Harbinger's last stand / the second seal", "chapters": [
        {"id": "17A", "title": "Sandglass", "location": "EXT. DUNEGATE — THE SALT WALLS", "kind": "cutscene", "start": "solara-dunegate",
         "open": L(TRADER, "You brought a war to my market.")
         + L(O, "It was coming anyway. We brought help.")
         + L(GOL, "Everybody who can carry a rifle, on the walls. Everybody who can't, in the salt cellars.")
         + L(AUREN, "The map shows them coming from three directions. Then four. Then it stops drawing.")
         + L(N, "Why would it stop drawing?")
         + L(AUREN, "Because after that, it depends on us."),
         "close": []},
        {"id": "17B", "title": "The Salt Walls", "location": "EXT. DUNEGATE — THE WALLS", "kind": "survive", "amount": 75, "label": "Hold Dunegate",
         "open": L(N, "Contact. All directions.")
         + L(GOL, "Make them pay for every metre of sand!"),
         "close": L(N, "The attack is pulling back. Something is clearing a path for itself.")
         + L(HARB, "Sixth. You built another fortress on stolen ground.")}
        ,
        {"id": "17C", "title": "The Harbinger", "location": "EXT. DUNEGATE — THE MARKET SQUARE", "kind": "boss", "boss": "harbinger",
         "boss_name": "The Harbinger", "label": "End the Harbinger",
         "open": L(HARB, "We met at Haven. You remember me now?")
         + L(O, "I remember you ran.")
         + L(HARB, "I was told to wait. The five had to wake before the sixth remembered. Two are awake. That is enough."),
         "close": L(HARB, "It does not matter. I was only ever the voice before the voice.")
         + L(O, "Whose voice?")
         + L(HARB, "I was a herald once. For the keepers. For you. Before you broke what we served.")}
        ,
        {"id": "17D", "title": "The Herald's End", "location": "EXT. DUNEGATE — THE MARKET SQUARE", "kind": "cutscene",
         "open": L(HARB, "Vael... I have failed. Again.")
         + L(TUROG, "You did not fail, old friend. You counted them for me. Two awake. Three asleep. The sixth beginning to remember.")
         + L(HARB, "Then let me rest.")
         + L(TUROG, "Rest. I will finish this kindly.")
         + L(N, "The Harbinger's signal is gone. It was not killed. It was released.")
         + L(O, "He was a herald for the keepers. For me.")
         + L(AUREN, "He was. His name was Ossian. He used to carry your letters."),
         "close": []},
        {"id": "17E", "title": "The Second Seal", "location": "INT. SUNKEN ARCOLOGY — THE MAP ROOM", "kind": "cutscene",
         "open": L(AUREN, "My turn, I suppose.")
         + L(CIPH, "What do you need?")
         + L(AUREN, "Nothing. A cartographer only needs to know where he's standing.")
         + L(AUREN, "I am Auren Thale. First Cartographer. Keeper of the second seal. I have mapped the end of the world. I'm going to need a bigger map.")
         + L(N, "Second seal restored. The glass map has stopped drawing us. It is drawing a route to the sea.")
         + L(AUREN, "The third keeper doesn't have a body anymore. Only a voice, underwater, saying the same thing over and over.")
         + L(O, "What's it saying?")
         + L(AUREN, "Your name. The one you had before this one.")
         + L(N, "Two seals restored. Three remain. Chapter of record closed."),
         "close": []},
    ]},
]

STAGES = {
    "11A": "camp", "11B": "village", "11C": "forest", "11D": "forest", "11E": "falls", "11F": "falls", "11G": "lodge",
    "12A": "stones", "12B": "stones", "12C": "stones", "12D": "stones", "12E": "stones", "12F": "camp",
    "13A": "medical", "13B": "street", "13C": "lab", "13D": "recording", "13E": "lab_red", "13F": "recording",
    "14A": "desert_camp", "14B": "desert_road", "14C": "market", "14D": "dig", "14E": "dig", "14F": "map_room",
    "15A": "map_room", "15B": "desert_camp", "15C": "desert_camp", "15D": "ribcage", "15E": "ribcage",
    "16A": "murals", "16B": "desert_road", "16C": "desert_road", "16D": "ribcage", "16E": "ribcage",
    "17A": "market", "17B": "market", "17C": "market", "17D": "market", "17E": "map_room",
}
ACTS = {
    "12E": {"First seal restored. I am reading the lock on the far side of the planet shifting by a fraction of a degree.": "seal"},
    "17E": {"Second seal restored. The glass map has stopped drawing us. It is drawing a route to the sea.": "seal"},
}
BOSSES = {"collector-prime": "rift-hound", "executor-prime": "crystal-stalker"}
