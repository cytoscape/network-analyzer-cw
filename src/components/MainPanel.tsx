import {
  Box,
  Button,
  FormControlLabel,
  List,
  ListItem,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import { lazy, Suspense, useEffect, useState } from 'react'

import { useWorkspaceApi } from 'cyweb/WorkspaceApi'

import { useAnalysisResult } from '../hooks/analysisResultStore'
import { useChartDialog } from '../hooks/useChartDialog'
import { useCurrentNetworkId } from '../hooks/useCurrentNetworkId'
import { useNetworkElementCounts } from '../hooks/useNetworkElementCounts'
import { useNodeColumnNames } from '../hooks/useNodeColumnNames'
import { NetworkAnalysisResult } from '../model/networkAnalyzerTypes'
import { AnalyzerDialog } from './AnalyzerDialog'
import { getLongDoc, getShortDoc, type StatKey } from './statsDoc'

import { BarChartIcon } from './icons'

// Module-scope lazy component (stable identity across renders). PlotDialog
// pulls in plotly + react-chart-editor (a ~10 MB chunk) — deferring it to the
// first chart-button click keeps the panel itself lightweight.
const LazyPlotDialog = lazy(() => import('./PlotDialog'))


// Smallest network the analyzer accepts, as in ResultsPanel.updateButtons
// ("Network Too Small<br>(must have at least 4 nodes and 1 edge)").
const MIN_NODE_COUNT = 4
const MIN_EDGE_COUNT = 1

// Degree column the charts use for undirected results, where there is nothing
// to choose, and the two a directed analysis lets the user pick between
// (ResultsPanel's TOTAL_DEGREE_COLUMN / IN_DEGREE_COLUMN / OUT_DEGREE_COLUMN).
const TOTAL_DEGREE_COLUMN = 'Degree'
const IN_DEGREE_COLUMN = 'Indegree'
const OUT_DEGREE_COLUMN = 'Outdegree'

// Columns only a directed analysis produces, used to recognize directed
// results on a network whose statistics are not in this session
// (ResultsPanel.DIRECTED_ONLY_COLUMNS).
const DIRECTED_ONLY_COLUMNS = [IN_DEGREE_COLUMN, OUT_DEGREE_COLUMN]

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}

// `value` returns null to hide a row entirely — used for centralization/heterogeneity,
// which are undirected-only (null in directed mode). `key` is the Java
// statistic ID (Msgs/NetworkStats), which the descriptions are keyed by.
const METRICS: ReadonlyArray<{
  key: StatKey
  label: string
  value: (result: NetworkAnalysisResult) => string | null
}> = [
  { key: 'nodeCount', label: 'Number of nodes', value: (r) => formatNumber(r.nodeCount) },
  { key: 'edgeCount', label: 'Number of edges', value: (r) => formatNumber(r.edgeCount) },
  { key: 'avNeighbors', label: 'Avg. number of neighbors', value: (r) => formatNumber(r.avNeighbors) },
  { key: 'diameter', label: 'Network diameter', value: (r) => formatNumber(r.diameter) },
  { key: 'radius', label: 'Network radius', value: (r) => formatNumber(r.radius) },
  { key: 'avSpl', label: 'Characteristic path length', value: (r) => formatNumber(r.avgShortestPathLength) },
  { key: 'cc', label: 'Clustering coefficient', value: (r) => formatNumber(r.clusteringCoefficient) },
  { key: 'density', label: 'Network density', value: (r) => formatNumber(r.density) },
  { key: 'heterogeneity', label: 'Network heterogeneity', value: (r) => (r.heterogeneity === null ? null : formatNumber(r.heterogeneity)) },
  { key: 'centralization', label: 'Network centralization', value: (r) => (r.centralization === null ? null : formatNumber(r.centralization)) },
  { key: 'ncc', label: 'Connected components', value: (r) => formatNumber(r.connectedComponents) },
  { key: 'mnp', label: 'Multi-edge node pairs', value: (r) => formatNumber(r.multiEdgeNodePairs) },
  { key: 'nsl', label: 'Number of self-loops', value: (r) => formatNumber(r.selfLoops) },
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
 * Port of ResultsPanel.updateChartButton, including the interpretation hint
 * of getInterpretationHint: when only a directed analysis can produce a
 * missing column (`Indegree`/`Outdegree`), the tooltip says so, since an
 * unqualified "run a new analysis" would let the user re-run the undirected
 * one that cannot create it. Only the directed hint can apply here — every
 * other chart column, `Degree` included, is written by both interpretations.
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
  const hint = missingColumns.some((name) => DIRECTED_ONLY_COLUMNS.includes(name)) ? 'directed ' : ''
  return (
    <Tooltip
      title={
        <>
          {`Requires the node column${plural ? 's' : ''} ${missingColumns.map((name) => `"${name}"`).join(' and ')}.`}
          <br />
          {`Run a new ${hint}analysis to compute ${plural ? 'them' : 'it'}.`}
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

  // The user's pick for directed results; Outdegree starts selected, as in
  // ResultsPanel.createDegreeChoicePanel.
  const [degreeChoice, setDegreeChoice] = useState(OUT_DEGREE_COLUMN)

  // The statistic whose description shows under the table; clicking its row
  // again puts the description away.
  const [selectedStat, setSelectedStat] = useState<StatKey | null>(null)

  const workspaceApi = useWorkspaceApi()
  const networkId = useCurrentNetworkId()
  const result = useAnalysisResult(networkId)

  // The Java panel rebuilds the table — selection cleared — for every new
  // result, and a selection should not carry over to another network either.
  useEffect(() => {
    setSelectedStat(null)
  }, [networkId, result])
  const { nodeCount, edgeCount } = useNetworkElementCounts(networkId)
  const columnNames = useNodeColumnNames(networkId)

  // Whether the results on the current network come from a directed analysis,
  // which is what offers the degree choice. The stored result says so outright
  // and is the authority; without one — a network imported with the columns of
  // an analysis run elsewhere — the directed-only columns are the evidence
  // (ResultsPanel.isDirectedResult).
  const directedResults =
    result !== undefined ? result.directed : DIRECTED_ONLY_COLUMNS.every((name) => columnNames.has(name))

  // The degree column the charts plot: the user's pick for directed results,
  // else Degree (ResultsPanel.getDegreeColumn). It changes both what the
  // buttons plot and which column has to be there for them to be enabled.
  const degreeColumn = directedResults ? degreeChoice : TOTAL_DEGREE_COLUMN

  const {
    plotSpec,
    degreeHistogramMissingColumns,
    betweennessScatterMissingColumns,
    openDegreeHistogram,
    openBetweennessScatter,
    closePlot,
    selectPoints,
  } = useChartDialog(networkId, degreeColumn)

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
          {METRICS.map(({ key, label, value }) => {
            const formatted = value(shownResult)
            if (formatted === null) return null
            return (
              // The whole row answers for the statistic, so hovering the
              // value shows the tooltip too, and clicking anywhere selects
              // it (ResultsPanel.createStatsTable).
              <Tooltip key={key} title={getShortDoc(key)}>
                <TableRow
                  hover
                  selected={selectedStat === key}
                  onClick={() => setSelectedStat((prev) => (prev === key ? null : key))}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ color: 'text.secondary', pl: 0 }}>
                    {label}
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0 }}>
                    {formatted}
                  </TableCell>
                </TableRow>
              </Tooltip>
            )
          })}
          </TableBody>
        </Table>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
          Analysis time (sec): {formatNumber(shownResult.analysisTimeMs / 1000)}
        </Typography>
        {/* Description of the selected statistic — the web counterpart of
            ResultsPanel's DescriptionPanel: always shown, with a hint while
            nothing is selected. A few descriptions change with the
            interpretation, which the result records (getLongDoc). */}
        <Box sx={{ mt: 1, p: 1.5, backgroundColor: (theme) => theme.palette.background.default, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {selectedStat === null ? (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ fontStyle: 'italic', textAlign: 'center', py: 1 }}
            >
              Select a statistic above to see its description.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                {METRICS.find(({ key }) => key === selectedStat)?.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getLongDoc(selectedStat, shownResult.directed)}
              </Typography>
            </>
          )}
        </Box>
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
        {/* A directed analysis computes in-degree and out-degree separately,
            and either can be the one worth plotting, so the user picks. Only
            shown for directed results: an undirected analysis has the single
            Degree column and nothing to choose between
            (ResultsPanel.createDegreeChoicePanel). */}
        {directedResults && (
          <RadioGroup row value={degreeChoice} onChange={(event) => setDegreeChoice(event.target.value)}>
            {[IN_DEGREE_COLUMN, OUT_DEGREE_COLUMN].map((column) => (
              <FormControlLabel
                key={column}
                value={column}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{column}</Typography>}
              />
            ))}
          </RadioGroup>
        )}
        <ChartButton
          hasData={hasData}
          missingColumns={degreeHistogramMissingColumns}
          onClick={openDegreeHistogram}
        >
          Node {degreeColumn} Distribution
        </ChartButton>
        <ChartButton
          hasData={hasData}
          missingColumns={betweennessScatterMissingColumns}
          onClick={openBetweennessScatter}
        >
          Betweenness by {degreeColumn}
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
