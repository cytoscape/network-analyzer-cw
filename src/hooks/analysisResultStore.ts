/**
 * Module-level store of the last analysis result per network, shared between
 * every independently-mounted consumer (the Apps menu item and the results
 * panel are separate React trees, so plain component state can't bridge them).
 *
 * This is the in-memory tier only. The host's per-app storage
 * (`AppContext.apis.appData`) is what carries a result across a reload or a
 * second tab, and `analysisAppData.ts` bridges the two: it subscribes here to
 * write every change, and restores a network's stored result on first sight.
 */
import { useSyncExternalStore } from 'react'
import { NetworkAnalysisResult } from '../model/networkAnalyzerTypes'

const results = new Map<string, NetworkAnalysisResult>()
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Subscribe to every store change from outside React. Used by
 * `analysisAppData` to write the results through the host's per-app storage —
 * persistence is a subscriber, not a call in each mutator, so a new mutator
 * is covered for free.
 */
export function subscribeAnalysisResults(listener: () => void): () => void {
  return subscribe(listener)
}

/** Non-hook read of every result, keyed by network id, for use outside React. */
export function getAnalysisResults(): ReadonlyMap<string, NetworkAnalysisResult> {
  return results
}

/** Non-hook read of one network's result, for use outside React renders. */
export function getAnalysisResult(networkId: string): NetworkAnalysisResult | undefined {
  return results.get(networkId)
}

export function setAnalysisResult(networkId: string, result: NetworkAnalysisResult): void {
  results.set(networkId, result)
  emitChange()
}

/** A network was deleted (or its result discarded): forget its result. */
export function removeAnalysisResult(networkId: string): void {
  if (results.delete(networkId)) emitChange()
}

/** The last analysis result for `networkId`, or undefined if it hasn't been analyzed yet. */
export function useAnalysisResult(networkId: string): NetworkAnalysisResult | undefined {
  return useSyncExternalStore(subscribe, () => results.get(networkId))
}
