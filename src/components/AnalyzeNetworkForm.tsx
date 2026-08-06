import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  SvgIcon,
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
        gap: 2,
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
        startIcon={
          <SvgIcon color="inherit" fontSize="small" viewBox="0 0 32 32">
            <path d="M13.538,-0 C15.372,0 17.125,0.356 18.798,1.067 C20.471,1.779 21.913,2.741 23.125,3.952 C24.337,5.164 25.298,6.606 26.01,8.279 C26.721,9.952 27.077,11.705 27.077,13.539 C27.077,16.359 26.282,18.917 24.692,21.212 L31.288,27.808 C31.763,28.282 32,28.859 32,29.538 C32,30.218 31.76,30.798 31.279,31.279 C30.798,31.76 30.218,32 29.538,32 C28.846,32 28.269,31.756 27.808,31.269 L21.211,24.692 C18.917,26.282 16.359,27.077 13.538,27.077 C11.705,27.077 9.952,26.721 8.279,26.01 C6.606,25.298 5.164,24.337 3.952,23.125 C2.74,21.914 1.779,20.471 1.067,18.798 C0.356,17.125 0,15.372 0,13.539 C0,11.705 0.356,9.952 1.067,8.279 C1.779,6.606 2.74,5.164 3.952,3.952 C5.164,2.741 6.606,1.779 8.279,1.067 C9.952,0.356 11.705,0 13.538,0 z M13.538,2.249 C10.43,2.249 7.772,3.353 5.563,5.563 C3.353,7.772 2.249,10.43 2.249,13.539 C2.249,16.647 3.353,19.305 5.563,21.514 C7.772,23.724 10.43,24.828 13.538,24.828 C16.647,24.828 19.305,23.724 21.514,21.514 C23.724,19.305 24.828,16.647 24.828,13.539 C24.828,10.43 23.724,7.772 21.514,5.563 C19.305,3.353 16.647,2.249 13.538,2.249 z" />
            <path d="M12.25,21.038 L14.5,21.038 C14.875,21.038 15.25,20.663 15.25,20.288 L15.25,12.413 C15.25,12.038 14.875,11.663 14.5,11.663 L12.25,11.663 C11.875,11.663 11.5,12.038 11.5,12.413 L11.5,20.288 C11.5,20.663 11.875,21.038 12.25,21.038 z" />
            <path d="M17.75,21.038 C17.375,21.038 17,20.663 17,20.288 L17,6.788 C17,6.413 17.375,6.038 17.75,6.038 L20,6.038 C20.375,6.038 20.75,6.413 20.75,6.788 L20.75,20.288 C20.75,20.663 20.375,21.038 20,21.038 L17.75,21.038 z" />
            <path d="M6.75,21.038 C6.375,21.038 6,20.663 6,20.288 L6,16.163 C6,15.788 6.375,15.413 6.75,15.413 L9,15.413 C9.375,15.413 9.75,15.788 9.75,16.163 L9.75,20.288 C9.75,20.663 9.375,21.038 9,21.038 L6.75,21.038 z" />
          </SvgIcon>
        }
        onClick={() => analyze(networkId, directed, () => onAnalyze?.(networkId, directed))}
        sx={{ mx: 'auto' }}
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
