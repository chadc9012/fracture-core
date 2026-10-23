/** Original stations: the owner's own recordings play first (public/audio/radio, see docs/radio), and the procedural
 * instrumental in audio.ts is the fallback when a recording cannot load. No licensed songs, external streams or credentials. */
export const RADIO_STATIONS = {
  hiphop: { name: "Block Signal", genre: "Hip-hop", bpm: 92, bass: [55, 55, 65.4, 49], notes: [220, 261.6, 293.7, 196], wave: "triangle" as OscillatorType },
  rock: { name: "Rust Riot", genre: "Rock", bpm: 132, bass: [82.4, 82.4, 98, 73.4], notes: [164.8, 196, 220, 146.8], wave: "sawtooth" as OscillatorType },
  house: { name: "Neon Frequency", genre: "EDM / House", bpm: 126, bass: [65.4, 65.4, 77.8, 58.3], notes: [261.6, 311.1, 392, 233.1], wave: "square" as OscillatorType },
  reggae: { name: "Island Relay", genre: "Dancehall / Reggae", bpm: 100, bass: [49, 65.4, 58.3, 43.7], notes: [196, 261.6, 233.1, 174.6], wave: "triangle" as OscillatorType },
  oldschool: { name: "Golden Era 94", genre: "Old-school hip-hop", bpm: 94, bass: [55, 49, 65.4, 55], notes: [220, 196, 261.6, 220], wave: "triangle" as OscillatorType },
  instrumental: { name: "Instrumental Dimensions", genre: "Instrumental beats", bpm: 88, bass: [65.4, 58.3, 49, 55], notes: [261.6, 233.1, 196, 220], wave: "sine" as OscillatorType },
  comedy: { name: "Fracture FM: Off the Rails", genre: "Comedy talk radio", bpm: 96, bass: [55, 55, 55, 55], notes: [220, 220, 220, 220], wave: "triangle" as OscillatorType },
};
export type StationId = keyof typeof RADIO_STATIONS;
export type MusicSource = "playlist" | StationId;
export const RADIO_KEY = "world-fracture-radio-source";
export function isStation(id: string): id is StationId { return Object.hasOwn(RADIO_STATIONS, id); }
export function getMusicSource(): MusicSource { try { const id = localStorage.getItem(RADIO_KEY) ?? "playlist"; return isStation(id) ? id : "playlist"; } catch { return "playlist"; } }
export function setMusicSource(source: MusicSource) { try { localStorage.setItem(RADIO_KEY, source); } catch { /* device storage unavailable */ } window.dispatchEvent(new Event("wf-playlist-changed")); }
/** Recorded rotation per station (stages 42-46 from the owner): Block Signal rotates four Kinggg Dream songs, Keep Moving opens Neon
 * Frequency, and three more stations play their demo recordings. Broadcasts are linear: every program plays through, no skip or
 * shuffle. After every AD_EVERY programs one original fictional commercial airs (rotating through RADIO_ADS), never mid-song. */
export type StationTrack = { title: string; artist: string; path: string };
const KD = "Kinggg Dream";
export const STATION_TRACKS: Record<StationId, StationTrack[]> = {
  hiphop: [
    { title: "Brooklyn, Stand Tall", artist: KD, path: "/audio/radio/kinggg-dream-brooklyn-stand-tall.mp3" },
    { title: "Bodega Gate", artist: KD, path: "/audio/radio/kinggg-dream-bodega-gate.mp3" },
    { title: "Write Your Own Name", artist: KD, path: "/audio/radio/kinggg-dream-write-your-own-name.mp3" },
    { title: "We Keep Rolling", artist: KD, path: "/audio/radio/kinggg-dream-we-keep-rolling.mp3" },
  ],
  rock: [{ title: "Burn the Horizon", artist: "Rust Riot", path: "/audio/radio/rust-riot-vocal-mix.ogg" }],
  house: [
    { title: "Keep Moving", artist: KD, path: "/audio/radio/kinggg-dream-keep-moving.mp3" },
    { title: "Electric Tomorrow", artist: "Neon Frequency", path: "/audio/radio/neon-frequency-vocal-mix.ogg" },
  ],
  reggae: [{ title: "Island Signal", artist: "Island Relay", path: "/audio/radio/island-relay-vocal-mix.ogg" }],
  oldschool: [{ title: "Instrumental", artist: "Golden Era 94", path: "/audio/radio/golden-era-94-instrumental.ogg" }],
  instrumental: [{ title: "Instrumental", artist: "Instrumental Dimensions", path: "/audio/radio/instrumental-dimensions.ogg" }],
  comedy: [{ title: "Off the Rails · Episode 1", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-01.ogg" }],
};
export const RADIO_ADS: StationTrack[] = [
  { title: "Nexus Noodle Express", artist: "Commercial", path: "/audio/radio/ads/nexus-noodle.ogg" },
  { title: "WyrmShield Insurance", artist: "Commercial", path: "/audio/radio/ads/vyrak-insurance.ogg" },
  { title: "Portal Mart", artist: "Commercial", path: "/audio/radio/ads/portal-mart.ogg" },
  { title: "Nexus Transit Authority", artist: "Commercial", path: "/audio/radio/ads/nexus-transit.ogg" },
  { title: "Rusty Ride Motors", artist: "Commercial", path: "/audio/radio/ads/rusty-ride.ogg" },
];
export const AD_EVERY = 2;
/** the broadcast position: which program is next, how many programs have played since the last ad, which ad is next */
export type Broadcast = { program: number; sinceAd: number; ad: number };
export const BROADCAST_START: Broadcast = { program: 0, sinceAd: 0, ad: 0 };
/** what plays now at this position */
export function onAir(id: StationId, b: Broadcast, adBreak: boolean): StationTrack & { advertisement: boolean } {
  return adBreak ? { ...RADIO_ADS[b.ad % RADIO_ADS.length]!, advertisement: true } : { ...stationTrack(id, b.program), advertisement: false };
}
/** after the current item ends: a finished program counts toward the next ad break; a finished ad returns to the music */
export function nextOnAir(b: Broadcast, wasAd: boolean): { broadcast: Broadcast; adBreak: boolean } {
  if (wasAd) return { broadcast: { ...b, ad: b.ad + 1, sinceAd: 0 }, adBreak: false };
  const played = { ...b, program: b.program + 1, sinceAd: b.sinceAd + 1 };
  return played.sinceAd >= AD_EVERY ? { broadcast: played, adBreak: true } : { broadcast: played, adBreak: false };
}
/** the track at a rotation step (wraps; negative steps are treated as 0) */
export function stationTrack(id: StationId, step: number): StationTrack {
  const list = STATION_TRACKS[id];
  return list[Math.max(0, Math.floor(step)) % list.length]!;
}
