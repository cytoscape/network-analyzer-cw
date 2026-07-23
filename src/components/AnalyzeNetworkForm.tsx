import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import type { JSX } from 'react/jsx-runtime'

import { useAnalyzeNetworkAction } from '../hooks/useAnalyzeNetworkAction'
import { useCurrentNetworkId } from '../hooks/useCurrentNetworkId'

/**
 * "Analyze as Directed Graph" checkbox + "Analyze Network" button. Shared by
 * the Apps menu item and the results panel (shown there when a network is
 * selected but hasn't been analyzed yet) so both stay behaviorally identical.
 *
 * The analysis itself runs in a Web Worker (see useAnalyzeNetworkAction.ts /
 * useNetworkAnalyzerWorker.ts) so the tab stays responsive on large networks.
 * While it runs, a modal shows progress and a Cancel button; while the
 * results are being written back to the node/edge tables afterward, the same
 * modal shows a non-cancellable "Saving results…" message — mirrors the
 * sibling MCODE app's analysis-progress dialog.
 */
// `onAnalyze` fires once the run genuinely completes (not on click, and not
// on a cancel) — MainPanel uses it to switch back from its "New Analysis"
// form to the summary view only once there's an actual new result to show.
const AnalyzeNetworkForm = ({ onAnalyze }: { onAnalyze?: (networkId: string, directed: boolean) => void }): JSX.Element => {
  const networkId = useCurrentNetworkId()
  const { analyze, cancel, status } = useAnalyzeNetworkAction()
  const [directed, setDirected] = useState(false)

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <FormControlLabel
        label="Analyze as Directed Graph"
        control={<Checkbox checked={directed} onChange={(e) => setDirected(e.target.checked)} />}
        onClick={(e) => e.stopPropagation()}
      />
      <Button
        variant="contained"
        size="small"
        disabled={networkId === '' || status !== 'idle'}
        onClick={() => analyze(networkId, directed, () => onAnalyze?.(networkId, directed))}
      >
        Analyze Network
      </Button>

      <Dialog open={status !== 'idle'}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress color="primary" />
          <Typography>{status === 'saving' ? 'Saving results…' : 'Analyzing network…'}</Typography>
        </DialogContent>
        {/* Cancel only while the worker runs; the saving phase isn't cancellable. */}
        {status === 'analyzing' && (
          <DialogActions>
            <Button variant="outlined" color="error" onClick={cancel}>
              Cancel
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  )
}

export default AnalyzeNetworkForm
