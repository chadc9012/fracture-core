/** Debug switches read from the page URL, for isolating what costs frame time on a given machine.
 * ?hud=0 hides the HUD layer, ?shadows=0 turns shadow maps off, ?post=0 skips post-processing, ?dpr=0.5 forces the pixel ratio.
 * ?fx=bloom,ca,vignette,noise,grade,aberration lists post effects to turn OFF individually (ca = chromatic aberration; grade = hue/brightness).
 * Absent flags change nothing. Pure and read once, so it is safe to call anywhere. */
export type PerfFlags = { hud: boolean; shadows: boolean; post: boolean; dpr: number | null; fxOff: ReadonlySet<string> };

export function parsePerfFlags(search: string): PerfFlags {
  const q = new URLSearchParams(search);
  const dpr = Number(q.get("dpr"));
  return { hud: q.get("hud") !== "0", shadows: q.get("shadows") !== "0", post: q.get("post") !== "0", fxOff: new Set((q.get("fx") ?? "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean)), dpr: q.has("dpr") && Number.isFinite(dpr) && dpr >= 0.25 && dpr <= 3 ? dpr : null };
}

export const perfFlags = (): PerfFlags => parsePerfFlags(typeof window === "undefined" ? "" : window.location.search);
