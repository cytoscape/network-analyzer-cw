/**
 * Brandes' algorithm (U. Brandes, "A Faster Algorithm for Betweenness
 * Centrality", J. Math. Sociol. 25(2):163-177, 2001) for node betweenness,
 * stress, and edge betweenness centrality.
 * See networkAnalyzerTypes.ts for attribution.
 *
 * One implementation serves both modes: pass the any-direction CSR
 * (undirected) or the out-direction CSR (directed) as `offsets`/`targets`.
 * The directed Java analyzer's own `computeNBandEB` overload traverses a
 * combined in/out array but truncates it to the out-edge portion before the
 * forward BFS expansion and never uses the in-edge portion afterward — i.e.
 * it's algorithmically just an out-edge-only Brandes pass, so no separate
 * directed implementation is needed here.
 *
 * Uses integer-indexed typed-array scratch buffers (reused across all
 * `nodeCount` source iterations) instead of `Map`/`Set` — profiling showed
 * the Map-based version's constant-factor overhead (hashing, string edge
 * keys, per-call allocation) dominates wall-clock time on large networks.
 * Predecessor lists are threaded through the CSR's own slot indices
 * (`predNext`/`predFrom`, linked via `predHead`) rather than allocated as
 * `Map<string, string[]>` per source.
 *
 * Edge betweenness is accumulated per logical edge id (see
 * networkAnalyzerGraph.ts's `anyEdgeIds`/`outEdgeIds` — not per literal
 * CX2/CyEdge id) — parallel edges between the same node pair collapse to one
 * Brandes edge, matching Java's node-pair-hash approach. The caller is
 * responsible for writing that one value back to every literal edge sharing
 * the pair.
 *
 * Node betweenness is left un-normalized here; the per-component
 * normalization factor (`1 / ((n-1)(n-2))`, using THAT node's own component
 * size) is applied by the caller (networkAnalyzerColumns.ts), matching Java
 * applying it inside the per-component loop rather than globally.
 */

export interface BetweennessResult {
  /** Raw (un-normalized) node betweenness, indexed by node index. */
  betweenness: Float64Array
  /** Indexed by node index. */
  stress: Float64Array
  /** Indexed by logical edge id. */
  edgeBetweenness: Float64Array
}

export function computeBetweenness(
  nodeCount: number,
  offsets: Int32Array,
  targets: Int32Array,
  edgeIds: Int32Array,
  edgeCount: number,
): BetweennessResult {
  const betweenness = new Float64Array(nodeCount)
  const stress = new Float64Array(nodeCount)
  const edgeBetweenness = new Float64Array(edgeCount)

  // Scratch buffers reused across every source iteration.
  const distance = new Int32Array(nodeCount)
  const sigma = new Float64Array(nodeCount) // shortest-path counts; float64 avoids int32 overflow, same reasoning as using `double` in Java
  const delta = new Float64Array(nodeCount)
  const stressDependency = new Float64Array(nodeCount)
  const order = new Int32Array(nodeCount) // BFS discovery order, doubles as Brandes' stack
  const predHead = new Int32Array(nodeCount) // -1 = no predecessors
  const slotCount = targets.length
  const predNext = new Int32Array(slotCount) // singly-linked list threaded through CSR slot indices
  const predFrom = new Int32Array(slotCount) // predecessor node for that CSR slot

  for (let source = 0; source < nodeCount; source++) {
    distance.fill(-1)
    sigma.fill(0)
    delta.fill(0)
    stressDependency.fill(0)
    predHead.fill(-1)

    distance[source] = 0
    sigma[source] = 1
    order[0] = source
    let head = 0
    let tail = 1

    // --- forward BFS: distances, shortest-path counts (sigma), predecessors ---
    while (head < tail) {
      const u = order[head++]
      const du = distance[u]
      const s = offsets[u]
      const e = offsets[u + 1]
      for (let i = s; i < e; i++) {
        const v = targets[i]
        if (distance[v] === -1) {
          distance[v] = du + 1
          order[tail++] = v
        }
        if (distance[v] === du + 1) {
          sigma[v] += sigma[u]
          predNext[i] = predHead[v]
          predHead[v] = i
          predFrom[i] = u
        }
      }
    }

    // --- backward accumulation, in reverse BFS-discovery order ---
    for (let k = tail - 1; k >= 0; k--) {
      const w = order[k]
      const deltaw = delta[w]
      const stressw = stressDependency[w]
      const sigmaw = sigma[w]

      for (let slot = predHead[w]; slot !== -1; slot = predNext[slot]) {
        const v = predFrom[slot]
        // Standard Brandes edge-dependency formula: (sigma_v/sigma_w) * (1 + delta_w).
        // This is the exact quantity contributed to both delta(v) and the (v,w)
        // edge's betweenness — Java's Dbetweenness-based recursion computes the
        // same value through the DAG's descendant edges instead of directly.
        const contribution = (sigma[v] / sigmaw) * (1 + deltaw)
        delta[v] += contribution
        stressDependency[v] += 1 + stressw
        edgeBetweenness[edgeIds[slot]] += contribution
      }

      if (w !== source) {
        betweenness[w] += deltaw
        stress[w] += sigmaw * stressw
      }
    }
  }

  return { betweenness, stress, edgeBetweenness }
}

/** Per-component node-betweenness normalization factor, matching computeNormFactor(). */
export function normalizationFactor(componentSize: number): number {
  return componentSize > 2 ? 1 / ((componentSize - 1) * (componentSize - 2)) : 1
}
