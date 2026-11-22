"""World events: things that happen to the world while the story goes on — storms, silences, migrations, panics.
Each opens after a main mission and can be played whenever the player is ready."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "story"))
from common import *

CATEGORY = "event"
RADIO = "MILITARY RADIO"
NEWS = "GLOBAL BROADCAST"
CIV = "CIVILIAN"
RANGER = "RANGER"
KEEPER = "LIGHTHOUSE KEEPER"
CHOIR = "CHOIR VOICE"

MISSIONS = [
    {"id": "E01", "title": "Glass Rain", "region": "Neon City", "world": "neon-city", "after": "18",
     "beat": "A Fracture storm rains glass over Neon City", "chapters": [
        {"id": "E01A", "title": "Storm Warning", "location": "EXT. NEON CITY — THE MAGENTA CROSS", "kind": "cutscene", "start": "neon-mods",
         "open": L(NEWS, "Neon City residents: a Fracture storm is forming over the Magenta Cross. Seek shelter. Do not look up.")
         + L(N, "It's raining glass. Sharp glass. People are trapped in the open."),
         "close": []},
        {"id": "E01B", "title": "Shelter", "location": "EXT. THE MAGENTA CROSS", "kind": "survive", "amount": 50, "label": "Get people under cover until the storm passes",
         "open": L(CIV, "Help! My daughter's under the overpass!"),
         "close": L(N, "Storm passing. Forty-two people sheltered. Three hundred kilos of glass on the street.")
         + L(CIV, "It's beautiful. Isn't that awful? It's beautiful.")},
    ]},
    {"id": "E02", "title": "The Silent Hour", "region": "Riverdale", "world": "riverdale", "after": "32",
     "beat": "A Choir silence spreads over a quiet town", "chapters": [
        {"id": "E02A", "title": "Nobody Answers", "location": "EXT. RIVERDALE — THE SQUARE", "kind": "reach", "start": "riverdale-square", "label": "Walk into the silent square",
         "open": L(N, "Riverdale has gone silent. Every phone, every radio. A silence field.")
         + L(O, "Choir?")
         + L(N, "A small one. Sent to listen to a town. To see if it's worth ending."),
         "close": []},
        {"id": "E02B", "title": "Make Noise", "location": "EXT. RIVERDALE — THE SQUARE", "kind": "kills", "amount": 6, "label": "Break the silence constructs",
         "open": L(N, "Make noise. Lots of it."),
         "close": L(CIV, "...hello? Hello! I can hear myself! Everybody, I can hear myself!")
         + L(N, "The town is shouting. All of it. I think they're going to shout for a while.")},
    ]},
    {"id": "E03", "title": "Falling Prism", "region": "Crystal Badlands", "world": "crystal-badlands", "after": "15",
     "beat": "A crystal meteor and everyone racing for it", "chapters": [
        {"id": "E03A", "title": "Impact", "location": "EXT. CRYSTAL BADLANDS — THE RIFTS", "kind": "drive", "to": "cb-rifts", "start": "cb-port",
         "label": "Race to the crater",
         "open": L(N, "Something fell out of a Fracture into the badlands. A crystal the size of a house. Everyone saw it.")
         + L(O, "Everyone's going for it.")
         + L(N, "The Ascendancy, raiders, three Free Operator crews and a man on a horse."),
         "close": []},
        {"id": "E03B", "title": "First There", "location": "EXT. THE RIFTS — THE CRATER", "kind": "kills", "amount": 8, "label": "Hold the crater",
         "open": L(N, "Raiders first. Then everyone else."),
         "close": L(N, "The crystal is humming. It's... a seed. Not the Seed. A small one. A Fracture growing a garden.")
         + L(O, "Leave it. Let it grow.")}
        ,
    ]},
    {"id": "E04", "title": "Ghost Convoy", "region": "The Wastelands", "world": "wastelands", "after": "44",
     "beat": "A convoy that died years ago is still driving", "chapters": [
        {"id": "E04A", "title": "Headlights", "location": "EXT. THE OLD HIGHWAY — NIGHT", "kind": "cutscene", "start": "wl-old-highway",
         "open": L(N, "Headlights on the highway. Six trucks. Their registrations belong to a convoy lost in the first dust storm.")
         + L(O, "Ghosts?")
         + L(N, "Echoes. A Fracture replaying a road. The drivers think it's six years ago."),
         "close": []},
        {"id": "E04B", "title": "Last Stop", "location": "EXT. THE VAULT GATE", "kind": "drive", "to": "vault-gate", "label": "Lead the ghost convoy home",
         "open": L(N, "If they reach the gate, the echo may finish. Let them arrive."),
         "close": L(N, "They're at the gate. The headlights are fading.")
         + L(O, "Six years late.")
         + L(N, "But they arrived. I think that's the part the echo was waiting for.")},
    ]},
    {"id": "E05", "title": "The Flickering Light", "region": "Azure Isles", "world": "azure-isles", "after": "25",
     "beat": "The isles' lighthouse has started flashing a code", "chapters": [
        {"id": "E05A", "title": "The Keeper", "location": "EXT. AZURE ISLES — THE LIGHTHOUSE", "kind": "talk", "who": "LIGHTHOUSE KEEPER", "start": "az-marina", "to": "az-light",
         "label": "Climb to the lighthouse",
         "open": [],
         "close": L(KEEPER, "It started on its own. Flashing. Same pattern, over and over. I don't know who it's talking to.")
         + L(N, "...It's talking to me. Astryan code. It's saying \"lighthouse\". Over and over. To another lighthouse.")
         + L(KEEPER, "Well, answer it, then.")},
        {"id": "E05B", "title": "Answer", "location": "EXT. THE LIGHTHOUSE — THE LAMP ROOM", "kind": "hack", "label": "Let NOVA answer through the lamp",
         "open": [],
         "close": L(N, "I said hello. It said hello back. Then it said goodbye. It was waiting a very long time for one hello.")
         + L(KEEPER, "And now?")
         + L(N, "Now it's just a lighthouse. Which is a fine thing to be.")},
    ]},
    {"id": "E06", "title": "Floodtide", "region": "Swamps", "world": "swamps", "after": "26",
     "beat": "The swamps rise and the boardwalk villages go under", "chapters": [
        {"id": "E06A", "title": "Rising", "location": "EXT. THE SWAMPS — THE BOARDWALKS", "kind": "survive", "amount": 55, "start": "ss-boardwalks",
         "label": "Hold the boardwalks while the villages evacuate",
         "open": L(N, "A Fracture opened under the lake. The water is rising a metre an hour. And it brought things with it.")
         + L(CIV, "The airboats! Get the children to the airboats!"),
         "close": L(N, "Everyone's out. The boardwalks are under. They'll rebuild.")
         + L(CIV, "We always rebuild. The swamp takes, we build. It's a marriage.")},
    ]},
    {"id": "E07", "title": "Skyfall", "region": "Storm Islands", "world": "storm", "after": "23",
     "beat": "A floating island is falling into the sea", "chapters": [
        {"id": "E07A", "title": "The Falling Isle", "location": "EXT. STORM ISLANDS — THE SKY DOCK", "kind": "cutscene", "start": "storm-sky-dock",
         "open": L(N, "The Windward isle is losing altitude. Forty metres an hour. Three hundred people live on it.")
         + L(O, "Can we stop it?")
         + L(N, "The aether temple at its heart is failing. If someone restarts it, maybe."),
         "close": []},
        {"id": "E07B", "title": "The Temple", "location": "EXT. THE AETHER TEMPLE", "kind": "hack", "to": "storm-aether-temple", "label": "Restart the aether temple",
         "open": L(N, "Something is nesting in it. Something that likes falling."),
         "close": L(N, "The isle is holding. Rising, a little.")
         + L(CIV, "We felt it stop! We felt it! Who are you?")
         + L(O, "Just passing through.")},
    ]},
    {"id": "E08", "title": "Ember Eruption", "region": "Obsidian Reach — Ember Peaks", "world": "ember", "after": "39",
     "beat": "The fire spire erupts over the ash outpost", "chapters": [
        {"id": "E08A", "title": "Ashfall", "location": "EXT. THE ASH OUTPOST", "kind": "survive", "amount": 50, "start": "sp-ash-outpost",
         "label": "Hold the outpost until the evacuation trucks arrive",
         "open": L(N, "The fire spire is erupting. The ash outpost has eight minutes. And the eruption woke the crawlers."),
         "close": L(N, "Trucks away. The outpost is gone. The people aren't.")
         + L(O, "That's the right way round.")},
    ]},
    {"id": "E09", "title": "Frost Bloom", "region": "Frostveil", "world": "frostveil", "after": "38",
     "beat": "Flowers growing out of the ice, and something tending them", "chapters": [
        {"id": "E09A", "title": "Flowers", "location": "EXT. FROSTVEIL — THE SHELF", "kind": "reach", "to": "fv-shelf", "start": "fv-camp", "label": "Find the flowers on the shelf",
         "open": L(N, "Flowers. Blooming in minus thirty. In the shape of a crown.")
         + L(O, "Seraphine?")
         + L(N, "Something she left. Or something that remembers her."),
         "close": L(N, "A guardian. Small. Made of ice and petals. It's tending them.")
         + L(O, "Hostile?")
         + L(N, "It's watering them with snow. I don't think it has room in its day to be hostile.")},
    ]},
    {"id": "E10", "title": "Market Panic", "region": "Nexus City", "world": "nexus", "after": "08",
     "beat": "A rumour sends the whole city to the market", "chapters": [
        {"id": "E10A", "title": "Rumour", "location": "EXT. NEXUS — THE MALL", "kind": "cutscene", "start": "nexus-mall",
         "open": L(NEWS, "Unconfirmed reports that water supplies will be cut tonight. Frontier Defense denies the—")
         + L(N, "Ten thousand people are converging on the market. The rumour is false. The panic is real."),
         "close": []},
        {"id": "E10B", "title": "Calm", "location": "EXT. NEXUS — THE MALL PLAZA", "kind": "survive", "amount": 45, "label": "Keep the peace until the water trucks arrive",
         "open": L(CIV, "They're hoarding it! The rich blocks are hoarding the water!"),
         "close": L(N, "Water trucks arriving. Twelve of them. Voss sent everything.")
         + L(CIV, "...There's enough. There's actually enough.")
         + L(O, "There was always enough. There just wasn't enough trust.")},
    ]},
    {"id": "E11", "title": "Phantom Parade", "region": "Old Harrow", "world": "old-harrow", "after": "42",
     "beat": "A festival from a world that never happened marches through Old Harrow", "chapters": [
        {"id": "E11A", "title": "The Parade", "location": "EXT. OLD HARROW — THE MARKET", "kind": "cutscene", "start": "oh-market",
         "open": L(N, "A parade. Lanterns, music, people in costumes. None of them are real. They're from a festival that never happened here.")
         + L(CIV, "Is it dangerous?")
         + L(N, "Only if you try to stop it. Let it pass."),
         "close": []},
        {"id": "E11B", "title": "Let It Pass", "location": "EXT. OLD HARROW — THE BRIDGE", "kind": "reach", "to": "oh-bridge", "label": "Walk with the parade to the bridge",
         "open": [],
         "close": L(N, "They've crossed the bridge. They're gone.")
         + L(CIV, "My grandmother used to talk about a lantern festival. Nobody believed her. She said it was from another life.")
         + L(N, "Perhaps it was.")},
    ]},
    {"id": "E12", "title": "The Great Migration", "region": "Verdant Forest", "world": "veridan", "after": "11",
     "beat": "The forest's herds move all at once, and the poachers move with them", "chapters": [
        {"id": "E12A", "title": "Moving", "location": "EXT. VERDANT FOREST — THE NORTH GROVE", "kind": "talk", "who": "RANGER", "start": "vf-north-grove",
         "label": "Find the rangers",
         "open": [],
         "close": L(RANGER, "Every herd in the forest is moving north. All at once. They've never done that.")
         + L(N, "They're moving away from a Fracture forming in the south. They know before we do.")
         + L(RANGER, "And the poachers know they're moving.")},
        {"id": "E12B", "title": "Poachers", "location": "EXT. THE NORTH GROVE", "kind": "kills", "amount": 7, "label": "Stop the poachers",
         "open": L(RANGER, "Don't hit the herd. Hit the people with nets."),
         "close": L(RANGER, "The herd's through. Thank you.")
         + L(N, "There are calves. Hundreds. Walking north.")
         + L(O, "Good luck to them.")},
    ]},
]
