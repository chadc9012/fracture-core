import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { hasBackup, localSavedAt, pullAndMerge, pushSave, restoreBackup, setRemoteMergeHandler } from "@/game/cloud-save";
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
  const [mode, setMode] = useState<"in" | "up">("in");
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

  const tone = status === "error" ? "text-destructive" : status === "merged" ? "text-warning" : status === "synced" ? "text-primary" : "text-muted-foreground";

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className={`fixed left-4 top-[18.5rem] z-30 border border-border bg-card/80 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur-md ${tone}`}>
        ☁ {user ? LABEL[status] : "Cloud save · sign in"}
      </button>
      {open && (
        <section className="fixed left-4 top-[21rem] z-40 w-72 border border-border bg-card/95 p-4 text-xs backdrop-blur-md">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-primary">Cloud save</h2>
          {user ? (
            <div className="mt-3 space-y-3">
              <p className="text-muted-foreground">Signed in as {user.email}. Missions, reward vehicles and your garage follow you to any device.</p>
              <p className={tone}>{LABEL[status]}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={retry} className="border border-border px-2 py-1 uppercase">Sync now</button>
                {hasBackup() && <button onClick={() => { const b = restoreBackup(); if (b) { onProgression(b); setNote("Restored this device's copy from before the last merge."); } }} className="border border-border px-2 py-1 uppercase">Undo merge</button>}
                <button onClick={() => supabase.auth.signOut()} className="border border-border px-2 py-1 uppercase">Sign out</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <button onClick={() => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })} className="w-full border border-border py-1.5 uppercase">Continue with Google</button>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full border border-border bg-background px-2 py-1.5" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full border border-border bg-background px-2 py-1.5" />
              <button onClick={submit} className="w-full bg-primary py-1.5 uppercase text-primary-foreground">{mode === "in" ? "Sign in" : "Create account"}</button>
              <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-[10px] uppercase text-muted-foreground">{mode === "in" ? "New here? Create account" : "Have an account? Sign in"}</button>
            </div>
          )}
          {note && <p className="mt-2 text-warning">{note}</p>}
        </section>
      )}
    </>
  );
}
