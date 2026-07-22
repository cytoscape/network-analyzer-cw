"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Unit tests for the per-node/per-edge Network Analyzer table columns.
 * See networkAnalyzerTypes.ts for attribution.
 *
 * Expected betweenness/stress values are worked out by hand via Brandes'
 * algorithm and cross-checked against known closed-form results (e.g. a path
 * graph's betweenness(v) = 2 * L * R, where L/R are the node counts to the
 * left/right of v — and the invariant that summing all edge-betweenness
 * values must equal the total shortest-path length across all ordered pairs).
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const networkAnalyzerColumns_1 = require("./networkAnalyzerColumns");
const networkAnalyzerGraph_1 = require("./networkAnalyzerGraph");
function edge(id, sourceId, targetId) {
    return { id, sourceId, targetId };
}
function approxEqual(actual, expected, message) {
    strict_1.default.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}
(0, node_test_1.default)('triangle (undirected): degree, clustering, topological coefficient, betweenness, radiality', () => {
    const nodeIds = ['A', 'B', 'C'];
    const edges = [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'C', 'A')];
    const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
    const { nodeColumns, edgeColumns } = (0, networkAnalyzerColumns_1.computeNetworkAnalyzerColumns)(graph, edges, { directed: false });
    for (const nodeId of nodeIds) {
        strict_1.default.equal(nodeColumns.get('Degree').get(nodeId), 2);
        approxEqual(nodeColumns.get('ClusteringCoefficient').get(nodeId), 1, 'ClusteringCoefficient');
        approxEqual(nodeColumns.get('TopologicalCoefficient').get(nodeId), 1, 'TopologicalCoefficient');
        strict_1.default.equal(nodeColumns.get('Eccentricity').get(nodeId), 1);
        approxEqual(nodeColumns.get('AverageShortestPathLength').get(nodeId), 1, 'apl');
        approxEqual(nodeColumns.get('ClosenessCentrality').get(nodeId), 1, 'closeness');
        approxEqual(nodeColumns.get('Radiality').get(nodeId), 1, 'radiality');
        // No node lies "between" any pair in a complete graph.
        approxEqual(nodeColumns.get('BetweennessCentrality').get(nodeId), 0, 'betweenness');
        strict_1.default.equal(nodeColumns.get('Stress').get(nodeId), 0);
        strict_1.default.equal(nodeColumns.get('SelfLoops').get(nodeId), 0);
        strict_1.default.equal(nodeColumns.get('IsSingleNode').get(nodeId), false);
        strict_1.default.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs').get(nodeId), 0);
    }
    // Each edge is used by exactly 2 (source, direction) BFS passes.
    for (const e of edges) {
        strict_1.default.equal(edgeColumns.get('EdgeBetweenness').get(e.id), 2);
    }
});
(0, node_test_1.default)('path graph (4 nodes, undirected): known betweenness/stress + edge-betweenness sums to total path length', () => {
    const nodeIds = ['A', 'B', 'C', 'D'];
    const edges = [edge('ab', 'A', 'B'), edge('bc', 'B', 'C'), edge('cd', 'C', 'D')];
    const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
    const { nodeColumns, edgeColumns } = (0, networkAnalyzerColumns_1.computeNetworkAnalyzerColumns)(graph, edges, { directed: false });
    // Raw betweenness(v) = 2 * (nodes to the left) * (nodes to the right); normalized by 1/((n-1)(n-2)) = 1/6.
    approxEqual(nodeColumns.get('BetweennessCentrality').get('A'), 0, 'betweenness A');
    approxEqual(nodeColumns.get('BetweennessCentrality').get('B'), 4 / 6, 'betweenness B');
    approxEqual(nodeColumns.get('BetweennessCentrality').get('C'), 4 / 6, 'betweenness C');
    approxEqual(nodeColumns.get('BetweennessCentrality').get('D'), 0, 'betweenness D');
    strict_1.default.equal(nodeColumns.get('Stress').get('A'), 0);
    strict_1.default.equal(nodeColumns.get('Stress').get('B'), 4);
    strict_1.default.equal(nodeColumns.get('Stress').get('C'), 4);
    strict_1.default.equal(nodeColumns.get('Stress').get('D'), 0);
    strict_1.default.equal(nodeColumns.get('Degree').get('A'), 1);
    strict_1.default.equal(nodeColumns.get('Degree').get('B'), 2);
    const ab = edgeColumns.get('EdgeBetweenness').get('ab');
    const bc = edgeColumns.get('EdgeBetweenness').get('bc');
    const cd = edgeColumns.get('EdgeBetweenness').get('cd');
    strict_1.default.equal(ab, 6);
    strict_1.default.equal(bc, 8);
    strict_1.default.equal(cd, 6);
    // Sum of all edge betweenness == total shortest-path length across all
    // ordered pairs (connectedPairs=12, avgSpl=20/12 from the summary-stats test).
    approxEqual(ab + bc + cd, 20, 'edge betweenness sum == total path length');
});
(0, node_test_1.default)('isolated node next to a triangle (undirected): Radiality guards the singleton to 0', () => {
    const nodeIds = ['A', 'B', 'C', 'E'];
    const edges = [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'C', 'A')];
    const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
    const { nodeColumns } = (0, networkAnalyzerColumns_1.computeNetworkAnalyzerColumns)(graph, edges, { directed: false });
    strict_1.default.equal(nodeColumns.get('IsSingleNode').get('E'), true);
    strict_1.default.equal(nodeColumns.get('Degree').get('E'), 0);
    strict_1.default.equal(nodeColumns.get('Eccentricity').get('E'), 0);
    approxEqual(nodeColumns.get('Radiality').get('E'), 0, 'radiality guard');
    // The triangle's own nodes are unaffected by E's presence — matches Java
    // writing per-component attributes independently for every component.
    approxEqual(nodeColumns.get('Radiality').get('A'), 1, 'radiality A');
});
(0, node_test_1.default)('directed chain (A -> B -> C): indegree/outdegree, betweenness, stress, edge betweenness', () => {
    const nodeIds = ['A', 'B', 'C'];
    const edges = [edge('ab', 'A', 'B'), edge('bc', 'B', 'C')];
    const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
    const { nodeColumns, edgeColumns } = (0, networkAnalyzerColumns_1.computeNetworkAnalyzerColumns)(graph, edges, { directed: true });
    strict_1.default.equal(nodeColumns.get('Indegree').get('A'), 0);
    strict_1.default.equal(nodeColumns.get('Outdegree').get('A'), 1);
    strict_1.default.equal(nodeColumns.get('EdgeCount').get('A'), 1);
    strict_1.default.equal(nodeColumns.get('Indegree').get('B'), 1);
    strict_1.default.equal(nodeColumns.get('Outdegree').get('B'), 1);
    strict_1.default.equal(nodeColumns.get('EdgeCount').get('B'), 2);
    strict_1.default.equal(nodeColumns.get('Indegree').get('C'), 1);
    strict_1.default.equal(nodeColumns.get('Outdegree').get('C'), 0);
    // Only B lies on a directed shortest path (A -> B -> C), normalized by 1/((3-1)(3-2)) = 1/2.
    approxEqual(nodeColumns.get('BetweennessCentrality').get('A'), 0, 'betweenness A');
    approxEqual(nodeColumns.get('BetweennessCentrality').get('B'), 0.5, 'betweenness B');
    approxEqual(nodeColumns.get('BetweennessCentrality').get('C'), 0, 'betweenness C');
    strict_1.default.equal(nodeColumns.get('Stress').get('B'), 1);
    // Undirected-only columns must be absent in directed mode.
    strict_1.default.equal(nodeColumns.has('Degree'), false);
    strict_1.default.equal(nodeColumns.has('Radiality'), false);
    strict_1.default.equal(nodeColumns.has('TopologicalCoefficient'), false);
    strict_1.default.equal(edgeColumns.get('EdgeBetweenness').get('ab'), 2);
    strict_1.default.equal(edgeColumns.get('EdgeBetweenness').get('bc'), 2);
});
(0, node_test_1.default)('multi-edge pair (undirected): the same betweenness value is written to every parallel edge', () => {
    const nodeIds = ['A', 'B', 'C'];
    const edges = [edge('e1', 'A', 'B'), edge('e2', 'A', 'B'), edge('e3', 'B', 'C')];
    const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
    const { nodeColumns, edgeColumns } = (0, networkAnalyzerColumns_1.computeNetworkAnalyzerColumns)(graph, edges, { directed: false });
    strict_1.default.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs').get('A'), 1);
    strict_1.default.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs').get('B'), 1);
    strict_1.default.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs').get('C'), 0);
    const eb = edgeColumns.get('EdgeBetweenness');
    // Both parallel A-B edges collapse to the same logical Brandes edge, so
    // they must carry the identical betweenness value.
    strict_1.default.equal(eb.get('e1'), eb.get('e2'));
});
