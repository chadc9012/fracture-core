# World Fracture Radio — First Original Recorded Tracks

Four original, synthesized instrumental recordings are included in `public/audio/radio` and connected to the existing radio selector.

| Station | Track | Style | Approximate duration |
| --- | --- | --- | --- |
| Block Signal | Block Signal | Hip-hop | 31 s |
| Rust Riot | Rust Riot | Rock | 22 s |
| Neon Frequency | Neon Frequency | House / EDM | 23 s |
| Island Relay | Island Relay | Dancehall / Reggae | 29 s |

These are short looping **instrumental radio tracks**, not fully produced vocal songs. All music was generated from original synthesis code without sampling commercial recordings.

`startRadio()` now streams the corresponding local Ogg file via an HTML audio element into the existing Web Audio mix and loops it until the station is stopped. The previous procedural synthesizer remains in the source as a fallback if the HTML Audio constructor is unavailable. Browser playback, bundling and production build have not been verified. User interaction may be required to unlock playback.

Next: develop full-length song arrangements, optional original vocals, station IDs, DJ segments, and a per-station track rotation.
