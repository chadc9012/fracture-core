/** Original stations: the owner's own recordings play first (public/audio/radio, see docs/radio), and the procedural
 * instrumental in audio.ts is the fallback when a recording cannot load. No licensed songs, external streams or credentials. */
export const RADIO_STATIONS = {
  hiphop: { name: "Block Signal", genre: "Hip-hop", bpm: 92, bass: [55, 55, 65.4, 49], notes: [220, 261.6, 293.7, 196], wave: "triangle" as OscillatorType },
  rock: { name: "Rust Riot", genre: "Rock", bpm: 132, bass: [82.4, 82.4, 98, 73.4], notes: [164.8, 196, 220, 146.8], wave: "sawtooth" as OscillatorType },
  house: { name: "Neon Frequency", genre: "EDM / House", bpm: 126, bass: [65.4, 65.4, 77.8, 58.3], notes: [261.6, 311.1, 392, 233.1], wave: "square" as OscillatorType },
  reggae: { name: "Island Relay", genre: "Dancehall / Reggae", bpm: 100, bass: [49, 65.4, 58.3, 43.7], notes: [196, 261.6, 233.1, 174.6], wave: "triangle" as OscillatorType },
};
export type StationId = keyof typeof RADIO_STATIONS;
export type MusicSource = "playlist" | StationId;
export const RADIO_KEY = "world-fracture-radio-source";
export function isStation(id: string): id is StationId { return Object.hasOwn(RADIO_STATIONS, id); }
export function getMusicSource(): MusicSource { try { const id = localStorage.getItem(RADIO_KEY) ?? "playlist"; return isStation(id) ? id : "playlist"; } catch { return "playlist"; } }
export function setMusicSource(source: MusicSource) { try { localStorage.setItem(RADIO_KEY, source); } catch { /* device storage unavailable */ } window.dispatchEvent(new Event("wf-playlist-changed")); }
/** Recorded rotation per station (the owner's tracks; Kinggg Dream leads Block Signal). Loops through in order. */
export type StationTrack = { title: string; artist: string; path: string };
export const STATION_TRACKS: Record<StationId, StationTrack[]> = {
  hiphop: [
    { title: "Brooklyn, Stand Tall", artist: "Kinggg Dream", path: "/audio/radio/kinggg-dream-brooklyn-stand-tall.mp3" },
    { title: "Bodega Gate", artist: "Kinggg Dream", path: "/audio/radio/kinggg-dream-bodega-gate.mp3" },
    { title: "After the Fracture", artist: "Block Signal", path: "/audio/radio/block-signal-vocal-mix.ogg" },
  ],
  rock: [{ title: "Burn the Horizon", artist: "Rust Riot", path: "/audio/radio/rust-riot-vocal-mix.ogg" }],
  house: [{ title: "Electric Tomorrow", artist: "Neon Frequency", path: "/audio/radio/neon-frequency-vocal-mix.ogg" }],
  reggae: [{ title: "Island Signal", artist: "Island Relay", path: "/audio/radio/island-relay-vocal-mix.ogg" }],
};
/** the track at a rotation step (wraps; negative steps are treated as 0) */
export function stationTrack(id: StationId, step: number): StationTrack {
  const list = STATION_TRACKS[id];
  return list[Math.max(0, Math.floor(step)) % list.length]!;
}
