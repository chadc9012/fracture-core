import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { hasBackup, listRestorePoints, loadRestorePoint, localSavedAt, pullAndMerge, pushSave, restoreBackup, setRemoteMergeHandler, type RestorePoint } from "@/game/cloud-save";
import type { PlayerProgression } from "@/game/progression";

type Status = "offline" | "syncing" | "synced" | "merged" | "error";

const LABEL: Record<Status, string> = {
  offline: "Local save only",
  syncing: "Syncing…",
  synced: "Cloud save up to date",
  merged: "Merged progress from another device",
  error: "Cloud save failed — progress kept on this device",
};

export function CloudSavePanel({ progression, onProgression }: { progression: PlayerProgression; onProgression: (p: PlayerProgression) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("offline");
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [points, setPoints] = useState<RestorePoint[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const ready = useRef(false);
  const latest = useRef(progression);
  latest.current = progression;

  useEffect(() => {
    setRemoteMergeHandler((p) => { setStatus("merged"); onProgression(p); });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    supabase.auth.getSession().then(({ data: d }) => setUser(d.session?.user ?? null));
    return () => { data.subscription.unsubscribe(); setRemoteMergeHandler(null); };
  }, [onProgression]);

  // on sign-in: pull, migrate, merge
  useEffect(() => {
    ready.current = false;
    if (!user) { setStatus("offline"); return; }
    setStatus("syncing");
    pullAndMerge(user.id, latest.current, localSavedAt())
      .then((r) => { onProgression(r.progression); setStatus(r.status === "merged" ? "merged" : "synced"); ready.current = true; })
      .catch(() => setStatus("error"));
  }, [user, onProgression]);

  // debounced upload whenever progress changes
  useEffect(() => {
    if (!user || !ready.current) return;
    const t = window.setTimeout(() => {
      setStatus((s) => (s === "merged" ? s : "syncing"));
      pushSave(user.id, progression).then(() => setStatus((s) => (s === "merged" ? s : "synced"))).catch(() => setStatus("error"));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [progression, user]);

  const submit = async () => {
    setNote("");
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setNote(error ? error.message : "If that email has an account, a reset link is on its way.");
      return;
    }
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (res.error) setNote(res.error.message);
    else if (mode === "up" && !res.data.session) setNote("Check your email to confirm your account.");
  };

  const retry = () => {
    if (!user) return;
    setStatus("syncing");
    pullAndMerge(user.id, latest.current, localSavedAt()).then((r) => { onProgression(r.progression); setStatus("synced"); ready.current = true; }).catch(() => setStatus("error"));
  };

  const openPoints = () => { if (!user) return; setPoints([]); listRestorePoints(user.id).then(setPoints).catch(() => { setPoints(null); setNote("Couldn't load restore points."); }); };
  const restore = async (id: string) => {
    try { const p = await loadRestorePoint(id); onProgression(p); setConfirmId(null); setPoints(null); setNote("Restored. This version now syncs to all your devices."); }
    catch { setNote("Restore failed — nothing was changed."); }
  };

  const tone = status === "error" ? "text-destructive" : status === "merged" ? "text-warning" : status === "synced" ? "text-primary" : "text-muted-foreground";

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className={`fixed left-4 top-[18.5rem] z-30 border border-border bg-card/80 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] ${tone}`}>
        ☁ {user ? LABEL[status] : "Cloud save · sign in"}
      </button>
      {open && (
        <section className="fixed left-4 top-[21rem] z-40 w-72 border border-border bg-card/95 p-4 text-xs">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-primary">Cloud save</h2>
          {user ? (
            <div className="mt-3 space-y-3">
              <p className="text-muted-foreground">Signed in as {user.email}. Missions, reward vehicles and your garage follow you to any device.</p>
              <p className={tone}>{LABEL[status]}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={retry} className="border border-border px-2 py-1 uppercase">Sync now</button>
                {hasBackup() && <button onClick={() => { const b = restoreBackup(); if (b) { onProgression(b); setNote("Restored this device's copy from before the last merge."); } }} className="border border-border px-2 py-1 uppercase">Undo merge</button>}
                <button onClick={openPoints} className="border border-border px-2 py-1 uppercase">Restore points</button>
                <button onClick={() => supabase.auth.signOut()} className="border border-border px-2 py-1 uppercase">Sign out</button>
              </div>
              {points && <div className="max-h-56 space-y-1 overflow-y-auto border-t border-border pt-2">
                {points.length === 0 && <p className="text-muted-foreground">No earlier versions yet — they're kept automatically as you play (one every 10 minutes, up to 30).</p>}
                {points.map((pt) => <div key={pt.id} className="flex items-center justify-between gap-2 border border-border/60 p-1.5">
                  <span><span className="block">{new Date(pt.created_at).toLocaleString()}</span><span className="text-[10px] text-muted-foreground">{pt.summary}</span></span>
                  {confirmId === pt.id
                    ? <button onClick={() => restore(pt.id)} className="bg-primary px-2 py-1 uppercase text-primary-foreground">Confirm</button>
                    : <button onClick={() => setConfirmId(pt.id)} className="border border-border px-2 py-1 uppercase">Restore</button>}
                </div>)}
              </div>}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <button onClick={() => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })} className="w-full border border-border py-1.5 uppercase">Continue with Google</button>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full border border-border bg-background px-2 py-1.5" />
              {mode !== "reset" && <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full border border-border bg-background px-2 py-1.5" />}
              <button onClick={submit} className="w-full bg-primary py-1.5 uppercase text-primary-foreground">{mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}</button>
              <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-[10px] uppercase text-muted-foreground">{mode === "in" ? "New here? Create account" : "Have an account? Sign in"}</button>
              {mode === "in" && <button onClick={() => { setMode("reset"); setNote(""); }} className="w-full text-[10px] uppercase text-muted-foreground">Forgot password?</button>}
            </div>
          )}
          {note && <p className="mt-2 text-warning">{note}</p>}
        </section>
      )}
    </>
  );
}
