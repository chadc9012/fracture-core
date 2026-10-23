import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { subscribeVoice, type VoiceStatus } from "@/game/voice-director";
import { CornerBrackets } from "./HudChrome";

/** `hidden` keeps the subscription (so the current line is not lost) while a full-screen menu such as the atlas is open */
export function VoiceSubtitle({ hidden = false }: { hidden?: boolean }) {
  const [status, setStatus] = useState<VoiceStatus>({ state: "idle" });
  useEffect(() => subscribeVoice(setStatus), []);
  if (status.state === "idle" || hidden) return null;
  return (
    <div className="voice-subtitle pointer-events-none fixed bottom-[12.5rem] left-1/2 xl:bottom-24 z-[70] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 border border-primary/40 bg-background/85 px-4 py-3">
      <CornerBrackets />
      <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.24em] text-primary"><Radio className="size-3" />{status.speaker ?? "VOICE"} // {status.state === "loading" ? "LINKING" : status.state === "speaking" ? "TRANSMISSION" : "CAPTIONS ONLY"}</p>
      {status.text && <p className="mt-1 text-sm leading-relaxed text-foreground">{status.text}</p>}
      {status.state === "unavailable" && <p className="mt-1 text-[9px] text-muted-foreground">{status.message}</p>}
    </div>
  );
}