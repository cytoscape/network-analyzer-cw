import { useCallback, useState } from 'react'
import { useElementApi } from 'cyweb/ElementApi'
import { useTableApi } from 'cyweb/TableApi'
import { ValueTypeName } from 'cyweb/ApiTypes'

import { ColumnValues } from '../model/networkAnalyzerColumns'
import { IdentifiedEdge } from '../model/networkAnalyzerTypes'
import { setAnalysisResult } from './analysisResultStore'
import { AnalysisCancelledError, useNetworkAnalyzerWorker } from './useNetworkAnalyzerWorker'

export type AnalyzeStatus = 'idle' | 'analyzing' | 'saving'

/** IsSingleNode is the only boolean column — everything else is numeric. */
const BOOLEAN_COLUMNS = new Set(['IsSingleNode'])

function writeColumns(
  tableApi: ReturnType<typeof useTableApi>,
  networkId: string,
  tableType: 'node' | 'edge',
  columns: ColumnValues,
): void {
  for (const [columnName, values] of columns) {
    const isBoolean = BOOLEAN_COLUMNS.has(columnName)
    tableApi.createColumn(
      networkId,
      tableType,
      columnName,
      isBoolean ? ValueTypeName.Boolean : ValueTypeName.Double,
      isBoolean ? false : 0,
    )
    tableApi.setValues(
      networkId,
      tableType,
      [...values].map(([id, value]) => ({ id, column: columnName, value })),
    )
  }
}

/**
 * Returns the Network Analyzer trigger + its live status, shared by the Apps
 * menu form and the results panel form so both behave identically.
 *
 * Fetches nodes/edges via `elementApi` on the main thread (fast, not the
 * bottleneck), runs the actual O(V·(V+E)) analysis in a Web Worker so the tab
 * stays responsive — and cancellable, see useNetworkAnalyzerWorker.ts — then
 * writes the results back via `cyweb/TableApi` in a separate, non-cancellable
 * "saving" phase (a partial column write would leave the tables inconsistent).
 */
export function useAnalyzeNetworkAction(): {
  analyze: (networkId: string, directed: boolean, onComplete?: () => void) => void
  cancel: () => void
  status: AnalyzeStatus
} {
  const elementApi = useElementApi()
  const tableApi = useTableApi()
  const { runInWorker, cancel: cancelWorker } = useNetworkAnalyzerWorker()
  const [status, setStatus] = useState<AnalyzeStatus>('idle')

  const analyze = useCallback(
    (networkId: string, directed: boolean, onComplete?: () => void): void => {
      const wallClockStart = performance.now()

      const nodeIdsResult = elementApi.getNodeIds(networkId)
      const edgesResult = elementApi.getEdges(networkId)
      if (!nodeIdsResult.success || !edgesResult.success) {
        console.error('Failed to read network elements for analysis.')
        return
      }

      const edges: IdentifiedEdge[] = edgesResult.data.edges
      const nodeIds = nodeIdsResult.data.nodeIds

      setStatus('analyzing')
      runInWorker({ nodeIds, edges, directed })
        .then(({ result, nodeColumns, edgeColumns }) => {
          setStatus('saving')
          writeColumns(tableApi, networkId, 'node', nodeColumns)
          writeColumns(tableApi, networkId, 'edge', edgeColumns)

          const wallClockMs = performance.now() - wallClockStart
          console.log(`Network Analyzer — Summary Statistics (${directed ? 'directed' : 'undirected'})`)
          console.table(result)
          console.log(
            `Analysis: ${result.analysisTimeMs.toFixed(2)} ms · Total (fetch + analysis): ${wallClockMs.toFixed(2)} ms`,
          )

          setAnalysisResult(networkId, result)
          setStatus('idle')
          // Called directly here (not inferred from a status transition) —
          // `setStatus('saving')` and this `setStatus('idle')` run in the same
          // tick with no `await` between them, so React 18 batches them into
          // one commit and a caller watching for a 'saving' -> 'idle' render
          // transition would never see it.
          onComplete?.()
        })
        .catch((error: unknown) => {
          if (!(error instanceof AnalysisCancelledError)) {
            console.error('Network analysis failed:', error)
          }
          setStatus('idle')
        })
    },
    [elementApi, tableApi, runInWorker],
  )

  const cancel = useCallback((): void => {
    cancelWorker()
  }, [cancelWorker])

  return { analyze, cancel, status }
}
