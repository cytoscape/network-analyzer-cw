/**
 * Analysis results in the host's per-app storage — `AppContext.apis.appData`.
 *
 * WHAT THIS FIXES
 *   Results used to live only in `analysisResultStore`, module state that dies
 *   with the page. A reload — or the same workspace opened in a second tab of
 *   the same browser — lost every result while its Network Analyzer columns
 *   stayed on the network. The host persists per-app storage in IndexedDB and
 *   hydrates it at boot, before apps mount, so a result stored through it is
 *   there again in both cases.
 *
 * HOW THE HOST API IS USED
 *   appData.set(networkId, 'result', payload)   one entry per network
 *   appData.get(networkId, 'result')            synchronous
 *   appData.remove(networkId, 'result')         when the result is dropped
 *
 *   Entries are LOCAL by default: they never reach a CX2 download, an NDEx
 *   save or "Open in Cytoscape". Pass `{ export: true }` to `set` for a key
 *   that should travel with the network instead — see the note on EXPORTING
 *   below. Every call returns `ApiResult`, never throws.
 *
 * WIRING
 *   `NetworkAnalyzerApp.mount()` hands the api in (`setAppDataApi`). Writes
 *   then happen through a store subscription, so every mutator persists
 *   without its own call. Reads happen in the panel, per network, on mount
 *   and on every switch (`hydrateAnalysisResult`) — once per network per
 *   session, so a restore never overwrites a result computed since.
 *
 *   A React component that only needs the api can call `useAppDataApi()` from
 *   `cyweb/AppDataApi` instead; it returns the same per-app instance. The
 *   module-level holder here exists because the store subscription runs
 *   outside React.
 */
import type { AppDataApi, CyWebEvents } from '@cytoscape-web/api-types'

import {
  getAnalysisResults,
  removeAnalysisResult,
  setAnalysisResult,
  subscribeAnalysisResults,
} from '../hooks/analysisResultStore'
import { fromStoredResult, toStoredResult } from './analysisResultPersistence'

/** Per-network key: the last analysis result computed on that network. */
const RESULT_KEY = 'result'

let appData: AppDataApi | null = null
let unsubscribe: (() => void) | null = null

/** Networks already read back once; hydration must not undo later edits. */
const hydrated = new Set<string>()

/**
 * The JSON last written per network, so an unchanged result is not rewritten.
 * Its key set is also the list of networks to revisit when a result is
 * discarded — a network that no longer has one needs its entry removed, and
 * it is no longer in the store to be found from there.
 */
const lastWritten = new Map<string, string>()

const warn = (what: string, error: { code: string; message: string }): void => {
  console.warn(`Network Analyzer app data: ${what} — ${error.code} ${error.message}`)
}

/**
 * Take the host's per-app storage api (from `mount()`), or drop it (from
 * `unmount()`). Starts persisting every store change.
 */
export function setAppDataApi(api: AppDataApi | null): void {
  unsubscribe?.()
  unsubscribe = null
  window.removeEventListener('network:deleted', onNetworkDeleted)
  appData = api ?? null

  // `hydrated` and `lastWritten` deliberately survive: the results themselves
  // are still in the store (the module outlives a disable), so re-enabling
  // must not read the stored copy back over them.
  //
  // `api == null` and not `=== null`: a host without the appData domain hands
  // in `undefined`, and calling through that would throw inside the panel.
  if (appData === null) {
    if (api === undefined) {
      console.warn(
        'Network Analyzer app data: this host has no appData domain; results will not persist',
      )
    }
    return
  }

  unsubscribe = subscribeAnalysisResults(flushWrites)
  // Listened for here, not in the panel: the panel is unmounted while closed,
  // and a network deleted meanwhile must still drop its result.
  window.addEventListener('network:deleted', onNetworkDeleted)
}

/**
 * Read `networkId`'s stored result into the store, once per network per
 * session. Safe to call on every switch; a no-op the second time, so it never
 * overwrites a result computed since.
 */
export function hydrateAnalysisResult(networkId: string): void {
  const api = appData
  if (api === null || networkId === '' || hydrated.has(networkId)) return
  hydrated.add(networkId)

  const stored = api.get(networkId, RESULT_KEY)
  if (!stored.success) {
    // APP11 = nothing stored: the normal case for a never-analyzed network.
    if (stored.error.code !== 'APP11') {
      warn(`failed to read the result for network ${networkId}`, stored.error)
    }
    return
  }

  const result = fromStoredResult(stored.data.value)
  if (result === null) {
    console.warn(
      `Network Analyzer app data: the stored result for network ${networkId} was unreadable and has been dropped`,
    )
    return
  }
  // Seed the write cache BEFORE the store change notifies the writer, so the
  // hydration itself does not trigger a rewrite of the same bytes.
  lastWritten.set(networkId, JSON.stringify(toStoredResult(result)))
  setAnalysisResult(networkId, result)
}

/**
 * Forget a deleted network. The host drops both app-data tiers for a deleted
 * network itself, so there is nothing to remove there — only the result in
 * the store and the local bookkeeping, so a re-imported network with the same
 * id reads fresh.
 */
export function forgetNetwork(networkId: string): void {
  hydrated.delete(networkId)
  lastWritten.delete(networkId)
  removeAnalysisResult(networkId)
}

const onNetworkDeleted = (event: Event): void => {
  const { networkId } = (event as CustomEvent<CyWebEvents['network:deleted']>).detail
  forgetNetwork(networkId)
}

/**
 * Write every network whose result differs from what was last stored. Not
 * debounced: the store changes once per analysis, and a write is one small
 * record, so there is nothing to coalesce — and nothing to lose if the tab
 * closes right after an analysis.
 */
const flushWrites = (): void => {
  const api = appData
  if (api === null) return

  // Start from the networks last written so a dropped one is revisited, then
  // overlay what the store currently holds.
  const networkIds = new Set([...lastWritten.keys(), ...getAnalysisResults().keys()])

  for (const networkId of networkIds) {
    const result = getAnalysisResults().get(networkId)
    if (result === undefined) {
      // No result any more, yet one was written: `forgetNetwork` already
      // cleared a deleted network's bookkeeping, so this is a discard on a
      // network that still exists.
      if (!lastWritten.has(networkId)) continue
      const removed = api.remove(networkId, RESULT_KEY)
      if (removed.success) lastWritten.delete(networkId)
      else warn(`failed to remove the result for network ${networkId}`, removed.error)
      continue
    }

    const payload = toStoredResult(result)
    const json = JSON.stringify(payload)
    if (lastWritten.get(networkId) === json) continue

    const written = api.set(networkId, RESULT_KEY, payload)
    if (!written.success) {
      // APP1 = the network left the workspace mid-write. The result stays in
      // memory for this session; only the reload is lost.
      warn(`failed to store the result for network ${networkId}`, written.error)
      continue
    }
    lastWritten.set(networkId, json)
  }
}

// EXPORTING RESULTS WITH THE NETWORK
//
// `api.set(networkId, RESULT_KEY, payload, { export: true })` moves the entry
// into the network's `cyAppData` CX2 aspect: it is then saved to NDEx, present
// in every CX2 download, and marks the network modified. A key lives in
// exactly one tier, so switching the flag moves the entry rather than
// duplicating it. Network Analyzer keeps results local — the per-node and
// per-edge statistics already travel with the network as table columns, and
// the summary is recomputable from them in seconds.
