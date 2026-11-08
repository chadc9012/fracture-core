# Nexus City street set (from the owner's night-street target renders, Nov 8)

Target: wet neon night street, reflective asphalt, glowing bollards, banners, holo billboards, monorail viaduct, palms and
cherry blossoms, parked supercars, plaza arch gateway. Budget per prop: <=6k tris (hero cars <=12k), 1K textures (2K hero), Y-up,
origin at base, 1 unit = 1 m. Generate with Meshy image-to-3D or text-to-3D "game-ready, PBR, clean topology", then fit with the same
Blender fit scripts used for weapons (scripts/fit-weapon-meshy.py pattern). Save to public/models/city/street/<id>.glb.

| id | what | notes |
|---|---|---|
| bollard-glow | black steel bollard, glowing cyan cap ring | instanced hundreds; 600 tris |
| street-lamp-banner | tall black lamp, warm head, hanging purple World Fracture banner | banner as separate material |
| holo-billboard | curved screen on building face, frame + emissive panel | content texture swapped in code |
| direction-sign | glowing cyan directory board (District, Trading Hub, Arena, Apartments) | text via texture |
| monorail-train | 3-car white/blue-trim train | rides the viaduct spline |
| monorail-pillar | curved concrete pillar with cyan strip | repeat along the rail |
| palm-lit | palm wrapped in warm uplights | variant of existing palms |
| cherry-tree | pink blossom tree | 2 variants |
| planter-large | stone planter with tropical plants | |
| bench-street | black bench with cyan edge strip | |
| bus-shelter-neon | canopy with magenta underlight | |
| info-kiosk | blue holographic kiosk pillar | |
| cafe-umbrella-set | warm-lit umbrella, table, chairs | |
| car-hyper | chrome hypercar with cyan and magenta underglow, rear wing | hero, 2 colourways |
| car-sedan-night | sedan with red tail lights | 3 colourways |
| hover-car | small flying car with thrusters | sky traffic |
| motorbike | sleek bike with rider optional | |
| plaza-arch | glowing arch gateway over the street ("Nexus City, Central District") | landmark |
| storefront-glass | lit glass shopfront modules (mall, Nova Tech clinic, lounge/casino) | modular 4 m bays |

Priority order: bollard-glow, street-lamp-banner, car-hyper, car-sedan-night, holo-billboard, direction-sign, planter-large,
bench-street, bus-shelter-neon, palm-lit, cherry-tree, monorail-train, plaza-arch, then the rest. Roughly 20 Meshy generations.
Placement lives in city-streets.ts / CityStreets.tsx (existing street furniture and WetReflections.tsx keep working with the new GLBs).
