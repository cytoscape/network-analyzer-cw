/**
 * Round-trip tests for the JSON form the analysis results are stored in
 * through the host's per-app storage (`appData`). What matters here is that
 * the value survives JSON — the host round-trips every value it stores — and
 * that a malformed or older payload is dropped rather than half-read.
 *
 * Uses Node's built-in test runner (no extra dependencies):
 *   node --test   (via `npm test`)
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ANALYSIS_PAYLOAD_VERSION,
  fromStoredResult,
  toStoredResult,
} from './analysisResultPersistence'
import { NetworkAnalysisResult } from './networkAnalyzerTypes'

const undirectedResult: NetworkAnalysisResult = {
  directed: false,
  nodeCount: 4,
  edgeCount: 4,
  avNeighbors: 2,
  density: 0.6667,
  centralization: 0.3333,
  heterogeneity: 0.2041,
  clusteringCoefficient: 0.8333,
  connectedComponents: 1,
  diameter: 2,
  radius: 1,
  avgShortestPathLength: 1.1667,
  connectedPairs: 12,
  isolatedNodes: 0,
  selfLoops: 0,
  multiEdgeNodePairs: 0,
  analysisTimeMs: 0.42,
}

const directedResult: NetworkAnalysisResult = {
  ...undirectedResult,
  directed: true,
  centralization: null,
  heterogeneity: null,
}

/** What the host does to every value it stores. */
const throughJson = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value))

/**
 * What `appData.get()` actually hands back: the object the host holds in its
 * own Immer store, deeply frozen (Immer's autofreeze is never disabled there).
 */
const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) return value
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
  return Object.freeze(value)
}

/** One stored value, exactly as a read from the host produces it. */
const asStoredByHost = (result: NetworkAnalysisResult): unknown =>
  deepFreeze(throughJson(toStoredResult(result)))

test('an undirected result survives the JSON round trip unchanged', () => {
  const restored = fromStoredResult(throughJson(toStoredResult(undirectedResult)))
  assert.deepEqual(restored, undirectedResult)
})

test('a directed result keeps its null-valued undirected-only statistics', () => {
  const restored = fromStoredResult(throughJson(toStoredResult(directedResult)))
  assert.deepEqual(restored, directedResult)
  assert.equal(restored?.centralization, null)
  assert.equal(restored?.heterogeneity, null)
})

test('the restored result is a fresh, writable object, not the frozen store copy', () => {
  const stored = asStoredByHost(undirectedResult)
  const restored = fromStoredResult(stored)
  assert.ok(restored !== null)
  assert.notEqual(restored, (stored as { result: unknown }).result)
  assert.ok(!Object.isFrozen(restored))
  // Writing to it must not throw — a frozen object would.
  restored.analysisTimeMs = 1
  assert.equal(restored.analysisTimeMs, 1)
})

test('the payload carries the current version', () => {
  assert.equal(toStoredResult(undirectedResult).version, ANALYSIS_PAYLOAD_VERSION)
})

test('a payload from another version is dropped', () => {
  const stored = throughJson(toStoredResult(undirectedResult)) as { version: number }
  stored.version = ANALYSIS_PAYLOAD_VERSION + 1
  assert.equal(fromStoredResult(stored), null)
})

test('something that is not a payload at all is dropped', () => {
  for (const value of [undefined, null, 42, 'results', [], {}, { version: ANALYSIS_PAYLOAD_VERSION }]) {
    assert.equal(fromStoredResult(value), null, `for ${JSON.stringify(value)}`)
  }
})

test('a result with a missing or mistyped statistic is dropped', () => {
  const missing = throughJson(toStoredResult(undirectedResult)) as { result: Record<string, unknown> }
  delete missing.result.diameter
  assert.equal(fromStoredResult(missing), null)

  const mistyped = throughJson(toStoredResult(undirectedResult)) as { result: Record<string, unknown> }
  mistyped.result.nodeCount = '4'
  assert.equal(fromStoredResult(mistyped), null)

  const notBoolean = throughJson(toStoredResult(undirectedResult)) as { result: Record<string, unknown> }
  notBoolean.result.directed = 'false'
  assert.equal(fromStoredResult(notBoolean), null)
})

test('a statistic that JSON turned into null (NaN or Infinity) drops the result', () => {
  // Only the two undirected-only statistics may be null; any other null means
  // the analysis produced a non-number, which is not worth restoring.
  const stored = throughJson(toStoredResult({ ...undirectedResult, avgShortestPathLength: NaN }))
  assert.equal((stored as { result: { avgShortestPathLength: unknown } }).result.avgShortestPathLength, null)
  assert.equal(fromStoredResult(stored), null)
})

test('a field this build does not know is left behind', () => {
  const stored = throughJson(toStoredResult(undirectedResult)) as { result: Record<string, unknown> }
  stored.result.someFutureStatistic = 7
  const restored = fromStoredResult(stored)
  assert.deepEqual(restored, undirectedResult)
  assert.ok(!('someFutureStatistic' in (restored as object)))
})
