import { useEffect, useRef, useState } from "react";
import horizon from "@/assets/world-fracture-horizon.png.asset.json";
import { BOOT_TOTAL_MS, BOOT_TOTAL_REDUCED_MS, NOVA_BOOT_LINES, bootFrame } from "@/game/startup";
import { PAD_LABELS } from "@/game/menu-nav";
import { useMenuInput } from "./useMenuInput";

const VIOLET = "#7c6cff", BLUE = "#4aa8ff";

/** Cinematic opening: black → the world fades up → title with a restrained blue-violet pulse →
 * scripted NOVA subtitles → menu. Silent by design (browsers block audio before a gesture, and the
 * opening must never be loud); skippable by any key, click/tap or controller button. Isolated from
 * the gameplay scene: it mounts no Canvas and touches no game state. */
export function BootSequence({ reducedMotion, onDone }: { reducedMotion: boolean; onDone: () => void }) {
  const total = reducedMotion ? BOOT_TOTAL_REDUCED_MS : BOOT_TOTAL_MS;
  const [line, setLine] = useState(-1);
  const bg = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  const end = () => { if (done.current) return; done.current = true; finish.current(); };

  useEffect(() => {
    const start = performance.now();
    let raf = 0, lastLine = -1;
    const tick = (now: number) => {
      const f = bootFrame(now - start, reducedMotion);
      if (bg.current) bg.current.style.opacity = String(f.reveal);
      if (title.current) title.current.style.opacity = String(f.title);
      if (f.line !== lastLine) { lastLine = f.line; setLine(f.line); }
      if (f.done) { end(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // any deliberate input skips; pointer/keys are removed on unmount
  useEffect(() => {
    const skip = (e: Event) => { if (e instanceof KeyboardEvent && (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta")) return; end(); };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => { window.removeEventListener("pointerdown", skip); window.removeEventListener("keydown", skip); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pad = useMenuInput(true, () => end());
  const labels = PAD_LABELS[pad ?? "generic"];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black" role="region" aria-label="World Fracture opening" data-total-ms={total}>
      <div ref={bg} className="absolute inset-0" style={{ opacity: reducedMotion ? 1 : 0 }}>
        <img src={horizon.url} alt="" className="h-full w-full object-cover object-center opacity-70" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 25%, rgb(0 0 0 / 0.78) 100%)" }} />
      </div>
      <div ref={title} className="absolute inset-0 grid place-items-center px-6 text-center" style={{ opacity: reducedMotion ? 1 : 0 }}>
        <div>
          <div aria-hidden className="mx-auto mb-6 h-px w-40" style={{ background: `linear-gradient(90deg, transparent, ${VIOLET}, ${BLUE}, transparent)`, animation: reducedMotion ? undefined : "boot-line 3.2s ease-in-out infinite" }} />
          <h1 className="font-mono text-4xl font-bold tracking-[0.18em] text-white sm:text-6xl lg:text-7xl" style={{ textShadow: `0 0 28px ${VIOLET}66, 0 0 70px ${BLUE}33` }}>WORLD<br />FRACTURE</h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-40" style={{ background: `linear-gradient(90deg, transparent, ${BLUE}, ${VIOLET}, transparent)`, animation: reducedMotion ? undefined : "boot-line 3.2s ease-in-out 0.6s infinite" }} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-24 px-6 text-center" aria-live="polite">
        {line >= 0 && <p key={line} className="mx-auto max-w-xl font-mono text-xs uppercase tracking-[0.25em] text-white/80 sm:text-sm"><span style={{ color: BLUE }}>NOVA</span> · {NOVA_BOOT_LINES[line]}</p>}
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); end(); }} className="absolute bottom-6 right-6 border border-white/30 bg-black/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/80 outline-none hover:border-white/70 focus-visible:border-white focus-visible:text-white">
        Skip · any key / {labels.confirm}
      </button>
      <style>{`@keyframes boot-line { 0%,100% { opacity: .35; transform: scaleX(.7) } 50% { opacity: 1; transform: scaleX(1) } }`}</style>
    </div>
  );
}
