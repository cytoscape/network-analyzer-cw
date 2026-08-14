import { useCallback, useEffect, useState } from 'react'
import { useCyWebEvent } from 'cyweb/EventBus'
import { useWorkspaceApi } from 'cyweb/WorkspaceApi'
import type { WorkspaceApi } from 'cyweb/ApiTypes'

export interface NetworkElementCounts {
  nodeCount: number
  edgeCount: number
}

const EMPTY: NetworkElementCounts = { nodeCount: 0, edgeCount: 0 }

function readCounts(workspaceApi: WorkspaceApi, networkId: string): NetworkElementCounts {
  if (networkId === '') return EMPTY

  const result = workspaceApi.getNetworkSummary(networkId)
  if (!result.success) {
    console.warn('Could not read the network summary:', result.error.message)
    return EMPTY
  }
  const { nodeCount, edgeCount } = result.data
  return { nodeCount, edgeCount }
}

/**
 * How many nodes and edges `networkId` currently has, kept in sync with CW.
 *
 * The counts come from the network summary, which CW updates as elements are
 * added and removed. They are re-read on `network:changed` (nodes/edges added
 * or removed) and whenever `networkId` changes — the caller gets that id from
 * `useCurrentNetworkId`, which tracks `network:switched`, so switching
 * networks refreshes the counts too.
 *
 * The event handler re-reads in a microtask rather than inline, because CW
 * updates the summary at the *end* of an element operation while
 * `network:changed` is dispatched from the topology mutation that starts it
 * (nodeOperations/edgeOperations: mutate the network, delete/edit the table
 * rows, then updateNetworkSummary). Reading inline returns the counts from
 * before the change and leaves the panel one edit behind; the summary update
 * is synchronous and in the same tick, so a microtask sees it.
 *
 * Zeroes when there is no current network, or when the summary can't be read.
 */
export function useNetworkElementCounts(networkId: string): NetworkElementCounts {
  const workspaceApi = useWorkspaceApi()
  const [counts, setCounts] = useState<NetworkElementCounts>(EMPTY)

  const refresh = useCallback(
    (id: string): void => {
      const next = readCounts(workspaceApi, id)
      // Same counts (the common case for a cell edit) must not re-render.
      setCounts((current) =>
        current.nodeCount === next.nodeCount && current.edgeCount === next.edgeCount ? current : next,
      )
    },
    [workspaceApi],
  )

  useEffect(() => {
    refresh(networkId)
  }, [refresh, networkId])

  /** Re-reads once the summary update that follows the event has landed. */
  const refreshSoon = useCallback(
    (id: string): void => {
      queueMicrotask(() => refresh(id))
    },
    [refresh],
  )

  // `useCyWebEvent` holds the handler in a ref, so this inline closure always
  // sees the current `networkId` without re-subscribing.
  useCyWebEvent('network:changed', ({ networkId: changedNetworkId }) => {
    if (changedNetworkId !== networkId) return
    refreshSoon(networkId)
  })

  return counts
}
