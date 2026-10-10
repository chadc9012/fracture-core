/** Cheap cinematic grade for tiers that skip the post-processing pass (LOW, Safari, or an adaptive drop to low performance).
 * It is a CSS overlay, not a shader: a vignette plus a cool-shadow / warm-highlight tint, so it costs the GPU almost nothing.
 * Pure data: the component only turns these numbers into style strings. Subtle by design: it must never hide gameplay. */
export type GradeStyle = { vignette: string; tint: string; blend: "soft-light" | "overlay"; opacity: number };

export const GRADE = { vignetteInner: 52, vignetteDark: 0.5, tintTop: "rgba(24, 70, 96, 0.55)", tintBottom: "rgba(255, 168, 96, 0.35)", opacity: 0.6 } as const;

/** `reducedMotion`/`reduceEffects` users get a flatter grade (no heavy vignette) */
export function gradeStyle(opts: { reduce?: boolean } = {}): GradeStyle {
  const dark = opts.reduce ? GRADE.vignetteDark * 0.4 : GRADE.vignetteDark;
  return {
    vignette: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) ${GRADE.vignetteInner}%, rgba(2,8,14,${dark.toFixed(2)}) 100%)`,
    tint: `linear-gradient(180deg, ${GRADE.tintTop} 0%, rgba(0,0,0,0) 45%, ${GRADE.tintBottom} 100%)`,
    blend: "soft-light",
    opacity: opts.reduce ? GRADE.opacity * 0.6 : GRADE.opacity,
  };
}
