# Armour references (owner, Nov 15)

- `armored-soldier-turnaround.png`: the source of the **Neon Sentinel** suit. Its front/side/back cuts (`soldier_*.jpg`) went to Meshy multi-view (Meshy 7.1 flagship, Ultra 2K mesh, 4K PBR textures, A-pose, private license). The output is `Meshy_AI_Neon_Sentinel_1115133915_texture.glb` (62 MB, about 600k vertices). It is kept on the owner's Mac in the `fracture-core` folder and isn't committed because of its size.
- `tactical-character-turnaround.png`, `tactical-character-breakdown.png`: the lighter tactical look (bracers, knee armour, belt and pouches, boots). This is the next suit.

Pipeline: `blender -b -P scripts/build-armor-suit.py -- SUIT.glb models/operators/bodies/<frame>-<body>.glb models/operators/armor/<suit>/<frame>-<body>.glb`. The script runs once per body and exports geometry only. Then extract the suit's textures once into `models/operators/armor/<suit>/` as `albedo.jpg`, `normal.jpg`, `metal_rough.jpg` and `emission.jpg`.

Quality bar (owner): check every generated model up close before it's used, and reject anything with pixelated or blurry textures.
