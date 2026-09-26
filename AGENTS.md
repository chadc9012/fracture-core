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
