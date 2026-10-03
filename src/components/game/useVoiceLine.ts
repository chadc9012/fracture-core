import { useEffect } from "react";
import { speakVoice, stopVoice, type VoicePriority } from "@/game/voice-director";

const stableId = (scope: string, speaker: string, text: string) => `${scope}:${speaker}:${text}`;

export function useVoiceLine(scope: string, speaker: string, text: string | null | undefined, priority: VoicePriority = "story") {
  useEffect(() => {
    if (!text) return;
    speakVoice({ id: stableId(scope, speaker, text), scope, speaker, text, priority });
    return () => stopVoice(scope);
  }, [scope, speaker, text, priority]);
}