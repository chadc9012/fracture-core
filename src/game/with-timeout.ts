/** Rejects (or resolves to `fallback` when given) if `work` has not settled within `ms`.
 * Pure helper so a stalled network call (auth session, cloud push, slot read) can never leave a menu waiting forever. */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) { super(`${label} timed out after ${ms} ms`); this.name = "TimeoutError"; }
}

export function withTimeout<T>(work: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** Like withTimeout but resolves to `fallback` on timeout or failure. */
export async function orFallback<T>(work: Promise<T>, ms: number, fallback: T, label?: string): Promise<T> {
  try { return await withTimeout(work, ms, label); } catch { return fallback; }
}
