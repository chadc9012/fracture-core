<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture

- Gameplay, 3D components, assets, saves and combat rules are documented in `src/game/AGENTS.md`; read it before changing them. Why: detailed contracts belong next to their owning subsystem.
- Keep the TanStack Start route architecture and generated client boundaries. Why: the published app runs on the Worker runtime.
- Controller onboarding browser tests use the isolated test save profile and a simulated standard Gamepad API in scripts/tests; never inject real saves or replace menu handlers. Why: end-to-end input regressions must exercise real polling without changing player progress.
- Touch input uses normalized keyboard bindings and releases on cancellation/menus. Why: remapping and interrupted gestures must not leave movement or fire held.
- Vehicle sound/RPM profiles consume existing fleet tuning; never invent a gearbox, fuel or second health system. Why: telemetry must describe real supported systems.
- Skate attachments preserve the model-up frame when parented to foot bones. Why: differing rig rolls must not turn accessories into the foot.
- Vehicle race courses are routed over drivable ground (src/game/race-routing.ts: A* over the real terrain, rivers, towers, homes and garages) and baked per world scale by `bun scripts/bake-race-routes.ts` into race-routes.generated.ts; race-routing.test.ts fails if a world change blocks a baked route. Why: authored course shapes ran through lakes and buildings; routing at load is too slow.
