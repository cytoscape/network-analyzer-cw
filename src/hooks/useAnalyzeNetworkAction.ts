import { useElementApi } from 'cyweb/ElementApi'
import { useTableApi } from 'cyweb/TableApi'
import { ValueTypeName } from 'cyweb/ApiTypes'

import { analyzeNetwork } from '../model/networkAnalyzer'
import { ColumnValues, computeNetworkAnalyzerColumns } from '../model/networkAnalyzerColumns'
import { buildGraph } from '../model/networkAnalyzerGraph'
import { IdentifiedEdge } from '../model/networkAnalyzerTypes'
import { setAnalysisResult } from './analysisResultStore'

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
 * Returns a function that runs the Network Analyzer algorithm against
 * `networkId`, stores the summary result (keyed by network id) for the
 * results panel to pick up, and writes the per-node/per-edge metrics as
 * table columns via `cyweb/TableApi`. Shared by the Apps menu form and the
 * results panel form so both trigger identical behavior.
 */
export function useAnalyzeNetworkAction(): (networkId: string, directed: boolean) => void {
  const elementApi = useElementApi()
  const tableApi = useTableApi()

  return (networkId: string, directed: boolean): void => {
    const wallClockStart = performance.now()

    const nodeIdsResult = elementApi.getNodeIds(networkId)
    const edgeIdsResult = elementApi.getEdgeIds(networkId)
    if (!nodeIdsResult.success || !edgeIdsResult.success) {
      console.error('Failed to read network elements for analysis.')
      return
    }

    const edges: IdentifiedEdge[] = edgeIdsResult.data.edgeIds.flatMap((edgeId) => {
      const edgeResult = elementApi.getEdge(networkId, edgeId)
      return edgeResult.success ? [{ id: edgeId, ...edgeResult.data }] : []
    })
    const nodeIds = nodeIdsResult.data.nodeIds

    const result = analyzeNetwork(nodeIds, edges, { directed })

    const graph = buildGraph(nodeIds, edges)
    const { nodeColumns, edgeColumns } = computeNetworkAnalyzerColumns(graph, edges, { directed })
    writeColumns(tableApi, networkId, 'node', nodeColumns)
    writeColumns(tableApi, networkId, 'edge', edgeColumns)

    const wallClockMs = performance.now() - wallClockStart

    console.log(`Network Analyzer — Summary Statistics (${directed ? 'directed' : 'undirected'})`)
    console.table(result)
    console.log(
      `Analysis: ${result.analysisTimeMs.toFixed(2)} ms · Total (fetch + analysis): ${wallClockMs.toFixed(2)} ms`,
    )

    setAnalysisResult(networkId, result)
  }
}
