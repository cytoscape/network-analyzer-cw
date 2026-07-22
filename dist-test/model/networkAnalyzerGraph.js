"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = buildGraph;
exports.sumSelfLoops = sumSelfLoops;
exports.countMultiEdgeNodePairs = countMultiEdgeNodePairs;
exports.findComponents = findComponents;
exports.largestComponent = largestComponent;
exports.inducedSubgraph = inducedSubgraph;
exports.countClosedNeighborPairs = countClosedNeighborPairs;
exports.bfsEccentricity = bfsEccentricity;
function addNeighbor(neighbors, counts, from, to) {
    neighbors.get(from).add(to);
    const nodeCounts = counts.get(from);
    nodeCounts.set(to, (nodeCounts.get(to) ?? 0) + 1);
}
function bumpCount(counts, from, to) {
    const nodeCounts = counts.get(from);
    nodeCounts.set(to, (nodeCounts.get(to) ?? 0) + 1);
}
function buildGraph(nodeIds, edges) {
    const anyNeighbors = new Map();
    const outNeighbors = new Map();
    const anyNeighborCounts = new Map();
    const outNeighborCounts = new Map();
    const inNeighborCounts = new Map();
    const selfLoopCounts = new Map();
    for (const nodeId of nodeIds) {
        anyNeighbors.set(nodeId, new Set());
        outNeighbors.set(nodeId, new Set());
        anyNeighborCounts.set(nodeId, new Map());
        outNeighborCounts.set(nodeId, new Map());
        inNeighborCounts.set(nodeId, new Map());
        selfLoopCounts.set(nodeId, 0);
    }
    for (const { sourceId, targetId } of edges) {
        if (sourceId === targetId) {
            selfLoopCounts.set(sourceId, (selfLoopCounts.get(sourceId) ?? 0) + 1);
            continue;
        }
        addNeighbor(anyNeighbors, anyNeighborCounts, sourceId, targetId);
        addNeighbor(anyNeighbors, anyNeighborCounts, targetId, sourceId);
        outNeighbors.get(sourceId).add(targetId);
        bumpCount(outNeighborCounts, sourceId, targetId);
        bumpCount(inNeighborCounts, targetId, sourceId);
    }
    return {
        nodeIds,
        anyNeighbors,
        outNeighbors,
        anyNeighborCounts,
        outNeighborCounts,
        inNeighborCounts,
        selfLoopCounts,
    };
}
/** Sum of per-node self-loop counts over the given nodes. */
function sumSelfLoops(selfLoopCounts, nodeIds) {
    let total = 0;
    for (const nodeId of nodeIds)
        total += selfLoopCounts.get(nodeId) ?? 0;
    return total;
}
/** Number of node pairs connected by more than one edge (direction ignored). */
function countMultiEdgeNodePairs(anyNeighborCounts) {
    let partners = 0;
    for (const counts of anyNeighborCounts.values()) {
        for (const count of counts.values()) {
            if (count > 1)
                partners++;
        }
    }
    // Each multi-edge node pair is counted once from each endpoint.
    return partners / 2;
}
/** All (weakly) connected components, always computed over ANY-direction adjacency. */
function findComponents(nodeIds, anyNeighbors) {
    const visited = new Set();
    const components = [];
    for (const start of nodeIds) {
        if (visited.has(start))
            continue;
        const component = [start];
        visited.add(start);
        const queue = [start];
        let head = 0;
        while (head < queue.length) {
            const node = queue[head++];
            for (const neighbor of anyNeighbors.get(node) ?? []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                    component.push(neighbor);
                }
            }
        }
        components.push(component);
    }
    return components;
}
/** The node ids of the largest of `components` (first-encountered wins ties). Empty if `components` is empty. */
function largestComponent(components) {
    let largest = [];
    for (const component of components) {
        if (component.length > largest.length)
            largest = component;
    }
    return largest;
}
/**
 * Restricts `graph` to the induced subgraph over `nodeSubset` — every
 * adjacency/count/self-loop map filtered down to just those nodes. Used to
 * recompute stats over a single connected component (see networkAnalyzer.ts).
 */
function filterCounts(counts, subset) {
    const filtered = new Map();
    for (const [neighbor, count] of counts ?? []) {
        if (subset.has(neighbor))
            filtered.set(neighbor, count);
    }
    return filtered;
}
function inducedSubgraph(graph, nodeSubset) {
    const subset = new Set(nodeSubset);
    const anyNeighbors = new Map();
    const outNeighbors = new Map();
    const anyNeighborCounts = new Map();
    const outNeighborCounts = new Map();
    const inNeighborCounts = new Map();
    const selfLoopCounts = new Map();
    for (const nodeId of nodeSubset) {
        anyNeighbors.set(nodeId, new Set([...(graph.anyNeighbors.get(nodeId) ?? [])].filter((n) => subset.has(n))));
        outNeighbors.set(nodeId, new Set([...(graph.outNeighbors.get(nodeId) ?? [])].filter((n) => subset.has(n))));
        anyNeighborCounts.set(nodeId, filterCounts(graph.anyNeighborCounts.get(nodeId), subset));
        outNeighborCounts.set(nodeId, filterCounts(graph.outNeighborCounts.get(nodeId), subset));
        inNeighborCounts.set(nodeId, filterCounts(graph.inNeighborCounts.get(nodeId), subset));
        selfLoopCounts.set(nodeId, graph.selfLoopCounts.get(nodeId) ?? 0);
    }
    return {
        nodeIds: nodeSubset,
        anyNeighbors,
        outNeighbors,
        anyNeighborCounts,
        outNeighborCounts,
        inNeighborCounts,
        selfLoopCounts,
    };
}
/** Ordered pairs (u, v) of `neighbors` such that `edgeExists(u, v)`, excluding u === v. */
function countClosedNeighborPairs(neighbors, edgeExists) {
    let closed = 0;
    for (const u of neighbors) {
        for (const v of neighbors) {
            if (u !== v && edgeExists(u, v))
                closed++;
        }
    }
    return closed;
}
/**
 * BFS from `source` over `adjacency` (pass `anyNeighbors` for undirected
 * traversal, `outNeighbors` for directed/forward-only traversal).
 */
function bfsEccentricity(source, adjacency) {
    const distance = new Map([[source, 0]]);
    const queue = [source];
    let head = 0;
    let eccentricity = 0;
    let totalLength = 0;
    while (head < queue.length) {
        const node = queue[head++];
        const nodeDistance = distance.get(node);
        for (const neighbor of adjacency.get(node) ?? []) {
            if (!distance.has(neighbor)) {
                const neighborDistance = nodeDistance + 1;
                distance.set(neighbor, neighborDistance);
                queue.push(neighbor);
                eccentricity = Math.max(eccentricity, neighborDistance);
                totalLength += neighborDistance;
            }
        }
    }
    return { eccentricity, reachableCount: distance.size - 1, totalLength };
}
