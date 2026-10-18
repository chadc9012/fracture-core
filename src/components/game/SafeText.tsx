import { Component, Suspense, type ComponentProps, type ReactNode } from "react";
import { Text as DreiText } from "@react-three/drei";

/**
 * World-space labels. drei's Text (troika) resolves its fonts from a CDN at runtime and suspends on that fetch,
 * so an offline client, a firewall or an ad-blocker used to throw into the world error boundary and desync the
 * whole scene. Each label now waits and fails on its own: a missing font hides that label, never the world.
 */
class QuietLabel extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.warn("[label] text font unavailable, label hidden:", error); }
  override render() { return this.state.failed ? null : this.props.children; }
}

export function Text(props: ComponentProps<typeof DreiText>) {
  return (
    <QuietLabel>
      <Suspense fallback={null}>
        <DreiText {...props} />
      </Suspense>
    </QuietLabel>
  );
}
