/**
 * Kill Playlist: the player's own songs, stored on this device (IndexedDB), played while fighting.
 * playlistShouldPlay is the pure rule; the DOM player in KillPlaylist.tsx applies it.
 */
export type PlaylistMode = "COMBAT" | "ALWAYS" | "OFF";
export type Track = { id: string; name: string; blob: Blob };

/** combat starts the playlist at intensity >= 0.25; it keeps playing until CALM_HOLD seconds of calm */
export const COMBAT_START = 0.25;
export const CALM_HOLD = 10;
export function playlistShouldPlay(mode: PlaylistMode, combat: number, calmFor: number): boolean {
  if (mode === "OFF") return false;
  if (mode === "ALWAYS") return true;
  return combat >= COMBAT_START || calmFor < CALM_HOLD;
}

const DB = "world-fracture-playlist";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("tracks", { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => { const q = fn(db.transaction("tracks", mode).objectStore("tracks")); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export const loadTracks = () => tx<Track[]>("readonly", (s) => s.getAll() as IDBRequest<Track[]>).catch(() => [] as Track[]);
export const saveTrack = (t: Track) => tx("readwrite", (s) => s.put(t));
export const deleteTrack = (id: string) => tx("readwrite", (s) => s.delete(id));

export const MODE_KEY = "world-fracture-playlist-mode";
export const PLAYLIST_EVENT = "wf-playlist-changed";
export function getMode(): PlaylistMode { try { return (localStorage.getItem(MODE_KEY) as PlaylistMode) || "COMBAT"; } catch { return "COMBAT"; } }
export function setMode(m: PlaylistMode) { localStorage.setItem(MODE_KEY, m); window.dispatchEvent(new Event(PLAYLIST_EVENT)); }
export const notifyChanged = () => window.dispatchEvent(new Event(PLAYLIST_EVENT));
