import { useCallback, useEffect, useRef } from 'react'

import NetworkAnalyzerWorkerInline from '../model/networkAnalyzer.worker?worker&inline'

import type { NetworkAnalyzerWorkerInput, NetworkAnalyzerWorkerOutput } from '../model/networkAnalyzer.worker'

/** Rejection reason `cancel()` uses, so callers can distinguish a deliberate cancel from a real worker error. */
export class AnalysisCancelledError extends Error {
  constructor() {
    super('Network analysis cancelled')
    this.name = 'AnalysisCancelledError'
  }
}

/**
 * Path of the worker module, for DEV only. Kept in a variable (not written
 * literally inside `new URL(...)`) so Vite's asset transform does not match the
 * pattern at build time and emit the raw .ts file as an asset; the whole dev
 * branch is dead code in a production build anyway.
 */
const DEV_WORKER_PATH = '../model/networkAnalyzer.worker.ts'

/**
 * Constructs the Network Analyzer worker — without hardcoding any origin, so
 * the same code works wherever the app is served from.
 *
 * PRODUCTION: `?worker&inline` embeds the bundled worker (its import graph is
 * pure algorithm code) into this chunk and constructs it from a Blob at
 * runtime. A Blob worker is same-origin by construction, so it works no matter
 * where the remote is deployed — any origin, any base path, no CORS, no URL to
 * resolve. (The alternative, `?worker&url`, emits a root-absolute `/assets/…`
 * URL because the SDK owns `base: '/'`, which breaks subpath deployments.)
 *
 * DEV: Vite serves modules unbundled, so there is nothing to inline — the
 * inline wrapper falls back to `new Worker(<dev url>)`, and that breaks
 * cross-origin: this app is a Module Federation remote whose modules are
 * served from its own dev server (e.g. :5556) while the page is the host's
 * origin (e.g. cyweb on :5500), and browsers reject constructing a Worker
 * directly from a cross-origin script URL ("SecurityError: Failed to
 * construct 'Worker'"). So in dev we build the worker from a tiny same-origin
 * Blob module that `import`s the dev-served worker module — a module import
 * may cross origins under CORS, and the dev server already sends
 * `Access-Control-Allow-Origin: *` (the host needs it to import
 * remoteEntry.js at all).
 */
function createWorker(): Worker {
  if (import.meta.env.PROD) {
    return new NetworkAnalyzerWorkerInline({ name: 'network-analyzer-worker' })
  }

  const workerUrl = new URL(DEV_WORKER_PATH, import.meta.url).href
  // The revoke frees the Blob once the module graph has loaded (static imports
  // resolve before the module body runs) — the same trick Vite's own inline
  // worker wrapper uses.
  const bootstrap =
    `import ${JSON.stringify(workerUrl)};\n` + `URL.revokeObjectURL(import.meta.url);`
  const blobUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }))
  return new Worker(blobUrl, { type: 'module', name: 'network-analyzer-worker' })
}

/**
 * Manages a single Network Analyzer web worker's lifecycle. A terminated
 * worker can't be reused, so `runInWorker` creates a fresh one each call.
 *
 * The worker is bundled by Vite's built-in `?worker&inline` handling — no
 * separate compiler config, no pinned output filename. See `createWorker`
 * above for how it is constructed in production vs dev.
 */
export function useNetworkAnalyzerWorker(): {
  runInWorker: (input: NetworkAnalyzerWorkerInput) => Promise<NetworkAnalyzerWorkerOutput>
  cancel: () => void
} {
  const workerRef = useRef<Worker | null>(null)
  const rejectRef = useRef<((reason: unknown) => void) | null>(null)

  const cancel = useCallback((): void => {
    workerRef.current?.terminate()
    workerRef.current = null
    rejectRef.current?.(new AnalysisCancelledError())
    rejectRef.current = null
  }, [])

  const runInWorker = useCallback(
    (input: NetworkAnalyzerWorkerInput): Promise<NetworkAnalyzerWorkerOutput> => {
      return new Promise((resolve, reject) => {
        const worker = createWorker()
        workerRef.current = worker
        rejectRef.current = reject

        worker.onmessage = (event: MessageEvent<NetworkAnalyzerWorkerOutput>): void => {
          workerRef.current = null
          rejectRef.current = null
          resolve(event.data)
          worker.terminate()
        }
        worker.onerror = (event: ErrorEvent): void => {
          workerRef.current = null
          rejectRef.current = null
          reject(new Error(event.message || 'Network analysis worker failed'))
          worker.terminate()
        }

        worker.postMessage(input)
      })
    },
    [],
  )

  // Terminate any in-flight worker if the component unmounts mid-analysis.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  return { runInWorker, cancel }
}
