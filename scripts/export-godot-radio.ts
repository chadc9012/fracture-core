/**
 * Exports the radio for the Godot project (godot-world-fracture/scripts/audio/radio.gd): the stations that have recordings,
 * their rotation, station IDs and the commercials (src/game/radio-stations.ts). The archived episodes and ads (spoilers,
 * docs/radio/SPOILER_REVIEW.md) are not exported, so the Godot build never ships them. The web game stays the source of
 * truth; the JSON is committed (godot-world-fracture/data/radio.json) and re-run whenever a station changes.
 *
 *   bun scripts/export-godot-radio.ts
 */
import { writeFileSync } from "node:fs";
import { AD_EVERY, RADIO_ADS, RADIO_STATIONS, STATION_IDS, STATION_TRACKS, hasRecordings, type StationId } from "../src/game/radio-stations";

const godot = (p: string) => "res://audio" + p.replace(/^\/audio/, "");
const stations = (Object.keys(RADIO_STATIONS) as StationId[]).filter(hasRecordings).map((id) => ({
  id, name: RADIO_STATIONS[id].name, genre: RADIO_STATIONS[id].genre,
  ident: STATION_IDS[id] ? { ...STATION_IDS[id]!, path: godot(STATION_IDS[id]!.path) } : null,
  tracks: STATION_TRACKS[id].map((t) => ({ ...t, path: godot(t.path) })),
}));
const out = { stations, ads: RADIO_ADS.map((a) => ({ ...a, path: godot(a.path) })), adEvery: AD_EVERY };
writeFileSync("godot-world-fracture/data/radio.json", JSON.stringify(out));
console.log(`radio.json: ${stations.length} stations, ${stations.reduce((n, s) => n + s.tracks.length, 0)} tracks, ${out.ads.length} ads`);
