import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Route } from "./voice";

/* The voice route must never surface an AbortError as a runtime crash: players skip and cancel
 * spoken lines constantly, and each skip aborts either the request body or the upstream call. */

type Handler = (args: { request: Request }) => Promise<Response>;
const POST = (Route as unknown as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers.POST;

const abortError = () => Object.assign(new Error("This operation was aborted"), { name: "AbortError" });

const jsonRequest = (body: unknown) =>
  new Request("http://test/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let savedKey: string | undefined;
let savedFetch: typeof fetch;

beforeEach(() => {
  savedKey = process.env["LOVABLE_API_KEY"];
  savedFetch = globalThis.fetch;
  process.env["LOVABLE_API_KEY"] = "test-key";
});

afterEach(() => {
  if (savedKey === undefined) delete process.env["LOVABLE_API_KEY"];
  else process.env["LOVABLE_API_KEY"] = savedKey;
  globalThis.fetch = savedFetch;
});

describe("POST /api/voice abort handling", () => {
  it("returns 499 when the request body aborts mid-read (player navigated away)", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"text":"hel'));
        controller.error(abortError());
      },
    });
    const request = new Request("http://test/api/voice", { method: "POST", body, duplex: "half" } as RequestInit);
    const response = await POST({ request });
    expect(response.status).toBe(499);
  });

  it("returns 499 when the upstream voice call is canceled (player skipped the line)", async () => {
    globalThis.fetch = mock(() => Promise.reject(abortError())) as unknown as typeof fetch;
    const response = await POST({ request: jsonRequest({ text: "Signal locked.", speaker: "NOVA" }) });
    expect(response.status).toBe(499);
  });

  it("returns 502 with a caption-fallback message when the upstream voice call fails", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("gateway down"))) as unknown as typeof fetch;
    const response = await POST({ request: jsonRequest({ text: "Signal locked.", speaker: "NOVA" }) });
    expect(response.status).toBe(502);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toContain("Captions remain active");
  });

  it("rejects invalid dialogue bodies with 400", async () => {
    const response = await POST({ request: jsonRequest({ text: "" }) });
    expect(response.status).toBe(400);
  });
});

describe("caption fallback when spoken dialogue fails", () => {
  type Status = { state: string; speaker?: string; text?: string; message?: string };

  beforeEach(() => {
    // minimal browser audio stubs so the voice director runs outside a browser
    const param = { value: 1, setTargetAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} };
    class FakeAudioContext {
      currentTime = 0;
      state = "running";
      destination = {};
      resume() { return Promise.resolve(); }
      createGain() { return { gain: { ...param }, connect() {}, disconnect() {} }; }
      createAnalyser() { return { fftSize: 256, connect() {}, getByteTimeDomainData() {} }; }
      createBuffer(_ch: number, len: number, rate: number) { return { duration: len / rate, copyToChannel() {} }; }
      createBufferSource() { return { connect() {}, start() {}, stop() {}, onended: null as null | (() => void), buffer: null as unknown }; }
    }
    (globalThis as Record<string, unknown>)["window"] = { AudioContext: FakeAudioContext };
    (globalThis as Record<string, unknown>)["requestAnimationFrame"] = () => 0;
    (globalThis as Record<string, unknown>)["cancelAnimationFrame"] = () => undefined;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)["window"];
    delete (globalThis as Record<string, unknown>)["requestAnimationFrame"];
    delete (globalThis as Record<string, unknown>)["cancelAnimationFrame"];
  });

  it("keeps captions up and reports 'unavailable' when the voice request fails", async () => {
    const { speakVoice, subscribeVoice, configureVoice } = await import("@/game/voice-director");
    configureVoice({ enabled: true, volume: 0.85 });
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "Spoken dialogue is temporarily unavailable. Captions remain active." }), { status: 502 })),
    ) as unknown as typeof fetch;

    const statuses: Status[] = [];
    const unsubscribe = subscribeVoice((s) => statuses.push(s));
    speakVoice({ id: "test-caption-fallback", scope: "test", speaker: "NOVA", text: "The signal is ahead." });
    await new Promise((r) => setTimeout(r, 100));
    unsubscribe();

    const unavailable = statuses.find((s) => s.state === "unavailable");
    expect(unavailable).toBeDefined();
    expect(unavailable?.text).toBe("The signal is ahead."); // caption text stays on screen
    expect(unavailable?.message).toContain("Captions remain active");
  });

  it("stays silent when the player cancels a line — no error, no 'unavailable'", async () => {
    const { speakVoice, stopVoice, subscribeVoice, configureVoice } = await import("@/game/voice-director");
    configureVoice({ enabled: true, volume: 0.85 });
    globalThis.fetch = mock((( _url: string, init?: RequestInit ) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(abortError()), { once: true });
      })) as unknown as typeof fetch;

    const statuses: Status[] = [];
    const unsubscribe = subscribeVoice((s) => statuses.push(s));
    speakVoice({ id: "test-cancel-line", scope: "cancel-scope", speaker: "NOVA", text: "Hold position." });
    await new Promise((r) => setTimeout(r, 50));
    stopVoice("cancel-scope");
    await new Promise((r) => setTimeout(r, 300)); // play() waits 140ms after an abort
    unsubscribe();

    expect(statuses.some((s) => s.state === "unavailable")).toBe(false);
  });
});
