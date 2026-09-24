import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  encounter: z.string().trim().min(2).max(120),
  fireteam: z.string().trim().min(2).max(600),
  combatLog: z.string().trim().min(20).max(12000),
});

export const getRaidStrategy = createServerFn({ method: "POST" })
  .validator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { recommendation: "", error: "Strategy uplink is temporarily unavailable." };
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-lite",
          messages: [
            { role: "system", content: "You are the WORLD FRACTURE raid tactician. Analyze only the supplied combat evidence. Return concise plain text with exactly these headings: FAILURE PATTERNS, POSITIONING, ROLE ASSIGNMENTS, PHASE PLAN, PRIORITY ADJUSTMENTS. Under PRIORITY ADJUSTMENTS give exactly three numbered actions. Never invent player statistics." },
            { role: "user", content: `Encounter: ${data.encounter}\nFireteam: ${data.fireteam}\nCombat log:\n${data.combatLog}` },
          ],
          temperature: 0.35,
          max_tokens: 900,
        }),
      });
      if (!response.ok) {
        console.error("Raid strategy gateway failed", response.status, await response.text());
        return { recommendation: "", error: "The strategy uplink could not analyze this log. Try again." };
      }
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      const recommendation = payload.choices?.[0]?.message?.content?.trim();
      return recommendation ? { recommendation, error: "" } : { recommendation: "", error: "No strategy was returned. Try a more detailed combat log." };
    } catch (error) {
      console.error("Raid strategy request failed", error);
      return { recommendation: "", error: "The strategy uplink is offline. Try again shortly." };
    }
  });
