import { useCallback, useEffect, useState } from 'react'
import { useCyWebEvent } from 'cyweb/EventBus'
import { useTableApi } from 'cyweb/TableApi'

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
 */
export function useNodeColumnNames(networkId: string): ReadonlySet<string> {
  const tableApi = useTableApi()
  const [columnNames, setColumnNames] = useState<ReadonlySet<string>>(() => new Set())

  const refresh = useCallback(
    (id: string): void => {
      if (id === '') {
        setColumnNames(new Set())
        return
      }
      const result = tableApi.getColumns(id, 'node')
      if (!result.success) {
        console.warn('Could not read the node table columns:', result.error.message)
        setColumnNames(new Set())
        return
      }
      setColumnNames(new Set(result.data.columns.map((column) => column.name)))
    },
    [tableApi],
  )

  useEffect(() => {
    refresh(networkId)
  }, [refresh, networkId])

  // `useCyWebEvent` holds the handler in a ref, so this inline closure always
  // sees the current `networkId` without re-subscribing.
  useCyWebEvent('data:changed', ({ networkId: changedNetworkId, tableType, addedColumns, removedColumns }) => {
    if (tableType !== 'node' || changedNetworkId !== networkId) return
    if (addedColumns.length === 0 && removedColumns.length === 0) return
    refresh(networkId)
  })

  return columnNames
}
