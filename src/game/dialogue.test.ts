import { describe, expect, test } from "bun:test";

describe("starbreaker recognition", () => {
  const ctx = { questTitle: null, zoneTier: "STABLE" as const, owner: "NEXUS" as never, regionId: "none", visitCount: 1 };
  test("Starbreakers are recognised on alternating revisits, others never", async () => {
    const { revisitDialogueFor, STARBREAKER_LINE } = await import("./dialogue");
    const id = "solara-waystation";
    expect(revisitDialogueFor(id, { ...ctx, starbreaker: true })?.[0]?.text).toBe(STARBREAKER_LINE);
    expect(revisitDialogueFor(id, { ...ctx, starbreaker: false })?.[0]?.text).not.toBe(STARBREAKER_LINE);
    expect(revisitDialogueFor(id, { ...ctx, starbreaker: true, visitCount: 2 })?.[0]?.text).not.toBe(STARBREAKER_LINE);
  });
});
