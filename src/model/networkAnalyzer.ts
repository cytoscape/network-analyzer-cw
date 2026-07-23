/**
 * Network Analyzer "Summary Statistics" — scalar network-level statistics.
 * See networkAnalyzerTypes.ts for attribution and scope notes.
 *
 * Formulas mirror UndirNetworkAnalyzer.computeAll() / DirNetworkAnalyzer.computeAll()
 * in the org.cytoscape.analyzer "Analyzer" app, restricted to the scalar
 * `simpleParams` (no degree/C(k)/betweenness/stress/closeness distributions,
 * no node/edge table writes).
 *
 * IMPORTANT asymmetry, verified against that source (UndirNetworkAnalyzer
 * computes every component's own stats via ConnectedComponentInfo, then does
 * `stats.copyStats(largest.getStats())` — silently replacing every simple
 * stat that isn't already set with the largest component's value; DirNetworkAnalyzer
 * finds the largest component too but never copies its stats, so directed
 * analysis stays whole-network). We replicate this exactly rather than
 * "fixing" it, since the goal is matching the reference tool's real behavior:
 *  - undirected: nodeCount/edgeCount/connectedComponents are whole-network;
 *    every other stat (avNeighbors, density, centralization, heterogeneity,
 *    clusteringCoefficient, diameter, radius, avgShortestPathLength,
 *    connectedPairs, isolatedNodes, selfLoops, multiEdgeNodePairs) is computed
 *    over ONLY the largest connected component.
 *  - directed: everything is whole-network, no restriction.
 */
import {
  BfsResult,
  buildGraph,
  computeAllNodeBfs,
  countClosedNeighborPairs,
  countMultiEdgeNodePairs,
  findComponents,
  largestComponent,
  NetworkGraph,
  sumSelfLoops,
} from './networkAnalyzerGraph'
import { EdgeEndpoints, NetworkAnalysisOptions, NetworkAnalysisResult } from './networkAnalyzerTypes'

/**
 * Shortest-path summary across `indices`, reading from an already-computed
 * per-node BFS result array (see `computeAllNodeBfs`) rather than re-running
 * BFS — `bfsResults` is expected to be indexed by node index.
 */
function computePathStats(indices: number[], bfsResults: BfsResult[]) {
  let diameter = 0
  let radius = 0
  let connectedPairs = 0
  let totalLength = 0
  let sawPositiveEccentricity = false

  for (const i of indices) {
    const { eccentricity, reachableCount, totalLength: nodeTotalLength } = bfsResults[i]
    if (eccentricity > diameter) diameter = eccentricity
    if (eccentricity > 0 && (!sawPositiveEccentricity || eccentricity < radius)) {
      radius = eccentricity
      sawPositiveEccentricity = true
    }
    connectedPairs += reachableCount
    totalLength += nodeTotalLength
  }

  const avgShortestPathLength = connectedPairs > 0 ? totalLength / connectedPairs : 0
  return { diameter, radius, connectedPairs, avgShortestPathLength }
}

type SummaryStats = Omit<NetworkAnalysisResult, 'analysisTimeMs' | 'directed' | 'edgeCount'>

function analyzeUndirected(graph: NetworkGraph, allNodesBfs: BfsResult[]): SummaryStats {
  const nodeCount = graph.nodeIds.length
  const components = findComponents(nodeCount, graph.anyOffsets, graph.anyTargets)
  const connectedComponents = components.length

  // Everything below is scoped to the largest connected component only — see
  // the module-level comment for why. No induced subgraph is needed: every
  // neighbor of a node inside the largest component is, by definition of
  // connectivity, also inside it — so reading directly from `graph`'s own
  // CSR restricted to `componentNodes` gives identical results to an
  // induced-subgraph copy, without the extra allocation.
  const componentNodes = largestComponent(components)
  const { anyOffsets, anyTargets } = graph
  const componentSize = componentNodes.length
  const scratch = new Uint8Array(nodeCount)

  let neighborSum = 0
  let neighborSqSum = 0
  let maxNeighborCount = 0
  let isolatedNodes = 0
  let clusteringSum = 0

  for (const node of componentNodes) {
    const start = anyOffsets[node]
    const end = anyOffsets[node + 1]
    const k = end - start
    neighborSum += k
    neighborSqSum += k * k
    if (k > maxNeighborCount) maxNeighborCount = k
    if (k === 0) isolatedNodes++

    if (k > 1) {
      const closed = countClosedNeighborPairs(start, end, anyTargets, anyOffsets, anyTargets, scratch)
      clusteringSum += closed / (k * (k - 1))
    }
  }

  const avNeighbors = componentSize > 0 ? neighborSum / componentSize : 0
  const density = componentSize > 1 ? avNeighbors / (componentSize - 1) : 0
  const centralization =
    componentSize > 2
      ? (componentSize / (componentSize - 2)) * (maxNeighborCount / (componentSize - 1) - density)
      : 0
  const heterogeneity =
    neighborSum > 0 ? Math.sqrt((neighborSqSum * componentSize) / (neighborSum * neighborSum) - 1) : 0
  const clusteringCoefficient = componentSize > 0 ? clusteringSum / componentSize : 0

  const { diameter, radius, connectedPairs, avgShortestPathLength } = computePathStats(
    componentNodes,
    allNodesBfs,
  )

  return {
    nodeCount,
    avNeighbors,
    density,
    centralization,
    heterogeneity,
    clusteringCoefficient,
    connectedComponents,
    diameter,
    radius,
    avgShortestPathLength,
    connectedPairs,
    isolatedNodes,
    selfLoops: sumSelfLoops(graph.selfLoopCounts, componentNodes),
    multiEdgeNodePairs: countMultiEdgeNodePairs(graph.anyNeighborCounts, componentNodes),
  }
}

function analyzeDirected(graph: NetworkGraph, allNodesBfs: BfsResult[]): SummaryStats {
  const nodeCount = graph.nodeIds.length
  const { anyOffsets, anyTargets, outOffsets, outTargets } = graph
  const scratch = new Uint8Array(nodeCount)
  const allIndices: number[] = new Array(nodeCount)

  let neighborSum = 0
  let outNeighborSum = 0
  let isolatedNodes = 0
  let clusteringSum = 0

  for (let node = 0; node < nodeCount; node++) {
    allIndices[node] = node
    const anyStart = anyOffsets[node]
    const anyEnd = anyOffsets[node + 1]
    const k = anyEnd - anyStart
    neighborSum += k
    outNeighborSum += outOffsets[node + 1] - outOffsets[node]
    if (k === 0) isolatedNodes++

    if (k > 1) {
      const closed = countClosedNeighborPairs(anyStart, anyEnd, anyTargets, outOffsets, outTargets, scratch)
      clusteringSum += closed / (k * (k - 1))
    }
  }

  const avNeighbors = nodeCount > 0 ? neighborSum / nodeCount : 0
  const density = nodeCount > 1 ? outNeighborSum / (nodeCount * (nodeCount - 1)) : 0
  const clusteringCoefficient = nodeCount > 0 ? clusteringSum / nodeCount : 0

  const { diameter, radius, connectedPairs, avgShortestPathLength } = computePathStats(allIndices, allNodesBfs)

  return {
    nodeCount,
    avNeighbors,
    density,
    centralization: null,
    heterogeneity: null,
    clusteringCoefficient,
    // Connected components are always weak (ANY-direction), matching
    // ConnComponentAnalyzer's behavior for both directed and undirected networks.
    connectedComponents: findComponents(nodeCount, anyOffsets, anyTargets).length,
    diameter,
    radius,
    avgShortestPathLength,
    connectedPairs,
    isolatedNodes,
    selfLoops: sumSelfLoops(graph.selfLoopCounts, allIndices),
    multiEdgeNodePairs: countMultiEdgeNodePairs(graph.anyNeighborCounts, allIndices),
  }
}

/**
 * Graph + all-node BFS results already computed elsewhere (e.g. because the
 * caller is also computing per-node table columns, which need the exact same
 * BFS pass — see networkAnalyzerColumns.ts / useAnalyzeNetworkAction.ts).
 * Passing this in lets `analyzeNetwork` skip redoing that O(V·(V+E)) work.
 * `sharedComputeMs` is folded into the returned `analysisTimeMs` so the
 * reported cost stays honest even though the work is shared with other output.
 */
export interface PrecomputedAnalysis {
  graph: NetworkGraph
  allNodesBfs: BfsResult[]
  sharedComputeMs: number
}

/**
 * Runs the Network Analyzer "Summary Statistics" computation over the given
 * network elements. `edges` provide raw endpoints only — by default the graph
 * and its BFS pass are (re)built from scratch; pass `precomputed` to reuse
 * work already done by a caller that also needs per-node/edge table columns.
 */
export function analyzeNetwork(
  nodeIds: string[],
  edges: EdgeEndpoints[],
  options: NetworkAnalysisOptions,
  precomputed?: PrecomputedAnalysis,
): NetworkAnalysisResult {
  const start = performance.now()

  const graph = precomputed?.graph ?? buildGraph(nodeIds, edges)
  const offsets = options.directed ? graph.outOffsets : graph.anyOffsets
  const targets = options.directed ? graph.outTargets : graph.anyTargets
  const allNodesBfs = precomputed?.allNodesBfs ?? computeAllNodeBfs(graph.nodeIds.length, offsets, targets)

  const summary = options.directed
    ? analyzeDirected(graph, allNodesBfs)
    : analyzeUndirected(graph, allNodesBfs)

  const analysisTimeMs = (precomputed?.sharedComputeMs ?? 0) + (performance.now() - start)

  return {
    ...summary,
    directed: options.directed,
    edgeCount: edges.length,
    analysisTimeMs,
  }
}
