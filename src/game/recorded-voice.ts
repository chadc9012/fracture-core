/**
 * Pre-recorded dialogue. A line whose id is in RECORDED_VOICES plays its audio file; every other line streams from /api/voice.
 * Clips are 16-bit mono PCM WAV under public/audio/voices. Playback never uses browser speech synthesis.
 * Add a clip by dropping the WAV in public/audio/voices and adding `lineId: "file-name.wav"` here, with the exact spoken text
 * in RECORDED_TRANSCRIPTS so captions match the audio.
 */
export const RECORDED_VOICES: Record<string, string> = {};
export const RECORDED_TRANSCRIPTS: Record<string, string> = {};

export const recordedUrl = (lineId: string): string | null => {
  const file = RECORDED_VOICES[lineId];
  return file ? `/audio/voices/${file}` : null;
};

export type DecodedWav = { samples: Float32Array; sampleRate: number };

/** Minimal RIFF/WAVE reader for 16-bit PCM (mono; stereo is averaged). Throws on anything else so the caller falls back. */
export function decodeWav(buf: ArrayBuffer): DecodedWav {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (buf.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file.");
  let channels = 0, rate = 0, bits = 0, fmtTag = 0, data: [number, number] | null = null;
  for (let o = 12; o + 8 <= buf.byteLength;) {
    const id = tag(o), size = v.getUint32(o + 4, true), body = o + 8;
    if (id === "fmt ") { fmtTag = v.getUint16(body, true); channels = v.getUint16(body + 2, true); rate = v.getUint32(body + 4, true); bits = v.getUint16(body + 14, true); }
    else if (id === "data") { data = [body, Math.min(size, buf.byteLength - body)]; break; }
    o = body + size + (size % 2);
  }
  if (!data || fmtTag !== 1 || bits !== 16 || channels < 1 || channels > 2 || !rate) throw new Error("Unsupported WAV format.");
  const frames = Math.floor(data[1] / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += v.getInt16(data[0] + (i * channels + c) * 2, true);
    samples[i] = sum / channels / 32768;
  }
  return { samples, sampleRate: rate };
}
