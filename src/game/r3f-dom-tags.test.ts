import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A DOM-only element inside the 3D tree (an SVG <title>, a <div>) throws in react-three-fiber and takes the whole scene
 * down. 3D component files (they draw meshes and no SVG/DOM) must not use one. */
describe("3D components use only three.js elements", () => {
  test("no <title>/<div>/<span> in mesh-only component files", () => {
    const dir = join(process.cwd(), "src", "components", "game");
    const bad: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
      const src = readFileSync(join(dir, f), "utf8");
      if (!src.includes("<mesh") || /<svg|<div|<Html|<button|<p\b|createPortal/.test(src)) continue;
      if (/<title>|<span\b/.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
