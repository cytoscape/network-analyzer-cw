/**
 * Graph construction and traversal helpers for the Network Analyzer port.
 * See networkAnalyzerTypes.ts for attribution.
 *
 * Uses integer-indexed CSR (Compressed Sparse Row) typed arrays for the hot
 * adjacency structures (any-/out-direction neighbors), mirroring the original
 * Java's own `int[]` array representation — its code comments credit a
 * contributor for this exact speed improvement over naive collections. An
 * earlier version of this port used `Map<string, Set<string>>` for
 * readability, but profiling showed that constant-factor cost (Map/Set
 * operations, string hashing) dominates wall-clock time on large networks far
 * more than the underlying O(V·(V+E)) algorithmic complexity does.
 *
 * Node self-references are always excluded from adjacency (matches
 * CyNetworkUtils.getNeighbors/getNeighborMap in the original); self-loops are
 * tracked per node instead, since undirected analysis restricts most stats to
 * the largest connected component (see networkAnalyzer.ts) and needs to
 * re-total self-loops/multi-edges over just that subset.
 *
 * Cold-path bookkeeping (`*NeighborCounts`, read once per node rather than
 * once per BFS/Brandes source) stays as small per-node `Map<number, number>`s
 * — negligible overhead at that call frequency, not worth CSR-ifying too.
 */
import { EdgeEndpoints } from './networkAnalyzerTypes'

export interface NetworkGraph {
  /** index -> original node id. */
  nodeIds: string[]
  /** original node id -> index. */
  nodeIndex: Map<string, number>

  // ANY-direction distinct-neighbor CSR (undirected traversal, degree, etc.)
  anyOffsets: Int32Array
  anyTargets: Int32Array
  /** Parallel to `anyTargets`: logical (direction-collapsed) edge id per slot. */
  anyEdgeIds: Int32Array
  anyEdgeCount: number
  /** `(min*nodeCount+max)` -> logical edge id; maps a literal edge back to its slot for output. */
  anyPairEdgeId: Map<number, number>

  // OUT-direction distinct-neighbor CSR (directed traversal).
  outOffsets: Int32Array
  outTargets: Int32Array
  outEdgeIds: Int32Array
  outEdgeCount: number
  /** `(s*nodeCount+t)` -> logical edge id. */
  outPairEdgeId: Map<number, number>

  /**
   * Raw (with-multiplicity) neighbor-occurrence counts per node, used for
   * Degree/Indegree/Outdegree/EdgeCount/multi-edge detection — unlike the CSR
   * arrays above (distinct neighbors), these count every parallel edge
   * separately. index -> (neighbor index -> occurrence count).
   */
  anyNeighborCounts: Array<Map<number, number>>
  outNeighborCounts: Array<Map<number, number>>
  inNeighborCounts: Array<Map<number, number>>
  /** Self-loop edge count per node. */
  selfLoopCounts: Int32Array
}

function bumpCount(counts: Map<number, number>, key: number): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/** Flattens per-node `Set<number>`s into CSR arrays, assigning each slot its logical edge id. */
function flattenCsr(
  nodeCount: number,
  neighborSets: Array<Set<number>>,
  edgeIdFor: (u: number, v: number) => number,
): { offsets: Int32Array; targets: Int32Array; edgeIds: Int32Array } {
  const offsets = new Int32Array(nodeCount + 1)
  for (let i = 0; i < nodeCount; i++) offsets[i + 1] = offsets[i] + neighborSets[i].size

  const targets = new Int32Array(offsets[nodeCount])
  const edgeIds = new Int32Array(offsets[nodeCount])
  const cursor = offsets.slice(0, nodeCount)

  for (let u = 0; u < nodeCount; u++) {
    for (const v of neighborSets[u]) {
      const pos = cursor[u]++
      targets[pos] = v
      edgeIds[pos] = edgeIdFor(u, v)
    }
  }

  return { offsets, targets, edgeIds }
}

export function buildGraph(nodeIds: string[], edges: EdgeEndpoints[]): NetworkGraph {
  const nodeCount = nodeIds.length
  const nodeIndex = new Map<string, number>()
  for (let i = 0; i < nodeCount; i++) nodeIndex.set(nodeIds[i], i)

  const anyNeighborSets: Array<Set<number>> = new Array(nodeCount)
  const outNeighborSets: Array<Set<number>> = new Array(nodeCount)
  const anyNeighborCounts: Array<Map<number, number>> = new Array(nodeCount)
  const outNeighborCounts: Array<Map<number, number>> = new Array(nodeCount)
  const inNeighborCounts: Array<Map<number, number>> = new Array(nodeCount)
  const selfLoopCounts = new Int32Array(nodeCount)

  for (let i = 0; i < nodeCount; i++) {
    anyNeighborSets[i] = new Set()
    outNeighborSets[i] = new Set()
    anyNeighborCounts[i] = new Map()
    outNeighborCounts[i] = new Map()
    inNeighborCounts[i] = new Map()
  }

  const anyPairEdgeId = new Map<number, number>()
  const outPairEdgeId = new Map<number, number>()
  let nextAnyEdgeId = 0
  let nextOutEdgeId = 0

  for (const { sourceId, targetId } of edges) {
    const s = nodeIndex.get(sourceId)
    const t = nodeIndex.get(targetId)
    if (s === undefined || t === undefined) continue
    if (s === t) {
      selfLoopCounts[s]++
      continue
    }

    anyNeighborSets[s].add(t)
    anyNeighborSets[t].add(s)
    outNeighborSets[s].add(t)

    bumpCount(anyNeighborCounts[s], t)
    bumpCount(anyNeighborCounts[t], s)
    bumpCount(outNeighborCounts[s], t)
    bumpCount(inNeighborCounts[t], s)

    const anyKey = s < t ? s * nodeCount + t : t * nodeCount + s
    if (!anyPairEdgeId.has(anyKey)) anyPairEdgeId.set(anyKey, nextAnyEdgeId++)

    const outKey = s * nodeCount + t
    if (!outPairEdgeId.has(outKey)) outPairEdgeId.set(outKey, nextOutEdgeId++)
  }

  const any = flattenCsr(nodeCount, anyNeighborSets, (u, v) =>
    anyPairEdgeId.get(u < v ? u * nodeCount + v : v * nodeCount + u)!,
  )
  const out = flattenCsr(nodeCount, outNeighborSets, (u, v) => outPairEdgeId.get(u * nodeCount + v)!)

  return {
    nodeIds,
    nodeIndex,
    anyOffsets: any.offsets,
    anyTargets: any.targets,
    anyEdgeIds: any.edgeIds,
    anyEdgeCount: nextAnyEdgeId,
    anyPairEdgeId,
    outOffsets: out.offsets,
    outTargets: out.targets,
    outEdgeIds: out.edgeIds,
    outEdgeCount: nextOutEdgeId,
    outPairEdgeId,
    anyNeighborCounts,
    outNeighborCounts,
    inNeighborCounts,
    selfLoopCounts,
  }
}

/** Sum of per-node self-loop counts over the given node indices. */
export function sumSelfLoops(selfLoopCounts: Int32Array, indices: Iterable<number>): number {
  let total = 0
  for (const i of indices) total += selfLoopCounts[i]
  return total
}

/** Number of node pairs (within `indices`) connected by more than one edge (direction ignored). */
export function countMultiEdgeNodePairs(
  anyNeighborCounts: Array<Map<number, number>>,
  indices: Iterable<number>,
): number {
  let partners = 0
  for (const i of indices) {
    for (const count of anyNeighborCounts[i].values()) {
      if (count > 1) partners++
    }
  }
  // Each multi-edge node pair is counted once from each endpoint.
  return partners / 2
}

/** All (weakly) connected components, always computed over ANY-direction adjacency. */
export function findComponents(nodeCount: number, offsets: Int32Array, targets: Int32Array): number[][] {
  const visited = new Uint8Array(nodeCount)
  const components: number[][] = []
  const queue = new Int32Array(nodeCount)

  for (let start = 0; start < nodeCount; start++) {
    if (visited[start]) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1
    const component: number[] = [start]

    while (head < tail) {
      const u = queue[head++]
      const s = offsets[u]
      const e = offsets[u + 1]
      for (let i = s; i < e; i++) {
        const v = targets[i]
        if (!visited[v]) {
          visited[v] = 1
          queue[tail++] = v
          component.push(v)
        }
      }
    }
    components.push(component)
  }
  return components
}

/** The largest of `components` (first-encountered wins ties). Empty if `components` is empty. */
export function largestComponent(components: number[][]): number[] {
  let largest: number[] = []
  for (const component of components) {
    if (component.length > largest.length) largest = component
  }
  return largest
}

/**
 * Count of ordered pairs (u, v), both among the neighbors in `ownTargets[start,end)`,
 * such that traversing from u via `checkOffsets`/`checkTargets` reaches v.
 * Mirrors UndirNetworkAnalyzer.computeCC's traversal-count form (mark this
 * node's own neighbors in a reusable `Uint8Array` scratch for O(1) membership
 * checks, clearing only the touched entries afterward — not a full
 * `O(nodeCount)` reset per node).
 */
export function countClosedNeighborPairs(
  start: number,
  end: number,
  ownTargets: Int32Array,
  checkOffsets: Int32Array,
  checkTargets: Int32Array,
  scratch: Uint8Array,
): number {
  for (let i = start; i < end; i++) scratch[ownTargets[i]] = 1

  let closed = 0
  for (let i = start; i < end; i++) {
    const u = ownTargets[i]
    const uStart = checkOffsets[u]
    const uEnd = checkOffsets[u + 1]
    for (let j = uStart; j < uEnd; j++) {
      if (scratch[checkTargets[j]] === 1) closed++
    }
  }

  for (let i = start; i < end; i++) scratch[ownTargets[i]] = 0
  return closed
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

/**
 * BFS eccentricity/apl for every node, via the given adjacency (pass the
 * any-direction CSR for undirected traversal, the out-direction CSR for
 * directed/forward-only traversal). This is the expensive O(V·(V+E)) pass —
 * callers that need it for more than one purpose (e.g. both the summary
 * stats and the per-node table columns) should run it once and share the
 * result. `distance`/`queue` scratch buffers are reused across all `nodeCount`
 * source iterations rather than reallocated per source.
 */
export function computeAllNodeBfs(nodeCount: number, offsets: Int32Array, targets: Int32Array): BfsResult[] {
  const results: BfsResult[] = new Array(nodeCount)
  const distance = new Int32Array(nodeCount)
  const queue = new Int32Array(nodeCount)

  for (let source = 0; source < nodeCount; source++) {
    distance.fill(-1)
    distance[source] = 0
    queue[0] = source
    let head = 0
    let tail = 1
    let eccentricity = 0
    let totalLength = 0

    while (head < tail) {
      const u = queue[head++]
      const du = distance[u]
      const s = offsets[u]
      const e = offsets[u + 1]
      for (let i = s; i < e; i++) {
        const v = targets[i]
        if (distance[v] === -1) {
          const dv = du + 1
          distance[v] = dv
          queue[tail++] = v
          if (dv > eccentricity) eccentricity = dv
          totalLength += dv
        }
      }
    }

    results[source] = { eccentricity, reachableCount: tail - 1, totalLength }
  }

  return results
}
