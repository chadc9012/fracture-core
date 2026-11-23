"""More character quests: the keepers, the Echo, Vesper, Crane, Halvard and the Engine's phantom child — the people the
later chapters bring in."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "story"))
from common import *

CATEGORY = "character"
VESPER = "VESPER"
HALV = "DR. HALVARD"
PHANTOM = "PHANTOM CHILD"
LUNE = "RESEARCHER LUNE"
KEEPER = "LIGHTHOUSE KEEPER"
CIVILIAN = "CIVILIAN"
ODA = "CHIEF ODA"
ODA_L = (L(ODA, "Eighty of us in a pod built for forty. Nobody complained. Nobody breathed, either.")
         + L(ODA, "There. Look. On fire and everywhere. Again.")
         + L(O, "You've seen it before.")
         + L(ODA, "Once. Once is not enough of anything this good.")
         + L(N, "The engineers are crying. Every one of them.")
         + L(ODA, "Salt water. We're used to it."))

MISSIONS = [
    {"id": "C13", "title": "The Lamp's Room", "giver": "THE ECHO", "region": "Thalassia", "world": "thalassia", "after": "31",
     "beat": "The Echo left a room's worth of itself in NOVA, and it wants to see the sky", "chapters": [
        {"id": "C13A", "title": "A Warm Room", "location": "INT. THALASSIA — THE PORT", "kind": "cutscene", "start": "th-port",
         "open": L(N, "Operator. The room the Echo left in me has started asking questions.")
         + L(O, "What kind of questions?")
         + L(ECHO, "...the lamp says there is a sky... above the water... I have never seen one...")
         + L(N, "It has spent longer than human history in the dark. It would like to see the sky once.")
         + L(O, "Then let's take it up."),
         "close": []},
        {"id": "C13B", "title": "Up", "location": "INT. THALASSIA — THE TRANSIT TUBES", "kind": "reach", "to": "th-arcadia", "label": "Carry the Echo up to the Arcadia dome",
         "open": L(ECHO, "...the water is getting lighter... is that what lighter means..."),
         "close": L(ECHO, "...oh...")
         + L(N, "It's looking through me. At the light on the glass.")
         + L(ECHO, "...it is not a question... the sky is not a question... it is an answer nobody asked for...")
         + L(N, "I think it's happy. I think I am too. We're sharing it.")
         + L(O, "That's the best kind.")},
    ]},
    {"id": "C14", "title": "The Map's Last Sheet", "giver": "AUREN THALE", "region": "The Shattered Expanse", "world": "shattered-reefs", "after": "60",
     "beat": "Auren wants to draw the one place his map never could", "chapters": [
        {"id": "C14A", "title": "Ink", "location": "EXT. THE SHATTERED EXPANSE — THE PORT", "kind": "talk", "who": "AUREN THALE", "start": "sr-port",
         "label": "Meet Auren at the Expanse port",
         "open": [],
         "close": L(AUREN, "The edge of the glass. I've mapped everything else. I want one sheet of the place nobody decided.")
         + L(O, "Can you map somewhere undecided?")
         + L(AUREN, "No. That's why I want to try. Walk with me. Stay close. The ground's still in two minds.")},
        {"id": "C14B", "title": "Survey", "location": "EXT. THE DRIFT", "kind": "trace", "label": "Hold the survey stakes while Auren draws",
         "open": L(AUREN, "Three stakes. I draw between them. Don't let anything knock them over. Especially the ground."),
         "close": L(AUREN, "There. Look. It's blank.")
         + L(O, "You drew nothing?")
         + L(AUREN, "I drew it exactly. It's the most accurate map I've ever made. Nothing's been decided there yet. Isn't it beautiful?")},
    ]},
    {"id": "C15", "title": "The Ledger's Price", "giver": "VESPER", "region": "Neon City", "world": "neon-city", "after": "20",
     "beat": "Somebody wants Vesper dead for selling the ledger's location", "chapters": [
        {"id": "C15A", "title": "Debt", "location": "INT. THE UNDERGROUND — VESPER'S ROOM", "kind": "talk", "who": "VESPER", "start": "neon-underground", "to": "neon-underground",
         "label": "Answer Vesper's call",
         "open": [],
         "close": L(VESPER, "I sold you where the ledger was. Everyone on the ledger knows who sold it. I'd like to keep my head.")
         + L(O, "Who's coming?")
         + L(VESPER, "Everyone who paid into it. Tonight. I'd prefer they find you instead of me.")},
        {"id": "C15B", "title": "Callers", "location": "INT. THE UNDERGROUND", "kind": "survive", "amount": 50, "label": "Keep Vesper's door shut",
         "open": L(VESPER, "I'll be under the desk. Being brave."),
         "close": L(VESPER, "Still have my head. Lovely. What do I owe you?")
         + L(O, "Nothing.")
         + L(VESPER, "Nobody in Neon City has ever said that to me. I'm going to have to sit down.")},
    ]},
    {"id": "C16", "title": "Thaw", "giver": "DR. HALVARD", "region": "Frostveil", "world": "frostveil", "after": "37",
     "beat": "The station's engineers who tried to lift the crown are still silent", "chapters": [
        {"id": "C16A", "title": "Three Engineers", "location": "INT. FROSTVEIL STATION", "kind": "talk", "who": "DR. HALVARD", "start": "fv-station", "to": "fv-station",
         "label": "Find Halvard in the station",
         "open": [],
         "close": L(HALV, "The three who tried to lift the crown. They can hear now. They still can't speak.")
         + L(N, "The Cantor's silence lingers in them. There may be a relay of it under the shelf, still singing.")
         + L(HALV, "Then break it. Please. One of them is my son.")},
        {"id": "C16B", "title": "The Last Note", "location": "EXT. FROSTVEIL — THE SHELF", "kind": "kills", "amount": 6, "to": "fv-shelf", "label": "Break the silence relays",
         "open": L(N, "Small constructs. Humming one note. Over and over."),
         "close": L(HALV, "...He said my name. He said my name. Thank you.")
         + L(N, "The other two are laughing. I think at nothing. I think that's allowed.")},
    ]},
    {"id": "C17", "title": "Vigilance Tells the Best Stories", "giver": "PHANTOM CHILD", "region": "The Origin Engine — the Capital", "world": "nexus", "after": "52",
     "beat": "The phantom child in the Engine wants one last story", "chapters": [
        {"id": "C17A", "title": "The Garden Square", "location": "EXT. THE CELESTIAL CAPITAL — A GARDEN SQUARE", "kind": "talk", "who": "PHANTOM CHILD",
         "start": "nexus-central-plaza", "label": "Find the child in the garden square",
         "open": [],
         "close": L(PHANTOM, "Vigilance! You came back! Tell me a story. The one about the people before the people.")
         + L(N, "...I don't remember it.")
         + L(PHANTOM, "You do. You just have to start.")},
        {"id": "C17B", "title": "Once", "location": "EXT. THE GARDEN SQUARE", "kind": "cutscene",
         "open": L(N, "Once, before there were people, there was a question. And some very tired, very brave people tried to answer it.")
         + L(N, "They couldn't. So they left a seed instead. A seed that would grow into someone who could ask it properly.")
         + L(PHANTOM, "Did the seed grow?")
         + L(N, "It did. It's standing right here. It's quite tall now. It crashes trucks.")
         + L(O, "One truck.")
         + L(PHANTOM, "That's the best ending. Mama said you'd tell it best.")
         + L(N, "She's gone. The Engine's let her rest. I think she was waiting for the end of the story."),
         "close": []},
    ]},
    {"id": "C18", "title": "Names", "giver": "RESEARCHER LUNE", "region": "Nexus City", "world": "nexus", "after": "40",
     "beat": "Lune wants every volunteer in the Ascendancy's records called by their name", "chapters": [
        {"id": "C18A", "title": "Forty-One Files", "location": "INT. ASCENDANCY TOWER", "kind": "hack", "start": "nexus-university", "label": "Open the volunteer files",
         "open": L(LUNE, "Every volunteer is a number in the system. Crane says names make the work harder.")
         + L(O, "He's right. That's why we're doing it."),
         "close": L(N, "Files open. Two hundred and twelve volunteers. Two hundred and twelve names.")}
        ,
        {"id": "C18B", "title": "Read Them", "location": "INT. ASCENDANCY TOWER", "kind": "cutscene",
         "open": L(LUNE, "Tallis Volk. Tomas Arden. Mira Celt. Joan Okafor. Ben and Rosa Lin, twins.")
         + L(LUNE, "I'm going to read all of them. Out loud. It'll take a while.")
         + L(CRANE, "...Go on, Lune. I'm listening.")
         + L(N, "I am recording every one."),
         "close": []},
    ]},
    # ------------------------------------------------------------------------------------- more world events
    {"id": "E13", "title": "The Second Moon", "category": "event", "region": "Nexus City", "world": "nexus", "after": "47",
     "beat": "A reflection of the Engine's sky hangs over Nexus for a night", "chapters": [
        {"id": "E13A", "title": "Two Moons", "location": "EXT. NEXUS — THE HARBOUR", "kind": "cutscene", "start": "nexus-harbor",
         "open": L(N, "There are two moons over Nexus tonight. One of them is the Astryan sky leaking through the Engine.")
         + L(CIVILIAN, "Is it the end of the world?")
         + L(O, "No. It's just a very old sky saying hello."),
         "close": []},
        {"id": "E13B", "title": "Moonstruck", "location": "EXT. NEXUS — THE HARBOUR", "kind": "survive", "amount": 45, "label": "Keep the harbour calm until moonset",
         "open": L(N, "Riftwalkers are stepping through the reflection. Small numbers. Curious."),
         "close": L(N, "Moonset. The second one's gone.")
         + L(CIVILIAN, "My kids want to know if it'll come back.")
         + L(O, "Tell them to keep looking up.")},
    ]},
    {"id": "E14", "title": "The Lantern Road", "category": "event", "region": "Old Harrow", "world": "old-harrow", "after": "70",
     "beat": "After the door is kept, the first visitors from the other side arrive at Old Harrow", "chapters": [
        {"id": "E14A", "title": "Visitors", "location": "EXT. OLD HARROW — THE BRIDGE", "kind": "talk", "who": "CIVILIAN", "start": "oh-market", "to": "oh-bridge",
         "label": "Meet the visitors on the bridge",
         "open": L(N, "Someone has walked out of the old parade's road. Real this time. Carrying a lantern."),
         "close": L(CIVILIAN, "We followed the singing. Is this... is this where the door is?")
         + L(O, "It's one of them. Welcome.")
         + L(CIVILIAN, "We didn't know if anyone would be on this side.")
         + L(N, "There always will be, now. That's what kept means.")},
    ]},
    {"id": "E15", "title": "Dead Air", "category": "event", "region": "Nexus City", "world": "nexus", "after": "08",
     "beat": "Radio Free Nexus goes silent mid-broadcast", "chapters": [
        {"id": "E15A", "title": "Static", "location": "EXT. NEXUS — THE RELAY TOWERS", "kind": "trace", "start": "nexus-central-plaza", "label": "Find out why the free radio stopped",
         "open": L("RADIO FREE NEXUS", "...water at the harbour... shelter at — ")
         + L(N, "The broadcast cut out. All three relays. Something is sitting on them."),
         "close": L("RADIO FREE NEXUS", "...sorry about that, Nexus. A little technical difficulty with a very large bird. We're back. You're not alone.")}
        ,
    ]},
    {"id": "E16", "title": "Bloomfall", "category": "event", "region": "Verdant Forest — Eldergrove", "world": "eldergrove", "after": "62",
     "beat": "Every tree in Eldergrove flowers at once when the fourth seal sings", "chapters": [
        {"id": "E16A", "title": "Petals", "location": "EXT. ELDERGROVE VILLAGE", "kind": "talk", "who": "ELDER MAREN", "start": "eg-village", "to": "eg-village",
         "label": "Find the elder in the falling petals",
         "open": [],
         "close": L("ELDER MAREN", "Every tree flowered at dawn. All of them. Even the dead ones.")
         + L(ILYRA, "The fourth seal sang. The forest heard. It always hears.")
         + L("ELDER MAREN", "Will it happen again?")
         + L(ILYRA, "Every time someone keeps a promise. So, not often. But sometimes.")},
    ]},
    {"id": "E17", "title": "Thalassian Sunrise", "category": "event", "region": "Thalassia", "world": "thalassia", "after": "30",
     "beat": "The engineers' first trip up to see the sunrise", "chapters": [
        {"id": "E17A", "title": "Up Top", "location": "INT. THALASSIA — THE PORT", "kind": "talk", "who": "CHIEF ODA", "start": "th-port", "to": "th-port",
         "label": "Ride the first sunrise pod with the engineers",
         "open": [],
         "close": ODA_L}
        ,
    ]},
    {"id": "E18", "title": "The Quiet Market", "category": "event", "region": "Neon City", "world": "neon-city", "after": "66",
     "beat": "The Choir's last stragglers try to silence Neon's night market", "chapters": [
        {"id": "E18A", "title": "Turn It Up", "location": "EXT. NEON CITY — THE NIGHT MARKET", "kind": "kills", "amount": 8, "start": "neon-dealer",
         "label": "Clear the silence from the market",
         "open": L(N, "The Choir's last constructs. They've found the loudest place in Neon City and are trying to make it quiet.")
         + L(VESPER, "Over my dead body. And my stall's."),
         "close": L(VESPER, "Music back on! Everybody, louder! Louder than that!")
         + L(N, "Four hundred people singing very badly. It's perfect.")},
    ]},
]
