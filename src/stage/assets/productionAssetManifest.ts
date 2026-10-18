// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
/**
 * Asset contract for production replacements. Keep paths in one place so art drops
 * do not require editing scene logic. These files are expected to be supplied by
 * the project's approved art pipeline; no third-party assets are bundled here.
 */
export type ProductionAsset = {
  id: string;
  path: string;
  category: 'architecture' | 'vehicle' | 'prop' | 'character' | 'environment';
  fallback: 'blockout' | 'hide';
  target: 'hero' | 'high' | 'medium' | 'background';
  notes: string;
};

export const NEON_CITY_ASSETS: Record<string, ProductionAsset> = {
  aegisSpire: {
    id: 'neon.aegis-spire', path: '/assets/world-fracture/neon-city/aegis-spire.glb',
    category: 'architecture', fallback: 'blockout', target: 'hero',
    notes: 'Hero skyline silhouette; modular floors, PBR glass/metal, emissive signage separated by material.',
  },
  gridWalkway: {
    id: 'neon.grid-walkway', path: '/assets/world-fracture/neon-city/grid-walkway.glb',
    category: 'architecture', fallback: 'blockout', target: 'high',
    notes: 'Modular elevated transit ring with collision proxies kept separate from render meshes.',
  },
  streetKiosk: {
    id: 'neon.street-kiosk', path: '/assets/world-fracture/neon-city/street-kiosk.glb',
    category: 'prop', fallback: 'blockout', target: 'medium',
    notes: 'Reusable street-market prop; texture atlases and material variants preferred.',
  },
  patrolDrone: {
    id: 'neon.patrol-drone', path: '/assets/world-fracture/neon-city/patrol-drone.glb',
    category: 'vehicle', fallback: 'hide', target: 'high',
    notes: 'Rigged rotors/anti-gravity fins, navigation lights, LODs, and a low-cost shadow proxy.',
  },
  operatorHero: {
    id: 'character.operator-approved', path: '/assets/world-fracture/characters/operator-approved.glb',
    category: 'character', fallback: 'hide', target: 'hero',
    notes: 'Use the already-approved World Fracture operator model and rig. Do not substitute a random soldier.',
  },
  novaDrone: {
    id: 'character.nova-drone', path: '/assets/world-fracture/characters/nova-drone.glb',
    category: 'character', fallback: 'hide', target: 'high',
    notes: 'Preserve established NOVA silhouette, emissive language, and attachment point for shoulder-follow scenes.',
  },
};

export const ART_ACCEPTANCE_CHECKLIST = [
  'PBR materials use packed ORM maps or the project-standard equivalent; no accidental pure-white default materials.',
  'Hero assets have authored LODs and sensible draw-call/material budgets.',
  'Textures have named resolutions and mobile fallback variants.',
  'Collision meshes are separate from render meshes where practical.',
  'Scale, forward axis, origin, and skeleton naming match the project export convention.',
  'No copyrighted third-party characters or unlicensed marketplace assets are introduced.',
] as const;
