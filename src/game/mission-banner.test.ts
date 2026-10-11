import { expect, test } from "bun:test";
import { bannerFor } from "./mission-banner";

test("a banner when a mission starts or completes, nothing for mid-mission steps or restored runs", () => {
  expect(bannerFor({}, { "descent-protocol": "TRIGGERED" })).toEqual({ kind: "NEW", title: "Descent Protocol", subtitle: "Thalassia · Sentry Dock" });
  expect(bannerFor({ "descent-protocol": "IDLE" }, { "descent-protocol": "TRIGGERED" })?.kind).toBe("NEW");
  expect(bannerFor({ "descent-protocol": "RING" }, { "descent-protocol": "CORE" })).toBeNull();
  expect(bannerFor({ "descent-protocol": "TRACING" }, { "descent-protocol": "COMPLETE" })?.kind).toBe("COMPLETE");
  expect(bannerFor({ "descent-protocol": "COMPLETE" }, { "descent-protocol": "WORLD_UPDATE" })).toBeNull();
  expect(bannerFor({ "descent-protocol": "TRACING" }, {})).toBeNull();
});
