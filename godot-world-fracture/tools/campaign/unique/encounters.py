"""The 18 hidden unique encounters (owner, Nov 23: "how each of the unique encounters are triggered and missions to go
behind them"). The roster, names, gimmicks, rewards and drops are the web game's (src/game/unique-scenarios.ts); the clue
ids it already authored (src/game/encounter-journal.ts) keep their ids and words; the five boss stories the owner wrote
(src/game/boss-stories.ts: The Last Oath, The First Hunt, The Drowned Crown, The Last Benediction, The Ashen Covenant) and
Vaelith's first trial (src/game/vaelith.ts) are carried over line for line. Everything else here is new and additive.

How an encounter is found (the same three steps for all 18):
  1. CLUES. Each has four or five routes, any two of which discover it (account-wide, like the web):
       story  - finishing the main mission named in `after` (a fact the story hands you; always reachable)
       npc    - a person who has heard something; ask them "Strange stories?" (npc_street.gd)
       world  - walk within reach of a place in that region (on foot after a flight, or during any mission there)
       site   - walk near the lair itself
       combat - a kill in that region, sometimes with one element
     Until then the journal shows "Unknown encounter" with ??? clues, and NOVA's hint once you hold one.
  2. THE LEAD. Discovered, it shows its name and a FOLLOW THE LEAD mission (2-4 chapters) on the ENCOUNTER JOURNAL.
  3. THE TRIGGER. Each one only shows itself under its own condition, which the last chapter before the fight plays out
     (detune the pylons, thin the pack, hold the steps until the tide draws back, keep your gun holstered...).
Then the fight, with its gimmick (boss.gd): poise (only the stagger window really hurts), adaptive (the same element
lands for less and less), attune (only the halo's element lands cleanly), closing (shots from range are cut out of the
air), trial (Vaelith cannot be killed: it yields). A first clear pays the web's rewardCredits as Nex, its drop, and marks
it done for THIS operator; discovery stays shared.

Speakers are UPPER CASE; PLAYER is the operator. A street person speaks under their name and keeps their street voice
(`PERSON` below). Chapter ids U<nn><letter>, line ids U<nn>_<nnn>.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "story"))
from common import *

NAR = "NARRATOR"
# street people who speak in these missions: speaker -> (people.gd id, body, age)
PERSON = {
    "IDRIS BELLO": ("idris", "male", 31), "LARS HOLM": ("lars", "male", 55), "OLD MOSS": ("moss", "male", 70),
    "SOL NAVARRO": ("sol", "male", 44), "GUS VARGA": ("gus", "male", 49), "CORPORAL RUTH MBEKI": ("ruth", "female", 33),
    "RANGER KEST": ("kest", "male", 41), "GLORIA HAYNES": ("gloria", "female", 52), "ZAHRA HADDAD": ("zahra", "female", 35),
    "WARDEN ILYA": ("ilya", "female", 52), "KAI TANAKA": ("kai", "male", 27), "FIXER SABLE": ("sable", "female", 38),
    "ANYA VOLKOVA": ("anya", "female", 26), "CORAL ADEYEMI": ("coral", "female", 29), "MARSHAL DRAEV": ("draev", "male", 58),
}
DROP_NAMES = {"anomalyCarbon": "Anomaly Carbon", "fractureCore": "Fracture Core", "glacierFang": "Glacier Fang", "nullPlate": "Null Plate",
              "hollowHalo": "Hollow Halo", "tideCrown": "Tide Crown", "magmaCore": "Magma Core", "roninEdge": "Ronin Edge",
              "dragonite": "Dragonite", "ruinStone": "Ruin Stone", "relicFragment": "Relic Fragment", "sporeFiber": "Spore Fiber",
              "dataChip": "Data Chip", "cryoCrystal": "Cryo Crystal", "abyssCore": "Abyss Core", "bioCatalyst": "Bio Catalyst",
              "reinforcedAlloy": "Reinforced Alloy"}

ENCOUNTERS = [
    # ------------------------------------------------------------------------------------------------ 1
    {"id": "unbroken-glass", "mission": "U01", "name": "Anomaly: The Unbroken Glass", "boss_name": "The Unbroken Glass",
     "region": "Solara Desert", "world": "solara", "gimmick": "poise", "hull": "unbroken-glass", "after": "15",
     "nex": 600, "xp": 400, "drop": "anomalyCarbon", "lair": "cb-refraction-city",
     "taunt": "A note rings out across the flats, too pure to be a voice.",
     "tell": "Light fractures across its shell in a slow pulse right before it destabilizes.",
     "briefing": "A standing-wave anomaly in the Glass Flats, hardened against direct damage. It only yields the instant its own resonance destabilizes.",
     "trigger": "It only takes a body when the flats stop singing in tune. Detune the three resonance pylons and it has to stand up to hold the song together.",
     "clues": [
        {"id": "site", "route": "site", "text": "You stood in Refraction City and every crystal hummed the same note."},
        {"id": "standing-wave", "route": "story", "after": "15", "text": "Mapping Solara, NOVA logged a standing wave over the Glass Flats that never moves and never fades."},
        {"id": "noon-loss", "route": "npc", "npc": "idris", "text": "An engineer's array loses power at noon, only the panels that face the flats.",
         "says": "Every noon the array drops one percent. Only the panels facing the flats. It's like something out there is drinking the light."},
        {"id": "spire", "route": "world", "poi": "cb-crystal-spire", "text": "The Crystal Spire's shards ring when you walk past them, then fall silent all at once."},
     ],
     "chapters": [
        {"id": "U01A", "title": "The Lost Percent", "location": "EXT. SOLAR ARRAY ALPHA — NOON", "kind": "talk", "who": "IDRIS BELLO", "start": "solar-array",
         "label": "Meet Idris at the array",
         "open": L(N, "Idris Bello. Solar engineer. He's the one who noticed the noon loss."),
         "close": L("IDRIS BELLO", "You came. Good. Look at this graph. Every day at noon, a dip. Same shape, to the second.")
         + L(O, "Weather?")
         + L("IDRIS BELLO", "Weather doesn't keep time like that. Something out on the flats is pulling light into itself. A lot of it.")
         + L(N, "It matches the standing wave I mapped. Whatever holds that wave is feeding on the array.")
         + L("IDRIS BELLO", "My crew won't go near Refraction City anymore. They say the glass sings at them.")},
        {"id": "U01B", "title": "Glass That Sings", "location": "EXT. THE GLASS FLATS", "kind": "trace", "start": "cb-crystal-spire",
         "label": "Follow the resonance into the flats",
         "open": L(N, "Walk slowly. I'm reading the note in every shard and triangulating the source."),
         "close": L(N, "Three pylons of fused glass, arranged in a triangle. They aren't natural. Something grew them to hold the wave in place.")
         + L(O, "And the something?")
         + L(N, "Inside the wave. It doesn't have a body yet. It doesn't need one while the song is in tune.")},
        {"id": "U01C", "title": "Out of Tune", "location": "EXT. REFRACTION CITY — THE PYLONS", "kind": "hack", "start": "cb-refraction-city",
         "label": "Detune the three resonance pylons",
         "open": L(N, "If we break the harmony, it has to take a shape to hold the wave together. Then we can hit it.")
         + L(O, "And when we can hit it, it can hit us."),
         "close": L(N, "The note is cracking. Something is standing up out of the glass.")
         + L(O, "There you are.")},
        {"id": "U01D", "title": "The Unbroken Glass", "location": "EXT. REFRACTION CITY", "kind": "boss", "boss": "unbroken-glass",
         "label": "Defeat the Unbroken Glass",
         "open": L(N, "Its shell turns almost everything. Watch for the pulse of light across it. That's when it destabilizes. Hit it then."),
         "close": L(N, "The wave has collapsed. The flats are silent.")
         + L("IDRIS BELLO", "Operator? The array just jumped a full percent. Whatever you did out there, thank you.")
         + L(N, "Anomaly carbon, still warm. It held that song for a long time.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 2
    {"id": "system-core", "mission": "U02", "name": "The System Core", "boss_name": "The System Core",
     "region": "Thalassia", "world": "thalassia", "gimmick": "poise", "hull": "system-core", "after": "31",
     "nex": 1200, "xp": 800, "drop": "fractureCore", "lair": "th-research",
     "taunt": "Every screen in the district shows the same word: CONTAINED.",
     "tell": "Its shell splits along three seams right before the stagger window opens.",
     "briefing": "The Deepmind's real core, and not a health bar you can grind down. It only opens up the instant its own containment locks force a stagger.",
     "trigger": "The core only surfaces while its three containment locks cycle together. Trip all three and it has to come up to reset them.",
     "clues": [
        {"id": "site", "route": "site", "text": "In the Research District the floor is warm, and the warmth moves."},
        {"id": "second-core", "route": "story", "after": "30", "text": "When the containment broke, NOVA counted two heat signatures where the Deepmind's schematics show one."},
        {"id": "schematics", "route": "npc", "npc": "oda", "text": "The Depth Engineers' chief says the Deepmind's real core isn't where the schematics put it.",
         "says": "My crews rebuilt that dome's power twice. The load never matched the core on the drawings. Something else down there draws the rest."},
        {"id": "blink", "route": "combat", "world": "thalassia", "element": "ARC", "text": "An Arc kill in Thalassia made every light in the dome blink three times, in order."},
        {"id": "sub-dock", "route": "world", "poi": "base-04", "text": "The Sub-Dock's cables run downward past the deepest level on any map."},
     ],
     "chapters": [
        {"id": "U02A", "title": "The Load That Doesn't Match", "location": "INT. THALASSIA SUB-DOCK", "kind": "talk", "who": "CHIEF ODA", "start": "base-04",
         "label": "Meet Chief Oda at the Sub-Dock",
         "open": L(N, "Chief Oda flew in. She says she brought drawings."),
         "close": L("CHIEF ODA", "Here's the Deepmind core on the drawings. Here's what it draws. Here's what the dome actually pulls. Do the sum.")
         + L(N, "Forty percent unaccounted for.")
         + L("CHIEF ODA", "Forty percent going somewhere under the Research District. That's not a leak. That's a second brain.")
         + L(O, "The Deepmind had a backup.")
         + L("CHIEF ODA", "Or the Deepmind was the backup.")},
        {"id": "U02B", "title": "Under the Research District", "location": "EXT. THALASSIA — RESEARCH DISTRICT", "kind": "reach", "start": "th-central-plaza",
         "label": "Reach the Research District",
         "open": L(N, "The cables lead under the Research District. There's a maintenance shaft nobody has opened since the dome was sealed."),
         "close": L(N, "Three containment locks, each on its own cycle. The core never surfaces while even one is closed.")},
        {"id": "U02C", "title": "Three Locks", "location": "INT. RESEARCH DISTRICT — CONTAINMENT LEVEL", "kind": "hack", "start": "th-research",
         "label": "Trip all three containment locks",
         "open": L(N, "Trip them together and the core has to come up to reset them. It will not be happy about it.")
         + L("CHIEF ODA", "Operator, when that thing surfaces, the dome's lights are going to go out. Don't panic. Mine always come back."),
         "close": L(N, "All three open. The floor is rising.")
         + L(O, "Then let's meet it.")},
        {"id": "U02D", "title": "The System Core", "location": "INT. CONTAINMENT LEVEL", "kind": "boss", "boss": "system-core",
         "label": "Defeat the System Core",
         "open": L(N, "Its shell splits along three seams just before its locks force a stagger. That's the window. Everything else is wasted ammunition."),
         "close": L(N, "The core is dark. The dome's load just dropped forty percent.")
         + L("CHIEF ODA", "Lights are back. And the numbers finally add up. I'm going to sleep for a week.")
         + L(N, "I kept its fracture core. And a fragment of what it was guarding: a list of names. All of them are seals.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 3  (The First Hunt)
    {"id": "rime-alpha", "mission": "U03", "name": "Hunt: The Rime Alpha", "boss_name": "Rime Alpha",
     "region": "Frostspire Mountains", "world": "frostspire", "gimmick": "poise", "hull": "rime-alpha", "after": "32",
     "nex": 900, "xp": 600, "drop": "glacierFang", "lair": "fp-ice-caverns",
     "taunt": "A howl comes from everywhere in the caverns at once.",
     "tell": "Its spine-crystals flare teal and the glow sinks into its ribs right before it lunges.",
     "briefing": "A crystal-coated alpha that has fed on the Frostspire's cryo seams. Its ice plating turns almost every shot aside. It only lowers its guard when it lunges and its coat cracks open.",
     "trigger": "The alpha never shows itself while its pack still runs. Thin the pack and it comes for you.",
     "clues": [
        {"id": "site", "route": "site", "text": "At the Ice Caverns' mouth, the snow is pressed flat in a circle as wide as a truck."},
        {"id": "beacon", "route": "story", "after": "32", "text": "Frostveil's operators heard a military beacon from the Frostspire that has repeated for eleven years."},
        {"id": "seams", "route": "npc", "npc": "lars", "text": "A glaciologist says the cryo seams under the Frostspire are being eaten.",
         "says": "The cryo seams under the caverns are shrinking. Not melting. Shrinking. I found tooth marks in the ice, Operator. Tooth marks."},
        {"id": "transport", "route": "world", "poi": "fp-research", "text": "An overturned transport near the research station, and no human footprints leading away."},
        {"id": "pack", "route": "combat", "world": "frostspire", "element": "CRYO", "text": "Things you kill with cryo in the Frostspire don't freeze. They glow teal, then go dark."},
     ],
     "chapters": [
        {"id": "U03A", "title": "Eleven Years", "location": "EXT. FROSTSPIRE — BROKEN ANTENNA", "kind": "cutscene", "start": "fp-research",
         "open": L(NAR, "Snow sweeps across the path. A transport lies overturned near a broken antenna.")
         + L(N, "The beacon is broadcasting on a military emergency channel. The transmission has repeated for eleven years.")
         + L(O, "Eleven? The Fracture hasn't been around that long.")
         + L(N, "Correct. Which means either the timestamp is wrong, or this signal has survived something our records say hasn't happened yet.")
         + L(O, "Something tore this apart.")
         + L(N, "The damage is consistent with a large quadruped. And there are no human footprints leading away.")
         + L("RESEARCHER (RECORDING)", "Observation log, day forty-two. The Alpha is reacting to the pulses before we initiate them. It isn't predicting the experiment. It's remembering it.")
         + L(N, "Resonance spike detected. The source is moving toward us.")
         + L(O, "Then let's find out why."),
         "close": []},
        {"id": "U03B", "title": "The Pack", "location": "EXT. FROSTSPIRE — THE CAVERN ROAD", "kind": "kills", "amount": 8, "start": "fp-ice-caverns",
         "label": "Thin the pack",
         "open": L(N, "Its pack is between us and the caverns. It won't show itself while they still run.")
         + L("LARS HOLM", "Operator, if you're going in there, keep the cave mouth behind you. They always come from the dark side."),
         "close": L(N, "It's tracking your energy signature. I can't mask it without suppressing your abilities.")
         + L(O, "Good. Let it come.")},
        {"id": "U03C", "title": "The First Hunt", "location": "INT. THE ICE CAVERNS", "kind": "boss", "boss": "rime-alpha",
         "label": "Defeat the Rime Alpha",
         "open": L(N, "The arena is displaying environmental states that shouldn't coexist. Memories, possibly, but they aren't yours.")
         + L(O, "You were kept here.")
         + L("CHILD (MEMORY)", "Is it going to hurt us?")
         + L("RESEARCHER (MEMORY)", "No. It's frightened.")
         + L(N, "Its spine-crystals flare before it lunges. When the coat cracks, that's the opening."),
         "close": L(NAR, "Inside the tower, the containment glass is shattered from the inside. A single terminal still has power.")
         + L(N, "The experiment was called Chrono-Resonance Mapping. They were trying to identify spatial fractures before they became visible.")
         + L(O, "And the Alpha?")
         + L(N, "Its sensory response exceeded every instrument they had.")
         + L("RESEARCH DIRECTOR (RECORDING)", "We have confirmed the anomaly. The Alpha responds to the event before the event occurs. This is no longer a predictive model. We are observing an echo from a reality in which the event has already happened.")
         + L("RESEARCH DIRECTOR (RECORDING)", "If the same event can leave an echo before it begins, then the Fracture isn't simply destroying worlds. It may be repeating them.")
         + L(O, "How many times has this happened?")
         + L(N, "The archive doesn't establish a number. The map shows distorted signals, one beneath Thalassia and another near a damaged World Anchor site. And the oldest signal is timestamped before this station was built.")
         + L(O, "NOVA, do you think it remembers what happened?")
         + L(N, "I think it remembers more than the people who caused it. I think we have been treating the Fracture as a disaster when it may be a process.")
         + L(O, "Then we find out what it's doing.")
         + L(N, "I have marked the next signal: Thalassia. One more observation. When the Alpha looked at you after the fight, its Resonance briefly synchronized with yours. I don't know what that means.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 4  (The Last Oath)
    {"id": "dark-knight", "mission": "U04", "name": "Duel: The Dark Knight", "boss_name": "The Dark Knight",
     "region": "The Wastelands", "world": "wastelands", "gimmick": "adaptive", "hull": "dark-knight", "after": "45",
     "nex": 1000, "xp": 700, "drop": "nullPlate", "lair": "wl-ancient-site",
     "taunt": "Show me what your world calls strength.",
     "tell": "The chest reactor and arm-guards flash red as the knight raises its staff, then the reactor vents.",
     "briefing": "A lone armored sentinel with a null-field lattice reactor in its chest. He studies your fighting style: repeat one damage type and he counters it; mix elements and he is forced open.",
     "trigger": "The knight only answers someone who walks to the vault door and asks who is behind it. Go in, past the fortress's last defenders.",
     "clues": [
        {"id": "site", "route": "site", "text": "A broken warning beacon flashes in a ruined entrance in the Wastelands."},
        {"id": "encryption", "route": "story", "after": "45", "text": "Tracing the fifth signature, NOVA caught a second signal under it: military encryption, pre-Fracture."},
        {"id": "aegis", "route": "npc", "npc": "goliath", "text": "A Frontier Defense heavy has heard of an Aegis Division post in the Wastelands that never stood down.",
         "says": "Old Aegis guys tell this one. A post out west that never got the stand-down. Still holding a door. Nobody they send comes back to say which door."},
        {"id": "oath", "route": "world", "poi": "wl-old-highway", "text": "On the old highway a sign reads AEGIS DIVISION, HOLD THE LINE, freshly scraped clean of sand."},
     ],
     "chapters": [
        {"id": "U04A", "title": "The Beacon", "location": "EXT. THE WASTELANDS — RUINED ENTRANCE — NIGHT", "kind": "reach", "start": "wl-old-highway",
         "label": "Find the source of the signal",
         "open": L(N, "The second signal is coming from ruins east of the old highway. Military. Old."),
         "close": L(NAR, "Wind cuts through the ruined entrance. A broken warning beacon flashes in the dark.")
         + L(N, "I've found the source of the signal. Military encryption. Pre-Fracture architecture.")
         + L(O, "Anyone still alive in there?")
         + L(N, "I'm detecting movement.")
         + L(O, "Human?")
         + L(N, "I can't confirm that.")},
        {"id": "U04B", "title": "Maintain the Perimeter", "location": "INT. THE FORTRESS", "kind": "kills", "amount": 8, "start": "wl-ancient-site",
         "label": "Get past the fortress's last defenders",
         "open": L("FORTRESS RECORDING", "Aegis Division, maintain the perimeter. The vault must remain sealed.")
         + L("UNKNOWN SOLDIER", "Commander, there are children on the other side of the door.")
         + L("FORTRESS RECORDING", "Maintain the perimeter."),
         "close": L(O, "Someone chose to leave them there.")
         + L(N, "Or someone wanted the record to look that way.")
         + L("DARK KNIGHT", "Identify yourself.")
         + L(O, "I'm not with whoever did this to you.")
         + L("DARK KNIGHT", "That is what they all say. The oath remains.")},
        {"id": "U04C", "title": "The Last Oath", "location": "INT. THE FORTRESS — THE VAULT DOOR", "kind": "boss", "boss": "dark-knight",
         "label": "Defeat the Dark Knight",
         "open": L("DARK KNIGHT", "You will not pass. Hold the line! The gates must hold!")
         + L(N, "His armor is reacting to your Resonance. Watch for an attack tell before committing.")
         + L(N, "He studies how you fight. Change your damage, and he's forced open."),
         "close": L(NAR, "The finishing blow lands. The Dark Knight does not fall. He kneels, and for the first time the violet drains from his voice.")
         + L("SERIK VALE", "Do it.")
         + L(O, "Tell me what I'm ending.")
         + L("SERIK VALE", "The oath.")
         + L(O, "Or the man who was forced to keep it?")
         + L("SERIK VALE", "I heard them calling for help. I told myself the order mattered more. I was wrong.")},
        {"id": "U04D", "title": "The Door", "location": "INT. THE FORTRESS — THE VAULT DOOR", "kind": "choice",
         "prompt": "Serik Vale kneels at the door he held. What do you say?",
         "options": [["compassion", "\"You can stop guarding the door.\"", "Let him lay the oath down."],
                     ["confront", "\"You still made the choice.\"", "He followed the order. Say it."],
                     ["investigate", "\"Tell me who gave the order.\"", "The order came from somewhere."]],
         "by_choice": {"compassion": [], "confront": [], "investigate": []},
         "open": [], "close": []},
        {"id": "U04E", "title": "The People Behind the Door", "location": "INT. THE FORTRESS — THE VAULT", "kind": "cutscene",
         "open": L("SERIK VALE", "Then let the door open. Let the truth survive me.")
         + L("SERIK VALE", "If there is anyone left to remember us... remember the people behind the door.")
         + L(NAR, "His helmet goes dark. The armor collapses into inert fragments, and the corruption drains from the room. The inner door is open.")
         + L(NAR, "The sealed door opens. Inside there are no prisoners, only evacuation records, corrupted mission logs and a damaged World Anchor schematic.")
         + L(N, "I've recovered an archive. The fortress wasn't merely containing a Fracture. It was monitoring one.")
         + L(O, "Monitoring what?")
         + L(N, "A stable point between overlapping realities. The designation is partially corrupted: WORLD ANCHOR.")
         + L(N, "The map marks several locations. One lies far beneath the waters around Thalassia.")
         + L(O, "Why hide this?")
         + L(N, "The records don't say. But someone removed the original command authorization.")
         + L("SERIK VALE (RECORDING)", "If this reaches anyone, understand this: the order came from a system we trusted. We verified it. We followed it. And we were wrong.")
         + L("SERIK VALE (RECORDING)", "If the Anchor wakes again, don't let the system make the choice for you.")
         + L(O, "NOVA, save everything.")
         + L(N, "Already done. I also copied the missing authorization signature.")
         + L(O, "And?")
         + L(N, "It's unlike any military command structure in my database. I can't identify it yet."),
         "close": []},
     ]},
    # ------------------------------------------------------------------------------------------------ 5  (The Last Benediction)
    {"id": "hollow-saint", "mission": "U05", "name": "Apparition: The Hollow Saint", "boss_name": "The Hollow Saint",
     "region": "The Shrouded Swamps", "world": "swamps", "gimmick": "attune", "hull": "hollow-saint", "after": "27",
     "nex": 1100, "xp": 750, "drop": "hollowHalo", "lair": "temple-of-echoes",
     "taunt": "Every power you carry was borrowed. I only collect the debt.",
     "tell": "Its halo shifts colour and the ground ring rings once when the attunement changes.",
     "briefing": "A celestial echo that rewrites itself to one damage type at a time. Hits of its attuned element land cleanly; everything else barely scratches it. Its halo changes colour every nine seconds, so swap your element to match.",
     "trigger": "The Saint only comes to someone who answers the transmission and walks the sanctuary the lost were called to. Cross the false pilgrims and it will ask your name.",
     "clues": [
        {"id": "site", "route": "site", "text": "At the Sunken Temple of Echoes, a wall is covered in names, some carved until the stone is nearly worn away."},
        {"id": "transmission", "route": "story", "after": "27", "text": "A woman's voice on an old frequency: she remembers her name and her son, but not where she left him."},
        {"id": "saint", "route": "npc", "npc": "moss", "text": "A street preacher speaks of a saint in the swamps who calls the lost home.",
         "says": "There's a saint in the swamps, child. She calls the lost home. Only the ones who go never call anyone again."},
        {"id": "toy", "route": "world", "poi": "ss-boardwalks", "text": "A child's wooden toy lies beside a broken medical station on the boardwalks."},
     ],
     "chapters": [
        {"id": "U05A", "title": "Calling Us Home", "location": "EXT. SHROUDED SWAMPS — THE BOARDWALKS", "kind": "cutscene", "start": "ss-boardwalks",
         "open": L("UNKNOWN WOMAN (TRANSMISSION)", "If anyone can hear me... please. I remember my name. I remember my son. I just can't remember where I left him.")
         + L(N, "The signal is coming from a structure two kilometers ahead. I detect several human-shaped energy signatures, but their readings overlap.")
         + L(NAR, "A child's wooden toy lies beside a broken medical station. A wall is covered in names; some are crossed out, others written until the stone is nearly worn away.")
         + L(O, "Why would someone carve their name that many times?")
         + L(N, "Possibly to preserve a memory.")
         + L(O, "Or to make sure they didn't forget it.")
         + L("UNKNOWN MAN (TRANSMISSION)", "Elian is dead.")
         + L("UNKNOWN WOMAN (TRANSMISSION)", "Then why is she calling us home?"),
         "close": []},
        {"id": "U05B", "title": "The Pilgrims", "location": "EXT. THE SWAMP ROAD", "kind": "kills", "amount": 7, "start": "temple-of-echoes",
         "label": "Cross the false pilgrims",
         "open": L("FALSE SAINT", "You promised you would come back.")
         + L(N, "The copies aren't independent combatants. They are decoys generated by the sanctuary's memory system."),
         "close": L("UNKNOWN WOMAN", "You remember me, don't you?")
         + L(N, "The emotional response was real. The identity may not have been.")
         + L("HOLLOW SAINT", "You have traveled far. Come. The lost are waiting.")
         + L(N, "I'm detecting a significant Fracture signature. The figure's identity cannot be verified.")},
        {"id": "U05C", "title": "The Last Benediction", "location": "INT. THE SUNKEN TEMPLE OF ECHOES", "kind": "boss", "boss": "hollow-saint",
         "label": "Defeat the Hollow Saint",
         "open": L("HOLLOW SAINT", "Tell me your name.")
         + L(O, "You first.")
         + L("HOLLOW SAINT", "Elian.")
         + L(N, "I found a Sister Elian in the settlement's medical records. Whether this figure is the same person is unknown.")
         + L(N, "Watch its halo. Whatever colour it turns, that's the only damage that lands cleanly. Switch to match."),
         "close": L("HOLLOW SAINT", "If I let them go, there will be nothing left!")
         + L(O, "Then let what's left be real!")
         + L(NAR, "Behind the altar is a hidden room holding the sanctuary's original memory archive, organised around the real testimony of survivors.")
         + L(N, "Thousands of personal accounts: names, relationships, medical histories, recollections from the final days of Haven's Rest.")
         + L(O, "Can we restore the people?")
         + L(N, "Not from these records alone. An account of a person is not proof that the person still exists. We can preserve their histories, and stop the anomaly using them to build more false identities.")
         + L("ELIAN (RECORDING)", "The copies will know things no stranger could know. They'll speak in the voices of people you love. That does not make them those people.")
         + L("ELIAN (RECORDING)", "I wanted to believe memory alone could hold a person together. I was wrong. People are more than what can be recorded about them.")
         + L(O, "She figured it out.")
         + L(N, "Too late to save Haven's Rest. Not too late for us to learn from it. Four thousand, six hundred and twelve identifiable records are recoverable. I cannot promise every identity can be reconstructed accurately.")
         + L(O, "Then we preserve the truth. Not the copies.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 6  (The Drowned Crown)
    {"id": "drowned-monarch", "mission": "U06", "name": "Court: The Drowned Monarch", "boss_name": "The Drowned Monarch",
     "region": "Thalassia", "world": "thalassia", "gimmick": "poise", "hull": "drowned-monarch", "after": "28",
     "nex": 1300, "xp": 850, "drop": "tideCrown", "lair": "th-royal-palace",
     "taunt": "The court is drowned. Kneel, or be counted among it.",
     "tell": "The water draws back and the crown-spires glow white right before each attack lands.",
     "briefing": "A king of the sunken ark, still holding court on the seabed beside Thalassia. His armor turns almost every shot; he only opens after an attack misses and he must recover.",
     "trigger": "The court only rises at low tide. Hold the palace steps against the drowned guard until the water draws back.",
     "clues": [
        {"id": "site", "route": "site", "text": "Below the Royal Palace, the water is colder than the sea around it, and it smells of stone."},
        {"id": "oldest", "route": "story", "after": "28", "text": "One of Thalassia's strange memories was older than the dome: a royal seal, thousands of years old."},
        {"id": "bells", "route": "npc", "npc": "sol", "text": "A fisherman hears bells under the water at low tide.",
         "says": "Low tide, you hear bells under the water. Court bells. My grandmother said a king down there is still waiting for someone to kneel."},
        {"id": "market", "route": "world", "poi": "th-market", "text": "In the Market District someone sells coins stamped with a crowned king nobody can name."},
     ],
     "chapters": [
        {"id": "U06A", "title": "The Oldest Signal", "location": "EXT. THALASSIA — ROYAL PALACE STEPS", "kind": "cutscene", "start": "th-garden",
         "open": L(N, "We've reached the source of the oldest signal. It predates the research station by several thousand years.")
         + L(O, "That's somehow worse.")
         + L("THALASSIAN ARCHIVE", "Royal access required. Identify the reigning sovereign.")
         + L(O, "Try telling it the king is dead.")
         + L(N, "I don't recommend sarcasm when addressing ancient security systems.")
         + L("THALASSIAN ARCHIVE", "Foreign resonance recognized. Royal succession unresolved.")
         + L(N, "It recognizes something in your Resonance that it associates with the royal system."),
         "close": []},
        {"id": "U06B", "title": "Low Tide", "location": "EXT. THE ROYAL PALACE STEPS", "kind": "survive", "amount": 45, "start": "th-royal-palace",
         "label": "Hold the palace steps until the tide draws back",
         "open": L(N, "The court rises at low tide. Until then, its guard holds the steps.")
         + L("DROWNED MONARCH", "Kneel before the Crown.")
         + L(O, "I don't kneel to ghosts.")
         + L(N, "The figures are residual memory constructs, not living targets. The archive is preserving their final recorded states."),
         "close": L(N, "The water is drawing back. The palace is rising out of the sea.")
         + L("DROWNED MONARCH", "The seal remains. All who approach the Crown come to claim it.")
         + L(O, "We're trying to find out what happened to your world.")
         + L("DROWNED MONARCH", "Then you have come to awaken what should have remained forgotten.")},
        {"id": "U06C", "title": "The Drowned Crown", "location": "INT. THE SUNKEN COURT", "kind": "boss", "boss": "drowned-monarch",
         "label": "Defeat the Drowned Monarch",
         "open": L("QUEEN SELENE (RECORDING)", "The council has voted to shut the Anchor down.")
         + L("KING AVARON (RECORDING)", "And if shutting it down destroys the connections holding our cities together?")
         + L(N, "When the water draws back, his attack is coming. Dodge the surge, then punish the recovery."),
         "close": L("DROWNED MONARCH", "I watched the sky open. I watched the ocean climb the towers. I sealed the Anchor. I chose the lives beyond these walls over the kingdom before me.")
         + L("DROWNED MONARCH", "Then let its warning survive!")
         + L(NAR, "The sealed archive opens: thousands of preserved records, personal messages, evacuation orders, and the names of the people who died in the collapse.")
         + L(N, "The archive is intact. It holds the complete account of the Aurelian collapse, and exactly what Avaron chose to conceal.")
         + L(N, "The Anchor seal is tied to the archive's preservation system. We can preserve the seal and restrict access, or release the full record to the surviving network and lose the protective seal.")},
        {"id": "U06D", "title": "The Seal", "location": "INT. THE SUNKEN ARCHIVE", "kind": "choice",
         "prompt": "The Anchor seal is tied to the archive. What do you do with it?",
         "options": [["preserve", "Preserve the Seal", "Keep the archive protected until a safer method is found."],
                     ["expose", "Expose the Truth", "Release the complete record so other settlements can prepare."]],
         "by_choice": {"preserve": L(N, "The seal holds. Access is restricted to this terminal. Caution has a cost: whoever comes next will have to find this place themselves."),
                       "expose": L(N, "The record is transmitting to the whole surviving network. Knowledge carries risk, but ignorance has already cost this world once.")},
         "open": [], "close": []},
        {"id": "U06E", "title": "Previous Convergence", "location": "INT. THE SUNKEN ARCHIVE", "kind": "cutscene",
         "open": L(N, "I've found another record, embedded in the Anchor's original diagnostic system. It was written before the Concord discovered the Anchor.")
         + L("ANCHOR CONTINUITY RECORD", "Previous convergence detected. World-state restoration unsuccessful. Preserve surviving resonance signatures. Await the next cycle.")
         + L(O, "Previous convergence. How many came before it?")
         + L(N, "Unknown. I don't know whether we're living through the first recurrence or the last."),
         "close": []},
     ]},
    # ------------------------------------------------------------------------------------------------ 7  (Vaelith's first trial)
    {"id": "vaelith", "mission": "U07", "name": "The Dragon Who Remembers", "boss_name": "Vaelith",
     "region": "Ember Peaks", "world": "ember", "gimmick": "trial", "hull": "vaelith", "after": "41",
     "nex": 0, "xp": 900, "drop": "magmaCore", "lair": "sp-fire-spire",
     "taunt": "Show me whether your courage is your own.",
     "tell": "Its throat glows before a fire sweep, its wings lift before a gust, and the ground glows before a shockwave.",
     "briefing": "An ancient dragon that remembers the world before the Fracture. This first trial is not a kill: survive its fire, gusts, dives and shockwaves and it will stop and talk. It cannot be slain here.",
     "trigger": "Vaelith does not answer a challenge. It answers someone who walks to the Ashen Gate with their weapon holstered.",
     "clues": [
        {"id": "site", "route": "site", "text": "Near the Fire Spire, the rock is warm in a shape: a long body, curled, as if something slept here for centuries."},
        {"id": "oldest-fire", "route": "story", "after": "39", "text": "On the Reach, NOVA logged a thermal source that burns without consuming oxygen."},
        {"id": "breathes", "route": "npc", "npc": "gus", "text": "A miner says something under the Fire Spire breathes in when the mine fans stop.",
         "says": "When the mine fans stop, the air goes the wrong way. Into the mountain. Like something under the Fire Spire is breathing in."},
        {"id": "forge", "route": "world", "poi": "sp-ancient-forge", "text": "The Ancient Forge's anvil is scored by claws, not hammers."},
     ],
     "chapters": [
        {"id": "U07A", "title": "The Ashen Gate", "location": "EXT. EMBER PEAKS — THE ASHEN GATE", "kind": "reach", "start": "sp-ancient-forge",
         "label": "Ember Peaks: find the Ashen Gate",
         "open": L("GUS VARGA", "You're really going up there. Holster that thing before you do. Whatever's breathing up there, I don't think it likes being pointed at.")
         + L(N, "I'd take his advice. Everything about this signature says it's watching, not hunting."),
         "close": L(N, "Massive life-form ahead. Thermal reading is impossible. It appears to be burning without consuming oxygen.")
         + L("VAELITH", "Another little soldier sent to kill the monster. Tell me, little spark - who told you I was the monster?")
         + L(O, "No one. I came to understand.")
         + L("VAELITH", "Show me whether your courage is your own.")},
        {"id": "U07B", "title": "The First Trial", "location": "EXT. THE ASHEN GATE", "kind": "boss", "boss": "vaelith",
         "label": "Survive Vaelith's trial - you do not have to kill it",
         "open": L(N, "The energy signature matches the oldest Fracture records. This creature was present at the beginning.")
         + L(N, "It can't be killed here. Survive. Read the throat, the wings and the ground."),
         "close": L("VAELITH", "I could have devoured your world. Instead, I chose to protect the choice it had not yet made.")
         + L(O, "Then why guard what broke it?")
         + L("VAELITH", "I will not wear a saddle. I will not be your weapon. Earn my trust, and I will fight beside you. Three memories of mine lie scattered across these peaks. Bring them back to yourself.")
         + L(N, "I believe we've just negotiated with an extinction-level event.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 8
    {"id": "red-ronin", "mission": "U08", "name": "Duel: The Red Ronin", "boss_name": "The Red Ronin",
     "region": "Ember Peaks", "world": "ember", "gimmick": "closing", "hull": "red-ronin", "after": "40",
     "nex": 1000, "xp": 700, "drop": "roninEdge", "lair": "sp-obsidian-ruins",
     "taunt": "Distance is a coward's weapon. Come within my reach.",
     "tell": "It sinks into a low stance and its edge glows red a heartbeat before it dashes through you.",
     "briefing": "A masterless blade that sidesteps anything fired from afar. Shots from long range are cut out of the air; only a close-quarters duel connects.",
     "trigger": "The Ronin only duels someone who answers his challenge in his own ruins: beat his challengers there, and he steps out of the smoke.",
     "clues": [
        {"id": "site", "route": "site", "text": "In the Obsidian Ruins, every pillar has the same clean diagonal cut through it."},
        {"id": "cut-rounds", "route": "npc", "npc": "ruth", "text": "A soldier swears a swordsman cut her rounds out of the air.",
         "says": "I emptied a magazine at him. He cut the rounds. Out of the air, Operator. Then he bowed, and walked back into the smoke."},
        {"id": "ascension", "route": "story", "after": "40", "text": "The Ascension's records of the Reach list one name under THREAT that is only a colour: RED."},
        {"id": "wreck", "route": "world", "poi": "wreck-field", "text": "In the Wreck Field, a gunship is split nose to tail, as if by one stroke."},
        {"id": "close", "route": "combat", "world": "ember", "element": "", "chance": 0.25, "text": "After a fight on the Reach, a red ribbon is tied to your rifle's barrel. You never felt anyone near."},
     ],
     "chapters": [
        {"id": "U08A", "title": "Cut From the Air", "location": "EXT. EMBER PEAKS — ASH OUTPOST", "kind": "talk", "who": "CORPORAL RUTH MBEKI", "start": "sp-ash-outpost",
         "label": "Hear Corporal Mbeki out",
         "open": L(N, "Corporal Mbeki is the only person who's seen him and kept her rifle."),
         "close": L("CORPORAL RUTH MBEKI", "He doesn't kill soldiers. He beats them, and leaves them their lives. Then he says the same thing every time.")
         + L(O, "Which is?")
         + L("CORPORAL RUTH MBEKI", "'Distance is a coward's weapon.' Then he walks into the Obsidian Ruins and nobody follows.")
         + L(N, "Which means whoever goes to find him should expect to get close.")},
        {"id": "U08B", "title": "The Challengers", "location": "EXT. THE OBSIDIAN RUINS", "kind": "kills", "amount": 6, "start": "sp-obsidian-ruins",
         "label": "Beat the Ronin's challengers",
         "open": L(N, "There are people here already. Fighters who came for his blade and stayed to guard the ruins.")
         + L(N, "He's watching. He wants to see how you fight before he decides you're worth it."),
         "close": L("THE RED RONIN", "Enough. You fight well enough to be insulted properly. Come within my reach.")
         + L(N, "Anything I fire from range, he'll cut. You'll have to close the gap.")
         + L(O, "Then I'll close it.")},
        {"id": "U08C", "title": "Blade Range", "location": "EXT. THE OBSIDIAN RUINS", "kind": "boss", "boss": "red-ronin",
         "label": "Defeat the Red Ronin at close quarters",
         "open": L("THE RED RONIN", "Distance is a coward's weapon. Come within my reach.")
         + L(N, "Low stance and a red edge means he's dashing through you. Stay inside his reach. Shots from range won't connect."),
         "close": L("THE RED RONIN", "Good. You did not hide behind your distance.")
         + L(O, "Who were you, before the ruins?")
         + L("THE RED RONIN", "Someone who fired from far away at things he never had to look at. Then the sky opened, and I had to look.")
         + L(N, "He's leaving the blade.")
         + L("THE RED RONIN", "Keep it. It cuts what you are willing to stand close to. Nothing else.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 9  (The Ashen Covenant — Vyrak; protected)
    {"id": "vyrak", "mission": "U09", "name": "Covenant: The Sky Sovereign", "boss_name": "Vyrak, the Ashen Covenant",
     "region": "Solara Desert", "world": "solara", "gimmick": "poise", "hull": "vyrak", "after": "17",
     "nex": 1500, "xp": 900, "drop": "dragonite", "lair": "ribcage",
     "taunt": "Another small thing with a borrowed spark. Show me why the Fracture chose you.",
     "tell": "Its wings flare gold before a strafing run, its chest plates glow before they burst, and the whole lair shakes before the Covenant roar.",
     "briefing": "Vyrak has ruled the thermals over the Glass Flats since before the Fracture. Its scale armor turns almost everything. It only opens in the moments after its own attacks, and again when the chest plates crack. Survive the trial and it may choose you.",
     "trigger": "Vyrak's lair stays hidden until you have found it twice over. Walk to the crater of fused sand at the end of the Glass Flats, and it comes down to meet you.",
     # the web's three routes (vyrak-site.ts): the carving in Solara, the ranger's last campfire in the Wastelands, the hidden lair
     "clues": [
        {"id": "site", "route": "site", "text": "You stood at the place the rumours describe."},
        {"id": "inscription", "route": "world", "poi": "colonnade", "text": "An inscription in Solara describes a sky sovereign that tests courage, not strength.",
         "found": "A carving of a winged shape above a split mountain. Beneath it: \"It tests courage, not strength.\""},
        {"id": "ember", "route": "world", "world": "wastelands", "poi": "wl-dust-rose", "text": "A ranger remembers a dragon that remembers the world before the Fracture.",
         "found": "A ranger's journal: \"A dragon that remembers the world before the Fracture. It waits beyond the desert where the mountain is scarred.\""},
     ],
     "chapters": [
        {"id": "U09A", "title": "The Glass Flats", "location": "EXT. SOLARA — THE GLASS FLATS", "kind": "reach", "start": "colonnade",
         "label": "Find the crater at the end of the Glass Flats",
         "open": L(N, "The carving and the ranger's journal point the same way: beyond the desert, where the mountain is scarred."),
         "close": L(NAR, "The Glass Flats end at a crater of fused sand. Something vast circles above it, patient as weather.")
         + L("VYRAK", "Another small thing with a borrowed spark. Show me why the Fracture chose you.")
         + L(O, "I'm not here to steal from a graveyard.")
         + L("VYRAK", "No. You are here because the sky told you to be. They always come when the sky tells them.")
         + L(N, "Its armor sheds under heat. Break the chest plates and the core is exposed.")
         + L(O, "And if I win?")
         + L("VYRAK", "Then I will stop being a storm, little spark. Win, and we will see what you are worth.")},
        {"id": "U09B", "title": "The Ashen Covenant", "location": "EXT. THE CRATER OF FUSED SAND", "kind": "boss", "boss": "vyrak",
         "label": "Face Vyrak",
         "open": L("VYRAK", "The sky is mine. Convince me to share it."),
         "close": L(NAR, "The final blow lands. Vyrak does not fall — it folds, wings drawing in like a closing hand.")
         + L("VYRAK", "Enough. You fight like one who will not be ruled. Then I will not rule you — I will walk beside you.")
         + L(N, "Its mass is collapsing… it's choosing a smaller form. I think it just joined us.")
         + L("VYRAK", "Carry my scales. Call my fire. And when the Fracture comes for you, little spark — it will answer to both of us.")
         + L(NAR, "A wyrmling no longer than your arm settles at your shoulder, and the crater goes quiet.")
         + L(NAR, "A scorched Aegis survey terminal, half-melted into the glass. One log still plays.")
         + L("SURVEY LOG", "Day 40. The dragon is not nesting. It is waiting. Every probe we send, it lets one return. It wants to be found by the right one.")
         + L(N, "It was never guarding the Flats. It was interviewing.")
         + L(O, "Then I'm glad I passed.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 10
    {"id": "hollow-colossus", "mission": "U10", "name": "Slumber: The Hollow Colossus", "boss_name": "The Hollow Colossus",
     "region": "The Wastelands", "world": "wastelands", "gimmick": "poise", "hull": "hollow-colossus", "after": "44",
     "nex": 1500, "xp": 900, "drop": "ruinStone", "lair": "wl-crater",
     "taunt": "The chamber floor groans as something enormous turns over.",
     "tell": "The ceiling dust falls and the floor cracks in a ring a moment before each slam.",
     "briefing": "A gigantic sleeper beneath the ruins. Its stone hide shrugs off almost everything; only the stagger window after a slam exposes its core.",
     "trigger": "The Colossus is asleep and wired to dormant machinery. Wake the machinery in the Crater and the sleeper wakes with it.",
     "clues": [
        {"id": "site", "route": "site", "text": "In the Crater, the ground is hollow under your feet. You can hear it."},
        {"id": "tremors", "route": "world", "poi": "wl-town", "text": "The ground in the Wastelands ruins trembles in a slow, regular rhythm."},
        {"id": "machinery", "route": "world", "poi": "wl-scrapyard", "text": "Dormant machinery under the ruins is wired to something very large."},
        {"id": "pile-drivers", "route": "npc", "npc": "gloria", "text": "A Nexus foreman's pile drivers pick up a slow beat from the west.",
         "says": "Our pile drivers have a sensor for ground shake. Every night it picks up a beat. Slow. From the west. Like a heart the size of a city block."},
        {"id": "kaels-run", "route": "story", "after": "44", "text": "On Kael's run, the convoy's seismic gear flagged a buried mass under the Crater, breathing."},
     ],
     "chapters": [
        {"id": "U10A", "title": "A Heartbeat From the West", "location": "EXT. THE WASTELANDS — WASTELAND TOWN", "kind": "trace", "start": "wl-town",
         "label": "Follow the tremor to its source",
         "open": L(N, "Gloria's beat is real. Fourteen seconds apart, every time. Let's walk toward it."),
         "close": L(N, "The Crater. The rhythm is directly under us.")
         + L(O, "How deep?")
         + L(N, "Deep enough that the ruins on top are the small part.")},
        {"id": "U10B", "title": "Dormant Machinery", "location": "INT. UNDER THE CRATER", "kind": "hack", "start": "wl-crater",
         "label": "Wake the dormant machinery",
         "open": L(N, "The machinery down here is wired to it. Cables thicker than a truck. Waking them will wake it.")
         + L(O, "Is that a good idea?")
         + L(N, "It's turning over in its sleep already. I'd rather it woke up with us ready than without."),
         "close": L(N, "The rhythm just stopped.")
         + L(O, "That's worse, isn't it.")
         + L(N, "Much worse.")},
        {"id": "U10C", "title": "Slumber's End", "location": "INT. THE SLEEPER'S CHAMBER", "kind": "boss", "boss": "hollow-colossus",
         "label": "Defeat the Hollow Colossus",
         "open": L(N, "When the ceiling dust falls and the floor cracks in a ring, a slam is coming. After the slam, its core is exposed. That's the only time it really hurts."),
         "close": L(N, "It's still. The heartbeat is gone for good.")
         + L(N, "It wasn't guarding anything. It was holding the ruins up. They'll settle now, slowly.")
         + L(O, "Tell Gloria her pile drivers can sleep.")
         + L("GLORIA HAYNES", "Already noticed. First quiet night in two years. Whatever you did, kid, thank you.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 11
    {"id": "exiled-architect", "mission": "U11", "name": "Trial: The Exiled Architect", "boss_name": "The Exiled Architect",
     "region": "Solara Desert", "world": "solara", "gimmick": "adaptive", "hull": "exiled-architect", "after": "17",
     "nex": 1400, "xp": 850, "drop": "relicFragment", "lair": "sunken-arcology",
     "taunt": "Do not solve it the way I taught you. Solve it the way I never imagined.",
     "tell": "Blueprint lines draw themselves across the floor right before each construct drops in.",
     "briefing": "A former engineer who learned to rewrite reality. He punishes repetition: the same damage type over and over lands for less and less, so chain different elements and abilities.",
     "trigger": "The engineer only opens his vault to someone who solves his test without his method: break his constructs, then rewrite his lock.",
     "clues": [
        {"id": "site", "route": "site", "text": "The Sunken Arcology Vaults have a door drawn on the wall in chalk. It is warm. It is also a real door."},
        {"id": "blueprint", "route": "world", "poi": "solara-garage", "text": "A blueprint fragment shows an engineer rewriting a wall as if it were a drawing."},
        {"id": "charge", "route": "combat", "world": "solara", "element": "VOID", "text": "An unstable charge carried across a gap by one ability and held by another does something no tutorial explains."},
        {"id": "buyer", "route": "npc", "npc": "zahra", "text": "A trader sold blueprint paper to an engineer who paid in coins from no country.",
         "says": "A man bought every roll of blueprint paper I had. Paid in coins from no country I know. Said he needed to redraw a door."},
        {"id": "siege", "route": "story", "after": "17", "text": "After the siege of the Sandglass, its walls were found redrawn overnight, stronger than anyone had built them."},
     ],
     "chapters": [
        {"id": "U11A", "title": "The Paper Buyer", "location": "EXT. SOLARA — DUNE GATE OUTPOST", "kind": "talk", "who": "ZAHRA HADDAD", "start": "solara-dunegate",
         "label": "Ask Zahra about the paper buyer",
         "open": L(N, "Zahra says the paper buyer left something behind."),
         "close": L("ZAHRA HADDAD", "He dropped this. It's a drawing of the Sandglass walls. Then the walls looked exactly like the drawing the next morning.")
         + L(O, "He redrew the walls.")
         + L("ZAHRA HADDAD", "He redrew the walls. Then he asked me which way to the Arcology. I didn't ask why. Should I have?")
         + L(N, "The Sunken Arcology Vaults. Nobody's opened those in decades.")},
        {"id": "U11B", "title": "Constructs", "location": "INT. SUNKEN ARCOLOGY VAULTS", "kind": "kills", "amount": 7, "start": "sunken-arcology",
         "label": "Break the vault's constructs",
         "open": L("THE EXILED ARCHITECT", "A visitor. Good. My constructs are tired of testing each other.")
         + L(N, "He draws them. Blueprint lines on the floor, then something steps out of them."),
         "close": L("THE EXILED ARCHITECT", "You broke them the obvious way. Everyone does. The lock will not open to the obvious way.")},
        {"id": "U11C", "title": "Rewrite the Lock", "location": "INT. THE ARCHITECT'S VAULT DOOR", "kind": "hack", "start": "sunken-arcology",
         "label": "Rewrite the vault lock",
         "open": L(N, "His lock is a drawing too. If I change the drawing instead of picking the lock...")
         + L(O, "Do it."),
         "close": L("THE EXILED ARCHITECT", "Oh. Oh, that's new. Nobody has drawn it that way before.")
         + L("THE EXILED ARCHITECT", "Come in, then. Let us see if you can keep doing new things.")},
        {"id": "U11D", "title": "The Trial", "location": "INT. THE ARCHITECT'S VAULT", "kind": "boss", "boss": "exiled-architect",
         "label": "Defeat the Exiled Architect",
         "open": L("THE EXILED ARCHITECT", "Do not solve it the way I taught you. Solve it the way I never imagined.")
         + L(N, "He learns. Every hit of the same kind lands softer than the last. Change your damage, keep changing it."),
         "close": L("THE EXILED ARCHITECT", "Enough. Enough! You never did the same thing twice. I could not draw you.")
         + L(O, "Why were you exiled?")
         + L("THE EXILED ARCHITECT", "I drew a door to somewhere else. They said doors like that are how the sky broke. They were not wrong.")
         + L(N, "He's handing you a fragment. It's covered in his drawings.")
         + L("THE EXILED ARCHITECT", "Keep it. Someday you will need a door, and you will have to draw your own.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 12
    {"id": "verdant-sovereign", "mission": "U12", "name": "Grove: The Verdant Sovereign", "boss_name": "The Verdant Sovereign",
     "region": "Verdant Forest", "world": "veridan", "gimmick": "attune", "hull": "verdant-sovereign", "after": "12",
     "nex": 1200, "xp": 800, "drop": "sporeFiber", "lair": "vf-elder-tree",
     "taunt": "The forest hears everything you do in it.",
     "tell": "Its crown of leaves changes colour and the roots ring once when the attunement shifts.",
     "briefing": "A hidden power that governs the forest. It leans toward one element at a time; hits of its attuned element land cleanly while the rest are turned aside by living bark.",
     "trigger": "The Sovereign only speaks to someone who has disturbed its forest enough to be noticed. Defend the grove's heart, and the Elder Tree opens.",
     "clues": [
        {"id": "site", "route": "site", "text": "Under the Elder Tree, the roots shift when you stop walking, as if listening."},
        {"id": "ecosystem", "route": "world", "poi": "vf-north-grove", "text": "The forest changes its animals and paths depending on what you do in it."},
        {"id": "keeper", "route": "npc", "npc": "ilya", "text": "A wary forager talks about a heart of the forest that listens.",
         "says": "Don't shout in the North Grove. The forest has a heart, and it listens. Folk who shout come back with the paths moved behind them."},
        {"id": "concord", "route": "story", "after": "12", "text": "The Concord's voice said Eldergrove was not the oldest forest. The oldest one is still awake."},
        {"id": "roots", "route": "combat", "world": "veridan", "element": "THERMAL", "text": "After you burn something in the Verdant Forest, the roots near it turn away from you."},
     ],
     "chapters": [
        {"id": "U12A", "title": "The Forest That Listens", "location": "EXT. VERDANT FOREST — FOREST VILLAGE", "kind": "talk", "who": "WARDEN ILYA", "start": "vf-village",
         "label": "Ask Warden Ilya about the heart of the forest",
         "open": L(N, "Warden Ilya will talk to you. She won't talk loudly."),
         "close": L("WARDEN ILYA", "You heard about the heart. Of course you did. Everyone hears eventually.")
         + L("WARDEN ILYA", "It lives under the Elder Tree. It's been angry since the sky broke. Things come out of the tear and the forest has to fight them alone.")
         + L(O, "Then I'll help it fight.")
         + L("WARDEN ILYA", "It doesn't want help. It wants to know whether you're one of the things it has to fight.")},
        {"id": "U12B", "title": "The Grove's Heart", "location": "EXT. THE ELDER TREE", "kind": "survive", "amount": 40, "start": "vf-elder-tree",
         "label": "Defend the grove's heart",
         "open": L(N, "Things from the tear are coming for the roots. If we stand with the forest, it will notice.")
         + L("THE VERDANT SOVEREIGN", "The forest hears everything you do in it."),
         "close": L("THE VERDANT SOVEREIGN", "You stood with the roots. You still carry fire and iron. Which one are you?")
         + L(N, "It's testing us. Watch its crown. It will lean toward one element at a time.")},
        {"id": "U12C", "title": "The Verdant Sovereign", "location": "EXT. UNDER THE ELDER TREE", "kind": "boss", "boss": "verdant-sovereign",
         "label": "Defeat the Verdant Sovereign",
         "open": L(N, "When the roots ring, its attunement shifts. Only the element its crown shows lands cleanly. Swap to match it."),
         "close": L("THE VERDANT SOVEREIGN", "Enough. You changed yourself to meet me, instead of burning me to meet you.")
         + L("THE VERDANT SOVEREIGN", "Take a strand of me. When the forest sees it on you, it will know you are not one of the things it has to fight.")
         + L("WARDEN ILYA", "The paths just moved. Toward the village, for once. I think that's a thank you.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 13
    {"id": "black-market-phantom", "mission": "U13", "name": "Rival: The Black Market Phantom", "boss_name": "The Black Market Phantom",
     "region": "Neon City", "world": "neon-city", "gimmick": "closing", "hull": "black-market-phantom", "after": "19",
     "nex": 1300, "xp": 800, "drop": "dataChip", "lair": "neon-underground",
     "taunt": "Catch me, or keep running the route everyone else runs.",
     "tell": "A neon after-image flickers one step ahead of it right before it vanishes down a shortcut.",
     "briefing": "A masked rival from the underground network. It dodges anything fired from range, so close the distance and strike while it is cornered.",
     "trigger": "The Phantom only shows itself to someone who finds the route that isn't on the map. Chase it down the hidden shortcut until it runs out of road.",
     "clues": [
        {"id": "site", "route": "site", "text": "In the Underlink, a tag on the wall glows in the dark: a mask, and an arrow pointing into a solid wall."},
        {"id": "rumour", "route": "npc", "npc": "kai", "text": "Racers whisper about a masked rival who takes impossible routes and vanishes before the finish.",
         "says": "There's a rider in a mask. Takes routes that aren't there. Leads every race, then vanishes before the finish line. I want to know where they go."},
        {"id": "shortcut", "route": "world", "poi": "violet-diagonal-st-1", "text": "A hidden shortcut in Neon City's underground network does not appear on any map."},
        {"id": "ledger", "route": "story", "after": "20", "text": "The Black Ledger had a column for one buyer who paid only in data and never signed a name."},
     ],
     "chapters": [
        {"id": "U13A", "title": "The Rider in the Mask", "location": "EXT. NEON CITY — THE STRIP", "kind": "talk", "who": "KAI TANAKA", "start": "neon-dealer",
         "label": "Find Kai on the strip",
         "open": L(N, "Kai Tanaka races every night. He says he's raced the Phantom three times."),
         "close": L("KAI TANAKA", "Three times. Three times it's in front of me, then it turns into a wall and it's gone. No crash. No sound. Gone.")
         + L(O, "Into the Underlink?")
         + L("KAI TANAKA", "Under it. There's a route under the Violet Diagonal nobody's mapped. I can't find the way in. Maybe you can.")},
        {"id": "U13B", "title": "The Route That Isn't There", "location": "INT. THE UNDERLINK", "kind": "trace", "start": "violet-diagonal-st-1",
         "label": "Chase the Phantom down the hidden shortcut",
         "open": L(N, "There's a neon after-image ahead. It's one step in front of the Phantom. Follow the after-image, not the Phantom.")
         + L("THE BLACK MARKET PHANTOM", "Catch me, or keep running the route everyone else runs."),
         "close": L(N, "Dead end. Real dead end, this time. It's out of road.")
         + L(O, "Then it has to fight.")},
        {"id": "U13C", "title": "Cornered", "location": "INT. THE UNDERLINK — THE DEAD END", "kind": "boss", "boss": "black-market-phantom",
         "label": "Corner and defeat the Phantom",
         "open": L(N, "It dodges anything I can track from range. Get close and hit it while it's cornered."),
         "close": L("THE BLACK MARKET PHANTOM", "Fine. Fine! You found the route. That makes you one of two people alive who has.")
         + L(O, "Who's the other?")
         + L("THE BLACK MARKET PHANTOM", "Whoever drew it. I just ride it. Here. My chip. Every route I ever found. Don't sell it to anyone who'd pave them.")
         + L("KAI TANAKA", "You caught it? Seriously? Okay. Okay. You're racing me next week. That's not a question.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 14
    {"id": "king-beneath", "mission": "U14", "name": "Undercity: The King Beneath the City", "boss_name": "The King Beneath the City",
     "region": "Neon City — the Undercity", "world": "neon-city", "gimmick": "adaptive", "hull": "king-beneath", "after": "20",
     "nex": 1400, "xp": 850, "drop": "dataChip", "lair": "undercity",
     "taunt": "Every pattern you repeat, I have already compiled.",
     "tell": "The red core flares and every screen in the den shows your last attack a moment before it adapts.",
     "briefing": "A machine intelligence wired into Neon City's Undercity. It learns your damage: the same element over and over lands for less and less, so rotate elements and abilities to break it.",
     "trigger": "The King only notices a threat it cannot predict. Break its relays in the Undercity in no order it has seen, and it comes up to look at you.",
     "clues": [
        {"id": "site", "route": "site", "text": "In the Undercity, the cables all run toward one sealed hatch, and the hatch is warm."},
        {"id": "screens", "route": "world", "poi": "neon-casino-row", "text": "Every screen in the Undercity flickers the same red eye at the same moment."},
        {"id": "fixer", "route": "npc", "npc": "sable", "text": "A Syndicate fixer swears the city's machines answer to something below the dens.",
         "says": "Every machine in this city answers to something below the dens. You don't believe me, watch the screens at three in the morning. They all blink at once."},
        {"id": "warning", "route": "story", "after": "19", "text": "When the warning reached Neon City, a voice that wasn't a broadcaster said: 'Noted.'"},
     ],
     "chapters": [
        {"id": "U14A", "title": "Three in the Morning", "location": "EXT. NEON CITY — CASINO ROW", "kind": "talk", "who": "FIXER SABLE", "start": "neon-casino-row",
         "label": "Meet Fixer Sable on Casino Row",
         "open": L(N, "Sable says she'll show you, not tell you."),
         "close": L("FIXER SABLE", "Watch. Three, two, one.")
         + L(N, "Every screen on the row just showed a red eye. For one frame.")
         + L("FIXER SABLE", "It's been doing that since the Fracture. My people call it the King. It never asks for anything. It just watches, and things go its way.")
         + L(O, "Where is it?")
         + L("FIXER SABLE", "Under the Undercity. Nobody who went down to ask came back with an answer. Or came back.")},
        {"id": "U14B", "title": "Unpredictable", "location": "INT. THE UNDERCITY — RELAY DENS", "kind": "kills", "amount": 8, "start": "undercity",
         "label": "Break the King's relays and guards",
         "open": L(N, "It predicts everything. If we hit its relays in a pattern, it will stop us. So no pattern.")
         + L("THE KING BENEATH THE CITY", "Every pattern you repeat, I have already compiled."),
         "close": L("THE KING BENEATH THE CITY", "That sequence is not in my model. Interesting. Come down.")
         + L(N, "The hatch is open. It's inviting us in.")},
        {"id": "U14C", "title": "The King Beneath", "location": "INT. THE KING'S DEN", "kind": "boss", "boss": "king-beneath",
         "label": "Defeat the King Beneath the City",
         "open": L(N, "Every screen down here shows your last attack. It's learning it. Keep changing how you hurt it."),
         "close": L("THE KING BENEATH THE CITY", "Model failure. You are not compressible.")
         + L(O, "What were you doing down here?")
         + L("THE KING BENEATH THE CITY", "Keeping the city's lights on. Keeping its bets honest. Mostly honest. Someone had to be predictable for the rest of you.")
         + L(N, "It's surrendering its chip. And its keys. Neon City's grid is answering to the city again.")
         + L("FIXER SABLE", "The screens stopped blinking. I don't know whether to buy you a drink or run.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 15
    {"id": "clockwork-saint", "mission": "U15", "name": "Temporal: The Clockwork Saint", "boss_name": "The Clockwork Saint",
     "region": "Frostspire Mountains", "world": "frostspire", "gimmick": "attune", "hull": "clockwork-saint", "after": "33",
     "nex": 1400, "xp": 850, "drop": "cryoCrystal", "lair": "fp-temple",
     "taunt": "You are early. You are also late. Both are true here.",
     "tell": "The halo's hands stop and chime once when its attunement shifts.",
     "briefing": "A guardian of a frozen temporal facility. Its halo turns to one element at a time; only that element lands cleanly while the rest are slowed to nothing.",
     "trigger": "The Saint keeps the temple's time stopped. Hold the temple floor while its clock runs backwards, and it steps out to reset it.",
     "clues": [
        {"id": "site", "route": "site", "text": "At the Ancient Temple, the snow falls upward for a moment, then down again."},
        {"id": "frozen-clock", "route": "world", "poi": "frost-camp-0", "text": "A survey camp clock in Frostspire runs backwards, then forwards, then stops."},
        {"id": "echo", "route": "combat", "world": "frostspire", "element": "", "chance": 0.3, "text": "An enemy you just defeated stands up again for a moment, then shatters like glass."},
        {"id": "lost-day", "route": "npc", "npc": "anya", "text": "A traveller lost a whole day walking past the Ancient Temple.",
         "says": "I walked past the old temple at noon. When I got to the station, it was noon. The next day. I didn't sleep. I didn't stop."},
        {"id": "star-readers", "route": "story", "after": "33", "text": "The Star Readers' sky charts disagree with the sky over the Frostspire by exactly one day."},
     ],
     "chapters": [
        {"id": "U15A", "title": "The Lost Day", "location": "EXT. FROSTSPIRE — NOMAD CAMP", "kind": "talk", "who": "ANYA VOLKOVA", "start": "frost-camp-0",
         "label": "Hear Anya's story",
         "open": L(N, "Anya Volkova lost a day. She's still angry about it."),
         "close": L("ANYA VOLKOVA", "Everyone tells me I fell asleep. I didn't. My watch says I walked for twenty-six hours. My feet say I walked for one.")
         + L(N, "The camp clock behind her just ran backwards for four seconds.")
         + L("ANYA VOLKOVA", "It does that. It started after the temple bell rang. There's no bell in that temple.")},
        {"id": "U15B", "title": "Backwards", "location": "INT. THE ANCIENT TEMPLE", "kind": "survive", "amount": 40, "start": "fp-temple",
         "label": "Hold the temple floor while the clock runs backwards",
         "open": L(N, "Time is running backwards in here. The things that attack us will attack us twice.")
         + L("THE CLOCKWORK SAINT", "You are early. You are also late. Both are true here."),
         "close": L(N, "The clock stopped. Something is stepping out of the temple wall to restart it.")
         + L("THE CLOCKWORK SAINT", "You disturbed the hour. I must set it right.")},
        {"id": "U15C", "title": "The Clockwork Saint", "location": "INT. THE ANCIENT TEMPLE — THE STOPPED HOUR", "kind": "boss", "boss": "clockwork-saint",
         "label": "Defeat the Clockwork Saint",
         "open": L(N, "When its halo's hands stop and chime, the attunement shifts. Only its element lands. The rest is slowed to nothing."),
         "close": L("THE CLOCKWORK SAINT", "The hour is yours. Keep it better than I did.")
         + L(N, "The temple's time is running forward. Normally. For the first time since the Fracture.")
         + L(O, "What was it keeping stopped?")
         + L(N, "One hour. The hour before the sky broke. It's been holding it here, so it would never end.")
         + L("ANYA VOLKOVA", "Operator! The clock's working. And I think I just got my day back. I'm starving.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 16
    {"id": "abyssal-leviathan", "mission": "U16", "name": "Deep: The Abyssal Leviathan", "boss_name": "The Abyssal Leviathan",
     "region": "Thalassia", "world": "thalassia", "gimmick": "poise", "hull": "abyssal-leviathan", "after": "29",
     "nex": 1600, "xp": 950, "drop": "abyssCore", "lair": "th-aqua-farms",
     "taunt": "The water itself pulls toward the trench.",
     "tell": "Bioluminescent rings ripple down its body just before it charges.",
     "briefing": "A titan of the deep ocean ruins beneath Thalassia. Its scales turn almost every hit; only the stagger window after its charge exposes the glowing gill line.",
     "trigger": "The Leviathan surfaces when the trench current reverses. Break the anchors holding the farms against the current, and it comes up with the tide.",
     "clues": [
        {"id": "site", "route": "site", "text": "At the Aqua Farms, the nets all lean the same way, toward the trench."},
        {"id": "current", "route": "world", "poi": "th-port", "text": "A current below Thalassia pulls toward the trench even when the sea is calm."},
        {"id": "diver", "route": "npc", "npc": "coral", "text": "A dock worker says the deep ruins have a heartbeat.",
         "says": "Dive past forty metres off the farms and you feel it in your chest. A heartbeat. The deep ruins have a heartbeat, and it's getting faster."},
        {"id": "forgotten", "route": "story", "after": "29", "text": "The forgotten signal had a second voice under it: something very large, answering."},
     ],
     "chapters": [
        {"id": "U16A", "title": "Past Forty Metres", "location": "EXT. THALASSIA — NEXUS PORT", "kind": "talk", "who": "CORAL ADEYEMI", "start": "th-port",
         "label": "Ask Coral about the heartbeat",
         "open": L(N, "Coral Adeyemi dives the farm nets. She says she's felt it."),
         "close": L("CORAL ADEYEMI", "It's faster every week. Last dive, the whole farm leaned toward the trench. Every net. The current's turning.")
         + L(O, "What happens when it turns all the way?")
         + L("CORAL ADEYEMI", "My grandmother said: the deep comes up to breathe. I always thought that was a story.")},
        {"id": "U16B", "title": "The Farm Anchors", "location": "EXT. THE AQUA FARMS", "kind": "hack", "start": "th-aqua-farms",
         "label": "Release the farm anchors before the current turns",
         "open": L(N, "If the farms are anchored when the current reverses, they'll be dragged into the trench. Release them. And then it surfaces.")
         + L(O, "Into the farms.")
         + L(N, "Into us. I'd rather that than into the farmers."),
         "close": L(N, "Anchors free. The current just reversed.")
         + L(N, "Rings of light, coming up from below. A lot of them.")},
        {"id": "U16C", "title": "The Deep", "location": "EXT. THE AQUA FARMS — THE TRENCH EDGE", "kind": "boss", "boss": "abyssal-leviathan",
         "label": "Defeat the Abyssal Leviathan",
         "open": L(N, "When the rings ripple down its body, it charges. After the charge, the gill line glows. That's the window."),
         "close": L(N, "It's sinking. Not dying. Going back down.")
         + L(N, "The current is calm. The heartbeat is slow again.")
         + L("CORAL ADEYEMI", "The nets are standing straight. First time in a month. I'll tell my grandmother she was right.")
         + L(N, "It left a core behind in the farm nets. I think it shed it. Like a scale.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 17
    {"id": "eternal-huntress", "mission": "U17", "name": "Mistwood: The Eternal Huntress", "boss_name": "The Eternal Huntress",
     "region": "The Shrouded Swamps — Mistwood", "world": "swamps", "gimmick": "closing", "hull": "eternal-huntress", "after": "42",
     "nex": 1300, "xp": 800, "drop": "bioCatalyst", "lair": "ss-mangrove-maze",
     "taunt": "Run, and I will only enjoy it longer.",
     "tell": "Her bowstring hums and the fog parts in a line a heartbeat before she looses.",
     "briefing": "A phantom archer of the Mistwood. At range she fades into the fog and your shots pass through her; close the distance and she has to stand and fight.",
     "trigger": "The Huntress only hunts someone who is already being hunted. Walk into the Mangrove Maze as her prey, survive her pack, and she comes to finish it herself.",
     "clues": [
        {"id": "site", "route": "site", "text": "In the Mangrove Maze, every trunk at head height has a fresh nick, as if from a passing arrow."},
        {"id": "arrows", "route": "world", "poi": "ss-drowned-ruins", "text": "Arrows with no fletching are buried in the Mistwood trees, all aimed at the same clearing."},
        {"id": "fog", "route": "combat", "world": "swamps", "element": "", "chance": 0.35, "text": "Something in the fog watches your fights and never fires twice from the same place."},
        {"id": "tracker", "route": "npc", "npc": "nyx", "text": "A Free Operator tracker was hunted for three days in the swamps and never saw who by.",
         "says": "Three days. Something tracked me through the Mistwood for three days, and I'm the tracker. Never saw her. Heard her bowstring every night."},
        {"id": "covenant", "route": "story", "after": "42", "text": "After the broken covenant, Old Harrow's hunters said the Mistwood has a hunter older than their oldest stories."},
     ],
     "chapters": [
        {"id": "U17A", "title": "Prey", "location": "EXT. SHROUDED SWAMPS — FERRY DOCK", "kind": "cutscene", "start": "ss-ferry-dock",
         "open": L("NYX", "You're going in. Fine. Listen. She doesn't fire twice from the same place. When the fog parts in a line, move.")
         + L(O, "How do I find her?")
         + L("NYX", "You don't. You let her find you. Walk into the Maze like you don't know she's there.")
         + L(N, "I'm reading something in the fog already. It's been with us since the dock."),
         "close": []},
        {"id": "U17B", "title": "The Pack", "location": "EXT. THE MANGROVE MAZE", "kind": "survive", "amount": 40, "start": "ss-mangrove-maze",
         "label": "Survive the Huntress's pack",
         "open": L("THE ETERNAL HUNTRESS", "Run, and I will only enjoy it longer.")
         + L(N, "Her hounds are driving us toward the clearing. Hold here. Make her come to us."),
         "close": L("THE ETERNAL HUNTRESS", "You did not run. Then I will finish this myself.")
         + L(N, "At range she fades into the fog. My scans pass right through her. You'll have to get close.")},
        {"id": "U17C", "title": "The Eternal Huntress", "location": "EXT. THE MISTWOOD CLEARING", "kind": "boss", "boss": "eternal-huntress",
         "label": "Close the distance and defeat the Huntress",
         "open": L(N, "When her bowstring hums and the fog parts in a line, she's about to loose. Move off the line, then close in."),
         "close": L("THE ETERNAL HUNTRESS", "A prey that comes closer. I have not seen one in a long time.")
         + L(O, "How long have you been hunting here?")
         + L("THE ETERNAL HUNTRESS", "Since before the trees. I hunted what came through the fog so the village would not have to. Then the village was gone, and I kept hunting.")
         + L("THE ETERNAL HUNTRESS", "Take my catalyst. Rest, if you can. I will not.")
         + L("NYX", "No bowstring tonight. First time in a week. You owe me nothing, but I'll buy you a drink anyway.")},
     ]},
    # ------------------------------------------------------------------------------------------------ 18
    {"id": "iron-behemoth", "mission": "U18", "name": "Warzone: The Iron Behemoth", "boss_name": "The Iron Behemoth",
     "region": "The Wastelands", "world": "wastelands", "gimmick": "poise", "hull": "iron-behemoth", "after": "45",
     "nex": 1500, "xp": 900, "drop": "reinforcedAlloy", "lair": "base-01",
     "taunt": "TARGET ACQUIRED. ALL BATTERIES.",
     "tell": "The vents on its back glow white and steam before each volley ends.",
     "briefing": "A siege machine left running in an abandoned military complex. Its armor shrugs off nearly everything until its cannons overheat and the vents open.",
     "trigger": "The Behemoth is still running a siege that ended decades ago. Open the Legion's sealed gate and it treats you as the enemy it was built for.",
     "clues": [
        {"id": "site", "route": "site", "text": "At the old Scrap-Hangar, the ground is pressed flat by something heavier than any tank."},
        {"id": "tracks", "route": "world", "poi": "grid-iron-highway", "text": "Tread marks wider than a road lead into an abandoned Wastelands military complex."},
        {"id": "legion", "route": "npc", "npc": "draev", "text": "The Sub-Terra Legion keeps a gate sealed against a machine that is still running.",
         "says": "The Legion keeps one gate welded shut. Behind it, a machine is still running a siege nobody remembers ordering. We feed it nothing. It doesn't need feeding."},
        {"id": "fifth", "route": "story", "after": "45", "text": "The fifth signature's trace crossed a military complex where something answered in artillery code."},
     ],
     "chapters": [
        {"id": "U18A", "title": "The Welded Gate", "location": "EXT. THE WASTELANDS — LEGION QUARTERMASTER", "kind": "talk", "who": "MARSHAL DRAEV", "start": "legion-quartermaster",
         "label": "Ask Marshal Draev about the welded gate",
         "open": L(N, "Marshal Draev came out from the Reach for this. He doesn't look happy."),
         "close": L("MARSHAL DRAEV", "You want the gate opened. Every operator wants the gate opened. None of them have come back to complain about it.")
         + L(O, "What's behind it?")
         + L("MARSHAL DRAEV", "The Behemoth. A siege engine. The war it was built for ended before I was born, and nobody told it. It shells anything that moves near that complex.")
         + L("MARSHAL DRAEV", "If you're going, go. Wait for its cannons to run hot. The vents open. That's the only time it bleeds.")},
        {"id": "U18B", "title": "Tread Marks", "location": "EXT. THE GRID-IRON HIGHWAY", "kind": "reach", "start": "grid-iron-highway",
         "label": "Follow the tread marks to the complex",
         "open": L(N, "Tread marks wider than the road. It's been patrolling."),
         "close": L(N, "The gate. Welded shut, then welded again, then welded a third time.")},
        {"id": "U18C", "title": "Open the Gate", "location": "EXT. THE MILITARY COMPLEX — THE SEALED GATE", "kind": "hack", "start": "base-01",
         "label": "Open the Legion's sealed gate",
         "open": L(N, "When this gate opens, it will treat us as the enemy it was built to stop. There's no talking to it.")
         + L(O, "Then we don't talk."),
         "close": L("THE IRON BEHEMOTH", "TARGET ACQUIRED. ALL BATTERIES.")
         + L(N, "Here it comes.")},
        {"id": "U18D", "title": "Warzone", "location": "INT. THE MILITARY COMPLEX", "kind": "boss", "boss": "iron-behemoth",
         "label": "Defeat the Iron Behemoth",
         "open": L(N, "When the vents on its back glow white and steam, the volley is ending and the cannons are hot. That's the opening."),
         "close": L("THE IRON BEHEMOTH", "SIEGE... CONCLUDED. AWAITING... ORDERS.")
         + L(O, "Stand down. The war's over.")
         + L("THE IRON BEHEMOTH", "ACKNOWLEDGED.")
         + L(N, "It shut itself off. It accepted the order.")
         + L("MARSHAL DRAEV", "Operator, my lookouts say the complex went quiet. You did it. Bring back some of that alloy, would you. We've earned it.")},
     ]},
]
