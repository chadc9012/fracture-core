/** Original stations: the owner's own recordings play first (public/audio/radio, see docs/radio), and the procedural
 * instrumental in audio.ts is the fallback when a recording cannot load. No licensed songs, external streams or credentials. */
export const RADIO_STATIONS = {
  hiphop: { name: "Block Signal", genre: "Hip-hop", bpm: 92, bass: [55, 55, 65.4, 49], notes: [220, 261.6, 293.7, 196], wave: "triangle" as OscillatorType },
  rock: { name: "Rust Riot", genre: "Rock", bpm: 132, bass: [82.4, 82.4, 98, 73.4], notes: [164.8, 196, 220, 146.8], wave: "sawtooth" as OscillatorType },
  house: { name: "Neon Frequency", genre: "EDM / House", bpm: 126, bass: [65.4, 65.4, 77.8, 58.3], notes: [261.6, 311.1, 392, 233.1], wave: "square" as OscillatorType },
  reggae: { name: "Island Relay", genre: "Dancehall / Reggae", bpm: 100, bass: [49, 65.4, 58.3, 43.7], notes: [196, 261.6, 233.1, 174.6], wave: "triangle" as OscillatorType },
  oldschool: { name: "Golden Era 94", genre: "Old-school hip-hop", bpm: 94, bass: [55, 49, 65.4, 55], notes: [220, 196, 261.6, 220], wave: "triangle" as OscillatorType },
  instrumental: { name: "Parallel 88", genre: "Instrumental beats", bpm: 88, bass: [65.4, 58.3, 49, 55], notes: [261.6, 233.1, 196, 220], wave: "sine" as OscillatorType },
  rnb: { name: "Velvet Static", genre: "Hip-hop & R&B", bpm: 84, bass: [55, 61.7, 49, 55], notes: [220, 246.9, 196, 220], wave: "sine" as OscillatorType },
  latin: { name: "Calor 97", genre: "Latin: old-school classics, reggaeton, dembow", bpm: 120, bass: [55, 55, 65.4, 49], notes: [220, 261.6, 329.6, 196], wave: "triangle" as OscillatorType },
  comedy: { name: "Fracture FM: Off the Rails", genre: "Comedy talk radio", bpm: 96, bass: [55, 55, 55, 55], notes: [220, 220, 220, 220], wave: "triangle" as OscillatorType },
};
export type StationId = keyof typeof RADIO_STATIONS;
export type MusicSource = "playlist" | StationId;
export const RADIO_KEY = "world-fracture-radio-source";
export function isStation(id: string): id is StationId { return Object.hasOwn(RADIO_STATIONS, id); }
export function getMusicSource(): MusicSource { try { const id = localStorage.getItem(RADIO_KEY) ?? "playlist"; return isStation(id) ? id : "playlist"; } catch { return "playlist"; } }
export function setMusicSource(source: MusicSource) { try { localStorage.setItem(RADIO_KEY, source); } catch { /* device storage unavailable */ } window.dispatchEvent(new Event("wf-playlist-changed")); }
/** Recorded rotation per station (stages 42-49 from the owner): Block Signal rotates four Kinggg Dream songs, Keep Moving opens Neon
 * Frequency, Neon Frequency / Golden Era 94 / Parallel 88 add the stage 49 night instrumentals, and Fracture FM airs
 * only the episodes that passed the spoiler review (docs/radio/SPOILER_REVIEW.md): 03 and the stage 49 caller shows (06-08).
 * Tuning in opens with the station's short ID (STATION_IDS, stage 47).
 * Broadcasts are linear: every program plays through, no skip or shuffle. After every AD_EVERY programs one original fictional
 * commercial airs (rotating through RADIO_ADS), never mid-song. */
export type StationTrack = { title: string; artist: string; path: string };
const KD = "Kinggg Dream";
export const STATION_TRACKS: Record<StationId, StationTrack[]> = {
  hiphop: [
    { title: "Brooklyn, Stand Tall", artist: KD, path: "/audio/radio/kinggg-dream-brooklyn-stand-tall.mp3" },
    { title: "Bodega Gate", artist: KD, path: "/audio/radio/kinggg-dream-bodega-gate.mp3" },
    { title: "Write Your Own Name", artist: KD, path: "/audio/radio/kinggg-dream-write-your-own-name.mp3" },
    { title: "We Keep Rolling", artist: KD, path: "/audio/radio/kinggg-dream-we-keep-rolling.mp3" },    { title: "Facetime", artist: KD, path: "/audio/radio/kinggg-dream-facetime.mp3" },
    { title: "Nike Like Mikey", artist: KD, path: "/audio/radio/kinggg-dream-nike-like-mikey.mp3" },
    { title: "Legit Real Hittah", artist: KD, path: "/audio/radio/kinggg-dream-legit-real-hittah.mp3" },
    { title: "Cake", artist: KD, path: "/audio/radio/kinggg-dream-cake.mp3" },
    { title: "G.A.S.", artist: KD, path: "/audio/radio/kinggg-dream-gas.mp3" },
    { title: "CFWM", artist: KD, path: "/audio/radio/kinggg-dream-cfwm.mp3" },
    { title: "Drip Walk", artist: KD, path: "/audio/radio/kinggg-dream-drip-walk.mp3" },
    { title: "Freaky", artist: KD, path: "/audio/radio/kinggg-dream-freaky.mp3" },
    { title: "Levels", artist: KD, path: "/audio/radio/kinggg-dream-levels.mp3" },
    { title: "Poppin Tags", artist: KD, path: "/audio/radio/kinggg-dream-poppin-tags.mp3" },
    { title: "Rooftop", artist: KD, path: "/audio/radio/kinggg-dream-rooftop.mp3" },
    { title: "New Day", artist: KD, path: "/audio/radio/kinggg-dream-new-day.mp3" },
  ],
  rock: [{ title: "Burn the Horizon", artist: "Rust Riot", path: "/audio/radio/rust-riot-vocal-mix.ogg" }],
  house: [
    { title: "Keep Moving", artist: KD, path: "/audio/radio/kinggg-dream-keep-moving.mp3" },
    { title: "Electric Tomorrow", artist: "Neon Frequency", path: "/audio/radio/neon-frequency-vocal-mix.ogg" },
    { title: "After Hours", artist: "Neon Frequency", path: "/audio/radio/neon-frequency-after-hours.ogg" },
  ],
  reggae: [
    { title: "Island Signal", artist: "Island Relay", path: "/audio/radio/island-relay-vocal-mix.ogg" },
    { title: "Likkle Secret", artist: KD, path: "/audio/radio/kinggg-dream-likkle-secret.mp3" },
  ],
  oldschool: [
    { title: "Instrumental", artist: "Golden Era 94", path: "/audio/radio/golden-era-94-instrumental.ogg" },
    { title: "Night Shift", artist: "Golden Era 94", path: "/audio/radio/golden-era-night-shift.ogg" },
  ],
  instrumental: [
    { title: "Parallel Streets", artist: "Vektor Lane", path: "/audio/radio/instrumental-dimensions.ogg" },
    { title: "Night Drive", artist: "Vektor Lane", path: "/audio/radio/instrumental-night-drive.ogg" },
  ],
  // no recordings yet: these two stations air the procedural groove (audio.ts) until the owner supplies original tracks
  rnb: [],
  latin: [],
  comedy: [
    { title: "Off the Rails · Episode 3: Wasteland Mechanics", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-03.ogg" },
    { title: "Off the Rails · Council Hotline", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-06.ogg" },
    { title: "Off the Rails · Faction Open Line", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-07.ogg" },
    { title: "Off the Rails · Fracture Weather Watch", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-08.ogg" },
  ],
};
/** a recording that ships but never airs, with the reason it was withheld */
export type ArchivedTrack = StationTrack & { withheld: string };
/** Off the Rails episodes held off air because they spoil the story (owner: "remove any spoilers"; review in
 * docs/radio/SPOILER_REVIEW.md). The files stay in public/audio/radio; nothing in the broadcast reads this list. Re-airing one
 * needs a re-recorded episode without the spoiling line, not just a move into STATION_TRACKS. */
export const FRACTURE_FM_ARCHIVE: ArchivedTrack[] = [
  { title: "Off the Rails · Episode 1", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-01.ogg", withheld: "a Titan parking a dragon: reveals the hidden dragon encounter (Vyrak) and its Wyrmling bond" },
  { title: "Off the Rails · Episode 2: Pothole Protection", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-02.ogg", withheld: "a giant dragon blocking the Solara highway: gives away Vyrak's hidden Solara lair" },
  { title: "Off the Rails · Episode 4: The Dragon Parking Ticket", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-04.ogg", withheld: "a dragon parked in Solara Desert, plus dragon insurance and 'reboot wildlife': Vyrak's lair and the simulation reveal" },
  { title: "Off the Rails · Episode 5: The Dungeon Landlord", artist: "Fracture FM", path: "/audio/radio/fracture-fm-episode-05.ogg", withheld: "'procedurally generated dungeons' and rent paid in experience points: tells the player the world is generated (simulation reveal)" },
];
/** the short station ID that opens every tuning session (stage 47, public/audio/radio/ids) */
export const STATION_IDS: Partial<Record<StationId, StationTrack>> = {
  hiphop: { title: "Station ID", artist: "Block Signal", path: "/audio/radio/ids/block-signal-id.ogg" },
  rock: { title: "Station ID", artist: "Rust Riot", path: "/audio/radio/ids/rust-riot-id.ogg" },
  house: { title: "Station ID", artist: "Neon Frequency", path: "/audio/radio/ids/neon-frequency-id.ogg" },
  reggae: { title: "Station ID", artist: "Island Relay", path: "/audio/radio/ids/island-relay-id.ogg" },
  oldschool: { title: "Station ID", artist: "Golden Era 94", path: "/audio/radio/ids/golden-era-id.ogg" },
  instrumental: { title: "Station ID", artist: "Parallel 88", path: "/audio/radio/ids/instrumental-dimensions-id.ogg" },
  comedy: { title: "Station ID", artist: "Fracture FM: Off the Rails", path: "/audio/radio/ids/off-the-rails-id.ogg" },
};
export const RADIO_ADS: StationTrack[] = [
  { title: "Nexus Noodle Express", artist: "Commercial", path: "/audio/radio/ads/nexus-noodle.ogg" },
  { title: "Portal Mart", artist: "Commercial", path: "/audio/radio/ads/portal-mart.ogg" },
  { title: "Nexus Transit Authority", artist: "Commercial", path: "/audio/radio/ads/nexus-transit.ogg" },
  { title: "Rusty Ride Motors", artist: "Commercial", path: "/audio/radio/ads/rusty-ride.ogg" },
  // stage 49 originals
  { title: "Public Safety Office", artist: "Commercial", path: "/audio/radio/ads/fracture-safety.ogg" },
  { title: "Market Mile", artist: "Commercial", path: "/audio/radio/ads/market-mile.ogg" },
  { title: "Circuit Cafe", artist: "Commercial", path: "/audio/radio/ads/circuit-cafe.ogg" },
  { title: "Patchwork Repairs", artist: "Commercial", path: "/audio/radio/ads/patchwork-repairs.ogg" },
  { title: "Nexus Community Board", artist: "Commercial", path: "/audio/radio/ads/community-board.ogg" },
];
/** commercials held off air for spoilers (docs/radio/SPOILER_REVIEW.md); the files stay in public/audio/radio/ads */
export const RADIO_ADS_ARCHIVE: ArchivedTrack[] = [
  { title: "WyrmShield Insurance", artist: "Commercial", path: "/audio/radio/ads/vyrak-insurance.ogg", withheld: "'Has a dragon landed on your vehicle?' and 'mysterious glowing ash': reveals Vyrak, the Ashen Covenant" },
];
export const AD_EVERY = 2;
/** the broadcast position: whether the station ID is still to play (`intro`), which program is next, how many programs have
 * played since the last ad, which ad is next */
export type Broadcast = { intro?: boolean; program: number; sinceAd: number; ad: number };
export const BROADCAST_START: Broadcast = { intro: true, program: 0, sinceAd: 0, ad: 0 };
export type OnAir = StationTrack & { advertisement: boolean; ident: boolean };
/** what plays now at this position */
export function onAir(id: StationId, b: Broadcast, adBreak: boolean): OnAir {
  const ident = STATION_IDS[id];
  if (b.intro && ident) return { ...ident, advertisement: false, ident: true };
  return adBreak ? { ...RADIO_ADS[b.ad % RADIO_ADS.length]!, advertisement: true, ident: false } : { ...stationTrack(id, b.program), advertisement: false, ident: false };
}
/** after the current item ends: the station ID leads into the first program (it never counts toward an ad break); a finished
 * program counts toward the next ad break; a finished ad returns to the music */
export function nextOnAir(b: Broadcast, wasAd: boolean): { broadcast: Broadcast; adBreak: boolean } {
  if (b.intro) return { broadcast: { ...b, intro: false }, adBreak: false };
  if (wasAd) return { broadcast: { ...b, ad: b.ad + 1, sinceAd: 0 }, adBreak: false };
  const played = { ...b, program: b.program + 1, sinceAd: b.sinceAd + 1 };
  return played.sinceAd >= AD_EVERY ? { broadcast: played, adBreak: true } : { broadcast: played, adBreak: false };
}
/** the track at a rotation step (wraps; negative steps are treated as 0) */
/** whether the station has recordings to air; the rest play the procedural groove */
export function hasRecordings(id: StationId): boolean { return STATION_TRACKS[id].length > 0; }
export function stationTrack(id: StationId, step: number): StationTrack {
  const list = STATION_TRACKS[id];
  return list[Math.max(0, Math.floor(step)) % list.length]!;
}
