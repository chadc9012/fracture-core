import { beforeEach, describe, expect, test } from "bun:test";
import { getAssetSummary, reportAsset, resetAssetReport, summarize } from "./forest-assets";

describe("forest asset report", () => {
  beforeEach(() => resetAssetReport());
  test("counts loading, ok and failed", () => {
    expect(summarize([{ label: "a", status: "ok" }, { label: "b", status: "failed" }, { label: "c", status: "loading" }])).toEqual({ total: 3, ok: 1, loading: 1, failed: ["b"], settled: false });
  });
  test("is settled only once nothing is loading", () => {
    reportAsset("x", "Fern", "loading");
    expect(getAssetSummary().settled).toBe(false);
    reportAsset("x", "Fern", "failed");
    expect(getAssetSummary()).toEqual({ total: 1, ok: 0, loading: 0, failed: ["Fern"], settled: true });
  });
  test("a remount cannot downgrade a settled result", () => {
    reportAsset("x", "Fir", "ok");
    reportAsset("x", "Fir", "loading");
    expect(getAssetSummary().ok).toBe(1);
  });
});
