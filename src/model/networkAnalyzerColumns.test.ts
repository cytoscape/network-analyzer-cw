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
import assert from 'node:assert/strict'
import test from 'node:test'

import { computeNetworkAnalyzerColumns } from './networkAnalyzerColumns'
import { buildGraph } from './networkAnalyzerGraph'
import { IdentifiedEdge } from './networkAnalyzerTypes'

function edge(id: string, sourceId: string, targetId: string): IdentifiedEdge {
  return { id, sourceId, targetId }
}

function approxEqual(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`)
}

test('triangle (undirected): degree, clustering, topological coefficient, betweenness, radiality', () => {
  const nodeIds = ['A', 'B', 'C']
  const edges = [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'C', 'A')]
  const graph = buildGraph(nodeIds, edges)
  const { nodeColumns, edgeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed: false })

  for (const nodeId of nodeIds) {
    assert.equal(nodeColumns.get('Degree')!.get(nodeId), 2)
    approxEqual(nodeColumns.get('ClusteringCoefficient')!.get(nodeId) as number, 1, 'ClusteringCoefficient')
    approxEqual(nodeColumns.get('TopologicalCoefficient')!.get(nodeId) as number, 1, 'TopologicalCoefficient')
    assert.equal(nodeColumns.get('Eccentricity')!.get(nodeId), 1)
    approxEqual(nodeColumns.get('AverageShortestPathLength')!.get(nodeId) as number, 1, 'apl')
    approxEqual(nodeColumns.get('ClosenessCentrality')!.get(nodeId) as number, 1, 'closeness')
    approxEqual(nodeColumns.get('Radiality')!.get(nodeId) as number, 1, 'radiality')
    // No node lies "between" any pair in a complete graph.
    approxEqual(nodeColumns.get('BetweennessCentrality')!.get(nodeId) as number, 0, 'betweenness')
    assert.equal(nodeColumns.get('Stress')!.get(nodeId), 0)
    assert.equal(nodeColumns.get('SelfLoops')!.get(nodeId), 0)
    assert.equal(nodeColumns.get('IsSingleNode')!.get(nodeId), false)
    assert.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs')!.get(nodeId), 0)
  }

  // Each edge is used by exactly 2 (source, direction) BFS passes.
  for (const e of edges) {
    assert.equal(edgeColumns.get('EdgeBetweenness')!.get(e.id), 2)
  }
})

test('path graph (4 nodes, undirected): known betweenness/stress + edge-betweenness sums to total path length', () => {
  const nodeIds = ['A', 'B', 'C', 'D']
  const edges = [edge('ab', 'A', 'B'), edge('bc', 'B', 'C'), edge('cd', 'C', 'D')]
  const graph = buildGraph(nodeIds, edges)
  const { nodeColumns, edgeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed: false })

  // Raw betweenness(v) = 2 * (nodes to the left) * (nodes to the right); normalized by 1/((n-1)(n-2)) = 1/6.
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('A') as number, 0, 'betweenness A')
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('B') as number, 4 / 6, 'betweenness B')
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('C') as number, 4 / 6, 'betweenness C')
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('D') as number, 0, 'betweenness D')

  assert.equal(nodeColumns.get('Stress')!.get('A'), 0)
  assert.equal(nodeColumns.get('Stress')!.get('B'), 4)
  assert.equal(nodeColumns.get('Stress')!.get('C'), 4)
  assert.equal(nodeColumns.get('Stress')!.get('D'), 0)

  assert.equal(nodeColumns.get('Degree')!.get('A'), 1)
  assert.equal(nodeColumns.get('Degree')!.get('B'), 2)

  const ab = edgeColumns.get('EdgeBetweenness')!.get('ab') as number
  const bc = edgeColumns.get('EdgeBetweenness')!.get('bc') as number
  const cd = edgeColumns.get('EdgeBetweenness')!.get('cd') as number
  assert.equal(ab, 6)
  assert.equal(bc, 8)
  assert.equal(cd, 6)
  // Sum of all edge betweenness == total shortest-path length across all
  // ordered pairs (connectedPairs=12, avgSpl=20/12 from the summary-stats test).
  approxEqual(ab + bc + cd, 20, 'edge betweenness sum == total path length')
})

test('isolated node next to a triangle (undirected): Radiality guards the singleton to 0', () => {
  const nodeIds = ['A', 'B', 'C', 'E']
  const edges = [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'C', 'A')]
  const graph = buildGraph(nodeIds, edges)
  const { nodeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed: false })

  assert.equal(nodeColumns.get('IsSingleNode')!.get('E'), true)
  assert.equal(nodeColumns.get('Degree')!.get('E'), 0)
  assert.equal(nodeColumns.get('Eccentricity')!.get('E'), 0)
  approxEqual(nodeColumns.get('Radiality')!.get('E') as number, 0, 'radiality guard')
  // The triangle's own nodes are unaffected by E's presence — matches Java
  // writing per-component attributes independently for every component.
  approxEqual(nodeColumns.get('Radiality')!.get('A') as number, 1, 'radiality A')
})

test('directed chain (A -> B -> C): indegree/outdegree, betweenness, stress, edge betweenness', () => {
  const nodeIds = ['A', 'B', 'C']
  const edges = [edge('ab', 'A', 'B'), edge('bc', 'B', 'C')]
  const graph = buildGraph(nodeIds, edges)
  const { nodeColumns, edgeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed: true })

  assert.equal(nodeColumns.get('Indegree')!.get('A'), 0)
  assert.equal(nodeColumns.get('Outdegree')!.get('A'), 1)
  assert.equal(nodeColumns.get('EdgeCount')!.get('A'), 1)
  assert.equal(nodeColumns.get('Indegree')!.get('B'), 1)
  assert.equal(nodeColumns.get('Outdegree')!.get('B'), 1)
  assert.equal(nodeColumns.get('EdgeCount')!.get('B'), 2)
  assert.equal(nodeColumns.get('Indegree')!.get('C'), 1)
  assert.equal(nodeColumns.get('Outdegree')!.get('C'), 0)

  // Only B lies on a directed shortest path (A -> B -> C), normalized by 1/((3-1)(3-2)) = 1/2.
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('A') as number, 0, 'betweenness A')
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('B') as number, 0.5, 'betweenness B')
  approxEqual(nodeColumns.get('BetweennessCentrality')!.get('C') as number, 0, 'betweenness C')
  assert.equal(nodeColumns.get('Stress')!.get('B'), 1)

  // Undirected-only columns must be absent in directed mode.
  assert.equal(nodeColumns.has('Degree'), false)
  assert.equal(nodeColumns.has('Radiality'), false)
  assert.equal(nodeColumns.has('TopologicalCoefficient'), false)

  assert.equal(edgeColumns.get('EdgeBetweenness')!.get('ab'), 2)
  assert.equal(edgeColumns.get('EdgeBetweenness')!.get('bc'), 2)
})

test('multi-edge pair (undirected): the same betweenness value is written to every parallel edge', () => {
  const nodeIds = ['A', 'B', 'C']
  const edges = [edge('e1', 'A', 'B'), edge('e2', 'A', 'B'), edge('e3', 'B', 'C')]
  const graph = buildGraph(nodeIds, edges)
  const { nodeColumns, edgeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed: false })

  assert.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs')!.get('A'), 1)
  assert.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs')!.get('B'), 1)
  assert.equal(nodeColumns.get('PartnerOfMultiEdgedNodePairs')!.get('C'), 0)

  const eb = edgeColumns.get('EdgeBetweenness')!
  // Both parallel A-B edges collapse to the same logical Brandes edge, so
  // they must carry the identical betweenness value.
  assert.equal(eb.get('e1'), eb.get('e2'))
})
