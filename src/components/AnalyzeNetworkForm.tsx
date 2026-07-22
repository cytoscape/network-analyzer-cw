import { Box, Button, Checkbox, FormControlLabel } from '@mui/material'
import { useState } from 'react'
import type { JSX } from 'react/jsx-runtime'

import { useAnalyzeNetworkAction } from '../hooks/useAnalyzeNetworkAction'
import { useCurrentNetworkId } from '../hooks/useCurrentNetworkId'

/**
 * "Analyze as Directed Graph" checkbox + "Analyze Network" button. Shared by
 * the Apps menu item and the results panel (shown there when a network is
 * selected but hasn't been analyzed yet) so both stay behaviorally identical.
 */
const AnalyzeNetworkForm = ({ onAnalyze }: { onAnalyze?: (networkId: string, directed: boolean) => void }): JSX.Element => {
  const networkId = useCurrentNetworkId()
  const analyze = useAnalyzeNetworkAction()
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
        disabled={networkId === ''}
        onClick={() => {
          analyze(networkId, directed)
          onAnalyze?.(networkId, directed)
        }}
      >
        Analyze Network
      </Button>
    </Box>
  )
}

export default AnalyzeNetworkForm
