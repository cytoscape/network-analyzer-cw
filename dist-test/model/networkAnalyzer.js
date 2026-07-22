"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeNetwork = analyzeNetwork;
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
const networkAnalyzerGraph_1 = require("./networkAnalyzerGraph");
/** Shortest-path summary across every node, via BFS over the given adjacency. */
function computePathStats(nodeIds, adjacency) {
    let diameter = 0;
    let radius = 0;
    let connectedPairs = 0;
    let totalLength = 0;
    let sawPositiveEccentricity = false;
    for (const nodeId of nodeIds) {
        const { eccentricity, reachableCount, totalLength: nodeTotalLength } = (0, networkAnalyzerGraph_1.bfsEccentricity)(nodeId, adjacency);
        if (eccentricity > diameter)
            diameter = eccentricity;
        if (eccentricity > 0 && (!sawPositiveEccentricity || eccentricity < radius)) {
            radius = eccentricity;
            sawPositiveEccentricity = true;
        }
        connectedPairs += reachableCount;
        totalLength += nodeTotalLength;
    }
    const avgShortestPathLength = connectedPairs > 0 ? totalLength / connectedPairs : 0;
    return { diameter, radius, connectedPairs, avgShortestPathLength };
}
function analyzeUndirected(graph) {
    const nodeCount = graph.nodeIds.length;
    const components = (0, networkAnalyzerGraph_1.findComponents)(graph.nodeIds, graph.anyNeighbors);
    const connectedComponents = components.length;
    // Everything below is scoped to the largest connected component only — see
    // the module-level comment for why.
    const componentNodes = (0, networkAnalyzerGraph_1.largestComponent)(components);
    const component = (0, networkAnalyzerGraph_1.inducedSubgraph)(graph, componentNodes);
    const { anyNeighbors } = component;
    const componentSize = componentNodes.length;
    let neighborSum = 0;
    let neighborSqSum = 0;
    let maxNeighborCount = 0;
    let isolatedNodes = 0;
    let clusteringSum = 0;
    for (const nodeId of componentNodes) {
        const neighbors = anyNeighbors.get(nodeId);
        const k = neighbors.size;
        neighborSum += k;
        neighborSqSum += k * k;
        if (k > maxNeighborCount)
            maxNeighborCount = k;
        if (k === 0)
            isolatedNodes++;
        if (k > 1) {
            const closed = (0, networkAnalyzerGraph_1.countClosedNeighborPairs)(neighbors, (u, v) => anyNeighbors.get(u).has(v));
            clusteringSum += closed / (k * (k - 1));
        }
    }
    const avNeighbors = componentSize > 0 ? neighborSum / componentSize : 0;
    const density = componentSize > 1 ? avNeighbors / (componentSize - 1) : 0;
    const centralization = componentSize > 2
        ? (componentSize / (componentSize - 2)) * (maxNeighborCount / (componentSize - 1) - density)
        : 0;
    const heterogeneity = neighborSum > 0 ? Math.sqrt((neighborSqSum * componentSize) / (neighborSum * neighborSum) - 1) : 0;
    const clusteringCoefficient = componentSize > 0 ? clusteringSum / componentSize : 0;
    const { diameter, radius, connectedPairs, avgShortestPathLength } = computePathStats(componentNodes, anyNeighbors);
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
        selfLoops: (0, networkAnalyzerGraph_1.sumSelfLoops)(component.selfLoopCounts, componentNodes),
        multiEdgeNodePairs: (0, networkAnalyzerGraph_1.countMultiEdgeNodePairs)(component.anyNeighborCounts),
    };
}
function analyzeDirected(graph) {
    const { nodeIds, anyNeighbors, outNeighbors } = graph;
    const nodeCount = nodeIds.length;
    let neighborSum = 0;
    let outNeighborSum = 0;
    let isolatedNodes = 0;
    let clusteringSum = 0;
    for (const nodeId of nodeIds) {
        const neighbors = anyNeighbors.get(nodeId);
        const k = neighbors.size;
        neighborSum += k;
        outNeighborSum += outNeighbors.get(nodeId).size;
        if (k === 0)
            isolatedNodes++;
        if (k > 1) {
            const closed = (0, networkAnalyzerGraph_1.countClosedNeighborPairs)(neighbors, (u, v) => outNeighbors.get(u).has(v));
            clusteringSum += closed / (k * (k - 1));
        }
    }
    const avNeighbors = nodeCount > 0 ? neighborSum / nodeCount : 0;
    const density = nodeCount > 1 ? outNeighborSum / (nodeCount * (nodeCount - 1)) : 0;
    const clusteringCoefficient = nodeCount > 0 ? clusteringSum / nodeCount : 0;
    const { diameter, radius, connectedPairs, avgShortestPathLength } = computePathStats(nodeIds, outNeighbors);
    return {
        nodeCount,
        avNeighbors,
        density,
        centralization: null,
        heterogeneity: null,
        clusteringCoefficient,
        // Connected components are always weak (ANY-direction), matching
        // ConnComponentAnalyzer's behavior for both directed and undirected networks.
        connectedComponents: (0, networkAnalyzerGraph_1.findComponents)(nodeIds, anyNeighbors).length,
        diameter,
        radius,
        avgShortestPathLength,
        connectedPairs,
        isolatedNodes,
        selfLoops: (0, networkAnalyzerGraph_1.sumSelfLoops)(graph.selfLoopCounts, nodeIds),
        multiEdgeNodePairs: (0, networkAnalyzerGraph_1.countMultiEdgeNodePairs)(graph.anyNeighborCounts),
    };
}
/**
 * Runs the Network Analyzer "Summary Statistics" computation over the given
 * network elements. `edges` provide raw endpoints only — the graph is rebuilt
 * from scratch each call (no incremental/cached state).
 */
function analyzeNetwork(nodeIds, edges, options) {
    const start = performance.now();
    const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
    const summary = options.directed ? analyzeDirected(graph) : analyzeUndirected(graph);
    const analysisTimeMs = performance.now() - start;
    return {
        ...summary,
        directed: options.directed,
        edgeCount: edges.length,
        analysisTimeMs,
    };
}
