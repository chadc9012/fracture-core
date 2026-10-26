import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hasRecordings, AD_EVERY, BROADCAST_START, FRACTURE_FM_ARCHIVE, RADIO_ADS, RADIO_ADS_ARCHIVE, RADIO_STATIONS, STATION_IDS, STATION_TRACKS, nextOnAir, onAir, stationTrack, type Broadcast, type StationId } from "./radio-stations";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

describe("radio station recordings", () => {
  test("nine stations; the seven recorded ones each have a station ID and a rotation, and every file (IDs, songs, ads, archive) ships", () => {
    expect(Object.keys(RADIO_STATIONS)).toHaveLength(9);
    expect(Object.keys(RADIO_STATIONS)).toEqual(expect.arrayContaining(["rnb", "latin"]));
    // Velvet Static (hip-hop & R&B) and Calor 97 (Latin) air the procedural groove until original recordings are supplied
    expect(hasRecordings("rnb")).toBe(false); expect(hasRecordings("latin")).toBe(false);
    for (const id of Object.keys(RADIO_STATIONS) as StationId[]) {
      if (!hasRecordings(id)) continue;
      for (const t of STATION_TRACKS[id]) expect(existsSync(publicDir + t.path)).toBe(true);
      expect(existsSync(publicDir + STATION_IDS[id]!.path)).toBe(true);
    }
    for (const ad of RADIO_ADS) expect(existsSync(publicDir + ad.path)).toBe(true);
    for (const t of [...FRACTURE_FM_ARCHIVE, ...RADIO_ADS_ARCHIVE]) expect(existsSync(publicDir + t.path)).toBe(true);
  });
  test("Block Signal rotates the Kinggg Dream catalog; Keep Moving opens Neon Frequency", () => {
    expect(STATION_TRACKS.hiphop).toHaveLength(16);
    expect(STATION_TRACKS.hiphop.map((t) => t.title).slice(0, 4)).toEqual(["Brooklyn, Stand Tall", "Bodega Gate", "Write Your Own Name", "We Keep Rolling"]);
    expect(STATION_TRACKS.reggae.map((t) => t.title)).toContain("Likkle Secret");
    expect(STATION_TRACKS.hiphop.every((t) => t.artist === "Kinggg Dream")).toBe(true);
    expect(stationTrack("house", 0).title).toBe("Keep Moving");
    expect(stationTrack("hiphop", 16)).toEqual(stationTrack("hiphop", 0));
    expect(stationTrack("rock", -3)).toEqual(stationTrack("rock", 0));
  });
  test("stage 49: night instrumentals and the spoiler-free caller shows join the rotation", () => {
    expect(STATION_TRACKS.house.map((t) => t.title)).toContain("After Hours");
    expect(STATION_TRACKS.oldschool.map((t) => t.title)).toContain("Night Shift");
    expect(STATION_TRACKS.instrumental.map((t) => t.title)).toContain("Night Drive");
    expect(STATION_TRACKS.comedy.map((t) => t.path)).toEqual(["03", "06", "07", "08"].map((n) => `/audio/radio/fracture-fm-episode-${n}.ogg`));
    expect(RADIO_ADS).toHaveLength(9);
    expect(new Set(RADIO_ADS.map((a) => a.path)).size).toBe(RADIO_ADS.length);
  });
});

/** docs/radio/SPOILER_REVIEW.md: these recordings spoil the story and must never reach the air */
const SPOILERS = [
  "/audio/radio/fracture-fm-episode-01.ogg", "/audio/radio/fracture-fm-episode-02.ogg", "/audio/radio/fracture-fm-episode-04.ogg",
  "/audio/radio/fracture-fm-episode-05.ogg", "/audio/radio/ads/vyrak-insurance.ogg",
];
describe("spoiler review", () => {
  test("every spoiling recording is archived with a reason, and the archive is the whole off-air set", () => {
    const archived = [...FRACTURE_FM_ARCHIVE, ...RADIO_ADS_ARCHIVE];
    expect(archived.map((t) => t.path).sort()).toEqual([...SPOILERS].sort());
    for (const t of archived) expect(t.withheld.length).toBeGreaterThan(10);
  });
  test("no station ever airs an off-air recording: IDs, programs and ad breaks over many full rotations", () => {
    const offAir = new Set([...SPOILERS, ...FRACTURE_FM_ARCHIVE.map((t) => t.path), ...RADIO_ADS_ARCHIVE.map((t) => t.path)]);
    const lists = [...Object.values(STATION_TRACKS).flat(), ...Object.values(STATION_IDS), ...RADIO_ADS];
    for (const t of lists) expect(offAir.has(t.path)).toBe(false);
    for (const id of Object.keys(RADIO_STATIONS) as StationId[]) {
      let b: Broadcast = BROADCAST_START, ad = false;
      for (let i = 0; i < 200; i++) {
        expect(offAir.has(onAir(id, b, ad).path)).toBe(false);
        const n = nextOnAir(b, ad); b = n.broadcast; ad = n.adBreak;
      }
    }
  });
});

describe("linear broadcast", () => {
  test("tuning in opens with the station ID, then a commercial airs after every two full programs, never mid-song", () => {
    let b: Broadcast = BROADCAST_START, ad = false; const aired: string[] = [];
    for (let i = 0; i < 10; i++) { const t = onAir("hiphop", b, ad); aired.push(t.ident ? `ID:${t.artist}` : t.advertisement ? `AD:${t.title}` : t.title); const n = nextOnAir(b, ad); b = n.broadcast; ad = n.adBreak; }
    expect(aired).toEqual(["ID:Block Signal", "Brooklyn, Stand Tall", "Bodega Gate", `AD:${RADIO_ADS[0]!.title}`, "Write Your Own Name", "We Keep Rolling", `AD:${RADIO_ADS[1]!.title}`, "Facetime", "Nike Like Mikey", `AD:${RADIO_ADS[2]!.title}`]);
    expect(AD_EVERY).toBe(2);
  });
  test("the station ID plays once per tuning session and is never an advertisement", () => {
    const first = onAir("comedy", BROADCAST_START, false);
    expect(first).toMatchObject({ ident: true, advertisement: false, path: STATION_IDS.comedy!.path });
    const after = nextOnAir(BROADCAST_START, false);
    expect(after.adBreak).toBe(false);
    expect(after.broadcast).toMatchObject({ intro: false, program: 0, sinceAd: 0 });
    expect(onAir("comedy", after.broadcast, false).path).toBe("/audio/radio/fracture-fm-episode-03.ogg");
  });
});
