# Reference features brief: ideas pulled from the shared screenshots

Source: the screenshots shared on 2026-10-10 (Destiny 2 wiki mission chart, Polygon "Captis" HUD capture, Instagram character/subclass screens, Behance "Destiny 2 UI + Visual Design" boards) and the World Fracture NPC/enemy concept sheet. These are **structure and usability references only**. Do not reuse Destiny's fonts (Neue Haas Grotesk is licensed), emblems, icons, names or art; build our own in the World Fracture style.

**Status: a backlog, nothing here is implemented.** Per the current priority order (forest verification -> Nexus -> transitions -> map), these wait until the build is stable and browser-verified. "Exists" below means a module exists in the repo, not that it was browser-checked.

## 1. HUD (Polygon capture, Behance "HUD elements")
| Idea seen | What it does for the player | Where it would land | Risk |
|---|---|---|---|
| Rank-coded enemy bars: base, elite, miniboss, ultra; segmented bars for tougher ranks; a pinned top-centre boss bar | Reads threat at a glance; segments show phases/poise | HUD.tsx reading existing enemy rank + `boss-phases.ts`/`boss-poise.ts`; presentation only | Low (read-only of sim state) |
| Left-side status timer list (buff/debuff name + seconds) | Shows what is active (armor/ability effects, cooldowns) | New HUD list fed by `abilityHud(live)` and `loadoutEffects()` | Low |
| Objective banner (mission title + current step, checkbox) | Clear "what now" | QuestTracker.tsx already exists: restyle only | Low |
| Radar with enemy cone/alert state | Awareness cue that matches `enemy-perception.ts` (patrol/suspicious/alert/search) | Minimap.tsx: colour enemy blips by awareness state | Medium (must not leak info the AI doesn't give) |
| Floating damage numbers (crosshair shows total) | Combat feedback | CombatFx reads sim events; optional setting | Low, make it a setting (off for reduced motion) |
| Level-up / "new ability unlocked" banner; medal and pickup stack | Reward feedback without menus | LevelUpOverlay.tsx exists; add pickup stack | Low |
| Round timer / activity score strip | Used for timed encounters | Only if we add timed activities | Defer |

## 2. Character, inventory and item screens (Instagram, Behance)
- Character screen with armor slots down both sides of the operator, power number top-right, and three stat bars (Mobility / Resilience / Recovery) beside it. Ours already derives Defense/Mobility/Intellect from `armorSummary`; the layout idea is slot columns flanking the 3D operator in the forge Gear tab.
- Capacity counters on inventory groups ("Consumables 19/50", "Engrams 04/10"): add counts to InventoryWindow sections; needs a decision on caps (a progression rule, so it needs your approval; no caps added by default).
- Item detail card: name, level/type, big attack number, stat bars (impact/range/stability/handling), perk rows with icon + one-line text, and a three-button footer (Lock / Details / Equip). Maps to our weapon/armor `perk` and `rarity` fields in the inventory.
- Rarity colour banding on item headers (purple/gold headers): we already have `rarity`; use it for header colour.

## 3. Class and subclass screens (Behance, Instagram)
- Class select: three tall banners (emblem shield, class name, one-line flavour). Ours: NYX / GOLIATH / CIPHER with the existing lineup art; the banner + one-line pitch pattern is cheap.
- Subclass tree: central super-ability diamond, grenades/class ability/movement clustered around it, "Path A / Path B" with four visual states (locked, available, active, inactive) and an upgrade-points counter. Maps onto our ability branches (Power / Control / Utility in `branch-effects.ts`); the four-state node styling is the useful part. Rules stay in the existing pure modules.
- Subclass lore card: order name, a one-line creed, two path descriptions. Good home for each Operator's identity text.

## 4. Typography and layout (Behance spec board)
Hierarchy worth copying (not the typeface): wide-tracked uppercase titles, a very large bold sub-screen header, medium-weight tooltip headers, small italic descriptions, and a fixed minimum body size. Check our `ui-kicker` and mono headers against a simple scale (title / header / body / caption) and set minimum sizes; the in-game screenshots show 8-9 px captions that would be hard to read.

## 5. Activity structure (wiki mission chart)
The chart groups content into columns by type (social hubs, story missions, strikes/dungeons, arenas, PvP) with level gates and branching chains. Take the idea, not the content:
- An **activity taxonomy** for our own chronicle/retention rules (story chain `fd-01..fd-18`, region dungeons, scenario bosses, side contracts, free roam) shown as a single "journey" page.
- A level/power gate label on each node, using existing power bands (80/95/110/125).
- Lives in `retention.ts` / `CHRONICLE` data and the star map's sector intel; no new quest framework.

## 6. Factions, NPCs and shops (our concept sheet)
- Regional factions: Raiders (Wastelands), Overclocked (Nexus), Vanguard (Frostspire), Aberrations (Swamps), each with Regular / Elite / Boss looks and combat roles (frontline, ranged, assault, support, special). Check against `encounters.ts`, `enemy-visuals.ts` and `enemy-intelligence.ts` before adding anything; Verdant and Ember/Solara factions are not on the sheet.
- Shopkeepers: six distinct models by trade plus per-region styles. `regional-shops.ts` and `ShopStalls.tsx` exist; distinct *models* would need GLBs (none can be generated here).
- 33 civilian faces/voices: `civilians.ts` holds a smaller authored list; faces/voices are asset work.

## 7. Screenshot / capture list for the next reference pass
So the next session can compare like with like:
1. Destiny: the Director/map screen, a fast-travel / drop-in transition, an activity loading card, the loot-pickup stack, and the enemy nameplate close-up (for the transit and HUD work).
2. Our game, same screens: forge Gear tab, inventory, quest tracker, in-combat HUD at 1080p, and the star map Terrain view.
3. Our F3/F4 captures per `docs/forest-perf-protocol.md` (still outstanding and the gate for everything above).

## 8. Second reference batch: results, death, vendors, vaults, emblems (Behance UI sets)
Ideas only. Do not reuse the source fonts, icons, emblems or names; all art must be original. Nothing here is implemented.

- **Activity results screen.** Victory banner, a per-player scoreboard (kills / assists / deaths / score), a team-results panel and a rewards row. Our `VictoryReport.tsx` exists; the layout idea is banner on top, stats in the middle, reward chips along the bottom. Rewards stay on the existing idempotent claim ledger; the screen only displays what was already granted.
- **Death screen.** Short line, a restart reason and "restarting from last checkpoint". Ours: copy and layout for the death overlay on top of `respawn.ts`; it must never change where the player respawns (calm safe ground only).
- **Faction reputation vendor.** A vendor page with a rank bar, a progress-to-next-rank number and a grid of items gated by rank. Fits `regional-shops.ts`. A reputation system would be new progression state, so it needs your sign-off before any work; for now only the layout is noted.
- **Vault grid.** Paged grid of item tiles with a capacity counter. Same caveat as the inventory caps in section 2: a cap is a progression rule and needs your decision.
- **Emblems and rank icons.** Tiered rank badges (a shape, a tier count, a colour). Could drive original operator banners and profile cards; needs original art, none can be generated here.
- **Character select.** Three tall class panels, which matches the class banner idea in section 3.
- **Weapon / armor detail cards.** Perk icons with one-line text, stat bars, rarity header colour. Same as section 2; tooltips follow the typography scale in section 4.
- **Director / destination map.** A planet-style node map with named destination cards and a recommended-activity highlight. Our star map already has region hotspots, a Recommended marker and city chips, so the extra idea is an activity list under each destination card.

Order: these all sit behind the same gate as the rest of this brief (F3/F4 forest readings first, then Nexus, then transit completion, then map finalization). Result, death and detail-card layouts are presentation only and can come first; reputation, vault caps and ranks are progression changes and wait for your approval.

## Suggested order once the gate passes
1. Presentation-only HUD polish: rank bars, status timer list, damage-number setting.
2. Typography scale and minimum sizes.
3. Item detail card and capacity counters (after a decision on caps).
4. Subclass node states and lore cards.
5. Activity "journey" page.
Anything that changes rewards, caps or progression rules needs your sign-off first.
