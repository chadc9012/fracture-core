#!/usr/bin/env python3
"""The side missions: character quests, faction missions and world events (tools/campaign/side/*.py), written to
data/dialogue/side_missions.json for scripts/mission/side_mission.gd (one mission at a time, from the SIDE MISSIONS
board). Same shape as the main story's missions; each also carries its category, giver, `after` (the main mission that
opens it), `until` (the main mission that closes it, if any) and `faction` (Mission 5's choice it is offered to first).
Line ids S<mission>_<nnn>; chapter ids S<chapter>.

    python3 tools/campaign/side_missions.py
"""
import importlib.util, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "side")
KINDS = {"reach", "kills", "survive", "trace", "hack", "core", "talk", "choice", "boss", "race", "drive", "cutscene"}
BOSSES = {"iron-brute": "colossus", "mangrove-stalker": "rift-hound"}
# the set each kind of place plays on (scripts/mission/stage.gd), by the mission's world
STAGE_BY_WORLD = {"nexus": "street", "neon-city": "neon_street", "wastelands": "wasteland", "eldergrove": "forest", "goldenreach": "camp",
                  "solara": "desert_camp", "thalassia": "dome", "veridan": "forest", "swamps": "camp", "crystal-badlands": "reef",
                  "riverdale": "harrow", "azure-isles": "docks", "storm": "reef", "ember": "lava_camp", "frostveil": "snow_camp",
                  "old-harrow": "harrow"}


def main():
    out = {"version": 1, "source": "tools/campaign/side/*.py (character quests, faction missions, world events)",
           "bosses": BOSSES, "missions": [], "lines": []}
    for name in ("characters", "keepers", "factions", "events"):
        spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for m in mod.MISSIONS:
            n = [0]

            def ids(seq, m=m, n=n):
                res = []
                for sp, text in seq:
                    n[0] += 1
                    lid = "S%s_%03d" % (m["id"], n[0])
                    out["lines"].append({"id": lid, "mission": m["id"], "speaker": sp, "text": text})
                    res.append(lid)
                return res

            mo = {k: v for k, v in m.items() if k != "chapters"}
            mo["category"] = m.get("category", mod.CATEGORY)
            mo["chapters"] = []
            for c in m["chapters"]:
                assert c["kind"] in KINDS, c["kind"]
                if c["kind"] == "boss":
                    assert c["boss"] in BOSSES, c["boss"]
                co = {k: v for k, v in c.items() if k not in ("open", "close", "by_choice")}
                co["id"] = "S" + c["id"]
                co["open"] = ids(c["open"])
                co["close"] = ids(c["close"])
                if "by_choice" in c:
                    co["by_choice"] = {k: ids(v) for k, v in c["by_choice"].items()}
                co.setdefault("stage", c.get("stage", STAGE_BY_WORLD.get(m["world"], "street")))
                mo["chapters"].append(co)
            out["missions"].append(mo)
    ids_ = [c["id"] for m in out["missions"] for c in m["chapters"]]
    assert len(ids_) == len(set(ids_)), "duplicate chapter ids"
    path = os.path.join(ROOT, "data", "dialogue", "side_missions.json")
    json.dump(out, open(path, "w"), indent=1, ensure_ascii=False)
    cats = {}
    for m in out["missions"]:
        cats[m["category"]] = cats.get(m["category"], 0) + 1
    print("side missions: %d (%s), %d chapters, %d lines" % (len(out["missions"]), ", ".join("%d %s" % (v, k) for k, v in cats.items()),
          sum(len(m["chapters"]) for m in out["missions"]), len(out["lines"])))


if __name__ == "__main__":
    main()
