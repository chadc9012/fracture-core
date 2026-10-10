# Aerial Warfare - Phase A audit (no flight code written yet)

| Capability | Exists? | Evidence |
|---|---|---|
| Vehicle definitions incl. air craft | Data only | `vehicles.ts`: `rift-helicopter`, `vanguard-jet` (domain AIR), `void-skimmer` (SPACE), `ai-interceptor`; all reuse the `race_future` model key |
| Flight model (throttle/pitch/roll/lift/drag) | **No** | no altitude/pitch for vehicles in `sim.ts`/`Scene.tsx`; vehicle movement is ground-style (heightAt-following) |
| Aircraft entry/exit | Generic vehicle entry only | no flight-specific state |
| Aerial camera / flight input / rebinding | **No** | bindings cover on-foot + ground vehicles |
| Air projectiles, lock-on, missiles, flares, countermeasures | **No** | bullets are ground/player projectiles; no lock or incoming-missile model |
| Enemy air AI | **No** | `enemy-perception.ts` + `sim.ts` machine AI is ground-only |
| Air mission framework | Missions are on-foot state machines (`missions/*`); hidden-scenario framework = `unique-scenarios.ts` lairs |
| Aircraft models / animation | **None** | `public/models` has operators + 2 boss GLBs only |
| Equipment slots for aircraft (frame/engine/weapons/modules) | **No** | `GearSlot` includes only `vehicle`; no aircraft loadout in `progression` |
| Checkpoints / respawn / save slots / cloud merge | Yes, reusable | `respawn.ts`, `save-slots.ts`, `cloud-save.ts` |

Conclusion: aerial warfare needs a new, self-contained flight foundation (flight model, input mapping incl. pad, camera, boundary recovery, air weapons, air AI) before any mission is meaningful. Per the spec's own build order this is Phase A and must be proven for feel in a real browser before missions are built; that cannot be done in the current environment (no browser, no build). Nothing aerial has been implemented or claimed.
