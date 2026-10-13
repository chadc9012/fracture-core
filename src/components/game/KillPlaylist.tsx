import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCombatLevel } from "@/game/audio";
import { PLAYLIST_EVENT, deleteTrack, getMode, loadTracks, notifyChanged, playlistShouldPlay, saveTrack, setMode, type PlaylistMode, type Track } from "@/game/kill-playlist";

function useTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mode, setM] = useState<PlaylistMode>("COMBAT");
  useEffect(() => {
    const load = () => { void loadTracks().then(setTracks); setM(getMode()); };
    load(); window.addEventListener(PLAYLIST_EVENT, load);
    return () => window.removeEventListener(PLAYLIST_EVENT, load);
  }, []);
  return { tracks, mode };
}

/** Settings → Audio: add songs from the device, remove them, choose when they play. */
export function KillPlaylistPanel() {
  const { tracks, mode } = useTracks();
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) await saveTrack({ id: `${Date.now()}-${f.name}`, name: f.name.replace(/\.[^.]+$/, ""), blob: f });
    notifyChanged();
  };
  return (
    <div className="mt-4 border border-border bg-card/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Kill Playlist</p>
      <p className="mt-1 text-xs text-muted-foreground">Add your own songs. They stay on this device and play over the game music.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["COMBAT", "ALWAYS", "OFF"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m === "COMBAT" ? "During fights" : m === "ALWAYS" ? "Always" : "Off"}</Button>
        ))}
        <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 text-xs">+ Add songs<input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => void add(e.target.files)} /></label>
      </div>
      <ul className="mt-2 space-y-1">
        {tracks.length === 0 && <li className="text-xs text-muted-foreground">No songs yet.</li>}
        {tracks.map((t) => (
          <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
            <span className="truncate">{t.name}</span>
            <Button size="sm" variant="ghost" onClick={() => void deleteTrack(t.id).then(notifyChanged)}>Remove</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** In-world player: shuffles through the playlist while the rule says so, fades with the music level. */
export function KillPlaylistPlayer({ volume, muted }: { volume: number; muted: boolean }) {
  const { tracks, mode } = useTracks();
  const audio = useRef<HTMLAudioElement | null>(null);
  const idx = useRef(0); const url = useRef<string | null>(null);
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    if (!tracks.length) return;
    const el = audio.current ?? (audio.current = new Audio());
    const loadTrack = () => {
      const t = tracks[idx.current % tracks.length]; if (!t) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(t.blob); el.src = url.current; setNow(t.name);
    };
    el.onended = () => { idx.current++; loadTrack(); void el.play().catch(() => {}); };
    if (!el.src) { idx.current = Math.floor(Math.random() * tracks.length); loadTrack(); }
    let calm = 99;
    const timer = window.setInterval(() => {
      const c = getCombatLevel(); calm = c >= 0.25 ? 0 : calm + 0.5;
      const on = !muted && playlistShouldPlay(mode, c, calm);
      el.volume = Math.max(0, Math.min(1, volume));
      if (on && el.paused) void el.play().catch(() => {});
      else if (!on && !el.paused) el.pause();
    }, 500);
    return () => window.clearInterval(timer);
  }, [tracks, mode, volume, muted]);
  useEffect(() => () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }, []);
  if (!now || !audio.current || audio.current.paused) return null;
  return <div className="pointer-events-none absolute right-3 top-28 max-w-[50vw] truncate border border-primary/40 bg-background/70 px-2 py-1 font-mono text-[10px] uppercase text-primary">♪ {now}</div>;
}
