# Story scenarios (batch 1: shared story layer + Vaelith)

Status key: **Implemented** (code) / **Tested** (bun test) / **Browser** (NOT verified - no browser in the build environment).

## Shared story layer - `src/game/story.ts`
Pure data + reducers, persisted as `progression.story` (flags, decisions, per-character trust, per-scenario stage, collectibles).
- Branching graphs: `DialogueGraph` -> nodes -> choices with `requires` conditions and `effects` (flag / choice / trust / stage / collect).
- Effects apply once per `graph:node[:choice]` (recorded as a `once:` flag): replaying a conversation never farms trust.
- A decision key keeps its first value; stages only move forward; trust is clamped 0..100.
- Save: `normalizeProgression` sanitises it (old saves get an empty story); `mergeProgression` -> `mergeStory` (flags/collectibles union, trust max, furthest stage, newer copy wins decisions).
- UI: `StoryDialogue.tsx` (keyboard + standard-mapping gamepad, never blocks play, Esc/B skips and applies nothing further). Existing linear `DialogueOverlay` is untouched.

## The Dragon Who Remembers - Vaelith (`src/game/vaelith.ts`, Ember Peaks)
Flow: Ashen Gate talk -> First Trial (encounter director, non-lethal) -> truth talk -> 3 memories (proximity pickups) -> lair defence (existing mission drones) -> artifact choice (preserve / destroy) -> alliance talk -> rewards.
- Encounter (`scenario-encounters.ts` "vaelith"): sweeping flame (cone), wing gust (circle), aerial dive (lands on your snapshot position), volcanic shockwave (arming ground zones). Every attack: tell, range, geometry hit test via `hurtPlayer`, recovery, weak-point window. At 40% hp a **truce** starts: no more attacks, hp cannot fall below a floor, damage can never kill it, and after 20 s it withdraws (no kill, credit, drops or claim). Dying mid-trial resets it.
- Trust ladder: Hostile 0 / Wary 10 / Allied 40 / Bonded 80. Sources: kind/hostile choices, trial survived (+10), each memory (+10), lair defence (+10), artifact choice (+15 preserve / +10 destroy), alliance oath. Minimum route still reaches Allied; Bonded needs the kind route (tested).
- Rewards (existing validated claim path, stable run ids `story:vaelith:alliance` / `story:vaelith:bond`; nothing is granted by killing the dragon): Dragonheart Plate (chest, legendary) + Ember Lance (primary, exotic) on alliance; Dragon-Scale Mantle (class item, legendary) + `cosmetic:dragon-bond` flag when Bonded. Destroying the artifact additionally pays 150 fracture shards once; preserving it grants the `relic:ember-heart` collectible.
- Companion (`callVaelith`): Allied/Bonded only, outdoors, not inside any scenario boss arena, 90 s cooldown (x0.7 Bonded, +50% damage Bonded), aerial strike (3 nearest) or fire breath (cone), damage through the shared `applyMachineDamageMods`, never hurts the player or hits decoys.

### Not done / limits (Vaelith)
- **No dedicated dragon model** (procedural stand-in), no dragon animation, no voice/cinematics; the cosmetic is only a saved flag (no cosmetic renderer exists).
- The companion has **no key/pad binding or VFX yet** (API + tests only).
- No dragon riding / free flight (no mount framework).
- Memory and artifact locations have objective text but no map markers yet.
- Lair defence uses all live `mission` machines; an unrelated active mission wave would also hold it open.
- Browser: nothing above has been run. The scene wiring (lair entry, memory pickups, truce -> dialogue, defence) and `StoryDialogue` are unverified in a browser.

## Not started in this batch
Unbroken Glass / System Core story expansion, Dark Knight / Rime Alpha / Drowned Monarch / Hollow Saint dialogue and story choices (encounters exist; no dialogue graphs yet), Nhal'Zareth (the Demon World), private-fireteam access (no fireteam/server layer exists; local single-player only).
