import { gradeStyle } from "@/game/cinematic-look";

/** CSS-only cinematic grade for tiers without post-processing: one plain-alpha layer, no blend mode. Never intercepts input. */
export function CinematicGrade({ reduce = false }: { reduce?: boolean }) {
  const g = gradeStyle({ reduce });
  return <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]" style={{ background: g.background, opacity: g.opacity }} />;
}
