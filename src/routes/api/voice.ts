import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requestSpeech } from "@/lib/speech.server";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(700),
  speaker: z.string().trim().min(1).max(40).optional(),
});

const directionFor = (speaker: string) => {
  if (speaker === "NOVA") return "Speak as NOVA, a calm feminine artificial intelligence: controlled, intelligent, quietly warm under pressure, concise, and cinematic.";
  if (speaker === "NARRATOR") return "Speak as a restrained cinematic narrator: grave, measured, intimate, never theatrical.";
  if (/OVERSEER|PRIME|CORE|SENTINEL|KING|KRAKEN/i.test(speaker)) return `Speak as ${speaker}, a formidable science-fiction antagonist: deliberate, distinct, threatening, and concise.`;
  return `Speak as ${speaker}, a grounded survivor in a fractured science-fiction world. Keep the delivery natural and restrained.`;
};

export const Route = createFileRoute("/api/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ message: "This dialogue line could not be prepared." }, { status: 400 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ message: "Spoken dialogue is not configured." }, { status: 401 });
        const speaker = (parsed.data.speaker ?? "NARRATOR").toUpperCase();
        const prompt = `${directionFor(speaker)} Say exactly: ${parsed.data.text}`;
        try {
          const upstream = await requestSpeech({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey,
            model: "google/gemini-3.1-flash-tts-preview",
            format: "gemini",
            voice: "Kore",
          }, prompt, request.signal);
          const headers = new Headers({
            "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
            "Cache-Control": "no-cache",
          });
          for (const [key, value] of upstream.headers) if (key.toLowerCase().startsWith("x-lovable-aig-")) headers.set(key, value);
          return new Response(upstream.body, { status: upstream.status, headers });
        } catch (error) {
          if (request.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return new Response(null, { status: 499 });
          return Response.json({ message: "Spoken dialogue is temporarily unavailable. Captions remain active." }, { status: 502 });
        }
      },
    },
  },
});