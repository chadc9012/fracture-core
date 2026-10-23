import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RADIO_STATIONS, STATION_TRACKS, stationTrack, type StationId } from "./radio-stations";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

describe("radio station recordings", () => {
  test("every station has a recorded rotation and every file ships", () => {
    for (const id of Object.keys(RADIO_STATIONS) as StationId[]) {
      expect(STATION_TRACKS[id].length).toBeGreaterThan(0);
      for (const t of STATION_TRACKS[id]) expect(existsSync(publicDir + t.path)).toBe(true);
    }
  });
  test("Block Signal leads with Kinggg Dream and rotates", () => {
    expect(stationTrack("hiphop", 0).title).toBe("Brooklyn, Stand Tall");
    expect(stationTrack("hiphop", 1).title).toBe("Bodega Gate");
    expect(stationTrack("hiphop", STATION_TRACKS.hiphop.length)).toEqual(stationTrack("hiphop", 0));
    expect(stationTrack("rock", -3)).toEqual(stationTrack("rock", 0));
  });
});
