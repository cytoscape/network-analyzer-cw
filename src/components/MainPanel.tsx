import { 
  Box,
  Button,
  Dialog,
  DialogTitle,
  List,
  ListItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
  DialogContent,
  IconButton,
} from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import { lazy, Suspense, useState } from 'react'

import { useWorkspaceApi } from 'cyweb/WorkspaceApi'

import { useAnalysisResult } from '../hooks/analysisResultStore'
import { useChartDialog } from '../hooks/useChartDialog'
import { useCurrentNetworkId } from '../hooks/useCurrentNetworkId'
import { NetworkAnalysisResult } from '../model/networkAnalyzerTypes'
import AnalyzeNetworkForm from './AnalyzeNetworkForm'

// Module-scope lazy component (stable identity across renders). PlotDialog
// pulls in plotly + react-chart-editor (a ~10 MB chunk) — deferring it to the
// first chart-button click keeps the panel itself lightweight.
const LazyPlotDialog = lazy(() => import('./PlotDialog'))

import BarChartIcon from '@mui/icons-material/BarChart'
import CloseIcon from '@mui/icons-material/Close'


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


const AnalyzerDialog = ({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element => {
  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      onClose={onClose}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6">Network Analyzer</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close dialog">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: (theme) => `${theme.spacing(1)} !important` }}>
        <AnalyzeNetworkForm onAnalyze={() => onClose()} />
      </DialogContent>
    </Dialog>
  )
}


const ChartButton = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }): JSX.Element => {
  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<BarChartIcon />}
      sx={{ minWidth: 220, textTransform: 'none', borderRadius: 4, backgroundColor: (theme) => theme.palette.background.paper }}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}


const MainPanel = (): JSX.Element => {
  const [newAnalysis, setNewAnalysis] = useState(false)

  const workspaceApi = useWorkspaceApi()
  const networkId = useCurrentNetworkId()
  const result = useAnalysisResult(networkId)
  const { plotSpec, openDegreeHistogram, openBetweennessScatter, closePlot, selectPoints } = useChartDialog(networkId)

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
          {result && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              <b>{result.directed ? 'Directed' : 'Undirected'}</b>&mdash;
            </Typography>
          )}
            {networkName}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setNewAnalysis(true)}
            sx={{ flexShrink: 0, borderRadius: 4, textTransform: 'none', backgroundColor: (theme) => theme.palette.background.paper }}
          >
            New Analysis...
          </Button>
        </Box>
      </Box>
    {result && (
      <>
      <Box
        sx={{
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
            const formatted = value(result)
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
          Analysis time (sec): {formatNumber(result.analysisTimeMs / 1000)}
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
        <ChartButton onClick={openDegreeHistogram}>
          Node Degree Distribution
        </ChartButton>
        <ChartButton onClick={openBetweennessScatter}>
          Betweenness by Degree
        </ChartButton>
      </Box>
    </>
    )}
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
