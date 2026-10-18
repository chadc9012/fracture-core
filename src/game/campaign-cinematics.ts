/** Playable cinematics built from the campaign script (campaign-script.ts): Mission 06, Rime Alpha, the Null Sovereign and the Fracture Engine raid.
 * Same Cinematic type, controller and once-keyed played flags as the Act I scenes in cinematics.ts, so skip / pause / replay rules are shared.
 * Camera kinds and symbolic anchors are chosen by rule (Scene resolves anchors); the dialogue and staging are the document's. */
import type { CameraKind, CineLine, CineShot, Cinematic, Handoff } from "./cinematics";
import { CAMPAIGN_SCRIPT, type ScriptGroup, type ScriptScene } from "./campaign-script";

const CAMERAS: readonly CameraKind[] = ["crane", "dolly", "static", "track", "closeup", "orbit"];
const GROUP: Record<ScriptGroup, { mission: Cinematic["mission"]; hand: Handoff }> = {
  blackout: { mission: 6, hand: { objective: "RESTORE EMERGENCY POWER", control: "gameplay", hook: { system: "missions/blackout-protocol.ts", exists: true, note: "Mission 06 gameplay takes over in place." } } },
  "rime-alpha": { mission: "side", hand: { objective: "HUNT RIME ALPHA", control: "gameplay", hook: { system: "unique-scenarios.ts rime-alpha", exists: true, note: "The boss introduction flows straight into the fight; the scenario is already summoned." } } },
  "null-sovereign": { mission: 20, hand: { objective: "DEFEAT THE NULL SOVEREIGN", control: "gameplay", hook: { system: "unique-scenarios.ts dark-knight", exists: true, note: "The Null Sovereign's phases map onto the existing Dark Knight scenario boss." } } },
  "fracture-engine": { mission: "raid", hand: { objective: "ENTER THE FRACTURE ENGINE", control: "gameplay", hook: { system: "raid encounters", exists: false, note: "No raid director exists yet; this script is ready for it." } } },
};

const speakerOf = (s: string) => s.split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

/** Cue runs and the lines that follow them become shots; a cue after spoken lines starts a new shot. */
export function sceneShots(scene: ScriptScene): CineShot[] {
  const shots: CineShot[] = [];
  let cur: CineShot | null = null, spoken = false, n = 0;
  const open = () => { n++; cur = { id: `${scene.id}-s${n}`, camera: CAMERAS[(n - 1) % CAMERAS.length]!, anchor: `${scene.group}:${scene.id}:${n}`, framing: "", cues: [], lines: [], minSeconds: 4 }; shots.push(cur); spoken = false; };
  for (const b of scene.beats) {
    if (b[0] === "c") {
      if (!cur || spoken) open();
      const text = b[1];
      if (!cur!.framing && /^VISUAL:/i.test(text)) cur!.framing = text.replace(/^VISUAL:\s*/i, ""); else cur!.cues.push(text);
    } else {
      if (!cur) open();
      const line: CineLine = { id: `${scene.id}-l${cur!.lines.length + 1}-${n}`, speaker: speakerOf(b[1]), text: b[3] };
      cur!.lines.push(line); spoken = true;
    }
  }
  return shots;
}

const lineCount = (s: ScriptScene) => s.beats.filter((b) => b[0] === "l").length;
/** every scene with spoken dialogue becomes a cinematic; pure-staging scenes stay in the script as notes */
export const CAMPAIGN_CINEMATICS: readonly Cinematic[] = CAMPAIGN_SCRIPT.filter((s) => lineCount(s) >= 2).map((scene) => {
  const g = GROUP[scene.group];
  const shots = sceneShots(scene);
  const secs = shots.reduce((t, sh) => t + Math.max(sh.minSeconds, sh.lines.length * 3 + 1), 0);
  return { id: `c-${scene.id}`, mission: g.mission, part: scene.id, title: scene.title, target: [Math.max(10, Math.round(secs * 0.8)), Math.round(secs * 1.6)] as const, trigger: `${scene.group}: ${scene.title}`, shots, handoff: g.hand };
});
export const campaignCinematicById = (id: string) => CAMPAIGN_CINEMATICS.find((c) => c.id === id);
export const campaignCinematicsFor = (group: ScriptGroup) => CAMPAIGN_CINEMATICS.filter((c) => c.trigger.startsWith(`${group}:`));

/** scenes that play back to back: when the key scene ends, the value scene follows (each keeps its own once-only played flag) */
export const CAMPAIGN_CHAIN: Readonly<Record<string, string>> = { "c-blackout-2": "c-blackout-3" };
