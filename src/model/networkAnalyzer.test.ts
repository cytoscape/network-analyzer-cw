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
import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeNetwork } from './networkAnalyzer'
import { EdgeEndpoints } from './networkAnalyzerTypes'

function edge(sourceId: string, targetId: string): EdgeEndpoints {
  return { sourceId, targetId }
}

function approxEqual(actual: number, expected: number, message: string): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`,
  )
}

test('triangle (3 nodes, fully connected, undirected)', () => {
  const result = analyzeNetwork(
    ['A', 'B', 'C'],
    [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')],
    { directed: false },
  )

  assert.equal(result.nodeCount, 3)
  assert.equal(result.edgeCount, 3)
  approxEqual(result.avNeighbors, 2, 'avNeighbors')
  approxEqual(result.density, 1, 'density')
  approxEqual(result.centralization ?? NaN, 0, 'centralization')
  approxEqual(result.heterogeneity ?? NaN, 0, 'heterogeneity')
  approxEqual(result.clusteringCoefficient, 1, 'clusteringCoefficient')
  assert.equal(result.connectedComponents, 1)
  assert.equal(result.diameter, 1)
  assert.equal(result.radius, 1)
  approxEqual(result.avgShortestPathLength, 1, 'avgShortestPathLength')
  assert.equal(result.connectedPairs, 6)
  assert.equal(result.isolatedNodes, 0)
  assert.equal(result.selfLoops, 0)
  assert.equal(result.multiEdgeNodePairs, 0)
})

test('path graph (4 nodes, A-B-C-D, undirected)', () => {
  const result = analyzeNetwork(
    ['A', 'B', 'C', 'D'],
    [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')],
    { directed: false },
  )

  assert.equal(result.nodeCount, 4)
  assert.equal(result.edgeCount, 3)
  approxEqual(result.avNeighbors, 1.5, 'avNeighbors')
  approxEqual(result.density, 0.5, 'density')
  approxEqual(result.centralization ?? NaN, 1 / 3, 'centralization')
  approxEqual(result.heterogeneity ?? NaN, 1 / 3, 'heterogeneity')
  approxEqual(result.clusteringCoefficient, 0, 'clusteringCoefficient')
  assert.equal(result.connectedComponents, 1)
  assert.equal(result.diameter, 3)
  assert.equal(result.radius, 2)
  approxEqual(result.avgShortestPathLength, 20 / 12, 'avgShortestPathLength')
  assert.equal(result.connectedPairs, 12)
  assert.equal(result.isolatedNodes, 0)
})

test('isolated node alongside a connected pair (undirected) — restricted to the largest component', () => {
  const result = analyzeNetwork(['A', 'B', 'C'], [edge('A', 'B')], { directed: false })

  // nodeCount/edgeCount/connectedComponents are whole-network...
  assert.equal(result.nodeCount, 3)
  assert.equal(result.edgeCount, 1)
  assert.equal(result.connectedComponents, 2)
  // ...but avNeighbors/isolatedNodes/diameter/etc. are computed over ONLY the
  // largest component ({A, B}), matching org.cytoscape.analyzer's
  // UndirNetworkAnalyzer.computeAll() -> stats.copyStats(largest.getStats()).
  // C (isolated, its own component) is excluded from these entirely.
  approxEqual(result.avNeighbors, 1, 'avNeighbors')
  assert.equal(result.isolatedNodes, 0)
  assert.equal(result.diameter, 1)
  assert.equal(result.radius, 1)
  assert.equal(result.connectedPairs, 2)
  approxEqual(result.avgShortestPathLength, 1, 'avgShortestPathLength')
})

test('triangle plus a disconnected pair (undirected) — largest component wins', () => {
  const result = analyzeNetwork(
    ['A', 'B', 'C', 'D', 'E'],
    [edge('A', 'B'), edge('B', 'C'), edge('C', 'A'), edge('D', 'E')],
    { directed: false },
  )

  assert.equal(result.nodeCount, 5)
  assert.equal(result.edgeCount, 4)
  assert.equal(result.connectedComponents, 2)
  // All computed over the 3-node triangle, not the whole 5-node network.
  approxEqual(result.avNeighbors, 2, 'avNeighbors')
  approxEqual(result.density, 1, 'density')
  approxEqual(result.clusteringCoefficient, 1, 'clusteringCoefficient')
  assert.equal(result.diameter, 1)
  assert.equal(result.radius, 1)
  assert.equal(result.connectedPairs, 6)
  approxEqual(result.avgShortestPathLength, 1, 'avgShortestPathLength')
  assert.equal(result.isolatedNodes, 0)
})

test('self-loop is counted but excluded from adjacency (undirected)', () => {
  const result = analyzeNetwork(['A', 'B'], [edge('A', 'B'), edge('A', 'A')], {
    directed: false,
  })

  assert.equal(result.nodeCount, 2)
  assert.equal(result.edgeCount, 2)
  assert.equal(result.selfLoops, 1)
  // Self-loop must not inflate A's neighbor count.
  approxEqual(result.avNeighbors, 1, 'avNeighbors')
  assert.equal(result.multiEdgeNodePairs, 0)
  assert.equal(result.diameter, 1)
  assert.equal(result.connectedPairs, 2)
})

test('multi-edge node pair is detected (undirected)', () => {
  const result = analyzeNetwork(['A', 'B'], [edge('A', 'B'), edge('A', 'B')], {
    directed: false,
  })

  assert.equal(result.nodeCount, 2)
  assert.equal(result.edgeCount, 2)
  assert.equal(result.multiEdgeNodePairs, 1)
  // Duplicate edges must not inflate the distinct neighbor count.
  approxEqual(result.avNeighbors, 1, 'avNeighbors')
  approxEqual(result.density, 1, 'density')
})

test('directed chain (A -> B -> C)', () => {
  const result = analyzeNetwork(['A', 'B', 'C'], [edge('A', 'B'), edge('B', 'C')], {
    directed: true,
  })

  assert.equal(result.nodeCount, 3)
  assert.equal(result.edgeCount, 2)
  assert.equal(result.centralization, null)
  assert.equal(result.heterogeneity, null)
  // avNeighbors uses ANY-direction distinct neighbor counts: A=1, B=2, C=1.
  approxEqual(result.avNeighbors, 4 / 3, 'avNeighbors')
  // density uses distinct out-neighbor counts: (1 + 1 + 0) / (3*2).
  approxEqual(result.density, 1 / 3, 'density')
  approxEqual(result.clusteringCoefficient, 0, 'clusteringCoefficient')
  // Connected components are weak (ANY-direction) even in directed mode.
  assert.equal(result.connectedComponents, 1)
  // Diameter/radius/avSpl follow out-edges only: A reaches B,C; B reaches C; C reaches nothing.
  assert.equal(result.diameter, 2)
  assert.equal(result.radius, 1)
  assert.equal(result.connectedPairs, 3)
  approxEqual(result.avgShortestPathLength, 4 / 3, 'avgShortestPathLength')
  assert.equal(result.isolatedNodes, 0)
})

test('empty network', () => {
  const result = analyzeNetwork([], [], { directed: false })

  assert.equal(result.nodeCount, 0)
  assert.equal(result.edgeCount, 0)
  assert.equal(result.avNeighbors, 0)
  assert.equal(result.density, 0)
  assert.equal(result.diameter, 0)
  assert.equal(result.connectedComponents, 0)
})
