import { Box, Paper, Typography } from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import type { MenuItemHostProps } from 'cyweb/ApiTypes'

import AnalyzeNetworkForm from './AnalyzeNetworkForm'


// `closeOnAction` is deliberately NOT set on this resource's registration
// (see NetworkAnalyzerApp.tsx) — it closes the dropdown on ANY click inside
// this menu item, which would unmount this component (and silently kill an
// in-flight analysis Worker) well before a multi-second run can finish. We
// close it ourselves instead, only once the analysis genuinely completes.
const AppMenuItem = ({ handleClose }: MenuItemHostProps): JSX.Element => {
  return (
    <Box sx={{ px: 1, backgroundColor: (theme) => theme.palette.background.paper }}>
      <Paper variant="outlined">
        <Box sx={{ px: 2, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
          <Typography variant="overline" color="text.primary">
            Network Analyzer
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 1 }}>
          <AnalyzeNetworkForm onAnalyze={handleClose} />
        </Box>
      </Paper>
    </Box>
  )
}

export default AppMenuItem
