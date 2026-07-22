/**
 * Module-level store of the last analysis result per network, shared between
 * every independently-mounted consumer (the Apps menu item and the results
 * panel are separate React trees, so plain component state can't bridge them).
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

export function setAnalysisResult(networkId: string, result: NetworkAnalysisResult): void {
  results.set(networkId, result)
  emitChange()
}

/** The last analysis result for `networkId`, or undefined if it hasn't been analyzed yet. */
export function useAnalysisResult(networkId: string): NetworkAnalysisResult | undefined {
  return useSyncExternalStore(subscribe, () => results.get(networkId))
}
