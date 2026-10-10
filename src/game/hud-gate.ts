/**
 * HUD report gate. Scene reports a HUD snapshot about every 0.18 s, and every report re-renders GameCanvas and
 * (because its props are inline) Scene. Measured on an Intel iGPU Mac standing still: ~10 Scene renders/s.
 * The gate drops a report when the snapshot is identical to the last one sent, but always lets one through
 * after `maxQuietMs` so anything on the HUD that animates from the clock cannot go stale for long.
 * Pure (time is passed in) and never throws: if a snapshot cannot be serialised it is always sent.
 */
export function createHudGate(maxQuietMs = 500) {
  let lastKey: string | null = null;
  let lastAt = Number.NEGATIVE_INFINITY;
  return (snapshot: unknown, nowMs: number): boolean => {
    let key: string;
    try { key = JSON.stringify(snapshot); } catch { lastKey = null; lastAt = nowMs; return true; }
    if (key === lastKey && nowMs - lastAt < maxQuietMs) return false;
    lastKey = key; lastAt = nowMs;
    return true;
  };
}
