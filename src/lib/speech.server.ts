export type SpeechConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "gemini";
  voice: string;
};

export function speechBody(config: SpeechConfig, text: string) {
  return {
    model: config.model,
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } } },
    },
    stream_format: "sse",
  };
}

export function requestSpeech(config: SpeechConfig, text: string, signal?: AbortSignal) {
  return fetch(`${config.baseURL}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(speechBody(config, text)),
    ...(signal ? { signal } : {}),
  });
}