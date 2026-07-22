import { useState } from 'react'
import { useCyWebEvent } from 'cyweb/EventBus'
import { useWorkspaceApi } from 'cyweb/WorkspaceApi'

/**
 * The current network's id, or '' when no network is selected. Stays in sync
 * across every independently-mounted consumer (the Apps menu item, the
 * results panel) since each subscribes to the same `network:switched` event.
 */
export function useCurrentNetworkId(): string {
  const workspaceApi = useWorkspaceApi()
  const [networkId, setNetworkId] = useState(() => {
    const result = workspaceApi.getCurrentNetworkId()
    return result.success ? result.data.networkId : ''
  })

  useCyWebEvent('network:switched', ({ networkId: newNetworkId }) => {
    setNetworkId(newNetworkId)
  })

  return networkId
}
