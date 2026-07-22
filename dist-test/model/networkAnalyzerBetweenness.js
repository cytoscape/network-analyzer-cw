"use strict";
/**
 * Brandes' algorithm (U. Brandes, "A Faster Algorithm for Betweenness
 * Centrality", J. Math. Sociol. 25(2):163-177, 2001) for node betweenness,
 * stress, and edge betweenness centrality.
 * See networkAnalyzerTypes.ts for attribution.
 *
 * One implementation serves both modes: pass `anyNeighbors` (undirected) or
 * `outNeighbors` (directed) as `adjacency`. The directed Java analyzer's own
 * `computeNBandEB` overload traverses a combined in/out array but truncates it
 * to the out-edge portion before the forward BFS expansion and never uses the
 * in-edge portion afterward — i.e. it's algorithmically just an out-edge-only
 * Brandes pass, so no separate directed implementation is needed here.
 *
 * Edge betweenness is accumulated per logical edge (via `edgeKey`, not per
 * literal CyEdge/CX2 edge id) — parallel edges between the same node pair
 * collapse to one Brandes edge, matching Java's node-pair-hash approach. The
 * caller is responsible for writing that one value back to every literal edge
 * sharing the pair.
 *
 * Node betweenness is left un-normalized here; the per-component normalization
 * factor (`1 / ((n-1)(n-2))`, using THAT node's own component size) is applied
 * by the caller (networkAnalyzerColumns.ts), matching Java applying it inside
 * the per-component loop rather than globally.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBetweenness = computeBetweenness;
exports.normalizationFactor = normalizationFactor;
function computeBetweenness(nodeIds, adjacency, edgeKey) {
    const betweenness = new Map(nodeIds.map((id) => [id, 0]));
    const stress = new Map(nodeIds.map((id) => [id, 0]));
    const edgeBetweenness = new Map();
    for (const source of nodeIds) {
        // --- forward BFS: distances, shortest-path counts (sigma), predecessors ---
        const order = [source];
        const predecessors = new Map();
        const sigma = new Map([[source, 1]]);
        const distance = new Map([[source, 0]]);
        let head = 0;
        while (head < order.length) {
            const v = order[head++];
            const dv = distance.get(v);
            for (const w of adjacency.get(v) ?? []) {
                if (!distance.has(w)) {
                    distance.set(w, dv + 1);
                    order.push(w);
                }
                if (distance.get(w) === dv + 1) {
                    sigma.set(w, (sigma.get(w) ?? 0) + sigma.get(v));
                    let preds = predecessors.get(w);
                    if (preds === undefined) {
                        preds = [];
                        predecessors.set(w, preds);
                    }
                    preds.push(v);
                }
            }
        }
        // --- backward accumulation, in reverse BFS-discovery order ---
        const delta = new Map();
        const stressDependency = new Map();
        for (let i = order.length - 1; i >= 0; i--) {
            const w = order[i];
            const deltaw = delta.get(w) ?? 0;
            const stressw = stressDependency.get(w) ?? 0;
            const sigmaw = sigma.get(w);
            for (const v of predecessors.get(w) ?? []) {
                // Standard Brandes edge-dependency formula: (sigma_v/sigma_w) * (1 + delta_w).
                // This is the exact quantity contributed to both delta(v) and the (v,w)
                // edge's betweenness — Java's Dbetweenness-based recursion computes the
                // same value through the DAG's descendant edges instead of directly.
                const contribution = (sigma.get(v) / sigmaw) * (1 + deltaw);
                delta.set(v, (delta.get(v) ?? 0) + contribution);
                stressDependency.set(v, (stressDependency.get(v) ?? 0) + 1 + stressw);
                const key = edgeKey(v, w);
                edgeBetweenness.set(key, (edgeBetweenness.get(key) ?? 0) + contribution);
            }
            if (w !== source) {
                betweenness.set(w, (betweenness.get(w) ?? 0) + deltaw);
                stress.set(w, (stress.get(w) ?? 0) + sigmaw * stressw);
            }
        }
    }
    return { betweenness, stress, edgeBetweenness };
}
/** Per-component node-betweenness normalization factor, matching computeNormFactor(). */
function normalizationFactor(componentSize) {
    return componentSize > 2 ? 1 / ((componentSize - 1) * (componentSize - 2)) : 1;
}
