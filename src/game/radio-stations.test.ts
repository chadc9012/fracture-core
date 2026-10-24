import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AD_EVERY, BROADCAST_START, FRACTURE_FM_ARCHIVE, RADIO_ADS, RADIO_STATIONS, STATION_IDS, STATION_TRACKS, nextOnAir, onAir, stationTrack, type Broadcast, type StationId } from "./radio-stations";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

describe("radio station recordings", () => {
  test("seven stations, each with a station ID and a recorded rotation, and every file (IDs, songs, ads, archive) ships", () => {
    expect(Object.keys(RADIO_STATIONS)).toHaveLength(7);
    for (const id of Object.keys(RADIO_STATIONS) as StationId[]) {
      expect(STATION_TRACKS[id].length).toBeGreaterThan(0);
      for (const t of STATION_TRACKS[id]) expect(existsSync(publicDir + t.path)).toBe(true);
      expect(existsSync(publicDir + STATION_IDS[id].path)).toBe(true);
    }
    for (const ad of RADIO_ADS) expect(existsSync(publicDir + ad.path)).toBe(true);
    for (const ep of FRACTURE_FM_ARCHIVE) expect(existsSync(publicDir + ep.path)).toBe(true);
  });
  test("Block Signal rotates four Kinggg Dream songs; Keep Moving opens Neon Frequency", () => {
    expect(STATION_TRACKS.hiphop.map((t) => t.title)).toEqual(["Brooklyn, Stand Tall", "Bodega Gate", "Write Your Own Name", "We Keep Rolling"]);
    expect(STATION_TRACKS.hiphop.every((t) => t.artist === "Kinggg Dream")).toBe(true);
    expect(stationTrack("house", 0).title).toBe("Keep Moving");
    expect(stationTrack("hiphop", 4)).toEqual(stationTrack("hiphop", 0));
    expect(stationTrack("rock", -3)).toEqual(stationTrack("rock", 0));
  });
  test("stage 49: night instrumentals and caller shows join the rotation; Episode 1 and every earlier ad stay on air", () => {
    expect(STATION_TRACKS.house.map((t) => t.title)).toContain("After Hours");
    expect(STATION_TRACKS.oldschool.map((t) => t.title)).toContain("Night Shift");
    expect(STATION_TRACKS.instrumental.map((t) => t.title)).toContain("Night Drive");
    const comedy = STATION_TRACKS.comedy.map((t) => t.path);
    expect(comedy[0]).toBe("/audio/radio/fracture-fm-episode-01.ogg");
    for (const n of ["06", "07", "08"]) expect(comedy).toContain(`/audio/radio/fracture-fm-episode-${n}.ogg`);
    for (const ep of FRACTURE_FM_ARCHIVE) expect(comedy).not.toContain(ep.path);
    expect(RADIO_ADS.map((a) => a.path)).toContain("/audio/radio/ads/vyrak-insurance.ogg");
    expect(RADIO_ADS).toHaveLength(10);
    expect(new Set(RADIO_ADS.map((a) => a.path)).size).toBe(RADIO_ADS.length);
  });
});

describe("linear broadcast", () => {
  test("tuning in opens with the station ID, then a commercial airs after every two full programs, never mid-song", () => {
    let b: Broadcast = BROADCAST_START, ad = false; const aired: string[] = [];
    for (let i = 0; i < 10; i++) { const t = onAir("hiphop", b, ad); aired.push(t.ident ? `ID:${t.artist}` : t.advertisement ? `AD:${t.title}` : t.title); const n = nextOnAir(b, ad); b = n.broadcast; ad = n.adBreak; }
    expect(aired).toEqual(["ID:Block Signal", "Brooklyn, Stand Tall", "Bodega Gate", `AD:${RADIO_ADS[0]!.title}`, "Write Your Own Name", "We Keep Rolling", `AD:${RADIO_ADS[1]!.title}`, "Brooklyn, Stand Tall", "Bodega Gate", `AD:${RADIO_ADS[2]!.title}`]);
    expect(AD_EVERY).toBe(2);
  });
  test("the station ID plays once per tuning session and is never an advertisement", () => {
    const first = onAir("comedy", BROADCAST_START, false);
    expect(first).toMatchObject({ ident: true, advertisement: false, path: STATION_IDS.comedy.path });
    const after = nextOnAir(BROADCAST_START, false);
    expect(after.adBreak).toBe(false);
    expect(after.broadcast).toMatchObject({ intro: false, program: 0, sinceAd: 0 });
    expect(onAir("comedy", after.broadcast, false).path).toBe("/audio/radio/fracture-fm-episode-01.ogg");
  });
});
