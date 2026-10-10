import { useEffect, useMemo, useRef, useState } from "react";
import horizon from "@/assets/world-fracture-horizon.png.asset.json";
import { playIntroSwell, unlockAudio } from "@/game/audio";
import { classById, type ClassId } from "@/game/loadout";
import { PAD_LABELS, moveFocus } from "@/game/menu-nav";
import type { SaveSummary } from "@/game/startup";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreditsPanel } from "./CreditsPanel";
import { useMenuInput } from "./useMenuInput";

type Item = { id: "continue" | "new" | "character" | "settings" | "credits"; label: string; hint: string };
const ITEMS: Item[] = [
  { id: "continue", label: "Continue", hint: "Resume your saved game" },
  { id: "new", label: "New Game", hint: "Create an operator and deploy" },
  { id: "character", label: "Character", hint: "Operator, class, body and appearance" },
  { id: "settings", label: "Settings", hint: "Controls, audio, display, accessibility" },
  { id: "credits", label: "Credits", hint: "Who and what made this" },
];

export function MainMenu({ save, classId, reducedMotion, startNotice, onContinue, onNewGame, onCharacter, onSettings }: {
  startNotice?: string;
  save: SaveSummary; classId: ClassId;reducedMotion: boolean;
  onContinue: () => void; onNewGame: () => void; onCharacter: () => void; onSettings: () => void;
}) {
  const enabled = useMemo(() => ITEMS.map(() => true), []);
  const [index, setIndex] = useState(() => (save.hasSave ? 0 : 1)); // land on New Game when there is nothing to continue
  const [notice, setNotice] = useState("");
  const [overlay, setOverlay] = useState<null | "confirm-new" | "credits">(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // First deliberate input unlocks the procedural audio engine (same rule as the rest of the game); nothing plays before that.
  const swelled = useRef(false);
  useEffect(() => {
    const greet = () => { if (swelled.current) return; swelled.current = true; unlockAudio(); playIntroSwell(); };
    window.addEventListener("pointerdown", greet); window.addEventListener("keydown", greet);
    return () => { window.removeEventListener("pointerdown", greet); window.removeEventListener("keydown", greet); };
  }, []);

  const go = (fn: () => void) => {
    if (reducedMotion) { fn(); return; }
    setLeaving(true);
    timer.current = window.setTimeout(fn, 260);
  };

  const activate = (item: Item) => {
    setNotice("");
    switch (item.id) {
      case "continue":
        if (!save.hasSave) { setNotice("No saved game found on this device. Choose New Game to begin."); return; }
        go(onContinue); return;
      case "new":
        if (save.hasSave) setOverlay("confirm-new"); else go(onNewGame);
        return;
      case "character": go(onCharacter); return;
      case "settings": onSettings(); return;
      case "credits": setOverlay("credits"); return;
    }
  };

  const pad = useMenuInput(overlay === null && !leaving, (intent) => {
    if (intent === "up" || intent === "down") setIndex((i) => moveFocus(i, intent === "down" ? 1 : -1, enabled));
    else if (intent === "confirm") activate(ITEMS[index]!);
    else if (intent === "back") setNotice("This is the main menu. Choose an option to continue.");
  });
  const labels = PAD_LABELS[pad ?? "generic"];
  const cls = classById(classId);

  return (
    <div className={`fixed inset-0 overflow-hidden bg-background transition-opacity duration-200 ${leaving ? "opacity-0" : "opacity-100"}`}>
      {/* cinematic backdrop: the Fractured Earth horizon on a slow push-in, drifting light and shadow sweeps and low mist; pure CSS, so it needs no WebGL and costs no draw calls.
          Reduced motion freezes every layer (styles.css). */}
      <img src={horizon.url} alt="" className="title-landscape absolute inset-0 h-full w-full object-cover object-center" />
      <div className="title-sunlight pointer-events-none absolute inset-0" />
      <div className="title-shadows pointer-events-none absolute inset-0" />
      <div className="title-mist pointer-events-none absolute inset-x-0 bottom-0 h-2/5" />
      <div className="pointer-events-none absolute inset-0 title-vignette" />

      <main className="relative z-10 flex h-full flex-col justify-between overflow-y-auto px-6 py-8 sm:px-14 sm:py-12">
        <header>
          <p className="font-mono text-[9px] uppercase tracking-[0.42em] text-primary">Signal recovered · Nexus orbit</p>
          <h1 className="title-glow mt-4 font-mono text-4xl font-bold tracking-[0.12em] text-foreground sm:text-6xl">WORLD<br />FRACTURE</h1>
          {save.hasSave && <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{save.name ?? cls.name} · Level {save.level} · {save.missions} mission{save.missions === 1 ? "" : "s"} complete</p>}
        </header>

        <nav aria-label="Main menu" className="my-8 flex w-full max-w-sm flex-col gap-1">
          {ITEMS.map((item, i) => {
            const active = i === index;
            const dim = item.id === "continue" && !save.hasSave;
            return (
              <button key={item.id} type="button" onClick={() => { setIndex(i); activate(item); }} onMouseEnter={() => setIndex(i)} onFocus={() => setIndex(i)}
                aria-current={active ? "true" : undefined}
                className={`group h-12 border-l-2 pl-4 text-left font-mono text-sm uppercase tracking-[0.22em] outline-none transition-all duration-150 ${active ? "translate-x-1 border-primary bg-primary/10 text-foreground ui-focus" : "border-transparent text-muted-foreground"} ${dim ? "opacity-60" : ""} focus-visible:ring-1 focus-visible:ring-primary`}>
                {item.label}
                {active && <span className="ml-3 hidden font-sans text-[10px] normal-case tracking-normal text-muted-foreground sm:inline">{item.hint}</span>}
              </button>
            );
          })}
          <p className="mt-3 min-h-4 font-mono text-[10px] uppercase tracking-[0.15em] text-primary" role="status" aria-live="polite">{startNotice || notice}</p>
        </nav>

        <footer className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          ↑↓ / W S / {labels.nav} Select · Enter / {labels.confirm} Confirm · Esc / {labels.back} Back
        </footer>
      </main>

      {overlay === "confirm-new" && (
        <ConfirmDialog pad={pad} title="Start a new game?" confirmLabel="New Game" cancelLabel="Keep my save"
          body="You have saved progress. Starting a new game keeps it: your current game is parked in a free save slot and a fresh run begins. Nothing is erased, and you can switch back any time from Saves. If every slot is in use, New Game is refused until you free one."
          onCancel={() => setOverlay(null)} onConfirm={() => { setOverlay(null); go(onNewGame); }} />
      )}
      {overlay === "credits" && <CreditsPanel pad={pad} onClose={() => setOverlay(null)} />}
    </div>
  );
}
