"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Unit tests for the Network Analyzer "Summary Statistics" port.
 * See networkAnalyzerTypes.ts for attribution.
 *
 * Uses Node's built-in test runner (no extra dependencies), same convention
 * as the sibling mcode-cw-app's mcodeAlgorithm.test.ts:
 *   node --test --experimental-strip-types   (or `npm test`)
 *
 * Expected values below are worked out by hand against the formulas ported
 * from UndirNetworkAnalyzer.computeAll() / DirNetworkAnalyzer.computeAll().
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const networkAnalyzer_1 = require("./networkAnalyzer");
function edge(sourceId, targetId) {
    return { sourceId, targetId };
}
function approxEqual(actual, expected, message) {
    strict_1.default.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}
(0, node_test_1.default)('triangle (3 nodes, fully connected, undirected)', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B', 'C'], [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')], { directed: false });
    strict_1.default.equal(result.nodeCount, 3);
    strict_1.default.equal(result.edgeCount, 3);
    approxEqual(result.avNeighbors, 2, 'avNeighbors');
    approxEqual(result.density, 1, 'density');
    approxEqual(result.centralization ?? NaN, 0, 'centralization');
    approxEqual(result.heterogeneity ?? NaN, 0, 'heterogeneity');
    approxEqual(result.clusteringCoefficient, 1, 'clusteringCoefficient');
    strict_1.default.equal(result.connectedComponents, 1);
    strict_1.default.equal(result.diameter, 1);
    strict_1.default.equal(result.radius, 1);
    approxEqual(result.avgShortestPathLength, 1, 'avgShortestPathLength');
    strict_1.default.equal(result.connectedPairs, 6);
    strict_1.default.equal(result.isolatedNodes, 0);
    strict_1.default.equal(result.selfLoops, 0);
    strict_1.default.equal(result.multiEdgeNodePairs, 0);
});
(0, node_test_1.default)('path graph (4 nodes, A-B-C-D, undirected)', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B', 'C', 'D'], [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')], { directed: false });
    strict_1.default.equal(result.nodeCount, 4);
    strict_1.default.equal(result.edgeCount, 3);
    approxEqual(result.avNeighbors, 1.5, 'avNeighbors');
    approxEqual(result.density, 0.5, 'density');
    approxEqual(result.centralization ?? NaN, 1 / 3, 'centralization');
    approxEqual(result.heterogeneity ?? NaN, 1 / 3, 'heterogeneity');
    approxEqual(result.clusteringCoefficient, 0, 'clusteringCoefficient');
    strict_1.default.equal(result.connectedComponents, 1);
    strict_1.default.equal(result.diameter, 3);
    strict_1.default.equal(result.radius, 2);
    approxEqual(result.avgShortestPathLength, 20 / 12, 'avgShortestPathLength');
    strict_1.default.equal(result.connectedPairs, 12);
    strict_1.default.equal(result.isolatedNodes, 0);
});
(0, node_test_1.default)('isolated node alongside a connected pair (undirected) — restricted to the largest component', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B', 'C'], [edge('A', 'B')], { directed: false });
    // nodeCount/edgeCount/connectedComponents are whole-network...
    strict_1.default.equal(result.nodeCount, 3);
    strict_1.default.equal(result.edgeCount, 1);
    strict_1.default.equal(result.connectedComponents, 2);
    // ...but avNeighbors/isolatedNodes/diameter/etc. are computed over ONLY the
    // largest component ({A, B}), matching org.cytoscape.analyzer's
    // UndirNetworkAnalyzer.computeAll() -> stats.copyStats(largest.getStats()).
    // C (isolated, its own component) is excluded from these entirely.
    approxEqual(result.avNeighbors, 1, 'avNeighbors');
    strict_1.default.equal(result.isolatedNodes, 0);
    strict_1.default.equal(result.diameter, 1);
    strict_1.default.equal(result.radius, 1);
    strict_1.default.equal(result.connectedPairs, 2);
    approxEqual(result.avgShortestPathLength, 1, 'avgShortestPathLength');
});
(0, node_test_1.default)('triangle plus a disconnected pair (undirected) — largest component wins', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B', 'C', 'D', 'E'], [edge('A', 'B'), edge('B', 'C'), edge('C', 'A'), edge('D', 'E')], { directed: false });
    strict_1.default.equal(result.nodeCount, 5);
    strict_1.default.equal(result.edgeCount, 4);
    strict_1.default.equal(result.connectedComponents, 2);
    // All computed over the 3-node triangle, not the whole 5-node network.
    approxEqual(result.avNeighbors, 2, 'avNeighbors');
    approxEqual(result.density, 1, 'density');
    approxEqual(result.clusteringCoefficient, 1, 'clusteringCoefficient');
    strict_1.default.equal(result.diameter, 1);
    strict_1.default.equal(result.radius, 1);
    strict_1.default.equal(result.connectedPairs, 6);
    approxEqual(result.avgShortestPathLength, 1, 'avgShortestPathLength');
    strict_1.default.equal(result.isolatedNodes, 0);
});
(0, node_test_1.default)('self-loop is counted but excluded from adjacency (undirected)', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B'], [edge('A', 'B'), edge('A', 'A')], {
        directed: false,
    });
    strict_1.default.equal(result.nodeCount, 2);
    strict_1.default.equal(result.edgeCount, 2);
    strict_1.default.equal(result.selfLoops, 1);
    // Self-loop must not inflate A's neighbor count.
    approxEqual(result.avNeighbors, 1, 'avNeighbors');
    strict_1.default.equal(result.multiEdgeNodePairs, 0);
    strict_1.default.equal(result.diameter, 1);
    strict_1.default.equal(result.connectedPairs, 2);
});
(0, node_test_1.default)('multi-edge node pair is detected (undirected)', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B'], [edge('A', 'B'), edge('A', 'B')], {
        directed: false,
    });
    strict_1.default.equal(result.nodeCount, 2);
    strict_1.default.equal(result.edgeCount, 2);
    strict_1.default.equal(result.multiEdgeNodePairs, 1);
    // Duplicate edges must not inflate the distinct neighbor count.
    approxEqual(result.avNeighbors, 1, 'avNeighbors');
    approxEqual(result.density, 1, 'density');
});
(0, node_test_1.default)('directed chain (A -> B -> C)', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)(['A', 'B', 'C'], [edge('A', 'B'), edge('B', 'C')], {
        directed: true,
    });
    strict_1.default.equal(result.nodeCount, 3);
    strict_1.default.equal(result.edgeCount, 2);
    strict_1.default.equal(result.centralization, null);
    strict_1.default.equal(result.heterogeneity, null);
    // avNeighbors uses ANY-direction distinct neighbor counts: A=1, B=2, C=1.
    approxEqual(result.avNeighbors, 4 / 3, 'avNeighbors');
    // density uses distinct out-neighbor counts: (1 + 1 + 0) / (3*2).
    approxEqual(result.density, 1 / 3, 'density');
    approxEqual(result.clusteringCoefficient, 0, 'clusteringCoefficient');
    // Connected components are weak (ANY-direction) even in directed mode.
    strict_1.default.equal(result.connectedComponents, 1);
    // Diameter/radius/avSpl follow out-edges only: A reaches B,C; B reaches C; C reaches nothing.
    strict_1.default.equal(result.diameter, 2);
    strict_1.default.equal(result.radius, 1);
    strict_1.default.equal(result.connectedPairs, 3);
    approxEqual(result.avgShortestPathLength, 4 / 3, 'avgShortestPathLength');
    strict_1.default.equal(result.isolatedNodes, 0);
});
(0, node_test_1.default)('empty network', () => {
    const result = (0, networkAnalyzer_1.analyzeNetwork)([], [], { directed: false });
    strict_1.default.equal(result.nodeCount, 0);
    strict_1.default.equal(result.edgeCount, 0);
    strict_1.default.equal(result.avNeighbors, 0);
    strict_1.default.equal(result.density, 0);
    strict_1.default.equal(result.diameter, 0);
    strict_1.default.equal(result.connectedComponents, 0);
});
