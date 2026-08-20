import { Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import AnalyzeNetworkForm from './AnalyzeNetworkForm'
import { CloseIcon } from './icons'


export const AnalyzerDialog = ({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element => {
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