import { gradeStyle } from "@/game/cinematic-look";

/** CSS-only cinematic grade for tiers without post-processing. Never intercepts input. */
export function CinematicGrade({ reduce = false }: { reduce?: boolean }) {
  const g = gradeStyle({ reduce });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]">
      <div className="absolute inset-0" style={{ background: g.tint, mixBlendMode: g.blend, opacity: g.opacity }} />
      <div className="absolute inset-0" style={{ background: g.vignette }} />
    </div>
  );
}
