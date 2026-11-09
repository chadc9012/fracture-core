# Character turnaround sheets (owner, Nov 8)

The owner's sheets, cleaned before use (owner: "clean up images before adding, some look pixelated"): every figure cut
from its sheet, lifted off the background (transparent), denoised with an edge-keeping filter, resampled to a common
1024 px height and lightly sharpened — `scripts/clean-turnarounds.py`. The small navy-background renders (figures were
~300 × 450 px) are upscaled 2.2×; they come out clean but soft, since no learned super-resolution runs in the build sandbox
— re-render those from the game models at 2× for truly crisp cards. The hi-res concept sheets keep their floor reflection.

`clean/<sheet>[-rN]-<front|side|back>.webp` are the figures, `clean/<sheet>-sheet.webp` the re-laid sheets. Originals of
the two concept sheets stay as `armored-operator-turnaround.png` and `hunter-raider-turnaround.png`.

| Sheet | Rows (top → bottom) | Family guess (matches public/models) |
| --- | --- | --- |
| armored-operator-concept | blue-lit black armour, red accents (concept art) | a new operator armour set — Meshy brief |
| hunter-raider-concept | white-haired hunter in the torn coat; red-haired raider in the layered skirt (concept art) | two new female outfits — Meshy brief |
| operators-dark-concept | vanguard plate; heavy with the orange visor; caped orange-plate; red-scarf woman (hi-res concept) | vanguard / raider heavy / cape / scout |
| operators-dark-model | the same four as game-model renders | vanguard-regular / raider-boss / caped / scout |
| aberration-abyssal | swamp beast; lean purple-eyed stalker; many-armed crawler; small toothed fish | aberration boss / elite / regular; abyssal regular |
| abyssal-guardian | tentacled fish; shark; stone golem; iron golem | abyssal elite / boss; guardian regular / elite |
| guardian-overclocked | sandstone golem; three red-cyan armoured operators | guardian boss; overclocked boss / elite / regular |
| raider-skyborn | three rust-brown raiders; white horned caped knight | raider regular / elite / boss; skyborn boss |
| skyborn-vanguard | white bird-helm; white horned cape; blue heavy; blue armoured | skyborn regular / elite; vanguard elite / boss |
| vanguard-single | one blue-cyan armoured operator | vanguard regular |
| wasteland-civilians | goggles coat; eyepatch long coat; scarf and glasses; dreadlocks and shemagh | NPC merchants / civilians |
| hunter-raider-model | the hunter and the raider as game-model renders | the two female outfits, modelled |
| coats-and-halos | white tech coat; gold-trim coat with halo discs (two takes); white-blue tech coat | cipher / nyx authored variants |
| cloaked-women | purple hooded cloak; red half-cape | nyx-rift / scout |

Family names are a reading of the renders against the model list, not confirmed by the owner; rename rows here when known.
