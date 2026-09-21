import { useCallback, useEffect, useState } from 'react'
import { useCyWebEvent } from 'cyweb/EventBus'
import { useTableApi } from 'cyweb/TableApi'

/** `getColumns` when the network's tables are not in the host's store. */
const NETWORK_NOT_FOUND = 'APP1'

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Names of the columns currently in `networkId`'s NODES table, kept in sync
 * with CW. Only the schema is fetched (`getColumns`), never the rows, so this
 * stays cheap on large networks.
 *
 * The set is read at three moments, and each one covers a case the others
 * cannot:
 *
 * 1. WHEN `networkId` CHANGES. The caller gets the id from
 *    `useCurrentNetworkId`, which tracks `network:switched`, so this is "the
 *    user switched networks". It is the only signal for switching back to a
 *    network the host already has in memory: that fires `network:switched`
 *    and nothing else.
 *
 * 2. ON `network:loaded`, for this network only. After a page reload the host
 *    restores just the network summaries and loads a network's tables the
 *    first time it becomes current. `network:switched` fires as soon as the
 *    current id changes, before that async load (IndexedDB or NDEx) lands, so
 *    read 1 fails with `APP1 NETWORK_NOT_FOUND` and leaves the set empty —
 *    every chart button disabled. `network:loaded` is the host saying the
 *    tables are readable now. It is also the only signal for the network that
 *    is current at boot, which gets no `network:switched` at all.
 *
 *    The id check matters: `network:loaded` fires for ANY network whose data
 *    lands, including ones that are not on screen (created without being
 *    shown, or added by another tab). For a new network it even arrives
 *    before `network:switched`; read 1 picks that one up when the switch
 *    follows.
 *
 * 3. ON `data:changed` WITH A SCHEMA CHANGE. `addedColumns`/`removedColumns`
 *    (a rename shows up as one of each) report column edits made anywhere —
 *    an analysis run writing its results, or the user deleting a column in
 *    the table browser. Plain row edits (both arrays empty) are ignored. The
 *    first landing of a network's tables does NOT fire this event; that is
 *    what `network:loaded` is for.
 *
 * No read can be lost between 1 and 2. If the tables land before React
 * re-renders with the new id, the handler still holds the old id and ignores
 * the event, but then read 1 runs against loaded tables and succeeds.
 */
export function useNodeColumnNames(networkId: string): ReadonlySet<string> {
  const tableApi = useTableApi()
  const [columnNames, setColumnNames] = useState<ReadonlySet<string>>(EMPTY)

  /**
   * Reads the schema into state. The host's "no tables for this network
   * (yet)" answer reads as no columns, silently: `network:loaded` follows.
   * Any other failure is logged and also reads as no columns.
   */
  const refresh = useCallback(
    (id: string): void => {
      if (id === '') {
        setColumnNames(EMPTY)
        return
      }
      const result = tableApi.getColumns(id, 'node')
      if (result.success) {
        setColumnNames(new Set(result.data.columns.map((column) => column.name)))
        return
      }
      if (result.error.code !== NETWORK_NOT_FOUND) {
        console.warn('Could not read the node table columns:', result.error.message)
      }
      setColumnNames(EMPTY)
    },
    [tableApi],
  )

  useEffect(() => {
    refresh(networkId)
  }, [refresh, networkId])

  // `useCyWebEvent` holds each handler in a ref, so these inline closures
  // always see the current `networkId` without re-subscribing.
  useCyWebEvent('network:loaded', ({ networkId: loadedNetworkId }) => {
    if (loadedNetworkId !== networkId) return
    refresh(networkId)
  })

  useCyWebEvent('data:changed', ({ networkId: changedNetworkId, tableType, addedColumns, removedColumns }) => {
    if (tableType !== 'node' || changedNetworkId !== networkId) return
    if (addedColumns.length === 0 && removedColumns.length === 0) return
    refresh(networkId)
  })

  return columnNames
}
