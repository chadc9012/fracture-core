# Living World: Nexus City and Neon City

The two cities are separate places with their own districts, factions, NPCs, patrols and events. Nothing about one city's standing changes the other's.

## Factions and standing
| City | Faction | Notes |
|---|---|---|
| Nexus | Nexus Wardens | civic security; runs Nexus Armory and Bastion Fittings |
| Nexus | Arcology Guild | merchants and smiths; runs Calibration Range and Field Outfitter |
| Neon | Neon Syndicate | Undercity fixers; runs Neon Street Dealer and Glitch Mods; rival of Aegis |
| Neon | Aegis Directorate | the Spire authority; rival of the Syndicate |

Standing runs from −100 to 100: Hostile (≤ −40), Wary, Neutral, Trusted (≥ 20), Honored (≥ 55).
- Hostile: the faction's shops refuse trade, and its patrols warn you once and then open fire.
- Wary: prices ×1.25. Neutral: ×1. Trusted: ×0.9. Honored: ×0.8.
- In Neon City, helping one side costs half that much standing with the rival.

Standing is saved as two counters per faction (gained and lost). Both only grow, so a cloud merge takes the larger of each and never loses anything.

## Districts
- Nexus City: Spire, Market, Shipyard and Arcology.
- Neon City: Aegis Spire, Undercity, Neon Market and The Grid.
- Winning an invasion or a roaming-boss fight secures the district for 2 days, which gives 10% off at its shops.
- Losing one makes the district fall, which closes its shops until you win it back. The event director sends a retake invasion to a fallen district about 45 s after you enter that city.

## NPCs (talk with Y)
- **Nexus City:**
  - Commander Hale (Wardens leader)
  - Sergeant Vos (contracts)
  - Ines Varo (Guild leader, contracts)
  - Whisper (informant)
- **Neon City:**
  - Madame Kiro (Syndicate leader)
  - Patch (contracts)
  - Director Thorne (Aegis leader)
  - Lt. Moreau (contracts)
  - Static (informant)

Contracts only progress through play:
- **CULL:** kills inside that city.
- **DEFEND:** world events won in that city.
- **DELIVER:** materials handed in.
- **SURVEY:** walking to the marked point.

Informants sell intel. Each piece reveals a stash with a beacon, and the stash opens once when you reach it.

Leaders offer three things:
- A one-time Neon pledge, which needs Trusted standing: +20 with the chosen side, −25 with its rival, and it is permanent.
- A commendation at Honored standing, paid once.
- A way to make amends while Hostile: 20 scrap metal for +30 standing.

## World events (only inside a city, never during scripted missions, the tutorial or interiors)
| Event | What you do |
|---|---|
| Invasion | Clear the wave before the timer runs out. The district falls if you lose. |
| Distress call | A short timer to clear 3 attackers. |
| Roaming warlord | Aegis-Prime on the city edge. The district falls if you lose. |
| Smuggler convoy | Stop the escorts. In Neon City this pleases Aegis and angers the Syndicate. |
| Reality fracture | Stand inside the violet ring for 25 s while aberrations spawn. |

- **Winning** needs at least one kill by the player. It pays standing, materials and shards once per event id.
- **Leaving the city** (more than 80 m past its edge) fails the event.
- **Hub turrets** ignore event machines; city patrols fight them with support damage and get no kill credit.
- **Civilians** run from hostiles inside the city and cower until things have been quiet for 6 s.

## Testing
- `src/game/living-world.test.ts`: rules.
- `src/game/living-runtime.test.ts`: the real sim.

Dev aids (`?dev=1`, test profile):
- `__dev.livingNow()` starts an event.
- `__dev.living()` shows the current event state.
- `__dev.livingKill()` kills the current event's hostiles as the player.
