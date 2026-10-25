/** Test shim for gen-ability-golden: boss-poise.ts stays real; ability-effects.ts's hitPoise calls are recorded. */
export * from "../../../src/game/boss-poise";
import { hitPoise as realHitPoise } from "../../../src/game/boss-poise";
export function hitPoise(...args: Parameters<typeof realHitPoise>): ReturnType<typeof realHitPoise> {
  ((globalThis as unknown as { __wfAbilityLog: string[] }).__wfAbilityLog ??= []).push(`poise:${args[1]}`);
  return realHitPoise(...args);
}
