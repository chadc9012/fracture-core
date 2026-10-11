import { useEffect, useRef } from "react";
import { PAD_LABELS, type PadKind } from "@/game/menu-nav";
import { useMenuInput } from "./useMenuInput";

/** Credits are limited to what this build actually uses; placeholders are labelled, not invented. */
const SECTIONS: { heading: string; lines: string[] }[] = [
  { heading: "Game", lines: ["World Fracture"] },
  { heading: "Engine & tools", lines: ["React · TanStack Start", "three.js · React Three Fiber · Drei", "Built with Lovable and Claude Code"] },
  { heading: "Assets", lines: ["Operator models: Meshy-generated", "Environment HDRIs: Poly Haven (CC0)", "Foliage and rocks: see project asset manifests", "Fox: model by PixelMannen (CC0), rigging and animation by tomkranis (CC BY 4.0), glTF conversion by @AsoboStudio and @scurest (CC BY 4.0), via Khronos glTF Sample Assets", "Other wildlife: procedural, built in-engine"] },
  { heading: "Voice & audio", lines: ["Combat and ambience: procedural, generated in-engine", "Story voice: server-streamed synthesis, captions as fallback"] },
  { heading: "Full credits", lines: ["Placeholder — the complete credit roll is not written yet."] },
];

export function CreditsPanel({ onClose, pad }: { onClose: () => void; pad: PadKind | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useMenuInput(true, (intent) => {
    if (intent === "back" || intent === "confirm") onClose();
    else if (ref.current) ref.current.scrollBy({ top: intent === "down" ? 80 : -80 });
  });
  const labels = PAD_LABELS[pad ?? "generic"];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="credits-title" className="max-h-[85vh] w-[min(92vw,34rem)] overflow-y-auto border border-primary/40 bg-card p-6 outline-none">
        <h2 id="credits-title" className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-foreground">Credits</h2>
        {SECTIONS.map((s) => (
          <section key={s.heading} className="mt-5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">{s.heading}</h3>
            {s.lines.map((l) => <p key={l} className="mt-1 text-sm text-muted-foreground">{l}</p>)}
          </section>
        ))}
        <button type="button" onClick={onClose} className="mt-6 h-10 w-full border border-primary bg-primary/15 font-mono text-xs uppercase tracking-[0.2em] text-foreground ui-focus outline-none">Return</button>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Esc / Enter / {labels.back} Return</p>
      </div>
    </div>
  );
}
