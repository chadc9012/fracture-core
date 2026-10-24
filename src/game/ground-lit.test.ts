import { expect, test } from "bun:test";
import * as THREE from "three";
import { FLIP_LINE, groundLitFragment } from "./ground-lit";

// Regression: up-normal grass cards on a double-sided material rendered near-black from behind (three flips the normal per face).
test("the grass fragment shader keeps the up normal on both faces", () => {
  const chunk = THREE.ShaderChunk.normal_fragment_begin;
  expect(chunk).toContain(FLIP_LINE); // if three renames the line, this test tells us the patch stopped working
  const frag = THREE.ShaderLib.standard.fragmentShader;
  const out = groundLitFragment(frag, chunk);
  expect(out).not.toContain("#include <normal_fragment_begin>");
  expect(out).not.toContain(FLIP_LINE);
  expect(out).toContain("faceDirection"); // the rest of the chunk (declarations other chunks read) is kept
});
