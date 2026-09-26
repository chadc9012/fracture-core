import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · World Fracture" },
      { name: "description", content: "Set a new password to get back into your World Fracture cloud save." },
      { property: "og:title", content: "Reset password · World Fracture" },
      { property: "og:description", content: "Set a new password to get back into your World Fracture cloud save." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 8) return setNote("Use at least 8 characters.");
    if (password !== confirm) return setNote("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setNote(error.message);
    setNote("Password updated. Returning to the game…");
    window.setTimeout(() => navigate({ to: "/", replace: true }), 1200);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
      <section className="w-full max-w-sm space-y-3 border border-border bg-card p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Cloud save recovery</p>
        <h1 className="text-xl font-semibold">Set a new password</h1>
        {ready ? (
          <>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full border border-border bg-background px-3 py-2 text-sm" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full border border-border bg-background px-3 py-2 text-sm" />
            <Button className="w-full" disabled={busy} onClick={submit}>Update password</Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email. Links expire after a while — request a new one from the Cloud save panel if needed.</p>
        )}
        {note && <p className="text-sm text-warning">{note}</p>}
      </section>
    </main>
  );
}
