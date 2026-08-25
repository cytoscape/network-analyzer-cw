/**
 * Brief documentation for the summary statistics shown in the results panel:
 * a one-line plain-text description per statistic for tooltips, and a longer
 * one — formula included, where there is one — for the description box under
 * the table. Port of the desktop StatsDoc, texts copied verbatim; keyed by
 * the same statistic IDs as Java's Msgs/NetworkStats.
 *
 * `connPairs` and `usn` are not ported: this panel does not show those two
 * rows (see METRICS in MainPanel.tsx).
 */
import type { JSX } from 'react/jsx-runtime'

export type StatKey =
  | 'nodeCount'
  | 'edgeCount'
  | 'avNeighbors'
  | 'ncc'
  | 'diameter'
  | 'radius'
  | 'avSpl'
  | 'cc'
  | 'density'
  | 'heterogeneity'
  | 'centralization'
  | 'nsl'
  | 'mnp'

/** One-line plain-text descriptions, for tooltips. */
const shortDocs: Record<StatKey, string> = {
  nodeCount: 'Total number of nodes in the network.',
  edgeCount: 'Total number of edges in the network.',
  avNeighbors: 'Average number of neighbors per node.',
  ncc: 'Number of disconnected parts the network splits into.',
  diameter: 'Largest shortest-path distance between any two connected nodes.',
  radius:
    "Smallest node eccentricity; a node's eccentricity is its largest shortest-path distance to any reachable node.",
  avSpl: 'Average shortest-path length between connected node pairs.',
  cc: "How connected each node's neighbors are to one another, on average (0–1).",
  density: 'Fraction of possible edges that actually exist (0–1).',
  heterogeneity: 'Variability of the node degrees; high values indicate hub nodes.',
  centralization: 'How star-like the network is: near 1 = one central hub, near 0 = uniform connectivity.',
  nsl: 'Number of edges that connect a node to itself.',
  mnp: 'Number of node pairs connected by more than one edge.',
}

/** Longer descriptions, for the description box. */
const longDocs: Record<StatKey, JSX.Element> = {
  nodeCount: <>The total number of nodes in the network, including nodes with no connections.</>,
  edgeCount: (
    <>
      The total number of edges in the network, as interpreted by the analysis (paired edges may have been
      combined, depending on the chosen interpretation).
    </>
  ),
  avNeighbors: (
    <>
      The average number of neighbors over all nodes, indicating the average connectivity of a node in the
      network. For a simple undirected network, the network density equals this value divided by (<i>N</i> - 1),
      where <i>N</i> is the number of nodes.
    </>
  ),
  ncc: (
    <>
      A connected component is a maximal set of nodes such that every pair of nodes is connected by a path
      within the component. The number of connected components indicates how fragmented the network is: a fully
      connected network has a single component.
    </>
  ),
  diameter: (
    <>
      The distance between two nodes is the length, in edges, of the shortest path between them. The network
      diameter is the largest distance between any two nodes; node pairs with no connecting path are ignored.
    </>
  ),
  radius: (
    <>
      The eccentricity of a node is the largest shortest-path distance from that node to any other node in its
      connected component. The network radius is the smallest non-zero node eccentricity (the diameter is the
      largest).
    </>
  ),
  avSpl: (
    <>
      Also known as the average shortest path length: the average shortest-path distance over all node pairs
      for which a path exists. It gives the expected distance between two randomly chosen connected nodes.
    </>
  ),
  cc: (
    <>
      The clustering coefficient of a node <i>n</i> measures how connected its neighbors are to one another:{' '}
      <i>
        C<sub>n</sub>
      </i>{' '}
      = 2
      <i>
        e<sub>n</sub>
      </i>{' '}
      / (
      <i>
        k<sub>n</sub>
      </i>
      (
      <i>
        k<sub>n</sub>
      </i>{' '}
      - 1)), where{' '}
      <i>
        k<sub>n</sub>
      </i>{' '}
      is the number of neighbors of <i>n</i> and{' '}
      <i>
        e<sub>n</sub>
      </i>{' '}
      is the number of edges between those neighbors. The network clustering coefficient is the average of{' '}
      <i>
        C<sub>n</sub>
      </i>{' '}
      over all nodes, with nodes having fewer than two neighbors counted as 0. It ranges from 0 (no neighbor of
      any node connects to another neighbor) to 1 (every neighborhood is fully connected).
    </>
  ),
  density: (
    <>
      The fraction of possible edges that actually exist: <i>D</i> = 2<i>E</i> / (<i>N</i>(<i>N</i> - 1)) for a
      network with <i>N</i> nodes and <i>E</i> edges. It ranges from 0 (no edges) to 1 (every possible edge is
      present); self-loops and duplicated edges are not considered.
    </>
  ),
  heterogeneity: (
    <>
      The coefficient of variation of the node degrees: the standard deviation of the degrees divided by their
      mean. A high value indicates greater variation in connectivity and a stronger tendency for some nodes to
      act as hubs.
    </>
  ),
  centralization: (
    <>
      An index of how strongly degree is concentrated in a few nodes: <i>C</i> = (<i>N</i> / (<i>N</i> - 2))
      &#183; (<i>k</i>
      <sub>max</sub> / (<i>N</i> - 1) - <i>D</i>), where <i>k</i>
      <sub>max</sub> is the maximum node degree and <i>D</i> is the network density. Star-like networks have
      centralization close to 1, whereas networks where every node has the same number of neighbors have
      centralization close to 0.
    </>
  ),
  nsl: <>The number of edges whose source and target are the same node.</>,
  mnp: (
    <>
      The number of unordered pairs of nodes that are connected by more than one edge (duplicated or parallel
      edges).
    </>
  ),
}

/** Replacements for `longDocs` entries whose text differs under a directed analysis. */
const directedLongDocs: Partial<Record<StatKey, JSX.Element>> = {
  avNeighbors: (
    <>
      The average number of neighbors over all nodes, indicating the average connectivity of a node in the
      network. Neighbors are counted regardless of edge direction.
    </>
  ),
  cc: (
    <>
      The clustering coefficient of a node <i>n</i> measures how connected its neighbors are to one another:{' '}
      <i>
        C<sub>n</sub>
      </i>{' '}
      ={' '}
      <i>
        e<sub>n</sub>
      </i>{' '}
      / (
      <i>
        k<sub>n</sub>
      </i>
      (
      <i>
        k<sub>n</sub>
      </i>{' '}
      - 1)), where{' '}
      <i>
        k<sub>n</sub>
      </i>{' '}
      is the number of neighbors of <i>n</i>, counted regardless of edge direction, and{' '}
      <i>
        e<sub>n</sub>
      </i>{' '}
      is the number of directed edges between those neighbors, counted individually. The network clustering
      coefficient is the average of{' '}
      <i>
        C<sub>n</sub>
      </i>{' '}
      over all nodes, with nodes having fewer than two neighbors counted as 0. It ranges from 0 (no clustering)
      to 1 (every neighborhood is fully connected).
    </>
  ),
  density: (
    <>
      The fraction of possible edges that actually exist: <i>D</i> = <i>E</i> / (<i>N</i>(<i>N</i> - 1)) for a
      directed network with <i>N</i> nodes and <i>E</i> edges, since each pair of nodes may be connected by an
      edge in each direction. It ranges from 0 (no edges) to 1 (every possible edge is present); self-loops and
      duplicated edges are not considered.
    </>
  ),
  radius: (
    <>
      The eccentricity of a node is the largest shortest-path distance from it to any node reachable from it,
      following edge direction. The network radius is the smallest non-zero node eccentricity (the diameter is
      the largest).
    </>
  ),
  avSpl: (
    <>
      Also known as the average shortest path length: the average shortest-path distance over all node pairs
      for which a path exists. In a directed analysis, paths follow edge direction and the pairs are ordered:
      the distance from one node to another may differ from the distance in the opposite direction.
    </>
  ),
  ncc: (
    <>
      A connected component is a maximal set of nodes such that every pair of nodes is connected by a path
      within the component. The number of connected components indicates how fragmented the network is: a fully
      connected network has a single component. Components are computed ignoring edge direction; in
      graph-theory terms, these are the weakly connected components.
    </>
  ),
  mnp: (
    <>
      {longDocs.mnp} Edge direction is ignored, so two edges in opposite directions between the same two nodes
      also form a multi-edge pair.
    </>
  ),
  // Defined on shortest paths, which follow edge direction when the network
  // is analyzed as directed
  diameter: <>{longDocs.diameter} In a directed analysis, paths follow edge direction.</>,
}

/** The one-line tooltip description of the given statistic. */
export function getShortDoc(key: StatKey): string {
  return shortDocs[key]
}

/** The long description of the given statistic, under the given interpretation. */
export function getLongDoc(key: StatKey, directed: boolean): JSX.Element {
  return (directed ? directedLongDocs[key] : undefined) ?? longDocs[key]
}
