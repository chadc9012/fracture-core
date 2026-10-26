/** The world clock's pace (Scene: time is the day fraction 0..1, 0.36 = 08:38 at the start).
 * Owner, Oct 26 2026: the day ran in ~125 s (0.008 a second), so most of a session was night. A 24-minute day keeps every
 * phase of the sky board (dawn, morning, noon, afternoon, sunset, dusk, night) on screen for minutes, as in GTA-style days.
 * The Unreal port's environment core keeps the same rate (WFEnvironmentCore.h DayRate). */
export const DAY_SECONDS = 24 * 60;
export const DAY_RATE = 1 / DAY_SECONDS;
