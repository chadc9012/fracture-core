/** Bundled authored audio (user-supplied WAVs, mono 24 kHz) served from the asset CDN. audio.ts falls back to procedural sound while a file loads or if it fails. */
import a_ember_peaks from "@/assets/audio/ember-peaks.wav.asset.json";
import a_forest_wilds from "@/assets/audio/forest-wilds.wav.asset.json";
import a_frost_spire from "@/assets/audio/frost-spire.wav.asset.json";
import a_loot_pickup from "@/assets/audio/loot-pickup.wav.asset.json";
import a_melee_impact from "@/assets/audio/melee-impact.wav.asset.json";
import a_nexus_hum from "@/assets/audio/nexus-hum.wav.asset.json";
import a_precision_rifle from "@/assets/audio/precision-rifle.wav.asset.json";
import a_reality_fracture_impact from "@/assets/audio/reality-fracture-impact.wav.asset.json";
import a_reality_rift_portal from "@/assets/audio/reality-rift-portal.wav.asset.json";
import a_shotgun_blast from "@/assets/audio/shotgun-blast.wav.asset.json";
import a_solara_dunes from "@/assets/audio/solara-dunes.wav.asset.json";
import a_swamp_marsh from "@/assets/audio/swamp-marsh.wav.asset.json";
import a_tank_cannon from "@/assets/audio/tank-cannon.wav.asset.json";
import a_underwater_city from "@/assets/audio/underwater-city.wav.asset.json";
import a_vehicle_engine_start from "@/assets/audio/vehicle-engine-start.wav.asset.json";
import a_wasteland_wind from "@/assets/audio/wasteland-wind.wav.asset.json";
import a_waterfall_river from "@/assets/audio/waterfall-river.wav.asset.json";

export const AUDIO_FILES: Record<string, string> = {
  "ember-peaks": a_ember_peaks.url,
  "forest-wilds": a_forest_wilds.url,
  "frost-spire": a_frost_spire.url,
  "loot-pickup": a_loot_pickup.url,
  "melee-impact": a_melee_impact.url,
  "nexus-hum": a_nexus_hum.url,
  "precision-rifle": a_precision_rifle.url,
  "reality-fracture-impact": a_reality_fracture_impact.url,
  "reality-rift-portal": a_reality_rift_portal.url,
  "shotgun-blast": a_shotgun_blast.url,
  "solara-dunes": a_solara_dunes.url,
  "swamp-marsh": a_swamp_marsh.url,
  "tank-cannon": a_tank_cannon.url,
  "underwater-city": a_underwater_city.url,
  "vehicle-engine-start": a_vehicle_engine_start.url,
  "wasteland-wind": a_wasteland_wind.url,
  "waterfall-river": a_waterfall_river.url,
};
