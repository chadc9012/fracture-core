"""The owner's vehicle boards (Nov 15: the approved 21, the 61-vehicle roster, the airport fleet) as game files.

Each row: roster id -> (real length in metres, triangle budget, output file under models/fleet/). Rows whose output is
an existing fleet file replace that model in place, so every street, garage, Skyways and district call keeps working;
the rest are new files (showroom/, craft/, airliners/). The Meshy downloads are matched to ids in RAW (probe renders).

    python3 tools/vehicle_set.py RAW_DIR      # fits every RAW entry with tools/fit_meshy_vehicle.py
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FLEET = os.path.join(HERE, "..", "models", "fleet")

CAR, BIG, AIR, LINER = 60000, 70000, 70000, 80000
SET = {
    # ---- in place: the starters, traffic, parked and district vehicles take the boards' models
    "neon-drift": (4.6, CAR, "street-racer-lod.glb"),
    "rift-runner": (4.8, CAR, "muscle-car-lod.glb"),
    "blue-underglow": (4.6, CAR, "tuner.glb"),
    "goliath-4x4": (5.3, CAR, "offroad-truck.glb"),
    "ironclad-scout": (5.2, CAR, "security-suv.glb"),
    "ghost-ray-hoverbike": (2.7, CAR, "aether-hoverbike.glb"),
    "civic-rover": (4.7, CAR, "luxury-sedan.glb"),
    "crimson-z": (4.7, CAR, "armored-muscle.glb"),
    "aegis-siege-breaker": (8.6, BIG, "goliath-tank.glb"),
    "revenant-tank": (9.5, BIG, "fracture-behemoth.glb"),
    "war-rig": (11.7, BIG, "war-rig.glb"),
    "trailblazer-6x6": (6.4, CAR, "tech-transport.glb"),
    "f39-jupiter": (17.0, AIR, "vanguard-jet.glb"),
    "solara-falcon": (15.0, AIR, "craft/solara-falcon.glb"),
    "void-skimmer": (14.0, AIR, "void-skimmer.glb"),
    "orbis-gunship": (14.0, AIR, "rift-helicopter.glb"),
    "triton-hydrospear": (11.0, CAR, "scrap-patrol-boat.glb"),
    "nautilus-abyss": (9.0, CAR, "hydro-sub-skiff.glb"),
    # ---- the showroom (catalog.gd SHOWROOM)
    "void-chaser": (4.7, CAR, "showroom/void-chaser.glb"),
    "zenith-v12": (4.7, CAR, "showroom/zenith-v12.glb"),
    "eclipse-gtr": (4.6, CAR, "showroom/eclipse-gtr.glb"),
    "venom-rs": (4.6, CAR, "showroom/venom-rs.glb"),
    "hyperion-x": (4.6, CAR, "showroom/hyperion-x.glb"),
    "arcadia-sv": (4.6, CAR, "showroom/arcadia-sv.glb"),
    "street-phantom": (4.8, CAR, "showroom/street-phantom.glb"),
    "reactor-s": (4.7, CAR, "showroom/reactor-s.glb"),
    "nightshade": (5.3, CAR, "showroom/nightshade.glb"),
    "atlas-overland": (5.0, CAR, "showroom/atlas-overland.glb"),
    "wasteland-raider": (5.6, CAR, "showroom/wasteland-raider.glb"),
    "summit-crawler": (5.2, CAR, "showroom/summit-crawler.glb"),
    "mirage-buggy": (4.0, CAR, "showroom/mirage-buggy.glb"),
    "sandstalker-atv": (2.3, CAR, "showroom/sandstalker-atv.glb"),
    "dune-stalker-trike": (2.8, CAR, "showroom/dune-stalker-trike.glb"),
    "behemoth-crusher": (5.6, CAR, "showroom/behemoth-crusher.glb"),
    "nomad-bike": (2.1, CAR, "showroom/nomad-bike.glb"),
    "shadow-r1": (2.1, CAR, "showroom/shadow-r1.glb"),
    "tempest-900": (2.1, CAR, "showroom/tempest-900.glb"),
    "voltstrike": (2.1, CAR, "showroom/voltstrike.glb"),
    "ravager-chopper": (2.5, CAR, "showroom/ravager-chopper.glb"),
    "aether-bike": (2.2, CAR, "showroom/aether-bike.glb"),
    "apex-hauler": (16.0, BIG, "showroom/apex-hauler.glb"),
    "cargo-hauler": (7.5, CAR, "showroom/cargo-hauler.glb"),
    "metro-bus": (12.0, CAR, "showroom/metro-bus.glb"),
    "service-van": (5.4, CAR, "showroom/service-van.glb"),
    "medical-response": (6.2, CAR, "showroom/medical-response.glb"),
    "fire-rescue": (10.0, BIG, "showroom/fire-rescue.glb"),
    "bastion-apc": (7.5, BIG, "showroom/bastion-apc.glb"),
    "havoc-ifv": (6.8, BIG, "showroom/havoc-ifv.glb"),
    "warden-mech": (5.0, BIG, "showroom/warden-mech.glb"),
    # ---- aircraft and boats (Skyways CRAFT, airport hangars)
    "skyhawk": (8.3, AIR, "craft/skyhawk.glb"),
    "riftwing": (14.0, AIR, "craft/riftwing.glb"),
    "valkyrie-vtol": (17.5, AIR, "craft/valkyrie-vtol.glb"),
    "thunderbolt-a7": (16.0, AIR, "craft/thunderbolt-a7.glb"),
    "nimbus-cargo": (30.0, AIR, "craft/nimbus-cargo.glb"),
    "horizon-dropship": (20.0, AIR, "craft/horizon-dropship.glb"),
    "starliner-shuttle": (37.0, AIR, "craft/starliner-shuttle.glb"),
    "corsair-speedboat": (12.0, CAR, "craft/corsair-speedboat.glb"),
    "leviathan-yacht": (45.0, BIG, "craft/leviathan-yacht.glb"),
    "deepfin-explorer": (10.0, CAR, "craft/deepfin-explorer.glb"),
    "tidehunter-sub": (24.0, CAR, "craft/tidehunter-sub.glb"),
    "abyssal-carrier": (60.0, BIG, "craft/abyssal-carrier.glb"),
    # ---- the airport fleet's passenger airliners (airport_view.gd picks one per airline)
    "a320n-aerolink": (37.6, LINER, "airliners/a320n-aerolink.glb"),
    "b737-atlas": (39.5, LINER, "airliners/b737-atlas.glb"),
    "a330-solmara-air": (63.7, LINER, "airliners/a330-solmara-air.glb"),
    "b787-dreamliner": (57.0, LINER, "airliners/b787-dreamliner.glb"),
    "a350-horizon": (66.8, LINER, "airliners/a350-horizon.glb"),
    "b777-veyron": (73.9, LINER, "airliners/b777-veyron.glb"),
    "a380-world-fracture": (72.7, LINER, "airliners/a380-world-fracture.glb"),
    "l1011-tristar": (54.2, LINER, "airliners/l1011-tristar.glb"),
}

# Meshy download -> [roster id, nose] (nose: which glTF axis end is the front, from the probe renders)
RAW = {}

if __name__ == "__main__":
    raw_dir = sys.argv[1]
    raw = json.load(open(os.path.join(raw_dir, "raw.json"))) if os.path.exists(os.path.join(raw_dir, "raw.json")) else RAW
    only = set(sys.argv[2:])
    for f, (vid, nose) in raw.items():
        if only and vid not in only:
            continue
        length, tris, out = SET[vid]
        dst = os.path.join(FLEET, out)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        cmd = ["blender", "-b", "-P", os.path.join(HERE, "fit_meshy_vehicle.py"), "--", os.path.join(raw_dir, f), dst,
               str(length), str(tris), "4096", "--nose", nose]
        r = subprocess.run(cmd, capture_output=True, text=True)
        print([l for l in r.stdout.splitlines() if l.startswith("FIT")] or r.stderr[-400:])
