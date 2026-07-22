/**
 * Graph construction and traversal helpers for the Network Analyzer port.
 * See networkAnalyzerTypes.ts for attribution.
 *
 * Uses simple Map/Set-based adjacency rather than the original Java's
 * low-level int-array (CSR) representation and thread pool — appropriate
 * here since this runs single-threaded in JS, and the Java version's array
 * optimization existed specifically to support multi-threaded traversal.
 *
 * Node self-references are always excluded from adjacency (matches
 * CyNetworkUtils.getNeighbors/getNeighborMap in the original); self-loops are
 * tracked per node instead, since undirected analysis restricts most stats to
 * the largest connected component (see networkAnalyzer.ts) and needs to
 * re-total self-loops/multi-edges over just that subset.
 */
import { EdgeEndpoints } from './networkAnalyzerTypes'

export interface NetworkGraph {
  nodeIds: string[]
  /** Distinct ANY-direction neighbors per node (self excluded). */
  anyNeighbors: Map<string, Set<string>>
  /** Distinct out-neighbors per node (self excluded); meaningful in directed mode. */
  outNeighbors: Map<string, Set<string>>
  /**
   * ANY-direction neighbor edge-occurrence counts per node, used to detect
   * multi-edge node pairs (matches CyNetworkUtils.getNeighborMap's frequency map).
   */
  anyNeighborCounts: Map<string, Map<string, number>>
  /**
   * Raw (with-multiplicity) out-/in-edge occurrence counts per node — unlike
   * `outNeighbors`/`anyNeighbors` (distinct neighbor sets), these count every
   * parallel edge separately. Used for directed mode's Indegree/Outdegree/
   * EdgeCount table columns, which mirror Java's raw `getAdjacentEdgeList` size.
   */
  outNeighborCounts: Map<string, Map<string, number>>
  inNeighborCounts: Map<string, Map<string, number>>
  /** Self-loop edge count per node. */
  selfLoopCounts: Map<string, number>
}

/** Result of a single-source BFS, mirroring the original's PathLengthData. */
export interface BfsResult {
  /** Longest shortest-path distance found from the source (0 if isolated). */
  eccentricity: number
  /** Number of other nodes reachable from the source. */
  reachableCount: number
  /** Sum of shortest-path distances to all reachable nodes. */
  totalLength: number
}

function addNeighbor(
  neighbors: Map<string, Set<string>>,
  counts: Map<string, Map<string, number>>,
  from: string,
  to: string,
): void {
  neighbors.get(from)!.add(to)
  const nodeCounts = counts.get(from)!
  nodeCounts.set(to, (nodeCounts.get(to) ?? 0) + 1)
}

function bumpCount(counts: Map<string, Map<string, number>>, from: string, to: string): void {
  const nodeCounts = counts.get(from)!
  nodeCounts.set(to, (nodeCounts.get(to) ?? 0) + 1)
}

export function buildGraph(nodeIds: string[], edges: EdgeEndpoints[]): NetworkGraph {
  const anyNeighbors = new Map<string, Set<string>>()
  const outNeighbors = new Map<string, Set<string>>()
  const anyNeighborCounts = new Map<string, Map<string, number>>()
  const outNeighborCounts = new Map<string, Map<string, number>>()
  const inNeighborCounts = new Map<string, Map<string, number>>()
  const selfLoopCounts = new Map<string, number>()

  for (const nodeId of nodeIds) {
    anyNeighbors.set(nodeId, new Set())
    outNeighbors.set(nodeId, new Set())
    anyNeighborCounts.set(nodeId, new Map())
    outNeighborCounts.set(nodeId, new Map())
    inNeighborCounts.set(nodeId, new Map())
    selfLoopCounts.set(nodeId, 0)
  }

  for (const { sourceId, targetId } of edges) {
    if (sourceId === targetId) {
      selfLoopCounts.set(sourceId, (selfLoopCounts.get(sourceId) ?? 0) + 1)
      continue
    }
    addNeighbor(anyNeighbors, anyNeighborCounts, sourceId, targetId)
    addNeighbor(anyNeighbors, anyNeighborCounts, targetId, sourceId)
    outNeighbors.get(sourceId)!.add(targetId)
    bumpCount(outNeighborCounts, sourceId, targetId)
    bumpCount(inNeighborCounts, targetId, sourceId)
  }

  return {
    nodeIds,
    anyNeighbors,
    outNeighbors,
    anyNeighborCounts,
    outNeighborCounts,
    inNeighborCounts,
    selfLoopCounts,
  }
}

/** Sum of per-node self-loop counts over the given nodes. */
export function sumSelfLoops(selfLoopCounts: Map<string, number>, nodeIds: Iterable<string>): number {
  let total = 0
  for (const nodeId of nodeIds) total += selfLoopCounts.get(nodeId) ?? 0
  return total
}

/** Number of node pairs connected by more than one edge (direction ignored). */
export function countMultiEdgeNodePairs(anyNeighborCounts: Map<string, Map<string, number>>): number {
  let partners = 0
  for (const counts of anyNeighborCounts.values()) {
    for (const count of counts.values()) {
      if (count > 1) partners++
    }
  }
  // Each multi-edge node pair is counted once from each endpoint.
  return partners / 2
}

/** All (weakly) connected components, always computed over ANY-direction adjacency. */
export function findComponents(nodeIds: string[], anyNeighbors: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  for (const start of nodeIds) {
    if (visited.has(start)) continue
    const component: string[] = [start]
    visited.add(start)
    const queue: string[] = [start]
    let head = 0
    while (head < queue.length) {
      const node = queue[head++]
      for (const neighbor of anyNeighbors.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
          component.push(neighbor)
        }
      }
    }
    components.push(component)
  }
  return components
}

/** The node ids of the largest of `components` (first-encountered wins ties). Empty if `components` is empty. */
export function largestComponent(components: string[][]): string[] {
  let largest: string[] = []
  for (const component of components) {
    if (component.length > largest.length) largest = component
  }
  return largest
}

/**
 * Restricts `graph` to the induced subgraph over `nodeSubset` — every
 * adjacency/count/self-loop map filtered down to just those nodes. Used to
 * recompute stats over a single connected component (see networkAnalyzer.ts).
 */
function filterCounts(
  counts: Map<string, number> | undefined,
  subset: Set<string>,
): Map<string, number> {
  const filtered = new Map<string, number>()
  for (const [neighbor, count] of counts ?? []) {
    if (subset.has(neighbor)) filtered.set(neighbor, count)
  }
  return filtered
}

export function inducedSubgraph(graph: NetworkGraph, nodeSubset: string[]): NetworkGraph {
  const subset = new Set(nodeSubset)
  const anyNeighbors = new Map<string, Set<string>>()
  const outNeighbors = new Map<string, Set<string>>()
  const anyNeighborCounts = new Map<string, Map<string, number>>()
  const outNeighborCounts = new Map<string, Map<string, number>>()
  const inNeighborCounts = new Map<string, Map<string, number>>()
  const selfLoopCounts = new Map<string, number>()

  for (const nodeId of nodeSubset) {
    anyNeighbors.set(
      nodeId,
      new Set([...(graph.anyNeighbors.get(nodeId) ?? [])].filter((n) => subset.has(n))),
    )
    outNeighbors.set(
      nodeId,
      new Set([...(graph.outNeighbors.get(nodeId) ?? [])].filter((n) => subset.has(n))),
    )
    anyNeighborCounts.set(nodeId, filterCounts(graph.anyNeighborCounts.get(nodeId), subset))
    outNeighborCounts.set(nodeId, filterCounts(graph.outNeighborCounts.get(nodeId), subset))
    inNeighborCounts.set(nodeId, filterCounts(graph.inNeighborCounts.get(nodeId), subset))
    selfLoopCounts.set(nodeId, graph.selfLoopCounts.get(nodeId) ?? 0)
  }

  return {
    nodeIds: nodeSubset,
    anyNeighbors,
    outNeighbors,
    anyNeighborCounts,
    outNeighborCounts,
    inNeighborCounts,
    selfLoopCounts,
  }
}

/** Ordered pairs (u, v) of `neighbors` such that `edgeExists(u, v)`, excluding u === v. */
export function countClosedNeighborPairs(
  neighbors: Set<string>,
  edgeExists: (u: string, v: string) => boolean,
): number {
  let closed = 0
  for (const u of neighbors) {
    for (const v of neighbors) {
      if (u !== v && edgeExists(u, v)) closed++
    }
  }
  return closed
}

/**
 * BFS from `source` over `adjacency` (pass `anyNeighbors` for undirected
 * traversal, `outNeighbors` for directed/forward-only traversal).
 */
export function bfsEccentricity(
  source: string,
  adjacency: Map<string, Set<string>>,
): BfsResult {
  const distance = new Map<string, number>([[source, 0]])
  const queue: string[] = [source]
  let head = 0
  let eccentricity = 0
  let totalLength = 0

  while (head < queue.length) {
    const node = queue[head++]
    const nodeDistance = distance.get(node)!
    for (const neighbor of adjacency.get(node) ?? []) {
      if (!distance.has(neighbor)) {
        const neighborDistance = nodeDistance + 1
        distance.set(neighbor, neighborDistance)
        queue.push(neighbor)
        eccentricity = Math.max(eccentricity, neighborDistance)
        totalLength += neighborDistance
      }
    }
  }

  return { eccentricity, reachableCount: distance.size - 1, totalLength }
}
