import { expect, test } from "bun:test";
import { advanceMission } from "./descent-protocol";
import { DESCENT_PROTOCOL } from "./descent-protocol";
import { missionSuite } from "./mission-suite";

missionSuite("Descent Protocol state machine", {
  id: "descent-protocol", advance: advanceMission as never, initial: DESCENT_PROTOCOL, payState: "WORLD_UPDATE", questId: "fd-16", materials: { dataShards: 5 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "DIVE"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "AIRLOCK"],
    [{ type: "HACK", progress: 100 }, "RING"], [{ type: "ARRIVED" }, "CORE"], [{ type: "ARRIVED" }, "TRACING"],
    [{ type: "HACK", progress: 100 }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});

test("a duplicate ARRIVED queued from the frame loop never skips a state (RING must not jump past CORE)", () => {
  let m = advanceMission(DESCENT_PROTOCOL, { type: "START" });
  m = advanceMission(m, { type: "ANCHOR", x: 0, z: 0 });
  m = advanceMission(m, { type: "ARRIVED", from: "DIVE" });
  m = advanceMission(m, { type: "CLEAR", from: "COMBAT_1" });
  m = advanceMission(m, { type: "HACK", progress: 100 });
  expect(m.state).toBe("RING");
  m = advanceMission(m, { type: "ARRIVED", from: "RING" });
  m = advanceMission(m, { type: "ARRIVED", from: "RING" }); // the same frame-loop event, applied after React advanced
  expect(m.state).toBe("CORE");
});
