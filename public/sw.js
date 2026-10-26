/* WORLD FRACTURE offline cache (hand-written, no build plugin). Hashed bundles (/assets/) are cached for good; game files that keep
 * their URL (models, audio, textures, fonts, maps) are served from cache and refreshed in the background, so a replaced model shows up
 * on the next load; pages try the network first and fall back to the last copy. Anything else (API, server functions, other sites,
 * partial/Range requests such as streamed audio) is never touched. Bump VERSION to drop every old cache. */
const VERSION = "wf-offline-v2"; // v2: drop the cached transmission-glass car models
const HASHED = ["/assets/"];
const KEPT = ["/models/", "/textures/", "/audio/", "/fonts/", "/maps/", "/menu/", "/refs/"];
const NEVER = ["/api/", "/_serverFn/", "/sw.js"];

/** "cache-first" | "stale-while-revalidate" | "page" | "bypass" */
function strategyFor(url, method, mode, hasRange, origin) {
  if (method !== "GET" || hasRange || url.origin !== origin) return "bypass";
  const p = url.pathname;
  if (NEVER.some((n) => p === n || p.startsWith(n))) return "bypass";
  if (HASHED.some((h) => p.startsWith(h))) return "cache-first";
  if (KEPT.some((k) => p.startsWith(k))) return "stale-while-revalidate";
  return mode === "navigate" ? "page" : "bypass";
}
const cacheable = (res) => res && res.status === 200 && res.type === "basic";

if (typeof module !== "undefined") module.exports = { strategyFor, VERSION };

if (typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self) {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("wf-offline-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  ));
  self.addEventListener("fetch", (e) => {
    const r = e.request;
    const s = strategyFor(new URL(r.url), r.method, r.mode, r.headers.has("range"), self.location.origin);
    if (s === "bypass") return;
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(r);
      if (s === "cache-first") {
        if (hit) return hit;
        const res = await fetch(r);
        if (cacheable(res)) cache.put(r, res.clone());
        return res;
      }
      if (s === "stale-while-revalidate") {
        const refresh = fetch(r).then((res) => { if (cacheable(res)) cache.put(r, res.clone()); return res; });
        if (hit) { refresh.catch(() => {}); return hit; }
        return refresh;
      }
      try {
        const res = await fetch(r);
        if (cacheable(res)) cache.put(r, res.clone());
        return res;
      } catch {
        return hit ?? (await cache.match("/")) ?? new Response("WORLD FRACTURE is offline and this page was never opened online on this device.", { status: 503, headers: { "content-type": "text/plain" } });
      }
    })());
  });
}
