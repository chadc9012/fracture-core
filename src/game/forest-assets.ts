/* Asset load report for the Verdant Forest. Every GLB the forest wants registers here as loading,
 * then ok or failed, so a missing file is reported instead of silently leaving an empty world.
 * Pure store (no React); GameCanvas shows it through useSyncExternalStore. */
export type AssetStatus = "loading" | "ok" | "failed";
export type AssetSummary = { total: number; ok: number; loading: number; failed: string[]; settled: boolean };

const items = new Map<string, { label: string; status: AssetStatus }>();
const subs = new Set<() => void>();

export function summarize(entries: Iterable<{ label: string; status: AssetStatus }>): AssetSummary {
  let total = 0, ok = 0, loading = 0;
  const failed: string[] = [];
  for (const e of entries) {
    total++;
    if (e.status === "ok") ok++;
    else if (e.status === "failed") failed.push(e.label);
    else loading++;
  }
  return { total, ok, loading, failed, settled: total > 0 && loading === 0 };
}

let snapshot: AssetSummary = summarize([]);

export function reportAsset(id: string, label: string, status: AssetStatus) {
  const prev = items.get(id);
  // a settled result is never downgraded back to "loading" by a remount
  if (prev && prev.status !== "loading" && status === "loading") return;
  if (prev?.status === status) return;
  items.set(id, { label, status });
  snapshot = summarize(items.values());
  if (status === "failed" && typeof console !== "undefined") console.warn(`[forest] asset failed to load: ${label}`);
  for (const fn of subs) fn();
}

export const getAssetSummary = () => snapshot;
export function subscribeAssets(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }
export function resetAssetReport() { items.clear(); snapshot = summarize([]); for (const fn of subs) fn(); }
