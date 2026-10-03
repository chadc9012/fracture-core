/** Browser graphics capability probe. Safari (especially older macOS/iOS builds, Lockdown Mode, or
 * with WebGL disabled in developer settings) differs from Chrome: no WebGL2, smaller texture limits,
 * or a context that is created but lost under memory pressure. We detect this up front so the game
 * can adapt its render settings or show a clear message instead of a black canvas. */
export type GraphicsSupport = {
  ok: boolean;
  webgl2: boolean;
  safari: boolean;
  maxTextureSize: number;
  reason: string | null;
};

export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS\/|Edg\/|Android/.test(ua);
}

/** Safari can return null from getShaderPrecisionFormat (context busy/lost), which crashes
 * Three.js renderer startup. Wrap it once so a null answer becomes a safe default. */
let precisionPatched = false;
export function patchShaderPrecision() {
  if (precisionPatched || typeof window === "undefined") return;
  precisionPatched = true;
  const fallback = (type: number) => {
    // LOW/MEDIUM/HIGH_FLOAT = 0x8df0..2; ints 0x8df3..5
    const isInt = type >= 0x8df3;
    return { rangeMin: isInt ? 31 : 127, rangeMax: isInt ? 30 : 127, precision: isInt ? 0 : 23 } as WebGLShaderPrecisionFormat;
  };
  for (const Ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    const proto = Ctor?.prototype as WebGLRenderingContext | undefined;
    if (!proto?.getShaderPrecisionFormat) continue;
    const original = proto.getShaderPrecisionFormat;
    proto.getShaderPrecisionFormat = function (shader: number, type: number) {
      try {
        return original.call(this, shader, type) ?? fallback(type);
      } catch {
        return fallback(type);
      }
    };
  }
}
if (typeof window !== "undefined") patchShaderPrecision();

export function detectGraphicsSupport(): GraphicsSupport {
  patchShaderPrecision();
  const safari = isSafari();
  if (typeof document === "undefined") return { ok: true, webgl2: true, safari, maxTextureSize: 4096, reason: null };
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl = gl2 ?? (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) {
      return {
        ok: false,
        webgl2: false,
        safari,
        maxTextureSize: 0,
        reason: safari
          ? "Safari blocked 3D graphics (WebGL). It may be turned off in Safari's developer settings or by Lockdown Mode."
          : "This browser could not start 3D graphics (WebGL). It may be disabled or unsupported on this device.",
      };
    }
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { ok: true, webgl2: Boolean(gl2), safari, maxTextureSize, reason: null };
  } catch (error) {
    return { ok: false, webgl2: false, safari, maxTextureSize: 0, reason: `3D graphics failed to start: ${String(error)}` };
  }
}
