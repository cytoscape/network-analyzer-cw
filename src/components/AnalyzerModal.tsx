import { DialogContent, DialogTitle, Typography } from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import type { ModalHostProps } from 'cyweb/ApiTypes'
import AnalyzeNetworkForm from './AnalyzeNetworkForm'

/**
 * The "Analyze Network" modal, registered in the host's 'modal-launcher'
 * slot (see NetworkAnalyzerApp.tsx) and opened via openModal('analyzer').
 * The host owns the Dialog shell — sizing, inert backdrop/Escape, and a
 * structural Close "X" — so this renders only the dialog contents.
 * `onAnalyze` fires once a run genuinely completes (not on click, not on
 * cancel), which is when the modal should go away.
 */
const AnalyzerModal = ({ requestClose }: ModalHostProps): JSX.Element => {
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
        <AnalyzeNetworkForm onAnalyze={() => requestClose()} />
      </DialogContent>
    </>
  )
}

export default AnalyzerModal
