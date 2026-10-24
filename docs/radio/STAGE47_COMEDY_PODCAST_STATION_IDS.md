# Stage 47 — Comedy Podcast & Station DJs

**New audio:** Off the Rails Episodes 2 and 3 (original fictional scripts, synthetic voice actors), plus seven original station ID audio clips. Each station now starts with a short station ID, then plays its full songs or episodes without skip or shuffle. Comedy rotates Episodes 1, 2 and 3. Commercials remain scheduled between every two complete programs, never interrupting a song.

**Audio fix:** The built-in radio is now connected to the master audio bus rather than the music bus. The existing radio player calls `setExternalMusic(true)` to mute procedural background music, so the old routing could silence the radio itself. The radio gain uses the current `musicVol` value at start. This is a source-level fix, not a browser-verified playback result.

**Known limitations:** The radio does not dynamically follow music-volume changes mid-track; changing settings can restart the station via the player. Podcast voices are offline synthetic narration, not professional performances. Station IDs play at the start of each tuning session, not before every track. No full Vite build or browser test has been completed.
