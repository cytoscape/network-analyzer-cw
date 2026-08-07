/**
 * Type definitions for the Network Analyzer "Summary Statistics" port.
 *
 * This is a TypeScript port (scalar summary statistics only) of the
 * Cytoscape Desktop NetworkAnalyzer app.
 *   - Original Java source (LGPL v2.1+):
 *     de.mpg.mpi_inf.bioinf.netanalyzer (NetworkAnalyzer.java,
 *     UndirNetworkAnalyzer.java, DirNetworkAnalyzer.java,
 *     ConnComponentAnalyzer.java, CyNetworkUtils.java)
 *   - Authors: Yassen Assenov, Sven-Eric Schelhorn, Nadezhda Doncheva
 *     (speed improvements by Dimitry Tegunov)
 *
 * Ported and adapted under the terms of the GNU Lesser General Public
 * License, version 2.1 or (at your option) any later version.
 *
 * The scalar `simpleParams` from the original `NetworkStats` are ported here
 * (node/edge counts, average degree, density, clustering coefficient,
 * diameter/radius, avg. shortest path length, isolated nodes, self-loops,
 * multi-edge node pairs, elapsed time) as `NetworkAnalysisResult`. The
 * per-node/per-edge `complexParams` used for node/edge table columns
 * (betweenness, stress, closeness, topological coefficient, etc. — see
 * networkAnalyzerColumns.ts) are also ported, restricted to the same
 * scalar-per-element values Java writes as table attributes. The chart
 * distributions (degree distribution, betweenness-by-degree scatter) are not
 * precomputed here — the chart dialogs (PlotDialog.tsx, plotSpecs.ts) build
 * them on demand from the written table columns, like CyPlot does on Desktop.
 */

/** Minimal edge shape needed for analysis — endpoints only. */
export interface EdgeEndpoints {
  sourceId: string
  targetId: string
}

/** An edge with its own element id, needed to write per-edge table columns. */
export interface IdentifiedEdge extends EdgeEndpoints {
  id: string
}

export interface NetworkAnalysisOptions {
  /** Treat edges as directed (source -> target) rather than undirected. */
  directed: boolean
}

/** Scalar "Summary Statistics" for a network, mirroring NetworkStats.simpleParams. */
export interface NetworkAnalysisResult {
  directed: boolean
  nodeCount: number
  edgeCount: number
  /** Average number of distinct neighbors per node ("avNeighbors"). */
  avNeighbors: number
  density: number
  /**
   * Degree centralization. Undirected only — the original DirNetworkAnalyzer
   * does not compute this for directed networks.
   */
  centralization: number | null
  /**
   * Heterogeneity (coefficient of variation of the degree distribution).
   * Undirected only, same reasoning as `centralization`.
   */
  heterogeneity: number | null
  /** Average local clustering coefficient ("cc"), averaged over all nodes. */
  clusteringCoefficient: number
  /** Number of (weakly) connected components ("ncc"). */
  connectedComponents: number
  /** Longest shortest-path eccentricity across all nodes ("diameter"). */
  diameter: number
  /** Shortest non-zero eccentricity across all nodes ("radius"). */
  radius: number
  /** Average shortest path length over all connected ordered pairs ("avSpl"). */
  avgShortestPathLength: number
  /** Number of connected ordered pairs of nodes ("connPairs"). */
  connectedPairs: number
  /** Number of nodes with no neighbors ("usn" — unconnected/isolated nodes). */
  isolatedNodes: number
  /** Number of self-loop edges ("nsl"). */
  selfLoops: number
  /** Number of node pairs connected by more than one edge ("mnp"). */
  multiEdgeNodePairs: number
  /** Wall-clock time spent inside the algorithm itself, in milliseconds. */
  analysisTimeMs: number
}
