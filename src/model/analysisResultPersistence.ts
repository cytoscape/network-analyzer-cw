/**
 * JSON form of a network's analysis result, for the host's per-app storage
 * (`AppContext.apis.appData`). Pure conversion: no API access, no React.
 * `analysisAppData.ts` does the reading and writing.
 *
 * `NetworkAnalysisResult` is already a flat record of numbers, booleans and
 * nulls, so it needs no reshaping — the payload just wraps it in a version.
 * The version is what lets a later build change a field's meaning and drop
 * older payloads rather than half-read them: the statistics are recomputable.
 *
 * Everything read back is validated. The value comes out of IndexedDB, written
 * by a possibly older build of this app, so it is external input: a bad record
 * is dropped, never trusted into the store.
 */
import { NetworkAnalysisResult } from './networkAnalyzerTypes'

/** Bump when a field changes meaning; older payloads are then discarded. */
export const ANALYSIS_PAYLOAD_VERSION = 1

/** What one `appData` entry holds: the last analysis result of one network. */
export interface StoredAnalysisPayload {
  version: number
  result: NetworkAnalysisResult
}

/** The payload to store for one network's result. */
export const toStoredResult = (
  result: NetworkAnalysisResult,
): StoredAnalysisPayload => ({
  version: ANALYSIS_PAYLOAD_VERSION,
  result,
})

// ── Reading back ────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Finite only. JSON has no NaN or Infinity — both become `null` on write — so
 * a statistic that was not a real number cannot come back as one, and a
 * payload holding one is not worth restoring.
 */
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Every numeric statistic, in the order `NetworkAnalysisResult` declares them. */
const NUMBER_FIELDS = [
  'nodeCount',
  'edgeCount',
  'avNeighbors',
  'density',
  'clusteringCoefficient',
  'connectedComponents',
  'diameter',
  'radius',
  'avgShortestPathLength',
  'connectedPairs',
  'isolatedNodes',
  'selfLoops',
  'multiEdgeNodePairs',
  'analysisTimeMs',
] as const

/** The two undirected-only statistics, `null` for a directed analysis. */
const NULLABLE_NUMBER_FIELDS = ['centralization', 'heterogeneity'] as const

// Compile-time exhaustiveness: a field added to `NetworkAnalysisResult` and
// left out of both lists would be copied below without validation. This line
// then fails to type-check (the tuple wrapping stops `never` distributing).
type UncoveredKey = Exclude<
  keyof NetworkAnalysisResult,
  (typeof NUMBER_FIELDS)[number] | (typeof NULLABLE_NUMBER_FIELDS)[number] | 'directed'
>
const _everyFieldValidated: [UncoveredKey] extends [never] ? true : never = true
void _everyFieldValidated

const isStoredResult = (value: unknown): value is NetworkAnalysisResult =>
  isRecord(value) &&
  typeof value.directed === 'boolean' &&
  NUMBER_FIELDS.every((field) => isFiniteNumber(value[field])) &&
  NULLABLE_NUMBER_FIELDS.every(
    (field) => value[field] === null || isFiniteNumber(value[field]),
  )

/** True when `value` is a payload this build can read. */
export const isStoredAnalysisPayload = (
  value: unknown,
): value is StoredAnalysisPayload =>
  isRecord(value) &&
  value.version === ANALYSIS_PAYLOAD_VERSION &&
  isStoredResult(value.result)

/**
 * Rebuild one network's result from a stored payload, or `null` for anything
 * this build cannot read.
 *
 * The result is COPIED out of the payload, field by field. `appData.get()`
 * hands back the object the host holds in its own Immer store, which is
 * deeply frozen; a copy is what makes a restored result behave like a freshly
 * computed one. Only the declared fields are copied, so a key an older build
 * wrote and this one dropped does not ride along.
 */
export const fromStoredResult = (value: unknown): NetworkAnalysisResult | null => {
  if (!isStoredAnalysisPayload(value)) return null
  const { result } = value
  return {
    directed: result.directed,
    nodeCount: result.nodeCount,
    edgeCount: result.edgeCount,
    avNeighbors: result.avNeighbors,
    density: result.density,
    centralization: result.centralization,
    heterogeneity: result.heterogeneity,
    clusteringCoefficient: result.clusteringCoefficient,
    connectedComponents: result.connectedComponents,
    diameter: result.diameter,
    radius: result.radius,
    avgShortestPathLength: result.avgShortestPathLength,
    connectedPairs: result.connectedPairs,
    isolatedNodes: result.isolatedNodes,
    selfLoops: result.selfLoops,
    multiEdgeNodePairs: result.multiEdgeNodePairs,
    analysisTimeMs: result.analysisTimeMs,
  }
}
