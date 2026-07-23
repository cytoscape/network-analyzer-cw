/**
 * Web Worker entry point for the Network Analyzer pipeline. Pure algorithm
 * invocation — no React, no `cyweb/*` imports (those need main-thread access
 * to CW's stores/API and stay in `hooks/useAnalyzeNetworkAction.ts`).
 *
 * Runs as a CLASSIC worker (see webpack.config.js's `workerChunkLoading` and
 * `optimization.splitChunks` comments for why: the Module Federation remote
 * is served from a cross-origin blob inside the CW host page, and only a
 * classic worker's `importScripts()` — not a module worker's `import()` — can
 * resolve further chunks against this remote's own origin from that context).
 *
 * `NetworkAnalysisResult` (primitives) and `ColumnValues`
 * (`Map<string, Map<string, ColumnValue>>`) are both natively
 * structured-cloneable, so no manual (de)serialization is needed across the
 * `postMessage` boundary.
 */
import { analyzeNetwork } from './networkAnalyzer'
import { computeNetworkAnalyzerColumns, NetworkAnalyzerColumns } from './networkAnalyzerColumns'
import { buildGraph, computeAllNodeBfs } from './networkAnalyzerGraph'
import { IdentifiedEdge, NetworkAnalysisResult } from './networkAnalyzerTypes'

export interface NetworkAnalyzerWorkerInput {
  nodeIds: string[]
  edges: IdentifiedEdge[]
  directed: boolean
}

export interface NetworkAnalyzerWorkerOutput extends NetworkAnalyzerColumns {
  result: NetworkAnalysisResult
}

self.onmessage = (event: MessageEvent<NetworkAnalyzerWorkerInput>): void => {
  const { nodeIds, edges, directed } = event.data

  const sharedStart = performance.now()
  const graph = buildGraph(nodeIds, edges)
  const offsets = directed ? graph.outOffsets : graph.anyOffsets
  const targets = directed ? graph.outTargets : graph.anyTargets
  const allNodesBfs = computeAllNodeBfs(graph.nodeIds.length, offsets, targets)
  const sharedComputeMs = performance.now() - sharedStart

  const result = analyzeNetwork(nodeIds, edges, { directed }, { graph, allNodesBfs, sharedComputeMs })
  const { nodeColumns, edgeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed }, allNodesBfs)

  const output: NetworkAnalyzerWorkerOutput = { result, nodeColumns, edgeColumns }
  postMessage(output)
}
