import { 
  Box,
  Button,
  List,
  ListItem,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import { lazy, Suspense, useState } from 'react'

import { useWorkspaceApi } from 'cyweb/WorkspaceApi'

import { useAnalysisResult } from '../hooks/analysisResultStore'
import { useChartDialog } from '../hooks/useChartDialog'
import { useCurrentNetworkId } from '../hooks/useCurrentNetworkId'
import { useNetworkElementCounts } from '../hooks/useNetworkElementCounts'
import { NetworkAnalysisResult } from '../model/networkAnalyzerTypes'
import { AnalyzerDialog } from './AnalyzerDialog'

import { BarChartIcon } from './icons'

// Module-scope lazy component (stable identity across renders). PlotDialog
// pulls in plotly + react-chart-editor (a ~10 MB chunk) — deferring it to the
// first chart-button click keeps the panel itself lightweight.
const LazyPlotDialog = lazy(() => import('./PlotDialog'))


// Smallest network the analyzer accepts, as in ResultsPanel.updateButtons
// ("Network Too Small<br>(must have at least 4 nodes and 1 edge)").
const MIN_NODE_COUNT = 4
const MIN_EDGE_COUNT = 1

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}

// `value` returns null to hide a row entirely — used for centralization/heterogeneity,
// which are undirected-only (null in directed mode).
const METRICS: ReadonlyArray<{ label: string; value: (result: NetworkAnalysisResult) => string | null }> = [
  { label: 'Number of nodes', value: (r) => formatNumber(r.nodeCount) },
  { label: 'Number of edges', value: (r) => formatNumber(r.edgeCount) },
  { label: 'Avg. number of neighbors', value: (r) => formatNumber(r.avNeighbors) },
  { label: 'Network diameter', value: (r) => formatNumber(r.diameter) },
  { label: 'Network radius', value: (r) => formatNumber(r.radius) },
  { label: 'Characteristic path length', value: (r) => formatNumber(r.avgShortestPathLength) },
  { label: 'Clustering coefficient', value: (r) => formatNumber(r.clusteringCoefficient) },
  { label: 'Network density', value: (r) => formatNumber(r.density) },
  { label: 'Network heterogeneity', value: (r) => (r.heterogeneity === null ? null : formatNumber(r.heterogeneity)) },
  { label: 'Network centralization', value: (r) => (r.centralization === null ? null : formatNumber(r.centralization)) },
  { label: 'Connected components', value: (r) => formatNumber(r.connectedComponents) },
  { label: 'Multi-edge node pairs', value: (r) => formatNumber(r.multiEdgeNodePairs) },
  { label: 'Number of self-loops', value: (r) => formatNumber(r.selfLoops) },
]

const EXTRA_INFO: ReadonlyArray<JSX.Element> = [
  <>Node specific statistics are found in the NODES Table.</>,
  <>Edge <i>Betweenness</i> is added to the EDGES Table.</>
]


/**
 * A chart button. It is enabled only when the network has something to plot
 * (`hasData`) and every node column the chart needs is in the NODES table;
 * while a column is missing, a tooltip says which ones and how to get them
 * back.
 *
 * Port of ResultsPanel.updateChartButton. The Java tooltip also names the
 * interpretation to re-run with ("run a new undirected analysis"), because
 * there `Degree` comes out of an undirected run only; here both charts' columns
 * are written by directed and undirected analyses alike, so the hint would
 * always be empty and is left out.
 */
const ChartButton = ({
  children,
  hasData,
  missingColumns,
  onClick,
}: {
  children: React.ReactNode
  hasData: boolean
  missingColumns: string[]
  onClick?: () => void
}): JSX.Element => {
  const button = (
    <Button
      variant="outlined"
      size="small"
      startIcon={<BarChartIcon />}
      sx={{ minWidth: 220, textTransform: 'none', borderRadius: 4, backgroundColor: (theme) => theme.palette.background.paper }}
      disabled={!hasData || missingColumns.length > 0}
      onClick={onClick}
    >
      {children}
    </Button>
  )

  if (!hasData || missingColumns.length === 0) return button

  const plural = missingColumns.length > 1
  return (
    <Tooltip
      title={
        <>
          {`Requires the node column${plural ? 's' : ''} ${missingColumns.map((name) => `"${name}"`).join(' and ')}.`}
          <br />
          {`Run a new analysis to compute ${plural ? 'them' : 'it'}.`}
        </>
      }
    >
      {/* A disabled MUI button fires no pointer events — the tooltip needs an enabled wrapper. */}
      <span>{button}</span>
    </Tooltip>
  )
}


const MainPanel = (): JSX.Element => {
  const [newAnalysis, setNewAnalysis] = useState(false)

  const workspaceApi = useWorkspaceApi()
  const networkId = useCurrentNetworkId()
  const result = useAnalysisResult(networkId)
  const { nodeCount, edgeCount } = useNetworkElementCounts(networkId)
  const {
    plotSpec,
    degreeHistogramMissingColumns,
    betweennessScatterMissingColumns,
    openDegreeHistogram,
    openBetweennessScatter,
    closePlot,
    selectPoints,
  } = useChartDialog(networkId)

  if (networkId === '') {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'grid',
          padding: '1em',
          backgroundColor: (theme) => theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            margin: 'auto',
            color: (theme) => theme.palette.text.disabled,
          }}
        >
          <h2>No network selected</h2>
        </Box>
      </Box>
    )
  }

  const summaryResult = workspaceApi.getNetworkSummary(networkId)
  const networkName = summaryResult.success ? summaryResult.data.name : networkId

  // Same rules as ResultsPanel.updateButtons: too small a network has nothing
  // meaningful to analyze, and an edgeless one nothing to plot.
  const tooSmall = nodeCount < MIN_NODE_COUNT || edgeCount < MIN_EDGE_COUNT
  const hasData = nodeCount > 0 && edgeCount > 0

  // Mirrors ResultsPanel.update(): the size checks come first, so a network
  // that has shrunk below the minimum reports that rather than statistics
  // computed while it was still big enough.
  const infoMessage =
    nodeCount === 0
      ? { title: 'Empty Network' }
      : tooSmall
        ? {
            title: 'Network Too Small',
            detail: `(must have at least ${MIN_NODE_COUNT} nodes and ${MIN_EDGE_COUNT} edge)`,
          }
        : result === undefined
          ? {
              title: 'No Statistics Found',
              detail: '(run a new analysis to calculate statistics for this network)',
            }
          : undefined

  // Non-undefined exactly when `infoMessage` is undefined — narrows `result`
  // for the statistics table below.
  const shownResult = infoMessage === undefined ? result : undefined

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box 
        sx={{
          px: 2,
          py: 1,
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, mt: 0.75, paddingLeft: '9px', textIndent: '-9px' }}>
          {shownResult && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              <b>{shownResult.directed ? 'Directed' : 'Undirected'}</b>&mdash;
            </Typography>
          )}
            {networkName}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={tooSmall}
            onClick={() => setNewAnalysis(true)}
            sx={{ flexShrink: 0, borderRadius: 4, textTransform: 'none', backgroundColor: (theme) => theme.palette.background.paper }}
          >
            New Analysis...
          </Button>
        </Box>
      </Box>
    {shownResult === undefined ? (
      // Centered, greyed-out message in place of the statistics — the web
      // counterpart of ResultsPanel.setResultString.
      <Box sx={{ flexGrow: 1, display: 'grid', px: 2, py: 1 }}>
        <Box sx={{ m: 'auto', textAlign: 'center', color: (theme) => theme.palette.text.disabled }}>
          <Typography variant="body2" color="inherit">
            {infoMessage?.title}
          </Typography>
          {infoMessage?.detail !== undefined && (
            <Typography variant="body2" color="inherit">
              {infoMessage.detail}
            </Typography>
          )}
        </Box>
      </Box>
    ) : (
      <Box
        sx={{
          flexGrow: 1,
          px: 2,
          py: 1,
          overflowY: 'auto',
        }}
      >
        <Typography variant="overline" color="text.primary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
          Summary Statistics:
        </Typography>
        <Table size="small">
          <TableBody>
          {METRICS.map(({ label, value }) => {
            const formatted = value(shownResult)
            if (formatted === null) return null
            return (
              <TableRow key={label}>
                <TableCell sx={{ color: 'text.secondary', pl: 0 }}>
                  {label}
                </TableCell>
                <TableCell align="right" sx={{ pr: 0 }}>
                  {formatted}
                </TableCell>
              </TableRow>
            )
          })}
          </TableBody>
        </Table>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
          Analysis time (sec): {formatNumber(shownResult.analysisTimeMs / 1000)}
        </Typography>
        <List
          dense
          sx={{
            mt: 1,
            display: 'flex',
            flexDirection: 'column',
            listStyleType: 'disc',
            pl: 2,
            '& ::marker': { 
              color: 'text.disabled',
            } 
          }}
        >
        {EXTRA_INFO.map((info, index) => (
          <ListItem key={index} sx={{ py: 0, px: 0, display: 'list-item' }}>
            <Typography variant="caption" color="text.secondary">
              {info}
            </Typography>
          </ListItem>
        ))}
        </List>
      </Box>
    )}
      {/* Always shown, like the Java panel's button bar — enablement, not
          visibility, tells the user whether a chart can be plotted. */}
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        <ChartButton
          hasData={hasData}
          missingColumns={degreeHistogramMissingColumns}
          onClick={openDegreeHistogram}
        >
          Node Degree Distribution
        </ChartButton>
        <ChartButton
          hasData={hasData}
          missingColumns={betweennessScatterMissingColumns}
          onClick={openBetweennessScatter}
        >
          Betweenness by Degree
        </ChartButton>
      </Box>
      <AnalyzerDialog open={newAnalysis} onClose={() => setNewAnalysis(false)} />
      {plotSpec !== null && (
        <Suspense fallback={null}>
          <LazyPlotDialog open onClose={closePlot} spec={plotSpec} onSelectPoints={selectPoints} />
        </Suspense>
      )}
    </Box>
  )
}

export default MainPanel
