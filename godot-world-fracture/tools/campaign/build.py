#!/usr/bin/env python3
"""Builds data/dialogue/campaign_full.json — the whole campaign as playable chapters — from act1/act2/act3.py.

Checks: every one of the owner's mission lines (campaign_draft1.json, M<nn>_*) is played exactly once, in the draft's
order within its mission; every referenced id exists; every chapter kind is one the runner knows. New lines get ids
M<mission>_D<nn> in order of appearance.

    python3 tools/campaign/build.py            # writes the JSON, prints the counts
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import act1, act2, act3  # noqa: E402

## owner lines deliberately not played: Vyrak's, outside Missions 09–10 (cut whole) — owner, Nov 23: he is a hidden
## unique encounter only and never comes up in the main story
CUT = {"M25_004"}

KINDS = {"reach", "kills", "survive", "trace", "hack", "core", "talk", "choice", "boss", "race", "drive", "cutscene"}


def main():
    draft = json.load(open(os.path.join(ROOT, "data", "dialogue", "campaign_draft1.json")))
    owner = {l["id"]: l for l in draft["lines"]}
    by_mission = {}
    for l in draft["lines"]:
        if l["mission"]:
            by_mission.setdefault(l["mission"], []).append(l["id"])
    missions = act1.MISSIONS + act2.MISSIONS + act3.MISSIONS
    out = {"version": 1,
           "source": "The owner's campaign dialogue draft (campaign_draft1.json), every mission line verbatim and in order, with the lead session's "
                     "draft lines (ids M<mission>_D<nn>) around them turning each beat into playable chapters. Mission 01 is its own scene "
                     "(scripts/mission/mission_01.gd).",
           "missions": []}
    new_lines = []
    used = {}
    for m in missions:
        counter = [0]

        def lines(seq, m=m, counter=counter):
            res = []
            for item in seq:
                if isinstance(item, str):
                    assert item in owner, "unknown owner line " + item
                    assert item not in used, "owner line used twice: " + item
                    used[item] = m["id"]
                    res.append(item)
                else:
                    counter[0] += 1
                    lid = "M%s_D%02d" % (m["id"], counter[0])
                    new_lines.append({"id": lid, "mission": m["id"], "speaker": item["speaker"], "text": item["text"]})
                    res.append(lid)
            return res

        mo = {k: v for k, v in m.items() if k != "chapters"}
        mo["chapters"] = []
        for c in m["chapters"]:
            assert c["kind"] in KINDS, c["kind"]
            co = {k: v for k, v in c.items() if k not in ("open", "mid", "close", "by_choice")}
            co["open"] = lines(c.get("open", []))
            if "mid" in c:
                co["mid"] = lines(c["mid"])
            if "by_choice" in c:
                co["by_choice"] = {k: lines(v) for k, v in c["by_choice"].items()}
            co["close"] = lines(c.get("close", []))
            mo["chapters"].append(co)
        out["missions"].append(mo)
        # the owner's lines of this mission, all of them, in order
        seq = [i for c in mo["chapters"] for part in ("open", "mid") for i in c.get(part, []) if i in owner] + \
              [i for c in mo["chapters"] for i in c["close"] if i in owner]
        # order check is per chapter stream (open → mid → by_choice → close); the draft's order is the id order
        played = [i for c in mo["chapters"] for part in ("open", "mid", "close") for i in c.get(part, []) if i in owner]
        mains = [i for i in by_mission.get(m["id"], []) if "_" in i and i.split("_")[1].isdigit() and i not in CUT]
        missing = [i for i in mains if i not in played]
        assert not missing, "mission %s misses owner lines %s" % (m["id"], missing)
        assert played == [i for i in played if True] and [i for i in played if i in mains] == mains, "mission %s plays the draft out of order" % m["id"]
        branches = [i for i in by_mission.get(m["id"], []) if i not in mains and i not in CUT]
        got = [i for c in mo["chapters"] for v in c.get("by_choice", {}).values() for i in v]
        assert sorted(got) == sorted(branches), "mission %s branch lines %s vs %s" % (m["id"], got, branches)
    out["lines"] = new_lines
    path = os.path.join(ROOT, "data", "dialogue", "campaign_full.json")
    json.dump(out, open(path, "w"), indent=1, ensure_ascii=False)
    chapters = sum(len(m["chapters"]) for m in out["missions"])
    print("missions %d, chapters %d, owner lines played %d of %d, new lines %d" % (
        len(out["missions"]), chapters, len(used), sum(len(v) for k, v in by_mission.items() if k != "01"), len(new_lines)))


if __name__ == "__main__":
    main()
