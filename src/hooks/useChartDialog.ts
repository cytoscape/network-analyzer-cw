import { useCallback, useState } from 'react'
import { useSelectionApi } from 'cyweb/SelectionApi'
import { useTableApi } from 'cyweb/TableApi'

import { buildHistogramSpec, buildScatterSpec, PlotSpec } from '../model/plotSpecs'

/**
 * State + actions behind the "Node Degree Distribution" and "Betweenness by
 * Degree" buttons.
 *
 * Port of the desktop flow: the analyzer buttons run CyPlot commands
 * (AnalyzerManager.makeDegreeHisto/makeBetweenScatter) whose tasks read the
 * current network's node table columns and open a plot editor window; here the
 * columns come from `cyweb/TableApi` and the editor opens in a dialog
 * (PlotDialog). Plot click/lasso selection maps back to the node selection
 * via `cyweb/SelectionApi` (CyPlot does this with a `network select`
 * cybrowser command keyed by node name; element ids are used here instead).
 *
 * Both modes write a `Degree` column (networkAnalyzerColumns.ts) — total
 * degree (in+out) for directed analyses — so the charts always plot `Degree`.
 */
export function useChartDialog(
  networkId: string,
): {
  plotSpec: PlotSpec | null
  openDegreeHistogram: () => void
  openBetweennessScatter: () => void
  closePlot: () => void
  selectPoints: (indices: number[]) => void
} {
  const tableApi = useTableApi()
  const selectionApi = useSelectionApi()

  const [openPlot, setOpenPlot] = useState<{ spec: PlotSpec; nodeIds: string[] } | null>(null)

  /**
   * Reads the node table once and returns the chart inputs, all in row order:
   * element ids, display names (CyPlot's name column — `name` if present,
   * else the first string column, else the element id), and the values of
   * each requested numeric column. Returns null (with a console warning) if a
   * requested column doesn't exist — e.g. no analysis columns yet.
   */
  const readColumns = useCallback(
    (numericColumns: string[]): { nodeIds: string[]; names: string[]; values: number[][] } | null => {
      const result = tableApi.getTable(networkId, 'node')
      if (!result.success) {
        console.warn('Could not read the node table:', result.error.message)
        return null
      }
      const { columns, rows } = result.data

      const missing = numericColumns.filter((name) => !columns.some((c) => c.name === name))
      if (missing.length > 0) {
        console.warn(`Node table has no "${missing.join('", "')}" column — run an analysis first.`)
        return null
      }

      const stringColumns = columns.filter((c) => c.type === 'string')
      const nameColumn = stringColumns.find((c) => c.name === 'name') ?? stringColumns[0]

      const nodeIds: string[] = []
      const names: string[] = []
      const values: number[][] = numericColumns.map(() => [])
      for (const row of rows) {
        const id = String(row.id)
        nodeIds.push(id)
        const name = nameColumn === undefined ? undefined : row[nameColumn.name]
        names.push(typeof name === 'string' ? name : id)
        numericColumns.forEach((columnName, i) => {
          const value = row[columnName]
          values[i].push(typeof value === 'number' ? value : 0)
        })
      }
      return { nodeIds, names, values }
    },
    [tableApi, networkId],
  )

  const openDegreeHistogram = useCallback((): void => {
    const data = readColumns(['Degree'])
    if (data === null) return
    setOpenPlot({
      spec: buildHistogramSpec('Degree', data.values[0], data.names),
      nodeIds: data.nodeIds,
    })
  }, [readColumns])

  const openBetweennessScatter = useCallback((): void => {
    const data = readColumns(['Degree', 'BetweennessCentrality'])
    if (data === null) return
    setOpenPlot({
      spec: buildScatterSpec('Degree', data.values[0], 'BetweennessCentrality', data.values[1], data.names),
      nodeIds: data.nodeIds,
    })
  }, [readColumns])

  const closePlot = useCallback((): void => setOpenPlot(null), [])

  const selectPoints = useCallback(
    (indices: number[]): void => {
      if (openPlot === null) return
      const nodeIds = indices.filter((i) => i >= 0 && i < openPlot.nodeIds.length).map((i) => openPlot.nodeIds[i])
      if (nodeIds.length > 0) selectionApi.exclusiveSelect(networkId, nodeIds, [])
    },
    [openPlot, selectionApi, networkId],
  )

  return { plotSpec: openPlot?.spec ?? null, openDegreeHistogram, openBetweennessScatter, closePlot, selectPoints }
}
