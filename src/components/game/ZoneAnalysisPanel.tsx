import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { ImageUp, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeZoneScreenshot } from "@/lib/zone-analysis.functions";

export function ZoneAnalysisPanel({ zoneName, onClose }: { zoneName: string; onClose: () => void }) {
  const analyze = useServerFn(analyzeZoneScreenshot);
  const [preview, setPreview] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choose = (file?: File) => {
    setError(""); setAnalysis("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Use a PNG, JPEG, or WebP screenshot."); return; }
    if (file.size > 6_000_000) { setError("Use a screenshot under 6 MB."); return; }
    const reader = new FileReader(); reader.onload = () => setPreview(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file);
  };
  const submit = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try { const result = await analyze({ data: { imageDataUrl: preview, zoneName } }); setAnalysis(result.analysis); setError(result.error); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Zone analysis failed."); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/90 p-4"><section className="w-full max-w-4xl border border-border bg-card p-5"><header className="flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Field reconnaissance</p><h2 className="mt-1 text-2xl">Zone Analysis</h2><p className="mt-1 text-xs text-muted-foreground">Current region · {zoneName}</p></div><Button size="icon" variant="outline" onClick={onClose} aria-label="Close zone analysis"><X /></Button></header><div className="mt-5 grid gap-5 md:grid-cols-2"><div><label className="grid aspect-video cursor-pointer place-items-center overflow-hidden border border-dashed border-primary/60 bg-background/50">{preview ? <img src={preview} className="h-full w-full object-cover" alt="Uploaded zone screenshot" /> : <span className="text-center font-mono text-[10px] uppercase text-muted-foreground"><ImageUp className="mx-auto mb-2" />Upload zone screenshot</span>}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0])} /></label><Button className="mt-3 w-full" disabled={!preview || busy} onClick={submit}>{busy ? <LoaderCircle className="animate-spin" /> : <ImageUp />}{busy ? "Reading terrain…" : "Analyze hazards"}</Button>{error && <p className="mt-3 border border-destructive/50 p-3 text-xs text-destructive">{error}</p>}</div><div className="min-h-64 border border-border bg-background/40 p-4">{analysis ? <div className="prose prose-sm prose-invert max-w-none text-sm"><ReactMarkdown>{analysis}</ReactMarkdown></div> : <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Hazards, safe route, traversal loadout, and emergency exit will appear here.</p>}</div></div></section></div>;
}