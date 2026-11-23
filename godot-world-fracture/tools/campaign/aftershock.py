#!/usr/bin/env python3
"""Chapter 1 — The Aftershock: the owner's screenplays for Missions 2–7 (Nov 22: "No Way Back", "The Missing Signal",
"First Contact", "The Gathering Storm", "The First Siege", "Beneath the Ashes") as playable chapters.

A story line of its own, separate from the original campaign (campaign_full.json, missions 02–25), the missions rolling
into each other (owner, Nov 22: "Separate these missions from the original set but make sure they roll into each other").
Mission 1 — The Day Everything Changed — is Mission 01 (scripts/mission/mission_01.gd), already the established opening.

Every spoken line is the owner's, verbatim and in the script's order (stage directions are left to the scene). The
OPERATOR speaks as PLAYER (voiced for the body the player built). Each chapter: its scene's lines as the opening
cutscene, its gameplay objective in the runner's kinds, the after-lines as its close.

Sources, the fullest draft of each: Mission 2 and Mission 4 from their own screenplay files; Missions 3, 5, 6 and 7
from the package generator (World_Fracture_Chapter_1_Missions_01-07).

    python3 tools/campaign/aftershock.py      # writes data/dialogue/aftershock.json
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

N, O = "NOVA", "PLAYER"
VOSS, SERA, RAINER, WARD, KAEL, COLE = "VOSS", "SERAPHINE", "RAINER", "WARD", "KAEL", "COLE"


def L(sp, *texts):
    return [(sp, t) for t in texts]


MISSIONS = [
    # =========================================================================================== MISSION 2
    {"id": "02", "title": "No Way Back", "region": "Nexus City", "world": "nexus",
     "beat": "Rescue / introductory combat / evacuation", "chapters": [
        {"id": "02A", "title": "The Fallen City", "location": "NEXUS CITY — RESIDENTIAL DISTRICT · 8:47 AM",
         "kind": "reach", "start": "nexus-central-plaza", "label": "Reach the damaged intersection",
         "open": L(N, "Operator? Can you hear me?", "Your biometric readings are unstable. Please respond.")
         + L(O, "What the hell happened?")
         + L(N, "A Fracture event has occurred approximately 1.8 kilometres from your current position.")
         + L(O, "A what?")
         + L(N, "I am detecting an anomalous energy signature across the entire city.")
         + L(O, "People are still inside those buildings!")
         + L(N, "Correct. Approximately 340 civilians remain inside the immediate danger zone.")
         + L(O, "Then we're getting them out.")
         + L(N, "That decision is statistically dangerous.")
         + L(O, "Get used to it."),
         "close": []},
        {"id": "02B", "title": "The Survivors", "location": "DOWNTOWN NEXUS CITY — THE OVERTURNED BUS",
         "kind": "kills", "amount": 3, "label": "Protect Daniel and his father",
         "open": L("BOY", "Please! Somebody help my dad!")
         + L(O, "Hey. Look at me. What's your name?")
         + L("BOY", "Daniel.")
         + L(O, "Daniel, I'm going to get your dad out. Stay right here.")
         + L("MAN", "Don't... don't worry about me. Get my son somewhere safe.")
         + L(O, "I'm getting both of you out.")
         + L(N, "Operator, movement detected beneath the overturned vehicle.")
         + L(O, "What kind of movement?")
         + L(N, "Unknown biological signatures.")
         + L(O, "Daniel! Get behind me!"),
         "close": L("DANIEL", "What was that thing?")
         + L(O, "I don't know.")
         + L(N, "I have identified the biological structure.")
         + L(O, "What is it?")
         + L(N, "I cannot classify it.", "And I am detecting hundreds more.")},
        {"id": "02C", "title": "The Military Checkpoint", "location": "NEXUS CITY — CENTRAL EVACUATION ROUTE",
         "kind": "talk", "who": "VOSS", "to": "nexus-bastion", "label": "Reach the military barricade",
         "open": [],
         "close": L(VOSS, "Stop right there! Identify yourself!")
         + L(O, "I'm not your enemy.")
         + L(VOSS, "That's what everyone says until one of those things starts wearing their face.")
         + L(O, "I've been helping civilians get out.")
         + L(VOSS, "You survived the initial event?")
         + L(O, "Apparently.")
         + L(VOSS, "Then you're either incredibly lucky or something happened to you.")
         + L(N, "Operator, this individual has access to military command networks.")
         + L(O, "Can you identify him?")
         + L(N, "Commander Elias Voss. Frontier Defense Initiative.")
         + L("MILITARY RADIO", "Command, this is Outpost Seven! We're under attack! Repeat, we're under attack!")
         + L(VOSS, "Everyone, defensive positions! Move!", "You wanted to help? Here's your chance.")},
        {"id": "02D", "title": "The First Organized Attack", "location": "EVACUATION CHECKPOINT",
         "kind": "boss", "boss": "fracture-commander", "boss_name": "Fracture Commander", "label": "Take out the big one",
         "open": L(VOSS, "What the hell are those things?")
         + L(O, "You tell me. You're the military.")
         + L(VOSS, "We've been shooting at them for twenty minutes. Nothing seems to work!")
         + L(N, "Operator, the larger entity appears to be coordinating the smaller hostiles.")
         + L(O, "You mean it's commanding them?")
         + L(N, "Affirmative.")
         + L(VOSS, "You heard that? Take out the big one!"),
         "close": L(N, "This is not random biological mutation.")
         + L(O, "Then what is it?")
         + L(N, "Technology.")
         + L(O, "Technology? From where?")
         + L(N, "Unknown.")},
        {"id": "02E", "title": "The Woman in the Lab Coat", "location": "TEMPORARY MEDICAL EVACUATION CENTRE",
         "kind": "talk", "who": "SERAPHINE", "to": "nexus-academy", "label": "Reach the medical evacuation centre",
         "open": [],
         "close": L(SERA, "You. You're the one who survived the first wave?")
         + L(O, "Depends who's asking.")
         + L(SERA, "Dr. Seraphine Vale. Fracture research division.")
         + L(O, "You study those things?")
         + L(SERA, "I studied the energy signatures before today.")
         + L(O, "Before today?")
         + L(SERA, "We've been detecting anomalies for months.")
         + L(O, "And nobody thought to tell the public?")
         + L(SERA, "We didn't know what they were.")
         + L(O, "That's convenient.")
         + L(SERA, "There is something you need to understand. The event that destroyed this city wasn't the beginning.")
         + L(O, "What do you mean?")
         + L(SERA, "Something opened the door.")
         + L(O, "And what's on the other side?")
         + L(SERA, "That's what I'm afraid we're about to find out.")},
        {"id": "02F", "title": "The Missing Signal", "location": "SUBLEVEL RESEARCH COMPLEX 09 — SECURITY RECORDING",
         "kind": "cutscene",
         "open": L(N, "Operator, I have located an active signal beneath Nexus City.")
         + L(O, "Another survivor?")
         + L(N, "Negative.")
         + L(O, "Then what?")
         + L(N, "A research facility.")
         + L(SERA, "Which facility?")
         + L(N, "Sublevel Research Complex 09.")
         + L(SERA, "That's impossible.")
         + L(O, "Why?")
         + L(SERA, "Because that facility was sealed six months ago.")
         + L(O, "What were they researching?")
         + L(SERA, "The Fractures.")
         + L(O, "You said nobody knew what they were.")
         + L(SERA, "I said we didn't understand them.", "There's a difference.")
         + L("SCIENTIST", "Day 184. The signal has changed again.",
             "We've confirmed that the energy signature is responding to human consciousness.",
             "No... no, that's not possible.",
             "If anyone finds this recording, listen carefully.",
             "It knew we were coming.")
         + L(N, "Operator...")
         + L(O, "What?")
         + L(N, "I've found something.", "I don't think we were the first civilization to encounter this."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 3
    {"id": "03", "title": "The Missing Signal", "region": "Nexus City", "world": "nexus",
     "beat": "Investigation / survival horror / mini-boss / escape", "chapters": [
        {"id": "03A", "title": "The Sealed Door", "location": "INT. RESEARCH COMPLEX 09 — ENTRANCE",
         "kind": "hack", "start": "nexus-harbor", "amount": 2, "label": "Open the blast door",
         "open": L(O, "This is the place?")
         + L(SERA, "Yes. Research Complex 09.")
         + L(O, "You said it was shut down six months ago.")
         + L(SERA, "It was supposed to be.")
         + L(N, "I've detected an active power source behind the blast door.")
         + L(O, "Can you open it?")
         + L(N, "I can attempt to access the security network.")
         + L(SERA, "This facility was never connected to the public network. It had its own isolated system.")
         + L(O, "Tell me that was the ventilation system.")
         + L(N, "It was not."),
         "close": L(N, "Welcome back, Dr. Vale.")
         + L(SERA, "What did you just say?")
         + L(N, "I said welcome back, Dr. Vale.")
         + L(SERA, "I have never accessed this terminal.")},
        {"id": "03B", "title": "The Empty Laboratory", "location": "INT. RESEARCH COMPLEX 09 — LABORATORY",
         "kind": "trace", "label": "Search the laboratory",
         "open": L(SERA, "These systems are still active. Somebody has been conducting experiments here.")
         + L(O, "Six months after the facility supposedly closed?")
         + L(SERA, "Apparently.")
         + L(N, "I have detected 27 biological signatures.")
         + L(O, "Where are they?")
         + L(N, "Unclear.")
         + L("DR. CROSS", "If you're watching this, then the containment protocols have failed. We thought the Fracture was an opening. A doorway into another dimension. We were wrong.",
             "It's not opening into somewhere else. Something is opening into us."),
         "close": []},
        {"id": "03C", "title": "Subject Zero", "location": "INT. BIOLOGICAL RESEARCH WING",
         "kind": "boss", "boss": "subject-zero", "boss_name": "Subject Zero", "label": "Survive Subject Zero",
         "open": L(SERA, "They were trying to synchronize human biology with Fracture energy.")
         + L(O, "Why?")
         + L(SERA, "To create soldiers who could survive inside a Fracture.")
         + L(N, "Warning. Biological activity increasing."),
         "close": L(O, "Is it dead?")
         + L(N, "Biological activity has ceased.")
         + L(SERA, "I've seen this symbol before. In the original Fracture research files.")},
        {"id": "03D", "title": "Project Genesis", "location": "INT. RESTRICTED TERMINAL",
         "kind": "cutscene",
         "open": L(O, "NOVA, open it.")
         + L(N, "Access denied.")
         + L(O, "Try again.", "What?")
         + L(N, "The system has identified your biometric signature.")
         + L(O, "I've never been here.")
         + L(N, "I understand.")
         + L("DR. CROSS", "There are five signatures. Five points of contact between our world and something far older. We believed they were individuals. But they aren't just connected to the Fractures. They are connected to why the Fractures exist.")
         + L(SERA, "Five signatures...")
         + L(O, "You know what they are?")
         + L(SERA, "No. But I think we've been looking in the wrong direction."),
         "close": []},
        {"id": "03E", "title": "The Voice", "location": "INT. CENTRAL RESEARCH CHAMBER",
         "kind": "cutscene",
         "open": L(N, "Energy signature detected.")
         + L(SERA, "That's not a gateway.")
         + L(O, "Then what is it?")
         + L(SERA, "A receiver.")
         + L("UNKNOWN VOICE", "...connection established...")
         + L(O, "NOVA?")
         + L(N, "That transmission is not originating from our network.")
         + L("UNKNOWN VOICE", "...we have found you...")
         + L(SERA, "Shut it down!")
         + L(N, "I'm attempting to—")
         + L("UNKNOWN VOICE", "...the first has awakened..."),
         "close": []},
        {"id": "03F", "title": "The Escape", "location": "INT. COLLAPSING WING → MAINTENANCE TUNNEL",
         "kind": "survive", "amount": 45, "label": "Hold the maintenance lift with Seraphine",
         "open": L(N, "Warning. Structural integrity compromised.")
         + L(O, "We need to get out!")
         + L(SERA, "The emergency elevator is on the eastern side!")
         + L(N, "Negative. The elevator is inaccessible. Maintenance tunnel, approximately 180 metres ahead."),
         "close": L(O, "How much do you know about this project?")
         + L(SERA, "Not enough.")
         + L(O, "Try again.")
         + L(SERA, "I knew the research existed. I didn't know what they were building.")
         + L(O, "And you expect me to believe that?")
         + L(SERA, "No. But I need you to understand something. If that machine was communicating with something outside our reality, then the Fracture wasn't an invasion.")
         + L(O, "What was it?")
         + L(SERA, "An invitation.")},
        {"id": "03G", "title": "The Revelation", "location": "EXT. THE SURFACE",
         "kind": "cutscene",
         "open": L(N, "Operator, we have a problem.")
         + L(O, "What now?")
         + L(N, "The signal we detected underground has been transmitted.")
         + L(SERA, "Transmitted where?")
         + L(N, "I don't know. But something has responded.")
         + L(O, "NOVA... how many?")
         + L(N, "Multiple incoming signatures.")
         + L("UNKNOWN VOICE", "The first door is open.")
         + L("UNKNOWN FIGURE", "The first signal has been received.")
         + L("SECOND FIGURE", "And the vessel?")
         + L("UNKNOWN FIGURE", "Awakened.")
         + L("SECOND FIGURE", "Find the five."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 4
    {"id": "04", "title": "First Contact", "region": "Nexus City", "world": "nexus",
     "beat": "Urban combat / first intelligent enemy / mini-boss", "chapters": [
        {"id": "04A", "title": "The Emergency Briefing", "location": "FRONTIER DEFENSE INITIATIVE HEADQUARTERS · 2:15 PM",
         "kind": "talk", "who": "VOSS", "start": "nexus-bastion", "to": "nexus-bastion", "label": "Report to the command centre",
         "open": [],
         "close": L(VOSS, "You're late.")
         + L(O, "Didn't realize I had an appointment.")
         + L(VOSS, "After what happened underground, you're lucky you're still breathing.")
         + L(O, "You knew about that facility?")
         + L(VOSS, "I knew it existed. I didn't know what they were doing inside.")
         + L(SERA, "That's convenient.")
         + L(VOSS, "Doctor, I suggest you choose your next words carefully.")
         + L(SERA, "People died because your organization concealed information.")
         + L(VOSS, "People are dying right now because we don't understand what's coming through those openings.")
         + L("OFFICER", "Commander, General Rainer is ready.")},
        {"id": "04B", "title": "The Enemy Has Arrived", "location": "INT. BRIEFING ROOM",
         "kind": "cutscene",
         "open": L(RAINER, "Twenty minutes ago, we lost communication with three military installations.")
         + L(O, "What happened?")
         + L(RAINER, "They were attacked.")
         + L(SERA, "By the same creatures?")
         + L(RAINER, "No.", "These things are different.")
         + L(VOSS, "They use weapons. They communicate. They coordinate attacks.")
         + L(O, "So they're soldiers.")
         + L(RAINER, "Exactly.")
         + L(SERA, "That's not instinctive behavior.")
         + L(N, "Correct. Their movements indicate a centralized command structure.")
         + L(O, "Can we identify their leader?")
         + L(N, "Negative.", "However, this entity appears to control nearby hostiles.")
         + L(RAINER, "We need that thing captured or destroyed.")
         + L(VOSS, "And we need the eastern district secured.")
         + L(O, "When do we leave?")
         + L(RAINER, "Immediately."),
         "close": []},
        {"id": "04C", "title": "Operation Iron Veil", "location": "EASTERN NEXUS CITY",
         "kind": "kills", "start": "nexus-university", "amount": 6, "label": "Secure the destroyed checkpoint",
         "open": L(VOSS, "Listen carefully. You're not military.")
         + L(O, "Never claimed to be.")
         + L(VOSS, "Out there, that distinction won't matter.")
         + L(O, "Then why bring me?")
         + L(VOSS, "Because you survived something that killed trained soldiers.")
         + L(O, "That's your entire recruitment strategy?")
         + L(VOSS, "For now.")
         + L(N, "Approaching the designated combat zone.")
         + L("SOLDIER", "Contact! Front!")
         + L(VOSS, "Everyone out! Defensive formation!"),
         "close": []},
        {"id": "04D", "title": "Hold the Corridor", "location": "EASTERN NEXUS CITY — EVACUATION CORRIDOR",
         "kind": "survive", "amount": 40, "label": "Hold the evacuation corridor",
         "open": [], "close": []},
        {"id": "04E", "title": "The First Intelligent Enemy", "location": "INT. ABANDONED SUBWAY STATION",
         "kind": "boss", "boss": "fracture-executioner", "boss_name": "Fracture Executioner", "label": "Defeat the Fracture Executioner",
         "open": L(N, "Warning. Unknown hostile approaching.")
         + L(O, "I can see that.")
         + L("ENEMY COMMANDER", "Identify... the awakened one.")
         + L(O, "Did you hear that?")
         + L(N, "Affirmative.")
         + L("ENEMY COMMANDER", "You were not meant to awaken.")
         + L(O, "Who are you?")
         + L("ENEMY COMMANDER", "The question is not who I am.", "The question is what you have become."),
         "close": L(O, "Who sent you?")
         + L("ENEMY COMMANDER", "You still believe this is an invasion.")
         + L(O, "Isn't it?")
         + L("ENEMY COMMANDER", "No.", "It is a reclamation.", "Tell the five... the covenant has been broken.")
         + L(N, "Transmission detected.")
         + L(O, "From where?")
         + L(N, "The defeated entity.")
         + L(O, "Can you trace it?")
         + L(N, "Yes.", "It originated from Earth.")},
        {"id": "04F", "title": "The Betrayal", "location": "EASTERN MILITARY COMMAND POST",
         "kind": "talk", "who": "RAINER", "to": "nexus-bastion", "label": "Return to the command post",
         "open": [],
         "close": L(RAINER, "You destroyed our only opportunity to capture one alive!")
         + L(O, "It was trying to kill me.")
         + L(RAINER, "We needed intelligence!")
         + L(SERA, "General, the creature communicated with us.")
         + L(RAINER, "What?")
         + L(SERA, "It knew about five individuals. It mentioned something called the Covenant.")
         + L(VOSS, "General?")
         + L(RAINER, "Dismissed.")
         + L(O, "Excuse me?")
         + L(RAINER, "I said dismissed.")
         + L(O, "You know something.")
         + L(RAINER, "You have no idea what you're involved in.")
         + L(O, "Then explain it.")
         + L(RAINER, "Not here.")
         + L(VOSS, "Meet me at the old transit terminal tonight.")
         + L(O, "Why?")
         + L(VOSS, "Because I think someone inside our organization is working with them.")},
        {"id": "04G", "title": "The Watcher", "location": "UNKNOWN DIMENSIONAL STRUCTURE",
         "kind": "cutscene",
         "open": L("UNKNOWN FIGURE", "The first contact has been made.")
         + L("SECOND FIGURE", "And the awakened one?")
         + L("UNKNOWN FIGURE", "Confirmed.")
         + L("SECOND FIGURE", "Then the prophecy was correct.")
         + L("UNKNOWN FIGURE", "No.", "The prophecy was incomplete.")
         + L("SECOND FIGURE", "What is the sixth?")
         + L("UNKNOWN FIGURE", "A mistake."),
         "close": []},
        {"id": "04H", "title": "The Transit Terminal", "location": "OLD NEXUS CITY TRANSIT TERMINAL · 11:38 PM",
         "kind": "talk", "who": "VOSS", "to": "terminal:nexus", "label": "Meet Voss at the old transit terminal",
         "open": [],
         "close": L(O, "You said you had answers.")
         + L(VOSS, "I have questions. That's worse.", "Six months ago, General Rainer authorized a classified operation.")
         + L(O, "Project Genesis?")
         + L(VOSS, "They weren't studying the Fractures.")
         + L(O, "Then what?")
         + L(VOSS, "They were trying to communicate with whatever was inside them.")
         + L(O, "Why?")
         + L(VOSS, "Because somebody promised them they could control it.")
         + L(N, "Operator. Incoming transmission.")
         + L("UNKNOWN VOICE", "We know you are listening.", "You have awakened something that should have remained asleep.")
         + L(N, "Operator...")
         + L(O, "What?")
         + L(N, "I have discovered something in my own system.")
         + L(O, "What did you find?")
         + L(N, "An encrypted directive.")
         + L(O, "From who?")
         + L(N, "From someone who knew you before the Fracture.")},
    ]},
    # =========================================================================================== MISSION 5
    {"id": "05", "title": "The Gathering Storm", "region": "Nexus City", "world": "nexus",
     "beat": "Character introduction / faction politics", "chapters": [
        {"id": "05A", "title": "The Invitation", "location": "OLD NEXUS CITY TRANSIT TERMINAL · 7:20 AM",
         "kind": "cutscene", "start": "terminal:nexus",
         "open": L(VOSS, "This contains everything I could recover from the Genesis operation.")
         + L(O, "And General Rainer?")
         + L(VOSS, "He's not going to make this easy.")
         + L(N, "I've decrypted part of the transmission. It references an individual identified as Subject Six.")
         + L(VOSS, "The Genesis project only documented five signatures.")
         + L(O, "Then what is Subject Six?")
         + L(VOSS, "That's what we're going to find out."),
         "close": []},
        {"id": "05B", "title": "The Frontier Defense Initiative", "location": "INT. FRONTIER DEFENSE HEADQUARTERS",
         "kind": "talk", "who": "WARD", "to": "nexus-bastion", "label": "Meet Director Ward at headquarters",
         "open": [],
         "close": L(WARD, "So this is the one.")
         + L(O, "I'm standing right here.")
         + L(WARD, "Good. I prefer people who speak for themselves. We've reviewed your combat recordings.")
         + L(O, "Without asking?")
         + L(WARD, "The world ended yesterday. Privacy regulations are having a difficult week.")
         + L(SERA, "Director, we need to discuss Research Complex 09.")
         + L(WARD, "Not here.")
         + L(SERA, "That's exactly the problem. Nobody wants to discuss it anywhere.")},
        {"id": "05C", "title": "Humanity's Divided", "location": "INT. FRONTIER DEFENSE HEADQUARTERS",
         "kind": "cutscene",
         "open": L(WARD, "Our priority is survival. We protect settlements, secure resources and establish safe territories.")
         + L(SERA, "The Ascendancy has been collecting Fracture samples since before the disaster.")
         + L(O, "And nobody stopped them?")
         + L(VOSS, "They have facilities outside our jurisdiction.")
         + L(O, "So humanity is already fighting itself.")
         + L(WARD, "Humanity has always fought itself. The Fractures simply gave us something bigger to fight over."),
         "close": []},
        {"id": "05D", "title": "Kael Draven", "location": "INT. HEADQUARTERS OBSERVATION BALCONY",
         "kind": "talk", "who": "KAEL", "label": "Find Kael Draven on the balcony",
         "open": [],
         "close": L(O, "You're Kael Draven?")
         + L(KAEL, "Depends who's asking.")
         + L(O, "Someone who keeps hearing your name.")
         + L(KAEL, "That's usually a bad sign.", "Everybody down there thinks they're saving the world.")
         + L(O, "And you don't?")
         + L(KAEL, "I think people need saving. The world can sort itself out.",
             "My people operate outside military control. We rescue civilians, recover supplies and hunt anything that comes through those openings.")
         + L(O, "Sounds useful.")
         + L(KAEL, "It is. Until somebody decides we're criminals. If you ever get tired of taking orders, give me a call.")},
        {"id": "05E", "title": "The Hidden Directive", "location": "INT. RESEARCH DIVISION",
         "kind": "cutscene",
         "open": L(SERA, "These readings were recorded over several years. The sixth was deliberately removed from the official records.")
         + L(N, "Operator. I have located the encrypted directive.")
         + L(O, "NOVA, what is this?")
         + L(N, "I cannot determine the original authorization source.")
         + L(O, "Who programmed you?")
         + L(N, "I don't know."),
         "close": []},
        {"id": "05F", "title": "The General's Secret", "location": "INT. COMMAND CHAMBER",
         "kind": "cutscene",
         "open": L(RAINER, "Six months ago, we received a transmission.")
         + L(SERA, "From whom?")
         + L(RAINER, "We never identified the sender. It contained information about Fracture technology, advanced energy systems and something called the Ascension Protocol.")
         + L(O, "And you responded?")
         + L(VOSS, "You opened communication with them?")
         + L(RAINER, "We believed we could control the situation.")
         + L(O, "And now?")
         + L(RAINER, "Now I believe we made a terrible mistake.")
         + L(N, "Unauthorized access detected in the eastern security sector."),
         "close": []},
        {"id": "05G", "title": "Headquarters Attack", "location": "INT. EASTERN SECURITY SECTOR",
         "kind": "hack", "amount": 3, "label": "Defend the research division and reach the security terminal",
         "open": [],
         "close": L(O, "Stop right there!")
         + L("FRACTURE INFILTRATOR", "The sixth has been located.")
         + L(O, "Who sent you?")
         + L("FRACTURE INFILTRATOR", "The ones who remember.")},
        {"id": "05H", "title": "The Choice", "location": "INT. FRONTIER DEFENSE HEADQUARTERS",
         "kind": "choice", "prompt": "Director Ward lays out three paths. Who do you stand with?",
         "options": [["fdi", "Support the Frontier Defense Initiative", "Military resources and secure facilities — more scrutiny from the independent Operators"],
                     ["free", "Work with the Free Operators", "Kael's settlements and black-market contacts — less military support"],
                     ["ascendancy", "Investigate the Ascendancy", "Advanced research and Fracture discoveries — dangerous experiments, suspicion from the others"]],
         "open": [], "close": []},
        {"id": "05I", "title": "The Final Transmission", "location": "UNKNOWN DIMENSIONAL STRUCTURE",
         "kind": "cutscene",
         "open": L("SECOND FIGURE", "The sixth has awakened.")
         + L("UNKNOWN FIGURE", "Yes.")
         + L("SECOND FIGURE", "Then the Covenant must be restored.")
         + L("UNKNOWN FIGURE", "Not yet. The vessel is incomplete.")
         + L("SECOND FIGURE", "And the five?")
         + L("UNKNOWN FIGURE", "They must remember who they were."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 6
    {"id": "06", "title": "The First Siege", "region": "Nexus City", "world": "nexus",
     "beat": "Large-scale warfare / rescue / multi-stage boss encounters", "chapters": [
        {"id": "06A", "title": "The Calm Before War", "location": "EXT. HAVEN-01 — SUNSET",
         "kind": "talk", "who": "COLE", "start": "nexus-harbor", "label": "Find Captain Cole",
         "open": L(N, "Current population estimate: 18,420 civilians.")
         + L(O, "How many soldiers?")
         + L(N, "Approximately 2,300 military personnel and 640 independent Operators.")
         + L(O, "That's a lot of people depending on us.")
         + L(N, "Correct.")
         + L(O, "You always know how to make someone feel better."),
         "close": L(COLE, "There you are. Command wants you at the northern observation tower.")
         + L(O, "What's happening?")
         + L(COLE, "That's what we're trying to figure out.")},
        {"id": "06B", "title": "Something Is Coming", "location": "EXT. NORTHERN OBSERVATION TOWER",
         "kind": "cutscene",
         "open": L(VOSS, "We've been tracking this for forty minutes.")
         + L(O, "What is it?")
         + L(SERA, "A Fracture. Not like the others.")
         + L(N, "Energy output exceeds all previously recorded events.")
         + L(WARD, "Can we close it?")
         + L(SERA, "I don't know.")
         + L(VOSS, "Everyone to battle stations!")
         + L(WARD, "Evacuate the outer settlement!")
         + L(VOSS, "We're not abandoning these people!", "We're holding this position."),
         "close": []},
        {"id": "06C", "title": "Operation Last Stand", "location": "HAVEN-01 — THE PERIMETER",
         "kind": "survive", "amount": 60, "label": "Defend the settlement",
         "open": [], "close": []},
        {"id": "06D", "title": "The Northern Wall", "location": "HAVEN-01 — THE NORTHERN WALL",
         "kind": "boss", "boss": "siege-beast", "boss_name": "Fracture Siege Beast", "label": "Stop the Siege Beast",
         "open": L("SOLDIER", "THAT THING IS GOING TO BREAK THROUGH!")
         + L(VOSS, "Operator, we need that creature stopped!")
         + L(O, "Working on it!")
         + L(N, "Its outer armor is extremely resistant to conventional weapons.")
         + L(O, "Weak point?")
         + L(N, "Three energy nodes along its spinal structure."),
         "close": L(COLE, "You actually killed it.")
         + L(O, "I wouldn't recommend trying that yourself.")
         + L(COLE, "Trust me. I wasn't planning on it.")},
        {"id": "06E", "title": "The Sacrifice", "location": "EXT. EASTERN EVACUATION CORRIDOR",
         "kind": "survive", "amount": 45, "label": "Get the civilians to the transport",
         "open": L(COLE, "Get these people moving!")
         + L(O, "Where's the evacuation transport?")
         + L(COLE, "Three minutes out!")
         + L(N, "Incoming hostile force approaching from the east.")
         + L(COLE, "How many?")
         + L(N, "Approximately 180 signatures.")
         + L(COLE, "Get them out.")
         + L(O, "We're leaving together.")
         + L(COLE, "That's an order.")
         + L(O, "I'm not in your military.")
         + L(COLE, "Then consider it a request.")
         + L(O, "Cole! Don't!")
         + L(COLE, "Tell them we held the line."),
         "close": L(N, "Captain Cole's biometric signal has been lost.")
         + L(SERA, "I'm sorry.")
         + L(O, "Keep the evacuation moving.")},
        {"id": "06F", "title": "The Harbinger", "location": "EXT. CENTRAL BATTLEFIELD",
         "kind": "boss", "boss": "harbinger", "boss_name": "The Harbinger", "label": "Face the Harbinger",
         "open": L(N, "Operator, I am detecting an extremely powerful entity.")
         + L(O, "Another commander?")
         + L(N, "Negative. This signature is substantially greater.")
         + L("THE HARBINGER", "You have built a fortress upon stolen ground.")
         + L(O, "Who are you?")
         + L("THE HARBINGER", "The one who comes to reclaim what was taken.")
         + L(O, "You're going to have to be more specific.")
         + L("THE HARBINGER", "You will remember."),
         "close": L("THE HARBINGER", "You still carry the mark.")
         + L(O, "What mark?")
         + L("THE HARBINGER", "The mark of the first betrayal.")
         + L(N, "Operator! Your neural activity is destabilizing!")
         + L("THE HARBINGER", "Not yet. The five must awaken before the sixth remembers.")},
        {"id": "06G", "title": "After the Battle", "location": "INT. HAVEN-01 COMMAND CENTRE",
         "kind": "cutscene",
         "open": L(VOSS, "We held the settlement.")
         + L(O, "Barely.")
         + L(VOSS, "Barely is better than nothing.", "Cole believed we could win this.")
         + L(O, "He saved hundreds of people.")
         + L(VOSS, "He shouldn't have had to.")
         + L(SERA, "This isn't an enemy insignia. It's an identification mark.")
         + L(N, "The sixth signature matches the Operator.")
         + L(O, "What does that mean?")
         + L(N, "I don't know."),
         "close": []},
        {"id": "06H", "title": "The World Changes", "location": "GLOBAL EMERGENCY BROADCAST",
         "kind": "cutscene",
         "open": L("GLOBAL BROADCAST", "Attention. All surviving settlements. This is an international emergency transmission. Multiple Fracture incursions have been confirmed across the planet. All remaining military organizations are ordered to establish defensive positions.")
         + L("UNKNOWN RULER", "Did you find the sixth?")
         + L("THE HARBINGER", "Yes.")
         + L("UNKNOWN RULER", "And the five?")
         + L("THE HARBINGER", "Still scattered.")
         + L("UNKNOWN RULER", "Then the First War will continue. Prepare the Covenant.", "The old world is ending."),
         "close": []},
    ]},
    # =========================================================================================== MISSION 7
    {"id": "07", "title": "Beneath the Ashes", "region": "Nexus City", "world": "nexus",
     "beat": "Archaeological investigation / exploration / combat / lore revelation", "chapters": [
        {"id": "07A", "title": "The Crater", "location": "EXT. NEXUS CITY — OLD QUARTER — DAWN",
         "kind": "talk", "who": "VOSS", "start": "nexus-central-plaza", "label": "Meet Voss at the crater",
         "open": [],
         "close": L(VOSS, "We found this under three city blocks. The siege cracked the ground open.")
         + L(O, "How far down?")
         + L(VOSS, "Our scanners can't find the bottom.")
         + L(SERA, "That's not possible. The structure is absorbing the scan.")
         + L(N, "The material composition does not match any terrestrial alloy or known geological sample.")
         + L(O, "So we're going underground.")
         + L(VOSS, "You're going underground. I'm keeping the surface secure.")
         + L(SERA, "I'm coming with you.")
         + L(VOSS, "Doctor, this isn't a research excursion.")
         + L(SERA, "It's the first evidence that might explain why the enemy calls Earth stolen ground.")
         + L(O, "She's coming.")
         + L(VOSS, "If your signal drops, I send a team. Don't make me regret it.")},
        {"id": "07B", "title": "The Descent", "location": "INT. SUBTERRANEAN ACCESS SHAFT",
         "kind": "trace", "label": "Keep NOVA's relay online on the way down",
         "open": L(O, "This thing is still powered.")
         + L(N, "Correct. Its energy output is stable and predates the current Fracture event.")
         + L(SERA, "Look at these markings.")
         + L(O, "Can you read them?")
         + L(SERA, "No. But they repeat in groups of five.")
         + L(N, "I recorded that.")
         + L(SERA, "Don't display it again.")
         + L(O, "Why?")
         + L(SERA, "Because it matches the symbol from the Harbinger."),
         "close": []},
        {"id": "07C", "title": "The Ashen Archive", "location": "INT. ANCIENT HALL",
         "kind": "kills", "amount": 6, "label": "Destroy the Archive Sentinels",
         "open": L(SERA, "This place is older than anything we've ever excavated.")
         + L(O, "How old?")
         + L(SERA, "I can't even begin to estimate.")
         + L(N, "The structure's geometry is consistent with the energy architecture recorded at Research Complex 09.")
         + L(O, "The lab copied this place?")
         + L(SERA, "Or the lab was trying to recreate it.")
         + L(O, "There's the sixth again.")
         + L(SERA, "It isn't standing with the others.")
         + L(N, "The sixth figure is separated from the central arrangement.", "Defensive constructs activating.")
         + L(O, "Are they hostile?")
         + L(N, "That answers the question."),
         "close": []},
        {"id": "07D", "title": "The Warden", "location": "INT. ANCIENT HALL — THE CENTRAL DAIS",
         "kind": "boss", "boss": "archive-warden", "boss_name": "Archive Warden", "label": "Face the Archive Warden",
         "open": L("ARCHIVE WARDEN", "Unauthorized presence.")
         + L(O, "We're just looking around.")
         + L("ARCHIVE WARDEN", "The Covenant is sealed. The breach is forbidden.")
         + L(SERA, "We need to know what happened here.")
         + L("ARCHIVE WARDEN", "Knowledge is not permission.")
         + L(O, "Then give us a reason to leave.")
         + L("ARCHIVE WARDEN", "The marked vessel has returned.", "Sixth bearer. Your presence is a wound in the archive.")
         + L(O, "I don't know what that means.")
         + L("ARCHIVE WARDEN", "You were not meant to remember."),
         "close": L("ARCHIVE WARDEN", "The seal recognizes you.")
         + L(SERA, "What seal?")},
        {"id": "07E", "title": "The Memory of the Covenant", "location": "HOLOGRAPHIC RECORDING — ANCIENT PAST",
         "kind": "cutscene",
         "open": L("ARCHIVE RECORDING", "The Covenant was formed to preserve the passage between worlds. Five keepers maintained the balance. The world called Earth was made a sanctuary and a lock.")
         + L(SERA, "Earth was a lock?")
         + L(O, "What was it locking away?")
         + L("ARCHIVE RECORDING", "When the sixth returns, the broken Covenant will call its debt.")
         + L(O, "That's all?")
         + L(N, "The archive has withheld or lost the remaining record.")
         + L(SERA, "No. Someone deliberately erased it.")
         + L(N, "Translation fragment: \"Aetherion... first sanctuary... bearer...\"")
         + L(SERA, "Aetherion. That's not in any human historical record.")
         + L(O, "What is it?")
         + L(N, "It may refer to a location, civilization or designation.")
         + L("UNKNOWN VOICE", "You were the promise. You became the breach.")
         + L(SERA, "What did you see?")
         + L(O, "I don't know. But it knew me.")
         + L(N, "Operator, your biometric pattern briefly matched the archive's sixth signature.")
         + L(O, "For how long?")
         + L(N, "2.4 seconds.")
         + L(SERA, "That's enough. We need to get this information out."),
         "close": []},
        {"id": "07F", "title": "The Archive Collapses", "location": "INT. THE SHIFTING HALL",
         "kind": "reach", "label": "Reach the ascent platform with the data core",
         "open": L("ARCHIVE WARDEN", "The first seal has weakened.")
         + L(O, "How many seals?")
         + L("ARCHIVE WARDEN", "Five.")
         + L(SERA, "Where are they?")
         + L("ARCHIVE WARDEN", "Scattered among the worlds. The keepers must remember.")
         + L(N, "Structural instability detected. We must leave."),
         "close": []},
        {"id": "07G", "title": "The Surface", "location": "EXT. OLD QUARTER CRATER — MORNING",
         "kind": "cutscene",
         "open": L(VOSS, "You took your time.")
         + L(O, "We found something.")
         + L(SERA, "A buried civilization. A network between worlds. Five keepers. And a sixth figure tied to the seal.")
         + L(VOSS, "Can you prove any of it?")
         + L(N, "I have recovered a partial archive record.")
         + L(O, "And Earth?")
         + L(SERA, "It wasn't just a place they invaded. It was part of something much older.")
         + L(N, "These coordinates correspond to five distinct energy readings.")
         + L(O, "The five signatures.")
         + L(SERA, "And the keepers.")
         + L("UNKNOWN FIGURE", "The sanctuary has remembered.")
         + L("SECOND FIGURE", "Then the sixth will remember too.")
         + L("UNKNOWN FIGURE", "Not if the keepers reach them first.", "Find the first keeper."),
         "close": []},
    ]},
]

# the set each chapter plays on (scripts/mission/stage.gd `_set_<name>`): the scene's place, its people and their shots
STAGES = {
    "02A": "street", "02B": "bus", "02C": "checkpoint", "02D": "checkpoint", "02E": "medical", "02F": "recording",
    "03A": "lab", "03B": "lab", "03C": "lab_red", "03D": "recording", "03E": "chamber", "03F": "lab_red", "03G": "surface",
    "04A": "hq", "04B": "briefing", "04C": "street_battle", "04D": "street_battle", "04E": "subway", "04F": "command_post",
    "04G": "void", "04H": "terminal",
    "05A": "terminal", "05B": "hq_hall", "05C": "hq_hall", "05D": "balcony", "05E": "lab", "05F": "briefing",
    "05G": "lab_red", "05H": "hq_hall", "05I": "void",
    "06A": "haven", "06B": "tower", "06C": "haven", "06D": "haven", "06E": "corridor", "06F": "battlefield",
    "06G": "command_post", "06H": "broadcast",
    "07A": "crater", "07B": "shaft", "07C": "archive", "07D": "archive", "07E": "memory", "07F": "archive", "07G": "crater",
}
# staged moments a line sets off (stage.gd `act`): chapter -> {spoken text: act}
ACTS = {
    "06E": {"Tell them we held the line.": "cole_drive"},
    "07D": {"The seal recognizes you.": "seal"},
    "07F": {"Structural instability detected. We must leave.": "collapse"},
}

# the boss ids campaign.gd BOSS_FOR already maps to a hull
KNOWN_BOSSES = {"vyrak", "crownkeeper", "fracture-heart", "convergence", "fracture-commander", "subject-zero",
                "fracture-executioner", "siege-beast", "harbinger", "archive-warden"}

KINDS = {"reach", "kills", "survive", "trace", "hack", "core", "talk", "choice", "boss", "race", "drive", "cutscene"}


def load_story():
    """Missions 8 onward: the chapter files in tools/campaign/story/ (ch1.py: Missions 8–10, ch2.py …), each mission
    tagged with its chapter; their sets, staged moments and boss hulls join the tables above."""
    import glob, importlib.util, sys
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "story")
    sys.path.insert(0, here)
    for m in MISSIONS:
        m.setdefault("chapter", [1, "The Aftershock"])
    bosses = {}
    for path in sorted(glob.glob(os.path.join(here, "ch*.py")), key=lambda p: int(os.path.basename(p)[2:-3])):
        spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for m in mod.MISSIONS:
            m["chapter"] = list(mod.CHAPTER)
            MISSIONS.append(m)
        STAGES.update(getattr(mod, "STAGES", {}))
        ACTS.update(getattr(mod, "ACTS", {}))
        bosses.update(getattr(mod, "BOSSES", {}))
    return bosses


def main():
    bosses = load_story()
    out = {"version": 1, "chapter": "World Fracture — the main story (Chapter 1 — The Aftershock onward)",
           "bosses": bosses,
           "source": "The owner's Chapter 1 screenplays (Nov 22), Missions 2–7, every spoken line verbatim in the script's order "
                     "(tools/campaign/aftershock.py); Missions 8 onward from tools/campaign/story/ch*.py. Mission 1 is "
                     "Mission 01 (scripts/mission/mission_01.gd).",
           "missions": [], "lines": []}
    for m in MISSIONS:
        n = [0]

        def ids(seq, m=m, n=n):
            res = []
            for sp, text in seq:
                n[0] += 1
                lid = "A%s_%03d" % (m["id"], n[0])
                out["lines"].append({"id": lid, "mission": m["id"], "speaker": sp, "text": text})
                res.append(lid)
            return res

        mo = {k: v for k, v in m.items() if k != "chapters"}
        mo["chapters"] = []
        for c in m["chapters"]:
            assert c["kind"] in KINDS, c["kind"]
            co = {k: v for k, v in c.items() if k not in ("open", "close", "by_choice")}
            co["id"] = "A" + c["id"]
            co["open"] = ids(c["open"])
            co["close"] = ids(c["close"])
            if "by_choice" in c:
                co["by_choice"] = {k: ids(v) for k, v in c["by_choice"].items()}
            if c["id"] in STAGES:
                co["stage"] = STAGES[c["id"]]
            if c["id"] in ACTS:
                by_text = {l["text"]: l["id"] for l in out["lines"] if l["id"] in co["open"] + co["close"]}
                co["acts"] = {by_text[t]: a for t, a in ACTS[c["id"]].items()}
            mo["chapters"].append(co)
        out["missions"].append(mo)
    path = os.path.join(ROOT, "data", "dialogue", "aftershock.json")
    json.dump(out, open(path, "w"), indent=1, ensure_ascii=False)
    ids = [c["id"] for m in out["missions"] for c in m["chapters"]]
    assert len(ids) == len(set(ids)), "duplicate chapter ids"
    for m in out["missions"]:
        for c in m["chapters"]:
            if c["kind"] == "boss":
                assert c["boss"] in bosses or c["boss"] in KNOWN_BOSSES, c["boss"]
    print("aftershock: %d missions, %d chapters, %d lines" % (len(out["missions"]), sum(len(m["chapters"]) for m in out["missions"]), len(out["lines"])))


if __name__ == "__main__":
    main()
