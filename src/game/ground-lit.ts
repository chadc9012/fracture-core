/** Grass cards light like the ground they grow from: their normals all point straight up (GrassField, the Verdant grass cards).
 * On a double-sided material three.js flips the normal for back-facing fragments (normal_fragment_begin: `normal *= faceDirection`),
 * so every card seen from behind got a normal pointing into the ground and rendered near-black — half the clumps in Solara's noon
 * sun were dark green instead of gold (owner's preview, Oct 24). This rewrites the chunk without that flip. Pure string transform:
 * pass the chunk text in (THREE.ShaderChunk.normal_fragment_begin) so it stays testable without three. */
export const FLIP_LINE = "normal *= faceDirection;";

export function groundLitFragment(fragmentShader: string, normalFragmentBegin: string): string {
  return fragmentShader.replace("#include <normal_fragment_begin>", normalFragmentBegin.replace(FLIP_LINE, "/* ground-lit: no back-face flip */"));
}
