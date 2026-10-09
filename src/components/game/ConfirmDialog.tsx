import { useEffect, useRef, useState } from "react";
import { PAD_LABELS, moveFocus, type PadKind } from "@/game/menu-nav";
import { useMenuInput } from "./useMenuInput";

/** Modal confirmation that works with mouse, keyboard (←/→/↑/↓, Enter, Esc) and gamepad (D-pad, confirm, back).
 * Focus starts on the safe (cancel) choice. */
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel, pad }: {
  title: string; body: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; pad: PadKind | null;
}) {
  const [index, setIndex] = useState(0); // 0 = cancel, 1 = confirm
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useMenuInput(true, (intent) => {
    if (intent === "back") onCancel();
    else if (intent === "up" || intent === "down") setIndex((i) => moveFocus(i, intent === "down" ? 1 : -1, [true, true]));
    else if (intent === "confirm") (index === 1 ? onConfirm : onCancel)();
  });
  const labels = PAD_LABELS[pad ?? "generic"];
  const btn = (i: number, label: string, fn: () => void) => (
    <button type="button" onClick={fn} onMouseEnter={() => setIndex(i)} onFocus={() => setIndex(i)}
      className={`h-10 flex-1 border px-4 font-mono text-xs uppercase tracking-[0.2em] outline-none transition-colors ${index === i ? "border-primary bg-primary/15 text-foreground ui-focus" : "border-border text-muted-foreground hover:text-foreground"}`}>{label}</button>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" className="w-[min(92vw,26rem)] border border-primary/40 bg-card p-6 outline-none">
        <h2 id="confirm-title" className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-foreground">{title}</h2>
        <p id="confirm-body" className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex gap-2">{btn(0, cancelLabel, onCancel)}{btn(1, confirmLabel, onConfirm)}</div>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">↑↓ Select · Enter / {labels.confirm} Confirm · Esc / {labels.back} Cancel</p>
      </div>
    </div>
  );
}
