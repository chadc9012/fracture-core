import { useEffect, useState } from "react";

/** The "dopamine hit" moment from the Loot + XP System v1 spec — a brief flash + text burst on
 * level-up, with an optional NOVA meta-progression unlock line underneath. Non-blocking and
 * auto-dismissing so it never interrupts combat like a modal would. */
export function LevelUpOverlay({ level, novaUnlocked, onDone }: { level: number; novaUnlocked: string[]; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const fade = setTimeout(() => setVisible(false), 1300);
    const done = setTimeout(onDone, 1700);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className={`pointer-events-none fixed inset-0 z-[90] grid place-items-center transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div className="absolute inset-0 bg-primary/10" />
      <div className="relative text-center">
        <p className="font-mono text-5xl font-bold tracking-[0.15em] text-primary drop-shadow-[0_0_30px_hsl(var(--primary))]">LEVEL UP</p>
        <p className="mt-1 font-mono text-2xl text-foreground">{level}</p>
        {novaUnlocked.length > 0 && (
          <div className="mt-4 border-t border-primary/40 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">NOVA evolution</p>
            {novaUnlocked.map((ability) => <p key={ability} className="mt-1 text-sm text-foreground">{ability.replace(/_/g, " ")} unlocked</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
