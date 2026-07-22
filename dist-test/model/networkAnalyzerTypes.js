"use strict";
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
 * scalar-per-element values Java writes as table attributes. The chart-only
 * distributions themselves (degree distribution, C(k), scatter plots) remain
 * out of scope — there's no chart UI for this app yet.
 */
Object.defineProperty(exports, "__esModule", { value: true });
