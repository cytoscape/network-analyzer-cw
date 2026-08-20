import { MenuItem, ListItemIcon, ListItemText } from '@mui/material'

import { useState } from 'react'
import type { JSX } from 'react/jsx-runtime'
import type { MenuItemHostProps } from 'cyweb/ApiTypes'

import { AnalyzerDialog } from './AnalyzerDialog'

import { LogoIcon } from './icons'


const AppMenuItem = ({ handleClose }: MenuItemHostProps): JSX.Element => {
  const [newAnalysis, setNewAnalysis] = useState(false)

  return (
    <>
      <MenuItem onClick={() => setNewAnalysis(true)}>
        <ListItemIcon>
          <LogoIcon color="inherit" fontSize="small" viewBox="0 0 32 32" />
        </ListItemIcon>
        <ListItemText>
          Analyze Network
        </ListItemText>
      </MenuItem>
      <AnalyzerDialog open={newAnalysis} onClose={() => setNewAnalysis(false)} />
    </>
  )
}

export default AppMenuItem
