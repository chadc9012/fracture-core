import { describe, expect, test } from "bun:test";
import { gameTick, survivalTickIsNoop } from "./quests";
import { DEFAULT_PROGRESSION } from "./progression";
import type { QuestEvent } from "./quests";

describe("survivalTickIsNoop", () => {
  const surv: QuestEvent = { type: "SURVIVED", world: "veridan", seconds: 0.18 };
  test("agrees with applying the events directly", () => {
    const direct = gameTick(DEFAULT_PROGRESSION, surv) === DEFAULT_PROGRESSION;
    expect(survivalTickIsNoop(DEFAULT_PROGRESSION, [surv])).toBe(direct);
  });
  test("never skips one-shot events, even if they would change nothing", () => {
    expect(survivalTickIsNoop(DEFAULT_PROGRESSION, [{ type: "KILL", world: "veridan" }])).toBe(false);
    expect(survivalTickIsNoop(DEFAULT_PROGRESSION, [surv, { type: "KILL", world: "veridan" }])).toBe(false);
    expect(survivalTickIsNoop(DEFAULT_PROGRESSION, [])).toBe(false);
  });
});
