# Stage 46 — Linear Radio, Commercial Breaks and Now Playing

Built-in radio stations are **linear broadcasts**: no skipping or shuffling. Tracks/episodes play through to completion. After every two complete programs, the station airs one original fictional commercial; ads rotate through five spots. An ad is never inserted mid-song. After the spot, playback continues with the next song or episode.

Added five original scripted, synthesized spoken commercials: Nexus Noodle Express, WyrmShield Insurance, Portal Mart, Nexus Transit Authority, and Rusty Ride Motors. All brands are fictional. Commercials are in `public/audio/radio/ads/`. They are demo voiceovers, not professional voice acting.

The station selector now shows the current song or commercial using `wf-radio-now-playing` events. No skip/shuffle buttons were added to built-in radio. The existing **My songs** player still has its own behavior, and Spotify/Apple Music integration remains external/not implemented. This update does not introduce their APIs.

Caveat: playback depends on Web Audio initialization and browser autoplay policies. The project has not passed a full Vite build or browser listening test. Ad breaks currently count songs completed during a station session and reset when the station is restarted.
