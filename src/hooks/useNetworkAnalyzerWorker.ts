import { useCallback, useEffect, useRef } from 'react'

import type { NetworkAnalyzerWorkerInput, NetworkAnalyzerWorkerOutput } from '../model/networkAnalyzer.worker'

/** Rejection reason `cancel()` uses, so callers can distinguish a deliberate cancel from a real worker error. */
export class AnalysisCancelledError extends Error {
  constructor() {
    super('Network analysis cancelled')
    this.name = 'AnalysisCancelledError'
  }
}

/**
 * Constructs the Network Analyzer worker. `new Worker(url)` can't be called
 * directly with the worker chunk's own URL — that chunk is served from this
 * remote's origin (e.g. localhost:5556), but the code constructing the
 * Worker runs inside the CW *host* page's origin (e.g. localhost:5500) once
 * Module Federation has loaded it there, and browsers reject constructing a
 * Worker directly from a cross-origin script URL ("SecurityError: Failed to
 * construct 'Worker'"). The standard workaround: wrap it in a tiny same-origin
 * Blob that does `importScripts(actualUrl)` — `importScripts()` is not
 * subject to that same restriction (the dev server's
 * `Access-Control-Allow-Origin: *` header, set in webpack.config.js's
 * devServer, covers it) — and construct the Worker from that blob's
 * (same-origin) object URL instead. This blob wrapper is why the worker must
 * run as a CLASSIC worker: `importScripts()` doesn't exist in module workers.
 */
function createWorker(scriptUrl: URL): Worker {
  const blob = new Blob([`importScripts(${JSON.stringify(scriptUrl.toString())});`], {
    type: 'application/javascript',
  })
  const blobUrl = URL.createObjectURL(blob)
  const worker = new Worker(blobUrl)
  // Safe to revoke immediately — the browser has already started fetching
  // the blob's content by the time the Worker constructor returns.
  URL.revokeObjectURL(blobUrl)
  return worker
}

/**
 * Manages a single Network Analyzer web worker's lifecycle. A terminated
 * worker can't be reused, so `runInWorker` creates a fresh one each call.
 *
 * Loaded as a CLASSIC worker chunk named "network-analyzer-worker" — its own
 * webpack compiler config with `target: 'webworker'` (see webpack.config.js's
 * `workerConfig`), NOT webpack's `new Worker(new URL(...))` magic-comment
 * syntax: that syntax only compiles the referenced module when written as one
 * literal inline expression, which we can't do here (the URL has to be
 * wrapped in a same-origin blob first — see `createWorker` above). It's a
 * separate compiler (not just a second entry in the main 'web'-target
 * config) so webpack-dev-server doesn't inject its HMR/live-reload client
 * into it — see workerConfig's comment in webpack.config.js for why that
 * matters. The compiler's output filename is predictable
 * (`network-analyzer-worker.mjs`, matching its entry key) precisely so it can
 * be referenced by a plain string below instead.
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
        // `webpackIgnore` tells webpack to leave this `new URL()` call alone
        // entirely at build time — without it, webpack statically parses ANY
        // `new URL(str, import.meta.url)` call and tries to resolve `str` as
        // a module request via its generic asset-module handling (which is
        // what caused both the raw-.ts-copy bug and, before the entry was
        // added, a "Module not found" build error for this exact string). We
        // want a plain runtime URL resolved by the browser against this
        // chunk's own base URL, pointing at the separately-compiled
        // "network-analyzer-worker" entry (see webpack.config.js's `entry`),
        // whose output filename is predictably `network-analyzer-worker.mjs`.
        const scriptUrl = new URL(/* webpackIgnore: true */ 'network-analyzer-worker.mjs', import.meta.url)
        const worker = createWorker(scriptUrl)
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
