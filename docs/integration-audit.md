# Entry-game integration audit (static; the game could not be launched in this sandbox)

Method: import-graph reachability over `src/` (372 non-test source files), button-handler scan of `src/components/game`, and a read of the GameCanvas phase machine. Nothing below is browser-verified.

## Entry flow (EXISTS, wired in GameCanvas)
boot (BootSequence, once per session) -> title (MainMenu: Continue / New Game / Character / Settings / Credits) -> hub or loadout (StartMenu: class, subclass, appearance, body type, gear per slot) -> briefing (DeploymentBriefing) -> world (Scene, NOVA tutorial, first mission, quest chain, HUD, inventory, map, settings, save slots, cloud save / guest local save). Replay of fd-01..fd-18 from emitted events is covered by quest-progression.test.ts (unit level only).

## Reachability findings
| Item | Finding | Action |
|---|---|---|
| Orphan UI: TitleScreen, TitleBackdrop, OperatorPreview | Legacy title path replaced by MainMenu; imported nowhere | left in place, noted |
| `gear-evaluation.ts` (grade / verdict / attribute delta) | Implemented, untested, **not shown anywhere** | wired into the inventory detail panel (`GearEvaluation.tsx`), tests added |
| `terrain-refine.ts` | Unused by design: chunked ground (1.5 m LOD0) replaced the single plane (docs/world-scale.md) | none needed |
| `population.ts` (33 civilian profiles, shop keepers, enemy rosters) | Pure data, imported nowhere; the boards are concept art, no distinct face models exist | not wired: wiring would imply content that is not there |
| `nature-models.ts` | Superseded by PolyFoliage | left in place |
| Buttons without a handler in src/components/game | none found | - |
| World load: Suspense fallback was `null` (blank canvas while the scene resolves) | missing loading state | `WorldLoading.tsx` (status text; after 15 s offers Reload) |
| `phase === "briefing"` with no pending deployment fell through to the world canvas | missing recovery | effect returns to character setup |

## Cities and assets (honest)
- NeonCity.tsx, NexusCity.tsx, DistrictStreet.tsx, Thalassia.tsx are fully procedural (box/primitive architecture, emissive materials, animated transit). There are **no city GLB/GLTF models** in the repo or in `public/models` (only operators and two bosses) and none are referenced by URL. Real building models therefore cannot be integrated without sourcing assets; the sandbox cannot reach any asset host. Neon City and Nexus remain separate cities.
- Forest GLBs and HDRIs are hosted externally, HEAD-verified at runtime with silent fallbacks.

## Not done in this pass
Production build, browser launch, controller, audio and every visual claim: blocked by the unreachable npm registry (`bun install` ConnectionRefused, empty node_modules).
