// Runs the (potentially multi-second) optimize off the UI thread so the loading
// spinner keeps animating and the page stays responsive. The solver enforces
// its own wall-clock budget internally; this worker just marshals the request
// and result. All payloads are plain data (structured-cloneable).

import { optimizePlaylist, type OptimizeRequest, type OptimizeResult } from './optimize';

export type OptimizeWorkerResponse =
  | { ok: true; result: OptimizeResult }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<OptimizeRequest>) => {
  try {
    const result = optimizePlaylist(e.data);
    const msg: OptimizeWorkerResponse = { ok: true, result };
    (self as unknown as Worker).postMessage(msg);
  } catch (err) {
    const msg: OptimizeWorkerResponse = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(msg);
  }
};
