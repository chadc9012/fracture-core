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

export function detectGraphicsSupport(): GraphicsSupport {
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
    const vertexPrecision = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
    const fragmentPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!vertexPrecision || !fragmentPrecision || vertexPrecision.precision <= 0 || fragmentPrecision.precision <= 0) {
      return {
        ok: false, webgl2: Boolean(gl2), safari, maxTextureSize: 0,
        reason: "This browser opened 3D graphics but did not provide the shader precision the world needs.",
      };
    }
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
    return { ok: true, webgl2: Boolean(gl2), safari, maxTextureSize, reason: null };
  } catch (error) {
    return { ok: false, webgl2: false, safari, maxTextureSize: 0, reason: `3D graphics failed to start: ${String(error)}` };
  }
}
