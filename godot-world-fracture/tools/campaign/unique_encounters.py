#!/usr/bin/env python3
"""The 18 hidden unique encounters (tools/campaign/unique/encounters.py) written to data/dialogue/unique_encounters.json
for scripts/mission/encounters.gd (clues, discovery, the journal) and scripts/mission/unique_encounter.gd (the lead-in
mission and the fight, on the campaign runner). Same mission shape as the side missions; each encounter also carries
its clues, its trigger, its gimmick and its reward. Line ids U<nn>_<nnn>; chapter ids U<nn><letter>.

    python3 tools/campaign/unique_encounters.py
"""
import importlib.util, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "unique")
KINDS = {"reach", "kills", "survive", "trace", "hack", "core", "talk", "choice", "boss", "race", "drive", "cutscene"}
ROUTES = {"site", "story", "npc", "world", "combat"}
GIMMICKS = {"poise", "adaptive", "attune", "closing", "trial"}
STAGE_BY_WORLD = {"solara": "desert_camp", "thalassia": "dome", "frostspire": "snow_camp", "wastelands": "wasteland",
                  "swamps": "camp", "ember": "lava_camp", "veridan": "forest", "neon-city": "neon_street"}
ROOM_SETS = {"zero_point", "choir_hall", "witness_vault", "astryan_hall", "council", "stacks", "pods", "heart", "forge", "cathedral", "underground",
             "station", "observatory", "ice_cave", "throne", "citadel", "dome", "farms", "tubes", "ring", "pool", "garden", "palace", "backroom",
             "vault", "engine", "transport", "tower", "sanctuary", "lodge", "map_room", "murals", "lab", "lab_red", "recording", "chamber",
             "briefing", "subway", "shaft", "archive", "memory", "hq_hall", "balcony"}   # stage.gd ROOMS
# the sets the lairs play on (scripts/mission/stage.gd)
STAGE_BY_CHAPTER = {"U01C": "desert_road", "U01D": "desert_road", "U02B": "lab", "U02C": "lab", "U02D": "plaza",
                    "U03B": "snow_camp", "U03C": "snow_camp", "U04B": "vault", "U04C": "vault_gate", "U04D": "vault_gate", "U04E": "vault",
                    "U05C": "abbey", "U06B": "sea", "U06C": "sea", "U06D": "palace", "U06E": "palace", "U07B": "ridge",
                    "U09B": "ribcage", "U10B": "underground", "U10C": "crater", "U11B": "dig", "U11C": "vault", "U11D": "dig",
                    "U13B": "subway", "U13C": "neon_street", "U14B": "underground", "U14C": "neon_street", "U15B": "abbey", "U15C": "abbey",
                    "U16B": "farms", "U16C": "docks", "U18C": "vault_gate", "U18D": "vault_gate"}


def main():
    spec = importlib.util.spec_from_file_location("encounters", os.path.join(HERE, "encounters.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    maps = {}

    def pois(world):
        if world not in maps:
            maps[world] = {p["id"] for p in json.load(open(os.path.join(ROOT, "generated", "maps", world + ".json"))).get("pois", [])}
        return maps[world]

    out = {"version": 1, "source": "tools/campaign/unique/encounters.py (the 18 hidden unique encounters)",
           "bosses": {}, "encounters": [], "missions": [], "lines": []}
    for e in mod.ENCOUNTERS:
        assert e["gimmick"] in GIMMICKS, e["id"]
        assert e["lair"] in pois(e["world"]), (e["id"], e["lair"])
        out["bosses"][e["id"]] = e["hull"]
        n = [0]

        def ids(seq, e=e, n=n):
            res = []
            for sp, text in seq:
                n[0] += 1
                lid = "%s_%03d" % (e["mission"], n[0])
                line = {"id": lid, "mission": e["mission"], "speaker": sp, "text": text}
                if sp in mod.PERSON:
                    pid, body, age = mod.PERSON[sp]
                    line.update({"person": pid, "body": body, "age": age})
                out["lines"].append(line)
                res.append(lid)
            return res

        clues = []
        for c in e["clues"]:
            assert c["route"] in ROUTES, (e["id"], c)
            cc = dict(c)
            if c["route"] == "site":
                cc["world"], cc["poi"] = e["world"], e["lair"]
            if c["route"] == "world":
                cc.setdefault("world", e["world"])
                assert cc["poi"] in pois(cc["world"]), (e["id"], cc["poi"])
            if c["route"] == "combat":
                cc.setdefault("chance", 1.0)
            clues.append(cc)
        assert len({c["id"] for c in clues}) == len(clues), e["id"]
        meta = {k: v for k, v in e.items() if k not in ("chapters", "clues")}
        meta["clues"] = clues
        meta["drop_name"] = mod.DROP_NAMES[e["drop"]]
        out["encounters"].append(meta)
        mo = {"id": e["mission"], "title": e["name"], "region": e["region"], "world": e["world"], "encounter": e["id"],
              "beat": e["trigger"], "category": "unique", "chapters": []}
        for c in e["chapters"]:
            assert c["kind"] in KINDS, c["kind"]
            if c["kind"] == "boss":
                assert c["boss"] == e["id"], c["id"]
            if c.get("start"):
                assert c["start"] in pois(e["world"]), (c["id"], c["start"])
            co = {k: v for k, v in c.items() if k not in ("open", "close", "by_choice")}
            co["open"] = ids(c["open"])
            co["close"] = ids(c["close"])
            if "by_choice" in c:
                co["by_choice"] = {k: ids(v) for k, v in c["by_choice"].items()}
            if c["kind"] == "boss":
                co["boss_name"] = e["boss_name"]
            co.setdefault("stage", STAGE_BY_CHAPTER.get(c["id"], STAGE_BY_WORLD.get(e["world"], "street")))
            # a fight is fought in the open: a room set's walls would stand between the operator and the boss
            assert c["kind"] != "boss" or co["stage"] not in ROOM_SETS, (c["id"], co["stage"])
            mo["chapters"].append(co)
        assert mo["chapters"][0].get("start"), e["id"] + ": the first chapter needs a start POI"
        out["missions"].append(mo)
    assert len(out["encounters"]) == 18
    ids_ = [c["id"] for m in out["missions"] for c in m["chapters"]]
    assert len(ids_) == len(set(ids_)), "duplicate chapter ids"
    path = os.path.join(ROOT, "data", "dialogue", "unique_encounters.json")
    json.dump(out, open(path, "w"), indent=1, ensure_ascii=False)
    print("unique encounters: %d, %d clues, %d chapters, %d lines" % (len(out["encounters"]), sum(len(e["clues"]) for e in out["encounters"]),
          len(ids_), len(out["lines"])))


if __name__ == "__main__":
    main()
