/** Cheap cinematic grade for tiers that skip the post-processing pass (LOW, Safari, or an adaptive drop to low performance).
 * It is a single plain-alpha CSS layer (vignette + cool-top / warm-bottom tint), not a shader and NOT a CSS blend mode:
 * `mix-blend-mode` over a WebGL canvas forces the browser compositor to resolve the canvas in an extra full-resolution
 * pass, which on integrated GPUs costs far more than the pixels it tints (F3 showed 50-80 ms of non-render frame time
 * with the old soft-light overlay). Pure data; subtle by design so it never hides gameplay. */
export type GradeStyle = { background: string; vignette: string; opacity: number };

export const GRADE = { vignetteInner: 52, vignetteDark: 0.42, tintTop: "rgba(24, 70, 96, 0.2)", tintBottom: "rgba(255, 168, 96, 0.14)" } as const;

/** `reducedMotion`/`reduceEffects` users get a flatter grade (no heavy vignette) */
export function gradeStyle(opts: { reduce?: boolean } = {}): GradeStyle {
  const dark = opts.reduce ? GRADE.vignetteDark * 0.4 : GRADE.vignetteDark;
  const vignette = `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) ${GRADE.vignetteInner}%, rgba(2,8,14,${dark.toFixed(2)}) 100%)`;
  return {
    vignette,
    background: `${vignette}, linear-gradient(180deg, ${GRADE.tintTop} 0%, rgba(0,0,0,0) 45%, ${GRADE.tintBottom} 100%)`,
    opacity: opts.reduce ? 0.4 : 0.7,
  };
}
