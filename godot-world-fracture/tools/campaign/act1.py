"""Campaign script, Act I — the Nexus City missions after the apartment (M02–M05) and the first expeditions (M06–M08).

Every mission is the owner's campaign dialogue draft (data/dialogue/campaign_draft1.json) played in full and in order —
a bare id string is one of the owner's lines, verbatim — with new lines around them (dicts) that turn each beat into a
playable chapter: an opening, the objective, the close. New line ids are M<mission>_D<nn> ("draft"), so the owner can
find and rewrite every word that is not theirs. Kinds are the descent's (scripts/mission/descent.gd): reach, kills,
survive, trace, hack, core; plus talk (walk up to the named person), choice (scripts/cinema/choice.gd), boss, race,
drive, and cutscene (lines only).
"""

N = "NOVA"
P = "PLAYER"


def L(speaker, text):
    return {"speaker": speaker, "text": text}


MISSIONS = [
    {
        "id": "02", "title": "The Broken Stairwell", "region": "Nexus City", "beat": "Rescue neighbors, awaken first ability",
        "world": "nexus", "chapters": [
            {"id": "02A", "title": "Floor twelve", "location": "INT. APARTMENT BLOCK, TWELFTH-FLOOR LANDING — MORNING", "kind": "reach", "start": "nexus-plate", "amount": 1,
             "label": "Reach the blocked stairwell",
             "open": [L(N, "The stairwell is two doors down. The building has eleven floors of people under us and one way out."),
                      L(P, "Then one way out will have to be enough."),
                      L(N, "Smoke on the landing. Keep your head low and your hand on the rail.")],
             "close": ["M02_001", "M02_002"]},
            {"id": "02B", "title": "The beam", "location": "INT. STAIRWELL — SMOKE", "kind": "survive", "amount": 20,
             "label": "Hold the beam for twenty seconds",
             "open": ["M02_003", "M02_004", "M02_005", L(N, "Your heart rate is 140. The current follows it. Breathe out, and push."),
                      L(P, "I am pushing."), L(N, "Not with your arms.")],
             "close": ["M02_006", "M02_007", "M02_008"]},
            {"id": "02C", "title": "Service stairs", "location": "INT. SERVICE STAIRS → STREET", "kind": "reach", "start": "nexus-central-plaza", "amount": 1,
             "label": "Get the family to the street",
             "open": ["M02_009", L("CIVILIAN", "What did you just do up there?"), L(P, "Keep moving. I will tell you when I know."),
                      L(N, "Eleven floors. The service stairs hold. The main ones do not.")],
             "close": ["M02_010", "M02_011", L(N, "Noted. I will stop saying it. I will keep measuring it.")]},
        ]},
    {
        "id": "03", "title": "Streets of Glass", "region": "Nexus City", "beat": "First open-world street traversal",
        "world": "nexus", "chapters": [
            {"id": "03A", "title": "Shelter indoors", "location": "EXT. NEXUS AVENUE — GLASS EVERYWHERE", "kind": "reach", "start": "nexus-central-plaza", "amount": 1,
             "label": "Cross the avenue to the transit station",
             "open": ["M03_001", "M03_002", "M03_003", "M03_004", "M03_005",
                      L(P, "A road that goes somewhere new. That is not the worst thing on this street."),
                      L(N, "It is the worst thing. The things on this street came down it.")],
             "close": []},
            {"id": "03B", "title": "Out of the purple light", "location": "EXT. TRANSIT STATION STEPS", "kind": "kills", "amount": 6,
             "label": "Hold the station steps",
             "open": ["M03_006", "M03_007", "M03_008", L(P, "Cover. Movement. Ability. In that order?"), L(N, "In whichever order keeps you alive.")],
             "close": ["M03_009", "M03_010", L("SURVIVOR", "They are through. The train is through. Who are you?"),
                       L(P, "Somebody who lives on twelve."), L(N, "Lived.")]},
        ]},
    {
        "id": "04", "title": "The First Operator", "region": "Nexus City", "beat": "Encounter the Operator response team",
        "world": "nexus", "chapters": [
            {"id": "04A", "title": "Weapon down", "location": "EXT. NEXUS BASTION CHECKPOINT — DUSK", "kind": "talk", "start": "nexus-bastion", "who": "CAPTAIN VALE", "amount": 1,
             "label": "Approach the checkpoint",
             "open": [L(N, "Operator response team at the bastion. Armoured, calm, and counting you."),
                      L(P, "Counting me as what?"), L(N, "That is the question they will ask.")],
             "close": ["M04_001", "M04_002", "M04_003", "M04_004", "M04_005", "M04_006", "M04_007"]},
            {"id": "04B", "title": "Civilians first", "location": "EXT. CHECKPOINT → ARMORY", "kind": "reach", "start": "nexus-armory", "amount": 1,
             "label": "Walk with the team to the armory",
             "open": ["M04_008", "M04_009", L("CAPTAIN VALE", "That is more than most people decide in a week."),
                      L(N, "She is recording you. So am I. Mine is the one you can read.")],
             "close": [L("CAPTAIN VALE", "Armory. Draw what you can carry. Nobody gets issued more than they can explain."),
                       L(P, "I can explain a rifle."), L("CAPTAIN VALE", "Good. Explain the rest to me tomorrow.")]},
        ]},
    {
        "id": "05", "title": "The Choice to Stay", "region": "Nexus City", "beat": "Player chooses cooperation or independence",
        "world": "nexus", "chapters": [
            {"id": "05A", "title": "Soldiers", "location": "INT. BASTION BRIEFING ROOM — NIGHT", "kind": "cutscene",
             "open": ["M05_001", "M05_002", "M05_003", "M05_004", "M05_005", "M05_006"], "close": []},
            {"id": "05B", "title": "Protect the district", "location": "EXT. NEXUS AVENUE — NIGHT PATROL", "kind": "kills", "amount": 8,
             "label": "Clear the district of the night's breach",
             "open": [L(N, "Breach signatures at the plaza. Two squads of Vanguard drones, one of them already leaking."),
                      L(P, "Leaking what?"), L(N, "Whatever the purple light is made of.")],
             "close": [L(N, "District clear. Vale watched the whole thing from the wall."), L(P, "Then she has her proof.")]},
            {"id": "05C", "title": "The choice", "location": "EXT. BASTION WALL — DAWN", "kind": "choice",
             "prompt": "Captain Vale is waiting for an answer.",
             "options": [["cooperate", "Work with her team", "Civilians come first; you answer to your conscience before her"],
                         ["independent", "Stay independent", "You help, but you are not joining anyone's command"]],
             "open": [L("CAPTAIN VALE", "You held the district. So. Where do you stand?")],
             "by_choice": {"cooperate": ["M05_cooperate_001", "M05_cooperate_002"], "independent": ["M05_independent_001", "M05_independent_002"]},
             "close": [L(N, "Recorded. Both of us will remember this one.")]},
        ]},
    {
        "id": "06", "title": "Verdant Echoes", "region": "Verdant Forest", "beat": "First regional expedition, no mandatory calibration",
        "world": "veridan", "chapters": [
            {"id": "06A", "title": "Peaceful", "location": "EXT. VERDANT FOREST, THE NORTH GROVE — DAY", "kind": "reach", "start": "crash-site", "amount": 1, "to": "vf-north-grove",
             "label": "Follow the scout's trail to the north grove",
             "open": ["M06_001", "M06_002", L(N, "The scout's trail runs north. She has not used the same route twice."),
                      L(P, "Careful, or lost?"), L(N, "Careful. Lost people repeat themselves.")],
             "close": ["M06_003", "M06_004", "M06_005"]},
            {"id": "06B", "title": "Beneath the roots", "location": "EXT. THE ELDER TREE", "kind": "trace", "amount": 3, "to": "vf-elder-tree",
             "label": "Trace the signal under the roots",
             "open": ["M06_006", "M06_007", "M06_008", L("SCOUT MIRA", "Then stay on the moss. The forest keeps count of what you break.")],
             "close": [L(N, "Signal source: a seed vault, pre-Fracture, still sealed."), L("SCOUT MIRA", "Still sealed means still hers. Leave it."),
                       L(P, "We leave it. We note where it is."), L("SCOUT MIRA", "Note it in your head, not on the map.")]},
            {"id": "06C", "title": "What the forest sends", "location": "EXT. LUMINA FALLS", "kind": "kills", "amount": 5, "to": "vf-lumina-falls",
             "label": "Drive off the corrupted wildlife",
             "open": [L(N, "Hostile fauna. The forest has decided what you are."), L(P, "It is wrong."), L(N, "Convince it.")],
             "close": [L("SCOUT MIRA", "You did not burn anything."), L(P, "Was that the test?"), L("SCOUT MIRA", "That was the first one.")]},
        ]},
    {
        "id": "07", "title": "The Living Forest", "region": "Verdant Forest", "beat": "Faction choice and evolving dungeon",
        "world": "veridan", "chapters": [
            {"id": "07A", "title": "Samples", "location": "EXT. THE GROTTO — WARDEN'S CAMP", "kind": "talk", "start": "vf-grotto", "who": "WARDEN ILYA", "amount": 1,
             "label": "Find the Warden at the grotto",
             "open": [L(N, "The Warden's people have seen us since the falls. They let us walk."),
                      L(P, "That is either trust or a trap."), L(N, "In this forest it is usually the same thing.")],
             "close": ["M07_001", "M07_002", "M07_003"]},
            {"id": "07B", "title": "The shifting roots", "location": "INT. THE ROOT DUNGEON — MOVING", "kind": "reach", "amount": 1, "to": "vf-ruins",
             "label": "Follow the living roots to the extraction site",
             "open": ["M07_004", "M07_005", "M07_006", "M07_007",
                      L(N, "Left. No — the left just closed. Straight, then.")],
             "close": [L(N, "Extraction site. Vanguard drills, abandoned in a hurry. The forest is still digesting the camp."),
                       L("WARDEN ILYA", "They took the heartwood. The trees took them. Now you decide what happens to the rest.")]},
            {"id": "07C", "title": "The cost of answers", "location": "EXT. EXTRACTION SITE", "kind": "choice",
             "prompt": "The extraction site is yours to decide.",
             "options": [["protect_forest", "Seal the site", "The forest has paid enough; the Warden becomes an ally"],
                         ["take_sample", "One sample, documented", "Evidence for the surface; the Warden holds you to every word"]],
             "open": [L("WARDEN ILYA", "Well?")],
             "by_choice": {"protect_forest": ["M07_protect_forest_001", "M07_protect_forest_002"], "take_sample": ["M07_take_sample_001", "M07_take_sample_002"]},
             "close": [L(N, "The dungeon is settling. It will not look like this tomorrow."), L(P, "Nothing here does.")]},
        ]},
    {
        "id": "08", "title": "Solara Crossing", "region": "Solara Desert", "beat": "Desert convoy and racing introduction",
        "world": "solara", "chapters": [
            {"id": "08A", "title": "Rook's garage", "location": "EXT. SOLARA GARAGE — NOON HEAT", "kind": "talk", "start": "solara-garage", "who": "MECHANIC ROOK", "amount": 1,
             "label": "Find Rook at the garage",
             "open": [L(N, "Solara. Forty-six degrees in the shade and the shade is for sale."), L(P, "Who sells shade?"), L(N, "Everyone here.")],
             "close": ["M08_001", "M08_002", "M08_003"]},
            {"id": "08B", "title": "The convoy run", "location": "EXT. THE DUNE GATE → THE RIBCAGE", "kind": "race", "start": "solara-dunegate", "track": "solara", "amount": 1,
             "label": "Win the convoy run",
             "open": ["M08_004", "M08_005", "M08_006", L("RACER", "Rook's new charity case. Try to keep the car in one country.")],
             "close": [L("MECHANIC ROOK", "You won. In a storm. In that."), L(P, "You said we could negotiate."),
                       L("MECHANIC ROOK", "I said we can. Pull in. The front end is talking to me and it is not saying nice things."),
                       L(N, "He is proud of you. He will deny it under any questioning.")]},
        ]},
]
