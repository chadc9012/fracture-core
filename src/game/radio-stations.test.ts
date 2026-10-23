import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AD_EVERY, BROADCAST_START, RADIO_ADS, RADIO_STATIONS, STATION_TRACKS, nextOnAir, onAir, stationTrack, type Broadcast, type StationId } from "./radio-stations";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

describe("radio station recordings", () => {
  test("seven stations, each with a recorded rotation, and every file (songs and ads) ships", () => {
    expect(Object.keys(RADIO_STATIONS)).toHaveLength(7);
    for (const id of Object.keys(RADIO_STATIONS) as StationId[]) {
      expect(STATION_TRACKS[id].length).toBeGreaterThan(0);
      for (const t of STATION_TRACKS[id]) expect(existsSync(publicDir + t.path)).toBe(true);
    }
    for (const ad of RADIO_ADS) expect(existsSync(publicDir + ad.path)).toBe(true);
  });
  test("Block Signal rotates four Kinggg Dream songs; Keep Moving opens Neon Frequency", () => {
    expect(STATION_TRACKS.hiphop.map((t) => t.title)).toEqual(["Brooklyn, Stand Tall", "Bodega Gate", "Write Your Own Name", "We Keep Rolling"]);
    expect(STATION_TRACKS.hiphop.every((t) => t.artist === "Kinggg Dream")).toBe(true);
    expect(stationTrack("house", 0).title).toBe("Keep Moving");
    expect(stationTrack("hiphop", 4)).toEqual(stationTrack("hiphop", 0));
    expect(stationTrack("rock", -3)).toEqual(stationTrack("rock", 0));
  });
});

describe("linear broadcast", () => {
  test("a commercial airs after every two full programs, never mid-song, and the music resumes where it left off", () => {
    let b: Broadcast = BROADCAST_START, ad = false; const aired: string[] = [];
    for (let i = 0; i < 9; i++) { const t = onAir("hiphop", b, ad); aired.push(t.advertisement ? `AD:${t.title}` : t.title); const n = nextOnAir(b, ad); b = n.broadcast; ad = n.adBreak; }
    expect(aired).toEqual(["Brooklyn, Stand Tall", "Bodega Gate", `AD:${RADIO_ADS[0]!.title}`, "Write Your Own Name", "We Keep Rolling", `AD:${RADIO_ADS[1]!.title}`, "Brooklyn, Stand Tall", "Bodega Gate", `AD:${RADIO_ADS[2]!.title}`]);
    expect(AD_EVERY).toBe(2);
  });
});
