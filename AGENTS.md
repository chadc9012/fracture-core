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

- Game rules (pure logic modules, Scene wiring, assets, saves) live in src/game/AGENTS.md; read it before changing gameplay. Why: keeps this file small.
- Gameplay rules are pure, testable modules in src/game/*; Scene/components only forward input and draw. Why: deterministic and testable apart from rendering.
- Progression syncs to player_saves with additive merges; never add a second persistence system. Why: progress is only gained.
- Any 3D asset must be verified and fail silently to a fallback. Why: one failed model can suspend the whole scene.
- Test files import "bun:test", typed by src/types/bun-test.d.ts. Why: the typecheck has no bun types.
