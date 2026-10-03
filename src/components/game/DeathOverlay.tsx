import { useEffect, useState } from "react";
import { useVoiceLine } from "./useVoiceLine";

/**
 * Hull-destroyed feedback. hurtPlayer() (sim.ts) resets hp/cargo and stamps sim.lastDeath the instant
 * the hull hits zero, and Scene.tsx's frame loop already teleports the player back to Nexus City that
 * same frame — by the time this mounts, the player is already standing at Nexus. So this isn't a
 * blocking "game over" gate (there's nothing to gate; play never stopped), it's a brief, non-blocking
 * flash that tells the player what just happened and what it cost, then gets out of the way on its own.
 */
export function DeathOverlay({
  cause,
  cargoLost,
  deaths,
  onDone,
}: {
  cause: string;
  cargoLost: number;
  deaths: number;
  onDone: () => void;
}) {
  const [fading, setFading] = useState(false);
  useVoiceLine(`death-${deaths}`, "NOVA", `Operator signal lost. Reconstructing at the nearest safe point.`, "critical");

  useEffect(() => {
    setFading(false);
    const fade = setTimeout(() => setFading(true), 2200);
    const done = setTimeout(onDone, 2900);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cause]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center gap-2 text-center transition-opacity duration-700 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-background/70 shadow-[inset_0_0_220px_70px_rgba(255,45,85,0.35)]" />
      <div className="relative">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-destructive">Hull Destroyed</p>
        <h1 className="mt-2 text-3xl font-semibold uppercase tracking-wide text-foreground">{cause || "Unknown cause"}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {cargoLost > 0 ? `Cargo lost: ${cargoLost} · ` : ""}Respawned at a safe checkpoint, away from the fighting
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Deaths this run: {deaths}</p>
      </div>
    </div>
  );
}
