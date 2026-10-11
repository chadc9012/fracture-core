import { expect, test } from "bun:test";
import { profileFromSearch, profileKey } from "./save-profile";

test("dev and test URLs use a separate profile; the main save keeps its original keys", () => {
  expect(profileFromSearch("?dev=1")).toBe("test");
  expect(profileFromSearch("?profile=test&perf=1")).toBe("test");
  expect(profileFromSearch("")).toBe("main");
  expect(profileFromSearch("?perf=1")).toBe("main");
  expect(profileKey("world-fracture.progression.v1", "main")).toBe("world-fracture.progression.v1");
  expect(profileKey("world-fracture.progression.v1", "test")).not.toBe("world-fracture.progression.v1");
});
