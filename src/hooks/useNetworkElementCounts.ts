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
 * added and removed. They are re-read whenever `networkId` changes — the
 * caller gets that id from `useCurrentNetworkId`, which tracks
 * `network:switched` — and on the events below.
 *
 * TODO: drop the `data:changed` subscription once CW fixes `network:changed`.
 * That is the event meant for this, but as of `@cytoscape-web/api-types`
 * 1.0.0-beta.3 it never fires for node/edge add/remove: CW's networks are
 * cytoscape-backed and mutated in place (see the "we return the same
 * reference" notes in networkStoreImpl.deleteNodesFromNetwork), so
 * `networks.set(id, sameRef)` marks nothing changed under immer and the
 * `subscribeWithSelector((s) => s.networks)` in initEventBus never runs — and
 * its `prevNetwork === network` guard would skip the diff anyway. Adding or
 * removing elements does add/remove the matching node/edge table rows, so
 * `data:changed` is a reliable stand-in; it also fires for plain cell edits,
 * hence the no-op guard in `refresh`.
 *
 * The event handlers re-read in a microtask rather than inline, because CW
 * updates the summary *after* the table write that dispatches the event: in
 * nodeOperations/edgeOperations the order is delete-from-network,
 * delete/edit-rows, then updateNetworkSummary. Reading inline returns the
 * counts from before the change, which leaves the button one edit behind. The
 * summary update is synchronous and in the same tick, so a microtask sees it.
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

  // `useCyWebEvent` holds the handler in a ref, so these inline closures always
  // see the current `networkId` without re-subscribing.
  useCyWebEvent('network:changed', ({ networkId: changedNetworkId }) => {
    if (changedNetworkId !== networkId) return
    refreshSoon(networkId)
  })

  // Stand-in for the broken `network:changed` — see the TODO above.
  useCyWebEvent('data:changed', ({ networkId: changedNetworkId }) => {
    if (changedNetworkId !== networkId) return
    refreshSoon(networkId)
  })

  return counts
}
