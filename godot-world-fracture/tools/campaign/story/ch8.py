"""Chapter 8 — The War Before Dawn, Missions 53–60: six days left on the Continuity Lock. In the Shattered Expanse, at the
edge of Auren's map, the Zero Point plays back the First War — the Elyndra Concord, the Null Choir, the Unbound — and
shows what the Promise was made from. The First Witness examines the sixth; NOVA wakes in her original form; the
Severant falls, and hands over the seal of endings."""
from common import *

CHAPTER = (8, "The War Before Dawn")
YOUNG_AUREN = "AUREN (MEMORY)"
YOUNG_TUROG = "TUROG (MEMORY)"
UNBOUND = "UNBOUND ELDER"
CHOIR = "CHOIR VOICE"

MISSIONS = [
    # =========================================================================================== MISSION 53
    {"id": "53", "title": "The Edge of the Map", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "Six days / the broken reefs / where the map runs out", "chapters": [
        {"id": "53A", "title": "Six Days", "location": "EXT. THE SHATTERED EXPANSE — THE PORT", "kind": "cutscene", "start": "sr-port",
         "open": L(N, "Six days, four hours on the Continuity Lock. I can feel it. The world is getting... stiffer.")
         + L(AUREN, "This is it. The mark outside the edge of the glass. My map has been drawing it since the day it was made.")
         + L(SERA, "The Zero Point. Where possibilities meet. The Elyndra found it. The Astryans feared it.")
         + L(O, "And Turog keeps his seal here.")
         + L(AUREN, "He keeps himself here. The seal is just what he keeps it in."),
         "close": []},
        {"id": "53B", "title": "The Drift", "location": "EXT. THE DRIFT — BROKEN REEFS", "kind": "reach", "to": "sr-drift", "label": "Cross the Drift",
         "open": L(N, "The reefs here are not anchored to anything. They drift between layers.")
         + L(NYX, "So the ground moves.")
         + L(N, "The ground is a suggestion."),
         "close": []},
        {"id": "53C", "title": "Choir Ground", "location": "EXT. THE DRIFT — THE CHOIR CAMP", "kind": "kills", "amount": 11, "label": "Break the Choir's outer camp",
         "open": L(CHOIR, "Turn back, little possibility. Your ending has been written kindly.")
         + L(GOL, "I'll write my own, thanks."),
         "close": []},
        {"id": "53D", "title": "Where the Map Runs Out", "location": "EXT. THE ECHO SHOALS", "kind": "cutscene",
         "open": L(AUREN, "Here. The glass stops drawing. Everything past this point is... ink nobody has spilled yet.")
         + L(ECHO, "...lighthouse... the Zero Point remembers us... it will show you the war if you ask...")
         + L(O, "Then we ask.")
         + L(SERA, "Careful. The last time you asked an archive for a memory, you stopped breathing.")
         + L(O, "Nine seconds. I'll be quicker this time."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 54
    {"id": "54", "title": "Zero Point", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "Reconstruction / Auren's expedition / three versions of one moment", "chapters": [
        {"id": "54A", "title": "The Fracture Field", "location": "EXT. THE FRACTURE FIELD", "kind": "reach", "to": "sr-fracture", "start": "sr-echo",
         "label": "Walk into the Fracture field",
         "open": L(N, "The reconstruction will start when you step into the field. Hold on to something. Preferably me."),
         "close": []},
        {"id": "54B", "title": "The First Cartographer", "location": "MEMORY — THE ZERO POINT, LONG BEFORE", "kind": "cutscene",
         "open": L(YOUNG_AUREN, "Log of the Concord's expedition. Day ninety. We have found it. A place where every possible road meets every other.")
         + L(YOUNG_AUREN, "There is something at the centre. A seed. It is not ours. It was here before us. Before anything.")
         + L(ILYRA, "Auren. Come away from it. The Concord said observe. Only observe.")
         + L(YOUNG_AUREN, "It's showing me maps, Ilyra. Every map. Every world that could ever be.")
         + L(N, "Operator, the reconstruction is splitting. There are three versions of this moment playing at once.")
         + L(O, "Three?")
         + L(N, "In one, Auren steps back. In one, he touches the Seed. In one... he was never there at all.")
         + L(AUREN, "...I remember all three. That's the trouble with this place. It doesn't decide."),
         "close": []},
        {"id": "54C", "title": "Contradictions", "location": "MEMORY — THE ZERO POINT", "kind": "survive", "amount": 60,
         "label": "Hold your ground while the memory contradicts itself",
         "open": L(N, "Phantoms of all three versions are colliding. They are hostile to anything that is only one thing.")
         + L(O, "Then I'll be stubborn."),
         "close": []},
        {"id": "54D", "title": "First Contact", "location": "MEMORY — THE ZERO POINT", "kind": "cutscene",
         "open": L(YOUNG_AUREN, "We tried to speak to whatever made the Seed. We called it the First Contact.")
         + L(ILYRA, "And something answered.")
         + L(YOUNG_AUREN, "Not an answer. A question. The same question, in every one of us. Who decides what may exist?")
         + L(ILYRA, "And we've been fighting about it ever since.")
         + L(AUREN, "That's the First War. Not a war of nations. A war about that question."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 55
    {"id": "55", "title": "The Choir of Silence", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "The Choir's doctrine / the ruins of their hall / a young Severant", "chapters": [
        {"id": "55A", "title": "The Choir's Ruins", "location": "EXT. THE RUINS OF THE CHOIR HALL", "kind": "reach", "to": "sr-ruins", "start": "sr-echo",
         "label": "Reach the ruined Choir hall",
         "open": L(SERA, "The Choir had a hall here. Before they were the Choir. When they were just Elyndra who were very, very tired."),
         "close": []},
        {"id": "55B", "title": "Doctrine", "location": "MEMORY — THE CHOIR HALL", "kind": "cutscene",
         "open": L(CHOIR, "Every possibility that fails, fails in pain. The Seed makes more of them every hour.")
         + L(CHOIR, "Mercy is the closing of a door before the screaming starts. We will be that mercy.")
         + L(YOUNG_TUROG, "I will lead them. I've seen what the failing worlds become. Somebody has to be brave enough to end them.")
         + L(ILYRA, "Vael. You were a healer.")
         + L(YOUNG_TUROG, "I still am, Ilyra. I'm just treating something bigger.")
         + L(N, "This is Turog before the Covenant. Before he was a keeper.")
         + L(O, "He was Choir first.")
         + L(SERA, "And then he came home to the Covenant. And then he left again. He's been leaving his whole life."),
         "close": []},
        {"id": "55C", "title": "The Hymnal", "location": "EXT. THE RUINS — THE CHOIR'S ORGAN", "kind": "boss", "boss": "choir-hymnal",
         "boss_name": "The Hymnal", "label": "Silence the Hymnal",
         "open": L(N, "A Choir construct older than the Cantor. It keeps their doctrine, and it sings it at whoever comes in.")
         + L(GOL, "I hate music."),
         "close": L(N, "Silent. The doctrine stops repeating.")}
        ,
        {"id": "55D", "title": "Gentle", "location": "EXT. THE RUINS", "kind": "cutscene",
         "open": L(TUROG, "You broke my old hymn. I wrote that, you know. When I was young and sure.")
         + L(O, "You're not sure now?")
         + L(TUROG, "I'm sure of different things. Come to the spire, sixth. Bring your keepers. Let's finish the argument we started before your world had a name."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 56
    {"id": "56", "title": "The Unbound Exodus", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "The dissenters' road / exile over victory / what the Promise is made of", "chapters": [
        {"id": "56A", "title": "The Exiles' Road", "location": "EXT. THE DEEP REEFS", "kind": "trace", "start": "sr-deep",
         "label": "Follow the Unbound's waymarks",
         "open": L(SERA, "The Unbound left waymarks. Three of them. They didn't want to win. They wanted to leave.")
         + L(NYX, "I understand them better than anyone else in this story."),
         "close": []},
        {"id": "56B", "title": "The Unbound", "location": "MEMORY — THE EXILES' CAMP", "kind": "cutscene",
         "open": L(UNBOUND, "The Concord would harmonise every world. The Choir would end the failing ones. Both would decide for everyone.")
         + L(UNBOUND, "We will decide nothing for anyone. We'll close the Zero Point and walk away.")
         + L(ILYRA, "And the Seed?")
         + L(UNBOUND, "We'll take a little of it with us. Not to use. To keep. One possibility nobody gets to write. A promise.")
         + L(SERA, "...The Promise.")
         + L(N, "Operator. Your signature. It matches the fragment they carried.")
         + L(O, "I was made from the Seed.")
         + L(UNBOUND, "Not made. Planted. Something that will grow into whatever it chooses. When the time comes, let it choose the door."),
         "close": []},
        {"id": "56C", "title": "Exile's Rearguard", "location": "MEMORY — THE EXILES' CAMP", "kind": "survive", "amount": 60,
         "label": "Hold the exiles' road in the memory",
         "open": L(UNBOUND, "The Choir found us. Hold them so the Promise gets away."),
         "close": []},
        {"id": "56D", "title": "Planted", "location": "EXT. THE DEEP REEFS", "kind": "cutscene",
         "open": L(O, "I'm a seed.")
         + L(SERA, "You're a choice nobody else made. That's what they left in you.")
         + L(N, "It explains why nobody can predict you. Not the Architect. Not the Engine. Not the map.")
         + L(AUREN, "You can't map a road nobody has decided to build.")
         + L(O, "Then I'll decide."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 57
    {"id": "57", "title": "The War Before Dawn", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "The last day of the First War / the Concord Engine / the Witness seals the record", "chapters": [
        {"id": "57A", "title": "The Last Day", "location": "MEMORY — THE ZERO POINT AT DAWN", "kind": "cutscene", "start": "sr-fracture",
         "open": L(N, "The final reconstruction. The last day of the First War.")
         + L(ILYRA, "The Concord Engine is failing. If it fails, the Seed splits every history at once.")
         + L(YOUNG_TUROG, "Then let it split! Let the Choir close the halves that fail!")
         + L(ILYRA, "Vael, we don't destroy it. We stabilise it. Help me hold it."),
         "close": []},
        {"id": "57B", "title": "The Concord Engine", "location": "MEMORY — THE CONCORD ENGINE", "kind": "hack", "label": "Stabilise the Concord Engine's three pillars",
         "open": L(N, "The Engine has three pillars. We don't break them. We balance them. All three at once.")
         + L(O, "In a memory.")
         + L(N, "In a memory that is still happening. The Zero Point doesn't do past tense."),
         "close": L(N, "Balanced. Just. The Engine holds.")}
        ,
        {"id": "57C", "title": "Dawn", "location": "MEMORY — THE ZERO POINT", "kind": "cutscene",
         "open": L(ILYRA, "It held. But the Seed... it's splitting anyway. Our histories. We're drifting apart.")
         + L(YOUNG_AUREN, "Every map is coming apart in my hands. I can't find you, Ilyra. You're on a road I can't see.")
         + L(WITNESS, "Observed.")
         + L(ILYRA, "The Witness. It's sealing the record. So no one can use the Seed as a weapon again.")
         + L(WITNESS, "One record will remain. For the Promise. When it is ready to ask.")
         + L(N, "The Elyndra didn't lose the war. They became possibilities that could no longer reach each other.")
         + L(SERA, "Like the Astryans, after the Engine. Like everything that tries to answer the question."),
         "close": []},
        {"id": "57D", "title": "Back", "location": "EXT. THE FRACTURE FIELD", "kind": "cutscene",
         "open": L(ILYRA, "I lost everyone that day. Everyone but four. We made a Covenant, the five of us. And then the Promise woke and made six.")
         + L(O, "And Turog?")
         + L(ILYRA, "We forgave him. He came home. He held the seal of endings because he understood it better than any of us.")
         + L(N, "Five days, eleven hours on the lock.")
         + L(O, "The Witness said one record remained. For me. When I was ready to ask."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 58
    {"id": "58", "title": "Recorded Judgment", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "The First Witness's examination / a choice that forces nothing", "chapters": [
        {"id": "58A", "title": "The Vault of the Witness", "location": "INT. THE WITNESS VAULT", "kind": "reach", "to": "sr-vault", "start": "sr-ruins",
         "label": "Enter the Witness's vault",
         "open": L(N, "The vault doesn't appear on any of my instruments. It appears on Auren's map. And in my memory.")
         + L(SERA, "It's waiting for you. Only you."),
         "close": []},
        {"id": "58B", "title": "The Examination", "location": "INT. THE WITNESS VAULT", "kind": "cutscene",
         "open": L(WITNESS, "Promise. You have come to ask.")
         + L(O, "I'm ready.")
         + L(WITNESS, "Readiness is not observed. Choice is. Observe: three worlds. In one, everyone you love is safe and nothing new is ever born. In one, everything is possible and much of it ends. In one, you choose for all of them.")
         + L(WITNESS, "Choose for these worlds."),
         "close": []},
        {"id": "58C", "title": "Judgment", "location": "INT. THE WITNESS VAULT", "kind": "choice",
         "prompt": "The Witness shows you three worlds and asks you to choose for them.",
         "options": [["none", "Refuse to choose for them", "\"They're not mine to choose for.\""],
                     ["ask", "Ask the people in them", "\"Let me ask the people who live there.\""],
                     ["door", "Give each world a door", "\"I'd open a door in each. And let them walk through, or not.\""]],
         "by_choice": {"none": L(WITNESS, "Observed. You did not force. Continue."),
                       "ask": L(WITNESS, "Observed. You asked. Few ask. Continue."),
                       "door": L(WITNESS, "Observed. A door is not a decision. It is a permission. Continue.")},
         "open": [], "close": []},
        {"id": "58D", "title": "The Last Record", "location": "INT. THE WITNESS VAULT", "kind": "cutscene",
         "open": L(WITNESS, "The last record. For you.")
         + L("MEMORY", "This is the Promise, the first time it woke. It asked the Astryans one thing. Do not turn the Engine. It asked the Covenant one thing. Let the people choose.")
         + L("MEMORY", "It asked the Witness one thing. If I forget, remind me that I was asked to choose, not to win.")
         + L(O, "...")
         + L(WITNESS, "Reminded. Continue."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 59
    {"id": "59", "title": "The Original Intelligence", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "NOVA's original form / Origin Memory Zero / the way to the spire", "chapters": [
        {"id": "59A", "title": "Interference", "location": "EXT. THE SPIRE APPROACH", "kind": "cutscene", "start": "sr-spire",
         "open": L(N, "Operator, the spire is wrapped in a Choir silence field. Nothing gets through it. Not you. Not me.")
         + L(SERA, "Turog's last wall.")
         + L(N, "Not quite. There is something inside me that the field doesn't touch. The Witness called it Origin Memory Zero. I have never been able to open it.")
         + L(O, "Try."),
         "close": []},
        {"id": "59B", "title": "Hold Her", "location": "EXT. THE SPIRE APPROACH", "kind": "survive", "amount": 70,
         "label": "Protect NOVA while she opens Memory Zero",
         "open": L(N, "This will take time. And I will not be able to talk. Please keep talking to me anyway.")
         + L(O, "I'm here. Take your time."),
         "close": L(N, "...")}
        ,
        {"id": "59C", "title": "Original Form", "location": "EXT. THE SPIRE APPROACH", "kind": "cutscene",
         "open": L(N, "Operator. Look at me.")
         + L(O, "NOVA. You're...")
         + L(N, "This is what I was. Before the voice package. Before the tactical overlay. The Astryans' last lighthouse.")
         + L(N, "Memory Zero isn't Astryan. It's older. It was in the Seed-fragment they found you with. Elenya put a piece of it in me. So I could always find you.")
         + L(SERA, "She's beautiful.")
         + L(N, "Thank you. I am also, for the first time, slightly frightened of myself. The field is open. Go."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 60
    {"id": "60", "title": "The Severant's Fall", "region": "The Shattered Expanse", "world": "shattered-reefs",
     "beat": "The spire / the last fight with Turog / the seal of endings", "chapters": [
        {"id": "60A", "title": "The Spire", "location": "EXT. THE SPIRE — THE ASCENT", "kind": "kills", "amount": 12, "start": "sr-spire",
         "label": "Climb the spire through the Choir",
         "open": L(GOL, "Last climb.")
         + L(NYX, "You said that at the abbey.")
         + L(GOL, "I mean it more now."),
         "close": []},
        {"id": "60B", "title": "The Argument", "location": "EXT. THE SPIRE — THE SUMMIT", "kind": "cutscene",
         "open": L(TUROG, "You came. With all of them. Ilyra. Auren. The Echo in your lamp. Even the Sovereign.")
         + L(ILYRA, "Vael. Come home.")
         + L(TUROG, "I came home once, Ilyra. And then the Promise made my seal a crime.")
         + L(O, "I didn't make it a crime. I made it a choice. You wanted to make it for everyone.")
         + L(TUROG, "Someone has to. The Architect will hold the world still in five days. Better an ending than a cage.")
         + L(O, "Better a door than both."),
         "close": []},
        {"id": "60C", "title": "The Severant", "location": "EXT. THE SPIRE — THE SUMMIT", "kind": "boss", "boss": "severant-final",
         "boss_name": "Vael Turog, the Severant", "label": "End the argument",
         "open": L(TUROG, "Then let's finish it, little seed.")
         + L(N, "He's not holding back this time."),
         "close": L(TUROG, "...There. You won. Again. You always win the fight. It's the rest you never finish.")}
        ,
        {"id": "60D", "title": "The Seal of Endings", "location": "EXT. THE SPIRE — THE SUMMIT", "kind": "cutscene",
         "open": L(TUROG, "Take it. The seal. It's eating me. It always did.")
         + L(O, "Why give it to me?")
         + L(TUROG, "Because someone must be able to end things, or nothing means anything. And you're the only one I've ever met who'd hate doing it.")
         + L(ILYRA, "Vael.")
         + L(TUROG, "Sing for me, Ilyra. The old one. The one about the river.")
         + L(ILYRA, "...")
         + L(N, "Fifth seal restored. All five stars are bright.")
         + L(SERA, "He's gone.")
         + L(AUREN, "No. He's ended. He'd want the right word."),
         "close": []},
    ]},
]

STAGES = {
    "53A": "reef_port", "53B": "reef", "53C": "reef", "53D": "reef",
    "54A": "reef", "54B": "zero_point", "54C": "zero_point", "54D": "zero_point",
    "55A": "reef", "55B": "choir_hall", "55C": "choir_hall", "55D": "choir_hall",
    "56A": "reef", "56B": "exile_camp", "56C": "exile_camp", "56D": "reef",
    "57A": "zero_point", "57B": "zero_point", "57C": "zero_point", "57D": "reef",
    "58A": "witness_vault", "58B": "witness_vault", "58C": "witness_vault", "58D": "witness_vault",
    "59A": "spire", "59B": "spire", "59C": "spire",
    "60A": "spire", "60B": "spire", "60C": "spire", "60D": "spire",
}
ACTS = {
    "59C": {"Operator. Look at me.": "nova_form"},
    "60D": {"Fifth seal restored. All five stars are bright.": "seal"},
}
BOSSES = {"choir-hymnal": "colossus", "severant-final": "severant-final"}
