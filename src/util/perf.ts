// Lightweight performance instrumentation. Logs timings to the console as
// `[perf] <label>: <ms>ms <details>` so we can see how fast each stage runs
// (playlist load, feature fetch + cache hit rate, optimization, write-back).

const enabled =
  typeof import.meta !== 'undefined' ? import.meta.env?.DEV !== false : true;

export function perfLog(
  label: string,
  ms: number,
  extra?: Record<string, unknown>,
): void {
  if (!enabled) return;
  const detail =
    extra && Object.keys(extra).length
      ? ' ' +
        Object.entries(extra)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      : '';
  // eslint-disable-next-line no-console
  console.info(`[perf] ${label}: ${ms.toFixed(1)}ms${detail}`);
}

/** Start a timer; call the returned fn to get elapsed ms. */
export function startTimer(): () => number {
  const t0 = performance.now();
  return () => performance.now() - t0;
}

/** Time an async fn, log the elapsed ms with optional details, return result. */
export async function timedAsync<T>(
  label: string,
  fn: () => Promise<T>,
  extra?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const done = startTimer();
  const result = await fn();
  perfLog(label, done(), extra?.(result));
  return result;
}
