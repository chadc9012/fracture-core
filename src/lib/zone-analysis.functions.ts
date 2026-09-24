import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const inputSchema = z.object({
  imageDataUrl: z.string().refine((value) => /^data:image\/(png|jpeg|webp);base64,/.test(value), "Use a PNG, JPEG, or WebP screenshot."),
  zoneName: z.string().trim().max(100),
});

export const analyzeZoneScreenshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.imageDataUrl.length > 8_000_000) return { analysis: "", error: "Screenshot is too large. Use an image under 6 MB." };
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { analysis: "", error: "Zone analysis is unavailable." };
    try {
      const runIdFetch = createLovableAiGatewayRunIdFetch();
      const lovable = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey: key,
        headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        fetch: runIdFetch.fetch,
      });
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        messages: [{ role: "user", content: [
          { type: "text", text: `Analyze this WORLD FRACTURE zone screenshot${data.zoneName ? ` from ${data.zoneName}` : ""}. Use only visible evidence. Return concise markdown with exactly these headings: VISIBLE HAZARDS, SAFE ROUTE, TRAVERSAL LOADOUT, EMERGENCY EXIT. Identify uncertainty rather than inventing details.` },
          { type: "image", image: new URL(data.imageDataUrl) },
        ] }],
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
        maxRetries: 0,
      });
      const analysis = (await result.text).trim();
      return analysis ? { analysis, error: "" } : { analysis: "", error: "No traversal report was returned." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Zone analysis failed.";
      console.error("Zone screenshot analysis failed", message);
      return { analysis: "", error: message };
    }
  });