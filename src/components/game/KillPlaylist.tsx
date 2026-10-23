import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCombatLevel, startRadio, setExternalMusic, unlockAudio } from "@/game/audio";
import { RADIO_STATIONS, getMusicSource, setMusicSource, type MusicSource } from "@/game/radio-stations";
import { PLAYLIST_EVENT, deleteTrack, getMode, loadTracks, notifyChanged, playlistShouldPlay, saveTrack, setMode, type PlaylistMode, type Track } from "@/game/kill-playlist";

function useTracks() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mode, setM] = useState<PlaylistMode>("COMBAT");
  const [source, setSource] = useState<MusicSource>("playlist");
  useEffect(() => {
    const load = () => { void loadTracks().then(setTracks); setM(getMode()); setSource(getMusicSource()); };
    load(); window.addEventListener(PLAYLIST_EVENT, load);
    return () => window.removeEventListener(PLAYLIST_EVENT, load);
  }, []);
  return { tracks, mode, source };
}

/** Settings → Audio: add songs from the device, remove them, choose when they play. */
export function KillPlaylistPanel() {
  const { tracks, mode, source } = useTracks();
  // live "now playing" from startRadio's wf-radio-now-playing event (song, episode or commercial)
  const [onAirNow, setOnAirNow] = useState<{ station: string; title: string } | null>(null);
  useEffect(() => {
    const onRadio = (e: Event) => { const d = (e as CustomEvent<{ station: string; title: string }>).detail; if (d && typeof d.title === "string") setOnAirNow(d); };
    window.addEventListener("wf-radio-now-playing", onRadio);
    return () => window.removeEventListener("wf-radio-now-playing", onRadio);
  }, []);
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) await saveTrack({ id: `${Date.now()}-${f.name}`, name: f.name.replace(/\.[^.]+$/, ""), blob: f });
    notifyChanged();
  };
  return (
    <div className="mt-4 border border-border bg-card/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Kill Playlist</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Radio stations">
        {Object.entries(RADIO_STATIONS).map(([id, station]) => <Button key={id} variant={source === id ? "default" : "outline"} className="h-auto min-h-12 justify-start py-2 text-left" onClick={() => { unlockAudio(); setMusicSource(id as MusicSource); }}><span><span className="block text-xs">{station.name}</span><span className="block text-[10px] opacity-75">{station.genre}</span></span></Button>)}
        <Button variant={source === "playlist" ? "default" : "outline"} onClick={() => setMusicSource("playlist")}>My songs</Button>
      </div>
      {source !== "playlist" && <div className="mt-2 border border-border/70 bg-background/50 px-3 py-2 text-xs" aria-live="polite">
        <p className="font-semibold">Live radio · {RADIO_STATIONS[source].name}</p>
        <p className="text-muted-foreground">{onAirNow?.station === source ? onAirNow.title : "Tuning in…"}</p>
        <p className="text-[10px] text-muted-foreground">Full songs and episodes play through without skipping; commercials air between programs.</p>
      </div>}
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
  const { tracks, mode, source } = useTracks();
  const audio = useRef<HTMLAudioElement | null>(null);
  const idx = useRef(0); const url = useRef<string | null>(null);
  const [now, setNow] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (source === "playlist") return;
    let stop: (() => void) | null = null, calm = 99;
    const tick = () => {
      const c = getCombatLevel(); calm = c >= 0.25 ? 0 : calm + 0.5;
      const on = !muted && volume > 0 && playlistShouldPlay(mode, c, calm);
      if (on && !stop) { unlockAudio(); setNow(RADIO_STATIONS[source].name); stop = startRadio(source, (label) => setNow(`${RADIO_STATIONS[source].name} · ${label}`)); setExternalMusic(true); setPlaying(true); }
      if (!on && stop) { stop(); stop = null; setExternalMusic(false); setPlaying(false); }
    };
    tick(); const timer = window.setInterval(tick, 500);
    return () => { clearInterval(timer); stop?.(); setExternalMusic(false); setPlaying(false); };
  }, [source, mode, muted, volume]);
  useEffect(() => {
    if (source !== "playlist" || !tracks.length) { audio.current?.pause(); return; }
    const el = audio.current ?? (audio.current = new Audio());
    const loadTrack = () => {
      const t = tracks[idx.current % tracks.length]; if (!t) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(t.blob); el.src = url.current; setNow(t.name);
    };
    el.onended = () => { idx.current++; loadTrack(); void el.play().catch(() => { setPlaying(false); setExternalMusic(false); }); };
    idx.current %= tracks.length; loadTrack();
    let calm = 99;
    const timer = window.setInterval(() => {
      const c = getCombatLevel(); calm = c >= 0.25 ? 0 : calm + 0.5;
      const on = !muted && volume > 0 && playlistShouldPlay(mode, c, calm);
      el.volume = Math.max(0, Math.min(1, volume));
      if (on && el.paused) void el.play().then(() => { setExternalMusic(true); setPlaying(true); }).catch(() => { setPlaying(false); setExternalMusic(false); });
      else if (!on) { el.pause(); setPlaying(false); setExternalMusic(false); }
    }, 500);
    return () => { window.clearInterval(timer); el.pause(); el.onended = null; setExternalMusic(false); setPlaying(false); };
  }, [tracks, mode, volume, muted, source]);
  useEffect(() => () => { audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }, []);
  if (!now || !playing) return null;
  return <div className="pointer-events-none absolute right-3 top-28 max-w-[50vw] truncate border border-primary/40 bg-background/70 px-2 py-1 font-mono text-[10px] uppercase text-primary">♪ {now}</div>;
}
