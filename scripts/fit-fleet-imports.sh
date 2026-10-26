#!/usr/bin/env bash
# Rebuilds the imported fleet bodies (scripts/fit-fleet-model.py) from the owner's downloaded models. The sources are not in the
# repo (Sketchfab downloads, CC BY 4.0; credits in src/components/game/CreditsPanel.tsx): pass the folder holding them.
#   bash scripts/fit-fleet-imports.sh /path/to/downloads
set -euo pipefail
SRC=${1:?folder with the downloaded .glb files}
OUT=$(dirname "$0")/../public/models/fleet
MC="$SRC/2015_mc_laren_650s_gt3.glb --length=4.55 --nose=-y --paint=PAINT --glass=GLASS --wheel=WHEEL,TYRE --drop=phong5 --flatpaint=#2a0a6e --tailobj=Object_60,Object_63,Object_194,Object_197"
CV="$SRC/2010_chevrolet_corvette_grand_sport.glb --length=4.45 --nose=-y --paint=CarPaint --glass=Glass --wheel=material,CChevrolet_CorvetteGrandSport_2017_Wheel1A_3D_3DWheel1A_Material1 --drop=EXT_Trans --dropobj=Object_395,Object_401,Object_362,Object_371 --flatpaint=#9aa3ad --tailobj=Object_248,Object_260,Object_245,Object_257 --headobj=Object_269,Object_290"
fit() { local name=$1 spec=$2; shift 2; blender -b -P "$(dirname "$0")/fit-fleet-model.py" -- ${spec%% *} "$OUT/$name.glb" ${spec#* } "$@"; }
fit street-racer "$MC" --tris=60000 --tex=1024
fit street-racer-lod "$MC" --tris=6000 --wheeltris=400 --tex=512
fit muscle-car "$CV" --tris=50000 --tex=1024
fit muscle-car-lod "$CV" --tris=6000 --wheeltris=400 --tex=512
