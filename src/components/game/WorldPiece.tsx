import { Component, type ReactNode } from "react";

/** Error boundary for optional world dressing: if a set piece throws while rendering, it is dropped (and logged) instead
 * of taking the whole 3D scene down with it. */
export class WorldPiece extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(e: unknown) { console.warn(`[world] ${this.props.name} failed and was skipped`, e); }
  override render() { return this.state.failed ? null : this.props.children; }
}
