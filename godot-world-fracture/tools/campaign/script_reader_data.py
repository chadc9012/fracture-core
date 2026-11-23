#!/usr/bin/env python3
"""The main story and side missions as one compact JSON for the script reader page (one record per mission):
python3 tools/campaign/script_reader_data.py <out.json>"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def pack(path, line_key="lines"):
    d = json.load(open(os.path.join(ROOT, "data", "dialogue", path)))
    lines = {l["id"]: [l["speaker"], l["text"]] for l in d[line_key]}
    out = []
    for m in d["missions"]:
        rec = {k: m.get(k) for k in ("id", "title", "region", "beat", "chapter", "category", "giver", "after", "until", "faction") if m.get(k) is not None}
        rec["scenes"] = []
        for c in m["chapters"]:
            sc = {"id": c["id"], "title": c["title"], "loc": c.get("location", ""), "kind": c["kind"], "label": c.get("label", ""),
                  "set": c.get("stage", ""), "boss": c.get("boss_name", ""),
                  "open": [lines[i] for i in c.get("open", [])], "close": [lines[i] for i in c.get("close", [])]}
            if c.get("options"):
                sc["options"] = [[o[1], o[2]] for o in c["options"]]
            if c.get("by_choice"):
                sc["by_choice"] = {k: [lines[i] for i in v] for k, v in c["by_choice"].items()}
                sc["choice_names"] = {o[0]: o[1] for o in c.get("options", [])}
            if c.get("prompt"):
                sc["prompt"] = c["prompt"]
            rec["scenes"].append(sc)
        out.append(rec)
    return out


data = {"main": pack("aftershock.json"), "side": pack("side_missions.json"), "unique": pack("unique_encounters.json")}
# the hidden encounters: how each is found and what it takes (tools/campaign/unique/encounters.py)
uq = json.load(open(os.path.join(ROOT, "data", "dialogue", "unique_encounters.json")))
by_mission = {e["mission"]: e for e in uq["encounters"]}
_names = {}


def place(world, poi):
    if world not in _names:
        m = json.load(open(os.path.join(ROOT, "generated", "maps", world + ".json")))
        _names[world] = {q["id"]: q.get("name", q["id"]) for q in m.get("pois", [])}
    return _names[world].get(poi, poi)


def how(e, c):
    if c["route"] in ("site", "world"):
        return place(c.get("world", e["world"]), c["poi"])
    return c.get("npc", c.get("after", c.get("element", "")))
for rec in data["unique"]:
    e = by_mission[rec["id"]]
    rec["enc"] = {"name": e["name"], "gimmick": e["gimmick"], "trigger": e["trigger"], "after": e["after"], "lair": e["lair"],
                  "reward": [e["nex"], e["xp"], e["drop_name"]], "briefing": e["briefing"], "tell": e["tell"],
                  "clues": [[c["route"], c["text"], how(e, c)] for c in e["clues"]]}
json.dump(data, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(data["main"]), "main,", len(data["side"]), "side,", len(data["unique"]), "unique,", os.path.getsize(sys.argv[1]) // 1024, "KB")
