/** Original instrumental stations: no licensed songs, external streams or credentials. */
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