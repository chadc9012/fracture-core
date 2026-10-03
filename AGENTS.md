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

- Keep camera preference client-local: FPS is default, F persists FPS/TPP, and melee or special actions temporarily override to TPP; camera choice is presentation, not shared combat state.
- Player progression syncs to the player_saves table via optimistic revision checks; conflicts merge additively (unions/maxes), newer copy wins choices. Why: progress is only gained, so merging never loses unlocks.
- Keep regional enemy and boss identities in a shared encounter catalog, with material drops granted into progression on confirmed kills. Why: map intelligence, combat rewards, and inventory must agree.
- Authored missions are pure state machines in src/game/missions/* advanced by world events emitted from Scene (ANCHOR/ARRIVED/CLEAR) and UI (HACK/ACK). Why: deterministic, testable, no menu-driven quest flow.
- Input bindings live in src/game/bindings.ts and persist client-side (localStorage "world-fracture-bindings"); Scene reads them each frame for keyboard + standard-mapping gamepads. Why: controls are per-device presentation, not progression.
- Cloud restore points are captured by a database trigger on player_saves updates (max 1 per 10 min, keep 30); restoring replaces rather than merges. Why: the backend guarantees history even if a client misbehaves.
- Combat audio is procedural Web Audio in src/game/audio.ts (no sound files), unlocked on first user input; Scene triggers it from weapon/ability/sim state changes. Why: zero asset downloads, sounds react to live combat values.
- Map/HUD markers share src/game/waypoints.ts so compass, map and beacons agree; creation stays a spatial Identity Forge while preserving saved identity contracts.
- Destructible interiors use the structural graph in src/game/destruction.ts; every change is logged as a DestructionEvent. Why: future multiplayer replicates events, not physics.
- Dense authored districts share street furniture and animated transit from DistrictStreet.tsx; district files own their local architecture. Why: Thalassia and Neon City stay visually related without coupling their layouts.
- World model URLs must resolve all dependent textures; repaired NPC GLBs bundle without missing external maps, and unreachable rock models are excluded from preloading. Why: a failed model can suspend the entire 3D scene and leave only the HUD visible.
- The world Canvas is wrapped in GraphicsGuard (src/game/webgl-support.ts probe): no WebGL, context loss, or no frames shows GraphicsError; Safari gets capped DPR, hard shadows, no post-processing. Why: Safari failures otherwise leave a black canvas.
- Weather is a deterministic per-region front cycle in src/game/weather-cycle.ts sampled from the day clock; Scene applies it to light/fog/particles. Why: every client agrees on weather without syncing.
- Enemy awareness (patrol/suspicious/alert/search, cover) is a pure state machine in src/game/enemy-perception.ts driven by sim.ts. Why: detection rules stay testable apart from movement.
