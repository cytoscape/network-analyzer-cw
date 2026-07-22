"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAnalyzeNetworkAction = useAnalyzeNetworkAction;
const ElementApi_1 = require("cyweb/ElementApi");
const TableApi_1 = require("cyweb/TableApi");
const ApiTypes_1 = require("cyweb/ApiTypes");
const networkAnalyzer_1 = require("../model/networkAnalyzer");
const networkAnalyzerColumns_1 = require("../model/networkAnalyzerColumns");
const networkAnalyzerGraph_1 = require("../model/networkAnalyzerGraph");
const analysisResultStore_1 = require("./analysisResultStore");
/** IsSingleNode is the only boolean column — everything else is numeric. */
const BOOLEAN_COLUMNS = new Set(['IsSingleNode']);
function writeColumns(tableApi, networkId, tableType, columns) {
    for (const [columnName, values] of columns) {
        const isBoolean = BOOLEAN_COLUMNS.has(columnName);
        tableApi.createColumn(networkId, tableType, columnName, isBoolean ? ApiTypes_1.ValueTypeName.Boolean : ApiTypes_1.ValueTypeName.Double, isBoolean ? false : 0);
        tableApi.setValues(networkId, tableType, [...values].map(([id, value]) => ({ id, column: columnName, value })));
    }
}
/**
 * Returns a function that runs the Network Analyzer algorithm against
 * `networkId`, stores the summary result (keyed by network id) for the
 * results panel to pick up, and writes the per-node/per-edge metrics as
 * table columns via `cyweb/TableApi`. Shared by the Apps menu form and the
 * results panel form so both trigger identical behavior.
 */
function useAnalyzeNetworkAction() {
    const elementApi = (0, ElementApi_1.useElementApi)();
    const tableApi = (0, TableApi_1.useTableApi)();
    return (networkId, directed) => {
        const wallClockStart = performance.now();
        const nodeIdsResult = elementApi.getNodeIds(networkId);
        const edgeIdsResult = elementApi.getEdgeIds(networkId);
        if (!nodeIdsResult.success || !edgeIdsResult.success) {
            console.error('Failed to read network elements for analysis.');
            return;
        }
        const edges = edgeIdsResult.data.edgeIds.flatMap((edgeId) => {
            const edgeResult = elementApi.getEdge(networkId, edgeId);
            return edgeResult.success ? [{ id: edgeId, ...edgeResult.data }] : [];
        });
        const nodeIds = nodeIdsResult.data.nodeIds;
        const result = (0, networkAnalyzer_1.analyzeNetwork)(nodeIds, edges, { directed });
        const graph = (0, networkAnalyzerGraph_1.buildGraph)(nodeIds, edges);
        const { nodeColumns, edgeColumns } = (0, networkAnalyzerColumns_1.computeNetworkAnalyzerColumns)(graph, edges, { directed });
        writeColumns(tableApi, networkId, 'node', nodeColumns);
        writeColumns(tableApi, networkId, 'edge', edgeColumns);
        const wallClockMs = performance.now() - wallClockStart;
        console.log(`Network Analyzer — Summary Statistics (${directed ? 'directed' : 'undirected'})`);
        console.table(result);
        console.log(`Analysis: ${result.analysisTimeMs.toFixed(2)} ms · Total (fetch + analysis): ${wallClockMs.toFixed(2)} ms`);
        (0, analysisResultStore_1.setAnalysisResult)(networkId, result);
    };
}
