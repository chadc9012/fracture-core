"""Chapter 5 — The Frozen Crown, Missions 32–38: the fourth seal sleeps under the Frostveil ice in a crown nobody can
lift. Seraphine lifts it, remembers, and walks away with the Architect — and restores the seal from inside his citadel."""
from common import *

CHAPTER = (5, "The Frozen Crown")
HALV = "DR. HALVARD"

MISSIONS = [
    # =========================================================================================== MISSION 32
    {"id": "32", "title": "Frostveil Silence", "region": "Frostveil", "world": "frostveil",
     "beat": "Arrival / the silent station / the Choir's quiet ones / Seraphine's dreams", "chapters": [
        {"id": "32A", "title": "North", "location": "EXT. FROSTVEIL — THE ICE SHELF", "kind": "cutscene", "start": "fv-camp",
         "open": L(N, "Frostveil. Minus thirty-eight degrees. The research station stopped transmitting four days ago.")
         + L(KAEL, "My people run supplies up here. Last run came back with the drivers unable to speak. Not wouldn't. Couldn't.")
         + L(O, "You came yourself.")
         + L(KAEL, "When things get strange enough, I like to look at them with my own eyes.")
         + L(SERA, "I've been dreaming about this place. Snow that doesn't fall. A chair made of ice.")
         + L(KAEL, "That's a weird dream, Doc.")
         + L(SERA, "I'm a weird person, Kael."),
         "close": []},
        {"id": "32B", "title": "The Station", "location": "EXT. FROSTVEIL RESEARCH STATION", "kind": "reach", "to": "fv-station",
         "label": "Reach the research station",
         "open": L(N, "There are heat signatures inside. Forty people. None of them are moving.")
         + L(O, "Alive?")
         + L(N, "Alive. Silent. Even their hearts are quiet."),
         "close": []},
        {"id": "32C", "title": "The Chief", "location": "INT. FROSTVEIL STATION — THE COMMON ROOM", "kind": "talk", "who": "DR. HALVARD",
         "to": "fv-station", "label": "Wake the station's chief",
         "open": [],
         "close": L(HALV, "...sound... is that sound? I can hear you.")
         + L(O, "Take it slow. What happened here?")
         + L(HALV, "The silence came off the shelf. Like fog. Everything it touched forgot how to make noise. The wind. The generators. Us.")
         + L(N, "A Null Choir suppression field. It spreads where a keeper is close to waking. The Choir's answer to a song is silence.")
         + L(HALV, "We were drilling. Under the shelf. We found a cavern with a chair in it. A chair of ice with a crown on the seat.")
         + L(SERA, "Did anyone touch it?")
         + L(HALV, "Nobody could lift it. Three engineers tried. That's when the silence came.")}
        ,
        {"id": "32D", "title": "The Quiet Ones", "location": "EXT. FROSTVEIL STATION — THE YARD", "kind": "kills", "amount": 9,
         "label": "Clear the Choir's silent constructs",
         "open": L(N, "Constructs in the yard. My audio is failing near them. If I stop talking, keep shooting.")
         + L(KAEL, "That's the best plan I've heard in weeks."),
         "close": L(N, "...signal returning. Station is quiet. The normal kind of quiet.")}
        ,
        {"id": "32E", "title": "The Dream", "location": "INT. FROSTVEIL STATION — NIGHT", "kind": "cutscene",
         "open": L(SERA, "Are you awake?")
         + L(O, "Now I am.")
         + L(SERA, "In the dream I'm sitting on the chair. There's a veil over my face and I can't take it off. And you're standing at the gate with your hand on it, and I'm saying something to you.")
         + L(O, "What are you saying?")
         + L(SERA, "I don't know. Every time I get to the words, I wake up. I think I'm afraid of them.")
         + L(N, "Seraphine's neural pattern during sleep matched the archive's fourth signature for eleven minutes.")
         + L(SERA, "Yes, NOVA. I know. Thank you."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 33
    {"id": "33", "title": "The Star Readers", "region": "Aurora Gate", "world": "aurora-gate",
     "beat": "The Astryan observatory / reading the seals in the sky / the Choir follows", "chapters": [
        {"id": "33A", "title": "Aurora", "location": "EXT. AURORA GATE — NIGHT", "kind": "cutscene", "start": "ag-airport",
         "open": L(N, "Aurora Gate. The observatory on the hill is Astryan underneath. Built to read the lock in the sky.")
         + L(KAEL, "Read the lock in the sky. Sure. Why not.")
         + L(O, "What will it show us?")
         + L(N, "Where the crown's seal truly sleeps. The cavern under the shelf is only where it surfaced."),
         "close": []},
        {"id": "33B", "title": "The Hill Road", "location": "EXT. AURORA GATE — THE HILL ROAD", "kind": "drive", "to": "ag-observatory",
         "label": "Drive to the observatory",
         "open": L(KAEL, "Roads up here were built by people who hated driving."),
         "close": []},
        {"id": "33C", "title": "The Great Lens", "location": "INT. THE OBSERVATORY — THE GREAT LENS", "kind": "hack", "to": "ag-observatory",
         "label": "Wake the great lens",
         "open": L(N, "The lens is Astryan crystal. It needs a keeper's signature to align. Or the sixth's.")
         + L(O, "I'm getting used to being a key."),
         "close": L(N, "Aligned.")}
        ,
        {"id": "33D", "title": "Five Stars", "location": "INT. THE OBSERVATORY — THE GREAT LENS", "kind": "cutscene",
         "open": L(N, "The lens shows the lock as a constellation. Five stars round a dark centre.")
         + L(N, "The first three are bright. The Voice. The Cartographer. The Echo.")
         + L(SERA, "And the fourth?")
         + L(N, "Dim. It is not under the shelf. It is in the person the seal was given to.")
         + L(O, "The Veiled Sovereign.")
         + L(N, "The crown is a lock on her memory. Whoever lifts it remembers what she was.")
         + L(KAEL, "And the fifth?")
         + L(N, "The fifth star is moving. Toward the centre.")
         + L(SERA, "Turog."),
         "close": []},
        {"id": "33E", "title": "Hold the Hill", "location": "EXT. THE OBSERVATORY", "kind": "survive", "amount": 60,
         "label": "Hold the observatory while NOVA copies the star map",
         "open": L(N, "The Choir noticed the lens. They are coming up the hill.")
         + L(KAEL, "Free Operators! Earn your keep!"),
         "close": L(N, "Star map copied. We have what we came for.")}
        ,
    ]},
    # =========================================================================================== MISSION 34
    {"id": "34", "title": "The Veiled Sovereign", "region": "Frostveil", "world": "frostveil",
     "beat": "Into the ice / the crown / a face under the veil", "chapters": [
        {"id": "34A", "title": "Crevasses", "location": "EXT. FROSTVEIL — THE CREVASSE FIELD", "kind": "trace", "start": "fv-crevasses",
         "label": "Follow the star map down through the crevasses",
         "open": L(N, "Three anchor points lead down to the cavern. The star map shows a path the drill missed.")
         + L(SERA, "I know the way. I don't know how I know."),
         "close": []},
        {"id": "34B", "title": "The Cavern", "location": "INT. THE ICE CAVERN", "kind": "reach", "to": "fv-cave", "label": "Reach the cavern of the crown",
         "open": L(N, "Temperature dropping. Sound is fading again.")
         + L(O, "Choir?")
         + L(N, "No. This silence is older. It is respectful."),
         "close": []},
        {"id": "34C", "title": "The Chair of Ice", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "cutscene",
         "open": L(N, "A throne. A crown on the seat. And behind the ice of the wall... a woman.")
         + L(O, "Frozen?")
         + L(N, "Preserved. Veiled. Her signature is the fourth keeper's.")
         + L(SERA, "Move the light. Please. I need to see her.")
         + L(N, "...")
         + L(SERA, "It's me. Under the veil. It's my face.")
         + L(O, "Seraphine...")
         + L(SERA, "I left myself here. I left my memory on a chair in the ice and I walked out and I forgot I'd done it."),
         "close": []},
        {"id": "34D", "title": "The Sovereign Speaks", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "talk", "who": "SERAPHINE",
         "label": "Stand with Seraphine at the throne",
         "open": [],
         "close": L(VEIL, "You came back for me. For yourself. I always hoped you would, and I always hoped you wouldn't.")
         + L(SERA, "Why did you leave me here?")
         + L(VEIL, "Because I couldn't carry what I knew and still be kind. So I put it down. And I picked up a lab coat.")
         + L(VEIL, "Sixth. You're here too. Of course you are. You were always where the hardest thing was.")
         + L(O, "What did you know? What was too heavy?")
         + L(VEIL, "That the Covenant didn't break when you opened the gate. It broke before. It broke when I walked away from it. You only finished what I started.")
         + L(SERA, "...")
         + L(VEIL, "Lift the crown, if you want to remember. You will hate us both for a while. That's the price.")}
        ,
        {"id": "34E", "title": "Afraid of the Words", "location": "INT. THE ICE CAVERN", "kind": "cutscene",
         "open": L(SERA, "If I lift it, I'll remember all of it.")
         + L(O, "Then don't. Not yet.")
         + L(SERA, "Vasq said every time I remember, I leave. Eleven worlds. I left eleven times.")
         + L(O, "You don't have to leave this time.")
         + L(SERA, "You don't know that. Neither do I. That's what terrifies me.")
         + L(N, "Operator. Something just arrived at the cavern entrance. It has no signature. And then it has one.")
         + L(ARCH, "I said I'd ask again when the third keeper woke. I'm a man of my word. Usually."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 35
    {"id": "35", "title": "The Crown Nobody Can Lift", "region": "Frostveil", "world": "frostveil",
     "beat": "The Architect's second offer / a choice / the crown is lifted", "chapters": [
        {"id": "35A", "title": "The Second Offer", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "cutscene", "start": "fv-cave",
         "open": L(ARCH, "Hello, Seraphine. You found her. I hoped you wouldn't, for your sake.")
         + L(SERA, "You knew she was here.")
         + L(ARCH, "I carried you here. You asked me to. You were weeping. You said, \"Make me someone who doesn't know.\" So I did.")
         + L(O, "And then you let her think she was your Second.")
         + L(ARCH, "She was my Second. She was the best I ever had. She simply didn't know she'd been something else first.")
         + L(ARCH, "Sixth, my offer. Stand aside. Let Seraphine come home with me, uncrowned. The fourth seal stays asleep. Turog never gets his five. The world goes on.")
         + L(O, "Asleep. Locked. Held still.")
         + L(ARCH, "Alive."),
         "close": []},
        {"id": "35B", "title": "The Crown", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "choice",
         "prompt": "The crown is on the throne. The Architect is waiting. Seraphine is looking at you.",
         "options": [["beside", "Lift it with her", "Put your hand on the crown beside hers. Whatever she remembers, she doesn't remember it alone."],
                     ["alone", "Let her choose alone", "Step back. It's her memory. It's her choice."],
                     ["refuse", "Tell her not to", "Ask her to leave it. Some doors should stay shut."]],
         "by_choice": {"beside": L(SERA, "Together, then. If I hate you afterwards, it's your own fault."),
                       "alone": L(SERA, "Thank you. You're the first person in a very long time who hasn't decided for me."),
                       "refuse": L(SERA, "I know. I know. And I'm sorry. I've spent eleven worlds not knowing.")},
         "open": [], "close": []},
        {"id": "35C", "title": "Remembering", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "cutscene",
         "open": L(SERA, "...")
         + L(N, "Her neural activity is... I have never seen a human brain do this. I'm not sure it is a human brain.")
         + L(SERA, "Oh. Oh, no.")
         + L(O, "Seraphine?")
         + L(SERA, "I remember the gate. I remember your hand on it. I remember what I said to you.")
         + L(O, "What did you say?")
         + L(SERA, "I said, \"If you open it, I will spend every world after this one making sure you never remember why.\" And I have. Every single one.")
         + L(ARCH, "Welcome back, Sovereign."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 36
    {"id": "36", "title": "The Betrayal", "region": "Frostveil", "world": "frostveil",
     "beat": "Seraphine leaves / the Sovereign's guard / the seal goes with her", "chapters": [
        {"id": "36A", "title": "The Door Again", "location": "INT. THE ICE CAVERN", "kind": "cutscene", "start": "fv-cave",
         "open": L(SERA, "I'm going with him.")
         + L(O, "No.")
         + L(SERA, "You don't understand yet. You will. When you remember everything, the world ends. I've watched it. Eleven times. Your hand on the gate. Every time.")
         + L(O, "Then help me do it differently.")
         + L(SERA, "I tried. In world seven, I stayed. We tried together. I wrote it down. Read it again sometime.")
         + L(VASQ, "Sovereign. The door.")
         + L(SERA, "Hold it, Oren. Like you always do.")
         + L(N, "Seraphine. Please.")
         + L(SERA, "Look after them, Vigilance. You were always better at it than me."),
         "close": []},
        {"id": "36B", "title": "Cover", "location": "INT. THE ICE CAVERN — THE TUNNELS", "kind": "survive", "amount": 60,
         "label": "Survive the Executors covering her retreat",
         "open": L(N, "Executors in the tunnels. They are not trying to kill us. They are trying to slow us.")
         + L(KAEL, "Then let's be fast."),
         "close": L(N, "Something is rising from the floor of the cavern. Ice and armour. Old.")}
        ,
        {"id": "36C", "title": "The Sovereign's Guard", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "boss", "boss": "sovereign-guard",
         "boss_name": "The Sovereign's Guard", "label": "Get past the throne's guardian",
         "open": L(N, "A guardian she left with the crown. It is following her last command.")
         + L(O, "Which was?")
         + L(N, "\"Let no one follow me.\""),
         "close": L(N, "It's down. The throne is empty. The crown is gone. So is the seal.")}
        ,
        {"id": "36D", "title": "Empty Chair", "location": "INT. THE ICE CAVERN — THE THRONE", "kind": "cutscene",
         "open": L(KAEL, "I'm sorry. I liked her. I don't like a lot of people.")
         + L(O, "She took the fourth seal with her.")
         + L(N, "She took her memory of it. The seal itself is in her. It goes where she goes.")
         + L(O, "To the Architect.")
         + L(N, "To the Architect. Operator... I think she was crying when she left. I don't know what my sensors are worth anymore. But I think she was."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 37
    {"id": "37", "title": "Whiteout", "region": "Frostveil", "world": "frostveil",
     "beat": "The Silent Cantor / fighting without sound / Turog's mockery", "chapters": [
        {"id": "37A", "title": "The Silence Returns", "location": "EXT. FROSTVEIL STATION", "kind": "cutscene", "start": "fv-station",
         "open": L(HALV, "It's coming back. The silence. Bigger than before.")
         + L(N, "A Choir construct at the centre of it. Much larger. It is singing silence.")
         + L(KAEL, "Singing silence. Great.")
         + L(N, "Inside its field my voice will fail. Your abilities may fail. Use the station. The generators, the flares. Anything that makes noise."),
         "close": []},
        {"id": "37B", "title": "Hold the Generators", "location": "EXT. FROSTVEIL STATION — THE GENERATOR YARD", "kind": "survive", "amount": 60,
         "label": "Keep the generators running against the silence",
         "open": L(HALV, "The generators are the loudest thing we have. Keep them running and the field can't close."),
         "close": L(N, "...it's here.")}
        ,
        {"id": "37C", "title": "The Silent Cantor", "location": "EXT. FROSTVEIL — THE SHELF", "kind": "boss", "boss": "silent-cantor",
         "boss_name": "The Silent Cantor", "label": "Break the Silent Cantor",
         "open": L(N, "...")
         + L(O, "NOVA? NOVA!")
         + L(KAEL, "She's gone quiet! Just shoot the big singing thing!"),
         "close": L(N, "...signal... I'm back. I heard nothing for three minutes. I did not like it.")}
        ,
        {"id": "37D", "title": "Mockery", "location": "EXT. FROSTVEIL — THE SHELF", "kind": "cutscene",
         "open": L(TUROG, "My Cantor sang well. You only killed the song, not the singer.")
         + L(O, "Turog.")
         + L(TUROG, "Your Sovereign has chosen the wall again. She always chooses the wall. The Architect's wall, my silence. We are the only two honest answers to a world that cannot stop ending.")
         + L(O, "There's a third answer.")
         + L(TUROG, "There is always a third answer, sixth. You have tried it eleven times."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 38
    {"id": "38", "title": "The Fourth Seal", "region": "Frostveil", "world": "frostveil",
     "beat": "The Architect's citadel / Seraphine at his side / the seal restored from inside", "chapters": [
        {"id": "38A", "title": "The Spine", "location": "EXT. FROSTVEIL — THE SPINE ROAD", "kind": "drive", "to": "fv-spine", "start": "fv-station",
         "label": "Drive to the citadel on the Spine",
         "open": L(N, "The Continuum has a citadel on the Spine. It wasn't there yesterday.")
         + L(KAEL, "Buildings don't just appear.")
         + L(N, "This one did."),
         "close": []},
        {"id": "38B", "title": "The Gate of the Citadel", "location": "EXT. THE CITADEL — THE GATE", "kind": "kills", "amount": 10, "to": "fv-spine",
         "label": "Break into the citadel",
         "open": L(N, "Executors. Observers. And something in the walls listening."),
         "close": []},
        {"id": "38C", "title": "The Wall", "location": "INT. THE CITADEL — THE HIGH HALL", "kind": "cutscene",
         "open": L(ARCH, "You came for her. Of course.")
         + L(SERA, "Go home. Please.")
         + L(O, "Not without you.")
         + L(SERA, "I'm exactly where I need to be.")
         + L(ARCH, "She has agreed to keep the fourth seal asleep. Here. Under my care. Turog will never have five.")
         + L(O, "And the lock never opens.")
         + L(ARCH, "And the world never ends.")
         + L(SERA, "Go. Before the Warden wakes."),
         "close": []},
        {"id": "38D", "title": "The Citadel Warden", "location": "INT. THE CITADEL — THE HIGH HALL", "kind": "boss", "boss": "citadel-warden",
         "boss_name": "Citadel Warden", "label": "Defeat the Citadel Warden",
         "open": L(ARCH, "I'm sorry. It's only a machine. It will only hurt you a great deal."),
         "close": L(N, "It's down. The Architect is gone. Seraphine is gone.")}
        ,
        {"id": "38E", "title": "From Inside", "location": "EXT. THE SPINE — DUSK", "kind": "cutscene",
         "open": L(N, "Operator. Wait. A transmission. On my oldest channel. Only an Astryan key could use it.")
         + L(SERA, "Vigilance. Don't say anything. Just listen.")
         + L(SERA, "I lied to him. I'm good at it. I've had eleven worlds of practice.")
         + L(SERA, "I'm restoring the fourth seal. Now. From inside his walls, where Turog can't reach it and where he won't think to look.")
         + L(N, "Fourth seal restored. The star is bright.")
         + L(SERA, "Tell the sixth I'm sorry. Tell them I'm not leaving this time. I'm just standing somewhere they can't see me yet.")
         + L(O, "She did it.")
         + L(N, "Four of five. And the fifth star is still moving toward the centre."),
         "close": []},
    ]},
]

STAGES = {
    "32A": "snow_camp", "32B": "snow_camp", "32C": "station", "32D": "snow_camp", "32E": "station",
    "33A": "snow_camp", "33B": "snow_camp", "33C": "observatory", "33D": "observatory", "33E": "observatory",
    "34A": "ice_cave", "34B": "ice_cave", "34C": "throne", "34D": "throne", "34E": "throne",
    "35A": "throne", "35B": "throne", "35C": "throne",
    "36A": "throne", "36B": "ice_cave", "36C": "throne", "36D": "throne",
    "37A": "snow_camp", "37B": "snow_camp", "37C": "snow_camp", "37D": "snow_camp",
    "38A": "snow_camp", "38B": "citadel", "38C": "citadel", "38D": "citadel", "38E": "snow_camp",
}
ACTS = {
    "35C": {"Oh. Oh, no.": "seal"},
    "38E": {"Fourth seal restored. The star is bright.": "seal"},
}
BOSSES = {"sovereign-guard": "rift-hound", "silent-cantor": "colossus", "citadel-warden": "colossus"}
