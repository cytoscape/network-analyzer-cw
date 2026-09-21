import { DialogContent, DialogTitle, Typography } from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import type { ModalHostProps } from 'cyweb/ApiTypes'
import { useAppContext } from 'cyweb/AppIdContext'
import { showResultsPanel } from '../model/resultsPanel'
import AnalyzeNetworkForm from './AnalyzeNetworkForm'

/**
 * The "Analyze Network" modal, registered in the host's 'modal-launcher'
 * slot (see NetworkAnalyzerApp.tsx) and opened via openModal('analyzer').
 * The host owns the Dialog shell — sizing, an inert backdrop, Escape, and a
 * structural Close "X" — so this renders only the dialog contents.
 * `onAnalyze` fires once a run genuinely completes (not on click, not on
 * cancel), which is when the modal should go away — and when the results tab
 * is brought into view: the modal is usually opened from the Apps menu, with
 * the side panel closed or on another tab, so without this a finished run
 * shows the user nothing. Opened from the panel's own "New Analysis..."
 * button, the tab is already showing and the call changes nothing.
 */
const AnalyzerModal = ({ requestClose }: ModalHostProps): JSX.Element => {
  const appContext = useAppContext()

  return (
    <>
      <DialogTitle
        sx={{
          px: 3,
          py: 2,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6">Network Analyzer</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: (theme) => `${theme.spacing(1)} !important` }}>
        <AnalyzeNetworkForm
          onAnalyze={() => {
            requestClose()
            showResultsPanel(appContext?.apis)
          }}
        />
      </DialogContent>
    </>
  )
}

export default AnalyzerModal
