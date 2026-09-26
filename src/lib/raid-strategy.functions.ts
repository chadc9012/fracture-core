import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const inputSchema = z.object({
  dungeon: z.string().trim().min(2).max(120),
  playerClass: z.string().trim().min(2).max(60),
  weapons: z.string().trim().min(2).max(600),
  fireteam: z.string().trim().min(2).max(600),
});

export const getRaidStrategy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { recommendation: "", error: "Strategy uplink is unavailable." };
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
        messages: [
          { role: "system", content: "You are WORLD FRACTURE's field tactician. Give an actionable and concise strategy grounded only in the provided loadout. Use exactly these headings: ROLE ASSIGNMENTS, EXPECTED THREATS, ROUTE PLAN, ABILITY CHAINS, LOOT PRIORITY. Clearly label uncertainty; never invent statistics or assert the party has abilities not specified." },
          { role: "user", content: `Dungeon: ${data.dungeon}\nPlayer class: ${data.playerClass}\nEquipped weapons: ${data.weapons}\nTeam composition: ${data.fireteam}` },
        ],
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
        maxRetries: 0,
      });
      const recommendation = (await result.text).trim();
      return recommendation ? { recommendation, error: "" } : { recommendation: "", error: "No strategy was returned. Try again later." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Strategy analysis failed.";
      console.error("Strategy request failed", message);
      return { recommendation: "", error: message };
    }
  });