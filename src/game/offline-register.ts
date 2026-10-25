/** When to install the offline service worker (public/sw.js). Skipped in dev, inside an iframe, and on Lovable's editor preview
 * hosts, where a cache that outlives a code change would show stale builds. Pure so it is testable; registration is in __root.tsx. */
export function shouldRegisterServiceWorker(env: { prod: boolean; hasServiceWorker: boolean; inIframe: boolean; hostname: string }): boolean {
  if (!env.prod || !env.hasServiceWorker || env.inIframe) return false;
  return !/(^|\.)lovableproject\.com$|^id-preview--/.test(env.hostname);
}
export function registerOfflineCache(): void {
  if (typeof window === "undefined") return;
  let inIframe = true;
  try { inIframe = window.self !== window.top; } catch { /* cross-origin parent counts as an iframe */ }
  const ok = shouldRegisterServiceWorker({ prod: import.meta.env.PROD, hasServiceWorker: "serviceWorker" in navigator, inIframe, hostname: location.hostname });
  if (ok) void navigator.serviceWorker.register("/sw.js").catch(() => { /* offline cache is optional */ });
}
