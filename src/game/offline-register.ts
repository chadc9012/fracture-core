/** When to install the offline service worker (public/sw.js). Skipped in dev, inside an iframe, and on Lovable's editor preview
 * hosts, where a cache that outlives a code change would show stale builds. Pure so it is testable; registration is in __root.tsx. */
export function shouldRegisterServiceWorker(env: { prod: boolean; hasServiceWorker: boolean; inIframe: boolean; hostname: string }): boolean {
  if (!env.prod || !env.hasServiceWorker || env.inIframe) return false;
  return !/(^|\.)lovableproject\.com$|^id-preview--/.test(env.hostname);
}
export function registerOfflineCache(): void {
  if (typeof window === "undefined") return;
  // The Android app ships every file inside the APK, so it has nothing to cache offline, and a worker left from an older build kept
  // serving that build's models (the transmission-glass cars that blanked Nexus City) after an update. Inside the app: remove any
  // worker and its caches, and reload once if there was one so this launch runs on the APK's own files.
  if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) { void dropOfflineCache(); return; }
  let inIframe = true;
  try { inIframe = window.self !== window.top; } catch { /* cross-origin parent counts as an iframe */ }
  const ok = shouldRegisterServiceWorker({ prod: import.meta.env.PROD, hasServiceWorker: "serviceWorker" in navigator, inIframe, hostname: location.hostname });
  if (ok) void navigator.serviceWorker.register("/sw.js").catch(() => { /* offline cache is optional */ });
}

async function dropOfflineCache(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = typeof caches !== "undefined" ? (await caches.keys()).filter((k) => k.startsWith("wf-offline-")) : [];
    await Promise.all(keys.map((k) => caches.delete(k)));
    if ((regs.length || keys.length) && !sessionStorage.getItem("wf-sw-dropped")) { sessionStorage.setItem("wf-sw-dropped", "1"); location.reload(); }
  } catch { /* nothing cached */ }
}
