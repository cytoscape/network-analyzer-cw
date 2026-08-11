/**
 * Per-node/per-edge Network Analyzer metrics, written as table columns.
 * See networkAnalyzerTypes.ts for attribution and scope.
 *
 * Unlike the summary stats (networkAnalyzer.ts), which restrict undirected
 * mode to the largest connected component, these are computed for EVERY node
 * and edge in EVERY component — Java's `ConnectedComponentInfo.analyze()`
 * writes attributes for every component in the `for (component : components)`
 * loop; only the later `stats.copyStats(largest.getStats())` step restricts
 * the *summary*, and that step never touches node/edge table rows.
 *
 * Column names match the original Java `Msgs` attribute names exactly, so a
 * user comparing against Cytoscape Desktop recognizes them immediately.
 *
 * Not ported: `NumberOfDirectedEdges`/`NumberOfUndirectedEdges` — these need a
 * per-edge "is this edge directed" flag that CW's Edge/EdgeData model doesn't
 * carry (CW treats a whole analysis run as uniformly directed or undirected,
 * not a per-edge mix), so they'd be degenerate/meaningless here.
 *
 * Internally iterates by integer node/edge index (see networkAnalyzerGraph.ts)
 * for performance; converts back to string ids only when writing the final
 * output maps, since `cyweb/TableApi`'s `CellEdit.id` needs real element ids.
 */
import { computeBetweenness, normalizationFactor } from './networkAnalyzerBetweenness'
import {
  BfsResult,
  computeAllNodeBfs,
  countClosedNeighborPairs,
  findComponents,
  NetworkGraph,
} from './networkAnalyzerGraph'
import { IdentifiedEdge, NetworkAnalysisOptions } from './networkAnalyzerTypes'

export type ColumnValue = number | boolean
/** columnName -> nodeId/edgeId -> value */
export type ColumnValues = Map<string, Map<string, ColumnValue>>

export interface NetworkAnalyzerColumns {
  nodeColumns: ColumnValues
  edgeColumns: ColumnValues
}

function sumCounts(counts: Map<number, number> | undefined): number {
  let total = 0
  for (const count of counts?.values() ?? []) total += count
  return total
}

/**
 * Topological overlap of `node`'s neighborhood (undirected only): for each
 * neighbor's own neighbors (excluding `node` itself), counts how many are
 * shared with `node`'s neighborhood, normalized by (distinct shared
 * neighbors * degree). Mirrors UndirNetworkAnalyzer.computeTC.
 *
 * Uses two reusable scratch buffers instead of `Set`s: `isNeighborScratch`
 * marks this node's own any-direction neighbors for O(1) membership checks;
 * `seenScratch`/`seenList` dedupe distinct common-neighbor nodes seen while
 * scanning. Both are cleared incrementally (only the touched entries), not
 * reset in full per node.
 */
function computeTopologicalCoefficient(
  node: number,
  anyOffsets: Int32Array,
  anyTargets: Int32Array,
  isNeighborScratch: Uint8Array,
  seenScratch: Uint8Array,
  seenList: Int32Array,
): number {
  const start = anyOffsets[node]
  const end = anyOffsets[node + 1]
  const k = end - start
  if (k === 0) return 0

  for (let i = start; i < end; i++) isNeighborScratch[anyTargets[i]] = 1

  let tc = 0
  let commonCount = 0
  let seenCount = 0
  for (let i = start; i < end; i++) {
    const neighbor = anyTargets[i]
    const nStart = anyOffsets[neighbor]
    const nEnd = anyOffsets[neighbor + 1]
    for (let j = nStart; j < nEnd; j++) {
      const nOfNeighbor = anyTargets[j]
      if (nOfNeighbor === node) continue
      tc++
      if (seenScratch[nOfNeighbor] === 0) {
        seenScratch[nOfNeighbor] = 1
        seenList[seenCount++] = nOfNeighbor
        commonCount++
        if (isNeighborScratch[nOfNeighbor] === 1) tc++
      }
    }
  }

  for (let i = start; i < end; i++) isNeighborScratch[anyTargets[i]] = 0
  for (let i = 0; i < seenCount; i++) seenScratch[seenList[i]] = 0

  // A node whose neighbors have no other connections (e.g. a star's center)
  // has no common-neighbor nodes at all — Java leaves this as an unguarded
  // 0/0 (NaN); we return 0 instead, consistent with our other degenerate-case guards.
  return commonCount > 0 ? tc / (commonCount * k) : 0
}

function setColumn(columns: ColumnValues, name: string, id: string, value: ColumnValue): void {
  let column = columns.get(name)
  if (column === undefined) {
    column = new Map()
    columns.set(name, column)
  }
  column.set(id, value)
}

/**
 * Computes every per-node/per-edge Network Analyzer table column for the
 * given graph. `edges` (with element ids) are only needed to map the
 * per-node-pair edge betweenness value back onto literal edge ids.
 */
export function computeNetworkAnalyzerColumns(
  graph: NetworkGraph,
  edges: IdentifiedEdge[],
  options: NetworkAnalysisOptions,
  precomputedBfs?: BfsResult[],
): NetworkAnalyzerColumns {
  const {
    nodeIds,
    nodeIndex,
    anyOffsets,
    anyTargets,
    anyEdgeIds,
    anyEdgeCount,
    anyPairEdgeId,
    outOffsets,
    outTargets,
    outEdgeIds,
    outEdgeCount,
    outPairEdgeId,
    anyNeighborCounts,
    outNeighborCounts,
    inNeighborCounts,
    selfLoopCounts,
  } = graph
  const nodeCount = nodeIds.length
  const directed = options.directed
  const offsets = directed ? outOffsets : anyOffsets
  const targets = directed ? outTargets : anyTargets
  const edgeIds = directed ? outEdgeIds : anyEdgeIds
  const edgeCount = directed ? outEdgeCount : anyEdgeCount
  const pairEdgeId = directed ? outPairEdgeId : anyPairEdgeId

  const components = findComponents(nodeCount, anyOffsets, anyTargets)
  const componentSizeByNode = new Int32Array(nodeCount)
  for (const component of components) {
    for (const node of component) componentSizeByNode[node] = component.length
  }

  // Per-node eccentricity/average shortest path length — same BFS traversal
  // the summary stats need; reuse it if the caller already ran it (e.g.
  // useAnalyzeNetworkAction.ts, which needs both summary and columns) rather
  // than paying for this O(V·(V+E)) pass twice.
  const allNodesBfs = precomputedBfs ?? computeAllNodeBfs(nodeCount, offsets, targets)

  // Each component's own diameter (max eccentricity within it) — Radiality
  // uses the node's OWN component's diameter, not the giant-component-only
  // diameter the summary stats report.
  const componentDiameterByNode = new Int32Array(nodeCount)
  for (const component of components) {
    let diameter = 0
    for (const node of component) diameter = Math.max(diameter, allNodesBfs[node].eccentricity)
    for (const node of component) componentDiameterByNode[node] = diameter
  }

  const { betweenness, stress, edgeBetweenness } = computeBetweenness(nodeCount, offsets, targets, edgeIds, edgeCount)

  const nodeColumns: ColumnValues = new Map()
  const isNeighborScratch = new Uint8Array(nodeCount)
  const seenScratch = directed ? undefined : new Uint8Array(nodeCount)
  const seenList = directed ? undefined : new Int32Array(nodeCount)

  for (let node = 0; node < nodeCount; node++) {
    const nodeId = nodeIds[node]
    const anyStart = anyOffsets[node]
    const anyEnd = anyOffsets[node + 1]
    const anyDegree = anyEnd - anyStart
    const selfLoops = selfLoopCounts[node]
    const isSingleNode = anyDegree === 0

    let multiEdgePartners = 0
    for (const count of anyNeighborCounts[node].values()) {
      if (count > 1) multiEdgePartners++
    }

    let neighborhoodConnectivity = 0
    if (anyDegree > 0) {
      let sum = 0
      for (let i = anyStart; i < anyEnd; i++) {
        const neighbor = anyTargets[i]
        sum += anyOffsets[neighbor + 1] - anyOffsets[neighbor]
      }
      neighborhoodConnectivity = sum / anyDegree
    }

    const { eccentricity, reachableCount, totalLength } = allNodesBfs[node]
    const apl = reachableCount > 0 ? totalLength / reachableCount : 0
    const closeness = apl > 0 ? 1 / apl : 0
    const componentSize = componentSizeByNode[node]
    const betweennessCentrality = betweenness[node] * normalizationFactor(componentSize)
    const nodeStress = stress[node]

    setColumn(nodeColumns, 'SelfLoops', nodeId, selfLoops)
    setColumn(nodeColumns, 'PartnerOfMultiEdgedNodePairs', nodeId, multiEdgePartners)
    setColumn(nodeColumns, 'IsSingleNode', nodeId, isSingleNode)
    setColumn(nodeColumns, 'NeighborhoodConnectivity', nodeId, neighborhoodConnectivity)
    setColumn(nodeColumns, 'Eccentricity', nodeId, eccentricity)
    setColumn(nodeColumns, 'AverageShortestPathLength', nodeId, apl)
    setColumn(nodeColumns, 'ClosenessCentrality', nodeId, closeness)
    setColumn(nodeColumns, 'BetweennessCentrality', nodeId, betweennessCentrality)
    setColumn(nodeColumns, 'Stress', nodeId, nodeStress)

    if (directed) {
      const inDegree = sumCounts(inNeighborCounts[node])
      const outDegree = sumCounts(outNeighborCounts[node])
      setColumn(nodeColumns, 'Indegree', nodeId, inDegree)
      setColumn(nodeColumns, 'Outdegree', nodeId, outDegree)
      setColumn(nodeColumns, 'EdgeCount', nodeId, inDegree + outDegree)
      // Total degree, written under the same `Degree` name the undirected
      // branch uses so the charts have one degree column in both modes (Java
      // writes only `EdgeCount` here).
      setColumn(nodeColumns, 'Degree', nodeId, inDegree + outDegree)

      const clusteringCoefficient =
        anyDegree > 1
          ? countClosedNeighborPairs(anyStart, anyEnd, anyTargets, outOffsets, outTargets, isNeighborScratch) /
            (anyDegree * (anyDegree - 1))
          : 0
      setColumn(nodeColumns, 'ClusteringCoefficient', nodeId, clusteringCoefficient)
    } else {
      const degree = sumCounts(anyNeighborCounts[node]) + 2 * selfLoops
      setColumn(nodeColumns, 'Degree', nodeId, degree)

      const clusteringCoefficient =
        anyDegree > 1
          ? countClosedNeighborPairs(anyStart, anyEnd, anyTargets, anyOffsets, anyTargets, isNeighborScratch) /
            (anyDegree * (anyDegree - 1))
          : 0
      setColumn(nodeColumns, 'ClusteringCoefficient', nodeId, clusteringCoefficient)

      setColumn(
        nodeColumns,
        'TopologicalCoefficient',
        nodeId,
        computeTopologicalCoefficient(node, anyOffsets, anyTargets, isNeighborScratch, seenScratch!, seenList!),
      )

      const componentDiameter = componentDiameterByNode[node]
      const radiality = componentDiameter > 0 ? (componentDiameter + 1 - apl) / componentDiameter : 0
      setColumn(nodeColumns, 'Radiality', nodeId, radiality)
    }
  }

  const edgeBetweennessColumn = new Map<string, ColumnValue>()
  for (const { id, sourceId, targetId } of edges) {
    if (sourceId === targetId) continue // self-loops have no betweenness
    const s = nodeIndex.get(sourceId)
    const t = nodeIndex.get(targetId)
    if (s === undefined || t === undefined) continue
    const key = directed ? s * nodeCount + t : s < t ? s * nodeCount + t : t * nodeCount + s
    const logicalEdgeId = pairEdgeId.get(key)
    edgeBetweennessColumn.set(id, logicalEdgeId !== undefined ? edgeBetweenness[logicalEdgeId] : 0)
  }
  const edgeColumns: ColumnValues = new Map([['EdgeBetweenness', edgeBetweennessColumn]])

  return { nodeColumns, edgeColumns }
}
