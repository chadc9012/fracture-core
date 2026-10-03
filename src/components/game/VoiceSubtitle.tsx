import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { subscribeVoice, type VoiceStatus } from "@/game/voice-director";
import { CornerBrackets } from "./HudChrome";

export function VoiceSubtitle() {
  const [status, setStatus] = useState<VoiceStatus>({ state: "idle" });
  useEffect(() => subscribeVoice(setStatus), []);
  if (status.state === "idle") return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[70] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 border border-primary/40 bg-background/85 px-4 py-3 backdrop-blur-md">
      <CornerBrackets />
      <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.24em] text-primary"><Radio className="size-3" />{status.speaker ?? "VOICE"} // {status.state === "loading" ? "LINKING" : status.state === "speaking" ? "TRANSMISSION" : "CAPTIONS ONLY"}</p>
      {status.text && <p className="mt-1 text-sm leading-relaxed text-foreground">{status.text}</p>}
      {status.state === "unavailable" && <p className="mt-1 text-[9px] text-muted-foreground">{status.message}</p>}
    </div>
  );
}