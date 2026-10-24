# Radio spoiler review

The owner's instruction for radio content was "remove any spoilers". This review covers everything the in-game radio can play: the Fracture FM episodes 01-08, every commercial and every station ID. Each item is judged from its script, since the audio was not listened to. The audio was synthesised from these scripts, so the two should match, but nobody has checked by ear.

## What counts as a spoiler

A line is a spoiler if it gives away story the player may not have reached yet. That covers:

- **Boss identities and secret encounters.** Vyrak is a hidden encounter. Its lair in Solara has no marker until two clues are found (`vyrak-site.ts`), and beating it bonds a Wyrmling to the Operator (`dragon-covenant.ts`). The game's other dragon, Vaelith, is a story scenario in Ember Peaks. So any mention of a dragon in the world, especially in Solara or near a volcano, points at those encounters. The same applies to Subject Zero, Overseer Kael, Kraken-Vanguard, Aegis-Prime, the Fuel King and the Storm Islands.
- **The simulation reveal.** Late in the story the player learns that the regions are layers of a failing simulation stack, and that NOVA is part of the Deepmind (`missions/core-node.ts`). Lines where people in the world describe their reality as generated software count as hints of that reveal: "procedurally generated", rebooting a living thing, rent converted to experience points.
- **Late missions, faction-choice outcomes and endings.**

The following are fine:

- The premise from the opening cinematic: reality split, Fracture zones, portals, other dimensions, time running oddly.
- Region names shown on the map from the start: Nexus, Neon, Solara, the Wastelands.
- Operator classes, and everyday "Operator" words such as boss fight and quest log.
- Comedy about city life, plus disclaimers that say nothing is known.

## Decisions

| Item | File | Decision | Reason (spoiling line, or why it is safe) |
| --- | --- | --- | --- |
| Off the Rails · Episode 1 | fracture-fm-episode-01.ogg | **OFF** | "A Titan has been fined for parking a dragon in a compact space." This reveals the hidden dragon and that an Operator can keep one (the Vyrak Wyrmling bond). The line "if your quest marker disappears, you are probably the side quest" is also a fourth-wall joke. |
| Episode 2: Pothole Protection | fracture-fm-episode-02.ogg | **OFF** | "A giant dragon has blocked the Solara highway." This gives away Vyrak's hidden Solara lair. The episode also mentions Dragonite, the material Vyrak drops. |
| Episode 3: Wasteland Mechanics | fracture-fm-episode-03.ogg | **ON AIR** | Covers a junk mechanic, a bakery whose time runs backwards inside a Fracture zone (opening premise), a Titan using a shield as a parking space, and an invisible car. No bosses, secrets or reveals. |
| Episode 4: The Dragon Parking Ticket | fracture-fm-episode-04.ogg | **OFF** | "A dragon has received a parking ticket in Solara Desert." This is Vyrak's location. It also includes dragon insurance, "a decorative window in a volcano" and "Please do not attempt to reboot wildlife", a hint at the simulation reveal. |
| Episode 5: The Dungeon Landlord | fracture-fm-episode-05.ogg | **OFF** | "Rising rent in procedurally generated dungeons" and "Your security deposit has been converted to experience points." People in the world call it generated content, which hints at the simulation reveal. |
| Council Hotline (06) | fracture-fm-episode-06.ogg | **ON AIR** | Transit, streetlights and warning signs. It says outright: "no official cause of the Fracture has been established... We will not speculate." |
| Faction Open Line (07) | fracture-fm-episode-07.ogg | **ON AIR** | Neighbourhood groups arguing over a bridge and a bakery. It tells listeners not to treat rumours as facts and names no leader, base or battle. |
| Fracture Weather Watch (08) | fracture-fm-episode-08.ogg | **ON AIR** | Unconfirmed lights and a spinning compass. "The government has not released a definitive explanation of the Fracture." |
| Nexus Noodle Express | ads/nexus-noodle.ogg | **ON AIR** | Noodles after a "twelve hour boss fight", with no delivery into Fracture zones. Generic. |
| WyrmShield Insurance | ads/vyrak-insurance.ogg | **OFF** | "Has a dragon landed on your vehicle?... mysterious glowing ash". This reveals the dragon and echoes Vyrak's title, the Ashen Covenant. The file is even named after Vyrak. |
| Portal Mart | ads/portal-mart.ogg | **ON AIR** | Batteries, mystery keys, energy cells "of unknown origin". Generic. |
| Nexus Transit Authority | ads/nexus-transit.ogg | **ON AIR** | "Platform seven is temporarily in another dimension." Opening premise only. Nexus is the starting hub. |
| Rusty Ride Motors | ads/rusty-ride.ogg | **ON AIR** | Wasteland cars with three working tyres. The region name is shown on the map from the start. |
| Public Safety Office | ads/fracture-safety.ogg | **ON AIR** | Follow posted advisories. No cause or secret is named. |
| Market Mile | ads/market-mile.ogg | **ON AIR** | Food, tools, neighbours. |
| Circuit Cafe | ads/circuit-cafe.ogg | **ON AIR** | Wi-Fi "occasionally in another dimension". Opening premise only. |
| Patchwork Repairs | ads/patchwork-repairs.ogg | **ON AIR** | Armour and engine repairs. |
| Nexus Community Board | ads/community-board.ogg | **ON AIR** | Meeting notices and volunteer drives. |
| Station IDs (all 7) | ids/*-id.ogg | **ON AIR, unscripted** | **No script exists** for any station ID. Each is a clip of about 5 seconds titled "Station ID" for its station (stage 47: "short station ID audio clips"). The title and length are clearly harmless, so they stay on air. They have not been checked by ear. |

The embedded "Questionable Repairs" ad inside Episode 1 is harmless, but it goes off air with the episode.

### Songs (outside the requested scope, checked for completeness)

- The on-air vocal mixes are Burn the Horizon, Electric Tomorrow and Island Signal (lyrics in `RADIO_VOLUME_2_LYRICS.md`). They contain only generic imagery (city lights, broken sky, ocean) and no story.
- The instrumentals have no words.
- The Kinggg Dream songs are the owner's own recordings and are not about the game's story. There are no lyric sheets for them in the repo.

## In code

- `src/game/radio-stations.ts`: `STATION_TRACKS.comedy` holds episodes 03, 06, 07 and 08. The spoiling episodes 01, 02, 04 and 05 are in `FRACTURE_FM_ARCHIVE`, and WyrmShield is in `RADIO_ADS_ARCHIVE`. Each archived item has a `withheld` reason. The files stay in `public/audio/radio`.
- `src/game/radio-stations.test.ts`: the "spoiler review" tests pin the off-air set. They check that no station list, ID or ad holds an off-air file, and they run every station through 200 broadcast steps (IDs, programs and ad breaks) to show none ever airs.
- An archived episode only goes back on air after it is re-recorded without the spoiling line, and after this table and the test's `SPOILERS` list are updated.

This supersedes the broadcast policy in `STAGE49_SPOILER_SAFE_RADIO.md`. That document said Episode 1 and WyrmShield were held back, but the code still aired both.
