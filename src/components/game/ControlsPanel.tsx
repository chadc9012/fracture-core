import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACTION_LABEL, DEFAULT_BINDINGS, firstPressedButton, keyName, padName, type Action, type Bindings } from "@/game/bindings";

type Listening = { device: "keyboard"; action: keyof Bindings["keyboard"] } | { device: "gamepad"; action: Action } | null;

/** Rebind reload / weapon switching on keyboard and controller. Click a binding, then press the new key or button. */
export function ControlsPanel({ bindings, onChange }: { bindings: Bindings; onChange: (b: Bindings) => void }) {
  const [listening, setListening] = useState<Listening>(null);
  const [pad, setPad] = useState(false);

  useEffect(() => {
    const check = () => setPad(Array.from(navigator.getGamepads?.() ?? []).some(Boolean));
    check();
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);
    return () => { window.removeEventListener("gamepadconnected", check); window.removeEventListener("gamepaddisconnected", check); };
  }, []);

  useEffect(() => {
    if (!listening) return;
    if (listening.device === "keyboard") {
      const onKey = (e: KeyboardEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.code !== "Escape") onChange({ ...bindings, keyboard: { ...bindings.keyboard, [listening.action]: e.code } });
        setListening(null);
      };
      window.addEventListener("keydown", onKey, true);
      return () => window.removeEventListener("keydown", onKey, true);
    }
    // wait for all buttons released, then take the next press
    let armed = firstPressedButton() < 0;
    const id = window.setInterval(() => {
      const b = firstPressedButton();
      if (!armed) { armed = b < 0; return; }
      if (b >= 0) { onChange({ ...bindings, gamepad: { ...bindings.gamepad, [listening.action]: b } }); setListening(null); }
    }, 50);
    return () => window.clearInterval(id);
  }, [listening, bindings, onChange]);

  const row = (label: string, value: string, active: boolean, onClick: () => void) => (
    <div key={label} className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick} className="h-6 min-w-16 px-2 font-mono text-[10px]">{active ? "press…" : value}</Button>
    </div>
  );

  return (
    <div className="space-y-2 pt-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Keyboard · 1–4 always select weapons</p>
      {(Object.keys(bindings.keyboard) as (keyof Bindings["keyboard"])[]).map((a) => row(ACTION_LABEL[a], keyName(bindings.keyboard[a]), listening?.device === "keyboard" && listening.action === a, () => setListening({ device: "keyboard", action: a })))}
      <p className="pt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Controller · {pad ? "connected" : "press any button to connect"}</p>
      {(Object.keys(bindings.gamepad) as Action[]).map((a) => row(ACTION_LABEL[a], padName(bindings.gamepad[a]), listening?.device === "gamepad" && listening.action === a, () => setListening({ device: "gamepad", action: a })))}
      <Button size="sm" variant="outline" className="w-full text-[10px]" onClick={() => onChange(DEFAULT_BINDINGS)}>Reset controls</Button>
    </div>
  );
}
