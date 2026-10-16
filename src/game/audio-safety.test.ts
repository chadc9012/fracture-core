import { expect, test } from "bun:test";
import { AUDIO_SAFETY, envelopeAttack, unitVolume } from "./audio-safety";
test("mix gain inputs cannot amplify or poison the audio graph", () => {
 expect(unitVolume(4)).toBe(1); expect(unitVolume(-1)).toBe(0); expect(unitVolume(NaN)).toBe(0); expect(unitVolume(0.4)).toBe(0.4);
});
test("fallback effects start smoothly with headroom for simultaneous voices", () => {
 expect(envelopeAttack(0.1)).toBe(0.003); expect(envelopeAttack(0.004)).toBe(0.001);
 expect(AUDIO_SAFETY.effectsGain).toBeLessThan(0.6); expect(AUDIO_SAFETY.reverbGain).toBeLessThan(0.2);
});
