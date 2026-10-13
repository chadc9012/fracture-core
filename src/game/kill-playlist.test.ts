import { expect, test } from "bun:test";
import { playlistShouldPlay } from "./kill-playlist";

test("combat mode plays during fights and stops after 10s calm", () => {
  expect(playlistShouldPlay("COMBAT", 0.5, 0)).toBe(true);
  expect(playlistShouldPlay("COMBAT", 0, 5)).toBe(true);
  expect(playlistShouldPlay("COMBAT", 0, 11)).toBe(false);
  expect(playlistShouldPlay("OFF", 1, 0)).toBe(false);
  expect(playlistShouldPlay("ALWAYS", 0, 99)).toBe(true);
});
