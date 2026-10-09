import { advanceMission, BROKEN_SIGNAL } from "./broken-signal";
import { missionSuite } from "./mission-suite";

// Broken Signal already has its own transition test; this adds the shared persistence/idempotency suite.
missionSuite("Broken Signal persistence", {
  id: "broken-signal", advance: advanceMission as never, initial: BROKEN_SIGNAL, payState: "WORLD_UPDATE", questId: "fd-03", materials: { dataShards: 3 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 12, z: 24 }, "DISCOVERY"], [{ type: "ARRIVED" }, "TRAVERSAL"], [{ type: "ARRIVED" }, "COMBAT_1"],
    [{ type: "CLEAR" }, "HACKING"], [{ type: "HACK", progress: 50 }, "COMBAT_2"], [{ type: "CLEAR" }, "HACKING"], [{ type: "HACK", progress: 100 }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});
