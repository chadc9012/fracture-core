import { describe, expect, it } from "vitest";
import { captionEnvelope, classifyMood, poseFor } from "./voice-animation";

describe("voice animation", () => {
  it("boss speakers read as threat", () => expect(classifyMood("OVERSEER", "hello")).toBe("threat"));
  it("exclamations read as urgent", () => expect(classifyMood("Mara", "Move now!")).toBe("urgent"));
  it("silence closes the jaw", () => expect(poseFor(0, "calm", 1).jaw).toBe(0));
  it("caption envelope ends after the line", () => expect(captionEnvelope(100, "short line")).toBe(0));
});
