import { createFileRoute } from "@tanstack/react-router";
import { parseSlainKey, SLAIN_KEY } from "@/game/sky-sovereign";

/** GET /api/world-firsts?id=vyrak → { first: { callsign, at } | null }
 * The earliest kill of a Unique across every save (sky-sovereign.ts). The web game stamps `unique-slain-at:vyrak:<ms>:<CALLSIGN>`
 * in earnedRewards beside the plain `unique-slain:vyrak` key (which the containment filter matches); the Godot build writes
 * `data.godot.profile.data.unique_slain.vyrak = { at, callsign }`. Read-only, service role, no player ids leave the server.
 * Times are the clients' own clocks: good enough to crown a first, not proof against a forged save. */
const UNIQUES = new Set(["vyrak"]);
type First = { callsign: string; at: number } | null;
const earliest = (a: First, b: First): First => (!a ? b : !b ? a : a.at <= b.at ? a : b);

export const Route = createFileRoute("/api/world-firsts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!UNIQUES.has(id)) return Response.json({ message: "Unknown unique." }, { status: 400 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let first: First = null;
          const web = await supabaseAdmin.from("player_saves").select("rewards:data->earnedRewards").contains("data", { earnedRewards: [SLAIN_KEY] }).limit(1000);
          if (web.error) throw web.error;
          for (const row of (web.data ?? []) as unknown as { rewards: unknown }[]) {
            if (!Array.isArray(row.rewards)) continue;
            for (const k of row.rewards) if (typeof k === "string") first = earliest(first, parseSlainKey(k));
          }
          const godot = await supabaseAdmin.from("player_saves").select(`slain:data->godot->profile->data->unique_slain->${id}`).not(`data->godot->profile->data->unique_slain->${id}`, "is", null).limit(1000);
          if (!godot.error) {
            for (const row of (godot.data ?? []) as unknown as { slain: unknown }[]) {
              const s = row.slain as { at?: unknown; callsign?: unknown } | null;
              const at = Number(s?.at);
              if (s && Number.isFinite(at) && at > 0) first = earliest(first, { at, callsign: String(s.callsign ?? "OPERATOR").toUpperCase().slice(0, 16) || "OPERATOR" });
            }
          }
          return Response.json({ first }, { headers: { "Cache-Control": "public, max-age=60" } });
        } catch (error) {
          console.error("world-firsts failed", error instanceof Error ? error.message : error);
          return Response.json({ first: null, message: "World records are unavailable." }, { status: 503 });
        }
      },
    },
  },
});
