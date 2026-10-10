import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Sparkles } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";
import horizon from "@/assets/world-fracture-horizon.png.asset.json";
import { playIntroSwell, unlockAudio } from "@/game/audio";
import { classById, type ClassId } from "@/game/loadout";
import { OPERATOR_MODELS, OperatorModel } from "./OperatorModel";
import { PAD_LABELS, moveFocus } from "@/game/menu-nav";
import { detectGraphicsSupport } from "@/game/webgl-support";
import type { SaveSummary } from "@/game/startup";
import type { ArmorLook } from "@/game/armor-look";
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

/** Shows the player's operator or, if the model can't load, nothing at all (never a placeholder solid). */
function Stage({ classId, color, look, reduced, onUnavailable }: { classId: ClassId; color: string; look: ArmorLook | undefined; reduced: boolean; onUnavailable: () => void }) {
  const turn = useRef<THREE.Group>(null);
  useFrame((s) => { if (turn.current && !reduced) turn.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.35 - 0.25; });
  return (
    <>
      <ambientLight intensity={0.35} color="#9db4ff" />
      <directionalLight position={[3, 5, 4]} intensity={2.1} color="#dfe8ff" />
      <pointLight position={[-3, 2, -2]} intensity={26} distance={12} color="#7c6cff" />
      <pointLight position={[2.5, 1, 2]} intensity={14} distance={9} color={color} />
      <group ref={turn} rotation-y={-0.25}>
        <OperatorModel classId={classId} height={2.5} feetY={-1.25} color={color} look={look} pose="showcase" fallback={<Pending onUnavailable={onUnavailable} />} />
      </group>
      <ContactShadows position={[0, -1.25, 0]} opacity={0.5} scale={7} blur={2.6} far={3} />
      <Sparkles count={reduced ? 0 : 40} scale={[7, 4, 4]} size={1.2} speed={0.15} opacity={0.5} color="#8fa2ff" />
      <Environment resolution={64}><Lightformer intensity={1.4} position={[0, 6, 3]} scale={[10, 4, 1]} /><Lightformer intensity={1} color="#7c6cff" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} /></Environment>
    </>
  );
}
/** Rendered while the GLB loads (and if it fails). If it is still pending after 12 s, say so honestly. */
function Pending({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => { const t = window.setTimeout(onUnavailable, 12000); return () => window.clearTimeout(t); }, [onUnavailable]);
  return null;
}

export function MainMenu({ save, classId, look, reducedMotion, onContinue, onNewGame, onCharacter, onSettings }: {
  save: SaveSummary; classId: ClassId; look?: ArmorLook | undefined; reducedMotion: boolean;
  onContinue: () => void; onNewGame: () => void; onCharacter: () => void; onSettings: () => void;
}) {
  const enabled = useMemo(() => ITEMS.map(() => true), []);
  const [index, setIndex] = useState(() => (save.hasSave ? 0 : 1)); // land on New Game when there is nothing to continue
  const [notice, setNotice] = useState("");
  const [overlay, setOverlay] = useState<null | "confirm-new" | "credits">(null);
  const [leaving, setLeaving] = useState(false);
  const [modelDown, setModelDown] = useState(() => !OPERATOR_MODELS[classId]);
  const caps = useMemo(() => detectGraphicsSupport(), []);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const markDown = useCallback(() => setModelDown(true), []);

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

  let stage: ReactNode = null;
  if (caps.ok && !modelDown) {
    stage = (
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.9, 5.4], fov: 34 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
        <Stage classId={classId} color={cls.color} look={look} reduced={reducedMotion} onUnavailable={markDown} />
      </Canvas>
    );
  }

  return (
    <div className={`fixed inset-0 overflow-hidden bg-background transition-opacity duration-200 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <img src={horizon.url} alt="" className="title-landscape absolute inset-0 h-full w-full object-cover object-center opacity-60" />
      <div className="pointer-events-none absolute inset-0 title-vignette" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, rgb(4 6 18 / 0.88) 0%, rgb(4 6 18 / 0.55) 45%, transparent 75%)" }} />
      <div className="absolute inset-y-0 right-0 w-full lg:w-[55%]" aria-hidden={!stage}>{stage}</div>
      {modelDown && (
        <p className="absolute bottom-16 right-8 max-w-xs text-right font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground" role="status">
          {caps.ok ? `Operator model unavailable (${cls.name}) — the 3D preview is skipped.` : "3D graphics unavailable on this browser — the 3D preview is skipped."}
        </p>
      )}

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
          <p className="mt-3 min-h-4 font-mono text-[10px] uppercase tracking-[0.15em] text-primary" role="status" aria-live="polite">{notice}</p>
        </nav>

        <footer className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          ↑↓ / W S / {labels.nav} Select · Enter / {labels.confirm} Confirm · Esc / {labels.back} Back
        </footer>
      </main>

      {overlay === "confirm-new" && (
        <ConfirmDialog pad={pad} title="Start a new game?" confirmLabel="New Game" cancelLabel="Keep my save"
          body="You have saved progress. Nothing is deleted now — your save stays as it is until you confirm a new character in the next screen, and you can back out of character creation to return here."
          onCancel={() => setOverlay(null)} onConfirm={() => { setOverlay(null); go(onNewGame); }} />
      )}
      {overlay === "credits" && <CreditsPanel pad={pad} onClose={() => setOverlay(null)} />}
    </div>
  );
}
