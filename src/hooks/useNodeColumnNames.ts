import { useCallback, useEffect, useState } from 'react'
import { useCyWebEvent } from 'cyweb/EventBus'
import { useTableApi } from 'cyweb/TableApi'

/**
 * How often to look again for a network whose tables the host has not loaded
 * yet (see `useNodeColumnNames`). One synchronous store lookup per attempt,
 * so a short interval costs nothing noticeable.
 */
const NOT_LOADED_RETRY_MS = 250

/** `getColumns` when the network's tables are not in the host's store. */
const NETWORK_NOT_FOUND = 'APP1'

const EMPTY: ReadonlySet<string> = new Set()

/**
 * Names of the columns currently in `networkId`'s NODES table, kept in sync
 * with CW.
 *
 * The set is re-read whenever CW reports a schema change for that table:
 * `data:changed` carries `addedColumns`/`removedColumns` (a rename shows up as
 * one of each), so column edits made anywhere — an analysis run writing its
 * results, or the user deleting a column in the table browser — are picked up.
 * Plain row edits (both arrays empty) are ignored.
 *
 * Only the schema is fetched (`getColumns`), never the rows, so this stays
 * cheap on large networks.
 *
 * NOT-YET-LOADED NETWORKS. After a page reload the host loads a network's
 * tables lazily, the first time it becomes current: `network:switched` fires
 * as soon as the current id changes, and the tables land in the store only
 * once the async load (IndexedDB or NDEx) completes. In that gap `getColumns`
 * fails with `APP1 NETWORK_NOT_FOUND` — and the host's `data:changed` bridge
 * deliberately skips a network whose tables were absent before, so the load
 * itself fires no event. Without a second look the set would stay empty until
 * the next switch, with every chart button disabled. So a not-found read is
 * retried on a timer until the tables are there, or the network changes.
 */
export function useNodeColumnNames(networkId: string): ReadonlySet<string> {
  const tableApi = useTableApi()
  const [columnNames, setColumnNames] = useState<ReadonlySet<string>>(EMPTY)

  /**
   * One read of the schema. `'not-loaded'` is the host's "no tables for this
   * network (yet)" answer; any other failure is logged and reads as no columns.
   */
  const readColumnNames = useCallback(
    (id: string): ReadonlySet<string> | 'not-loaded' => {
      if (id === '') return EMPTY
      const result = tableApi.getColumns(id, 'node')
      if (result.success) {
        return new Set(result.data.columns.map((column) => column.name))
      }
      if (result.error.code === NETWORK_NOT_FOUND) return 'not-loaded'
      console.warn('Could not read the node table columns:', result.error.message)
      return EMPTY
    },
    [tableApi],
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const attempt = (): void => {
      timer = null
      const names = readColumnNames(networkId)
      if (names === 'not-loaded') {
        setColumnNames(EMPTY)
        timer = setTimeout(attempt, NOT_LOADED_RETRY_MS)
        return
      }
      setColumnNames(names)
    }
    attempt()

    // A pending retry belongs to this network; the next one starts its own.
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [readColumnNames, networkId])

  // `useCyWebEvent` holds the handler in a ref, so this inline closure always
  // sees the current `networkId` without re-subscribing. No retry needed here:
  // a table that just reported a schema change is loaded by definition.
  useCyWebEvent('data:changed', ({ networkId: changedNetworkId, tableType, addedColumns, removedColumns }) => {
    if (tableType !== 'node' || changedNetworkId !== networkId) return
    if (addedColumns.length === 0 && removedColumns.length === 0) return
    const names = readColumnNames(networkId)
    setColumnNames(names === 'not-loaded' ? EMPTY : names)
  })

  return columnNames
}
