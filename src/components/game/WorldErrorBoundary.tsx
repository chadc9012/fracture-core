import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Last-resort rollback for a genuine React render crash inside the 3D world (the frame-loop's own
 * try/catch in Scene.tsx handles per-frame logic errors already — this is the backstop for a crash
 * during render itself). Progress is saved continuously elsewhere, so a reload recovers from the
 * last save rather than losing the session outright. */
export class WorldErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state: { crashed: boolean } = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[world-fracture] world render crashed, offering recovery:", error);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-background/95 backdrop-blur">
          <div className="max-w-sm border border-destructive bg-card/90 p-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-destructive">World desynced</p>
            <h2 className="mt-2 text-lg font-semibold">Something broke in the simulation</h2>
            <p className="mt-2 text-xs text-muted-foreground">Your progress is saved. Reloading will pick back up from your last save point.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>Reload world</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
