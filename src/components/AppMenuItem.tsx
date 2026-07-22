import { Box, Paper, Typography } from '@mui/material'
import type { JSX } from 'react/jsx-runtime'
import type { MenuItemHostProps } from 'cyweb/ApiTypes'

import AnalyzeNetworkForm from './AnalyzeNetworkForm'


// `handleClose` (MenuItemHostProps) is unused — closeOnAction on the resource
// registration handles closing the dropdown automatically.
const AppMenuItem = (_props: MenuItemHostProps): JSX.Element => {
  return (
    <Box sx={{ px: 1, backgroundColor: (theme) => theme.palette.background.paper }}>
      <Paper variant="outlined">
        <Box sx={{ px: 2, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
          <Typography variant="overline" color="text.primary">
            Network Analyzer
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 1 }}>
          <AnalyzeNetworkForm />
        </Box>
      </Paper>
    </Box>
  )
}

export default AppMenuItem
