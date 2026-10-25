// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/** The TanStack devtools plugin (on in development mode, which is how the Lovable preview builds) tags every JSX element
 * with `data-tsd-source`. On a react-three-fiber element that becomes a pierced prop (`data` → `tsd` → `source`), and on
 * any three object whose `data` is null or a primitive R3F throws "Cannot set data-tsd-source", which crashed the world
 * on load ("World desynced") and hung local dev on "Loading world". The 3D scene files never need the source tags, so they
 * are stripped right after the devtools pass (both are `pre` plugins; this one is registered after it). */
function stripSourceTagsFrom3D(): Plugin {
  return {
    name: "strip-tsd-source-from-3d",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0] ?? "";
      if (!/\/src\/components\/game\/.*\.tsx$/.test(file) || !code.includes("data-tsd-source")) return null;
      return { code: code.replace(/\s+data-tsd-source="[^"]*"/g, ""), map: null };
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // WF_MOBILE=1 builds the game as a static single-page app (a prerendered shell + client bundle) for the Android app in mobile/,
    // which ships the game inside the APK instead of loading it from a server
    ...(process.env["WF_MOBILE"] ? { spa: { enabled: true } } : {}),
  },
  vite: { plugins: [stripSourceTagsFrom3D()] },
});
