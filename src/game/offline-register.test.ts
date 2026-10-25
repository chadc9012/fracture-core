import { expect, test } from "bun:test";
import { shouldRegisterServiceWorker } from "./offline-register";
// @ts-ignore plain JS service worker, exposed for tests
const { strategyFor } = require("../../public/sw.js") as { strategyFor: (u: URL, m: string, mode: string, range: boolean, origin: string) => string };
const O = "https://game.example";
const s = (path: string, o: { m?: string; mode?: string; range?: boolean; origin?: string } = {}) => strategyFor(new URL(path, o.origin ?? O), o.m ?? "GET", o.mode ?? "no-cors", o.range ?? false, O);

test("hashed bundles are cache-first, same-URL game files refresh in the background, pages try the network first", () => {
  expect(s("/assets/index-abc123.js")).toBe("cache-first");
  expect(s("/models/weapons/rifle.glb")).toBe("stale-while-revalidate");
  expect(s("/audio/radio/kinggg-dream-bodega-gate.mp3")).toBe("stale-while-revalidate");
  expect(s("/", { mode: "navigate" })).toBe("page");
});
test("API, server functions, other sites, writes and Range requests are never touched", () => {
  expect(s("/api/voice")).toBe("bypass");
  expect(s("/_serverFn/abc")).toBe("bypass");
  expect(s("/sw.js")).toBe("bypass");
  expect(s("/models/x.glb", { origin: "https://cdn.other" })).toBe("bypass");
  expect(s("/models/x.glb", { m: "POST" })).toBe("bypass");
  expect(s("/audio/a.mp3", { range: true })).toBe("bypass");
  expect(s("/some/data.json")).toBe("bypass");
});
test("the worker registers only in production, outside iframes and Lovable preview hosts", () => {
  const base = { prod: true, hasServiceWorker: true, inIframe: false, hostname: "world-fracture.lovable.app" };
  expect(shouldRegisterServiceWorker(base)).toBe(true);
  expect(shouldRegisterServiceWorker({ ...base, prod: false })).toBe(false);
  expect(shouldRegisterServiceWorker({ ...base, inIframe: true })).toBe(false);
  expect(shouldRegisterServiceWorker({ ...base, hasServiceWorker: false })).toBe(false);
  expect(shouldRegisterServiceWorker({ ...base, hostname: "abc.lovableproject.com" })).toBe(false);
  expect(shouldRegisterServiceWorker({ ...base, hostname: "id-preview--abc.lovable.app" })).toBe(false);
});
