import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Structural checks on the authored CIPHER GLB (built by scripts/build-operator-authored.py): the game drives it by clip name and bone name. */
function glbJson(path: string) {
  const b = readFileSync(path);
  const len = b.readUInt32LE(12);
  return { json: JSON.parse(b.subarray(20, 20 + len).toString("utf8")), bytes: b.length };
}

describe("authored CIPHER model", () => {
  const { json, bytes } = glbJson("public/models/operators/cipher-authored.glb");
  test("ships web-sized (the Meshy exports were ~50 MB)", () => { expect(bytes).toBeLessThan(6 * 1024 * 1024); });
  test("has the walk and run clips the stride driver scrubs", () => {
    const names = (json.animations as { name: string }[]).map((a) => a.name).sort();
    expect(names).toEqual(["run", "walk"]);
  });
  test("keeps the Mixamo bones that weapons, armor mounts and root pinning look up", () => {
    const joints = new Set((json.skins[0].joints as number[]).map((i) => json.nodes[i].name));
    for (const n of ["mixamorig:Hips", "mixamorig:Spine2", "mixamorig:RightHand", "mixamorig:LeftHand", "mixamorig:Head"]) expect(joints.has(n)).toBe(true);
  });
  test("is one skinned mesh with its own textures re-encoded as JPEG", () => {
    expect(json.meshes.length).toBe(1);
    expect((json.images as { mimeType: string }[]).every((i) => i.mimeType === "image/jpeg")).toBe(true);
  });
});
