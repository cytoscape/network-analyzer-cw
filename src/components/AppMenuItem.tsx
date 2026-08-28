import { MenuItem, ListItemIcon, ListItemText } from '@mui/material'

import type { JSX } from 'react/jsx-runtime'
import { useAppContext } from 'cyweb/AppIdContext'

import { LogoIcon } from './icons'

// The click opens the host-rendered 'analyzer' modal (modal-launcher slot),
// which lives outside this dropdown's subtree — so the dropdown closes right
// away (closeOnAction: true on the registration) while the form, and any
// analysis Worker it starts, keeps running in the modal.
const AppMenuItem = (): JSX.Element => {
  const ctx = useAppContext()

  return (
    <MenuItem
      onClick={() => {
        ctx?.apis.resource.openModal('analyzer')
      }}
    >
      <ListItemIcon>
        <LogoIcon color="inherit" fontSize="small" viewBox="0 0 32 32" />
      </ListItemIcon>
      <ListItemText>
        Analyze Network
      </ListItemText>
    </MenuItem>
  )
}

export default AppMenuItem
