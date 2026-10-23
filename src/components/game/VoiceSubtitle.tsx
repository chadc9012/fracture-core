import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { subscribeVoice, type VoiceStatus } from "@/game/voice-director";

/** `hidden` keeps the subscription (so the current line is not lost) while a full-screen menu such as the atlas is open */
export function VoiceSubtitle({ hidden = false }: { hidden?: boolean }) {
  const [status, setStatus] = useState<VoiceStatus>({ state: "idle" });
  useEffect(() => subscribeVoice(setStatus), []);
  if (status.state === "idle" || hidden) return null;
  return (
    <div className="voice-subtitle pointer-events-none fixed bottom-[12.5rem] left-1/2 xl:bottom-24 z-[70] w-[min(44rem,calc(100%-2rem))] -translate-x-1/2">
      <p className="vs-speaker inline-flex items-center gap-2"><Radio className="size-3" />{status.speaker ?? "VOICE"}{status.state === "loading" ? " · linking" : ""}</p>
      {status.text && <p className="vs-line">{status.text}</p>}
    </div>
  );
}