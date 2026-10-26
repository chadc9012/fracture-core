// Google sign-in inside the Android app.
//
// The web build signs in through Lovable's OAuth broker (`/~oauth/initiate`), which only exists on the hosted site. Inside the APK
// the game is served from its own bundle (origin https://localhost), so that URL resolves to nothing, and a full-page redirect would
// leave the game anyway. Here the app asks Supabase for the Google sign-in URL itself, opens it in the phone's browser (a Chrome
// custom tab over the game), and Google hands the user back through the deep link com.chadc9012.worldfracture://auth/callback,
// which the Android shell routes to this module to turn into a Supabase session. The web build never takes this path.
//
// Supabase only honours redirect URLs on the project's allow list (Authentication → URL configuration), so
// NATIVE_AUTH_REDIRECT must be listed there; otherwise Supabase falls back to the site URL and the phone lands on the website.
// The client is loaded lazily so the pure parts of this module (the callback parser) run under plain node in the tests.
async function client() {
  return (await import("./client")).supabase;
}

export const NATIVE_AUTH_REDIRECT = "com.chadc9012.worldfracture://auth/callback";

type CapacitorPlugin = Record<string, (...args: unknown[]) => Promise<unknown>>;
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, CapacitorPlugin | undefined>;
  registerPlugin?: (name: string) => CapacitorPlugin;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the Capacitor Android (or iOS) shell, never in a browser. */
export function isNativeApp(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

function plugin(name: string): CapacitorPlugin | undefined {
  const cap = capacitor();
  return cap?.Plugins?.[name] ?? cap?.registerPlugin?.(name);
}

export type CallbackParse =
  | { kind: "code"; code: string }
  | { kind: "tokens"; access_token: string; refresh_token: string }
  | { kind: "error"; message: string }
  | { kind: "ignore" };

/** Reads what Supabase put on the callback URL: a PKCE code (`?code=`), implicit-flow tokens (`#access_token=`), or an error. */
export function parseAuthCallback(url: string): CallbackParse {
  if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return { kind: "ignore" };
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { kind: "error", message: "Sign-in link was malformed" }; }
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const errorDescription = query.get("error_description") ?? hash.get("error_description") ?? query.get("error") ?? hash.get("error");
  if (errorDescription) return { kind: "error", message: errorDescription.replace(/\+/g, " ") };
  const code = query.get("code");
  if (code) return { kind: "code", code };
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (access_token && refresh_token) return { kind: "tokens", access_token, refresh_token };
  return { kind: "error", message: "Sign-in returned without a session" };
}

async function completeSignIn(url: string): Promise<{ error: Error | null }> {
  const result = parseAuthCallback(url);
  if (result.kind === "ignore") return { error: null };
  if (result.kind === "error") return { error: new Error(result.message) };
  const supabase = await client();
  const res = result.kind === "code"
    ? await supabase.auth.exchangeCodeForSession(result.code)
    : await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
  return { error: res.error ? new Error(res.error.message) : null };
}

let listening = false;
let onResult: ((error: Error | null) => void) | null = null;

/** Starts routing deep links from the Android shell into Supabase. Safe to call more than once; a no-op in a browser. */
export function listenForNativeAuthCallback(): void {
  if (listening || !isNativeApp()) return;
  const app = plugin("App");
  if (!app?.addListener) return;
  listening = true;
  void app.addListener("appUrlOpen", (event: unknown) => {
    const url = (event as { url?: string } | undefined)?.url;
    if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return;
    void plugin("Browser")?.close?.().catch(() => undefined);
    void completeSignIn(url).then(({ error }) => { onResult?.(error); onResult = null; });
  });
}

/** Opens Google sign-in in the phone's browser; resolves once the app has the session (or the sign-in failed). */
export async function signInWithGoogleNative(): Promise<{ error: Error | null }> {
  if (!isNativeApp()) return { error: new Error("Google sign-in in the browser goes through the site, not the app") };
  listenForNativeAuthCallback();
  const supabase = await client();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) return { error: new Error(error.message) };
  if (!data.url) return { error: new Error("Supabase gave no sign-in URL") };
  const browser = plugin("Browser");
  const done = new Promise<{ error: Error | null }>((resolve) => { onResult = (e) => resolve({ error: e }); });
  try {
    if (browser?.open) await browser.open({ url: data.url });
    else window.open(data.url, "_blank");
  } catch (e) {
    onResult = null;
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
  return done;
}
